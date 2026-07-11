"use client";

import { motion } from "framer-motion";
import commsData from "@/data/communications.json";
import type { CommChannel } from "@/types";

const channels = commsData as CommChannel[];

const channelStatusColors: Record<string, string> = {
  active: "text-secondary",
  standby: "text-outline",
  encrypted: "text-primary-fixed-dim",
  jammed: "text-error",
};

const channelStatusDot: Record<string, string> = {
  active: "bg-secondary",
  standby: "bg-outline",
  encrypted: "bg-primary-fixed-dim",
  jammed: "bg-error animate-pulse",
};

export default function CommunicationsPage() {
  return (
    <div className="p-[var(--spacing-gutter)] flex flex-col gap-[var(--spacing-gutter)] h-[calc(100vh-4rem)]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-[var(--font-inter)] text-[28px] leading-[36px] tracking-[-0.01em] font-semibold text-on-surface uppercase">
          Communications Hub
        </h1>
        <p className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant mt-1 uppercase">
          Secure Channel Management & Monitoring
        </p>
      </motion.div>
      <div className="grid grid-cols-2 gap-[var(--spacing-gutter)] flex-1 overflow-auto">
        {channels.map((ch, idx) => (
          <motion.div
            key={ch.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="glass-card border border-outline-variant/20 p-5 flex flex-col gap-3 rounded-sm agent-card-hover cursor-pointer relative"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined text-[28px] ${channelStatusColors[ch.status] || "text-outline"}`}>
                  {ch.status === "encrypted" ? "lock" : ch.status === "jammed" ? "signal_wifi_off" : "cell_tower"}
                </span>
                <div>
                  <h3 className="font-[var(--font-inter)] text-[16px] font-semibold text-on-surface">{ch.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${channelStatusDot[ch.status] || "bg-outline"}`} />
                    <span className={`font-[var(--font-geist)] text-[10px] uppercase font-semibold ${channelStatusColors[ch.status] || "text-outline"}`}>
                      {ch.status}
                    </span>
                  </div>
                </div>
              </div>
              <span className="font-[var(--font-geist)] text-[12px] text-primary-fixed-dim bg-primary-fixed-dim/10 px-2 py-1 rounded-sm border border-primary-fixed-dim/20">
                {ch.frequency}
              </span>
            </div>
            <div className="glass-card bg-surface-container-lowest/50 p-3 rounded-sm border border-outline-variant/10">
              <div className="font-[var(--font-geist)] text-[10px] text-outline mb-1 uppercase">Last Transmission</div>
              <p className="font-[var(--font-inter)] text-[13px] text-on-surface-variant italic">&quot;{ch.lastMessage}&quot;</p>
            </div>
            <div className="tech-bracket" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
