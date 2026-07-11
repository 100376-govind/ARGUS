import { EvidenceResult, EvidenceSource } from "../models/evidence-models";
import { FieldValidatorLogger } from "../../field-validator/utils/field-validator-logger";

export class EvidenceNormalizationService {
  private logger = new FieldValidatorLogger("EvidenceNormalizationService");

  public normalize(
    source: EvidenceSource,
    rawResult: any
  ): EvidenceResult {
    const start = performance.now();
    this.logger.debug(`Normalizing evidence from source: ${source}`);

    let confidence = 0;
    let status: "success" | "failed" | "degraded" | "unavailable" = "unavailable";
    let observations: string[] = [];
    let metadata: Record<string, any> = {};

    try {
      if (rawResult) {
        confidence = typeof rawResult.confidence === "number" ? Math.max(0, Math.min(100, rawResult.confidence)) : 0;
        status = ["success", "failed", "degraded", "unavailable"].includes(rawResult.status)
          ? rawResult.status
          : "unavailable";
        observations = Array.isArray(rawResult.observations) ? rawResult.observations : [];
        metadata = rawResult.metadata || {};
      }
    } catch (err) {
      this.logger.error(`Error normalizing evidence from ${source}`, err as Error);
    }

    const duration = performance.now() - start;
    this.logger.performance("normalizeEvidence", duration);

    return {
      source,
      confidence,
      status,
      observations,
      timestamp: Date.now(),
      metadata
    };
  }
}
