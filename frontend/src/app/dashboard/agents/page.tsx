"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import incidentsData from "@/data/incidents.json";
import agentsData from "@/data/agents.json";
import type { Incident, FieldOperative, RosterAgent } from "@/types";

const fieldOperatives = agentsData.fieldOperatives as FieldOperative[];
const roster = agentsData.roster as RosterAgent[];

type TabKey = "ai" | "operatives" | "roster";
const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "ai", label: "AI Agents", icon: "smart_toy" },
  { key: "operatives", label: "Field Operatives", icon: "person_pin_circle" },
  { key: "roster", label: "Roster", icon: "badge" },
];

const rosterStatusStyles: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-secondary/20", text: "text-secondary" },
  deployed: { bg: "bg-secondary/20", text: "text-secondary" },
  standby: { bg: "bg-primary-fixed-dim/20", text: "text-primary-fixed-dim" },
  alert: { bg: "bg-error/20", text: "text-error" },
  "on-leave": { bg: "bg-outline/20", text: "text-outline" },
  offline: { bg: "bg-outline/20", text: "text-outline" },
};

const specialtyStyles: Record<string, string> = {
  tactical: "bg-primary-fixed-dim/20 text-primary-fixed-dim border border-primary-fixed-dim/30",
  paramedic: "bg-secondary/20 text-secondary border border-secondary/30",
  engineer: "bg-on-surface-variant/20 text-on-surface-variant border border-on-surface-variant/30",
  recon: "bg-primary/20 text-primary border border-primary/30",
  medic: "bg-secondary/20 text-secondary border border-secondary/30",
};

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  Idle: { bg: "bg-outline/20", text: "text-outline", dot: "bg-outline" },
  Processing: { bg: "bg-primary/20", text: "text-primary-fixed-dim", dot: "bg-primary-fixed-dim shadow-[0_0_6px_rgba(0,218,243,0.6)] animate-pulse" },
  Waiting: { bg: "bg-amber-500/20", text: "text-amber-400", dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" },
  Completed: { bg: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" },
  Error: { bg: "bg-error/20", text: "text-error", dot: "bg-error shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-ping" }
};

const healthStyles: Record<string, { text: string; bg: string }> = {
  Healthy: { text: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
  Warning: { text: "text-amber-400", bg: "bg-amber-500/10 border border-amber-500/20" },
  Offline: { text: "text-error", bg: "bg-error/10 border border-error/20" }
};

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

export default function AgentsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("ai");
  const [selectedRosterId, setSelectedRosterId] = useState<string>(roster[0]?.id || "");
  const [backendAgents, setBackendAgents] = useState<any[]>([]);
  const [customValData, setCustomValData] = useState<Record<string, any>>({});

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

  // Fetch agent metrics from the backend status API
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
      console.error("Failed to fetch real-time agents:", err);
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

  // Compute live agent data merging backend metrics with frontend local state overrides
  const aiAgents = useMemo(() => {
    const baseMap = new Map(backendAgents.map(a => [a.name, a]));

    const unvalidatedList = groupedByLocation
      .filter(([loc]) => !validatedLocations.includes(loc))
      .map(([loc]) => loc);

    const validatedPendingResources = validatedLocations.filter(loc => {
      // Check if resources have been allocated or reports completed
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

    return [
      {
        id: "AI-001",
        name: "Data Dispatcher",
        status: dispatcherActive ? "Processing" : "Idle",
        confidence: 99,
        currentTask: dispatcherActive
          ? `Ingesting raw communication feeds for ${unvalidatedList[0]}, normalizing structured reports via Gemini.`
          : "Idle - No Active Tasks",
        activeLocation: dispatcherActive ? unvalidatedList[0] : "None",
        queueSize: dispatcherActive ? unvalidatedList.length * 4 : 0,
        cpu: baseMap.get("Data Dispatcher")?.cpu || 2,
        memory: baseMap.get("Data Dispatcher")?.memory || 8,
        processingTime: baseMap.get("Data Dispatcher")?.processingTime || "450ms",
        lastUpdated: baseMap.get("Data Dispatcher")?.lastUpdated || new Date().toISOString(),
        health: baseMap.get("Data Dispatcher")?.health || "Healthy",
        icon: "hub"
      },
      {
        id: "AI-002",
        name: "Risk Evaluator",
        status: evaluatorActive ? "Processing" : "Idle",
        confidence: 97,
        currentTask: evaluatorActive
          ? `Evaluating compound severity and prioritizing emergency dispatcher feeds for ${unvalidatedList[0]}.`
          : "Idle - No Active Tasks",
        activeLocation: evaluatorActive ? unvalidatedList[0] : "None",
        queueSize: evaluatorActive ? unvalidatedList.length : 0,
        cpu: baseMap.get("Risk Evaluator")?.cpu || 3,
        memory: baseMap.get("Risk Evaluator")?.memory || 10,
        processingTime: baseMap.get("Risk Evaluator")?.processingTime || "820ms",
        lastUpdated: baseMap.get("Risk Evaluator")?.lastUpdated || new Date().toISOString(),
        health: baseMap.get("Risk Evaluator")?.health || "Healthy",
        icon: "shield"
      },
      {
        id: "AI-003",
        name: "Field Validator",
        status: validatorActive ? "Processing" : "Idle",
        confidence: 95,
        currentTask: validatorActive
          ? `Verifying GPS proximity, camera streams, and sensor evidence correlation for ${unvalidatedList[0]}.`
          : "Idle - No Active Tasks",
        activeLocation: validatorActive ? unvalidatedList[0] : "None",
        queueSize: validatorActive ? unvalidatedList.length : 0,
        cpu: baseMap.get("Field Validator")?.cpu || 1,
        memory: baseMap.get("Field Validator")?.memory || 9,
        processingTime: baseMap.get("Field Validator")?.processingTime || "1.2s",
        lastUpdated: baseMap.get("Field Validator")?.lastUpdated || new Date().toISOString(),
        health: baseMap.get("Field Validator")?.health || "Healthy",
        icon: "analytics"
      },
      {
        id: "AI-004",
        name: "Resource Allocator",
        status: allocatorActive ? "Processing" : "Idle",
        confidence: 92,
        currentTask: allocatorActive
          ? `Calculating vehicle routes, scheduling teams, and determining priority dispatch for ${validatedPendingResources[0]}.`
          : "Idle - No Active Tasks",
        activeLocation: allocatorActive ? validatedPendingResources[0] : "None",
        queueSize: allocatorActive ? validatedPendingResources.length : 0,
        cpu: baseMap.get("Resource Allocator")?.cpu || 1,
        memory: baseMap.get("Resource Allocator")?.memory || 7,
        processingTime: baseMap.get("Resource Allocator")?.processingTime || "1.5s",
        lastUpdated: baseMap.get("Resource Allocator")?.lastUpdated || new Date().toISOString(),
        health: baseMap.get("Resource Allocator")?.health || "Healthy",
        icon: "route"
      },
      {
        id: "AI-005",
        name: "Compliance Auditor",
        status: auditorActive ? "Processing" : "Idle",
        confidence: 98,
        currentTask: auditorActive
          ? `Auditing SOP checklist checkpoints, timeline progressions, and policy rules for ${activeAudits[0]}.`
          : "Idle - No Active Tasks",
        activeLocation: auditorActive ? activeAudits[0] : "None",
        queueSize: auditorActive ? activeAudits.length : 0,
        cpu: baseMap.get("Compliance Auditor")?.cpu || 2,
        memory: baseMap.get("Compliance Auditor")?.memory || 11,
        processingTime: baseMap.get("Compliance Auditor")?.processingTime || "920ms",
        lastUpdated: baseMap.get("Compliance Auditor")?.lastUpdated || new Date().toISOString(),
        health: baseMap.get("Compliance Auditor")?.health || "Healthy",
        icon: "verified_user"
      }
    ];
  }, [backendAgents, groupedByLocation, validatedLocations, customValData]);

  const selectedAgent = roster.find((a) => a.id === selectedRosterId) || roster[0];

  return (
    <div className="p-[var(--spacing-gutter)] flex flex-col gap-[var(--spacing-gutter)] h-[calc(100vh-4rem)]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="font-[var(--font-inter)] text-[32px] leading-[40px] tracking-[-0.02em] font-bold text-primary-fixed-dim uppercase">
            {activeTab === "ai" ? "AI Agents" : activeTab === "operatives" ? "Active Operatives" : "Active Roster"}
          </h1>
          <p className="font-[var(--font-inter)] text-[14px] text-on-surface-variant mt-1">
            {activeTab === "ai"
              ? "Real-time status and operational metrics for assigned autonomous tactical agents."
              : activeTab === "operatives"
              ? "Real-time telemetry and status for deployed field agents across all active sectors."
              : "Full personnel database with deployment history and dossier access."}
          </p>
        </div>
        {activeTab === "ai" && (
          <button className="px-6 py-2 bg-error/10 border border-error text-error font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold uppercase hover:bg-error/20 transition-all flex items-center gap-2 rounded-sm">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            Initiate Protocol Zero
          </button>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-outline-variant/30">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold uppercase transition-all relative ${
              activeTab === tab.key
                ? "text-primary-fixed-dim"
                : "text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary-fixed-dim"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {activeTab === "ai" && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-6 gap-[var(--spacing-gutter)]"
            >
              {aiAgents.map((agent, idx) => {
                const sty = statusStyles[agent.status] || statusStyles.Idle;
                const hl = healthStyles[agent.health] || healthStyles.Healthy;
                return (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className="glass-card border border-outline-variant/20 p-5 flex flex-col gap-4 relative agent-card-hover cursor-pointer group md:col-span-2"
                  >
                    {/* Header */}
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                        agent.status === "Error" ? "border-error bg-error/10" : "border-primary-fixed-dim/50 bg-primary-fixed-dim/10"
                      }`}>
                        <span className={`material-symbols-outlined text-[24px] ${
                          agent.status === "Error" ? "text-error" : "text-primary-fixed-dim"
                        }`}>{agent.icon}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-[var(--font-inter)] text-[18px] font-semibold text-on-surface">{agent.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${sty.dot}`} />
                          <span className={`font-[var(--font-geist)] text-[10px] uppercase font-bold ${sty.text}`}>
                            {agent.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-[var(--font-inter)] text-[28px] font-bold text-on-surface">{agent.confidence}</span>
                        <span className="font-[var(--font-inter)] text-[14px] text-outline">%</span>
                        <div className="font-[var(--font-geist)] text-[10px] text-outline uppercase">Confidence</div>
                      </div>
                    </div>

                    {/* Task */}
                    <div>
                      <div className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-secondary uppercase mb-1">Current Task</div>
                      <p className="font-[var(--font-inter)] text-[13px] text-on-surface-variant leading-relaxed h-[42px] overflow-hidden line-clamp-2" title={agent.currentTask}>
                        {agent.currentTask}
                      </p>
                    </div>

                    {/* Meta Info Grid */}
                    <div className="grid grid-cols-2 gap-2 border-t border-b border-outline-variant/15 py-3 font-[var(--font-geist)] text-[11px]">
                      <div>
                        <span className="text-outline uppercase block text-[9px] tracking-wider">Active Location</span>
                        <span className="text-on-surface font-semibold truncate block mt-0.5">{agent.activeLocation}</span>
                      </div>
                      <div>
                        <span className="text-outline uppercase block text-[9px] tracking-wider">Queue Size</span>
                        <span className="text-on-surface font-semibold block mt-0.5">{agent.queueSize} items</span>
                      </div>
                      <div>
                        <span className="text-outline uppercase block text-[9px] tracking-wider">Processing Time</span>
                        <span className="text-on-surface font-semibold block mt-0.5">{agent.processingTime}</span>
                      </div>
                      <div>
                        <span className="text-outline uppercase block text-[9px] tracking-wider">Last Updated</span>
                        <span className="text-on-surface font-semibold block mt-0.5 truncate">
                          {new Date(agent.lastUpdated).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {/* Metrics CPU/MEM and Health */}
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex gap-4">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-[var(--font-geist)] text-[9px] text-on-surface uppercase">CPU</span>
                            <span className="font-[var(--font-geist)] text-[11px] text-on-surface">{agent.cpu}%</span>
                          </div>
                          <div className="w-16 bg-surface-container-highest h-1 rounded-full mt-1 overflow-hidden">
                            <div className="bg-primary-fixed-dim h-full" style={{ width: `${agent.cpu}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-[var(--font-geist)] text-[9px] text-on-surface uppercase">MEM</span>
                            <span className="font-[var(--font-geist)] text-[11px] text-on-surface">{agent.memory}%</span>
                          </div>
                          <div className="w-16 bg-surface-container-highest h-1 rounded-full mt-1 overflow-hidden">
                            <div className="bg-secondary h-full" style={{ width: `${agent.memory}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className={`px-2 py-0.5 rounded-sm text-[9px] uppercase font-bold tracking-wider ${hl.bg} ${hl.text}`}>
                        {agent.health}
                      </div>
                    </div>

                    <div className="tech-bracket" />
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {activeTab === "operatives" && (
            <motion.div
              key="operatives"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-4 gap-[var(--spacing-gutter)]"
            >
              {fieldOperatives.map((op, idx) => (
                <motion.div
                  key={op.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className={`glass-card border p-4 flex flex-col gap-3 relative agent-card-hover cursor-pointer ${
                    op.isAlert
                      ? "border-error/50 shadow-[0_0_15px_rgba(255,180,171,0.1)]"
                      : "border-outline-variant/20"
                  }`}
                >
                  {/* Top */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className={`font-[var(--font-geist)] text-[12px] font-semibold ${op.isAlert ? "text-error" : "text-primary-fixed-dim"}`}>
                        ID: {op.id}
                      </div>
                      <h3 className="font-[var(--font-inter)] text-[18px] font-semibold text-on-surface">{op.name}</h3>
                      <span className={`inline-block px-2 py-0.5 mt-1 font-[var(--font-geist)] text-[10px] tracking-[0.1em] font-semibold uppercase rounded-sm ${
                        specialtyStyles[op.specialty] || specialtyStyles.tactical
                      }`}>
                        {op.specialty}
                      </span>
                    </div>
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={op.avatar}
                        alt={op.name}
                        className="w-14 h-14 rounded-full border-2 border-outline-variant/50 object-cover"
                      />
                      {op.isAlert && (
                        <span className="absolute -top-1 -right-1 px-1 py-0.5 bg-error text-[8px] text-on-error font-bold rounded-sm shadow-[0_0_8px_rgba(255,180,171,0.8)]">
                          Alert
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Vitals */}
                  <div className="grid grid-cols-2 gap-y-2 font-[var(--font-geist)] text-[13px] font-medium text-on-surface">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-outline">favorite</span>
                      <span className="text-outline text-[11px]">HR</span>
                    </div>
                    <span className={`text-right ${op.isAlert ? "text-error font-bold" : ""}`}>
                      {op.heartRate} BPM
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-outline">air</span>
                      <span className="text-outline text-[11px]">O2</span>
                    </div>
                    <span className="text-right">{op.oxygenLevel}%</span>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-outline">location_on</span>
                      <span className="text-outline text-[11px]">LOC</span>
                    </div>
                    <span className="text-right text-[12px]">{op.location}</span>
                  </div>
                  {/* Vitals Sparkline */}
                  <div>
                    <span className="font-[var(--font-geist)] text-[10px] text-outline">Vitals Trend</span>
                    <div className="mt-1 w-full h-10 glass-card border border-outline-variant/20 rounded-sm flex items-center p-1 overflow-hidden">
                      <svg viewBox="0 0 100 30" className="w-full h-full" preserveAspectRatio="none">
                        <path
                          d={op.vitalsPath}
                          fill="none"
                          stroke={op.isAlert ? "#ffb4ab" : "#00daf3"}
                          strokeWidth="1.5"
                          className="animate-sparkline"
                        />
                      </svg>
                    </div>
                  </div>
                  {op.isAlert && (
                    <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-error/50" />
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === "roster" && (
            <motion.div
              key="roster"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex gap-[var(--spacing-gutter)] h-full"
            >
              {/* Roster Table */}
              <div className="flex-1 glass-panel rounded-sm overflow-hidden flex flex-col">
                <div className="h-12 bg-surface-container-highest/50 flex items-center px-4 gap-3 border-b border-outline-variant/20">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">view_list</span>
                  <h3 className="font-[var(--font-inter)] text-[16px] font-semibold text-on-surface uppercase flex-1">
                    Active Roster
                  </h3>
                  <div className="relative w-48">
                    <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-outline text-[16px]">search</span>
                    <input
                      type="text"
                      placeholder="QUERY ID / NAME..."
                      className="w-full bg-surface-container border-b border-outline-variant focus:border-primary-container focus:outline-none text-on-surface font-[var(--font-geist)] text-[11px] pl-7 py-1 transition-all h-7 rounded-t-sm"
                    />
                  </div>
                  <button className="px-3 py-1 glass-card border border-primary-fixed-dim text-primary-fixed-dim font-[var(--font-geist)] text-[10px] tracking-[0.1em] font-semibold uppercase hover:bg-primary-fixed-dim/10 transition-all flex items-center gap-1 rounded-sm">
                    <span className="material-symbols-outlined text-[14px]">filter_list</span>
                    Filter
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left">
                    <tbody className="font-[var(--font-geist)] text-[13px] font-medium">
                      {roster.map((agent) => {
                        const isSelected = selectedRosterId === agent.id;
                        const sSt = rosterStatusStyles[agent.status] || rosterStatusStyles.standby;
                        return (
                          <tr
                            key={agent.id}
                            onClick={() => setSelectedRosterId(agent.id)}
                            className={`border-b border-outline-variant/10 hover:bg-surface-container-highest/30 cursor-pointer transition-colors ${
                              isSelected ? "row-active" : ""
                            }`}
                          >
                            <td className={`p-3 ${isSelected ? "text-primary-fixed-dim" : "text-on-surface-variant"}`}>
                              {agent.id}
                            </td>
                            <td className="p-3 text-on-surface">{agent.designation}</td>
                            <td className="p-3 text-on-surface-variant">{agent.specialty}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] uppercase font-bold ${sSt.bg} ${sSt.text} border border-current/20`}>
                                <span className={`w-1.5 h-1.5 rounded-full bg-current`} />
                                {agent.status.replace("-", " ")}
                              </span>
                            </td>
                            <td className="p-3 text-on-surface-variant">{agent.location}</td>
                            <td className={`p-3 text-right ${agent.rating >= 97 ? "text-primary-fixed-dim" : "text-on-surface"}`}>
                              {agent.rating}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dossier Panel */}
              <div className="w-96 glass-panel rounded-sm overflow-y-auto flex flex-col">
                <div className="glass-card-header px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-secondary">badge</span>
                    <h3 className="font-[var(--font-inter)] text-[16px] font-semibold text-secondary uppercase">Dossier</h3>
                  </div>
                  <span className="font-[var(--font-geist)] text-[10px] text-outline border border-outline-variant/30 px-2 py-0.5 rounded-sm">
                    {selectedAgent?.id}
                  </span>
                </div>
                <div className="p-5 flex flex-col gap-5">
                  {/* Profile */}
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 bg-surface-container-highest rounded-sm overflow-hidden border border-outline-variant/30 flex items-center justify-center flex-shrink-0">
                      {selectedAgent?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={selectedAgent.avatar} alt={selectedAgent.designation} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-[32px] text-outline">person</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold uppercase ${rosterStatusStyles[selectedAgent?.status || "standby"]?.bg} ${rosterStatusStyles[selectedAgent?.status || "standby"]?.text}`}>
                          BIO-SYNC: STABLE
                        </div>
                      </div>
                      <h2 className="font-[var(--font-inter)] text-[22px] font-semibold text-on-surface uppercase">
                        {selectedAgent?.designation?.split(",").reverse().join(" ").trim() || "N/A"}
                      </h2>
                      <p className="font-[var(--font-inter)] text-[12px] text-secondary font-semibold">{selectedAgent?.role || "Operative"}</p>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-[var(--font-geist)] text-[11px]">
                        <span className="text-outline">DOB:</span>
                        <span className="text-on-surface-variant">{selectedAgent?.dob || "CLASSIFIED"}</span>
                        <span className="text-outline">B-TYPE:</span>
                        <span className="text-on-surface-variant">{selectedAgent?.bloodType || "CLASSIFIED"}</span>
                        <span className="text-outline">CLEARANCE:</span>
                        <span className="text-primary-fixed-dim font-bold">{selectedAgent?.clearance || "LEVEL 3"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Radar radar chart */}
                  <div>
                    <h4 className="font-[var(--font-inter)] text-[14px] font-semibold text-on-surface border-b border-outline-variant/20 pb-2 mb-4">
                      Combat Metrics
                    </h4>
                    <div className="flex items-center justify-center h-44">
                      <svg viewBox="0 0 200 200" className="w-44 h-44">
                        {[1, 0.66, 0.33].map((s, i) => (
                          <polygon
                            key={i}
                            points={pentagon(100, 100, 80 * s)}
                            fill="none"
                            stroke="rgba(0,218,243,0.15)"
                            strokeWidth="1"
                          />
                        ))}
                        <polygon
                          points={pentagon(100, 100, 80, [0.9, 0.7, 0.75, 0.85, 0.6])}
                          fill="rgba(0,218,243,0.15)"
                          stroke="#00daf3"
                          strokeWidth="2"
                        />
                        <text x="100" y="10" textAnchor="middle" fill="#00daf3" fontSize="10" fontWeight="600">TACTICAL</text>
                        <text x="190" y="75" textAnchor="end" fill="#00daf3" fontSize="10" fontWeight="600">STEALTH</text>
                        <text x="170" y="160" textAnchor="end" fill="#00daf3" fontSize="10" fontWeight="600">ENDURANCE</text>
                        <text x="30" y="160" textAnchor="start" fill="#00daf3" fontSize="10" fontWeight="600">TECH</text>
                        <text x="10" y="75" textAnchor="start" fill="#00daf3" fontSize="10" fontWeight="600">COMBAT</text>
                      </svg>
                    </div>
                  </div>

                  {/* Deployment Logs */}
                  <div>
                    <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2 mb-3">
                      <h4 className="font-[var(--font-inter)] text-[14px] font-semibold text-on-surface">
                        Deployment Logs
                      </h4>
                      <span className="material-symbols-outlined text-[16px] text-outline cursor-pointer hover:text-primary-fixed-dim transition-colors">
                        open_in_new
                      </span>
                    </div>
                    {selectedAgent?.deploymentLogs?.length ? (
                      selectedAgent.deploymentLogs.map((log, i) => (
                        <div
                          key={i}
                          className={`p-3 mb-2 glass-card border rounded-sm ${
                            log.isActive
                              ? "border-primary-fixed-dim/30 border-l-2 border-l-primary-fixed-dim"
                              : "border-outline-variant/20"
                          }`}
                        >
                          <div className="flex justify-between font-[var(--font-geist)] text-[10px] mb-1">
                            <span className={log.isActive ? "text-primary-fixed-dim" : "text-outline"}>
                              {log.timestamp}
                            </span>
                            <span className="text-outline">{log.location}</span>
                          </div>
                          <p className="font-[var(--font-inter)] text-[12px] text-on-surface-variant">{log.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="font-[var(--font-geist)] text-[12px] text-outline italic">No recent deployment logs.</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-auto">
                    <button className="flex-1 py-2 bg-primary-fixed-dim text-[#001f24] font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold uppercase hover:shadow-[0_0_15px_rgba(0,218,243,0.3)] transition-all flex items-center justify-center gap-2 rounded-sm">
                      <span className="material-symbols-outlined text-[16px]">headset_mic</span>
                      Comm Link
                    </button>
                    <button className="w-10 h-10 flex items-center justify-center glass-card border border-error/30 text-error hover:bg-error/10 transition-all rounded-sm">
                      <span className="material-symbols-outlined text-[18px]">block</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Helper: Generate pentagon points for radar chart
function pentagon(cx: number, cy: number, r: number, values?: number[]): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI / 2) + (2 * Math.PI * i) / 5;
    const scale = values ? values[i] : 1;
    const x = cx + r * scale * Math.cos(angle);
    const y = cy - r * scale * Math.sin(angle);
    pts.push(`${x},${y}`);
  }
  return pts.join(" ");
}
