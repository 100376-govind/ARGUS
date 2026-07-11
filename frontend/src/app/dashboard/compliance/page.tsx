"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import incidentsData from "@/data/incidents.json";

interface Incident {
  id: string;
  incidentType: string;
  status: string;
}

export default function CompliancePage() {
  const [incidents, setIncidents] = useState<Incident[]>(incidentsData as Incident[]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [complianceData, setComplianceData] = useState<any>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    sitrep: true,
    summary: false,
    decision: false,
    recommendations: false,
  });

  // Load incidents from API
  useEffect(() => {
    async function loadIncidents() {
      try {
        const res = await fetch("http://localhost:3001/api/incidents");
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setIncidents(json.data);
            if (json.data.length > 0) {
              setSelectedId(json.data[0].id);
            }
          }
        }
      } catch (err) {
        console.warn("Could not load incidents from API, using fallback data", err);
        if (incidentsData.length > 0) {
          setSelectedId(incidentsData[0].id);
        }
      }
    }
    loadIncidents();
  }, []);

  // Fetch compliance data
  const fetchCompliance = async (id: string) => {
    if (!id) return;
    const cleanId = id.replace("#", "");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:3001/api/compliance/${cleanId}`);
      if (!res.ok) {
        throw new Error("Failed to load compliance data");
      }
      const json = await res.json();
      if (json.success) {
        setComplianceData(json.data);
      } else {
        throw new Error(json.errors?.[0] || "Unknown compliance error");
      }
    } catch (err: any) {
      setError(err.message || "Network Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId) {
      fetchCompliance(selectedId);
    }
  }, [selectedId]);

  // Setup Socket.io subscription
  useEffect(() => {
    const socket = io("http://localhost:3001/risk");

    socket.on("connect", () => {
      console.log("Compliance Panel: Connected to Socket.io namespace /risk");
    });

    const cleanId = selectedId.replace("#", "");

    if (cleanId) {
      socket.emit("subscribe:incident", cleanId);
    }

    socket.on("dashboardUpdated", () => {
      if (cleanId) fetchCompliance(cleanId);
    });

    socket.on("timelineUpdated", (data: any) => {
      if (data.incidentId === cleanId) {
        setComplianceData((prev: any) => prev ? { ...prev, timeline: data.timeline } : prev);
      }
    });

    return () => {
      if (cleanId) {
        socket.emit("unsubscribe:incident", cleanId);
      }
      socket.disconnect();
    };
  }, [selectedId]);

  const toggleCard = (card: string) => {
    setExpandedCards((prev) => ({ ...prev, [card]: !prev[card] }));
  };

  const handleDownloadPDF = () => {
    if (!selectedId) return;
    const cleanId = selectedId.replace("#", "");
    window.open(`http://localhost:3001/api/compliance/pdf/${cleanId}`);
  };

  const timelineStages = [
    { name: "Incident Received", key: "received", label: "Dispatcher Stage" },
    { name: "Priority Assigned", key: "evaluated", label: "Risk Evaluator Stage" },
    { name: "Validation Completed", key: "validated", label: "Field Validator Stage" },
    { name: "Resources Allocated", key: "allocated", label: "Resource Allocator Stage" },
  ];

  return (
    <div className="p-8 flex flex-col gap-8 h-[calc(100vh-4rem)] overflow-y-auto bg-[#080B0F] text-white">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1A2633] pb-6">
        <div>
          <h1 className="font-[var(--font-inter)] text-3xl font-extrabold uppercase tracking-wide bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(34,211,238,0.3)]">
            Compliance Auditor Command Center
          </h1>
          <p className="font-[var(--font-geist)] text-xs text-[#6B859E] uppercase tracking-widest mt-1">
            Real-Time Audit Records & Incident Timeline Compliance Verification
          </p>
        </div>

        {/* Dropdown Selector */}
        <div className="flex items-center gap-3">
          <label className="font-[var(--font-geist)] text-xs text-[#6B859E] uppercase tracking-widest">
            Select Incident:
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-[#101622] border border-[#233549] text-white px-4 py-2 rounded-sm text-xs font-semibold focus:outline-none focus:border-cyan-500 transition-colors"
          >
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.id} ({(inc.incidentType || (inc as any).type || "unknown").toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Dashboard */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 h-96 bg-[#101622]/50 animate-pulse rounded-sm border border-[#233549]/30" />
          <div className="lg:col-span-2 h-96 bg-[#101622]/50 animate-pulse rounded-sm border border-[#233549]/30" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-96 bg-[#101622] border border-red-900/30 rounded-sm p-8 text-center">
          <span className="material-symbols-outlined text-red-500 text-[64px] mb-4">gavel</span>
          <h2 className="text-xl font-bold uppercase tracking-wider text-red-400 mb-2">Audit Synchronization Failed</h2>
          <p className="text-sm text-[#8EA2B8] max-w-md mb-6">{error}</p>
          <button
            onClick={() => fetchCompliance(selectedId)}
            className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-800 text-white text-xs uppercase tracking-widest font-bold rounded-sm hover:opacity-90 transition-opacity"
          >
            Retry Synchronization
          </button>
        </div>
      ) : complianceData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Stepper Timeline & Summary (1 Column) */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            <div className="glass-panel p-6 border border-[#22D3EE]/20 rounded-sm bg-[#101622]/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-2xl rounded-full" />
              <div className="flex items-center justify-between mb-6">
                <span className="font-[var(--font-geist)] text-xs text-[#6B859E] uppercase tracking-widest">
                  Compliance Status
                </span>
                <span
                  className={`px-3 py-1 rounded-sm text-[10px] font-extrabold uppercase tracking-widest ${
                    complianceData.complianceStatus === "Complete"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {complianceData.complianceStatus}
                </span>
              </div>

              {/* Stepper Timeline UI */}
              <div className="relative pl-6 border-l-2 border-[#1E293B]">
                {timelineStages.map((stage, idx) => {
                  const event = complianceData.timeline.find((t: any) => t.stage === stage.key);
                  const isActive = !!event;

                  return (
                    <motion.div
                      key={stage.key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="mb-8 relative"
                    >
                      {/* Node circle icon marker */}
                      <span
                        className={`absolute -left-[35px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] border ${
                          isActive
                            ? "bg-emerald-950 border-emerald-400 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                            : "bg-[#0F172A] border-[#334155] text-slate-500"
                        }`}
                      >
                        {isActive ? "✓" : idx + 1}
                      </span>

                      <div>
                        <h4
                          className={`text-sm font-bold uppercase tracking-wider ${
                            isActive ? "text-[#E2E8F0]" : "text-slate-500"
                          }`}
                        >
                          {stage.name}
                        </h4>
                        <p className="text-[10px] text-[#6B859E] uppercase tracking-widest mt-0.5">
                          {stage.label}
                        </p>
                        {isActive && (
                          <div className="mt-2 text-xs text-slate-300 bg-[#0A0F17] p-3 rounded-sm border border-[#1A2633]/60 font-[var(--font-geist)]">
                            {event.description}
                            <div className="text-[9px] text-[#52708E] mt-1.5 uppercase">
                              Time: {new Date(event.timestamp).toLocaleTimeString()} | Executed By: {event.agentName}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Actions Footer */}
              <div className="mt-6 pt-6 border-t border-[#1E293B] flex gap-3">
                <button
                  onClick={handleDownloadPDF}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-[10px] uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Export Audit PDF
                </button>
              </div>
            </div>
          </div>

          {/* AI Reports Display (2 Columns) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Expandable Cards for SITREP, summaries etc */}
            {[
              {
                id: "sitrep",
                title: "Situation Report (SITREP)",
                content: complianceData.auditRecord.metadata.sitrep || "SITREP not generated.",
                icon: "shield",
              },
              {
                id: "summary",
                title: "Incident Intelligence Summary",
                content: complianceData.auditRecord.metadata.incidentSummary || "Summary not generated.",
                icon: "description",
              },
              {
                id: "decision",
                title: "Decision Summary Matrix",
                content: complianceData.auditRecord.metadata.decisionSummary || "Decision details not populated.",
                icon: "analytics",
              },
            ].map((card) => (
              <div
                key={card.id}
                className="border border-[#1A2633] rounded-sm bg-[#101622]/40 overflow-hidden"
              >
                <button
                  onClick={() => toggleCard(card.id)}
                  className="w-full flex items-center justify-between p-5 bg-[#101622]/60 hover:bg-[#101622] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#22D3EE] text-[20px]">{card.icon}</span>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                      {card.title}
                    </h3>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">
                    {expandedCards[card.id] ? "expand_less" : "expand_more"}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {expandedCards[card.id] && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-[#1A2633]"
                    >
                      <div className="p-6 text-sm text-slate-300 leading-relaxed font-[var(--font-geist)] bg-[#0C111C]/80">
                        {card.content}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* Recommendations Display Card */}
            <div className="border border-[#1A2633] rounded-sm bg-[#101622]/40 overflow-hidden">
              <button
                onClick={() => toggleCard("recommendations")}
                className="w-full flex items-center justify-between p-5 bg-[#101622]/60 hover:bg-[#101622] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#34D399] text-[20px]">lightbulb</span>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Audit Recommendations
                  </h3>
                </div>
                <span className="material-symbols-outlined text-slate-400">
                  {expandedCards.recommendations ? "expand_less" : "expand_more"}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {expandedCards.recommendations && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-[#1A2633]"
                  >
                    <div className="p-6 bg-[#0C111C]/80">
                      {Array.isArray(complianceData.auditRecord.metadata.recommendations) &&
                      complianceData.auditRecord.metadata.recommendations.length > 0 ? (
                        <ul className="flex flex-col gap-3 font-[var(--font-geist)]">
                          {complianceData.auditRecord.metadata.recommendations.map((rec: string, idx: number) => (
                            <motion.li
                              key={idx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="text-xs text-slate-300 flex items-start gap-2"
                            >
                              <span className="text-emerald-400 font-bold shrink-0">✦</span>
                              {rec}
                            </motion.li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-500 text-xs uppercase tracking-wider">
                          No recommendations available.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
