import { describe, it, expect } from "vitest";
import { massByDefinition, moduleMass, systemMass } from "../src/system/mass.js";
import { DRONE, FRAME, MOTOR, MOTOR_SCREW, STANDOFF, cadVolumeMm3, lookup } from "./fixtures/drone.js";

describe("mass from the model", () => {
  it("custom plates: CAD volume x declared density", () => {
    const m = moduleMass(FRAME, cadVolumeMm3)!;
    expect(m.basis).toBe("cad_volume");
    expect(m.volumeMm3).toBe(60_000);
    expect(m.material?.density_g_cm3).toBe(1.5);
    expect(m.massG).toBeCloseTo(60 * 1.5, 9);
    expect(m.assumed).toBe(true);
    expect(moduleMass(FRAME)).toBeUndefined(); // no volume source, no mass
    expect(moduleMass({ id: "no-cad", name: "No CAD", interfaces: [] }, cadVolumeMm3)).toBeUndefined();
  });

  it("a stated weight wins over CAD volume", () => {
    expect(moduleMass(MOTOR, cadVolumeMm3)).toMatchObject({ massG: 32, basis: "stated", assumed: false });
    expect(moduleMass(STANDOFF, cadVolumeMm3)).toMatchObject({ massG: 1.8, basis: "stated" });
    expect(moduleMass(MOTOR_SCREW, cadVolumeMm3)).toMatchObject({ basis: "cad_volume", massG: 0.08 * 8 });
  });

  it("sums instances by quantity through groups and harnesses, and lists what has no mass", () => {
    const m = systemMass(DRONE, lookup, cadVolumeMm3);
    const by = new Map(massByDefinition(m).map((g) => [g.def.id, g]));
    expect(by.get(MOTOR.id)?.quantity).toBe(4);
    expect(by.get(MOTOR_SCREW.id)?.quantity).toBe(16); // 4 per motor harness x 4 arms
    expect(by.get("fixture-spacer-m3x6")?.totalG).toBeCloseTo(8 * 0.15, 9);
    expect(m.missing.map((e) => e.path).sort()).toEqual(["stack/sh8_cable", "video_cable", "xt60_lead"]);
    const sum = m.entries.reduce((s, e) => s + (e.totalG ?? 0), 0);
    expect(m.totalG).toBeCloseTo(sum, 9);
    expect(m.assumedG).toBeGreaterThan(0);
    expect(m.assumedG).toBeLessThan(m.totalG);
  });
});
