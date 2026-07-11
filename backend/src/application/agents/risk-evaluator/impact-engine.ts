export interface ImpactAssessment {
  overallImpactScore: number; // 0 - 100
  breakdown: {
    population: {
      affectedCount: number;
      severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    };
    buildings: {
      damagedCount: number;
      structuralIntegrityLost: boolean;
    };
    hospitals: {
      affectedCount: number;
      isOperational: boolean;
    };
    roads: {
      blockedRoutesCount: number;
      evacuationRouteCutoff: boolean;
    };
    powerGrid: {
      nodesAffectedCount: number;
      outageDurationEstimatedHours: number;
    };
    schools: {
      closedCount: number;
      shelterCapacityAvailable: boolean;
    };
  };
}

export interface ImpactEstimationInput {
  incidentType: string;
  victimCount: number;
  locationDetails?: {
    isHighDensityZone: boolean;
    hasSchoolNearby: boolean;
    hasHospitalNearby: boolean;
  };
  metadataInfraDetails?: {
    estimatedBuildingsDamaged?: number;
    blockedRoadsCount?: number;
    gridNodesOfflineCount?: number;
  };
}

export class ImpactEngine {
  
  /**
   * Computes granular structural impact across population and multiple infrastructure nodes.
   */
  public estimateImpact(input: ImpactEstimationInput): ImpactAssessment {
    const type = input.incidentType.toLowerCase();

    // 1. Population Impact Calculation
    let affectedPop = input.victimCount * 10;
    if (input.locationDetails?.isHighDensityZone) {
      affectedPop += 250;
      if (type.includes("explosion") || type.includes("chemical") || type.includes("earthquake")) {
        affectedPop += 1000;
      }
    }
    
    let popSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    if (affectedPop > 1000) popSeverity = "CRITICAL";
    else if (affectedPop > 200) popSeverity = "HIGH";
    else if (affectedPop > 50) popSeverity = "MEDIUM";

    // 2. Building Impact Calculation
    let damagedBuildings = input.metadataInfraDetails?.estimatedBuildingsDamaged ?? 0;
    if (damagedBuildings === 0) {
      if (type.includes("collapse")) damagedBuildings = 1;
      if (type.includes("earthquake")) damagedBuildings = 45;
      if (type.includes("explosion")) damagedBuildings = 5;
      if (type.includes("fire")) damagedBuildings = 2;
    }
    const structuralIntegrityLost = type.includes("collapse") || type.includes("earthquake") || damagedBuildings > 10;

    // 3. Hospital Impact Calculation
    const hospitalsAffected = input.locationDetails?.hasHospitalNearby ? 1 : 0;
    const hospitalOperational = !type.includes("earthquake") && !type.includes("explosion");

    // 4. Roads Blockage Calculation
    const blockedRoads = input.metadataInfraDetails?.blockedRoadsCount ?? (type.includes("accident") ? 1 : type.includes("collapse") || type.includes("flood") ? 3 : 0);
    const evacuationCutoff = blockedRoads > 2 && (type.includes("flood") || type.includes("earthquake"));

    // 5. Power Grid Impact Calculation
    const gridNodes = input.metadataInfraDetails?.gridNodesOfflineCount ?? (type.includes("power") ? 8 : type.includes("earthquake") ? 15 : 0);
    let outageHours = 0;
    if (gridNodes > 0) {
      outageHours = type.includes("earthquake") ? 48 : type.includes("power") ? 8 : 4;
    }

    // 6. Schools Impact Calculation
    const closedSchools = input.locationDetails?.hasSchoolNearby ? 1 : 0;
    const schoolShelterAvailable = !type.includes("earthquake") && !type.includes("flood");

    // 7. Calculate overall impact score (0 - 100)
    let impactScore = 0;
    impactScore += Math.min(30, (affectedPop / 500) * 15);
    impactScore += Math.min(25, damagedBuildings * 2.5);
    impactScore += hospitalsAffected * 20;
    impactScore += Math.min(10, blockedRoads * 3);
    impactScore += Math.min(10, gridNodes * 0.7);
    impactScore += closedSchools * 5;

    const overallImpactScore = Math.round(Math.min(100, Math.max(0, impactScore)));

    return {
      overallImpactScore,
      breakdown: {
        population: {
          affectedCount: affectedPop,
          severity: popSeverity,
        },
        buildings: {
          damagedCount: damagedBuildings,
          structuralIntegrityLost,
        },
        hospitals: {
          affectedCount: hospitalsAffected,
          isOperational: hospitalOperational,
        },
        roads: {
          blockedRoutesCount: blockedRoads,
          evacuationRouteCutoff: evacuationCutoff,
        },
        powerGrid: {
          nodesAffectedCount: gridNodes,
          outageDurationEstimatedHours: outageHours,
        },
        schools: {
          closedCount: closedSchools,
          shelterCapacityAvailable: schoolShelterAvailable,
        },
      },
    };
  }
}

export const impactEngine = new ImpactEngine();
