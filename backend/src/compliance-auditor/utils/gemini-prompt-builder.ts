export class GeminiPromptBuilder {
  public static buildPrompt(structuredInput: Record<string, any>): string {
    const formattedData = JSON.stringify(structuredInput, null, 2);

    return `You are the Compliance Auditor for ARGUS (AI-powered Multi-Agent Crisis Command Platform).
Your task is to analyze the provided structured incident data, timeline, and agent history, and generate an AI-powered compliance and audit report.

Below is the structured incident context:
${formattedData}

Generate the following report sections:
1. Situation Report (SITREP): High-level operational summary of the crisis.
2. Incident Summary: Background details, incident type, source, and severity.
3. Decision Summary: Assessment of the priority, validated information, and resource allocations.
4. Compliance Report: Assessment of how compliant the agent executions were.
5. Recommendations: Specific recommendations for future crisis response improvement.

Return your response strictly as a JSON object matching the schema below.
Do not include any explanation, code fences, markdown syntax, or chain-of-thought reasoning outside the JSON format. The response must be pure JSON.

JSON Schema:
{
  "sitrep": "A string containing the Situation Report (SITREP)",
  "incidentSummary": "A string containing the Incident Summary",
  "decisionSummary": "A string containing the Decision Summary",
  "complianceStatus": "A string explaining the compliance assessment",
  "recommendations": ["A list of recommendation strings"]
}
`;
  }
}
