import { describe, it, expect } from "vitest";
import { checkSystem } from "../src/system/checks.js";
import { fastenerHarnesses, fastenerTorqueRule, jointTorques } from "../src/system/fasteners.js";
import type { ModuleDef } from "../src/types/index.js";
import { DRONE, MOTOR_HARDWARE, STACK_HARDWARE, lookup } from "./fixtures/drone.js";

describe("fastener torques (PB-797)", () => {
  it("finds every fastener harness once, with the instances that use it", () => {
    const hs = fastenerHarnesses(DRONE, lookup);
    expect(hs.map((h) => h.def.id).sort()).toEqual(["fixture-gps-hardware", "fixture-motor-hardware", "fixture-plate-hardware", "fixture-stack-hardware"]);
    expect(hs.find((h) => h.def.id === MOTOR_HARDWARE.id)!.paths).toEqual(["arm_fr_hardware", "arm_rr_hardware", "arm_rl_hardware", "arm_fl_hardware"]);
    for (const h of hs) for (const t of jointTorques(h.def, lookup)) expect(t.basis).toBe("assumption");
  });

  it("torques sit on the part that is turned", () => {
    const motor = jointTorques(MOTOR_HARDWARE, lookup)[0];
    expect(motor.part?.id).toBe("fixture-screw-m3x8");
    expect(motor.torque.torqueNm).toBe(0.6);
    const stack = jointTorques(STACK_HARDWARE, lookup);
    expect(stack.map((t) => [t.index, t.child])).toEqual([[3, "nuts"]]);
    expect(stack[0].part?.tags).toContain("nut");
  });

  it("the nominal check summarises the joints and counts the assumed torques", () => {
    const d = checkSystem(DRONE, lookup).diagnostics.filter((x) => x.rule === "fastener_torque");
    expect(d).toHaveLength(1);
    expect(d[0].details).toEqual({ joints: 4, assumed: 5 });
  });

  it("reports a joint with no torque, and a torque with no basis", () => {
    const none: ModuleDef = { ...MOTOR_HARDWARE, fastenerStack: MOTOR_HARDWARE.fastenerStack!.map(({ torque: _t, ...i }) => i) };
    const bare: ModuleDef = { ...MOTOR_HARDWARE, fastenerStack: MOTOR_HARDWARE.fastenerStack!.map((i) => ({ ...i, torque: { torqueNm: 2 } })) };
    const run = (d: ModuleDef) => fastenerTorqueRule(DRONE, (id) => (id === d.id ? d : lookup(id)));
    expect(run(none).find((x) => x.id === "fastener_torque:fixture-motor-hardware")?.severity).toBe("warning");
    expect(run(bare).find((x) => x.id === "fastener_torque:fixture-motor-hardware:0")?.severity).toBe("error");
  });
});
