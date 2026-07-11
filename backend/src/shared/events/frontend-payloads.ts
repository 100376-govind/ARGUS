import { SeverityLevel, PriorityLevel } from "@/domain/entities/risk-evaluator";

export interface DashboardUpdatePayload {
  incidentId: string;
  assessmentId: string;
  timestamp: string;
  
  // Dashboard indicators
  priorityBadge: {
    level: PriorityLevel;
    score: number;
    color: "green" | "yellow" | "orange" | "red"; // UI mapping colors
  };
  
  severityBadge: {
    level: SeverityLevel | "CATASTROPHIC";
    score: number;
    color: "green" | "yellow" | "orange" | "red" | "purple";
  };
  
  reasoningPanel: {
    bullets: string[];
    summary: string;
    confidence: number; // 0 - 100
  };
  
  timeline: {
    event: string;
    timestamp: string;
    actor: string;
  };
  
  activityFeed: {
    type: "INFO" | "WARNING" | "CRITICAL" | "ALERT";
    message: string;
    severity: "low" | "medium" | "high" | "critical";
    timestamp: string;
  };
  
  mapMarker: {
    incidentId: string;
    lat: number;
    lng: number;
    pulseColor: "blue" | "yellow" | "red" | "purple"; // Alert status marker pulse
  };
}

export class FrontendPayloadGenerator {
  /**
   * Translates a standard RiskAssessment entity and incident metadata
   * into the optimized frontend dashboard update payload structure.
   */
  public static generate(assessment: any, lat?: number | null, lng?: number | null): DashboardUpdatePayload {
    const severity = assessment.severity as SeverityLevel | "CATASTROPHIC";
    const priority = assessment.priority as PriorityLevel;
    
    // Resolve UI colors
    const severityColor = this.getSeverityColor(severity);
    const priorityColor = this.getPriorityColor(priority);
    const pulseColor = this.getMapPulseColor(severity, assessment.isProtocolZeroTriggered);

    // Bullet points parser
    let bullets: string[] = [];
    if (assessment.reasoning) {
      bullets = assessment.reasoning
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .map((line: string) => (line.startsWith("✓") ? line : `✓ ${line}`));
    }

    return {
      incidentId: assessment.incidentId,
      assessmentId: assessment.id,
      timestamp: new Date().toISOString(),
      priorityBadge: {
        level: priority,
        score: Math.round(assessment.overallRiskScore || 0),
        color: priorityColor,
      },
      severityBadge: {
        level: severity,
        score: Math.round(assessment.overallRiskScore || 0),
        color: severityColor,
      },
      reasoningPanel: {
        bullets: bullets.length > 0 ? bullets : ["✓ Risk assessment successfully compiled"],
        summary: assessment.reasoning || "Evaluation sequence finalized.",
        confidence: Math.round((assessment.confidence || 0) * 100),
      },
      timeline: {
        event: assessment.isProtocolZeroTriggered ? "Protocol Zero Recommendation Issued" : "Risk Assessment Completed",
        timestamp: new Date().toISOString(),
        actor: "agent:risk-evaluator",
      },
      activityFeed: {
        type: assessment.isProtocolZeroTriggered ? "CRITICAL" : (severity === "CRITICAL" || severity === "CATASTROPHIC" ? "ALERT" : "INFO"),
        message: assessment.isProtocolZeroTriggered 
          ? `CRITICAL ALERT: Protocol Zero trigger recommended for Incident ${assessment.incidentId}`
          : `Incident ${assessment.incidentId} risk updated to severity level: ${severity}`,
        severity: severity === "LOW" ? "low" : (severity === "MEDIUM" ? "medium" : (severity === "HIGH" ? "high" : "critical")),
        timestamp: new Date().toISOString(),
      },
      mapMarker: {
        incidentId: assessment.incidentId,
        lat: lat || 0.0,
        lng: lng || 0.0,
        pulseColor,
      },
    };
  }

  private static getSeverityColor(level: string): "green" | "yellow" | "orange" | "red" | "purple" {
    switch (level) {
      case "CATASTROPHIC": return "purple";
      case "CRITICAL": return "red";
      case "HIGH": return "orange";
      case "MEDIUM": return "yellow";
      default: return "green";
    }
  }

  private static getPriorityColor(level: string): "green" | "yellow" | "orange" | "red" {
    switch (level) {
      case "CRITICAL": return "red";
      case "HIGH": return "orange";
      case "MEDIUM": return "yellow";
      default: return "green";
    }
  }

  private static getMapPulseColor(severity: string, protocolZero: boolean): "blue" | "yellow" | "red" | "purple" {
    if (protocolZero) return "purple";
    if (severity === "CRITICAL" || severity === "CATASTROPHIC") return "red";
    if (severity === "HIGH" || severity === "MEDIUM") return "yellow";
    return "blue";
  }
}
