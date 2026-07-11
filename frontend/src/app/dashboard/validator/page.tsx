"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import { formatTimestamp } from "@/lib/utils";

interface ValidationReport {
  incidentId: string;
  validationStatus: "Verified" | "Likely Valid" | "Needs Manual Verification" | "Unverified" | "Pending";
  validationScore: number;
  evidenceBreakdown: Array<{
    source: string;
    confidence: number;
    weight: number;
    weightedContribution: number;
    status: string;
  }>;
  supportingEvidence: string[];
  conflictingEvidence: string[];
  summary: string;
  recommendation: string;
  timestamp: number;
}

interface NetworkIntelligence {
  connectedDevices: number;
  activeDevices: number;
  networkHealth: number;
  packetLoss: number;
  signalStrength: number;
  internetReachability: boolean;
  occupancyEstimate: string;
  infrastructureStatus: string;
  communicationStatus: string;
}

export default function FieldValidatorDashboard() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>("");
  
  // Real data states
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [network, setNetwork] = useState<NetworkIntelligence | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  
  // Loading & error states
  const [isLoading, setIsLoading] = useState(false);
  const [isCollectingNetwork, setIsCollectingNetwork] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Typewriter effect state
  const [typewriterText, setTypewriterText] = useState<string[]>([]);
  const [currentTypewriterIdx, setCurrentTypewriterIdx] = useState(0);

  const socketRef = useRef<Socket | null>(null);

  // Fetch all incidents to populate Selector list
  useEffect(() => {
    async function loadIncidents() {
      try {
        const res = await fetch("http://localhost:3001/api/incidents", {
          headers: {
            Authorization: "Bearer mock-admin-token",
          },
        });
        if (res.ok) {
          const json = await res.json();
          setIncidents(json.data || []);
          if (json.data && json.data.length > 0) {
            setSelectedIncidentId(json.data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load incidents", err);
      }
    }
    loadIncidents();
  }, []);

  // Set up real-time Socket.io listener
  useEffect(() => {
    const socket = io("http://localhost:3001/risk", {
      path: "/socket.io",
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to validation namespace");
    });

    socket.on("validation:started", (data: any) => {
      if (data.incidentId === selectedIncidentId) {
        setIsCollectingNetwork(true);
        setError(null);
      }
    });

    socket.on("validation:network_collected", (data: any) => {
      if (data.incidentId === selectedIncidentId) {
        setIsCollectingNetwork(false);
        setIsAnalyzingAI(true);
        if (data.snapshot) {
          setNetwork(data.snapshot);
        }
      }
    });

    socket.on("validation:evidence_normalized", (data: any) => {
      if (data.incidentId === selectedIncidentId) {
        // Updated state indicators
      }
    });

    socket.on("validation:completed", (data: any) => {
      if (data.incidentId === selectedIncidentId) {
        setIsAnalyzingAI(false);
        if (data.report) {
          setReport(data.report);
        }
        // Reload history log list
        fetchHistory(selectedIncidentId);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedIncidentId]);

  // Join room for the selected incident
  useEffect(() => {
    if (socketRef.current && selectedIncidentId) {
      socketRef.current.emit("subscribe:incident", selectedIncidentId);
    }
  }, [selectedIncidentId]);

  // Fetch report data on Incident change
  useEffect(() => {
    if (selectedIncidentId) {
      fetchValidationData(selectedIncidentId);
    }
  }, [selectedIncidentId]);

  const fetchValidationData = async (incidentId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [reportRes, networkRes] = await Promise.all([
        fetch(`http://localhost:3001/api/field-validator/${incidentId}`, {
          headers: { Authorization: "Bearer mock-admin-token" },
        }),
        fetch(`http://localhost:3001/api/field-validator/network/${incidentId}`, {
          headers: { Authorization: "Bearer mock-admin-token" },
        }),
      ]);

      if (reportRes.ok && networkRes.ok) {
        const reportJson = await reportRes.json();
        const networkJson = await networkRes.json();

        setReport(reportJson.data?.validationReport);
        setNetwork(networkJson.data?.networkSnapshot);

        await fetchHistory(incidentId);
      } else {
        setError("Validation metrics unavailable for this incident yet.");
      }
    } catch (err) {
      setError("Failed to communicate with ARGUS Validation API.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async (incidentId: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/field-validator/history/${incidentId}`, {
        headers: { Authorization: "Bearer mock-admin-token" },
      });
      if (res.ok) {
        const json = await res.json();
        setTimeline(json.data?.timeline || []);
      }
    } catch (err) {
      console.error("Failed to load validation history logs", err);
    }
  };

  // Run validation manually for this incident (useful for UI interaction/retry)
  const handleValidateTrigger = async () => {
    setIsCollectingNetwork(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:3001/api/risk/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-admin-token",
        },
        body: JSON.stringify({ incidentId: selectedIncidentId }),
      });
      if (!res.ok) {
        throw new Error("Validation trigger failed");
      }
    } catch (err) {
      setError("Failed to run real-time validator loop. Try again.");
      setIsCollectingNetwork(false);
    }
  };

  // Typewriter effect logic
  useEffect(() => {
    if (report?.summary) {
      const lines = [
        report.summary,
        report.recommendation,
        `Confidence verified at ${report.validationScore}%`,
      ].filter(Boolean);
      setTypewriterText(lines);
      setCurrentTypewriterIdx(0);
    } else {
      setTypewriterText([]);
    }
  }, [report]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Verified":
        return "text-secondary border-secondary/35 bg-secondary/10";
      case "Likely Valid":
        return "text-cyan-400 border-cyan-400/35 bg-cyan-400/10";
      case "Needs Manual Verification":
        return "text-amber-400 border-amber-400/35 bg-amber-400/10";
      case "Unverified":
        return "text-red-400 border-red-400/35 bg-red-400/10";
      default:
        return "text-outline border-outline/35 bg-outline/10";
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6 text-on-surface select-none font-[var(--font-geist)]">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h1 className="font-[var(--font-inter)] text-2xl font-bold tracking-wider text-primary-fixed-dim flex items-center gap-2">
            <span className="material-symbols-outlined text-[28px] animate-pulse">analytics</span>
            FIELD VALIDATOR CONTROL PANEL
          </h1>
          <p className="text-[11px] text-outline uppercase tracking-widest mt-1">
            Real-time Environment & Multi-Source Evidence Fusion
          </p>
        </div>

        {/* Incident Selector */}
        <div className="flex items-center gap-3">
          <label className="text-[11px] text-outline font-bold tracking-widest uppercase">Target incident:</label>
          <select
            value={selectedIncidentId}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            className="bg-surface-container-highest border border-outline-variant/30 text-on-surface text-[12px] font-bold px-3 py-1.5 rounded-sm outline-none focus:border-secondary transition-all"
          >
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.id} - {inc.incidentType}
              </option>
            ))}
          </select>

          <button
            onClick={handleValidateTrigger}
            disabled={isCollectingNetwork || isAnalyzingAI}
            className="bg-secondary/15 hover:bg-secondary/25 border border-secondary text-secondary text-[11px] tracking-widest font-bold px-4 py-1.5 rounded-sm uppercase transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[14px]">autorenew</span>
            Run Validator
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel border-error/30 bg-error/5 p-4 rounded-sm flex items-start gap-3 text-error text-[12px] uppercase">
          <span className="material-symbols-outlined text-[18px]">warning</span>
          <div className="flex-1">
            <div className="font-bold">System Status Warning</div>
            <div className="mt-1 normal-case text-on-surface-variant">{error}</div>
          </div>
          <button
            onClick={() => fetchValidationData(selectedIncidentId)}
            className="bg-error/20 border border-error text-error px-3 py-1 text-[10px] font-bold rounded-sm uppercase cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Section 1 & Section 2 */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Section 1: Validation Status Card */}
          <div className="glass-panel border border-outline-variant/20 p-5 rounded-sm relative overflow-hidden flex flex-col gap-4">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-secondary" />
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[14px] font-semibold tracking-wider text-primary">VALIDATION STATE SNAPSHOT</h3>
                <span className="text-[10px] text-outline uppercase font-bold mt-0.5 block">
                  Incident ID: {selectedIncidentId || "N/A"}
                </span>
              </div>
              {report && (
                <span className={`px-2.5 py-0.5 rounded-sm border text-[10px] font-bold uppercase ${getStatusColor(report.validationStatus)}`}>
                  {report.validationStatus}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="h-24 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-secondary" />
              </div>
            ) : report ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <div className="bg-surface-container-lowest/50 border border-outline-variant/10 p-3 rounded-sm">
                  <span className="text-[10px] text-outline uppercase block">Validation Score</span>
                  <span className="text-2xl font-bold text-secondary mt-1 block">{report.validationScore}%</span>
                </div>
                <div className="bg-surface-container-lowest/50 border border-outline-variant/10 p-3 rounded-sm">
                  <span className="text-[10px] text-outline uppercase block">Last Updated</span>
                  <span className="text-[12px] font-semibold text-on-surface mt-2 block">
                    {new Date(report.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="bg-surface-container-lowest/50 border border-outline-variant/10 p-3 rounded-sm flex flex-col justify-between">
                  <span className="text-[10px] text-outline uppercase block">Progress Indicator</span>
                  <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden mt-2">
                    <div
                      className="bg-secondary h-full transition-all duration-500"
                      style={{ width: `${report.validationScore}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-outline text-[12px] uppercase">No active validation data.</div>
            )}
          </div>

          {/* Section 2: Network Intelligence Card */}
          <div className="glass-panel border border-outline-variant/20 p-5 rounded-sm flex flex-col gap-4 relative">
            <h3 className="text-[14px] font-semibold tracking-wider text-cyan-400">NETWORK ENVIRONMENT DATA</h3>
            {isCollectingNetwork ? (
              <div className="h-48 flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-cyan-400" />
                <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">
                  Sensing network topology...
                </span>
              </div>
            ) : network ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="bg-surface-container-lowest/30 border border-outline-variant/10 p-3 rounded-sm">
                  <span className="text-[9px] text-outline uppercase">Connected Devices</span>
                  <span className="text-lg font-bold text-on-surface block mt-1">{network.connectedDevices}</span>
                </div>
                <div className="bg-surface-container-lowest/30 border border-outline-variant/10 p-3 rounded-sm">
                  <span className="text-[9px] text-outline uppercase">Active Nodes</span>
                  <span className="text-lg font-bold text-secondary block mt-1">{network.activeDevices}</span>
                </div>
                <div className="bg-surface-container-lowest/30 border border-outline-variant/10 p-3 rounded-sm">
                  <span className="text-[9px] text-outline uppercase">Network Health</span>
                  <span className="text-lg font-bold text-cyan-400 block mt-1">{network.networkHealth}%</span>
                </div>
                <div className="bg-surface-container-lowest/30 border border-outline-variant/10 p-3 rounded-sm">
                  <span className="text-[9px] text-outline uppercase">Packet Loss</span>
                  <span className="text-lg font-bold text-red-400 block mt-1">{network.packetLoss}%</span>
                </div>
                <div className="bg-surface-container-lowest/30 border border-outline-variant/10 p-3 rounded-sm">
                  <span className="text-[9px] text-outline uppercase">Signal Strength</span>
                  <span className="text-lg font-bold text-on-surface block mt-1">{network.signalStrength} dBm</span>
                </div>
                <div className="bg-surface-container-lowest/30 border border-outline-variant/10 p-3 rounded-sm">
                  <span className="text-[9px] text-outline uppercase">Internet Connection</span>
                  <span className={`text-[12px] font-bold block mt-2 uppercase ${network.internetReachability ? "text-secondary" : "text-error"}`}>
                    {network.internetReachability ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>
                <div className="bg-surface-container-lowest/30 border border-outline-variant/10 p-3 rounded-sm col-span-2">
                  <span className="text-[9px] text-outline uppercase">Occupancy Estimate</span>
                  <span className="text-[12px] font-bold text-amber-400 block mt-2 uppercase">{network.occupancyEstimate}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-outline text-[12px] uppercase">
                No active network diagnostics collected.
              </div>
            )}
          </div>

          {/* Section 3: Evidence Breakdown Card */}
          <div className="glass-panel border border-outline-variant/20 p-5 rounded-sm flex flex-col gap-4">
            <h3 className="text-[14px] font-semibold tracking-wider text-secondary">EVIDENCE FUSION CONVERGENCE</h3>
            {report ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {report.evidenceBreakdown.map((ev, index) => (
                  <div key={index} className="bg-surface-container-lowest/40 border border-outline-variant/15 p-3 rounded-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider">{ev.source}</span>
                        <span className={`px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase ${
                          ev.status === "success" ? "bg-secondary/15 text-secondary" : "bg-outline/15 text-outline"
                        }`}>
                          {ev.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-[9px] text-outline uppercase">Confidence:</span>
                        <span className="text-[12px] font-bold text-on-surface">{ev.confidence}%</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[9px] text-outline uppercase">Weight:</span>
                        <span className="text-[12px] font-bold text-outline">{Math.round(ev.weight * 100)}%</span>
                      </div>
                    </div>
                    <div className="border-t border-outline-variant/10 pt-2 mt-2 flex justify-between items-center">
                      <span className="text-[9px] text-outline uppercase">Contribution:</span>
                      <span className="text-[12px] font-bold text-secondary">{Math.round(ev.weightedContribution)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-outline text-[12px] uppercase">
                Evidence breakdown currently empty.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Section 4, Section 5 & Section 6 */}
        <div className="flex flex-col gap-6">
          {/* Section 6: Overall Validation Score circular gauge */}
          <div className="glass-panel border border-outline-variant/20 p-5 rounded-sm flex flex-col items-center justify-center gap-4 relative">
            <h3 className="text-[14px] font-semibold tracking-wider text-primary self-start">OVERALL FUSION CONFIDENCE</h3>
            
            {report ? (
              <div className="relative flex items-center justify-center w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="68"
                    className="stroke-surface-container-highest"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="68"
                    className="stroke-secondary transition-all duration-1000"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={427}
                    strokeDashoffset={427 - (427 * report.validationScore) / 100}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-on-surface">{report.validationScore}%</span>
                  <span className="text-[9px] text-outline uppercase font-bold tracking-widest mt-1">VERIFIED</span>
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-outline text-[12px] uppercase">Gauge empty</div>
            )}
          </div>

          {/* Section 4: AI Environmental Inference */}
          <div className="glass-panel border border-outline-variant/20 p-5 rounded-sm flex flex-col gap-3 min-h-[160px]">
            <h3 className="text-[14px] font-semibold tracking-wider text-amber-400 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-amber-400 animate-pulse">smart_toy</span>
              AI ENVIRONMENTAL INFERENCE
            </h3>

            {isAnalyzingAI ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-amber-400" />
                <span className="text-[9px] text-amber-400 uppercase tracking-wider font-bold">
                  Gemini analyzing metrics...
                </span>
              </div>
            ) : report ? (
              <div className="flex flex-col gap-2 font-[var(--font-geist)] text-[11px] leading-relaxed text-on-surface-variant mt-1">
                {typewriterText.map((line, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-surface-container-lowest/40 p-2 border border-outline-variant/10 rounded-sm">
                    <span className="text-secondary font-bold select-none">&gt;</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-outline text-[12px] uppercase">
                AI Inference context empty.
              </div>
            )}
          </div>

          {/* Section 5: Validation Timeline */}
          <div className="glass-panel border border-outline-variant/20 p-5 rounded-sm flex flex-col gap-4">
            <h3 className="text-[14px] font-semibold tracking-wider text-cyan-400">VALIDATION PIPELINE LOGS</h3>
            <div className="flex flex-col gap-3">
              {timeline.length > 0 ? (
                timeline.map((step, idx) => (
                  <div key={idx} className="flex gap-3 items-start border-l border-outline-variant/30 pl-4 ml-2 relative">
                    <div className="absolute -left-[4.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-cyan-400 border border-surface shadow-[0_0_8px_rgba(0,229,255,0.7)]" />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider">{step.agentName}</span>
                        <span className="text-[9px] text-outline">{new Date(step.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant leading-relaxed mt-1 normal-case">
                        {step.reasoning}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-outline text-[12px] uppercase">No logs recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
