/**
 * CTR Electronics Talon SRX brushed DC motor controller (P/N 14-838288) —
 * datasheet-honest UHD part.
 *
 * Sources (see ./ctre-talon-srx/sources.json):
 *   - src_guide:     Talon SRX User's Guide 217-8080 (2017-02-03) — https://ctre.download/files/user-manual/Talon%20SRX%20User's%20Guide.pdf
 *   - src_product:   CTRE Talon SRX product page — https://store.ctr-electronics.com/products/talon-srx
 *   - src_cad:       TalonSRX_CAD.zip: STEP Talon_SRX_14-838288 and VEXpro drawing
 *                    217-8080 (2015-01-20) — https://ctre.download/cad/TalonSRX_CAD.zip
 *   - src_protopart: ProtoPart ctre-talon-srx definition.json (community; starting point only)
 *
 * Modelling notes:
 *   - Power input: the red (V+) and black (GND) 12 AWG leads. 6-28 V, 12 V
 *     nominal, 60 A continuous (max_current), 100 A surge for 2 s
 *     (burst_current). No reverse-polarity protection (usage_note). The
 *     ProtoPart value 6-16 V / 40 A is superseded (source_discrepancy).
 *   - Motor output: the white (M+) and green (M-) 12 AWG leads as power
 *     output leaves (capability motor_out) composed into `motor_output`, the
 *     brushed-DC convention used by ti-l293dne / sparkfun-rob-28633. Brushed
 *     DC only (product page).
 *   - Signal wires: the yellow wire is CAN-H or PWM signal, the green one
 *     CAN-L or PWM ground; each colour is fitted twice and the two are
 *     electrically identical (daisy chain). One leaf per colour carries both
 *     functions; `can_bus` (protocol `can`, role transceiver, 1 Mbit/s) and
 *     `pwm_control` (pwm input, 1-2 ms pulse, 2.9-100 ms period) bind them,
 *     and the `signal_mode` one_of group makes them exclusive (the guide:
 *     "Do Not connect (2X) PWM connectors"; the Talon detects CAN traffic
 *     automatically). There is no CAN builder: the bus is hand-rolled with
 *     the existing `can` protocol type (as pjrc-teensy-4-1). Role convention
 *     (PB-796 audit): the composed `can_bus` uses role `transceiver`, the
 *     library convention for a CAN node (rev-spark-max,
 *     rev-power-distribution-hub, pjrc-teensy-4-1), so it links to other
 *     nodes' can_bus (src/matching/roles.ts makes peer <-> transceiver
 *     incompatible). The CAN_H / CAN_L leaves keep role `peer`: peer <-> peer
 *     is self-compatible, which suits one wire of a differential bus.
 *   - Data Port: the 2x5 0.05 in keyed header, one leaf per pin from the
 *     guide's pinout (pin 6 "DO NOT CONNECT" is not modelled). The sensor
 *     rails +3.3 V (33 mA) and +5 V (50 mA) are PowerOut; the guide says
 *     never to feed external supplies into the port. `quadrature_input`
 *     composes A/B (+ optional index). The Quad B / Index 5 V tolerance
 *     depends on hardware revision (source_discrepancy on those leaves).
 *   - Mounting: 2 x #8 clearance holes Ø4.50, 50.80 mm apart (drawing),
 *     for #8-32 screws (guide) with #8 nut pockets. BoltPattern has no
 *     two-hole line shape, so it is modelled as shape "circle", holeCount 2,
 *     spacing 50.8 (two holes on a Ø50.8 circle sit exactly 50.8 mm apart
 *     on a line) — an `assumption` trait records the convention.
 *   - Thermal: no operating temperature in any CTRE source (data_gap), so no
 *     thermal domain; verify's thermal coverage warning is expected.
 *   - Geometry: vendor STEP bound by library/cad/py/catalog/ctre-talon-srx.py
 *     (rotated so the plain case face is z = 0, normal -Z). Licence not
 *     stated: STEP not committed.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  BoltPattern,
  Ground,
  Pin,
  PowerIn,
  PowerOut,
  baudRate,
  burstCurrentA,
  clockFreqHz,
  connectorTrait,
  defineModule,
  maxCurrentA,
  voltageRangeV,
} from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  guide: "https://ctre.download/files/user-manual/Talon%20SRX%20User's%20Guide.pdf",
  product: "https://store.ctr-electronics.com/products/talon-srx",
  drawing: "https://ctre.download/cad/TalonSRX_CAD.zip",
  cad: "https://ctre.download/cad/TalonSRX_CAD.zip",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/ctre-talon-srx/definition.json",
} as const;

const pinFn = (description: string, source: string | string[] = SRC.guide): TraitDef => ({
  type: "pin_functions",
  params: { description, source },
});

function withTraits(iface: InterfaceDef, traits: TraitDef[], extra: Partial<InterfaceDef> = {}): InterfaceDef {
  return { ...iface, ...extra, traits: [...(iface.traits ?? []), ...traits] };
}

const POWER_LEAD = (colour: string, marking: string) =>
  connectorTrait("bare_wire_lead", {
    note: `${colour} 12 AWG (600 strand min) lead, case marking "${marking}", 5.5 in ± 0.25 in (139.7 mm) long (guide wire table; drawing 140.03/140.05 mm). Terminate with crimped (and soldered) connectors.`,
  });

const SIGNAL_WIRE = (colour: string) =>
  connectorTrait("bare_wire_lead", {
    note: `Two ${colour} 22 AWG signal wires, 11.0 in (279.4 mm) per the guide wire table (the drawing shows 304.80 mm / 12.0 in), electrically identical, twisted with the other colour. For PWM, fit a 3-pin 0.1 in plug with green (ground) and yellow (signal) on the outer pins and the centre pin empty.`,
  });

// ---------------------------------------------------------------------------
// Power input and motor output leads
// ---------------------------------------------------------------------------

const vin = withTraits(
  PowerIn({ id: "vin", name: "V+ (red)", pin: "V+", voltageV: [6, 28], nominalV: 12, maxCurrentA: 60, parameters: [burstCurrentA(100)] }),
  [
    pinFn("Positive Input, case marking V+, red 12 AWG lead. Nominal 12 V, 6-28 V; 60 A continuous, 100 A surge (2 s).", [SRC.guide, SRC.product]),
    POWER_LEAD("Red", "V+"),
    {
      type: "usage_note",
      params: {
        note: "The Talon SRX has no reverse polarity protection: power applied backwards may permanently damage it. Source voltage must never exceed 28 V. Use a 40 A or smaller breaker in series with the positive input (e.g. from a PDP channel).",
        source: SRC.guide,
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "supply voltage / current",
        values: ["6-16 V, 40 A max (ProtoPart power domain)", "6-28 V, 12 V nominal, 60 A continuous, 100 A surge 2 s (CTRE guide and product page)"],
        sources: [SRC.protopart, SRC.guide, SRC.product],
        resolution: "Manufacturer values used. The 40 A figure is the breaker the guide recommends, not the controller rating.",
      },
    },
  ],
);

const gnd = withTraits(Ground({ id: "gnd", name: "GND (black)", pin: "GND" }), [
  pinFn("Input Ground, case marking GND, black 12 AWG lead.", SRC.guide),
  POWER_LEAD("Black", "GND"),
]);

const motorLeaf = (id: string, name: string, pin: string, colour: string, text: string): InterfaceDef =>
  withTraits(
    {
      id,
      name,
      pin,
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["output"] }],
      capabilities: ["motor_out"],
    },
    [pinFn(text, SRC.guide), POWER_LEAD(colour, pin)],
  );

const motorPos = motorLeaf("motor_pos", "M+ (white)", "M+", "White", "Positive Output, case marking M+, white 12 AWG lead. Connect to the M+ side of the motor.");
const motorNeg = motorLeaf("motor_neg", "M- (green)", "M-", "Green", "Output Ground, case marking M-, green 12 AWG lead. Connect to the M- side of the motor.");

const motorOutput: InterfaceDef = {
  id: "motor_output",
  name: "Brushed DC motor output (M+ / M-)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "power", roles: ["output"] }],
  parameters: [voltageRangeV(6, 28, 12), maxCurrentA(60), burstCurrentA(100)],
  slots: [
    { id: "motor_pos", required: true, match: { protocol: "power", role: "output", capability: "motor_out" } },
    { id: "motor_neg", required: true, match: { protocol: "power", role: "output", capability: "motor_out" } },
  ],
  profiles: [{ id: "motor_leads", label: "M+ white / M- green leads", default_active: true, bindings: { motor_pos: "motor_pos", motor_neg: "motor_neg" } }],
  max_instances: 1,
  traits: [
    {
      type: "usage_note",
      params: {
        note: "Powers brushed DC motors with variable speed forward, reverse or off; cannot be used with brushless motors. 15.625 kHz output switching, 4% minimum throttle (deadband), sign-magnitude synchronous rectification, brake/coast selectable (B/C CAL button or CAN). Swapping M+/M- reverses rotation. Output leads usually need an extension to reach the motor. Current ratings are the controller's (60 A continuous, 100 A for 2 s); the voltage is the input supply range.",
        source: [SRC.product, SRC.guide],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// CAN / PWM signal wires
// ---------------------------------------------------------------------------

const sigYellow = withTraits(
  {
    id: "sig_yellow",
    name: "CAN-H / PWM signal (yellow)",
    pin: "CAN-H/PWM",
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [
      { type: "can", roles: ["peer"] },
      { type: "pwm", roles: ["input"] },
    ],
    capabilities: ["can_h", "pwm_in"],
  },
  [pinFn("CAN-High / PWM Signal, yellow 22 AWG wire (2x, electrically identical). PWM logic-high minimum threshold 1.0 V, logic-low maximum 0.4 V, input current < 1 mA.", SRC.guide), SIGNAL_WIRE("yellow")],
);

const sigGreen = withTraits(
  {
    id: "sig_green",
    name: "CAN-L / PWM ground (green)",
    pin: "CAN-L/PWM GND",
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [
      { type: "can", roles: ["peer"] },
      { type: "power", roles: ["ground"] },
    ],
    capabilities: ["can_l", "ground"],
  },
  [pinFn("CAN-Low / PWM Ground, green 22 AWG wire (2x, electrically identical).", SRC.guide), SIGNAL_WIRE("green")],
);

const canBus: InterfaceDef = {
  id: "can_bus",
  name: "CAN bus (CAN-H yellow / CAN-L green)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "can", roles: ["transceiver"] }],
  parameters: [baudRate(1_000_000)],
  slots: [
    { id: "can_h", required: true, match: { protocol: "can", capability: "can_h" } },
    { id: "can_l", required: true, match: { protocol: "can", capability: "can_l" } },
  ],
  profiles: [{ id: "can_wires", label: "Yellow CAN-H / green CAN-L wires", default_active: true, bindings: { can_h: "sig_yellow", can_l: "sig_green" } }],
  max_instances: 1,
  traits: [
    {
      type: "usage_note",
      params: {
        note: "CAN at 1 Mbit/s. Up to 63 Talon SRXs daisy-chain green-to-green and yellow-to-yellow on one bus (twisted pair, 22 AWG, crimped and soldered, or the CTRE CAN Connector terminal block); terminate the far end with 120 ohm or the PDP. Assign a unique device ID 1-62 (avoid the default 0). CAN allows field-upgrade, Data Port configuration, brake/coast toggling and closed-loop motor control. The Talon detects CAN traffic automatically.",
        source: SRC.guide,
      },
    },
  ],
};

const pwmControl: InterfaceDef = {
  id: "pwm_control",
  name: "PWM control (yellow signal / green ground)",
  domain: "electrical",
  exposed: true,
  default_active: false,
  protocols: [{ type: "pwm", roles: ["input"] }],
  parameters: [
    // period 2.9-100 ms -> 10-345 Hz
    clockFreqHz([10, 345]),
    { id: "pulse_width", name: "Input pulse (high time), nominal", unit: "µs", range: [1000, 2000] },
    { id: "pulse_width_max", name: "Input pulse (high time), max accepted", unit: "µs", range: [600, 2400] },
    { id: "frame_period", name: "Input period", unit: "ms", range: [2.9, 100] },
    { id: "v_ih_min", name: "Logic high, min threshold", unit: "V", value: 1.0 },
    { id: "v_il_max", name: "Logic low, max threshold", unit: "V", value: 0.4 },
  ],
  slots: [
    { id: "signal", required: true, match: { protocol: "pwm", role: "input", capability: "pwm_in" } },
    { id: "ground", required: true, match: { protocol: "power", role: "ground", capability: "ground" } },
  ],
  profiles: [{ id: "pwm_wires", label: "Yellow signal / green ground", default_active: true, bindings: { signal: "sig_yellow", ground: "sig_green" } }],
  max_instances: 1,
  traits: [
    {
      type: "usage_note",
      params: {
        note: "PWM pulse 1-2 ms with 1.5 ms neutral, period 2.9-100 ms (the parameter clock_freq 10-345 Hz is that period range). Thresholds suit 3.3 V and 5 V controllers. Talons cannot be daisy-chained in PWM mode (one controller output each, or a Y-cable to drive several from one output); only limit switches work on the Data Port under PWM. Insulate the unused yellow/green pair; never connect two PWM connectors to one Talon. PWM calibration via the B/C CAL button.",
        source: SRC.guide,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Data Port (2x5, 0.05 in, keyed)
// ---------------------------------------------------------------------------

const DATA_PORT = connectorTrait("header_2x5_1.27mm_keyed", {
  positions: 10,
  pinout: ["+3.3V", "+5V", "Analog Input", "Forward Limit", "Quadrature B", "DO NOT CONNECT", "Quadrature A", "Reverse Limit", "Quadrature Index", "GND"],
  note: "Data Port: accepts a 2x5 0.05 in pitch keyed ribbon cable (guide 1.4.1); two 4-40 UNC threaded holes 19.05 mm apart beside it (drawing). Leave unused pins floating; pin 6 is DO NOT CONNECT.",
});

const quadRevDiscrepancy: TraitDef = {
  type: "source_discrepancy",
  params: {
    field: "Quad B / Quad Index input voltage range",
    values: ["0-3.3 V (Talon hardware revision 1.5 and earlier; not 5 V tolerant, microcontroller errata)", "0-5 V (revision 1.6 and on)"],
    sources: [SRC.guide],
    resolution: "Modelled as 0-5 V (current hardware). Revision 1.5 and earlier must not see > 3.6 V on Quad B or Quad Index.",
  },
};

const dp = (iface: InterfaceDef, text: string, extra: TraitDef[] = []) => withTraits(iface, [pinFn(text), DATA_PORT, ...extra]);

const dp3v3 = dp(PowerOut({ id: "dp_3v3", name: "+3.3V (Data Port 1)", pin: 1, voltageV: 3.3, maxCurrentA: 0.033 }), "+3.3V sensor supply output, 33 mA max. Do not connect to the 5 V output.");
const dp5v = dp(PowerOut({ id: "dp_5v", name: "+5V (Data Port 2)", pin: 2, voltageV: 5, maxCurrentA: 0.05 }), "+5V sensor supply output, 50 mA max.");
const dpAnalog = dp(Pin({ id: "dp_analog", name: "Analog Input (Data Port 3)", pin: 3, voltageV: [0, 3.3], capabilities: { digital: false, analogIn: true } }), "Analog Input, 0-3.3 V. Power the analog sensor only from the Data Port 3.3 V.");
const limitPin = (id: string, name: string, pin: number, text: string) =>
  withTraits(dp(Pin({ id, name, pin, voltageV: [0, 5], capabilities: { inputOnly: true } }), text), [], {
    capabilities: ["digital_io", "limit_switch"],
  });
const dpFwdLimit = limitPin("dp_fwd_limit", "Forward Limit (Data Port 4)", 4, "Forward Limit switch input, 0-5 V, pulled up to 2.5 V internally, normally open by default. Logic high min 2.64 V, low max 0.66 V.");
const dpRevLimit = limitPin("dp_rev_limit", "Reverse Limit (Data Port 8)", 8, "Reverse Limit switch input, 0-5 V, pulled up to 2.5 V internally, normally open by default. Logic high min 2.64 V, low max 0.66 V.");
const quadPin = (id: string, name: string, pin: number, cap: string, text: string, extra: TraitDef[] = []) =>
  withTraits(dp(Pin({ id, name, pin, voltageV: [0, 5], capabilities: { inputOnly: true } }), text, extra), [], {
    capabilities: ["digital_io", cap],
  });
const dpQuadA = quadPin("dp_quad_a", "Quadrature A (Data Port 7)", 7, "quadrature_a", "Quadrature A input, 0-5 V. Logic high min 2.64 V, low max 0.66 V.");
const dpQuadB = quadPin("dp_quad_b", "Quadrature B (Data Port 5)", 5, "quadrature_b", "Quadrature B input. Logic high min 2.64 V, low max 0.66 V.", [quadRevDiscrepancy]);
const dpQuadIdx = quadPin("dp_quad_idx", "Quadrature Index (Data Port 9)", 9, "quadrature_index", "Quadrature Index input (rising edges counted; not required for position/velocity).", [quadRevDiscrepancy]);
const dpGnd = dp(Ground({ id: "dp_gnd", name: "GND (Data Port 10)", pin: 10 }), "GND for sensors on the Data Port. Do not connect it to ground elsewhere.");

const quadratureInput: InterfaceDef = {
  id: "quadrature_input",
  name: "Quadrature encoder input (Data Port)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "custom", roles: ["input"] }],
  slots: [
    { id: "a", required: true, match: { protocol: "digital", role: "input", capability: "quadrature_a" } },
    { id: "b", required: true, match: { protocol: "digital", role: "input", capability: "quadrature_b" } },
    { id: "index", required: false, match: { protocol: "digital", role: "input", capability: "quadrature_index" } },
  ],
  profiles: [{ id: "data_port_quad", label: "Data Port pins 7 / 5 / 9", default_active: true, bindings: { a: "dp_quad_a", b: "dp_quad_b", index: "dp_quad_idx" } }],
  max_instances: 1,
  traits: [
    {
      type: "usage_note",
      params: {
        note: "Wire the encoder to Quadrature A (7), B (5), optional Index (9), power it from Data Port +3.3 V (1) or +5 V (2) and GND (10). Optional 10k pull-up if the sensor needs one. Max quadrature CPR = 80,000,000 / peak RPM (187.5 ns edge-to-edge). Encoders and analog sensors only work under CAN control. Plug-and-play support for the CTRE Magnetic Encoder.",
        source: [SRC.guide, SRC.product],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Mechanical
// ---------------------------------------------------------------------------

const mount = withTraits(
  BoltPattern({
    id: "mount",
    name: "2 x #8 mounting holes, 50.8 mm",
    role: "component",
    shape: "circle",
    spacingMm: 50.8,
    holeCount: 2,
    fastener: "#8-32",
    fastenerDiameterMm: 4.166,
    threaded: false,
    note: "Two #8 clearance holes (Ø4.50 mm) on the case centre line, 50.80 mm apart (drawing), with 11/32 in (#8) nut pockets on the Data Port side (nut pocket height 22.65 mm). Mount with 2 x #8-32 screws or zip ties in the zip-tie grooves (guide 1.5). The aluminium case is electrically isolated: mount it directly on the metal frame, which also sinks heat.",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "bolt pattern shape",
        value: "circle, 2 holes, 50.8 mm",
        reason: "The pattern is two holes on a line; BoltPattern has no line shape, and two holes on a Ø50.8 circle are exactly 50.8 mm apart on a line through the centre.",
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const CTRE_TALON_SRX_BASE: ModuleDef = defineModule({
  id: "ctre-talon-srx",
  name: "CTRE Talon SRX Motor Controller",
  version: "1.0.0",
  manufacturer: "CTR Electronics",
  part_number: "14-838288",
  description:
    "Brushed DC motor controller for competition robotics (FRC), co-developed by CTR Electronics and VEX Robotics. 6-28 V input (12 V nominal), 60 A continuous / 100 A 2 s surge, controlled over CAN (1 Mbit/s, daisy-chained yellow/green wires) or 1-2 ms PWM on the same wires. Data Port (2x5 0.05 in) for quadrature encoder, analog sensor and forward/reverse limit switches. Sealed aluminium case 69.9 x 30.2 x 24.4 mm, 0.10 kg, 12 AWG pre-attached leads, 2 x #8 mounting holes 50.8 mm apart.",
  tags: ["frc", "motor-controller", "brushed", "dc-motor", "can", "pwm", "ctre", "talon-srx", "encoder-input"],
  categories: ["motor_controller", "actuator.motor_controller", "robotics.frc"],

  interfaces: [
    vin,
    gnd,
    motorPos,
    motorNeg,
    motorOutput,
    sigYellow,
    sigGreen,
    canBus,
    pwmControl,
    dp3v3,
    dp5v,
    dpAnalog,
    dpFwdLimit,
    dpQuadB,
    dpQuadA,
    dpRevLimit,
    dpQuadIdx,
    dpGnd,
    quadratureInput,
    mount,
  ],

  interfaceGroups: [
    { id: "signal_mode", label: "CAN or PWM on the yellow/green wires", members: ["can_bus", "pwm_control"], policy: "one_of" },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vin", name: "Battery input (V+ / GND)", nominal_voltage_V: 12, voltage_range_V: [6, 28], max_current_mA: 60000 },
      ],
      metadata: {
        surge_current_A: 100,
        surge_duration_s: 2,
        pwm_output_chop_rate_kHz: 15.625,
        minimum_throttle_deadband_pct: 4,
        reverse_polarity_protection: false,
        data_port_supply: "3.3 V (pin 1) 33 mA; 5 V (pin 2) 50 mA",
        source: [SRC.guide, SRC.product],
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 69.9, width: 30.2, height: 24.4 },
      weight_g: 100,
      metadata: {
        weight_note: "0.23 lbf / 0.10 kgf excluding wiring (guide).",
        material: "cast aluminium, black anodised, sealed; fans optional",
        mounting: "2 x #8-32 screws (Ø4.50 clearance holes 50.80 mm apart, #8 nut pockets) or zip ties",
        source: [SRC.guide, SRC.product, SRC.drawing],
      },
    },
    {
      domain: "network",
      metadata: {
        bus: "CAN, 1 Mbit/s, up to 63 Talon SRX per bus, device ID 1-62",
        source: SRC.guide,
      },
    },
  ],

  traits: [
    {
      type: "performance",
      params: {
        kind: "motor_controller",
        motor_type: "brushed DC",
        continuous_current_A: 60,
        surge_current_A: 100,
        surge_duration_s: 2,
        switching_frequency_kHz: 15.625,
        deadband_pct: 4,
        control_inputs: ["CAN (1 Mbit/s)", "PWM (1-2 ms)"],
        closed_loop: "onboard PID, current closed-loop, voltage compensation, motion profile (over CAN)",
        source: [SRC.product, SRC.guide],
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "firmware",
        note: "Ships with firmware 0.28 typically; CAN users should field-upgrade (1.1 or newer); check the FRC game rules for the minimum firmware. A Talon that does not enter calibration mode (red/green blink) on a held B/C CAL press needs a CAN update even for PWM use.",
        source: SRC.guide,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "status indication",
        note: "Status LEDs blink proportionally to output; illuminated Brake/Coast Calibration button. Blink codes in guide section 2.3.",
        source: [SRC.guide, SRC.product],
      },
    },
    {
      type: "data_gap",
      params: {
        fields: ["operating / storage temperature", "CAN termination on the device (none stated)"],
        note: "Not stated in the CTRE user's guide or product page. No thermal domain is modelled.",
      },
    },
  ],

  artifacts: [
    { id: "art_guide", name: "Talon SRX User's Guide", type: "datasheet", url: SRC.guide },
    { id: "art_product_page", name: "CTRE Talon SRX product page", type: "documentation", url: SRC.product },
    { id: "art_drawing", name: "Talon SRX drawing 217-8080 and STEP (TalonSRX_CAD.zip)", type: "cad", url: SRC.drawing },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796), vendor STEP bound by library/cad/py/catalog/ctre-talon-srx.py.
// Coordinates after the script's transform: plain case face at z = 0 (normal
// -Z, toward the frame), body on +Z, #8 holes at (0, ±25.4), power input and
// signal wires leaving at -Y, motor output leads at +Y.
// ---------------------------------------------------------------------------

const INPUT_LEADS = vendorFeature("input_leads", { area_mm2: 4448.024, centroid: [0.0, -97.341, 15.0] });
const OUTPUT_LEADS = vendorFeature("output_leads", { area_mm2: 4448.024, centroid: [0.0, 97.341, 15.0] });
const SIGNAL_WIRES = vendorFeature("signal_wires", { area_mm2: 5851.472, centroid: [9.722, -162.127, 10.895] });
const DATA_PORT_F = vendorFeature("data_port", { area_mm2: 1298.781, centroid: [0.016, -13.071, 24.434] });

export const CTRE_TALON_SRX: ModuleDef = withGeometry(
  CTRE_TALON_SRX_BASE,
  {
    // Frame at the pattern centre on the mounting face; xAxis along the two holes.
    // symmetryDeg 180: the pattern repeats end for end (the leads then leave the other way).
    mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [0, 1, 0], symmetryDeg: 180 },
      refs: [vendorFeature("mount", { area_mm2: 613.751, centroid: [0.0, 0.0, 10.237] }), vendorOwn("mount"), procedural("bolt_pattern")],
    },
    vin: { refs: [INPUT_LEADS] },
    gnd: { refs: [INPUT_LEADS] },
    motor_pos: { refs: [OUTPUT_LEADS] },
    motor_neg: { refs: [OUTPUT_LEADS] },
    motor_output: { refs: [OUTPUT_LEADS] },
    sig_yellow: { refs: [SIGNAL_WIRES] },
    sig_green: { refs: [SIGNAL_WIRES] },
    can_bus: { refs: [SIGNAL_WIRES] },
    pwm_control: { refs: [SIGNAL_WIRES] },
    quadrature_input: { refs: [DATA_PORT_F] },
    dp_3v3: { refs: [DATA_PORT_F] },
    dp_5v: { refs: [DATA_PORT_F] },
    dp_analog: { refs: [DATA_PORT_F] },
    dp_fwd_limit: { refs: [DATA_PORT_F] },
    dp_rev_limit: { refs: [DATA_PORT_F] },
    dp_quad_a: { refs: [DATA_PORT_F] },
    dp_quad_b: { refs: [DATA_PORT_F] },
    dp_quad_idx: { refs: [DATA_PORT_F] },
    dp_gnd: { refs: [DATA_PORT_F] },
  },
  vendorCadArtifacts({
    partId: "ctre-talon-srx",
    name: "Talon_SRX_14-838288",
    url: SRC.cad,
    stepFile: "Talon_SRX_14-838288.STEP",
    sha256: "eeae00856e4627433801df114cd16f8ad4ab9da88d6c169b6f514f31455488af",
    licence: "not stated by CTR Electronics; not redistributed",
    interfaces: ["mount"],
  }),
);
