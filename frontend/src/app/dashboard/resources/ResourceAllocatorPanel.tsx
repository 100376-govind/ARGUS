"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import ResourceMapView from "@/components/map/ResourceMapView";

interface AllocationDetails {
  incidentId: string;
  status: "pending" | "allocated";
  eta: number | null;
  distance: number | null;
  routeStatus: "Optimal" | "Delayed" | "CriticalDelay";
  estimatedArrival: string | null;
  allocation: {
    allocatedResources: Array<{
      resourceId: string;
      resourceName: string;
      resourceType: string;
      compositeRank: number;
      capabilityScore: number;
      etaMinutes: number;
      distanceKm: number;
    }>;
    resourceScore: number;
    selectedTeams: {
      primary: { teamId: string; memberCount: number; avgCapabilityScore: number };
      backup: { teamId: string; memberCount: number; avgCapabilityScore: number };
    };
    hospitals: Array<{ resourceId: string; name: string; availableBeds: number; icuAvailable: boolean }>;
    shelters: Array<{ resourceId: string; name: string; remainingCapacity: number }>;
    estimatedCapacity: {
      totalResponders: number;
      totalVehicles: number;
      medicalUnits: number;
      rescueUnits: number;
      hospitalBeds: number;
      shelterSpaces: number;
    };
    allocationTimestamp: string;
  } | null;
  dispatchPlan: Array<{
    resourceId: string;
    resourceName: string;
    resourceType: string;
    dispatchSequenceOrder: number;
    route: {
      distanceKm: number;
      durationMinutes: number;
      trafficDelayMinutes: number;
      estimatedArrivalTime: string;
      dispatchTime: string;
      routeStatus: "Optimal" | "Delayed" | "CriticalDelay";
    };
  }> | null;
}

export default function ResourceAllocatorDashboard() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>("");
  const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  
  // Loading & error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // Fetch all incidents
  useEffect(() => {
    async function loadIncidents() {
      try {
        const res = await fetch("http://localhost:3001/api/incidents", {
          headers: { Authorization: "Bearer mock-admin-token" },
        });
        if (res.ok) {
          const json = await res.json();
          setIncidents(json.data || []);
          if (json.data && json.data.length > 0) {
            setSelectedIncidentId(json.data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load incidents", err);
      }
    }
    loadIncidents();
  }, []);

  // Fetch allocation data
  const fetchAllocationData = async (incidentId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [detailsRes, historyRes] = await Promise.all([
        fetch(`http://localhost:3001/api/resource-allocator/${incidentId}`, {
          headers: { Authorization: "Bearer mock-admin-token" },
        }),
        fetch(`http://localhost:3001/api/resource-allocator/history/${incidentId}`, {
          headers: { Authorization: "Bearer mock-admin-token" },
        }),
      ]);

      if (detailsRes.ok && historyRes.ok) {
        const detailsJson = await detailsRes.json();
        const historyJson = await historyRes.json();
        setAllocation(detailsJson.data);
        setHistory(historyJson.data || []);
      } else {
        setError("Resource allocation metrics unavailable for this incident.");
      }
    } catch (err) {
      setError("Failed to communicate with ARGUS Resource Allocator API.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedIncidentId) {
      fetchAllocationData(selectedIncidentId);
    }
  }, [selectedIncidentId]);

  // Set up real-time Socket.io listener
  useEffect(() => {
    const socket = io("http://localhost:3001/risk", {
      path: "/socket.io",
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to risk/allocation namespace");
    });

    socket.on("dashboardUpdated", (data: any) => {
      if (data.incidentId === selectedIncidentId) {
        fetchAllocationData(selectedIncidentId);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedIncidentId]);

  // Handle room subscription
  useEffect(() => {
    if (socketRef.current && selectedIncidentId) {
      socketRef.current.emit("subscribe:incident", selectedIncidentId);
    }
  }, [selectedIncidentId]);

  const triggerAllocation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:3001/api/risk/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-admin-token",
        },
        body: JSON.stringify({ incidentId: selectedIncidentId }),
      });
      if (!res.ok) {
        throw new Error("Trigger failed");
      }
    } catch (err) {
      setError("Failed to run automated resource allocator. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Compile markers for Map
  const mapMarkers: any[] = [];
  const routePath: google.maps.LatLngLiteral[] = [];

  // Command base coordinates
  const commandBase = { lat: 22.557827, lng: 88.496820 };

  if (allocation?.allocation) {
    // Add command base marker
    mapMarkers.push({
      id: "command-base",
      name: "Tactical Command Base",
      type: "Incident",
      lat: commandBase.lat,
      lng: commandBase.lng,
      pulse: true,
    });

    // Add responder markers
    allocation.allocation.allocatedResources.forEach((r: any, idx: number) => {
      // Offset locations slightly around base for visual clarity
      const offsetLat = commandBase.lat + Math.sin(idx * 1.5) * 0.015;
      const offsetLng = commandBase.lng + Math.cos(idx * 1.5) * 0.015;

      mapMarkers.push({
        id: r.resourceId,
        name: r.resourceName,
        type: r.resourceType,
        lat: offsetLat,
        lng: offsetLng,
      });

      // Simple route path generation linking responder to base
      if (idx === 0) {
        routePath.push({ lat: offsetLat, lng: offsetLng });
        routePath.push(commandBase);
      }
    });
  }

  return (
    <div className="p-6 flex flex-col gap-6 text-on-surface select-none font-[var(--font-geist)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="font-[var(--font-inter)] text-2xl font-bold tracking-wider text-primary-fixed-dim flex items-center gap-2">
            <span className="material-symbols-outlined text-[28px] animate-pulse">route</span>
            Smart Resource Allocation Panel
          </h1>
          <p className="text-xs text-outline-variant uppercase tracking-widest mt-1">
            Phase 4.45 Real-Time Routing, ETA Mapping & Dispatch Sequencing
          </p>
        </div>

        {/* Dropdown Selector */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedIncidentId}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            className="bg-surface-container-highest border border-outline-variant/35 px-4 py-2 text-sm text-on-surface font-semibold focus:outline-none uppercase rounded-sm"
          >
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.id} - {inc.incidentType}
              </option>
            ))}
          </select>

          <button
            onClick={triggerAllocation}
            className="px-5 py-2 text-sm font-semibold uppercase bg-primary-fixed-dim/15 border border-primary-fixed-dim text-primary-fixed-dim hover:bg-primary-fixed-dim/20 transition-all rounded-sm"
          >
            Re-run Allocator
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 glass-panel h-80 animate-pulse bg-surface-container-highest/20 rounded-sm" />
          <div className="glass-panel h-80 animate-pulse bg-surface-container-highest/20 rounded-sm" />
        </div>
      ) : error ? (
        <div className="p-6 border border-error/35 bg-error/10 text-error flex flex-col items-center justify-center gap-2 rounded-sm">
          <span className="material-symbols-outlined text-[36px]">error</span>
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={() => selectedIncidentId && fetchAllocationData(selectedIncidentId)}
            className="mt-2 px-4 py-1.5 bg-error/20 hover:bg-error/35 transition-all text-xs font-bold uppercase rounded-sm"
          >
            Retry Sync
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          
          {/* Dispatch Status Cards */}
          <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
            <div className="glass-panel p-5 relative rounded-sm">
              <h2 className="text-xs font-bold tracking-widest text-outline-variant uppercase mb-3">Dispatch Summary</h2>
              
              <div className="flex flex-col gap-3">
                <div className="flex justify-between border-b border-outline-variant/20 pb-2">
                  <span className="text-sm text-outline">Priority</span>
                  <span className="text-sm font-bold text-error">{allocation?.priority}</span>
                </div>
                <div className="flex justify-between border-b border-outline-variant/20 pb-2">
                  <span className="text-sm text-outline">Resource Score</span>
                  <span className="text-sm font-bold text-primary">{allocation?.allocation?.resourceScore}%</span>
                </div>
                <div className="flex justify-between border-b border-outline-variant/20 pb-2">
                  <span className="text-sm text-outline">ETA (Arrival)</span>
                  <span className="text-sm font-bold text-cyan-400">{allocation?.eta} mins</span>
                </div>
                <div className="flex justify-between border-b border-outline-variant/20 pb-2">
                  <span className="text-sm text-outline">Route status</span>
                  <span className="text-sm font-bold uppercase text-green-400">{allocation?.routeStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-outline">Total Distance</span>
                  <span className="text-sm font-bold text-purple-400">{allocation?.distance} km</span>
                </div>
              </div>
            </div>

            {/* Selected Teams Roster */}
            <div className="glass-panel p-5 relative rounded-sm flex-1">
              <h2 className="text-xs font-bold tracking-widest text-outline-variant uppercase mb-3">Primary & Backup Teams</h2>
              
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-surface-container-highest/35 border border-outline-variant/20 rounded-sm">
                  <span className="text-xs text-primary font-bold tracking-wider">PRIMARY TEAM</span>
                  <div className="flex justify-between mt-1 text-sm">
                    <span>Units: {allocation?.allocation?.selectedTeams.primary.memberCount}</span>
                    <span>Avg Score: {allocation?.allocation?.selectedTeams.primary.avgCapabilityScore}%</span>
                  </div>
                </div>

                <div className="p-3 bg-surface-container-highest/20 border border-outline-variant/10 rounded-sm">
                  <span className="text-xs text-outline font-bold tracking-wider">BACKUP TEAM</span>
                  <div className="flex justify-between mt-1 text-sm">
                    <span>Units: {allocation?.allocation?.selectedTeams.backup.memberCount}</span>
                    <span>Avg Score: {allocation?.allocation?.selectedTeams.backup.avgCapabilityScore}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Map and Route View */}
          <div className="col-span-12 md:col-span-8 glass-panel rounded-sm relative min-h-[350px] overflow-hidden">
            <ResourceMapView markers={mapMarkers} routePath={routePath} />
            <div className="absolute top-4 left-4 bg-surface-container-lowest/80 border border-outline-variant/50 px-3 py-1 font-[var(--font-geist)] text-[10px] tracking-wider font-bold text-primary z-20 rounded-sm">
              OPTIMIZED CRISIS ROUTE
            </div>
          </div>

          {/* Dispatch Sequence Timeline */}
          <div className="col-span-12 md:col-span-6 glass-panel p-5 rounded-sm">
            <h2 className="text-xs font-bold tracking-widest text-outline-variant uppercase mb-4">Optimal Dispatch Sequence</h2>
            <div className="flex flex-col gap-3">
              {allocation?.dispatchPlan?.map((item) => (
                <motion.div
                  key={item.resourceId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 bg-surface-container-highest/30 border border-outline-variant/20 rounded-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500 text-cyan-400 flex items-center justify-center text-xs font-bold">
                      {item.dispatchSequenceOrder}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-on-surface">{item.resourceName}</h4>
                      <p className="text-xs text-outline">{item.resourceType}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-cyan-400">{item.route.durationMinutes} mins</span>
                    <p className="text-xs text-outline">{item.route.distanceKm} km</p>
                  </div>
                </motion.div>
              )) || <p className="text-sm text-outline">No dispatch items scheduled</p>}
            </div>
          </div>

          {/* Assigned Facilities */}
          <div className="col-span-12 md:col-span-6 glass-panel p-5 rounded-sm">
            <h2 className="text-xs font-bold tracking-widest text-outline-variant uppercase mb-4">Assigned Medical & Shelter Facilities</h2>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-xs font-bold text-purple-400 tracking-wider uppercase mb-2">Hospitals</h3>
                {allocation?.allocation?.hospitals.map(h => (
                  <div key={h.resourceId} className="flex justify-between text-sm border-b border-outline-variant/15 pb-2">
                    <span>{h.name}</span>
                    <span className="font-bold text-outline-variant">Beds Available: {h.availableBeds}</span>
                  </div>
                )) || <p className="text-xs text-outline">No hospitals assigned</p>}
              </div>

              <div>
                <h3 className="text-xs font-bold text-green-400 tracking-wider uppercase mb-2">Shelters</h3>
                {allocation?.allocation?.shelters.map(s => (
                  <div key={s.resourceId} className="flex justify-between text-sm border-b border-outline-variant/15 pb-2">
                    <span>{s.name}</span>
                    <span className="font-bold text-outline-variant">Remaining Space: {s.remainingCapacity}</span>
                  </div>
                )) || <p className="text-xs text-outline">No shelters assigned</p>}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
