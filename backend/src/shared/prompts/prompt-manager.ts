import { floodPromptTemplate } from "./templates/flood.prompt";
import { firePromptTemplate } from "./templates/fire.prompt";
import { earthquakePromptTemplate } from "./templates/earthquake.prompt";
import { buildingCollapsePromptTemplate } from "./templates/building_collapse.prompt";
import { chemicalLeakPromptTemplate } from "./templates/chemical_leak.prompt";
import { explosionPromptTemplate } from "./templates/explosion.prompt";
import { roadAccidentPromptTemplate } from "./templates/road_accident.prompt";
import { landslidePromptTemplate } from "./templates/landslide.prompt";
import { unknownPromptTemplate } from "./templates/unknown.prompt";
import { ValidationError } from "../errors/app-error";

export interface PromptTemplate {
  name: string;
  version: string;
  template: string;
}

export class PromptManager {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.registerTemplate(floodPromptTemplate);
    this.registerTemplate(firePromptTemplate);
    this.registerTemplate(earthquakePromptTemplate);
    this.registerTemplate(buildingCollapsePromptTemplate);
    this.registerTemplate(chemicalLeakPromptTemplate);
    this.registerTemplate(explosionPromptTemplate);
    this.registerTemplate(roadAccidentPromptTemplate);
    this.registerTemplate(landslidePromptTemplate);
    this.registerTemplate(unknownPromptTemplate);
  }

  private registerTemplate(template: PromptTemplate): void {
    if (!template.name || !template.version || !template.template) {
      throw new ValidationError("Invalid prompt template configuration");
    }
    this.templates.set(template.name.toLowerCase(), template);
  }

  /**
   * Retrieves a template by type. Falls back to "unknown" if not found.
   */
  public getTemplate(name: string): PromptTemplate {
    const key = name.toLowerCase();
    const template = this.templates.get(key) || this.templates.get("unknown");
    if (!template) {
      throw new ValidationError(`Template '${name}' and fallback 'unknown' not found.`);
    }
    return template;
  }

  /**
   * Interpolates variables into a template string.
   */
  public interpolate(templateStr: string, variables: Record<string, any>): string {
    let result = templateStr;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const stringValue = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
      result = result.split(placeholder).join(stringValue);
    }
    
    // Check if there are any remaining un-interpolated variables
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = result.match(regex);
    if (matches) {
      // Validate that all placeholders have been replaced.
      // If some optional fields are missing, replace them with empty string or empty object representation rather than failing completely.
      for (const match of matches) {
        result = result.split(match).join("");
      }
    }
    return result;
  }

  /**
   * Validates that the rendered prompt meets general length and safety requirements
   */
  public validatePrompt(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) {
      throw new ValidationError("Rendered prompt is empty");
    }
    if (prompt.length > 50000) {
      throw new ValidationError("Rendered prompt length exceeds limits");
    }
  }
}

export const promptManager = new PromptManager();
