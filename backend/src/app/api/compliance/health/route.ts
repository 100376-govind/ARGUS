import { NextRequest } from "next/server";
import { ComplianceHealth } from "@/compliance-auditor/services/compliance-health";
import { withErrorCatching } from "@/presentation/middleware/global-exception-handler";
import { StandardResponse } from "@/presentation/responses/standard-response";

export const GET = withErrorCatching(async (req: NextRequest) => {
  const health = await ComplianceHealth.checkHealth();
  return StandardResponse.success(health, "Health status retrieved successfully");
});
