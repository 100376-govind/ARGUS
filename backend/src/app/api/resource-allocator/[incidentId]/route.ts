import { NextRequest } from "next/server";
import { resourceAllocatorApiController } from "@/resource-allocator/controllers/resource-allocator-api.controller";
import { withErrorCatching } from "@/presentation/middleware/global-exception-handler";

export const GET = withErrorCatching(async (req: NextRequest, context: any) => {
  return await resourceAllocatorApiController.getAllocationDetails(req, context);
});
