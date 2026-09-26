/**
 * HAKRC BLS 35A 4IN1 ESC (20 x 20 mm, BLHeli_S, board HK88201 V1.2) —
 * datasheet-honest UHD part.
 *
 * Sources (see ./hakrc-bls-35a-4in1-esc/sources.json):
 *   - src_product: HAKRC product page (description + "ESC Specifications") —
 *     https://www.hakrc.com/BLS-35A-4IN1-ESC.html
 *   - src_pinout_image: HAKRC product pinout image (top side) —
 *     https://img03.71360.com/file/read/www2/M00/17/B9/wKj2K2LrPOKAU2JMAAP4DLM4LYQ657.png
 *   - src_bottom_image: HAKRC product image (bottom side) —
 *     https://img03.71360.com/file/read/www2/M00/17/BC/wKj2K2LrPi2AdaQ3AAEearEbZto343.jpg
 *   - src_protopart: ProtoPart hakrc-bls-35a-4in1 definition (community
 *     starting point; several of its values conflict with HAKRC, see below).
 *
 * Modelling notes:
 *   - Variant lock: the 20 x 20 mm "BLS 35A 4IN1 ESC" on hakrc.com (31 x 30 x
 *     6 mm, 6.1 g, EFM8BB21F16G, BLHeli_S BL16.7). Not the "BLS 8B 35A 4IN1"
 *     or any 30.5 x 30.5 mm HAKRC ESC.
 *   - ProtoPart describes an STM32F421K MCU, AM32 firmware
 *     (AM32_HAKRC_K_F421), bidirectional DShot, DShot1200, a 5 V logic input
 *     pad, M2 holes and 28 x 28 mm. HAKRC's page says EFM8BB21F16G, BLHeli_S
 *     BL16.7, DShot150/300/600, M3 and 31 x 30 mm, and the pinout image shows
 *     no 5 V pad. This part follows HAKRC; AM32 cannot run on the EFM8 MCU, so
 *     the ProtoPart (Project Stinger) board may be a different HAKRC F421
 *     variant. source_discrepancy traits; needs a human decision.
 *   - Battery: "+" / "-" pads on the bottom edge. 2-6S (the only supply
 *     statement). The voltage range 6.0-25.2 V is derived from 2S x 3.0 V
 *     to 6S x 4.2 V (assumption). No total-current rating (data gap).
 *   - FC connector: 8-pin, labelled "Curr NC 4 3 2 1 + -" (pinout image).
 *     Leaves: `cur` (current-sensor output), `m1`..`m4` (signal inputs),
 *     `vbat_out` (+) and `gnd` (-); NC has no leaf. No telemetry pin.
 *     Pitch ~1.0 mm is measured from the photo, so the JST-SH class and the
 *     pin-1 end are assumptions. The pinout differs from the DolphinRC F405
 *     V3 stack (BAT GND CUR VOID M1-M4): a remapped cable is needed.
 *   - ESC signal inputs: PWM, OneShot125, OneShot42, MultiShot,
 *     DShot150/300/600 (product page). Bidirectional DShot is not claimed.
 *   - Motor outputs: four BrushlessPhases, 35 A continuous / 40 A
 *     "instantaneous" per the page (read as per channel, like the name;
 *     assumption). Burst duration not stated.
 *   - Mounting: 20 x 20 mm, "Fixed aperture: M3". Hole diameter not stated:
 *     CAD uses 3.2 mm (assumption). ProtoPart says M2 (discrepancy).
 *   - Current sensor scale/offset: not stated (data gap).
 *   - Geometry generated (no manufacturer CAD: data_gap) from the stated
 *     31 x 30 x 6 mm, the 20 x 20 holes and the pinout photo; pad and
 *     connector positions are photo estimates (assumption trait).
 *   - Verify warning "no thermal domain or operating_conditions trait" is
 *     intentional: HAKRC gives no operating temperature (data_gap). ProtoPart's
 *     -10..90 C has no manufacturer source.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { BoltPattern, BrushlessPhases, EscSignal, FcEscPort, Ground, PowerIn, PowerOut, cellCount, connectorTrait, defineModule } from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://www.hakrc.com/BLS-35A-4IN1-ESC.html",
  pinout: "https://img03.71360.com/file/read/www2/M00/17/B9/wKj2K2LrPOKAU2JMAAP4DLM4LYQ657.png",
  bottom: "https://img03.71360.com/file/read/www2/M00/17/BC/wKj2K2LrPi2AdaQ3AAEearEbZto343.jpg",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/hakrc-bls-35a-4in1/definition.json",
} as const;

/** FC connector as labelled on the pinout image, from the "Curr" end. */
const FC_PINOUT = ["CUR", "NC", "M4", "M3", "M2", "M1", "VBAT", "GND"];

const CONN_8 = connectorTrait("jst_sh_8", {
  gender: "receptacle",
  positions: 8,
  pinout: FC_PINOUT,
  note: "8-pin connector labelled 'Curr NC 4 3 2 1 + -' (silkscreen CN4321+-) on the pinout image. Pitch about 1.0 mm by photo measurement; family (JST-SH) and pin-1 end are assumptions.",
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function padFunction(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

const VIN: [number, number] = [6.0, 25.2]; // derived from 2-6S (assumption)

// Battery pads -------------------------------------------------------------

const batIn = withTraits(PowerIn({ id: "bat_in", name: "BAT+", pin: "+", voltageV: VIN, parameters: [cellCount([2, 6])] }), [
  padFunction("+ — battery positive pad (bottom edge). Working voltage: 2-6S.", [SRC.product, SRC.pinout]),
  connectorTrait("solder_pad", { note: "Solder pad on the bottom edge; no lead, connector or capacitor is listed as included." }),
  {
    type: "assumption",
    params: { field: "voltage range", value: "6.0-25.2 V", reason: "HAKRC states only 'Working voltage: 2-6S'; range = 2S x 3.0 V/cell to 6S x 4.2 V/cell." },
  },
]);

const batNeg = withTraits(Ground({ id: "bat_neg", name: "BAT-", pin: "-" }), [
  padFunction("- — battery negative pad (bottom edge).", SRC.pinout),
  connectorTrait("solder_pad"),
]);

// FC connector leaves --------------------------------------------------------

const vbatOut = withTraits(PowerOut({ id: "vbat_out", name: "+ (VBAT)", pin: "+", voltageV: VIN }), [
  padFunction("+ — battery voltage on the 8-pin FC connector.", SRC.pinout),
  CONN_8,
]);

const gnd = withTraits(Ground({ id: "gnd", name: "- (GND)", pin: "-" }), [padFunction("- — ground on the 8-pin FC connector.", SRC.pinout), CONN_8]);

const cur: InterfaceDef = {
  id: "cur",
  name: "Curr",
  pin: "Curr",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "analog", roles: ["output"] }],
  capabilities: ["analog_out"],
  traits: [padFunction("Curr — current sensor output on the 8-pin FC connector (shunt on the bottom side). Scale/offset not stated.", [SRC.pinout, SRC.bottom]), CONN_8],
};

const signals = [1, 2, 3, 4].map((n) =>
  withTraits(
    EscSignal({
      id: `m${n}`,
      name: `M${n}`,
      pin: `${n}`,
      role: "input",
      protocols: ["pwm", "oneshot125", "oneshot42", "multishot", "dshot150", "dshot300", "dshot600"],
      motorIndex: n,
    }),
    [padFunction(`${n} — ESC channel ${n} throttle signal input on the 8-pin FC connector.`, [SRC.pinout, SRC.product]), CONN_8],
  ),
);

const fcPort = withTraits(
  FcEscPort({ id: "fc_port", name: "FC connector (8-pin)", side: "esc", connector: "jst_sh_8", pinout: FC_PINOUT, motors: signals, vbat: "vbat_out", gnd: "gnd", current: "cur" }),
  [
    {
      type: "usage_note",
      params: {
        note: "Pinout Curr, NC, M4, M3, M2, M1, +, -. Stacks with a different FC pinout (e.g. DolphinRC F405 V3: BAT GND CUR VOID M1-M4) need a remapped cable. No telemetry pin (BLHeli_S). Firmware BLHeli_S BL16.7, configurable with BLHeliSuite through the signal line or FC passthrough.",
        source: [SRC.pinout, SRC.product],
      },
    },
    {
      type: "assumption",
      params: { field: "connector family and pin 1", value: "JST-SH 1.0 mm 8-pin; pin 1 at the Curr end", reason: "The image labels the pins but not the connector family or pin 1; pitch measured from the photo." },
    },
  ],
);

// Motor outputs --------------------------------------------------------------

const motors = [1, 2, 3, 4].flatMap((n) =>
  BrushlessPhases({
    id: `motor_${n}`,
    name: `Motor ${n} phases`,
    role: "output",
    phases: [
      { pin: `${n}`, name: `M${n} phase pad 1` },
      { pin: `${n}`, name: `M${n} phase pad 2` },
      { pin: `${n}`, name: `M${n} phase pad 3` },
    ],
    maxCurrentA: 35,
    burstCurrentA: 40,
    voltageV: VIN,
    termination: "solder_pad",
  }),
);

// Mounting -------------------------------------------------------------------

const mount = withTraits(
  BoltPattern({
    id: "stack_mount",
    name: "20 x 20 mm stack mount (M3)",
    role: "component",
    shape: "square",
    spacingMm: 20,
    holeCount: 4,
    fastener: "M3",
    fastenerDiameterMm: 3,
    threaded: false,
    note: "Fixed hole position: 20*20mm; Fixed aperture: M3 (product page). Hole diameter not stated.",
  }),
  [padFunction("Four corner mounting holes (numbered 1-4 on the board), 20 x 20 mm.", [SRC.product, SRC.pinout])],
);

// Module ---------------------------------------------------------------------

const HAKRC_BLS_35A_4IN1_ESC_BASE: ModuleDef = defineModule({
  id: "hakrc-bls-35a-4in1-esc",
  name: "HAKRC BLS 35A 4-in-1 ESC (20x20)",
  version: "1.0.0",
  manufacturer: "HAKRC (Shenzhen Haike Technology Co., Ltd.)",
  part_number: "BLS 35A 4IN1 ESC (board HK88201 V1.2)",
  description:
    "BLHeli_S 4-in-1 brushless ESC, 35 A continuous / 40 A instantaneous, 2-6S, EFM8BB21F16G, DShot150/300/600, OneShot, MultiShot, PWM; 20 x 20 mm M3 mount, 31 x 30 x 6 mm, 6.1 g, 8-pin FC connector (Curr NC 4 3 2 1 + -).",
  tags: ["esc", "4in1", "blheli_s", "35a", "6s", "20x20", "fpv", "drone", "dshot"],
  categories: ["esc", "drone"],
  interfaces: [batIn, batNeg, vbatOut, gnd, cur, ...signals, fcPort, ...motors, mount],
  artifacts: [
    { id: "product", name: "HAKRC BLS 35A 4IN1 ESC product page", type: "documentation", url: SRC.product },
    { id: "pinout_image", name: "HAKRC BLS 35A 4IN1 pinout image", type: "documentation", url: SRC.pinout },
  ],
  domains: [
    { domain: "electrical", power_domains: [{ id: "vbat", name: "Battery (2-6S)", voltage_range_V: VIN, regulation_type: "unregulated" }] },
    {
      domain: "mechanical",
      dimensions_mm: { length: 31, width: 30, height: 6 },
      weight_g: 6.1,
      metadata: { mounting: "20 x 20 mm, M3", source: SRC.product },
    },
  ],
  traits: [
    {
      type: "performance",
      params: {
        kind: "esc",
        channels: 4,
        continuous_current_A: 35,
        burst_current_A: 40,
        mcu: "EFM8BB21F16G, up to 48 MHz (the page spells it 'EMF8BB21F16G', read as the Silicon Labs EFM8BB21F16G that BLHeli_S targets)",
        firmware: "BLHeli_S BL16.7 (BLHeliSuite)",
        driver: "three-in-one IC driver (FORTIOR FD6288Q marking on the pinout image)",
        pcb: "3 oz copper, 6 layers",
        features: "hardware PWM, Damped Light, regenerative braking, active freewheeling",
        source: [SRC.product, SRC.pinout],
      },
    },
    {
      type: "assumption",
      params: { field: "current rating scope", value: "35 A / 40 A per channel", reason: "The page states 'Maximum continuous working current: 35A / Maximum instantaneous current: 40A' without saying per channel; the product name (35A 4IN1) implies per channel." },
    },
    {
      type: "assumption",
      params: {
        field: "CAD geometry",
        value: "30 (x) x 31 (y) x 6 mm board, 1.6 mm PCB, Φ3.2 holes, pad/connector positions from the photo",
        reason: "HAKRC gives only 31*30*6 mm, 20*20 mm and M3; axis assignment, PCB thickness, hole diameter and pad positions are not dimensioned.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "MCU and firmware",
        values: ["STM32F421K, AM32 (AM32_HAKRC_K_F421_2.18), bidirectional DShot, DShot1200 (ProtoPart)", "EFM8BB21F16G, BLHeli_S BL16.7, DShot150/300/600 (HAKRC page)"],
        sources: [SRC.protopart, SRC.product],
        resolution: "HAKRC page used. Identity caveat: ProtoPart cites this same HAKRC page (and itself says the ESC ships with BLHeli_S), but AM32 cannot run on the EFM8BB21, so the ProtoPart/Stinger board may be a different HAKRC revision or SKU (an F421 board). No HAKRC source for an F421 version of this product was found (2026-09-26). Confirm the physical board before flashing AM32.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "mounting and size",
        values: ["20 x 20 mm, M2, 28 x 28 x 6 mm, 6 g (ProtoPart)", "20*20 mm, M3, 31*30*6 mm, 6.1 g (HAKRC page)"],
        sources: [SRC.protopart, SRC.product, SRC.pinout],
        resolution: "HAKRC page used (M3, 31 x 30 x 6 mm). Identity caveat: the ProtoPart listing may describe a different revision or SKU. On the HAKRC pinout photo (10.75 px/mm from the 20 mm callout) the bare PCB is about 28 x 27 mm and about 30.3 mm across the motor pads, so ProtoPart's 28 x 28 may be the PCB alone; the hole bores measure about 3.3-3.6 mm, consistent with M3, not M2.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "5 V logic input and telemetry pads",
        values: ["5 V logic-in pad and telemetry pad (ProtoPart)", "connector Curr NC 4 3 2 1 + -, no 5 V or telemetry pad (HAKRC pinout image)"],
        sources: [SRC.protopart, SRC.pinout],
        resolution: "No 5 V or telemetry interface modelled. Identity caveat: the ProtoPart listing may describe a different revision or SKU (board HK88201 V1.2 is shown by HAKRC).",
      },
    },
    {
      type: "data_gap",
      params: {
        fields: [
          "manufacturer CAD",
          "operating temperature",
          "total battery current rating",
          "burst duration",
          "current sensor scale/offset",
          "signal logic level",
          "hole diameter",
          "connector part number and pin 1",
        ],
        note: "No manufacturer CAD or drawing: hakrc.com product page offers none (checked 2026-09-26); geometry generated from the stated size, hole pattern and the pinout photo (library/cad/py/catalog/hakrc-bls-35a-4in1-esc.py). Other fields not stated by HAKRC.",
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// Geometry: generated (not manufacturer CAD). Board centred, PCB bottom z = 0,
// component side +Z, connector at +Y as on the pinout image.
// ---------------------------------------------------------------------------

export const HAKRC_BLS_35A_4IN1_ESC: ModuleDef = withGeometry(
  HAKRC_BLS_35A_4IN1_ESC_BASE,
  {
    stack_mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0], symmetryDeg: 90 },
      refs: [feature("stack_mount", { area_mm2: 64.34, centroid: [0.0, 0.0, 0.8] }), own("stack_mount"), procedural("bolt_pattern")],
    },
    motor_1: { frame: { origin: [-13.75, -6.0, 1.9], normal: [0, 0, 1] }, refs: [feature("motor_1", { area_mm2: 15.0, centroid: [-13.75, -6.0, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_1")] },
    motor_2: { frame: { origin: [-13.75, 6.0, 1.9], normal: [0, 0, 1] }, refs: [feature("motor_2", { area_mm2: 15.0, centroid: [-13.75, 6.0, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_2")] },
    motor_3: { frame: { origin: [13.75, -6.0, 1.9], normal: [0, 0, 1] }, refs: [feature("motor_3", { area_mm2: 15.0, centroid: [13.75, -6.0, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_3")] },
    motor_4: { frame: { origin: [13.75, 6.0, 1.9], normal: [0, 0, 1] }, refs: [feature("motor_4", { area_mm2: 15.0, centroid: [13.75, 6.0, 1.9], normal: [0.0, 0.0, 1.0] }), own("motor_4")] },
    bat_in: { refs: [feature("bat_in", { area_mm2: 9.0, centroid: [3.0, -14.0, 1.9], normal: [0.0, 0.0, 1.0] }), own("bat_in")] },
    bat_neg: { refs: [feature("bat_neg", { area_mm2: 9.0, centroid: [-3.0, -14.0, 1.9], normal: [0.0, 0.0, 1.0] }), own("bat_neg")] },
    fc_port: {
      frame: { origin: [-1.2, 15.125, 3.05], normal: [0, 1, 0], xAxis: [1, 0, 0] },
      refs: [feature("fc_port", { area_mm2: 29.0, centroid: [-1.2, 15.125, 3.05], normal: [0.0, 1.0, 0.0] }), own("fc_port")],
    },
    cur: { refs: [feature("fc_port", { area_mm2: 29.0, centroid: [-1.2, 15.125, 3.05], normal: [0.0, 1.0, 0.0] })] },
    vbat_out: { refs: [feature("fc_port", { area_mm2: 29.0, centroid: [-1.2, 15.125, 3.05], normal: [0.0, 1.0, 0.0] })] },
    gnd: { refs: [feature("fc_port", { area_mm2: 29.0, centroid: [-1.2, 15.125, 3.05], normal: [0.0, 1.0, 0.0] })] },
    m1: { refs: [feature("fc_port", { area_mm2: 29.0, centroid: [-1.2, 15.125, 3.05], normal: [0.0, 1.0, 0.0] })] },
    m2: { refs: [feature("fc_port", { area_mm2: 29.0, centroid: [-1.2, 15.125, 3.05], normal: [0.0, 1.0, 0.0] })] },
    m3: { refs: [feature("fc_port", { area_mm2: 29.0, centroid: [-1.2, 15.125, 3.05], normal: [0.0, 1.0, 0.0] })] },
    m4: { refs: [feature("fc_port", { area_mm2: 29.0, centroid: [-1.2, 15.125, 3.05], normal: [0.0, 1.0, 0.0] })] },
  },
  cadArtifacts({
    dir: "library/parts/hakrc-bls-35a-4in1-esc/artifacts/cad",
    name: "hakrc-bls-35a-4in1",
    generator: "library/cad/py/catalog/hakrc-bls-35a-4in1-esc.py",
    tool: "build123d 0.13.0",
    interfaces: ["stack_mount", "motor_1", "motor_2", "motor_3", "motor_4", "bat_in", "bat_neg", "fc_port"],
  }),
);
