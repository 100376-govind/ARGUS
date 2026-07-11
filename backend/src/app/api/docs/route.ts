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
      { name: "Risk Evaluator", description: "AI-powered incident risk classification, predictions and overrides" },
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
      },
      "/api/risk/evaluate": {
        post: {
          tags: ["Risk Evaluator"],
          summary: "Evaluate incident risk",
          description: "Orchestrates the evaluation chain for an incident using Gemini AI and core analytical risk engines.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["incidentId"],
                  properties: {
                    incidentId: { type: "string", example: "INC-1234" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Incident risk evaluated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      message: { type: "string", example: "Incident evaluated successfully" },
                      timestamp: { type: "string", format: "date-time" },
                      requestId: { type: "string" },
                      data: { $ref: "#/components/schemas/RiskAssessment" },
                    },
                  },
                },
              },
            },
            "400": { description: "Invalid Incident details provided" },
            "404": { description: "Incident not found in Shared Memory" },
            "502": { description: "Gemini AI execution failure" },
          },
        },
      },
      "/api/risk/{incidentId}": {
        get: {
          tags: ["Risk Evaluator"],
          summary: "Get risk assessment by incident ID",
          parameters: [{ name: "incidentId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Risk assessment details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      data: { $ref: "#/components/schemas/RiskAssessment" },
                    },
                  },
                },
              },
            },
            "404": { description: "Risk assessment not found" },
          },
        },
        patch: {
          tags: ["Risk Evaluator"],
          summary: "Override risk assessment values manually",
          description: "Allows Commander or Admin users to manually override severity, priority, or reasoning values.",
          parameters: [{ name: "incidentId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                    reasoning: { type: "string" },
                    isProtocolZeroTriggered: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Risk assessment updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/RiskAssessment" },
                    },
                  },
                },
              },
            },
            "403": { description: "Access denied. Insufficient roles" },
            "404": { description: "Risk assessment not found" },
          },
        },
      },
      "/api/risk/history/{incidentId}": {
        get: {
          tags: ["Risk Evaluator"],
          summary: "Get severity and priority adjustment logs",
          parameters: [{ name: "incidentId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Risk adjustment history log payload",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          assessmentId: { type: "string" },
                          incidentId: { type: "string" },
                          severityHistory: { type: "array", items: { $ref: "#/components/schemas/SeverityHistory" } },
                          priorityHistory: { type: "array", items: { $ref: "#/components/schemas/PriorityHistory" } },
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
      "/api/risk/statistics": {
        get: {
          tags: ["Risk Evaluator"],
          summary: "Get aggregated risk statistics",
          responses: {
            "200": {
              description: "Statistics aggregated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          totalEvaluated: { type: "integer" },
                          averageRiskScore: { type: "number" },
                          protocolZeroTriggeredCount: { type: "integer" },
                          severityDistribution: { type: "object" },
                          priorityDistribution: { type: "object" },
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
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        RiskAssessment: {
          type: "object",
          properties: {
            id: { type: "string" },
            incidentId: { type: "string" },
            severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
            priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
            overallRiskScore: { type: "number" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
            isProtocolZeroTriggered: { type: "boolean" },
            threatPredictions: { type: "array", items: { $ref: "#/components/schemas/ThreatPrediction" } },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ThreatPrediction: {
          type: "object",
          properties: {
            id: { type: "string" },
            riskAssessmentId: { type: "string" },
            threatType: { type: "string" },
            probability: { type: "number" },
            impact: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
            estimatedTimeframe: { type: "string" },
            confidence: { type: "number" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        SeverityHistory: {
          type: "object",
          properties: {
            id: { type: "string" },
            riskAssessmentId: { type: "string" },
            severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
            score: { type: "number" },
            reason: { type: "string" },
            changedBy: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        PriorityHistory: {
          type: "object",
          properties: {
            id: { type: "string" },
            riskAssessmentId: { type: "string" },
            priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
            score: { type: "number" },
            reason: { type: "string" },
            changedBy: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
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
