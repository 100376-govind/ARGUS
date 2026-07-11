export enum EvidenceSource {
  CitizenReport = "CitizenReport",
  RiskEvaluator = "RiskEvaluator",
  Weather = "Weather",
  GoogleSearch = "GoogleSearch",
  GoogleMaps = "GoogleMaps",
  HistoricalIncidents = "HistoricalIncidents",
  NetworkIntelligence = "NetworkIntelligence"
}

export interface EvidenceResult {
  source: EvidenceSource;
  confidence: number; // 0 to 100
  status: "success" | "failed" | "degraded" | "unavailable";
  observations: string[];
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface EvidenceWeight {
  source: EvidenceSource;
  weight: number; // Decimal representing percentage (e.g. 0.25 for 25%)
}

export type ValidationStatus = "Verified" | "Likely Valid" | "Needs Manual Verification" | "Unverified";

export interface EvidenceBreakdown {
  source: EvidenceSource;
  confidence: number;
  weight: number;
  weightedContribution: number;
  status: string;
}

export interface FusionResult {
  overallValidationScore: number; // 0 to 100
  validationStatus: ValidationStatus;
  supportingEvidence: string[];
  conflictingEvidence: string[];
  evidenceBreakdown: EvidenceBreakdown[];
}

export interface ValidationReport {
  incidentId: string;
  validationStatus: ValidationStatus;
  validationScore: number;
  evidenceBreakdown: EvidenceBreakdown[];
  supportingEvidence: string[];
  conflictingEvidence: string[];
  summary: string;
  recommendation: string;
  timestamp: number;
}
