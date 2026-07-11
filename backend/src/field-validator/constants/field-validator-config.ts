export enum Environment {
  Development = "Development",
  Testing = "Testing",
  Production = "Production"
}

export interface IFieldValidatorConfig {
  environment: Environment;
  isMockEnabled: boolean;
  refreshIntervalMs: number;
  timeoutMs: number;
  retryCount: number;
  isRouterEnabled: boolean;
  networkPollingIntervalMs: number;
}

export const FieldValidatorConfig: IFieldValidatorConfig = {
  environment: (process.env.NODE_ENV === "production") 
    ? Environment.Production 
    : (process.env.NODE_ENV === "test") ? Environment.Testing : Environment.Development,
  isMockEnabled: process.env.FIELD_VALIDATOR_MOCK_ENABLED !== "false", // Defaults to true if not explicitly false
  refreshIntervalMs: parseInt(process.env.FIELD_VALIDATOR_REFRESH_INTERVAL_MS || "5000", 10),
  timeoutMs: parseInt(process.env.FIELD_VALIDATOR_TIMEOUT_MS || "10000", 10),
  retryCount: parseInt(process.env.FIELD_VALIDATOR_RETRY_COUNT || "3", 10),
  isRouterEnabled: process.env.FIELD_VALIDATOR_ROUTER_ENABLED === "true", // Defaults to false
  networkPollingIntervalMs: parseInt(process.env.FIELD_VALIDATOR_POLLING_INTERVAL_MS || "2000", 10),
};
