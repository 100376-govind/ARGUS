import { NetworkSnapshotModel } from "../../models/network-models";
import { NetworkFeatures } from "../../interfaces/ai-interfaces";
import { ClassificationServices } from "./classification-services";
import { FieldValidatorLogger } from "../../utils/field-validator-logger";

export class FeatureExtractionService {
  private logger = new FieldValidatorLogger("FeatureExtractionService");

  public extractFeatures(snapshot: NetworkSnapshotModel): NetworkFeatures {
    const startTime = performance.now();
    this.logger.debug("Feature Extraction Started");

    const connectedDevicesCount = snapshot.connectedDevices.length;
    const activeDevicesCount = snapshot.activeDevicesCount;
    const inactiveDevicesCount = Math.max(0, connectedDevicesCount - activeDevicesCount);

    // Aggregate average signal strength from connected devices for feature abstraction
    let totalSignalScore = 0;
    let signalCount = 0;
    for (const dev of snapshot.connectedDevices) {
      if (dev.signalStrength) {
        // Simple mapping for aggregation
        const scoreMap: Record<string, number> = { "Excellent": -45, "Good": -60, "Moderate": -70, "Weak": -80, "Critical": -90 };
        totalSignalScore += scoreMap[dev.signalStrength] || -90;
        signalCount++;
      }
    }
    const avgRssi = signalCount > 0 ? (totalSignalScore / signalCount) : -90;
    const signalStrengthCategory = ClassificationServices.classifySignalStrength(avgRssi);

    const packetLossCategory = ClassificationServices.classifyPacketLoss(snapshot.metrics.packetLossPercentage);
    const latencyCategory = ClassificationServices.classifyLatency(snapshot.metrics.latencyMs);
    const bandwidthUsageCategory = ClassificationServices.classifyBandwidth(snapshot.metrics.bandwidthUsage);
    const networkHealth = ClassificationServices.classifyNetworkHealth(snapshot.metrics.networkHealth);
    
    const internetReachability = snapshot.metrics.internetReachability;
    const connectionStability = ClassificationServices.classifyConnectionStability(packetLossCategory, latencyCategory);
    const networkAvailability = ClassificationServices.classifyNetworkAvailability(internetReachability, connectedDevicesCount);

    const features: NetworkFeatures = {
      connectedDevices: connectedDevicesCount,
      activeDevices: activeDevicesCount,
      inactiveDevices: inactiveDevicesCount,
      signalStrengthCategory,
      packetLossCategory,
      latencyCategory,
      bandwidthUsageCategory,
      networkHealth,
      internetReachability,
      connectionStability,
      networkAvailability
    };

    const duration = performance.now() - startTime;
    this.logger.debug("Feature Extraction Completed", { durationMs: duration });
    this.logger.performance("extractFeatures", duration);

    return features;
  }
}
