/**
 * STEPPERONLINE 17HS08-1004S (NEMA 17 bipolar stepper, 1.0 A, 20 mm body) —
 * datasheet-honest UHD part.
 *
 * Sources (see ./stepperonline-17hs08-1004s/sources.json):
 *   - src_datasheet: 17HS08-1004S full datasheet / drawing (STEPPERONLINE, drawing
 *                    dated 8.18.2018) — https://www.omc-stepperonline.com/download/17HS08-1004S.pdf
 *   - src_product:   STEPPERONLINE product page (UK store, same catalogue) —
 *                    https://www.stepperonline.co.uk/nema-17-bipolar-stepper-motor-1-8deg-16ncm-22-66oz-in-1a-extruder-motor-42x42x20mm-4-wires-17hs08-1004s.html
 *   - src_protopart: ProtoPart stepperonline-17hs08-1004s definition (community;
 *                    starting point only, every value re-verified).
 *
 * Modelling notes:
 *   - Leads: four flying leads (UL1007 AWG24, 400±10 mm, no connector on the
 *     drawing). One leaf per lead; the datasheet names them A, A\, B, B\ with
 *     colours BLK, GRN, RED, BLU (pin numbers 1-4 of the connection table),
 *     so `pin` is the colour and the name carries the winding end. The product
 *     page calls the same leads A+, A-, B+, B-.
 *   - `bipolar_stepper_phases` (role input) composes the four leads with
 *     slots phase_a_pos, phase_a_neg, phase_b_pos, phase_b_neg in that order,
 *     so it pairs slot-for-slot with a driver's output (stepperonline-dm542t-v4).
 *     The protocol type is the one stepperonline-17hs19-2004s1 uses, but that
 *     older part has role "motor" and power-typed leads; this part uses
 *     input/output roles and a `stepper_phase` leaf type (vocabulary gap in
 *     .research/gaps.json, escalated to the integrator).
 *   - `phase_current` (A, range-checked by DRC) is the rated 1.00 A/phase;
 *     `max_current` is the same figure for capacity checks. 3.7 V is only the
 *     I x R of one winding (1.0 A x 3.7 Ω); the source gives no drive-bus
 *     voltage, so no `voltage` parameter is claimed (a chopper driver sets it).
 *   - Mechanical: BoltPattern 4 x M3 tapped, depth 2.5 min, on a 31±0.2 mm
 *     square (front face); Shaft Ø5 mm D-cut output. Both bound to generated
 *     geometry from the drawing (manufacturer STEP exists but could not be
 *     downloaded; data_gap trait).
 *   - Discrepancies (source_discrepancy traits): body length 20.5±1 (drawing)
 *     vs 21.5 mm (product page) vs 20 mm (ProtoPart / older listings);
 *     ProtoPart describes the front holes as "M3 clearance" but the drawing
 *     says 4-M3 DEPTH 2.5 MIN (tapped, blind).
 *   - Thermal: ambient -10..50 °C, temperature rise max 80 °C, class B.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { BoltPattern, Shaft, connectorTrait, defineModule, maxCurrentA } from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  datasheet: "https://www.omc-stepperonline.com/download/17HS08-1004S.pdf",
  product:
    "https://www.stepperonline.co.uk/nema-17-bipolar-stepper-motor-1-8deg-16ncm-22-66oz-in-1a-extruder-motor-42x42x20mm-4-wires-17hs08-1004s.html",
  protopart:
    "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/stepperonline-17hs08-1004s/definition.json",
} as const;

const RATED_PHASE_CURRENT_A = 1.0;

const LEADS = connectorTrait("bare_wire_lead", {
  positions: 4,
  pinout: ["BLK (A)", "GRN (A\\)", "RED (B)", "BLU (B\\)"],
  note: "Four flying leads, UL1007 AWG24, 400±10 mm; no connector on the drawing. Order is the datasheet's connection-table pin order 1-4.",
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

// ---------------------------------------------------------------------------
// Electrical: the four motor leads and the composed bipolar winding pair
// ---------------------------------------------------------------------------

function lead(id: string, colour: string, end: string, description: string): InterfaceDef {
  return {
    id,
    name: `${colour} (${end})`,
    pin: colour,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "stepper_phase", roles: ["input"] }],
    capabilities: ["stepper_phase"],
    parameters: [maxCurrentA(RATED_PHASE_CURRENT_A)],
    traits: [
      { type: "pin_functions", params: { description, source: [SRC.datasheet, SRC.product] } },
      LEADS,
    ],
  };
}

const leads: InterfaceDef[] = [
  lead("lead_black", "BLK", "A", "Pin 1, BLK: winding A, end A (product page: A+)."),
  lead("lead_green", "GRN", "A\\", "Pin 2, GRN: winding A, end A\\ (product page: A-)."),
  lead("lead_red", "RED", "B", "Pin 3, RED: winding B, end B (product page: B+)."),
  lead("lead_blue", "BLU", "B\\", "Pin 4, BLU: winding B, end B\\ (product page: B-)."),
];

const phases: InterfaceDef = {
  id: "bipolar_stepper_phases",
  name: "Bipolar stepper windings (A, A\\, B, B\\)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "bipolar_stepper_phases", roles: ["input"] }],
  max_instances: 1,
  parameters: [
    { id: "phase_current", name: "Rated current per phase", unit: "A", value: RATED_PHASE_CURRENT_A },
    maxCurrentA(RATED_PHASE_CURRENT_A),
    { id: "phase_resistance", name: "Resistance per phase @25 °C (±10%)", unit: "Ω", value: 3.7, tolerance: { type: "percent", value: 10 } },
    { id: "phase_inductance", name: "Inductance per phase @1 kHz (±20%)", unit: "mH", value: 4.5, tolerance: { type: "percent", value: 20 } },
  ],
  slots: [
    { id: "phase_a_pos", label: "A", required: true, match: { protocol: "stepper_phase", role: "input", capability: "stepper_phase" } },
    { id: "phase_a_neg", label: "A\\", required: true, match: { protocol: "stepper_phase", role: "input", capability: "stepper_phase" } },
    { id: "phase_b_pos", label: "B", required: true, match: { protocol: "stepper_phase", role: "input", capability: "stepper_phase" } },
    { id: "phase_b_neg", label: "B\\", required: true, match: { protocol: "stepper_phase", role: "input", capability: "stepper_phase" } },
  ],
  profiles: [
    {
      id: "datasheet_colours",
      label: "A=BLK, A\\=GRN, B=RED, B\\=BLU",
      default_active: true,
      bindings: { phase_a_pos: "lead_black", phase_a_neg: "lead_green", phase_b_pos: "lead_red", phase_b_neg: "lead_blue" },
    },
  ],
  traits: [
    LEADS,
    {
      type: "usage_note",
      params: {
        topic: "drive",
        note: "Full step, 2-phase excitation, CW when facing the mounting end: step 1 A+ B+ A\\- B\\-, step 2 A- B+ A\\+ B\\-, step 3 A- B- A\\+ B\\+, step 4 A+ B- A\\- B\\+ (reverse the order for CCW). Rated 1.00 A/phase; 3.7 V is the I x R of one winding, so drive it from a current-limiting (chopper) bipolar driver.",
        source: SRC.datasheet,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "wiring",
        note: "Product page connection table: A+ Black, A- Green, B+ Red, B- Blue.",
        source: SRC.product,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Mechanical: NEMA 17 front face and D-cut shaft
// ---------------------------------------------------------------------------

const frontMount = withTraits(
  BoltPattern({
    id: "front_mount",
    name: "Front face mounting holes",
    role: "component",
    shape: "square",
    spacingMm: 31,
    holeCount: 4,
    fastener: "M3",
    fastenerDiameterMm: 3,
    threaded: true,
    note: "4-M3 DEPTH 2.5 MIN on a 31±0.2 mm square in the front face (42.3 mm max frame); Ø22 (0/-0.05) x 2±0.25 mm pilot boss.",
  }),
  [
    {
      type: "source_discrepancy",
      params: {
        field: "front hole type",
        values: ["4-M3 DEPTH 2.5 MIN, tapped blind holes (datasheet drawing)", "\"NEMA 17 front face 4x M3 clearance\" (ProtoPart)"],
        sources: [SRC.datasheet, SRC.protopart],
        resolution: "Datasheet drawing used: the holes are tapped M3, at least 2.5 mm deep. Screws must not bottom out.",
      },
    },
  ],
);

const shaft = withTraits(
  Shaft({
    id: "shaft",
    name: "Output shaft (D-cut)",
    role: "output",
    diameterMm: 5,
    note: "Ø5 (0/-0.012) mm, 20±1 mm long from the front face, D-flat 16.5±0.25 mm long, 4.5±0.1 mm across the flat. Single shaft.",
  }),
  [{ type: "usage_note", params: { note: "Couple with a 5 mm bore coupler or gear.", source: SRC.protopart } }],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const STEPPERONLINE_17HS08_1004S_BASE: ModuleDef = defineModule({
  id: "stepperonline-17hs08-1004s",
  name: "STEPPERONLINE 17HS08-1004S NEMA 17 stepper",
  version: "1.0.0",
  manufacturer: "STEPPERONLINE",
  part_number: "17HS08-1004S",
  description:
    "Short-body NEMA 17 bipolar hybrid stepper motor: 1.8° step, 1.00 A/phase, 3.7 Ω and 4.5 mH per phase, 0.16 N·m (16 N·cm) holding torque, 42.3 mm frame x 20.5 mm body, Ø5 mm D-cut shaft, four 400 mm flying leads, 140 g. Extruder-class motor.",
  tags: ["nema17", "stepper", "bipolar", "hybrid-stepper", "1.8deg", "1a", "extruder", "4-wire", "stepperonline"],
  categories: ["actuator.motor.stepper"],

  interfaces: [...leads, phases, frontMount, shaft],

  interfaceGroups: [
    { id: "winding_a", label: "Winding A (BLK/GRN), connect as a pair", members: ["lead_black", "lead_green"], policy: "all_of" },
    { id: "winding_b", label: "Winding B (RED/BLU), connect as a pair", members: ["lead_red", "lead_blue"], policy: "all_of" },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        {
          id: "phase_coils",
          name: "Phase windings (current-driven)",
          nominal_voltage_V: 3.7,
          max_current_mA: 1000,
        },
      ],
      metadata: {
        rated_current_per_phase_A: 1.0,
        resistance_per_phase_ohm: 3.7,
        inductance_per_phase_mH: 4.5,
        insulation_class: "B (130 °C)",
        insulation_resistance: "100 MΩ",
        dielectric_strength: "500 VAC for 1 min (coils to case)",
        note: "nominal_voltage_V is I x R of one winding, not a supply voltage.",
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 42.3, width: 42.3, height: 20.5 },
      weight_g: 140,
      metadata: {
        frame: "NEMA 17, 42.3 mm max square",
        body_length_mm: "20.5±1 (drawing); 21.5 (product page)",
        pilot_boss: "Ø22 x 2 mm",
        shaft: "Ø5 x 20 mm, D-flat 16.5 mm, 4.5 mm across the flat",
        rotor_inertia_g_cm2: 22,
        lead_length_mm: 400,
      },
    },
    {
      domain: "thermal",
      operating_temperature_C: [-10, 50],
      metadata: { temperature_rise_max_C: 80, insulation_class: "B (130 °C)", ambient_humidity: "max 85% (no condensation)" },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "stepper_motor",
        step_angle_deg: 1.8,
        step_accuracy: "±5% (non-accumulative)",
        holding_torque_Nm: 0.16,
        holding_torque_lb_in: 1.42,
        rotor_inertia_g_cm2: 22,
        source: [SRC.datasheet, SRC.product],
      },
    },
    {
      type: "operating_conditions",
      params: {
        ambient_temperature_C: [-10, 50],
        temperature_rise_max_C: 80,
        temperature_rise_condition: "motor standstill, 2 phases energized",
        ambient_humidity: "max 85%, no condensation",
        source: SRC.datasheet,
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "body length",
        values: ["20.5±1 mm (datasheet drawing)", "21.5 mm (product page: \"Body Length: 21.5mm\", title 42x42x21.5mm)", "20 mm (ProtoPart; older 42x42x20mm listings)"],
        sources: [SRC.datasheet, SRC.product, SRC.protopart],
        resolution: "Drawing value 20.5 mm used for dimensions and CAD; 21.5 mm is within +1 of the drawing tolerance. Allow 21.5 mm clearance.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "holding torque / phase resistance",
        values: ["0.16 N·m, 3.70 Ω±10% (datasheet); 16 N·cm, 3.7 Ω (product page)", "13 N·cm, 3.5 Ω, 3.5 V (older third-party listings of the same part number)"],
        sources: [SRC.datasheet, SRC.product],
        resolution: "Manufacturer datasheet and current product page agree on 0.16 N·m and 3.7 Ω; the older listing values are not used.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "manufacturer CAD",
        note: "STEPPERONLINE lists 17HS08-1004S.STEP (1.2 MB) on the product page (get_file&file=92/17HS08-1004S.STEP), but every download route (omc-stepperonline.com: Access denied 403; stepperonline.co.uk get_file: Cloudflare browser challenge; no Wayback capture) was blocked from this environment. Geometry is generated from the datasheet drawing (library/cad/py/catalog/stepperonline-17hs08-1004s.py). A human can download the STEP from the product page's Downloads tab and switch the part to vendor CAD.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "maximum drive voltage / speed-torque",
        note: "The datasheet gives no drive-bus voltage limit; the torque curve PDF (17HS08-1004S_Torque_Curve.pdf) was not retrieved. Dielectric strength is 500 VAC coil-to-case.",
      },
    },
    {
      type: "assumption",
      params: {
        field: "CAD corner chamfer, lead exit housing, lead stub, hole bore",
        value: "4 mm x 45° corner chamfer; 10 x 4 x 6 mm lead exit; leads as a 20 mm Ø4 stub on -Y; M3 tapped holes as Ø3.0 x 2.5 mm plain bores (thread not modelled)",
        reason: "Not dimensioned on the drawing; only used for the representative body. Mounting holes, boss and shaft are from the drawing.",
      },
    },
  ],

  artifacts: [
    { id: "art_datasheet", name: "17HS08-1004S full datasheet (drawing + specifications)", type: "datasheet", url: SRC.datasheet },
    { id: "art_product", name: "STEPPERONLINE 17HS08-1004S product page", type: "documentation", url: SRC.product },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796), generated: library/cad/py/catalog/stepperonline-17hs08-1004s.py.
// Front face at z = 0, body toward -Z, shaft +Z at the origin, leads on -Y.
// ---------------------------------------------------------------------------

export const STEPPERONLINE_17HS08_1004S: ModuleDef = withGeometry(
  STEPPERONLINE_17HS08_1004S_BASE,
  {
    // Bracket comes from +Z (shaft side). Square pattern: any 90° rotation fits.
    front_mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0], symmetryDeg: 90 },
      refs: [
        feature("front_mount", { area_mm2: 94.248, centroid: [0.0, 0.0, -1.25] }),
        own("front_mount"),
        procedural("bolt_pattern"),
      ],
    },
    shaft: {
      frame: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      refs: [feature("shaft", { area_mm2: 261.07, centroid: [0.0, -0.474, 9.644] }), own("shaft"), procedural("shaft")],
    },
    // All four leads leave through the one lead exit (end of the lead stub).
    bipolar_stepper_phases: {
      refs: [feature("leads", { area_mm2: 12.566, centroid: [0.0, -45.15, -10.25], normal: [0.0, -1.0, 0.0] })],
    },
  },
  cadArtifacts({
    dir: "library/parts/stepperonline-17hs08-1004s/artifacts/cad",
    name: "stepperonline-17hs08-1004s",
    generator: "library/cad/py/catalog/stepperonline-17hs08-1004s.py",
    tool: "build123d 0.13.0",
    interfaces: ["front_mount", "shaft"],
  }),
);
