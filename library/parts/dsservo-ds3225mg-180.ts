/**
 * DSSERVO DS3225MG 25 kg digital servo (180° version) — datasheet-honest UHD part.
 *
 * Sources (see ./dsservo-ds3225mg-180/sources.json):
 *   - src_datasheet: Dongguan City Dsservo Technology "DS3225 Product datasheet"
 *                    (2 pages: drawing, environment, mechanical, electrical,
 *                    control and PWM diagrams) — https://www.dsservo.com/down.asp?id=24
 *   - src_ds3218:    DSSERVO DS3218 datasheet (same case drawing; justifies the
 *                    CAD substitution) — https://www.dsservo.com/down.asp?id=22
 *   - src_cad:       DSSERVO "DS3218-3d.rar" (DS3218.stp) — https://www.dsservo.com/down.asp?id=25
 *   - src_makerfocus: MakerFocus listing (the ProtoPart source; distributor) —
 *                    https://www.makerfocus.com/products/digital-servo-25kg
 *   - src_protopart: ProtoPart makerfocus-ds3225mg-25kg-digital-servo-high-torque (community).
 *
 * Modelling notes:
 *   - Identity: MakerFocus resells the DSSERVO DS3225MG; DSSERVO is the
 *     manufacturer. DSSERVO's sheet covers 180° and 270° builds ("180° or
 *     270° when 500~2500 µsec"); MakerFocus sells the 180° build ("180 degree
 *     rotation"), so this part is locked to 180°.
 *   - Electrical: three-wire lead (300±5 mm). Leaves `lead_signal`,
 *     `lead_vplus`, `lead_gnd`; `rc_servo_3wire` (pwm, role device) mirrors
 *     towerpro-sg90 so servo hosts (adafruit-1411-16ch-pwm-servo-shield) pair
 *     with it. DSSERVO does not state wire colours or plug pin order: the
 *     standard signal / V+ / GND order with V+ in the middle is an
 *     assumption trait.
 *   - Supply 4.8-6.8 V; `current_draw` 2.3 A is the stall current at 6.8 V
 *     (worst case for supply sizing); idle 4-5 mA.
 *   - Signal: PWM 500-2500 µs (neutral 1500 µs), 50-330 Hz, 3.3-5 V pulse
 *     amplitude (datasheet PWM diagram), dead band 3 µs.
 *   - Mechanical: BoltPattern 4 x Ø4.5 on 49.5 x 10 mm (flange; holes
 *     measured in the vendor STEP, 49.5 and 10 from the drawing); output
 *     spline as a Shaft of Ø6 mm, measured in the STEP (the datasheet gives
 *     no spline size or tooth count; 25T is from MakerFocus's included horn,
 *     assumption trait).
 *   - Geometry: DSSERVO's DS3218 STEP, bound by vendor_step.py and rotated
 *     Z-up; the DS3218 and DS3225 drawings are identical (assumption trait).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  BoltPattern,
  Ground,
  PowerIn,
  Shaft,
  connectorTrait,
  currentDrawA,
  defineModule,
  maxFrequencyHz,
  voltageRangeV,
} from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  datasheet: "https://www.dsservo.com/down.asp?id=24",
  ds3218: "https://www.dsservo.com/down.asp?id=22",
  cad: "https://www.dsservo.com/down.asp?id=25",
  downloads: "https://www.dsservo.com/en/download.asp",
  makerfocus: "https://www.makerfocus.com/products/digital-servo-25kg",
  protopart:
    "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/makerfocus-ds3225mg-25kg-digital-servo-high-torque/definition.json",
} as const;

const LEAD = connectorTrait("servo_3pin", {
  gender: "female",
  positions: 3,
  pinout: ["signal", "V+", "GND"],
  note: "Three-wire lead, 300±5 mm, ending in a 3-pin servo plug (drawn on the datasheet). Pin order signal / V+ (centre) / GND is the RC-servo convention, not stated by DSSERVO (assumption trait).",
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

const leadSignal: InterfaceDef = {
  id: "lead_signal",
  name: "Signal",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "pwm", roles: ["input"] }],
  capabilities: ["rc_pwm_in"],
  parameters: [
    voltageRangeV(3.3, 5),
    maxFrequencyHz([50, 330]),
    { id: "pulse_width", name: "Pulse width range", unit: "µs", range: [500, 2500] },
  ],
  traits: [
    {
      type: "pin_functions",
      params: {
        description: "Signal: PWM control. Pulse 500-2500 µs (neutral 1500 µs) maps to 0-180°, counterclockwise with increasing width; 50-330 Hz; pulse amplitude 3.3-5 V; dead band 3 µs.",
        source: SRC.datasheet,
      },
    },
    LEAD,
  ],
};

const leadVplus = withTraits(
  { ...PowerIn({ id: "lead_vplus", name: "V+", voltageV: [4.8, 6.8], parameters: [currentDrawA(2.3)] }), capabilities: ["power_in"] },
  [
    {
      type: "pin_functions",
      params: {
        description: "V+: servo supply, 4.8-6.8 V. Idle current 4 mA (5 V) / 5 mA (6.8 V); stall current 1.9 A (5 V) / 2.3 A (6.8 V).",
        source: SRC.datasheet,
      },
    },
    LEAD,
  ],
);

const leadGnd = withTraits(Ground({ id: "lead_gnd", name: "GND" }), [
  { type: "pin_functions", params: { description: "GND: supply and signal ground (common with the PWM source).", source: SRC.datasheet } },
  LEAD,
]);

const rcServo: InterfaceDef = {
  id: "rc_servo_3wire",
  name: "RC servo PWM control (3-wire lead)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "pwm", roles: ["device"] }],
  max_instances: 1,
  parameters: [maxFrequencyHz([50, 330]), { id: "pulse_width", name: "Pulse width range", unit: "µs", range: [500, 2500] }],
  slots: [
    { id: "power", required: true, match: { protocol: "power", role: "input", capability: "power_in" } },
    { id: "ground", required: true, match: { protocol: "power", role: "ground", capability: "ground" } },
    { id: "signal", required: true, match: { protocol: "pwm", role: "input", capability: "rc_pwm_in" } },
  ],
  profiles: [
    { id: "lead", label: "3-wire lead: signal, V+, GND", default_active: true, bindings: { power: "lead_vplus", ground: "lead_gnd", signal: "lead_signal" } },
  ],
  traits: [
    LEAD,
    {
      type: "usage_note",
      params: {
        topic: "control",
        note: "PWM (pulse width modification): 0.5 ms → 0°, 1.5 ms → 90°, 2.5 ms → 180° (180° build). Neutral 1500 µs. Operating frequency 50-330 Hz. Dead band 3 µs.",
        source: SRC.datasheet,
      },
    },
  ],
};

const flangeMount = withTraits(
  BoltPattern({
    id: "flange_mount",
    name: "Mounting flange",
    role: "component",
    shape: "rectangle",
    spacingMm: 49.5,
    spacingYmm: 10,
    holeCount: 4,
    fastener: "Ø4.5 mm holes (fastener not named; M3 or M4)",
    fastenerDiameterMm: [3, 4],
    threaded: false,
    note: "Four holes in the two flange ears: 49.5 mm apart along the case length, 10 mm apart across it; flange 54.5 mm overall, flange underside 27.7 mm above the case bottom (drawing). Hole diameter Ø4.5 measured in the vendor STEP (not on the drawing). The flange carries rubber grommet features in the STEP.",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "fastener diameter / hole diameter",
        value: "Ø4.5 holes (vendor STEP), fasteners 3-4 mm",
        reason: "The DSSERVO drawing dimensions the 49.5 x 10 mm pattern but not the hole size or fastener; Ø4.5 is measured in DSSERVO's DS3218 STEP.",
        source: [SRC.datasheet, SRC.cad],
      },
    },
  ],
);

const outputSpline = withTraits(
  Shaft({
    id: "output_spline",
    name: "Output spline",
    role: "output",
    diameterMm: 6,
    note: "Output spline on the case top, 10 mm from the case centre along the length (vendor STEP). Ø6 is the hub cylinder in the STEP; tooth count and pitch diameter are not on the datasheet. Stall torque 21 kg·cm (5 V) / 24.5 kg·cm (6.8 V); 180° travel.",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "spline size / tooth count",
        value: "Ø6 mm hub, 25T",
        reason: "DSSERVO states neither. Ø6 is measured in the vendor STEP; 25T comes from MakerFocus's included \"25T Adjustable metal servo arm\" (distributor) and ProtoPart.",
        source: [SRC.cad, SRC.makerfocus],
      },
    },
  ],
);

const DSSERVO_DS3225MG_180_BASE: ModuleDef = defineModule({
  id: "dsservo-ds3225mg-180",
  name: "DSSERVO DS3225MG 25 kg digital servo (180°)",
  version: "1.0.0",
  manufacturer: "Dongguan City Dsservo Technology Co., Ltd (DSSERVO)",
  part_number: "DS3225MG (180°)",
  description:
    "Standard-size waterproof (IP66) digital servo, metal gears, CNC aluminium middle case: 4.8-6.8 V, stall torque 21 kg·cm @5 V / 24.5 kg·cm @6.8 V, 0.15 / 0.13 s/60°, PWM 500-2500 µs at 50-330 Hz, 180° travel, 40 x 20 x 40.5 mm, 60 g, 300 mm lead. Sold by MakerFocus as the \"25KG digital servo\".",
  tags: ["servo", "digital-servo", "rc-servo", "metal-gear", "waterproof", "ip66", "25kg", "ds3225", "dsservo", "makerfocus"],
  categories: ["actuator.motor.servo"],

  interfaces: [leadSignal, leadVplus, leadGnd, rcServo, flangeMount, outputSpline],

  domains: [
    {
      domain: "electrical",
      power_domains: [{ id: "servo_supply", name: "Servo supply (V+)", voltage_range_V: [4.8, 6.8], max_current_mA: 2300 }],
      metadata: {
        idle_current_mA: { "5V": 4, "6.8V": 5 },
        stall_current_A: { "5V": 1.9, "6.8V": 2.3 },
        motor: "3-pole",
        control: "PWM, 500-2500 µs, 50-330 Hz, 3.3-5 V pulse",
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 40, width: 20, height: 40.5 },
      weight_g: 60,
      metadata: {
        flange: "54.5 mm overall, holes 49.5 x 10 mm, underside 27.7 mm above the case bottom",
        height_drawing_mm: 40.4,
        gear_ratio: 275,
        bearing: "double bearing",
        lead_length_mm: "300±5",
        waterproof: "IP66",
      },
    },
    {
      domain: "thermal",
      operating_temperature_C: [-15, 70],
      metadata: { storage_temperature_C: [-30, 80] },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "servo",
        stall_torque_kg_cm: { "5V": 21, "6.8V": 24.5 },
        speed_s_per_60deg: { "5V": 0.15, "6.8V": 0.13 },
        running_degree: 180,
        dead_band_us: 3,
        gear_ratio: 275,
        rotating_direction: "counterclockwise (500→2500 µs)",
        source: SRC.datasheet,
      },
    },
    {
      type: "operating_conditions",
      params: { supply_voltage_V: [4.8, 6.8], operating_temperature_C: [-15, 70], storage_temperature_C: [-30, 80], waterproof: "IP66", source: SRC.datasheet },
    },
    {
      type: "usage_note",
      params: {
        topic: "variant",
        note: "DSSERVO builds the DS3225 as 180° or 270° with the same datasheet; this part is the 180° build sold by MakerFocus (\"180 degree rotation ... Can be rotated within 360 degrees when power off\"). The 270° build maps 500-2500 µs to 0-270°.",
        source: [SRC.datasheet, SRC.makerfocus],
      },
    },
    {
      type: "assumption",
      params: {
        field: "lead colours and plug pin order",
        value: "signal / V+ (centre) / GND",
        reason: "DSSERVO shows a 3-pin plug but no colours or order; the RC-servo convention is assumed. ProtoPart's brown (GND) / red (V+) / orange-yellow (signal) colours are not in a manufacturer source.",
        source: [SRC.datasheet, SRC.protopart],
      },
    },
    {
      type: "assumption",
      params: {
        field: "CAD model",
        value: "DSSERVO DS3218.stp used as the DS3225MG body",
        reason: "DSSERVO publishes no DS3225 model. Its DS3218 and DS3225 datasheets carry the identical case drawing (the embedded drawing image is byte-identical in both PDFs: 40 x 20 x 40.4, 54.5 flange, 49.5 x 10 holes, 27.7 to the flange, 24 horn, same 3-pin lead) and the same size (40*20*40.5), weight (60 g), gear ratio (275) and lead length (300±5 mm). Internals differ (DS3218: 18 / 21.5 kg·cm, 1.8 / 2.2 A) and are not modelled.",
        source: [SRC.datasheet, SRC.ds3218, SRC.cad],
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "stall torque / weight (MakerFocus)",
        values: ["21 kg·cm @5 V, 24.5 kg·cm @6.8 V, 60 g (DSSERVO datasheet)", "21 kg/cm @5 V, 25 kg/cm @6.8 V, 67 g (MakerFocus listing)"],
        sources: [SRC.datasheet, SRC.makerfocus],
        resolution: "Manufacturer values used.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "supply voltage / waterproof rating (ProtoPart)",
        values: ["4.8-6.8 V, IP66 (DSSERVO datasheet; MakerFocus 4.8-6.8 V)", "\"nominal 6V-7.4V class operation\", \"IP67-class (vendor listing claim)\" (ProtoPart)"],
        sources: [SRC.datasheet, SRC.makerfocus, SRC.protopart],
        resolution: "Manufacturer values used: do not run this servo from a 2S LiPo (7.4 V) directly.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "spline tooth count and dimensions, horn",
        note: "The DSSERVO datasheet gives no spline specification; see the assumption trait on output_spline.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "signal logic thresholds, running current under load",
        note: "Only the 3.3-5 V pulse amplitude, idle and stall currents are given.",
      },
    },
  ],

  artifacts: [
    { id: "art_datasheet", name: "DSSERVO DS3225 product datasheet", type: "datasheet", url: SRC.datasheet },
    { id: "art_ds3218_datasheet", name: "DSSERVO DS3218 product datasheet (same case)", type: "documentation", url: SRC.ds3218 },
    { id: "art_makerfocus", name: "MakerFocus DS3225 25KG digital servo listing", type: "documentation", url: SRC.makerfocus },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796), vendor: DSSERVO DS3218.stp via
// library/cad/py/catalog/dsservo-ds3225mg-180.py, rotated +90° about X so the
// spline points +Z. Flange underside z = 7.6, case bottom z = -20, spline
// axis at (10, 0), flange holes at (±24.75, ±5).
// ---------------------------------------------------------------------------

const LEAD_REF = vendorFeature("servo_lead", { area_mm2: 109.753, centroid: [29.679, 0.223, -11.45] });

export const DSSERVO_DS3225MG_180: ModuleDef = withGeometry(
  DSSERVO_DS3225MG_180_BASE,
  {
    // The servo drops into a cut-out; the plate is under the flange (-Z).
    // No symmetry: the spline is off-centre.
    flange_mount: {
      frame: { origin: [0, 0, 7.6], normal: [0, 0, -1], xAxis: [1, 0, 0] },
      refs: [
        vendorFeature("flange_mount", { area_mm2: 147.953, centroid: [-0.195, 0.0, 9.24] }),
        vendorFeature("flange_underside", { area_mm2: 938.061, centroid: [0.007, 0.0, 7.735] }),
        vendorOwn("flange_mount"),
        procedural("bolt_pattern"),
      ],
    },
    output_spline: {
      frame: { origin: [10, 0, 20.4], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      refs: [vendorFeature("output_spline", { area_mm2: 71.628, centroid: [10.0, 0.0, 19.7] }), vendorOwn("output_spline"), procedural("shaft")],
    },
    rc_servo_3wire: { refs: [LEAD_REF] },
    lead_signal: { refs: [LEAD_REF] },
    lead_vplus: { refs: [LEAD_REF] },
    lead_gnd: { refs: [LEAD_REF] },
  },
  vendorCadArtifacts({
    partId: "dsservo-ds3225mg-180",
    name: "DS3218",
    url: SRC.cad,
    stepFile: "DS3218.stp",
    sha256: "19ca1b5ee9f3201b76af4bfc5101cf75172f92fb826129bfe4e35d66bac72bae",
    licence: "not stated on the DSSERVO download page; not redistributed",
    interfaces: ["flange_mount", "output_spline"],
  }),
);
