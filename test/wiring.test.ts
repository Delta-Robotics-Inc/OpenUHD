import { describe, it, expect } from "vitest";
import { wiringChecklist, wiringMarkdown } from "../src/system/wiring.js";
import { DRONE, lookup } from "./fixtures/drone.js";

describe("wiring checklist", () => {
  const steps = wiringChecklist(DRONE, lookup);

  it("flags UART crossovers and labels motor phases individually", () => {
    const crsf = steps.find((s) => s.linkId === "rx_crsf")!;
    expect(crsf.connections.length).toBeGreaterThan(0);
    expect(crsf.connections.every((c) => c.crossover)).toBe(true);
    const m1 = steps.find((s) => s.linkId === "m1_phases")!;
    expect(new Set(m1.connections.map((c) => c.from)).size).toBe(3);
  });

  it("groups the steps by the harness that carries them", () => {
    expect(steps.find((s) => s.linkId === "video_osd")?.harness).toBe("video_cable");
    const md = wiringMarkdown("Fixture", steps);
    expect(md).toMatch(/^# Wiring and assembly checklist — Fixture/);
    expect(md).toContain("## video_cable");
    expect(md).toContain("— crossover");
  });
});
