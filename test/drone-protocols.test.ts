import { describe, it, expect } from "vitest";
import { validatePair } from "../src/drc/index.js";
import {
  BoltPattern,
  BrushlessPhases,
  CRSF,
  EscSignal,
  FcEscPort,
  Ground,
  PowerIn,
  PowerOut,
  Shaft,
  UART,
  cellCount,
  defineModule,
} from "../src/protocols/index.js";
import type { ModuleDef } from "../src/types/index.js";

/** Minimal drone stubs exercising the drone vocabulary (PB-780). */

const motorSignals = (role: "output" | "input", protocols: Parameters<typeof EscSignal>[0]["protocols"]) =>
  [1, 2, 3, 4].map((n) => EscSignal({ id: `m${n}`, name: `M${n}`, role, protocols, motorIndex: n }));

function esc(opts: { signal?: Parameters<typeof EscSignal>[0]["protocols"]; cells?: [number, number] } = {}): ModuleDef {
  const signals = motorSignals("input", opts.signal ?? ["dshot150", "dshot300", "dshot600"]);
  return defineModule({
    id: "stub-esc",
    name: "Stub 4-in-1 ESC",
    interfaces: [
      PowerIn({ id: "vbat_in", voltageV: [7, 25.2], parameters: [cellCount(opts.cells ?? [2, 6])] }),
      PowerOut({ id: "vbat_out", voltageV: [7, 25.2] }),
      Ground(),
      ...signals,
      FcEscPort({ side: "esc", motors: signals, vbat: "vbat_out", gnd: "gnd" }),
      ...BrushlessPhases({ id: "motor_1", role: "output", maxCurrentA: 60 }),
      BoltPattern({
        id: "stack_mount",
        role: "component",
        shape: "square",
        spacingMm: 30.5,
        holeCount: 4,
        fastener: "M3",
        fastenerDiameterMm: 3,
      }),
    ],
  });
}

const fcSignals = motorSignals("output", ["dshot150", "dshot300", "dshot600"]);
const fc = defineModule({
  id: "stub-fc",
  name: "Stub flight controller",
  interfaces: [
    PowerIn({ id: "vbat_in", voltageV: [7, 25.2] }),
    Ground(),
    ...fcSignals,
    FcEscPort({ side: "fc", motors: fcSignals, vbat: "vbat_in", gnd: "gnd" }),
    ...UART({ instance: 2, rx: { pin: "R2" }, tx: { pin: "T2" }, roles: ["host"] }),
  ],
});

const motor = defineModule({
  id: "stub-motor",
  name: "Stub brushless motor",
  interfaces: [
    ...BrushlessPhases({ role: "input", termination: "bare_wire_lead" }),
    BoltPattern({
      id: "base_mount",
      role: "component",
      shape: "square",
      spacingMm: 16,
      holeCount: 4,
      fastener: "M3",
      fastenerDiameterMm: 3,
    }),
    Shaft({ id: "shaft", role: "output", diameterMm: 5, thread: "M5" }),
  ],
});

function frame(stackSpacing: number): ModuleDef {
  return defineModule({
    id: "stub-frame",
    name: "Stub frame",
    interfaces: [
      BoltPattern({
        id: "stack_mount",
        role: "structure",
        shape: "square",
        spacingMm: stackSpacing,
        holeCount: 4,
        fastener: "M3",
        fastenerDiameterMm: 3,
      }),
    ],
  });
}

const battery = (cells: number): ModuleDef =>
  defineModule({
    id: "stub-battery",
    name: "Stub LiPo",
    interfaces: [
      PowerOut({ id: "xt60", voltageV: [cells * 3.0, cells * 4.2], maxCurrentA: 100, parameters: [cellCount(cells)] }),
    ],
  });

const receiver = defineModule({
  id: "stub-rx",
  name: "Stub ELRS receiver",
  interfaces: [...CRSF({ rx: { pin: "RX" }, tx: { pin: "TX" } })],
});

function connection(a: ModuleDef, b: ModuleDef, protocol: string) {
  return validatePair(a, b).connections.find((c) => c.protocol === protocol);
}

describe("drone vocabulary: builders", () => {
  it("BrushlessPhases emits three phase leaves and a composed 3-phase port", () => {
    const ifaces = BrushlessPhases({ role: "input" });
    expect(ifaces.map((i) => i.id)).toEqual(["phases_a", "phases_b", "phases_c", "phases"]);
    expect(ifaces[3].slots?.map((s) => s.id)).toEqual(["phase_a", "phase_b", "phase_c"]);
  });

  it("EscSignal collapses DShot rates into one protocol with a rate range", () => {
    const pin = EscSignal({ id: "m1", role: "output", protocols: ["dshot300", "dshot600", "pwm"] });
    expect(pin.protocols.map((p) => p.type).sort()).toEqual(["dshot", "pwm_esc"]);
    expect(pin.parameters?.find((p) => p.id === "esc_signal_rate")?.range).toEqual([300, 600]);
  });
});

describe("drone vocabulary: pair DRC", () => {
  it("ESC phase output connects to motor phases with three child links", () => {
    const c = connection(esc(), motor, "bldc_3phase");
    expect(c).toBeDefined();
    expect(c!.subLinks).toHaveLength(3);
    expect(c!.unresolvedSlots).toHaveLength(0);
  });

  it("FC ↔ ESC connector pairs M1–M4, VBAT and GND in order", () => {
    const c = connection(fc, esc(), "fc_esc_connector");
    expect(c).toBeDefined();
    expect(c!.subLinks).toHaveLength(6);
    expect(c!.unresolvedSlots).toHaveLength(0);
  });

  it("FC motor outputs do not connect to a PWM-only ESC over the connector", () => {
    const c = connection(fc, esc({ signal: ["pwm"] }), "fc_esc_connector");
    expect(c?.unresolvedSlots.length ?? 4).toBeGreaterThan(0);
  });

  it("30.5 mm stack pattern mates the 30.5 mm frame mount but not a 20 mm one", () => {
    expect(connection(frame(30.5), esc(), "bolt_pattern")?.state).not.toBe("incompatible");
    const mismatch = validatePair(frame(20), esc());
    const bolt = mismatch.connections.find((c) => c.protocol === "bolt_pattern");
    expect(bolt === undefined || bolt.state === "incompatible").toBe(true);
  });

  it("6S battery is accepted by a 2–6S ESC input and rejected by a 2–4S one", () => {
    expect(connection(battery(6), esc(), "power")?.state).not.toBe("incompatible");
    const low = validatePair(battery(6), esc({ cells: [2, 4] }));
    const power = low.connections.filter((c) => c.protocol === "power");
    expect(power.every((c) => c.state === "incompatible") || power.length === 0).toBe(true);
  });

  it("CRSF receiver connects to a flight controller UART", () => {
    const c = connection(fc, receiver, "uart");
    expect(c).toBeDefined();
    expect(c!.subLinks).toHaveLength(2);
  });
});
