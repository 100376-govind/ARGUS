import { EvidenceResult } from "../models/evidence-models";

export interface WeatherEvidenceCollector {
  collect(incidentId: string, location: string, conditionsExpected: string): Promise<EvidenceResult>;
}

export interface GoogleSearchEvidenceCollector {
  collect(incidentId: string, query: string): Promise<EvidenceResult>;
}

export interface GoogleMapsEvidenceCollector {
  collect(incidentId: string, coordinates: { lat: number; lng: number } | string): Promise<EvidenceResult>;
}

export interface HistoricalIncidentCollector {
  collect(incidentId: string, location: string, incidentType: string): Promise<EvidenceResult>;
}

export interface NetworkEvidenceCollector {
  collect(incidentId: string): Promise<EvidenceResult>;
}
