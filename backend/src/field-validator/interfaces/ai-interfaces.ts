export interface NetworkFeatures {
  connectedDevices: number;
  activeDevices: number;
  inactiveDevices: number;
  signalStrengthCategory: string;
  packetLossCategory: string;
  latencyCategory: string;
  bandwidthUsageCategory: string;
  networkHealth: string;
  internetReachability: boolean;
  connectionStability: string;
  networkAvailability: string;
}

export interface EnvironmentalInferenceResult {
  environmentalInference: string[];
  validationConfidence: number;
  occupancyConfidence: number;
  communicationConfidence: number;
  infrastructureConfidence: number;
  summary: string;
}
