import { NetworkSnapshotModel, HistoricalSnapshotModel, NetworkStatisticsModel } from "../models/network-models";
import { MockNetworkGenerator } from "../mocks/mock-network-generator";

export class FieldValidatorService {
  private mockGenerator: MockNetworkGenerator;

  constructor() {
    this.mockGenerator = new MockNetworkGenerator("service-placeholder");
  }

  public async collectSnapshot(): Promise<NetworkSnapshotModel> {
    return this.mockGenerator.generateSnapshot();
  }

  public async getLatestSnapshot(): Promise<NetworkSnapshotModel> {
    return this.mockGenerator.generateSnapshot();
  }

  public async getSnapshotHistory(): Promise<HistoricalSnapshotModel> {
    const snapshots = [
      this.mockGenerator.generateSnapshot(),
      this.mockGenerator.generateSnapshot(),
      this.mockGenerator.generateSnapshot()
    ];
    return new HistoricalSnapshotModel(
      `hist-${Date.now()}`,
      snapshots,
      Date.now() - 3600000,
      Date.now()
    );
  }

  public async getCurrentMetrics(): Promise<NetworkStatisticsModel> {
    return new NetworkStatisticsModel(
      25.5, // averageLatencyMs
      1.2,  // averagePacketLoss
      10,   // peakConnectedDevices
      5,    // averageActiveDevices
      Date.now()
    );
  }
}
