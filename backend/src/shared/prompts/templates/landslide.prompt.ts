import { PromptTemplate } from "../prompt-manager";

export const landslidePromptTemplate: PromptTemplate = {
  name: "landslide",
  version: "1.0.0",
  template: `
INSTRUCTIONS FOR LANDSLIDE RISK ASSESSMENT:
Analyze the landslide or mudslide scenario using the provided incident facts. Focus on the following critical threat indicators:
1. Volume of displaced material and speed of movement/flow.
2. Obstruction of river channels (causing sudden upstream flooding/dams) and critical corridors.
3. Damage to houses, infrastructure, power poles, and ongoing risk of slope failure.

FACTS TO ANALYZE:
Incident Description: {{structuredDesc}}
Key Entities Found: {{extractedEntities}}
Metadata: {{metadata}}
`,
};
