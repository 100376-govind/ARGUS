import { NetworkCollectorService } from "../collectors/network-collector.service";

describe("NetworkCollectorService", () => {
  let collector: NetworkCollectorService;

  beforeEach(() => {
    collector = new NetworkCollectorService();
  });

  it("should gracefully return a valid snapshot even if mock fails (it shouldn't)", async () => {
    const snapshot = await collector.collectSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot.connectedDevices).toBeInstanceOf(Array);
  });

  it("should execute in less than 100ms", async () => {
    const start = performance.now();
    await collector.collectSnapshot();
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
