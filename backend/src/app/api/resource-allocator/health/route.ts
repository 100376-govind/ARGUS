import { NextRequest, NextResponse } from "next/server";
import { performResourceAllocatorHealthCheck } from "@/resource-allocator/services/resource-allocator-health.service";
import { withErrorCatching } from "@/presentation/middleware/global-exception-handler";
import { StandardResponse } from "@/presentation/responses/standard-response";

export const GET = withErrorCatching(async (req: NextRequest) => {
  const healthReport = await performResourceAllocatorHealthCheck();
  const statusCode = healthReport.status === "critical" ? 503 : 200;
  return StandardResponse.success(healthReport, "Resource Allocator health check complete", statusCode);
});
