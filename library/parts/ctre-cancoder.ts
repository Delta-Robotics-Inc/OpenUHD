/**
 * CTR Electronics CANcoder magnetic absolute encoder, Standard (unwired)
 * variant, P/N 19-676768 — datasheet-honest UHD part.
 *
 * Sources (see ./ctre-cancoder/sources.json):
 *   - src_guide:     CANCoder User's Guide rev 1.4 (2023-02-13) — https://ctre.download/files/user-manual/CANCoder%20User's%20Guide.pdf
 *   - src_product:   CTRE CANcoder product page — https://store.ctr-electronics.com/products/cancoder
 *   - src_cad:       CTRE Cancoder_CAD.zip (Housing.STEP, PCB Assembly.STEP) — https://ctre.download/cad/Cancoder_CAD.zip
 *   - src_protopart: ProtoPart ctre-cancoder definition.json (community; starting point only)
 *
 * Modelling notes:
 *   - Variant lock: the Standard CANcoder (19-676768) ships without wires;
 *     the PCB has six 100 mil through-holes (GND, CANL x2, CANH x2, V+) and
 *     the user solders leads. Each hole is one leaf. The Wired (22-676768)
 *     and Wired with Molex SL (26-676768) variants have factory leads on the
 *     same holes and are NOT modelled here (usage_note).
 *   - Supply: 6-16 V, 12 V typical, 50 mA typ / 60 mA max at 12 V (guide
 *     1.3, product page). ProtoPart's 5-24 V / 100 mA is superseded
 *     (source_discrepancy).
 *   - CAN: no CAN builder exists, so `can_bus` is hand-rolled with the
 *     existing `can` protocol type. The composed `can_bus` takes role
 *     `transceiver`, the library convention (rev-spark-max,
 *     rev-power-distribution-hub, pjrc-teensy-4-1): `peer` is incompatible
 *     with `transceiver` in src/matching/roles.ts, so a `peer` bus would not
 *     link to those parts. The CAN_H/CAN_L leaves keep role `peer`
 *     (self-compatible: a differential bus has no direction). The two hole pairs are the two pigtails of a
 *     daisy chain: one profile each, max_instances 2. CAN 2.0 and CAN FD
 *     (product page); no bit rate is stated for the CANcoder (data_gap).
 *   - Mounting: 2 x Ø2.642 holes 14.884 mm apart, symmetric about the
 *     sensing axis (drawing), for the kit's 3-48 machine screws. BoltPattern
 *     has no line shape: modelled as shape "circle", 2 holes on Ø14.884,
 *     which places the holes exactly (assumption trait). The sensing axis
 *     is the pattern centre, so the frame origin is on the magnet axis.
 *   - The magnet (0.25 x 0.5 in diametric N42, in the kit) is not a
 *     mechanical coupling: there is no shaft interface; its placement
 *     (0.75-1.5 mm from the housing detent, within 0.25 mm of the axis) is a
 *     usage_note.
 *   - Geometry: vendor Housing.STEP bound by library/cad/py/catalog/ctre-cancoder.py
 *     (translated so the housing bottom is z = 0 and the sensing axis is the
 *     Z axis). Licence not stated: STEP not committed. The PCB STEP is in
 *     separate coordinates and is not bound.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { BoltPattern, Ground, PowerIn, connectorTrait, defineModule } from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, withGeometry } from "../cad/artifacts.js";

const SRC = {
  guide: "https://ctre.download/files/user-manual/CANCoder%20User's%20Guide.pdf",
  product: "https://store.ctr-electronics.com/products/cancoder",
  cad: "https://ctre.download/cad/Cancoder_CAD.zip",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/ctre-cancoder/definition.json",
} as const;

const pinFn = (description: string, source: string | string[] = SRC.guide): TraitDef => ({
  type: "pin_functions",
  params: { description, source },
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

const HOLE = connectorTrait("pcb_through_hole", {
  note: "100 mil plated through-hole on the CANcoder PCB (six in a row: GND, CANL x2, CANH x2, V+). Strip ~20 AWG wire (product page: 22 AWG minimum), pass it through, fill the hole with solder, trim the lead.",
});

// ---------------------------------------------------------------------------
// Supply
// ---------------------------------------------------------------------------

const vPlus = withTraits(PowerIn({ id: "v_plus", name: "V+ (12V)", pin: "V+", voltageV: [6, 16], nominalV: 12, maxCurrentA: 0.06 }), [
  pinFn("V+ supply through-hole (12V, red lead in the guide's wiring photo). 6.0-16.0 V, 12 V typical; 50 mA typical, 60 mA max at 12 V.", [SRC.guide, SRC.product]),
  HOLE,
  {
    type: "source_discrepancy",
    params: {
      field: "supply voltage / current",
      values: ["5-24 V, 12 V nominal, 100 mA max (ProtoPart)", "6.0-16.0 V, 12 V typ, 50 mA typ / 60 mA max at 12 V (CTRE guide 1.3 and product page)"],
      sources: [SRC.protopart, SRC.guide, SRC.product],
      resolution: "Manufacturer values used.",
    },
  },
]);

const gnd = withTraits(Ground({ id: "gnd", name: "GND", pin: "GND" }), [pinFn("GND through-hole (black lead in the guide's wiring photo)."), HOLE]);

// ---------------------------------------------------------------------------
// CAN (two through-hole pairs for two pigtails)
// ---------------------------------------------------------------------------

const canLeaf = (id: string, name: string, pin: string, cap: "can_h" | "can_l", text: string): InterfaceDef =>
  withTraits(
    {
      id,
      name,
      pin,
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "can", roles: ["peer"] }],
      capabilities: [cap],
    },
    [pinFn(text), HOLE],
  );

const canH1 = canLeaf("can_h_1", "CANH (1)", "CANH", "can_h", "CANH through-hole, first of two (yellow lead). The two CANH holes are the same net, for two CAN pigtails.");
const canH2 = canLeaf("can_h_2", "CANH (2)", "CANH", "can_h", "CANH through-hole, second of two (yellow lead). The two CANH holes are the same net, for two CAN pigtails.");
const canL1 = canLeaf("can_l_1", "CANL (1)", "CANL", "can_l", "CANL through-hole, first of two (green lead). The two CANL holes are the same net, for two CAN pigtails.");
const canL2 = canLeaf("can_l_2", "CANL (2)", "CANL", "can_l", "CANL through-hole, second of two (green lead). The two CANL holes are the same net, for two CAN pigtails.");

const canBus: InterfaceDef = {
  id: "can_bus",
  name: "CAN bus (two daisy-chain pigtails)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  // Composed bus uses role "transceiver" (library convention: rev-spark-max,
  // rev-power-distribution-hub, pjrc-teensy-4-1) so it links to their can_bus.
  protocols: [{ type: "can", roles: ["transceiver"] }],
  slots: [
    { id: "can_h", required: true, match: { protocol: "can", capability: "can_h" } },
    { id: "can_l", required: true, match: { protocol: "can", capability: "can_l" } },
  ],
  profiles: [
    { id: "pigtail_1", label: "CANH / CANL pair 1", default_active: true, bindings: { can_h: "can_h_1", can_l: "can_l_1" } },
    { id: "pigtail_2", label: "CANH / CANL pair 2", default_active: true, bindings: { can_h: "can_h_2", can_l: "can_l_2" } },
  ],
  max_instances: 2,
  traits: [
    {
      type: "usage_note",
      params: {
        note: "CAN 2.0 and CAN FD; Phoenix 6 / Phoenix Pro. The two CANH/CANL hole pairs are electrically common and allow a CAN pigtail in and out (daisy chain). The LED shows CAN health and magnet field strength (guide 1.6).",
        source: [SRC.guide, SRC.product],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Mechanical
// ---------------------------------------------------------------------------

const mount = withTraits(
  BoltPattern({
    id: "mount",
    name: "2 x 3-48 mounting holes, 14.884 mm",
    role: "component",
    shape: "circle",
    spacingMm: 14.884,
    holeCount: 2,
    fastener: "3-48 machine screw (kit)",
    fastenerDiameterMm: 2.515,
    threaded: false,
    note: "Two Ø2.642 mm holes 14.884 mm apart, symmetric about the sensing axis (drawing, bottom view); 2 x 3-48 machine screws are in the kit. The magnet axis is the pattern centre. The mounting surface should have a relative permeability near 1 (aluminium, most plastics); no centre hole is required.",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "bolt pattern shape / fastener diameter",
        value: "circle, 2 holes on Ø14.884; fastener Ø2.515 mm",
        reason: "Two holes on a line through the axis: BoltPattern has no line shape, and two holes on a Ø14.884 circle sit exactly 14.884 mm apart. The guide names 3-48 screws but no diameter; 2.515 mm (0.099 in) is the #3 major diameter.",
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "magnet placement",
        note: "Place the kit's 0.25 x 0.5 in diametrically polarised N42 magnet at the end of the rotating shaft, coaxial with the encoder: 0.75-1.5 mm (0.030-0.059 in) from the housing detent for a green LED (max 2.95 mm), axis within 0.25 mm of the housing centre. Glue it in a non-ferrous shaft; a tight press fit can crack it.",
        source: SRC.guide,
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const CTRE_CANCODER_BASE: ModuleDef = defineModule({
  id: "ctre-cancoder",
  name: "CTRE CANcoder (Standard)",
  version: "1.0.0",
  manufacturer: "CTR Electronics",
  part_number: "19-676768",
  description:
    "Magnetic rotary encoder on CAN: senses a diametrically polarised magnet on a shaft end (12-bit, 4096 CPR, up to 15000 RPM) and reports absolute and relative position and velocity over CAN 2.0 / CAN FD. 6-16 V supply, 50 mA typical. Standard variant: bare PCB with six through-holes (V+, GND, CANH x2, CANL x2) in a clear ABS housing, 21.7 x 26.9 mm, mounted with 2 x 3-48 screws 14.884 mm apart. -40 to +85 C.",
  tags: ["frc", "encoder", "absolute-encoder", "magnetic-encoder", "can", "can-fd", "ctre", "cancoder", "sensor"],
  categories: ["sensor", "sensor.encoder", "robotics.frc"],

  interfaces: [vPlus, gnd, canH1, canH2, canL1, canL2, canBus, mount],

  domains: [
    {
      domain: "electrical",
      power_domains: [{ id: "v_plus", name: "V+ supply", nominal_voltage_V: 12, voltage_range_V: [6, 16], max_current_mA: 60 }],
      metadata: { supply_current_typ_mA: 50, esd_kV: 30, source: [SRC.guide, SRC.product] },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 26.9, width: 21.7, height: 13.5 },
      metadata: {
        outline_note: "21.748 x 26.908 mm (drawing); 13.54 mm tall (vendor STEP).",
        housing: "clear ABS, closed with one 2-28 x 7/16 in screw",
        magnet: "0.250 x 0.500 in, N42 NdFeB, nickel plated, diametrical, 0.106 oz, 176 F max",
        source: [SRC.guide, SRC.cad],
      },
    },
    { domain: "thermal", operating_temperature_C: [-40, 85] },
    { domain: "network", metadata: { bus: "CAN 2.0 and CAN FD", source: SRC.product } },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "encoder",
        sensing: "magnetic, diametrically polarised magnet, 12-bit",
        counts_per_revolution: 4096,
        max_velocity_rpm: 15000,
        outputs: ["absolute position", "relative position", "velocity"],
        absolute_vs_relative_discrepancy_deg: { at_boot_still: 0.1, rotating_below_60_rpm: 1.44 },
        source: SRC.guide,
      },
    },
    {
      type: "operating_conditions",
      params: { ambient_temperature_C: [-40, 85], supply_voltage_V: [6, 16], supply_current_mA: { typ: 50, max: 60 }, source: SRC.guide },
    },
    {
      type: "usage_note",
      params: {
        topic: "variants",
        note: "Also sold as Wired (22-676768: red V+, black ground, yellow CAN high, green CAN low, 22 AWG, 12 in; CAN pairs end in 0.1 in 3-pin connectors, wires outside, no middle pin) and Wired with Molex SL (26-676768). Those variants have the same PCB with factory leads and are not modelled by this part.",
        source: SRC.product,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "errata",
        note: "Some Fall 2022 units have a housing bottom tab that is too long; see guide section 6.1 for the fix.",
        source: [SRC.product, SRC.guide],
      },
    },
    {
      type: "data_gap",
      params: { fields: ["CAN bit rate (not stated for the CANcoder)", "mass"], note: "Not stated in the CTRE guide or product page." },
    },
  ],

  artifacts: [
    { id: "art_guide", name: "CANCoder User's Guide", type: "datasheet", url: SRC.guide },
    { id: "art_product_page", name: "CTRE CANcoder product page", type: "documentation", url: SRC.product },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796), vendor Housing.STEP bound by library/cad/py/catalog/ctre-cancoder.py.
// After the script's transform: housing bottom at z = 0 (normal -Z, against
// the mechanism), sensing axis = Z axis, holes at ±(6.445, 3.721), lead exit
// at the tab (-Y).
// ---------------------------------------------------------------------------

const WIRE_EXIT = vendorFeature("wire_exit", { area_mm2: 320.949, centroid: [0.0, -15.653, 6.983] });

export const CTRE_CANCODER: ModuleDef = withGeometry(
  CTRE_CANCODER_BASE,
  {
    // Origin on the sensing axis; xAxis toward hole (6.445, 3.721); the
    // 2-hole pattern repeats every 180 deg about the axis.
    mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [0.866, 0.5, 0], symmetryDeg: 180 },
      refs: [vendorFeature("mount", { area_mm2: 21.079, centroid: [0.0, 0.0, 0.635] }), vendorFeature("magnet_detent", { area_mm2: 13.428, centroid: [0.0, 0.0, 0.317] }), procedural("bolt_pattern")],
    },
    v_plus: { refs: [WIRE_EXIT] },
    gnd: { refs: [WIRE_EXIT] },
    can_h_1: { refs: [WIRE_EXIT] },
    can_h_2: { refs: [WIRE_EXIT] },
    can_l_1: { refs: [WIRE_EXIT] },
    can_l_2: { refs: [WIRE_EXIT] },
    can_bus: { refs: [WIRE_EXIT] },
  },
  vendorCadArtifacts({
    partId: "ctre-cancoder",
    name: "CANcoder_Housing",
    url: SRC.cad,
    stepFile: "Housing.STEP",
    sha256: "d31b87eee288beee2a2b46984844b640082c986fb71e44baeea1dee74fb36845",
    licence: "not stated by CTR Electronics; not redistributed",
  }),
);
