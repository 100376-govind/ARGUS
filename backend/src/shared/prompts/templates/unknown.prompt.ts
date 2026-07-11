import { PromptTemplate } from "../prompt-manager";

export const unknownPromptTemplate: PromptTemplate = {
  name: "unknown",
  version: "1.0.0",
  template: `
INSTRUCTIONS FOR GENERIC/UNKNOWN RISK ASSESSMENT:
Analyze the incident scenario using the provided incident facts. Focus on standard risk assessment parameters:
1. Threat type identification and potential for rapid escalation.
2. Exposure of civilians, response crews, and critical infrastructure assets.
3. Clarity and completeness of incident details.

FACTS TO ANALYZE:
Incident Description: {{structuredDesc}}
Key Entities Found: {{extractedEntities}}
Metadata: {{metadata}}
`,
};
