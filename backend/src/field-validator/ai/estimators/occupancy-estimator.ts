import { NetworkFeatures } from "../../interfaces/ai-interfaces";

export type OccupancyLikelihood = "Likely Occupied" | "Possibly Occupied" | "Low Occupancy" | "Unknown";

export class OccupancyEstimator {
  public static estimate(features: NetworkFeatures): OccupancyLikelihood {
    if (features.networkAvailability === "Unavailable") {
      return "Unknown";
    }

    // High activity and devices suggest likely occupancy
    if (features.activeDevices > 3 && features.bandwidthUsageCategory === "High") {
      return "Likely Occupied";
    }

    if (features.activeDevices > 0 || features.connectedDevices > 2) {
      return "Possibly Occupied";
    }

    // Very few connected devices and no active usage
    if (features.connectedDevices <= 2 && features.activeDevices === 0) {
      return "Low Occupancy";
    }

    return "Unknown";
  }
}
