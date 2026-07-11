import { 
  ConnectedDevice as IConnectedDevice, 
  NetworkSnapshot as INetworkSnapshot, 
  ValidationEvidence as IValidationEvidence,
  NetworkMetrics,
  EnvironmentalInference,
  SignalStrength
} from "../interfaces/network-interfaces";

export class ConnectedDeviceModel implements IConnectedDevice {
  constructor(
    public readonly deviceId: string,
    public readonly macAddress: string,
    public readonly ipAddress: string,
    public readonly signalStrength: SignalStrength,
    public readonly isConnected: boolean,
    public readonly lastSeenTimestamp: number
  ) {}
}

export class RouterInformationModel {
  constructor(
    public readonly routerId: string,
    public readonly ipAddress: string,
    public readonly model: string,
    public readonly firmwareVersion: string,
    public readonly uptimeSeconds: number
  ) {}
}

export class NetworkSnapshotModel implements INetworkSnapshot {
  constructor(
    public readonly snapshotId: string,
    public readonly timestamp: number,
    public readonly connectedDevices: ConnectedDeviceModel[],
    public readonly activeDevicesCount: number,
    public readonly metrics: NetworkMetrics
  ) {}
}

export class ValidationEvidenceModel implements IValidationEvidence {
  constructor(
    public readonly evidenceId: string,
    public readonly timestamp: number,
    public readonly snapshot: NetworkSnapshotModel,
    public readonly inference: EnvironmentalInference,
    public readonly isValid: boolean,
    public readonly notes: string
  ) {}
}

export class HistoricalSnapshotModel {
  constructor(
    public readonly historyId: string,
    public readonly snapshots: NetworkSnapshotModel[],
    public readonly recordedFrom: number,
    public readonly recordedTo: number
  ) {}
}

export class NetworkStatisticsModel {
  constructor(
    public readonly averageLatencyMs: number,
    public readonly averagePacketLoss: number,
    public readonly peakConnectedDevices: number,
    public readonly averageActiveDevices: number,
    public readonly timestamp: number
  ) {}
}
