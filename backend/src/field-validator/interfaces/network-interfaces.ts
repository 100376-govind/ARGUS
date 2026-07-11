export type SignalStrength = "Excellent" | "Good" | "Moderate" | "Weak" | "Critical";
export type NetworkHealth = "Excellent" | "Good" | "Moderate" | "Poor" | "Critical";
export type BandwidthUsage = "Low" | "Medium" | "High";
export type ChannelUtilization = "Low" | "Medium" | "High";

export interface ConnectedDevice {
  deviceId: string;
  macAddress: string;
  ipAddress: string;
  signalStrength: SignalStrength;
  isConnected: boolean;
  lastSeenTimestamp: number;
}

export interface NetworkMetrics {
  packetLossPercentage: number;
  latencyMs: number;
  bandwidthUsage: BandwidthUsage;
  channelUtilization: ChannelUtilization;
  internetReachability: boolean;
  networkHealth: NetworkHealth;
}

export interface NetworkSnapshot {
  snapshotId: string;
  timestamp: number;
  connectedDevices: ConnectedDevice[];
  activeDevicesCount: number;
  metrics: NetworkMetrics;
}

export interface EnvironmentalInference {
  inferenceId: string;
  timestamp: number;
  inferredPeopleCount: number;
  confidenceScore: number;
  description: string;
}

export interface ValidationEvidence {
  evidenceId: string;
  timestamp: number;
  snapshot: NetworkSnapshot;
  inference: EnvironmentalInference;
  isValid: boolean;
  notes: string;
}

export interface FieldValidationContext {
  contextId: string;
  incidentId: string;
  agentId: string;
  timestamp: number;
  evidences: ValidationEvidence[];
}

export interface RouterConfiguration {
  routerId: string;
  ipAddress: string;
  model: string;
  firmwareVersion: string;
  isEnabled: boolean;
}

export interface MockConfiguration {
  isMockEnabled: boolean;
  minConnectedDevices: number;
  maxConnectedDevices: number;
  minActiveDevices: number;
  maxActiveDevices: number;
  seed?: string;
}
