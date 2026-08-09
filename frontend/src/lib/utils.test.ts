import { describe, expect, it } from "vitest";
import { cn, formatDate, formatTime, initials, priorityColor, tokenStatusLabel } from "./utils";

describe("cn", () => {
  it("merges class names and resolves conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("a b", false && "c", undefined, "d")).toBe("a b d");
  });
});

describe("formatDate", () => {
  it("formats a date", () => {
    expect(formatDate(new Date("2026-08-09T10:00:00Z"))).toMatch(/Aug/);
    expect(formatDate(new Date("2026-08-09T10:00:00Z"))).toMatch(/2026/);
  });
  it("returns a placeholder for missing input", () => {
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("formatTime", () => {
  it("formats a time", () => {
    expect(formatTime(new Date("2026-08-09T10:05:00Z"))).toMatch(/\d{2}:\d{2}/);
  });
  it("returns a placeholder for missing input", () => {
    expect(formatTime(undefined)).toBe("—");
  });
});

describe("initials", () => {
  it("returns initials from a name", () => {
    expect(initials("Ravi Teja")).toBe("RT");
  });
  it("handles a single word and empty input", () => {
    expect(initials("Ravi")).toBe("R");
    expect(initials(undefined)).toBe("?");
  });
});

describe("priorityColor", () => {
  it("maps each priority to a colour class", () => {
    expect(priorityColor("red")).toContain("bg-red-500/15");
    expect(priorityColor("orange")).toContain("bg-orange-500/15");
    expect(priorityColor("yellow")).toContain("bg-yellow-500/15");
    expect(priorityColor("green")).toContain("bg-emerald-500/15");
  });
  it("defaults unknown priorities to green", () => {
    expect(priorityColor("purple")).toContain("bg-emerald-500/15");
  });
});

describe("tokenStatusLabel", () => {
  it("maps known statuses to labels", () => {
    expect(tokenStatusLabel("waiting")).toBe("Waiting");
    expect(tokenStatusLabel("called")).toBe("In consultation");
    expect(tokenStatusLabel("completed")).toBe("Completed");
    expect(tokenStatusLabel("emergency")).toBe("Emergency");
  });
  it("passes through unknown statuses", () => {
    expect(tokenStatusLabel("draft")).toBe("draft");
    expect(tokenStatusLabel(undefined)).toBe("—");
  });
});
