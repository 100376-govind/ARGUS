import { EvidenceResult, EvidenceSource } from "../models/evidence-models";
import { FieldValidatorLogger } from "../../field-validator/utils/field-validator-logger";

export interface ConflictAssessment {
  conflictingObservations: string[];
  supportingObservations: string[];
}

export class ConflictDetectionService {
  private logger = new FieldValidatorLogger("ConflictDetectionService");

  public detectConflicts(evidences: EvidenceResult[]): ConflictAssessment {
    const start = performance.now();
    this.logger.debug("Conflict Detection Started");

    const conflictingObservations: string[] = [];
    const supportingObservations: string[] = [];

    const getEv = (src: EvidenceSource) => evidences.find(e => e.source === src);

    const citizenReport = getEv(EvidenceSource.CitizenReport);
    const weather = getEv(EvidenceSource.Weather);
    const historical = getEv(EvidenceSource.HistoricalIncidents);
    const network = getEv(EvidenceSource.NetworkIntelligence);

    if (citizenReport) {
      const isFloodReport = citizenReport.observations.some(obs => obs.toLowerCase().includes("flood"));
      const isCollapseReport = citizenReport.observations.some(obs => obs.toLowerCase().includes("collapse") || obs.toLowerCase().includes("seismic") || obs.toLowerCase().includes("earthquake"));

      // Weather Conflict Heuristics
      if (weather && weather.status === "success") {
        const noRain = weather.observations.some(obs => obs.toLowerCase().includes("no rain") || obs.toLowerCase().includes("clear sky") || obs.toLowerCase().includes("dry"));
        const rainOrStorm = weather.observations.some(obs => obs.toLowerCase().includes("rain") || obs.toLowerCase().includes("storm") || obs.toLowerCase().includes("precipitation"));

        if (isFloodReport && noRain) {
          conflictingObservations.push("Citizen reports flooding, but weather reports no recent precipitation.");
        } else if (isFloodReport && rainOrStorm) {
          supportingObservations.push("Weather records verify precipitation, supporting the flooding report.");
        }
      }

      // Historical Incidents Support Heuristics
      if (historical && historical.status === "success") {
        const isSeismicZone = historical.observations.some(obs => obs.toLowerCase().includes("seismic") || obs.toLowerCase().includes("fault line") || obs.toLowerCase().includes("earthquake-prone"));
        const isFloodZone = historical.observations.some(obs => obs.toLowerCase().includes("flood-prone") || obs.toLowerCase().includes("low-lying"));

        if (isCollapseReport && isSeismicZone) {
          supportingObservations.push("Seismic history confirms location is prone to geological instability, supporting structural damage reports.");
        }
        if (isFloodReport && isFloodZone) {
          supportingObservations.push("Historical incidents confirm flood-prone geography.");
        }
      }

      // Network Support Heuristics
      if (network && network.status === "success") {
        const activeDevices = network.observations.some(obs => obs.toLowerCase().includes("active") || obs.toLowerCase().includes("occupancy"));
        const degradedInfra = network.observations.some(obs => obs.toLowerCase().includes("degraded") || obs.toLowerCase().includes("offline"));

        if (activeDevices) {
          supportingObservations.push("Active communications in network topology suggest possible occupancy.");
        }
        if (degradedInfra) {
          supportingObservations.push("Network infrastructure degradation observed, consistent with localized disaster impacts.");
        }
      }
    }

    const duration = performance.now() - start;
    this.logger.debug("Conflict Detection Completed", { conflictsCount: conflictingObservations.length });
    this.logger.performance("detectConflicts", duration);

    return {
      conflictingObservations,
      supportingObservations
    };
  }
}
