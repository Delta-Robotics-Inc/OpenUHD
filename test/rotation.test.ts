import { describe, it, expect } from "vitest";
import { checkSystem } from "../src/system/checks.js";
import { propMounts, resolveSpins } from "../src/system/rotation.js";
import type { ModuleDef } from "../src/types/index.js";
import { ARM, DRONE, lookup, lookupWith } from "./fixtures/drone.js";

describe("spin direction and prop handedness", () => {
  it("an arm instance's spin carries down to its motor and prop", () => {
    const spins = resolveSpins(DRONE, lookup);
    expect(spins.get("arm_rr/motor")?.spin).toBe("cw");
    expect(spins.get("arm_fr/motor")?.spin).toBe("ccw");
    expect(spins.get("arm_rl/prop")?.spin).toBe("ccw");
    expect(spins.get("arm_fl/prop")).toMatchObject({ spin: "cw", setAt: "arm_fl" });
    expect(spins.get("battery")?.spin).toBeUndefined();
  });

  it("finds each prop-on-shaft link inside the arm groups", () => {
    const mounts = propMounts(DRONE, lookup);
    expect(mounts.map((m) => m.linkId).sort()).toEqual(["arm_fl/prop_on_shaft", "arm_fr/prop_on_shaft", "arm_rl/prop_on_shaft", "arm_rr/prop_on_shaft"]);
    expect(mounts[0].variants).toEqual(["cw", "ccw"]);
  });

  it("the nominal build has every prop matching its motor", () => {
    const d = checkSystem(DRONE, lookup).diagnostics.filter((x) => x.rule === "prop_handedness");
    expect(d).toHaveLength(1);
    expect(d[0].severity).toBe("info");
    expect(d[0].message).toMatch(/^4 prop\(s\) match/);
  });

  it("a CW prop on a CCW motor is an error", () => {
    const cwProp: ModuleDef = { ...ARM, id: "fixture-arm-cw-prop", children: ARM.children!.map((c) => (c.id === "prop" ? { ...c, spin: "cw" as const } : c)) };
    const system: ModuleDef = { ...DRONE, children: DRONE.children!.map((c) => (c.id === "arm_fr" ? { ...c, moduleDefId: cwProp.id } : c)) };
    const errors = checkSystem(system, lookupWith(cwProp)).diagnostics.filter((x) => x.rule === "prop_handedness" && x.severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].refs).toEqual(["link:arm_fr/prop_on_shaft", "arm_fr/motor", "arm_fr/prop"]);
    expect(errors[0].details).toEqual({ motor: "ccw", prop: "cw" });
  });

  it("warns when a motor has no spin instead of assuming one", () => {
    const bare: ModuleDef = { ...DRONE, children: DRONE.children!.map((c) => (c.id === "arm_rl" ? { ...c, spin: undefined } : c)) };
    const w = checkSystem(bare, lookup).diagnostics.filter((x) => x.rule === "prop_handedness" && x.severity === "warning");
    expect(w.map((x) => x.id)).toEqual(["prop_handedness:arm_rl/prop_on_shaft"]);
  });
});
