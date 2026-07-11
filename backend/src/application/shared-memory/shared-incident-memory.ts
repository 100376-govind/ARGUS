import { IncidentEntity, AgentExecutionRecord } from "@/domain/entities/incident";
import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { logger } from "@/infrastructure/logger/pino";

/**
 * Shared Incident Memory allows any agent in the ARGUS pipeline to read/write
 * structured data about an incident. Each agent appends its execution record
 * to the agentHistory array, enabling full traceability and reasoning chains.
 *
 * This is the coordination layer that enables multi-agent collaboration
 * without coupling agents to each other.
 */
export class SharedIncidentMemory {
  constructor(private readonly incidentRepo: IIncidentRepository) {}

  /**
   * Reads the current state of an incident from the shared memory (database).
   */
  async read(incidentId: string): Promise<IncidentEntity | null> {
    logger.debug({ incidentId }, "SharedMemory: Reading incident state");
    return this.incidentRepo.findById(incidentId);
  }

  /**
   * Writes an agent's execution output back to the incident.
   * Appends the agent execution record to the agentHistory array,
   * merges any updated fields, and increments the version.
   */
  async write(
    incidentId: string,
    agentName: string,
    execution: {
      status: "success" | "failed";
      confidence: number;
      reasoning: string;
      outputData: any;
      errorMessage?: string;
      updatedFields?: Partial<IncidentEntity>;
    }
  ): Promise<IncidentEntity> {
    const startedAt = new Date();

    const current = await this.incidentRepo.findById(incidentId);
    if (!current) {
      throw new Error(`SharedMemory: Incident ${incidentId} not found`);
    }

    const executionRecord: AgentExecutionRecord = {
      agentName,
      status: execution.status,
      confidence: execution.confidence,
      reasoning: execution.reasoning,
      outputData: execution.outputData,
      timestamp: new Date(),
    };

    // Append agent execution to history
    const updatedAgentHistory = [...current.agentHistory, executionRecord];

    // Merge updated fields from the agent
    const mergedUpdates: Partial<IncidentEntity> = {
      ...execution.updatedFields,
      agentHistory: updatedAgentHistory,
    };

    // Persist to repository with audit trail
    const updatedIncident = await this.incidentRepo.update(
      incidentId,
      mergedUpdates,
      `agent:${agentName}`,
      `agent_enrichment:${agentName}`
    );

    // Log agent execution in the dedicated tracking table
    const completedAt = new Date();
    await this.incidentRepo.logAgentExecution({
      agentName,
      incidentId,
      status: execution.status,
      confidence: execution.confidence,
      reasoning: execution.reasoning,
      outputData: execution.outputData,
      errorMessage: execution.errorMessage,
      startedAt,
      completedAt,
    });

    logger.info(
      { incidentId, agentName, status: execution.status, confidence: execution.confidence },
      "SharedMemory: Agent execution recorded"
    );

    return updatedIncident;
  }

  /**
   * Returns the full agent execution chain for a given incident,
   * ordered by timestamp ascending.
   */
  async getAgentChain(incidentId: string): Promise<AgentExecutionRecord[]> {
    const incident = await this.incidentRepo.findById(incidentId);
    if (!incident) return [];
    return incident.agentHistory.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Returns the latest output from a specific agent for a given incident.
   */
  async getLatestAgentOutput(incidentId: string, agentName: string): Promise<AgentExecutionRecord | null> {
    const chain = await this.getAgentChain(incidentId);
    const agentOutputs = chain.filter((e) => e.agentName === agentName);
    return agentOutputs.length > 0 ? agentOutputs[agentOutputs.length - 1] : null;
  }
}
