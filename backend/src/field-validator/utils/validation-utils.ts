import { SignalStrength } from "../interfaces/network-interfaces";

export class ValidationUtils {
  private static readonly ALLOWED_SIGNAL_STRENGTHS: SignalStrength[] = [
    "Excellent", "Good", "Moderate", "Weak", "Critical"
  ];

  public static validateConnectedDevicesCount(count: number): void {
    if (count < 0) {
      throw new Error("Connected devices cannot be negative.");
    }
  }

  public static validateActiveDevicesCount(activeCount: number, connectedCount: number): void {
    if (activeCount > connectedCount) {
      throw new Error("Active devices cannot exceed connected devices.");
    }
    if (activeCount < 0) {
      throw new Error("Active devices cannot be negative.");
    }
  }

  public static validatePacketLoss(loss: number): void {
    if (loss < 0 || loss > 100) {
      throw new Error("Packet loss must be between 0 and 100.");
    }
  }

  public static validateLatency(latencyMs: number): void {
    if (latencyMs < 0) {
      throw new Error("Latency must be positive.");
    }
  }

  public static validateSignalStrength(strength: string): void {
    if (!this.ALLOWED_SIGNAL_STRENGTHS.includes(strength as SignalStrength)) {
      throw new Error(`Invalid signal strength: ${strength}. Allowed values are: ${this.ALLOWED_SIGNAL_STRENGTHS.join(", ")}`);
    }
  }
}
