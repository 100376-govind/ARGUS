import { ValidationConfidenceCalculator } from "../ai/inference/validation-confidence-calculator";
import { EnvironmentalInferenceResult } from "../interfaces/ai-interfaces";

describe("ValidationConfidenceCalculator", () => {
  it("should calculate blended confidence correctly", () => {
    const inference: EnvironmentalInferenceResult = {
      environmentalInference: [],
      summary: "",
      occupancyConfidence: 80, // 80 * 0.5 = 40
      infrastructureConfidence: 60, // 60 * 0.3 = 18
      communicationConfidence: 90, // 90 * 0.2 = 18
      validationConfidence: 70 // AI's base confidence
    };
    
    // Heuristic = 40 + 18 + 18 = 76
    // Final = (76 * 0.6) + (70 * 0.4) = 45.6 + 28 = 73.6 -> Math.round -> 74
    
    const result = ValidationConfidenceCalculator.calculateOverallConfidence(inference);
    expect(result).toBe(74);
  });

  it("should bound negative inputs to 0", () => {
    const inference: EnvironmentalInferenceResult = {
      environmentalInference: [], summary: "",
      occupancyConfidence: -50, infrastructureConfidence: -10, communicationConfidence: -100, validationConfidence: -20
    };
    expect(ValidationConfidenceCalculator.calculateOverallConfidence(inference)).toBe(0);
  });

  it("should execute in less than 20ms", () => {
    const inference: EnvironmentalInferenceResult = {
      environmentalInference: [], summary: "",
      occupancyConfidence: 50, infrastructureConfidence: 50, communicationConfidence: 50, validationConfidence: 50
    };
    
    const start = performance.now();
    ValidationConfidenceCalculator.calculateOverallConfidence(inference);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(20);
  });
});
