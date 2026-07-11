import { PromptTemplate } from "../prompt-manager";

export const floodPromptTemplate: PromptTemplate = {
  name: "flood",
  version: "1.0.0",
  template: `
INSTRUCTIONS FOR FLOOD RISK ASSESSMENT:
Analyze the flood scenario using the provided incident facts. Focus on the following critical threat indicators:
1. Water level rise rates and current heights relative to flood barriers/banks.
2. Inundation zones, threat to vital utilities (substations, water plants), and major roadways.
3. Entrapment risks for civilian population and structural integrity of flooded buildings.

FACTS TO ANALYZE:
Incident Description: {{structuredDesc}}
Key Entities Found: {{extractedEntities}}
Metadata: {{metadata}}
`,
};
