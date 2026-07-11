import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { dataDispatcherService } from "@/shared/container";
import { incidentCreateTextSchema } from "@/shared/validation/incident";

export const POST = withHandler(async (req: NextRequest) => {
  const body = await req.json();
  const validated = incidentCreateTextSchema.parse(body);

  const incident = await dataDispatcherService.dispatchText(
    validated.rawContent,
    validated.reporter,
    validated.metadata,
    validated.tags
  );

  return NextResponse.json({ success: true, data: incident }, { status: 201 });
});
