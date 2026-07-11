"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import incidentsData from "@/data/incidents.json";
import activityData from "@/data/activity.json";
import type { ActivityEntry, Incident } from "@/types";

const incidents = incidentsData as Incident[];

export interface SimIncidentCard {
  tempId: string;
  id: string;
  type: string;
  priority: string;
  severity: string;
  confidence: number;
  dispatcherStatus: "Receiving..." | "Understanding..." | "Extracting Entities..." | "Normalizing..." | "Creating Incident..." | "Completed" | "Pending";
  riskStatus: "Waiting..." | "Analyzing Threat..." | "Calculating Severity..." | "Calculating Priority..." | "Generating Reasoning..." | "Completed";
  rawContent: string;
  reasoning: string;
  timestamp: string;
  glowColor: string;
  visibleText: string;
  coordinates?: { lat: number; lng: number };
}

const DEFAULT_CENTER = { lat: 22.557827, lng: 88.496820 };

const simulationIncidentsData = incidents.map((inc) => ({
  id: inc.id,
  rawContent: inc.description || `${inc.type} reported in ${inc.location}. Severity: ${inc.severity || "Medium"}.`,
  type: inc.type,
  glowColor: inc.priority === "critical" ? "red" : inc.priority === "high" ? "orange" : "yellow",
  priority: inc.priority,
  severity: inc.severity || "medium",
  coordinates: inc.coordinates || { lat: 22.57264, lng: 88.36389 },
  assignedAgency: inc.responseTeam,
  reportSource: inc.commander || "Citizen"
}));

interface LiveDemoContextProps {
  isSimulating: boolean;
  simTimeline: Array<{ time: string; event: string }>;
  simCards: SimIncidentCard[];
  setSimCards: React.Dispatch<React.SetStateAction<SimIncidentCard[]>>;
  simMessage: string | null;
  liveIncidents: any[];
  setLiveIncidents: React.Dispatch<React.SetStateAction<any[]>>;
  activities: ActivityEntry[];
  setActivities: React.Dispatch<React.SetStateAction<ActivityEntry[]>>;
  startLiveSimulation: () => void;
  stopLiveSimulation: () => void;
  coordinates: { lat: number; lng: number };
  locationStatus: string;
  lastUpdatedTime: string;
}

const LiveDemoContext = createContext<LiveDemoContextProps | undefined>(undefined);

export function LiveDemoProvider({ children }: { children: React.ReactNode }) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simTimeline, setSimTimeline] = useState<Array<{ time: string; event: string }>>([]);
  const [simCards, setSimCards] = useState<SimIncidentCard[]>([]);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [liveIncidents, setLiveIncidents] = useState<any[]>(incidents);
  const [activities, setActivities] = useState<ActivityEntry[]>(activityData as ActivityEntry[]);

  const [coordinates, setCoordinates] = useState(DEFAULT_CENTER);
  const [locationStatus, setLocationStatus] = useState("Live location unavailable");
  const [lastUpdatedTime, setLastUpdatedTime] = useState("");

  const watchIdRef = useRef<number | null>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const simulationTimeRef = useRef<number>(0);

  const prependActivity = (level: "sys" | "warn" | "act" | "log", message: string) => {
    setActivities((prev) => [
      {
        id: `act-${Math.random().toString(36).substring(2, 9)}`,
        level,
        message,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
  };

  // Start GPS tracking on mount — always, regardless of simulation state
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationStatus("Live location unavailable");
      return;
    }

    // First try a one-shot getCurrentPosition for an immediate reading
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoordinates({ lat, lng });
        setLocationStatus("LIVE");
        setLastUpdatedTime(new Date().toLocaleTimeString());
      },
      (err) => {
        console.warn("getCurrentPosition failed:", err.message);
        setLocationStatus("Live location unavailable");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Then start continuous tracking via watchPosition
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoordinates({ lat, lng });
        setLocationStatus("LIVE");
        setLastUpdatedTime(new Date().toLocaleTimeString());
      },
      (err) => {
        console.warn("watchPosition failed:", err.message);
        // Keep "LIVE" if we already got a fix, only set unavailable if we never got one
        setLocationStatus((prev) => prev === "LIVE" ? "LIVE" : "Live location unavailable");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const startLiveSimulation = () => {
    if (isSimulating) return;

    setIsSimulating(true);
    setSimTimeline([{ time: "00:00", event: "Simulation Started" }]);
    setSimCards([]);
    setLiveIncidents([]);
    setActivities(activityData as ActivityEntry[]);
    simulationTimeRef.current = 0;
    prependActivity("sys", "Multi-Incident Live Simulation started");

    simulationIntervalRef.current = setInterval(async () => {
      simulationTimeRef.current += 1.5;
      const t = simulationTimeRef.current;
      const index = Math.floor(t / 1.5) - 1;

      if (index < simulationIncidentsData.length) {
        const timeStr = `00:${String(Math.floor(t)).padStart(2, "0")}`;
        setSimTimeline((prev) => [...prev, { time: timeStr, event: `Incident ${index + 1} Received` }]);
        triggerSimulatedIncident(index);
      } else {
        const timeStr = `00:${String(Math.floor(t)).padStart(2, "0")}`;
        setSimTimeline((prev) => [...prev, { time: timeStr, event: "Simulation Completed" }]);
        prependActivity("sys", "Simulation completed successfully");
        if (simulationIntervalRef.current) {
          clearInterval(simulationIntervalRef.current);
        }
      }
    }, 1500);
  };

  const stopLiveSimulation = () => {
    setIsSimulating(false);
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }
    setSimCards([]);
    setSimTimeline([]);
    setLiveIncidents(incidents);
    prependActivity("sys", "Live simulation manually stopped by operator");
    if (watchIdRef.current !== null && typeof window !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const triggerSimulatedIncident = async (index: number) => {
    const rawData = simulationIncidentsData[index];
    if (!rawData) return;

    const tempId = `TEMP-${index + 1}`;
    prependActivity("log", `Incoming Signal Detected: ${rawData.type}`);

    // Create a draft Card
    const newCard: SimIncidentCard = {
      tempId,
      id: "PENDING",
      type: rawData.type,
      priority: "pending",
      severity: "pending",
      confidence: 0,
      dispatcherStatus: "Receiving...",
      riskStatus: "Waiting...",
      rawContent: rawData.rawContent,
      reasoning: "",
      glowColor: rawData.glowColor,
      timestamp: new Date().toLocaleTimeString(),
      visibleText: "",
      coordinates: rawData.coordinates,
    };

    setSimCards((prev) => [newCard, ...prev]);

    // Typewriter effect
    let textLength = 0;
    const typeWriterInterval = setInterval(() => {
      textLength += 3;
      setSimCards((prev) =>
        prev.map((c) =>
          c.tempId === tempId
            ? { ...c, visibleText: rawData.rawContent.substring(0, textLength) }
            : c
        )
      );

      if (textLength >= rawData.rawContent.length) {
        clearInterval(typeWriterInterval);
      }
    }, 30);

    // Dispatcher status steps
    const steps: Array<SimIncidentCard["dispatcherStatus"]> = [
      "Understanding...",
      "Extracting Entities...",
      "Normalizing...",
      "Creating Incident...",
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((res) => setTimeout(res, 400));
      setSimCards((prev) =>
        prev.map((c) => (c.tempId === tempId ? { ...c, dispatcherStatus: steps[i]! } : c))
      );
    }

    let incidentId = `INC-${Math.floor(1000 + Math.random() * 9000)}`;
    let normalizedType = rawData.type;

    try {
      const dispatchRes = await fetch("http://localhost:3001/api/incidents/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawContent: rawData.rawContent,
          reporter: {
            name: "Tactical Live Simulation Sensor",
            role: "sensor",
          },
        }),
      });

      if (dispatchRes.ok) {
        const result = await dispatchRes.json();
        incidentId = result.data.id;
        normalizedType = result.data.incidentType;
      }
    } catch (err: any) {
      console.warn("Live Demo fallback:", err.message);
    }

    setSimCards((prev) =>
      prev.map((c) =>
        c.tempId === tempId
          ? { ...c, id: incidentId, type: normalizedType, dispatcherStatus: "Completed", riskStatus: "Analyzing Threat..." }
          : c
      )
    );
    prependActivity("act", `Dispatcher completed processing for ${incidentId}`);

    // Run Risk Evaluator steps
    const riskSteps: Array<SimIncidentCard["riskStatus"]> = [
      "Calculating Severity...",
      "Calculating Priority...",
      "Generating Reasoning...",
    ];

    for (let i = 0; i < riskSteps.length; i++) {
      await new Promise((res) => setTimeout(res, 400));
      setSimCards((prev) =>
        prev.map((c) => (c.tempId === tempId ? { ...c, riskStatus: riskSteps[i]! } : c))
      );
    }

    let priorityVal = rawData.priority || "low";
    let severityVal = rawData.severity || "low";
    let reasoningVal = `Incident assessment completed. Threat level: ${severityVal.toUpperCase()}.`;

    try {
      const evaluateRes = await fetch("http://localhost:3001/api/risk/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer mock-admin-token",
        },
        body: JSON.stringify({ incidentId }),
      });

      if (evaluateRes.ok) {
        const result = await evaluateRes.json();
        const assessment = result.data;
        priorityVal = assessment.priority.toLowerCase();
        severityVal = assessment.severity.toLowerCase();
        reasoningVal = assessment.reasoning;
      }
    } catch (err: any) {
      console.warn("Risk Evaluator fallback:", err.message);
      if (rawData.priority === "critical") {
        priorityVal = "critical"; severityVal = "critical";
        reasoningVal = `${rawData.type} emergency. Critical warning signs detected.`;
      } else if (rawData.priority === "high") {
        priorityVal = "high"; severityVal = "high";
        reasoningVal = `${rawData.type} report. High response priority.`;
      }
    }

    setSimCards((prev) =>
      prev.map((c) =>
        c.tempId === tempId
          ? {
              ...c,
              priority: priorityVal,
              severity: severityVal,
              reasoning: reasoningVal,
              riskStatus: "Completed",
            }
          : c
      )
    );

    prependActivity("sys", `Risk Evaluation completed for ${incidentId} (${priorityVal.toUpperCase()})`);
    prependActivity("act", `Priority Assigned: ${priorityVal.toUpperCase()} • Shared Memory Updated`);

    // Place marker on map
    const newMarker = {
      id: incidentId,
      type: normalizedType,
      priority: priorityVal,
      coordinates: rawData.coordinates,
    };

    setLiveIncidents((prev) => [...prev, newMarker]);
  };

  return (
    <LiveDemoContext.Provider
      value={{
        isSimulating,
        simTimeline,
        simCards,
        setSimCards,
        simMessage,
        liveIncidents,
        setLiveIncidents,
        activities,
        setActivities,
        startLiveSimulation,
        stopLiveSimulation,
        coordinates,
        locationStatus,
        lastUpdatedTime
      }}
    >
      {children}
    </LiveDemoContext.Provider>
  );
}

export function useLiveDemo() {
  const context = useContext(LiveDemoContext);
  if (context === undefined) {
    throw new Error("useLiveDemo must be used within a LiveDemoProvider");
  }
  return context;
}
