import { SharedMemoryIntegration } from "./shared-memory-integration";
import { GeminiReportService, GeminiReportResponse } from "./gemini-report.service";
import { GeminiPromptBuilder } from "../utils/gemini-prompt-builder";
import { ComplianceValidator } from "../utils/compliance-validator";
import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { logger } from "@/infrastructure/logger/pino";

export class ReportGenerationService {
  private readonly sharedMemoryIntegration: SharedMemoryIntegration;
  private readonly geminiReportService: GeminiReportService;

  constructor(
    private readonly incidentRepo: IIncidentRepository,
    apiKey?: string,
    modelName?: string
  ) {
    this.sharedMemoryIntegration = new SharedMemoryIntegration(incidentRepo);
    this.geminiReportService = new GeminiReportService(apiKey, modelName);
  }

  public async generateAuditReport(incidentId: string): Promise<GeminiReportResponse & { complianceStatus: string; reportTimestamp: Date }> {
    logger.info({ incidentId }, "Compliance Auditor: Report Generation Started");

    const incident = await this.incidentRepo.findById(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const complianceData = await this.sharedMemoryIntegration.getComplianceData(incidentId);

    const structuredInput = {
      incidentId,
      incidentType: incident.incidentType,
      source: incident.source,
      status: incident.status,
      confidence: incident.confidence,
      createdAt: incident.createdAt,
      timeline: complianceData.timeline,
      agentHistory: incident.agentHistory,
    };

    const prompt = GeminiPromptBuilder.buildPrompt(structuredInput);
    const geminiReport = await this.geminiReportService.generateReport(prompt);

    const complianceValidation = ComplianceValidator.validateCompliance(complianceData.timeline);
    logger.info({ incidentId, complianceValidation }, "Compliance Auditor: Compliance Checked");

    const finalReport = {
      ...geminiReport,
      complianceStatus: `System Status: ${complianceValidation}. Details: ${geminiReport.complianceStatus}`,
      reportTimestamp: new Date(),
    };

    await this.sharedMemoryIntegration.writeReportState(incidentId, finalReport);

    return finalReport;
  }
}
