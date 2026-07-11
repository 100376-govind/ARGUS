import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { IncidentEntity } from "@/domain/entities/incident";

export class PDFExportService {
  public static async exportIncidentAuditPDF(incident: IncidentEntity, complianceData: any): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Title
    page.drawText("ARGUS TACTICAL COMMAND CENTER", {
      x: 50,
      y: height - 50,
      size: 18,
      font: boldFont,
      color: rgb(0.1, 0.5, 0.7),
    });

    page.drawText("INCIDENT COMPLIANCE AUDIT REPORT", {
      x: 50,
      y: height - 80,
      size: 14,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Metadata lines helper
    let y = height - 120;
    const drawLine = (label: string, value: string) => {
      page.drawText(label, { x: 50, y, size: 10, font: boldFont });
      page.drawText(value || "N/A", { x: 180, y, size: 10, font });
      y -= 18;
    };

    drawLine("Incident ID:", incident.id);
    drawLine("Incident Type:", incident.incidentType);
    drawLine("Source Channel:", incident.source);
    drawLine("Current Status:", incident.status);
    drawLine("Confidence level:", `${Math.round(incident.confidence * 100)}%`);
    drawLine("Generated At:", new Date().toLocaleString());

    y -= 10;

    // Report sections
    const drawSection = (title: string, text: string) => {
      if (y < 100) return;
      page.drawText(title, { x: 50, y, size: 12, font: boldFont, color: rgb(0.1, 0.5, 0.7) });
      y -= 15;
      
      // Simple word wrapping
      const words = (text || "N/A").split(" ");
      let currentLine = "";
      for (const word of words) {
        if ((currentLine + " " + word).length > 80) {
          page.drawText(currentLine.trim(), { x: 50, y, size: 9, font });
          y -= 12;
          currentLine = word;
        } else {
          currentLine += " " + word;
        }
      }
      if (currentLine) {
        page.drawText(currentLine.trim(), { x: 50, y, size: 9, font });
        y -= 12;
      }
      y -= 10;
    };

    drawSection("SITUATION REPORT (SITREP)", complianceData.sitrep);
    drawSection("INCIDENT SUMMARY", complianceData.incidentSummary);
    drawSection("DECISION SUMMARY", complianceData.decisionSummary);
    drawSection("COMPLIANCE STATUS", complianceData.complianceStatus);

    if (complianceData.recommendations && Array.isArray(complianceData.recommendations)) {
      page.drawText("RECOMMENDATIONS", { x: 50, y, size: 12, font: boldFont, color: rgb(0.1, 0.5, 0.7) });
      y -= 15;
      for (const rec of complianceData.recommendations) {
        page.drawText(`- ${rec}`, { x: 50, y, size: 9, font });
        y -= 12;
      }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
