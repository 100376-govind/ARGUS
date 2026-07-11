export type ThreatCategory =
  | "FLOOD"
  | "GEOLOGICAL"
  | "TRANSPORTATION"
  | "HAZARDOUS_MATERIAL"
  | "FIRE"
  | "MEDICAL"
  | "PUBLIC_SAFETY"
  | "UTILITY"
  | "UNKNOWN";

export type ThreatSubtype =
  | "flood"
  | "urban_flood"
  | "flash_flood"
  | "cyclone"
  | "earthquake"
  | "building_collapse"
  | "road_accident"
  | "train_accident"
  | "chemical_leak"
  | "gas_leak"
  | "explosion"
  | "urban_fire"
  | "forest_fire"
  | "hospital_emergency"
  | "crowd_stampede"
  | "infrastructure_failure"
  | "power_failure"
  | "unknown";

export interface ThreatDefinition {
  subtype: ThreatSubtype;
  category: ThreatCategory;
  description: string;
  escalationRules: string[];
  metadata: {
    baseThreatWeight: number; // 0.0 - 1.0 multiplier
    defaultSeverityScore: number; // 0 - 100
    criticalFactors: string[];
  };
}

export class ThreatClassificationEngine {
  private readonly threatDefinitions: Map<ThreatSubtype, ThreatDefinition> = new Map();

  constructor() {
    this.initializeDefinitions();
  }

  private initializeDefinitions(): void {
    const definitions: ThreatDefinition[] = [
      {
        subtype: "flood",
        category: "FLOOD",
        description: "General inundation of normally dry land due to rising water bodies.",
        escalationRules: [
          "Water level rises past barrier limits",
          "Drainage network capacity exceeded",
          "Upstream reservoir discharge",
        ],
        metadata: {
          baseThreatWeight: 0.6,
          defaultSeverityScore: 50,
          criticalFactors: ["river_levels", "rainfall_volume", "barrier_state"],
        },
      },
      {
        subtype: "urban_flood",
        category: "FLOOD",
        description: "Flooding in heavily developed urban areas caused by rainfall exceeding drainage capacity.",
        escalationRules: [
          "Severe drainage blockages reported",
          "Major roads fully submerged",
          "Basement residential area water entry",
        ],
        metadata: {
          baseThreatWeight: 0.7,
          defaultSeverityScore: 60,
          criticalFactors: ["drainage_blocks", "submerged_metro_lines", "population_density"],
        },
      },
      {
        subtype: "flash_flood",
        category: "FLOOD",
        description: "Sudden, high-velocity flooding caused by torrential rain, requiring immediate evacuation.",
        escalationRules: [
          "Rainfall rate exceeds 50mm/hour",
          "Sudden riverbank break upstream",
          "Civilian vehicles swept away",
        ],
        metadata: {
          baseThreatWeight: 0.9,
          defaultSeverityScore: 85,
          criticalFactors: ["water_velocity", "entrapment_risk", "rate_of_rise"],
        },
      },
      {
        subtype: "cyclone",
        category: "FLOOD",
        description: "Severe tropical storm with high winds, storm surge, and destructive rainfall.",
        escalationRules: [
          "Wind speeds exceed 120 km/h",
          "Coastal storm surge exceeds 2 meters",
          "Power grid poles down over major sector",
        ],
        metadata: {
          baseThreatWeight: 0.85,
          defaultSeverityScore: 80,
          criticalFactors: ["wind_speed", "coastal_surge", "evacuation_compliance"],
        },
      },
      {
        subtype: "earthquake",
        category: "GEOLOGICAL",
        description: "Seismic ground shaking causing structural collapses and secondary fire or leak hazards.",
        escalationRules: [
          "Aftershocks exceed magnitude 5.0",
          "Gas supply lines ruptured in multiple sectors",
          "Substation or dam structural compromise",
        ],
        metadata: {
          baseThreatWeight: 0.9,
          defaultSeverityScore: 90,
          criticalFactors: ["magnitude", "shaking_intensity", "structural_integrity"],
        },
      },
      {
        subtype: "building_collapse",
        category: "GEOLOGICAL",
        description: "Failure of building load-bearing structures resulting in entrapment or structural debris.",
        escalationRules: [
          "Neighboring high-rise structures listing/cracking",
          "Secondary debris falls blocking rescue lanes",
          "Severe utility main bursts inside wreckage",
        ],
        metadata: {
          baseThreatWeight: 0.85,
          defaultSeverityScore: 80,
          criticalFactors: ["trapped_victims", "structural_stability", "hazmat_proximity"],
        },
      },
      {
        subtype: "road_accident",
        category: "TRANSPORTATION",
        description: "Vehicular collision on major transit routes causing blockage or passenger injuries.",
        escalationRules: [
          "Involvement of cargo truck carrying flammable materials",
          "Multi-vehicle pile-up exceeding 5 cars",
          "Arterial highway completely blocked",
        ],
        metadata: {
          baseThreatWeight: 0.5,
          defaultSeverityScore: 40,
          criticalFactors: ["victim_count", "hazmat_involvement", "road_blockage"],
        },
      },
      {
        subtype: "train_accident",
        category: "TRANSPORTATION",
        description: "Train derailment or collision presenting massive mass casualty risks.",
        escalationRules: [
          "Derailment in high-speed corridor",
          "Passenger coaches overturned or breached",
          "Power overhead lines snapped and live",
        ],
        metadata: {
          baseThreatWeight: 0.85,
          defaultSeverityScore: 85,
          criticalFactors: ["derailed_coaches", "casualty_volume", "location_accessibility"],
        },
      },
      {
        subtype: "chemical_leak",
        category: "HAZARDOUS_MATERIAL",
        description: "Accidental release of toxic chemical agents threating health or environment.",
        escalationRules: [
          "Plume migrating towards residential district",
          "Runoff water contaminated with industrial solvent",
          "Reaction with moisture creating secondary fire",
        ],
        metadata: {
          baseThreatWeight: 0.9,
          defaultSeverityScore: 85,
          criticalFactors: ["plume_direction", "compound_toxicity", "population_density"],
        },
      },
      {
        subtype: "gas_leak",
        category: "HAZARDOUS_MATERIAL",
        description: "Leak of combustible or asphyxiant gas presenting risk of ignition or suffocation.",
        escalationRules: [
          "Gas readings exceed lower explosive limit (LEL)",
          "Leak detected in confined spaces of high-rise",
          "Pressure regulatory valve malfunction",
        ],
        metadata: {
          baseThreatWeight: 0.85,
          defaultSeverityScore: 80,
          criticalFactors: ["lel_percentage", "confinement_level", "ignition_sources"],
        },
      },
      {
        subtype: "explosion",
        category: "HAZARDOUS_MATERIAL",
        description: "Rapid expansion of pressure and heat causing devastation, blast injuries, and fire.",
        escalationRules: [
          "Rupture of neighboring pressurized silos/tanks",
          "Fire spreading to nearby munitions or chemical storages",
          "Toxic fumes entering storm drains",
        ],
        metadata: {
          baseThreatWeight: 0.95,
          defaultSeverityScore: 90,
          criticalFactors: ["blast_radius", "secondary_tank_exposure", "shockwave_damage"],
        },
      },
      {
        subtype: "urban_fire",
        category: "FIRE",
        description: "Uncontrolled fire in built-up commercial or residential districts.",
        escalationRules: [
          "Fire spreads to adjacent structures (wind-driven)",
          "Inability to establish water supply pressure",
          "Victims trapped on upper floor balconies",
        ],
        metadata: {
          baseThreatWeight: 0.8,
          defaultSeverityScore: 70,
          criticalFactors: ["building_occupancy", "wind_velocity", "water_source_distance"],
        },
      },
      {
        subtype: "forest_fire",
        category: "FIRE",
        description: "Wildfire spreading through forest or scrubland toward urban interface.",
        escalationRules: [
          "Fire jumps established containment lines",
          "Embers starting secondary fires 1km ahead",
          "Evacuation corridors cut off by smoke",
        ],
        metadata: {
          baseThreatWeight: 0.75,
          defaultSeverityScore: 65,
          criticalFactors: ["wind_direction", "fuel_dryness", "urban_interface_distance"],
        },
      },
      {
        subtype: "hospital_emergency",
        category: "MEDICAL",
        description: "Crisis within medical facilities requiring immediate triage, backup power, or evacuation.",
        escalationRules: [
          "ICU/NICU backup generators fail to start",
          "Fire alarm triggered in oxygen cylinder depot",
          "Sudden influx of critical trauma patients",
        ],
        metadata: {
          baseThreatWeight: 0.9,
          defaultSeverityScore: 85,
          criticalFactors: ["critical_patients", "backup_power_status", "evacuation_needs"],
        },
      },
      {
        subtype: "crowd_stampede",
        category: "PUBLIC_SAFETY",
        description: "Surge or panic in mass gatherings leading to crush injuries and casualties.",
        escalationRules: [
          "Emergency exits locked or blocked",
          "Police warning systems fail",
          "Uncontrolled rush toward narrow chokepoint",
        ],
        metadata: {
          baseThreatWeight: 0.8,
          defaultSeverityScore: 75,
          criticalFactors: ["crowd_density", "exit_capacity", "panic_index"],
        },
      },
      {
        subtype: "infrastructure_failure",
        category: "UTILITY",
        description: "Failure of bridges, dams, or water supply lines critical to community survival.",
        escalationRules: [
          "Structural shift in reservoir dam concrete",
          "Water purification systems contaminated",
          "Major transport bridge load-bearing beam shear",
        ],
        metadata: {
          baseThreatWeight: 0.75,
          defaultSeverityScore: 65,
          criticalFactors: ["failure_scale", "downstream_population", "utility_redundancy"],
        },
      },
      {
        subtype: "power_failure",
        category: "UTILITY",
        description: "Blackout in power grids affecting grid stability and critical infrastructure services.",
        escalationRules: [
          "Cascade failure across regional grid lines",
          "Loss of electrical feed to subway/railway networks",
          "Duration of outage exceeds 12 hours",
        ],
        metadata: {
          baseThreatWeight: 0.7,
          defaultSeverityScore: 55,
          criticalFactors: ["affected_grid_nodes", "redundant_lines", "temperature_extremes"],
        },
      },
      {
        subtype: "unknown",
        category: "UNKNOWN",
        description: "Undetermined hazard requires generic assessment parameters.",
        escalationRules: [
          "Sudden escalation or secondary events occurring",
          "Details remain highly ambiguous",
        ],
        metadata: {
          baseThreatWeight: 0.4,
          defaultSeverityScore: 30,
          criticalFactors: ["report_consistency", "information_gaps"],
        },
      },
    ];

    for (const def of definitions) {
      this.threatDefinitions.set(def.subtype, def);
    }
  }

  /**
   * Retrieves a ThreatDefinition based on incident subtype. Fallback to 'unknown'.
   */
  public getThreatDefinition(subtype: string): ThreatDefinition {
    const key = subtype.toLowerCase() as ThreatSubtype;
    return this.threatDefinitions.get(key) || this.threatDefinitions.get("unknown")!;
  }

  /**
   * Validates if a subtype belongs to a specific threat category.
   */
  public isCategoryMatch(subtype: string, category: ThreatCategory): boolean {
    const def = this.getThreatDefinition(subtype);
    return def.category === category;
  }
}

export const threatClassificationEngine = new ThreatClassificationEngine();
