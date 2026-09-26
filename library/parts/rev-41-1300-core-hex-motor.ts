/**
 * REV Robotics Core Hex Motor (REV-41-1300) — datasheet-honest UHD part.
 *
 * Sources (see ./rev-41-1300-core-hex-motor/sources.json):
 *   - src_product:      REV product page — https://www.revrobotics.com/rev-41-1300/
 *   - src_docs:         REV docs, Core Hex Motor — https://docs.revrobotics.com/duo-build/motion/motors/core-hex-motor
 *   - src_encoder_docs: REV docs, REV Motor Encoders — https://docs.revrobotics.com/duo-control/sensors/encoders/motor-based-encoders
 *   - src_pinout:       REV motor power / encoder pinout image (gitbook SVG on the docs page)
 *   - src_drawing:      REV-41-1300-DR-00 drawing — https://www.revrobotics.com/content/docs/REV-41-1300-DR.pdf
 *   - src_cad:          REV-41-1300 STEP — https://www.revrobotics.com/content/cad/REV-41-1300.STEP
 *   - src_ip_policy:    REV IP Policy — https://www.revrobotics.com/ip-policy/
 *   - src_protopart:    ProtoPart rev-41-1300-core-hex-motor definition.json (community; starting point only)
 *
 * Modelling notes:
 *   - Brushed DC gearmotor (72:1) with a 90 degree output and a built-in
 *     magnetic quadrature encoder.
 *   - Motor power: 2-pin JST-VH, M- / M+ (pinout image, drawn order). Leaves
 *     are power inputs with capability motor_in, composed into `motor_power`
 *     (the brushed-DC convention of sparkfun-rob-28633 / ctre-talon-srx).
 *     12 V DC rated; stall current 4.4 A is a stall figure, recorded as the
 *     `stall_current` parameter rather than a continuous max_current (no
 *     continuous rating is published: data_gap). ProtoPart's 5 A max is not
 *     in any REV source (source_discrepancy).
 *   - Encoder: 4-pin JST-PH, drawn order Ch B, Ch A, 3.3V, GND (pinout
 *     image; pin 1 is not marked, so no numbers are assigned). REV: "compatible
 *     with 5V or 3.3V logic level devices". The supply pin is labelled 3.3V;
 *     the 3.3-5 V supply range is an assumption from that statement. 4 counts
 *     per motor revolution, 288 per output revolution.
 *   - Output: `hex_bore` is a Shaft (output) for the 5 mm FEMALE hex: a
 *     5 mm hex shaft is inserted into or through the motor. shaft_diameter
 *     is the 5 mm across-flats size.
 *   - Mounting: two faces, each with six Ø2.46 holes on a Ø16 circle around
 *     the output (drawing), the two faces clocked 30 deg apart (REV docs and
 *     STEP). The holes are read as M3 tapped (Ø2.46 is an M3 tap drill; REV
 *     DUO uses M3 hardware): assumption trait.
 *   - Thermal: no operating temperature in any REV source (data_gap); verify's
 *     thermal coverage warning is expected.
 *   - Geometry: vendor STEP bound by library/cad/py/catalog/rev-41-1300-core-hex-motor.py
 *     (no transform: output axis = Z at the origin). No licence at the STEP
 *     link; REV's IP Policy (src_ip_policy) allows non-commercial use per CC
 *     BY-NC-SA 4.0 and needs a licence for commercial use:
 *     STEP not committed. The connectors are not modelled separately in the
 *     STEP; power and encoder interfaces ref the rear end cap.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { BoltPattern, Ground, PowerIn, Shaft, connectorTrait, defineModule, voltageV } from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://www.revrobotics.com/rev-41-1300/",
  docs: "https://docs.revrobotics.com/duo-build/motion/motors/core-hex-motor",
  encoderDocs: "https://docs.revrobotics.com/duo-control/sensors/encoders/motor-based-encoders",
  pinout:
    "https://756878072-files.gitbook.io/~/files/v0/b/gitbook-legacy-files/o/assets%2F-M5yw0n8IneF5-9ybLjT%2F-M_M8cPZpdT88Tye8xPn%2F-M_MCcUszaBq8eeo9Rmp%2FHD%20Hex%20Motor_Encoder%20Pinout1_Export.svg?alt=media&token=b7cf4b6d-d8aa-407c-bf6d-609253e815cf",
  drawing: "https://www.revrobotics.com/content/docs/REV-41-1300-DR.pdf",
  cad: "https://www.revrobotics.com/content/cad/REV-41-1300.STEP",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/rev-41-1300-core-hex-motor/definition.json",
} as const;

const pinFn = (description: string, source: string | string[] = [SRC.pinout, SRC.docs]): TraitDef => ({
  type: "pin_functions",
  params: { description, source },
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

const JST_VH_2 = connectorTrait("jst_vh_2", {
  positions: 2,
  pinout: ["M -", "M +"],
  note: "2-pin JST-VH motor power connector (REV docs). Pinout in the order REV's pinout image draws it (M - black, M + red); pin 1 is not marked. A 2-wire power cable (Expansion Hub compatible) is included.",
});

const JST_PH_4 = connectorTrait("jst_ph_4", {
  positions: 4,
  pinout: ["Ch B", "Ch A", "3.3V", "GND"],
  note: "4-pin JST-PH encoder connector (REV docs). Pinout in the order REV's pinout image draws it (Ch B blue, Ch A white, 3.3V red, GND black); pin 1 is not marked. A 4-wire sensor cable (Expansion Hub compatible) is included.",
});

// ---------------------------------------------------------------------------
// Motor power (JST-VH 2)
// ---------------------------------------------------------------------------

const motorLeaf = (id: string, name: string, pin: string, text: string): InterfaceDef =>
  withTraits(
    { id, name, pin, domain: "electrical", exposed: true, default_active: true, protocols: [{ type: "power", roles: ["input"] }], capabilities: ["motor_in"] },
    [pinFn(text), JST_VH_2],
  );

const motorNeg = motorLeaf("motor_neg", "M -", "M -", "Motor power M - (JST-VH, black in REV's pinout image).");
const motorPos = motorLeaf("motor_pos", "M +", "M +", "Motor power M + (JST-VH, red in REV's pinout image).");

const motorPower: InterfaceDef = {
  id: "motor_power",
  name: "Motor power (JST-VH 2)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "power", roles: ["input"] }],
  parameters: [voltageV(12), { id: "stall_current", name: "Stall current", unit: "A", value: 4.4 }],
  slots: [
    { id: "motor_pos", required: true, match: { protocol: "power", role: "input", capability: "motor_in" } },
    { id: "motor_neg", required: true, match: { protocol: "power", role: "input", capability: "motor_in" } },
  ],
  profiles: [{ id: "jst_vh", label: "JST-VH M+ / M-", default_active: true, bindings: { motor_pos: "motor_pos", motor_neg: "motor_neg" } }],
  max_instances: 1,
  traits: [
    {
      type: "source_discrepancy",
      params: {
        field: "motor current",
        values: ["5 A max (ProtoPart power domain)", "stall current 4.4 A at 12 V (REV product page and docs); no continuous rating"],
        sources: [SRC.protopart, SRC.product, SRC.docs],
        resolution: "REV value used, as a stall figure.",
      },
    },
    {
      type: "usage_note",
      params: { note: "Brushed DC motor, 12 V DC. Plugs into a REV Control Hub / Expansion Hub motor port with the included 2-wire cable. Swapping M+ and M- reverses rotation.", source: [SRC.product, SRC.docs] },
    },
  ],
};

// ---------------------------------------------------------------------------
// Encoder (JST-PH 4)
// ---------------------------------------------------------------------------

const encLeaf = (id: string, name: string, pin: string, cap: string, text: string): InterfaceDef =>
  withTraits(
    { id, name, pin, domain: "electrical", exposed: true, default_active: true, protocols: [{ type: "digital", roles: ["output"] }], capabilities: [cap] },
    [pinFn(text), JST_PH_4],
  );

const encB = encLeaf("enc_b", "Ch B", "Ch B", "quadrature_b", "Encoder channel B output (JST-PH, blue in REV's pinout image).");
const encA = encLeaf("enc_a", "Ch A", "Ch A", "quadrature_a", "Encoder channel A output (JST-PH, white in REV's pinout image).");
const encVcc = withTraits(
  { ...PowerIn({ id: "enc_vcc", name: "3.3V", pin: "3.3V", voltageV: [3.3, 5], nominalV: 3.3 }), capabilities: ["encoder_vcc"] },
  [
    pinFn("Encoder supply, labelled 3.3V (JST-PH, red in REV's pinout image)."),
    JST_PH_4,
    {
      type: "assumption",
      params: {
        field: "encoder supply voltage range",
        value: "3.3-5 V",
        reason: "REV labels the pin 3.3V and states the encoder is compatible with 5V or 3.3V logic level devices (Control Hub / Expansion Hub); no supply range or current is published.",
        source: [SRC.pinout, SRC.product],
      },
    },
  ],
);
const encGnd = withTraits(Ground({ id: "enc_gnd", name: "GND", pin: "GND" }), [pinFn("Encoder ground (JST-PH, black in REV's pinout image)."), JST_PH_4]);

const encoder: InterfaceDef = {
  id: "encoder",
  name: "Quadrature encoder (JST-PH 4)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "custom", roles: ["output"] }],
  slots: [
    { id: "vcc", required: true, match: { protocol: "power", role: "input", capability: "encoder_vcc" } },
    { id: "gnd", required: true, match: { protocol: "power", role: "ground", capability: "ground" } },
    { id: "a", required: true, match: { protocol: "digital", role: "output", capability: "quadrature_a" } },
    { id: "b", required: true, match: { protocol: "digital", role: "output", capability: "quadrature_b" } },
  ],
  profiles: [{ id: "jst_ph", label: "JST-PH Ch B / Ch A / 3.3V / GND", default_active: true, bindings: { vcc: "enc_vcc", gnd: "enc_gnd", a: "enc_a", b: "enc_b" } }],
  max_instances: 1,
  traits: [
    {
      type: "usage_note",
      params: {
        note: "Built-in magnetic quadrature encoder: 4 counts per motor revolution (1 rise of channel A), 288 counts per output revolution (72 rises of channel A). Compatible with 5V or 3.3V logic level devices including the REV Control Hub (REV-31-1595) and Expansion Hub (REV-31-1153); the included 4-wire sensor cable fits the hub.",
        source: [SRC.product, SRC.encoderDocs],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Mechanical
// ---------------------------------------------------------------------------

const hexBore = Shaft({
  id: "hex_bore",
  name: "5 mm female hex output",
  role: "output",
  diameterMm: 5,
  note: "5 mm FEMALE hex output (a bore, not a shaft): insert any REV 5 mm hex shaft into or through the motor to make a custom-length output shaft. 90 degree output. shaft_diameter is the 5 mm across-flats size.",
});

const motionPattern = (id: string, name: string, note: string): InterfaceDef =>
  withTraits(
    BoltPattern({
      id,
      name,
      role: "component",
      shape: "circle",
      spacingMm: 16,
      holeCount: 6,
      fastener: "M3",
      fastenerDiameterMm: 3,
      threaded: true,
      note,
    }),
    [
      {
        type: "assumption",
        params: {
          field: "fastener / threaded",
          value: "M3, tapped",
          reason: "The drawing gives Ø2.46 mm holes on a Ø16 circle but no thread callout; Ø2.46 mm is an M3 tap-drill size and the REV DUO system uses M3 hardware.",
          source: SRC.drawing,
        },
      },
    ],
  );

const mountA = motionPattern(
  "mount_a",
  "Face A motion pattern (6 x Ø2.46 on Ø16)",
  "Face A (the face at z = +16.25 in the STEP): six Ø2.46 mm holes on a Ø16 mm circle around the output (drawing), at 0/60/120... deg. REV: two mounting faces, the Motion Pattern clocked differently on each, giving twelve motor angles.",
);
const mountB = motionPattern(
  "mount_b",
  "Face B motion pattern (6 x Ø2.46 on Ø16)",
  "Face B (the face at z = -18.25 in the STEP): six Ø2.46 mm holes on a Ø16 mm circle around the output, clocked 30 deg from face A (STEP).",
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const REV_41_1300_BASE: ModuleDef = defineModule({
  id: "rev-41-1300-core-hex-motor",
  name: "REV Core Hex Motor (REV-41-1300)",
  version: "1.0.0",
  manufacturer: "REV Robotics",
  part_number: "REV-41-1300",
  description:
    "12 V brushed DC gearmotor (72:1, 125 RPM free, 3.2 N-m stall torque, 4.4 A stall) with a 90 degree 5 mm female hex output and a built-in magnetic quadrature encoder (288 counts per output revolution, 3.3 V / 5 V logic). JST-VH 2 motor power and JST-PH 4 encoder connectors. Two mounting faces with six-hole Ø16 mm Motion Patterns clocked 30 deg apart. 95.7 x 36.5 x 34.5 mm, 7 oz. REV DUO / FTC.",
  tags: ["rev", "motor", "dc-motor", "brushed", "gearmotor", "encoder", "hex-bore", "5mm-hex", "ftc", "duo"],
  categories: ["motor", "actuator.motor.dc_motor", "robotics.ftc"],

  interfaces: [motorNeg, motorPos, motorPower, encB, encA, encVcc, encGnd, encoder, hexBore, mountA, mountB],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "motor_power", name: "Motor power", nominal_voltage_V: 12 },
        { id: "enc_vcc", name: "Encoder supply", nominal_voltage_V: 3.3, voltage_range_V: [3.3, 5] },
      ],
      metadata: { stall_current_A: 4.4, source: [SRC.product, SRC.docs] },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 95.72, width: 36.47, height: 34.5 },
      weight_g: 198.4,
      metadata: {
        weight_note: "7 oz (198.4 g) as stated.",
        output: "5 mm female hex, 90 degree",
        output_axis_to_end_mm: 16.48,
        motion_pattern: "6 x Ø2.46 on Ø16 mm per face; faces clocked 30 deg apart",
        source: [SRC.product, SRC.drawing, SRC.cad],
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "motor",
        motor_type: "brushed DC gearmotor",
        nominal_voltage_V: 12,
        gear_ratio: "72:1",
        free_speed_rpm: 125,
        stall_torque_Nm: 3.2,
        stall_current_A: 4.4,
        encoder_counts_per_motor_rev: 4,
        encoder_counts_per_output_rev: 288,
        note: "REV recommends the Core Hex for lighter-duty arms and intakes.",
        source: [SRC.product, SRC.docs, SRC.encoderDocs],
      },
    },
    {
      type: "usage_note",
      params: { topic: "kit contents", note: "Core Hex Motor with built-in encoder, 4-wire sensor cable and 2-wire power cable (Expansion Hub compatible).", source: SRC.product },
    },
    {
      type: "data_gap",
      params: {
        fields: ["continuous current rating", "free-running current", "encoder supply current", "connector pin 1 / numbering", "operating temperature"],
        note: "Not stated in REV's product page, docs or drawing.",
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "REV Core Hex Motor product page", type: "documentation", url: SRC.product },
    { id: "art_docs", name: "REV docs: Core Hex Motor", type: "documentation", url: SRC.docs },
    { id: "art_encoder_docs", name: "REV docs: REV Motor Encoders", type: "documentation", url: SRC.encoderDocs },
    { id: "art_drawing", name: "REV-41-1300 drawing", type: "documentation", url: SRC.drawing },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796), vendor STEP bound by library/cad/py/catalog/rev-41-1300-core-hex-motor.py.
// Output axis = Z at the origin; face A z = +16.25 (normal +Z), face B
// z = -18.25 (normal -Z); motor body toward -X; connectors at the rear end.
// ---------------------------------------------------------------------------

const REAR_END = vendorFeature("rear_end", { area_mm2: 484.421, centroid: [-79.245, 3.134, -1.0] });

export const REV_41_1300_CORE_HEX_MOTOR: ModuleDef = withGeometry(
  REV_41_1300_BASE,
  {
    // xAxis toward hole 1 at (8, 0); the six-hole pattern repeats every 60 deg.
    mount_a: {
      frame: { origin: [0, 0, 16.25], normal: [0, 0, 1], xAxis: [1, 0, 0], symmetryDeg: 60 },
      refs: [vendorFeature("mount_a", { area_mm2: 252.716, centroid: [0.0, 0.0, 13.525] }), vendorFeature("face_a", { area_mm2: 1637.672, centroid: [-27.388, 1.966, 16.25], normal: [0.0, 0.0, 1.0] }), vendorOwn("mount_a"), procedural("bolt_pattern")],
    },
    // xAxis toward hole 1 at (0, 8): face B is clocked 30 deg from face A.
    mount_b: {
      frame: { origin: [0, 0, -18.25], normal: [0, 0, -1], xAxis: [0, 1, 0], symmetryDeg: 60 },
      refs: [vendorFeature("mount_b", { area_mm2: 252.716, centroid: [0.0, 0.0, -15.525] }), vendorFeature("face_b", { area_mm2: 1650.593, centroid: [-27.197, 2.074, -18.25], normal: [0.0, 0.0, -1.0] }), vendorOwn("mount_b"), procedural("bolt_pattern")],
    },
    // The bore runs through; the frame is at the face A end, pointing out.
    hex_bore: {
      frame: { origin: [0, 0, 16.35], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      refs: [vendorFeature("hex_bore", { area_mm2: 588.897, centroid: [0.0, 0.0, -0.65] }), procedural("shaft")],
    },
    motor_power: { refs: [REAR_END] },
    motor_pos: { refs: [REAR_END] },
    motor_neg: { refs: [REAR_END] },
    encoder: { refs: [REAR_END] },
    enc_a: { refs: [REAR_END] },
    enc_b: { refs: [REAR_END] },
    enc_vcc: { refs: [REAR_END] },
    enc_gnd: { refs: [REAR_END] },
  },
  vendorCadArtifacts({
    partId: "rev-41-1300-core-hex-motor",
    name: "REV-41-1300",
    url: SRC.cad,
    stepFile: "REV-41-1300.STEP",
    sha256: "0c3c08c954263d01a50caed13f2cda78e495c42caff0e08c81d64de0687970f3",
    licence: "no licence at the STEP link; REV IP Policy allows non-commercial use per CC BY-NC-SA 4.0, commercial use needs a REV licence; not redistributed",
    interfaces: ["mount_a", "mount_b"],
  }),
);
