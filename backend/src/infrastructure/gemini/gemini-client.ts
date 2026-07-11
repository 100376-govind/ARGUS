import { GoogleGenAI, Type } from "@google/genai";
import { IAIClient, AIDispatchResult } from "@/domain/services/ai-client";
import { env } from "@/shared/config/env";
import { logger } from "@/infrastructure/logger/pino";
import { BadGatewayError } from "@/shared/errors/app-error";
import { geminiIncidentResponseSchema } from "@/shared/validation/incident";

export class GeminiClient implements IAIClient {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  private getDispatcherSchema() {
    return {
      type: Type.OBJECT,
      properties: {
        incidentType: { type: Type.STRING, description: "Type of incident (e.g., chemical_spill, fire, flood, medical_emergency, grid_failure, structure_damage)" },
        structuredDesc: { type: Type.STRING, description: "Objective, concise and complete summary of the incident in standard English" },
        confidence: { type: Type.NUMBER, description: "Confidence score from 0.0 to 100.0 based on information clarity and completeness" },
        locationName: { type: Type.STRING, nullable: true, description: "Extracted name of the location, street, neighborhood, building, landmark" },
        lat: { type: Type.NUMBER, nullable: true, description: "Extracted decimal GPS latitude coordinate if explicitly stated" },
        lng: { type: Type.NUMBER, nullable: true, description: "Extracted decimal GPS longitude coordinate if explicitly stated" },
        extractedEntities: {
          type: Type.OBJECT,
          properties: {
            locations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Location references found in text" },
            hazards: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Hazards e.g. toxic waste, gas leakage, open flames" },
            people: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific names or counts of victims/individuals mentioned" },
            vehicles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Vehicles mentioned e.g., license plates, truck types, aircrafts" },
            organizations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Involved companies, departments, or entities" },
          },
          required: ["locations", "hazards", "people", "vehicles", "organizations"],
        },
        reasoning: { type: Type.STRING, description: "Reasoning for the classification, details extracted, and confidence assignment" },
        tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key categorization tags e.g. chemical, hazmat, fire, power" },
      },
      required: [
        "incidentType",
        "structuredDesc",
        "confidence",
        "extractedEntities",
        "reasoning",
        "tags",
      ],
    };
  }

  async normalizeIncident(content: string, mimeType?: string): Promise<AIDispatchResult> {
    const systemPrompt = `You are the Data Dispatcher agent for ARGUS, an enterprise Crisis Command Platform.
Your sole responsibility is to extract facts, summarize incidents, and normalize unstructured inputs (such as reports, text logs, SMS, social media posts) into a clean, structured JSON object.

Follow these strict constraints:
1. NEVER calculate or determine incident severity or priority level (as that is the responsibility of the Risk Evaluator).
2. NEVER make rescue, resource allocation, or field dispatch decisions (as that is the responsibility of the Resource Allocator).
3. Translate non-English content (Hindi, Bengali, mixed languages, etc.) into clean standard English.
4. If location is mentioned, attempt to parse its locationName, lat, and lng. If no coordinates are mentioned, return null for lat and lng.
5. You must output valid JSON matching the exact schema provided.`;

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        logger.debug({ attempt, contentLength: content.length }, "Calling Gemini 2.5 Pro for incident normalization");

        const response = await this.ai.models.generateContent({
          model: "gemini-2.5-pro",
          contents: mimeType 
            ? [
                {
                  inlineData: {
                    mimeType,
                    data: content // base64 encoded media string
                  }
                },
                "Analyze this media file and extract the structured incident report details."
              ]
            : content,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: this.getDispatcherSchema(),
            temperature: 0.1, // low temperature for deterministic classifications
          }
        });

        const rawText = response.text;
        if (!rawText) {
          throw new Error("Gemini returned empty response text");
        }

        const parsed = JSON.parse(rawText);
        
        // Zod validation of AI response output
        const validated = geminiIncidentResponseSchema.parse(parsed);

        logger.info({ confidence: validated.confidence, type: validated.incidentType }, "Incident normalized successfully by Gemini");
        return validated as AIDispatchResult;

      } catch (error) {
        logger.warn({ error: error instanceof Error ? error.message : error, attempt }, "Gemini normalization attempt failed");
        
        if (attempt >= maxRetries) {
          logger.error({ error, content }, "Gemini normalization failed after all retries");
          throw new BadGatewayError("AI normalization failed after multiple attempts", error);
        }

        // Wait before retry (exponential backoff)
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }

    throw new BadGatewayError("AI normalization failed unexpectedly");
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const base64Audio = audioBuffer.toString("base64");
    
    try {
      logger.debug({ mimeType, sizeBytes: audioBuffer.length }, "Transcribing speech audio with Gemini 2.5 Pro");

      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
          "Transcribe this emergency voice recording verbatim. If in Hindi, Bengali, or mixed languages, transcribe the exact spoken words first, then provide a translation below it. Keep formatting clean.",
        ],
        config: {
          temperature: 0.2,
        }
      });

      const transcriptionText = response.text;
      if (!transcriptionText) {
        throw new Error("Gemini transcription returned empty response");
      }

      logger.info("Speech audio transcribed successfully");
      return transcriptionText;
    } catch (error) {
      logger.error({ error }, "Failed to transcribe audio with Gemini API");
      throw new BadGatewayError("Gemini audio transcription failed", error);
    }
  }
}

export const aiClient = new GeminiClient();
