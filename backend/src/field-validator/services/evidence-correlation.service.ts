import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { IncidentEntity } from "@/domain/entities/incident";

export class EvidenceCorrelationService {
  constructor(private readonly incidentRepo: IIncidentRepository) {}

  public async correlate(incidentId: string): Promise<{
    evidenceCorrelation: any;
    supportingReports: any[];
    keywordSimilarity: number;
    locationSimilarity: number;
    incidentSimilarity: number;
    timeSimilarity: number;
    validationConfidence: number;
  }> {
    const currentIncident = await this.incidentRepo.findById(incidentId);
    if (!currentIncident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    // Fetch all incidents
    const allIncidents = await this.incidentRepo.findAll();

    // Filter out current incident
    const otherIncidents = allIncidents.filter(inc => inc.id !== incidentId);

    const supportingReports: any[] = [];
    let maxOverallSimilarity = 0;
    let bestMatch: any = null;

    // Helper to calculate keyword similarity using Jaccard Similarity
    const getKeywordSimilarity = (text1: string, text2: string): number => {
      const tokenize = (text: string) => {
        return new Set(
          (text || "")
            .toLowerCase()
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter(word => word.length > 2 && !["the", "and", "for", "with", "this", "that", "from", "near", "reported", "incidents", "incident"].includes(word))
        );
      };
      const set1 = tokenize(text1);
      const set2 = tokenize(text2);
      if (set1.size === 0 || set2.size === 0) return 0;

      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      return Math.round((intersection.size / union.size) * 100);
    };

    // Helper to calculate location similarity
    const getLocationSimilarity = (inc1: IncidentEntity, inc2: IncidentEntity): number => {
      if (inc1.lat !== null && inc1.lat !== undefined && inc1.lng !== null && inc1.lng !== undefined &&
          inc2.lat !== null && inc2.lat !== undefined && inc2.lng !== null && inc2.lng !== undefined) {
        // Calculate distance in km using Haversine formula
        const R = 6371; // Earth's radius in km
        const dLat = ((inc2.lat - inc1.lat) * Math.PI) / 180;
        const dLng = ((inc2.lng - inc1.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((inc1.lat * Math.PI) / 180) *
            Math.cos((inc2.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c; // Distance in km

        if (distance <= 0.5) return 100; // <= 500m
        if (distance <= 2.0) return 80;  // <= 2km
        if (distance <= 5.0) return 50;  // <= 5km
        if (distance <= 10.0) return 20; // <= 10km
        return 0;
      }

      if (inc1.locationName && inc2.locationName) {
        const name1 = inc1.locationName.toLowerCase().trim();
        const name2 = inc2.locationName.toLowerCase().trim();
        if (name1 === name2) return 100;
        if (name1.includes(name2) || name2.includes(name1)) return 50;
      }

      return 0;
    };

    // Helper to calculate incident type similarity
    const getIncidentSimilarity = (type1: string, type2: string): number => {
      const t1 = (type1 || "").toLowerCase().trim();
      const t2 = (type2 || "").toLowerCase().trim();
      if (t1 === t2) return 100;
      if (t1.includes(t2) || t2.includes(t1)) return 50;
      return 0;
    };

    // Helper to calculate time similarity
    const getTimeSimilarity = (date1: Date, date2: Date): number => {
      const diffMs = Math.abs(new Date(date1).getTime() - new Date(date2).getTime());
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours <= 1) return 100;
      if (diffHours <= 4) return 80;
      if (diffHours <= 12) return 50;
      if (diffHours <= 24) return 20;
      return 0;
    };

    for (const other of otherIncidents) {
      const keywordSim = getKeywordSimilarity(
        `${currentIncident.rawContent} ${currentIncident.structuredDesc}`,
        `${other.rawContent} ${other.structuredDesc}`
      );
      const locationSim = getLocationSimilarity(currentIncident, other);
      const incidentSim = getIncidentSimilarity(currentIncident.incidentType, other.incidentType);
      const timeSim = getTimeSimilarity(currentIncident.createdAt, other.createdAt);

      const hasLocation =
        (currentIncident.lat !== null && currentIncident.lng !== null) ||
        (other.lat !== null && other.lng !== null);

      let overallSimilarity = 0;
      if (hasLocation) {
        overallSimilarity = Math.round(
          keywordSim * 0.25 + locationSim * 0.35 + incidentSim * 0.25 + timeSim * 0.15
        );
      } else {
        overallSimilarity = Math.round(
          keywordSim * 0.40 + incidentSim * 0.40 + timeSim * 0.20
        );
      }

      const detail = {
        incidentId: other.id,
        overallSimilarity,
        keywordSimilarity: keywordSim,
        locationSimilarity: locationSim,
        incidentSimilarity: incidentSim,
        timeSimilarity: timeSim,
      };

      if (overallSimilarity >= 50) {
        supportingReports.push(detail);
      }

      if (overallSimilarity > maxOverallSimilarity) {
        maxOverallSimilarity = overallSimilarity;
        bestMatch = detail;
      }
    }

    return {
      evidenceCorrelation: bestMatch ? {
        matchedIncidentId: bestMatch.incidentId,
        overallSimilarity: bestMatch.overallSimilarity,
      } : null,
      supportingReports,
      keywordSimilarity: bestMatch ? bestMatch.keywordSimilarity : 0,
      locationSimilarity: bestMatch ? bestMatch.locationSimilarity : 0,
      incidentSimilarity: bestMatch ? bestMatch.incidentSimilarity : 0,
      timeSimilarity: bestMatch ? bestMatch.timeSimilarity : 0,
      validationConfidence: maxOverallSimilarity,
    };
  }
}
