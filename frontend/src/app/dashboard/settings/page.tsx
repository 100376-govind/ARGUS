"use client";

import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="p-[var(--spacing-gutter)] flex flex-col gap-[var(--spacing-gutter)] h-[calc(100vh-4rem)]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-[var(--font-inter)] text-[28px] leading-[36px] tracking-[-0.01em] font-semibold text-on-surface uppercase">
          System Settings
        </h1>
        <p className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant mt-1 uppercase">
          Configuration & Preferences
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-[var(--spacing-gutter)]">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-sm p-6 relative"
        >
          <h3 className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-secondary uppercase mb-4">Operator Profile</h3>
          <div className="flex items-center gap-6 mb-6">
            <div className="w-16 h-16 rounded-full bg-surface-container-highest border border-outline-variant/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px] text-outline">person</span>
            </div>
            <div>
              <div className="font-[var(--font-inter)] text-[18px] font-semibold text-on-surface">{user?.name || "Commander"}</div>
              <div className="font-[var(--font-geist)] text-[12px] text-outline">{user?.id || "AX-0001"} • {user?.sector || "Sector-7"}</div>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: "Display Name", value: user?.name || "Commander" },
              { label: "Role", value: user?.role || "Admin" },
              { label: "Sector", value: user?.sector || "Sector-7" },
            ].map((field) => (
              <div key={field.label}>
                <label className="font-[var(--font-geist)] text-[10px] tracking-[0.1em] font-semibold text-on-surface-variant uppercase block mb-1">{field.label}</label>
                <input
                  type="text"
                  defaultValue={field.value}
                  className="w-full bg-transparent border-b border-outline-variant text-on-surface font-[var(--font-geist)] text-[13px] py-1.5 px-1 focus:outline-none focus:border-primary-fixed-dim transition-colors"
                />
              </div>
            ))}
          </div>
          <div className="tech-bracket" />
        </motion.div>

        {/* System Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel rounded-sm p-6 relative"
        >
          <h3 className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-secondary uppercase mb-4">System Configuration</h3>
          <div className="space-y-4">
            {[
              { label: "Scanline Overlay", desc: "Enable CRT-style scanline effect", checked: true },
              { label: "Sound Effects", desc: "Alert sounds and notifications", checked: false },
              { label: "Dark Mode", desc: "System dark mode (always on)", checked: true },
              { label: "Real-time Updates", desc: "WebSocket data streaming", checked: true },
            ].map((setting) => (
              <div key={setting.label} className="flex items-center justify-between p-3 glass-card border border-outline-variant/20 rounded-sm">
                <div>
                  <div className="font-[var(--font-inter)] text-[14px] text-on-surface">{setting.label}</div>
                  <div className="font-[var(--font-geist)] text-[11px] text-outline">{setting.desc}</div>
                </div>
                <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${setting.checked ? "bg-primary-fixed-dim" : "bg-surface-container-highest"}`}>
                  <div className={`w-4 h-4 rounded-full bg-surface absolute top-0.5 transition-all ${setting.checked ? "left-5" : "left-0.5"}`} />
                </div>
              </div>
            ))}
          </div>
          <div className="tech-bracket" />
        </motion.div>
      </div>
    </div>
  );
}
