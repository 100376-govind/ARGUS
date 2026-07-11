import { randomUUID } from "crypto";
import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { IAIClient } from "@/domain/services/ai-client";
import { IMediaService } from "@/domain/services/media-service";
import { IEventBus } from "@/domain/services/event-bus";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { IncidentEntity, AuditLogEntry } from "@/domain/entities/incident";
import { logger, logOperation } from "@/infrastructure/logger/pino";

function generateIncidentId(): string {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `INC-${num}`;
}

function generateUUID(): string {
  return randomUUID();
}


export class DataDispatcherService {
  private sharedMemory: SharedIncidentMemory;

  constructor(
    private readonly incidentRepo: IIncidentRepository,
    private readonly aiClient: IAIClient,
    private readonly mediaService: IMediaService,
    private readonly eventBus: IEventBus
  ) {
    this.sharedMemory = new SharedIncidentMemory(incidentRepo);
  }

  /**
   * Dispatches a text-based incident report through the AI normalization pipeline.
   */
  async dispatchText(rawContent: string, reporterData?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    role?: string;
  }, metadata?: any, tags?: string[]): Promise<IncidentEntity> {
    logOperation("DataDispatcher", "dispatchText", { contentLength: rawContent.length });
    const startedAt = new Date();

    // Step 1: Normalize with Gemini
    const aiResult = await this.aiClient.normalizeIncident(rawContent);

    // Step 2: Create reporter if provided
    let reporterId: string | null = null;
    if (reporterData) {
      const reporter = await this.incidentRepo.createReporter({
        id: generateUUID(),
        name: reporterData.name,
        email: reporterData.email || null,
        phone: reporterData.phone || null,
        role: reporterData.role || "civilian",
        metadata: null,
      });
      reporterId = reporter.id;
    }

    // Step 3: Build the Incident entity
    const incidentId = generateIncidentId();
    const initialAuditEntry: AuditLogEntry = {
      version: 1,
      changedBy: "agent:data-dispatcher",
      action: "create",
      timestamp: new Date(),
      changes: [{ field: "status", from: null, to: "pending" }],
    };

    const incident = await this.incidentRepo.create({
      id: incidentId,
      version: 1,
      status: "pending",
      source: "text",
      incidentType: aiResult.incidentType,
      rawContent,
      structuredDesc: aiResult.structuredDesc,
      confidence: aiResult.confidence,
      lat: aiResult.lat || null,
      lng: aiResult.lng || null,
      locationName: aiResult.locationName || null,
      extractedEntities: aiResult.extractedEntities,
      agentHistory: [],
      auditTrail: [initialAuditEntry],
      metadata: metadata || null,
      tags: [...(tags || []), ...aiResult.tags],
      reporterId,
    });

    // Step 4: Write agent execution to shared memory
    await this.sharedMemory.write(incidentId, "data-dispatcher", {
      status: "success",
      confidence: aiResult.confidence,
      reasoning: aiResult.reasoning,
      outputData: aiResult,
    });

    // Step 5: Publish IncidentCreated event
    await this.eventBus.publish("IncidentCreated", {
      incidentId: incident.id,
      incidentType: incident.incidentType,
      status: incident.status,
      confidence: incident.confidence,
      locationName: incident.locationName,
      lat: incident.lat,
      lng: incident.lng,
      source: incident.source,
      structuredDesc: incident.structuredDesc,
      createdAt: incident.createdAt,
    });

    logger.info({ incidentId: incident.id, type: incident.incidentType }, "Incident dispatched successfully");
    return incident;
  }

  /**
   * Dispatches an audio-based incident report. Transcribes first, then normalizes.
   */
  async dispatchAudio(
    audioBuffer: Buffer,
    mimeType: string,
    reporterData?: { name: string; email?: string | null; phone?: string | null; role?: string },
    metadata?: any
  ): Promise<IncidentEntity> {
    logOperation("DataDispatcher", "dispatchAudio", { mimeType, sizeBytes: audioBuffer.length });

    // Step 1: Upload audio to Firebase
    const fileName = `audio/${generateUUID()}.${mimeType.split("/")[1] || "wav"}`;
    const mediaUrl = await this.mediaService.uploadFile(audioBuffer, fileName, mimeType);

    // Step 2: Transcribe audio with Gemini
    const transcript = await this.aiClient.transcribeAudio(audioBuffer, mimeType);

    // Step 3: Normalize transcript
    const aiResult = await this.aiClient.normalizeIncident(transcript);

    // Step 4: Create reporter
    let reporterId: string | null = null;
    if (reporterData) {
      const reporter = await this.incidentRepo.createReporter({
        id: generateUUID(),
        name: reporterData.name,
        email: reporterData.email || null,
        phone: reporterData.phone || null,
        role: reporterData.role || "civilian",
        metadata: null,
      });
      reporterId = reporter.id;
    }

    // Step 5: Build Incident
    const incidentId = generateIncidentId();
    const initialAuditEntry: AuditLogEntry = {
      version: 1,
      changedBy: "agent:data-dispatcher",
      action: "create",
      timestamp: new Date(),
      changes: [{ field: "status", from: null, to: "pending" }],
    };

    const incident = await this.incidentRepo.create({
      id: incidentId,
      version: 1,
      status: "pending",
      source: "audio",
      incidentType: aiResult.incidentType,
      rawContent: transcript,
      structuredDesc: aiResult.structuredDesc,
      confidence: aiResult.confidence,
      lat: aiResult.lat || null,
      lng: aiResult.lng || null,
      locationName: aiResult.locationName || null,
      extractedEntities: aiResult.extractedEntities,
      agentHistory: [],
      auditTrail: [initialAuditEntry],
      metadata: { ...(metadata || {}), originalMimeType: mimeType, transcript },
      tags: aiResult.tags,
      reporterId,
    });

    // Step 6: Link media
    await this.incidentRepo.addMedia({
      id: generateUUID(),
      url: mediaUrl,
      type: "audio",
      metadata: { mimeType, sizeBytes: audioBuffer.length, transcript },
      incidentId: incident.id,
    });

    // Step 7: Shared memory + event
    await this.sharedMemory.write(incidentId, "data-dispatcher", {
      status: "success",
      confidence: aiResult.confidence,
      reasoning: aiResult.reasoning,
      outputData: { ...aiResult, transcript, mediaUrl },
    });

    await this.eventBus.publish("IncidentCreated", {
      incidentId: incident.id,
      incidentType: incident.incidentType,
      status: incident.status,
      confidence: incident.confidence,
      locationName: incident.locationName,
      lat: incident.lat,
      lng: incident.lng,
      source: incident.source,
      structuredDesc: incident.structuredDesc,
      createdAt: incident.createdAt,
    });

    logger.info({ incidentId: incident.id, type: incident.incidentType }, "Audio incident dispatched");
    return incident;
  }

  /**
   * Dispatches an image-based incident. Sends base64 to Gemini for visual analysis.
   */
  async dispatchImage(
    imageBuffer: Buffer,
    mimeType: string,
    reporterData?: { name: string; email?: string | null; phone?: string | null; role?: string },
    metadata?: any
  ): Promise<IncidentEntity> {
    logOperation("DataDispatcher", "dispatchImage", { mimeType, sizeBytes: imageBuffer.length });

    // Upload to Firebase
    const fileName = `images/${generateUUID()}.${mimeType.split("/")[1] || "jpg"}`;
    const mediaUrl = await this.mediaService.uploadFile(imageBuffer, fileName, mimeType);

    // Normalize with Gemini multimodal
    const base64 = imageBuffer.toString("base64");
    const aiResult = await this.aiClient.normalizeIncident(base64, mimeType);

    let reporterId: string | null = null;
    if (reporterData) {
      const reporter = await this.incidentRepo.createReporter({
        id: generateUUID(),
        name: reporterData.name,
        email: reporterData.email || null,
        phone: reporterData.phone || null,
        role: reporterData.role || "civilian",
        metadata: null,
      });
      reporterId = reporter.id;
    }

    const incidentId = generateIncidentId();
    const incident = await this.incidentRepo.create({
      id: incidentId,
      version: 1,
      status: "pending",
      source: "image",
      incidentType: aiResult.incidentType,
      rawContent: `[Image uploaded: ${fileName}]`,
      structuredDesc: aiResult.structuredDesc,
      confidence: aiResult.confidence,
      lat: aiResult.lat || null,
      lng: aiResult.lng || null,
      locationName: aiResult.locationName || null,
      extractedEntities: aiResult.extractedEntities,
      agentHistory: [],
      auditTrail: [{ version: 1, changedBy: "agent:data-dispatcher", action: "create", timestamp: new Date(), changes: [] }],
      metadata: metadata || null,
      tags: aiResult.tags,
      reporterId,
    });

    await this.incidentRepo.addMedia({
      id: generateUUID(),
      url: mediaUrl,
      type: "image",
      metadata: { mimeType, sizeBytes: imageBuffer.length },
      incidentId: incident.id,
    });

    await this.sharedMemory.write(incidentId, "data-dispatcher", {
      status: "success",
      confidence: aiResult.confidence,
      reasoning: aiResult.reasoning,
      outputData: { ...aiResult, mediaUrl },
    });

    await this.eventBus.publish("IncidentCreated", {
      incidentId: incident.id,
      incidentType: incident.incidentType,
      status: incident.status,
      confidence: incident.confidence,
      locationName: incident.locationName,
      source: incident.source,
      structuredDesc: incident.structuredDesc,
      createdAt: incident.createdAt,
    });

    logger.info({ incidentId: incident.id }, "Image incident dispatched");
    return incident;
  }

  /**
   * Dispatches a video-based incident. Stores video, extracts metadata only (no streaming analysis).
   */
  async dispatchVideo(
    videoBuffer: Buffer,
    mimeType: string,
    reporterData?: { name: string; email?: string | null; phone?: string | null; role?: string },
    metadata?: any
  ): Promise<IncidentEntity> {
    logOperation("DataDispatcher", "dispatchVideo", { mimeType, sizeBytes: videoBuffer.length });

    const fileName = `videos/${generateUUID()}.${mimeType.split("/")[1] || "mp4"}`;
    const mediaUrl = await this.mediaService.uploadFile(videoBuffer, fileName, mimeType);

    // For video, use text-based normalization of any description provided
    const description = (metadata?.description as string) || `Video incident report uploaded (${mimeType}, ${videoBuffer.length} bytes)`;
    const aiResult = await this.aiClient.normalizeIncident(description);

    let reporterId: string | null = null;
    if (reporterData) {
      const reporter = await this.incidentRepo.createReporter({
        id: generateUUID(),
        name: reporterData.name,
        email: reporterData.email || null,
        phone: reporterData.phone || null,
        role: reporterData.role || "civilian",
        metadata: null,
      });
      reporterId = reporter.id;
    }

    const incidentId = generateIncidentId();
    const incident = await this.incidentRepo.create({
      id: incidentId,
      version: 1,
      status: "pending",
      source: "video",
      incidentType: aiResult.incidentType,
      rawContent: description,
      structuredDesc: aiResult.structuredDesc,
      confidence: aiResult.confidence,
      lat: aiResult.lat || null,
      lng: aiResult.lng || null,
      locationName: aiResult.locationName || null,
      extractedEntities: aiResult.extractedEntities,
      agentHistory: [],
      auditTrail: [{ version: 1, changedBy: "agent:data-dispatcher", action: "create", timestamp: new Date(), changes: [] }],
      metadata: { ...(metadata || {}), videoMimeType: mimeType },
      tags: aiResult.tags,
      reporterId,
    });

    await this.incidentRepo.addMedia({
      id: generateUUID(),
      url: mediaUrl,
      type: "video",
      metadata: { mimeType, sizeBytes: videoBuffer.length },
      incidentId: incident.id,
    });

    await this.sharedMemory.write(incidentId, "data-dispatcher", {
      status: "success",
      confidence: aiResult.confidence,
      reasoning: aiResult.reasoning,
      outputData: { ...aiResult, mediaUrl },
    });

    await this.eventBus.publish("IncidentCreated", {
      incidentId: incident.id,
      incidentType: incident.incidentType,
      status: incident.status,
      confidence: incident.confidence,
      source: incident.source,
      structuredDesc: incident.structuredDesc,
      createdAt: incident.createdAt,
    });

    logger.info({ incidentId: incident.id }, "Video incident dispatched");
    return incident;
  }

  /**
   * Dispatches a webhook-sourced incident (from external integrations like Twilio, PagerDuty).
   */
  async dispatchWebhook(source: string, payload: Record<string, any>): Promise<IncidentEntity> {
    logOperation("DataDispatcher", "dispatchWebhook", { source });

    const rawContent = JSON.stringify(payload);
    const aiResult = await this.aiClient.normalizeIncident(rawContent);

    const incidentId = generateIncidentId();
    const incident = await this.incidentRepo.create({
      id: incidentId,
      version: 1,
      status: "pending",
      source: "webhook",
      incidentType: aiResult.incidentType,
      rawContent,
      structuredDesc: aiResult.structuredDesc,
      confidence: aiResult.confidence,
      lat: aiResult.lat || null,
      lng: aiResult.lng || null,
      locationName: aiResult.locationName || null,
      extractedEntities: aiResult.extractedEntities,
      agentHistory: [],
      auditTrail: [{ version: 1, changedBy: `webhook:${source}`, action: "create", timestamp: new Date(), changes: [] }],
      metadata: { webhookSource: source },
      tags: [...aiResult.tags, `webhook:${source}`],
      reporterId: null,
    });

    // Log webhook receipt
    const { prisma } = await import("@/infrastructure/database/prisma-client");
    await prisma.webhookLog.create({
      data: {
        source,
        payload: payload as any,
        statusCode: 200,
      },
    });

    await this.sharedMemory.write(incidentId, "data-dispatcher", {
      status: "success",
      confidence: aiResult.confidence,
      reasoning: aiResult.reasoning,
      outputData: aiResult,
    });

    await this.eventBus.publish("IncidentCreated", {
      incidentId: incident.id,
      incidentType: incident.incidentType,
      status: incident.status,
      confidence: incident.confidence,
      source: incident.source,
      structuredDesc: incident.structuredDesc,
      createdAt: incident.createdAt,
    });

    logger.info({ incidentId: incident.id, webhookSource: source }, "Webhook incident dispatched");
    return incident;
  }

  /**
   * Dispatches multiple text incidents in a single batch.
   */
  async dispatchBulk(
    incidents: Array<{
      rawContent: string;
      reporter?: { name: string; email?: string | null; phone?: string | null; role?: string };
      metadata?: any;
      tags?: string[];
    }>
  ): Promise<IncidentEntity[]> {
    logOperation("DataDispatcher", "dispatchBulk", { count: incidents.length });

    const results: IncidentEntity[] = [];
    for (const item of incidents) {
      try {
        const result = await this.dispatchText(
          item.rawContent,
          item.reporter,
          item.metadata,
          item.tags
        );
        results.push(result);
      } catch (error) {
        logger.error({ error, rawContent: item.rawContent.substring(0, 100) }, "Bulk dispatch: individual item failed, continuing");
      }
    }

    logger.info({ total: incidents.length, successful: results.length }, "Bulk dispatch completed");
    return results;
  }

  /**
   * Retrieves a single incident by ID.
   */
  async getById(id: string): Promise<IncidentEntity | null> {
    return this.incidentRepo.findById(id);
  }

  /**
   * Lists incidents with optional filters.
   */
  async list(filters?: {
    status?: string;
    incidentType?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): Promise<IncidentEntity[]> {
    return this.incidentRepo.findAll(filters);
  }

  /**
   * Updates an incident's mutable fields.
   */
  async update(id: string, updates: Partial<IncidentEntity>, changedBy: string): Promise<IncidentEntity> {
    return this.incidentRepo.update(id, updates, changedBy, "manual_update");
  }

  /**
   * Soft-deletes an incident (marks as resolved).
   */
  async remove(id: string): Promise<boolean> {
    return this.incidentRepo.delete(id);
  }
}
