import { describe, it, expect } from "vitest";
import { massByDefinition, moduleMass, systemMass } from "../src/system/mass.js";
import { cadVolumeMm3 } from "../library/cad/manifests.js";
import { SYSTEM, lookup } from "../library/systems/quadcopter-5in/index.js";

describe("mass from the model (PB-797)", () => {
  it("the generators record body volume in the manifest", () => {
    expect(cadVolumeMm3(lookup("quadcopter-5in-frame")!)).toBeGreaterThan(50_000);
    expect(cadVolumeMm3(lookup("iso-4762-m3x8")!)).toBeGreaterThan(0);
    expect(cadVolumeMm3({ id: "no-cad", name: "No CAD", interfaces: [] })).toBeUndefined();
  });

  it("custom plates: CAD volume × declared 3K carbon density", () => {
    const frame = lookup("quadcopter-5in-frame")!;
    const m = moduleMass(frame, cadVolumeMm3)!;
    expect(m.basis).toBe("cad_volume");
    expect(m.material?.density_g_cm3).toBe(1.52);
    expect(m.massG).toBeCloseTo((cadVolumeMm3(frame)! / 1000) * 1.52, 9);
    expect(m.assumed).toBe(true);
    expect(moduleMass(frame)).toBeUndefined(); // no volume source, no mass
  });

  it("a stated weight wins; supplier datasheet weights are used for the Ettinger parts", () => {
    expect(moduleMass(lookup("meps-neon-2207-v2-1950kv")!, cadVolumeMm3)).toMatchObject({ massG: 36, basis: "stated" });
    expect(moduleMass(lookup("m3-aluminium-standoff-30mm")!, cadVolumeMm3)).toMatchObject({ massG: 1.82, basis: "stated" });
    expect(moduleMass(lookup("iso-4762-m3x8")!, cadVolumeMm3)?.basis).toBe("cad_volume");
  });

  it("sums instances by quantity through groups and harnesses, and lists what has no mass", () => {
    const m = systemMass(SYSTEM, lookup, cadVolumeMm3);
    const by = new Map(massByDefinition(m).map((g) => [g.def.id, g]));
    expect(by.get("meps-neon-2207-v2-1950kv")?.quantity).toBe(4);
    expect(by.get("motor-screw-m3x8")?.quantity).toBe(16); // 4 per arm harness × 4 arms
    expect(by.get("ettinger-005-83-060-m3-nylon-spacer-6mm")?.totalG).toBeCloseTo(8 * 0.15, 9);
    expect(m.missing.map((e) => e.path).sort()).toEqual(["bulk_cap", "dji_cable", "stack/sh8_cable", "xt60_lead"]);
    const sum = m.entries.reduce((s, e) => s + (e.totalG ?? 0), 0);
    expect(m.totalG).toBeCloseTo(sum, 9);
    expect(m.totalG).toBeGreaterThan(550);
    expect(m.totalG).toBeLessThan(650);
    expect(m.assumedG).toBeGreaterThan(0);
    expect(m.assumedG).toBeLessThan(m.totalG);
  });
});
