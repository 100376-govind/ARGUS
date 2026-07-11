import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma-client";
import { riskEvaluationQueue } from "@/infrastructure/queue/risk-evaluation-queue";
import { withErrorCatching } from "@/presentation/middleware/global-exception-handler";
import { AuthenticationHooks } from "@/presentation/middleware/auth.hooks";
import { StandardResponse } from "@/presentation/responses/standard-response";
import os from "os";

export const GET = withErrorCatching(async (req: NextRequest) => {
  // Authenticate user
  const user = await AuthenticationHooks.authenticate(req);
  AuthenticationHooks.authorize(user, ["Commander", "Admin", "Dispatcher"]);

  // Fetch real incidents stats from PostgreSQL
  let dbIncidents: any[] = [];
  try {
    dbIncidents = await prisma.incident.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("Failed to query database incidents in agents status:", err);
  }

  const pendingIncidents = dbIncidents.filter(i => i.status === "pending");
  const inProgressIncidents = dbIncidents.filter(i => i.status === "in-progress");
  const resolvedIncidents = dbIncidents.filter(i => i.status === "resolved" || i.status === "completed");

  // Gather real system metrics to simulate agent loads
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
  
  const loadAvg = os.loadavg();
  const cpuPercent = Math.min(100, Math.round((loadAvg[0] / os.cpus().length) * 100));

  // Get Queue stats for Risk Evaluator
  const queueStats = riskEvaluationQueue.getStats();
  const activeTasks = queueStats.activeWorkers;
  const waitingTasks = queueStats.queueLength;
  
  const getMem = (offset: number) => Math.max(10, Math.min(95, usedMemPercent + offset));
  const getCpu = (offset: number) => Math.max(5, Math.min(99, cpuPercent + offset));

  const timestamp = new Date().toISOString();

  // Map Data Dispatcher
  const dispatcherActive = pendingIncidents.length > 0;
  const dispatcherLoc = pendingIncidents[0]?.locationName || "None";
  const dispatcherTask = dispatcherActive 
    ? `Ingesting raw reports for ${dispatcherLoc}, normalizing feeds with Gemini.` 
    : "Idle - No Active Tasks";

  // Map Risk Evaluator
  const evaluatorActive = activeTasks > 0 || inProgressIncidents.length > 0;
  const evaluatorLoc = inProgressIncidents[0]?.locationName || pendingIncidents[0]?.locationName || "None";
  const evaluatorTask = evaluatorActive
    ? `Evaluating severity and calculating threat priority for ${evaluatorLoc}.`
    : "Idle - No Active Tasks";

  // Map Field Validator
  const validatorActive = inProgressIncidents.length > 0;
  const validatorLoc = inProgressIncidents[0]?.locationName || "None";
  const validatorTask = validatorActive
    ? `Cross-referencing satellite, telemetry, and camera feeds to validate incident in ${validatorLoc}.`
    : "Idle - No Active Tasks";

  // Map Resource Allocator
  const allocatorActive = inProgressIncidents.length > 0 && dbIncidents.some(i => i.status === "in-progress" || i.status === "dispatched");
  const allocatorLoc = dbIncidents.find(i => i.status === "in-progress" || i.status === "dispatched")?.locationName || "None";
  const allocatorTask = allocatorActive
    ? `Optimizing route ETA and resources allocation for ${allocatorLoc}.`
    : "Idle - No Active Tasks";

  // Map Compliance Auditor
  const auditorActive = dbIncidents.length > 0;
  const auditorLoc = dbIncidents[0]?.locationName || "None";
  const auditorTask = auditorActive
    ? `Auditing lifecycle status and compiling compliance records for ${auditorLoc}.`
    : "Idle - No Active Tasks";

  const agents = [
    {
      id: "AI-001",
      name: "Data Dispatcher",
      status: dispatcherActive ? "Processing" : "Idle",
      confidence: 99,
      currentTask: dispatcherTask,
      activeLocation: dispatcherLoc,
      queueSize: pendingIncidents.length,
      cpu: dispatcherActive ? getCpu(12) : 2,
      memory: dispatcherActive ? getMem(5) : 8,
      processingTime: "450ms",
      lastUpdated: timestamp,
      health: "Healthy",
      icon: "hub"
    },
    {
      id: "AI-002",
      name: "Risk Evaluator",
      status: evaluatorActive ? "Processing" : "Idle",
      confidence: 97,
      currentTask: evaluatorTask,
      activeLocation: evaluatorLoc,
      queueSize: waitingTasks + inProgressIncidents.length,
      cpu: evaluatorActive ? getCpu(35) : 3,
      memory: evaluatorActive ? getMem(20) : 10,
      processingTime: "820ms",
      lastUpdated: timestamp,
      health: "Healthy",
      icon: "shield"
    },
    {
      id: "AI-003",
      name: "Field Validator",
      status: validatorActive ? "Processing" : "Idle",
      confidence: 95,
      currentTask: validatorTask,
      activeLocation: validatorLoc,
      queueSize: inProgressIncidents.length,
      cpu: validatorActive ? getCpu(18) : 1,
      memory: validatorActive ? getMem(12) : 9,
      processingTime: "1.2s",
      lastUpdated: timestamp,
      health: "Healthy",
      icon: "analytics"
    },
    {
      id: "AI-004",
      name: "Resource Allocator",
      status: allocatorActive ? "Processing" : "Idle",
      confidence: 92,
      currentTask: allocatorTask,
      activeLocation: allocatorLoc,
      queueSize: allocatorActive ? 1 : 0,
      cpu: allocatorActive ? getCpu(-10) : 1,
      memory: allocatorActive ? getMem(-15) : 7,
      processingTime: "1.5s",
      lastUpdated: timestamp,
      health: "Healthy",
      icon: "route"
    },
    {
      id: "AI-005",
      name: "Compliance Auditor",
      status: auditorActive ? "Processing" : "Idle",
      confidence: 98,
      currentTask: auditorTask,
      activeLocation: auditorLoc,
      queueSize: resolvedIncidents.length,
      cpu: auditorActive ? getCpu(5) : 2,
      memory: auditorActive ? getMem(8) : 11,
      processingTime: "920ms",
      lastUpdated: timestamp,
      health: "Healthy",
      icon: "verified_user"
    }
  ];

  return StandardResponse.success(agents, "Live agent metrics compiled");
});
