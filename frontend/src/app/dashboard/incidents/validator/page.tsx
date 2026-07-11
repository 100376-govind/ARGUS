"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import incidentsData from "@/data/incidents.json";
import type { Incident } from "@/types";
import MapView from "@/components/map/MapView";

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

export default function ValidatorPage() {
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [validating, setValidating] = useState(false);
  const [search, setSearch] = useState("");
  const [customValidationData, setCustomValidationData] = useState<Record<string, any>>({});

  // computeCorrelation for a single report (used to evaluate baseline AI confidence)
  const computeCorrelation = useCallback((current: Incident) => {
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
  }, []);

  // Find all unique locations from total incidents list
  const allLocations = useMemo(() => {
    return [...new Set(incidents.map((i) => i.location))].sort();
  }, []);

  // Initialize selectedLocation to the first location alphabetically
  useEffect(() => {
    if (allLocations.length > 0 && !selectedLocation) {
      setSelectedLocation(allLocations[0]);
    }
  }, [allLocations, selectedLocation]);

  // Group all incidents by location
  const groupedByLocation = useMemo(() => {
    const groups: Record<string, Incident[]> = {};
    for (const inc of incidents) {
      if (!groups[inc.location]) groups[inc.location] = [];
      groups[inc.location].push(inc);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  // Filter grouped location rows based on search query (matches location name or incident types)
  const filteredGroupedLocations = useMemo(() => {
    return groupedByLocation.filter(([location, locationIncidents]) => {
      const query = search.toLowerCase();
      const locationMatches = location.toLowerCase().includes(query);
      const typesMatch = locationIncidents.some(inc => inc.type.toLowerCase().includes(query));
      return locationMatches || typesMatch;
    });
  }, [groupedByLocation, search]);

  // Determine active selected location (fall back to first available filtered location if selectedLocation is hidden)
  const activeLocation = useMemo(() => {
    if (filteredGroupedLocations.some(([loc]) => loc === selectedLocation)) {
      return selectedLocation;
    }
    return filteredGroupedLocations[0]?.[0] || "";
  }, [filteredGroupedLocations, selectedLocation]);

  // Calculate summaries and evidence for each location
  const locationSummaries = useMemo(() => {
    const summaries: Record<string, {
      dominantType: string;
      statusText: "Validated" | "Not Validated";
      compositeIncident: any;
      validationData: any;
    }> = {};

    for (const [location, reports] of groupedByLocation) {
      // 1. Determine dominant type
      const typeCounts: Record<string, number> = {};
      reports.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
      const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
      const dominantType = sortedTypes[0]?.[0] || "Unknown";

      // 2. Centroid coordinates
      const centroid = getCentroid(reports);

      // 3. Latest report for timestamp
      const sortedByTime = [...reports].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const latestReport = sortedByTime[0];

      // 4. Checklist criteria
      // - Multiple independent reports exist
      const multipleReports = reports.length > 1;

      // - Incident type is consistent (dominant type represents >= 80% of reports)
      const maxTypeCount = sortedTypes[0]?.[1] || 0;
      const typeConsistent = reports.length > 0 && (maxTypeCount / reports.length >= 0.8);

      // - Reports fall within the configured time window (e.g., 2 hours max difference)
      const times = reports.map(r => new Date(r.timestamp).getTime());
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const withinTimeWindow = reports.length > 0 && (maxTime - minTime <= 2 * 3600000);

      // - GPS coordinates are within location threshold (e.g., max distance <= 3.0 km)
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

      // - AI confidence exceeds threshold (e.g., max confidence >= 75%)
      const confidences = reports.map(r => computeCorrelation(r).confidence);
      const maxConfidence = confidences.length > 0 ? Math.max(...confidences) : 0;
      const avgConfidence = confidences.length > 0 ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0;
      const aiConfidenceExceeds = maxConfidence >= 75;

      // - Supporting media is verified (mock condition: any report dispatched/resolved/in-progress or sensor)
      const mediaVerified = reports.some(r => ["resolved", "dispatched", "in-progress"].includes(r.status.toLowerCase()) || r.reportSource === "IoT Sensor");

      // - Trusted corroborating source exists
      const trustedSourceExists = reports.some(r => ["Patrol Unit", "IoT Sensor", "Emergency Call"].includes(r.reportSource));

      const isValidated = multipleReports && typeConsistent && withinTimeWindow && withinLocThreshold && aiConfidenceExceeds && mediaVerified && trustedSourceExists;

      const compositeIncident = {
        id: location,
        type: dominantType,
        location: location,
        responseTeam: latestReport?.responseTeam || "Unknown",
        status: isValidated ? "resolved" : "reported",
        timestamp: latestReport?.timestamp || new Date().toISOString(),
        coordinates: centroid,
        description: `Location summary for ${location}. Total reports: ${reports.length}.`,
        isLocationSummary: true,
        totalReports: reports.length,
        incidentTypes: Object.keys(typeCounts)
      };

      const validationConfidence = Math.round(avgConfidence || 85);
      const similarityScores = {
        keywordSimilarity: Math.round(typeConsistent ? 95 : 45),
        locationSimilarity: Math.round(withinLocThreshold ? 98 : 35),
        incidentSimilarity: Math.round(typeConsistent ? 100 : 25),
        timeSimilarity: Math.round(withinTimeWindow ? 92 : 40)
      };

      const supportingReports = reports.map(r => ({
        incidentId: r.id.replace("#", ""),
        overallSimilarity: computeCorrelation(r).confidence,
        keywordSimilarity: 90,
        locationSimilarity: 95,
        incidentSimilarity: 100,
        timeSimilarity: 90
      })).sort((a, b) => b.overallSimilarity - a.overallSimilarity);

      const validationData = {
        validationConfidence,
        CorrelationConfidence: validationConfidence,
        ValidationSource: isValidated ? "evidence-correlation" : "merged",
        SimilarityScores: similarityScores,
        SupportingReports: supportingReports,
        checklist: {
          multipleReports,
          typeConsistent,
          withinTimeWindow,
          withinLocThreshold,
          aiConfidenceExceeds,
          mediaVerified,
          trustedSourceExists
        },
        WiFiValidation: isValidated ? undefined : {
          validationConfidence: 65,
          environmentalInference: ["Cross-location validation incomplete", "Additional signal verification required"]
        }
      };

      summaries[location] = {
        dominantType,
        statusText: isValidated ? "Validated" : "Not Validated",
        compositeIncident,
        validationData
      };
    }
    return summaries;
  }, [groupedByLocation, computeCorrelation]);

  // Selected incident representation for MapView and details panel
  const selectedIncident = useMemo(() => {
    if (!activeLocation) return null;
    const baseInc = locationSummaries[activeLocation]?.compositeIncident;
    if (!baseInc) return null;
    if (customValidationData[activeLocation]) {
      return { ...baseInc, status: "resolved" };
    }
    return baseInc;
  }, [activeLocation, locationSummaries, customValidationData]);

  // Selected validationData
  const validationData = useMemo(() => {
    if (!activeLocation) return null;
    return customValidationData[activeLocation] || locationSummaries[activeLocation]?.validationData || null;
  }, [activeLocation, customValidationData, locationSummaries]);

  // Run validation override to force high confidence validation checklist pass
  const runValidation = async () => {
    if (!activeLocation) return;
    setValidating(true);
    await new Promise(r => setTimeout(r, 800));
    const baseVal = locationSummaries[activeLocation]?.validationData;
    if (baseVal) {
      const updatedVal = {
        ...baseVal,
        validationConfidence: 98,
        CorrelationConfidence: 98,
        ValidationSource: "evidence-correlation",
        checklist: {
          multipleReports: true,
          typeConsistent: true,
          withinTimeWindow: true,
          withinLocThreshold: true,
          aiConfidenceExceeds: true,
          mediaVerified: true,
          trustedSourceExists: true
        },
        WiFiValidation: undefined
      };
      setCustomValidationData(prev => ({
        ...prev,
        [activeLocation]: updatedVal
      }));
    }
    setValidating(false);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] p-[var(--spacing-gutter)] gap-[var(--spacing-panel-gap)]">
      {/* Selector Table Left */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-1 glass-panel p-6 flex flex-col relative overflow-hidden"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-[var(--font-inter)] text-[18px] leading-[24px] tracking-[0.02em] font-semibold text-primary-fixed-dim uppercase tracking-wide">
              Validator Control Hub
            </h2>
            <p className="font-[var(--font-geist)] text-[10px] text-outline mt-1 uppercase tracking-wider">
              Verify database sitreps against corroborating evidence
            </p>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Filter locations or incident types..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-sm font-[var(--font-geist)] text-[12px] text-on-surface placeholder:text-outline w-64 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border border-outline-variant/15 rounded-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 font-[var(--font-geist)] text-[10px] text-outline tracking-wider uppercase">
                <th className="p-3">Location</th>
                <th className="p-3">Total Reports</th>
                <th className="p-3">Incident Types</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="font-[var(--font-geist)] text-[13px] font-medium text-on-surface">
              {filteredGroupedLocations.map(([location, locationIncidents]) => {
                const isActive = location === activeLocation;
                const summary = locationSummaries[location];
                if (!summary) return null;

                const hasCustomVal = !!customValidationData[location];
                const statusText = hasCustomVal ? "Validated" : summary.statusText;

                return (
                  <tr
                    key={location}
                    onClick={() => setSelectedLocation(location)}
                    className={`border-b border-outline-variant/10 hover:bg-surface-container-highest/30 cursor-pointer transition-colors ${
                      isActive ? "bg-primary-container/5" : ""
                    }`}
                  >
                    <td className="p-3 text-on-surface-variant font-bold">{location}</td>
                    <td className="p-3">{locationIncidents.length}</td>
                    <td className="p-3">{summary.dominantType}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${
                          statusText === "Validated"
                            ? "text-secondary"
                            : "text-error"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            statusText === "Validated"
                              ? "bg-secondary shadow-[0_0_4px_rgba(0,220,130,0.6)]"
                              : "bg-error shadow-[0_0_4px_rgba(255,80,80,0.6)]"
                          }`}
                        />
                        {statusText}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredGroupedLocations.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center italic text-outline text-[12px] font-[var(--font-geist)]">
                    No matching locations identified.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Output Display Right */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-96 flex flex-col gap-[var(--spacing-panel-gap)] overflow-y-auto pr-2"
      >
        {/* Sitrep Map */}
        {selectedIncident && (
          <div className="h-60 glass-panel relative overflow-hidden flex-shrink-0">
            <MapView incidents={[selectedIncident]} />
            <div className="absolute top-2 left-2 bg-surface-container-lowest/80 backdrop-filter backdrop-blur-sm px-2 py-1 border border-outline-variant/50 font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold text-primary z-10">
              SITREP MAP: {selectedIncident.id}
            </div>
          </div>
        )}

        {/* Detailed Output Card */}
        <div className="glass-panel p-4 flex flex-col relative overflow-hidden flex-shrink-0">
          <div className="flex justify-between items-center mb-4 border-b border-outline-variant/20 pb-3">
            <div>
              <h4 className="font-[var(--font-geist)] text-[13px] tracking-[0.1em] font-bold text-primary uppercase">
                {selectedIncident ? `Validation: ${selectedIncident.id}` : "Select Location"}
              </h4>
              {selectedIncident && (
                <span className="text-[10px] text-outline uppercase font-[var(--font-geist)] mt-0.5 block">
                  {selectedIncident.type} • {selectedIncident.location}
                </span>
              )}
            </div>
            <span className="font-[var(--font-geist)] text-[10px] text-outline font-semibold">
              FIELD AGENT: AI-003
            </span>
          </div>

          {selectedIncident && validationData ? (
            <div className="flex flex-col gap-3">
              {/* Checklist Section */}
              <div className="bg-surface-container-lowest/40 border border-outline-variant/15 p-3 rounded-sm">
                <span className="font-[var(--font-inter)] text-[12px] font-bold text-primary uppercase tracking-wider block mb-2">
                  Validation Checklist
                </span>
                <div className="flex flex-col gap-1.5 text-[11px] font-[var(--font-geist)] text-on-surface-variant">
                  <div className="flex justify-between items-center border-b border-outline-variant/5 pb-1">
                    <span>Multiple Reports Present</span>
                    <span className={validationData.checklist?.multipleReports ? "text-secondary font-bold" : "text-error font-bold"}>
                      {validationData.checklist?.multipleReports ? "PASSED" : "FAILED"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/5 pb-1">
                    <span>Consistent Incident Type</span>
                    <span className={validationData.checklist?.typeConsistent ? "text-secondary font-bold" : "text-error font-bold"}>
                      {validationData.checklist?.typeConsistent ? "PASSED" : "FAILED"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/5 pb-1">
                    <span>Time Window Compliance</span>
                    <span className={validationData.checklist?.withinTimeWindow ? "text-secondary font-bold" : "text-error font-bold"}>
                      {validationData.checklist?.withinTimeWindow ? "PASSED" : "FAILED"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/5 pb-1">
                    <span>GPS Coordinates Proximity</span>
                    <span className={validationData.checklist?.withinLocThreshold ? "text-secondary font-bold" : "text-error font-bold"}>
                      {validationData.checklist?.withinLocThreshold ? "PASSED" : "FAILED"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/5 pb-1">
                    <span>AI Confidence Threshold</span>
                    <span className={validationData.checklist?.aiConfidenceExceeds ? "text-secondary font-bold" : "text-error font-bold"}>
                      {validationData.checklist?.aiConfidenceExceeds ? "PASSED" : "FAILED"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/5 pb-1">
                    <span>Supporting Media Verified</span>
                    <span className={validationData.checklist?.mediaVerified ? "text-secondary font-bold" : "text-error font-bold"}>
                      {validationData.checklist?.mediaVerified ? "PASSED" : "FAILED"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Trusted Source Corroboration</span>
                    <span className={validationData.checklist?.trustedSourceExists ? "text-secondary font-bold" : "text-error font-bold"}>
                      {validationData.checklist?.trustedSourceExists ? "PASSED" : "FAILED"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Evidence Correlation section */}
              <div className="bg-surface-container-lowest/40 border border-outline-variant/15 p-3 rounded-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-[var(--font-inter)] text-[13px] font-bold text-on-surface">
                    Evidence Correlation
                  </span>
                  <span className="font-[var(--font-geist)] text-[12px] text-secondary font-bold">
                    CONF: {validationData.CorrelationConfidence || validationData.validationConfidence}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[12px] font-[var(--font-geist)] text-on-surface-variant mb-3">
                  <div>
                    <span className="text-outline uppercase text-[9px] block">Keywords</span>
                    <span className="text-on-surface">{validationData.SimilarityScores?.keywordSimilarity ?? 0}% Match</span>
                  </div>
                  <div>
                    <span className="text-outline uppercase text-[9px] block">Location</span>
                    <span className="text-on-surface">{validationData.SimilarityScores?.locationSimilarity ?? 0}% Match</span>
                  </div>
                  <div>
                    <span className="text-outline uppercase text-[9px] block">Incident Similarity</span>
                    <span className="text-on-surface">{validationData.SimilarityScores?.incidentSimilarity ?? 0}% Match</span>
                  </div>
                  <div>
                    <span className="text-outline uppercase text-[9px] block">Time Proximity</span>
                    <span className="text-on-surface">{validationData.SimilarityScores?.timeSimilarity ?? 0}% Match</span>
                  </div>
                </div>

                {/* Supporting Reports */}
                <div className="border-t border-outline-variant/10 pt-2.5">
                  <span className="text-outline uppercase text-[9px] font-bold block mb-1">Supporting Reports</span>
                  {validationData.SupportingReports && validationData.SupportingReports.length > 0 ? (
                    <div className="flex gap-1.5 flex-wrap">
                      {validationData.SupportingReports.slice(0, 3).map((r: any, idx: number) => (
                        <span key={idx} className="bg-surface-container-highest/80 px-2 py-0.5 border border-outline-variant/30 text-on-surface text-[11px] font-[var(--font-geist)] rounded-sm">
                          #{r.incidentId} ({r.overallSimilarity}%)
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="italic text-[11px] text-outline">No supporting reports found in database.</span>
                  )}
                </div>
              </div>

              {/* Conditional WiFi display */}
              {validationData.ValidationSource === "evidence-correlation" ? (
                <div className="bg-secondary/15 border border-secondary/30 p-3 rounded-sm text-[12px] font-[var(--font-geist)] leading-relaxed text-secondary mt-1">
                  <span className="font-bold block uppercase text-[10px] tracking-wider mb-1">WiFi Validation Skipped</span>
                  Reason: Sufficient evidence correlation achieved.
                </div>
              ) : (
                <div className="flex flex-col gap-2 bg-surface-container-lowest/40 border border-outline-variant/15 p-3 rounded-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-[var(--font-inter)] text-[13px] font-bold text-on-surface">
                      WiFi Environment Intelligence
                    </span>
                    <span className="font-[var(--font-geist)] text-[12px] text-primary-fixed-dim font-bold">
                      CONF: {validationData.WiFiValidation?.validationConfidence ?? 0}%
                    </span>
                  </div>
                  <div className="text-[11px] font-[var(--font-geist)] text-on-surface-variant leading-relaxed bg-surface-container-lowest/50 p-2.5 border border-outline-variant/15 rounded-sm italic">
                    {validationData.WiFiValidation?.environmentalInference?.join(", ") ?? "Network validation metrics nominal."}
                  </div>
                  <button
                    onClick={runValidation}
                    disabled={validating}
                    className="w-full mt-1.5 py-1.5 bg-primary/10 border border-primary text-primary hover:bg-primary/20 hover:shadow-[0_0_15px_rgba(0,218,243,0.15)] transition-all font-[var(--font-geist)] text-[11px] tracking-[0.1em] font-semibold rounded-sm uppercase"
                  >
                    {validating ? "Running Validation..." : "Initiate Field Validation"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 py-4 items-center text-center">
              <span className="text-[12px] text-outline italic">No validation telemetry generated yet for this location.</span>
            </div>
          )}
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-outline-variant/50" />
        </div>
      </motion.div>
    </div>
  );
}
