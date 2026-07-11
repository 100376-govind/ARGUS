import { 
  ConnectedDeviceModel, 
  NetworkSnapshotModel 
} from "../models/network-models";
import { 
  NetworkMetrics, 
  SignalStrength, 
  NetworkHealth, 
  BandwidthUsage, 
  ChannelUtilization 
} from "../interfaces/network-interfaces";

export class MockNetworkGenerator {
  private seed: number;

  constructor(seedString: string = "default-seed") {
    this.seed = this.hashCode(seedString);
  }

  /**
   * Generates a deterministic pseudo-random number between 0 and 1
   */
  private random(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  private getRandomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  private getRandomItem<T>(array: T[]): T {
    return array[this.getRandomInt(0, array.length - 1)];
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  private generateMacAddress(): string {
    const hexDigits = "0123456789ABCDEF";
    let mac = "";
    for (let i = 0; i < 6; i++) {
      mac += hexDigits.charAt(this.getRandomInt(0, 15));
      mac += hexDigits.charAt(this.getRandomInt(0, 15));
      if (i < 5) mac += ":";
    }
    return mac;
  }

  private generateIpAddress(): string {
    return `192.168.1.${this.getRandomInt(2, 254)}`;
  }

  public generateConnectedDevices(): ConnectedDeviceModel[] {
    const numDevices = this.getRandomInt(2, 12);
    const devices: ConnectedDeviceModel[] = [];

    const signalStrengths: SignalStrength[] = ["Excellent", "Good", "Moderate", "Weak", "Critical"];

    for (let i = 0; i < numDevices; i++) {
      devices.push(new ConnectedDeviceModel(
        `dev-${this.getRandomInt(1000, 9999)}`,
        this.generateMacAddress(),
        this.generateIpAddress(),
        this.getRandomItem(signalStrengths),
        this.random() > 0.1, // 90% chance of being connected
        Date.now() - this.getRandomInt(0, 60000)
      ));
    }

    return devices;
  }

  public generateNetworkMetrics(): NetworkMetrics {
    const bandwidths: BandwidthUsage[] = ["Low", "Medium", "High"];
    const channelUtils: ChannelUtilization[] = ["Low", "Medium", "High"];
    const healths: NetworkHealth[] = ["Excellent", "Good", "Moderate", "Poor", "Critical"];

    return {
      packetLossPercentage: this.getRandomInt(0, 90),
      latencyMs: this.getRandomInt(5, 400),
      bandwidthUsage: this.getRandomItem(bandwidths),
      channelUtilization: this.getRandomItem(channelUtils),
      internetReachability: this.random() > 0.05, // 95% chance reachable
      networkHealth: this.getRandomItem(healths)
    };
  }

  public generateSnapshot(): NetworkSnapshotModel {
    const devices = this.generateConnectedDevices();
    const activeCount = Math.min(this.getRandomInt(1, 10), devices.length);
    
    return new NetworkSnapshotModel(
      `snap-${this.getRandomInt(10000, 99999)}`,
      Date.now(),
      devices,
      activeCount,
      this.generateNetworkMetrics()
    );
  }
}
