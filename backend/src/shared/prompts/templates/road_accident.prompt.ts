import { PromptTemplate } from "../prompt-manager";

export const roadAccidentPromptTemplate: PromptTemplate = {
  name: "road_accident",
  version: "1.0.0",
  template: `
INSTRUCTIONS FOR ROAD ACCIDENT RISK ASSESSMENT:
Analyze the vehicle collision scenario using the provided incident facts. Focus on the following critical threat indicators:
1. Scale of collision (multi-vehicle pile-ups, involvement of heavy freight/buses/HAZMAT trucks).
2. Blockage of major arterial roads/freeways, secondary crash potential.
3. Civilian entrapment and vehicle fires/leaks.

FACTS TO ANALYZE:
Incident Description: {{structuredDesc}}
Key Entities Found: {{extractedEntities}}
Metadata: {{metadata}}
`,
};
