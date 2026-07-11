"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  Waiting: { bg: "bg-outline/20", text: "text-outline", dot: "bg-outline" },
  Notified: { bg: "bg-cyan-500/20", text: "text-cyan-400", dot: "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)] animate-pulse" },
  Acknowledged: { bg: "bg-blue-500/20", text: "text-blue-400", dot: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]" },
  Responding: { bg: "bg-amber-500/20", text: "text-amber-400", dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" },
  Resolved: { bg: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" }
};

export default function CommunicationsPage() {
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [customValData, setCustomValData] = useState<Record<string, any>>({});
  const [selectedDept, setSelectedDept] = useState<string>("Police Department");
  const [simStep, setSimStep] = useState<number>(0);

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

  // Simulating department response state sequence over time
  useEffect(() => {
    setSimStep(0);
    const timers = [
      setTimeout(() => setSimStep(1), 1000), // Notified
      setTimeout(() => setSimStep(2), 3000), // Acknowledged
      setTimeout(() => setSimStep(3), 5000), // Responding
      setTimeout(() => setSimStep(4), 9000), // Resolved (for resolved hotspots)
    ];
    return () => timers.forEach(clearTimeout);
  }, [selectedLocation]);

  // Group all incidents by location
  const groupedByLocation = useMemo(() => {
    const groups: Record<string, Incident[]> = {};
    for (const inc of incidents) {
      if (!groups[inc.location]) groups[inc.location] = [];
      groups[inc.location].push(inc);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  // Filter to validated locations
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

  // Only incidents with Compliance Status = Compliant are automatically forwarded to communications
  const compliantLocations = useMemo(() => {
    return validatedLocations.filter(loc => {
      // Kolkata, Howrah, Barrackpore are Compliant. 
      // Asansol is Under Review (78), Haldia is Non-Compliant (45) by default.
      // Overridden locations via customValData are Compliant.
      if (customValData[loc]) return true;
      if (loc === "Kolkata" || loc === "Howrah" || loc === "Barrackpore") return true;
      return false;
    });
  }, [validatedLocations, customValData]);

  // Handle selected location auto fallback
  useEffect(() => {
    if (compliantLocations.length > 0 && !compliantLocations.includes(selectedLocation)) {
      setSelectedLocation(compliantLocations[0]);
    }
  }, [compliantLocations, selectedLocation]);

  const activeLocation = useMemo(() => {
    if (compliantLocations.includes(selectedLocation)) {
      return selectedLocation;
    }
    return compliantLocations[0] || "";
  }, [compliantLocations, selectedLocation]);

  const activeReports = useMemo(() => {
    if (!activeLocation) return [];
    return incidents.filter(i => i.location === activeLocation);
  }, [activeLocation]);

  // Active Incident properties
  const activeIncidentInfo = useMemo(() => {
    if (activeReports.length === 0) return null;
    
    // Dominant Type
    const typeCounts: Record<string, number> = {};
    activeReports.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const dominantType = sortedTypes[0]?.[0] || "Unknown";

    // Severity
    const severities = activeReports.map(r => r.severity || "Medium");
    const hasCritical = severities.some(s => s.toLowerCase() === "critical");
    const hasHigh = severities.some(s => s.toLowerCase() === "high");
    const priority = hasCritical ? "CRITICAL" : hasHigh ? "HIGH" : "MEDIUM";

    return {
      type: dominantType,
      priority,
      summary: `${dominantType} incident cluster reported in ${activeLocation} with ${activeReports.length} corroborated events.`,
      reportsCount: activeReports.length
    };
  }, [activeReports, activeLocation]);

  // Notifications logic by Incident Type
  const notifiedDepts = useMemo(() => {
    if (!activeIncidentInfo) return new Set<string>();
    const type = activeIncidentInfo.type.toLowerCase();

    // Fire -> Fire Services + Police + Hospital + Disaster Management
    if (type === "fire" || type === "explosion") {
      return new Set([
        "Police Department",
        "Fire & Emergency Services",
        "Government Hospital / Medical Services",
        "Disaster Management Authority"
      ]);
    }
    // Earthquake -> Disaster Management + NDRF/SDRF + Hospital + Police
    if (type === "earthquake") {
      return new Set([
        "Police Department",
        "Government Hospital / Medical Services",
        "Disaster Management Authority",
        "NDRF / SDRF"
      ]);
    }
    // Flood -> Disaster Management + Police
    if (type === "flood") {
      return new Set([
        "Police Department",
        "Disaster Management Authority",
        "NDRF / SDRF"
      ]);
    }
    // Road Accident -> Police + Hospital + Traffic Police
    if (type === "road accident" || type === "traffic") {
      return new Set([
        "Police Department",
        "Government Hospital / Medical Services",
        "Traffic Police"
      ]);
    }
    // Building/Bridge Collapse -> Fire + NDRF/SDRF + Hospital + Police
    if (type === "building collapse" || type === "bridge collapse" || type === "collapse") {
      return new Set([
        "Police Department",
        "Fire & Emergency Services",
        "Government Hospital / Medical Services",
        "NDRF / SDRF"
      ]);
    }

    // Default Fallback
    return new Set([
      "Police Department",
      "Disaster Management Authority"
    ]);
  }, [activeIncidentInfo]);

  // Departments List
  const departmentsData = useMemo(() => {
    if (!activeIncidentInfo) return [];

    const isNDRFRequired = notifiedDepts.has("NDRF / SDRF");
    const depts = [
      {
        name: "Police Department",
        team: "Sector-7 Law Enforcement Command",
        action: "Establish perimeter security, manage public order and evacuate zone.",
        baseEta: 5,
        log: "00:00: Dispatch notification parsed. 00:01: Patrol units dispatched."
      },
      {
        name: "Fire & Emergency Services",
        team: "Rescue Engine Co. 15 & Heavy Ladder Team",
        action: "Mitigate active hazards, suppress fires, and execute search rescue.",
        baseEta: 7,
        log: "00:00: Level-1 dispatcher dispatch ordered. 00:02: Fire crews mobilized."
      },
      {
        name: "Government Hospital / Medical Services",
        team: "Medical Emergency Team Gamma",
        action: "Set up mobile trauma triage stations and prepare critical ER wards.",
        baseEta: 9,
        log: "00:00: Hospital ER alert verified. 00:01: Advanced paramedic ambulance deployed."
      },
      {
        name: "Disaster Management Authority",
        team: "S7 Incident Coordination Cell",
        action: "Orchestrate inter-department communication networks and manage shelters.",
        baseEta: 15,
        log: "00:00: Emergency level confirmed. 00:04: Command center active."
      },
      {
        name: "Traffic Police",
        team: "Traffic Control Squadron Beta",
        action: "Establish corridor detours and divert civil congestion from rescue lanes.",
        baseEta: 4,
        log: "00:00: Traffic hazard reported. 00:01: Road blocks active."
      },
      {
        name: "NDRF / SDRF",
        team: "National Disaster Response Unit 3",
        action: "Deploy sonar sensors, search dogs, and concrete shoring rigs.",
        baseEta: 12,
        log: "00:00: Heavy rescue request authorized. 00:03: Heavy responders en route."
      }
    ];

    // Filter out NDRF/SDRF card if not required/notified
    return depts.filter(d => {
      if (d.name === "NDRF / SDRF") return isNDRFRequired;
      return true;
    }).map((d) => {
      const isNotified = notifiedDepts.has(d.name);
      
      // Compute status dynamically using simStep
      let status: "Waiting" | "Notified" | "Acknowledged" | "Responding" | "Resolved" = "Waiting";
      if (isNotified) {
        if (simStep === 0) status = "Notified";
        else if (simStep === 1) status = "Acknowledged";
        else if (simStep === 2) status = "Responding";
        else status = "Resolved";
      }

      // Compute resource recommendation count based on incident details
      const reports = activeIncidentInfo.reportsCount;
      const severity = activeIncidentInfo.priority;
      const personnelCount = reports * 8 + (severity === "CRITICAL" ? 50 : 20);

      return {
        name: d.name,
        status,
        incident: `${activeIncidentInfo.type} Incident - ${activeLocation}`,
        location: activeLocation,
        type: activeIncidentInfo.type,
        priority: activeIncidentInfo.priority,
        dispatchTime: new Date(Date.now() - 300000).toLocaleTimeString(),
        eta: status === "Resolved" ? "Arrived" : `${d.baseEta} mins`,
        officer: d.team,
        lastUpdate: new Date().toLocaleTimeString(),
        action: d.action,
        log: d.log,
        resourcesAssigned: `${personnelCount} personnel, tactical dispatch vehicle, radio grid`,
        aiRecommendation: `${personnelCount} Personnel and medical triage packs.`
      };
    });
  }, [activeIncidentInfo, activeLocation, notifiedDepts, simStep]);

  // Selected department details
  const selectedDeptDetails = useMemo(() => {
    return departmentsData.find(d => d.name === selectedDept) || departmentsData[0] || null;
  }, [departmentsData, selectedDept]);

  // Set default selected department on list updates
  useEffect(() => {
    if (departmentsData.length > 0 && !departmentsData.some(d => d.name === selectedDept)) {
      setSelectedDept(departmentsData[0].name);
    }
  }, [departmentsData, selectedDept]);

  // Display "Awaiting Compliance Approval" empty state
  if (compliantLocations.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] p-[var(--spacing-gutter)] gap-[var(--spacing-panel-gap)] text-on-surface font-[var(--font-geist)]">
        <div className="flex-1 flex flex-col gap-6">
          {/* Header */}
          <div className="flex-shrink-0 border-b border-outline-variant/20 pb-4">
            <h1 className="font-[var(--font-inter)] text-[28px] leading-[36px] tracking-[-0.01em] font-semibold text-on-surface uppercase">
              Communications Hub
            </h1>
            <p className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-outline-variant mt-1 uppercase">
              Secure Department Dispatch & Inter-Agency Feeds
            </p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center border border-outline-variant/15 bg-surface-container-lowest/30 rounded-sm relative overflow-hidden">
            <span className="material-symbols-outlined text-[48px] text-outline-variant animate-pulse mb-3">
              hourglass_empty
            </span>
            <h2 className="text-lg font-[var(--font-inter)] font-semibold text-primary-fixed-dim uppercase tracking-wider">
              Awaiting Compliance Approval
            </h2>
            <p className="text-xs text-outline mt-1.5 max-w-md text-center leading-relaxed">
              No compliant incidents have been forwarded. Audit the incidents in Compliance Auditor to authorize communications.
            </p>
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-outline-variant/50" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] p-[var(--spacing-gutter)] gap-[var(--spacing-panel-gap)] text-on-surface font-[var(--font-geist)] select-none overflow-hidden">
      
      {/* Grid of Department Cards (Left) */}
      <div className="flex-1 flex flex-col gap-[var(--spacing-panel-gap)] overflow-y-auto pr-2">
        
        {/* Header and selector */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4 flex-shrink-0">
          <div>
            <h1 className="font-[var(--font-inter)] text-2xl font-bold tracking-wider text-primary-fixed-dim flex items-center gap-2">
              <span className="material-symbols-outlined text-[28px] animate-pulse">cell_tower</span>
              Communications Hub
            </h1>
            <p className="text-xs text-outline-variant uppercase tracking-widest mt-1">
              Secure Department Dispatch & Inter-Agency Feeds
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-[10px] text-outline font-bold uppercase tracking-wider">COMPLIANT LOCATION:</span>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="bg-surface-container-highest border border-outline-variant/35 px-4 py-2 text-sm text-on-surface font-semibold focus:outline-none uppercase rounded-sm"
            >
              {compliantLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Departments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {departmentsData.map((dept, idx) => {
            const sty = statusStyles[dept.status] || statusStyles.Waiting;
            const isSelected = dept.name === selectedDept;

            return (
              <motion.div
                key={dept.name}
                onClick={() => setSelectedDept(dept.name)}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`glass-card border p-4 flex flex-col gap-3 rounded-sm cursor-pointer relative transition-all ${
                  isSelected ? "border-primary shadow-[0_0_12px_rgba(0,218,243,0.15)] bg-primary-container/5" : "border-outline-variant/20 hover:border-outline-variant/40"
                }`}
              >
                {/* Top header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-[var(--font-inter)] text-[15px] font-bold text-on-surface">
                      {dept.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${sty.dot}`} />
                      <span className={`font-[var(--font-geist)] text-[10px] uppercase font-bold ${sty.text}`}>
                        {dept.status}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-outline whitespace-nowrap">
                    ETA: {dept.eta}
                  </span>
                </div>

                {/* Main operational details */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] font-[var(--font-geist)] border-t border-outline-variant/10 pt-2 text-on-surface-variant">
                  <div>
                    <span className="text-outline uppercase text-[8px] tracking-wider block">Incident Type</span>
                    <span className="text-on-surface font-semibold block mt-0.5">{dept.type}</span>
                  </div>
                  <div>
                    <span className="text-outline uppercase text-[8px] tracking-wider block">Priority</span>
                    <span className="text-error font-semibold block mt-0.5">{dept.priority}</span>
                  </div>
                  <div>
                    <span className="text-outline uppercase text-[8px] tracking-wider block">Assigned Officer</span>
                    <span className="text-on-surface font-semibold block mt-0.5 truncate">{dept.officer}</span>
                  </div>
                  <div>
                    <span className="text-outline uppercase text-[8px] tracking-wider block">Last Update</span>
                    <span className="text-on-surface font-semibold block mt-0.5">{dept.lastUpdate}</span>
                  </div>
                </div>

                <div className="tech-bracket" />
              </motion.div>
            );
          })}
        </div>

      </div>

      {/* Department Detail Display (Right) */}
      {selectedDeptDetails && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[410px] flex-shrink-0 flex flex-col gap-[var(--spacing-panel-gap)] overflow-y-auto pr-2 h-full"
        >
          {/* Detailed dispatch card */}
          <div className="glass-panel p-5 flex flex-col relative overflow-hidden flex-shrink-0 gap-4">
            
            {/* Header info */}
            <div className="border-b border-outline-variant/20 pb-3 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-outline uppercase font-bold tracking-widest font-[var(--font-geist)]">
                  DISPATCH CHANNEL STATUS
                </span>
                <h3 className="font-[var(--font-inter)] text-base font-bold text-on-surface mt-0.5">
                  {selectedDeptDetails.name} details
                </h3>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-[10px] uppercase font-extrabold ${statusStyles[selectedDeptDetails.status].bg} ${statusStyles[selectedDeptDetails.status].text}`}>
                {selectedDeptDetails.status}
              </span>
            </div>

            {/* Incident Summary */}
            <div className="text-xs text-on-surface-variant leading-relaxed">
              <span className="font-bold text-outline uppercase text-[9px] block mb-1">Incident Summary</span>
              <p className="bg-surface-container-lowest/50 p-2.5 border border-outline-variant/15 rounded-sm italic">
                {selectedDeptDetails.incident}
              </p>
            </div>

            {/* Compliance verification check */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-sm text-xs flex justify-between items-center">
              <span className="font-bold text-emerald-400 uppercase text-[9px]">Compliance Status Approval</span>
              <span className="font-bold text-emerald-400 tracking-wider font-[var(--font-geist)]">✓ APPROVED & FORWARDED</span>
            </div>

            {/* Core dispatch grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-[var(--font-geist)]">
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Area/Location</span>
                <span className="text-on-surface font-semibold">{selectedDeptDetails.location}</span>
              </div>
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">ETA</span>
                <span className="text-cyan-400 font-semibold">{selectedDeptDetails.eta}</span>
              </div>
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Assigned Officer/Team</span>
                <span className="text-on-surface font-semibold block truncate" title={selectedDeptDetails.officer}>
                  {selectedDeptDetails.officer}
                </span>
              </div>
              <div className="p-2 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm">
                <span className="text-outline uppercase text-[9px] block">Dispatch Time</span>
                <span className="text-on-surface font-semibold">{selectedDeptDetails.dispatchTime}</span>
              </div>
            </div>

            {/* Resource recommendations & assignments */}
            <div className="flex flex-col gap-2 text-xs">
              <div className="p-3 bg-secondary/15 border border-secondary/30 rounded-sm">
                <span className="font-bold text-secondary uppercase text-[9px] block mb-0.5">AI Resource Recommendation</span>
                <span className="text-on-surface font-semibold">{selectedDeptDetails.aiRecommendation}</span>
              </div>
              <div className="p-3 bg-surface-container-highest/35 border border-outline-variant/20 rounded-sm">
                <span className="font-bold text-outline uppercase text-[9px] block mb-0.5">Assigned Resources</span>
                <span className="text-on-surface">{selectedDeptDetails.resourcesAssigned}</span>
              </div>
            </div>

            {/* Current Action */}
            <div className="p-3.5 bg-surface-container-lowest/50 border border-outline-variant/15 rounded-sm text-xs leading-relaxed text-on-surface-variant">
              <span className="font-bold text-outline uppercase text-[9px] block mb-1">Current Action</span>
              {selectedDeptDetails.action}
            </div>

            {/* Department logs */}
            <div className="text-xs text-on-surface-variant leading-relaxed">
              <span className="font-bold text-outline uppercase text-[9px] block mb-1">Department Response Log</span>
              <p className="bg-surface-container-lowest/50 p-2.5 border border-outline-variant/15 rounded-sm font-[var(--font-geist)] text-[11px]">
                {selectedDeptDetails.log}
              </p>
            </div>

            {/* Dispatch Timeline */}
            <div className="text-xs text-on-surface-variant flex flex-col gap-2">
              <span className="font-bold text-outline uppercase text-[9px] block">Dispatch Timeline</span>
              <div className="flex flex-col gap-2 border-l border-outline-variant/20 pl-4 ml-2">
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-outline block font-bold">00:00</span>
                  <span className="text-on-surface-variant mt-0.5 block">Audit report published in compliance records</span>
                </div>
                <div className="relative">
                  <div className={`absolute -left-[21px] top-1 w-2 h-2 rounded-full ${simStep >= 1 ? "bg-emerald-400" : "bg-outline"}`} />
                  <span className="text-[10px] text-outline block font-bold">00:01</span>
                  <span className="text-on-surface-variant mt-0.5 block">Automated alert dispatched to {selectedDeptDetails.name}</span>
                </div>
                <div className="relative">
                  <div className={`absolute -left-[21px] top-1 w-2 h-2 rounded-full ${simStep >= 2 ? "bg-emerald-400" : "bg-outline"}`} />
                  <span className="text-[10px] text-outline block font-bold">00:03</span>
                  <span className="text-on-surface-variant mt-0.5 block">Department acknowledgement received</span>
                </div>
              </div>
            </div>

            {/* Completion status */}
            <div className="p-3 bg-surface-container-highest/20 border border-outline-variant/15 rounded-sm text-xs flex justify-between items-center">
              <span className="font-bold text-outline uppercase text-[9px]">Completion Status</span>
              <span className={`font-bold tracking-wider font-[var(--font-geist)] ${
                selectedDeptDetails.status === "Resolved" ? "text-emerald-400" : "text-amber-400"
              }`}>{selectedDeptDetails.status === "Resolved" ? "MISSION COMPLETED" : "OPERATIONAL"}</span>
            </div>

            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-outline-variant/50" />
          </div>
        </motion.div>
      )}

    </div>
  );
}
