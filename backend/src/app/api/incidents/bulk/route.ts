import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { dataDispatcherService } from "@/shared/container";
import { incidentCreateBulkSchema as incidentBulkSchema } from "@/shared/validation/incident";


export const POST = withHandler(async (req: NextRequest) => {
  const body = await req.json();
  const validated = incidentBulkSchema.parse(body);

  const incidents = await dataDispatcherService.dispatchBulk(validated.incidents);

  return NextResponse.json(
    {
      success: true,
      data: {
        total: validated.incidents.length,
        created: incidents.length,
        failed: validated.incidents.length - incidents.length,
        incidents,
      },
    },
    { status: 201 }
  );
});
