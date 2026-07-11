import { MockNetworkGenerator } from "../mocks/mock-network-generator";

describe("MockNetworkGenerator", () => {
  let generator: MockNetworkGenerator;

  beforeEach(() => {
    generator = new MockNetworkGenerator("test-seed");
  });

  it("should generate deterministic snapshots with the same seed", () => {
    const generator2 = new MockNetworkGenerator("test-seed");
    const snap1 = generator.generateSnapshot();
    const snap2 = generator2.generateSnapshot();

    expect(snap1.metrics.packetLossPercentage).toBe(snap2.metrics.packetLossPercentage);
    expect(snap1.connectedDevices.length).toBe(snap2.connectedDevices.length);
  });

  it("should generate devices within bounds (2-12)", () => {
    const snapshot = generator.generateSnapshot();
    expect(snapshot.connectedDevices.length).toBeGreaterThanOrEqual(2);
    expect(snapshot.connectedDevices.length).toBeLessThanOrEqual(12);
  });

  it("should execute in less than 20ms", () => {
    const start = performance.now();
    generator.generateSnapshot();
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(20);
  });
});
