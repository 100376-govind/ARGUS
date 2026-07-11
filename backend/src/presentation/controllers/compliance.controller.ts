import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PrismaIncidentRepository } from "@/infrastructure/database/prisma-incident-repository";
import { ReportGenerationService } from "@/compliance-auditor/services/report-generation.service";
import { ComplianceAuditorService } from "@/compliance-auditor/services/compliance-auditor.service";
import { PDFExportService } from "@/compliance-auditor/services/pdf-export.service";
import { SharedMemoryIntegration } from "@/compliance-auditor/services/shared-memory-integration";
import { ComplianceCache } from "@/compliance-auditor/services/compliance-cache";
import { ComplianceMetrics } from "@/compliance-auditor/services/compliance-metrics";
import { socketGateway } from "@/infrastructure/sockets/socket-gateway";
import { eventBus } from "@/infrastructure/redis/redis-event-bus";
import { StandardResponse } from "../responses/standard-response";
import { logger } from "@/infrastructure/logger/pino";
import { performance } from "perf_hooks";

const paramsSchema = z.object({
  incidentId: z.string().min(1, "Incident ID is required"),
});

export class ComplianceController {
  private readonly incidentRepo: PrismaIncidentRepository;
  private readonly reportGenService: ReportGenerationService;
  private readonly complianceService: ComplianceAuditorService;
  private readonly sharedMemory: SharedMemoryIntegration;

  constructor() {
    this.incidentRepo = new PrismaIncidentRepository();
    this.reportGenService = new ReportGenerationService(this.incidentRepo);
    this.complianceService = new ComplianceAuditorService(this.incidentRepo);
    this.sharedMemory = new SharedMemoryIntegration(this.incidentRepo);
  }

  public async getComplianceSummary(req: NextRequest, context: any): Promise<NextResponse> {
    const startTime = performance.now();
    ComplianceMetrics.incrementRequests();

    try {
      const params = paramsSchema.parse(await context.params);
      const incidentId = params.incidentId;
      const cacheKey = `compliance:summary:${incidentId}`;

      // Check Cache
      const cached = await ComplianceCache.get<any>(cacheKey);
      if (cached) {
        ComplianceMetrics.recordSuccess();
        ComplianceMetrics.recordApiLatency(performance.now() - startTime);
        return StandardResponse.success(cached, "Compliance summary retrieved from cache");
      }

      // Publish Redis AuditStarted
      const redisStart = performance.now();
      await eventBus.publish("AuditStarted", { incidentId, timestamp: Date.now() });
      ComplianceMetrics.recordRedisLatency(performance.now() - redisStart);
      socketGateway.broadcastAuditStarted(incidentId);

      let audit = await this.complianceService.getAudit(incidentId);
      if (!audit) {
        ComplianceMetrics.recordError();
        return StandardResponse.error(["Incident not found"], "Not Found", 404);
      }

      const data = await this.sharedMemory.getComplianceData(incidentId);
      const metadata = (await this.incidentRepo.findById(incidentId))?.metadata as any;
      
      let sitrep = metadata?.sitrep;
      let timeline = data.timeline;

      if (!sitrep) {
        const genStart = performance.now();
        const generated = await this.reportGenService.generateAuditReport(incidentId);
        ComplianceMetrics.recordReportTime(performance.now() - genStart);
        
        sitrep = generated.sitrep;
        timeline = (await this.sharedMemory.getComplianceData(incidentId)).timeline;

        await eventBus.publish("ReportGenerated", { incidentId, timestamp: Date.now() });
        socketGateway.broadcastReportGenerated(incidentId, generated);
      }

      await eventBus.publish("ComplianceCompleted", { incidentId, timestamp: Date.now() });
      socketGateway.broadcastComplianceChecked(incidentId, audit.metadata.isFullyCompliant ? "Complete" : "Incomplete");
      socketGateway.broadcastDashboardUpdated(incidentId);

      const payload = {
        auditRecord: audit,
        timeline,
        complianceStatus: audit.metadata.isFullyCompliant ? "Complete" : "Incomplete",
      };

      // Set Cache
      await ComplianceCache.set(cacheKey, payload);

      ComplianceMetrics.recordSuccess();
      ComplianceMetrics.recordApiLatency(performance.now() - startTime);
      return StandardResponse.success(payload, "Compliance summary retrieved successfully");
    } catch (error: any) {
      ComplianceMetrics.recordError();
      logger.error({ error: error.message }, "ComplianceController: Error in getComplianceSummary");
      return StandardResponse.error([error.message], "Internal Error", 500);
    }
  }

  public async getTimeline(req: NextRequest, context: any): Promise<NextResponse> {
    const startTime = performance.now();
    try {
      const params = paramsSchema.parse(await context.params);
      const incidentId = params.incidentId;
      const cacheKey = `compliance:timeline:${incidentId}`;

      const cached = await ComplianceCache.get<any>(cacheKey);
      if (cached) {
        ComplianceMetrics.recordApiLatency(performance.now() - startTime);
        return StandardResponse.success(cached, "Incident timeline retrieved from cache");
      }

      const timeline = await this.complianceService.getTimeline(incidentId);
      
      await eventBus.publish("TimelineUpdated", { incidentId, timestamp: Date.now() });
      socketGateway.broadcastTimelineUpdated(incidentId, timeline.events);

      await ComplianceCache.set(cacheKey, timeline);

      ComplianceMetrics.recordApiLatency(performance.now() - startTime);
      return StandardResponse.success(timeline, "Incident timeline retrieved successfully");
    } catch (error: any) {
      logger.error({ error: error.message }, "ComplianceController: Error in getTimeline");
      return StandardResponse.error([error.message], "Internal Error", 500);
    }
  }

  public async getReport(req: NextRequest, context: any): Promise<NextResponse> {
    const startTime = performance.now();
    try {
      const params = paramsSchema.parse(await context.params);
      const incidentId = params.incidentId;
      const cacheKey = `compliance:report:${incidentId}`;

      const cached = await ComplianceCache.get<any>(cacheKey);
      if (cached) {
        ComplianceMetrics.recordApiLatency(performance.now() - startTime);
        return StandardResponse.success(cached, "Audit report retrieved from cache");
      }

      const incident = await this.incidentRepo.findById(incidentId);
      if (!incident) {
        return StandardResponse.error(["Incident not found"], "Not Found", 404);
      }

      const metadata = incident.metadata as any;
      let payload;

      if (!metadata?.sitrep) {
        const generated = await this.reportGenService.generateAuditReport(incidentId);
        payload = {
          sitrep: generated.sitrep,
          incidentSummary: generated.incidentSummary,
          decisionSummary: generated.decisionSummary,
          recommendations: generated.recommendations,
        };
      } else {
        payload = {
          sitrep: metadata.sitrep,
          incidentSummary: metadata.incidentSummary,
          decisionSummary: metadata.decisionSummary,
          recommendations: metadata.recommendations,
        };
      }

      await ComplianceCache.set(cacheKey, payload);

      ComplianceMetrics.recordApiLatency(performance.now() - startTime);
      return StandardResponse.success(payload, "Audit report retrieved successfully");
    } catch (error: any) {
      logger.error({ error: error.message }, "ComplianceController: Error in getReport");
      return StandardResponse.error([error.message], "Internal Error", 500);
    }
  }

  public async getPdf(req: NextRequest, context: any): Promise<NextResponse> {
    const startTime = performance.now();
    try {
      const params = paramsSchema.parse(await context.params);
      const incidentId = params.incidentId;

      const incident = await this.incidentRepo.findById(incidentId);
      if (!incident) {
        return StandardResponse.error(["Incident not found"], "Not Found", 404);
      }

      let complianceData = incident.metadata as any;
      if (!complianceData?.sitrep) {
        complianceData = await this.reportGenService.generateAuditReport(incidentId);
      }

      const pdfStart = performance.now();
      const pdfBuffer = await PDFExportService.exportIncidentAuditPDF(incident, complianceData);
      ComplianceMetrics.recordPdfTime(performance.now() - pdfStart);

      await eventBus.publish("PDFGenerated", { incidentId, timestamp: Date.now() });
      socketGateway.broadcastPdfGenerated(incidentId);

      ComplianceMetrics.recordApiLatency(performance.now() - startTime);

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="compliance-audit-${incidentId}.pdf"`,
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message }, "ComplianceController: Error in getPdf");
      return StandardResponse.error([error.message], "Internal Error", 500);
    }
  }
}

export const complianceController = new ComplianceController();
