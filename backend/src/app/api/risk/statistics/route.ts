import { NextRequest } from "next/server";
import { riskController } from "@/presentation/controllers/risk.controller";
import { withErrorCatching } from "@/presentation/middleware/global-exception-handler";

export const GET = withErrorCatching(async (req: NextRequest) => {
  return await riskController.getStatistics(req);
});
