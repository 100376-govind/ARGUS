import { logger } from "@/infrastructure/logger/pino";

interface MetricRecord {
  timestamp: string;
  durationMs: number;
  label?: string;
}

export class RiskEvaluatorMetrics {
  private static instance: RiskEvaluatorMetrics;
  private apiLatencies: Map<string, MetricRecord[]> = new Map();
  private socketLatencies: Map<string, MetricRecord[]> = new Map();
  private redisLatencies: Map<string, MetricRecord[]> = new Map();
  private eventDeliveryTimes: Map<string, MetricRecord[]> = new Map();
  private evaluationTimes: MetricRecord[] = [];

  private constructor() {}

  public static getInstance(): RiskEvaluatorMetrics {
    if (!RiskEvaluatorMetrics.instance) {
      RiskEvaluatorMetrics.instance = new RiskEvaluatorMetrics();
    }
    return RiskEvaluatorMetrics.instance;
  }

  private addRecord(map: Map<string, MetricRecord[]>, key: string, durationMs: number, label?: string): void {
    let records = map.get(key);
    if (!records) {
      records = [];
      map.set(key, records);
    }
    records.push({
      timestamp: new Date().toISOString(),
      durationMs,
      label,
    });

    // Cap metrics memory footprint to last 1000 items per key
    if (records.length > 1000) {
      records.shift();
    }
  }

  public recordApiLatency(path: string, method: string, durationMs: number): void {
    const key = `${method}:${path}`;
    this.addRecord(this.apiLatencies, key, durationMs);
    logger.debug({ key, durationMs }, "Metrics: API Latency recorded");
  }

  public recordSocketLatency(event: string, durationMs: number): void {
    this.addRecord(this.socketLatencies, event, durationMs);
    logger.debug({ event, durationMs }, "Metrics: Socket Latency recorded");
  }

  public recordRedisLatency(operation: string, durationMs: number): void {
    this.addRecord(this.redisLatencies, operation, durationMs);
    logger.debug({ operation, durationMs }, "Metrics: Redis Latency recorded");
  }

  public recordEventDeliveryTime(eventType: string, durationMs: number): void {
    this.addRecord(this.eventDeliveryTimes, eventType, durationMs);
    logger.debug({ eventType, durationMs }, "Metrics: Event Delivery Time recorded");
  }

  public recordEvaluationTime(incidentId: string, durationMs: number): void {
    this.evaluationTimes.push({
      timestamp: new Date().toISOString(),
      durationMs,
      label: incidentId,
    });
    if (this.evaluationTimes.length > 1000) {
      this.evaluationTimes.shift();
    }
    logger.info({ incidentId, durationMs }, "Metrics: Risk Evaluation duration recorded");
  }

  public getSummary() {
    const calculateAverage = (records: MetricRecord[] = []) => {
      if (records.length === 0) return 0;
      const sum = records.reduce((acc, curr) => acc + curr.durationMs, 0);
      return Math.round((sum / records.length) * 100) / 100;
    };

    const getStats = (map: Map<string, MetricRecord[]>) => {
      const summary: Record<string, { avgMs: number; count: number; maxMs: number }> = {};
      map.forEach((records, key) => {
        const avgMs = calculateAverage(records);
        const maxMs = records.length > 0 ? Math.max(...records.map((r) => r.durationMs)) : 0;
        summary[key] = {
          avgMs,
          count: records.length,
          maxMs,
        };
      });
      return summary;
    };

    return {
      apiSummary: getStats(this.apiLatencies),
      socketSummary: getStats(this.socketLatencies),
      redisSummary: getStats(this.redisLatencies),
      eventSummary: getStats(this.eventDeliveryTimes),
      evaluationSummary: {
        avgMs: calculateAverage(this.evaluationTimes),
        count: this.evaluationTimes.length,
        maxMs: this.evaluationTimes.length > 0 ? Math.max(...this.evaluationTimes.map((r) => r.durationMs)) : 0,
      },
    };
  }
}

export const metrics = RiskEvaluatorMetrics.getInstance();
