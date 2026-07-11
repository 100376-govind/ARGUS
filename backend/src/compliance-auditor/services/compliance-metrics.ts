export interface ComplianceMetricsSnapshot {
  auditRequestsCount: number;
  reportGenerationTimes: number[];
  geminiResponseTimes: number[];
  pdfGenerationTimes: number[];
  redisLatencies: number[];
  apiLatencies: number[];
  socketLatencies: number[];
  successCount: number;
  errorCount: number;
}

export class ComplianceMetrics {
  private static metrics: ComplianceMetricsSnapshot = {
    auditRequestsCount: 0,
    reportGenerationTimes: [],
    geminiResponseTimes: [],
    pdfGenerationTimes: [],
    redisLatencies: [],
    apiLatencies: [],
    socketLatencies: [],
    successCount: 0,
    errorCount: 0,
  };

  public static incrementRequests(): void {
    this.metrics.auditRequestsCount++;
  }

  public static recordReportTime(ms: number): void {
    this.metrics.reportGenerationTimes.push(ms);
  }

  public static recordGeminiTime(ms: number): void {
    this.metrics.geminiResponseTimes.push(ms);
  }

  public static recordPdfTime(ms: number): void {
    this.metrics.pdfGenerationTimes.push(ms);
  }

  public static recordRedisLatency(ms: number): void {
    this.metrics.redisLatencies.push(ms);
  }

  public static recordApiLatency(ms: number): void {
    this.metrics.apiLatencies.push(ms);
  }

  public static recordSocketLatency(ms: number): void {
    this.metrics.socketLatencies.push(ms);
  }

  public static recordSuccess(): void {
    this.metrics.successCount++;
  }

  public static recordError(): void {
    this.metrics.errorCount++;
  }

  private static average(arr: number[]): number {
    return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  public static getSnapshot() {
    const total = this.metrics.successCount + this.metrics.errorCount;
    return {
      auditRequestsCount: this.metrics.auditRequestsCount,
      averageReportTimeMs: this.average(this.metrics.reportGenerationTimes),
      averageGeminiResponseTimeMs: this.average(this.metrics.geminiResponseTimes),
      averagePdfGenerationTimeMs: this.average(this.metrics.pdfGenerationTimes),
      averageRedisLatencyMs: this.average(this.metrics.redisLatencies),
      averageApiLatencyMs: this.average(this.metrics.apiLatencies),
      averageSocketLatencyMs: this.average(this.metrics.socketLatencies),
      successRate: total === 0 ? 100 : (this.metrics.successCount / total) * 100,
      errorRate: total === 0 ? 0 : (this.metrics.errorCount / total) * 100,
    };
  }
}
