"use client";

import { motion } from "framer-motion";
import dronesData from "@/data/drones.json";
import type { Drone } from "@/types";

const drones = dronesData as Drone[];

const droneStatusColors: Record<string, string> = {
  active: "text-secondary",
  patrol: "text-primary-fixed-dim",
  returning: "text-primary",
  maintenance: "text-outline",
  "signal-lost": "text-error",
};

const droneStatusDot: Record<string, string> = {
  active: "bg-secondary",
  patrol: "bg-primary-fixed-dim",
  returning: "bg-primary",
  maintenance: "bg-outline",
  "signal-lost": "bg-error animate-pulse",
};

export default function DronesPage() {
  return (
    <div className="p-[var(--spacing-gutter)] flex flex-col gap-[var(--spacing-gutter)] h-[calc(100vh-4rem)]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-[var(--font-inter)] text-[28px] leading-[36px] tracking-[-0.01em] font-semibold text-on-surface uppercase">
          Drone Command
        </h1>
        <p className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant mt-1 uppercase">
          Fleet Management & Live Feeds
        </p>
      </motion.div>
      <div className="grid grid-cols-3 gap-[var(--spacing-gutter)] flex-1 overflow-auto">
        {drones.map((drone, idx) => (
          <motion.div
            key={drone.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className={`glass-card border p-5 flex flex-col gap-3 rounded-sm agent-card-hover cursor-pointer relative ${
              drone.status === "signal-lost" ? "border-error/40" : "border-outline-variant/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined text-[28px] ${droneStatusColors[drone.status] || "text-outline"}`}>
                  {drone.status === "signal-lost" ? "signal_wifi_off" : "flight"}
                </span>
                <div>
                  <h3 className="font-[var(--font-inter)] text-[16px] font-semibold text-on-surface">{drone.callsign}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${droneStatusDot[drone.status] || "bg-outline"}`} />
                    <span className={`font-[var(--font-geist)] text-[10px] uppercase font-semibold ${droneStatusColors[drone.status] || "text-outline"}`}>
                      {drone.status.replace("-", " ")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-[var(--font-inter)] text-[22px] font-bold text-primary-fixed-dim">{drone.battery}%</div>
                <div className="font-[var(--font-geist)] text-[9px] text-outline uppercase">Battery</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 font-[var(--font-geist)] text-[12px] text-on-surface-variant">
              <div className="flex flex-col">
                <span className="text-outline text-[10px] uppercase">Altitude</span>
                <span>{drone.altitude}M</span>
              </div>
              <div className="flex flex-col">
                <span className="text-outline text-[10px] uppercase">Speed</span>
                <span>{drone.speed} KPH</span>
              </div>
              <div className="flex flex-col col-span-2">
                <span className="text-outline text-[10px] uppercase">Location</span>
                <span>{drone.location}</span>
              </div>
            </div>
            {drone.assignedIncident && (
              <div className="mt-1 px-2 py-1 bg-error/10 border border-error/30 rounded-sm font-[var(--font-geist)] text-[10px] text-error">
                Assigned: {drone.assignedIncident}
              </div>
            )}
            <div className="tech-bracket" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
