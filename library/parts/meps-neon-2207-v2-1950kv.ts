/**
 * MEPS NEON 2207 V2 brushless motor (1950KV, 6S) — datasheet-honest UHD part.
 *
 * Sources (see ./meps-neon-2207-v2-1950kv/sources.json):
 *   - src_product:       MEPSKING product page — https://www.mepsking.shop/neon-2207-fpv-brushless-motor.html
 *   - src_spec:          NEON 2207 V2 specification table — https://img-meps.mepsking.top/material/1/neon-2207-v2-motor-specification-pc.jpg
 *   - src_drawing:       NEON 2207 V2 size chart — https://img-meps.mepsking.top/material/1/neon-2207-v2-motor-size-chart-pc.jpg
 *   - src_test:          NEON 2207 V2 thrust test data — https://img-meps.mepsking.top/material/1/neon-2207-v2-motor-test-data-pc.jpg
 *   - src_package_photo: package contents photo — https://img-meps.mepsking.top/material/1/meps-neon-2207-v2-motor-package.jpg
 *
 * Modelling notes:
 *   - Variant lock: 1950KV only. The spec table rates 1950KV and 2050KV at 6S
 *     and 2550KV at 4S; the FAQ recommends 6S for 1950/2050KV and calls 1950KV
 *     the "balanced flight and efficiency" option. Every figure below is from
 *     the 1950 column / KV1950 test table. The page's headline "1817 g" thrust
 *     is the 2050KV + SZ5145 result and is deliberately NOT used.
 *   - `phases`: the three unlabelled, pre-tinned motor leads, modelled with
 *     BrushlessPhases (role input, bare_wire_lead). Leads carry no silkscreen
 *     label, so the builder's default A/B/C designators are used; any two may
 *     be swapped to reverse rotation. The only current figure the source gives
 *     is "Peak Current (60S) 42.97 A", mapped to `burst_current` (60 s
 *     duration in a usage_note); no continuous rating is stated, so
 *     `max_current` is omitted (data_gap). "Rated Voltage (Lipo) 6S" is a
 *     `cell_count` of 6; no volt figure is stated, so `voltage` is omitted.
 *     Lead gauge is not stated (data_gap).
 *   - `base_mount`: BoltPattern (component), 4x M3 on a 16 mm bolt circle per
 *     the drawing ("4-M3", "Ø16"). The FAQ calls this "standard 16×16mm
 *     mounting"; that is the same 16 mm hole-to-hole pattern, recorded as a
 *     source_discrepancy trait. The drawing shows only this one pattern.
 *     "4-M3" is read as tapped M3 holes (threaded: true).
 *   - `shaft`: Shaft (output) Φ5 mm, M5 thread. The prop nut is only shown in
 *     the package photo; nut handedness and rotation are not stated (data_gap).
 *   - Thermal: no operating temperature in any source, so there is no thermal
 *     domain. This justifies verify's "coverage" warning (a data_gap trait
 *     records it).
 *   - No SKU is published; part_number is the manufacturer's variant label.
 */
import type { ModuleDef } from "../../src/types/index.js";
import {
  BoltPattern,
  BrushlessPhases,
  Shaft,
  burstCurrentA,
  cellCount,
  defineModule,
} from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://www.mepsking.shop/neon-2207-fpv-brushless-motor.html",
  spec: "https://img-meps.mepsking.top/material/1/neon-2207-v2-motor-specification-pc.jpg",
  drawing: "https://img-meps.mepsking.top/material/1/neon-2207-v2-motor-size-chart-pc.jpg",
  test: "https://img-meps.mepsking.top/material/1/neon-2207-v2-motor-test-data-pc.jpg",
  package: "https://img-meps.mepsking.top/material/1/meps-neon-2207-v2-motor-package.jpg",
} as const;

// ---------------------------------------------------------------------------
// Electrical: three motor phase leads
// ---------------------------------------------------------------------------

const phaseInterfaces = BrushlessPhases({
  role: "input",
  termination: "bare_wire_lead",
  burstCurrentA: 42.97,
});

const phases = phaseInterfaces.map((iface) => {
  if (iface.id !== "phases") {
    return {
      ...iface,
      traits: [
        ...(iface.traits ?? []),
        {
          type: "pin_functions",
          params: {
            description:
              "Motor phase lead (unlabelled). Lead 150±2 mm, pre-tinned, 10 mm heat shrink at the motor, 3 mm stripped end.",
            source: [SRC.spec, SRC.drawing, SRC.product],
          },
        },
      ],
    };
  }
  return {
    ...iface,
    parameters: [...(iface.parameters ?? []), cellCount(6)],
    traits: [
      ...(iface.traits ?? []),
      {
        type: "connector",
        params: {
          connector_type: "bare_wire_lead",
          positions: 3,
          lead_length_mm: 150,
          lead_length_tolerance_mm: 2,
          heat_shrink_length_mm: 10,
          stripped_length_mm: 3,
          pre_tinned: true,
          lead_gauge_awg: null,
          note: "Lead 150±2 mm (spec table); heat shrink 10 mm and 3 mm strip (size chart); 'pre-tinned wires' (FAQ). Gauge not stated.",
          source: [SRC.spec, SRC.drawing, SRC.product],
        },
      },
      {
        type: "usage_note",
        params: {
          note: "Peak Current (60S) 42.97 A — the burst_current parameter is this 60-second peak; no continuous rating is published. Rated Voltage (Lipo) 6S. Manufacturer ESC recommendation: 35–55A (FAQ); 35A–60A BLHeli_32 / AM32 (review section).",
          burst_duration_s: 60,
          source: [SRC.spec, SRC.product],
        },
      },
    ],
  };
});

// ---------------------------------------------------------------------------
// Mechanical: base mount and output shaft
// ---------------------------------------------------------------------------

const baseMountBase = BoltPattern({
  id: "base_mount",
  name: "Base mount 4x M3 on 16 mm",
  role: "component",
  shape: "circle",
  spacingMm: 16,
  holeCount: 4,
  fastener: "M3",
  fastenerDiameterMm: 3,
  threaded: true,
  note: "Size chart '4-M3' on 'Ø16' (16 mm bolt circle); FAQ: 'standard 16×16mm mounting'. M3 socket-head screws are included (package photo); lengths not stated.",
});

const baseMount = {
  ...baseMountBase,
  traits: [
    ...(baseMountBase.traits ?? []),
    {
      type: "source_discrepancy",
      params: {
        field: "mount pattern designation",
        values: ["4-M3 on Ø16 bolt circle", "16×16mm"],
        sources: [SRC.drawing, SRC.product],
        resolution:
          "Drawing geometry used (16 mm circle, 4 holes). '16×16mm' is the FPV naming for the same 16 mm hole-to-hole pattern; hole_spacing is 16 mm either way.",
      },
    },
  ],
};

const shaft = Shaft({
  id: "shaft",
  name: "Output shaft Φ5 mm M5",
  role: "output",
  diameterMm: 5,
  thread: "M5",
  note: "Φ5 mm solid stainless-steel shaft (spec table, materials section), M5 thread with an 8 mm dimension on the threaded section (size chart). A flanged lock prop nut is included (package photo). Nut thread handedness and motor rotation direction are not stated.",
});

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const MEPS_NEON_2207_V2_1950KV_BASE: ModuleDef = defineModule({
  id: "meps-neon-2207-v2-1950kv",
  name: "MEPS NEON 2207 V2 1950KV Brushless Motor",
  version: "1.0.0",
  manufacturer: "MEPS",
  part_number: "NEON 2207 V2 1950KV",
  description:
    "2207, 12N14P, 1950KV brushless outrunner for 5-inch FPV drones, rated for 6S LiPo. Three 150 mm pre-tinned phase leads, 4x M3 base mount on a 16 mm circle, Φ5 mm M5-threaded shaft. 36 g including leads.",
  tags: ["brushless", "bldc", "fpv", "quadcopter", "motor", "2207", "6s", "5-inch"],
  categories: ["motor"],

  interfaces: [...phases, baseMount, shaft],

  domains: [
    {
      domain: "electrical",
      metadata: {
        rated_cells: 6,
        internal_resistance_mohm: 69,
        internal_resistance_tolerance_mohm: 5,
        idle_current_A_max: 1.6,
        idle_current_test_voltage_V: 10,
        peak_current_A: 42.97,
        peak_current_duration_s: 60,
        max_power_W: 1036,
        source: SRC.spec,
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 28.3, width: 28.3, height: 31.6 },
      weight_g: 36,
      metadata: {
        diameter_mm: 28.3,
        diameter_tolerance_mm: 0.2,
        overall_height_mm: 31.6,
        body_height_mm: 19.3,
        shaft_thread_dimension_mm: 8,
        weight_tolerance_g: 1,
        weight_includes_leads: true,
        materials: "6082 aluminium shell, stainless-steel shaft, NMB bearings, N50H magnets",
        source: [SRC.spec, SRC.drawing, SRC.product],
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "motor",
        kv_rpm_per_V: 1950,
        stator_size: "2207",
        configuration: "12N14P",
        rated_cells: 6,
        internal_resistance_mohm: 69,
        internal_resistance_tolerance_mohm: 5,
        idle_current_A_max: 1.6,
        idle_current_test_voltage_V: 10,
        peak_current_A: 42.97,
        peak_current_duration_s: 60,
        max_power_W: 1036,
        thrust_tests: [
          {
            propeller: "MEPS SZ5145",
            supply_V: 25.2,
            full_throttle: { thrust_g: 1699, current_A: 43.0, power_W: 1036, rpm: 30342, voltage_V: 24.1 },
            half_throttle: { thrust_g: 763, current_A: 10.4, power_W: 260, rpm: 20457 },
          },
          {
            propeller: "MEPS SZ4942",
            supply_V: 25.2,
            full_throttle: { thrust_g: 1584, current_A: 41.8, power_W: 1009, rpm: 31973, voltage_V: 24.2 },
            half_throttle: { thrust_g: 648, current_A: 9.5, power_W: 237, rpm: 20929 },
          },
        ],
        note: "KV, configuration, resistance, currents and power from the 1950 column of the spec table; stator size from the page text; thrust from the KV1950 test table (10%-step table in the source).",
        source: [SRC.spec, SRC.test, SRC.product],
      },
    },
    {
      type: "data_gap",
      params: {
        fields: [
          "continuous current rating",
          "maximum voltage in volts",
          "lead wire gauge",
          "operating / storage temperature",
          "prop nut thread handedness and rotation direction",
          "mounting screw lengths / max engagement depth",
          "part number / SKU",
        ],
        note: "None of the manufacturer sources state these.",
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "MEPS NEON 2207 V2 product page", type: "documentation", url: SRC.product },
    { id: "art_spec_table", name: "NEON 2207 V2 specification table", type: "datasheet", url: SRC.spec },
    { id: "art_size_chart", name: "NEON 2207 V2 size chart", type: "cad", url: SRC.drawing },
    { id: "art_test_data", name: "NEON 2207 V2 thrust test data", type: "datasheet", url: SRC.test },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-775): representative CAD generated from this definition's own
// dimensions by library/cad/py/parts.py — not manufacturer CAD. Frames are in
// the body's coordinates (mm); refs list D1 feature, D2 own artifact, D3
// procedural, in that order. See docs/geometry-artifacts.md.
// ---------------------------------------------------------------------------

export const MEPS_NEON_2207_V2_1950KV: ModuleDef = withGeometry(
  MEPS_NEON_2207_V2_1950KV_BASE,
  {
    // The motor face. Origin: bolt-circle centre on the base; normal: out of
    // the base (the arm approaches from -Z); xAxis: toward hole #1 is at 45°
    // from it, and the 4-hole pattern repeats every 90°.
    base_mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0], symmetryDeg: 90 },
      refs: [
        feature("base_mount", { area_mm2: 524.646, centroid: [0.0, 0.0, 0.0], normal: [0.0, 0.0, -1.0] }),
        own("base_mount"),
        feature("baseMount", undefined, "cad_kcl"),
        { kind: "artifact", artifact: "cad_kcl_base_mount" },
        procedural("bolt_pattern"),
      ],
    },
    // Where the propeller seats: top of the bell, shaft axis +Z.
    shaft: {
      frame: { origin: [0, 0, 19.3], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      refs: [feature("shaft", { area_mm2: 193.208, centroid: [0.0, 0.0, 25.45] }), own("shaft"), procedural("shaft")],
    },
    // "phases" has no geometry of its own: it resolves to its three leads.
    phases_a: {
      frame: { origin: [25.15, -2.2, 1.5], normal: [1, 0, 0] },
      refs: [feature("phases_a", { area_mm2: 2.011, centroid: [25.15, -2.2, 1.5], normal: [1.0, 0.0, 0.0] }), own("phases_a")],
    },
    phases_b: {
      frame: { origin: [25.15, 0, 1.5], normal: [1, 0, 0] },
      refs: [feature("phases_b", { area_mm2: 2.011, centroid: [25.15, 0.0, 1.5], normal: [1.0, 0.0, 0.0] }), own("phases_b")],
    },
    phases_c: {
      frame: { origin: [25.15, 2.2, 1.5], normal: [1, 0, 0] },
      refs: [feature("phases_c", { area_mm2: 2.011, centroid: [25.15, 2.2, 1.5], normal: [1.0, 0.0, 0.0] }), own("phases_c")],
    },
  },
  [
    ...cadArtifacts({
    dir: "library/parts/meps-neon-2207-v2-1950kv/artifacts/cad",
    name: "meps-neon-2207-v2",
    generator: "library/cad/py/parts.py",
    tool: "build123d 0.13.0",
    interfaces: ["base_mount", "shaft", "phases_a", "phases_b", "phases_c"],
  }),
    {
      id: "cad_kcl",
      name: "Motor (KCL)",
      type: "cad",
      role: "source",
      format: "kcl",
      units: "mm",
      filePath: "library/cad/kcl/motor.kcl",
      description: "KCL body; the motor face is the extrude start cap tagged $baseMount.",
      provenance: { tool: "Zoo KCL" },
    },
    {
      id: "cad_kcl_base_mount",
      name: "Motor face (KCL)",
      type: "cad",
      role: "interface",
      interfaceId: "base_mount",
      format: "kcl",
      units: "mm",
      filePath: "library/cad/kcl/motor_base_mount.kcl",
      provenance: { tool: "Zoo KCL" },
    },
  ],
);
