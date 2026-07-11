"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import incidentsData from "@/data/incidents.json";
import type { Incident } from "@/types";

const incidents = incidentsData as Incident[];

// Helper to calculate centroid coordinates of reports
const getCentroid = (reports: Incident[]) => {
  let latSum = 0, lngSum = 0, count = 0;
  reports.forEach(r => {
    if (r.coordinates) {
      latSum += r.coordinates.lat;
      lngSum += r.coordinates.lng;
      count++;
    }
  });
  return count > 0 ? { lat: latSum / count, lng: lngSum / count } : undefined;
};

// Haversine formula to calculate distance in km
const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// computeCorrelation for a single report (used to evaluate baseline AI confidence)
const computeCorrelation = (current: Incident) => {
  const others = incidents.filter(i => i.id !== current.id);
  const tokenize = (t: string) => new Set((t || "").toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(w => w.length > 2));
  const jaccard = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; const inter = [...a].filter(x => b.has(x)).length; return Math.round((inter / new Set([...a, ...b]).size) * 100); };
  const locSim = (c: Incident, o: Incident) => { if (c.coordinates && o.coordinates) { const d = haversine(c.coordinates.lat, c.coordinates.lng, o.coordinates.lat, o.coordinates.lng); if (d <= 0.5) return 100; if (d <= 2) return 80; if (d <= 5) return 50; if (d <= 10) return 20; return 0; } return c.location === o.location ? 100 : 0; };
  const typeSim = (a: string, b: string) => { const x = a.toLowerCase(), y = b.toLowerCase(); return x === y ? 100 : (x.includes(y) || y.includes(x)) ? 50 : 0; };
  const timeSim = (a: string, b: string) => { const h = Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3600000; if (h <= 1) return 100; if (h <= 4) return 80; if (h <= 12) return 50; if (h <= 24) return 20; return 0; };

  const curTokens = tokenize(`${current.type} ${current.location} ${current.description || ""}`);
  const supporting: any[] = [];
  let best: any = null, maxSim = 0;

  for (const o of others) {
    const kw = jaccard(curTokens, tokenize(`${o.type} ${o.location} ${o.description || ""}`));
    const loc = locSim(current, o);
    const typ = typeSim(current.type, o.type);
    const tm = timeSim(current.timestamp, o.timestamp);
    const hasLoc = !!(current.coordinates && o.coordinates);
    const overall = hasLoc ? Math.round(kw * 0.25 + loc * 0.35 + typ * 0.25 + tm * 0.15) : Math.round(kw * 0.4 + typ * 0.4 + tm * 0.2);
    if (overall >= 50) supporting.push({ incidentId: o.id.replace("#", ""), overallSimilarity: overall, keywordSimilarity: kw, locationSimilarity: loc, incidentSimilarity: typ, timeSimilarity: tm });
    if (overall > maxSim) { maxSim = overall; best = { kw, loc, typ, tm, id: o.id.replace("#", ""), overall }; }
  }
  supporting.sort((a, b) => b.overallSimilarity - a.overallSimilarity);
  return { best, supporting: supporting.slice(0, 5), confidence: maxSim };
};

const generateReportDetail = (location: string, reports: Incident[], valConfidence?: number, customStatus?: string) => {
  const totalReports = reports.length;
  
  // Dominant Type
  const typeCounts: Record<string, number> = {};
  reports.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const dominantType = sortedTypes[0]?.[0] || "Unknown";

  // Severity
  const severities = reports.map(r => r.severity || "Medium");
  const hasCritical = severities.some(s => s.toLowerCase() === "critical");
  const hasHigh = severities.some(s => s.toLowerCase() === "high");
  const severity = hasCritical ? "Critical" : hasHigh ? "High" : "Medium";

  // Validation Confidence
  const confidence = valConfidence || (reports.length > 0 ? Math.round(reports.reduce((acc, curr) => acc + (computeCorrelation(curr).confidence || 80), 0) / reports.length) : 85);

  // Status mapping
  let status: "Submitted" | "Reviewed" | "Completed" = "Submitted";
  if (customStatus) {
    status = customStatus as any;
  } else if (totalReports > 15) {
    status = "Completed";
  } else if (totalReports > 11) {
    status = "Reviewed";
  }

  // Summary and AI assessment details
  const summary = `${dominantType} incident cluster identified in ${location} with ${totalReports} distinct corroborations. Response teams deployed to stabilize the sector.`;
  const aiAssessment = `ARGUS AI analysis confirms a major ${dominantType.toLowerCase()} event in ${location}. Sensor feeds indicate secondary infrastructure stress. Immediate dispatch and containment protocol recommended.`;
  
  // Suggestions
  const personnelCount = totalReports * 8 + (severity === "Critical" ? 50 : 20);
  const fireUnits = (dominantType === "Fire" || dominantType === "Explosion" || dominantType === "Building Collapse") ? Math.ceil(totalReports / 3) + 2 : 0;
  const policeSAR = Math.ceil(totalReports / 3) + (dominantType === "Civil Unrest" || dominantType === "Earthquake" ? 4 : 2);
  const ambulances = Math.ceil(totalReports / 2) + 1;
  const eta = dominantType === "Earthquake" ? 8 : 12;

  // Recommendations and actions list
  const nextActions = [
    "Establish primary communication grid",
    "Deploy perimeter units to manage civilian flow",
    "Initiate target area search and rescue"
  ];
  if (dominantType === "Earthquake" || dominantType === "Building Collapse") {
    nextActions.push("Deploy heavy rescue units for structural clearing");
  } else if (dominantType === "Flood") {
    nextActions.push("Coordinate water evacuation assets");
  }

  // Synced recommendations
  const resourcesSuggested = `${personnelCount} Personnel, ${ambulances} Ambulances, ${policeSAR} Police/SAR${fireUnits > 0 ? `, ${fireUnits} Fire Units` : ""}`;

  return {
    id: `REP-${location.toUpperCase().slice(0, 3)}-${totalReports}`,
    title: `${dominantType} Incident Report - ${location}`,
    location,
    type: dominantType,
    totalReports,
    status,
    confidence,
    summary,
    aiAssessment,
    resourcesSuggested,
    unitsAssigned: `${location} Central Police, Local Fire Dept, NDRF Team ${totalReports}`,
    eta: `${eta} minutes`,
    operationalStatus: status === "Completed" ? "STANDBY / CONTAINED" : status === "Reviewed" ? "DISPATCHED / RESPONDING" : "ACTIVE / EVALUATING",
    nextActions,
    evidenceSummary: {
      images: Math.ceil(totalReports * 0.4),
      videos: Math.ceil(totalReports * 0.2),
      texts: totalReports
    },
    date: new Date(reports[0]?.timestamp || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }),
    timeline: [
      { time: "00:00", event: "First report corroborated by AI Agent" },
      { time: "00:15", event: "Telemetry network cross-reference verified" },
      { time: "00:30", event: "Command baseline validation established" }
    ]
  };
};

const reportStatusStyles: Record<string, { bg: string; text: string }> = {
  Submitted: { bg: "bg-primary-fixed-dim/20", text: "text-primary-fixed-dim" },
  Reviewed: { bg: "bg-secondary/20", text: "text-secondary" },
  Completed: { bg: "bg-green-500/20", text: "text-green-400" },
};

export default function ReportsPage() {
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [customValData, setCustomValData] = useState<Record<string, any>>({});

  // Sync validation data from localStorage
  useEffect(() => {
    const loadCustomVal = () => {
      if (typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem("argus-custom-validation-data");
          if (stored) {
            setCustomValData(JSON.parse(stored));
          }
        } catch (e) {
          console.error("Failed to load custom validation data", e);
        }
      }
    };

    loadCustomVal();

    // Listen for storage updates
    window.addEventListener("storage", loadCustomVal);
    const interval = setInterval(loadCustomVal, 1000);

    return () => {
      window.removeEventListener("storage", loadCustomVal);
      clearInterval(interval);
    };
  }, []);

  // Group all incidents by location
  const groupedByLocation = useMemo(() => {
    const groups: Record<string, Incident[]> = {};
    for (const inc of incidents) {
      if (!groups[inc.location]) groups[inc.location] = [];
      groups[inc.location].push(inc);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  // Filter to validated locations only
  const validatedLocations = useMemo(() => {
    const valid: string[] = [];
    for (const [location, reports] of groupedByLocation) {
      if (customValData[location]) {
        valid.push(location);
        continue;
      }

      // Run 7 baseline checks
      const multipleReports = reports.length > 1;
      const typeCounts: Record<string, number> = {};
      reports.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
      const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
      const dominantType = sortedTypes[0]?.[0] || "Unknown";
      const maxTypeCount = sortedTypes[0]?.[1] || 0;
      const typeConsistent = reports.length > 0 && (maxTypeCount / reports.length >= 0.8);

      const times = reports.map(r => new Date(r.timestamp).getTime());
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const withinTimeWindow = reports.length > 0 && (maxTime - minTime <= 2 * 3600000);

      let maxDist = 0;
      let hasCoords = false;
      for (let i = 0; i < reports.length; i++) {
        for (let j = i + 1; j < reports.length; j++) {
          const c1 = reports[i].coordinates;
          const c2 = reports[j].coordinates;
          if (c1 && c2) {
            hasCoords = true;
            const d = haversine(c1.lat, c1.lng, c2.lat, c2.lng);
            if (d > maxDist) maxDist = d;
          }
        }
      }
      const withinLocThreshold = !hasCoords || (maxDist <= 3.0);

      const confidences = reports.map(r => computeCorrelation(r).confidence);
      const maxConfidence = confidences.length > 0 ? Math.max(...confidences) : 0;
      const aiConfidenceExceeds = maxConfidence >= 75;

      const mediaVerified = reports.some(r => ["resolved", "dispatched", "in-progress"].includes(r.status.toLowerCase()) || r.reportSource === "IoT Sensor");
      const trustedSourceExists = reports.some(r => ["Patrol Unit", "IoT Sensor", "Emergency Call"].includes(r.reportSource || ""));

      const isValidated = multipleReports && typeConsistent && withinTimeWindow && withinLocThreshold && aiConfidenceExceeds && mediaVerified && trustedSourceExists;

      if (isValidated) {
        valid.push(location);
      }
    }
    return valid;
  }, [groupedByLocation, customValData]);

  // Handle selected location auto fallback
  useEffect(() => {
    if (validatedLocations.length > 0 && !validatedLocations.includes(selectedLocation)) {
      setSelectedLocation(validatedLocations[0]);
    }
  }, [validatedLocations, selectedLocation]);

  const activeLocation = useMemo(() => {
    if (validatedLocations.includes(selectedLocation)) {
      return selectedLocation;
    }
    return validatedLocations[0] || "";
  }, [validatedLocations, selectedLocation]);

  // Generate list of active reports for validated locations
  const reportsList = useMemo(() => {
    return validatedLocations.map((location) => {
      const reports = incidents.filter(i => i.location === location);
      const valConfidence = customValData[location]?.validationConfidence;
      const customStatus = customValData[location] ? "Completed" : undefined;
      return generateReportDetail(location, reports, valConfidence, customStatus);
    });
  }, [validatedLocations, customValData]);

  // Selected report detail object
  const selectedReport = useMemo(() => {
    return reportsList.find(r => r.location === activeLocation) || null;
  }, [reportsList, activeLocation]);

  // If no reports are generated, display "Awaiting Validation" empty state
  if (validatedLocations.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] p-[var(--spacing-gutter)] gap-[var(--spacing-panel-gap)] text-on-surface font-[var(--font-geist)]">
        <div className="flex-1 flex flex-col gap-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex-shrink-0 border-b border-outline-variant/20 pb-4">
            <h1 className="font-[var(--font-inter)] text-[28px] leading-[36px] tracking-[-0.01em] font-semibold text-on-surface uppercase">
              Mission Reports
            </h1>
            <p className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant mt-1 uppercase">
              After-Action Reports & Intelligence Summaries
            </p>
          </motion.div>

          <div className="flex-1 flex flex-col items-center justify-center border border-outline-variant/15 bg-surface-container-lowest/30 rounded-sm relative overflow-hidden">
            <span className="material-symbols-outlined text-[48px] text-outline-variant animate-pulse mb-3">
              hourglass_empty
            </span>
            <h2 className="text-lg font-[var(--font-inter)] font-semibold text-primary-fixed-dim uppercase tracking-wider">
              Awaiting Validation
            </h2>
            <p className="text-xs text-outline mt-1.5 max-w-md text-center leading-relaxed">
              No reports available. Run the validator in the Validator Control Hub to generate system intelligence reports.
            </p>
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-outline-variant/50" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] p-[var(--spacing-gutter)] gap-[var(--spacing-panel-gap)] text-on-surface font-[var(--font-geist)] overflow-hidden select-none">
      
      {/* Selector Table Left */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-1 glass-panel p-6 flex flex-col relative overflow-hidden h-full"
      >
        <div className="flex-shrink-0 border-b border-outline-variant/20 pb-4 mb-6">
          <h1 className="font-[var(--font-inter)] text-[28px] leading-[36px] tracking-[-0.01em] font-semibold text-on-surface uppercase">
            Mission Reports
          </h1>
          <p className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant mt-1 uppercase">
            After-Action Reports & Intelligence Summaries
          </p>
        </div>

        <div className="flex-1 overflow-y-auto border border-outline-variant/15 rounded-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 font-[var(--font-geist)] text-[10px] text-outline tracking-wider uppercase bg-surface-container-lowest">
                <th className="p-3">REPORT TITLE</th>
                <th className="p-3">AREA</th>
                <th className="p-3">STATUS</th>
                <th className="p-3">DATE</th>
              </tr>
            </thead>
            <tbody className="font-[var(--font-geist)] text-[13px] font-medium text-on-surface">
              {reportsList.map((rep) => {
                const isActive = rep.location === activeLocation;
                const sty = reportStatusStyles[rep.status] || reportStatusStyles.Submitted;

                return (
                  <tr
                    key={rep.id}
                    onClick={() => setSelectedLocation(rep.location)}
                    className={`border-b border-outline-variant/10 hover:bg-surface-container-highest/30 cursor-pointer transition-colors ${
                      isActive ? "bg-primary-container/5" : ""
                    }`}
                  >
                    <td className="p-3 text-on-surface font-bold">{rep.title}</td>
                    <td className="p-3 text-on-surface-variant">{rep.location}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-[10px] uppercase font-bold ${sty.bg} ${sty.text}`}>
                        {rep.status}
                      </span>
                    </td>
                    <td className="p-3 text-on-surface-variant">{rep.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Output Display Right */}
      {selectedReport && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[420px] flex-shrink-0 flex flex-col gap-[var(--spacing-panel-gap)] overflow-y-auto pr-2 h-full"
        >
          {/* Detailed Report Card */}
          <div className="glass-panel p-5 flex flex-col relative overflow-hidden flex-shrink-0 gap-4">
            
            {/* Header info */}
            <div className="border-b border-outline-variant/20 pb-3 flex justify-between items-start">
              <div>
                <span className="text-[10px] text-primary font-bold uppercase tracking-widest font-[var(--font-geist)]">
                  {selectedReport.id}
                </span>
                <h3 className="font-[var(--font-inter)] text-base font-bold text-on-surface mt-0.5">
                  {selectedReport.title}
                </h3>
              </div>
              <span className="text-[11px] text-outline whitespace-nowrap">
                {selectedReport.date}
              </span>
            </div>

            {/* Summary */}
            <div className="text-xs text-on-surface-variant leading-relaxed">
              <span className="font-bold text-outline uppercase text-[9px] block mb-1">Incident Summary</span>
              <p className="bg-surface-container-lowest/50 p-2.5 border border-outline-variant/15 rounded-sm italic">
                {selectedReport.summary}
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-[var(--font-geist)]">
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Location (Area)</span>
                <span className="text-on-surface font-semibold">{selectedReport.location}</span>
              </div>
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Incident Type</span>
                <span className="text-on-surface font-semibold">{selectedReport.type}</span>
              </div>
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Corroborated Reports</span>
                <span className="text-on-surface font-semibold">{selectedReport.totalReports}</span>
              </div>
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Validation Status</span>
                <span className="text-secondary font-semibold">Validated</span>
              </div>
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Validation Confidence</span>
                <span className="text-primary font-semibold">{selectedReport.confidence}%</span>
              </div>
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">ETA</span>
                <span className="text-cyan-400 font-semibold">{selectedReport.eta}</span>
              </div>
            </div>

            {/* Evidence Summary */}
            <div className="p-3 bg-surface-container-lowest/40 border border-outline-variant/15 rounded-sm text-[11px]">
              <span className="font-bold text-outline uppercase text-[9px] block mb-1">Evidence Summary</span>
              <div className="flex justify-between text-on-surface-variant font-[var(--font-geist)]">
                <span>Verified Images: <strong className="text-on-surface">{selectedReport.evidenceSummary.images}</strong></span>
                <span>Video Feeds: <strong className="text-on-surface">{selectedReport.evidenceSummary.videos}</strong></span>
                <span>Text Feeds: <strong className="text-on-surface">{selectedReport.evidenceSummary.texts}</strong></span>
              </div>
            </div>

            {/* AI Assessment */}
            <div className="text-xs text-on-surface-variant leading-relaxed">
              <span className="font-bold text-outline uppercase text-[9px] block mb-1">AI Assessment</span>
              <p className="bg-surface-container-lowest/50 p-2.5 border border-outline-variant/15 rounded-sm">
                {selectedReport.aiAssessment}
              </p>
            </div>

            {/* Resource Recommendations & Units Assigned */}
            <div className="flex flex-col gap-2 text-xs">
              <div className="p-3 bg-secondary/15 border border-secondary/30 rounded-sm">
                <span className="font-bold text-secondary uppercase text-[9px] block mb-0.5">Resource Recommendation</span>
                <span className="text-on-surface font-semibold">{selectedReport.resourcesSuggested}</span>
              </div>
              <div className="p-3 bg-surface-container-highest/35 border border-outline-variant/20 rounded-sm">
                <span className="font-bold text-outline uppercase text-[9px] block mb-0.5">Units Assigned</span>
                <span className="text-on-surface">{selectedReport.unitsAssigned}</span>
              </div>
            </div>

            {/* Operational Status */}
            <div className="p-3 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm text-xs flex justify-between items-center">
              <span className="font-bold text-outline uppercase text-[9px]">Current Operational Status</span>
              <span className="font-bold text-cyan-400 tracking-wider font-[var(--font-geist)]">{selectedReport.operationalStatus}</span>
            </div>

            {/* Recommended Next Actions */}
            <div className="text-xs text-on-surface-variant flex flex-col gap-1.5">
              <span className="font-bold text-outline uppercase text-[9px] block">Recommended Next Actions</span>
              <div className="flex flex-col gap-1 font-[var(--font-geist)]">
                {selectedReport.nextActions.map((action, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-surface-container-lowest/30 p-2 border border-outline-variant/10 rounded-sm">
                    <span className="material-symbols-outlined text-[14px] text-secondary">check_circle</span>
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="text-xs text-on-surface-variant flex flex-col gap-2">
              <span className="font-bold text-outline uppercase text-[9px] block">Timeline</span>
              <div className="flex flex-col gap-2 border-l border-outline-variant/20 pl-4 ml-2">
                {selectedReport.timeline.map((event, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-primary" />
                    <span className="text-[10px] text-outline block font-bold">{event.time}</span>
                    <span className="text-on-surface-variant mt-0.5 block">{event.event}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-outline-variant/50" />
          </div>
        </motion.div>
      )}

    </div>
  );
}
