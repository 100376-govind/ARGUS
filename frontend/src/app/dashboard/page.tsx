"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveDemo } from "@/context/LiveDemoContext";
import activityData from "@/data/activity.json";
import incidentsData from "@/data/incidents.json";
import type { ActivityEntry, ActiveUnit, Incident } from "@/types";
import MapView from "@/components/map/MapView";


interface SimIncidentCard {
  tempId: string;
  id: string;
  type: string;
  priority: string;
  severity: string;
  confidence: number;
  dispatcherStatus: "Receiving..." | "Understanding..." | "Extracting Entities..." | "Normalizing..." | "Creating Incident..." | "Completed" | "Pending";
  riskStatus: "Waiting..." | "Analyzing Threat..." | "Calculating Severity..." | "Calculating Priority..." | "Generating Reasoning..." | "Completed";
  rawContent: string;
  reasoning: string;
  timestamp: string;
  glowColor: string; // "red" | "orange" | "yellow"
  visibleText: string;
  coordinates?: { lat: number; lng: number };
}

const systemMetrics = [
  { name: "CPU USAGE", value: 78, color: "primary-fixed-dim" },
  { name: "NETWORK", value: 45, color: "secondary" },
];

const activeUnits: ActiveUnit[] = [
  { id: "1", name: "Agent K.", sector: "Sector 4", type: "Mobile", status: "active" },
  { id: "2", name: "Unit 09", sector: "Sector 7", type: "Static", status: "active" },
  { id: "3", name: "Recon Drone 2", sector: "", type: "Signal Lost", status: "alert", isWarning: true },
];

const incidents = incidentsData as Incident[];

const logLevelColors: Record<string, string> = {
  sys: "text-primary-fixed-dim",
  warn: "text-error",
  act: "text-secondary",
  log: "text-outline",
  error: "text-error",
};

const logLevelLabels: Record<string, string> = {
  sys: "[SYS]",
  warn: "[WARN]",
  act: "[ACT]",
  log: "[LOG]",
  error: "[ERR]",
};

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

// Raw content data for simulation mapped from all active incidents in the database
const simulationIncidentsData = incidents.map((inc) => ({
  id: inc.id,
  rawContent: inc.description || `${inc.type} reported in ${inc.location}. Severity: ${inc.severity || "Medium"}.`,
  type: inc.type,
  glowColor: inc.priority === "critical" ? "red" : inc.priority === "high" ? "orange" : "yellow",
  priority: inc.priority,
  severity: inc.severity || "medium",
  coordinates: inc.coordinates || { lat: 22.57264, lng: 88.36389 },
  assignedAgency: inc.responseTeam,
  reportSource: inc.commander || "Citizen"
}));

export default function DashboardOverview() {
  const {
    isSimulating,
    simTimeline,
    simCards,
    simMessage,
    liveIncidents,
    activities,
    startLiveSimulation,
    stopLiveSimulation,
    coordinates
  } = useLiveDemo();

  const [selectedIncidentCoordinates, setSelectedIncidentCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  // Sort helper to sort simulation cards dynamically (Critical -> High -> Medium -> Low)
  const priorityOrder: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    pending: 0,
  };

  const sortedSimCards = useMemo(() => {
    return [...simCards].sort((a, b) => {
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });
  }, [simCards]);


  return (
    <div className="flex h-[calc(100vh-4rem)] relative overflow-hidden">
      
      {/* Simulation Command overlay floating on the map */}
      <div className="absolute top-4 left-4 z-20 w-80 flex flex-col gap-3 pointer-events-auto">
        
        {/* Run Live Demo Card */}
        <div className="glass-panel rounded-sm border border-outline-variant/30 overflow-hidden relative p-4 flex flex-col gap-3">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-error animate-pulse" />
          
          <div>
            <h3 className="font-[var(--font-inter)] text-[15px] font-semibold text-on-surface flex items-center gap-2">
              <span className="animate-ping w-2 h-2 rounded-full bg-error inline-block" />
              🚨 Live Command Console
            </h3>
            <p className="font-[var(--font-geist)] text-[10px] text-outline mt-1 uppercase tracking-wider">
              Simulate Multi-Incident Emergency
            </p>
          </div>

          <button
            onClick={isSimulating ? stopLiveSimulation : startLiveSimulation}
            className={`w-full py-2 flex items-center justify-center gap-2 font-[var(--font-geist)] text-[12px] tracking-[0.15em] font-bold rounded-sm uppercase transition-all border ${
              isSimulating
                ? "bg-error border-error text-on-error hover:bg-error-container hover:text-error animate-pulse shadow-[0_0_20px_rgba(255,180,171,0.3)]"
                : "bg-error/15 border-error text-error hover:bg-error/30 hover:shadow-[0_0_20px_rgba(255,180,171,0.25)]"
            }`}
          >
            <span>{isSimulating ? "Stop Live Demo" : "Run Live Demo"}</span>
          </button>

          {/* Timeline display */}
          <div className="border-t border-outline-variant/10 pt-3 flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            <span className="font-[var(--font-geist)] text-[9px] tracking-widest text-outline uppercase font-bold">
              Simulation Timeline
            </span>
            <div className="flex flex-col gap-1">
              {simTimeline.map((item, idx) => (
                <div key={idx} className="flex justify-between font-[var(--font-geist)] text-[10px] leading-relaxed text-on-surface-variant">
                  <span className="text-secondary">{item.time}</span>
                  <span className="text-on-surface">{item.event}</span>
                </div>
              ))}
            </div>
            {simMessage && (
              <div className="text-center font-[var(--font-geist)] text-[11px] font-bold text-secondary mt-2 bg-secondary/15 py-1 border border-secondary/30 rounded-sm">
                🎉 {simMessage}
              </div>
            )}
          </div>
        </div>

        {/* List of active Live Incident cards dropping one-by-one */}
        <div className="flex flex-col gap-3 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
          <AnimatePresence>
            {sortedSimCards.map((card) => {
              const borderGlow =
                card.glowColor === "red"
                  ? "border-error/45 shadow-[0_0_15px_rgba(255,180,171,0.12)]"
                  : card.glowColor === "orange"
                  ? "border-tertiary-container/45 shadow-[0_0_15px_rgba(255,193,192,0.12)]"
                  : "border-secondary-container/45 shadow-[0_0_15px_rgba(68,221,193,0.12)]";

              return (
                <motion.div
                  key={card.tempId}
                  initial={{ opacity: 0, scale: 0.9, y: 25 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", damping: 15 }}
                  onClick={() => card.coordinates && setSelectedIncidentCoordinates(card.coordinates)}
                  className={`glass-panel border p-3 flex flex-col gap-2 rounded-sm cursor-pointer hover:bg-surface-container-highest/20 transition-all ${borderGlow}`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <span className="font-[var(--font-geist)] text-[11px] font-bold text-outline">
                      {card.id}
                    </span>
                    <span className="font-[var(--font-geist)] text-[10px] text-outline-variant font-bold uppercase tracking-wider">
                      {card.type}
                    </span>
                  </div>

                  {/* Badges */}
                  {card.riskStatus === "Completed" && (
                    <div className="flex gap-2">
                      <span className={`px-2 py-0.5 font-[var(--font-geist)] text-[9px] font-bold rounded-sm uppercase ${
                        card.priority === "critical" ? "bg-error/20 text-error" : card.priority === "high" ? "bg-tertiary-container/20 text-tertiary-container" : "bg-secondary-container/20 text-secondary-container"
                      }`}>
                        {card.priority.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 bg-surface-container-highest/60 border border-outline-variant/20 text-on-surface font-[var(--font-geist)] text-[9px] font-medium rounded-sm">
                        CONF: {Math.round(card.confidence * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Raw typed signal */}
                  <div className="p-2 bg-surface-container-lowest/70 border border-outline-variant/15 text-[11px] font-[var(--font-geist)] leading-relaxed text-on-surface-variant rounded-sm italic">
                    "{card.visibleText}"
                  </div>

                  {/* Dispatcher status */}
                  <div className="flex items-center justify-between text-[10px] font-[var(--font-geist)]">
                    <span className="text-outline">Data Dispatcher:</span>
                    <span className={card.dispatcherStatus === "Completed" ? "text-secondary font-bold" : "text-primary-fixed-dim"}>
                      {card.dispatcherStatus === "Completed" ? "✓ Done" : card.dispatcherStatus}
                    </span>
                  </div>

                  {/* Risk Evaluator status */}
                  <div className="flex items-center justify-between text-[10px] font-[var(--font-geist)] border-b border-outline-variant/10 pb-1.5">
                    <span className="text-outline">Risk Evaluator:</span>
                    <span className={card.riskStatus === "Completed" ? "text-secondary font-bold" : "text-primary-fixed-dim"}>
                      {card.riskStatus === "Completed" ? "✓ Done" : card.riskStatus}
                    </span>
                  </div>

                  {/* AI Reasoning */}
                  {card.riskStatus === "Completed" && card.reasoning && (
                    <div className="text-[10px] font-[var(--font-geist)] text-on-surface-variant leading-relaxed bg-primary-container/5 p-2 rounded-sm border border-outline-variant/10">
                      <span className="text-secondary font-bold block mb-1">AI CORE REASONING:</span>
                      {card.reasoning}
                    </div>
                  )}

                  <span className="font-[var(--font-geist)] text-[8px] text-outline/50 self-end mt-1">
                    {card.timestamp}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 relative bg-surface-dim">
        <MapView incidents={liveIncidents} selectedIncidentCoordinates={selectedIncidentCoordinates} />
        {/* Grid Overlay */}
        <div className="absolute inset-0 grid-overlay pointer-events-none z-10" />
      </div>

      {/* Intelligence Panel (Right) */}
      <aside className="w-80 lg:w-96 glass-panel border-l border-outline-variant/20 flex flex-col z-40">
        {/* Header */}
        <div className="px-6 py-4 glass-card-header flex items-center justify-between">
          <h2 className="font-[var(--font-inter)] text-[18px] leading-[24px] tracking-[0.02em] font-semibold text-primary-fixed-dim tracking-wide uppercase">
            Intelligence Feed
          </h2>
          <span className="material-symbols-outlined text-primary-fixed-dim text-[18px] status-pip">
            sensors
          </span>
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex-1 overflow-y-auto p-4 flex flex-col gap-4"
        >
          {/* AI Reasoning Feed */}
          <motion.div variants={fadeUp} className="glass-card rounded-sm p-1 relative overflow-hidden flex flex-col h-48">
            <div className="glass-card-header px-3 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-secondary">smart_toy</span>
              <span className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-secondary uppercase">
                AI Core Logic
              </span>
            </div>
            <div className="p-3 flex-1 overflow-y-auto font-[var(--font-geist)] text-[11px] leading-relaxed text-on-surface-variant">
              {activities.slice(0, 15).map((entry) => (
                <div key={entry.id} className="mb-2">
                  <span className={logLevelColors[entry.level] || "text-outline"}>
                    {logLevelLabels[entry.level] || "[LOG]"}
                  </span>{" "}
                  {entry.message}
                </div>
              ))}
            </div>
            <div className="tech-bracket" />
          </motion.div>

          {/* System Load */}
          <motion.div variants={fadeUp} className="glass-card rounded-sm p-1 relative">
            <div className="glass-card-header px-3 py-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-primary-fixed-dim">monitoring</span>
              <span className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-primary-fixed-dim uppercase">
                System Load
              </span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {systemMetrics.map((metric) => (
                <div key={metric.name}>
                  <div className="flex justify-between font-[var(--font-geist)] text-[10px] font-medium text-on-surface mb-1">
                    <span>{metric.name}</span>
                    <span className={`text-${metric.color}`}>{metric.value}%</span>
                  </div>
                  <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`bg-${metric.color} h-full shadow-[0_0_8px_currentColor]`}
                      style={{ width: `${metric.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Active Units */}
          <motion.div variants={fadeUp} className="glass-card rounded-sm p-1 relative flex-1 min-h-[200px]">
            <div className="glass-card-header px-3 py-2 flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-outline">group</span>
                <span className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline uppercase">
                  Active Units
                </span>
              </div>
              <span className="font-[var(--font-geist)] text-[10px] bg-primary-container/20 text-primary-fixed-dim px-2 py-0.5 rounded-sm">
                3 ONLINE
              </span>
            </div>
            <div className="p-2 flex flex-col gap-2 overflow-y-auto">
              {activeUnits.map((unit) => (
                <div
                  key={unit.id}
                  className={`flex items-center justify-between p-2 hover:bg-surface-container-highest/40 rounded-sm transition-colors cursor-pointer border border-transparent group ${
                    unit.isWarning
                      ? "hover:border-error/30 bg-error/5"
                      : "hover:border-outline-variant/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-sm bg-surface border flex items-center justify-center ${
                        unit.isWarning ? "border-error/50 text-error" : "border-outline-variant"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {unit.isWarning ? "warning" : "person"}
                      </span>
                    </div>
                    <div>
                      <div
                        className={`font-[var(--font-inter)] text-[14px] font-semibold ${
                          unit.isWarning
                            ? "text-error"
                            : "text-on-surface group-hover:text-primary-fixed-dim"
                        } transition-colors`}
                      >
                        {unit.name}
                      </div>
                      <div className={`font-[var(--font-geist)] text-[10px] ${unit.isWarning ? "text-error/70" : "text-outline"}`}>
                        {unit.isWarning ? unit.type : `${unit.sector} • ${unit.type}`}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      unit.isWarning
                        ? "bg-error shadow-[0_0_5px_rgba(255,180,171,0.8)] status-pip text-error"
                        : "bg-secondary shadow-[0_0_5px_rgba(68,221,193,0.8)]"
                    }`}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </aside>
    </div>
  );
}
