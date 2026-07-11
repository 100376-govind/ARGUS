import { NextRequest } from "next/server";
import { protocolZeroController } from "@/presentation/controllers/protocol-zero.controller";
import { withErrorCatching } from "@/presentation/middleware/global-exception-handler";

export const POST = withErrorCatching(async (req: NextRequest) => {
  return await protocolZeroController.reject(req);
});
