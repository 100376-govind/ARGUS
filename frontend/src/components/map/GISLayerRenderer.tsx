"use client";

import { useEffect, useRef, useCallback } from "react";
import { useMap, useMapsLibrary, AdvancedMarker } from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import type { GISLayerKey, ValidatedLocation, ResourcePOI } from "./useGISLayers";
import districtData from "@/data/wb-districts.json";

// ── Severity → impact radius (metres) ──
const severityRadius: Record<string, number> = {
  critical: 2500,
  high: 1800,
  medium: 1200,
  low: 700,
};

// ── Resource marker colours ──
const resourceColors: Record<string, { bg: string; icon: string }> = {
  Police: { bg: "bg-blue-500", icon: "local_police" },
  Hospital: { bg: "bg-purple-600", icon: "emergency" },
  Fire: { bg: "bg-orange-500", icon: "local_fire_department" },
  NDRF: { bg: "bg-green-600", icon: "military_tech" },
};

interface Props {
  gisEnabled: boolean;
  layers: Record<GISLayerKey, boolean>;
  validatedLocations: ValidatedLocation[];
  resourcePOIs: ResourcePOI[];
  liveLocation: google.maps.LatLngLiteral | null;
}

export default function GISLayerRenderer({
  gisEnabled,
  layers,
  validatedLocations,
  resourcePOIs,
  liveLocation,
}: Props) {
  const map = useMap();
  const vizLib = useMapsLibrary("visualization");

  // ── Refs for cached overlays ──
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const boundaryLayerRef = useRef<google.maps.Data | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const clusterMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  // ── Cleanup helper ──
  const clearCircles = useCallback(() => {
    circlesRef.current.forEach((c) => c.setMap(null));
    circlesRef.current = [];
  }, []);

  const clearCluster = useCallback(() => {
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
    clusterMarkersRef.current.forEach((m) => (m.map = null));
    clusterMarkersRef.current = [];
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  HEATMAP LAYER
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!map || !vizLib) return;
    const show = gisEnabled && layers.heatmap;

    if (show) {
      const points = validatedLocations.flatMap((vl) =>
        vl.reports
          .filter((r) => r.coordinates)
          .map((r) => ({
            location: new google.maps.LatLng(r.coordinates!.lat, r.coordinates!.lng),
            weight: vl.confidence / 20,
          }))
      );

      if (!heatmapRef.current) {
        heatmapRef.current = new (vizLib as any).HeatmapLayer({
          data: points,
          radius: 40,
          opacity: 0.7,
          gradient: [
            "rgba(0,0,0,0)",
            "rgba(0,218,243,0.3)",
            "rgba(0,218,243,0.5)",
            "rgba(68,221,193,0.6)",
            "rgba(255,193,192,0.7)",
            "rgba(255,180,171,0.85)",
            "rgba(255,100,80,1)",
          ],
          map,
        });
      } else {
        (heatmapRef.current as any).setData(points);
        (heatmapRef.current as any).setMap(map);
      }
    } else {
      (heatmapRef.current as any)?.setMap(null);
    }
  }, [map, vizLib, gisEnabled, layers.heatmap, validatedLocations]);

  // ═══════════════════════════════════════════════════════════
  //  IMPACT ZONE CIRCLES
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!map) return;
    const show = gisEnabled && layers.impactZones;

    clearCircles();

    if (show) {
      validatedLocations.forEach((vl) => {
        const radius = severityRadius[vl.severity.toLowerCase()] || 1200;
        const circle = new google.maps.Circle({
          center: vl.centroid,
          radius,
          strokeColor: "#00DAF3",
          strokeOpacity: 0.6,
          strokeWeight: 1.5,
          fillColor: vl.severity.toLowerCase() === "critical" ? "#FFB4AB" : "#00DAF3",
          fillOpacity: 0.12,
          map,
        });
        circlesRef.current.push(circle);
      });
    }

    return () => clearCircles();
  }, [map, gisEnabled, layers.impactZones, validatedLocations, clearCircles]);

  // ═══════════════════════════════════════════════════════════
  //  ADMIN BOUNDARIES (GeoJSON Data Layer)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!map) return;
    const show = gisEnabled && layers.adminBoundaries;

    if (show) {
      if (!boundaryLayerRef.current) {
        const dataLayer = new google.maps.Data({ map });
        dataLayer.addGeoJson(districtData as any);
        dataLayer.setStyle({
          strokeColor: "#00DAF3",
          strokeOpacity: 0.5,
          strokeWeight: 1.5,
          fillColor: "#00DAF3",
          fillOpacity: 0.04,
        });
        boundaryLayerRef.current = dataLayer;
      } else {
        boundaryLayerRef.current.setMap(map);
      }
    } else {
      boundaryLayerRef.current?.setMap(null);
    }
  }, [map, gisEnabled, layers.adminBoundaries]);

  // ═══════════════════════════════════════════════════════════
  //  INCIDENT MARKER CLUSTERER
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!map) return;
    const show = gisEnabled && layers.incidentMarkers;

    clearCluster();

    if (show) {
      const markers: google.maps.marker.AdvancedMarkerElement[] = [];

      validatedLocations.forEach((vl) => {
        vl.reports.forEach((r) => {
          if (!r.coordinates) return;

          const pin = document.createElement("div");
          pin.className = "w-3 h-3 rounded-full border-2 border-[var(--md-sys-color-surface,#111)] bg-red-500 shadow-[0_0_6px_rgba(255,100,80,0.8)]";

          const marker = new google.maps.marker.AdvancedMarkerElement({
            position: r.coordinates,
            map,
            content: pin,
            title: `${r.id}: ${r.type} (${r.priority})`,
          });
          markers.push(marker);
        });
      });

      clusterMarkersRef.current = markers;

      clustererRef.current = new MarkerClusterer({
        map,
        markers,
        renderer: {
          render: ({ count, position }) => {
            const el = document.createElement("div");
            el.className =
              "flex items-center justify-center w-9 h-9 rounded-full border-2 border-cyan-400/60 bg-surface/80 text-cyan-300 text-[11px] font-bold shadow-[0_0_12px_rgba(0,218,243,0.4)] backdrop-blur-sm";
            el.textContent = String(count);
            return new google.maps.marker.AdvancedMarkerElement({ position, content: el });
          },
        },
      });
    }

    return () => clearCluster();
  }, [map, gisEnabled, layers.incidentMarkers, validatedLocations, clearCluster]);

  // ═══════════════════════════════════════════════════════════
  //  DISPATCH ROUTES (Directions API polylines)
  // ═══════════════════════════════════════════════════════════
  const routePolylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map) return;
    const show = gisEnabled && layers.dispatchRoutes;

    // Clear existing
    routePolylinesRef.current.forEach((p) => p.setMap(null));
    routePolylinesRef.current = [];

    if (!show || !liveLocation) return;

    // Draw straight-line fallback routes from operator to each validated centroid
    validatedLocations.forEach((vl) => {
      const glow = new google.maps.Polyline({
        path: [liveLocation, vl.centroid],
        geodesic: true,
        strokeColor: "#00B4D8",
        strokeOpacity: 0.2,
        strokeWeight: 8,
        map,
      });
      const main = new google.maps.Polyline({
        path: [liveLocation, vl.centroid],
        geodesic: true,
        strokeColor: "#00DAF3",
        strokeOpacity: 0.8,
        strokeWeight: 3,
        icons: [
          {
            icon: { path: "M 0,-1 0,1", strokeOpacity: 0.8, scale: 3 },
            offset: "0",
            repeat: "14px",
          },
        ],
        map,
      });
      routePolylinesRef.current.push(glow, main);
    });

    return () => {
      routePolylinesRef.current.forEach((p) => p.setMap(null));
      routePolylinesRef.current = [];
    };
  }, [map, gisEnabled, layers.dispatchRoutes, liveLocation, validatedLocations]);

  // ═══════════════════════════════════════════════════════════
  //  RESOURCE LOCATION MARKERS  (rendered via React)
  // ═══════════════════════════════════════════════════════════
  const showResources = gisEnabled && layers.resourceLocations;

  // ═══════════════════════════════════════════════════════════
  //  LIVE LOCATION  (rendered via React)
  // ═══════════════════════════════════════════════════════════
  const showLiveLoc = gisEnabled && layers.liveLocation;

  return (
    <>
      {/* Resource markers via React AdvancedMarker */}
      {showResources &&
        resourcePOIs.map((poi) => {
          const cfg = resourceColors[poi.type] || { bg: "bg-gray-500", icon: "place" };
          return (
            <AdvancedMarker key={poi.id} position={{ lat: poi.lat, lng: poi.lng }} title={poi.name}>
              <div className="relative flex flex-col items-center group cursor-pointer">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-surface shadow-lg ${cfg.bg} text-white`}
                >
                  <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                </div>
                <div className="absolute -top-7 bg-surface-container-lowest/95 border border-outline-variant/30 px-2 py-0.5 rounded-sm font-[var(--font-geist)] text-[8px] font-semibold text-on-surface whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 transition-opacity uppercase z-50">
                  {poi.name}
                </div>
              </div>
            </AdvancedMarker>
          );
        })}

      {/* GIS live location marker */}
      {showLiveLoc && liveLocation && (
        <AdvancedMarker position={liveLocation} title="Operator Live Location (GIS)">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-12 h-12 rounded-full border border-secondary bg-secondary/15 animate-ping" />
            <div className="absolute w-8 h-8 rounded-full border-2 border-secondary bg-secondary/20" />
            <div className="w-4 h-4 rounded-full bg-secondary border-2 border-surface shadow-[0_0_10px_rgba(68,221,193,0.8)] z-10" />
            <span className="absolute -top-6 bg-surface-container-highest/90 border border-secondary/30 text-secondary text-[9px] font-[var(--font-geist)] font-semibold tracking-wider px-1.5 py-0.5 rounded-sm whitespace-nowrap uppercase">
              OPERATOR (YOU)
            </span>
          </div>
        </AdvancedMarker>
      )}
    </>
  );
}
