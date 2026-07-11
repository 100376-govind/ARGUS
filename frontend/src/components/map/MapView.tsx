"use client";

import React, { useEffect, useState, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

interface MapViewProps {
  incidents?: Array<{
    id: string;
    type: string;
    priority: string;
    coordinates?: { lat: number; lng: number };
  }>;
  selectedIncidentCoordinates?: { lat: number; lng: number } | null;
}

// Initial coordinates specified by user: Sector-7 Tactical Command Center
const DEFAULT_CENTER = { lat: 22.557827, lng: 88.496820 };

// Helper component to handle programmatic map center and zoom changes safely
function MapCenterController({ center, zoom }: { center: google.maps.LatLngLiteral; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    if (map && center) {
      map.panTo(center);
    }
  }, [map, center]);

  useEffect(() => {
    if (map && zoom) {
      map.setZoom(zoom);
    }
  }, [map, zoom]);

  return null;
}

function DirectionsRoute({ origin, destination }: { origin: google.maps.LatLngLiteral; destination: google.maps.LatLngLiteral }) {
  const map = useMap();
  const routesLibrary = useMapsLibrary("routes");

  useEffect(() => {
    if (!map || !routesLibrary || !origin || !destination) return;

    const directionsService = new routesLibrary.DirectionsService();
    const directionsRenderer = new routesLibrary.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#00B4D8",
        strokeOpacity: 0,
        strokeWeight: 0,
      },
    });

    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRenderer.setDirections(result);

          const route = result.routes[0];
          if (route) {
            const fullPath: google.maps.LatLng[] = [];
            route.legs.forEach(leg => {
              leg.steps.forEach(step => {
                step.path.forEach(point => fullPath.push(point));
              });
            });

            // Wider glow/shadow layer
            const glowPolyline = new google.maps.Polyline({
              path: fullPath,
              geodesic: true,
              strokeColor: "#00B4D8",
              strokeOpacity: 0.25,
              strokeWeight: 10,
              map,
            });

            // Main cyan route line
            const mainPolyline = new google.maps.Polyline({
              path: fullPath,
              geodesic: true,
              strokeColor: "#00DAF3",
              strokeOpacity: 0.9,
              strokeWeight: 4,
              map,
            });

            (directionsRenderer as any).__customPolylines = [glowPolyline, mainPolyline];
          }
        }
      }
    );

    return () => {
      const polylines = (directionsRenderer as any).__customPolylines;
      if (polylines) {
        polylines.forEach((p: google.maps.Polyline) => p.setMap(null));
      }
      directionsRenderer.setMap(null);
    };
  }, [map, routesLibrary, origin.lat, origin.lng, destination.lat, destination.lng]);

  return null;
}

export default function MapView({ incidents = [], selectedIncidentCoordinates }: MapViewProps) {
  const [center, setCenter] = useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);
  const [liveLocation, setLiveLocation] = useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);
  const [path, setPath] = useState<google.maps.LatLngLiteral[]>([DEFAULT_CENTER]);
  const [autoFollow, setAutoFollow] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(15);

  const [telemetry, setTelemetry] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
    altitude: number | null;
    lastUpdated: string;
  }>({
    latitude: DEFAULT_CENTER.lat,
    longitude: DEFAULT_CENTER.lng,
    accuracy: null,
    speed: null,
    heading: null,
    altitude: null,
    lastUpdated: new Date().toLocaleTimeString(),
  });

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "";

  // Use a ref for autoFollow to prevent restarting the watchPosition stream on toggle change
  const autoFollowRef = useRef(autoFollow);
  useEffect(() => {
    autoFollowRef.current = autoFollow;
  }, [autoFollow]);

  // Continuously track device location using watchPosition
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by this operator device.");
      return;
    }

    const success = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, speed, heading, altitude } = position.coords;
      const coords = { lat: latitude, lng: longitude };

      setLiveLocation(coords);
      setPath((prev) => {
        // Only append if the location has actually changed from the last recorded point
        const lastPoint = prev[prev.length - 1];
        if (lastPoint && lastPoint.lat === latitude && lastPoint.lng === longitude) {
          return prev;
        }
        return [...prev, coords];
      });

      setTelemetry({
        latitude,
        longitude,
        accuracy,
        speed: speed !== null && speed >= 0 ? speed * 3.6 : null, // Convert m/s to km/h
        heading,
        altitude,
        lastUpdated: new Date(position.timestamp).toLocaleTimeString(),
      });

      if (autoFollowRef.current) {
        setCenter(coords);
      }
      setGeoError(null);
    };

    const error = (err: GeolocationPositionError) => {
      console.warn("Geolocation watchPosition failed:", err.message);
      let errMsg = "GPS tracking unavailable.";
      if (err.code === err.PERMISSION_DENIED) {
        errMsg = "GPS permission denied. Using default command location.";
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        errMsg = "GPS position unavailable.";
      } else if (err.code === err.TIMEOUT) {
        errMsg = "GPS request timed out.";
      }
      setGeoError(errMsg);
    };

    const watchId = navigator.geolocation.watchPosition(success, error, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Center on single incident if focus list has exactly 1 incident
  useEffect(() => {
    if (incidents.length === 1 && incidents[0]) {
      const inc = incidents[0];
      const baseCoords = liveLocation || DEFAULT_CENTER;
      const latOffset = Math.sin(inc.id.charCodeAt(2) * 10) * 0.015;
      const lngOffset = Math.cos(inc.id.charCodeAt(3) * 10) * 0.015;
      
      const coords = {
        lat: baseCoords.lat + latOffset,
        lng: baseCoords.lng + lngOffset,
      };
      setCenter(coords);
    }
  }, [incidents, liveLocation]);

  // Center on clicked incident from dispatch board
  useEffect(() => {
    if (selectedIncidentCoordinates) {
      setCenter(selectedIncidentCoordinates);
    }
  }, [selectedIncidentCoordinates]);

  if (!apiKey) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container-lowest/80 border border-outline-variant/30 text-error">
        <span className="material-symbols-outlined text-[48px] mb-2 animate-pulse">warning</span>
        <span className="font-[var(--font-geist)] text-[12px] tracking-[0.1em] font-semibold uppercase">
          GOOGLE MAPS API KEY MISSING
        </span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full relative">
      <APIProvider apiKey={apiKey} libraries={["routes"]}>
        <Map
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={zoom}
          mapId={mapId || undefined}
          disableDefaultUI={true}
          gestureHandling="greedy"
          style={{ width: "100%", height: "100%" }}
        >
          <MapCenterController center={center} zoom={zoom} />

          {/* Live User Location Marker */}
          {liveLocation && (
            <AdvancedMarker position={liveLocation} title="Operator Live Location">
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

          {/* Incident Markers */}
          {incidents.map((inc) => {
            const baseCoords = liveLocation || DEFAULT_CENTER;
            const latOffset = Math.sin(inc.id.charCodeAt(2) * 10) * 0.015;
            const lngOffset = Math.cos(inc.id.charCodeAt(3) * 10) * 0.015;

            const coords = {
              lat: baseCoords.lat + latOffset,
              lng: baseCoords.lng + lngOffset,
            };

            const isCritical = inc.priority === "critical";
            const colorClass = isCritical
              ? "bg-error border-error shadow-[0_0_12px_rgba(255,180,171,0.8)]"
              : inc.priority === "high"
              ? "bg-tertiary-container border-tertiary-container shadow-[0_0_8px_rgba(255,193,192,0.6)]"
              : "bg-secondary-container border-secondary-container";

            return (
              <AdvancedMarker key={inc.id} position={coords} title={`${inc.type} (${inc.priority})`}>
                <div className="relative flex flex-col items-center group cursor-pointer">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 border-surface z-10 status-pip ${colorClass}`} />
                  {isCritical && (
                    <div className="absolute w-10 h-10 rounded-full border border-error bg-error/15 animate-ping" />
                  )}
                  <div className="absolute -top-7 bg-surface-container-lowest/95 border border-outline-variant/30 px-2 py-0.5 rounded-sm font-[var(--font-geist)] text-[9px] font-semibold text-on-surface whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 transition-opacity uppercase z-50">
                    <span className={isCritical ? "text-error font-bold" : "text-primary-fixed-dim"}>
                      {inc.id}: {inc.type}
                    </span>
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}
        </Map>
      </APIProvider>

      {/* Map Control Buttons overlay */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-20">
        <button
          onClick={() => setZoom((z) => Math.min(z + 1, 20))}
          className="w-10 h-10 rounded-sm glass-card flex items-center justify-center text-on-surface hover:text-primary-fixed-dim hover:bg-surface-container-highest/50 transition-colors border border-outline-variant/30 active:scale-95 cursor-pointer"
          title="Zoom In"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 1, 1))}
          className="w-10 h-10 rounded-sm glass-card flex items-center justify-center text-on-surface hover:text-primary-fixed-dim hover:bg-surface-container-highest/50 transition-colors border border-outline-variant/30 active:scale-95 cursor-pointer"
          title="Zoom Out"
        >
          <span className="material-symbols-outlined">remove</span>
        </button>
        {liveLocation && (
          <button
            onClick={() => setCenter(liveLocation)}
            className="w-10 h-10 rounded-sm glass-card flex items-center justify-center text-secondary hover:bg-surface-container-highest/50 transition-colors border border-secondary/30 mt-2 active:scale-95 cursor-pointer"
            title="Recenter to Live Location"
          >
            <span className="material-symbols-outlined">my_location</span>
          </button>
        )}
      </div>

      {/* Real-time GPS Telemetry Panel */}
      <div className="absolute top-4 right-4 z-20 w-80 glass-panel border border-outline-variant/30 p-4 rounded-sm flex flex-col gap-3 font-[var(--font-geist)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary-fixed-dim animate-pulse">
              satellite_alt
            </span>
            <span className="text-[12px] font-bold text-primary-fixed-dim uppercase tracking-wider">
              GPS Telemetry System
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${geoError ? 'bg-error animate-pulse' : 'bg-secondary animate-pulse'}`} />
            <span className={`text-[9px] font-bold uppercase tracking-wider ${geoError ? 'text-error' : 'text-secondary'}`}>
              {geoError ? "FAULT" : "ACTIVE"}
            </span>
          </div>
        </div>

        {geoError && (
          <div className="border border-error/30 bg-error/10 px-2.5 py-1.5 rounded-sm flex items-start gap-2 text-error text-[10px] uppercase leading-relaxed">
            <span className="material-symbols-outlined text-[14px] mt-0.5 font-bold">warning</span>
            <div>
              <div className="font-bold">SYSTEM WARNING</div>
              <div>{geoError}</div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {/* Latitude */}
          <div className="flex justify-between items-center bg-surface-container-lowest/40 px-2.5 py-1.5 border border-outline-variant/10 rounded-sm">
            <span className="text-[10px] text-outline uppercase">Latitude</span>
            <span className="text-[12px] font-semibold text-on-surface">
              {telemetry.latitude.toFixed(6)}
            </span>
          </div>

          {/* Longitude */}
          <div className="flex justify-between items-center bg-surface-container-lowest/40 px-2.5 py-1.5 border border-outline-variant/10 rounded-sm">
            <span className="text-[10px] text-outline uppercase">Longitude</span>
            <span className="text-[12px] font-semibold text-on-surface">
              {telemetry.longitude.toFixed(6)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Accuracy */}
            <div className="flex flex-col bg-surface-container-lowest/40 p-2 border border-outline-variant/10 rounded-sm">
              <span className="text-[9px] text-outline uppercase mb-0.5">Accuracy</span>
              <span className="text-[12px] font-semibold text-on-surface">
                {telemetry.accuracy !== null ? `${telemetry.accuracy.toFixed(1)} m` : "N/A"}
              </span>
            </div>

            {/* Speed */}
            <div className="flex flex-col bg-surface-container-lowest/40 p-2 border border-outline-variant/10 rounded-sm">
              <span className="text-[9px] text-outline uppercase mb-0.5">Speed</span>
              <span className="text-[12px] font-semibold text-on-surface">
                {telemetry.speed !== null ? `${telemetry.speed.toFixed(1)} km/h` : "N/A"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Heading */}
            <div className="flex flex-col bg-surface-container-lowest/40 p-2 border border-outline-variant/10 rounded-sm">
              <span className="text-[9px] text-outline uppercase mb-0.5">Heading</span>
              <span className="text-[12px] font-semibold text-on-surface">
                {telemetry.heading !== null ? `${telemetry.heading.toFixed(0)}°` : "N/A"}
              </span>
            </div>

            {/* Altitude */}
            <div className="flex flex-col bg-surface-container-lowest/40 p-2 border border-outline-variant/10 rounded-sm">
              <span className="text-[9px] text-outline uppercase mb-0.5">Altitude</span>
              <span className="text-[12px] font-semibold text-on-surface">
                {telemetry.altitude !== null ? `${telemetry.altitude.toFixed(1)} m` : "N/A"}
              </span>
            </div>
          </div>

          {/* Last Updated */}
          <div className="flex justify-between items-center bg-surface-container-lowest/40 px-2.5 py-1.5 border border-outline-variant/10 rounded-sm">
            <span className="text-[10px] text-outline uppercase">Last Updated</span>
            <span className="text-[11px] font-semibold text-on-surface text-right">
              {telemetry.lastUpdated}
            </span>
          </div>
        </div>

        {/* Auto Follow Control */}
        <div className="border-t border-outline-variant/20 pt-3 flex items-center justify-between">
          <span className="text-[10px] text-outline uppercase tracking-wider">Auto-Follow Map</span>
          <button
            onClick={() => setAutoFollow(!autoFollow)}
            className={`px-3 py-1 text-[10px] font-bold rounded-sm border uppercase transition-all duration-200 active:scale-95 flex items-center gap-1 cursor-pointer ${
              autoFollow
                ? "bg-secondary/15 border-secondary text-secondary shadow-[0_0_8px_rgba(68,221,193,0.3)]"
                : "bg-surface-container-highest/30 border-outline-variant text-outline"
            }`}
          >
            <span className="material-symbols-outlined text-[12px]">
              {autoFollow ? "gps_fixed" : "gps_not_fixed"}
            </span>
            {autoFollow ? "ON" : "OFF"}
          </button>
        </div>
      </div>
    </div>
  );
}
