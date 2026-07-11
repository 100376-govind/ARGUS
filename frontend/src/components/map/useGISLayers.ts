"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import incidentsData from "@/data/incidents.json";
import type { Incident } from "@/types";

const incidents = incidentsData as Incident[];

// ── Layer keys ──────────────────────────────────────────────
export type GISLayerKey =
  | "incidentMarkers"
  | "heatmap"
  | "resourceLocations"
  | "dispatchRoutes"
  | "impactZones"
  | "adminBoundaries"
  | "liveLocation";

export interface GISLayerMeta {
  key: GISLayerKey;
  label: string;
  icon: string;
  defaultOn: boolean;
}

export const GIS_LAYERS: GISLayerMeta[] = [
  { key: "incidentMarkers", label: "Incident Markers", icon: "location_on", defaultOn: true },
  { key: "heatmap", label: "Heatmap", icon: "thermostat", defaultOn: false },
  { key: "resourceLocations", label: "Resource Locations", icon: "local_hospital", defaultOn: true },
  { key: "dispatchRoutes", label: "Dispatch Routes", icon: "route", defaultOn: false },
  { key: "impactZones", label: "Impact Zones", icon: "radar", defaultOn: false },
  { key: "adminBoundaries", label: "Admin Boundaries", icon: "border_all", defaultOn: false },
  { key: "liveLocation", label: "Live Location", icon: "my_location", defaultOn: true },
];

const buildDefaults = (): Record<GISLayerKey, boolean> => {
  const d: Record<string, boolean> = {};
  GIS_LAYERS.forEach((l) => (d[l.key] = l.defaultOn));
  return d as Record<GISLayerKey, boolean>;
};

// ── Validated-incident helper (mirrors Validator logic) ─────
const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const computeCorrelation = (current: Incident) => {
  const others = incidents.filter((i) => i.id !== current.id);
  const tokenize = (t: string) =>
    new Set(
      (t || "")
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
  const jaccard = (a: Set<string>, b: Set<string>) => {
    if (!a.size || !b.size) return 0;
    const inter = [...a].filter((x) => b.has(x)).length;
    return Math.round((inter / new Set([...a, ...b]).size) * 100);
  };
  const locSim = (c: Incident, o: Incident) => {
    if (c.coordinates && o.coordinates) {
      const d = haversine(c.coordinates.lat, c.coordinates.lng, o.coordinates.lat, o.coordinates.lng);
      if (d <= 0.5) return 100;
      if (d <= 2) return 80;
      if (d <= 5) return 50;
      if (d <= 10) return 20;
      return 0;
    }
    return c.location === o.location ? 100 : 0;
  };
  const typeSim = (a: string, b: string) => {
    const x = a.toLowerCase(),
      y = b.toLowerCase();
    return x === y ? 100 : x.includes(y) || y.includes(x) ? 50 : 0;
  };
  const timeSim = (a: string, b: string) => {
    const h = Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3600000;
    if (h <= 1) return 100;
    if (h <= 4) return 80;
    if (h <= 12) return 50;
    if (h <= 24) return 20;
    return 0;
  };
  const curTokens = tokenize(`${current.type} ${current.location} ${current.description || ""}`);
  let maxSim = 0;
  for (const o of others) {
    const kw = jaccard(curTokens, tokenize(`${o.type} ${o.location} ${o.description || ""}`));
    const loc = locSim(current, o);
    const typ = typeSim(current.type, o.type);
    const tm = timeSim(current.timestamp, o.timestamp);
    const hasLoc = !!(current.coordinates && o.coordinates);
    const overall = hasLoc
      ? Math.round(kw * 0.25 + loc * 0.35 + typ * 0.25 + tm * 0.15)
      : Math.round(kw * 0.4 + typ * 0.4 + tm * 0.2);
    if (overall > maxSim) maxSim = overall;
  }
  return { confidence: maxSim };
};

export interface ValidatedLocation {
  location: string;
  totalReports: number;
  incidentType: string;
  centroid: { lat: number; lng: number };
  severity: string;
  confidence: number;
  reports: Incident[];
}

// ── Resource POIs ───────────────────────────────────────────
export interface ResourcePOI {
  id: string;
  name: string;
  type: "Police" | "Hospital" | "Fire" | "NDRF";
  lat: number;
  lng: number;
}

// ── Hook ────────────────────────────────────────────────────
export function useGISLayers() {
  const [gisEnabled, setGisEnabled] = useState(false);
  const [layers, setLayers] = useState<Record<GISLayerKey, boolean>>(buildDefaults);
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "terrain">("roadmap");

  // Track which layers have been initialised (lazy-load)
  const initialisedRef = useRef<Set<GISLayerKey>>(new Set());

  const toggleGIS = useCallback(() => setGisEnabled((p) => !p), []);

  const toggleLayer = useCallback((key: GISLayerKey) => {
    setLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (next[key]) initialisedRef.current.add(key);
      return next;
    });
  }, []);

  const isInitialised = useCallback(
    (key: GISLayerKey) => initialisedRef.current.has(key),
    []
  );

  // Mark layers that start as defaultOn
  useEffect(() => {
    GIS_LAYERS.forEach((l) => {
      if (l.defaultOn) initialisedRef.current.add(l.key);
    });
  }, []);

  // ── Compute validated locations (same logic as Validator) ──
  const groupedByLocation = useMemo(() => {
    const map: Record<string, Incident[]> = {};
    incidents.forEach((inc) => {
      const loc = inc.location;
      if (!map[loc]) map[loc] = [];
      map[loc].push(inc);
    });
    return map;
  }, []);

  const validatedLocations: ValidatedLocation[] = useMemo(() => {
    const customValRaw =
      typeof window !== "undefined" ? localStorage.getItem("argus-custom-validation-data") : null;
    const customValData: Record<string, any> = customValRaw ? JSON.parse(customValRaw) : {};

    const valid: ValidatedLocation[] = [];
    for (const [location, reports] of Object.entries(groupedByLocation)) {
      const custom = customValData[location];
      if (custom?.forceValidated === false) continue;

      const multipleReports = reports.length >= 2 || custom?.forceValidated;
      const types = reports.map((r) => r.type);
      const dominantType = types.sort((a, b) => types.filter((v) => v === b).length - types.filter((v) => v === a).length)[0];
      const typeConsistent = new Set(types).size <= 2;
      const ts = reports.map((r) => new Date(r.timestamp).getTime());
      const withinTimeWindow = Math.max(...ts) - Math.min(...ts) <= 24 * 3600000;

      const coords = reports.filter((r) => r.coordinates).map((r) => r.coordinates!);
      const centroid =
        coords.length > 0
          ? {
              lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
              lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
            }
          : { lat: 22.5726, lng: 88.3639 };

      let maxDist = 0;
      for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
          const d = haversine(coords[i].lat, coords[i].lng, coords[j].lat, coords[j].lng);
          if (d > maxDist) maxDist = d;
        }
      }
      const withinLocThreshold = coords.length === 0 || maxDist <= 3.0;

      const confidences = reports.map((r) => computeCorrelation(r).confidence);
      const maxConfidence = confidences.length > 0 ? Math.max(...confidences) : 0;
      const aiConfidenceExceeds = maxConfidence >= 75;
      const mediaVerified = reports.some(
        (r) =>
          ["resolved", "dispatched", "in-progress"].includes(r.status.toLowerCase()) ||
          r.reportSource === "IoT Sensor"
      );
      const trustedSourceExists = reports.some((r) =>
        ["Patrol Unit", "IoT Sensor", "Emergency Call"].includes(r.reportSource || "")
      );

      const isValidated =
        multipleReports &&
        typeConsistent &&
        withinTimeWindow &&
        withinLocThreshold &&
        aiConfidenceExceeds &&
        mediaVerified &&
        trustedSourceExists;

      if (isValidated) {
        const avgConfidence =
          confidences.length > 0
            ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
            : 0;
        const sev =
          reports.find((r) => r.severity?.toLowerCase() === "critical")?.severity ||
          reports.find((r) => r.severity?.toLowerCase() === "high")?.severity ||
          reports[0]?.severity ||
          "Medium";
        valid.push({
          location,
          totalReports: reports.length,
          incidentType: dominantType,
          centroid,
          severity: sev,
          confidence: avgConfidence,
          reports,
        });
      }
    }
    return valid;
  }, [groupedByLocation]);

  // ── Resource POIs near validated locations ──
  const resourcePOIs: ResourcePOI[] = useMemo(() => {
    const pois: ResourcePOI[] = [];
    validatedLocations.forEach((vl) => {
      const { lat, lng } = vl.centroid;
      pois.push(
        { id: `police-${vl.location}`, name: `${vl.location} Police Station`, type: "Police", lat: lat + 0.005, lng: lng - 0.006 },
        { id: `hospital-${vl.location}`, name: `${vl.location} District Hospital`, type: "Hospital", lat: lat - 0.004, lng: lng + 0.007 },
        { id: `fire-${vl.location}`, name: `${vl.location} Fire Station`, type: "Fire", lat: lat + 0.003, lng: lng + 0.005 },
        { id: `ndrf-${vl.location}`, name: `${vl.location} NDRF Camp`, type: "NDRF", lat: lat - 0.006, lng: lng - 0.004 }
      );
    });
    return pois;
  }, [validatedLocations]);

  return {
    gisEnabled,
    toggleGIS,
    layers,
    toggleLayer,
    mapType,
    setMapType,
    isInitialised,
    validatedLocations,
    resourcePOIs,
  };
}
