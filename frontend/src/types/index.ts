// === INCIDENT TYPES ===
export type IncidentPriority = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "in-progress" | "dispatched" | "resolved" | "pending";

export interface Incident {
  id: string;
  priority: IncidentPriority;
  type: string;
  location: string;
  responseTeam: string;
  status: IncidentStatus;
  commander?: string;
  eta?: string;
  coordinates?: { lat: number; lng: number };
  timestamp: string;
}

// === AGENT TYPES ===
export type AgentStatus = "active" | "standby" | "deployed" | "on-leave" | "alert" | "offline";
export type AgentSpecialty = "tactical" | "paramedic" | "engineer" | "recon" | "medic";

export interface AIAgent {
  id: string;
  name: string;
  status: AgentStatus;
  confidence: number;
  currentTask: string;
  cpu: number;
  memory: number;
  icon: string;
}

export interface FieldOperative {
  id: string;
  name: string;
  specialty: AgentSpecialty;
  status: AgentStatus;
  heartRate: number;
  oxygenLevel: number;
  location: string;
  avatar: string;
  isAlert?: boolean;
  vitalsPath: string;
}

export interface RosterAgent {
  id: string;
  designation: string;
  specialty: string;
  status: AgentStatus;
  location: string;
  rating: number;
  dob?: string;
  bloodType?: string;
  clearance?: string;
  role?: string;
  avatar?: string;
  deploymentLogs?: DeploymentLog[];
}

export interface DeploymentLog {
  timestamp: string;
  location: string;
  description: string;
  isActive?: boolean;
}

// === DRONE TYPES ===
export type DroneStatus = "active" | "patrol" | "returning" | "maintenance" | "signal-lost";

export interface Drone {
  id: string;
  callsign: string;
  status: DroneStatus;
  altitude: number;
  speed: number;
  location: string;
  assignedIncident?: string;
  battery: number;
  coordinates?: { lat: number; lng: number };
}

// === RESOURCE TYPES ===
export type ResourceStatus = "en-route" | "active" | "depleted" | "standby" | "maintenance";

export interface ResourceLevel {
  name: string;
  icon: string;
  percentage: number;
  available: string;
  total: string;
  isCritical?: boolean;
}

export interface DeployedAsset {
  id: string;
  type: string;
  location: string;
  status: ResourceStatus;
}

// === ACTIVITY TYPES ===
export type LogLevel = "sys" | "warn" | "act" | "log" | "error";

export interface ActivityEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: string;
}

// === COMMUNICATION TYPES ===
export type ChannelStatus = "active" | "standby" | "encrypted" | "jammed";

export interface CommChannel {
  id: string;
  name: string;
  frequency: string;
  status: ChannelStatus;
  lastMessage: string;
  timestamp: string;
}

// === REPORT TYPES ===
export type ReportStatus = "submitted" | "reviewed" | "pending" | "classified";

export interface Report {
  id: string;
  title: string;
  author: string;
  status: ReportStatus;
  date: string;
  summary: string;
  sector: string;
}

// === SYSTEM TYPES ===
export interface SystemMetric {
  name: string;
  value: number;
  color: "primary" | "secondary" | "error";
}

export interface ActiveUnit {
  id: string;
  name: string;
  sector: string;
  type: string;
  status: AgentStatus;
  isWarning?: boolean;
}

// === MAP TYPES ===
export type MarkerType = "incident" | "drone" | "rescue" | "hospital" | "safe-zone";

export interface MapMarker {
  id: string;
  type: MarkerType;
  label: string;
  coordinates: { lat: number; lng: number };
  status?: string;
}

// === AUTH TYPES ===
export interface User {
  id: string;
  name: string;
  role: string;
  sector: string;
  avatar?: string;
}

// === NAV TYPES ===
export interface NavItem {
  label: string;
  icon: string;
  href: string;
  filledIcon?: boolean;
}
