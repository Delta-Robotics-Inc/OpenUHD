/**
 * DolphinRC AM32 ESC, 60A 4-in-1 (60A variant of the "DolphinRC F405 V3
 * 50A 60A STACK", SKU DPDZ00041) — datasheet-honest UHD part.
 *
 * Sources (see ./dolphinrc-am32-60a-4in1-esc/sources.json):
 *   - src_manual:  DolphinRC F405 V3 FPV Stack User Manual V1.0 (specs p2,
 *                  size drawing p3, wiring diagram p4) —
 *                  https://dolphinrc.com/u_file/2608/24/file/DolphinRCF40520250616153927-165929bb5a.pdf
 *   - src_product: DolphinRC F405 V3 50A 60A STACK product page —
 *                  https://dolphinrc.com/products/dolphinrc-f405-v3-50a-60a-stack
 *   - src_review:  DolphinRC blog review of the same stack (manufacturer
 *                  published, used only where manual/product page are silent) —
 *                  https://dolphinrc.com/blog/dolphinrc-f405-v3-50a-60a-stack-review
 *
 * Modelling notes:
 *   - Variant lock: 60A only. The 50A ESC (50 A / 55 A burst) is a different
 *     part and is not merged here.
 *   - Battery: "+" / "-" solder pads, 6-30 V (2-6S LiPo) per the manual. No
 *     total-current rating is stated, so the battery input carries no
 *     max_current (data gap).
 *   - Motor outputs: four BrushlessPhases (motor_1..motor_4), 60 A continuous
 *     and 65 A burst per channel. The three phase pads of each motor group
 *     are labelled only with the group name (M1..M4), so every phase leaf's
 *     pin is the group label. Burst duration conflicts between sources
 *     (source_discrepancy trait).
 *   - FC connector: 8-pin SH 1.0 mm socket. The manual's wiring diagram labels
 *     the wires BAT GND CUR VOID M1 M2 M3 M4 and the ESC silkscreen reads
 *     V G CUR (blank) M1 M2 M3 M4. Pin 1 is not marked, so the pinout is
 *     given from the BAT end (assumption trait). The FC part uses the exact
 *     same pinout array. VOID is not connected and has no leaf; this ESC has
 *     no telemetry wire (review: "No native telemetry"), so FcEscPort has no
 *     telemetry slot.
 *   - ESC signal inputs M1..M4: DShot300/DShot600, bidirectional DShot, from
 *     the review (the manual and product page do not list protocols).
 *   - Current sensor: analog output on CUR, Betaflight scale 150 / offset 0
 *     (product page; the review's "~400" is recorded as a discrepancy).
 *   - The 35 V 470 uF low-ESR capacitor is shipped as an accessory (product
 *     page "Includes"); the review says it is preinstalled — discrepancy.
 *   - Mounting: 30.5 x 30.5 mm, 4 mm holes, M3 x 8.1 mm rubber grommets.
 *   - Verify warning "no thermal domain or operating_conditions trait" is
 *     intentional: no source gives an operating temperature (data_gap trait).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  BoltPattern,
  BrushlessPhases,
  EscSignal,
  FcEscPort,
  Ground,
  PowerIn,
  PowerOut,
  cellCount,
  Connector,
  connectorTrait,
  defineModule,
} from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  manual:
    "https://dolphinrc.com/u_file/2608/24/file/DolphinRCF40520250616153927-165929bb5a.pdf",
  product: "https://dolphinrc.com/products/dolphinrc-f405-v3-50a-60a-stack",
  review: "https://dolphinrc.com/blog/dolphinrc-f405-v3-50a-60a-stack-review",
} as const;

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function padFunction(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

const VIN: [number, number] = [6, 30];

// ---------------------------------------------------------------------------
// Battery pads
// ---------------------------------------------------------------------------

const batIn = withTraits(
  PowerIn({
    id: "bat_in",
    name: "BAT+",
    pin: "+",
    voltageV: VIN,
    parameters: [cellCount([2, 6])],
  }),
  [
    padFunction("+ — battery positive (BAT+ / 电源正极). Input 6~30V (2~6S LiPo).", [SRC.manual, SRC.product]),
    connectorTrait("solder_pad", {
      note: "Large solder pad; stack ships with a 12AWG 12 cm red/black lead and XT60 male plug (product page). The included 35V 470uF low-ESR capacitor is soldered by the builder across +/- (each pad has a small hole for its leads, per review).",
    }),
  ],
);

const batNeg = withTraits(Ground({ id: "bat_neg", name: "BAT-", pin: "-" }), [
  padFunction("- — battery negative (BAT- / 电源负极).", SRC.manual),
  connectorTrait("solder_pad"),
]);

// ---------------------------------------------------------------------------
// FC connector leaves
// ---------------------------------------------------------------------------

const vbatOut = withTraits(
  PowerOut({ id: "vbat_out", name: "V (BAT)", pin: "V", voltageV: VIN }),
  [
    padFunction("V / BAT — battery voltage passed to the flight controller over the 8-pin connector.", SRC.manual),
  ],
);

const gnd = withTraits(Ground({ id: "gnd", name: "G (GND)", pin: "G" }), [
  padFunction("G / GND — ground on the 8-pin FC connector.", SRC.manual),
]);

const cur: InterfaceDef = {
  id: "cur",
  name: "CUR",
  pin: "CUR",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "analog", roles: ["output"] }],
  capabilities: ["analog_out"],
  traits: [
    padFunction("CUR — current sensor output to the FC current ADC. Current Sensor: Support (Scale=150 Offset=0).", [SRC.manual, SRC.product]),
  ],
};

const signals = [1, 2, 3, 4].map((n) =>
  withTraits(
    EscSignal({
      id: `m${n}`,
      name: `M${n}`,
      pin: `M${n}`,
      role: "input",
      protocols: ["dshot300", "dshot600"],
      bidirectional: true,
      motorIndex: n,
    }),
    [
      padFunction(`M${n} — ESC channel ${n} signal input from the FC (8-pin connector).`, [SRC.manual, SRC.review]),
    ],
  ),
);

const fcPort = withTraits(
  FcEscPort({
    id: "fc_port",
    name: "FC connector (8-pin SH)",
    side: "esc",
    motors: signals,
    vbat: "vbat_out",
    gnd: "gnd",
    current: "cur",
  }),
  [
    {
      type: "usage_note",
      params: {
        note: "Plug the included 50 mm SH 1.0 mm 8-pin cable into the FC's SH socket. Pin 4 (VOID) is unused; no ESC telemetry line.",
        source: [SRC.product, SRC.manual, SRC.review],
      },
    },
  ],
);

/** The FC socket itself (PB-805): positions bound to the pads they share. */
const fcSocket = Connector({
  id: "fc_socket",
  name: "FC socket (SH1.0 8-pin)",
  connector: "jst_sh_8",
  gender: "receptacle",
  pins: [["BAT", "vbat_out"], ["GND", "gnd"], ["CUR", "cur"], "VOID", ["M1", "m1"], ["M2", "m2"], ["M3", "m3"], ["M4", "m4"]],
  note:
    "SH 1.0 mm 8-pin socket; stack ships with a 50 mm SH 1.0 mm 8-pin cable for the FC-ESC connection (product page). Wire labels BAT GND CUR VOID M1 M2 M3 M4 (manual p4); ESC silkscreen V G CUR (blank) M1 M2 M3 M4 (manual p3). Pin 1 is not marked; order is given from the BAT end. The pads can also be soldered directly (review).",
  traits: [
    {
      type: "assumption",
      params: {
        field: "connector pin 1",
        value: "BAT end",
        reason: "Neither silkscreen nor manual marks pin 1; order taken from the BAT end so FC and ESC parts share one pinout (the included cable is 1:1).",
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// Motor outputs
// ---------------------------------------------------------------------------

const motors = [1, 2, 3, 4].flatMap((n) =>
  BrushlessPhases({
    id: `motor_${n}`,
    name: `Motor ${n} phases (M${n})`,
    role: "output",
    phases: [
      { pin: `M${n}`, name: `M${n} phase pad 1` },
      { pin: `M${n}`, name: `M${n} phase pad 2` },
      { pin: `M${n}`, name: `M${n} phase pad 3` },
    ],
    maxCurrentA: 60,
    burstCurrentA: 65,
    voltageV: VIN,
    termination: "solder_pad",
  }),
);

// ---------------------------------------------------------------------------
// Mounting
// ---------------------------------------------------------------------------

const mount = withTraits(
  BoltPattern({
    id: "stack_mount",
    name: "30.5 x 30.5 mm stack mount",
    role: "component",
    shape: "square",
    spacingMm: 30.5,
    holeCount: 4,
    fastener: "M3",
    fastenerDiameterMm: 3,
    threaded: false,
    note: "Hole: 30.5*30.5mm / Φ4mm (manual). M3*8.1mm rubber grommets for the ESC are included (product page).",
  }),
  [padFunction("Four Φ4 mm corner mounting holes, 30.5 x 30.5 mm pattern.", [SRC.manual, SRC.product])],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const DOLPHINRC_AM32_60A_4IN1_ESC_BASE: ModuleDef = defineModule({
  id: "dolphinrc-am32-60a-4in1-esc",
  name: "DolphinRC AM32 60A 4-in-1 ESC",
  version: "1.0.0",
  manufacturer: "DolphinRC (Shenzhen DolphinRC Model Technology Co., Ltd.)",
  part_number: "DolphinRC AM32 ESC 60A (F405 V3 stack, SKU DPDZ00041 option '60A ESC')",
  description:
    "AM32 4-in-1 brushless ESC, 60 A continuous / 65 A burst per channel, 2-6S (6-30 V), AT32F421 MCU, 30.5 x 30.5 mm, with 8-pin SH connector to the DolphinRC F405 V3 flight controller.",
  tags: ["esc", "4in1", "am32", "60a", "6s", "30.5x30.5", "fpv", "drone", "dshot"],
  categories: ["esc", "drone"],
  interfaces: [
    batIn,
    batNeg,
    vbatOut,
    gnd,
    cur,
    ...signals,
    fcPort,
    fcSocket,
    ...motors,
    mount,
  ],
  artifacts: [
    { id: "manual", name: "DolphinRC F405 V3 FPV Stack User Manual V1.0", type: "datasheet", url: SRC.manual },
    { id: "product", name: "DolphinRC F405 V3 50A 60A STACK product page", type: "documentation", url: SRC.product },
    { id: "review", name: "DolphinRC F405 V3 stack review (DolphinRC blog)", type: "documentation", url: SRC.review },
  ],
  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vbat", name: "Battery", voltage_range_V: VIN, regulation_type: "unregulated" },
      ],
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 45, width: 41, height: 6 },
      weight_g: 13.2,
      metadata: { mounting: "30.5 x 30.5 mm, Φ4 mm holes", weight_note: "13.2±0.1 g excluding accessories (manual)" },
    },
  ],
  traits: [
    {
      type: "performance",
      params: {
        kind: "esc",
        channels: 4,
        continuous_current_A: 60,
        burst_current_A: 65,
        mcu: "AT32F421, 120 MHz",
        firmware: "AM32 (32-bit); firmware target AT32DEVF421",
        pwm_frequency: "Programmable PWM frequency of up to 48KHz",
        mosfets: "40V dual MOSFET 5*6mm package (60A version)",
        tvs: "SMBJ24A 26V",
        source: [SRC.manual, SRC.product],
      },
    },
    {
      type: "usage_note",
      params: {
        note: "ESC protocols DShot300 / DShot600. For RPM filtering with bidirectional DShot on the F405 FC, keep DShot300.",
        source: SRC.review,
      },
    },
    {
      type: "usage_note",
      params: {
        note: "Current sensor: Betaflight current meter scale 150, offset 0.",
        source: SRC.product,
      },
    },
    {
      type: "usage_note",
      params: {
        note: "Bundled with the stack: 1x 35V 470uF low-ESR capacitor, 5x M3*8.1mm rubber grommets (ESC), 12AWG 12 cm power lead, XT60 male plug.",
        capacitor: { capacitance_uF: 470, voltage_V: 35, type: "low ESR electrolytic" },
        source: SRC.product,
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "burst current duration",
        values: ["65A (5S) — manual", "65A 10s — product page", "~80A 10s — review"],
        sources: [SRC.manual, SRC.product, SRC.review],
        resolution: "burst_current = 65 A (manual and product page agree); duration unresolved (manual '5S' may mean 5 s).",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "current sensor scale",
        values: ["150", "~400"],
        sources: [SRC.product, SRC.review],
        resolution: "150 (product page; matches the MATEKF405TE Betaflight default).",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "weight",
        values: ["13.2±0.1 g", "3 g", "~23.5 g"],
        sources: [SRC.manual, SRC.product, SRC.review],
        resolution: "13.2 g (manual spec table); product page 3 g is a typo.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "dimensions",
        values: ["45*41*6 mm", "45 x 40.5 mm (drawing)", "~45 x 44 x 8 mm"],
        sources: [SRC.manual, SRC.manual, SRC.review],
        resolution: "45 x 41 x 6 mm (manual spec table).",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "capacitor fitted",
        values: ["included as accessory", "preinstalled / soldered on board"],
        sources: [SRC.product, SRC.review],
        resolution: "Treated as a loose accessory the builder solders to the battery pads.",
      },
    },
    {
      type: "data_gap",
      params: {
        fields: ["operating temperature", "total battery current rating", "VBAT pin current limit", "current-sensor output voltage range"],
        note: "Not stated by any source.",
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-775): representative CAD generated from this definition's own
// dimensions by library/cad/py/parts.py — not manufacturer CAD. Frames are in
// the body's coordinates (mm); refs list D1 feature, D2 own artifact, D3
// procedural, in that order. See docs/geometry-artifacts.md.
// ---------------------------------------------------------------------------

export const DOLPHINRC_AM32_60A_4IN1_ESC: ModuleDef = withGeometry(
  DOLPHINRC_AM32_60A_4IN1_ESC_BASE,
  {
    stack_mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0], symmetryDeg: 90 },
      refs: [feature("stack_mount", { area_mm2: 80.425, centroid: [0.0, 0.0, 0.8] }), own("stack_mount"), procedural("bolt_pattern")],
    },
    // Motor pads: geometry on the parent (three pads as one feature), unlike
    // the motor, whose leads are bound per phase leaf.
    motor_1: {
      frame: { origin: [-11.5, -18.3, 1.9], normal: [0, 0, 1] },
      refs: [feature("motor_1", { area_mm2: 36.0, centroid: [-11.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_1"), procedural("pad")],
    },
    motor_2: {
      frame: { origin: [11.5, -18.3, 1.9], normal: [0, 0, 1] },
      refs: [feature("motor_2", { area_mm2: 36.0, centroid: [11.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_2"), procedural("pad")],
    },
    motor_3: {
      frame: { origin: [-11.5, 18.3, 1.9], normal: [0, 0, 1] },
      refs: [feature("motor_3", { area_mm2: 36.0, centroid: [-11.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_3"), procedural("pad")],
    },
    motor_4: {
      frame: { origin: [11.5, 18.3, 1.9], normal: [0, 0, 1] },
      refs: [feature("motor_4", { area_mm2: 36.0, centroid: [11.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_4"), procedural("pad")],
    },

    // Each phase pad on its own (PB-805 harness ends land per conductor), a innermost.
    motor_1_a: {
      frame: { origin: [-6.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("motor_1_a", { area_mm2: 12.0, centroid: [-6.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_1_a")],
    },
    motor_1_b: {
      frame: { origin: [-11.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("motor_1_b", { area_mm2: 12.0, centroid: [-11.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_1_b")],
    },
    motor_1_c: {
      frame: { origin: [-16.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("motor_1_c", { area_mm2: 12.0, centroid: [-16.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_1_c")],
    },
    motor_2_a: {
      frame: { origin: [6.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("motor_2_a", { area_mm2: 12.0, centroid: [6.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_2_a")],
    },
    motor_2_b: {
      frame: { origin: [11.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("motor_2_b", { area_mm2: 12.0, centroid: [11.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_2_b")],
    },
    motor_2_c: {
      frame: { origin: [16.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("motor_2_c", { area_mm2: 12.0, centroid: [16.5, -18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_2_c")],
    },
    motor_3_a: {
      frame: { origin: [-6.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("motor_3_a", { area_mm2: 12.0, centroid: [-6.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_3_a")],
    },
    motor_3_b: {
      frame: { origin: [-11.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("motor_3_b", { area_mm2: 12.0, centroid: [-11.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_3_b")],
    },
    motor_3_c: {
      frame: { origin: [-16.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("motor_3_c", { area_mm2: 12.0, centroid: [-16.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_3_c")],
    },
    motor_4_a: {
      frame: { origin: [6.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("motor_4_a", { area_mm2: 12.0, centroid: [6.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_4_a")],
    },
    motor_4_b: {
      frame: { origin: [11.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("motor_4_b", { area_mm2: 12.0, centroid: [11.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_4_b")],
    },
    motor_4_c: {
      frame: { origin: [16.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("motor_4_c", { area_mm2: 12.0, centroid: [16.5, 18.3, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_4_c")],
    },
    // Battery pads on the rear edge (+ on the right, - on the left, as photographed in the manual p3)
    bat_in: {
      frame: { origin: [-19.3, -5.5, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("bat_in", { area_mm2: 37.8, centroid: [-19.3, -5.5, 1.9], normal: [0.0, 0.0, 1.0] }), own("bat_in")],
    },
    bat_neg: {
      frame: { origin: [-19.3, 5.5, 1.9], normal: [0.0, 0.0, 1.0] },
      refs: [feature("bat_neg", { area_mm2: 37.8, centroid: [-19.3, 5.5, 1.9], normal: [0.0, 0.0, 1.0] }), own("bat_neg")],
    },
    // SH1.0 8-pin socket on the front edge, opening forward; xAxis runs pin 1 (BAT) to pin 8 (M4)
    fc_socket: {
      frame: { origin: [22.2, 0.0, 3.05], normal: [1.0, 0.0, 0.0], xAxis: [0.0, 1.0, 0.0] },
      refs: [feature("fc_socket", { area_mm2: 29.0, centroid: [22.2, 0.0, 3.05], normal: [1.0, 0.0, 0.0] }), own("fc_socket")],
    },
  },
  cadArtifacts({
    dir: "library/parts/dolphinrc-am32-60a-4in1-esc/artifacts/cad",
    name: "dolphinrc-am32-60a",
    generator: "library/cad/py/parts.py",
    tool: "build123d 0.13.0",
    interfaces: ["stack_mount", "motor_1", "motor_2", "motor_3", "motor_4", "motor_1_a", "motor_1_b", "motor_1_c", "motor_2_a", "motor_2_b", "motor_2_c", "motor_3_a", "motor_3_b", "motor_3_c", "motor_4_a", "motor_4_b", "motor_4_c", "bat_in", "bat_neg", "fc_socket"],
  }),
);
