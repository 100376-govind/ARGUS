import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { dataDispatcherService } from "@/shared/container";

/**
 * GET /api/incidents — List all incidents with optional filters.
 * Query params: status, incidentType, source, limit, offset
 */
export const GET = withHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  const filters = {
    status: searchParams.get("status") || undefined,
    incidentType: searchParams.get("incidentType") || undefined,
    source: searchParams.get("source") || undefined,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50,
    offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0,
  };

  const incidents = await dataDispatcherService.list(filters);

  return NextResponse.json({
    success: true,
    data: incidents,
    pagination: {
      limit: filters.limit,
      offset: filters.offset,
      count: incidents.length,
    },
  });
});
