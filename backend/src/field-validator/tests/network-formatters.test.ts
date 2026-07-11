import { 
  SignalStrengthFormatter, 
  NetworkHealthFormatter, 
  LatencyFormatter, 
  PacketLossFormatter, 
  TimestampFormatter 
} from "../utils/network-formatters";

describe("NetworkFormatters", () => {
  it("should format signal strength correctly", () => {
    expect(SignalStrengthFormatter.format("Excellent")).toBe("[SIGNAL: EXCELLENT]");
    expect(SignalStrengthFormatter.format("Weak")).toBe("[SIGNAL: WEAK]");
  });

  it("should format network health correctly", () => {
    expect(NetworkHealthFormatter.format("Good")).toBe("[HEALTH: GOOD]");
    expect(NetworkHealthFormatter.format("Critical")).toBe("[HEALTH: CRITICAL]");
  });

  it("should format latency correctly", () => {
    expect(LatencyFormatter.format(12.34)).toBe("12.3ms");
    expect(LatencyFormatter.format(100)).toBe("100.0ms");
  });

  it("should format packet loss correctly", () => {
    expect(PacketLossFormatter.format(5.123)).toBe("5.12% Loss");
  });

  it("should format timestamp to ISO string", () => {
    const ts = 1672531200000;
    expect(TimestampFormatter.formatISO(ts)).toBe(new Date(ts).toISOString());
  });
});
