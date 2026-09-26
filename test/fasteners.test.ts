import { describe, it, expect } from "vitest";
import { checkSystem } from "../src/system/checks.js";
import { fastenerHarnesses, fastenerTorqueRule, jointTorques } from "../src/system/fasteners.js";
import { SYSTEM, lookup } from "../library/systems/quadcopter-5in/index.js";
import type { ModuleDef } from "../src/types/index.js";

describe("fastener torques (PB-797)", () => {
  it("every quad fastener harness states a torque with a source or an assumption", () => {
    const hs = fastenerHarnesses(SYSTEM, lookup);
    expect(hs.map((h) => h.def.id).sort()).toEqual([
      "quadcopter-5in-camera-hardware",
      "quadcopter-5in-frame-hardware",
      "quadcopter-5in-gps-hardware",
      "quadcopter-5in-motor-hardware",
      "quadcopter-5in-stack-hardware",
      "quadcopter-5in-vtx-hardware",
    ]);
    for (const h of hs) {
      const ts = jointTorques(h.def, lookup);
      expect(ts.length).toBeGreaterThan(0);
      for (const t of ts) expect(t.basis).not.toBe("unsupported");
    }
    expect(hs.find((h) => h.def.id === "quadcopter-5in-motor-hardware")!.paths).toHaveLength(4);
  });

  it("torques sit on the part that is turned and stay below the supplier's steel-nut reference", () => {
    const motor = jointTorques(lookup("quadcopter-5in-motor-hardware")!, lookup)[0];
    expect(motor.part?.id).toBe("motor-screw-m3x8");
    expect(motor.torque.torqueNm).toBe(0.6);
    const stack = jointTorques(lookup("quadcopter-5in-stack-hardware")!, lookup)[0];
    expect(stack.part?.tags).toContain("nut");
    for (const h of fastenerHarnesses(SYSTEM, lookup))
      for (const t of jointTorques(h.def, lookup)) for (const r of t.torque.reference ?? []) expect(t.torque.torqueNm).toBeLessThanOrEqual(Math.max(...(t.torque.reference ?? []).map((x) => x.torqueNm)));
  });

  it("the nominal check summarises the joints and counts the assumed torques", () => {
    const d = checkSystem(SYSTEM, lookup).diagnostics.filter((x) => x.rule === "fastener_torque");
    expect(d).toHaveLength(1);
    expect(d[0].details).toEqual({ joints: 6, assumed: 8 });
  });

  it("reports a joint with no torque, and a torque with no basis", () => {
    const motorHw = lookup("quadcopter-5in-motor-hardware")!;
    const none: ModuleDef = { ...motorHw, fastenerStack: motorHw.fastenerStack!.map(({ torque: _t, ...i }) => i) };
    const bare: ModuleDef = { ...motorHw, fastenerStack: motorHw.fastenerStack!.map((i) => ({ ...i, torque: { torqueNm: 2 } })) };
    const run = (d: ModuleDef) => fastenerTorqueRule(SYSTEM, (id) => (id === d.id ? d : lookup(id)));
    expect(run(none).find((x) => x.id === "fastener_torque:quadcopter-5in-motor-hardware")?.severity).toBe("warning");
    expect(run(bare).find((x) => x.id === "fastener_torque:quadcopter-5in-motor-hardware:0")?.severity).toBe("error");
  });
});
