"use client";

import React, { useEffect, useState } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";

interface MarkerItem {
  id: string;
  name: string;
  type: "Ambulance" | "FireTruck" | "Police" | "Shelter" | "Hospital" | "Incident";
  lat: number;
  lng: number;
  pulse?: boolean;
}

interface MapProps {
  markers: MarkerItem[];
  routePath?: google.maps.LatLngLiteral[];
}

const DEFAULT_CENTER = { lat: 22.557827, lng: 88.496820 };

function MapCenterController({ center }: { center: google.maps.LatLngLiteral }) {
  const map = useMap();
  useEffect(() => {
    if (map && center) {
      map.panTo(center);
    }
  }, [map, center]);
  return null;
}

function RoutePolyline({ path }: { path?: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !path || path.length < 2) return;

    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#00DAF3",
      strokeOpacity: 0.85,
      strokeWeight: 4,
      map,
    });

    return () => {
      polyline.setMap(null);
    };
  }, [map, path]);
  return null;
}

export default function ResourceMapView({ markers, routePath }: MapProps) {
  const [center, setCenter] = useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "";

  useEffect(() => {
    if (markers.length > 0) {
      const incident = markers.find(m => m.type === "Incident");
      if (incident) {
        setCenter({ lat: incident.lat, lng: incident.lng });
      } else {
        setCenter({ lat: markers[0].lat, lng: markers[0].lng });
      }
    }
  }, [markers]);

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
    <div className="absolute inset-0 w-full h-full">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={13}
          mapId={mapId || undefined}
          disableDefaultUI={true}
          gestureHandling="greedy"
          style={{ width: "100%", height: "100%" }}
        >
          <MapCenterController center={center} />
          <RoutePolyline path={routePath} />

          {markers.map((marker) => {
            const isIncident = marker.type === "Incident";
            const iconName = 
              marker.type === "Ambulance" ? "medical_services" :
              marker.type === "FireTruck" ? "local_fire_department" :
              marker.type === "Police" ? "local_police" :
              marker.type === "Hospital" ? "emergency" :
              marker.type === "Shelter" ? "home" : "warning";

            const markerColor = 
              marker.type === "Incident" ? "bg-red-500 text-white" :
              marker.type === "Hospital" ? "bg-purple-600 text-white" :
              marker.type === "Shelter" ? "bg-green-600 text-white" : "bg-cyan-500 text-black";

            return (
              <AdvancedMarker key={marker.id} position={{ lat: marker.lat, lng: marker.lng }}>
                <div className="relative flex flex-col items-center group cursor-pointer">
                  {marker.pulse && (
                    <div className="absolute w-10 h-10 rounded-full border border-primary-fixed-dim bg-primary-fixed-dim/15 animate-ping" />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 border-surface shadow-lg ${markerColor}`}>
                    <span className="material-symbols-outlined text-[18px]">{iconName}</span>
                  </div>
                  <div className="absolute -top-7 bg-surface-container-lowest/95 border border-outline-variant/30 px-2 py-0.5 rounded-sm font-[var(--font-geist)] text-[9px] font-semibold text-on-surface whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 transition-opacity uppercase z-50">
                    {marker.name}
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}
        </Map>
      </APIProvider>
    </div>
  );
}
