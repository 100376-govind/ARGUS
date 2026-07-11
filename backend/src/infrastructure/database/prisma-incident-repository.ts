import { prisma } from "./prisma-client";
import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { IncidentEntity, ReporterEntity, MediaEntity, ExtractedEntities, AgentExecutionRecord, AuditLogEntry } from "@/domain/entities/incident";
import { NotFoundError } from "@/shared/errors/app-error";

export class PrismaIncidentRepository implements IIncidentRepository {
  private mapToEntity(dbInc: any): IncidentEntity {
    return {
      id: dbInc.id,
      version: dbInc.version,
      status: dbInc.status,
      source: dbInc.source,
      incidentType: dbInc.incidentType,
      rawContent: dbInc.rawContent,
      structuredDesc: dbInc.structuredDesc,
      confidence: dbInc.confidence,
      lat: dbInc.lat,
      lng: dbInc.lng,
      locationName: dbInc.locationName,
      extractedEntities: dbInc.extractedEntities as unknown as ExtractedEntities,
      agentHistory: dbInc.agentHistory as unknown as AgentExecutionRecord[],
      auditTrail: dbInc.auditTrail as unknown as AuditLogEntry[],
      metadata: dbInc.metadata,
      tags: dbInc.tags,
      reporterId: dbInc.reporterId,
      reporter: dbInc.reporter ? {
        id: dbInc.reporter.id,
        name: dbInc.reporter.name,
        email: dbInc.reporter.email,
        phone: dbInc.reporter.phone,
        role: dbInc.reporter.role,
        metadata: dbInc.reporter.metadata,
        createdAt: dbInc.reporter.createdAt,
        updatedAt: dbInc.reporter.updatedAt,
      } : null,
      media: dbInc.media ? dbInc.media.map((m: any) => ({
        id: m.id,
        url: m.url,
        type: m.type,
        metadata: m.metadata,
        incidentId: m.incidentId,
        createdAt: m.createdAt,
      })) : [],
      createdAt: dbInc.createdAt,
      updatedAt: dbInc.updatedAt,
    };
  }

  async findById(id: string): Promise<IncidentEntity | null> {
    const dbInc = await prisma.incident.findUnique({
      where: { id },
      include: {
        reporter: true,
        media: true,
      },
    });
    return dbInc ? this.mapToEntity(dbInc) : null;
  }

  async findAll(filters?: {
    status?: string;
    incidentType?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): Promise<IncidentEntity[]> {
    const dbIncs = await prisma.incident.findMany({
      where: {
        status: filters?.status,
        incidentType: filters?.incidentType,
        source: filters?.source,
      },
      include: {
        reporter: true,
        media: true,
      },
      orderBy: { createdAt: "desc" },
      take: filters?.limit,
      skip: filters?.offset,
    });
    return dbIncs.map((dbInc) => this.mapToEntity(dbInc));
  }

  async create(incident: Omit<IncidentEntity, "createdAt" | "updatedAt">): Promise<IncidentEntity> {
    const dbInc = await prisma.incident.create({
      data: {
        id: incident.id,
        version: incident.version,
        status: incident.status,
        source: incident.source,
        incidentType: incident.incidentType,
        rawContent: incident.rawContent,
        structuredDesc: incident.structuredDesc,
        confidence: incident.confidence,
        lat: incident.lat,
        lng: incident.lng,
        locationName: incident.locationName,
        extractedEntities: incident.extractedEntities as any,
        agentHistory: incident.agentHistory as any,
        auditTrail: incident.auditTrail as any,
        metadata: incident.metadata,
        tags: incident.tags,
        reporterId: incident.reporterId,
      },
      include: {
        reporter: true,
        media: true,
      },
    });
    return this.mapToEntity(dbInc);
  }

  async update(id: string, updates: Partial<IncidentEntity>, changedBy: string, actionName: string): Promise<IncidentEntity> {
    // Fetch current to maintain versioning and construct audit log changes list
    const current = await this.findById(id);
    if (!current) {
      throw new NotFoundError(`Incident with ID ${id} not found`);
    }

    const nextVersion = current.version + 1;
    
    // Construct changes array
    const changes: any[] = [];
    const fieldsToTrack: (keyof Partial<IncidentEntity>)[] = [
      "status",
      "incidentType",
      "structuredDesc",
      "confidence",
      "lat",
      "lng",
      "locationName",
      "tags",
    ];

    fieldsToTrack.forEach((field) => {
      if (updates[field] !== undefined && JSON.stringify(updates[field]) !== JSON.stringify(current[field])) {
        changes.push({
          field,
          from: current[field],
          to: updates[field],
        });
      }
    });

    const nextAuditEntry: AuditLogEntry = {
      version: nextVersion,
      changedBy,
      action: actionName,
      timestamp: new Date(),
      changes,
    };

    const nextAuditTrail = [...current.auditTrail, nextAuditEntry];

    // Combine updates for DB write
    const dbUpdates: any = {
      version: nextVersion,
      auditTrail: nextAuditTrail as any,
    };

    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.incidentType !== undefined) dbUpdates.incidentType = updates.incidentType;
    if (updates.structuredDesc !== undefined) dbUpdates.structuredDesc = updates.structuredDesc;
    if (updates.confidence !== undefined) dbUpdates.confidence = updates.confidence;
    if (updates.lat !== undefined) dbUpdates.lat = updates.lat;
    if (updates.lng !== undefined) dbUpdates.lng = updates.lng;
    if (updates.locationName !== undefined) dbUpdates.locationName = updates.locationName;
    if (updates.extractedEntities !== undefined) dbUpdates.extractedEntities = updates.extractedEntities as any;
    if (updates.agentHistory !== undefined) dbUpdates.agentHistory = updates.agentHistory as any;
    if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;

    const dbInc = await prisma.$transaction(async (tx) => {
      // Log in dedicated audit logs table as well
      await tx.auditLog.create({
        data: {
          incidentId: id,
          changedBy,
          action: actionName,
          oldValue: {
            status: current.status,
            incidentType: current.incidentType,
            structuredDesc: current.structuredDesc,
          } as any,
          newValue: updates as any,
        },
      });

      return tx.incident.update({
        where: { id },
        data: dbUpdates,
        include: {
          reporter: true,
          media: true,
        },
      });
    });

    return this.mapToEntity(dbInc);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.incident.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  async createReporter(reporter: Omit<ReporterEntity, "createdAt" | "updatedAt">): Promise<ReporterEntity> {
    const dbRep = await prisma.reporter.create({
      data: {
        id: reporter.id,
        name: reporter.name,
        email: reporter.email,
        phone: reporter.phone,
        role: reporter.role,
        metadata: reporter.metadata,
      },
    });
    return {
      id: dbRep.id,
      name: dbRep.name,
      email: dbRep.email,
      phone: dbRep.phone,
      role: dbRep.role,
      metadata: dbRep.metadata,
      createdAt: dbRep.createdAt,
      updatedAt: dbRep.updatedAt,
    };
  }

  async findReporterById(id: string): Promise<ReporterEntity | null> {
    const dbRep = await prisma.reporter.findUnique({
      where: { id },
    });
    return dbRep ? {
      id: dbRep.id,
      name: dbRep.name,
      email: dbRep.email,
      phone: dbRep.phone,
      role: dbRep.role,
      metadata: dbRep.metadata,
      createdAt: dbRep.createdAt,
      updatedAt: dbRep.updatedAt,
    } : null;
  }

  async addMedia(media: Omit<MediaEntity, "createdAt">): Promise<MediaEntity> {
    const dbMedia = await prisma.media.create({
      data: {
        id: media.id,
        url: media.url,
        type: media.type,
        metadata: media.metadata,
        incidentId: media.incidentId,
      },
    });
    return {
      id: dbMedia.id,
      url: dbMedia.url,
      type: dbMedia.type,
      metadata: dbMedia.metadata,
      incidentId: dbMedia.incidentId,
      createdAt: dbMedia.createdAt,
    };
  }

  async logAgentExecution(execution: {
    agentName: string;
    incidentId: string;
    status: "success" | "failed";
    confidence: number;
    reasoning: string;
    outputData: any;
    errorMessage?: string;
    startedAt: Date;
    completedAt: Date;
  }): Promise<void> {
    await prisma.agentExecution.create({
      data: {
        agentName: execution.agentName,
        incidentId: execution.incidentId,
        status: execution.status,
        confidence: execution.confidence,
        reasoning: execution.reasoning,
        outputData: execution.outputData,
        errorMessage: execution.errorMessage,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
      },
    });
  }
}
