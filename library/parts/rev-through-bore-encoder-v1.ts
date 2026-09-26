/**
 * REV Robotics Through Bore Encoder V1 (REV-11-1271) — datasheet-honest UHD part.
 *
 * Sources (see ./rev-through-bore-encoder-v1/sources.json):
 *   - src_product:   REV-11-1271 product page — https://www.revrobotics.com/rev-11-1271/
 *   - src_datasheet: REV-11-1271-DS-06 datasheet — https://www.revrobotics.com/content/docs/REV-11-1271-DS.pdf
 *   - src_drawing:   REV-11-1271 drawing — https://www.revrobotics.com/content/docs/REV-11-1271-DR.pdf
 *   - src_docs:      Through Bore Encoder V1 overview — https://docs.revrobotics.com/rev-crossover-products/sensors/tbe/v1
 *   - src_specs:     Through Bore Encoder V1 specifications — https://docs.revrobotics.com/rev-crossover-products/sensors/tbe/v1/specs
 *   - src_cad:       REV-11-1271 STEP — https://www.revrobotics.com/content/cad/REV-11-1271.STEP
 *   - src_protopart: ProtoPart rev-through-bore-encoder definition (community starting point only)
 *
 * Modelling notes:
 *   - Variant lock: V1 (REV-11-1271, Broadcom AEAT-8800-Q24). REV now also
 *     sells a Through Bore Encoder V2; nothing here is taken from V2 pages.
 *   - Connector: JST-PH 6-pin. The datasheet's encoder-mode key lists
 *     +V, ABS, ENC A, ENC B, ENC I, GND in that order but does not number the
 *     pins; leaves use those labels as pin designators and the connector
 *     trait keeps the order (pin 1 not identified: data_gap).
 *   - Supply: `vcc` PowerIn 3.3-5.0 V. ProtoPart said 4.5-5.5 V / 50 mA; REV
 *     says 3.3-5.0 V and gives no current (source_discrepancy, data_gap).
 *   - Outputs: A, B, I (digital outputs, 3.3 V logic, 5 V tolerant; 2048
 *     cycles / 8192 counts per rev, index 90 deg e once per rev) and ABS
 *     (absolute pulse / duty cycle, 975.6 Hz, 1-1024 us, 10-bit), modelled as
 *     digital + pwm output. No composite: there is no quadrature-encoder
 *     vocabulary and the leaves say what each pin carries (gaps.json).
 *   - The A/S switch selects ABI (A, supported) or SSI/SPI (S: pins become
 *     MISO, SEL, MOSI, CLK; manufacturing use only): usage_note.
 *   - Mount: two slotted #10-clearance ear holes (Φ4.98 mm); the slots' outer
 *     ends are 50.8 mm (2.0 in) apart through the bore centre, the inner ends
 *     45.8 mm (STEP). BoltPattern circle, 2 holes, 50.8 mm.
 *   - Bore: 1/2 in hex through bore, a Shaft with role input (the encoder is
 *     driven by the shaft), sized for a 12.7 mm (1/2 in) hex shaft (bore 12.8 mm
 *     across flats on the drawing, 12.78 mm in the STEP); inserts for 3/8 in hex,
 *     5 mm hex, 1/4 in round. The CAD feature is the six hex flats, which
 *     have no cylinder axis, so the shaft-axis plausibility check has nothing
 *     to compare (the frame is on the bore axis by construction).
 *   - No operating temperature in REV's sources (data_gap); justifies the
 *     verify "coverage" warning.
 *   - Geometry: manufacturer STEP (not committed), bound by
 *     library/cad/py/catalog/rev-through-bore-encoder-v1.py, no transform:
 *     bore axis Z, ear (mounting) faces at z = -2.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { BoltPattern, Ground, PowerIn, Shaft, connectorTrait, defineModule, maxFrequencyHz } from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://www.revrobotics.com/rev-11-1271/",
  datasheet: "https://www.revrobotics.com/content/docs/REV-11-1271-DS.pdf",
  drawing: "https://www.revrobotics.com/content/docs/REV-11-1271-DR.pdf",
  docs: "https://docs.revrobotics.com/rev-crossover-products/sensors/tbe/v1",
  specs: "https://docs.revrobotics.com/rev-crossover-products/sensors/tbe/v1/specs",
  cad: "https://www.revrobotics.com/content/cad/REV-11-1271.STEP",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/rev-through-bore-encoder/definition.json",
} as const;

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function pinFn(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

const JST_PH_6 = connectorTrait("jst_ph_6", {
  gender: "receptacle",
  positions: 6,
  pinout: ["+V", "ABS", "ENC A", "ENC B", "ENC I", "GND"],
  note: "JST-PH 6-pin (JST S6B-PH-K-S side-entry header in REV's STEP). Order as the datasheet encoder-mode key lists it; the key does not say which end is pin 1. Included cables: REV-11-1275 (JST-PH 6 to JST-PH 6, SPARK MAX brushed mode: A, B, I, ABS), REV-11-1817 (to 4 x 3-pin 0.1 in for roboRIO DIO: A, B, I, ABS), REV-31-1815 (to JST-PH 4 for Control/Expansion Hub encoder port: A, B).",
});

const LOGIC = "3.3 V logic (5 V tolerant).";

function output(id: string, name: string, pin: string, capability: string, description: string, extra: Partial<InterfaceDef> = {}): InterfaceDef {
  return {
    id,
    name,
    pin,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "digital", roles: ["output"] }],
    capabilities: [capability],
    ...extra,
    traits: [pinFn(description, [SRC.datasheet, SRC.product]), JST_PH_6],
  };
}

const vcc = withTraits(PowerIn({ id: "vcc", name: "+V", pin: "+V", voltageV: [3.3, 5.0] }), [
  pinFn("+V — supply input, 3.3-5.0 V.", [SRC.datasheet, SRC.specs]),
  JST_PH_6,
  {
    type: "source_discrepancy",
    params: {
      field: "supply voltage / current",
      values: ["3.3-5.0 V, no current stated (REV datasheet, product page, specs)", "4.5-5.5 V, 50 mA (ProtoPart 5v-logic)"],
      sources: [SRC.datasheet, SRC.product, SRC.protopart],
      resolution: "REV range used; no supply current modelled.",
    },
  },
]);
const gnd = withTraits(Ground({ id: "gnd", name: "GND", pin: "GND" }), [pinFn("GND — ground.", SRC.datasheet), JST_PH_6]);

const encA = output("enc_a", "ENC A", "ENC A", "encoder_a", `ENC A — incremental quadrature channel A, 2048 cycles per revolution. ${LOGIC}`);
const encB = output("enc_b", "ENC B", "ENC B", "encoder_b", `ENC B — incremental quadrature channel B. ${LOGIC}`);
const encI = output("enc_i", "ENC I", "ENC I", "encoder_index", `ENC I — index pulse, once per revolution, 90 deg electrical wide. ${LOGIC}`);
const abs = output(
  "abs",
  "ABS",
  "ABS",
  "absolute_encoder_duty_cycle",
  `ABS — absolute position pulse (duty cycle): period 1025 us (975.6 Hz), 1 us at 0 deg to 1024 us at 360 deg, 10-bit. ${LOGIC}`,
  { protocols: [{ type: "digital", roles: ["output"] }, { type: "pwm", roles: ["output"] }], parameters: [maxFrequencyHz(975.6)] },
);

const mount = BoltPattern({
  id: "mount",
  name: "2 x #10 clearance ear holes, 2 in apart",
  role: "component",
  shape: "circle",
  spacingMm: 50.8,
  holeCount: 2,
  fastener: "#10 screw (clearance)",
  fastenerDiameterMm: 4.83,
  threaded: false,
  note: "Two molded ear holes, Φ4.98 mm (0.196 in), slotted radially: outer ends on a Φ50.8 mm (2.0 in) circle through the bore centre (61.1 mm across the ears), inner ends 45.8 mm apart (STEP). REV: hole spacing matches common FRC gearboxes and chassis.",
});

const bore = Shaft({
  id: "hex_bore",
  name: "1/2 in hex through bore",
  role: "input",
  diameterMm: 12.7,
  note: "1/2 in hex through bore (default) for a 12.7 mm hex shaft; bore 12.8 mm across flats (drawing, 12.78 mm in the STEP), in a flanged 1/2 in hex bearing (Φ31.1 mm OD). Inserts (included): 3/8 in hex and 5 mm hex (press into the 1/2 in hex; slight taper, smaller end first), 1/4 in round (press onto the shaft first). Maximum 10000 rpm. Zero position calibrated to the notch in the case; do not disassemble.",
});

const REV_THROUGH_BORE_ENCODER_V1_BASE: ModuleDef = defineModule({
  id: "rev-through-bore-encoder-v1",
  name: "REV Through Bore Encoder V1",
  version: "1.0.0",
  manufacturer: "REV Robotics",
  part_number: "REV-11-1271",
  description:
    "Magnetic through-bore rotary encoder (Broadcom AEAT-8800-Q24) with incremental ABI quadrature output (2048 CPR / 8192 counts, index once per rev) and absolute duty-cycle output (975.6 Hz, 10-bit). 3.3-5.0 V supply, 3.3 V logic (5 V tolerant), JST-PH 6-pin. 1/2 in hex through bore with 3/8 in hex, 5 mm hex and 1/4 in round inserts; two #10-clearance ear holes 2 in apart. 10000 rpm max, 23 g.",
  tags: ["frc", "ftc", "encoder", "absolute", "quadrature", "through-bore", "hex", "sensor", "aeat-8800"],
  categories: ["sensor", "sensor.encoder"],

  interfaces: [vcc, gnd, encA, encB, encI, abs, mount, bore],

  domains: [
    {
      domain: "electrical",
      power_domains: [{ id: "vcc", name: "+V supply", voltage_range_V: [3.3, 5.0] }],
      metadata: { logic_level_V: 3.3, logic_tolerant_V: 5.0, source: [SRC.datasheet, SRC.specs] },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 57.4, width: 49.8, height: 15.3 },
      weight_g: 23.0,
      metadata: {
        across_ears_mm: 61.1,
        body_mm: [50.0, 49.8, 13.3],
        ear_offset_mm: 2.0,
        bore: "1/2 in hex (shaft 12.7 mm AF; bore 12.8 mm AF on the drawing)",
        weights_g: { "1/2in hex": 23.0, "3/8in hex": 23.5, "5mm hex": 24.0, "1/4in round": 24.0 },
        max_rpm: 10000,
        source: [SRC.drawing, SRC.product, SRC.datasheet],
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "encoder",
        sensor: "Broadcom AEAT-8800-Q24 magnetic rotary encoder (hall effect), magnet geared to the bore",
        incremental: { cycles_per_rev: 2048, counts_per_rev: 8192, index_per_rev: 1, index_width_deg_e: 90 },
        absolute: { output: "pulse width (duty cycle)", period_us: 1025, frequency_Hz: 975.6, min_pulse_us: 1, max_pulse_us: 1024, resolution_bits: 10 },
        max_rpm: 10000,
        source: [SRC.datasheet, SRC.product, SRC.specs],
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "mode switch",
        note: "Side switch 'A' / 'S': A = ABI incremental + absolute outputs (the only supported mode); S = SSI/SPI (manufacturing / future), which puts +V, MISO, SEL, MOSI, CLK, GND on the connector. Keep it in A. FTC Control/Expansion Hubs read only the incremental output through motor encoder ports.",
        source: [SRC.datasheet, SRC.specs, SRC.product],
      },
    },
    {
      type: "data_gap",
      params: {
        fields: ["operating / storage temperature", "supply current", "connector pin-1 position", "output drive strength"],
        note: "Not stated in the REV sources read (product page, datasheet DS-06, drawing, docs).",
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "Through Bore Encoder V1 product page", type: "datasheet", url: SRC.product },
    { id: "art_datasheet", name: "REV-11-1271 datasheet", type: "datasheet", url: SRC.datasheet },
    { id: "art_drawing", name: "REV-11-1271 drawing", type: "datasheet", url: SRC.drawing },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): manufacturer STEP bound by
// library/cad/py/catalog/rev-through-bore-encoder-v1.py (no transform: bore
// axis Z through the origin, ear mounting faces at z = -2).
// ---------------------------------------------------------------------------

const F_CONN = vendorFeature("connector", { area_mm2: 575.185, centroid: [32.391, 0.0, 6.385] });
const onConn = { frame: { origin: [36.2, 0, 7.5] as [number, number, number], normal: [1, 0, 0] as [number, number, number] }, refs: [F_CONN, vendorOwn("connector")] };

export const REV_THROUGH_BORE_ENCODER_V1: ModuleDef = withGeometry(
  REV_THROUGH_BORE_ENCODER_V1_BASE,
  {
    // Ear bottom faces (z = -2); the structure approaches from -Z. xAxis toward
    // the outer end of the ear slot at (15.99, -19.73); the pair repeats every 180 deg.
    mount: {
      frame: { origin: [0, 0, -2], normal: [0, 0, -1], xAxis: [0.6297, -0.7768, 0], symmetryDeg: 180 },
      refs: [vendorFeature("mount", { area_mm2: 156.401, centroid: [0.0, 0.0, 0.5] }), vendorOwn("mount"), procedural("bolt_pattern")],
    },
    hex_bore: {
      frame: { origin: [0, 0, -2], normal: [0, 0, -1], xAxis: [1, 0, 0] },
      refs: [vendorFeature("hex_bore", { area_mm2: 288.363, centroid: [0.0, 0.0, 6.75] }), vendorOwn("hex_bore"), procedural("shaft")],
    },
    // JST-PH header at +X; the cable plugs in from +X
    vcc: onConn,
    gnd: onConn,
    enc_a: onConn,
    enc_b: onConn,
    enc_i: onConn,
    abs: onConn,
  },
  vendorCadArtifacts({
    partId: "rev-through-bore-encoder-v1",
    name: "REV-11-1271",
    url: SRC.cad,
    stepFile: "REV-11-1271.STEP",
    sha256: "acc7a6237c6583e84aab159a47eadb784e03969e6e8cd095ed5c99a4565159dd",
    licence: "not stated by REV Robotics; not redistributed",
    interfaces: ["mount", "hex_bore", "connector"],
  }),
);
