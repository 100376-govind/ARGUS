import { NextResponse } from "next/server";

/**
 * GET /api/docs — Returns the OpenAPI 3.1 specification for ARGUS Backend.
 */
export async function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "ARGUS Crisis Command Platform — Backend API",
      version: "1.0.0",
      description:
        "AI-powered multi-agent crisis command platform. Receives emergency reports (text, audio, image, video), normalizes them with Gemini AI, stores structured incident data, and broadcasts real-time events.",
      contact: {
        name: "ARGUS Team",
      },
    },
    servers: [
      {
        url: "http://localhost:3001",
        description: "Local development",
      },
    ],
    tags: [
      { name: "Health", description: "System health and readiness checks" },
      { name: "Incidents", description: "Incident CRUD and dispatch operations" },
      { name: "Media", description: "Media upload endpoints (audio, image, video)" },
      { name: "Webhooks", description: "External integration webhook receivers" },
      { name: "Agents", description: "Agent execution chain and shared memory" },
    ],
    paths: {
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "System health check",
          description: "Checks PostgreSQL, Redis, Firebase, and Gemini connectivity. Returns degraded or unhealthy status if any dependency is down.",
          responses: {
            "200": {
              description: "All systems healthy or degraded",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
                      timestamp: { type: "string", format: "date-time" },
                      uptime: { type: "number" },
                      version: { type: "string" },
                      checks: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            service: { type: "string" },
                            status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
                            latencyMs: { type: "number" },
                            error: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "503": { description: "System unhealthy — critical dependency down" },
          },
        },
      },
      "/api/incidents": {
        get: {
          tags: ["Incidents"],
          summary: "List all incidents",
          description: "Returns a paginated list of incidents with optional filters.",
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["pending", "in-progress", "dispatched", "resolved"] } },
            { name: "incidentType", in: "query", schema: { type: "string" } },
            { name: "source", in: "query", schema: { type: "string", enum: ["text", "audio", "image", "video", "webhook", "bulk"] } },
            { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: {
            "200": {
              description: "Paginated incident list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "array", items: { $ref: "#/components/schemas/Incident" } },
                      pagination: {
                        type: "object",
                        properties: {
                          limit: { type: "integer" },
                          offset: { type: "integer" },
                          count: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/incidents/text": {
        post: {
          tags: ["Incidents"],
          summary: "Submit a text incident report",
          description: "Accepts raw text, normalizes with Gemini AI, extracts entities and geolocation, persists the structured incident, and broadcasts an IncidentCreated event.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["rawContent"],
                  properties: {
                    rawContent: { type: "string", minLength: 10, description: "Raw incident description text" },
                    reporter: {
                      type: "object",
                      required: ["name"],
                      properties: {
                        name: { type: "string" },
                        email: { type: "string", format: "email" },
                        phone: { type: "string" },
                        role: { type: "string", enum: ["civilian", "operator", "first_responder", "sensor"] },
                      },
                    },
                    metadata: { type: "object" },
                    tags: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Incident created and dispatched",
              content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } },
            },
            "400": { description: "Validation error" },
            "500": { description: "Internal server error" },
          },
        },
      },
      "/api/incidents/audio": {
        post: {
          tags: ["Media"],
          summary: "Submit an audio incident report",
          description: "Accepts audio file via FormData. Transcribes with Gemini, normalizes, stores in Firebase.",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["audio"],
                  properties: {
                    audio: { type: "string", format: "binary", description: "Audio file (wav, mp3, ogg, webm, flac, aac)" },
                    reporterName: { type: "string" },
                    reporterEmail: { type: "string" },
                    reporterPhone: { type: "string" },
                    reporterRole: { type: "string" },
                    metadata: { type: "string", description: "JSON string of metadata" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Audio incident created" },
            "400": { description: "Invalid audio type or size" },
          },
        },
      },
      "/api/incidents/image": {
        post: {
          tags: ["Media"],
          summary: "Submit an image incident report",
          description: "Accepts image file via FormData. Analyzes with Gemini multimodal, normalizes, stores in Firebase.",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["image"],
                  properties: {
                    image: { type: "string", format: "binary", description: "Image file (jpeg, png, webp, gif, bmp)" },
                    reporterName: { type: "string" },
                    reporterEmail: { type: "string" },
                    metadata: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Image incident created" },
            "400": { description: "Invalid image type or size" },
          },
        },
      },
      "/api/incidents/video": {
        post: {
          tags: ["Media"],
          summary: "Submit a video incident report",
          description: "Accepts video file via FormData. Stores in Firebase, normalizes description text.",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  required: ["video"],
                  properties: {
                    video: { type: "string", format: "binary", description: "Video file (mp4, webm, avi, mkv)" },
                    description: { type: "string" },
                    reporterName: { type: "string" },
                    metadata: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Video incident created" },
            "400": { description: "Invalid video type or size" },
          },
        },
      },
      "/api/incidents/webhook": {
        post: {
          tags: ["Webhooks"],
          summary: "Receive external webhook payload",
          description: "Accepts structured payloads from Twilio, PagerDuty, etc. Public route (no Clerk auth).",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["source", "payload"],
                  properties: {
                    source: { type: "string", description: "Integration source identifier" },
                    payload: { type: "object", description: "Raw webhook payload" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Webhook incident created" },
          },
        },
      },
      "/api/incidents/bulk": {
        post: {
          tags: ["Incidents"],
          summary: "Batch-create multiple text incidents",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["incidents"],
                  properties: {
                    incidents: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["rawContent"],
                        properties: {
                          rawContent: { type: "string" },
                          reporter: { type: "object" },
                          metadata: { type: "object" },
                          tags: { type: "array", items: { type: "string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Bulk incidents created" },
          },
        },
      },
      "/api/incidents/{id}": {
        get: {
          tags: ["Incidents"],
          summary: "Get incident by ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Incident details" },
            "404": { description: "Incident not found" },
          },
        },
        patch: {
          tags: ["Incidents"],
          summary: "Update incident fields",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    incidentType: { type: "string" },
                    structuredDesc: { type: "string" },
                    tags: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Incident updated" },
            "404": { description: "Incident not found" },
          },
        },
        delete: {
          tags: ["Incidents"],
          summary: "Soft-delete an incident",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Incident deleted" },
            "404": { description: "Incident not found" },
          },
        },
      },
      "/api/incidents/{id}/agent-chain": {
        get: {
          tags: ["Agents"],
          summary: "Get agent execution chain for an incident",
          description: "Returns the full ordered history of all AI agent executions for a given incident.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Agent execution chain",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          incidentId: { type: "string" },
                          agentCount: { type: "integer" },
                          chain: {
                            type: "array",
                            items: { $ref: "#/components/schemas/AgentExecution" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "404": { description: "Incident not found" },
          },
        },
      },
    },
    components: {
      schemas: {
        Incident: {
          type: "object",
          properties: {
            id: { type: "string", example: "INC-4092" },
            version: { type: "integer" },
            status: { type: "string", enum: ["pending", "in-progress", "dispatched", "resolved"] },
            source: { type: "string", enum: ["text", "audio", "image", "video", "webhook", "bulk"] },
            incidentType: { type: "string" },
            rawContent: { type: "string" },
            structuredDesc: { type: "string" },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            lat: { type: "number", nullable: true },
            lng: { type: "number", nullable: true },
            locationName: { type: "string", nullable: true },
            extractedEntities: { type: "object" },
            agentHistory: { type: "array" },
            auditTrail: { type: "array" },
            metadata: { type: "object", nullable: true },
            tags: { type: "array", items: { type: "string" } },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AgentExecution: {
          type: "object",
          properties: {
            agentName: { type: "string" },
            status: { type: "string", enum: ["success", "failed"] },
            confidence: { type: "number" },
            reasoning: { type: "string" },
            outputData: { type: "object" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { $ref: "#/components/schemas/Incident" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: { type: "object" },
              },
            },
          },
        },
      },
      securitySchemes: {
        ClerkAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Clerk session JWT token",
        },
      },
    },
    security: [{ ClerkAuth: [] }],
  };

  return NextResponse.json(spec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
