/**
 * CTR Electronics Pigeon 2.0 IMU (SKU 21-737785) — datasheet-honest UHD part.
 *
 * Sources (see ./ctre-pigeon-2/sources.json):
 *   - src_guide:     Pigeon 2.0 User's Guide rev 1.2 (2023-02-13) — https://ctre.download/files/user-manual/Pigeon2%20User's%20Guide.pdf
 *   - src_product:   CTRE Pigeon 2.0 product page — https://store.ctr-electronics.com/products/pigeon-2
 *   - src_cad:       CTRE Device-CADs PIGEON_2_CAD/Pigeon 2.zip — https://github.com/CrossTheRoadElec/Device-CADs/raw/master/PIGEON_2_CAD/Pigeon%202.zip
 *   - src_protopart: ProtoPart ctre-pigeon-2 definition.json (community; starting point only)
 *
 * Modelling notes:
 *   - Leads: the IMU ships with one 22 AWG power lead pair (red Vdd, black
 *     ground) and two 22 AWG CAN lead pairs, each ending in a 3-pin 0.1 in
 *     connector, one female and one male (daisy chain). One leaf per lead
 *     (the two yellow and the two green wires are electrically common);
 *     `can_bus` has one profile per CAN lead pair, max_instances 2.
 *   - Supply: 6-28 V, 12 V typical; 40 mA typ / 46 mA max at 12 V, 21/23 mA
 *     at 28 V; reverse input power protection. ProtoPart's 5-24 V / 100 mA is
 *     superseded (source_discrepancy).
 *   - CAN: no CAN builder exists, so `can_bus` is hand-rolled with the
 *     existing `can` protocol type. The composed `can_bus` uses role
 *     `transceiver`, the library convention (rev-spark-max,
 *     rev-power-distribution-hub, pjrc-teensy-4-1), so it links to their
 *     `can_bus`; `peer` <-> `transceiver` is incompatible in
 *     src/matching/roles.ts. The CAN_H/CAN_L leaves keep role `peer`
 *     (self-compatible, differential bus lines). CAN 2.0 at 1 Mbit/s; CAN FD
 *     with a CANivore.
 *   - The connector pin order inside the 3-pin housings is not stated for
 *     the Pigeon 2.0 (data_gap); CTRE's CANcoder page describes the same
 *     style as "wires to outside, no middle pin", not assumed here.
 *   - Mounting: two Ø3.26 through holes with Ø4.83 counterbores (screw
 *     heads on top), on diagonal corners of a 28.96 mm square (drawing; the
 *     STEP puts them at (-14.478, 14.478) and (14.478, -14.478)). Modelled as
 *     BoltPattern shape "circle", 2 holes on the Ø40.95 diagonal, which
 *     places both holes exactly (assumption trait). No fastener is named:
 *     fastener diameter is the range #4 (2.845 mm) to M3 (assumption).
 *   - Orientation: +X forward, +Y left, +Z up by default (the XYZ logo on the
 *     enclosure). The frame has no symmetryDeg: rotating the IMU changes its
 *     mount-orientation configuration.
 *   - Geometry: vendor STEP bound by library/cad/py/catalog/ctre-pigeon-2.py
 *     (raised so the housing bottom is z = 0). The Device-CADs repository has
 *     no licence: STEP not committed.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { BoltPattern, Ground, PowerIn, baudRate, connectorTrait, defineModule } from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  guide: "https://ctre.download/files/user-manual/Pigeon2%20User's%20Guide.pdf",
  product: "https://store.ctr-electronics.com/products/pigeon-2",
  cad: "https://github.com/CrossTheRoadElec/Device-CADs/raw/master/PIGEON_2_CAD/Pigeon%202.zip",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/ctre-pigeon-2/definition.json",
} as const;

const pinFn = (description: string, source: string | string[] = SRC.guide): TraitDef => ({
  type: "pin_functions",
  params: { description, source },
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

const POWER_LEAD = connectorTrait("bare_wire_lead", {
  note: "22 AWG power lead pair (red Vdd, black ground), pre-installed. Termination and length not stated.",
});
const canLead = (gender: "female" | "male") =>
  connectorTrait("3pin_0.1in", {
    gender,
    positions: 3,
    note: `22 AWG CAN lead pair (yellow CANH, green CANL) ending in a pre-installed 3-pin 0.1 in pitch connector, ${gender}. One pair has a female, the other a male connector, so CTRE CAN devices daisy-chain. Pin order in the housing not stated.`,
  });

// ---------------------------------------------------------------------------
// Supply
// ---------------------------------------------------------------------------

const vdd = withTraits(PowerIn({ id: "vdd", name: "Vdd (red)", pin: "Vdd", voltageV: [6, 28], nominalV: 12, maxCurrentA: 0.046 }), [
  pinFn("Red lead: Vdd. 6.0-28.0 V, 12 V typical; 40 mA typ / 46 mA max at 12 V, 21 mA typ / 23 mA max at 28 V. Reverse input power protection.", [SRC.guide, SRC.product]),
  POWER_LEAD,
  {
    type: "source_discrepancy",
    params: {
      field: "supply voltage / current",
      values: ["5-24 V, 12 V nominal, 100 mA max (ProtoPart)", "6.0-28.0 V, 12 V typ, 40 mA typ / 46 mA max at 12 V (CTRE guide 1.3 and product page)"],
      sources: [SRC.protopart, SRC.guide, SRC.product],
      resolution: "Manufacturer values used.",
    },
  },
]);

const gnd = withTraits(Ground({ id: "gnd", name: "Ground (black)", pin: "GND" }), [pinFn("Black lead: ground."), POWER_LEAD]);

// ---------------------------------------------------------------------------
// CAN (two lead pairs: female and male 3-pin connectors)
// ---------------------------------------------------------------------------

const canLeaf = (id: string, name: string, pin: string, cap: "can_h" | "can_l", gender: "female" | "male", text: string): InterfaceDef =>
  withTraits(
    { id, name, pin, domain: "electrical", exposed: true, default_active: true, protocols: [{ type: "can", roles: ["peer"] }], capabilities: [cap] },
    [pinFn(text), canLead(gender)],
  );

const canH1 = canLeaf("can_h_1", "CANH (yellow, female-connector pair)", "CANH", "can_h", "female", "Yellow lead: CANH (female-connector pair). The two yellow wires are electrically common.");
const canL1 = canLeaf("can_l_1", "CANL (green, female-connector pair)", "CANL", "can_l", "female", "Green lead: CANL (female-connector pair). The two green wires are electrically common.");
const canH2 = canLeaf("can_h_2", "CANH (yellow, male-connector pair)", "CANH", "can_h", "male", "Yellow lead: CANH (male-connector pair). The two yellow wires are electrically common.");
const canL2 = canLeaf("can_l_2", "CANL (green, male-connector pair)", "CANL", "can_l", "male", "Green lead: CANL (male-connector pair). The two green wires are electrically common.");

const canBus: InterfaceDef = {
  id: "can_bus",
  name: "CAN bus (female and male lead pairs)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "can", roles: ["transceiver"] }],
  parameters: [baudRate(1_000_000)],
  slots: [
    { id: "can_h", required: true, match: { protocol: "can", capability: "can_h" } },
    { id: "can_l", required: true, match: { protocol: "can", capability: "can_l" } },
  ],
  profiles: [
    { id: "female_pair", label: "CAN lead pair with female 3-pin connector", default_active: true, bindings: { can_h: "can_h_1", can_l: "can_l_1" } },
    { id: "male_pair", label: "CAN lead pair with male 3-pin connector", default_active: true, bindings: { can_h: "can_h_2", can_l: "can_l_2" } },
  ],
  max_instances: 2,
  traits: [
    {
      type: "usage_note",
      params: {
        note: "CAN 2.0 at 1 Mbit/s; CAN FD with a CANivore (roboRIO and CANivore supported). Phoenix 6 / Phoenix Pro, Phoenix Tuner (wireless via roboRIO). Two tri-colour LEDs show CAN health (guide 1.5).",
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
    name: "2 diagonal mounting holes on a 28.96 mm square",
    role: "component",
    shape: "circle",
    spacingMm: 40.95,
    holeCount: 2,
    fastener: "not named (Ø3.26 hole: #4 or M3)",
    fastenerDiameterMm: [2.845, 3.0],
    threaded: false,
    note: "Two Ø3.26 mm through holes with Ø4.83 mm counterbores on top, at diagonal corners of a 28.96 x 28.96 mm square (drawing), i.e. 40.95 mm apart on the diagonal. The other two corners hold the housing screws. Mount the IMU near the centre of rotation, away from magnetic/ferromagnetic material; any orientation is allowed if configured (guide 2, 6).",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "bolt pattern shape",
        value: "circle, 2 holes, Ø40.95 (28.96 mm square diagonal)",
        reason: "Only two diagonal corners of the 28.96 mm square are mounting holes; BoltPattern has no two-hole shape, and two holes on a Ø40.95 circle through the centre sit exactly on those corners.",
      },
    },
    {
      type: "assumption",
      params: {
        field: "fastener diameter",
        value: "2.845-3.0 mm (#4 to M3)",
        reason: "CTRE names no screw; the Ø3.26 mm (0.1285 in) through hole clears a #4 (2.845 mm) or M3 screw.",
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const CTRE_PIGEON_2_BASE: ModuleDef = defineModule({
  id: "ctre-pigeon-2",
  name: "CTRE Pigeon 2.0 IMU",
  version: "1.0.0",
  manufacturer: "CTR Electronics",
  part_number: "21-737785",
  description:
    "9-axis IMU (3-axis gyroscope, accelerometer, magnetometer) with on-board Kalman fusion giving yaw, pitch, roll, quaternion and gravity vector over CAN 2.0 (1 Mbit/s) or CAN FD (CANivore). No boot calibration; gyro re-biases after 4 s of stillness. 6-28 V, 40 mA at 12 V, reverse input protection. Polycarbonate housing 44.96 x 44.96 x 12.95 mm, 30.39 g with leads; one power lead pair and two CAN lead pairs with female and male 3-pin connectors. -40 to +85 C.",
  tags: ["frc", "imu", "gyro", "accelerometer", "magnetometer", "ahrs", "can", "can-fd", "ctre", "pigeon", "sensor"],
  categories: ["sensor", "sensor.imu", "robotics.frc"],

  interfaces: [vdd, gnd, canH1, canL1, canH2, canL2, canBus, mount],

  domains: [
    {
      domain: "electrical",
      power_domains: [{ id: "vdd", name: "Vdd supply", nominal_voltage_V: 12, voltage_range_V: [6, 28], max_current_mA: 46 }],
      metadata: {
        supply_current_mA: { at_12V: { typ: 40, max: 46 }, at_28V: { typ: 21, max: 23 } },
        reverse_input_protection: true,
        esd_kV: 30,
        source: [SRC.guide, SRC.product],
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 44.96, width: 44.96, height: 12.95 },
      weight_g: 30.39,
      metadata: {
        weight_note: "1.07 oz (30.39 g) with enclosure and wires (guide 1.4).",
        enclosure: "polycarbonate",
        shock: "10,000 g (200 us), 2,000 g (1 ms); 5 ft free fall",
        axes: "+X forward, +Y left, +Z up (XYZ logo on the enclosure)",
        source: [SRC.guide, SRC.product],
      },
    },
    { domain: "thermal", operating_temperature_C: [-40, 85] },
    { domain: "network", metadata: { bus: "CAN 2.0 (1 Mbit/s); CAN FD with CANivore", source: SRC.guide } },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "imu",
        axes: 9,
        gyro_range_dps: [125, 2000],
        gyro_range_selected_dps: 1000,
        gyro_resolution_bits: 16,
        accel_range_g: 8,
        accel_resolution_bits: 16,
        magnetometer_range_uT: 1150,
        magnetometer_resolution_uT: 0.3,
        compass_accuracy_deg: 1,
        yaw_drift: { no_motion_deg_per_h: 0.12, in_motion_deg_per_min: 0.4, boot_into_motion_deg_per_min: 1 },
        outputs: ["yaw", "pitch", "roll", "quaternion", "gravity vector", "raw gyro/accel/magnetometer"],
        note: "Firmware currently selects ±1000 dps. Raw sensor signals are enclosure-oriented; fused outputs follow the configured mount orientation.",
        source: [SRC.guide, SRC.product],
      },
    },
    {
      type: "operating_conditions",
      params: { ambient_temperature_C: [-40, 85], supply_voltage_V: [6, 28], source: SRC.guide },
    },
    {
      type: "data_gap",
      params: {
        fields: ["lead lengths", "3-pin connector pin order", "power lead termination"],
        note: "The Pigeon 2.0 guide and product page do not state them.",
      },
    },
  ],

  artifacts: [
    { id: "art_guide", name: "Pigeon 2.0 User's Guide", type: "datasheet", url: SRC.guide },
    { id: "art_product_page", name: "CTRE Pigeon 2.0 product page", type: "documentation", url: SRC.product },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796), vendor STEP bound by library/cad/py/catalog/ctre-pigeon-2.py.
// After the transform: housing bottom at z = 0 (normal -Z), holes at
// (-14.478, 14.478) and (14.478, -14.478), leads leave the boss at +Y.
// ---------------------------------------------------------------------------

const LEAD_EXIT = vendorFeature("lead_exit", { area_mm2: 129.535, centroid: [-0.436, 23.455, 5.842] });

export const CTRE_PIGEON_2: ModuleDef = withGeometry(
  CTRE_PIGEON_2_BASE,
  {
    // Origin at the housing centre on the bottom face; xAxis toward hole (14.478, -14.478).
    mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [0.7071, -0.7071, 0] },
      refs: [vendorFeature("mount", { area_mm2: 187.522, centroid: [0.0, 0.0, 4.826] }), vendorOwn("mount"), procedural("bolt_pattern")],
    },
    vdd: { refs: [LEAD_EXIT] },
    gnd: { refs: [LEAD_EXIT] },
    can_h_1: { refs: [LEAD_EXIT] },
    can_l_1: { refs: [LEAD_EXIT] },
    can_h_2: { refs: [LEAD_EXIT] },
    can_l_2: { refs: [LEAD_EXIT] },
    can_bus: { refs: [LEAD_EXIT] },
  },
  vendorCadArtifacts({
    partId: "ctre-pigeon-2",
    name: "Pigeon_2",
    url: SRC.cad,
    stepFile: "Pigeon 2.STEP",
    sha256: "5d5793e152ffd5ecf6e8fe339cc16cc1818af33c5391147177e633a8f7e4e9d3",
    licence: "not stated (Device-CADs repository has no licence); not redistributed",
    interfaces: ["mount"],
  }),
);
