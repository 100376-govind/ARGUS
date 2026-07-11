export class FieldValidatorLogger {
  constructor(private context: string) {}

  public info(message: string, meta?: Record<string, any>): void {
    console.log(`[INFO] [${this.context}] ${message}`, meta ? meta : "");
  }

  public warn(message: string, meta?: Record<string, any>): void {
    console.warn(`[WARN] [${this.context}] ${message}`, meta ? meta : "");
  }

  public error(message: string, error?: Error | unknown): void {
    console.error(`[ERROR] [${this.context}] ${message}`, error ? error : "");
  }

  public debug(message: string, meta?: Record<string, any>): void {
    // In a real production system, this might be filtered by log level
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[DEBUG] [${this.context}] ${message}`, meta ? meta : "");
    }
  }

  public performance(operation: string, durationMs: number): void {
    console.info(`[PERF] [${this.context}] ${operation} completed in ${durationMs.toFixed(2)}ms`);
  }
}
