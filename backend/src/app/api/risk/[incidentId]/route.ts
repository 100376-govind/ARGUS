import { NextRequest } from "next/server";
import { riskController } from "@/presentation/controllers/risk.controller";
import { withErrorCatching } from "@/presentation/middleware/global-exception-handler";

export const GET = withErrorCatching(async (req: NextRequest, context: any) => {
  return await riskController.getByIncidentId(req, context);
});

export const PATCH = withErrorCatching(async (req: NextRequest, context: any) => {
  return await riskController.update(req, context);
});
