"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import { useLiveDemo } from "@/context/LiveDemoContext";
import { motion, AnimatePresence } from "framer-motion";

import incidentsData from "@/data/incidents.json";
import type { Incident } from "@/types";

const incidents = incidentsData as Incident[];

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

export default function Navbar() {
  const { user, logout } = useAuth();
  const { coordinates, locationStatus, lastUpdatedTime } = useLiveDemo();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showRuntimeModal, setShowRuntimeModal] = useState(false);
  const [backendAgents, setBackendAgents] = useState<any[]>([]);
  const [customValData, setCustomValData] = useState<Record<string, any>>({});
  const [mounted, setMounted] = useState(false);

  const coordinatesFormatted = useMemo(() => {
    const lat = coordinates.lat;
    const lng = coordinates.lng;
    const latDir = lat >= 0 ? "N" : "S";
    const lngDir = lng >= 0 ? "E" : "W";
    return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
  }, [coordinates]);


  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
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

  // Fetch agents data from the backend status API
  const fetchAgents = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/agents/status", {
        headers: {
          "Authorization": "Bearer mock-admin-token"
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setBackendAgents(json.data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch real-time agents in navbar:", err);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 3000);
    return () => clearInterval(interval);
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

  // Filter to validated locations
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
      const trustedSourceExists = reports.some(r => ["Patrol Unit", "IoT Sensor", "Emergency Call"].includes(r.reportSource || ""));

      const isValidated = multipleReports && typeConsistent && withinTimeWindow && withinLocThreshold && aiConfidenceExceeds && mediaVerified && trustedSourceExists;

      if (isValidated) {
        valid.push(location);
      }
    }
    return valid;
  }, [groupedByLocation, customValData]);

  // Compute live active agents and runtimes (aligned with AgentsPage logic)
  const agentRuntimes = useMemo(() => {
    const unvalidatedList = groupedByLocation
      .filter(([loc]) => !validatedLocations.includes(loc))
      .map(([loc]) => loc);

    const validatedPendingResources = validatedLocations.filter(loc => {
      const reports = incidents.filter(i => i.location === loc);
      const hasCompleted = customValData[loc] || reports.length > 15;
      return !hasCompleted;
    });

    const activeAudits = validatedLocations;

    const dispatcherActive = unvalidatedList.length > 0;
    const evaluatorActive = unvalidatedList.length > 0;
    const validatorActive = unvalidatedList.length > 0;
    const allocatorActive = validatedPendingResources.length > 0;
    const auditorActive = activeAudits.length > 0;

    const agents = [
      { name: "Data Dispatcher", active: dispatcherActive, runtime: 450, text: "450ms" },
      { name: "Risk Evaluator", active: evaluatorActive, runtime: 820, text: "820ms" },
      { name: "Field Validator", active: validatorActive, runtime: 1200, text: "1.2s" },
      { name: "Resource Allocator", active: allocatorActive, runtime: 1500, text: "1.5s" },
      { name: "Compliance Auditor", active: auditorActive, runtime: 920, text: "920ms" },
    ];

    return agents;
  }, [groupedByLocation, validatedLocations, customValData]);

  // Calculate Average Runtime (mean of runtime of all active agents)
  const averageRuntimeFormatted = useMemo(() => {
    const active = agentRuntimes.filter(a => a.active);
    if (active.length === 0) return "--";

    const total = active.reduce((acc, curr) => acc + curr.runtime, 0);
    const avg = total / active.length;

    if (avg < 1000) {
      return `${Math.round(avg)} ms`;
    }
    return `${(avg / 1000).toFixed(2)} s`;
  }, [agentRuntimes]);

  const modalContent = (
    <AnimatePresence>
      {showRuntimeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center font-[var(--font-geist)] select-none">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-96 glass-panel p-6 border border-outline-variant/40 rounded-sm shadow-2xl relative flex flex-col gap-4 bg-[#080B0F]"
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">memory</span>
                <h3 className="font-[var(--font-inter)] text-sm font-bold text-on-surface uppercase tracking-wider">
                  AGENT RUNTIME TELEMETRY
                </h3>
              </div>
              <button
                onClick={() => setShowRuntimeModal(false)}
                className="text-outline hover:text-on-surface transition-colors cursor-pointer material-symbols-outlined text-[20px]"
              >
                close
              </button>
            </div>

            {/* Agents Runtime List */}
            <div className="flex flex-col gap-2.5">
              {agentRuntimes.map((agent) => (
                <div
                  key={agent.name}
                  className="flex justify-between items-center p-2.5 bg-surface-container-highest/30 border border-outline-variant/10 rounded-sm text-xs"
                >
                  <span className="text-on-surface font-medium">{agent.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${agent.active ? "bg-primary-fixed-dim" : "bg-outline"}`} />
                    <span className={`uppercase font-bold ${agent.active ? "text-primary-fixed-dim" : "text-outline"}`}>
                      {agent.active ? agent.text : "Idle"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Average */}
            <div className="mt-2 p-3 bg-secondary/10 border border-secondary/20 rounded-sm flex justify-between items-center text-xs">
              <span className="font-bold text-secondary uppercase tracking-wider text-[10px]">Computed Average</span>
              <span className="font-bold text-secondary text-sm">{averageRuntimeFormatted}</span>
            </div>

            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-outline-variant/50" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <nav className="bg-surface/80 backdrop-filter backdrop-blur-[24px] border-b border-outline-variant/20 shadow-[0_0_15px_rgba(0,218,243,0.1)] flex justify-between items-center w-full px-8 h-16 fixed top-0 z-50 ml-16" style={{ width: "calc(100% - 64px)" }}>
      {/* Brand */}
      <div className="flex items-center gap-4">
        <span className="font-[var(--font-inter)] text-[24px] leading-[32px] tracking-[0.01em] font-semibold tracking-tighter text-primary-fixed-dim">
          Argus Tactical Command
        </span>
      </div>

      {/* Coordinates & Avg Agent Runtime */}
      <div className="hidden md:flex items-center gap-8 font-[var(--font-geist)] text-[13px] leading-[18px] font-medium text-on-surface-variant">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-primary-fixed-dim">my_location</span>
          {locationStatus === "LIVE" ? (
            <div className="flex items-center gap-2.5">
              <span>Coordinates: <strong>{coordinatesFormatted}</strong></span>
              <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                LIVE • {lastUpdatedTime}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <span>Coordinates: <strong>{coordinatesFormatted}</strong></span>
              <span className="inline-flex items-center gap-1 bg-outline/10 border border-outline/20 px-2 py-0.5 rounded-sm text-[10px] text-outline font-extrabold uppercase tracking-wider">
                {locationStatus || "Live location unavailable"}
              </span>
            </div>
          )}
        </div>
        <div
          onClick={() => setShowRuntimeModal(true)}
          className="flex items-center gap-2 cursor-pointer hover:text-secondary hover:shadow-[0_0_8px_rgba(68,221,193,0.3)] transition-all px-2.5 py-1 rounded-sm border border-transparent hover:border-outline-variant/20 bg-surface-container-lowest/30 select-none"
        >
          <span className="material-symbols-outlined text-[16px] text-secondary">memory</span>
          <span>Avg Agent Runtime: <strong>{averageRuntimeFormatted}</strong></span>
        </div>
      </div>

      {/* Trailing Actions */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-sm hover:bg-primary-container/20 hover:text-primary transition-all cursor-pointer active:scale-95 text-on-surface-variant group">
          <span className="material-symbols-outlined group-hover:drop-shadow-[0_0_8px_rgba(0,218,243,0.8)] transition-all">
            notifications_active
          </span>
          <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full status-pip text-error" />
        </button>
        <button className="p-2 rounded-sm hover:bg-primary-container/20 hover:text-primary transition-all cursor-pointer active:scale-95 text-on-surface-variant group">
          <span className="material-symbols-outlined group-hover:drop-shadow-[0_0_8px_rgba(0,218,243,0.8)] transition-all">
            warning
          </span>
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="p-2 rounded-sm hover:bg-primary-container/20 hover:text-primary transition-all cursor-pointer active:scale-95 text-on-surface-variant group"
          >
            <span className="material-symbols-outlined group-hover:drop-shadow-[0_0_8px_rgba(0,218,243,0.8)] transition-all">
              account_circle
            </span>
          </button>
          {showUserMenu && (
            <div className="absolute right-0 top-12 w-56 glass-panel rounded-sm border border-outline-variant/30 p-2 flex flex-col gap-1 shadow-2xl">
              <div className="px-3 py-2 border-b border-outline-variant/20">
                <div className="font-[var(--font-inter)] text-[14px] font-semibold text-on-surface">{user?.name || "Commander"}</div>
                <div className="font-[var(--font-geist)] text-[10px] text-outline">{user?.sector || "Sector-7"} • {user?.role || "admin"}</div>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 text-error hover:bg-error-container/20 rounded-sm transition-colors text-[13px] font-[var(--font-geist)]"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Portal modal portal */}
      {mounted && createPortal(modalContent, document.body)}
    </nav>
  );
}
