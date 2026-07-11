import { NextRequest } from "next/server";
import { z } from "zod";

export class RequestValidator {
  /**
   * Helper to parse and validate request body JSON against a Zod schema.
   * Throws ZodError on failure.
   */
  public static async validateBody<T>(req: NextRequest, schema: z.ZodSchema<T>): Promise<T> {
    try {
      // Clone req to ensure multiple body reads don't break
      const reqClone = req.clone();
      const body = await reqClone.json();
      return schema.parse(body);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        throw err;
      }
      throw new z.ZodError([
        {
          code: "custom",
          path: ["body"],
          message: "Request body is missing or is not valid JSON",
        },
      ]);
    }
  }

  /**
   * Helper to parse and validate URL query search parameters against a Zod schema.
   */
  public static validateQuery<T>(req: NextRequest, schema: z.ZodSchema<T>): T {
    const { searchParams } = new URL(req.url);
    const paramsObj: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      paramsObj[key] = value;
    });

    try {
      return schema.parse(paramsObj);
    } catch (err: any) {
      throw err;
    }
  }

  /**
   * Helper to validate route parameter context objects against a Zod schema.
   */
  public static validateParams<T>(context: any, schema: z.ZodSchema<T>): T {
    const params = context?.params || {};
    try {
      return schema.parse(params);
    } catch (err: any) {
      throw err;
    }
  }
}
