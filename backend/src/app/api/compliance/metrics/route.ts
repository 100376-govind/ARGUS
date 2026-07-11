import { NextRequest } from "next/server";
import { ComplianceMetrics } from "@/compliance-auditor/services/compliance-metrics";
import { withErrorCatching } from "@/presentation/middleware/global-exception-handler";
import { StandardResponse } from "@/presentation/responses/standard-response";

export const GET = withErrorCatching(async (req: NextRequest) => {
  const metrics = ComplianceMetrics.getSnapshot();
  return StandardResponse.success(metrics, "Metrics snapshot retrieved successfully");
});
