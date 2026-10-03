import { describe, it, expect } from "vitest";
import {
  boundaryInterfaces,
  formatPath,
  parsePath,
  primaryInterfaces,
  resolveEndpoint,
  resolveExports,
  validateLink,
  validateLinks,
} from "../src/system/index.js";
import type { ModuleDef } from "../src/types/index.js";
import { ARM, DRONE, GNSS, STACK, lookup } from "./fixtures/drone.js";

describe("canonical paths", () => {
  it("round-trips module, interface and slot", () => {
    const path = formatPath(["stack", "fc"], "uart1", "tx");
    expect(path).toBe("stack/fc:uart1/tx");
    expect(parsePath(path)).toEqual({ modules: ["stack", "fc"], interfaceId: "uart1", slotId: "tx" });
  });
});

describe("boundary interfaces", () => {
  it("hides leaves bound into a composed interface but keeps power leaves", () => {
    const ids = primaryInterfaces(GNSS).map((i) => i.id);
    expect(ids).toContain("uart_gnss");
    expect(ids).toContain("i2c_compass");
    expect(ids).toContain("gnd");
    expect(ids.some((id) => id.endsWith("_tx") || id.endsWith("_sda"))).toBe(false);
  });

  it("a group exports every child interface not linked internally", () => {
    const ids = resolveExports(ARM, lookup).map((e) => e.id);
    expect(ids).toContain("motor__phases");
    expect(ids).toContain("motor__base_mount");
    // shaft and hub are consumed by the internal prop_on_shaft link
    expect(ids).not.toContain("motor__shaft");
    expect(ids).not.toContain("prop__hub_bore");
    expect(boundaryInterfaces(ARM, lookup).map((i) => i.id)).toEqual(ids);
  });

  it("a module's explicit exports resolve through to the child interface", () => {
    const end = resolveEndpoint(DRONE, { child: "stack", interfaceId: "motor_1" }, lookup);
    expect(end.owner.id).toBe("fixture-esc-4in1");
    expect(end.iface.id).toBe("motor_1");
    expect(end.path).toBe("stack:motor_1");
  });
});

describe("system links", () => {
  it("every stored link validates as configured", () => {
    for (const def of [DRONE, STACK, ARM]) {
      for (const result of validateLinks(def, lookup)) {
        expect(result.state, `${def.id}:${result.link.id} ${result.diagnostics.map((d) => d.message).join("; ")}`).toBe("configured");
      }
    }
  });

  it("opens the compass link into SDA/SCL and the motor link into three phases", () => {
    const results = validateLinks(DRONE, lookup);
    const compass = results.find((r) => r.link.id === "gnss_i2c")!;
    expect(compass.children.map((c) => c.a.slotId).sort()).toEqual(["scl", "sda"]);
    const motor = results.find((r) => r.link.id === "m1_phases")!;
    expect(motor.children).toHaveLength(3);
  });

  it("the FC/ESC cable pairs M1–M4 and the power lines", () => {
    const [cable] = validateLinks(STACK, lookup);
    expect(cable.children.map((c) => c.a.slotId)).toEqual(expect.arrayContaining(["motor_1", "motor_2", "motor_3", "motor_4", "vbat", "gnd"]));
    expect(cable.unresolvedSlots).toHaveLength(0);
  });

  it("raw 6S battery on the video unit's input is incompatible (3.7–13.2 V)", () => {
    const result = validateLink(DRONE, { id: "bad", a: { child: "battery", interfaceId: "battery_out" }, b: { child: "video", interfaceId: "vcc" } }, lookup);
    expect(result.state).toBe("incompatible");
  });

  it("a mechanical interface cannot link to an electrical one", () => {
    const result = validateLink(DRONE, { id: "bad", a: { child: "frame", interfaceId: "stack_mount" }, b: { child: "stack", interfaceId: "uart1" } }, lookup);
    expect(result.state).toBe("incompatible");
    expect(result.diagnostics[0].message).toMatch(/domains differ/);
  });

  const m1 = (childLinks: { a: string; b: string; locked?: boolean }[]): ModuleDef => ({
    ...DRONE,
    links: [{ id: "m1_stored", a: { child: "stack", interfaceId: "motor_1" }, b: { child: "arm_rr", interfaceId: "motor__phases" }, childLinks }],
  });

  it("stored child links override derived ones (phase swap)", () => {
    const [result] = validateLinks(m1([{ a: "phase_a", b: "phase_a" }, { a: "phase_b", b: "phase_c", locked: true }, { a: "phase_c", b: "phase_b", locked: true }]), lookup);
    expect(result.children.map((c) => [c.a.slotId, c.b.slotId, c.method])).toEqual([
      ["phase_a", "phase_a", "manual"],
      ["phase_b", "phase_c", "manual"],
      ["phase_c", "phase_b", "manual"],
    ]);
  });

  it("stored child links that land two conductors on one slot are incompatible", () => {
    const [result] = validateLinks(m1([{ a: "phase_a", b: "phase_a" }, { a: "phase_b", b: "phase_c" }, { a: "phase_c", b: "phase_c" }]), lookup);
    expect(result.state).toBe("incompatible");
    expect(result.diagnostics[0].message).toMatch(/phase_c 2 times/);
  });
});
