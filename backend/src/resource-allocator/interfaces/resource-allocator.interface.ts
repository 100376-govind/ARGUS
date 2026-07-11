export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export type ResourceType = "Police" | "Ambulance" | "FireTruck" | "RescueBoat" | "Shelter" | "Hospital";
export type ResourceStatus = "Available" | "Reserved" | "Deployed" | "Offline";

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  location: Location;
  metadata?: Record<string, any>;
}

export interface Responder extends Resource {
  type: "Police" | "Ambulance";
  badgeNumber: string;
  specialty: string;
  phoneNumber: string;
}

export interface Vehicle extends Resource {
  type: "Police" | "Ambulance" | "FireTruck" | "RescueBoat";
  licensePlate: string;
  capacity: number;
  fuelLevel: number;
}

export interface Hospital extends Resource {
  type: "Hospital";
  totalBeds: number;
  availableBeds: number;
  specialties: string[];
  icuAvailable: boolean;
}

export interface Shelter extends Resource {
  type: "Shelter";
  capacity: number;
  currentOccupancy: number;
  amenities: string[];
}

export interface FireStation extends Resource {
  type: "FireTruck";
  stationNumber: string;
  unitsAvailableCount: number;
}

export interface PoliceStation extends Resource {
  type: "Police";
  precinctNumber: string;
  unitsAvailableCount: number;
}

export interface ETA {
  estimatedTimeMinutes: number;
  distanceKm: number;
}

export type AllocationStatus = "Pending" | "Confirmed" | "Cancelled" | "Completed";

export interface Allocation {
  id: string;
  incidentId: string;
  resourceIds: string[];
  status: AllocationStatus;
  allocatedAt: Date;
  updatedAt: Date;
  etaMap: Record<string, ETA>; // Map of resourceId -> ETA
}
