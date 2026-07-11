import { PromptTemplate } from "../prompt-manager";

export const explosionPromptTemplate: PromptTemplate = {
  name: "explosion",
  version: "1.0.0",
  template: `
INSTRUCTIONS FOR EXPLOSION RISK ASSESSMENT:
Analyze the explosion scenario using the provided incident facts. Focus on the following critical threat indicators:
1. Blast radius, overpressure damage, and fragmentation/shrapnel threat.
2. Secondary explosions risk (e.g. gas lines, storage tanks, fuel depots).
3. Structural instability of affected facilities and presence of hazardous fires.

FACTS TO ANALYZE:
Incident Description: {{structuredDesc}}
Key Entities Found: {{extractedEntities}}
Metadata: {{metadata}}
`,
};
