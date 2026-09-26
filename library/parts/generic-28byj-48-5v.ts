/**
 * 28BYJ-48 5 V geared unipolar stepper motor (generic) — datasheet-honest UHD part.
 *
 * Identity caveat: the 28BYJ-48 is a generic motor made by many unnamed
 * factories; no original manufacturer publishes a datasheet. The most
 * complete named-maker document is the Kiatronics (Welten Holdings, NZ)
 * "28BYJ-48 – 5V Stepper Motor" sheet, which every value below comes from.
 * Units from other vendors may differ (see the `usage_note` "identity").
 *
 * Sources (see ./generic-28byj-48-5v/sources.json):
 *   - src_kiatronics:   Kiatronics 28BYJ-48 5V sheet (spec table, lead
 *                       schematic, dimension drawing) —
 *                       https://robocraft.ru/files/datasheet/28BYJ-48.pdf
 *   - src_kiatronics_mirror: same sheet at components101 (identical text) —
 *                       https://components101.com/sites/default/files/component_datasheet/28byj48-step-motor-datasheet.pdf
 *   - src_protopart:    ProtoPart 28byj-48-stepper-motor-5v (community; starting point only).
 *
 * Modelling notes:
 *   - Leads: five leads to a JST XHP-5 plug, numbered 1 Blue, 2 Pink,
 *     3 Yellow, 4 Orange, 5 Red on the sheet's schematic. Red is the common
 *     centre tap of both windings (+5 V); blue/yellow are the ends of one
 *     winding and pink/orange of the other. One leaf per lead; `pin` is the
 *     plug position number.
 *   - `unipolar_stepper` (role input) composes coil ends 1-4 and the common
 *     in plug order, so it pairs with generic-uln2003-stepper-driver-board's
 *     socket (A B C D PWR) slot-for-slot. Both types are new vocabulary
 *     (gaps.json).
 *   - Current: the sheet gives 5 VDC rated and 50 Ω ±7 % per winding half
 *     (DC resistance) but no current; `phase_current` 0.1 A is 5 V / 50 Ω
 *     (assumption trait: derived, ignores driver drop).
 *   - Mechanical: BoltPattern of 2 x Ø4.2±0.15 holes on 35±0.2 mm, modelled
 *     as a "rectangle" with Y spacing 0 (the builder has no 2-hole shape;
 *     the four generated positions collapse onto the two real holes).
 *     Shaft Ø5 double-flat (3 mm across), offset 8 mm from the can centre.
 *   - Thermal: no operating temperature in the source (data_gap); only the
 *     temperature rise (<40 K at 120 Hz) and insulation grade A.
 *   - Geometry: generated from the sheet's drawing (no manufacturer CAD).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { BoltPattern, PowerIn, Shaft, connectorTrait, defineModule } from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  kiatronics: "https://robocraft.ru/files/datasheet/28BYJ-48.pdf",
  mirror: "https://components101.com/sites/default/files/component_datasheet/28byj48-step-motor-datasheet.pdf",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/28byj-48-stepper-motor-5v/definition.json",
} as const;

const PLUG = connectorTrait("jst_xhp_5", {
  gender: "plug",
  positions: 5,
  pinout: ["1 Blue", "2 Pink", "3 Yellow", "4 Orange", "5 Red (common)"],
  note: "JST XHP-5 housing with SXH-001T-P0.6 contacts on AWG#26 UL1061 leads; 250±10 mm from the motor to the plug end (230±10 mm to the plug). Mates a 5-pin JST XH header.",
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function coilEnd(id: string, pin: string, colour: string, description: string): InterfaceDef {
  return {
    id,
    name: `${pin} ${colour}`,
    pin,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "stepper_phase", roles: ["input"] }],
    capabilities: ["stepper_phase"],
    traits: [{ type: "pin_functions", params: { description, source: SRC.kiatronics } }, PLUG],
  };
}

const leadBlue = coilEnd("lead_blue", "1", "Blue", "1 Blue: end of winding 1 (blue-red-yellow).");
const leadPink = coilEnd("lead_pink", "2", "Pink", "2 Pink: end of winding 2 (pink-red-orange).");
const leadYellow = coilEnd("lead_yellow", "3", "Yellow", "3 Yellow: other end of winding 1.");
const leadOrange = coilEnd("lead_orange", "4", "Orange", "4 Orange: other end of winding 2.");
const leadRed = withTraits(PowerIn({ id: "lead_red_common", name: "5 Red (common)", pin: "5", voltageV: 5 }), [
  {
    type: "pin_functions",
    params: { description: "5 Red: common centre tap of both windings; rated voltage 5 VDC.", source: SRC.kiatronics },
  },
  PLUG,
]);

const unipolar: InterfaceDef = {
  id: "unipolar_stepper",
  name: "Unipolar 5-wire stepper (JST XHP-5 plug)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "unipolar_stepper", roles: ["input"] }],
  max_instances: 1,
  parameters: [
    { id: "voltage", name: "Rated voltage", unit: "V", value: 5 },
    { id: "phase_current", name: "Current per energised half-winding (5 V / 50 Ω, derived)", unit: "A", value: 0.1 },
    { id: "phase_resistance", name: "DC resistance per half-winding @25 °C", unit: "Ω", value: 50, tolerance: { type: "percent", value: 7 } },
  ],
  slots: [
    { id: "coil_1", label: "1 Blue", required: true, match: { protocol: "stepper_phase", role: "input", capability: "stepper_phase" } },
    { id: "coil_2", label: "2 Pink", required: true, match: { protocol: "stepper_phase", role: "input", capability: "stepper_phase" } },
    { id: "coil_3", label: "3 Yellow", required: true, match: { protocol: "stepper_phase", role: "input", capability: "stepper_phase" } },
    { id: "coil_4", label: "4 Orange", required: true, match: { protocol: "stepper_phase", role: "input", capability: "stepper_phase" } },
    { id: "common", label: "5 Red", required: true, match: { protocol: "power", role: "input" } },
  ],
  profiles: [
    {
      id: "plug_order",
      label: "Plug 1-5: Blue Pink Yellow Orange Red",
      default_active: true,
      bindings: { coil_1: "lead_blue", coil_2: "lead_pink", coil_3: "lead_yellow", coil_4: "lead_orange", common: "lead_red_common" },
    },
  ],
  traits: [
    PLUG,
    {
      type: "usage_note",
      params: {
        topic: "drive",
        note: "4-phase unipolar: hold Red at +5 V and sink one (full step) or two adjacent coil ends to ground in sequence 1-2-3-4 (Blue, Pink, Yellow, Orange). Rated frequency 100 Hz; idle in-traction frequency > 600 Hz, idle out-traction > 1000 Hz.",
        source: SRC.kiatronics,
      },
    },
  ],
};

const mount = withTraits(
  BoltPattern({
    id: "mount",
    name: "Flange ears",
    role: "component",
    shape: "rectangle",
    spacingMm: 35,
    spacingYmm: 0,
    holeCount: 2,
    fastener: "Ø4.2 mm clearance holes (fastener not named; M3 or M4)",
    fastenerDiameterMm: [3, 4],
    threaded: false,
    note: "2-Ø4.2±0.15 holes on 35±0.2 mm centres through the flange ears (2-R3.5), on the shaft-side face. Two holes: modelled as a rectangle with 0 mm Y spacing.",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "fastener diameter",
        value: "3-4 mm (M3 or M4)",
        reason: "The drawing gives Ø4.2±0.15 holes only; M4 is the largest metric screw that clears them, M3 also fits.",
        source: SRC.kiatronics,
      },
    },
  ],
);

const shaft = Shaft({
  id: "shaft",
  name: "Output shaft (double flat)",
  role: "output",
  diameterMm: 5,
  note: "Ø5 (0/-0.1) mm, 10±0.5 mm from the flange face, two flats 3 (0/-0.1) mm across and 6±0.2 mm long; Ø9 x 1.5 mm boss. Axis 8 mm from the can centre. Output after a 1/64 gearbox.",
});

const GENERIC_28BYJ_48_5V_BASE: ModuleDef = defineModule({
  id: "generic-28byj-48-5v",
  name: "28BYJ-48 5 V geared stepper motor",
  version: "1.0.0",
  manufacturer: "Generic (28BYJ-48; Kiatronics datasheet as reference)",
  part_number: "28BYJ-48 - 5V",
  description:
    "Generic 28 mm 5 V 4-phase unipolar geared stepper: 1/64 speed variation ratio, stride angle 5.625°/64, 50 Ω ±7 % per winding half, pull-in torque 300 gf·cm, Ø5 mm double-flat shaft, 2 x Ø4.2 flange holes on 35 mm, five AWG26 leads to a JST XHP-5 plug. Values from the Kiatronics 28BYJ-48 sheet.",
  tags: ["28byj-48", "stepper", "unipolar", "geared", "5v", "5-wire", "jst-xh", "uln2003"],
  categories: ["actuator.motor.stepper"],

  interfaces: [leadBlue, leadPink, leadYellow, leadOrange, leadRed, unipolar, mount, shaft],

  interfaceGroups: [
    { id: "winding_1", label: "Winding 1 (Blue, Yellow; Red common)", members: ["lead_blue", "lead_yellow", "lead_red_common"], policy: "all_of" },
    { id: "winding_2", label: "Winding 2 (Pink, Orange; Red common)", members: ["lead_pink", "lead_orange", "lead_red_common"], policy: "all_of" },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [{ id: "coils", name: "Windings (common = Red)", nominal_voltage_V: 5 }],
      metadata: {
        phases: 4,
        dc_resistance_ohm: "50 ±7 % (25 °C)",
        insulation_resistance: ">10 MΩ (500 V)",
        insulation_withstand: "600 VAC / 1 mA / 1 s",
        insulation_grade: "A",
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 42, width: 31, height: 29 },
      metadata: {
        can: "Ø28 x 19 mm",
        flange: "35±0.2 mm hole centres, 2 x Ø4.2, R3.5 ears (42 mm across the ears)",
        shaft: "Ø5, 10 mm from the flange face, flats 3 mm across x 6 mm, 8 mm off the can centre",
        wire_cover: "14.6 mm wide, 17 mm from the can centre",
        lead: "5 x AWG#26 UL1061, 250±10 mm to the plug end",
        dimensions_note: "Body envelope without the lead and plug: length is the ear-to-ear span (35 + 2 x 3.5); width is the can top (14 above centre) to the wire cover (17 below); height is the can depth 19 plus the shaft 10 beyond the flange face.",
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "stepper_motor",
        rated_voltage_V: 5,
        speed_variation_ratio: "1/64",
        stride_angle: "5.625°/64",
        frequency_Hz: 100,
        idle_in_traction_frequency_Hz: "> 600",
        idle_out_traction_frequency_Hz: "> 1000",
        in_traction_torque: "> 34.3 mN·m (120 Hz)",
        self_positioning_torque: "> 34.3 mN·m",
        friction_torque: "600-1200 gf·cm",
        pull_in_torque: "300 gf·cm",
        noise: "< 35 dB (120 Hz, no load, 10 cm)",
        source: SRC.kiatronics,
      },
    },
    {
      type: "operating_conditions",
      params: {
        rated_voltage_V: 5,
        temperature_rise: "< 40 K (120 Hz)",
        insulation_grade: "A",
        note: "No ambient operating temperature is stated.",
        source: SRC.kiatronics,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "identity",
        note: "Generic part: the 28BYJ-48 is sold by many makers with the same drawing but unverified internals. 12 V versions (28BYJ-48-12V) use the same plug; check the label. This part is the 5 V version as described by the Kiatronics sheet.",
        source: [SRC.kiatronics, SRC.protopart],
      },
    },
    {
      type: "assumption",
      params: {
        field: "phase_current",
        value: "0.1 A",
        reason: "The sheet gives no current; 5 V / 50 Ω per energised half-winding, ignoring the driver's saturation drop.",
        source: SRC.kiatronics,
      },
    },
    {
      type: "assumption",
      params: {
        field: "CAD details",
        value: "flange 1 mm thick; wire cover 17 mm deep; plug as a 12.4 x 5.8 x 10 mm block 30 mm below the cover",
        reason: "Not dimensioned on the drawing; representative only. Can, holes, boss and shaft are from the drawing.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "manufacturer CAD",
        note: "No maker of the 28BYJ-48 publishes CAD. Looked at the Kiatronics sheet (drawing only), kiatronics.com (now a placeholder page with no products or downloads) and the ProtoPart artifacts (no CAD). Community models (GrabCAD) need a login and were not used without a clear licence. Geometry generated from the Kiatronics drawing (library/cad/py/catalog/generic-28byj-48-5v.py).",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "weight, operating temperature, exact gear ratio",
        note: "Not on the Kiatronics sheet. ProtoPart gives 30 g, -10..50 °C and 63.68395:1 without a manufacturer source; not used.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "lead length",
        values: ["250±10 mm to the plug end, 230±10 mm to the plug (Kiatronics drawing)", "240 mm (ProtoPart)"],
        sources: [SRC.kiatronics, SRC.protopart],
        resolution: "Kiatronics drawing values used.",
      },
    },
  ],

  artifacts: [
    { id: "art_datasheet", name: "Kiatronics 28BYJ-48 - 5V Stepper Motor sheet", type: "datasheet", url: SRC.kiatronics },
    { id: "art_datasheet_mirror", name: "Same sheet (components101 mirror)", type: "documentation", url: SRC.mirror },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796), generated: library/cad/py/catalog/generic-28byj-48-5v.py.
// Flange face at z = 0 (can toward -Z), holes at (±17.5, 0), shaft at (0, 8).
// ---------------------------------------------------------------------------

export const GENERIC_28BYJ_48_5V: ModuleDef = withGeometry(
  GENERIC_28BYJ_48_5V_BASE,
  {
    // The panel sits on the flange face (+Z side, shaft through it). No
    // symmetry: rotating 180° moves the offset shaft.
    mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      refs: [feature("mount", { area_mm2: 26.389, centroid: [0.0, 0.0, -0.5] }), own("mount"), procedural("bolt_pattern")],
    },
    shaft: {
      frame: { origin: [0, 8, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      refs: [feature("shaft", { area_mm2: 101.442, centroid: [0.0, 8.0, 3.903] }), own("shaft"), procedural("shaft")],
    },
    // The plug's mating face (representative position at the end of the lead).
    unipolar_stepper: {
      frame: { origin: [0, -47, -4.5], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      refs: [feature("plug", { area_mm2: 71.92, centroid: [0.0, -47.0, -4.5], normal: [0.0, 0.0, 1.0] })],
    },
  },
  cadArtifacts({
    dir: "library/parts/generic-28byj-48-5v/artifacts/cad",
    name: "generic-28byj-48-5v",
    generator: "library/cad/py/catalog/generic-28byj-48-5v.py",
    tool: "build123d 0.13.0",
    interfaces: ["mount", "shaft"],
  }),
);
