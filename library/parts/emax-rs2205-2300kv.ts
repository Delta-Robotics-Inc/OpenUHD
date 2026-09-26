/**
 * EMAX RS2205 RaceSpec motor, Cooling Series (2300KV, 3S-4S) — datasheet-honest UHD part.
 *
 * Sources (see ./emax-rs2205-2300kv/sources.json):
 *   - src_product:       EMAX product page (specifications) — https://emaxmodel.com/products/emax-rs2205-racespec-motor-cooling-series
 *   - src_drawing:       RS2205 dimension drawing — https://cdn.shopify.com/s/files/1/0469/7358/3518/t/3/assets/RS2205-1.jpg?v=1598532542
 *   - src_test:          RS2205-2300KV thrust test table — https://cdn.shopify.com/s/files/1/0469/7358/3518/t/3/assets/RS2205-2.jpg?v=1598532544
 *   - src_package_photo: package contents photo — https://cdn.shopify.com/s/files/1/0469/7358/3518/products/5_23.jpg?v=1598532540
 *   - src_protopart:     ProtoPart emax-rs2205-2300kv definition (starting point only)
 *
 * Modelling notes:
 *   - Variant lock: 2300KV only. The page also sells 2600KV (separate test
 *     table RS2205-3.jpg, not used). Both prop-thread variants ("CW
 *     Thread/CCW Rotation", "CCW Thread/CW Rotation") share every figure and
 *     are covered by this part; the thread handedness is a purchase choice
 *     (usage_note on `shaft`).
 *   - `phases`: three unlabelled 20AWG leads, 77 mm (drawing), modelled with
 *     BrushlessPhases (role input, bare_wire_lead) and the builder's default
 *     A/B/C designators. EMAX publishes no continuous or peak current rating:
 *     `max_current`/`burst_current` are omitted (data_gap) and the thrust
 *     test's 29.9 A maximum (16 V, HQ5045BN) is in the performance trait.
 *     "Input voltage: 3S-4S (12.6 - 16.8v)" gives `cell_count` [3, 4] and
 *     `voltage` [12.6, 16.8].
 *   - ProtoPart discrepancies (source_discrepancy traits): ProtoPart gives a
 *     9-25.2 V (6S) range and 30 A continuous / 45 A 100 ms peak per phase;
 *     neither is in any EMAX source. Manufacturer values are used.
 *   - Base holes: "16 x 19" on the drawing is the usual motor cross pattern,
 *     not a rectangle: one diagonal hole pair is 16 mm apart, the other 19 mm
 *     apart (the dimension extension lines run through opposite holes; a
 *     16 x 19 rectangle would put the holes on a 24.8 mm diagonal, outside the
 *     drawn base). The bolt_pattern vocabulary has no two-diameter cross, so
 *     the four M3 holes are two BoltPatterns (component), each a 2-hole
 *     "circle": `base_mount` (the 16 mm pair) and `base_mount_19` (the 19 mm
 *     pair). A frame arm mates either or both. (Audit repair PB-796; recorded
 *     in .research/gaps.json as a vocabulary gap.) The pattern's angle to the
 *     lead exit is drawn (~45°) but not dimensioned (assumption).
 *     Two screw lengths are included for 3 mm and 4 mm frames (product page).
 *   - `shaft`: Shaft (output) Φ5 mm with M5 thread (drawing), 15 mm prop shaft
 *     with 9 mm of thread. The spec line "Shaft Diameter: 3mm" is the inner
 *     shaft (Φ3 at the base in the drawing), recorded as a source_discrepancy.
 *   - Thermal: no operating temperature in any source, so there is no thermal
 *     domain (justifies verify's coverage warning; data_gap trait).
 *   - Geometry: EMAX publishes no CAD, so representative geometry is generated
 *     from the drawing by library/cad/py/catalog/emax-rs2205-2300kv.py (Z up,
 *     base at z = 0, shaft on the Z axis, leads exit +X).
 */
import type { ModuleDef } from "../../src/types/index.js";
import { BoltPattern, BrushlessPhases, Shaft, cellCount, defineModule } from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://emaxmodel.com/products/emax-rs2205-racespec-motor-cooling-series",
  drawing: "https://cdn.shopify.com/s/files/1/0469/7358/3518/t/3/assets/RS2205-1.jpg?v=1598532542",
  test: "https://cdn.shopify.com/s/files/1/0469/7358/3518/t/3/assets/RS2205-2.jpg?v=1598532544",
  package: "https://cdn.shopify.com/s/files/1/0469/7358/3518/products/5_23.jpg?v=1598532540",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/emax-rs2205-2300kv/definition.json",
  cadSearch: "https://emaxmodel.com/pages/downloads",
} as const;

// ---------------------------------------------------------------------------
// Electrical: three motor phase leads
// ---------------------------------------------------------------------------

const phases = BrushlessPhases({
  role: "input",
  termination: "bare_wire_lead",
  voltageV: [12.6, 16.8],
}).map((iface) => {
  if (iface.id !== "phases") {
    return {
      ...iface,
      traits: [
        ...(iface.traits ?? []),
        {
          type: "pin_functions",
          params: { description: "Motor phase lead (unlabelled), 20AWG, 77 mm.", source: [SRC.product, SRC.drawing] },
        },
      ],
    };
  }
  return {
    ...iface,
    parameters: [...(iface.parameters ?? []), cellCount([3, 4])],
    traits: [
      ...(iface.traits ?? []),
      {
        type: "connector",
        params: {
          connector_type: "bare_wire_lead",
          positions: 3,
          lead_gauge_awg: 20,
          lead_length_mm: 77,
          note: "Wire AWG: 20AWG (spec); lead length 77 mm (drawing). Termination (tinned or bare) not stated.",
          source: [SRC.product, SRC.drawing],
        },
      },
      {
        type: "source_discrepancy",
        params: {
          field: "supply voltage",
          values: ["3S-4S (12.6-16.8 V)", "9-25.2 V (nominal 14.8 V)"],
          sources: [SRC.product, SRC.protopart],
          resolution: "Manufacturer value used: voltage [12.6, 16.8] V, cell_count [3, 4]. The ProtoPart 25.2 V (6S) upper limit is not supported by EMAX.",
        },
      },
      {
        type: "source_discrepancy",
        params: {
          field: "phase current rating",
          values: ["not stated; max tested 29.9 A at 16 V (HQ5045BN)", "30 A continuous, 45 A peak for 100 ms"],
          sources: [SRC.test, SRC.protopart],
          resolution: "ProtoPart ratings have no manufacturer source; max_current and burst_current omitted.",
        },
      },
    ],
  };
});

// ---------------------------------------------------------------------------
// Mechanical: base mount and prop shaft
// ---------------------------------------------------------------------------

const mountTraits = (pair: string) => [
  {
    type: "assumption",
    params: {
      field: "mount pattern orientation",
      value: `${pair}; both pairs at 45° to the lead exit (+X), the 16 mm pair along (1, -1), the 19 mm pair along (1, 1)`,
      reason: "The drawing (bottom view, leads to the right) shows the 16 mm pair and the 19 mm pair at roughly 45° to the leads, but the angle is not dimensioned; the bottom view is read as seen from -Z.",
    },
  },
  {
    type: "assumption",
    params: {
      field: "threaded holes",
      value: "tapped M3 (threaded: true)",
      reason: "'4-M3' on the drawing, M3 screws supplied; thread depth not stated.",
    },
  },
];

const mountNote =
  "Drawing: '4-M3' on the 16 x 19 motor cross pattern (one diagonal pair 16 mm apart, the other 19 mm apart). Two sets of motor screws for 3 mm and 4 mm thick frames are included (product page); lengths not stated.";

const baseMount16 = BoltPattern({
  id: "base_mount",
  name: "Base mount 2x M3, 16 mm pair (16 x 19 cross)",
  role: "component",
  shape: "circle",
  spacingMm: 16,
  holeCount: 2,
  fastener: "M3",
  fastenerDiameterMm: 3,
  threaded: true,
  note: mountNote,
});
const baseMount = { ...baseMount16, traits: [...(baseMount16.traits ?? []), ...mountTraits("16 mm pair")] };

const baseMount19Base = BoltPattern({
  id: "base_mount_19",
  name: "Base mount 2x M3, 19 mm pair (16 x 19 cross)",
  role: "component",
  shape: "circle",
  spacingMm: 19,
  holeCount: 2,
  fastener: "M3",
  fastenerDiameterMm: 3,
  threaded: true,
  note: mountNote,
});
const baseMount19 = { ...baseMount19Base, traits: [...(baseMount19Base.traits ?? []), ...mountTraits("19 mm pair")] };

const shaftBase = Shaft({
  id: "shaft",
  name: "Prop shaft Φ5 mm M5",
  role: "output",
  diameterMm: 5,
  thread: "M5",
  note: "Drawing: Φ5 prop shaft extending 15 mm above the bell, M5 thread over 9 mm; spec: '15mm Extended Prop Shaft allows virtually any prop with 5mm hole'. 3 lock nuts included.",
});

const shaft = {
  ...shaftBase,
  traits: [
    ...(shaftBase.traits ?? []),
    {
      type: "usage_note",
      params: {
        note: "Sold as 'CW Thread/CCW Rotation' or 'CCW Thread/CW Rotation'; pick the thread that self-tightens for the motor's position on the frame.",
        source: SRC.product,
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "shaft diameter",
        values: ["3 mm (spec 'Shaft Diameter')", "Φ5 prop shaft, M5 thread; Φ3 at the base (drawing)"],
        sources: [SRC.product, SRC.drawing],
        resolution: "Both hold: 3 mm is the inner shaft, 5 mm the prop adapter shaft the propeller mates to. shaft_diameter = 5.",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const EMAX_RS2205_2300KV_BASE: ModuleDef = defineModule({
  id: "emax-rs2205-2300kv",
  name: "EMAX RS2205 2300KV RaceSpec Motor (Cooling Series)",
  version: "1.0.0",
  manufacturer: "EMAX",
  part_number: "RS2205-2300KV",
  description:
    "2205, 12N14P, 2300KV brushless outrunner for 5-inch FPV racing quads, rated 3S-4S (12.6-16.8 V). Three 77 mm 20AWG leads, 4x M3 base mount on the 16 x 19 mm cross pattern, Φ5 mm M5-threaded prop shaft. Approx. 30 g with wires.",
  tags: ["brushless", "bldc", "fpv", "quadcopter", "motor", "2205", "4s", "5-inch"],
  categories: ["motor"],

  interfaces: [...phases, baseMount, baseMount19, shaft],

  domains: [
    {
      domain: "electrical",
      metadata: { rated_cells: [3, 4], voltage_range_V: [12.6, 16.8], lead_gauge_awg: 20, source: SRC.product },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 27.9, width: 27.9, height: 31.7 },
      weight_g: 30,
      metadata: {
        diameter_mm: 27.9,
        overall_height_mm: 31.7,
        prop_shaft_length_mm: 15,
        prop_shaft_thread_length_mm: 9,
        inner_shaft_diameter_mm: 3,
        centre_boss_diameter_mm: 8,
        stator_diameter_mm: 22,
        stator_height_mm: 5,
        weight_note: "Approx. 30 g with wires",
        source: [SRC.product, SRC.drawing],
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "motor",
        kv_rpm_per_V: 2300,
        stator_size: "2205",
        configuration: "12N14P",
        rated_cells: [3, 4],
        magnets: "N52",
        bearings: "NMB",
        thrust_tests: [
          { propeller: "HQ5045 BN", supply_V: 16, max: { current_A: 29.9, thrust_g: 1024, power_W: 478.4, rpm: 24560 } },
          { propeller: "HQ5045 BN", supply_V: 12, max: { current_A: 20.7, thrust_g: 712, power_W: 248.4, rpm: 20080 } },
        ],
        note: "KV, configuration, stator, magnets and bearings from the product page; thrust rows are the last row of each voltage block in the RS2205-2300KV test table (full table in the source).",
        source: [SRC.product, SRC.test],
      },
    },
    {
      type: "data_gap",
      params: {
        fields: [
          "continuous / peak current rating",
          "operating / storage temperature",
          "internal resistance, idle current",
          "base flange thickness, mount hole depth, screw lengths",
          "mount pattern angle relative to the lead exit (drawn ~45°, not dimensioned)",
        ],
        note: "None of the EMAX sources state these.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "manufacturer CAD",
        note: "No STEP/3D model published: looked at the emaxmodel.com product page and emaxmodel.com/pages/downloads (manuals and firmware only). GrabCAD community models skipped (no licence stated). Geometry is representative, generated from the EMAX dimension drawing.",
        source: [SRC.product, SRC.cadSearch],
      },
    },
    {
      type: "assumption",
      params: {
        field: "generated geometry dimensions",
        value: "base flange 3 mm; M3 holes at the 2.5 mm tap drill; body height 16.7 mm (31.7 overall - 15 prop shaft); 12 mm lead stubs",
        reason: "The drawing gives the bell diameter, overall height, prop-shaft length and hole pattern but not these.",
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "EMAX RS2205 Cooling Series product page", type: "documentation", url: SRC.product },
    { id: "art_drawing", name: "RS2205 dimension drawing", type: "datasheet", url: SRC.drawing },
    { id: "art_test_data", name: "RS2205-2300KV thrust test table", type: "datasheet", url: SRC.test },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): representative CAD generated from the EMAX drawing by
// library/cad/py/catalog/emax-rs2205-2300kv.py — not manufacturer CAD.
// Frames are in the model's coordinates (mm, Z up, base at z = 0).
// ---------------------------------------------------------------------------

export const EMAX_RS2205_2300KV: ModuleDef = withGeometry(
  EMAX_RS2205_2300KV_BASE,
  {
    // The motor base. Origin: pattern centre on the base; normal: out of the
    // base (the arm approaches from -Z); xAxis: towards a hole of the pair.
    // Each 2-hole pair repeats every 180°.
    base_mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [0.70710678, -0.70710678, 0], symmetryDeg: 180 },
      refs: [
        feature("base_mount", { area_mm2: 47.124, centroid: [0.0, 0.0, 1.5] }),
        own("base_mount"),
        procedural("bolt_pattern"),
      ],
    },
    base_mount_19: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [0.70710678, 0.70710678, 0], symmetryDeg: 180 },
      refs: [
        feature("base_mount_19", { area_mm2: 47.124, centroid: [0.0, 0.0, 1.5] }),
        own("base_mount_19"),
        procedural("bolt_pattern"),
      ],
    },
    // Where the propeller seats: top of the bell, shaft axis +Z.
    shaft: {
      frame: { origin: [0, 0, 16.7], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      refs: [feature("shaft", { area_mm2: 235.619, centroid: [0.0, 0.0, 24.2] }), own("shaft"), procedural("shaft")],
    },
    // "phases" has no geometry of its own: it resolves to its three leads.
    phases_a: {
      frame: { origin: [24.95, -2, 1.5], normal: [1, 0, 0] },
      refs: [feature("phases_a", { area_mm2: 2.011, centroid: [24.95, -2.0, 1.5], normal: [1.0, 0.0, 0.0] }), own("phases_a")],
    },
    phases_b: {
      frame: { origin: [24.95, 0, 1.5], normal: [1, 0, 0] },
      refs: [feature("phases_b", { area_mm2: 2.011, centroid: [24.95, 0.0, 1.5], normal: [1.0, 0.0, 0.0] }), own("phases_b")],
    },
    phases_c: {
      frame: { origin: [24.95, 2, 1.5], normal: [1, 0, 0] },
      refs: [feature("phases_c", { area_mm2: 2.011, centroid: [24.95, 2.0, 1.5], normal: [1.0, 0.0, 0.0] }), own("phases_c")],
    },
  },
  cadArtifacts({
    dir: "library/parts/emax-rs2205-2300kv/artifacts/cad",
    name: "emax-rs2205",
    generator: "library/cad/py/catalog/emax-rs2205-2300kv.py",
    tool: "build123d 0.13.0",
    interfaces: ["base_mount", "base_mount_19", "shaft", "phases_a", "phases_b", "phases_c"],
  }),
);
