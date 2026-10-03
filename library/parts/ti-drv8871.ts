/**
 * Texas Instruments DRV8871 (DDA, 8-pin HSOP PowerPAD) brushed DC motor
 * driver IC — datasheet-honest UHD part.
 *
 * Sources (see ./ti-drv8871/sources.json):
 *   - src_datasheet: TI DRV8871 datasheet SLVSCY9B (rev. Jul 2016) with package
 *                    option addendum and DDA0008B outline — https://www.ti.com/lit/ds/symlink/drv8871.pdf
 *   - src_product:   TI DRV8871 product folder — https://www.ti.com/product/DRV8871
 *   - src_protopart: ProtoPart texas-instruments-drv8871 definition (community
 *                    starting point; every value re-verified against the datasheet).
 *
 * Modelling notes:
 *   - Variant: the bare IC in the DDA (HSOP-8 PowerPAD) package, orderable as
 *     DRV8871DDAR (active); DRV8871DDA is obsolete (addendum). The automotive
 *     DRV8871-Q1 is a different part and is not merged here.
 *   - Pin-honest leaves for pins 1-8 plus the exposed thermal pad (pin 9 in
 *     the drawing, "PAD" in the Pin Functions table), each with its verbatim
 *     pin_functions trait.
 *   - Composed interfaces: `motor_power_in` (VM + PGND), `dc_motor_output`
 *     (OUT1/OUT2) and `bridge_control` (IN1/IN2). The brushed DC output has no
 *     builder; it mirrors library/parts/l298n-motor-driver.ts (power output
 *     leaves with capability motor_out, slots phase_a/phase_b), recorded as a
 *     vocabulary gap in .research/gaps.json.
 *   - ILIM takes a resistor to ground (not a host signal), so it is a `custom`
 *     leaf with the ITRIP = 64 kV / RILIM equation in a usage_note.
 *   - IN1/IN2 are plain logic inputs (0-5.5 V, PWM up to 200 kHz). They are
 *     modelled as Pin leaves with digital + pwm-input capability; the PWM
 *     frequency limit is a parameter on `bridge_control`.
 *   - Current: 3.6 A peak (recommended operating), 3.5 A at 100% duty
 *     (absolute maximum). max_current on the output uses 3.5 A; the 3.6 A peak
 *     is burst_current (duration "a few hundred milliseconds", §7.4.2).
 *   - Discrepancies with ProtoPart (source_discrepancy traits): logic
 *     thresholds (ProtoPart VIH 2 V / VIL 0.8 V; datasheet 1.5 V / 0.5 V) and
 *     the PWM frequency (§7.1 says 0-100 kHz; §6.3 allows 200 kHz).
 *   - Geometry: generated from drawing DDA0008B (no downloadable manufacturer
 *     CAD: TI links Ultra Librarian, login required). Bare IC: no bolt pattern
 *     and no mounting frame. Each pin leaf refs its foot (`pin_N`), the thermal
 *     pad refs `thermal_pad`, and the composed interfaces ref their pins'
 *     features. Nominal (midpoint) dimensions; the standoff, body height and
 *     foot length are assumption traits.
 *   - verify-part warning "no mechanical interfaces" is intended: a bare SMD
 *     IC has no mounting pattern; it is soldered by its leads and pad.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  defineModule,
  Ground,
  Pin,
  PowerIn,
  PowerOut,
  burstCurrentA,
  connectorTrait,
  maxCurrentA,
  maxFrequencyHz,
  voltageRangeV,
} from "../../src/protocols/index.js";
import { cadArtifacts, feature, withGeometry } from "../cad/artifacts.js";

const SRC = {
  datasheet: "https://www.ti.com/lit/ds/symlink/drv8871.pdf",
  product: "https://www.ti.com/product/DRV8871",
  protopart:
    "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/texas-instruments-drv8871/definition.json",
} as const;

const VM_RANGE: [number, number] = [6.5, 45];
const LOGIC_RANGE: [number, number] = [0, 5.5];
const OUT_CONT_A = 3.5;
const OUT_PEAK_A = 3.6;

const SMD_LEAD = connectorTrait("smd_gull_wing_lead", { note: "HSOP-8 (DDA) gull-wing lead, 1.27 mm pitch." });

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function pinFn(description: string): TraitDef {
  return { type: "pin_functions", params: { description, source: SRC.datasheet } };
}

function withCaps(iface: InterfaceDef, caps: string[]): InterfaceDef {
  return { ...iface, capabilities: [...new Set([...(iface.capabilities ?? []), ...caps])] };
}

// ---------------------------------------------------------------------------
// Leaves — datasheet section 5, Pin Functions (DDA package, top view)
// ---------------------------------------------------------------------------

const gnd = withTraits(Ground({ id: "gnd", name: "GND", pin: 1 }), [
  pinFn("GND (pin 1, PWR) — Logic ground. Connect to board ground."),
  SMD_LEAD,
]);

const logicInput = (id: string, name: string, pin: number, fn: string) =>
  withTraits(
    withCaps(Pin({ id, name, pin, voltageV: LOGIC_RANGE, capabilities: { inputOnly: true } }), ["pwm_in"]),
    [
      pinFn(`${name} (pin ${pin}, I) — Logic inputs. Controls the H-bridge output. Has internal pulldowns (see Table 1). ${fn}`),
      {
        type: "usage_note",
        params: {
          note: "VIL max 0.5 V, VIH min 1.5 V, hysteresis 0.5 V typ; 100 kOhm pulldown to GND; IIH 33 uA typ / 100 uA max at 3.3 V. May be driven before VM is applied. Pulses must be at least 800 ns wide to be detected.",
          source: SRC.datasheet,
        },
      },
      {
        type: "source_discrepancy",
        params: {
          field: "logic input thresholds",
          values: ["VIH min 2 V, VIL max 0.8 V (ProtoPart)", "VIH min 1.5 V, VIL max 0.5 V (datasheet 6.5)"],
          sources: [SRC.protopart, SRC.datasheet],
          resolution: "Datasheet values used.",
        },
      },
      SMD_LEAD,
    ],
  );

const in2 = logicInput("in2", "IN2", 2, "With IN1: IN1=0 IN2=1 reverse (OUT2 to OUT1).");
const in1 = logicInput("in1", "IN1", 3, "With IN2: IN1=1 IN2=0 forward (OUT1 to OUT2).");

const ilim: InterfaceDef = withTraits(
  {
    id: "ilim",
    name: "ILIM",
    pin: 4,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "custom", roles: ["input"] }],
    capabilities: ["current_limit_set"],
  },
  [
    pinFn("ILIM (pin 4, I) — Current limit control. Connect a resistor to ground to set the current chopping threshold."),
    {
      type: "usage_note",
      params: {
        note: "ITRIP (A) = VILIM (kV) / RILIM (kOhm), VILIM = 64 kV typ (59-69 kV). Example: RILIM 32 kOhm -> 2 A. Minimum RILIM is 15 kOhm. For no current regulation use 15-18 kOhm (highest peak current, up to 3.6 A for a few hundred milliseconds).",
        source: SRC.datasheet,
      },
    },
    SMD_LEAD,
  ],
);

const vm = withTraits(
  PowerIn({ id: "vm", name: "VM", pin: 5, voltageV: VM_RANGE, maxCurrentA: OUT_PEAK_A }),
  [
    pinFn("VM (pin 5, PWR) — 6.5-V to 45-V power supply. Connect a 0.1-uF bypass capacitor to ground, as well as sufficient bulk capacitance, rated for the VM voltage."),
    SMD_LEAD,
  ],
);

const out = (id: string, name: string, pin: number) =>
  withTraits(
    withCaps(
      PowerOut({ id, name, pin, voltageV: VM_RANGE, maxCurrentA: OUT_CONT_A, parameters: [burstCurrentA(OUT_PEAK_A)] }),
      ["power_out", "motor_out"],
    ),
    [pinFn(`${name} (pin ${pin}, O) — H-bridge output. Connect directly to the motor or other inductive load.`), SMD_LEAD],
  );

const out1 = out("out1", "OUT1", 6);
const pgnd = withTraits(Ground({ id: "pgnd", name: "PGND", pin: 7 }), [
  pinFn("PGND (pin 7, PWR) — High-current ground path. Connect to board ground."),
  SMD_LEAD,
]);
const out2 = out("out2", "OUT2", 8);

const thermalPad = withTraits(Ground({ id: "thermal_pad", name: "PAD (PowerPAD)", pin: "PAD" }), [
  pinFn("PAD (—) — Thermal pad. Connect to board ground. For good thermal dissipation, use large ground planes on multiple layers, and multiple nearby vias connecting those planes."),
  connectorTrait("exposed_thermal_pad", { note: "Exposed PowerPAD on the package underside (pad 9 in DDA0008B), 2.11-2.71 x 2.8-3.4 mm." }),
]);

// ---------------------------------------------------------------------------
// Composed interfaces
// ---------------------------------------------------------------------------

const motorPowerIn: InterfaceDef = {
  id: "motor_power_in",
  name: "Motor supply (VM / PGND)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "power", roles: ["input"] }],
  parameters: [voltageRangeV(VM_RANGE[0], VM_RANGE[1]), maxCurrentA(OUT_PEAK_A)],
  slots: [
    { id: "vm", required: true, match: { protocol: "power", role: "input" } },
    { id: "gnd", required: true, match: { protocol: "power", role: "ground", capability: "ground" } },
  ],
  profiles: [{ id: "vm_pgnd", label: "VM / PGND (pins 5 / 7)", default_active: true, bindings: { vm: "vm", gnd: "pgnd" } }],
  bridgesTo: ["dc_motor_output"],
  traits: [
    {
      type: "usage_note",
      params: {
        note: "Single supply: VM powers the device and biases the motor. IVM 3 mA typ / 10 mA max at 12 V; sleep current 10 uA max. UVLO: falling 6.1 V typ / 6.4 V max, rising 6.3 V typ / 6.5 V max (hysteresis 100 mV min, 180 mV typ). Typical application: 0.1 uF + 47 uF on VM.",
        source: SRC.datasheet,
      },
    },
  ],
};

const dcMotorOutput: InterfaceDef = {
  id: "dc_motor_output",
  name: "Brushed DC motor output (OUT1 + OUT2)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "power", roles: ["output"] }],
  parameters: [voltageRangeV(VM_RANGE[0], VM_RANGE[1]), maxCurrentA(OUT_CONT_A), burstCurrentA(OUT_PEAK_A)],
  slots: [
    { id: "phase_a", required: true, match: { protocol: "power", role: "output", capability: "motor_out" } },
    { id: "phase_b", required: true, match: { protocol: "power", role: "output", capability: "motor_out" } },
  ],
  profiles: [{ id: "out1_out2", label: "OUT1 / OUT2 (pins 6 / 8)", default_active: true, bindings: { phase_a: "out1", phase_b: "out2" } }],
  max_instances: 1,
  traits: [
    {
      type: "usage_note",
      params: {
        note: "One H-bridge: drives one brushed DC motor or one winding of a stepper. RDS(on) HS 307 mOhm + LS 258 mOhm typ (565 mOhm) at 24 V, 1 A. Current regulation by ILIM (tOFF 25 us slow decay). OCP 3.7-6.4 A (4.5 typ), retry 3 ms; TSD 150 C min.",
        source: SRC.datasheet,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "current ratings",
        note: "Output current (100% duty) absolute maximum 3.5 A; peak output current 3.6 A (recommended operating), available for a few hundred milliseconds depending on PCB and ambient. Continuous current is limited by power dissipation and PCB thermal design.",
        source: SRC.datasheet,
      },
    },
  ],
};

const bridgeControl: InterfaceDef = {
  id: "bridge_control",
  name: "Bridge control inputs (IN1 / IN2)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "digital", roles: ["input"] }],
  parameters: [voltageRangeV(LOGIC_RANGE[0], LOGIC_RANGE[1]), maxFrequencyHz([0, 200_000])],
  slots: [
    { id: "in1", required: true, match: { protocol: "digital", role: "input", capability: "digital_io" } },
    { id: "in2", required: true, match: { protocol: "digital", role: "input", capability: "digital_io" } },
  ],
  profiles: [{ id: "in1_in2", label: "IN1 / IN2 (pins 3 / 2)", default_active: true, bindings: { in1: "in1", in2: "in2" } }],
  traits: [
    {
      type: "usage_note",
      params: {
        topic: "truth table (Table 1)",
        note: "IN1 IN2 -> OUT1 OUT2: 0 0 -> High-Z High-Z (coast; sleep after 1 ms); 0 1 -> L H (reverse); 1 0 -> H L (forward); 1 1 -> L L (brake, low-side slow decay). PWM one input while the other is static; drive/brake PWM typically works best.",
        source: SRC.datasheet,
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "maximum PWM frequency",
        values: ["0 to 100 kHz (section 7.1 Overview)", "0 to 200 kHz (6.3 Recommended Operating Conditions; usable duty 16-84% at 200 kHz)"],
        sources: [SRC.datasheet],
        resolution: "The Recommended Operating Conditions table (200 kHz, with its duty-cycle note) is the specification; 7.1 is descriptive text.",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const TI_DRV8871_BASE: ModuleDef = defineModule({
  id: "ti-drv8871",
  name: "TI DRV8871 Brushed DC Motor Driver (HSOP-8)",
  version: "1.1.0",
  manufacturer: "Texas Instruments",
  part_number: "DRV8871DDAR",
  description:
    "Texas Instruments DRV8871 single H-bridge brushed DC motor driver IC in the 8-pin HSOP PowerPAD (DDA) package: 6.5-45 V VM, 3.6 A peak (3.5 A at 100% duty abs max), 565 mOhm typ HS+LS RDS(on), PWM control on IN1/IN2 (up to 200 kHz), current regulation set by a resistor on ILIM (ITRIP = 64 kV / RILIM), sleep when both inputs are low, UVLO/OCP/TSD with automatic recovery.",
  tags: ["drv8871", "texas-instruments", "ti", "motor-driver", "h-bridge", "brushed-dc", "current-regulation", "hsop-8", "powerpad", "ic"],
  categories: ["actuator", "actuator.motor_controller"],

  interfaces: [gnd, in2, in1, ilim, vm, out1, pgnd, out2, thermalPad, motorPowerIn, dcMotorOutput, bridgeControl],

  interfaceGroups: [
    { id: "ground_pins", label: "Ground pins (GND, PGND, PAD — one board ground)", members: ["gnd", "pgnd", "thermal_pad"], policy: "all_of" },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vm", name: "Motor / device supply (VM)", nominal_voltage_V: 24, voltage_range_V: VM_RANGE, max_current_mA: 3600 },
      ],
      metadata: { pin_count: 8, exposed_pad: true, package: "HSOP-8 PowerPAD (DDA)" },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 4.9, width: 6.0, height: 1.7 },
      package: {
        name: "HSOP-8",
        code: "DDA (DDA0008B)",
        pin_count: 8,
        pitch_mm: 1.27,
        exposed_pad: true,
        exposed_pad_pin: "PAD",
        source: `${SRC.datasheet} (Device Information: HSOP (8) 4.90 mm × 6.00 mm; §5 "DDA Package 8-Pin HSOP", PAD row; DDA0008B outline: 6X 1.27 pitch, exposed thermal pad 2.11-2.71 x 2.8-3.4 mm)`,
      },
      metadata: {
        package: "DDA0008B PowerPAD SOIC, 1.7 mm max height (JEDEC MS-012)",
        body_mm: "4.8-5.0 x 3.8-4.0; lead span 5.8-6.2",
        exposed_pad_mm: "2.11-2.71 x 2.8-3.4",
        mounting_method: "surface_mount",
        msl: "Level-2-260C-1 YEAR",
      },
    },
    {
      domain: "thermal",
      operating_temperature_C: [-40, 125],
      metadata: {
        rtheta_ja_C_per_W: 41.1,
        rtheta_jc_bot_C_per_W: 2.7,
        rtheta_jb_C_per_W: 23.1,
        junction_max_C: 150,
        cooling_method: "PCB heat spreading through the PowerPAD",
      },
    },
  ],

  traits: [
    {
      type: "absolute_maximum",
      params: {
        vm_V: [-0.3, 50],
        logic_input_V: [-0.3, 7],
        out_V: "-0.7 to VM + 0.7",
        output_current_100pct_duty_A: [0, 3.5],
        junction_temperature_C: [-40, 150],
        storage_temperature_C: [-65, 150],
        esd_hbm_V: 6000,
        esd_cdm_V: 750,
        source: SRC.datasheet,
      },
    },
    {
      type: "operating_conditions",
      params: {
        vm_V: VM_RANGE,
        logic_input_V: LOGIC_RANGE,
        pwm_frequency_kHz: [0, 200],
        peak_output_current_A: [0, 3.6],
        ambient_temperature_C: [-40, 125],
        source: SRC.datasheet,
      },
    },
    {
      type: "performance",
      params: {
        kind: "motor_driver",
        channels: 1,
        topology: "H-bridge, four N-channel MOSFETs, integrated charge pump",
        rds_on_mOhm: { high_side_typ: 307, high_side_max: 360, low_side_typ: 258, low_side_max: 320, condition: "VM 24 V, 1 A, 25 kHz" },
        dead_time_ns: 220,
        propagation_delay_us: { typ: 0.7, max: 1 },
        ocp_A: { min: 3.7, typ: 4.5, max: 6.4 },
        tsd_C: { min: 150, typ: 175, hysteresis: 40 },
        source: SRC.datasheet,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "layout",
        note: "Connect GND, PGND and the PowerPAD to board ground; the package is designed to be soldered to a thermal pad on the board with large ground planes and vias. Place the 0.1 uF VM bypass close to the device and keep the VM/PGND/OUT loops short and wide.",
        source: SRC.datasheet,
      },
    },
    {
      type: "data_gap",
      params: {
        field: "manufacturer CAD",
        note: "No downloadable manufacturer 3D model: TI's product folder links CAD/CAE only through Ultra Librarian (https://www.ultralibrarian.com/TI/embedded/?gpn=DRV8871&package=DDA&pin=8), which requires a login; the SnapEDA part page returned no usable content to a scripted fetch. Geometry is generated from the DDA0008B outline (library/cad/py/catalog/ti-drv8871.py).",
        source: SRC.product,
      },
    },
    {
      type: "assumption",
      params: {
        field: "CAD package dimensions",
        value: "nominal = midpoint of each drawing range; body underside 0.075 mm above the seating plane, body top 1.6 mm, foot length 0.8 mm, lead thickness 0.18 mm, shoulder height 0.8 mm",
        reason: "DDA0008B gives only min/max limits (standoff 0-0.15, height 1.7 max, foot 0.40-1.27, lead 0.10-0.25 thick) and no shoulder height; the representative model needs single values.",
        source: SRC.datasheet,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "variant",
        note: "Orderable DRV8871DDAR (active, 2500 T&R, marking 8871). DRV8871DDA is obsolete. An automotive DRV8871-Q1 exists and is a separate part.",
        source: SRC.datasheet,
      },
    },
  ],

  artifacts: [
    { id: "art_datasheet", name: "TI DRV8871 datasheet SLVSCY9B", type: "datasheet", url: SRC.datasheet },
    { id: "art_product", name: "TI DRV8871 product folder", type: "documentation", url: SRC.product },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): generated from drawing DDA0008B. Seating plane z = 0,
// body centred on the origin, pins 1-4 on -X (pin 1 at +Y), 5-8 on +X.
// ---------------------------------------------------------------------------

const PIN_FEATURES = {
  gnd: feature("pin_1", { area_mm2: 0.328, centroid: [-2.6, 1.905, 0.0], normal: [0.0, 0.0, -1.0] }),
  in2: feature("pin_2", { area_mm2: 0.328, centroid: [-2.6, 0.635, 0.0], normal: [0.0, 0.0, -1.0] }),
  in1: feature("pin_3", { area_mm2: 0.328, centroid: [-2.6, -0.635, 0.0], normal: [0.0, 0.0, -1.0] }),
  ilim: feature("pin_4", { area_mm2: 0.328, centroid: [-2.6, -1.905, 0.0], normal: [0.0, 0.0, -1.0] }),
  vm: feature("pin_5", { area_mm2: 0.328, centroid: [2.6, -1.905, 0.0], normal: [0.0, 0.0, -1.0] }),
  out1: feature("pin_6", { area_mm2: 0.328, centroid: [2.6, -0.635, 0.0], normal: [0.0, 0.0, -1.0] }),
  pgnd: feature("pin_7", { area_mm2: 0.328, centroid: [2.6, 0.635, 0.0], normal: [0.0, 0.0, -1.0] }),
  out2: feature("pin_8", { area_mm2: 0.328, centroid: [2.6, 1.905, 0.0], normal: [0.0, 0.0, -1.0] }),
  thermal_pad: feature("thermal_pad", { area_mm2: 7.471, centroid: [0.0, 0.0, 0.0], normal: [0.0, 0.0, -1.0] }),
};

export const TI_DRV8871: ModuleDef = withGeometry(
  TI_DRV8871_BASE,
  {
    ...Object.fromEntries(Object.entries(PIN_FEATURES).map(([id, ref]) => [id, { refs: [ref] }])),
    motor_power_in: { refs: [PIN_FEATURES.vm, PIN_FEATURES.pgnd] },
    dc_motor_output: { refs: [PIN_FEATURES.out1, PIN_FEATURES.out2] },
    bridge_control: { refs: [PIN_FEATURES.in1, PIN_FEATURES.in2] },
  },
  cadArtifacts({
    dir: "library/parts/ti-drv8871/artifacts/cad",
    name: "ti-drv8871-dda",
    generator: "library/cad/py/catalog/ti-drv8871.py",
    tool: "build123d",
  }),
);
