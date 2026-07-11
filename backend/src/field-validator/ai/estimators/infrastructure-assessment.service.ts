import { NetworkFeatures } from "../../interfaces/ai-interfaces";

export type InfrastructureStatus = "Network Stable" | "Partially Degraded" | "Severely Degraded" | "Offline";

export interface InfrastructureAssessment {
  status: InfrastructureStatus;
  reasoning: string;
}

export class InfrastructureAssessmentService {
  public static assess(features: NetworkFeatures): InfrastructureAssessment {
    if (features.networkAvailability === "Unavailable") {
      return {
        status: "Offline",
        reasoning: "No network connectivity or devices present."
      };
    }

    if (!features.internetReachability) {
      return {
        status: "Severely Degraded",
        reasoning: "Local network exists but internet reachability is lost."
      };
    }

    if (features.packetLossCategory === "Critical" || features.latencyCategory === "Very High") {
      return {
        status: "Severely Degraded",
        reasoning: `Severe performance issues detected: ${features.packetLossCategory} packet loss, ${features.latencyCategory} latency.`
      };
    }

    if (features.packetLossCategory === "High" || features.latencyCategory === "High" || features.signalStrengthCategory === "Critical") {
      return {
        status: "Partially Degraded",
        reasoning: `Noticeable performance drops: ${features.packetLossCategory} packet loss, ${features.latencyCategory} latency, ${features.signalStrengthCategory} signal.`
      };
    }

    return {
      status: "Network Stable",
      reasoning: "Network metrics are within acceptable operational thresholds."
    };
  }
}
