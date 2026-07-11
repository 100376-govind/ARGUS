import { OccupancyEstimator } from "../ai/estimators/occupancy-estimator";
import { NetworkFeatures } from "../interfaces/ai-interfaces";

describe("OccupancyEstimator", () => {
  const baseFeatures: NetworkFeatures = {
    connectedDevices: 0,
    activeDevices: 0,
    inactiveDevices: 0,
    signalStrengthCategory: "Good",
    packetLossCategory: "Low",
    latencyCategory: "Low",
    bandwidthUsageCategory: "Low",
    networkHealth: "Good",
    internetReachability: true,
    connectionStability: "Stable",
    networkAvailability: "Available"
  };

  it("should estimate 'Likely Occupied'", () => {
    const features = { ...baseFeatures, activeDevices: 4, bandwidthUsageCategory: "High" };
    expect(OccupancyEstimator.estimate(features)).toBe("Likely Occupied");
  });

  it("should estimate 'Possibly Occupied'", () => {
    const features = { ...baseFeatures, activeDevices: 1, connectedDevices: 3 };
    expect(OccupancyEstimator.estimate(features)).toBe("Possibly Occupied");
  });

  it("should estimate 'Low Occupancy'", () => {
    const features = { ...baseFeatures, activeDevices: 0, connectedDevices: 2 };
    expect(OccupancyEstimator.estimate(features)).toBe("Low Occupancy");
  });

  it("should return 'Unknown' if unavailable", () => {
    const features = { ...baseFeatures, networkAvailability: "Unavailable" };
    expect(OccupancyEstimator.estimate(features)).toBe("Unknown");
  });
});
