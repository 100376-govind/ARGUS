import { ExtractedEntities } from "../entities/incident";

export interface AIDispatchResult {
  incidentType: string;
  structuredDesc: string;
  confidence: number;
  locationName?: string | null;
  lat?: number | null;
  lng?: number | null;
  extractedEntities: ExtractedEntities;
  reasoning: string;
  tags: string[];
}

export interface IAIClient {
  /**
   * Normalizes raw unstructured crisis text/data into clean structured json schema.
   */
  normalizeIncident(content: string, mimeType?: string): Promise<AIDispatchResult>;

  /**
   * Transcribes speech audio file to clear text.
   */
  transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string>;
}
