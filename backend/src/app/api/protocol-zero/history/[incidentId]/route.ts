import { NextRequest } from "next/server";
import { protocolZeroController } from "@/presentation/controllers/protocol-zero.controller";
import { withErrorCatching } from "@/presentation/middleware/global-exception-handler";

export const GET = withErrorCatching(async (req: NextRequest, context: any) => {
  return await protocolZeroController.getHistory(req, context);
});
