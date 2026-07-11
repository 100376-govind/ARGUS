import { NextRequest, NextResponse } from "next/server";
import { metrics } from "@/infrastructure/monitoring/metrics";
import { riskEvaluationQueue } from "@/infrastructure/queue/risk-evaluation-queue";
import { withErrorCatching } from "@/presentation/middleware/global-exception-handler";
import { AuthenticationHooks } from "@/presentation/middleware/auth.hooks";
import { StandardResponse } from "@/presentation/responses/standard-response";

export const GET = withErrorCatching(async (req: NextRequest) => {
  const user = await AuthenticationHooks.authenticate(req);
  AuthenticationHooks.authorize(user, ["Commander", "Admin", "Dispatcher"]);

  const latencyMetrics = metrics.getSummary();
  const queueStats = riskEvaluationQueue.getStats();

  const diagnostics = {
    timestamp: new Date().toISOString(),
    queue: queueStats,
    latency: latencyMetrics,
  };

  return StandardResponse.success(diagnostics, "SRE Diagnostics and Latency metrics compiled");
});
