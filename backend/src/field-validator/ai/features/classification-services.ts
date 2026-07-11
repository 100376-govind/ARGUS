import { SignalStrength, NetworkHealth, BandwidthUsage } from "../../interfaces/network-interfaces";

export class ClassificationServices {
  public static classifySignalStrength(rssiOrString: number | string): string {
    if (typeof rssiOrString === "string") return rssiOrString; // If already categorical
    const rssi = rssiOrString as number;
    if (rssi >= -50) return "Excellent";
    if (rssi >= -65) return "Good";
    if (rssi >= -75) return "Moderate";
    if (rssi >= -85) return "Weak";
    return "Critical";
  }

  public static classifyPacketLoss(lossPercentage: number): string {
    if (lossPercentage <= 2) return "Negligible";
    if (lossPercentage <= 10) return "Low";
    if (lossPercentage <= 30) return "Moderate";
    if (lossPercentage <= 60) return "High";
    return "Critical";
  }

  public static classifyLatency(latencyMs: number): string {
    if (latencyMs <= 20) return "Ultra Low";
    if (latencyMs <= 60) return "Low";
    if (latencyMs <= 150) return "Moderate";
    if (latencyMs <= 300) return "High";
    return "Very High";
  }

  public static classifyBandwidth(bandwidth: BandwidthUsage | number): string {
    if (typeof bandwidth === "string") return bandwidth;
    const mbps = bandwidth as number;
    if (mbps < 5) return "Low";
    if (mbps < 25) return "Medium";
    return "High";
  }

  public static classifyNetworkHealth(healthOrScore: NetworkHealth | number): string {
    if (typeof healthOrScore === "string") return healthOrScore;
    const score = healthOrScore as number;
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Good";
    if (score >= 50) return "Moderate";
    if (score >= 30) return "Poor";
    return "Critical";
  }

  public static classifyConnectionStability(packetLossCat: string, latencyCat: string): string {
    if (packetLossCat === "Critical" || latencyCat === "Very High") return "Unstable";
    if (packetLossCat === "High" || latencyCat === "High") return "Degraded";
    return "Stable";
  }

  public static classifyNetworkAvailability(internetReachability: boolean, connectedDevices: number): string {
    if (internetReachability && connectedDevices > 0) return "Available";
    if (!internetReachability && connectedDevices > 0) return "Local Only";
    return "Unavailable";
  }
}
