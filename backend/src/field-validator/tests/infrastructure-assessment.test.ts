import { InfrastructureAssessmentService } from "../ai/estimators/infrastructure-assessment.service";
import { NetworkFeatures } from "../interfaces/ai-interfaces";

describe("InfrastructureAssessmentService", () => {
  const baseFeatures: NetworkFeatures = {
    connectedDevices: 5,
    activeDevices: 3,
    inactiveDevices: 2,
    signalStrengthCategory: "Good",
    packetLossCategory: "Low",
    latencyCategory: "Low",
    bandwidthUsageCategory: "Medium",
    networkHealth: "Good",
    internetReachability: true,
    connectionStability: "Stable",
    networkAvailability: "Available"
  };

  it("should assess as 'Network Stable'", () => {
    const assessment = InfrastructureAssessmentService.assess(baseFeatures);
    expect(assessment.status).toBe("Network Stable");
  });

  it("should assess as 'Offline'", () => {
    const features = { ...baseFeatures, networkAvailability: "Unavailable" };
    const assessment = InfrastructureAssessmentService.assess(features);
    expect(assessment.status).toBe("Offline");
  });

  it("should assess as 'Severely Degraded' without internet", () => {
    const features = { ...baseFeatures, internetReachability: false };
    const assessment = InfrastructureAssessmentService.assess(features);
    expect(assessment.status).toBe("Severely Degraded");
  });

  it("should assess as 'Partially Degraded' with high packet loss", () => {
    const features = { ...baseFeatures, packetLossCategory: "High" };
    const assessment = InfrastructureAssessmentService.assess(features);
    expect(assessment.status).toBe("Partially Degraded");
  });
});
