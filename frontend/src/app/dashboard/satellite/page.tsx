"use client";

import { motion } from "framer-motion";

export default function SatellitePage() {
  return (
    <div className="p-[var(--spacing-gutter)] flex flex-col gap-[var(--spacing-gutter)] h-[calc(100vh-4rem)]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-[var(--font-inter)] text-[28px] leading-[36px] tracking-[-0.01em] font-semibold text-on-surface uppercase">
          Satellite Surveillance
        </h1>
        <p className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant mt-1 uppercase">
          Orbital Asset Management & Imagery
        </p>
      </motion.div>
      <div className="flex-1 grid grid-cols-12 gap-[var(--spacing-gutter)]">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-8 glass-panel rounded-sm relative overflow-hidden flex items-center justify-center"
        >
          <div className="absolute inset-0 grid-overlay opacity-20" />
          <div className="flex flex-col items-center gap-4 z-10">
            <span className="material-symbols-outlined text-[64px] text-primary-fixed-dim/40">satellite_alt</span>
            <p className="font-[var(--font-inter)] text-[16px] text-on-surface uppercase">Satellite Feed</p>
            <p className="font-[var(--font-geist)] text-[12px] text-outline">Next pass: T-12 minutes • Orbit: LEO-7</p>
          </div>
          <div className="tech-bracket" />
        </motion.div>
        <div className="col-span-4 flex flex-col gap-[var(--spacing-gutter)]">
          {[
            { label: "Orbit Status", value: "STABLE", icon: "public", color: "text-secondary" },
            { label: "Signal Strength", value: "94.2%", icon: "signal_cellular_alt", color: "text-primary-fixed-dim" },
            { label: "Next Pass", value: "T-12:00", icon: "schedule", color: "text-on-surface" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="glass-card border border-outline-variant/20 p-4 flex items-center gap-4 flex-1 rounded-sm agent-card-hover"
            >
              <span className={`material-symbols-outlined text-[24px] ${stat.color}`}>{stat.icon}</span>
              <div>
                <div className="font-[var(--font-geist)] text-[10px] text-outline uppercase">{stat.label}</div>
                <div className={`font-[var(--font-inter)] text-[18px] font-semibold ${stat.color}`}>{stat.value}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
