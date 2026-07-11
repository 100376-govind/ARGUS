import { vi } from "vitest";
import { FieldValidatorLogger } from "../utils/field-validator-logger";

describe("FieldValidatorLogger", () => {
  let logger: FieldValidatorLogger;
  let consoleSpy: any;

  beforeEach(() => {
    logger = new FieldValidatorLogger("TestContext");
  });

  afterEach(() => {
    if (consoleSpy) {
      consoleSpy.mockRestore();
    }
  });

  it("should log info messages", () => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("Test info message");
    expect(consoleSpy).toHaveBeenCalled();
    const firstCallArgs: string[] = consoleSpy.mock.calls[0];
    expect(firstCallArgs[0]).toContain("[INFO] [TestContext] Test info message");
  });

  it("should log error messages", () => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const testError = new Error("Test error");
    logger.error("Test error message", testError);
    expect(consoleSpy).toHaveBeenCalled();
    const firstCallArgs: any[] = consoleSpy.mock.calls[0];
    expect(firstCallArgs[0]).toContain("[ERROR] [TestContext] Test error message");
  });

  it("should log warn messages", () => {
    consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("Test warn message");
    expect(consoleSpy).toHaveBeenCalled();
    const firstCallArgs: string[] = consoleSpy.mock.calls[0];
    expect(firstCallArgs[0]).toContain("[WARN] [TestContext] Test warn message");
  });
});
