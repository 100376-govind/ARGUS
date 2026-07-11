import { z } from "zod";

/**
 * Validator schema for fetching resource allocation data by incident ID.
 */
export const GetAllocationParamsSchema = z.object({
  incidentId: z.string().min(1, "incidentId route parameter is required"),
});
