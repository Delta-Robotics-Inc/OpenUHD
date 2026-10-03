/**
 * FIXTURE, NOT A REAL PRODUCT: a small quadcopter built from invented parts,
 * for the tests of the system helpers (links and exports, system checks,
 * geometry and assembly, mass, fastener torques, tools, spin and prop
 * handedness, wiring, thrust tables). Every value is chosen for the tests;
 * none is a manufacturer's figure, and no part here should be used to design
 * hardware.
 *
 * Layout (frame coordinates, mm): x forward, y left, z up from the bottom
 * plate's underside. The plate is 4 mm thick, so the motor pads, the stack
 * mount and the standoff pads are at z = 4. Motors sit on the arm tips at
 * (±80, ±80). The top plate sits on 30 mm standoffs; the GNSS stands on it.
 */
import type { FastenerTorque, GeometryManifest, InterfaceDef, InterfaceLink, MaterialSpec, ModuleDef, ThrustTestRow } from "../../src/index.js";
import type { ModuleLookup } from "../../src/system/index.js";
import {
  BoltPattern,
  BrushlessPhases,
  CRSF,
  Connector,
  EscSignal,
  FcEscPort,
  Ground,
  I2C,
  PowerIn,
  PowerOut,
  SBUS,
  Shaft,
  UART,
  burstCurrentA,
  cellCount,
  connectorTrait,
  currentDrawA,
  defineModule,
  fastenerDiameterMm,
  minSupplyPowerW,
} from "../../src/protocols/index.js";
import { feature, own, procedural, withGeometry } from "../../src/authoring/cad.js";

const SIG = (area_mm2: number, centroid: [number, number, number]) => ({ area_mm2, centroid });

/** The fixture's own CAD bodies: one generic body artifact per part, plus extra ones where a test needs them. */
const body = (id: string, extra: ModuleDef["artifacts"] = []): ModuleDef["artifacts"] => [
  { id: "cad_step", name: `${id} body`, type: "3d_model", role: "body", format: "step", units: "mm", filePath: `fixtures/${id}/body.step` },
  ...(extra ?? []),
];

const CARBON: MaterialSpec = { name: "Fixture carbon laminate", density_g_cm3: 1.5, assumption: "Fixture density for the mass tests." };
const STEEL: MaterialSpec = { name: "Fixture stainless steel", density_g_cm3: 8, assumption: "Fixture density; the volume is a nominal body." };

// ---------------------------------------------------------------------------
// Propulsion: motor, propeller, the arm group
// ---------------------------------------------------------------------------

const row = (throttle_pct: number, current_A: number, rpm: number, thrust_g: number, power_W: number): ThrustTestRow => ({
  throttle_pct,
  voltage_V: 24,
  current_A,
  rpm,
  thrust_g,
  power_W,
  efficiency_g_per_W: Number((thrust_g / power_W).toFixed(2)),
});

export const MOTOR = withGeometry(
  defineModule({
    id: "fixture-motor-2207",
    name: "Fixture 2207 brushless motor",
    tags: ["motor", "brushless"],
    interfaces: [
      ...BrushlessPhases({ role: "input", termination: "bare_wire_lead", burstCurrentA: 40 }),
      BoltPattern({ id: "base_mount", role: "component", shape: "circle", spacingMm: 16, holeCount: 4, fastener: "M3", fastenerDiameterMm: 3, threaded: true }),
      Shaft({ id: "shaft", role: "output", diameterMm: 5, thread: "M5" }),
    ],
    domains: [{ domain: "mechanical", dimensions_mm: { length: 28, width: 28, height: 32 }, weight_g: 32 }],
    traits: [
      {
        type: "performance",
        params: {
          kind: "motor",
          thrust_tests: [
            { propeller: "fixture 5 in", supply_V: 24, rows: [row(25, 2, 9000, 150, 48), row(50, 8, 18000, 500, 192), row(75, 18, 25000, 900, 432), row(100, 34, 30000, 1300, 816)] },
            { propeller: "fixture 5.1 in", supply_V: 24, rows: [row(50, 9, 17500, 560, 216), row(100, 36, 29000, 1400, 864)] },
          ],
        },
      },
    ],
  }),
  {
    base_mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0], symmetryDeg: 90 },
      refs: [feature("base_mount", SIG(500, [0, 0, 0])), own("base_mount"), feature("baseMount", undefined, "cad_kcl"), procedural("bolt_pattern")],
    },
    shaft: { frame: { origin: [0, 0, 20], normal: [0, 0, 1], xAxis: [1, 0, 0] }, refs: [feature("shaft", SIG(190, [0, 0, 25]))] },
    phases_a: { frame: { origin: [22, -2, 1.5], normal: [1, 0, 0] }, refs: [feature("phases_a", SIG(2.5, [22, -2, 1.5]))] },
    phases_b: { frame: { origin: [22, 0, 1.5], normal: [1, 0, 0] }, refs: [feature("phases_b", SIG(2.5, [22, 0, 1.5]))] },
    phases_c: { frame: { origin: [22, 2, 1.5], normal: [1, 0, 0] }, refs: [feature("phases_c", SIG(2.5, [22, 2, 1.5]))] },
  },
  [
    ...body("fixture-motor-2207")!,
    { id: "cad_if_base_mount", name: "Base mount", type: "3d_model", role: "interface", format: "glb", filePath: "fixtures/fixture-motor-2207/base_mount.glb" },
    { id: "cad_kcl", name: "Motor (KCL)", type: "cad", role: "source", format: "kcl", filePath: "fixtures/fixture-motor-2207/motor.kcl" },
  ],
);

export const PROP = withGeometry(
  defineModule({
    id: "fixture-prop-5in",
    name: "Fixture 5 in propeller",
    tags: ["propeller"],
    interfaces: [Shaft({ id: "hub_bore", role: "input", diameterMm: 5 })],
    domains: [{ domain: "mechanical", weight_g: 4 }],
    traits: [{ type: "handedness", params: { variants: ["cw", "ccw"] } }],
  }),
  { hub_bore: { frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0], symmetryDeg: 120 }, refs: [feature("hub_bore", SIG(90, [0, 0, 3]))] } },
  body("fixture-prop-5in")!,
);

/** A group: motor and prop, the prop on the shaft. Its boundary is every child interface not linked inside. */
export const ARM: ModuleDef = {
  id: "fixture-arm",
  name: "Fixture arm (motor + prop)",
  kind: "group",
  interfaces: [],
  children: [
    { id: "motor", moduleDefId: MOTOR.id, name: "Motor" },
    { id: "prop", moduleDefId: PROP.id, name: "Propeller" },
  ],
  links: [{ id: "prop_on_shaft", name: "Prop on shaft", a: { child: "motor", interfaceId: "shaft" }, b: { child: "prop", interfaceId: "hub_bore" } }],
};

// ---------------------------------------------------------------------------
// The stack: flight controller over a 4-in-1 ESC, joined by a cable
// ---------------------------------------------------------------------------

const STACK_MOUNT = () => BoltPattern({ id: "stack_mount", role: "component", shape: "square", spacingMm: 30.5, holeCount: 4, fastener: "M3", fastenerDiameterMm: 3 });
const STACK_FRAME = { frame: { origin: [0, 0, 0] as [number, number, number], normal: [0, 0, -1] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number], symmetryDeg: 90 } };

const escSignals = [1, 2, 3, 4].map((n) => EscSignal({ id: `m${n}`, name: `M${n}`, role: "input", protocols: ["dshot300", "dshot600"], motorIndex: n }));
const phaseLeafFrames = (n: number, x: number, y: number) =>
  Object.fromEntries(["a", "b", "c"].map((p, i) => [`motor_${n}_${p}`, { frame: { origin: [x, y + (i - 1) * 2, 1] as [number, number, number], normal: [0, 0, 1] as [number, number, number] } }]));

export const ESC = withGeometry(
  defineModule({
    id: "fixture-esc-4in1",
    name: "Fixture 4-in-1 ESC",
    tags: ["esc"],
    interfaces: [
      { ...PowerIn({ id: "bat_in", name: "BAT+", voltageV: [12, 26], parameters: [cellCount([3, 6])] }), traits: [connectorTrait("solder_pad")] },
      { ...Ground({ id: "bat_neg", name: "BAT-" }), traits: [connectorTrait("solder_pad")] },
      PowerOut({ id: "vbat_out", voltageV: [12, 26] }),
      Ground(),
      ...escSignals,
      FcEscPort({ id: "fc_port", side: "esc", motors: escSignals, vbat: "vbat_out", gnd: "gnd" }),
      ...[1, 2, 3, 4].flatMap((n) => BrushlessPhases({ id: `motor_${n}`, name: `Motor ${n}`, role: "output", maxCurrentA: 50, burstCurrentA: 60 })),
      STACK_MOUNT(),
    ],
    domains: [{ domain: "mechanical", weight_g: 12 }],
  }),
  { stack_mount: STACK_FRAME, ...phaseLeafFrames(1, -15, -15), ...phaseLeafFrames(2, 15, -15), ...phaseLeafFrames(3, -15, 15), ...phaseLeafFrames(4, 15, 15) },
  body("fixture-esc-4in1")!,
);

const fcSignals = [1, 2, 3, 4].map((n) => EscSignal({ id: `m${n}`, name: `M${n}`, role: "output", protocols: ["dshot300", "dshot600"], motorIndex: n }));
const uart = (n: number) => UART({ id: `uart${n}`, instance: n, name: `UART${n}`, roles: ["host"], rx: { pin: `RX${n}` }, tx: { pin: `TX${n}` } });

export const FC = withGeometry(
  defineModule({
    id: "fixture-fc-f4",
    name: "Fixture flight controller",
    tags: ["flight-controller"],
    interfaces: [
      PowerIn({ id: "vbat_in", voltageV: [6, 30] }),
      Ground({ id: "gnd", name: "GND", pin: "GND" }),
      PowerOut({ id: "bec_5v", name: "5V BEC", pin: "5V", voltageV: 5, maxCurrentA: 2 }),
      PowerOut({ id: "bec_10v", name: "10V BEC", pin: "10V", voltageV: [10, 12], nominalV: 10, maxCurrentA: 2.5 }),
      {
        ...PowerOut({ id: "rail_4v5", name: "4.5V", pin: "4.5V", voltageV: [4.5, 5] }),
        traits: [{ type: "supplied_from", params: { interfaceId: "bec_5v", via: "diode", assumption: "Fixture: the 4.5 V rail is taken to branch from the 5 V BEC." } }],
      },
      ...fcSignals,
      FcEscPort({ id: "esc_port", side: "fc", motors: fcSignals, vbat: "vbat_in", gnd: "gnd" }),
      ...uart(1),
      ...uart(2),
      ...uart(3),
      ...uart(5),
      SBUS({ interfaceId: "sbus", role: "input", pin: "SBUS" }),
      ...I2C({ id: "i2c1", instance: 1, roles: ["master"], sda: { pin: "SDA" }, scl: { pin: "SCL" } }),
      Connector({
        id: "dji_socket",
        name: "Video socket (6-pin)",
        connector: "dji_6pin",
        gender: "receptacle",
        pins: [["10V", "bec_10v"], ["G", "gnd"], ["T5", "uart5_tx"], ["R5", "uart5_rx"], ["G", "gnd"], ["Sbus", "sbus"]],
      }),
      { ...STACK_MOUNT(), name: "FC mount" },
    ],
    domains: [{ domain: "mechanical", weight_g: 8 }],
  }),
  { stack_mount: STACK_FRAME },
  body("fixture-fc-f4")!,
);

/** The FC/ESC cable (ships with the stack). */
export const FC_ESC_CABLE: ModuleDef = {
  id: "fixture-fc-esc-cable",
  name: "Fixture FC/ESC cable",
  kind: "harness",
  topology: "wire",
  interfaces: [harnessEnd("end_fc", "jst_sh_8", "a"), harnessEnd("end_esc", "jst_sh_8", "b")],
};

/** A purchased stack: FC and ESC as children, its boundary given by explicit exports. */
export const STACK: ModuleDef = {
  id: "fixture-stack",
  name: "Fixture FC + ESC stack",
  kind: "module",
  interfaces: [],
  children: [
    { id: "fc", moduleDefId: FC.id, name: "Flight controller" },
    { id: "esc", moduleDefId: ESC.id, name: "ESC" },
    { id: "sh8_cable", moduleDefId: FC_ESC_CABLE.id, name: "FC/ESC cable" },
  ],
  links: [{ id: "fc_esc_cable", name: "FC/ESC cable", a: { child: "fc", interfaceId: "esc_port" }, b: { child: "esc", interfaceId: "fc_port" }, harness: "sh8_cable" }],
  exports: [
    { id: "bat_in", from: { child: "esc", interfaceId: "bat_in" } },
    { id: "bat_neg", from: { child: "esc", interfaceId: "bat_neg" } },
    ...[1, 2, 3, 4].map((n) => ({ id: `motor_${n}`, name: `Motor ${n}`, from: { child: "esc", interfaceId: `motor_${n}` } })),
    { id: "bec_5v", from: { child: "fc", interfaceId: "bec_5v" } },
    { id: "bec_10v", from: { child: "fc", interfaceId: "bec_10v" } },
    { id: "rail_4v5", from: { child: "fc", interfaceId: "rail_4v5" } },
    { id: "gnd", from: { child: "fc", interfaceId: "gnd" } },
    { id: "uart1", from: { child: "fc", interfaceId: "uart1" } },
    { id: "uart2", from: { child: "fc", interfaceId: "uart2" } },
    { id: "uart5", from: { child: "fc", interfaceId: "uart5" } },
    { id: "i2c1", from: { child: "fc", interfaceId: "i2c1" } },
    { id: "stack_mount", from: { child: "esc", interfaceId: "stack_mount" } },
    { id: "fc_stack_mount", from: { child: "fc", interfaceId: "stack_mount" } },
  ],
};

// ---------------------------------------------------------------------------
// Battery, receiver, video unit, GNSS
// ---------------------------------------------------------------------------

export const BATTERY = defineModule({
  id: "fixture-battery-6s",
  name: "Fixture 6S pack",
  tags: ["battery"],
  interfaces: [
    { ...PowerOut({ id: "battery_out", voltageV: [19.8, 25.2], maxCurrentA: 120, parameters: [cellCount(6), burstCurrentA(200)] }), traits: [connectorTrait("xt60")] },
    { ...Ground({ id: "battery_gnd" }), traits: [connectorTrait("xt60")] },
  ],
  domains: [{ domain: "mechanical", weight_g: 180 }],
});

export const RECEIVER = defineModule({
  id: "fixture-receiver",
  name: "Fixture CRSF receiver",
  tags: ["receiver"],
  interfaces: [...CRSF({ id: "crsf", rx: { pin: "RX" }, tx: { pin: "TX" } }), PowerIn({ id: "vcc_5v", voltageV: [4.5, 5.5] }), Ground()],
  domains: [{ domain: "mechanical", weight_g: 2 }],
});

export const VIDEO = withGeometry(
  defineModule({
    id: "fixture-video-unit",
    name: "Fixture digital video unit",
    tags: ["video"],
    interfaces: [
      PowerIn({ id: "vcc", voltageV: [3.7, 13.2], parameters: [minSupplyPowerW(10)] }),
      Ground({ id: "gnd" }),
      Ground({ id: "gnd_signal" }),
      ...UART({ id: "uart_osd", roles: ["device"], rx: { pin: "RX" }, tx: { pin: "TX" } }),
      SBUS({ interfaceId: "sbus", role: "output", pin: "S.Bus" }),
      Connector({
        id: "fc_cable_socket",
        connector: "dji_3in1_cable_6pin",
        pins: [["VCC", "vcc"], ["GND", "gnd"], ["RX", "uart_osd_rx"], ["TX", "uart_osd_tx"], ["GND", "gnd_signal"], ["S.Bus", "sbus"]],
      }),
      BoltPattern({ id: "tx_module_mount", role: "component", shape: "square", spacingMm: 20, holeCount: 4, fastener: "M2", fastenerDiameterMm: 2 }),
      BoltPattern({ id: "camera_mount", role: "component", shape: "row", pitchMm: 14, holeCount: 2, fastener: "M2", fastenerDiameterMm: 2 }),
    ],
    domains: [{ domain: "mechanical", weight_g: 30 }],
  }),
  {
    tx_module_mount: { frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0], symmetryDeg: 90 } },
    // the camera is a second body joined only by its cable: its frame names the body it is expressed in
    camera_mount: { frame: { artifact: "cad_camera_step", origin: [0, 0, 0], normal: [-1, 0, 0], xAxis: [0, 1, 0] } },
  },
  body("fixture-video-unit", [{ id: "cad_camera_step", name: "Camera body", type: "3d_model", role: "body", format: "step", units: "mm", filePath: "fixtures/fixture-video-unit/camera.step" }])!,
);

const GH6P_PINS: [string, string][] = [["5V", "vin_5v"], ["RX", "uart_gnss_rx"], ["TX", "uart_gnss_tx"], ["CL", "i2c_compass_scl"], ["DA", "i2c_compass_sda"], ["G", "gnd"]];
const GH6P_REFS = [feature("GH6P-1", SIG(330, [13, 0, 2])), feature("GH6P-2", SIG(330, [-13, 0, 2]))];

/** GNSS with a compass. Its two sockets carry the same signals, so each interface has two physical places. */
export function gnss(o: { id: string; name: string; address: number }): ModuleDef {
  return withGeometry(
    defineModule({
      id: o.id,
      name: o.name,
      tags: ["gnss", "compass"],
      interfaces: [
        PowerIn({ id: "vin_5v", voltageV: [4, 5.5], nominalV: 5, parameters: [currentDrawA(0.05)] }),
        Ground({ id: "gnd" }),
        ...UART({ id: "uart_gnss", roles: ["device"], tx: { pin: "TX" }, rx: { pin: "RX" } }),
        ...I2C({ id: "i2c_compass", roles: ["slave"], address: o.address, sda: { pin: "DA" }, scl: { pin: "CL" }, maxInstances: 1 }),
        Connector({ id: "gh6p_1", connector: "jst_gh_6", gender: "receptacle", pins: GH6P_PINS }),
        Connector({ id: "gh6p_2", connector: "jst_gh_6", gender: "receptacle", pins: GH6P_PINS }),
        BoltPattern({ id: "mount", role: "component", shape: "square", spacingMm: 20, holeCount: 4, fastener: "M2", fastenerDiameterMm: 2 }),
      ],
      domains: [{ domain: "mechanical", weight_g: 10 }],
    }),
    {
      // normal +Z is the component side, which faces the plate: the antenna points up
      mount: { frame: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
      gh6p_1: { frame: { origin: [15, 0, 2], normal: [1, 0, 0], xAxis: [0, 1, 0] }, refs: [GH6P_REFS[0]] },
      gh6p_2: { frame: { origin: [-15, 0, 2], normal: [-1, 0, 0], xAxis: [0, -1, 0] }, refs: [GH6P_REFS[1]] },
      uart_gnss: { refs: GH6P_REFS },
      i2c_compass: { refs: GH6P_REFS },
    },
    body(o.id)!,
  );
}

export const GNSS = gnss({ id: "fixture-gnss", name: "Fixture GNSS + compass", address: 0x2c });
/** An interchangeable GNSS: same interface ids, another compass address. */
export const GNSS_ALT = gnss({ id: "fixture-gnss-alt", name: "Fixture GNSS + compass (alternative)", address: 0x0d });

// ---------------------------------------------------------------------------
// Frame and top plate (custom parts: mass is CAD volume x material density)
// ---------------------------------------------------------------------------

const CORNERS = { fl: [80, 80], fr: [80, -80], rl: [-80, 80], rr: [-80, -80] } as const;
const DIAGONAL: [number, number, number] = [Math.SQRT1_2, Math.SQRT1_2, 0];

export const FRAME = withGeometry(
  defineModule({
    id: "fixture-frame",
    name: "Fixture frame",
    tags: ["frame"],
    interfaces: [
      BoltPattern({ id: "stack_mount", role: "structure", shape: "square", spacingMm: 30.5, holeCount: 4, fastener: "M3", fastenerDiameterMm: 3 }),
      ...Object.keys(CORNERS).map((c) =>
        BoltPattern({ id: `motor_mount_${c}`, role: "structure", shape: "circle", spacingMm: 16, holeCount: 4, fastener: "M3", fastenerDiameterMm: 3 }),
      ),
      BoltPattern({ id: "standoff_mount", role: "structure", shape: "square", spacingMm: 40, holeCount: 4, fastener: "M3", fastenerDiameterMm: 3 }),
      BoltPattern({ id: "vtx_mount", role: "structure", shape: "square", spacingMm: 20, holeCount: 4, fastener: "M2", fastenerDiameterMm: 2 }),
      BoltPattern({ id: "camera_mount", role: "structure", shape: "row", pitchMm: 14, holeCount: 2, fastener: "M2", fastenerDiameterMm: 2 }),
    ],
    domains: [{ domain: "mechanical", material: CARBON }],
  }),
  {
    stack_mount: { frame: { origin: [0, 0, 4], normal: [0, 0, 1], xAxis: [1, 0, 0], symmetryDeg: 90 } },
    // motor mounts: xAxis on the diagonal, so a multiple of 90° turns a motor's leads toward the centre
    ...Object.fromEntries(
      Object.entries(CORNERS).map(([c, [x, y]]) => [`motor_mount_${c}`, { frame: { origin: [x, y, 4] as [number, number, number], normal: [0, 0, 1] as [number, number, number], xAxis: DIAGONAL, symmetryDeg: 90 } }]),
    ),
    standoff_mount: { frame: { origin: [0, 0, 4], normal: [0, 0, 1], xAxis: [1, 0, 0], symmetryDeg: 90 } },
    vtx_mount: { frame: { origin: [-40, 0, 4], normal: [0, 0, 1], xAxis: [1, 0, 0], symmetryDeg: 90 } },
    camera_mount: { frame: { origin: [50, 0, 15], normal: [1, 0, 0], xAxis: [0, 1, 0] } },
  },
  body("fixture-frame")!,
);

export const TOP_PLATE = withGeometry(
  defineModule({
    id: "fixture-top-plate",
    name: "Fixture top plate",
    tags: ["frame"],
    interfaces: [
      BoltPattern({ id: "standoff_mount", role: "component", shape: "square", spacingMm: 40, holeCount: 4, fastener: "M3", fastenerDiameterMm: 3 }),
      BoltPattern({ id: "gps_mount", role: "structure", shape: "square", spacingMm: 20, holeCount: 4, fastener: "M2", fastenerDiameterMm: 2 }),
    ],
    domains: [{ domain: "mechanical", material: CARBON }],
  }),
  {
    standoff_mount: { frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0], symmetryDeg: 90 } },
    gps_mount: { frame: { origin: [-50, 0, 2], normal: [0, 0, 1], xAxis: [1, 0, 0] } },
  },
  body("fixture-top-plate")!,
);

// ---------------------------------------------------------------------------
// Fasteners
// ---------------------------------------------------------------------------

function threadIface(size: number, length: number, gender: "male" | "female"): InterfaceDef {
  return {
    id: gender === "male" ? "thread" : "bore",
    domain: "mechanical",
    exposed: true,
    protocols: [{ type: "custom", roles: ["peer"] }],
    capabilities: ["fastener"],
    parameters: [fastenerDiameterMm(size), { id: "length", unit: "mm", value: length }],
  };
}

/** ISO 4762 socket head cap screw. `socket` states the hex socket (else the standard's table applies). */
function screw(id: string, size: 2 | 3, length: number, socket?: number): ModuleDef {
  return {
    id,
    name: `Fixture M${size} x ${length} socket head cap screw`,
    kind: "module",
    tags: ["fastener", "screw", "iso-4762", `m${size}`],
    interfaces: [threadIface(size, length, "male")],
    domains: [{ domain: "mechanical", material: STEEL, metadata: { standard: "ISO 4762", ...(socket ? { hex_socket_mm: socket } : {}) } }],
  };
}

function hexPart(id: string, kind: "nut" | "spacer" | "standoff", size: 2 | 3, length: number, od: number, weight?: number): ModuleDef {
  return {
    id,
    name: `Fixture M${size} ${kind}, ${length} mm`,
    kind: "module",
    tags: ["fastener", kind, `m${size}`],
    interfaces: [{ ...threadIface(size, length, "female"), id: kind === "nut" ? "thread" : "bore" }],
    domains: [{ domain: "mechanical", ...(weight !== undefined ? { weight_g: weight } : { material: STEEL }), metadata: { outer_mm: od } }],
  };
}

export const MOTOR_SCREW = screw("fixture-screw-m3x8", 3, 8, 2.5);
export const STACK_SCREW = screw("fixture-screw-m3x30", 3, 30);
export const PLATE_SCREW = screw("fixture-screw-m3x6", 3, 6);
export const GPS_SCREW = screw("fixture-screw-m2x12", 2, 12);
export const M3_NUT = hexPart("fixture-nut-m3", "nut", 3, 4, 5.5);
export const M2_NUT = hexPart("fixture-nut-m2", "nut", 2, 2.8, 4);
export const STANDOFF = hexPart("fixture-standoff-m3x30", "standoff", 3, 30, 5.5, 1.8);
export const STACK_SPACER = hexPart("fixture-spacer-m3x6", "spacer", 3, 6, 6, 0.15);
export const GPS_SPACER = hexPart("fixture-spacer-m2x5", "spacer", 2, 5, 4, 0.05);

const torque = (torqueNm: number): FastenerTorque => ({
  torqueNm,
  assumption: "Fixture torque, below the reference.",
  reference: [{ torqueNm: 0.9, condition: "Fixture reference row", source: "https://example.com/torque-table" }],
});

function harnessEnd(id: string, connector: string, mates: "a" | "b"): InterfaceDef {
  return { id, domain: "electrical", exposed: false, protocols: [{ type: "custom", roles: ["peer"] }], traits: [connectorTrait(connector, { mates })] };
}

function hardware(id: string, name: string, children: ModuleDef["children"], fastenerStack: ModuleDef["fastenerStack"]): ModuleDef {
  return { id, name, kind: "harness", topology: "bus", tags: ["fasteners"], interfaces: [], children, fastenerStack };
}

/** Four screws up through the 4 mm arm into the motor base. */
export const MOTOR_HARDWARE = hardware(
  "fixture-motor-hardware",
  "Fixture motor hardware",
  [{ id: "screws", moduleDefId: MOTOR_SCREW.id, quantity: 4 }],
  [{ child: "screws", atMm: -4, torque: torque(0.6) }],
);

/** Screws up through the plate, a spacer under each board, nuts on top. */
export const STACK_HARDWARE = hardware(
  "fixture-stack-hardware",
  "Fixture stack hardware",
  [
    { id: "screws", moduleDefId: STACK_SCREW.id, quantity: 4 },
    { id: "spacers", moduleDefId: STACK_SPACER.id, quantity: 8 },
    { id: "nuts", moduleDefId: M3_NUT.id, quantity: 4 },
  ],
  [
    { child: "screws", atMm: -4 },
    { child: "spacers", atMm: 0 },
    { child: "spacers", atMm: 8 },
    { child: "nuts", atMm: 20, torque: torque(0.3) },
  ],
);

/** Standoffs between the plates, a screw into each end. */
export const PLATE_HARDWARE = hardware(
  "fixture-plate-hardware",
  "Fixture plate hardware",
  [
    { id: "standoffs", moduleDefId: STANDOFF.id, quantity: 4 },
    { id: "screws", moduleDefId: PLATE_SCREW.id, quantity: 8 },
  ],
  [
    { child: "screws", atMm: -4, torque: torque(0.5) },
    { child: "standoffs", atMm: 0 },
    { child: "screws", atMm: 32, direction: -1, torque: torque(0.5) },
  ],
);

/** M2 screws down through the GNSS and a spacer, nuts under the 2 mm plate. */
export const GPS_HARDWARE = hardware(
  "fixture-gps-hardware",
  "Fixture GPS hardware",
  [
    { id: "screws", moduleDefId: GPS_SCREW.id, quantity: 4 },
    { id: "spacers", moduleDefId: GPS_SPACER.id, quantity: 4 },
    { id: "nuts", moduleDefId: M2_NUT.id, quantity: 4 },
  ],
  [
    { child: "nuts", atMm: -2, direction: -1, torque: torque(0.15) },
    { child: "spacers", atMm: 0 },
    { child: "screws", atMm: 6, direction: -1 },
  ],
);

// ---------------------------------------------------------------------------
// Wire harnesses
// ---------------------------------------------------------------------------

export const XT60_LEAD: ModuleDef = {
  id: "fixture-xt60-lead",
  name: "Fixture battery lead",
  kind: "harness",
  topology: "wire",
  interfaces: [harnessEnd("end_battery", "xt60", "a"), harnessEnd("end_esc", "solder_pad", "b")],
};

export const VIDEO_CABLE: ModuleDef = {
  id: "fixture-video-cable",
  name: "Fixture video cable",
  kind: "harness",
  topology: "wire",
  interfaces: [harnessEnd("end_fc", "dji_6pin", "a"), harnessEnd("end_video", "dji_3in1_cable_6pin", "b")],
};

// ---------------------------------------------------------------------------
// The system
// ---------------------------------------------------------------------------

/** Quad-X, props in: M1 rear-right CW, M2 front-right CCW, M3 rear-left CCW, M4 front-left CW. `leads` turns each motor's leads toward the centre. */
export const ARMS = [
  { id: "arm_fr", corner: "fr", motor: 2, leads: 270, spin: "ccw" },
  { id: "arm_rr", corner: "rr", motor: 1, leads: 0, spin: "cw" },
  { id: "arm_rl", corner: "rl", motor: 3, leads: 90, spin: "ccw" },
  { id: "arm_fl", corner: "fl", motor: 4, leads: 180, spin: "cw" },
] as const;

const link = (id: string, a: [string, string], b: [string, string], extra: Partial<InterfaceLink> = {}): InterfaceLink => ({
  id,
  a: { child: a[0], interfaceId: a[1] },
  b: { child: b[0], interfaceId: b[1] },
  ...extra,
});

export const DRONE: ModuleDef = {
  id: "fixture-drone",
  name: "Fixture quadcopter",
  kind: "module",
  interfaces: [],
  children: [
    { id: "frame", moduleDefId: FRAME.id },
    { id: "top_plate", moduleDefId: TOP_PLATE.id },
    { id: "stack", moduleDefId: STACK.id },
    ...ARMS.map((a) => ({ id: a.id, moduleDefId: ARM.id, spin: a.spin })),
    { id: "battery", moduleDefId: BATTERY.id },
    { id: "receiver", moduleDefId: RECEIVER.id },
    { id: "video", moduleDefId: VIDEO.id },
    { id: "gnss", moduleDefId: GNSS.id },
    { id: "xt60_lead", moduleDefId: XT60_LEAD.id },
    { id: "video_cable", moduleDefId: VIDEO_CABLE.id },
    { id: "stack_hardware", moduleDefId: STACK_HARDWARE.id },
    { id: "plate_hardware", moduleDefId: PLATE_HARDWARE.id },
    ...ARMS.map((a) => ({ id: `${a.id}_hardware`, moduleDefId: MOTOR_HARDWARE.id })),
    { id: "gps_hardware", moduleDefId: GPS_HARDWARE.id },
  ],
  links: [
    link("battery_pos", ["battery", "battery_out"], ["stack", "bat_in"], { harness: "xt60_lead" }),
    link("battery_neg", ["battery", "battery_gnd"], ["stack", "bat_neg"], { harness: "xt60_lead" }),
    ...ARMS.flatMap((a) => [
      link(`m${a.motor}_phases`, ["stack", `motor_${a.motor}`], [a.id, "motor__phases"]),
      link(`${a.id}_mount`, [a.id, "motor__base_mount"], ["frame", `motor_mount_${a.corner}`], { harness: `${a.id}_hardware`, mate: { rotationDeg: a.leads } }),
    ]),
    // the ESC on an 8 mm spacer, the FC 8 mm above it
    link("stack_mount", ["stack", "stack_mount"], ["frame", "stack_mount"], { harness: "stack_hardware", mate: { gapMm: 8 } }),
    link("fc_mount", ["stack", "fc_stack_mount"], ["frame", "stack_mount"], { harness: "stack_hardware", mate: { gapMm: 18 } }),
    link("top_plate_mount", ["frame", "standoff_mount"], ["top_plate", "standoff_mount"], { harness: "plate_hardware", mate: { gapMm: 30 } }),
    link("rx_crsf", ["stack", "uart2"], ["receiver", "crsf"]),
    link("rx_power", ["stack", "bec_5v"], ["receiver", "vcc_5v"]),
    link("rx_gnd", ["stack", "gnd"], ["receiver", "gnd"]),
    link("video_power", ["stack", "bec_10v"], ["video", "vcc"], { harness: "video_cable" }),
    link("video_gnd", ["stack", "gnd"], ["video", "gnd"], { harness: "video_cable" }),
    link("video_osd", ["stack", "uart5"], ["video", "uart_osd"], { harness: "video_cable" }),
    link("vtx_mount", ["video", "tx_module_mount"], ["frame", "vtx_mount"], { mate: { gapMm: 3 } }),
    link("camera_mount", ["video", "camera_mount"], ["frame", "camera_mount"]),
    link("gnss_uart", ["stack", "uart1"], ["gnss", "uart_gnss"]),
    link("gnss_i2c", ["stack", "i2c1"], ["gnss", "i2c_compass"]),
    link("gnss_power", ["stack", "rail_4v5"], ["gnss", "vin_5v"]),
    link("gnss_gnd", ["stack", "gnd"], ["gnss", "gnd"]),
    link("gps_mount", ["gnss", "mount"], ["top_plate", "gps_mount"], { harness: "gps_hardware", mate: { gapMm: 5 } }),
  ],
};

export const DEFINITIONS: ModuleDef[] = [
  DRONE, FRAME, TOP_PLATE, STACK, FC, ESC, FC_ESC_CABLE, ARM, MOTOR, PROP, BATTERY, RECEIVER, VIDEO, GNSS, GNSS_ALT, XT60_LEAD, VIDEO_CABLE,
  MOTOR_HARDWARE, STACK_HARDWARE, PLATE_HARDWARE, GPS_HARDWARE,
  MOTOR_SCREW, STACK_SCREW, PLATE_SCREW, GPS_SCREW, M3_NUT, M2_NUT, STANDOFF, STACK_SPACER, GPS_SPACER,
];

const BY_ID = new Map(DEFINITIONS.map((d) => [d.id, d]));
export const lookup: ModuleLookup = (id) => BY_ID.get(id);
/** The lookup with some definitions replaced or added. */
export const lookupWith = (...overrides: ModuleDef[]): ModuleLookup => {
  const byId = new Map(overrides.map((d) => [d.id, d]));
  return (id) => byId.get(id) ?? lookup(id);
};

// ---------------------------------------------------------------------------
// What a CAD generator would write next to the bodies (manifests), by module
// ---------------------------------------------------------------------------

const manifest = (artifact: string, volume_mm3: number, features: GeometryManifest["features"] = {}): GeometryManifest => ({ artifact, units: "mm", volume_mm3, features });

export const MANIFESTS: Record<string, Record<string, GeometryManifest>> = {
  [MOTOR.id]: {
    cad_step: manifest("cad_step", 4000, {
      base_mount: SIG(500, [0, 0, 0]),
      shaft: SIG(190, [0, 0, 25]),
      phases_a: SIG(2.5, [22, -2, 1.5]),
      phases_b: SIG(2.5, [22, 0, 1.5]),
      phases_c: SIG(2.5, [22, 2, 1.5]),
    }),
  },
  [PROP.id]: { cad_step: manifest("cad_step", 3000, { hub_bore: SIG(90, [0, 0, 3]) }) },
  [GNSS.id]: { cad_step: manifest("cad_step", 2000, { "GH6P-1": SIG(330, [13, 0, 2]), "GH6P-2": SIG(330, [-13, 0, 2]) }) },
  [FRAME.id]: { cad_step: manifest("cad_step", 60_000) },
  [TOP_PLATE.id]: { cad_step: manifest("cad_step", 20_000) },
  [MOTOR_SCREW.id]: { cad_step: manifest("cad_step", 80) },
  [STACK_SCREW.id]: { cad_step: manifest("cad_step", 240) },
  [PLATE_SCREW.id]: { cad_step: manifest("cad_step", 60) },
  [GPS_SCREW.id]: { cad_step: manifest("cad_step", 40) },
  [M3_NUT.id]: { cad_step: manifest("cad_step", 50) },
  [M2_NUT.id]: { cad_step: manifest("cad_step", 20) },
};

/** Manifest lookup for one module's artifacts. */
export const manifestLookup = (def: ModuleDef) => (artifactId: string) => MANIFESTS[def.id]?.[artifactId];

/** Body volume from the manifest, for mass = volume x density. */
export const cadVolumeMm3 = (def: ModuleDef) => MANIFESTS[def.id]?.cad_step?.volume_mm3;
