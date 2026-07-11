import { PromptTemplate } from "../prompt-manager";

export const earthquakePromptTemplate: PromptTemplate = {
  name: "earthquake",
  version: "1.0.0",
  template: `
INSTRUCTIONS FOR EARTHQUAKE RISK ASSESSMENT:
Analyze the earthquake scenario using the provided incident facts. Focus on the following critical threat indicators:
1. Magnitude, shaking intensity, and occurrence of structural collapses or gas/water main breaks.
2. Threat of aftershocks, secondary hazards (tsunamis, landslides, fires).
3. Density of affected urban area and capacity of local first responder assets.

FACTS TO ANALYZE:
Incident Description: {{structuredDesc}}
Key Entities Found: {{extractedEntities}}
Metadata: {{metadata}}
`,
};
