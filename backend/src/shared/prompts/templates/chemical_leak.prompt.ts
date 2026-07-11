import { PromptTemplate } from "../prompt-manager";

export const chemicalLeakPromptTemplate: PromptTemplate = {
  name: "chemical_leak",
  version: "1.0.0",
  template: `
INSTRUCTIONS FOR CHEMICAL LEAK RISK ASSESSMENT:
Analyze the hazardous material spill or toxic leak scenario using the provided incident facts. Focus on the following critical threat indicators:
1. Toxicity, volatility, and flammability of the spilled material.
2. Atmospheric dispersion, wind direction, and proximity to densely populated or sensitive areas.
3. Ground/water contamination risk and required containment protocols.

FACTS TO ANALYZE:
Incident Description: {{structuredDesc}}
Key Entities Found: {{extractedEntities}}
Metadata: {{metadata}}
`,
};
