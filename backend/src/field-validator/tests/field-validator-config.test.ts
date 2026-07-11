import { FieldValidatorConfig, Environment } from "../constants/field-validator-config";

describe("FieldValidatorConfig", () => {
  it("should have correct default settings", () => {
    expect(FieldValidatorConfig.environment).toBeDefined();
    expect(FieldValidatorConfig.isMockEnabled).toBeDefined();
    expect(FieldValidatorConfig.refreshIntervalMs).toBeDefined();
    expect(FieldValidatorConfig.timeoutMs).toBeDefined();
    expect(FieldValidatorConfig.retryCount).toBeDefined();
    expect(FieldValidatorConfig.isRouterEnabled).toBeDefined();
    expect(FieldValidatorConfig.networkPollingIntervalMs).toBeDefined();
  });
});
