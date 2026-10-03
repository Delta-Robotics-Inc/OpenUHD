/**
 * PB-864: the vocabulary gaps logged by the ProtoPart port (PB-796):
 * steppers and step/dir, brushed motor outputs, encoder ports, RC servo
 * ports, shield headers, the CAN role family, cross bolt patterns, and
 * pneumatic and hydraulic ports.
 */
import { describe, expect, it } from "vitest";
import { validatePair } from "../src/drc/index.js";
import { areRolesCompatible } from "../src/matching/roles.js";
import {
  BoltPattern,
  BrushedMotorTerminals,
  CAN,
  CANLogic,
  FluidPort,
  Ground,
  HEADER_FORMS,
  Pin,
  PowerIn,
  PowerOut,
  QuadratureEncoder,
  ServoPort,
  ShieldHeader,
  StepDir,
  StepperPhases,
  defineModule,
  type FluidPortConfig,
} from "../src/protocols/index.js";
import { boltPatternHoles } from "../src/system/geometry.js";
import { deriveLinks } from "../src/system/derive.js";
import { validateLinks } from "../src/system/index.js";
import type { InterfaceDef, ModuleDef } from "../src/types/index.js";

const mod = (id: string, interfaces: InterfaceDef[]): ModuleDef => defineModule({ id, name: id, interfaces });
const connection = (a: ModuleDef, b: ModuleDef, protocol: string) => validatePair(a, b).connections.find((c) => c.protocol === protocol);

describe("steppers", () => {
  const driver = (winding: "bipolar" | "unipolar" = "bipolar") =>
    mod("stub-stepper-driver", StepperPhases({ role: "output", winding, maxCurrentA: 4.2, voltageV: [20, 50] }));
  const motor = mod("stub-nema17", StepperPhases({ role: "input", winding: "bipolar", maxCurrentA: 2, termination: "bare_wire_lead" }));

  it("StepperPhases emits a leaf per lead and a composed port with phase_a, phase_a_bar, phase_b, phase_b_bar", () => {
    const ifaces = StepperPhases({ role: "input", winding: "bipolar" });
    expect(ifaces.map((i) => i.id)).toEqual(["windings_phase_a", "windings_phase_a_bar", "windings_phase_b", "windings_phase_b_bar", "windings"]);
    expect(ifaces.at(-1)!.slots!.map((s) => [s.id, s.required])).toEqual([
      ["phase_a", true], ["phase_a_bar", true], ["phase_b", true], ["phase_b_bar", true],
    ]);
    expect(() => StepperPhases({ role: "input", winding: "bipolar", leads: { a: "x", aBar: "y", b: "z", bBar: "w", common: "c" } })).toThrow(/no centre tap/);
    expect(() => StepperPhases({ role: "input", winding: "unipolar", leads: { a: "x", aBar: "y", b: "z", bBar: "w" } })).toThrow(/needs common/);
  });

  it("a bipolar driver drives a bipolar motor, winding by winding", () => {
    const c = connection(driver(), motor, "bipolar_stepper_phases")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => `${l.from.slotId}>${l.to.slotId}`)).toEqual(["phase_a>phase_a", "phase_a_bar>phase_a_bar", "phase_b>phase_b", "phase_b_bar>phase_b_bar"]);
  });

  it("a unipolar driver does not drive a bipolar motor; a bipolar driver drives a six-wire unipolar motor with its taps open", () => {
    expect(connection(driver("unipolar"), motor, "bipolar_stepper_phases")).toBeUndefined();
    expect(connection(driver("unipolar"), motor, "unipolar_stepper_phases")).toBeUndefined();
    const sixWire = mod(
      "stub-6wire",
      StepperPhases({ role: "input", winding: "unipolar", bipolarCapable: true, leads: { a: { pin: "1" }, aBar: { pin: "3" }, b: { pin: "4" }, bBar: { pin: "6" }, commonA: { pin: "2" }, commonB: { pin: "5" } } }),
    );
    const c = connection(driver(), sixWire, "bipolar_stepper_phases")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks).toHaveLength(4);
    const fiveWire = mod("stub-28byj", StepperPhases({ role: "input", winding: "unipolar" }));
    expect(connection(driver("unipolar"), fiveWire, "unipolar_stepper_phases")!.subLinks).toHaveLength(5);
    expect(connection(driver(), fiveWire, "bipolar_stepper_phases")).toBeUndefined();
  });

  it("older stepper parts' driver and motor roles pair with output and input", () => {
    expect(areRolesCompatible("bipolar_stepper_phases", "output", "motor")).toBe(true);
    expect(areRolesCompatible("bipolar_stepper_phases", "driver", "input")).toBe(true);
    expect(areRolesCompatible("bipolar_stepper_phases", "driver", "motor")).toBe(true);
    expect(areRolesCompatible("bipolar_stepper_phases", "motor", "input")).toBe(false);
  });

  const stepDriver = mod(
    "stub-dm542t",
    StepDir({
      role: "input",
      step: { pin: "PUL+" },
      dir: { pin: "DIR+" },
      enable: { pin: "ENA+" },
      stepReturn: { pin: "PUL-" },
      dirReturn: { pin: "DIR-" },
      enableReturn: { pin: "ENA-" },
      maxStepRateHz: [0, 200_000],
      voltageV: [4, 28],
      minPulseWidthUs: 2.5,
      activeEdge: "rising",
    }),
  );
  const controller = (rate: number) =>
    mod("stub-mcu", StepDir({ role: "output", step: { pin: "D2" }, dir: { pin: "D3" }, enable: { pin: "D4" }, maxStepRateHz: rate, voltageV: 5 }));

  it("StepDir pairs a controller's STEP, DIR and ENABLE with a driver's opto inputs; the returns stay optional", () => {
    const c = connection(controller(50_000), stepDriver, "step_dir")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => `${l.from.slotId}>${l.to.slotId}`)).toEqual(["step>step", "dir>dir", "enable>enable"]);
    expect(c.unresolvedSlots).toEqual([]);
    const port = stepDriver.interfaces.find((i) => i.id === "step_dir")!;
    expect(port.traits?.[0].params).toMatchObject({ min_pulse_width_us: 2.5, active_edge: "rising", inputs: "differential_or_opto" });
  });

  it("a controller that steps faster than the driver accepts is a parameter conflict", () => {
    expect(connection(controller(400_000), stepDriver, "step_dir")!.state).toBe("incompatible");
  });
});

describe("brushed motor outputs", () => {
  const hBridge = mod("stub-drv8871", BrushedMotorTerminals({ role: "output", terminals: [{ pin: "OUT1" }, { pin: "OUT2" }], maxCurrentA: 3.6, voltageV: [6.5, 45] }));
  const motor = (v: [number, number]) => mod("stub-gearmotor", BrushedMotorTerminals({ role: "input", voltageV: v, termination: "spade_terminal" }));

  it("an H-bridge channel drives a brushed motor terminal by terminal", () => {
    const c = connection(hBridge, motor([6, 12]), "dc_motor")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => `${l.from.interfaceId}>${l.to.interfaceId}`)).toEqual(["motor_out_1>motor_1", "motor_out_2>motor_2"]);
    expect(motor([6, 12]).interfaces.find((i) => i.id === "motor")!.traits?.[0].type).toBe("motor_polarity");
  });

  it("a motor rated below the driver's supply range is a conflict", () => {
    expect(connection(hBridge, motor([3, 6]), "dc_motor")!.state).toBe("incompatible");
  });

  it("does not pair with brushless phases or stepper windings", () => {
    const steppers = mod("stub-stepper", StepperPhases({ role: "input", winding: "bipolar" }));
    expect(validatePair(hBridge, steppers).connections).toEqual([]);
  });
});

describe("encoder ports", () => {
  // A through-bore encoder (A, B, index, absolute PWM, 5 V) and a smart motor
  // controller's encoder input: the pair PB-796 could not mate.
  const encoder = (index = true) =>
    mod("stub-through-bore", [
      PowerIn({ id: "vcc", voltageV: [3.3, 5] }),
      Ground(),
      ...QuadratureEncoder({
        role: "output",
        a: { pin: "A" },
        b: { pin: "B" },
        ...(index ? { index: { pin: "I" } } : {}),
        absolute: { pin: "ABS" },
        power: "vcc",
        ground: "gnd",
        countsPerRev: 8192,
        voltageV: [3.3, 5],
        outputType: "push_pull",
      }),
    ]);
  const controllerInput = mod("stub-motor-controller", [
    PowerOut({ id: "enc_5v", voltageV: 5 }),
    Ground(),
    ...QuadratureEncoder({ role: "input", a: { pin: "7" }, b: { pin: "5" }, index: { pin: "9" }, absolute: { pin: "8" }, power: "enc_5v", ground: "gnd", voltageV: [0, 5] }),
  ]);

  it("an encoder mates a controller's encoder input: A, B, index, absolute, power and ground", () => {
    const c = connection(encoder(), controllerInput, "quadrature_encoder")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => l.from.slotId)).toEqual(["a", "b", "index", "absolute", "power", "ground"]);
  });

  it("an encoder without an index still mates an input that has one", () => {
    const c = connection(encoder(false), controllerInput, "quadrature_encoder")!;
    expect(c.state).toBe("valid");
    expect(c.unresolvedSlots).toEqual([]);
  });

  it("two encoders do not pair", () => {
    expect(connection(encoder(), encoder(), "quadrature_encoder")).toBeUndefined();
  });

  it("leaves carry the quadrature capabilities and open outputs note their pull-ups", () => {
    const ifaces = QuadratureEncoder({ role: "output", a: { pin: "A" }, b: { pin: "B" }, outputType: "open_collector" });
    expect(ifaces.slice(0, 2).map((i) => i.capabilities)).toEqual([["quadrature_a"], ["quadrature_b"]]);
    expect(JSON.stringify(ifaces.at(-1)!.traits)).toMatch(/pull-up/);
  });
});

describe("RC servo ports", () => {
  // DS3225-class servo on a PCA9685 servo shield channel.
  const servo = (pulse: [number, number] = [500, 2500]) =>
    mod("stub-ds3225", [
      PowerIn({ id: "vplus", voltageV: [4.8, 6.8] }),
      Ground(),
      ...ServoPort({ role: "input", signal: { pin: "SIG" }, power: "vplus", ground: "gnd", pulseWidthUs: pulse, frameRateHz: [50, 330], connector: "servo_3pin", gender: "plug", pinout: ["GND", "V+", "SIG"] }),
    ]);
  const channel = (frame: number | [number, number] = [24, 1526]) =>
    mod("stub-servo-shield", [
      PowerOut({ id: "vplus", voltageV: [4.8, 6] }),
      Ground(),
      ...ServoPort({ role: "output", signal: { pin: "PWM0" }, power: "vplus", ground: "gnd", pulseWidthUs: [0, 40_000], frameRateHz: frame, connector: "servo_3pin", gender: "header" }),
    ]);

  it("a servo plugs into a shield channel: signal, V+ and ground", () => {
    const c = connection(channel(), servo(), "rc_servo")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => l.from.slotId)).toEqual(["signal", "power", "ground"]);
  });

  it("a channel whose frame rate the servo cannot take is a conflict", () => {
    expect(connection(channel(400), servo(), "rc_servo")!.state).toBe("incompatible");
  });

  it("records the connector and pinout on the servo's port", () => {
    const port = servo().interfaces.find((i) => i.id === "servo")!;
    expect(port.traits?.[0].params).toMatchObject({ connector_type: "servo_3pin", gender: "plug", pinout: ["GND", "V+", "SIG"] });
    expect(port.parameters?.map((p) => p.id)).toEqual(["pulse_width", "frame_rate"]);
  });
});

describe("CAN role family", () => {
  const node = (id: string, rate: number | [number, number] = [125_000, 1_000_000]) =>
    mod(id, [Ground(), ...CAN({ canH: { pin: "CANH" }, canL: { pin: "CANL" }, ground: "gnd", bitRateBps: rate, fd: true, termination: "switchable" })]);

  it("two bus nodes pair CANH to CANH and CANL to CANL", () => {
    const c = connection(node("a"), node("b"), "can")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => `${l.from.slotId}>${l.to.slotId}`)).toEqual(["can_h>can_h", "can_l>can_l", "ground>ground"]);
  });

  it("nodes without a common bit rate are a conflict", () => {
    expect(connection(node("a", 1_000_000), node("b", 500_000), "can")!.state).toBe("incompatible");
  });

  it("node, transceiver and peer are one family on the bus side", () => {
    for (const [x, y] of [["node", "node"], ["node", "transceiver"], ["node", "peer"], ["transceiver", "peer"]]) expect(areRolesCompatible("can", x, y), `${x}/${y}`).toBe(true);
  });

  const mcu = mod("stub-mcu-can", CANLogic({ role: "controller", tx: { pin: "PA12" }, rx: { pin: "PA11" }, voltageV: 3.3 }));
  const phy = mod("stub-tja1051", [...CANLogic({ role: "transceiver", tx: { pin: "1" }, rx: { pin: "4" }, voltageV: 3.3 }), ...CAN({ canH: { pin: "7" }, canL: { pin: "6" } })]);

  it("a controller's TX and RX pair with a transceiver's TXD and RXD", () => {
    const c = connection(mcu, phy, "can_logic")!;
    expect(c.state).toBe("valid");
    expect(c.subLinks.map((l) => `${l.from.interfaceId}>${l.to.interfaceId}`)).toEqual(["can_logic_tx>can_logic_tx", "can_logic_rx>can_logic_rx"]);
    const tx = phy.interfaces.find((i) => i.id === "can_logic_tx")!;
    expect(tx.protocols).toEqual([{ type: "digital", roles: ["input"] }]);
  });

  it("two transceivers' logic sides do not pair, and neither do two controllers", () => {
    expect(areRolesCompatible("can_logic", "transceiver", "transceiver")).toBe(false);
    expect(areRolesCompatible("can_logic", "controller", "controller")).toBe(false);
    expect(connection(phy, phy, "can_logic")).toBeUndefined();
  });
});

describe("shield headers", () => {
  const HOST = mod("stub-uno", [
    PowerOut({ id: "rail_5v", voltageV: 5 }),
    Ground(),
    Pin({ id: "d9", pin: "D9", voltageV: 5, capabilities: { pwm: true } }),
    Pin({ id: "d10", pin: "D10", voltageV: 5, capabilities: { pwm: true } }),
    ShieldHeader({ form: "arduino_uno_r3", role: "host", pins: { "5V": "rail_5v", GND: "gnd", D9: "d9", D10: "d10" } }),
  ]);
  const SHIELD = mod("stub-servo-header-shield", [
    PowerIn({ id: "vin_5v", voltageV: [4.5, 5.5] }),
    Ground(),
    ...ServoPort({ id: "servo_1", role: "output", signal: { pin: "S1", id: "servo_1_sig" }, power: "vin_5v", ground: "gnd" }),
    { id: "sig_in", name: "Servo 1 from D9", pin: "D9", domain: "electrical", exposed: true, default_active: true, protocols: [{ type: "pwm", roles: ["input"] }], capabilities: ["pwm_in"] },
    ShieldHeader({ form: "arduino_uno_r3", role: "accessory", pins: { "5V": "vin_5v", GND: "gnd", D9: "sig_in" } }),
  ]);
  const system = (shield: ModuleDef): ModuleDef => ({
    id: "stub-stack",
    name: "UNO with a shield",
    interfaces: [],
    children: [
      { id: "uno", moduleDefId: HOST.id },
      { id: "shield", moduleDefId: shield.id },
    ],
    links: [{ id: "stack", a: { child: "uno", interfaceId: "arduino_uno_r3_header" }, b: { child: "shield", interfaceId: "arduino_uno_r3_header" } }],
  });
  const lookup = (...defs: ModuleDef[]) => (id: string) => defs.find((d) => d.id === id);

  it("lays out the UNO R3 headers in a fixed order: 32 positions", () => {
    expect(HEADER_FORMS.arduino_uno_r3.positions).toHaveLength(32);
    expect(HEADER_FORMS.raspberry_pi_40pin.positions).toHaveLength(40);
    const header = HOST.interfaces.find((i) => i.id === "arduino_uno_r3_header")!;
    expect(header.traits?.[0].params).toMatchObject({ connector_type: "arduino_uno_r3_header", gender: "female", positions: 32 });
    // both GND positions on the power header and the one by D13 bind the ground leaf
    const b = header.profiles![0].bindings;
    expect(["p6", "p7", "p29"].map((p) => b[p])).toEqual(["gnd", "gnd", "gnd"]);
  });

  it("a shield stacks on the host by one link, position by position, and its pins are checked through it", () => {
    const [r] = validateLinks(system(SHIELD), lookup(HOST, SHIELD));
    expect([r.protocol, r.state]).toEqual(["connector", "configured"]);
    expect(r.diagnostics).toEqual([]);
    const derived = deriveLinks(system(SHIELD), lookup(HOST, SHIELD)).map((d) => `${d.a.path}↔${d.b.path} ${d.state}`);
    expect(derived).toEqual(expect.arrayContaining(["uno:d9↔shield:sig_in configured", "uno:rail_5v↔shield:vin_5v configured"]));
  });

  it("two host headers do not mate, and an unknown position label is refused", () => {
    const hostAgain = { ...HOST, id: "stub-uno-2" };
    const r = validateLinks(system(hostAgain), lookup(HOST, hostAgain))[0];
    expect(r.diagnostics.map((d) => d.code)).toContain("connector_gender");
    expect(() => ShieldHeader({ form: "arduino_uno_r3", role: "host", pins: { D14: "x" } })).toThrow(/no position labelled "D14"/);
  });
});

describe("cross bolt patterns", () => {
  const cross = (role: "structure" | "component", x: number, y: number) =>
    BoltPattern({ id: "base", role, shape: "cross", spacingMm: x, spacingYmm: y, holeCount: 4, fastener: "M3", fastenerDiameterMm: 3 });
  const motor = mod("stub-2205", [cross("component", 16, 19)]);

  it("places one diagonal pair on x and the other on y", () => {
    expect(boltPatternHoles(cross("component", 16, 19))).toEqual([[-8, 0], [8, 0], [0, -9.5], [0, 9.5]]);
    expect(() => BoltPattern({ id: "x", role: "component", shape: "cross", spacingMm: 16, holeCount: 4, fastener: "M3", fastenerDiameterMm: 3 })).toThrow(/spacingYmm/);
  });

  it("a 16 × 19 cross mates a 16 × 19 arm mount, not a 12 × 12 cross or a 16 mm square", () => {
    expect(connection(mod("arm", [cross("structure", 16, 19)]), motor, "bolt_pattern")!.state).toBe("valid");
    expect(connection(mod("arm", [cross("structure", 12, 12)]), motor, "bolt_pattern")?.state ?? "incompatible").toBe("incompatible");
    const square = mod("arm", [BoltPattern({ id: "mount", role: "structure", shape: "square", spacingMm: 16, holeCount: 4, fastener: "M3", fastenerDiameterMm: 3 })]);
    const c = connection(square, motor, "bolt_pattern");
    expect(c?.state ?? "incompatible").toBe("incompatible");
    if (c) expect(c.diagnostics.map((d) => d.code)).toContain("bolt_pattern_shape");
  });
});

describe("pneumatic and hydraulic ports", () => {
  const port = (id: string, cfg: Omit<FluidPortConfig, "id" | "medium"> & { medium?: FluidPortConfig["medium"] }) => mod(`stub-${id}`, [FluidPort({ id, medium: "pneumatic", ...cfg })]);
  const npt = (size: string, gender: "male" | "female") => ({ kind: "thread" as const, standard: "NPT", size, gender });

  it("a 1/4 NPT male fitting threads into a 1/4 NPT female valve port", () => {
    const c = connection(port("fitting", { role: "bidirectional", joint: npt("1/4\"", "male"), pressureBar: [0, 10] }), port("valve_in", { role: "sink", joint: npt("1/4", "female"), pressureBar: [1.5, 8] }), "pneumatic")!;
    expect(c.state).toBe("valid");
  });

  it("a thread of another size, another standard or the same gender does not", () => {
    const valve = port("valve_in", { role: "sink", joint: npt("1/4", "female") });
    const codes = (j: Parameters<typeof FluidPort>[0]["joint"]) => connection(port("fitting", { role: "bidirectional", joint: j }), valve, "pneumatic")!.diagnostics.map((d) => [d.code, d.message]);
    expect(codes(npt("1/8", "male"))[0][1]).toMatch(/different thread sizes/);
    expect(codes({ kind: "thread", standard: "BSPP", size: "1/4", gender: "male" })[0][1]).toMatch(/different thread standards/);
    expect(codes(npt("1/4", "female"))[0][1]).toMatch(/both are female/);
    expect(codes({ kind: "thread", standard: "NPTF", size: "1/4", gender: "male" })).toEqual([]);
  });

  it("a push-to-connect fitting takes a tube of its size", () => {
    const fitting = port("tube_end", { role: "bidirectional", joint: { kind: "push_to_connect", tubeOdMm: 6.35 } });
    expect(connection(fitting, port("tube", { role: "bidirectional", joint: { kind: "tube", tubeOdMm: 6.35 } }), "pneumatic")!.state).toBe("valid");
    expect(connection(fitting, port("tube", { role: "bidirectional", joint: { kind: "tube", tubeOdMm: 8 } }), "pneumatic")!.state).toBe("incompatible");
    const twoFittings = connection(fitting, port("other", { role: "bidirectional", joint: { kind: "push_to_connect", tubeOdMm: 6.35 } }), "pneumatic")!;
    expect(twoFittings.diagnostics[0].message).toMatch(/do not connect without a fitting/);
  });

  it("a source's pressure must sit in the consumer's rated range", () => {
    const cylinder = port("cyl_a", { role: "sink", joint: npt("1/8", "female"), pressureBar: [1, 10] });
    expect(connection(port("compressor", { role: "source", joint: npt("1/8", "male"), pressureBar: 8.3 }), cylinder, "pneumatic")!.state).toBe("valid");
    expect(connection(port("tank", { role: "source", joint: npt("1/8", "male"), pressureBar: 62 }), cylinder, "pneumatic")!.state).toBe("incompatible");
  });

  it("flow roles: sources feed sinks and fittings; a sensor taps a source or a fitting, not a sink; two sources do not pair", () => {
    expect(areRolesCompatible("pneumatic", "source", "sink")).toBe(true);
    expect(areRolesCompatible("pneumatic", "sensing", "bidirectional")).toBe(true);
    expect(areRolesCompatible("pneumatic", "sensing", "sink")).toBe(false);
    expect(areRolesCompatible("pneumatic", "source", "source")).toBe(false);
    expect(areRolesCompatible("pneumatic", "input", "output")).toBe(false);
  });

  it("hydraulic ports are their own domain and do not pair with pneumatic ones", () => {
    const sensor = port("sensor", { medium: "hydraulic", role: "sensing", joint: { kind: "thread", standard: "BSPP", size: "G1/4", gender: "male" }, pressureBar: [0, 16], burstPressureBar: 30, fluids: ["water"] });
    const line = port("tee", { medium: "hydraulic", role: "bidirectional", joint: { kind: "thread", standard: "BSPP", size: "G1/4", gender: "female" }, pressureBar: [0, 20] });
    expect(connection(sensor, line, "hydraulic")!.state).toBe("valid");
    expect(validatePair(sensor, port("air", { role: "bidirectional", joint: { kind: "thread", standard: "BSPP", size: "G1/4", gender: "female" } })).connections).toEqual([]);
    const s = sensor.interfaces[0];
    expect(s.traits?.find((t) => t.type === "fluid")?.params).toMatchObject({ burst_pressure_bar: 30, fluids: ["water"] });
  });
});
