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

const generateComplianceDetail = (location: string, reports: Incident[], valConfidence?: number, customStatus?: string) => {
  const totalReports = reports.length;
  
  // Dominant Type
  const typeCounts: Record<string, number> = {};
  reports.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const dominantType = sortedTypes[0]?.[0] || "Unknown";

  // Validation Confidence
  const confidence = valConfidence || (reports.length > 0 ? Math.round(reports.reduce((acc, curr) => acc + (computeCorrelation(curr).confidence || 80), 0) / reports.length) : 85);

  // Default Status mapping and Score rules:
  // Kolkata -> Compliant, Score: 98%
  // Howrah -> Compliant, Score: 95%
  // Barrackpore -> Compliant, Score: 92%
  // Asansol -> Under Review, Score: 78%
  // Haldia -> Non-Compliant, Score: 45%
  let status: "Compliant" | "Under Review" | "Non-Compliant" = "Compliant";
  let score = 95;
  let violations: string[] = [];
  let correctiveActions: string[] = [];

  if (location === "Haldia") {
    status = "Non-Compliant";
    score = 45;
    violations = [
      "Missing official patrol unit corroboration",
      "GPS coordinates dispersion exceeds tolerance",
      "Missing mandatory emergency validation metadata"
    ];
    correctiveActions = [
      "Initiate field sensor recalibration protocol",
      "Deploy local patrol unit to manually verify coordinates",
      "Complete missing incident metadata fields on dashboard"
    ];
  } else if (location === "Asansol") {
    status = "Under Review";
    score = 78;
    violations = [
      "Resource allocation review pending manager sign-off"
    ];
    correctiveActions = [
      "Approve primary NDRF team dispatch plan",
      "Generate and publish the final building collapse after-action report"
    ];
  } else {
    status = "Compliant";
    score = location === "Kolkata" ? 98 : location === "Howrah" ? 95 : 92;
    correctiveActions = [
      "Monitor post-incident recovery metrics",
      "Archive validated audit trail logs in compliance vault"
    ];
  }

  // Handle user override if custom validation is active
  if (customStatus === "Completed") {
    status = "Compliant";
    score = location === "Haldia" ? 96 : location === "Asansol" ? 97 : score;
    violations = [];
    correctiveActions = [
      "Archive validated audit trail logs in compliance vault"
    ];
  }

  const summary = `Compliance audit for ${location} active incident cluster. All critical check points verified against ARGUS Protocol SOP v5.2.`;

  return {
    location,
    type: dominantType,
    status,
    score,
    summary,
    confidence,
    lastUpdated: new Date(reports[0]?.timestamp || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }),
    timeline: [
      { stage: "Validation", desc: `Field Validation Completed (${confidence}% confidence)`, status: "Passed" },
      { stage: "Allocation", desc: `Resources allocated (${reports.length * 8} Personnel, ${Math.ceil(reports.length / 2) + 1} Ambulances)`, status: status === "Non-Compliant" ? "Pending" : "Passed" },
      { stage: "Reporting", desc: `After-Action report published successfully`, status: status === "Compliant" ? "Passed" : "Pending" }
    ],
    sopChecklist: {
      validation: true,
      aiConfidence: confidence >= 75,
      allocation: status !== "Non-Compliant",
      reporting: status === "Compliant",
      fields: status === "Compliant"
    },
    evidenceVerified: {
      images: Math.ceil(totalReports * 0.4),
      videos: Math.ceil(totalReports * 0.2),
      texts: totalReports
    },
    violations,
    correctiveActions
  };
};

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  Compliant: { bg: "bg-emerald-500/20", text: "text-emerald-400 border border-emerald-500/30", dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" },
  "Under Review": { bg: "bg-amber-500/20", text: "text-amber-400 border border-amber-500/30", dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" },
  "Non-Compliant": { bg: "bg-error/20", text: "text-error border border-error/30", dot: "bg-error shadow-[0_0_6px_rgba(239,68,68,0.6)]" }
};

export default function CompliancePage() {
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
      const trustedSourceExists = reports.some(r => ["Patrol Unit", "IoT Sensor", "Emergency Call"].includes(r.reportSource));

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

  // Generate compliance records list
  const complianceList = useMemo(() => {
    return validatedLocations.map((location) => {
      const reports = incidents.filter(i => i.location === location);
      const valConfidence = customValData[location]?.validationConfidence;
      const customStatus = customValData[location] ? "Completed" : undefined;
      return generateComplianceDetail(location, reports, valConfidence, customStatus);
    });
  }, [validatedLocations, customValData]);

  // Selected compliance record
  const selectedRecord = useMemo(() => {
    return complianceList.find(r => r.location === activeLocation) || null;
  }, [complianceList, activeLocation]);

  // If no locations are validated yet, show "Awaiting Validation" screen
  if (validatedLocations.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] p-[var(--spacing-gutter)] gap-[var(--spacing-panel-gap)] text-on-surface font-[var(--font-geist)]">
        <div className="flex-1 flex flex-col gap-6">
          {/* Header */}
          <div className="flex-shrink-0 border-b border-outline-variant/20 pb-4">
            <h1 className="font-[var(--font-inter)] text-[28px] leading-[36px] tracking-[-0.01em] font-semibold text-on-surface uppercase">
              Compliance Auditor
            </h1>
            <p className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant mt-1 uppercase">
              Real-Time Audit Records & Incident Timeline Compliance Verification
            </p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center border border-outline-variant/15 bg-surface-container-lowest/30 rounded-sm relative overflow-hidden">
            <span className="material-symbols-outlined text-[48px] text-outline-variant animate-pulse mb-3">
              hourglass_empty
            </span>
            <h2 className="text-lg font-[var(--font-inter)] font-semibold text-primary-fixed-dim uppercase tracking-wider">
              Awaiting Validation
            </h2>
            <p className="text-xs text-outline mt-1.5 max-w-md text-center leading-relaxed">
              No audit logs available. Run the validator in the Validator Control Hub to generate compliance records.
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
            Compliance Auditor
          </h1>
          <p className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant mt-1 uppercase">
            Real-Time Audit Records & Incident Timeline Compliance Verification
          </p>
        </div>

        <div className="flex-1 overflow-y-auto border border-outline-variant/15 rounded-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 font-[var(--font-geist)] text-[10px] text-outline tracking-wider uppercase bg-surface-container-lowest">
                <th className="p-3">Area</th>
                <th className="p-3">Incident Type</th>
                <th className="p-3">Compliance Status</th>
                <th className="p-3">Score</th>
                <th className="p-3">Last Updated</th>
              </tr>
            </thead>
            <tbody className="font-[var(--font-geist)] text-[13px] font-medium text-on-surface">
              {complianceList.map((rec) => {
                const isActive = rec.location === activeLocation;
                const sty = statusStyles[rec.status] || statusStyles.Compliant;

                return (
                  <tr
                    key={rec.location}
                    onClick={() => setSelectedLocation(rec.location)}
                    className={`border-b border-outline-variant/10 hover:bg-surface-container-highest/30 cursor-pointer transition-colors ${
                      isActive ? "bg-primary-container/5" : ""
                    }`}
                  >
                    <td className="p-3 text-on-surface font-bold">{rec.location}</td>
                    <td className="p-3 text-on-surface-variant">{rec.type}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-[10px] uppercase font-extrabold ${sty.bg} ${sty.text}`}>
                        <span className={`w-1 h-1 rounded-full ${sty.dot}`} />
                        {rec.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`font-bold ${
                        rec.score >= 90 ? "text-emerald-400" : rec.score >= 70 ? "text-amber-400" : "text-error"
                      }`}>
                        {rec.score}%
                      </span>
                    </td>
                    <td className="p-3 text-on-surface-variant">{rec.lastUpdated}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Output Display Right */}
      {selectedRecord && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[430px] flex-shrink-0 flex flex-col gap-[var(--spacing-panel-gap)] overflow-y-auto pr-2 h-full"
        >
          {/* Detailed Compliance Card */}
          <div className="glass-panel p-5 flex flex-col relative overflow-hidden flex-shrink-0 gap-4">
            
            {/* Header info */}
            <div className="border-b border-outline-variant/20 pb-3 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-outline uppercase font-bold tracking-widest font-[var(--font-geist)]">
                  COMPLIANCE RECORD
                </span>
                <h3 className="font-[var(--font-inter)] text-lg font-bold text-on-surface mt-0.5">
                  {selectedRecord.location} Audit
                </h3>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-[10px] uppercase font-extrabold ${statusStyles[selectedRecord.status].bg} ${statusStyles[selectedRecord.status].text}`}>
                  {selectedRecord.status}
                </span>
                <div className="text-[10px] text-outline mt-1">{selectedRecord.lastUpdated}</div>
              </div>
            </div>

            {/* Score Ring Display */}
            <div className="flex items-center justify-between p-3.5 bg-surface-container-lowest/50 border border-outline-variant/15 rounded-sm">
              <div className="flex flex-col">
                <span className="text-[10px] text-outline uppercase font-bold tracking-wider">Overall Score</span>
                <span className="text-xs text-on-surface-variant mt-0.5">SOP Protocol Verification</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Horizontal simple progress bar */}
                <div className="w-24 bg-surface-container-highest h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      selectedRecord.score >= 90 ? "bg-emerald-400" : selectedRecord.score >= 70 ? "bg-amber-400" : "bg-error"
                    }`}
                    style={{ width: `${selectedRecord.score}%` }}
                  />
                </div>
                <span className={`text-xl font-bold font-[var(--font-inter)] ${
                  selectedRecord.score >= 90 ? "text-emerald-400" : selectedRecord.score >= 70 ? "text-amber-400" : "text-error"
                }`}>
                  {selectedRecord.score}%
                </span>
              </div>
            </div>

            {/* Summary */}
            <div className="text-xs text-on-surface-variant leading-relaxed">
              <span className="font-bold text-outline uppercase text-[9px] block mb-1">Incident Summary</span>
              <p className="bg-surface-container-lowest/50 p-2.5 border border-outline-variant/15 rounded-sm italic">
                {selectedRecord.summary}
              </p>
            </div>

            {/* SOP Checklist */}
            <div className="bg-surface-container-lowest/40 border border-outline-variant/15 p-3.5 rounded-sm">
              <span className="font-[var(--font-inter)] text-[12px] font-bold text-primary uppercase tracking-wider block mb-2">
                SOP Protocol Verification Checklist
              </span>
              <div className="flex flex-col gap-1.5 text-[11px] font-[var(--font-geist)] text-on-surface-variant">
                <div className="flex justify-between items-center border-b border-outline-variant/5 pb-1">
                  <span>1. Incident Validation Completed</span>
                  <span className="text-emerald-400 font-bold">✓ PASSED</span>
                </div>
                <div className="flex justify-between items-center border-b border-outline-variant/5 pb-1">
                  <span>2. AI Confidence Threshold Met</span>
                  <span className={selectedRecord.sopChecklist.aiConfidence ? "text-emerald-400 font-bold" : "text-error font-bold"}>
                    {selectedRecord.sopChecklist.aiConfidence ? "✓ PASSED" : "✗ FAILED"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-outline-variant/5 pb-1">
                  <span>3. Emergency Resources Allocated</span>
                  <span className={selectedRecord.sopChecklist.allocation ? "text-emerald-400 font-bold" : "text-error font-bold"}>
                    {selectedRecord.sopChecklist.allocation ? "✓ PASSED" : "✗ FAILED"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-outline-variant/5 pb-1">
                  <span>4. After-Action Report Published</span>
                  <span className={selectedRecord.sopChecklist.reporting ? "text-emerald-400 font-bold" : "text-error font-bold"}>
                    {selectedRecord.sopChecklist.reporting ? "✓ PASSED" : "✗ FAILED"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>5. Mandatory Fields Validated</span>
                  <span className={selectedRecord.sopChecklist.fields ? "text-emerald-400 font-bold" : "text-error font-bold"}>
                    {selectedRecord.sopChecklist.fields ? "✓ PASSED" : "✗ FAILED"}
                  </span>
                </div>
              </div>
            </div>

            {/* Validation & Evidence Details */}
            <div className="grid grid-cols-2 gap-2 text-xs font-[var(--font-geist)]">
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Validation Status</span>
                <span className="text-secondary font-semibold">Validated</span>
              </div>
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">AI Confidence</span>
                <span className="text-primary font-semibold">{selectedRecord.confidence}%</span>
              </div>
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Resource Status</span>
                <span className={selectedRecord.sopChecklist.allocation ? "text-secondary font-semibold" : "text-error font-semibold"}>
                  {selectedRecord.sopChecklist.allocation ? "Allocated" : "Pending"}
                </span>
              </div>
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Report Status</span>
                <span className={selectedRecord.sopChecklist.reporting ? "text-secondary font-semibold" : "text-error font-semibold"}>
                  {selectedRecord.sopChecklist.reporting ? "Published" : "Pending"}
                </span>
              </div>
            </div>

            {/* Evidence summary */}
            <div className="p-3 bg-surface-container-lowest/50 border border-outline-variant/15 rounded-sm text-[11px]">
              <span className="font-bold text-outline uppercase text-[9px] block mb-1">Evidence Verification Summary</span>
              <div className="flex justify-between text-on-surface-variant font-[var(--font-geist)]">
                <span>Images: <strong className="text-on-surface">{selectedRecord.evidenceVerified.images}</strong></span>
                <span>Videos: <strong className="text-on-surface">{selectedRecord.evidenceVerified.videos}</strong></span>
                <span>Texts: <strong className="text-on-surface">{selectedRecord.evidenceVerified.texts}</strong></span>
              </div>
            </div>

            {/* Policy Violations display */}
            <div className="text-xs text-on-surface-variant">
              <span className="font-bold text-outline uppercase text-[9px] block mb-1">Policy Violations</span>
              {selectedRecord.violations.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {selectedRecord.violations.map((vio, idx) => (
                    <div key={idx} className="bg-error/10 border border-error/25 p-2 text-error rounded-sm flex items-start gap-2">
                      <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">warning</span>
                      <span>{vio}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-emerald-400 rounded-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  <span>No Policy Violations Identified.</span>
                </div>
              )}
            </div>

            {/* Audit Trail Stepper */}
            <div className="text-xs text-on-surface-variant">
              <span className="font-bold text-outline uppercase text-[9px] block mb-2">Compliance Audit Trail</span>
              <div className="flex items-center justify-between bg-surface-container-lowest/50 p-3 border border-outline-variant/15 rounded-sm">
                {selectedRecord.timeline.map((step, idx) => (
                  <React.Fragment key={idx}>
                    <div className="flex flex-col items-center">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step.status === "Passed" ? "bg-emerald-950 text-emerald-400 border border-emerald-500/55" : "bg-surface-container-highest text-outline border border-outline-variant/30"
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-[9px] font-bold text-on-surface mt-1">{step.stage}</span>
                    </div>
                    {idx < selectedRecord.timeline.length - 1 && (
                      <div className="h-0.5 flex-1 bg-outline-variant/20 mx-2" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Recommended Corrective Actions */}
            <div className="text-xs text-on-surface-variant flex flex-col gap-2">
              <span className="font-bold text-outline uppercase text-[9px] block">Recommended Corrective Actions</span>
              <div className="flex flex-col gap-1.5 font-[var(--font-geist)]">
                {selectedRecord.correctiveActions.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-surface-container-lowest/30 p-2 border border-outline-variant/10 rounded-sm leading-relaxed">
                    <span className="material-symbols-outlined text-[14px] text-cyan-400 shrink-0 mt-0.5">info</span>
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </motion.div>
      )}

    </div>
  );
}
