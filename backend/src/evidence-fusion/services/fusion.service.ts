import { EvidenceResult, FusionResult, EvidenceBreakdown, EvidenceSource } from "../models/evidence-models";
import { EvidenceWeightEngine } from "../config/weight-engine";
import { ConflictDetectionService } from "./conflict-detection.service";
import { ValidationSummaryService } from "./validation-summary.service";
import { FieldValidatorLogger } from "../../field-validator/utils/field-validator-logger";

export class EvidenceFusionService {
  private logger = new FieldValidatorLogger("EvidenceFusionService");

  constructor(
    private readonly weightEngine: EvidenceWeightEngine,
    private readonly conflictDetector: ConflictDetectionService,
    private readonly summaryService: ValidationSummaryService
  ) {}

  public async fuse(evidences: EvidenceResult[]): Promise<FusionResult> {
    const start = performance.now();
    this.logger.debug("Evidence Fusion Started");

    // 1. Calculate Weighted Score
    let totalScore = 0;
    let totalAppliedWeight = 0;
    const evidenceBreakdown: EvidenceBreakdown[] = [];

    // Filter available evidence for weighting calculation
    for (const source of Object.values(EvidenceSource)) {
      const weight = this.weightEngine.getWeight(source);
      const ev = evidences.find(e => e.source === source);

      if (ev && ev.status !== "unavailable") {
        const weightedContribution = ev.confidence * weight;
        totalScore += weightedContribution;
        totalAppliedWeight += weight;

        evidenceBreakdown.push({
          source,
          confidence: ev.confidence,
          weight,
          weightedContribution,
          status: ev.status
        });
      } else {
        // Reduced confidence penalty for missing sources (do not fabricate, decrease confidence instead)
        evidenceBreakdown.push({
          source,
          confidence: 0,
          weight,
          weightedContribution: 0,
          status: "unavailable"
        });
      }
    }

    // Scale score to 0-100 base if weights don't sum to exactly 1.0 due to missing metrics
    const finalScore = totalAppliedWeight > 0 
      ? Math.round(totalScore / totalAppliedWeight) 
      : 50; // Fallback score if no evidence exists

    const overallValidationScore = Math.max(0, Math.min(100, finalScore));

    // 2. Conflict Assessment
    const conflictAssessment = this.conflictDetector.detectConflicts(evidences);

    // 3. Status mapping based on score thresholds (Verified, Likely Valid, Needs Manual Verification, Unverified)
    let validationStatus: "Verified" | "Likely Valid" | "Needs Manual Verification" | "Unverified";
    if (overallValidationScore >= 90) {
      validationStatus = "Verified";
    } else if (overallValidationScore >= 70) {
      validationStatus = "Likely Valid";
    } else if (overallValidationScore >= 40) {
      validationStatus = "Needs Manual Verification";
    } else {
      validationStatus = "Unverified";
    }

    const duration = performance.now() - start;
    this.logger.debug("Fusion Completed", { overallValidationScore, validationStatus });
    this.logger.performance("fuseEvidence", duration);

    return {
      overallValidationScore,
      validationStatus,
      supportingEvidence: conflictAssessment.supportingObservations,
      conflictingEvidence: conflictAssessment.conflictingObservations,
      evidenceBreakdown
    };
  }
}
