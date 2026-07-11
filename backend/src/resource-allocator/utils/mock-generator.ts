import { Resource, ResourceType } from "../interfaces/resource-allocator.interface";

export class MockResourceGenerator {
  // Center coordinates around Sector-7 Tactical Command Center (West Bengal, Kolkata region)
  private static readonly BASE_LAT = 22.557827;
  private static readonly BASE_LNG = 88.49682;

  /**
   * Generates a list of mock resources spread around the command center.
   */
  public static generateMockResources(): Resource[] {
    const resources: Resource[] = [];

    // 1. Police units
    for (let i = 1; i <= 5; i++) {
      resources.push({
        id: `POLICE-DEV-${i}`,
        name: `Patrol Unit ${i}`,
        type: "Police",
        status: i % 4 === 0 ? "Offline" : "Available",
        location: this.generateRandomOffsetLocation(0.02),
        metadata: {
          badgeNumber: `PB-${1000 + i}`,
          licensePlate: `WB-02-P-${1000 + i}`,
          officerCount: 2,
        },
      });
    }

    // 2. Ambulance units
    for (let i = 1; i <= 4; i++) {
      resources.push({
        id: `AMB-DEV-${i}`,
        name: `Ambulance Unit ${i}`,
        type: "Ambulance",
        status: i === 3 ? "Reserved" : "Available",
        location: this.generateRandomOffsetLocation(0.015),
        metadata: {
          licensePlate: `WB-02-A-${2000 + i}`,
          paramedicCount: 2,
        },
      });
    }

    // 3. Fire Trucks
    for (let i = 1; i <= 3; i++) {
      resources.push({
        id: `FIRE-DEV-${i}`,
        name: `Fire Engine ${i}`,
        type: "FireTruck",
        status: "Available",
        location: this.generateRandomOffsetLocation(0.025),
        metadata: {
          licensePlate: `WB-02-F-${3000 + i}`,
          waterCapacityLiters: 5000,
        },
      });
    }

    // 4. Rescue Boats
    for (let i = 1; i <= 2; i++) {
      resources.push({
        id: `BOAT-DEV-${i}`,
        name: `Rescue Boat ${i}`,
        type: "RescueBoat",
        status: "Available",
        location: this.generateRandomOffsetLocation(0.035),
        metadata: {
          capacity: 8,
          propulsionType: "Outboard Motor",
        },
      });
    }

    // 5. Hospitals
    resources.push({
      id: `HOSP-DEV-1`,
      name: "Sector-7 General Hospital",
      type: "Hospital",
      status: "Available",
      location: { latitude: this.BASE_LAT + 0.005, longitude: this.BASE_LNG - 0.005 },
      metadata: {
        totalBeds: 250,
        availableBeds: 45,
        icuAvailable: true,
        specialties: ["Emergency Medicine", "Trauma", "Cardiology"],
      },
    });

    resources.push({
      id: `HOSP-DEV-2`,
      name: "Argus Regional Care",
      type: "Hospital",
      status: "Available",
      location: { latitude: this.BASE_LAT - 0.01, longitude: this.BASE_LNG + 0.01 },
      metadata: {
        totalBeds: 120,
        availableBeds: 18,
        icuAvailable: false,
        specialties: ["Emergency Medicine", "Pediatrics"],
      },
    });

    // 6. Shelters
    resources.push({
      id: `SHELTER-DEV-1`,
      name: "Sector-7 Community Center Shelter",
      type: "Shelter",
      status: "Available",
      location: { latitude: this.BASE_LAT - 0.002, longitude: this.BASE_LNG - 0.008 },
      metadata: {
        capacity: 200,
        currentOccupancy: 68,
        amenities: ["Food Station", "Medical Booth", "Power Outlets"],
      },
    });

    return resources;
  }

  /**
   * Generates a coordinate slightly offset from base coordinates.
   */
  private static generateRandomOffsetLocation(maxOffset: number) {
    const latOffset = (Math.random() - 0.5) * 2 * maxOffset;
    const lngOffset = (Math.random() - 0.5) * 2 * maxOffset;
    return {
      latitude: this.BASE_LAT + latOffset,
      longitude: this.BASE_LNG + lngOffset,
    };
  }
}
