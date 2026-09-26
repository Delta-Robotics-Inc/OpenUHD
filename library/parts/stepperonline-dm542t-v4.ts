/**
 * STEPPERONLINE DM542T (V4.0) digital stepper drive — datasheet-honest UHD part.
 *
 * Sources (see ./stepperonline-dm542t-v4/sources.json):
 *   - src_manual_v4: DM542T(V4.0) user manual, Revision 4.0 (Oct 2020) —
 *                    https://www.omc-stepperonline.com/download/DM542T_V4.0.pdf
 *   - src_product:   STEPPERONLINE DM542T product page (UK store) —
 *                    https://www.stepperonline.co.uk/digital-stepper-driver-1-0-4-2a-20-50vdc-for-nema-17-23-24-stepper-motor-dm542t.html
 *   - src_manual_v1: DM542T user manual (pre-V4, 1.0-4.2 A, 20-50 VDC) —
 *                    https://www.omc-stepperonline.com/download/DM542T.pdf (context only)
 *   - src_protopart: ProtoPart stepperonline-dm542t definition (community;
 *                    starting point only).
 *
 * Modelling notes:
 *   - Variant lock: V4.0. The product page states "Currently, DM542T shipped
 *     from all warehouses is the newest version V4.0", so every value is from
 *     the V4.0 manual (18-50 VDC, 1.0-4.5 A peak, 5 V/24 V selector S2, ALM
 *     output, 16 microstep settings). The older DM542T.pdf (20-50 VDC,
 *     1.0-4.2 A, no selector, no fault output) is cited only for the
 *     discrepancy. ProtoPart mixed the two (source_discrepancy trait).
 *   - Terminals: one leaf per screw terminal, `pin` = the manual's pin name.
 *     P1 control: PUL+ PUL- DIR+ DIR- ENA+ ENA- (optically isolated; high
 *     4.5-5 V or 24 V per S2, low 0-0.5 V; factory setting 24 V). P2 fault:
 *     ALM+ ALM- (30 V/100 mA, sinking or sourcing). P3: GND, +Vdc, A+, A-,
 *     B+, B-.
 *   - `step_dir` composes PUL+/DIR+/ENA+ (ENA optional: "default no
 *     connection" = enabled). The - terminals are the opto returns; how they
 *     are wired depends on common-anode vs common-cathode control (manual
 *     §4.1), recorded as a usage_note rather than modelled as slots.
 *     `step_dir` is a new protocol type (vocabulary gap).
 *   - Motor: `bipolar_stepper_phases` (role output) with slots A+, A-, B+, B-
 *     in the same order as stepperonline-17hs08-1004s, so the pair validates
 *     slot-for-slot. `phase_current` is the settable RMS range 0.71-3.20 A
 *     (DIP SW1-3; peak 1.00-4.50 A) so DRC range-checks a motor's rated
 *     current against it.
 *   - Supply: PowerIn 18-50 VDC (spec table), 24-48 V recommended, 36 V
 *     typical on the product page. The manual's own feature list says
 *     20-50 VDC (source_discrepancy). No supply current is stated.
 *   - Mechanical: BoltPattern from Figure 1: 4 x Φ3.5 holes in the base,
 *     112 mm (X) x 22.5 mm (Y, from 25.3 and 47.8 mm) on a 118 x 75.5 mm
 *     footprint. The height is not clearly dimensioned (assumption trait);
 *     side-mount slots are noted but not modelled as a second pattern.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  BoltPattern,
  Ground,
  PowerIn,
  connectorTrait,
  defineModule,
  maxCurrentA,
  maxFrequencyHz,
  voltageRangeV,
} from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  manualV4: "https://www.omc-stepperonline.com/download/DM542T_V4.0.pdf",
  product:
    "https://www.stepperonline.co.uk/digital-stepper-driver-1-0-4-2a-20-50vdc-for-nema-17-23-24-stepper-motor-dm542t.html",
  manualV1: "https://www.omc-stepperonline.com/download/DM542T.pdf",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/stepperonline-dm542t/definition.json",
} as const;

const P1 = connectorTrait("screw_terminal", {
  positions: 6,
  pinout: ["PUL+", "PUL-", "DIR+", "DIR-", "ENA+", "ENA-"],
  note: "P1 control connector (manual §3.1, Figure 2). Pluggable screw terminal block; do not plug/unplug while powered. Shielded cable required.",
});
const P2 = connectorTrait("screw_terminal", {
  positions: 2,
  pinout: ["ALM+", "ALM-"],
  note: "P2 fault output connector (manual §3.2).",
});
const P3 = connectorTrait("screw_terminal", {
  positions: 6,
  pinout: ["GND", "+Vdc", "A+", "A-", "B+", "B-"],
  note: "P3 motor and power supply connector (manual §3.3). Pin order as printed on the case (Figure 2). Do not plug/unplug while powered.",
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function fn(description: string, source: string | string[] = SRC.manualV4): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

// ---------------------------------------------------------------------------
// P1 — optically isolated control inputs
// ---------------------------------------------------------------------------

function optoInput(id: string, pin: string, description: string, extra: InterfaceDef["parameters"] = []): InterfaceDef {
  return {
    id,
    name: pin,
    pin,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "digital", roles: ["input"] }],
    capabilities: ["digital_io", "opto_isolated"],
    parameters: [voltageRangeV(4.5, 24), { id: "input_current", name: "Logic signal current (typical 10 mA)", unit: "mA", range: [7, 16] }, ...extra],
    traits: [fn(description), P1],
  };
}

const pulPos = optoInput(
  "pul_pos",
  "PUL+",
  "PUL+: pulse (step) input, anode side. Optically isolated; high 4.5-5 V or 24 V (S2), low 0-0.5 V. Max 200 kHz; pulse width at least 2.5 µs, duty 50% recommended; each rising edge is one step.",
  [maxFrequencyHz([0, 200_000])],
);
const pulNeg = optoInput("pul_neg", "PUL-", "PUL-: pulse input, cathode side (opto return).");
const dirPos = optoInput(
  "dir_pos",
  "DIR+",
  "DIR+: direction input, anode side. DIR must lead the PUL edge by at least 5 µs. Swapping one winding's leads also reverses direction.",
);
const dirNeg = optoInput("dir_neg", "DIR-", "DIR-: direction input, cathode side (opto return).");
const enaPos = optoInput(
  "ena_pos",
  "ENA+",
  "ENA+: enable input, anode side (default not connected = enabled). 4.5-24 V disables the drive, 0-0.5 V enables it; ENA must lead DIR by at least 200 ms (sequence chart remark t1; the P1 table says 5 µs, so 200 ms is the safe value); enable time at least 200 ms.",
);
const enaNeg = optoInput("ena_neg", "ENA-", "ENA-: enable input, cathode side (opto return).");

const stepDir: InterfaceDef = {
  id: "step_dir",
  name: "Step / direction control (P1)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "step_dir", roles: ["input"] }],
  max_instances: 1,
  parameters: [maxFrequencyHz([0, 200_000])],
  slots: [
    { id: "pul", label: "PUL", required: true, match: { protocol: "digital", role: "input" } },
    { id: "dir", label: "DIR", required: true, match: { protocol: "digital", role: "input" } },
    { id: "ena", label: "ENA", required: false, match: { protocol: "digital", role: "input" } },
  ],
  profiles: [
    { id: "anode_side", label: "PUL+/DIR+/ENA+", default_active: true, bindings: { pul: "pul_pos", dir: "dir_pos", ena: "ena_pos" } },
  ],
  traits: [
    P1,
    {
      type: "usage_note",
      params: {
        topic: "control wiring",
        note: "Single-ended or differential PUL/DIR/ENA. Open-collector controller (common-anode): controller VCC to PUL+/DIR+/ENA+, controller outputs to PUL-/DIR-/ENA-. PNP controller (common-cathode): outputs to PUL+/DIR+/ENA+, controller GND to the - terminals. S2 selects 5 V or 24 V signal amplitude (factory 24 V; with 5 V signals S2 must be set to 5 V or the motor won't work; with 12 V set S2 to 5 V and add a 1 kΩ series resistor).",
        source: SRC.manualV4,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "timing",
        note: "t1: ENA ahead of DIR >= 200 ms; t2: DIR ahead of the PUL active edge >= 5 µs; t3: pulse width >= 2.5 µs; t4: low level width >= 2.5 µs; pulse duty 50% recommended. Max pulse input frequency 200 kHz. PUL/DIR mode only (no pulse/pulse mode).",
        source: SRC.manualV4,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// P2 — fault output
// ---------------------------------------------------------------------------

const almPos: InterfaceDef = {
  id: "alm_pos",
  name: "ALM+",
  pin: "ALM+",
  domain: "electrical",
  exposed: true,
  default_active: false,
  protocols: [{ type: "digital", roles: ["output"] }],
  capabilities: ["digital_io", "opto_isolated", "fault_output"],
  parameters: [voltageRangeV(0, 30), maxCurrentA(0.1)],
  traits: [
    fn("ALM+: fault output, maximum 30 V/100 mA, sinking or sourcing. ALM+ to ALM- is low impedance by default and changes to high impedance when the drive enters error protection (over-current or over-voltage)."),
    P2,
  ],
};
const almNeg: InterfaceDef = {
  ...almPos,
  id: "alm_neg",
  name: "ALM-",
  pin: "ALM-",
  traits: [fn("ALM-: fault output return (see ALM+)."), P2],
};

// ---------------------------------------------------------------------------
// P3 — supply
// ---------------------------------------------------------------------------

const vdc = withTraits(PowerIn({ id: "vdc", name: "+Vdc", pin: "+Vdc", voltageV: [18, 50], nominalV: 36 }), [
  fn("+Vdc: power supply positive, 18-50 VDC; 24-48 VDC recommended. Leave room for line fluctuation and motor back-EMF. Over-voltage protection trips above 60 VDC (red LED 2 blinks).", [SRC.manualV4, SRC.product]),
  P3,
]);
const gnd = withTraits(Ground({ id: "gnd", name: "GND", pin: "GND" }), [fn("GND: power supply ground connection."), P3]);

// ---------------------------------------------------------------------------
// P3 — motor outputs
// ---------------------------------------------------------------------------

function phaseOut(id: string, pin: string, description: string): InterfaceDef {
  return {
    id,
    name: pin,
    pin,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "stepper_phase", roles: ["output"] }],
    capabilities: ["stepper_phase"],
    parameters: [maxCurrentA(4.5)],
    traits: [fn(description), P3],
  };
}

const motorLeaves = [
  phaseOut("motor_a_pos", "A+", "A+: motor phase A. Connect motor A+ wire to A+."),
  phaseOut("motor_a_neg", "A-", "A-: motor phase A. Connect motor A- wire to A-."),
  phaseOut("motor_b_pos", "B+", "B+: motor phase B. Connect motor B+ wire to B+."),
  phaseOut("motor_b_neg", "B-", "B-: motor phase B. Connect motor B- wire to B-."),
];

const motorOut: InterfaceDef = {
  id: "bipolar_stepper_phases",
  name: "Motor outputs A+ A- B+ B- (P3)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "bipolar_stepper_phases", roles: ["output"] }],
  max_instances: 1,
  parameters: [
    { id: "phase_current", name: "Output current per phase, RMS (DIP SW1-3)", unit: "A", range: [0.71, 3.2] },
    maxCurrentA(4.5),
  ],
  slots: [
    { id: "phase_a_pos", label: "A+", required: true, match: { protocol: "stepper_phase", role: "output", capability: "stepper_phase" } },
    { id: "phase_a_neg", label: "A-", required: true, match: { protocol: "stepper_phase", role: "output", capability: "stepper_phase" } },
    { id: "phase_b_pos", label: "B+", required: true, match: { protocol: "stepper_phase", role: "output", capability: "stepper_phase" } },
    { id: "phase_b_neg", label: "B-", required: true, match: { protocol: "stepper_phase", role: "output", capability: "stepper_phase" } },
  ],
  profiles: [
    {
      id: "terminals",
      label: "A+ A- B+ B-",
      default_active: true,
      bindings: { phase_a_pos: "motor_a_pos", phase_a_neg: "motor_a_neg", phase_b_pos: "motor_b_pos", phase_b_neg: "motor_b_neg" },
    },
  ],
  traits: [
    P3,
    {
      type: "usage_note",
      params: {
        topic: "current setting",
        note: "SW1-SW3 peak (RMS): 1.00 (0.71), 1.46 (1.04), 1.91 (1.36), 2.37 (1.69), 2.84 (2.03), 3.31 (2.36), 3.76 (2.69), 4.50 (3.20) A. For a 4-lead motor set peak = 1.4 x the motor's rated phase current. SW4: idle current 50% (OFF) or 90% (ON) of the setting, applied 0.4 s after the last pulse. Motor auto-identification and parameter auto-configuration at power-on.",
        source: SRC.manualV4,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "microstep setting",
        note: "SW5-SW8 select 16 resolutions: 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 1000, 2000, 4000, 5000, 8000, 10000, 20000, 25000 steps/rev (for a 1.8° motor).",
        source: SRC.manualV4,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "motor compatibility",
        note: "Drives 2-phase and 4-phase bipolar hybrid stepper motors, NEMA 11 to 24. Keep motor wires at least 10 cm from PUL/DIR wires; never plug/unplug the motor while powered (back-EMF surge can damage the drive).",
        source: SRC.manualV4,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Mechanical
// ---------------------------------------------------------------------------

const baseMount = withTraits(
  BoltPattern({
    id: "base_mount",
    name: "Base mounting holes",
    role: "component",
    shape: "rectangle",
    spacingMm: 112,
    spacingYmm: 22.5,
    holeCount: 4,
    fastener: "Φ3.5 mm hole (fastener not named; M3 fits)",
    fastenerDiameterMm: 3,
    threaded: false,
    note: "4-Φ3.5 holes through the base flanges: 112 mm apart in X, at 25.3 and 47.8 mm from the 75.5 mm edge (22.5 mm apart in Y). The manual recommends side mounting (slots 4.5 mm wide on the 112 mm end flanges of the side view) for better heat dissipation; that side pattern is not modelled.",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "fastener diameter",
        value: "3 mm (M3)",
        reason: "The drawing gives Φ3.5 holes but names no fastener; M3 is the largest metric screw that clears Φ3.5.",
        source: SRC.manualV4,
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const STEPPERONLINE_DM542T_V4_BASE: ModuleDef = defineModule({
  id: "stepperonline-dm542t-v4",
  name: "STEPPERONLINE DM542T (V4.0) digital stepper drive",
  version: "1.0.0",
  manufacturer: "STEPPERONLINE (manufactured by Leadshine per the pre-V4 manual)",
  part_number: "DM542T (V4.0)",
  description:
    "2-phase digital stepper drive, PUL/DIR control with optically isolated 5 V/24 V inputs, 18-50 VDC supply (24-48 V recommended), 1.0-4.5 A peak (0.71-3.2 A RMS) in 8 DIP steps, 200-25600 steps/rev, 200 kHz max pulse rate, fault (ALM) output, over-voltage and over-current protection. 118 x 75.5 mm footprint, 230 g. For NEMA 11-24 bipolar steppers.",
  tags: ["stepper-driver", "dm542t", "bipolar", "pul-dir", "step-dir", "opto-isolated", "nema17", "nema23", "nema24", "stepperonline"],
  categories: ["actuator.motor_controller"],

  interfaces: [pulPos, pulNeg, dirPos, dirNeg, enaPos, enaNeg, stepDir, almPos, almNeg, vdc, gnd, ...motorLeaves, motorOut, baseMount],

  interfaceGroups: [
    { id: "pul_pair", label: "PUL+/PUL- opto input", members: ["pul_pos", "pul_neg"], policy: "all_of" },
    { id: "dir_pair", label: "DIR+/DIR- opto input", members: ["dir_pos", "dir_neg"], policy: "all_of" },
    { id: "winding_a", label: "Motor phase A (A+/A-)", members: ["motor_a_pos", "motor_a_neg"], policy: "all_of" },
    { id: "winding_b", label: "Motor phase B (B+/B-)", members: ["motor_b_pos", "motor_b_neg"], policy: "all_of" },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vdc", name: "Main supply (+Vdc/GND)", nominal_voltage_V: 36, voltage_range_V: [18, 50] },
        { id: "logic_isolated", name: "Opto-isolated control inputs", voltage_range_V: [4.5, 24] },
      ],
      metadata: {
        output_current_peak_A: [1.0, 4.5],
        output_current_rms_A: [0.71, 3.2],
        logic_signal_current_mA: { min: 7, typical: 10, max: 16 },
        isolation_resistance_Mohm: 500,
        max_pulse_frequency_kHz: 200,
        min_pulse_width_us: 2.5,
        min_direction_setup_us: 5,
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 118, width: 75.5, height: 25.5 },
      weight_g: 230,
      metadata: {
        mounting: "4 x Φ3.5 on 112 x 22.5 mm (base); side mounting recommended",
        height_note: "25.5 mm is the only vertical dimension in Figure 1 (assumption trait); ProtoPart states 34 mm.",
        connectors: "P1 control, P2 fault output, P3 power + motor (pluggable screw terminals), S1 8-bit DIP, S2 5V/24V selector, green power LED, red fault LED",
      },
    },
    {
      domain: "thermal",
      operating_temperature_C: [0, 40],
      metadata: { storage_temperature_C: [-20, 65], cooling: "Natural or forced cooling", reliable_working_temperature: "< 40 °C", humidity: "40-90% RH", vibration: "10-50 Hz / 0.15 mm" },
    },
  ],

  traits: [
    {
      type: "operating_conditions",
      params: {
        supply_voltage_V: [18, 50],
        recommended_supply_V: [24, 48],
        operating_temperature_C: [0, 40],
        storage_temperature_C: [-20, 65],
        humidity: "40%RH-90%RH",
        vibration: "10-50Hz / 0.15mm",
        environment: "Avoid dust, oil fog and corrosive gases",
        source: SRC.manualV4,
      },
    },
    {
      type: "absolute_maximum",
      params: {
        supply_voltage_V: 50,
        over_voltage_protection: "activates when drive working voltage is greater than 60 VDC (red LED blinks 2 times)",
        over_current_protection: "activates when peak current exceeds the limit (red LED blinks once)",
        alm_output: "30 V / 100 mA",
        note: "After a protection trip the motor shaft is free; reset by repowering.",
        source: SRC.manualV4,
      },
    },
    {
      type: "performance",
      params: {
        kind: "stepper_drive",
        microstep_resolutions_steps_per_rev: [200, 400, 800, 1600, 3200, 6400, 12800, 25600, 1000, 2000, 4000, 5000, 8000, 10000, 20000, 25000],
        output_current_peak_settings_A: [1.0, 1.46, 1.91, 2.37, 2.84, 3.31, 3.76, 4.5],
        features: ["anti-resonance", "auto-tuning / motor auto-identification", "soft-start", "idle current reduction 50% or 90%"],
        source: SRC.manualV4,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "LEDs",
        note: "Green: power indicator. Red: protection indicator, flashes 1-2 times in a 3-second period (1 = over-current, 2 = over-voltage, 3 = reserved).",
        source: SRC.manualV4,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "power supply",
        note: "Several drives may share one supply if it has capacity, but wire each drive to the supply separately; do not daisy-chain the power inputs. Add an EMI line filter between supply and drive in noisy environments.",
        source: SRC.manualV4,
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "supply voltage minimum",
        values: ["18 VDC (V4.0 manual specification table; product page \"+18~50VDC\")", "20 VDC (V4.0 manual feature list \"Input voltage 20-50VDC\"; pre-V4 manual)"],
        sources: [SRC.manualV4, SRC.product, SRC.manualV1],
        resolution: "Specification table value 18-50 VDC used (the product page agrees); design for >= 20 V to satisfy both.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "variant (ProtoPart)",
        values: [
          "ProtoPart: 20-50 VDC, 1.0-4.2 A peak, 15 microstep settings (pre-V4 DM542T) plus a \"5 V or 24 V logic\" selector (V4.0 only); no ALM output; height 34 mm",
          "V4.0 manual: 18-50 VDC, 1.0-4.5 A peak, 16 microstep settings incl. 200, 5 V/24 V selector S2, ALM+/ALM- fault output",
        ],
        sources: [SRC.protopart, SRC.manualV4, SRC.manualV1],
        resolution: "V4.0 values used (the only version now shipped, per the product page). The pre-V4 manual's 1.0-4.2 A table and 20-50 V range are not used.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "weight / operating temperature",
        values: ["230 g, operating 0-40 °C (V4.0 manual)", "Approx. 210 g, ambient 0-65 °C, operating 0-40 °C (product page); 210 g, operating -10-45 °C (pre-V4 manual)"],
        sources: [SRC.manualV4, SRC.product, SRC.manualV1],
        resolution: "V4.0 manual values used (230 g, 0-40 °C).",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "overall height",
        values: [
          "25.5 mm (V4.0 manual Figure 1 side view: the only vertical dimension, spanning the full side outline)",
          "34 mm (ProtoPart dimensions_mm.height; no source cited)",
        ],
        sources: [SRC.manualV4, SRC.protopart],
        resolution: "25.5 mm used (manufacturer drawing). The 34 mm figure is unsourced; allow extra clearance above the drive for pluggable terminal plugs and wiring.",
      },
    },
    {
      type: "assumption",
      params: {
        field: "overall height and CAD layout",
        value: "25.5 mm height; 3 mm base plate; P1/P2/P3 terminal blocks along the +Y long side (representative sizes)",
        reason: "Figure 1 dimensions only the footprint, the holes and a 25.5 mm side-view dimension that spans the whole side outline (read as the overall body height; the drawing does not label it as height, and plugs/wires above the terminals are not drawn); connector positions follow the Figure 2 photo order, not a dimensioned drawing. ProtoPart's 34 mm height has no cited source.",
        source: SRC.manualV4,
      },
    },
    {
      type: "data_gap",
      params: {
        field: "manufacturer CAD",
        note: "The product page lists DM542T(V4.0).STEP (1.98 MB, get_file&file=382/DM542T(V4.0).STEP). omc-stepperonline.com returns 403 and stepperonline.co.uk's get_file returns a Cloudflare browser challenge from this environment; no Wayback capture. Geometry is generated from the manual drawing (library/cad/py/catalog/stepperonline-dm542t-v4.py). A human download of the STEP would allow switching to vendor CAD.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "supply current, terminal wire gauge, logic input thresholds for 5 V mode",
        note: "Not stated in the V4.0 manual or on the product page.",
      },
    },
  ],

  artifacts: [
    { id: "art_manual_v4", name: "DM542T(V4.0) user manual", type: "datasheet", url: SRC.manualV4 },
    { id: "art_product", name: "STEPPERONLINE DM542T product page", type: "documentation", url: SRC.product },
    { id: "art_manual_v1", name: "DM542T user manual (pre-V4)", type: "documentation", url: SRC.manualV1 },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796), generated: library/cad/py/catalog/stepperonline-dm542t-v4.py.
// Base underside at z = 0, footprint centred, terminals along +Y.
// ---------------------------------------------------------------------------

const P1_REF = feature("P1", { area_mm2: 360.0, centroid: [30.0, 37.75, 9.0], normal: [0.0, 1.0, 0.0] });
const P2_REF = feature("P2", { area_mm2: 120.0, centroid: [4.0, 37.75, 9.0], normal: [0.0, 1.0, 0.0] });
const P3_REF = feature("P3", { area_mm2: 432.0, centroid: [-28.0, 37.75, 9.0], normal: [0.0, 1.0, 0.0] });
const onP1 = { refs: [P1_REF] };
const onP2 = { refs: [P2_REF] };
const onP3 = { refs: [P3_REF] };

export const STEPPERONLINE_DM542T_V4: ModuleDef = withGeometry(
  STEPPERONLINE_DM542T_V4_BASE,
  {
    // Hole-pattern centre on the underside; the mounting plate is below (-Z).
    // The rectangle repeats every 180°, but the terminal side matters for wiring.
    base_mount: {
      frame: { origin: [0, -1.2, 0], normal: [0, 0, -1], xAxis: [1, 0, 0], symmetryDeg: 180 },
      refs: [feature("base_mount", { area_mm2: 131.947, centroid: [0.0, -1.2, 1.5] }), own("base_mount"), procedural("bolt_pattern")],
    },
    step_dir: { frame: { origin: [30, 37.75, 9], normal: [0, 1, 0], xAxis: [1, 0, 0] }, refs: [P1_REF] },
    pul_pos: onP1,
    pul_neg: onP1,
    dir_pos: onP1,
    dir_neg: onP1,
    ena_pos: onP1,
    ena_neg: onP1,
    alm_pos: onP2,
    alm_neg: onP2,
    vdc: onP3,
    gnd: onP3,
    motor_a_pos: onP3,
    motor_a_neg: onP3,
    motor_b_pos: onP3,
    motor_b_neg: onP3,
    bipolar_stepper_phases: { frame: { origin: [-28, 37.75, 9], normal: [0, 1, 0], xAxis: [1, 0, 0] }, refs: [P3_REF] },
  },
  cadArtifacts({
    dir: "library/parts/stepperonline-dm542t-v4/artifacts/cad",
    name: "stepperonline-dm542t-v4",
    generator: "library/cad/py/catalog/stepperonline-dm542t-v4.py",
    tool: "build123d 0.13.0",
    interfaces: ["base_mount"],
  }),
);
