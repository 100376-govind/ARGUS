import autocannon from "autocannon";
import { logger } from "./pino";

export function runResourceAllocatorLoadTest(url = "http://localhost:3001/api/resource-allocator/INC-99", durationSeconds = 10): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info(`Starting load test against ${url} for ${durationSeconds} seconds...`);
    const instance = autocannon({
      url,
      connections: 100,
      duration: durationSeconds,
      headers: {
        Authorization: "Bearer mock-admin-token",
      },
    }, (err, result) => {
      if (err) {
        logger.error({ err }, "Load testing execution error");
        reject(err);
        return;
      }
      logger.info(`Load Test Complete: Requests/sec: ${result.requests.average}, Avg Latency: ${result.latency.average}ms`);
      resolve();
    });

    autocannon.track(instance, { renderProgressBar: false });
  });
}
