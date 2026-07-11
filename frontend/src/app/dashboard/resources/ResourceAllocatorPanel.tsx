"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import ResourceMapView from "@/components/map/ResourceMapView";
import incidentsData from "@/data/incidents.json";
import type { Incident } from "@/types";

const incidents = incidentsData as Incident[];

// Helper to calculate centroid coordinates of reports
const getCentroid = (reports: Incident[]) => {
  let latSum = 0, lngSum = 0, count = 0;
  reports.forEach(r => {
    if (r.coordinates) {
      latSum += r.coordinates.lat;
      lngSum += r.coordinates.lng;
      count++;
    }
  });
  return count > 0 ? { lat: latSum / count, lng: lngSum / count } : undefined;
};

// Haversine formula to calculate distance in km
const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// computeCorrelation for a single report (used to evaluate baseline AI confidence)
const computeCorrelation = (current: Incident) => {
  const others = incidents.filter(i => i.id !== current.id);
  const tokenize = (t: string) => new Set((t || "").toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(w => w.length > 2));
  const jaccard = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; const inter = [...a].filter(x => b.has(x)).length; return Math.round((inter / new Set([...a, ...b]).size) * 100); };
  const locSim = (c: Incident, o: Incident) => { if (c.coordinates && o.coordinates) { const d = haversine(c.coordinates.lat, c.coordinates.lng, o.coordinates.lat, o.coordinates.lng); if (d <= 0.5) return 100; if (d <= 2) return 80; if (d <= 5) return 50; if (d <= 10) return 20; return 0; } return c.location === o.location ? 100 : 0; };
  const typeSim = (a: string, b: string) => { const x = a.toLowerCase(), y = b.toLowerCase(); return x === y ? 100 : (x.includes(y) || y.includes(x)) ? 50 : 0; };
  const timeSim = (a: string, b: string) => { const h = Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3600000; if (h <= 1) return 100; if (h <= 4) return 80; if (h <= 12) return 50; if (h <= 24) return 20; return 0; };

  const curTokens = tokenize(`${current.type} ${current.location} ${current.description || ""}`);
  const supporting: any[] = [];
  let best: any = null, maxSim = 0;

  for (const o of others) {
    const kw = jaccard(curTokens, tokenize(`${o.type} ${o.location} ${o.description || ""}`));
    const loc = locSim(current, o);
    const typ = typeSim(current.type, o.type);
    const tm = timeSim(current.timestamp, o.timestamp);
    const hasLoc = !!(current.coordinates && o.coordinates);
    const overall = hasLoc ? Math.round(kw * 0.25 + loc * 0.35 + typ * 0.25 + tm * 0.15) : Math.round(kw * 0.4 + typ * 0.4 + tm * 0.2);
    if (overall >= 50) supporting.push({ incidentId: o.id.replace("#", ""), overallSimilarity: overall, keywordSimilarity: kw, locationSimilarity: loc, incidentSimilarity: typ, timeSimilarity: tm });
    if (overall > maxSim) { maxSim = overall; best = { kw, loc, typ, tm, id: o.id.replace("#", ""), overall }; }
  }
  supporting.sort((a, b) => b.overallSimilarity - a.overallSimilarity);
  return { best, supporting: supporting.slice(0, 5), confidence: maxSim };
};

const generateRecommendations = (location: string, reports: Incident[], valConfidence?: number) => {
  const totalReports = reports.length;
  
  // Dominant Type
  const typeCounts: Record<string, number> = {};
  reports.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const dominantType = sortedTypes[0]?.[0] || "Unknown";

  // Severity
  const severities = reports.map(r => r.severity || "Medium");
  const hasCritical = severities.some(s => s.toLowerCase() === "critical");
  const hasHigh = severities.some(s => s.toLowerCase() === "high");
  const severity = hasCritical ? "Critical" : hasHigh ? "High" : "Medium";

  // Validation Confidence
  const confidence = valConfidence || (reports.length > 0 ? Math.round(reports.reduce((acc, curr) => acc + (computeCorrelation(curr).confidence || 80), 0) / reports.length) : 85);

  // Recommendations Math
  const personnelCount = totalReports * 8 + (severity === "Critical" ? 50 : 20);
  const medicalTeams = Math.ceil(totalReports / 4) + (dominantType === "Medical" || dominantType === "Earthquake" ? 3 : 1);
  const fireUnits = (dominantType === "Fire" || dominantType === "Explosion" || dominantType === "Building Collapse") ? Math.ceil(totalReports / 3) + 2 : 0;
  const policeSAR = Math.ceil(totalReports / 3) + (dominantType === "Civil Unrest" || dominantType === "Earthquake" ? 4 : 2);
  const ambulances = Math.ceil(totalReports / 2) + 1;
  const reliefSupplies = totalReports * 50 + " Food/Water Packs";
  const heavyEquipment = (dominantType === "Earthquake" || dominantType === "Building Collapse" || dominantType === "Bridge Collapse") 
    ? "2 Excavators, 1 Mobile Crane" 
    : "Not Required";

  // Facilities
  const hospitals = [
    { resourceId: `${location}-HOSP-1`, name: `${location} General Hospital`, availableBeds: 24, icuAvailable: true },
    { resourceId: `${location}-HOSP-2`, name: `Apex Trauma Care ${location}`, availableBeds: 12, icuAvailable: false }
  ];
  
  const shelters = [
    { resourceId: `${location}-SHELT-1`, name: `${location} Primary Shelter`, remainingCapacity: 150 },
    { resourceId: `${location}-SHELT-2`, name: `St. Mary Community Hall`, remainingCapacity: 80 }
  ];

  // ETA and Priority
  const eta = dominantType === "Earthquake" ? 8 : 12;
  const distance = Math.round(eta * 1.15 * 10) / 10;

  // Nearest available units and sequence mapping
  const nearestUnits = [
    { id: "UNIT-1", name: `${location} Central Police/SAR`, type: "Police/SAR", eta: 4, dist: 3.1 },
    { id: "UNIT-2", name: `NDRF Sector-${totalReports} Station`, type: "Rescue/Heavy", eta: 6, dist: 4.8 },
    { id: "UNIT-3", name: `Fire & Hazmat Station`, type: "FireTruck", eta: 8, dist: 6.2 },
    { id: "UNIT-4", name: `District Trauma Ambulance`, type: "Ambulance", eta: 9, dist: 7.1 },
  ].filter(u => {
    if (u.type === "FireTruck" && fireUnits === 0) return false;
    return true;
  });

  const allocatedResources = nearestUnits.map((u, idx) => ({
    resourceId: u.id,
    resourceName: u.name,
    resourceType: u.type,
    compositeRank: idx + 1,
    capabilityScore: 92 - idx * 4,
    etaMinutes: u.eta,
    distanceKm: u.dist
  }));

  const dispatchPlan = nearestUnits.map((u, idx) => ({
    resourceId: u.id,
    resourceName: u.name,
    resourceType: u.type,
    dispatchSequenceOrder: idx + 1,
    route: {
      distanceKm: u.dist,
      durationMinutes: u.eta,
      trafficDelayMinutes: idx * 2,
      estimatedArrivalTime: new Date(Date.now() + u.eta * 60000).toLocaleTimeString(),
      dispatchTime: new Date().toLocaleTimeString(),
      routeStatus: "Optimal" as const
    }
  }));

  return {
    allocationResult: {
      incidentId: location,
      status: "allocated" as const,
      eta,
      distance,
      routeStatus: "Optimal" as const,
      estimatedArrival: new Date(Date.now() + eta * 60000).toLocaleTimeString(),
      allocation: {
        allocatedResources,
        resourceScore: confidence,
        selectedTeams: {
          primary: { teamId: `${location}-PRIMARY`, memberCount: allocatedResources.length, avgCapabilityScore: 90 },
          backup: { teamId: `${location}-BACKUP`, memberCount: 3, avgCapabilityScore: 82 }
        },
        hospitals,
        shelters,
        estimatedCapacity: {
          totalResponders: personnelCount,
          totalVehicles: fireUnits + policeSAR + ambulances,
          medicalUnits: medicalTeams,
          rescueUnits: policeSAR,
          hospitalBeds: 36,
          shelterSpaces: 230
        },
        allocationTimestamp: new Date().toISOString()
      },
      dispatchPlan
    },
    recommendations: {
      personnelCount,
      medicalTeams,
      fireUnits,
      policeSAR,
      ambulances,
      reliefSupplies,
      heavyEquipment,
      nearestUnits: nearestUnits.map(u => u.name).join(", ")
    }
  };
};

export default function ResourceAllocatorDashboard() {
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [customValData, setCustomValData] = useState<Record<string, any>>({});
  const [dynamicHospitals, setDynamicHospitals] = useState<any[] | null>(null);
  const [dynamicShelters, setDynamicShelters] = useState<any[] | null>(null);

  // Stable callbacks for Places search results
  const handleHospitalsFound = useCallback((hospitals: any[]) => {
    setDynamicHospitals(hospitals);
  }, []);
  const handleSheltersFound = useCallback((shelters: any[]) => {
    setDynamicShelters(shelters);
  }, []);

  // Sync validation data from localStorage
  useEffect(() => {
    const loadCustomVal = () => {
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("argus-custom-validation-data");
          if (stored) {
            setCustomValData(JSON.parse(stored));
          }
        } catch (e) {
          console.error("Failed to load custom validation data", e);
        }
      }
    };

    loadCustomVal();

    // Listen for storage updates
    window.addEventListener("storage", loadCustomVal);
    const interval = setInterval(loadCustomVal, 1000);

    return () => {
      window.removeEventListener("storage", loadCustomVal);
      clearInterval(interval);
    };
  }, []);

  // Group all incidents by location
  const groupedByLocation = useMemo(() => {
    const groups: Record<string, Incident[]> = {};
    for (const inc of incidents) {
      if (!groups[inc.location]) groups[inc.location] = [];
      groups[inc.location].push(inc);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  // Filter to validated locations only
  const validatedLocations = useMemo(() => {
    const valid: string[] = [];
    for (const [location, reports] of groupedByLocation) {
      if (customValData[location]) {
        valid.push(location);
        continue;
      }

      // Run 7 baseline checks
      const multipleReports = reports.length > 1;
      const typeCounts: Record<string, number> = {};
      reports.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
      const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
      const dominantType = sortedTypes[0]?.[0] || "Unknown";
      const maxTypeCount = sortedTypes[0]?.[1] || 0;
      const typeConsistent = reports.length > 0 && (maxTypeCount / reports.length >= 0.8);

      const times = reports.map(r => new Date(r.timestamp).getTime());
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const withinTimeWindow = reports.length > 0 && (maxTime - minTime <= 2 * 3600000);

      let maxDist = 0;
      let hasCoords = false;
      for (let i = 0; i < reports.length; i++) {
        for (let j = i + 1; j < reports.length; j++) {
          const c1 = reports[i].coordinates;
          const c2 = reports[j].coordinates;
          if (c1 && c2) {
            hasCoords = true;
            const d = haversine(c1.lat, c1.lng, c2.lat, c2.lng);
            if (d > maxDist) maxDist = d;
          }
        }
      }
      const withinLocThreshold = !hasCoords || (maxDist <= 3.0);

      const confidences = reports.map(r => computeCorrelation(r).confidence);
      const maxConfidence = confidences.length > 0 ? Math.max(...confidences) : 0;
      const aiConfidenceExceeds = maxConfidence >= 75;

      const mediaVerified = reports.some(r => ["resolved", "dispatched", "in-progress"].includes(r.status.toLowerCase()) || r.reportSource === "IoT Sensor");
      const trustedSourceExists = reports.some(r => ["Patrol Unit", "IoT Sensor", "Emergency Call"].includes(r.reportSource));

      const isValidated = multipleReports && typeConsistent && withinTimeWindow && withinLocThreshold && aiConfidenceExceeds && mediaVerified && trustedSourceExists;

      if (isValidated) {
        valid.push(location);
      }
    }
    return valid;
  }, [groupedByLocation, customValData]);

  // Handle selected location auto fallback
  useEffect(() => {
    if (validatedLocations.length > 0 && !validatedLocations.includes(selectedLocation)) {
      setSelectedLocation(validatedLocations[0]);
    }
  }, [validatedLocations, selectedLocation]);

  const activeLocation = useMemo(() => {
    if (validatedLocations.includes(selectedLocation)) {
      return selectedLocation;
    }
    return validatedLocations[0] || "";
  }, [validatedLocations, selectedLocation]);

  // Reset dynamic facilities when active location changes
  useEffect(() => {
    setDynamicHospitals(null);
    setDynamicShelters(null);
  }, [activeLocation]);

  const activeReports = useMemo(() => {
    if (!activeLocation) return [];
    return incidents.filter(i => i.location === activeLocation);
  }, [activeLocation]);

  const { allocation, recommendations, selectedIncident } = useMemo(() => {
    if (!activeLocation || activeReports.length === 0) {
      return { allocation: null, recommendations: null, selectedIncident: null };
    }

    const valConfidence = customValData[activeLocation]?.validationConfidence;
    const { allocationResult, recommendations: recs } = generateRecommendations(
      activeLocation,
      activeReports,
      valConfidence
    );

    const centroid = getCentroid(activeReports);
    const selectedIncidentRepresentation = {
      id: activeLocation,
      coordinates: centroid
    };

    return {
      allocation: allocationResult,
      recommendations: recs,
      selectedIncident: selectedIncidentRepresentation
    };
  }, [activeLocation, activeReports, customValData]);

  // If no locations are validated yet, show "Awaiting Validation" screen
  if (validatedLocations.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] p-[var(--spacing-gutter)] gap-[var(--spacing-panel-gap)] text-on-surface font-[var(--font-geist)]">
        <div className="flex-1 flex flex-col gap-6">
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
          </div>

          <div className="flex-1 flex flex-col items-center justify-center border border-outline-variant/15 bg-surface-container-lowest/30 rounded-sm relative overflow-hidden">
            <span className="material-symbols-outlined text-[48px] text-outline-variant animate-pulse mb-3">
              hourglass_empty
            </span>
            <h2 className="text-lg font-[var(--font-inter)] font-semibold text-primary-fixed-dim uppercase tracking-wider">
              Awaiting Validation
            </h2>
            <p className="text-xs text-outline mt-1.5 max-w-md text-center leading-relaxed">
              No locations have been validated yet. Run the validator in the Validator Control Hub to authorize dispatch.
            </p>
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-outline-variant/50" />
          </div>
        </div>
      </div>
    );
  }

  // Determine which facilities to display (dynamic from Google Places or fallback)
  const displayHospitals = dynamicHospitals && dynamicHospitals.length > 0
    ? dynamicHospitals
    : allocation?.allocation?.hospitals || [];
  const displayShelters = dynamicShelters && dynamicShelters.length > 0
    ? dynamicShelters
    : allocation?.allocation?.shelters || [];

  // Compile markers for Map
  const mapMarkers: any[] = [];
  const mapRoutes: { path: { lat: number; lng: number }[]; color?: string; glowColor?: string; label?: string }[] = [];
  const locationCentroid = selectedIncident?.coordinates || { lat: 22.557827, lng: 88.496820 };

  if (allocation?.allocation) {
    // Add command base marker
    mapMarkers.push({
      id: "command-base",
      name: `${activeLocation} Incident Centroid`,
      type: "Incident",
      lat: locationCentroid.lat,
      lng: locationCentroid.lng,
      pulse: true,
    });

    // Helper: Haversine distance in km
    const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371;
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const sinLat = Math.sin(dLat / 2);
      const sinLng = Math.sin(dLng / 2);
      const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
      return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    };

    // Build responder positions and add routes for ALL responders to the incident
    const responderPositions = allocation.allocation.allocatedResources.map((r, idx) => {
      const offsetLat = locationCentroid.lat + Math.sin(idx * 1.5) * 0.015;
      const offsetLng = locationCentroid.lng + Math.cos(idx * 1.5) * 0.015;
      const pos = { lat: offsetLat, lng: offsetLng };

      // Add route from this responder to incident
      mapRoutes.push({
        path: [pos, locationCentroid],
        color: "#00DAF3",
        glowColor: "#00B4D8",
        label: `${r.resourceName} Route`,
      });

      return {
        ...r,
        lat: offsetLat,
        lng: offsetLng,
      };
    });

    // Add all responder markers
    responderPositions.forEach((r) => {
      mapMarkers.push({
        id: r.resourceId,
        name: r.resourceName,
        type: r.resourceType,
        lat: r.lat,
        lng: r.lng,
      });
    });

    // Add all hospital markers
    displayHospitals.forEach((h: any) => {
      if (h.lat && h.lng) {
        mapMarkers.push({
          id: h.resourceId,
          name: h.name,
          type: "Hospital",
          lat: h.lat,
          lng: h.lng,
        });
      }
    });

    // Add all shelter markers
    displayShelters.forEach((s: any) => {
      if (s.lat && s.lng) {
        mapMarkers.push({
          id: s.resourceId,
          name: s.name,
          type: "Shelter",
          lat: s.lat,
          lng: s.lng,
        });
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] p-[var(--spacing-gutter)] gap-[var(--spacing-panel-gap)] text-on-surface font-[var(--font-geist)] select-none">
      
      {/* Selector and recommendations left */}
      <div className="w-96 flex flex-col gap-[var(--spacing-panel-gap)] overflow-y-auto pr-2 flex-shrink-0">
        
        {/* Dropdown Card */}
        <div className="glass-panel p-5 relative rounded-sm flex flex-col gap-3">
          <span className="text-[10px] text-outline uppercase font-bold tracking-widest">
            Select Active Hotspot
          </span>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full bg-surface-container-highest border border-outline-variant/35 px-4 py-2.5 text-sm text-on-surface font-semibold focus:outline-none uppercase rounded-sm"
          >
            {validatedLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Dispatch Summary */}
        <div className="glass-panel p-5 relative rounded-sm">
          <h2 className="text-xs font-bold tracking-widest text-outline-variant uppercase mb-3">Dispatch Summary</h2>
          
          <div className="flex flex-col gap-3">
            <div className="flex justify-between border-b border-outline-variant/20 pb-2">
              <span className="text-sm text-outline">Priority</span>
              <span className="text-sm font-bold text-error">{allocation?.allocation ? allocation.allocation.allocatedResources.length > 0 ? allocation.allocation.selectedTeams.primary.memberCount > 3 ? "CRITICAL" : "HIGH" : "MEDIUM" : "LOW"}</span>
            </div>
            <div className="flex justify-between border-b border-outline-variant/20 pb-2">
              <span className="text-sm text-outline">Validation Confidence</span>
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

        {/* Resource Recommendations & Supplies */}
        {recommendations && (
          <div className="glass-panel p-5 relative rounded-sm flex flex-col gap-3">
            <h2 className="text-xs font-bold tracking-widest text-outline-variant uppercase">Resource Recommendations</h2>
            
            <div className="grid grid-cols-2 gap-2 text-xs font-[var(--font-geist)]">
              <div className="p-2 bg-surface-container-highest/30 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Personnel Count</span>
                <span className="text-on-surface font-bold text-sm">{recommendations.personnelCount}</span>
              </div>
              <div className="p-2 bg-surface-container-highest/30 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Medical Teams</span>
                <span className="text-on-surface font-bold text-sm">{recommendations.medicalTeams}</span>
              </div>
              <div className="p-2 bg-surface-container-highest/30 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Fire Units</span>
                <span className="text-on-surface font-bold text-sm">{recommendations.fireUnits}</span>
              </div>
              <div className="p-2 bg-surface-container-highest/30 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Police / SAR</span>
                <span className="text-on-surface font-bold text-sm">{recommendations.policeSAR}</span>
              </div>
              <div className="p-2 bg-surface-container-highest/30 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Ambulances</span>
                <span className="text-on-surface font-bold text-sm">{recommendations.ambulances}</span>
              </div>
              <div className="p-2 bg-surface-container-highest/30 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Heavy Equipment</span>
                <span className="text-on-surface font-bold text-xs truncate" title={recommendations.heavyEquipment}>
                  {recommendations.heavyEquipment}
                </span>
              </div>
            </div>

            <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-sm text-xs leading-relaxed text-secondary-container">
              <span className="font-bold uppercase text-[9px] block tracking-wide mb-0.5 text-secondary">Relief Supplies</span>
              {recommendations.reliefSupplies}
            </div>
          </div>
        )}
      </div>

      {/* Map, sequence, facilities right */}
      <div className="flex-1 flex flex-col gap-[var(--spacing-panel-gap)] overflow-y-auto pr-2">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4 flex-shrink-0">
          <div>
            <h1 className="font-[var(--font-inter)] text-2xl font-bold tracking-wider text-primary-fixed-dim flex items-center gap-2">
              <span className="material-symbols-outlined text-[28px] animate-pulse">route</span>
              Smart Resource Allocation Panel
            </h1>
            <p className="text-xs text-outline-variant uppercase tracking-widest mt-1">
              Phase 4.45 Real-Time Routing, ETA Mapping & Dispatch Sequencing
            </p>
          </div>
        </div>

        {/* Map and Route View */}
        <div className="glass-panel rounded-sm relative min-h-[300px] h-[350px] overflow-hidden flex-shrink-0">
          <ResourceMapView markers={mapMarkers} routes={mapRoutes} onHospitalsFound={handleHospitalsFound} onSheltersFound={handleSheltersFound} />
          <div className="absolute top-4 left-4 bg-surface-container-lowest/80 border border-outline-variant/50 px-3 py-1 font-[var(--font-geist)] text-[10px] tracking-wider font-bold text-primary z-20 rounded-sm">
            OPTIMIZED CRISIS ROUTE
          </div>
        </div>

        {/* Grid of Sequence and Facilities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--spacing-panel-gap)] flex-shrink-0">
          
          {/* Dispatch Sequence Timeline */}
          <div className="glass-panel p-5 rounded-sm">
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
          <div className="glass-panel p-5 rounded-sm">
            <h2 className="text-xs font-bold tracking-widest text-outline-variant uppercase mb-4">Assigned Medical & Shelter Facilities</h2>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-xs font-bold text-purple-400 tracking-wider uppercase mb-2">Hospitals</h3>
                {displayHospitals.length > 0 ? displayHospitals.map((h: any) => (
                  <div key={h.resourceId} className="flex justify-between text-sm border-b border-outline-variant/15 pb-2">
                    <span>{h.name}</span>
                    <span className="font-bold text-outline-variant">Beds Available: {h.availableBeds}</span>
                  </div>
                )) : <p className="text-xs text-outline">No hospitals assigned</p>}
              </div>

              <div>
                <h3 className="text-xs font-bold text-green-400 tracking-wider uppercase mb-2">Shelters</h3>
                {displayShelters.length > 0 ? displayShelters.map((s: any) => (
                  <div key={s.resourceId} className="flex justify-between text-sm border-b border-outline-variant/15 pb-2">
                    <span>{s.name}</span>
                    <span className="font-bold text-outline-variant">Remaining Space: {s.remainingCapacity}</span>
                  </div>
                )) : <p className="text-xs text-outline">No shelters assigned</p>}
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
