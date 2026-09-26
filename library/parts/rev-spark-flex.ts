/**
 * REV Robotics SPARK Flex Motor Controller (REV-11-2159) — datasheet-honest UHD part.
 *
 * Sources (see ./rev-spark-flex/sources.json):
 *   - src_product:      REV-11-2159 product page — https://www.revrobotics.com/rev-11-2159/
 *   - src_specs:        SPARK Flex Specifications — https://docs.revrobotics.com/brushless/spark-flex/specs
 *   - src_power_motor:  Power and Motor Connections — https://docs.revrobotics.com/brushless/spark-flex/spark-flex-feature-description/power-and-motor-connections
 *   - src_control:      Control Connections — https://docs.revrobotics.com/brushless/spark-flex/spark-flex-feature-description/control-connections
 *   - src_data_port:    Data Port — https://docs.revrobotics.com/brushless/spark-flex/spark-flex-feature-description/data-port
 *   - src_mounting:     Mounting Holes — https://docs.revrobotics.com/brushless/spark-flex/spark-flex-feature-description/mounting-holes
 *   - src_dock / src_overview: Flex Dock and SPARK Flex overview (REV docs)
 *   - src_drawing:      NEO Vortex and SPARK Flex drawing — https://www.revrobotics.com/content/docs/REV-21-1652-REV-11-2159-DR.pdf
 *   - src_cad:          NEO Vortex and SPARK Flex STEP (combined) — https://revrobotics.com/content/cad/NEO-Vortex-Moter-and-SPARK-Flex-Motor-Controller-with-8mm-Shaft.STEP
 *   - src_protopart:    ProtoPart rev-spark-flex-rev-11-2159 definition (community starting point only)
 *
 * Modelling notes:
 *   - Power: integrated + (red) / - (black) 12 AWG leads, 450 mm. `vin`
 *     PowerIn 6-24 V (12 V nominal), 60 A continuous (3 min); 100 A / 2 s
 *     surge and 30 V absolute max are traits. REV's specs table says 6 V min
 *     (for the 5 V Data Port output) and 4.5 V before brown-out; the feature
 *     page says "any DC power source between 4.5 V and 24 V"
 *     (source_discrepancy; 6 V used so the Data Port 5 V is valid).
 *   - Motor phases leave through the docking interface (three contacts, no
 *     wires): BrushlessPhases (output) with termination "dock_contact", 60 A /
 *     100 A. The phase contacts carry no published A/B/C labels (the builder's
 *     A/B/C designators are used). The dock also has a sensor connector
 *     (`dock_sensor`, a 2x10 0.8 mm board-to-board header in REV's STEP) whose
 *     pinout REV does not publish (data_gap); it is a `custom` leaf. It mates
 *     the NEO Vortex or a Flex Dock, which provides phase wires and a 6-pin
 *     JST-PH encoder port for NEO / NEO 550.
 *   - CAN/PWM: two integrated yellow (CANH / PWM signal) and two green
 *     (CANL / PWM ground) 26 AWG twisted wires, 450 mm, ending in two 1x3
 *     0.1 in connectors without centre pins (one pinned, one socketed; pairs
 *     joined inside, bus unbroken when unpowered). `can_bus` uses the existing
 *     `can` type (role transceiver) with can_h/can_l leaves (leaf protocol
 *     `can`, role `peer`, the library CAN convention shared with
 *     ctre-talon-srx), slots matched by capability like the other REV parts;
 *     `pwm_in` (pwm_esc input) is the PWM alternative; `control_mode` one_of.
 *   - Data Port: 2x5 0.05 in keyed latching (Samtec ISDF-05-D-M mating
 *     housing). Leaves for pins 2-10; pin 1 is "Reserved" and is omitted.
 *   - Mount: six tapped #10-32 holes on a 2 in (50.8 mm) circle, max depth
 *     0.25 in, at 0/45/135/180/225/315 deg (none at 90/270, the flat sides).
 *     BoltPattern circle of the 4 diagonal holes (the regular subset), the
 *     0/180 deg pair in the note and an assumption trait. ProtoPart had six
 *     equal "mount_hole" resources (no angles).
 *   - No operating temperature in REV's sources (data_gap); justifies the
 *     verify "coverage" warning. Re-checked in the PB-796 audit: product page,
 *     specs, feature-description pages, drawing and the status-LED page
 *     (which only names a "Temperature Cutoff Fault", no value) give none.
 *   - Geometry: REV publishes the SPARK Flex only inside the combined NEO
 *     Vortex + SPARK Flex STEP; library/cad/py/catalog/rev-spark-flex.py
 *     extracts the "REV-11-2159" sub-assembly (unchanged coordinates) and
 *     binds it. Nothing is committed (licence not stated). No transform:
 *     mounting face y = 0 facing -Y, body to y = 28.2, through bore on Y.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { BoltPattern, BrushlessPhases, EscSignal, Ground, PowerIn, PowerOut, connectorTrait, defineModule } from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://www.revrobotics.com/rev-11-2159/",
  specs: "https://docs.revrobotics.com/brushless/spark-flex/specs",
  powerMotor: "https://docs.revrobotics.com/brushless/spark-flex/spark-flex-feature-description/power-and-motor-connections",
  control: "https://docs.revrobotics.com/brushless/spark-flex/spark-flex-feature-description/control-connections",
  dataPort: "https://docs.revrobotics.com/brushless/spark-flex/spark-flex-feature-description/data-port",
  mounting: "https://docs.revrobotics.com/brushless/spark-flex/spark-flex-feature-description/mounting-holes",
  dock: "https://docs.revrobotics.com/brushless/spark-flex/overview/dock",
  overview: "https://docs.revrobotics.com/brushless/spark-flex/overview",
  drawing: "https://www.revrobotics.com/content/docs/REV-21-1652-REV-11-2159-DR.pdf",
  cad: "https://revrobotics.com/content/cad/NEO-Vortex-Moter-and-SPARK-Flex-Motor-Controller-with-8mm-Shaft.STEP",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/rev-spark-flex-rev-11-2159/definition.json",
} as const;

type Vec3 = [number, number, number];

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function pinFn(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

function leaf(id: string, name: string, pin: string | number, type: string, role: string, capability: string, traits: TraitDef[]): InterfaceDef {
  return {
    id,
    name,
    pin,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type, roles: [role] }],
    capabilities: [capability],
    traits,
  };
}

// ---------------------------------------------------------------------------
// Power input (integrated 12 AWG leads)
// ---------------------------------------------------------------------------

const LEAD = (colour: string) =>
  connectorTrait("bare_wire_lead", { note: `Integrated ${colour} 12 AWG ultra-flexible silicone lead, 450 mm (17.72 in) from the case.` });

const vin = withTraits(PowerIn({ id: "vin", name: "+ (red)", pin: "+", voltageV: [6, 24], nominalV: 12, maxCurrentA: 60 }), [
  pinFn("+ — main power input, red lead. 12 V nominal, 6-24 V operating (6 V minimum for the 5 V Data Port output; 4.5 V minimum before full brown-out).", [SRC.specs, SRC.powerMotor]),
  LEAD("red"),
  { type: "absolute_maximum", params: { supply_voltage_V: 30, note: "DO NOT exceed the maximum supply voltage of 30 V.", source: [SRC.specs, SRC.powerMotor] } },
  {
    type: "usage_note",
    params: {
      note: "Current limits: 60 A for 3 minutes, 100 A for 2 seconds. Add a fuse or breaker between the SPARK Flex and its supply. Reverse polarity protection is built in (product page). Dock and undock only with main and USB power disconnected.",
      source: [SRC.powerMotor, SRC.specs, SRC.product],
    },
  },
  {
    type: "source_discrepancy",
    params: {
      field: "operating voltage minimum",
      values: ["6 V (specs table; 6 V needed for the Data Port 5 V output, 4.5 V before full brown-out)", "4.5 V ('compatible with any DC power source between 4.5 V and 24 V', feature page)", "6 V (ProtoPart main_12v 6-24 V)"],
      sources: [SRC.specs, SRC.powerMotor, SRC.protopart],
      resolution: "6-24 V modelled (full function including Data Port 5 V); the controller keeps running down to 4.5 V.",
    },
  },
]);

const vinGnd = withTraits(Ground({ id: "vin_gnd", name: "- (black)", pin: "-", maxCurrentA: 60 }), [
  pinFn("- — main power return, black lead.", SRC.powerMotor),
  LEAD("black"),
]);

// ---------------------------------------------------------------------------
// Docking interface: motor phases + sensor connector
// ---------------------------------------------------------------------------

const motorOut = BrushlessPhases({
  id: "motor_out",
  name: "Motor phases (dock contacts)",
  role: "output",
  maxCurrentA: 60,
  burstCurrentA: 100,
  termination: "dock_contact",
}).map((iface) =>
  iface.id === "motor_out"
    ? withTraits(iface, [
        {
          type: "usage_note",
          params: {
            note: "Phases leave through the docking interface (no wires). Dock to a NEO Vortex (REV-21-1652) or a Flex Dock (standard phase wires + 6-pin JST-PH encoder port for NEO / NEO 550 or brushed motors). Secure with the 4 x M3 x 25 mm SHCS docking screws (included); operating without them can cause unintended behaviour and damage. 100 A is the 2 s surge rating; 60 A continuous is tested for 3 minutes. 3-phase current sensing.",
            burst_duration_s: 2,
            source: [SRC.powerMotor, SRC.specs, SRC.dock, SRC.overview],
          },
        },
      ])
    : withTraits(iface, [pinFn("Docking-interface motor phase contact (REV publishes no per-contact label).", [SRC.powerMotor, SRC.cad])]),
);

const dockSensor: InterfaceDef = {
  id: "dock_sensor",
  name: "Dock sensor connector",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "custom", roles: ["peer"] }],
  capabilities: ["flex_dock_sensor"],
  max_instances: 1,
  traits: [
    connectorTrait("board_to_board_2x10_0.8mm", {
      positions: 20,
      note: "Docking-interface sensor connector; REV's STEP names it a 0.8 mm pitch 2x10 board-to-board male header. REV publishes no pinout.",
    }),
    pinFn("Docking interface sensor connection to the NEO Vortex or Flex Dock (motor sensor signals).", [SRC.powerMotor, SRC.product]),
  ],
};

// ---------------------------------------------------------------------------
// CAN/PWM control wires
// ---------------------------------------------------------------------------

const CONTROL_WIRES = connectorTrait("dupont_1x3_0.1in", {
  positions: 3,
  pinout: ["yellow (CANH / PWM signal)", "(no centre pin)", "green (CANL / PWM ground)"],
  note: "Two yellow and two green 26 AWG twisted wires, 450 mm, terminated in two 1 x 3, 0.1 in pitch rectangular connectors with the centre pin excluded; one pinned and one socketed, for daisy-chaining. Matching pairs are joined inside, so the CAN bus stays unbroken if the SPARK Flex loses power. PWM Cable Clips (REV-11-1229) included. Pin order within the 1x3 housing is not stated (yellow/green outer positions).",
});

const canH = leaf("can_h", "CANH (yellow pair)", "yellow", "can", "peer", "can_h", [
  pinFn("Yellow pair — CAN High in CAN mode; PWM signal in PWM mode.", SRC.control),
  CONTROL_WIRES,
]);
const canL = leaf("can_l", "CANL (green pair)", "green", "can", "peer", "can_l", [
  pinFn("Green pair — CAN Low in CAN mode; PWM ground in PWM mode.", SRC.control),
  CONTROL_WIRES,
]);

const canBus: InterfaceDef = {
  id: "can_bus",
  name: "CAN bus",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "can", roles: ["transceiver"] }],
  slots: [
    { id: "can_h", required: true, label: "CANH", match: { protocol: "can", capability: "can_h" } },
    { id: "can_l", required: true, label: "CANL", match: { protocol: "can", capability: "can_l" } },
  ],
  profiles: [{ id: "can_bus_wires", label: "Yellow / green control wires", default_active: true, bindings: { can_h: "can_h", can_l: "can_l" } }],
  max_instances: 1,
  traits: [
    CONTROL_WIRES,
    {
      type: "usage_note",
      params: {
        note: "CAN control and telemetry; colours must match connector to connector along the whole bus. The controller auto-detects CAN vs PWM on the same wires. No bit rate or termination is stated for the SPARK Flex.",
        source: [SRC.control, SRC.product],
      },
    },
  ],
};

const pwmIn = withTraits(EscSignal({ id: "pwm_in", name: "PWM signal (yellow)", pin: "yellow", role: "input", protocols: ["pwm"], defaultActive: false }), [
  pinFn("Yellow wire — servo-style PWM signal input in PWM mode; green is its ground. Use only one of the two connectors (normally the socketed one).", SRC.control),
  CONTROL_WIRES,
  {
    type: "usage_note",
    params: {
      note: "PWM input: 1000 / 1500 / 2000 us full reverse / neutral / full forward, valid 500-2500 us at 50-200 Hz, 50 ms timeout, default deadband 5 (the specs table gives the unit as Hz, verbatim). Input high level 0.5-0.9 V (typ 0.7 V).",
      source: SRC.specs,
    },
  },
]);

// ---------------------------------------------------------------------------
// USB-C
// ---------------------------------------------------------------------------

const usb: InterfaceDef = {
  id: "usb_c",
  name: "USB-C",
  domain: "electrical",
  exposed: true,
  default_active: false,
  protocols: [{ type: "usb", roles: ["device"] }],
  traits: [
    connectorTrait("usb_c", { gender: "receptacle", note: "USB-C above the CAN/PWM wires." }),
    {
      type: "usage_note",
      params: {
        note: "USB 2.0 configuration and control (REV Hardware Client). USB can power the internal microcontroller but not the motor output.",
        source: [SRC.control, SRC.product],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Data Port (2x5, 0.05 in pitch, keyed latching)
// ---------------------------------------------------------------------------

const DATA_PORT = connectorTrait("samtec_tfm_2x5_1.27mm", {
  positions: 10,
  pinout: [
    "Reserved",
    "+5V",
    "Analog Input",
    "Forward Limit Switch Input",
    "External Encoder - B Input",
    "Absolute Encoder - Duty Cycle Input",
    "External Encoder - A Input",
    "Reverse Limit Switch Input",
    "External Encoder - Index Input",
    "Ground",
  ],
  note: "0.05 in pitch 2 x 5 keyed, latching Data Port next to the power and control wires. Custom cables: Samtec ISDF-05-D-M latching housing with CC03R-2830-01-G(F) contacts (28-30 AWG). Accessories: Data Port Breakout Cable REV-11-2853 (JST-PH 6 for the Through Bore Encoder + 4 x 3-pin), Pigtail Cable REV-11-2852.",
});
const DIN = "Digital input 0-5 V, VIH >= 1.85 V, VIL <= 1.36 V.";

const dp5v = withTraits(PowerOut({ id: "dp_5v", name: "DP +5V", pin: 2, voltageV: 5, maxCurrentA: 0.5 }), [
  pinFn("Pin 2 — Power: +5V sensor supply, 500 mA max (may be reduced on USB-only power; needs >= 6 V main input).", [SRC.dataPort, SRC.specs]),
  DATA_PORT,
]);
const dpAnalog = leaf("dp_analog", "Analog Input", 3, "analog", "input", "analog_input", [
  pinFn("Pin 3 — Analog Input, 0 to Vout (the 5 V supply output).", [SRC.dataPort, SRC.specs]),
  DATA_PORT,
]);
const dpFwd = leaf("dp_fwd_limit", "Forward Limit Switch Input", 4, "digital", "input", "limit_switch", [pinFn(`Pin 4 — Forward Limit Switch Input. ${DIN}`, [SRC.dataPort, SRC.specs]), DATA_PORT]);
const dpEncB = leaf("dp_enc_b", "External Encoder B", 5, "digital", "input", "encoder_b", [pinFn(`Pin 5 — External Encoder - B Input. ${DIN}`, [SRC.dataPort, SRC.specs]), DATA_PORT]);
const dpAbs = leaf("dp_abs_duty", "Absolute Encoder Duty Cycle", 6, "digital", "input", "absolute_encoder_duty_cycle", [
  pinFn(`Pin 6 — Absolute Encoder - Duty Cycle Input. ${DIN}`, [SRC.dataPort, SRC.specs]),
  DATA_PORT,
]);
const dpEncA = leaf("dp_enc_a", "External Encoder A", 7, "digital", "input", "encoder_a", [pinFn(`Pin 7 — External Encoder - A Input. ${DIN}`, [SRC.dataPort, SRC.specs]), DATA_PORT]);
const dpRev = leaf("dp_rev_limit", "Reverse Limit Switch Input", 8, "digital", "input", "limit_switch", [pinFn(`Pin 8 — Reverse Limit Switch Input. ${DIN}`, [SRC.dataPort, SRC.specs]), DATA_PORT]);
const dpIdx = leaf("dp_enc_index", "External Encoder Index", 9, "digital", "input", "encoder_index", [pinFn(`Pin 9 — External Encoder - Index Input. ${DIN}`, [SRC.dataPort, SRC.specs]), DATA_PORT]);
const dpGnd = withTraits(Ground({ id: "dp_gnd", name: "DP GND", pin: 10 }), [pinFn("Pin 10 — Ground.", SRC.dataPort), DATA_PORT]);

// ---------------------------------------------------------------------------
// Mechanical
// ---------------------------------------------------------------------------

const mount = withTraits(
  BoltPattern({
    id: "mount",
    name: "Mounting face #10-32 on 2 in circle",
    role: "component",
    shape: "circle",
    spacingMm: 50.8,
    holeCount: 4,
    fastener: "#10-32 UNF",
    fastenerDiameterMm: 4.83,
    threaded: true,
    note: "Modelled: the 4 diagonal holes (45/135/225/315 deg) of the six tapped #10-32 holes on the 2 in (50.8 mm) circle; the other two are at 0/180 deg on the rounded sides. Absolute maximum screw depth 0.25 in (6.3 mm): check with the laser-etched depth gauges on the body. Mounting footprint: 2 in across the flats, 60 mm across the rounded sides; fits behind a standard 2 in rectangular tube.",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "bolt pattern subset",
        value: "4 holes at 45/135/225/315 deg of the 6-hole 50.8 mm circle",
        reason: "The six holes are not equally spaced (drawing: 45 deg steps, none at 90/270 deg); the largest regular subset is modelled so the pattern can be placed and checked. Angles from the drawing and the STEP.",
        source: [SRC.drawing, SRC.cad, SRC.mounting],
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const REV_SPARK_FLEX_BASE: ModuleDef = defineModule({
  id: "rev-spark-flex",
  name: "REV SPARK Flex Motor Controller",
  version: "1.0.0",
  manufacturer: "REV Robotics",
  part_number: "REV-11-2159",
  description:
    "Dockable brushed / brushless motor controller for FRC (REV ION). Docks directly onto a NEO Vortex (or a Flex Dock for NEO, NEO 550 and brushed motors) through a phase-and-sensor docking interface. 6-24 V (12 V nominal, 30 V abs. max), 60 A continuous, 100 A 2 s surge, 3-phase current sensing, reverse polarity protection. Integrated 12 AWG power leads and 26 AWG CAN/PWM wires (450 mm), USB-C, latching 10-pin Data Port. Six #10-32 holes on a 2 in circle, 16.5 mm through bore, 28.2 mm long, 130 g.",
  tags: ["frc", "rev-ion", "motor-controller", "brushless", "brushed", "can", "pwm", "usb-c", "spark-flex", "neo-vortex"],
  categories: ["motor_controller"],

  interfaces: [
    vin,
    vinGnd,
    ...motorOut,
    dockSensor,
    canH,
    canL,
    canBus,
    pwmIn,
    usb,
    dp5v,
    dpAnalog,
    dpFwd,
    dpEncB,
    dpAbs,
    dpEncA,
    dpRev,
    dpIdx,
    dpGnd,
    mount,
  ],

  interfaceGroups: [
    { id: "control_mode", label: "CAN/PWM wires: CAN or PWM (auto-detected)", members: ["can_bus", "pwm_in"], policy: "one_of" },
    { id: "dock", label: "Docking interface (phases + sensor)", members: ["motor_out", "dock_sensor"], policy: "all_of" },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vin", name: "Main input (+/-)", nominal_voltage_V: 12, voltage_range_V: [6, 24], max_current_mA: 60000 },
        { id: "dp_5v", name: "Data Port 5 V output", nominal_voltage_V: 5, max_current_mA: 500 },
      ],
      metadata: {
        absolute_max_supply_V: 30,
        brownout_V: 4.5,
        continuous_current_A: 60,
        continuous_current_test_duration_min: 3,
        surge_current_A: 100,
        surge_duration_s: 2,
        source: [SRC.specs, SRC.powerMotor],
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 60, width: 50.8, height: 28.2 },
      weight_g: 130,
      metadata: {
        body_length_not_docked_mm: 28.2,
        footprint: "2 in across the flats, 60 mm across the rounded sides",
        through_bore_mm: 16.5,
        mounting_holes: "6 x #10-32 on 2 in circle, 0.25 in max depth",
        docking_hardware: "4 x M3 SHCS x 25 mm (included)",
        weight_note: "130 g with wires and docking screws (docs); the product page says 142 g with wires.",
        source: [SRC.specs, SRC.product, SRC.drawing],
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "motor_controller",
        motor_types: ["brushless DC (NEO Vortex docked; NEO / NEO 550 via Flex Dock)", "brushed DC (via Flex Dock)"],
        control_interfaces: ["PWM", "CAN", "USB"],
        control_modes: ["velocity", "position", "current"],
        features: ["3-phase current shunt measurement", "reverse polarity protection"],
        continuous_current_A: 60,
        surge_current_A: 100,
        surge_duration_s: 2,
        source: [SRC.product, SRC.overview, SRC.specs],
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "weight",
        values: ["130 g with wires and docking screws (docs specs)", "142 g with wires (product page)"],
        sources: [SRC.specs, SRC.product],
        resolution: "Docs value used for weight_g; both recorded.",
      },
    },
    {
      type: "data_gap",
      params: {
        fields: ["operating / storage temperature", "dock sensor connector pinout", "phase contact labels", "CAN bit rate / termination", "control-wire 1x3 housing part number"],
        note: "Not stated in the REV sources read (product page, specs, feature-description pages, drawing).",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "ProtoPart model",
        values: [
          "ProtoPart: 6-24 V, 100 A main domain; 6 identical #10-32 holes; data port pin 9 'digital_input'; dock connector without phases",
          "REV: 6-24 V at 60 A continuous / 100 A 2 s; holes at 0/45/135/180/225/315 deg; pin 9 External Encoder Index; dock carries the motor phases and sensor",
        ],
        sources: [SRC.protopart, SRC.specs, SRC.drawing, SRC.dataPort, SRC.powerMotor],
        resolution: "Manufacturer documentation used; ProtoPart was a starting point only.",
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "SPARK Flex product page", type: "datasheet", url: SRC.product },
    { id: "art_specs", name: "SPARK Flex Specifications", type: "datasheet", url: SRC.specs },
    { id: "art_control", name: "SPARK Flex Control Connections", type: "documentation", url: SRC.control },
    { id: "art_data_port", name: "SPARK Flex Data Port", type: "documentation", url: SRC.dataPort },
    { id: "art_mounting", name: "SPARK Flex Mounting Holes", type: "documentation", url: SRC.mounting },
    { id: "art_drawing", name: "NEO Vortex and SPARK Flex drawing", type: "datasheet", url: SRC.drawing },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): the SPARK Flex sub-assembly of REV's combined STEP,
// bound by library/cad/py/catalog/rev-spark-flex.py (no transform: mounting
// face y = 0 facing -Y, docking side +Y, leads toward +X).
// ---------------------------------------------------------------------------

const F_DOCK = vendorFeature("dock_phases", { area_mm2: 936.497, centroid: [-20.949, 16.232, 0.0] });
const F_DATA = vendorFeature("data_port", { area_mm2: 2149.123, centroid: [22.958, 20.573, 16.226] });
const F_POWER = vendorFeature("power_leads", { area_mm2: 9513.253, centroid: [164.538, 9.1, 0.0] });
const F_CTRL = vendorFeature("control_wires", { area_mm2: 6327.91, centroid: [165.739, 13.497, 0.0] });
const onData = { frame: { origin: [23.0, 20.6, 16.2] as Vec3, normal: [1, 0, 0] as Vec3 }, refs: [F_DATA, vendorOwn("data_port")] };

export const REV_SPARK_FLEX: ModuleDef = withGeometry(
  REV_SPARK_FLEX_BASE,
  {
    // Mounting face y = 0; the structure approaches from -Y. xAxis toward the
    // 45 deg hole at (17.96, 0, 17.96); the 4 diagonal holes repeat every 90 deg.
    mount: {
      frame: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [0.7071, 0, 0.7071], symmetryDeg: 90 },
      refs: [vendorFeature("mount", { area_mm2: 402.832, centroid: [0.0, 3.175, 0.0] }), vendorOwn("mount"), procedural("bolt_pattern")],
    },
    // Dock contacts face the motor (+Y)
    motor_out: { frame: { origin: [-20.9, 28.2, 0], normal: [0, 1, 0] }, refs: [F_DOCK, vendorOwn("dock_phases")] },
    motor_out_a: { refs: [F_DOCK] },
    motor_out_b: { refs: [F_DOCK] },
    motor_out_c: { refs: [F_DOCK] },
    dock_sensor: { frame: { origin: [2.0, 25.0, -20.0], normal: [0, 1, 0] }, refs: [vendorFeature("dock_sensor", { area_mm2: 910.521, centroid: [2.0, 20.909, -20.035] })] },
    vin: { refs: [F_POWER] },
    vin_gnd: { refs: [F_POWER] },
    can_bus: { refs: [F_CTRL] },
    can_h: { refs: [F_CTRL] },
    can_l: { refs: [F_CTRL] },
    pwm_in: { refs: [F_CTRL] },
    usb_c: { refs: [vendorFeature("usb_c", { area_mm2: 633.673, centroid: [25.086, 19.298, 0.516] })] },
    dp_5v: onData,
    dp_analog: onData,
    dp_fwd_limit: onData,
    dp_enc_b: onData,
    dp_abs_duty: onData,
    dp_enc_a: onData,
    dp_rev_limit: onData,
    dp_enc_index: onData,
    dp_gnd: onData,
  },
  vendorCadArtifacts({
    partId: "rev-spark-flex",
    name: "REV-11-2159",
    url: SRC.cad,
    stepFile: "REV-11-2159-extracted.step",
    sha256: "f8a9c317ab5ecb0e807af9b0e4f5066063baf8b05ff7381e07260f9429aa180b",
    licence: "not stated by REV Robotics; not redistributed",
    interfaces: ["mount", "dock_phases", "data_port"],
  }),
);
