import { vi } from "vitest";
import { EnvironmentalAnalysisService } from "../ai/gemini/environmental-analysis.service";
import { NetworkFeatures } from "../interfaces/ai-interfaces";

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            environmentalInference: ["Network activity suggests possible occupancy."],
            validationConfidence: 85,
            occupancyConfidence: 80,
            communicationConfidence: 90,
            infrastructureConfidence: 85,
            summary: "Network conditions are stable and suggest human presence." // presence will be sanitized later
          })
        })
      }
    }))
  };
});

describe("EnvironmentalAnalysisService", () => {
  let service: EnvironmentalAnalysisService;

  const baseFeatures: NetworkFeatures = {
    connectedDevices: 5, activeDevices: 3, inactiveDevices: 2,
    signalStrengthCategory: "Good", packetLossCategory: "Low", latencyCategory: "Low",
    bandwidthUsageCategory: "Medium", networkHealth: "Good",
    internetReachability: true, connectionStability: "Stable", networkAvailability: "Available"
  };

  beforeEach(() => {
    service = new EnvironmentalAnalysisService();
  });

  it("should successfully analyze and return validated JSON", async () => {
    const result = await service.analyze(baseFeatures, "Likely Occupied", { status: "Network Stable", reasoning: "OK" });
    expect(result.validationConfidence).toBe(85);
    expect(result.environmentalInference.length).toBe(1);
  });
});
