import { prisma } from "./prisma-client";
import {
  RiskAssessment,
  ThreatPrediction,
  SeverityHistory,
  PriorityHistory,
  ProtocolZeroRequest,
  ReasoningLog,
  SeverityLevel,
  PriorityLevel,
  ProtocolZeroStatus,
} from "@/domain/entities/risk-evaluator";
import { DatabaseError } from "../../shared/errors/risk-evaluator-service-errors";


export class RiskAssessmentRepository {
  private mapToEntity(dbRecord: any): RiskAssessment {
    return {
      id: dbRecord.id,
      incidentId: dbRecord.incidentId,
      severity: dbRecord.severity as SeverityLevel,
      priority: dbRecord.priority as PriorityLevel,
      overallRiskScore: dbRecord.overallRiskScore,
      confidence: dbRecord.confidence,
      reasoning: dbRecord.reasoning,
      isProtocolZeroTriggered: dbRecord.isProtocolZeroTriggered,
      threatPredictions: dbRecord.threatPredictions?.map((tp: any) => ({
        id: tp.id,
        riskAssessmentId: tp.riskAssessmentId,
        threatType: tp.threatType,
        probability: tp.probability,
        impact: tp.impact as SeverityLevel,
        estimatedTimeframe: tp.estimatedTimeframe,
        confidence: tp.confidence,
        createdAt: tp.createdAt,
      })),
      severityHistory: dbRecord.severityHistory?.map((sh: any) => ({
        id: sh.id,
        riskAssessmentId: sh.riskAssessmentId,
        severity: sh.severity as SeverityLevel,
        score: sh.score,
        reason: sh.reason,
        changedBy: sh.changedBy,
        createdAt: sh.createdAt,
      })),
      priorityHistory: dbRecord.priorityHistory?.map((ph: any) => ({
        id: ph.id,
        riskAssessmentId: ph.riskAssessmentId,
        priority: ph.priority as PriorityLevel,
        score: ph.score,
        reason: ph.reason,
        changedBy: ph.changedBy,
        createdAt: ph.createdAt,
      })),
      reasoningLogs: dbRecord.reasoningLogs?.map((rl: any) => ({
        id: rl.id,
        riskAssessmentId: rl.riskAssessmentId,
        agentName: rl.agentName,
        inputPayload: rl.inputPayload as Record<string, any>,
        outputPayload: rl.outputPayload as Record<string, any>,
        confidence: rl.confidence,
        reasoning: rl.reasoning,
        createdAt: rl.createdAt,
      })),
      protocolZeroRequests: dbRecord.protocolZeroRequests?.map((p0: any) => ({
        id: p0.id,
        riskAssessmentId: p0.riskAssessmentId,
        status: p0.status as ProtocolZeroStatus,
        requestedBy: p0.requestedBy,
        reason: p0.reason,
        approvedBy: p0.approvedBy,
        actionedAt: p0.actionedAt,
        createdAt: p0.createdAt,
        updatedAt: p0.updatedAt,
      })),
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
    };
  }

  public async findById(id: string, tx?: any): Promise<RiskAssessment | null> {
    const client = tx || prisma;
    try {
      const dbRecord = await client.riskAssessment.findUnique({
        where: { id },
        include: {
          threatPredictions: true,
          severityHistory: true,
          priorityHistory: true,
          reasoningLogs: true,
          protocolZeroRequests: true,
        },
      });
      return dbRecord ? this.mapToEntity(dbRecord) : null;
    } catch (error: any) {
      throw new DatabaseError(`Failed to fetch RiskAssessment by ID: ${error.message}`, error);
    }
  }

  public async findByIncidentId(incidentId: string, tx?: any): Promise<RiskAssessment | null> {
    const client = tx || prisma;
    try {
      const dbRecord = await client.riskAssessment.findUnique({
        where: { incidentId },
        include: {
          threatPredictions: true,
          severityHistory: true,
          priorityHistory: true,
          reasoningLogs: true,
          protocolZeroRequests: true,
        },
      });
      return dbRecord ? this.mapToEntity(dbRecord) : null;
    } catch (error: any) {
      throw new DatabaseError(`Failed to fetch RiskAssessment by incident ID: ${error.message}`, error);
    }
  }

  public async create(
    data: Omit<RiskAssessment, "id" | "createdAt" | "updatedAt" | "threatPredictions" | "severityHistory" | "priorityHistory" | "reasoningLogs" | "protocolZeroRequests">,
    tx?: any
  ): Promise<RiskAssessment> {
    const client = tx || prisma;
    try {
      const dbRecord = await client.riskAssessment.create({
        data: {
          incidentId: data.incidentId,
          severity: data.severity,
          priority: data.priority,
          overallRiskScore: data.overallRiskScore,
          confidence: data.confidence,
          reasoning: data.reasoning,
          isProtocolZeroTriggered: data.isProtocolZeroTriggered,
        },
        include: {
          threatPredictions: true,
          severityHistory: true,
          priorityHistory: true,
          reasoningLogs: true,
          protocolZeroRequests: true,
        },
      });
      return this.mapToEntity(dbRecord);
    } catch (error: any) {
      throw new DatabaseError(`Failed to create RiskAssessment: ${error.message}`, error);
    }
  }

  public async update(
    id: string,
    data: Partial<Omit<RiskAssessment, "id" | "incidentId" | "createdAt" | "updatedAt">>,
    tx?: any
  ): Promise<RiskAssessment> {
    const client = tx || prisma;
    try {
      const dbRecord = await client.riskAssessment.update({
        where: { id },
        data: {
          severity: data.severity,
          priority: data.priority,
          overallRiskScore: data.overallRiskScore,
          confidence: data.confidence,
          reasoning: data.reasoning,
          isProtocolZeroTriggered: data.isProtocolZeroTriggered,
        },
        include: {
          threatPredictions: true,
          severityHistory: true,
          priorityHistory: true,
          reasoningLogs: true,
          protocolZeroRequests: true,
        },
      });
      return this.mapToEntity(dbRecord);
    } catch (error: any) {
      throw new DatabaseError(`Failed to update RiskAssessment: ${error.message}`, error);
    }
  }

  public async delete(id: string, tx?: any): Promise<boolean> {
    const client = tx || prisma;
    try {
      await client.riskAssessment.delete({
        where: { id },
      });
      return true;
    } catch (error: any) {
      throw new DatabaseError(`Failed to delete RiskAssessment: ${error.message}`, error);
    }
  }
}

export class PredictionRepository {
  public async create(
    data: Omit<ThreatPrediction, "id" | "createdAt">,
    tx?: any
  ): Promise<ThreatPrediction> {
    const client = tx || prisma;
    try {
      const dbRecord = await client.threatPrediction.create({
        data: {
          riskAssessmentId: data.riskAssessmentId,
          threatType: data.threatType,
          probability: data.probability,
          impact: data.impact,
          estimatedTimeframe: data.estimatedTimeframe,
          confidence: data.confidence,
        },
      });
      return {
        id: dbRecord.id,
        riskAssessmentId: dbRecord.riskAssessmentId,
        threatType: dbRecord.threatType,
        probability: dbRecord.probability,
        impact: dbRecord.impact as SeverityLevel,
        estimatedTimeframe: dbRecord.estimatedTimeframe,
        confidence: dbRecord.confidence,
        createdAt: dbRecord.createdAt,
      };
    } catch (error: any) {
      throw new DatabaseError(`Failed to create ThreatPrediction: ${error.message}`, error);
    }
  }

  public async findByAssessmentId(riskAssessmentId: string, tx?: any): Promise<ThreatPrediction[]> {
    const client = tx || prisma;
    try {
      const records = await client.threatPrediction.findMany({
        where: { riskAssessmentId },
      });
      return records.map((dbRecord: any) => ({
        id: dbRecord.id,
        riskAssessmentId: dbRecord.riskAssessmentId,
        threatType: dbRecord.threatType,
        probability: dbRecord.probability,
        impact: dbRecord.impact as SeverityLevel,
        estimatedTimeframe: dbRecord.estimatedTimeframe,
        confidence: dbRecord.confidence,
        createdAt: dbRecord.createdAt,
      }));
    } catch (error: any) {
      throw new DatabaseError(`Failed to find ThreatPredictions: ${error.message}`, error);
    }
  }

  public async deleteByAssessmentId(riskAssessmentId: string, tx?: any): Promise<boolean> {
    const client = tx || prisma;
    try {
      await client.threatPrediction.deleteMany({
        where: { riskAssessmentId },
      });
      return true;
    } catch (error: any) {
      throw new DatabaseError(`Failed to delete ThreatPredictions: ${error.message}`, error);
    }
  }
}

export class SeverityRepository {
  public async create(
    data: Omit<SeverityHistory, "id" | "createdAt">,
    tx?: any
  ): Promise<SeverityHistory> {
    const client = tx || prisma;
    try {
      const dbRecord = await client.severityHistory.create({
        data: {
          riskAssessmentId: data.riskAssessmentId,
          severity: data.severity,
          score: data.score,
          reason: data.reason,
          changedBy: data.changedBy,
        },
      });
      return {
        id: dbRecord.id,
        riskAssessmentId: dbRecord.riskAssessmentId,
        severity: dbRecord.severity as SeverityLevel,
        score: dbRecord.score,
        reason: dbRecord.reason,
        changedBy: dbRecord.changedBy,
        createdAt: dbRecord.createdAt,
      };
    } catch (error: any) {
      throw new DatabaseError(`Failed to create SeverityHistory: ${error.message}`, error);
    }
  }

  public async findByAssessmentId(riskAssessmentId: string, tx?: any): Promise<SeverityHistory[]> {
    const client = tx || prisma;
    try {
      const records = await client.severityHistory.findMany({
        where: { riskAssessmentId },
      });
      return records.map((dbRecord: any) => ({
        id: dbRecord.id,
        riskAssessmentId: dbRecord.riskAssessmentId,
        severity: dbRecord.severity as SeverityLevel,
        score: dbRecord.score,
        reason: dbRecord.reason,
        changedBy: dbRecord.changedBy,
        createdAt: dbRecord.createdAt,
      }));
    } catch (error: any) {
      throw new DatabaseError(`Failed to find SeverityHistories: ${error.message}`, error);
    }
  }
}

export class PriorityRepository {
  public async create(
    data: Omit<PriorityHistory, "id" | "createdAt">,
    tx?: any
  ): Promise<PriorityHistory> {
    const client = tx || prisma;
    try {
      const dbRecord = await client.priorityHistory.create({
        data: {
          riskAssessmentId: data.riskAssessmentId,
          priority: data.priority,
          score: data.score,
          reason: data.reason,
          changedBy: data.changedBy,
        },
      });
      return {
        id: dbRecord.id,
        riskAssessmentId: dbRecord.riskAssessmentId,
        priority: dbRecord.priority as PriorityLevel,
        score: dbRecord.score,
        reason: dbRecord.reason,
        changedBy: dbRecord.changedBy,
        createdAt: dbRecord.createdAt,
      };
    } catch (error: any) {
      throw new DatabaseError(`Failed to create PriorityHistory: ${error.message}`, error);
    }
  }

  public async findByAssessmentId(riskAssessmentId: string, tx?: any): Promise<PriorityHistory[]> {
    const client = tx || prisma;
    try {
      const records = await client.priorityHistory.findMany({
        where: { riskAssessmentId },
      });
      return records.map((dbRecord: any) => ({
        id: dbRecord.id,
        riskAssessmentId: dbRecord.riskAssessmentId,
        priority: dbRecord.priority as PriorityLevel,
        score: dbRecord.score,
        reason: dbRecord.reason,
        changedBy: dbRecord.changedBy,
        createdAt: dbRecord.createdAt,
      }));
    } catch (error: any) {
      throw new DatabaseError(`Failed to find PriorityHistories: ${error.message}`, error);
    }
  }
}

export class ReasoningRepository {
  public async create(
    data: Omit<ReasoningLog, "id" | "createdAt">,
    tx?: any
  ): Promise<ReasoningLog> {
    const client = tx || prisma;
    try {
      const dbRecord = await client.reasoningLog.create({
        data: {
          riskAssessmentId: data.riskAssessmentId,
          agentName: data.agentName,
          inputPayload: data.inputPayload as any,
          outputPayload: data.outputPayload as any,
          confidence: data.confidence,
          reasoning: data.reasoning,
        },
      });
      return {
        id: dbRecord.id,
        riskAssessmentId: dbRecord.riskAssessmentId,
        agentName: dbRecord.agentName,
        inputPayload: dbRecord.inputPayload as Record<string, any>,
        outputPayload: dbRecord.outputPayload as Record<string, any>,
        confidence: dbRecord.confidence,
        reasoning: dbRecord.reasoning,
        createdAt: dbRecord.createdAt,
      };
    } catch (error: any) {
      throw new DatabaseError(`Failed to create ReasoningLog: ${error.message}`, error);
    }
  }

  public async findByAssessmentId(riskAssessmentId: string, tx?: any): Promise<ReasoningLog[]> {
    const client = tx || prisma;
    try {
      const records = await client.reasoningLog.findMany({
        where: { riskAssessmentId },
      });
      return records.map((dbRecord: any) => ({
        id: dbRecord.id,
        riskAssessmentId: dbRecord.riskAssessmentId,
        agentName: dbRecord.agentName,
        inputPayload: dbRecord.inputPayload as Record<string, any>,
        outputPayload: dbRecord.outputPayload as Record<string, any>,
        confidence: dbRecord.confidence,
        reasoning: dbRecord.reasoning,
        createdAt: dbRecord.createdAt,
      }));
    } catch (error: any) {
      throw new DatabaseError(`Failed to find ReasoningLogs: ${error.message}`, error);
    }
  }
}

export class ProtocolZeroRepository {
  public async create(
    data: Omit<ProtocolZeroRequest, "id" | "createdAt" | "updatedAt">,
    tx?: any
  ): Promise<ProtocolZeroRequest> {
    const client = tx || prisma;
    try {
      const dbRecord = await client.protocolZeroRequest.create({
        data: {
          riskAssessmentId: data.riskAssessmentId,
          status: data.status,
          requestedBy: data.requestedBy,
          reason: data.reason,
          approvedBy: data.approvedBy,
          actionedAt: data.actionedAt,
        },
      });
      return {
        id: dbRecord.id,
        riskAssessmentId: dbRecord.riskAssessmentId,
        status: dbRecord.status as ProtocolZeroStatus,
        requestedBy: dbRecord.requestedBy,
        reason: dbRecord.reason,
        approvedBy: dbRecord.approvedBy,
        actionedAt: dbRecord.actionedAt,
        createdAt: dbRecord.createdAt,
        updatedAt: dbRecord.updatedAt,
      };
    } catch (error: any) {
      throw new DatabaseError(`Failed to create ProtocolZeroRequest: ${error.message}`, error);
    }
  }

  public async findById(id: string, tx?: any): Promise<ProtocolZeroRequest | null> {
    const client = tx || prisma;
    try {
      const dbRecord = await client.protocolZeroRequest.findUnique({
        where: { id },
      });
      if (!dbRecord) return null;
      return {
        id: dbRecord.id,
        riskAssessmentId: dbRecord.riskAssessmentId,
        status: dbRecord.status as ProtocolZeroStatus,
        requestedBy: dbRecord.requestedBy,
        reason: dbRecord.reason,
        approvedBy: dbRecord.approvedBy,
        actionedAt: dbRecord.actionedAt,
        createdAt: dbRecord.createdAt,
        updatedAt: dbRecord.updatedAt,
      };
    } catch (error: any) {
      throw new DatabaseError(`Failed to find ProtocolZeroRequest by ID: ${error.message}`, error);
    }
  }

  public async update(
    id: string,
    data: Partial<Omit<ProtocolZeroRequest, "id" | "riskAssessmentId" | "createdAt" | "updatedAt">>  ,
    tx?: any
  ): Promise<ProtocolZeroRequest> {
    const client = tx || prisma;
    try {
      const dbRecord = await client.protocolZeroRequest.update({
        where: { id },
        data: {
          status: data.status,
          approvedBy: data.approvedBy,
          actionedAt: data.actionedAt,
        },
      });
      return {
        id: dbRecord.id,
        riskAssessmentId: dbRecord.riskAssessmentId,
        status: dbRecord.status as ProtocolZeroStatus,
        requestedBy: dbRecord.requestedBy,
        reason: dbRecord.reason,
        approvedBy: dbRecord.approvedBy,
        actionedAt: dbRecord.actionedAt,
        createdAt: dbRecord.createdAt,
        updatedAt: dbRecord.updatedAt,
      };
    } catch (error: any) {
      throw new DatabaseError(`Failed to update ProtocolZeroRequest: ${error.message}`, error);
    }
  }

  public async findByStatus(status: string, tx?: any): Promise<ProtocolZeroRequest[]> {
    const client = tx || prisma;
    try {
      const records = await client.protocolZeroRequest.findMany({
        where: { status },
      });
      return records.map((dbRecord: any) => ({
        id: dbRecord.id,
        riskAssessmentId: dbRecord.riskAssessmentId,
        status: dbRecord.status as ProtocolZeroStatus,
        requestedBy: dbRecord.requestedBy,
        reason: dbRecord.reason,
        approvedBy: dbRecord.approvedBy,
        actionedAt: dbRecord.actionedAt,
        createdAt: dbRecord.createdAt,
        updatedAt: dbRecord.updatedAt,
      }));
    } catch (error: any) {
      throw new DatabaseError(`Failed to find ProtocolZeroRequests by status: ${error.message}`, error);
    }
  }
}
