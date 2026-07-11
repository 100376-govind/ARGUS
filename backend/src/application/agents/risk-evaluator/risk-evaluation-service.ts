import { prisma } from "@/infrastructure/database/prisma-client";
import {
  RiskAssessmentRepository,
  PredictionRepository,
  SeverityRepository,
  PriorityRepository,
  ReasoningRepository,
  ProtocolZeroRepository,
} from "@/infrastructure/database/risk-assessment-repository";
import { RiskEvaluatorGeminiClient } from "@/infrastructure/gemini/risk-evaluator-gemini-client";
import { threatAnalysisService } from "./threat-analysis-service";
import { severityEngine } from "./severity-engine";
import { priorityEngine } from "./priority-engine";
import { predictionService } from "./prediction-service";
import { impactEngine } from "./impact-engine";
import { weightedRiskEngine } from "./weighted-risk-engine";
import { confidenceService } from "./confidence-service";
import { reasoningService } from "./reasoning-service";
import { protocolZeroDecisionHelper } from "./protocol-helper";
import { RiskAssessmentBuilder } from "./risk-assessment-builder";
import { SharedIncidentMemoryIntegration } from "./shared-memory-integration";

import { riskEvaluatorCache } from "@/infrastructure/redis/risk-evaluator-cache";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { PrismaIncidentRepository } from "@/infrastructure/database/prisma-incident-repository";
import { RiskAssessment, SeverityLevel, PriorityLevel } from "@/domain/entities/risk-evaluator";
import { logger } from "@/infrastructure/logger/pino";
import {
  IncidentNotFoundError,
  InvalidIncidentError,
  GeminiFailureError,
  DatabaseError,
} from "@/shared/errors/risk-evaluator-service-errors";

export class RiskEvaluationService {
  private readonly riskAssessmentRepo: RiskAssessmentRepository;
  private readonly predictionRepo: PredictionRepository;
  private readonly severityRepo: SeverityRepository;
  private readonly priorityRepo: PriorityRepository;
  private readonly reasoningRepo: ReasoningRepository;
  private readonly protocolZeroRepo: ProtocolZeroRepository;
  private readonly sharedMemoryIntegration: SharedIncidentMemoryIntegration;
  private readonly geminiClient: RiskEvaluatorGeminiClient;

  constructor() {
    this.riskAssessmentRepo = new RiskAssessmentRepository();
    this.predictionRepo = new PredictionRepository();
    this.severityRepo = new SeverityRepository();
    this.priorityRepo = new PriorityRepository();
    this.reasoningRepo = new ReasoningRepository();
    this.protocolZeroRepo = new ProtocolZeroRepository();
    
    const incidentRepo = new PrismaIncidentRepository();
    const sharedMemory = new SharedIncidentMemory(incidentRepo);
    this.sharedMemoryIntegration = new SharedIncidentMemoryIntegration(sharedMemory);
    this.geminiClient = RiskEvaluatorGeminiClient.getInstance();
  }

  /**
   * Evaluates the risk associated with an incident and writes it into the system state.
   */
  public async evaluateIncidentRisk(incidentId: string): Promise<RiskAssessment> {
    const startTime = Date.now();
    logger.info({ incidentId }, "RiskEvaluationService: Starting risk evaluation sequence");

    // 1. Check cache first for rapid performance return
    const cached = await riskEvaluatorCache.get(incidentId);
    if (cached) {
      logger.info({ incidentId, cacheHit: true }, "RiskEvaluationService: Returning cached risk assessment");
      return cached;
    }

    // 2. Read Incident Context
    const incident = await this.sharedMemoryIntegration.readIncident(incidentId);
    if (!incident) {
      throw new IncidentNotFoundError(incidentId);
    }

    // 3. Validate Incident structure
    if (!incident.structuredDesc || !incident.incidentType) {
      throw new InvalidIncidentError(`Incident ${incidentId} contains incomplete Data Dispatcher normalization`);
    }

    // 4. Call Gemini client for risk evaluation
    let geminiResponse;
    let structuredContext: any;
    try {

      // Map extracted entities to a record for Gemini
      const entities = incident.extractedEntities
        ? {
            locations: incident.extractedEntities.locations || [],
            hazards: incident.extractedEntities.hazards || [],
            people: incident.extractedEntities.people || [],
            vehicles: incident.extractedEntities.vehicles || [],
            organizations: incident.extractedEntities.organizations || [],
          }
        : { locations: [], hazards: [], people: [], vehicles: [], organizations: [] };

      structuredContext = {
        structuredDesc: incident.structuredDesc,
        extractedEntities: entities,
        metadata: incident.metadata || {},
      };


      geminiResponse = await this.geminiClient.evaluateRisk(
        incidentId,
        incident.incidentType,
        structuredContext
      );
    } catch (error: any) {
      throw new GeminiFailureError(`Gemini AI execution failed for incident ${incidentId}: ${error.message}`, error);
    }

    // 5. Threat Analysis Service
    const threatAnalysis = threatAnalysisService.analyzeThreat(incident.incidentType);

    // 6. Severity Engine
    const isHazmat = incident.extractedEntities?.hazards?.length > 0 || threatAnalysis.category === "HAZARDOUS_MATERIAL";
    const infraDetails = this.resolveInfrastructureFlags(incident.extractedEntities?.locations || []);
    const envDetails = {
      isExtremeWeather: incident.metadata?.weather?.isExtreme === true || incident.metadata?.weather?.severity === "severe",
      isNightTime: this.checkIsNightTime(),
    };

    const severityResult = severityEngine.calculateSeverity({
      incidentType: incident.incidentType,
      victimCount: incident.extractedEntities?.people?.length || 0,
      hasHazmat: isHazmat,
      affectedInfrastructure: infraDetails,
      environment: envDetails,
      geminiAssessedSeverity: geminiResponse.severity,
    });

    // 7. Prediction Service
    const predictionsInput = {
      incidentType: incident.incidentType,
      isExtremeWeather: envDetails.isExtremeWeather,
      victimCount: incident.extractedEntities?.people?.length || 0,
      hasHospitalsNearby: infraDetails.hasHospitals,
      isNightTime: envDetails.isNightTime,
      geminiPredictions: geminiResponse.predictions.map((p) => ({
        threatType: p.threatType,
        probability: p.probability,
        impact: p.impact,
        estimatedTimeframe: p.estimatedTimeframe,
        confidence: p.confidence,
      })),
    };
    const generatedPredictions = predictionService.getPredictions(predictionsInput);

    // 8. Impact Engine
    const hasHospitalNearby = infraDetails.hasHospitals;
    const hasSchoolNearby = infraDetails.hasSchools;
    const impactResult = impactEngine.estimateImpact({
      incidentType: incident.incidentType,
      victimCount: incident.extractedEntities?.people?.length || 0,
      locationDetails: {
        isHighDensityZone: incident.locationName ? true : false, // Heuristic if location name is present
        hasSchoolNearby,
        hasHospitalNearby,
      },
      metadataInfraDetails: {
        estimatedBuildingsDamaged: incident.metadata?.damage?.buildingsCount,
        blockedRoadsCount: incident.metadata?.damage?.blockedRoadsCount,
        gridNodesOfflineCount: incident.metadata?.damage?.gridNodesOfflineCount,
      },
    });

    // 9. Priority Engine
    const priorityResult = priorityEngine.calculatePriority({
      severityScore: severityResult.score,
      impactScore: impactResult.overallImpactScore,
      timeUrgencyScore: this.resolveTimeUrgencyScore(incident.incidentType, geminiResponse.predictions),
    });

    // 10. Weighted Risk Engine
    const riskInput = {
      threatSubtype: incident.incidentType,
      victimCount: incident.extractedEntities?.people?.length || 0,
      hasVulnerablePopulation: hasSchoolNearby, // School children
      affectedInfrastructureCount: (infraDetails.hasHospitals ? 1 : 0) + (infraDetails.hasSchools ? 1 : 0) + (infraDetails.hasPowerGrid ? 1 : 0),
      hasHospitals: infraDetails.hasHospitals,
      hasSchools: infraDetails.hasSchools,
      hasHazmat: isHazmat,
      isExtremeWeather: envDetails.isExtremeWeather,
      dispatcherConfidence: incident.confidence,
      geminiConfidence: geminiResponse.confidence * 100,
    };
    const weightedRiskResult = weightedRiskEngine.calculateRiskScore(riskInput);

    // 11. Confidence Service
    const confidenceInput = {
      dispatcherConfidence: incident.confidence,
      geminiConfidence: geminiResponse.confidence,
      incidentFields: {
        hasLocation: incident.locationName ? true : false,
        hasReporterDetails: incident.reporterId ? true : false,
        hasVictimCountExplicit: incident.extractedEntities?.people?.length > 0,
        hasEntitiesExtracted: incident.extractedEntities ? true : false,
      },
      predictionConfidences: generatedPredictions.map((p) => p.confidence),
    };
    const confidenceAssessment = confidenceService.evaluateConfidence(confidenceInput);

    // 12. Reasoning Service
    const reasoningInput = {
      severityLevel: severityResult.level,
      priorityCode: priorityResult.code,
      incidentType: incident.incidentType,
      victimCount: incident.extractedEntities?.people?.length || 0,
      hasHazmat: isHazmat,
      isExtremeWeather: envDetails.isExtremeWeather,
      affectedInfrastructure: this.getInfrastructureNamesList(infraDetails),
      predictions: generatedPredictions,
      geminiReasoning: geminiResponse.reasoning,
    };
    const reasoningResult = reasoningService.generateReasoning(reasoningInput);

    // 13. Protocol Zero Decision Helper
    const protocolZeroInput = {
      overallRiskScore: weightedRiskResult.overallScore,
      severityLevel: severityResult.level,
      victimCount: incident.extractedEntities?.people?.length || 0,
      hasHazmat: isHazmat,
      isExtremeWeather: envDetails.isExtremeWeather,
      isNightTime: envDetails.isNightTime,
      impact: impactResult,
      incidentType: incident.incidentType,
      geminiTriggered: geminiResponse.protocolZero?.triggered || false,
      geminiReason: geminiResponse.protocolZero?.reason || "",
    };
    const protocolZeroResult = protocolZeroDecisionHelper.evaluateProtocolZeroTrigger(protocolZeroInput);

    // 14. Transaction Management (Wrap Prisma database writes in transaction client tx)
    let finalizedAssessment: RiskAssessment;
    try {
      finalizedAssessment = await prisma.$transaction(async (tx) => {
        // A. Persist main RiskAssessment record
        const dbAssessment = await this.riskAssessmentRepo.create(
          {
            incidentId,
            severity: severityResult.level as SeverityLevel,
            priority: priorityResult.level as PriorityLevel,
            overallRiskScore: weightedRiskResult.overallScore,
            confidence: confidenceAssessment.overallConfidence / 100,
            reasoning: reasoningResult.summaryText,
            isProtocolZeroTriggered: protocolZeroResult.triggered,
          },
          tx
        );

        // B. Store Threat Predictions
        const savedPredictions = [];
        for (const pred of generatedPredictions) {
          const savedPred = await this.predictionRepo.create(
            {
              riskAssessmentId: dbAssessment.id,
              threatType: pred.threatType,
              probability: pred.probability,
              impact: pred.impact,
              estimatedTimeframe: pred.estimatedTimeframe,
              confidence: pred.confidence,
            },
            tx
          );
          savedPredictions.push(savedPred);
        }

        // C. Record Severity History Snapshot
        await this.severityRepo.create(
          {
            riskAssessmentId: dbAssessment.id,
            severity: severityResult.level as SeverityLevel,
            score: severityResult.score,
            reason: reasoningResult.summaryText,
            changedBy: "agent:risk-evaluator",
          },
          tx
        );

        // D. Record Priority History Snapshot
        await this.priorityRepo.create(
          {
            riskAssessmentId: dbAssessment.id,
            priority: priorityResult.level as PriorityLevel,
            score: priorityResult.score,
            reason: reasoningResult.summaryText,
            changedBy: "agent:risk-evaluator",
          },
          tx
        );

        // E. Log Reasoning details
        await this.reasoningRepo.create(
          {
            riskAssessmentId: dbAssessment.id,
            agentName: "risk-evaluator",
            inputPayload: structuredContext,
            outputPayload: geminiResponse,
            confidence: confidenceAssessment.overallConfidence / 100,
            reasoning: reasoningResult.summaryText,
          },
          tx
        );

        // F. Create Protocol Zero Request entry if triggered
        const savedP0Requests = [];
        if (protocolZeroResult.triggered) {
          const p0 = await this.protocolZeroRepo.create(
            {
              riskAssessmentId: dbAssessment.id,
              status: "pending",
              requestedBy: "agent:risk-evaluator:protocol-zero-engine",
              reason: protocolZeroResult.reason,
            },
            tx
          );
          savedP0Requests.push(p0);
        }

        // Assemble finalized complete object using builder
        return new RiskAssessmentBuilder()
          .setId(dbAssessment.id)
          .setIncidentId(incidentId)
          .setSeverity(severityResult.level as SeverityLevel)
          .setPriority(priorityResult.level as PriorityLevel)
          .setOverallRiskScore(weightedRiskResult.overallScore)
          .setConfidence(confidenceAssessment.overallConfidence / 100)
          .setReasoning(reasoningResult.summaryText)
          .setIsProtocolZeroTriggered(protocolZeroResult.triggered)
          .setThreatPredictions(savedPredictions)
          .setProtocolZeroRequests(savedP0Requests)
          .setTimestamps(dbAssessment.createdAt, dbAssessment.updatedAt)
          .build();
      });
    } catch (err: any) {
      throw new DatabaseError(`Failed to commit risk assessment transaction: ${err.message}`, err);
    }

    // 15. Shared Memory Integration (persists to incident metadata/agent history)
    await this.sharedMemoryIntegration.appendRiskEvaluatorData(incidentId, finalizedAssessment);

    // 16. Cache Risk Assessment in Redis
    await riskEvaluatorCache.set(incidentId, finalizedAssessment);

    const duration = Date.now() - startTime;
    logger.info(
      {
        incidentId,
        assessmentId: finalizedAssessment.id,
        durationMs: duration,
        protocolZeroTriggered: finalizedAssessment.isProtocolZeroTriggered,
      },
      "RiskEvaluationService: Risk assessment sequence completed successfully"
    );

    return finalizedAssessment;
  }

  private resolveInfrastructureFlags(locations: string[]) {
    const text = locations.join(" ").toLowerCase();
    return {
      hasHospitals: text.includes("hospital") || text.includes("clinic") || text.includes("medical center"),
      hasSchools: text.includes("school") || text.includes("college") || text.includes("university") || text.includes("nursery"),
      hasPowerGrid: text.includes("substation") || text.includes("power grid") || text.includes("grid") || text.includes("generator"),
      hasBridgesOrRoads: text.includes("bridge") || text.includes("flyover") || text.includes("highway") || text.includes("highway lane"),
    };
  }

  private getInfrastructureNamesList(infra: ReturnType<typeof this.resolveInfrastructureFlags>): string[] {
    const list = [];
    if (infra.hasHospitals) list.push("Medical Care Facility");
    if (infra.hasSchools) list.push("Educational Centre");
    if (infra.hasPowerGrid) list.push("Power Substation Grid Node");
    if (infra.hasBridgesOrRoads) list.push("Critical Transport Route Bridge");
    return list;
  }

  private checkIsNightTime(): boolean {
    const hours = new Date().getHours();
    return hours >= 20 || hours < 6; // 8 PM to 6 AM is night
  }

  private resolveTimeUrgencyScore(incidentType: string, predictions: any[]): number {
    const type = incidentType.toLowerCase();
    if (type.includes("explosion") || type.includes("collapse") || type.includes("stampede")) {
      return 100; // immediate
    }

    // Check predicted timeframes
    const hasImmediate = predictions.some((p) => p.estimatedTimeframe === "immediate" || p.estimatedTimeframe === "15m");
    if (hasImmediate) return 90;

    return 50; // default moderate urgency
  }
}
export const riskEvaluationService = new RiskEvaluationService();
