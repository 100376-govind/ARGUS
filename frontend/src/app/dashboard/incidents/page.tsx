"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import incidentsData from "@/data/incidents.json";
import type { Incident } from "@/types";
import MapView from "@/components/map/MapView";

const incidents = incidentsData as Incident[];

const priorityConfig: Record<string, { color: string; bgColor: string; pulse?: boolean }> = {
  critical: { color: "text-error", bgColor: "bg-error", pulse: true },
  high: { color: "text-tertiary-container", bgColor: "bg-tertiary-container" },
  medium: { color: "text-secondary-container", bgColor: "bg-secondary-container" },
  low: { color: "text-outline", bgColor: "bg-outline" },
};

export default function IncidentsPage() {
  const [selectedIncident, setSelectedIncident] = useState<Incident>(incidents[0]);
  const [search, setSearch] = useState("");

  const filtered = incidents.filter(
    (inc) =>
      inc.id.toLowerCase().includes(search.toLowerCase()) ||
      inc.location.toLowerCase().includes(search.toLowerCase()) ||
      inc.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] p-[var(--spacing-gutter)] gap-[var(--spacing-panel-gap)]">
      {/* Incidents Table */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 flex flex-col glass-panel rounded-l-sm overflow-hidden relative"
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
        {/* Header */}
        <div className="h-12 bg-surface-container-highest/50 flex items-center px-4 border-b border-outline-variant/20">
          <h3 className="font-[var(--font-inter)] text-[18px] leading-[24px] tracking-[0.02em] font-semibold text-on-surface flex-1">
            Active Incidents Database
          </h3>
          <div className="relative w-64">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, Location..."
              className="w-full bg-surface-container border-b border-outline-variant focus:border-primary-container focus:outline-none text-on-surface font-[var(--font-inter)] text-[14px] pl-8 py-1 transition-all h-8 rounded-t-sm"
            />
          </div>
        </div>
        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-surface-container-lowest/90 backdrop-filter backdrop-blur-sm z-10">
              <tr className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant border-b border-outline-variant/20">
                <th className="p-3">ID</th>
                <th className="p-3">PRIORITY</th>
                <th className="p-3">TYPE</th>
                <th className="p-3">LOCATION</th>
                <th className="p-3">RESPONSE TEAM</th>
                <th className="p-3">STATUS</th>
              </tr>
            </thead>
            <tbody className="font-[var(--font-geist)] text-[13px] font-medium text-on-surface">
              {filtered.map((inc) => {
                const pCfg = priorityConfig[inc.priority] || priorityConfig.low;
                const isSelected = selectedIncident.id === inc.id;
                return (
                  <tr
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`border-b border-outline-variant/10 hover:bg-surface-container-highest/30 cursor-pointer transition-colors ${
                      isSelected ? "bg-primary-container/5" : ""
                    }`}
                  >
                    <td className="p-3 text-on-surface-variant">{inc.id}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 ${pCfg.color}`}>
                        <span className={`w-2 h-2 rounded-full ${pCfg.bgColor} ${pCfg.pulse ? "animate-pulse" : ""}`} />
                        {inc.priority.charAt(0).toUpperCase() + inc.priority.slice(1)}
                      </span>
                    </td>
                    <td className="p-3">{inc.type}</td>
                    <td className="p-3">{inc.location}</td>
                    <td className={`p-3 ${inc.status === "in-progress" ? "text-secondary" : "text-on-surface-variant"}`}>
                      {inc.responseTeam}
                    </td>
                    <td className={`p-3 ${inc.status === "in-progress" ? "text-secondary" : "text-on-surface-variant"}`}>
                      {inc.status === "in-progress" ? "In Progress" : inc.status.charAt(0).toUpperCase() + inc.status.slice(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Detail Side Panel */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="w-96 flex flex-col gap-[var(--spacing-panel-gap)]"
      >
        {/* Map Widget */}
        <div className="h-64 glass-panel rounded-tr-sm relative overflow-hidden">
          <MapView incidents={[selectedIncident]} />
          <div className="absolute top-2 left-2 bg-surface-container-lowest/80 backdrop-filter backdrop-blur-sm px-2 py-1 border border-outline-variant/50 font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-primary z-10">
            SITREP: {selectedIncident.id}
          </div>
        </div>

        {/* Drone Feed */}
        <div className="flex-1 glass-panel rounded-br-sm p-4 flex flex-col relative overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant uppercase">
              LIVE FEED: DRONE-04
            </h4>
            <span className="flex items-center gap-2 text-error font-[var(--font-geist)] text-[10px]">
              <span className="w-1.5 h-1.5 bg-error rounded-full animate-pulse" />
              REC
            </span>
          </div>
          <div className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-sm relative overflow-hidden flex items-center justify-center min-h-[200px]">
            {/* HUD Elements */}
            <div className="absolute inset-0 pointer-events-none p-2 flex flex-col justify-between font-[var(--font-geist)] text-[10px] text-primary/70">
              <div className="flex justify-between">
                <span>ALT: 450M</span>
                <span>SPD: 24KPH</span>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-primary/30 w-16 h-16 rounded-full flex items-center justify-center">
                <div className="w-1 h-4 bg-primary/50 absolute top-0" />
                <div className="w-1 h-4 bg-primary/50 absolute bottom-0" />
                <div className="w-4 h-1 bg-primary/50 absolute left-0" />
                <div className="w-4 h-1 bg-primary/50 absolute right-0" />
              </div>
              <div className="flex justify-between">
                <span>IR: ACTIVE</span>
                <span>TGT: LOCK</span>
              </div>
            </div>
          </div>
          {/* Details */}
          <div className="mt-4 grid grid-cols-2 gap-4 font-[var(--font-geist)] text-[13px] font-medium text-on-surface-variant">
            <div>
              <span className="block text-outline text-[10px] uppercase mb-1">Commander</span>
              <span className="text-on-surface">{selectedIncident.commander || "N/A"}</span>
            </div>
            <div>
              <span className="block text-outline text-[10px] uppercase mb-1">ETA</span>
              <span className="text-secondary">{selectedIncident.eta || "N/A"}</span>
            </div>
          </div>
          <button className="mt-4 w-full py-2 bg-primary/10 border border-primary text-primary hover:bg-primary/20 hover:shadow-[0_0_15px_rgba(0,218,243,0.2)] transition-all font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold rounded-sm uppercase">
            Deploy Reinforcements
          </button>
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-outline-variant/50" />
        </div>
      </motion.div>
    </div>
  );
}
