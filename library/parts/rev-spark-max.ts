/**
 * REV Robotics SPARK MAX Motor Controller (REV-11-2158) — datasheet-honest UHD part.
 *
 * Sources (see ./rev-spark-max/sources.json):
 *   - src_product:      REV-11-2158 product page — https://www.revrobotics.com/rev-11-2158/
 *   - src_specs:        SPARK MAX Specifications — https://docs.revrobotics.com/brushless/spark-max/specs
 *   - src_power_motor:  Power and Motor Connections — https://docs.revrobotics.com/brushless/spark-max/specs/power-and-motor-connections
 *   - src_control:      Control Connections (CAN/PWM port, USB-C) — https://docs.revrobotics.com/brushless/spark-max/specs/control-connections
 *   - src_encoder_port: Encoder Port — https://docs.revrobotics.com/brushless/spark-max/specs/encoder-port
 *   - src_data_port:    Data Port — https://docs.revrobotics.com/brushless/spark-max/specs/data-port
 *   - src_overview / src_wiring: SPARK MAX overview and wiring guide (REV docs)
 *   - src_drawing:      REV-11-2158 drawing — https://www.revrobotics.com/content/docs/REV-11-2158-DR.pdf
 *   - src_cad:          REV-11-2158 STEP — https://www.revrobotics.com/content/cad/REV-11-2158.STEP
 *   - src_protopart:    ProtoPart rev-spark-max definition (community starting point only)
 *
 * Modelling notes:
 *   - Power: integrated V+ (red) / V- (black) 12 AWG leads, 150 mm. `vin` is
 *     PowerIn 5.5-24 V (12 V nominal), 60 A continuous; the 100 A / 2 s surge
 *     and the 30 V absolute maximum are traits. ProtoPart said 6-16 V; REV
 *     says 5.5-24 V (source_discrepancy trait).
 *   - Motor output: BrushlessPhases (output) on the A (red), B (black), C
 *     (white) 12 AWG leads, 60 A continuous / 100 A burst. Brushed motors use
 *     A and B only (usage_note).
 *   - CAN/PWM port: locking 4-pin JST-PH, pins 1/3 = CAN High or PWM signal,
 *     2/4 = CAN Low or PWM ground, identical pins joined inside (daisy chain).
 *     `can_bus` is the existing `can` type (role transceiver) with two leaf
 *     conductors can_h/can_l (leaf protocol `can`, role `peer`, the library
 *     CAN convention shared with ctre-talon-srx: peer <-> peer suits one wire
 *     of a differential bus). Slots are matched by capability (can_h/can_l) with every
 *     other REV part in this batch. `pwm_in` is a servo-PWM input (pwm_esc)
 *     on the same pins; `control_mode` groups them one_of.
 *   - ENCODER port (6-pin JST-PH): leaves per pin (1 GND, 2 C/Index, 3 B,
 *     4 A, 5 motor temperature analog, 6 +5 V) composed into `encoder_port`.
 *     No vocabulary type exists for a hall/quadrature sensor port, so it is
 *     `custom` (peer) with typed slots (gaps.json vocabulary entry). Slot
 *     order matches rev-neo-brushless-v1-1 `sensor` so the pair resolves.
 *   - Data Port (10-pin, 1.27 mm): one leaf per pin with the REV pin function.
 *     Its quadrature pins share the encoder-port signals (usage_note). The
 *     5 V rail (100 mA) is shared between the Data Port and ENCODER port.
 *   - USB-C: USB 2.0 device; it powers only the microcontroller.
 *   - Mechanical: the SPARK MAX has no mounting holes (zip-tie notches only,
 *     drawing), so there is no BoltPattern; recorded as a usage_note. This
 *     justifies verify's "no mechanical interfaces" warning.
 *   - No operating-temperature figure in any REV source (data_gap), which
 *     justifies verify's "no thermal domain / operating_conditions" coverage
 *     warning. Audit re-check (2026-09-26): the product page and all 19
 *     docs.revrobotics.com/brushless/spark-max pages give none; the specs page
 *     only warns that 60 A continuous heats the heat sink.
 *   - Geometry: manufacturer STEP (not redistributable, not committed), bound
 *     by library/cad/py/catalog/rev-spark-max.py after a transform to Z-up
 *     with the heat-sink face at z = 0. Connector features are selected by
 *     position (the STEP has no component names).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  BrushlessPhases,
  EscSignal,
  Ground,
  PowerIn,
  PowerOut,
  connectorTrait,
  defineModule,
} from "../../src/protocols/index.js";
import { vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://www.revrobotics.com/rev-11-2158/",
  specs: "https://docs.revrobotics.com/brushless/spark-max/specs",
  powerMotor: "https://docs.revrobotics.com/brushless/spark-max/specs/power-and-motor-connections",
  control: "https://docs.revrobotics.com/brushless/spark-max/specs/control-connections",
  encoderPort: "https://docs.revrobotics.com/brushless/spark-max/specs/encoder-port",
  dataPort: "https://docs.revrobotics.com/brushless/spark-max/specs/data-port",
  overview: "https://docs.revrobotics.com/brushless/spark-max/overview",
  wiring: "https://docs.revrobotics.com/brushless/spark-max/gs/wiring",
  drawing: "https://www.revrobotics.com/content/docs/REV-11-2158-DR.pdf",
  cad: "https://www.revrobotics.com/content/cad/REV-11-2158.STEP",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/rev-spark-max/definition.json",
} as const;

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function pinFn(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

/** A signal leaf with an explicit protocol (digital/analog input or a CAN conductor). */
function leaf(
  id: string,
  name: string,
  pin: string | number,
  protocol: { type: string; role: string },
  capability: string,
  traits: TraitDef[],
): InterfaceDef {
  return {
    id,
    name,
    pin,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: protocol.type, roles: [protocol.role] }],
    capabilities: [capability],
    traits,
  };
}

// ---------------------------------------------------------------------------
// Power input and motor output (integrated 12 AWG leads)
// ---------------------------------------------------------------------------

const LEAD_12AWG = (colour: string) =>
  connectorTrait("bare_wire_lead", {
    note: `Integrated ${colour} 12 AWG ultra-flexible silicone lead, ~150 mm from the end face; not replaceable. REV recommends Anderson Powerpole connectors.`,
  });

const vin = withTraits(
  PowerIn({ id: "vin", name: "V+ (red)", pin: "V+", voltageV: [5.5, 24], nominalV: 12, maxCurrentA: 60 }),
  [
    pinFn("V+ — main power input, red lead. 12 V nominal, 5.5-24 V operating; brown-out below 5.5 V.", [SRC.powerMotor, SRC.specs]),
    LEAD_12AWG("red"),
    {
      type: "absolute_maximum",
      params: { supply_voltage_V: 30, note: "DO NOT exceed the maximum supply voltage of 30 V.", source: [SRC.specs, SRC.powerMotor] },
    },
    {
      type: "usage_note",
      params: {
        note: "Current limits: 60 A for 3 minutes, 100 A for 2 seconds. Fit a fuse or breaker between the SPARK MAX and its supply (e.g. a PDH/PDP channel). Reversing V+/V- or swapping power and motor leads permanently damages the controller. Fully charged battery voltage must stay below 24 V (6S LiPo exceeds it).",
        source: [SRC.powerMotor, SRC.specs],
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "operating voltage range",
        values: ["5.5-24 V (REV specs and product page)", "6-16 V (ProtoPart 12v-in power domain)"],
        sources: [SRC.specs, SRC.product, SRC.protopart],
        resolution: "Manufacturer value used: 5.5-24 V, 12 V nominal, 30 V absolute maximum.",
      },
    },
  ],
);

const vinGnd = withTraits(Ground({ id: "vin_gnd", name: "V- (black)", pin: "V-", maxCurrentA: 60 }), [
  pinFn("V- — main power return, black lead.", [SRC.powerMotor]),
  LEAD_12AWG("black"),
]);

const PHASE_COLOUR: Record<string, string> = { A: "red", B: "black", C: "white" };

const motorOut = BrushlessPhases({
  id: "motor_out",
  name: "Motor output A/B/C",
  role: "output",
  phases: [
    { pin: "A", name: "A (red)" },
    { pin: "B", name: "B (black)" },
    { pin: "C", name: "C (white)" },
  ],
  maxCurrentA: 60,
  burstCurrentA: 100,
  termination: "bare_wire_lead",
}).map((iface) => {
  if (iface.id === "motor_out") {
    return withTraits(iface, [
      {
        type: "usage_note",
        params: {
          note: "Brushless: connect all three leads; the order must match the motor (NEO red/black/white to A/B/C) or the motor will not spin and can be damaged. Brushed: motor M+ to A (red), M- to B (black); insulate and secure C. The controller cannot detect the motor type: configure Brushed/Brushless mode. 100 A burst is the 2 s surge rating; 60 A continuous is rated for 3 minutes. Output switching frequency 20 kHz.",
          burst_duration_s: 2,
          source: [SRC.powerMotor, SRC.wiring, SRC.specs],
        },
      },
    ]);
  }
  const letter = String(iface.pin);
  return withTraits(iface, [
    pinFn(`${letter} — motor output lead (${PHASE_COLOUR[letter]}), 12 AWG, ~150 mm.`, [SRC.powerMotor, SRC.specs]),
  ]);
});

// ---------------------------------------------------------------------------
// CAN/PWM port (locking 4-pin JST-PH)
// ---------------------------------------------------------------------------

const CAN_PWM_PORT = connectorTrait("jst_ph_4", {
  gender: "receptacle",
  positions: 4,
  pinout: ["CAN High / PWM Signal", "CAN Low / PWM Ground", "CAN High / PWM Signal", "CAN Low / PWM Ground"],
  note: "Locking, keyed 4-pin JST-PH on the power-input end. Mating housing JST PHR-4 with SPH-002T-P0.5L contacts. Pins 1/3 and 2/4 are joined inside, completing the CAN daisy chain. Included cables: SPARK CAN Cable V2 (REV-11-1880) and SPARK PWM Cable (REV-11-1274), 200 mm 24 AWG.",
});

const canH = leaf("can_h", "CAN High (pins 1, 3)", "1/3", { type: "can", role: "peer" }, "can_h", [
  pinFn("Pins 1 and 3 — CAN High in CAN mode; PWM Signal in PWM mode.", SRC.control),
  CAN_PWM_PORT,
]);
const canL = leaf("can_l", "CAN Low (pins 2, 4)", "2/4", { type: "can", role: "peer" }, "can_l", [
  pinFn("Pins 2 and 4 — CAN Low in CAN mode; PWM Ground in PWM mode.", SRC.control),
  CAN_PWM_PORT,
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
  profiles: [{ id: "can_bus_port", label: "CAN/PWM port", default_active: true, bindings: { can_h: "can_h", can_l: "can_l" } }],
  max_instances: 1,
  traits: [
    CAN_PWM_PORT,
    {
      type: "usage_note",
      params: {
        note: "CAN control and telemetry. CAN and USB control are supported for the FRC roboRIO and the REV Hardware Client only. The port auto-detects CAN vs PWM. The bus is daisy-chained through the port (pins 1/3 and 2/4 joined inside). No bit rate or termination is stated for the SPARK MAX.",
        source: [SRC.control, SRC.product],
      },
    },
  ],
};

const pwmIn = withTraits(
  EscSignal({ id: "pwm_in", name: "PWM signal (pins 1, 3)", pin: "1/3", role: "input", protocols: ["pwm"], defaultActive: false }),
  [
    pinFn("Pins 1/3 — servo-style PWM signal input in PWM mode; pins 2/4 are its ground.", SRC.control),
    CAN_PWM_PORT,
    {
      type: "usage_note",
      params: {
        note: "PWM input: 1000 us full reverse, 1500 us neutral, 2000 us full forward; valid 500-2500 us at 50-200 Hz; output disabled after 50 ms without a valid pulse; default deadband 5 %. Input high level 0.5-0.9 V (typ 0.7 V); input voltage max 12 V (REV table, verbatim).",
        source: SRC.specs,
      },
    },
  ],
);

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
    connectorTrait("usb_c", { gender: "receptacle", note: "USB type C on the power-input end, beside the CAN/PWM port. USB-A to USB-C cable included." }),
    {
      type: "usage_note",
      params: {
        note: "USB 2.0 configuration and control (REV Hardware Client). USB supplies 5 V to the internal microcontroller only: the controller can be configured without main power but cannot spin a motor.",
        source: [SRC.control, SRC.product],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// ENCODER port (locking 6-pin JST-PH)
// ---------------------------------------------------------------------------

const ENCODER_PORT = connectorTrait("jst_ph_6", {
  gender: "receptacle",
  positions: 6,
  pinout: ["Ground", "Encoder C / Index", "Encoder B", "Encoder A", "Motor Temperature", "+5V"],
  note: "Locking, keyed 6-pin JST-PH labelled ENCODER on the motor-output end. Mating housing JST PHR-6 with SPH-002T-P0.5L contacts. Accepts the NEO / NEO 550 built-in hall encoder cable.",
});

const DIGITAL_IN_NOTE = "Digital input 0-5 V, VIH >= 1.85 V, VIL <= 1.36 V; not pulled up internally.";

const encGnd = withTraits(Ground({ id: "enc_gnd", name: "ENC GND", pin: 1 }), [
  pinFn("Pin 1 — Power: Ground.", SRC.encoderPort),
  ENCODER_PORT,
]);
const encC = leaf("enc_c", "Encoder C / Index", 2, { type: "digital", role: "input" }, "encoder_c", [
  pinFn(`Pin 2 — Digital: Encoder C / Index (hall C for NEO). ${DIGITAL_IN_NOTE}`, [SRC.encoderPort, SRC.specs]),
  ENCODER_PORT,
]);
const encB = leaf("enc_b", "Encoder B", 3, { type: "digital", role: "input" }, "encoder_b", [
  pinFn(`Pin 3 — Digital: Encoder B (hall B for NEO). ${DIGITAL_IN_NOTE}`, [SRC.encoderPort, SRC.specs]),
  ENCODER_PORT,
]);
const encA = leaf("enc_a", "Encoder A", 4, { type: "digital", role: "input" }, "encoder_a", [
  pinFn(`Pin 4 — Digital: Encoder A (hall A for NEO). ${DIGITAL_IN_NOTE}`, [SRC.encoderPort, SRC.specs]),
  ENCODER_PORT,
]);
const encTemp = leaf("enc_temp", "Motor Temperature", 5, { type: "analog", role: "input" }, "motor_temperature", [
  pinFn("Pin 5 — Analog: Motor Temperature (analog input range 0-3.3 V).", [SRC.encoderPort, SRC.specs]),
  ENCODER_PORT,
]);
const enc5v = withTraits(PowerOut({ id: "enc_5v", name: "ENC +5V", pin: 6, voltageV: 5, maxCurrentA: 0.1 }), [
  pinFn("Pin 6 — Power: +5V. 100 mA max, shared with the Data Port 5 V (total 5 V + 3.3 V <= 100 mA).", [SRC.encoderPort, SRC.specs]),
  ENCODER_PORT,
]);

const encoderPort: InterfaceDef = {
  id: "encoder_port",
  name: "ENCODER port (hall / quadrature sensor)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "custom", roles: ["peer"] }],
  capabilities: ["rev_encoder_port"],
  slots: [
    { id: "v5", required: true, label: "+5V", match: { protocol: "power", role: "output" } },
    { id: "gnd", required: true, label: "GND", match: { protocol: "power", role: "ground" } },
    { id: "hall_a", required: true, label: "A", match: { protocol: "digital", role: "input", capability: "encoder_a" } },
    { id: "hall_b", required: true, label: "B", match: { protocol: "digital", role: "input", capability: "encoder_b" } },
    { id: "hall_c", required: true, label: "C / Index", match: { protocol: "digital", role: "input", capability: "encoder_c" } },
    { id: "temp", required: false, label: "Motor temperature", match: { protocol: "analog", role: "input", capability: "motor_temperature" } },
  ],
  profiles: [
    {
      id: "encoder_port_jst",
      label: "ENCODER 6-pin JST-PH",
      default_active: true,
      bindings: { v5: "enc_5v", gnd: "enc_gnd", hall_a: "enc_a", hall_b: "enc_b", hall_c: "enc_c", temp: "enc_temp" },
    },
  ],
  max_instances: 1,
  traits: [
    ENCODER_PORT,
    {
      type: "usage_note",
      params: {
        note: "Sensor input for the NEO / NEO 550 built-in encoder (3-phase hall sensors + motor temperature); required for brushless operation (the motor will not spin without it). In Brushed mode it accepts an external quadrature encoder (A, B, Index). Protocol type is `custom` (no hall-sensor-port vocabulary; see gaps.json).",
        source: [SRC.encoderPort, SRC.wiring, SRC.product],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Data Port (10-pin, 1.27 mm pitch, top face)
// ---------------------------------------------------------------------------

const DATA_PORT = connectorTrait("rev_data_port_10", {
  positions: 10,
  pinout: [
    "+3.3V",
    "+5V",
    "Analog Input",
    "Forward Limit Switch Input",
    "Encoder B",
    "Multi-function Pin",
    "Encoder A",
    "Reverse Limit Switch Input",
    "Encoder C / Index",
    "Ground",
  ],
  note: "10-pin, 1.27 mm (0.050 in) pitch Data Port on the top of the controller; a port-saver cap is included. REV names no connector part number for the SPARK MAX Data Port.",
});

const dp3v3 = withTraits(PowerOut({ id: "dp_3v3", name: "DP +3.3V", pin: 1, voltageV: 3.3, maxCurrentA: 0.03 }), [
  pinFn("Pin 1 — Power: +3.3V, 30 mA max (5 V + 3.3 V total <= 100 mA).", [SRC.dataPort, SRC.specs]),
  DATA_PORT,
]);
const dp5v = withTraits(PowerOut({ id: "dp_5v", name: "DP +5V", pin: 2, voltageV: 5, maxCurrentA: 0.1 }), [
  pinFn("Pin 2 — Power: +5V, 100 mA max, shared with the ENCODER port.", [SRC.dataPort, SRC.specs]),
  DATA_PORT,
]);
const dpAnalog = leaf("dp_analog", "Analog Input", 3, { type: "analog", role: "input" }, "analog_input", [
  pinFn("Pin 3 — Analog Input, 0-3.3 V, 12-bit (81 uV); firmware 1.4.0 or newer.", [SRC.dataPort, SRC.specs]),
  DATA_PORT,
]);
const dpFwd = leaf("dp_fwd_limit", "Forward Limit Switch Input", 4, { type: "digital", role: "input" }, "limit_switch", [
  pinFn(`Pin 4 — Digital: Forward Limit Switch Input; by default triggered when grounded (normally-open switch), polarity configurable. ${DIGITAL_IN_NOTE}`, [SRC.dataPort, SRC.specs]),
  DATA_PORT,
]);
const dpEncB = leaf("dp_enc_b", "Encoder B", 5, { type: "digital", role: "input" }, "encoder_b", [
  pinFn(`Pin 5 — Digital: Encoder B (shared with ENCODER port pin 3). ${DIGITAL_IN_NOTE}`, [SRC.dataPort, SRC.specs]),
  DATA_PORT,
]);
const dpMulti = leaf("dp_multi", "Multi-function Pin", 6, { type: "digital", role: "input" }, "multi_function", [
  pinFn("Pin 6 — Digital: Multi-function Pin; reconfigured in Alternate Encoder Mode.", SRC.dataPort),
  DATA_PORT,
]);
const dpEncA = leaf("dp_enc_a", "Encoder A", 7, { type: "digital", role: "input" }, "encoder_a", [
  pinFn(`Pin 7 — Digital: Encoder A (shared with ENCODER port pin 4). ${DIGITAL_IN_NOTE}`, [SRC.dataPort, SRC.specs]),
  DATA_PORT,
]);
const dpRev = leaf("dp_rev_limit", "Reverse Limit Switch Input", 8, { type: "digital", role: "input" }, "limit_switch", [
  pinFn(`Pin 8 — Digital: Reverse Limit Switch Input; by default triggered when grounded, polarity configurable. ${DIGITAL_IN_NOTE}`, [SRC.dataPort, SRC.specs]),
  DATA_PORT,
]);
const dpEncC = leaf("dp_enc_index", "Encoder C / Index", 9, { type: "digital", role: "input" }, "encoder_c", [
  pinFn(`Pin 9 — Digital: Encoder C / Index (shared with ENCODER port pin 2). ${DIGITAL_IN_NOTE}`, [SRC.dataPort, SRC.specs]),
  DATA_PORT,
]);
const dpGnd = withTraits(Ground({ id: "dp_gnd", name: "DP GND", pin: 10 }), [
  pinFn("Pin 10 — Ground.", SRC.dataPort),
  DATA_PORT,
]);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const REV_SPARK_MAX_BASE: ModuleDef = defineModule({
  id: "rev-spark-max",
  name: "REV SPARK MAX Motor Controller",
  version: "1.0.0",
  manufacturer: "REV Robotics",
  part_number: "REV-11-2158",
  description:
    "Brushed and sensored-brushless DC motor controller for FRC with PWM, CAN and USB-C control. 5.5-24 V (12 V nominal, 30 V abs. max), 60 A continuous, 100 A 2 s surge. Integrated 12 AWG power (V+/V-) and motor (A/B/C) leads, locking 4-pin JST-PH CAN/PWM port, 6-pin JST-PH ENCODER port for the NEO hall sensor, 10-pin Data Port (limit switches, analog, quadrature). 70 x 35 x 25.5 mm, 113.3 g.",
  tags: ["frc", "rev-ion", "motor-controller", "brushless", "brushed", "can", "pwm", "usb-c", "spark-max"],
  categories: ["motor_controller"],

  interfaces: [
    vin,
    vinGnd,
    ...motorOut,
    canH,
    canL,
    canBus,
    pwmIn,
    usb,
    encGnd,
    encC,
    encB,
    encA,
    encTemp,
    enc5v,
    encoderPort,
    dp3v3,
    dp5v,
    dpAnalog,
    dpFwd,
    dpEncB,
    dpMulti,
    dpEncA,
    dpRev,
    dpEncC,
    dpGnd,
  ],

  interfaceGroups: [
    { id: "control_mode", label: "CAN/PWM port: CAN or PWM (auto-detected)", members: ["can_bus", "pwm_in"], policy: "one_of" },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vin", name: "Main input (V+/V-)", nominal_voltage_V: 12, voltage_range_V: [5.5, 24], max_current_mA: 60000 },
        { id: "sensor_5v", name: "5 V sensor supply (ENCODER + Data Port)", nominal_voltage_V: 5, max_current_mA: 100 },
        { id: "sensor_3v3", name: "3.3 V Data Port supply", nominal_voltage_V: 3.3, max_current_mA: 30 },
      ],
      metadata: {
        absolute_max_supply_V: 30,
        continuous_current_A: 60,
        continuous_current_rated_duration_min: 3,
        surge_current_A: 100,
        surge_duration_s: 2,
        output_frequency_kHz: 20,
        sensor_supply_total_mA: 100,
        source: [SRC.specs, SRC.powerMotor],
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 70, width: 35, height: 25.5 },
      weight_g: 113.3,
      metadata: {
        drawing_body_mm: [69.3, 34.5, 25.0],
        mounting: "No mounting holes; zip-tie notches 44.0 mm apart, 6.0 mm wide (drawing).",
        lead_length_mm: 150,
        lead_gauge_awg: 12,
        cooling: "passive",
        source: [SRC.specs, SRC.drawing, SRC.overview],
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "motor_controller",
        motor_types: ["brushed DC", "sensored brushless DC"],
        compatible_motors: ["NEO Brushless Motor", "NEO 550 Brushless Motor", "CIM / Mini CIM", "775Pro / Redline", "BAG", "virtually any 12 V brushed DC motor (within the SPARK MAX ratings)"],
        control_interfaces: ["PWM", "CAN", "USB"],
        control_modes: ["closed-loop velocity", "closed-loop position", "follower"],
        continuous_current_A: 60,
        surge_current_A: 100,
        surge_duration_s: 2,
        source: [SRC.product, SRC.overview, SRC.specs],
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "mounting",
        note: "The SPARK MAX has no mounting holes: secure it with zip ties through the notches on its sides (drawing: 44.0 mm apart, 6.0 mm wide) or a mounting bracket. No BoltPattern is modelled.",
        source: [SRC.drawing, SRC.dataPort],
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "data port / encoder sharing",
        note: "The Data Port quadrature pins share the ENCODER port signals (Index shared with hall C). In Brushless mode the Data Port encoder pins cannot take an external encoder unless Alternate Encoder Mode is configured (multi-function pin reassigned). Accessories: Data Port Breakout (REV-11-1278), Alternate Encoder Adapter (REV-11-1881), Absolute Encoder Adapter (REV-11-3326).",
        source: SRC.dataPort,
      },
    },
    {
      type: "data_gap",
      params: {
        fields: ["operating / storage temperature", "CAN bit rate and termination", "Data Port connector part number", "mounting hardware"],
        note: "Not stated in the REV sources read (product page, specs, connection pages, drawing).",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "ProtoPart interface model",
        values: [
          "ProtoPart: power 6-16 V; CAN; 3-phase output; 5-pin hall encoder input (no temperature pin, no Data Port, no USB, no PWM)",
          "REV: 5.5-24 V; CAN/PWM shared 4-pin port; USB-C; 6-pin ENCODER port incl. motor temperature; 10-pin Data Port",
        ],
        sources: [SRC.protopart, SRC.specs, SRC.control, SRC.encoderPort, SRC.dataPort],
        resolution: "Manufacturer documentation used throughout; ProtoPart was a starting point only.",
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "SPARK MAX product page", type: "datasheet", url: SRC.product },
    { id: "art_specs", name: "SPARK MAX Specifications", type: "datasheet", url: SRC.specs },
    { id: "art_control", name: "SPARK MAX Control Connections", type: "documentation", url: SRC.control },
    { id: "art_encoder_port", name: "SPARK MAX Encoder Port", type: "documentation", url: SRC.encoderPort },
    { id: "art_data_port", name: "SPARK MAX Data Port", type: "documentation", url: SRC.dataPort },
    { id: "art_drawing", name: "REV-11-2158 drawing", type: "datasheet", url: SRC.drawing },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): manufacturer STEP, bound by
// library/cad/py/catalog/rev-spark-max.py. Coordinates are the STEP's after
// its transform: heat-sink face z = 0, power end -X, motor end +X, top +Z.
// ---------------------------------------------------------------------------

const PORT_CAN = vendorFeature("can_pwm_port", { area_mm2: 491.945, centroid: [-25.298, -6.317, 16.27] });
const PORT_USB = vendorFeature("usb_c", { area_mm2: 331.457, centroid: [-26.429, 5.413, 18.281] });
const PORT_ENC = vendorFeature("encoder_port", { area_mm2: 688.138, centroid: [25.079, 0.0, 21.567] });
const PORT_DATA = vendorFeature("data_port", { area_mm2: 198.925, centroid: [14.952, 0.0, 24.925] });
const LEADS_MOTOR = vendorFeature("motor_leads", { area_mm2: 47.713, centroid: [40.625, 0.081, 7.65], normal: [1.0, 0.0, 0.0] });
const LEADS_POWER = vendorFeature("power_leads", { area_mm2: 31.809, centroid: [-40.625, 0.0, 7.65], normal: [-1.0, 0.0, 0.0] });

const onCan = { frame: { origin: [-28.5, -6.3, 16.0] as [number, number, number], normal: [-1, 0, 0] as [number, number, number] }, refs: [PORT_CAN, vendorOwn("can_pwm_port")] };
const onEnc = { frame: { origin: [28.5, 0, 20.4] as [number, number, number], normal: [1, 0, 0] as [number, number, number] }, refs: [PORT_ENC, vendorOwn("encoder_port")] };
const onData = { frame: { origin: [15.0, 0, 24.95] as [number, number, number], normal: [0, 0, 1] as [number, number, number] }, refs: [PORT_DATA, vendorOwn("data_port")] };

export const REV_SPARK_MAX: ModuleDef = withGeometry(
  REV_SPARK_MAX_BASE,
  {
    vin: { refs: [LEADS_POWER] },
    vin_gnd: { refs: [LEADS_POWER] },
    motor_out: { refs: [LEADS_MOTOR] },
    motor_out_a: { refs: [LEADS_MOTOR] },
    motor_out_b: { refs: [LEADS_MOTOR] },
    motor_out_c: { refs: [LEADS_MOTOR] },
    // CAN/PWM JST-PH 4 opening on the power end face (x = -28.5); cable plugs in from -X
    can_bus: onCan,
    can_h: onCan,
    can_l: onCan,
    pwm_in: onCan,
    usb_c: { frame: { origin: [-29.4, 5.4, 18.3], normal: [-1, 0, 0] }, refs: [PORT_USB, vendorOwn("usb_c")] },
    // ENCODER JST-PH 6 opening on the motor end face (x = 28.5); cable plugs in from +X
    encoder_port: onEnc,
    enc_gnd: onEnc,
    enc_c: onEnc,
    enc_b: onEnc,
    enc_a: onEnc,
    enc_temp: onEnc,
    enc_5v: onEnc,
    // Data Port on the top face
    dp_3v3: onData,
    dp_5v: onData,
    dp_analog: onData,
    dp_fwd_limit: onData,
    dp_enc_b: onData,
    dp_multi: onData,
    dp_enc_a: onData,
    dp_rev_limit: onData,
    dp_enc_index: onData,
    dp_gnd: onData,
  },
  vendorCadArtifacts({
    partId: "rev-spark-max",
    name: "REV-11-2158",
    url: SRC.cad,
    stepFile: "REV-11-2158.STEP",
    sha256: "b8b374fc3dbb3bfa07ed10c9bdbc2ee407591a35bbe42035ddda87a0dcfa7e4d",
    licence: "not stated by REV Robotics; not redistributed",
    interfaces: ["can_pwm_port", "usb_c", "encoder_port", "data_port"],
  }),
);

