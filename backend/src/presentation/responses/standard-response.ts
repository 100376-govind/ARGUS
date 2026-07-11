import { NextResponse } from "next/server";

export interface StandardResponsePayload<T = any> {
  success: boolean;
  message: string;
  timestamp: string;
  requestId: string;
  data?: T;
  errors?: any[];
  metadata?: Record<string, any>;
}

export class StandardResponse {
  /**
   * Helper to create a unified success response.
   */
  public static success<T>(
    data: T,
    message: string = "Request completed successfully",
    statusCode: number = 200,
    metadata?: Record<string, any>,
    requestId?: string
  ): NextResponse<StandardResponsePayload<T>> {
    const trackingId = requestId || `req-${Math.random().toString(36).substring(2, 11)}`;
    return NextResponse.json(
      {
        success: true,
        message,
        timestamp: new Date().toISOString(),
        requestId: trackingId,
        data,
        metadata,
      },
      { status: statusCode }
    );
  }

  /**
   * Helper to create a unified error response.
   */
  public static error(
    errors: any[],
    message: string = "Request processing failed",
    statusCode: number = 400,
    errorCode?: string,
    requestId?: string
  ): NextResponse<StandardResponsePayload<null>> {
    const trackingId = requestId || `req-${Math.random().toString(36).substring(2, 11)}`;
    return NextResponse.json(
      {
        success: false,
        message,
        timestamp: new Date().toISOString(),
        requestId: trackingId,
        errors: errors.map((err) => {
          if (typeof err === "string") {
            return { code: errorCode || "API_ERROR", message: err };
          }
          return err;
        }),
      },
      { status: statusCode }
    );
  }
}
