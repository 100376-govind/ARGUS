import { NetworkHealth, SignalStrength } from "../interfaces/network-interfaces";

export class SignalStrengthFormatter {
  public static format(strength: SignalStrength): string {
    return `[SIGNAL: ${strength.toUpperCase()}]`;
  }
}

export class NetworkHealthFormatter {
  public static format(health: NetworkHealth): string {
    return `[HEALTH: ${health.toUpperCase()}]`;
  }
}

export class LatencyFormatter {
  public static format(latencyMs: number): string {
    return `${latencyMs.toFixed(1)}ms`;
  }
}

export class PacketLossFormatter {
  public static format(lossPercentage: number): string {
    return `${lossPercentage.toFixed(2)}% Loss`;
  }
}

export class TimestampFormatter {
  public static formatISO(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }
}
