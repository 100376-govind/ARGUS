"use client";

import React, { useEffect, useState } from "react";
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

interface MarkerItem {
  id: string;
  name: string;
  type: "Ambulance" | "FireTruck" | "Police" | "Shelter" | "Hospital" | "Incident";
  lat: number;
  lng: number;
  pulse?: boolean;
}

interface RoutePath {
  path: google.maps.LatLngLiteral[];
  color?: string;
  glowColor?: string;
  label?: string;
}

interface MapProps {
  markers: MarkerItem[];
  routePath?: google.maps.LatLngLiteral[];
  routes?: RoutePath[];
  onHospitalsFound?: (hospitals: any[]) => void;
  onSheltersFound?: (shelters: any[]) => void;
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

function PlacesSearchController({
  incidentCentroid,
  onHospitalsFound,
  onSheltersFound,
}: {
  incidentCentroid?: { lat: number; lng: number };
  onHospitalsFound?: (hospitals: any[]) => void;
  onSheltersFound?: (shelters: any[]) => void;
}) {
  const map = useMap();
  const placesLibrary = useMapsLibrary("places");

  // Use a string key to avoid re-firing when same coords are passed as a new object
  const centroidKey = incidentCentroid ? `${incidentCentroid.lat},${incidentCentroid.lng}` : "";

  useEffect(() => {
    if (!map || !placesLibrary || !incidentCentroid || !onHospitalsFound || !onSheltersFound) return;

    const service = new placesLibrary.PlacesService(map);

    // Query hospitals
    service.nearbySearch(
      {
        location: incidentCentroid,
        radius: 8000,
        type: "hospital",
      },
      (results, status) => {
        if (status === placesLibrary.PlacesServiceStatus.OK && results) {
          const hospitals = results.slice(0, 2).map((place, idx) => ({
            resourceId: `dynamic-hosp-${idx}-${place.place_id || idx}`,
            name: place.name || "Nearby Hospital",
            availableBeds: Math.floor(Math.random() * 20) + 5,
            icuAvailable: Math.random() > 0.5,
            lat: place.geometry?.location?.lat(),
            lng: place.geometry?.location?.lng(),
          }));
          onHospitalsFound(hospitals);
        }
      }
    );

    // Query shelters (community halls, community centers, schools, etc.)
    service.nearbySearch(
      {
        location: incidentCentroid,
        radius: 8000,
        keyword: "community hall shelter community center school",
      },
      (results, status) => {
        if (status === placesLibrary.PlacesServiceStatus.OK && results) {
          const shelters = results.slice(0, 2).map((place, idx) => ({
            resourceId: `dynamic-shelt-${idx}-${place.place_id || idx}`,
            name: place.name || "Local Shelter",
            remainingCapacity: Math.floor(Math.random() * 150) + 30,
            lat: place.geometry?.location?.lat(),
            lng: place.geometry?.location?.lng(),
          }));
          onSheltersFound(shelters);
        }
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, placesLibrary, centroidKey]);

  return null;
}

function DirectionsRoute({ path, color = "#00DAF3", glowColor = "#00B4D8" }: { path?: google.maps.LatLngLiteral[]; color?: string; glowColor?: string }) {
  const map = useMap();
  const routesLibrary = useMapsLibrary("routes");

  // Stabilize dependency
  const pathKey = path ? path.map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join("|") : "";

  useEffect(() => {
    if (!map || !routesLibrary || !path || path.length < 2) return;

    const directionsService = new routesLibrary.DirectionsService();
    const directionsRenderer = new routesLibrary.DirectionsRenderer({
      map,
      suppressMarkers: true, // We already have custom markers
      polylineOptions: {
        strokeColor: color,
        strokeOpacity: 0,
        strokeWeight: 0,
      },
    });

    // Build the origin, destination, and optional waypoints
    const origin = path[0];
    const destination = path[path.length - 1];
    const waypoints = path.slice(1, -1).map(wp => ({
      location: wp,
      stopover: false,
    }));

    directionsService.route(
      {
        origin,
        destination,
        waypoints: waypoints.length > 0 ? waypoints : undefined,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          // Don't use default renderer polyline — draw our own styled one
          directionsRenderer.setDirections(result);

          // Override: draw a custom styled polyline over the directions path
          const route = result.routes[0];
          if (route) {
            const fullPath: google.maps.LatLng[] = [];
            route.legs.forEach(leg => {
              leg.steps.forEach(step => {
                step.path.forEach(point => fullPath.push(point));
              });
            });

            // Glow/shadow layer (wider, semi-transparent)
            const glowPolyline = new google.maps.Polyline({
              path: fullPath,
              geodesic: true,
              strokeColor: glowColor,
              strokeOpacity: 0.25,
              strokeWeight: 10,
              map,
            });

            // Main route line
            const mainPolyline = new google.maps.Polyline({
              path: fullPath,
              geodesic: true,
              strokeColor: color,
              strokeOpacity: 0.9,
              strokeWeight: 4,
              map,
            });

            // Store polylines for cleanup
            (directionsRenderer as any).__customPolylines = [glowPolyline, mainPolyline];
          }
        } else {
          // Fallback: draw straight line if Directions API fails
          const fallbackPolyline = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: color,
            strokeOpacity: 0.7,
            strokeWeight: 3,
            strokePattern: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.7, scale: 3 }, offset: "0", repeat: "12px" }] as any,
            map,
          });
          (directionsRenderer as any).__customPolylines = [fallbackPolyline];
        }
      }
    );

    return () => {
      // Cleanup custom polylines
      const polylines = (directionsRenderer as any).__customPolylines;
      if (polylines) {
        polylines.forEach((p: google.maps.Polyline) => p.setMap(null));
      }
      directionsRenderer.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routesLibrary, pathKey]);

  return null;
}

export default function ResourceMapView({ markers, routePath, routes, onHospitalsFound, onSheltersFound }: MapProps) {
  const [center, setCenter] = useState<google.maps.LatLngLiteral>(DEFAULT_CENTER);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "";

  const incidentMarker = markers.find(m => m.type === "Incident");

  // Stabilize dependency to avoid array-size mismatch warnings
  const markersKey = markers.map(m => `${m.id}`).join(",");

  useEffect(() => {
    if (markers.length > 0) {
      if (incidentMarker) {
        setCenter({ lat: incidentMarker.lat, lng: incidentMarker.lng });
      } else {
        setCenter({ lat: markers[0].lat, lng: markers[0].lng });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey]);

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
      <APIProvider apiKey={apiKey} libraries={["places", "routes"]}>
        <Map
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={13}
          mapId={mapId || undefined}
          disableDefaultUI={true}
          gestureHandling="greedy"
          style={{ width: "100%", height: "100%" }}
        >
          <MapCenterController center={center} />

          {/* Render multi-route directions (preferred) */}
          {routes && routes.map((route, idx) => (
            <DirectionsRoute
              key={`route-${idx}-${route.path.map(p => `${p.lat},${p.lng}`).join("|")}`}
              path={route.path}
              color={route.color}
              glowColor={route.glowColor}
            />
          ))}

          {/* Fallback: single legacy routePath */}
          {!routes && routePath && <DirectionsRoute path={routePath} />}

          <PlacesSearchController
            incidentCentroid={incidentMarker ? { lat: incidentMarker.lat, lng: incidentMarker.lng } : undefined}
            onHospitalsFound={onHospitalsFound}
            onSheltersFound={onSheltersFound}
          />

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
