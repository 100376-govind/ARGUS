"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import agentsData from "@/data/agents.json";
import type { AIAgent, FieldOperative, RosterAgent } from "@/types";

const fieldOperatives = agentsData.fieldOperatives as FieldOperative[];
const roster = agentsData.roster as RosterAgent[];

type TabKey = "ai" | "operatives" | "roster";
const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: "ai", label: "AI Agents", icon: "smart_toy" },
  { key: "operatives", label: "Field Operatives", icon: "person_pin_circle" },
  { key: "roster", label: "Roster", icon: "badge" },
];

const statusStyles: Record<string, { bg: string; text: string }> = {
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

export default function AgentsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("ai");
  const [selectedRosterId, setSelectedRosterId] = useState<string>(roster[0]?.id || "");
  const [aiAgents, setAiAgents] = useState<AIAgent[]>(agentsData.aiAgents as AIAgent[]);

  useEffect(() => {
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
            setAiAgents(json.data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch real-time agents:", err);
      }
    };
    
    fetchAgents();
    const interval = setInterval(fetchAgents, 3000);
    return () => clearInterval(interval);
  }, []);

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
              {aiAgents.map((agent, idx) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className={`glass-card border border-outline-variant/20 p-5 flex flex-col gap-4 relative agent-card-hover cursor-pointer group md:col-span-2 ${
                    idx === 3 ? "md:col-start-2" : ""
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                      agent.status === "alert" ? "border-error bg-error/10" : "border-primary-fixed-dim/50 bg-primary-fixed-dim/10"
                    }`}>
                      <span className={`material-symbols-outlined text-[24px] ${
                        agent.status === "alert" ? "text-error" : "text-primary-fixed-dim"
                      }`}>{agent.icon}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-[var(--font-inter)] text-[18px] font-semibold text-on-surface">{agent.name}</h3>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyles[agent.status]?.bg || "bg-outline"}`} />
                        <span className={`font-[var(--font-geist)] text-[10px] uppercase ${statusStyles[agent.status]?.text || "text-outline"}`}>
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
                    <p className="font-[var(--font-inter)] text-[13px] text-on-surface-variant leading-relaxed">{agent.currentTask}</p>
                  </div>
                  {/* Metrics */}
                  <div className="flex gap-8 mt-auto">
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-[var(--font-geist)] text-[10px] text-on-surface uppercase">CPU</span>
                        <span className="font-[var(--font-geist)] text-[12px] text-on-surface">{agent.cpu}%</span>
                      </div>
                      <div className="w-20 bg-surface-container-highest h-1 rounded-full mt-1 overflow-hidden">
                        <div className="bg-primary-fixed-dim h-full" style={{ width: `${agent.cpu}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-[var(--font-geist)] text-[10px] text-on-surface uppercase">MEM</span>
                        <span className="font-[var(--font-geist)] text-[12px] text-on-surface">{agent.memory}%</span>
                      </div>
                      <div className="w-20 bg-surface-container-highest h-1 rounded-full mt-1 overflow-hidden">
                        <div className="bg-secondary h-full" style={{ width: `${agent.memory}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="tech-bracket" />
                </motion.div>
              ))}
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
                    <thead className="sticky top-0 bg-surface-container-lowest/90 backdrop-filter backdrop-blur-sm z-10">
                      <tr className="font-[var(--font-geist)] text-[10px] tracking-[0.1em] font-semibold text-outline-variant border-b border-outline-variant/20">
                        <th className="p-3">AGENT ID</th>
                        <th className="p-3">DESIGNATION</th>
                        <th className="p-3">SPECIALTY</th>
                        <th className="p-3">STATUS</th>
                        <th className="p-3">LOCATION</th>
                        <th className="p-3 text-right">RATING</th>
                      </tr>
                    </thead>
                    <tbody className="font-[var(--font-geist)] text-[13px] font-medium">
                      {roster.map((agent) => {
                        const isSelected = selectedRosterId === agent.id;
                        const sSt = statusStyles[agent.status] || statusStyles.standby;
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
                        <div className={`text-[9px] px-1.5 py-0.5 rounded-sm font-bold uppercase ${statusStyles[selectedAgent?.status || "standby"]?.bg} ${statusStyles[selectedAgent?.status || "standby"]?.text}`}>
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

                  {/* Combat Metrics (Radar Placeholder) */}
                  <div>
                    <h4 className="font-[var(--font-inter)] text-[14px] font-semibold text-on-surface border-b border-outline-variant/20 pb-2 mb-4">
                      Combat Metrics
                    </h4>
                    <div className="flex items-center justify-center h-44">
                      <svg viewBox="0 0 200 200" className="w-44 h-44">
                        {/* Pentagon grid */}
                        {[1, 0.66, 0.33].map((s, i) => (
                          <polygon
                            key={i}
                            points={pentagon(100, 100, 80 * s)}
                            fill="none"
                            stroke="rgba(0,218,243,0.15)"
                            strokeWidth="1"
                          />
                        ))}
                        {/* Data polygon */}
                        <polygon
                          points={pentagon(100, 100, 80, [0.9, 0.7, 0.75, 0.85, 0.6])}
                          fill="rgba(0,218,243,0.15)"
                          stroke="#00daf3"
                          strokeWidth="2"
                        />
                        {/* Labels */}
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
