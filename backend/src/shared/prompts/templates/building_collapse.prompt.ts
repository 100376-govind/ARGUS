import { PromptTemplate } from "../prompt-manager";

export const buildingCollapsePromptTemplate: PromptTemplate = {
  name: "building_collapse",
  version: "1.0.0",
  template: `
INSTRUCTIONS FOR BUILDING COLLAPSE RISK ASSESSMENT:
Analyze the structural collapse scenario using the provided incident facts. Focus on the following critical threat indicators:
1. Occupancy details and potential count of trapped occupants.
2. Stability of remaining structure, debris hazards, and threat to neighboring structures.
3. Utility integrity (gas leaks, live power lines, severed water mains) inside the wreckage.

FACTS TO ANALYZE:
Incident Description: {{structuredDesc}}
Key Entities Found: {{extractedEntities}}
Metadata: {{metadata}}
`,
};
