import { reasoningEngine, ReasoningInput } from "./reasoning-engine";

export interface ReasoningResult {
  formattedBullets: string[];
  summaryText: string;
}

export class ReasoningService {
  /**
   * Generates a list of brief, bullet-pointed reasoning statements prefixed with checkmarks
   * to display on UI command terminals, while strictly preventing CoT disclosures.
   */
  public generateReasoning(input: ReasoningInput): ReasoningResult {
    const rawResult = reasoningEngine.generateConciseReasoning(input);
    
    // Prefix each reasoning point with the requested checklist indicators
    const formattedBullets = rawResult.bullets.map((bullet) => `✓ ${bullet}`);
    const summaryText = rawResult.summary;

    return {
      formattedBullets,
      summaryText,
    };
  }
}

export const reasoningService = new ReasoningService();
