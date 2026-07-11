import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { dataDispatcherService } from "@/shared/container";
import { incidentCreateWebhookSchema as webhookPayloadSchema } from "@/shared/validation/incident";


export const POST = withHandler(async (req: NextRequest) => {
  const body = await req.json();
  const validated = webhookPayloadSchema.parse(body);

  const incident = await dataDispatcherService.dispatchWebhook(
    validated.source,
    validated.payload
  );

  return NextResponse.json({ success: true, data: incident }, { status: 201 });
});
