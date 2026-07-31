import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatCaseAge(createdAt: string, now = new Date()): string {
  const ms = Math.max(0, now.getTime() - new Date(createdAt).getTime());
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/** Compact remaining/overdue SLA clock (e.g. 42m, 1h 20m, −3h). */
export function formatSlaRemaining(dueAt: string, now = new Date()): string {
  const ms = new Date(dueAt).getTime() - now.getTime();
  const abs = Math.abs(ms);
  const totalMinutes = Math.floor(abs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const body =
    hours === 0
      ? `${minutes}m`
      : minutes === 0
        ? `${hours}h`
        : `${hours}h ${minutes}m`;
  return ms < 0 ? `−${body}` : body;
}
