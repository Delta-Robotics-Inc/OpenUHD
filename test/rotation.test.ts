import { describe, it, expect } from "vitest";
import { checkSystem } from "../src/system/checks.js";
import { propMounts, resolveSpins } from "../src/system/rotation.js";
import { SYSTEM, lookup } from "../library/systems/quadcopter-5in/index.js";
import { SCENARIOS } from "../library/systems/quadcopter-5in/scenarios.js";
import { betaflightConfig } from "../library/systems/quadcopter-5in/betaflight.js";
import type { ModuleDef } from "../src/types/index.js";

describe("spin direction and prop handedness (PB-797)", () => {
  it("arm instances carry Betaflight Quad-X props-in spin down to motor and prop", () => {
    const spins = resolveSpins(SYSTEM, lookup);
    expect(spins.get("arm_rr/motor")?.spin).toBe("cw"); // M1
    expect(spins.get("arm_fr/motor")?.spin).toBe("ccw"); // M2
    expect(spins.get("arm_rl/prop")?.spin).toBe("ccw"); // M3
    expect(spins.get("arm_fl/prop")).toMatchObject({ spin: "cw", setAt: "arm_fl" }); // M4
    expect(spins.get("battery")?.spin).toBeUndefined();
  });

  it("finds each prop-on-shaft link inside the arm groups", () => {
    const mounts = propMounts(SYSTEM, lookup);
    expect(mounts.map((m) => m.linkId).sort()).toEqual(["arm_fl/prop_on_shaft", "arm_fr/prop_on_shaft", "arm_rl/prop_on_shaft", "arm_rr/prop_on_shaft"]);
    expect(mounts[0].variants).toEqual(["cw", "ccw"]);
  });

  it("the nominal build has every prop matching its motor", () => {
    const d = checkSystem(SYSTEM, lookup).diagnostics.filter((x) => x.rule === "prop_handedness");
    expect(d).toHaveLength(1);
    expect(d[0].severity).toBe("info");
    expect(d[0].message).toMatch(/^4 prop\(s\) match/);
  });

  it("a CW prop on the CCW front-right motor is an error", () => {
    const s = SCENARIOS.find((x) => x.id === "prop-reversed")!;
    const errors = checkSystem(s.system, s.lookup).diagnostics.filter((x) => x.rule === "prop_handedness" && x.severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].refs).toEqual(["link:arm_fr/prop_on_shaft", "arm_fr/motor", "arm_fr/prop"]);
    expect(errors[0].details).toEqual({ motor: "ccw", prop: "cw" });
  });

  it("warns when a motor has no spin instead of assuming one", () => {
    const bare: ModuleDef = { ...SYSTEM, children: SYSTEM.children!.map((c) => (c.id === "arm_rl" ? { ...c, spin: undefined } : c)) };
    const w = checkSystem(bare, lookup).diagnostics.filter((x) => x.rule === "prop_handedness" && x.severity === "warning");
    expect(w.map((x) => x.id)).toEqual(["prop_handedness:arm_rl/prop_on_shaft"]);
  });

  it("Betaflight: props-in spins give yaw_motors_reversed OFF; all reversed give ON", () => {
    expect(betaflightConfig(SYSTEM, lookup).lines.map((l) => l.text)).toContain("set yaw_motors_reversed = OFF");
    const flip = { cw: "ccw", ccw: "cw" } as const;
    const out: ModuleDef = { ...SYSTEM, children: SYSTEM.children!.map((c) => (c.spin ? { ...c, spin: flip[c.spin] } : c)) };
    expect(betaflightConfig(out, lookup).lines.map((l) => l.text)).toContain("set yaw_motors_reversed = ON");
    const mixed: ModuleDef = { ...SYSTEM, children: SYSTEM.children!.map((c) => (c.id === "arm_fl" ? { ...c, spin: "ccw" as const } : c)) };
    expect(betaflightConfig(mixed, lookup).warnings.join(" ")).toMatch(/neither Quad-X props-in nor props-out/);
  });
});
