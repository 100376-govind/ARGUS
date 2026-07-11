import { ValidationUtils } from "../utils/validation-utils";

describe("ValidationUtils", () => {
  it("should validate connected devices count", () => {
    expect(() => ValidationUtils.validateConnectedDevicesCount(5)).not.toThrow();
    expect(() => ValidationUtils.validateConnectedDevicesCount(-1)).toThrow("Connected devices cannot be negative.");
  });

  it("should validate active devices count bounds", () => {
    expect(() => ValidationUtils.validateActiveDevicesCount(5, 10)).not.toThrow();
    expect(() => ValidationUtils.validateActiveDevicesCount(11, 10)).toThrow("Active devices cannot exceed connected devices.");
    expect(() => ValidationUtils.validateActiveDevicesCount(-1, 10)).toThrow("Active devices cannot be negative.");
  });

  it("should validate packet loss bounds", () => {
    expect(() => ValidationUtils.validatePacketLoss(50)).not.toThrow();
    expect(() => ValidationUtils.validatePacketLoss(-10)).toThrow("Packet loss must be between 0 and 100.");
    expect(() => ValidationUtils.validatePacketLoss(110)).toThrow("Packet loss must be between 0 and 100.");
  });

  it("should validate latency", () => {
    expect(() => ValidationUtils.validateLatency(50)).not.toThrow();
    expect(() => ValidationUtils.validateLatency(-5)).toThrow("Latency must be positive.");
  });

  it("should validate signal strength enum", () => {
    expect(() => ValidationUtils.validateSignalStrength("Excellent")).not.toThrow();
    expect(() => ValidationUtils.validateSignalStrength("Good")).not.toThrow();
    expect(() => ValidationUtils.validateSignalStrength("Invalid")).toThrow("Invalid signal strength: Invalid.");
  });

  it("should execute validation in less than 10ms", () => {
    const start = performance.now();
    ValidationUtils.validatePacketLoss(50);
    ValidationUtils.validateLatency(50);
    ValidationUtils.validateSignalStrength("Excellent");
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10);
  });
});
