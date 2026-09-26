/**
 * REV Robotics NEO Brushless Motor V1.1 (REV-21-1650) — datasheet-honest UHD part.
 *
 * Sources (see ./rev-neo-brushless-v1-1/sources.json):
 *   - src_product:      REV-21-1650 product page — https://www.revrobotics.com/rev-21-1650/
 *   - src_docs:         NEO V1.1 user guide — https://docs.revrobotics.com/brushless/neo/v1.1
 *   - src_datasheet:    NEO data sheet REV-21-1650-DS-01 — https://www.revrobotics.com/content/docs/REV-21-1650-DS.pdf
 *   - src_drawing:      REV-21-1650 V1.1 drawing — https://revrobotics.com/content/docs/REV-21-1650-V1.1-DR.pdf
 *   - src_encoder_port: SPARK MAX Encoder Port (the port the sensor cable plugs into) — https://docs.revrobotics.com/brushless/spark-max/specs/encoder-port
 *   - src_wiring:       Wiring the SPARK MAX — https://docs.revrobotics.com/brushless/spark-max/gs/wiring
 *   - src_spark_max_specs: SPARK MAX Specifications (encoder-port 5 V supply) — https://docs.revrobotics.com/brushless/spark-max/specs
 *   - src_cad:          REV-21-1650-V1.1 STEP — https://revrobotics.com/content/cad/REV-21-1650-V1.1.STEP
 *   - src_protopart:    ProtoPart rev-neo-brushless definition (community starting point only)
 *
 * Modelling notes:
 *   - Variant lock: V1.1 (ships since 11/16/2022; tapped #10-32 in the shaft
 *     end and the rear housing, extra front-face holes). Drawing and STEP are
 *     the V1.1 files; performance figures are REV's NEO figures, which REV
 *     publishes unchanged for V1.1 (docs page).
 *   - `phases`: three 12 AWG, 150 mm leads, red / black / white, which REV
 *     wires to SPARK MAX A / B / C; modelled as BrushlessPhases (input) with
 *     pins A/B/C. No current rating is published for the motor itself; the
 *     stall current (105 A empirical) is in the performance trait only.
 *   - `sensor`: the 300 mm 24 AWG sensor cable (3-phase hall sensors + motor
 *     temperature) ends in the 6-pin JST-PH plug that mates the SPARK MAX
 *     ENCODER port. REV publishes that pinout only for the controller side
 *     (1 GND, 2 C, 3 B, 4 A, 5 temperature, 6 +5 V); the NEO side is taken as
 *     the same pin-for-pin (assumption trait). `custom` (peer) with typed
 *     slots in the same order as rev-spark-max `encoder_port` (gaps.json
 *     vocabulary entry). The hall-sensor supply current is not published.
 *   - `face_mount`: BoltPattern circle, 4 x #10-32 tapped on the 50.8 mm
 *     circle at 0/90/180/270 deg (the regular subset of the 7 V1.1 holes; the
 *     others at 45/225/315 deg are in the note and an assumption trait).
 *     Hole depth: drawing V1.1 says 0.22 in [5.5 mm], the product page says
 *     "0.5in maximum" (source_discrepancy; the shallower drawing value is
 *     the safe limit).
 *   - `shaft`: Shaft (output) 8 mm, 2 mm keyed, 35 mm long; tapped #10-32
 *     x 12.7 mm in the end. The 19.05 mm pilot is in the shaft note.
 *   - No operating temperature in any REV source (data_gap); justifies the
 *     verify "coverage" warning.
 *   - Geometry: manufacturer STEP (not committed), bound by
 *     library/cad/py/catalog/rev-neo-brushless-v1-1.py; no transform (front
 *     face z = 0, shaft +Z).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { BoltPattern, BrushlessPhases, Ground, PowerIn, Shaft, connectorTrait, defineModule } from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://www.revrobotics.com/rev-21-1650/",
  docs: "https://docs.revrobotics.com/brushless/neo/v1.1",
  datasheet: "https://www.revrobotics.com/content/docs/REV-21-1650-DS.pdf",
  drawing: "https://revrobotics.com/content/docs/REV-21-1650-V1.1-DR.pdf",
  encoderPort: "https://docs.revrobotics.com/brushless/spark-max/specs/encoder-port",
  wiring: "https://docs.revrobotics.com/brushless/spark-max/gs/wiring",
  sparkMaxSpecs: "https://docs.revrobotics.com/brushless/spark-max/specs",
  cad: "https://revrobotics.com/content/cad/REV-21-1650-V1.1.STEP",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/rev-neo-brushless/definition.json",
} as const;

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function pinFn(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

function signal(id: string, name: string, pin: number, type: string, capability: string, traits: TraitDef[]): InterfaceDef {
  return {
    id,
    name,
    pin,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type, roles: ["output"] }],
    capabilities: [capability],
    traits,
  };
}

// ---------------------------------------------------------------------------
// Electrical: phase leads
// ---------------------------------------------------------------------------

const COLOUR: Record<string, string> = { A: "red", B: "black", C: "white" };

const phases = BrushlessPhases({
  id: "phases",
  name: "Motor phases (red/black/white)",
  role: "input",
  phases: [
    { pin: "A", name: "Phase lead red" },
    { pin: "B", name: "Phase lead black" },
    { pin: "C", name: "Phase lead white" },
  ],
  termination: "bare_wire_lead",
}).map((iface) => {
  if (iface.id !== "phases") {
    const letter = String(iface.pin);
    return withTraits(iface, [
      pinFn(`Motor phase lead, ${COLOUR[letter]}, 12 AWG, 150 mm; connects to SPARK MAX output ${letter}.`, [SRC.docs, SRC.wiring]),
    ]);
  }
  return withTraits(iface, [
    connectorTrait("bare_wire_lead", {
      positions: 3,
      pinout: ["red", "black", "white"],
      note: "Three high-flex silicone 12 AWG phase leads, 150 mm (5.91 in). REV wires red/black/white to SPARK MAX A/B/C and warns that the order must match.",
    }),
    {
      type: "usage_note",
      params: {
        note: "Brushless motor: drive ONLY from a brushless motor controller (SPARK MAX or compatible); never connect directly to a battery. The sensor cable must also be connected: the motor will not spin without it. REV publishes no continuous phase-current rating; set a smart current limit (see REV locked-rotor testing).",
        source: [SRC.product, SRC.datasheet, SRC.docs, SRC.wiring],
      },
    },
  ]);
});

// ---------------------------------------------------------------------------
// Electrical: sensor cable (6-pin JST-PH plug)
// ---------------------------------------------------------------------------

const SENSOR_PLUG = connectorTrait("jst_ph_6", {
  gender: "plug",
  positions: 6,
  pinout: ["Ground", "Hall C", "Hall B", "Hall A", "Motor Temperature", "+5V"],
  note: "6-pin JST-PH plug on a 300 mm (11.81 in) 24 AWG sensor cable; mates the SPARK MAX ENCODER port. Pin order is the SPARK MAX Encoder Port table (1 Ground, 2 C/Index, 3 B, 4 A, 5 Motor Temperature, 6 +5V); REV publishes no NEO-side pin table.",
});

const PINOUT_ASSUMPTION: TraitDef = {
  type: "assumption",
  params: {
    field: "sensor connector pinout",
    value: "1 GND, 2 hall C, 3 hall B, 4 hall A, 5 motor temperature, 6 +5 V",
    reason: "REV gives the pinout only for the SPARK MAX ENCODER port, which it says is designed to accept the NEO built-in hall encoder cable directly; the NEO plug is taken to match it pin for pin.",
    source: [SRC.encoderPort, SRC.wiring],
  },
};

const sensorGnd = withTraits(Ground({ id: "sensor_gnd", name: "Sensor GND", pin: 1 }), [
  pinFn("Pin 1 — sensor ground.", SRC.encoderPort),
  SENSOR_PLUG,
]);
const hallC = signal("hall_c", "Hall C", 2, "digital", "encoder_c", [pinFn("Pin 2 — hall sensor C (SPARK MAX Encoder C / Index).", SRC.encoderPort), SENSOR_PLUG]);
const hallB = signal("hall_b", "Hall B", 3, "digital", "encoder_b", [pinFn("Pin 3 — hall sensor B.", SRC.encoderPort), SENSOR_PLUG]);
const hallA = signal("hall_a", "Hall A", 4, "digital", "encoder_a", [pinFn("Pin 4 — hall sensor A.", SRC.encoderPort), SENSOR_PLUG]);
const temp = signal("motor_temp", "Motor temperature", 5, "analog", "motor_temperature", [
  pinFn("Pin 5 — motor temperature sensor (analog).", [SRC.encoderPort, SRC.datasheet]),
  SENSOR_PLUG,
]);
const sensor5v = withTraits(PowerIn({ id: "sensor_5v", name: "Sensor +5V", pin: 6, voltageV: 5 }), [
  pinFn("Pin 6 — +5 V supply for the hall sensors, from the controller (SPARK MAX ENCODER port, 100 mA shared rail). NEO supply current not published.", [SRC.encoderPort, SRC.sparkMaxSpecs]),
  SENSOR_PLUG,
]);

const sensor: InterfaceDef = {
  id: "sensor",
  name: "Sensor cable (hall encoder + temperature)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "custom", roles: ["peer"] }],
  capabilities: ["rev_encoder_port"],
  slots: [
    { id: "v5", required: true, label: "+5V", match: { protocol: "power", role: "input" } },
    { id: "gnd", required: true, label: "GND", match: { protocol: "power", role: "ground" } },
    { id: "hall_a", required: true, label: "Hall A", match: { protocol: "digital", role: "output", capability: "encoder_a" } },
    { id: "hall_b", required: true, label: "Hall B", match: { protocol: "digital", role: "output", capability: "encoder_b" } },
    { id: "hall_c", required: true, label: "Hall C", match: { protocol: "digital", role: "output", capability: "encoder_c" } },
    { id: "temp", required: false, label: "Motor temperature", match: { protocol: "analog", role: "output", capability: "motor_temperature" } },
  ],
  profiles: [
    {
      id: "sensor_plug",
      label: "6-pin JST-PH sensor plug",
      default_active: true,
      bindings: { v5: "sensor_5v", gnd: "sensor_gnd", hall_a: "hall_a", hall_b: "hall_b", hall_c: "hall_c", temp: "motor_temp" },
    },
  ],
  max_instances: 1,
  traits: [
    SENSOR_PLUG,
    PINOUT_ASSUMPTION,
    {
      type: "usage_note",
      params: {
        note: "Integrated motor sensor: 3-phase hall sensors (42 counts per revolution) and a motor temperature sensor. Plug into the SPARK MAX port labelled ENCODER; required for brushless commutation. Protocol type is `custom` (no hall-sensor-port vocabulary; see gaps.json).",
        source: [SRC.product, SRC.docs, SRC.wiring],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Mechanical: front-face mount and output shaft
// ---------------------------------------------------------------------------

const faceMount = withTraits(
  BoltPattern({
    id: "face_mount",
    name: "Front face 4 x #10-32 on 50.8 mm circle",
    role: "component",
    shape: "circle",
    spacingMm: 50.8,
    holeCount: 4,
    fastener: "#10-32 UNF",
    fastenerDiameterMm: 4.83,
    threaded: true,
    note: "Modelled: the 4 tapped #10-32 holes at 0/90/180/270 deg on the 2.00 in (50.8 mm) circle. The V1.1 face has 7 such holes (drawing: 7 x 10-32 UNF, 0.22 in [5.5 mm] deep); the other three are at 45/225/315 deg (none at 135 deg, where the leads exit). CIM-style mounting; 19.05 mm (0.75 in) pilot.",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "bolt pattern subset",
        value: "4 holes at 0/90/180/270 deg of the 7-hole 50.8 mm circle",
        reason: "The 7 holes are not equally spaced (no hole at 135 deg); the largest regular subset is modelled so the pattern can be placed and checked. Hole angles from the STEP (the drawing shows the circle, not angles).",
        source: [SRC.drawing, SRC.cad],
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "mounting hole depth",
        values: ["0.22 in [5.5 mm] (V1.1 drawing)", "0.5 in maximum (product page)", "5.0 mm modelled thread depth (STEP)"],
        sources: [SRC.drawing, SRC.product, SRC.cad],
        resolution: "Use the V1.1 drawing's 5.5 mm as the maximum screw engagement; the product page figure appears to be the V1.0 value.",
      },
    },
  ],
);

const shaft = Shaft({
  id: "shaft",
  name: "Output shaft 8 mm keyed",
  role: "output",
  diameterMm: 8,
  thread: "#10-32 UNF tapped end, 0.50 in [12.7 mm] deep",
  note: "8 mm shaft with a 2 mm key (keyway 22.0 mm C-C), 35 mm from the front face (31.5 mm above the 3.5 mm pilot). Output pilot 19.05 mm (0.75 in). A #10-32 x 3/8 in screw in the rear housing hole supports the shaft while pressing pinions (V1.1).",
});

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const REV_NEO_BRUSHLESS_V1_1_BASE: ModuleDef = defineModule({
  id: "rev-neo-brushless-v1-1",
  name: "REV NEO Brushless Motor V1.1",
  version: "1.0.0",
  manufacturer: "REV Robotics",
  part_number: "REV-21-1650",
  description:
    "Sensored brushless outrunner for FRC, a drop-in replacement for CIM-style motors. 12 V nominal, 473 Kv, 5676 rpm free, 105 A / 2.6 Nm stall, 406 W peak (empirical). Built-in 3-phase hall encoder (42 counts/rev) and temperature sensor on a 6-pin JST-PH cable for the SPARK MAX ENCODER port; 12 AWG red/black/white phase leads. 8 mm keyed shaft, 19.05 mm pilot, #10-32 face holes on a 2 in circle. 60 mm x 58.25 mm, 425 g. V1.1 (tapped shaft end and rear hole).",
  tags: ["frc", "rev-ion", "brushless", "bldc", "motor", "neo", "sensored", "hall-encoder", "cim-style"],
  categories: ["motor"],

  interfaces: [...phases, sensorGnd, hallC, hallB, hallA, temp, sensor5v, sensor, faceMount, shaft],

  domains: [
    {
      domain: "electrical",
      power_domains: [{ id: "sensor_5v", name: "Hall sensor +5 V (from controller)", nominal_voltage_V: 5 }],
      metadata: { nominal_voltage_V: 12, source: [SRC.product, SRC.docs] },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 58.25, width: 60, height: 60 },
      weight_g: 425,
      metadata: {
        body_diameter_mm: 60,
        body_length_mm: 58.25,
        shaft_diameter_mm: 8,
        shaft_length_mm: 35,
        pilot_diameter_mm: 19.05,
        face_holes: "7 x #10-32 UNF on 50.8 mm circle, 5.5 mm deep (V1.1 drawing)",
        phase_leads: "3 x 12 AWG, 150 mm",
        sensor_cable: "24 AWG, 300 mm, 6-pin JST-PH",
        source: [SRC.product, SRC.docs, SRC.drawing],
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "motor",
        nominal_voltage_V: 12,
        kv_rpm_per_V: 473,
        free_speed_rpm: 5676,
        free_current_A: 1.8,
        stall_current_A: 105,
        stall_torque_Nm: 2.6,
        peak_output_power_W: 406,
        theoretical_stall_current_A: 150,
        theoretical_stall_torque_Nm: 3.75,
        theoretical_peak_output_power_W: 540,
        typical_output_power_at_40A_W: 380,
        hall_encoder_counts_per_rev: 42,
        note: "Empirical values measured with the SPARK MAX and FRC system components (REV); theoretical values from the data sheet.",
        source: [SRC.product, SRC.datasheet, SRC.docs],
      },
    },
    {
      type: "data_gap",
      params: {
        fields: ["operating / storage temperature", "continuous phase current rating", "hall sensor supply current", "phase resistance / inductance", "NEO-side sensor connector pin table"],
        note: "Not stated in the REV sources read (product page, V1.1 docs, data sheet, drawing).",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "ProtoPart model",
        values: [
          "ProtoPart: motor power domain 6-16 V; 5-signal hall interface (no temperature); no mounting or shaft",
          "REV: 12 V nominal (no range given); sensor cable carries hall A/B/C, temperature, +5 V, GND; 8 mm keyed shaft, #10-32 face holes",
        ],
        sources: [SRC.protopart, SRC.product, SRC.encoderPort, SRC.drawing],
        resolution: "Manufacturer documentation used; ProtoPart's 6-16 V motor range has no REV source and is not modelled.",
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "NEO Brushless Motor product page", type: "datasheet", url: SRC.product },
    { id: "art_docs", name: "NEO V1.1 user guide", type: "documentation", url: SRC.docs },
    { id: "art_datasheet", name: "NEO data sheet", type: "datasheet", url: SRC.datasheet },
    { id: "art_drawing", name: "REV-21-1650 V1.1 drawing", type: "datasheet", url: SRC.drawing },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): manufacturer STEP bound by
// library/cad/py/catalog/rev-neo-brushless-v1-1.py (no transform: front face
// z = 0, shaft axis +Z through the origin).
// ---------------------------------------------------------------------------

const LEADS = vendorFeature("leads", { area_mm2: 468.686, centroid: [-30.08, 27.265, -5.484] });

export const REV_NEO_BRUSHLESS_V1_1: ModuleDef = withGeometry(
  REV_NEO_BRUSHLESS_V1_1_BASE,
  {
    // Front face: bolt-circle centre on the face, the mount approaches from +Z
    // (the shaft side); xAxis to hole 1 at 0 deg; the 4-hole subset repeats every 90 deg.
    face_mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0], symmetryDeg: 90 },
      refs: [vendorFeature("face_holes", { area_mm2: 444.067, centroid: [2.566, -2.566, -2.5] }), vendorOwn("face_holes"), procedural("bolt_pattern")],
    },
    shaft: {
      frame: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      refs: [vendorFeature("shaft", { area_mm2: 731.477, centroid: [0.0, -0.258, 19.065] }), vendorOwn("shaft"), procedural("shaft")],
    },
    phases: { refs: [LEADS, vendorOwn("leads")] },
    phases_a: { refs: [LEADS] },
    phases_b: { refs: [LEADS] },
    phases_c: { refs: [LEADS] },
    sensor: { refs: [LEADS] },
    sensor_gnd: { refs: [LEADS] },
    hall_a: { refs: [LEADS] },
    hall_b: { refs: [LEADS] },
    hall_c: { refs: [LEADS] },
    motor_temp: { refs: [LEADS] },
    sensor_5v: { refs: [LEADS] },
  },
  vendorCadArtifacts({
    partId: "rev-neo-brushless-v1-1",
    name: "REV-21-1650-V1.1",
    url: SRC.cad,
    stepFile: "REV-21-1650-V1.1.STEP",
    sha256: "50fb9445ae07465fbd10605e48009649316d376e8194451b7fc97959d17003a9",
    licence: "not stated by REV Robotics; not redistributed",
    interfaces: ["face_holes", "shaft", "leads"],
  }),
);
