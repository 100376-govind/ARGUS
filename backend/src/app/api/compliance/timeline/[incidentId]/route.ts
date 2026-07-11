import { NextRequest } from "next/server";
import { complianceController } from "@/presentation/controllers/compliance.controller";
import { withErrorCatching } from "@/presentation/middleware/global-exception-handler";

export const GET = withErrorCatching(async (req: NextRequest, context: any) => {
  return await complianceController.getTimeline(req, context);
});
