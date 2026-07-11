import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { NetworkSnapshotModel, ValidationEvidenceModel, NetworkStatisticsModel } from "../models/network-models";
import { EnvironmentalInferenceResult } from "../interfaces/ai-interfaces";

export class FieldValidatorSharedMemoryIntegration {
  constructor(private readonly sharedMemory: SharedIncidentMemory) {}

  public async appendNetworkSnapshot(incidentId: string, snapshot: NetworkSnapshotModel): Promise<void> {
    const existing = await this.sharedMemory.read(incidentId);
    if (!existing) throw new Error(`Incident ${incidentId} not found`);
    
    await this.sharedMemory.write(incidentId, "field-validator", {
      status: "success",
      confidence: 100,
      reasoning: "Network snapshot collected successfully",
      outputData: {
        type: "network-snapshot",
        data: snapshot,
        timestamp: Date.now()
      }
    });
  }

  public async appendValidationEvidence(incidentId: string, evidence: ValidationEvidenceModel): Promise<void> {
    const existing = await this.sharedMemory.read(incidentId);
    if (!existing) throw new Error(`Incident ${incidentId} not found`);

    await this.sharedMemory.write(incidentId, "field-validator", {
      status: evidence.isValid ? "success" : "failed",
      confidence: evidence.inference.confidenceScore,
      reasoning: evidence.notes,
      outputData: {
        type: "validation-evidence",
        data: evidence,
        timestamp: Date.now()
      }
    });
  }

  public async appendNetworkMetrics(incidentId: string, metrics: NetworkStatisticsModel): Promise<void> {
    const existing = await this.sharedMemory.read(incidentId);
    if (!existing) throw new Error(`Incident ${incidentId} not found`);

    await this.sharedMemory.write(incidentId, "field-validator", {
      status: "success",
      confidence: 100,
      reasoning: "Network metrics compiled",
      outputData: {
        type: "network-metrics",
        data: metrics,
        timestamp: Date.now()
      }
    });
  }

  public async appendEnvironmentalInference(
    incidentId: string, 
    inference: EnvironmentalInferenceResult,
    features: any
  ): Promise<void> {
    const existing = await this.sharedMemory.read(incidentId);
    if (!existing) throw new Error(`Incident ${incidentId} not found`);

    await this.sharedMemory.write(incidentId, "field-validator", {
      status: "success",
      confidence: inference.validationConfidence,
      reasoning: "Environmental inference generated via network topology",
      outputData: {
        type: "environmental-inference",
        networkFeatures: features,
        environmentalInference: inference.environmentalInference,
        validationConfidence: inference.validationConfidence,
        occupancyConfidence: inference.occupancyConfidence,
        communicationConfidence: inference.communicationConfidence,
        infrastructureConfidence: inference.infrastructureConfidence,
        analysisTimestamp: Date.now()
      }
    });
  }
}
