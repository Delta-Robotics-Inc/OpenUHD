/**
 * Texas Instruments L293D quadruple half-H driver, L293DNE (16-pin PDIP, NE
 * package) — datasheet-honest UHD part.
 *
 * Sources (see ./ti-l293dne/sources.json):
 *   - src_datasheet: TI SLRS008D "L293x Quadruple Half-H Drivers" (rev. Jan
 *                    2016, addendum Nov 2025) — https://www.ti.com/lit/ds/symlink/l293d.pdf
 *   - src_package:   TI MPDI003 NE (R-PDIP-T**) package drawing —
 *                    https://www.ti.com/lit/pdf/MPDI003
 *   - src_product:   TI L293D product folder — https://www.ti.com/product/L293D
 *   - src_protopart: ProtoPart l293d-motor-driver-ic definition (community,
 *                    starting point only; every value re-checked against TI).
 *
 * Modelling notes:
 *   - Identity: TI L293DNE (the ProtoPart part_number). SLRS008D covers the
 *     L293 and L293D; only the L293D values (600 mA, 1.2 A peak, clamp diodes)
 *     are used. ST's L293D (ProtoPart also cites an ST 2003 datasheet) is a
 *     different manufacturer's part with the same pinout; it is not merged
 *     here (identity trait / source_discrepancy).
 *   - Leaves: all 16 pins, ids named after the TI pin names, `pin` = package
 *     pin number, verbatim `pin_functions` from the Pin Functions table.
 *     The four GROUND / heat-sink pins (4, 5, 12, 13) are separate leaves.
 *   - Inputs 1A-4A and the enables 1,2EN / 3,4EN: digital inputs, 2.3 V VIH
 *     min up to VCC1 (<= 7 V), VIL 1.5 V max. Enables also accept PWM (the
 *     TI application shows EN as the switched input). Capabilities
 *     `digital_in` / `pwm_in` mirror l298n-motor-driver so the control
 *     interfaces look the same.
 *   - Outputs 1Y-4Y: each is a totem-pole half-H output (drive high, drive
 *     low, or Z). Brushed DC motor output has no builder, so it is modelled
 *     as in l298n-motor-driver: PowerOut leaves with capability `motor_out`
 *     and a composed `dc_motor_output` (profiles 1Y/2Y and 3Y/4Y,
 *     max_instances 2); vocabulary gap in .research/gaps.json. Each output
 *     can also drive a load to ground or to VCC2 on its own (Table 2).
 *   - Ratings: 600 mA continuous per channel, 1.2 A peak (nonrepetitive,
 *     t <= 100 us). VCC2 VCC1..36 V, VCC1 4.5-7 V. No total package current
 *     is stated (data_gap); ProtoPart's 2400 mA VCC2 figure is 4 x 600 mA,
 *     not a TI value (source_discrepancy).
 *   - ProtoPart claims a 5 kHz maximum switching frequency; TI states none
 *     (5 kHz is only the test pulse generator's PRR in Figure 2), so no
 *     frequency limit is modelled (source_discrepancy).
 *   - Mechanical: bare through-hole IC, so no bolt pattern and no mounting
 *     frame (verify's "no bolt pattern" is by design). A `through_hole_mount`
 *     interface (existing `mechanical_connection` type, as bme280's
 *     pcb_mount) binds the package; each pin leaf binds its own lead tip.
 *   - Geometry: generated from MPDI003 (no downloadable TI CAD: Ultra
 *     Librarian needs a login; data_gap "manufacturer CAD"). Body thickness,
 *     shoulder width/height and lead length choice within the drawing limits
 *     are assumptions (traits).
 *   - Lifecycle: L293DNE is ACTIVE, but TI says "for new designs, we
 *     recommend considering an alternate" (usage_note).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  Ground,
  PowerIn,
  PowerOut,
  burstCurrentA,
  connectorTrait,
  defineModule,
  maxCurrentA,
  voltageRangeV,
} from "../../src/protocols/index.js";
import { cadArtifacts, feature, withGeometry } from "../cad/artifacts.js";

const SRC = {
  datasheet: "https://www.ti.com/lit/ds/symlink/l293d.pdf",
  pkg: "https://www.ti.com/lit/pdf/MPDI003",
  product: "https://www.ti.com/product/L293D",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/l293d-motor-driver-ic/definition.json",
} as const;

/** SLRS008D 6.3: VCC1 4.5-7 V; VCC2 from VCC1 up to 36 V. */
const VCC1_RANGE: [number, number] = [4.5, 7];
const VCC2_RANGE: [number, number] = [4.5, 36];
/** 6.3: VIH 2.3 V min, up to VCC1 (VCC1 <= 7 V) or 7 V; 6.1: VI abs max 7 V. */
const INPUT_RANGE: [number, number] = [2.3, 7];
/** 6.1: L293D continuous output current ±600 mA; peak ±1.2 A nonrepetitive, t <= 100 us. */
const OUT_CONT_A = 0.6;
const OUT_PEAK_A = 1.2;

const DIP_PIN = connectorTrait("through_hole_pin", {
  note: "PDIP-16 (TI NE package) lead, 2.54 mm pitch, 7.62 mm nominal row spacing (MPDI003: 7.37-7.87 mm).",
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function pinFunction(name: string, no: number, type: string, description: string): TraitDef {
  return {
    type: "pin_functions",
    params: { name, pin: no, type, description, source: SRC.datasheet, where: "Section 5, Pin Functions table" },
  };
}

// ---------------------------------------------------------------------------
// Leaves — logic inputs
// ---------------------------------------------------------------------------

const INPUT_LEVELS = "VIH 2.3 V min (up to VCC1 when VCC1 <= 7 V), VIL 1.5 V max (6.3); VI abs max 7 V (6.1). TTL compatible, tolerant up to 7 V (8.1).";

function input(id: string, name: string, no: number, description: string, enable: boolean): InterfaceDef {
  return {
    id,
    name,
    pin: no,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: enable
      ? [
          { type: "digital", roles: ["input"] },
          { type: "pwm", roles: ["input"] },
        ]
      : [{ type: "digital", roles: ["input"] }],
    capabilities: enable ? ["digital_in", "pwm_in"] : ["digital_in"],
    parameters: [voltageRangeV(INPUT_RANGE[0], INPUT_RANGE[1])],
    traits: [
      pinFunction(name, no, "I", description),
      {
        type: "usage_note",
        params: {
          topic: "input levels",
          note: `${INPUT_LEVELS} ${enable ? "IIH 10 uA max, IIL -100 uA max at EN (6.5)." : "IIH 100 uA max, IIL -10 uA max at A (6.5)."}`,
          source: SRC.datasheet,
        },
      },
      DIP_PIN,
    ],
  };
}

const en12 = input("en_1_2", "1,2EN", 1, "Enable driver channels 1 and 2 (active high input)", true);
const in1 = input("a1", "1A", 2, "Driver inputs, noninverting (driver 1)", false);
const in2 = input("a2", "2A", 7, "Driver inputs, noninverting (driver 2)", false);
const en34 = input("en_3_4", "3,4EN", 9, "Enable driver channels 3 and 4 (active high input)", true);
const in3 = input("a3", "3A", 10, "Driver inputs, noninverting (driver 3)", false);
const in4 = input("a4", "4A", 15, "Driver inputs, noninverting (driver 4)", false);

// ---------------------------------------------------------------------------
// Leaves — driver outputs
// ---------------------------------------------------------------------------

const OUTPUT_LEVELS: TraitDef = {
  type: "usage_note",
  params: {
    topic: "output stage",
    note: "Totem-pole output: Darlington sink, pseudo-Darlington source (8.1). L293D at 0.6 A: VOH VCC2-1.8 V min / VCC2-1.4 V typ, VOL 1.2 V typ / 1.8 V max. Integrated clamp diodes: VOKH VCC2+1.3 V, VOKL 1.3 V typ at 0.6 A (6.5). Output voltage abs max -3 V to VCC2+3 V (6.1). High impedance when its enable is low or in thermal shutdown (Table 1).",
    source: SRC.datasheet,
  },
};

function output(id: string, name: string, no: number, driver: number, enable: string): InterfaceDef {
  const base = PowerOut({
    id,
    name,
    pin: no,
    voltageV: VCC2_RANGE,
    maxCurrentA: OUT_CONT_A,
    parameters: [burstCurrentA(OUT_PEAK_A)],
  });
  return {
    ...base,
    capabilities: ["power_out", "motor_out"],
    traits: [
      pinFunction(name, no, "O", `Driver outputs (driver ${driver}). Follows ${driver}A when ${enable} is high; high impedance when ${enable} is low (Table 1).`),
      OUTPUT_LEVELS,
      {
        type: "usage_note",
        params: {
          topic: "current rating",
          note: "Continuous output current ±600 mA; peak ±1.2 A nonrepetitive, t <= 100 us (6.1, L293D). Burst duration: 100 us.",
          source: SRC.datasheet,
        },
      },
      DIP_PIN,
    ],
  };
}

const out1 = output("y1", "1Y", 3, 1, "1,2EN");
const out2 = output("y2", "2Y", 6, 2, "1,2EN");
const out3 = output("y3", "3Y", 11, 3, "3,4EN");
const out4 = output("y4", "4Y", 14, 4, "3,4EN");

// ---------------------------------------------------------------------------
// Leaves — supplies and ground
// ---------------------------------------------------------------------------

const vcc1 = withTraits(PowerIn({ id: "vcc1", name: "VCC1", pin: 16, voltageV: VCC1_RANGE, nominalV: 5 }), [
  pinFunction("VCC1", 16, "—", "5-V supply for internal logic translation"),
  {
    type: "usage_note",
    params: {
      topic: "logic supply",
      note: "VCC1 is 5 V ± 0.5 V (section 10); recommended 4.5-7 V (6.3); abs max 36 V (6.1). ICC1 at IO = 0: 13/22 mA typ/max all outputs high, 35/60 mA all low, 8/24 mA all Z (6.5). Bypass with 0.1 uF or more (section 10).",
      source: SRC.datasheet,
    },
  },
  DIP_PIN,
]);

const vcc2 = withTraits(PowerIn({ id: "vcc2", name: "VCC2", pin: 8, voltageV: VCC2_RANGE }), [
  pinFunction("VCC2", 8, "—", "Power VCC for drivers 4.5 V to 36 V"),
  {
    type: "usage_note",
    params: {
      topic: "driver supply",
      note: "VCC2 from VCC1 up to 36 V (6.3); may be the same supply as VCC1 (section 10). ICC2 at IO = 0: 14/24 mA typ/max all outputs high, 2/6 mA all low, 2/4 mA all Z (6.5). Bypass with 0.1 uF or more; no power-up or power-down sequencing requirement (section 10).",
      source: SRC.datasheet,
    },
  },
  DIP_PIN,
]);

function ground(no: number): InterfaceDef {
  return withTraits(Ground({ id: `gnd_${no}`, name: "GROUND", pin: no }), [
    pinFunction("GROUND", no, "—", "Device ground and heat sink pin. Connect to printed-circuit-board ground plane with multiple solid vias"),
    DIP_PIN,
  ]);
}

const gnd4 = ground(4);
const gnd5 = ground(5);
const gnd12 = ground(12);
const gnd13 = ground(13);

// ---------------------------------------------------------------------------
// Composed — bridge control and motor output (as in l298n-motor-driver)
// ---------------------------------------------------------------------------

function bridgeControl(id: string, label: string, a: string, b: string, en: string, pins: string): InterfaceDef {
  return {
    id,
    name: label,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "digital", roles: ["input"] }],
    slots: [
      { id: "in_a", required: true, match: { protocol: "digital", role: "input", capability: "digital_in" } },
      { id: "in_b", required: true, match: { protocol: "digital", role: "input", capability: "digital_in" } },
      { id: "en", required: true, match: { protocol: "pwm", role: "input", capability: "pwm_in" } },
    ],
    profiles: [{ id: `${id}_pins`, label: pins, default_active: true, bindings: { in_a: a, in_b: b, en } }],
    max_instances: 1,
    traits: [
      {
        type: "usage_note",
        params: {
          topic: "bidirectional DC motor control (Table 3)",
          note: "EN H, A L, B H: turn right; EN H, A H, B L: turn left; EN H, A = B: fast motor stop; EN L: free-running motor stop. PWM on EN gives speed control.",
          source: SRC.datasheet,
        },
      },
    ],
  };
}

const bridge12Control = bridgeControl("bridge_1_2_control", "Bridge 1/2 control (1A, 2A, 1,2EN)", "a1", "a2", "en_1_2", "1A/2A + 1,2EN (pins 2/7/1)");
const bridge34Control = bridgeControl("bridge_3_4_control", "Bridge 3/4 control (3A, 4A, 3,4EN)", "a3", "a4", "en_3_4", "3A/4A + 3,4EN (pins 10/15/9)");

const dcMotorOutput: InterfaceDef = {
  id: "dc_motor_output",
  name: "DC motor output (Y pair)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "power", roles: ["output"] }],
  parameters: [voltageRangeV(VCC2_RANGE[0], VCC2_RANGE[1]), maxCurrentA(OUT_CONT_A), burstCurrentA(OUT_PEAK_A)],
  slots: [
    { id: "phase_a", required: true, match: { protocol: "power", role: "output", capability: "motor_out" } },
    { id: "phase_b", required: true, match: { protocol: "power", role: "output", capability: "motor_out" } },
  ],
  profiles: [
    { id: "bridge_1_2", label: "1Y + 2Y (pins 3/6)", default_active: true, bindings: { phase_a: "y1", phase_b: "y2" } },
    { id: "bridge_3_4", label: "3Y + 4Y (pins 11/14)", default_active: true, bindings: { phase_a: "y3", phase_b: "y4" } },
  ],
  max_instances: 2,
  traits: [
    {
      type: "usage_note",
      params: {
        topic: "H-bridge pairing",
        note: "Each pair of drivers forms a full-H (bridge) reversible drive (8.1): one bidirectional brushed DC motor on 1Y/2Y and one on 3Y/4Y, or one bipolar stepper on both pairs (Figure 11). Each output can also drive a load to ground or to VCC2 by itself (unidirectional control, Table 2). 600 mA continuous per channel (9.2.1). Clamp diodes are integrated in the L293D (8.1).",
        source: SRC.datasheet,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Mechanical — through-hole package
// ---------------------------------------------------------------------------

const thtMount: InterfaceDef = {
  id: "through_hole_mount",
  name: "PDIP-16 through-hole mount",
  domain: "mechanical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "mechanical_connection", roles: ["mounting_point"] }],
  capabilities: ["pdip16_300mil", "through_hole"],
  traits: [
    {
      type: "usage_note",
      params: {
        topic: "package",
        note: "NE (R-PDIP-T**) 16 pins: body 19.80 mm max long, 6.10-6.60 mm wide; 2.54 mm pitch; 7.37-7.87 mm row spacing; 5.08 mm max above the seating plane; 0.51 mm min standoff; leads 3.17-3.94 mm below the seating plane, 0.381-0.533 mm wide. Falls within JEDEC MS-001. Fits a 16-pin 0.3 in DIP socket or a breadboard across the centre channel.",
        source: SRC.pkg,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "soldering",
        note: "Pin temperature must not exceed 260 °C and soldering time must not exceed 12 s (section 10).",
        source: SRC.datasheet,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const TI_L293DNE_BASE: ModuleDef = defineModule({
  id: "ti-l293dne",
  name: "TI L293D Quadruple Half-H Driver (PDIP-16)",
  version: "1.1.0",
  manufacturer: "Texas Instruments",
  part_number: "L293DNE",
  description:
    "Texas Instruments L293D quadruple high-current half-H driver in a 16-pin PDIP (NE). 600 mA continuous (1.2 A peak, <= 100 us) per channel at 4.5-36 V driver supply (VCC2), separate 4.5-7 V logic supply (VCC1), TTL-compatible inputs (VIH 2.3 V), integrated output clamp diodes. Drivers are enabled in pairs, so it drives two bidirectional brushed DC motors, one bipolar stepper, or four unidirectional loads. 0 to 70 °C.",
  tags: ["l293d", "l293dne", "texas-instruments", "ti", "motor-driver", "h-bridge", "half-h", "brushed-dc", "stepper", "pdip-16", "dip", "through-hole", "bare-ic"],
  categories: ["actuator", "actuator.motor_controller", "component.ic"],

  interfaces: [
    en12, in1, out1, gnd4, gnd5, out2, in2, vcc2,
    en34, in3, out3, gnd12, gnd13, out4, in4, vcc1,
    bridge12Control, bridge34Control, dcMotorOutput,
    thtMount,
  ],

  interfaceGroups: [
    { id: "ground_pins", label: "GROUND / heat-sink pins (4, 5, 12, 13)", members: ["gnd_4", "gnd_5", "gnd_12", "gnd_13"], policy: "all_of" },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vcc1", name: "VCC1 logic supply", nominal_voltage_V: 5, voltage_range_V: VCC1_RANGE, max_current_mA: 60 },
        { id: "vcc2", name: "VCC2 driver supply", voltage_range_V: VCC2_RANGE },
      ],
      metadata: {
        pin_count: 16,
        package: "PDIP (NE) 16",
        output_current_continuous_mA: 600,
        output_current_peak_mA: 1200,
        output_current_peak_note: "nonrepetitive, t <= 100 us",
        icc1_max_note: "ICC1 max 60 mA with all outputs low, IO = 0 (6.5)",
        propagation_delay_ns_typ: { tPLH: 800, tPHL: 400 },
        transition_time_ns_typ: { tTLH: 300, tTHL: 300 },
        switching_conditions: "L293DNE, VCC1 = 5 V, VCC2 = 24 V, TA = 25 °C, CL = 30 pF (6.6)",
        esd: "HBM ±2000 V, CDM ±1000 V (6.2)",
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 19.8, width: 6.35, height: 5.08 },
      package: {
        name: "PDIP-16",
        code: "NE (R-PDIP-T**)",
        pin_count: 16,
        pitch_mm: 2.54,
        exposed_pad: false,
        source: `${SRC.datasheet} (Device Information: L293DNE PDIP (16) 19.80 mm × 6.35 mm; "NE Package 16-Pin PDIP"); ${SRC.pkg} (2.54 mm pitch)`,
      },
      metadata: {
        body_size_nom_mm: "19.80 x 6.35 (SLRS008D Device Information)",
        height_note: "5.08 mm is the maximum seating-plane-to-top height (MPDI003)",
        row_spacing_mm: [7.37, 7.87],
        mounting_method: "through-hole",
      },
    },
    {
      domain: "thermal",
      operating_temperature_C: [0, 70],
      metadata: {
        junction_temperature_max_C: 150,
        storage_temperature_C: [-65, 150],
        theta_ja_C_per_W: 36.4,
        theta_jc_top_C_per_W: 22.5,
        theta_jb_C_per_W: 16.5,
        psi_jt_C_per_W: 7.1,
        psi_jb_C_per_W: 16.3,
        cooling: "GROUND pins 4, 5, 12, 13 are the heat-sink path: solder to PCB copper or an external heat sink (section 10, Figures 12 and 14)",
      },
    },
  ],

  traits: [
    {
      type: "operating_conditions",
      params: {
        vcc1_V: VCC1_RANGE,
        vcc2_V: "VCC1 to 36",
        vih_V: "2.3 to VCC1 (VCC1 <= 7 V) or 7 (VCC1 >= 7 V)",
        vil_V: [-0.3, 1.5],
        operating_temperature_C: [0, 70],
        source: SRC.datasheet,
        where: "6.3 Recommended Operating Conditions",
      },
    },
    {
      type: "absolute_maximum",
      params: {
        vcc1_V: 36,
        vcc2_V: 36,
        input_V: 7,
        output_V: "-3 to VCC2 + 3",
        output_current_continuous_mA: 600,
        output_current_peak_A: "1.2 (nonrepetitive, t <= 100 us)",
        junction_temperature_C: 150,
        storage_temperature_C: [-65, 150],
        source: SRC.datasheet,
        where: "6.1 Absolute Maximum Ratings (L293D rows)",
      },
    },
    {
      type: "performance",
      params: {
        kind: "motor_driver",
        topology: "quadruple half-H, enabled in pairs (1,2EN and 3,4EN)",
        function_table: "EN H: Y follows A; EN L: Y high impedance (Table 1)",
        clamp_diodes: "integrated (L293D)",
        thermal_shutdown: "outputs high impedance in thermal shutdown (Table 1 note 2)",
        source: SRC.datasheet,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "power supply and layout",
        note: "VCC1 5 V ± 0.5 V; VCC2 can be the same supply or higher, up to 36 V. 0.1 uF or larger bypass capacitors at VCC1 and VCC2. Heatsinking is critical at high current: solder the GND pins to copper area or an external heat sink, which must be at ground. Place the device near the load and use solid vias from the ground pins to the ground plane.",
        source: SRC.datasheet,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "lifecycle",
        note: "L293DNE is ACTIVE, but TI's product folder says: \"This product is available for existing designs. However, for new designs, we recommend considering an alternate.\"",
        source: SRC.product,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "identity",
        note: "Modelled as TI L293DNE (PDIP NE 16, NIPDAU lead finish, 25 per tube; also orderable as L293DNE.A and L293DNEE4). The L293NE (1 A, no clamp diodes) is a different device in the same datasheet. ST's L293D (ProtoPart's second datasheet) is another manufacturer's part with the same pinout and is not covered by this definition.",
        source: [SRC.datasheet, SRC.protopart],
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "maximum switching frequency",
        values: ["5 kHz (ProtoPart max_switching_frequency_kHz, design rule 'Keep PWM on the EN pins at or below 5 kHz')", "not stated (TI SLRS008D)"],
        sources: [SRC.protopart, SRC.datasheet],
        resolution: "TI gives no switching-frequency limit; 5 kHz appears only as the pulse generator PRR in the Figure 2 test circuit. No limit is modelled.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "VCC2 maximum current",
        values: ["2400 mA (ProtoPart power domain vcc2_motor)", "not stated (TI SLRS008D)"],
        sources: [SRC.protopart, SRC.datasheet],
        resolution: "ProtoPart's figure is 4 x 600 mA, not a TI rating. Only the per-channel ratings are modelled; total current is thermally limited (data_gap).",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "package outline",
        values: ["19.3 x 6.35 x 4.6 mm, 1.2 g (ProtoPart mechanical domain)", "19.80 x 6.35 mm body (nom), 5.08 mm max height (TI SLRS008D, MPDI003); no mass stated"],
        sources: [SRC.protopart, SRC.datasheet, SRC.pkg],
        resolution: "TI values used; mass omitted (data_gap).",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "total package current / power dissipation limit",
        note: "TI states per-channel ratings and thermal resistance (RθJA 36.4 °C/W) and plots PTOT vs ambient (Figure 1) and vs copper area (Figure 7), but gives no single total-current rating.",
      },
    },
    {
      type: "data_gap",
      params: { field: "mass", note: "Not stated by TI for the NE package." },
    },
    {
      type: "data_gap",
      params: {
        field: "manufacturer CAD",
        note: "No downloadable TI 3D model: the SLRS008D datasheet has no package drawing and the L293D product folder (https://www.ti.com/product/L293D) offers CAD/CAE only through Ultra Librarian (app.ultralibrarian.com), which needs a login. Geometry is generated from TI MPDI003 (library/cad/py/catalog/ti-l293dne.py).",
      },
    },
    {
      type: "assumption",
      params: {
        field: "CAD body thickness and lead shape",
        value: "body 3.30 mm thick on a 0.51 mm standoff (top at 3.81 mm); shoulders 1.52 mm wide leaving the body 1.6 mm above the seating plane; leads 3.30 mm below the seating plane; 7.62 mm row spacing; 6.35 mm body width",
        reason: "MPDI003 gives only limits (height <= 5.08 mm, standoff >= 0.51 mm, lead length 3.17-3.94 mm, row spacing 7.37-7.87 mm, width 6.10-6.60 mm, shoulder <= 1.78 mm); representative values inside them are used.",
        source: SRC.pkg,
      },
    },
  ],

  artifacts: [
    { id: "art_datasheet", name: "TI L293x datasheet SLRS008D", type: "datasheet", url: SRC.datasheet },
    { id: "art_package", name: "TI MPDI003 NE (R-PDIP-T**) package drawing", type: "datasheet", url: SRC.pkg },
    { id: "art_product", name: "TI L293D product folder", type: "documentation", url: SRC.product },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): generated from MPDI003 (library/cad/py/catalog/ti-l293dne.py).
// Body centred on the origin, seating plane z = 0, leads down to z = -3.3.
// Pins 1-8 on -X (pin 1 at +Y), pins 9-16 on +X (pin 16 at +Y).
// Each pin leaf binds the bottom face of its own lead.
// ---------------------------------------------------------------------------

const DIR = "library/parts/ti-l293dne/artifacts/cad";

export const TI_L293DNE: ModuleDef = withGeometry(
  TI_L293DNE_BASE,
  {
    en_1_2: { refs: [feature("pin_1", { area_mm2: 0.114, centroid: [-3.81, 8.89, -3.3], normal: [0.0, 0.0, -1.0] })] },
    a1: { refs: [feature("pin_2", { area_mm2: 0.114, centroid: [-3.81, 6.35, -3.3], normal: [0.0, 0.0, -1.0] })] },
    y1: { refs: [feature("pin_3", { area_mm2: 0.114, centroid: [-3.81, 3.81, -3.3], normal: [0.0, 0.0, -1.0] })] },
    gnd_4: { refs: [feature("pin_4", { area_mm2: 0.114, centroid: [-3.81, 1.27, -3.3], normal: [0.0, 0.0, -1.0] })] },
    gnd_5: { refs: [feature("pin_5", { area_mm2: 0.114, centroid: [-3.81, -1.27, -3.3], normal: [0.0, 0.0, -1.0] })] },
    y2: { refs: [feature("pin_6", { area_mm2: 0.114, centroid: [-3.81, -3.81, -3.3], normal: [0.0, 0.0, -1.0] })] },
    a2: { refs: [feature("pin_7", { area_mm2: 0.114, centroid: [-3.81, -6.35, -3.3], normal: [0.0, 0.0, -1.0] })] },
    vcc2: { refs: [feature("pin_8", { area_mm2: 0.114, centroid: [-3.81, -8.89, -3.3], normal: [0.0, 0.0, -1.0] })] },
    en_3_4: { refs: [feature("pin_9", { area_mm2: 0.114, centroid: [3.81, -8.89, -3.3], normal: [0.0, 0.0, -1.0] })] },
    a3: { refs: [feature("pin_10", { area_mm2: 0.114, centroid: [3.81, -6.35, -3.3], normal: [0.0, 0.0, -1.0] })] },
    y3: { refs: [feature("pin_11", { area_mm2: 0.114, centroid: [3.81, -3.81, -3.3], normal: [0.0, 0.0, -1.0] })] },
    gnd_12: { refs: [feature("pin_12", { area_mm2: 0.114, centroid: [3.81, -1.27, -3.3], normal: [0.0, 0.0, -1.0] })] },
    gnd_13: { refs: [feature("pin_13", { area_mm2: 0.114, centroid: [3.81, 1.27, -3.3], normal: [0.0, 0.0, -1.0] })] },
    y4: { refs: [feature("pin_14", { area_mm2: 0.114, centroid: [3.81, 3.81, -3.3], normal: [0.0, 0.0, -1.0] })] },
    a4: { refs: [feature("pin_15", { area_mm2: 0.114, centroid: [3.81, 6.35, -3.3], normal: [0.0, 0.0, -1.0] })] },
    vcc1: { refs: [feature("pin_16", { area_mm2: 0.114, centroid: [3.81, 8.89, -3.3], normal: [0.0, 0.0, -1.0] })] },
    // Frame on the seating plane, PCB approaches from below (-Z); xAxis +X
    // points from the pin 1-8 row to the pin 9-16 row. No symmetryDeg:
    // rotating a DIP 180° swaps pin 1 and pin 9.
    through_hole_mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0] },
      refs: [
        feature("package_underside", { area_mm2: 125.73, centroid: [0.0, 0.0, 0.51], normal: [0.0, 0.0, -1.0] }),
        feature("package_top", { area_mm2: 124.945, centroid: [0.012, -0.055, 3.81], normal: [0.0, 0.0, 1.0] }),
      ],
    },
  },
  cadArtifacts({ dir: DIR, name: "ti-l293dne-pdip16", generator: "library/cad/py/catalog/ti-l293dne.py", tool: "build123d" }),
);
