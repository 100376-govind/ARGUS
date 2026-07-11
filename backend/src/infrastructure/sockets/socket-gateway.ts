import { Server as SocketIOServer, Socket } from "socket.io";
import { logger } from "@/infrastructure/logger/pino";

export class SocketGateway {
  private static instance: SocketGateway;
  private io: SocketIOServer | null = null;

  private constructor() {}

  public static getInstance(): SocketGateway {
    if (!SocketGateway.instance) {
      SocketGateway.instance = new SocketGateway();
    }
    return SocketGateway.instance;
  }

  /**
   * Initializes the Socket.io Server instance.
   * Configures rooms, namespaces, and heartbeat checks.
   */
  public initialize(server: any): void {
    if (this.io) {
      logger.warn("SocketGateway: Already initialized. Skipping duplicate server setup.");
      return;
    }

    logger.info("SocketGateway: Bootstrapping Socket.io connection framework");
    
    this.io = new SocketIOServer(server, {
      path: "/socket.io",
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Configure /risk namespace
    const riskNamespace = this.io.of("/risk");

    riskNamespace.on("connection", (socket: Socket) => {
      logger.info({ socketId: socket.id }, "SocketGateway: Client connected to /risk namespace");

      // Hearbeat validation handler
      socket.on("ping", () => {
        socket.emit("pong", { timestamp: new Date().toISOString() });
      });

      // Handle subscribing to a specific room for individual incident feeds
      socket.on("subscribe:incident", (incidentId: string) => {
        if (!incidentId) return;
        const room = `incident:${incidentId}`;
        socket.join(room);
        logger.info({ socketId: socket.id, incidentId }, "SocketGateway: Client joined incident room");
        socket.emit("subscribed", { room });
      });

      // Handle unsubscribing from incident updates
      socket.on("unsubscribe:incident", (incidentId: string) => {
        if (!incidentId) return;
        const room = `incident:${incidentId}`;
        socket.leave(room);
        logger.info({ socketId: socket.id, incidentId }, "SocketGateway: Client left incident room");
      });

      // Heartbeat event for frontend alignment
      socket.on("heartbeat", (data: any) => {
        socket.emit("heartbeat:ack", {
          status: "healthy",
          serverTime: new Date().toISOString(),
          data,
        });
      });

      socket.on("disconnect", (reason) => {
        logger.info({ socketId: socket.id, reason }, "SocketGateway: Client disconnected from namespace");
      });
    });
  }

  /**
   * Broadcasts a real-time event when a risk assessment is completed or updated.
   */
  public broadcastRiskUpdated(incidentId: string, assessment: any): void {
    if (!this.io) {
      logger.warn({ incidentId }, "SocketGateway: Broadcast failed — Socket Server not initialized");
      return;
    }

    const payload = {
      incidentId,
      assessmentId: assessment.id,
      severity: assessment.severity,
      priority: assessment.priority,
      overallRiskScore: assessment.overallRiskScore,
      confidence: assessment.confidence,
      reasoning: assessment.reasoning,
      isProtocolZeroTriggered: assessment.isProtocolZeroTriggered,
      predictions: assessment.threatPredictions || [],
      updatedAt: new Date().toISOString(),
    };

    // Broadcast globally to all general namespace listeners
    this.io.of("/risk").emit("risk:updated", payload);

    // Broadcast to the dedicated incident room
    const room = `incident:${incidentId}`;
    this.io.of("/risk").to(room).emit("incident:risk_details", payload);
    
    logger.info({ incidentId }, "SocketGateway: Broadcasted risk updates to clients");
  }

  /**
   * Broadcasts real-time alert on Protocol Zero activations.
   */
  public broadcastProtocolZeroRecommended(incidentId: string, payload: { assessmentId: string; reason: string }): void {
    if (!this.io) return;

    const alert = {
      incidentId,
      assessmentId: payload.assessmentId,
      reason: payload.reason,
      recommendedAt: new Date().toISOString(),
    };

    this.io.of("/risk").emit("protocol_zero:recommended", alert);
    this.io.of("/risk").to(`incident:${incidentId}`).emit("protocol_zero:alert", alert);
    logger.info({ incidentId }, "SocketGateway: Broadcasted Protocol Zero recommended alert");
  }
}

export const socketGateway = SocketGateway.getInstance();
