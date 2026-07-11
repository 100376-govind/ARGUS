"use client";

import { motion } from "framer-motion";
import activityData from "@/data/activity.json";
import incidentsData from "@/data/incidents.json";
import type { ActivityEntry, ActiveUnit, Incident } from "@/types";
import MapView from "@/components/map/MapView";

const systemMetrics = [
  { name: "CPU USAGE", value: 78, color: "primary-fixed-dim" },
  { name: "NETWORK", value: 45, color: "secondary" },
];

const activeUnits: ActiveUnit[] = [
  { id: "1", name: "Agent K.", sector: "Sector 4", type: "Mobile", status: "active" },
  { id: "2", name: "Unit 09", sector: "Sector 7", type: "Static", status: "active" },
  { id: "3", name: "Recon Drone 2", sector: "", type: "Signal Lost", status: "alert", isWarning: true },
];

const activities = activityData as ActivityEntry[];
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

export default function DashboardOverview() {
  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Main Map Area */}
      <div className="flex-1 relative bg-surface-dim">
        <MapView incidents={incidents} />
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
              {activities.slice(0, 8).map((entry) => (
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
