import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { dataDispatcherService } from "@/shared/container";
import { AppError } from "@/shared/errors/app-error";
import { incidentUpdateSchema } from "@/shared/validation/incident";

/**
 * GET /api/incidents/[id] — Get a single incident by ID.
 */
export const GET = withHandler(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;

  const incident = await dataDispatcherService.getById(id);

  if (!incident) {
    throw AppError.notFound("Incident", id);
  }

  return NextResponse.json({ success: true, data: incident });
});

/**
 * PATCH /api/incidents/[id] — Update an incident's mutable fields.
 */
export const PATCH = withHandler(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const body = await req.json();
  const validated = incidentUpdateSchema.parse(body);

  const existing = await dataDispatcherService.getById(id);
  if (!existing) {
    throw AppError.notFound("Incident", id);
  }

  const changedBy = req.headers.get("x-changed-by") || "api:manual";
  const updated = await dataDispatcherService.update(id, validated, changedBy);

  return NextResponse.json({ success: true, data: updated });
});

/**
 * DELETE /api/incidents/[id] — Soft-delete an incident.
 */
export const DELETE = withHandler(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;

  const existing = await dataDispatcherService.getById(id);
  if (!existing) {
    throw AppError.notFound("Incident", id);
  }

  await dataDispatcherService.remove(id);

  return NextResponse.json({ success: true, message: `Incident ${id} marked for deletion` });
});
