import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(date: string): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "active":
    case "deployed":
    case "in-progress":
    case "en-route":
      return "text-secondary";
    case "critical":
    case "alert":
    case "signal-lost":
    case "depleted":
      return "text-error";
    case "standby":
    case "pending":
      return "text-primary";
    case "offline":
    case "on-leave":
    case "maintenance":
      return "text-outline";
    default:
      return "text-on-surface-variant";
  }
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case "active":
    case "deployed":
    case "in-progress":
    case "en-route":
      return "bg-secondary";
    case "critical":
    case "alert":
    case "signal-lost":
    case "depleted":
      return "bg-error";
    case "standby":
    case "pending":
      return "bg-primary";
    case "offline":
    case "on-leave":
    case "maintenance":
      return "bg-outline";
    default:
      return "bg-on-surface-variant";
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "critical":
      return "text-error";
    case "high":
      return "text-tertiary-container";
    case "medium":
      return "text-secondary-container";
    case "low":
      return "text-outline";
    default:
      return "text-on-surface-variant";
  }
}

export function getPriorityBgColor(priority: string): string {
  switch (priority) {
    case "critical":
      return "bg-error";
    case "high":
      return "bg-tertiary-container";
    case "medium":
      return "bg-secondary-container";
    case "low":
      return "bg-outline";
    default:
      return "bg-on-surface-variant";
  }
}
