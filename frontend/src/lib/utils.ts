import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | Date | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", ...opts });
}

export function formatTime(iso: string | Date | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function initials(name: string | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function priorityColor(priority: string | undefined) {
  switch (priority) {
    case "red":
      return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
    case "orange":
      return "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30";
    case "yellow":
      return "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30";
    default:
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  }
}

export function tokenStatusLabel(status: string | undefined) {
  const map: Record<string, string> = {
    waiting: "Waiting",
    called: "In consultation",
    skipped: "Skipped",
    completed: "Completed",
    cancelled: "Cancelled",
    emergency: "Emergency",
  };
  return map[status ?? ""] ?? status ?? "—";
}
