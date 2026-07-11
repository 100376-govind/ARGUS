import { PromptTemplate } from "../prompt-manager";

export const firePromptTemplate: PromptTemplate = {
  name: "fire",
  version: "1.0.0",
  template: `
INSTRUCTIONS FOR FIRE RISK ASSESSMENT:
Analyze the fire scenario using the provided incident facts. Focus on the following critical threat indicators:
1. Fire propagation speed, wind factors, and fuel load (e.g., forest, residential, industrial).
2. Proximity to high-hazard facilities (gas stations, chemical plants, schools, hospitals).
3. Smoke inhalation threats and availability of evacuation corridors.

FACTS TO ANALYZE:
Incident Description: {{structuredDesc}}
Key Entities Found: {{extractedEntities}}
Metadata: {{metadata}}
`,
};
