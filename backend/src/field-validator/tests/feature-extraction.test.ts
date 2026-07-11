import { FeatureExtractionService } from "../ai/features/feature-extraction.service";
import { NetworkSnapshotModel, ConnectedDeviceModel } from "../models/network-models";

describe("FeatureExtractionService", () => {
  let service: FeatureExtractionService;

  beforeEach(() => {
    service = new FeatureExtractionService();
  });

  it("should extract features correctly", () => {
    const devices = [
      new ConnectedDeviceModel("dev-1", "mac", "ip", "Excellent", true, Date.now()),
      new ConnectedDeviceModel("dev-2", "mac", "ip", "Good", true, Date.now()),
      new ConnectedDeviceModel("dev-3", "mac", "ip", "Weak", true, Date.now())
    ];

    const snapshot = new NetworkSnapshotModel(
      "snap-1",
      Date.now(),
      devices,
      2, // active count
      {
        packetLossPercentage: 15,
        latencyMs: 120,
        bandwidthUsage: "Medium",
        channelUtilization: "Medium",
        internetReachability: true,
        networkHealth: "Good"
      }
    );

    const features = service.extractFeatures(snapshot);

    expect(features.connectedDevices).toBe(3);
    expect(features.activeDevices).toBe(2);
    expect(features.inactiveDevices).toBe(1);
    expect(features.packetLossCategory).toBe("Moderate");
    expect(features.latencyCategory).toBe("Moderate");
    expect(features.bandwidthUsageCategory).toBe("Medium");
    expect(features.internetReachability).toBe(true);
    expect(features.networkAvailability).toBe("Available");
  });

  it("should execute in less than 30ms", () => {
    const devices = [new ConnectedDeviceModel("dev-1", "mac", "ip", "Excellent", true, Date.now())];
    const snapshot = new NetworkSnapshotModel("snap-1", Date.now(), devices, 1, {
      packetLossPercentage: 0, latencyMs: 10, bandwidthUsage: "Low", channelUtilization: "Low", internetReachability: true, networkHealth: "Excellent"
    });

    const start = performance.now();
    service.extractFeatures(snapshot);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(30);
  });
});
