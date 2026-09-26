/**
 * REV Robotics Smart Robot Servo V1 (REV-41-1097) — datasheet-honest UHD part.
 *
 * Sources (see ./rev-41-1097-smart-robot-servo/sources.json):
 *   - src_docs:      REV docs, Smart Robot Servo V1 — https://docs.revrobotics.com/rev-crossover-products/servo/srs
 *   - src_manual:    REV-41-1097-UM-01 user's manual (2015) — https://revrobotics.ca/content/docs/REV-41-1097-UM.pdf
 *   - src_drawing:   REV-41-1097-DR-00 drawing (2017) — https://www.revrobotics.com/content/docs/REV-41-1097-DR.pdf
 *   - src_store_ca:  REV Robotics Canada store page (distributor) — https://revrobotics.ca/rev-41-1097/
 *   - src_cad:       REV-41-1097 STEP — https://www.revrobotics.com/content/cad/REV-41-1097.STEP
 *   - src_protopart: ProtoPart rev-41-1097-smart-robot-servo definition.json (community; starting point only)
 *
 * Modelling notes:
 *   - Identity: REV-41-1097 is the Smart Robot Servo V1. REV's docs list a
 *     separate SRS V2; the REV Canada store lists REV-41-1097 as
 *     Discontinued (www.revrobotics.com/rev-41-1097/ returned 404 on
 *     2026-09-26). Lifecycle recorded as a usage_note.
 *   - Electrical: 3-wire servo lead. Supply 4.8 V min, 6.0 V nominal, 7.4 V
 *     max; stall current 2.0 A at 6 V (max_current on the supply leaf; it is
 *     a stall figure, not a continuous draw). RC servo pulse 500-2500 us,
 *     1500 us centre. No REV source states the lead's wire colours,
 *     connector type or pin order, so the leaves carry no pin designators
 *     and the ProtoPart claim (female 3-pin, GND / PWM / V+) is recorded as
 *     a data_gap, not asserted. No frame rate is stated (data_gap).
 *   - `servo_control` is the PWM input (role input, pairs with a PWM output)
 *     binding V+, GND and signal.
 *   - Range: the 2015 manual says 180 deg default; REV's current docs and
 *     store say 270 deg (source_discrepancy; docs used). Speed 0.13 s/60 deg
 *     (manual, docs) vs 0.14 s/60 deg for current inventory (REV Canada
 *     store; source_discrepancy). Gear material "Metal" (manual) / "Brass"
 *     (docs): consistent, docs value kept.
 *   - Output: `spline` is a Shaft (output), 25T spline, Ø6.05 (drawing;
 *     tooth tips Ø6.0 in the STEP), M3 internal thread 6 mm deep (REV
 *     Canada store). Frame on the spline axis at the case top, normal +Z.
 *   - Mounting: four open-ended flange slots (R2.25 ends, drawing) on a
 *     10 x 49.5 mm rectangle. The drawing and datasheets give no hole
 *     spacing; it is measured from the manufacturer STEP (src_cad), recorded
 *     as a CAD-sourced usage_note, not a drawing fact. No fastener is named;
 *     the 4.5 mm slot takes M3 to M4 (assumption).
 *   - Thermal: no operating temperature in any REV source (data_gap); verify's
 *     thermal coverage warning is expected.
 *   - Geometry: vendor STEP bound by
 *     library/cad/py/catalog/rev-41-1097-smart-robot-servo.py (rotated so
 *     the case bottom is z = 0 and the spline points +Z). No licence on
 *     the product page; REV's site-wide IP Policy allows non-commercial use
 *     per CC BY-NC-SA 4.0 and needs a REV licence for commercial use: STEP
 *     not committed. The lead is not in the STEP, so the
 *     electrical interfaces have no geometry.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { BoltPattern, Ground, PowerIn, Shaft, defineModule } from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  docs: "https://docs.revrobotics.com/rev-crossover-products/servo/srs",
  manual: "https://revrobotics.ca/content/docs/REV-41-1097-UM.pdf",
  drawing: "https://www.revrobotics.com/content/docs/REV-41-1097-DR.pdf",
  storeCa: "https://revrobotics.ca/rev-41-1097/",
  cad: "https://www.revrobotics.com/content/cad/REV-41-1097.STEP",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/rev-41-1097-smart-robot-servo/definition.json",
} as const;

const pinFn = (description: string, source: string | string[] = [SRC.docs, SRC.manual]): TraitDef => ({
  type: "pin_functions",
  params: { description, source },
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

// ---------------------------------------------------------------------------
// Electrical: the 3-wire servo lead
// ---------------------------------------------------------------------------

const vPlus = withTraits(
  { ...PowerIn({ id: "v_plus", name: "V+", voltageV: [4.8, 7.4], nominalV: 6, maxCurrentA: 2.0 }), capabilities: ["power_in"] },
  [
    pinFn("Servo supply: 4.8 V min, 6.0 V nominal, 7.4 V max. Stall current 2.0 A at 6 V."),
    {
      type: "usage_note",
      params: { note: "max_current (2.0 A) is the stall current at 6 V; budget the supply for it.", source: [SRC.docs, SRC.manual] },
    },
  ],
);

const gnd = withTraits(Ground({ id: "gnd", name: "GND" }), [pinFn("Servo ground; common with the PWM source ground.")]);

const signal = withTraits(
  {
    id: "signal",
    name: "PWM signal",
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "pwm", roles: ["input"] }],
    capabilities: ["rc_pwm_in"],
  },
  [pinFn("RC servo pulse input: 500 us min, 1500 us centre, 2500 us max.")],
);

const servoControl: InterfaceDef = {
  id: "servo_control",
  name: "RC servo PWM input (V+, GND, signal)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "pwm", roles: ["input"] }],
  parameters: [{ id: "pulse_width", name: "Input pulse", unit: "µs", range: [500, 2500] }],
  slots: [
    { id: "power", required: true, match: { protocol: "power", role: "input", capability: "power_in" } },
    { id: "ground", required: true, match: { protocol: "power", role: "ground", capability: "ground" } },
    { id: "signal", required: true, match: { protocol: "pwm", role: "input", capability: "rc_pwm_in" } },
  ],
  profiles: [{ id: "servo_lead", label: "3-wire servo lead", default_active: true, bindings: { power: "v_plus", ground: "gnd", signal: "signal" } }],
  max_instances: 1,
  traits: [
    {
      type: "usage_note",
      params: {
        topic: "operating modes",
        note: "Default: angular servo, 270 deg over 500-2500 us with 1500 us centre. With the SRS Programmer (REV-31-1108): continuous rotation (500 us full CCW, 1500 us stop, 2500 us full CW, proportional between) or custom left/right angular limits (pulses past a limit are ignored and the servo holds the limit). Some controllers cannot produce the full 500-2500 us range; check the pulse if full travel is not seen.",
        source: [SRC.docs, SRC.manual, SRC.storeCa],
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "default angular range",
        values: ["180 deg over 500-2500 us (REV-41-1097-UM-01, 2015)", "270 deg over 500-2500 us (REV docs SRS V1; REV Canada store)"],
        sources: [SRC.manual, SRC.docs, SRC.storeCa],
        resolution: "270 deg (current REV documentation) used; early units per the 2015 manual may map the pulse range to 180 deg. Maximum programmable range in angular mode 280 deg (REV Canada store).",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Mechanical
// ---------------------------------------------------------------------------

const spline = withTraits(
  Shaft({
    id: "spline",
    name: "25T output spline",
    role: "output",
    diameterMm: 6.05,
    thread: "M3 internal, 6 mm deep",
    note: "25T output spline, Ø6.05 (drawing). Internal M3 thread 6 mm deep; do not exceed this depth (REV Canada store). Fits REV 25T servo horns and adapters (e.g. REV-41-1558 25T spline to 5 mm hex, REV-41-1828 horn, REV-21-2892 1/2 in hex). Spline and gears replaceable with REV-41-1168.",
  }),
  [
    {
      type: "source_discrepancy",
      params: {
        field: "spline diameter",
        values: ["Ø6.05 (drawing)", "Ø6.0 tooth tips (STEP)"],
        sources: [SRC.drawing, SRC.cad],
        resolution: "Drawing value used; 0.05 mm is within modelling tolerance.",
      },
    },
  ],
);

const mount = withTraits(
  BoltPattern({
    id: "mount",
    name: "4 flange slots, 10 x 49.5 mm",
    role: "component",
    shape: "rectangle",
    spacingMm: 10,
    spacingYmm: 49.5,
    holeCount: 4,
    fastener: "not named (4.5 mm open slots)",
    fastenerDiameterMm: [3, 4],
    threaded: false,
    note: "Four open-ended slots in the two mounting flanges, R2.25 mm ends (drawing), centred on a 10 x 49.5 mm rectangle (measured from the manufacturer STEP, src_cad; not on the drawing), 54 mm over the flanges. Mounting hardware is in the kit (manual); the servo is inserted through a cut-out and rests on the flange undersides.",
  }),
  [
    {
      type: "usage_note",
      params: {
        topic: "hole spacing provenance",
        field: "hole spacing",
        value: "10 x 49.5 mm",
        note: "CAD-sourced: the slot centres (±5, ±24.75) are measured from REV's own STEP (src_cad). The REV drawing dimensions only the 54 mm flange length and R2.25 slot ends, and no REV datasheet gives a hole spacing.",
        source_id: "src_cad",
        source: SRC.cad,
      },
    },
    {
      type: "assumption",
      params: {
        field: "fastener diameter",
        value: "3-4 mm",
        reason: "REV names no screw size; the 4.5 mm slot width (R2.25) clears M3 to M4 screws.",
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const REV_41_1097_BASE: ModuleDef = defineModule({
  id: "rev-41-1097-smart-robot-servo",
  name: "REV Smart Robot Servo (REV-41-1097)",
  version: "1.0.0",
  manufacturer: "REV Robotics",
  part_number: "REV-41-1097",
  description:
    "Configurable metal-geared smart servo (SRS V1): standard 270 deg angular servo out of the box (500-2500 us pulse), reprogrammable with the SRS Programmer for custom angular limits or continuous rotation. 4.8-7.4 V (6 V nominal), 2.0 A stall at 6 V, 13.5 kg-cm stall torque, 0.13 s/60 deg. 25T output spline, four flange mounting slots on 10 x 49.5 mm, 40.2 x 20.0 x 38.0 mm, 2.05 oz. Discontinued; succeeded by the SRS V2.",
  tags: ["rev", "servo", "smart-servo", "srs", "25t-spline", "pwm", "ftc", "frc", "continuous-rotation"],
  categories: ["actuator.motor.servo", "robotics.ftc"],

  interfaces: [vPlus, gnd, signal, servoControl, spline, mount],

  domains: [
    {
      domain: "electrical",
      power_domains: [{ id: "v_plus", name: "Servo supply", nominal_voltage_V: 6, voltage_range_V: [4.8, 7.4], max_current_mA: 2000 }],
      metadata: { stall_current_A_at_6V: 2.0, source: [SRC.docs, SRC.manual] },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 40.2, width: 20.0, height: 38.0 },
      weight_g: 58.1,
      metadata: {
        weight_note: "2.05 oz (58.1 g) as stated.",
        over_flanges_mm: 54,
        overall_height_mm: 43.7,
        gear_material: "brass (docs) / metal (manual)",
        source: [SRC.docs, SRC.manual, SRC.drawing],
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "servo",
        stall_torque_kgcm_at_6V: 13.5,
        stall_torque_ozin_at_6V: 187.8,
        speed_s_per_60deg_at_6V: 0.13,
        default_range_deg: 270,
        max_programmable_range_deg: 280,
        spline: "25T",
        modes: ["angular (default)", "angular with custom limits", "continuous rotation"],
        source: [SRC.docs, SRC.manual, SRC.storeCa],
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "speed at 6 V",
        values: ["0.13 s/60 deg (manual, docs)", "0.14 s/60 deg for current inventory (REV Canada store)"],
        sources: [SRC.manual, SRC.docs, SRC.storeCa],
        resolution: "0.13 s/60 deg (manufacturer documents) kept in the performance trait; late units may be slightly slower (0.14).",
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "lifecycle",
        note: "REV documents this part as Smart Robot Servo V1; a separate Smart Robot Servo V2 (Balanced and UltraSpeed) exists. The REV Canada store lists REV-41-1097 as Discontinued, and www.revrobotics.com/rev-41-1097/ returned 404 on 2026-09-26.",
        source: [SRC.docs, SRC.storeCa],
      },
    },
    {
      type: "usage_note",
      params: { topic: "kit contents", note: "Servo, servo horn (arm) assortment, horn mounting hardware (docs); the 2015 manual lists mounting hardware.", source: [SRC.docs, SRC.manual] },
    },
    {
      type: "data_gap",
      params: {
        fields: ["lead wire colours, length and connector type", "connector pin order", "PWM frame rate / period", "operating temperature"],
        note: "No REV source states them. ProtoPart claims a 3-wire female connector ordered GND / PWM / V+; not confirmed by REV, so no pin order is modelled.",
        source: SRC.protopart,
      },
    },
  ],

  artifacts: [
    { id: "art_docs", name: "REV docs: Smart Robot Servo V1", type: "documentation", url: SRC.docs },
    { id: "art_manual", name: "REV-41-1097 user's manual", type: "datasheet", url: SRC.manual },
    { id: "art_drawing", name: "REV-41-1097 drawing", type: "documentation", url: SRC.drawing },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796), vendor STEP bound by
// library/cad/py/catalog/rev-41-1097-smart-robot-servo.py. After the transform:
// case bottom z = 0, spline axis (0, 10.053) pointing +Z (case top 39.35,
// tip 43.55), flange undersides z ≈ 26.52, slots at (±5, ±24.75).
// ---------------------------------------------------------------------------

export const REV_41_1097_SMART_ROBOT_SERVO: ModuleDef = withGeometry(
  REV_41_1097_BASE,
  {
    // The flange underside rests on the plate; the plate is on the -Z side.
    mount: {
      frame: { origin: [0, 0, 26.52], normal: [0, 0, -1], xAxis: [1, 0, 0] },
      refs: [vendorFeature("mount", { area_mm2: 125.553, centroid: [0.0, 0.0, 27.869] }), vendorFeature("flange_face", { area_mm2: 208.638, centroid: [0.0, 0.0, 26.522] }), vendorOwn("mount"), procedural("bolt_pattern")],
    },
    // Where a horn seats: spline axis at the case top, pointing out (+Z).
    spline: {
      frame: { origin: [0, 10.053, 39.35], normal: [0, 0, 1], xAxis: [1, 0, 0] },
      refs: [vendorFeature("spline", { area_mm2: 7.728, centroid: [0.0, 10.053, 41.65] }), vendorOwn("spline"), procedural("shaft")],
    },
  },
  vendorCadArtifacts({
    partId: "rev-41-1097-smart-robot-servo",
    name: "REV-41-1097",
    url: SRC.cad,
    stepFile: "REV-41-1097.STEP",
    sha256: "2ae8de8a60ea26b95021ca04b3a71c2f0a68ec0f3b7cafd27d5b0353f536afb2",
    licence: "not stated on the product page; REV IP Policy: non-commercial use per CC BY-NC-SA 4.0, commercial use needs a REV licence; not redistributed",
    interfaces: ["mount", "spline"],
  }),
);
