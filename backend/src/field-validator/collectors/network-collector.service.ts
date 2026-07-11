import { FieldValidatorConfig } from "../constants/field-validator-config";
import { MockNetworkGenerator } from "../mocks/mock-network-generator";
import { NetworkSnapshotModel } from "../models/network-models";
import { FieldValidatorLogger } from "../utils/field-validator-logger";

export class NetworkCollectorService {
  private mockGenerator: MockNetworkGenerator;
  private logger: FieldValidatorLogger;

  constructor() {
    this.mockGenerator = new MockNetworkGenerator(process.env.MOCK_SEED || "field-validator-init");
    this.logger = new FieldValidatorLogger("NetworkCollectorService");
  }

  /**
   * Collects network metrics.
   * Gracefully falls back to mock data if in mock mode or if router collection fails.
   */
  public async collectSnapshot(): Promise<NetworkSnapshotModel> {
    const startTime = performance.now();
    this.logger.info("Collector Started");

    try {
      if (FieldValidatorConfig.isMockEnabled) {
        return this.generateMockSnapshot(startTime);
      }

      if (FieldValidatorConfig.isRouterEnabled) {
        // Future integration point for OpenWRT, SNMP, or REST Router APIs.
        this.logger.warn("Router integration is not yet implemented. Falling back to mock data.");
        return this.generateMockSnapshot(startTime);
      }

      // Default fallback
      return this.generateMockSnapshot(startTime);

    } catch (error) {
      this.logger.error("Failed to collect network metrics", error as Error);
      // Never crash, always return valid data
      return this.generateMockSnapshot(startTime);
    }
  }

  private generateMockSnapshot(startTime: number): NetworkSnapshotModel {
    const snapshot = this.mockGenerator.generateSnapshot();
    const executionTime = performance.now() - startTime;
    
    this.logger.info(`Snapshot Created in ${executionTime.toFixed(2)}ms`);
    this.logger.debug("Mock Data Generated", { snapshotId: snapshot.snapshotId });
    
    return snapshot;
  }
}
