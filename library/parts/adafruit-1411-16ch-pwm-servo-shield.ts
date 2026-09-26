/**
 * Adafruit 16-Channel 12-bit PWM/Servo Shield - I2C interface (product 1411,
 * NXP PCA9685) — datasheet-honest UHD part.
 *
 * Sources (see ./adafruit-1411-16ch-pwm-servo-shield/sources.json):
 *   - src_product:           Adafruit product page 1411 — https://www.adafruit.com/product/1411
 *   - src_learn_connections: Learn guide, Shield Connections —
 *                            https://learn.adafruit.com/adafruit-16-channel-pwm-slash-servo-shield/shield-connections
 *   - src_learn_stacking:    Learn guide, Stacking Shields (address jumpers)
 *   - src_learn_assembly / src_learn_faq / src_learn_overview / src_learn_downloads
 *   - src_eagle_brd / src_eagle_sch: Adafruit EagleCAD board + schematic (CC BY-SA 3.0) —
 *                            https://github.com/adafruit/Adafruit-16-channel-PWM-Servo-Shield
 *   - src_pca9685:           NXP PCA9685 data sheet Rev. 4 — https://www.nxp.com/docs/en/data-sheet/PCA9685.pdf
 *   - src_protopart:         ProtoPart adafruit-16ch-pwm-servo-shield (starting point only)
 *
 * Modelling notes:
 *   - Arduino UNO R3 shield. It mates with the Arduino UNO R3 header layout
 *     (the pads are the Adafruit ARDUINOR3_ICSP footprint in the .brd). Only
 *     the header pins the shield uses are leaves: 5V, 3V (alternative VCC via
 *     solder jumper SJ1), GND, SDA, SCL (also tied to A4/A5 on the board) and
 *     RESET (reset button SW1). The other header pins (D0-D13, A0-A3, AREF,
 *     IOREF, VIN, ICSP) only pass through for stacking, so they are omitted.
 *     No arduino-uno part is referenced (another port is in progress).
 *   - I2C: target (slave) at 0x40 default; A0-A5 solder jumpers add a binary
 *     offset (0x40-0x7F, 62 usable: All Call 0x70 and Software Reset are
 *     reserved, PCA9685 §7.1). Fm+ up to 1 MHz. Product page's "0x60-0x80"
 *     is a `source_discrepancy`.
 *   - Servo outputs: 16 host-side counterparts of towerpro-sg90
 *     `rc_servo_3wire` (protocol pwm, role host; slots power/ground/signal).
 *     Each channel has three leaves on its 3-pin column (signal top row, V+
 *     middle, GND bottom; Eagle JP2/JP1/JP6/JP5). `pwm_16ch` groups the 16
 *     signal leaves as one PCA9685 PWM unit (24-1526 Hz, 12-bit).
 *   - V+ (servo rail) comes from the 2-pin terminal block J1 through the
 *     reverse-polarity P-MOSFET; 5-6 V per Learn (4.8 V NiMH packs listed).
 *     No current rating is published (data_gap).
 *   - OE is tied to GND by a 10k resistor on the shield and is not broken
 *     out (Eagle nets), unlike the breakout board; not modelled.
 *   - The Eagle files show the IRLML6401 polarity MOSFET; the product page
 *     says it became an AOD417 on 2014-12-03, "otherwise identical" (the
 *     geometry still uses the Eagle outline, holes and header positions).
 *   - Mounting: the board has all four UNO R3 holes (Φ3.2 at (13.97,2.54),
 *     (15.24,50.8), (66.04,7.62), (66.04,35.56)), which form no rectangle.
 *     UNO R3 shield convention (same as adafruit-1438-motor-shield-v2): the
 *     diagonal pair (13.97,2.54)-(66.04,35.56) as a 2-hole "rectangle"
 *     61.657 x 0 mm, frame at the pair midpoint on the board bottom, normal
 *     -Z, xAxis toward (66.04,35.56); the other two holes are in its note
 *     and `assumption` trait.
 *   - Geometry is generated (no manufacturer STEP; `data_gap`) from the Eagle
 *     board in its coordinates: origin at the board's lower-left corner,
 *     board bottom z = 0, components on +Z. PCB thickness and header / terminal
 *     block heights are assumptions.
 *   - verify-part warnings: none expected beyond the trait-type check (all
 *     trait types used are canonical).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  BoltPattern,
  Ground,
  I2C,
  PWM,
  Pin,
  PowerIn,
  PowerOut,
  connectorTrait,
  defineModule,
} from "../../src/protocols/index.js";
import { cadArtifacts, feature, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  product: "https://www.adafruit.com/product/1411",
  overview: "https://learn.adafruit.com/adafruit-16-channel-pwm-slash-servo-shield/overview",
  connections: "https://learn.adafruit.com/adafruit-16-channel-pwm-slash-servo-shield/shield-connections",
  stacking: "https://learn.adafruit.com/adafruit-16-channel-pwm-slash-servo-shield/stacking-shields",
  assembly: "https://learn.adafruit.com/adafruit-16-channel-pwm-slash-servo-shield/assembly",
  faq: "https://learn.adafruit.com/adafruit-16-channel-pwm-slash-servo-shield/faq",
  downloads: "https://learn.adafruit.com/adafruit-16-channel-pwm-slash-servo-shield/downloads-links",
  brd: "https://github.com/adafruit/Adafruit-16-channel-PWM-Servo-Shield/blob/f44d2182dbfd0ba5a8b72622cb3eba32bd405af3/Adafruit%20PWM%20Servo%20Shield.brd",
  sch: "https://github.com/adafruit/Adafruit-16-channel-PWM-Servo-Shield/blob/f44d2182dbfd0ba5a8b72622cb3eba32bd405af3/Adafruit%20PWM%20Servo%20Shield.sch",
  pca9685: "https://www.nxp.com/docs/en/data-sheet/PCA9685.pdf",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/adafruit-16ch-pwm-servo-shield/definition.json",
} as const;

const PART = "adafruit-1411-16ch-pwm-servo-shield";

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function padFunction(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

const ARDUINO_HEADER = (pin: string, row: string) =>
  connectorTrait("arduino_r3_shield_header", {
    gender: "male",
    note: `Arduino UNO R3 shield header pin ${pin} (${row}); 0.1 in male header supplied in the kit, soldered by the user (stacking headers optional).`,
  });

// ---------------------------------------------------------------------------
// Arduino R3 header leaves (only the pins the shield uses)
// ---------------------------------------------------------------------------

const hdr5v = withTraits(PowerIn({ id: "hdr_5v", name: "5V", pin: "5V", voltageV: 5 }), [
  padFunction(
    "5V — Arduino 5 V rail; through solder jumper SJ1 (5V side) it is VCC for the PCA9685, which sets the I2C and PWM signal logic level (red LED lights when present). Not for servo power.",
    [SRC.connections, SRC.brd],
  ),
  ARDUINO_HEADER("5V", "power header"),
]);

const hdr3v3 = withTraits(
  PowerIn({ id: "hdr_3v3", name: "3V", pin: "3V", voltageV: 3.3, defaultActive: false }),
  [
    padFunction(
      "3V — Arduino 3.3 V rail; the alternative VCC source selected by solder jumper SJ1 (3V side) for 3.3 V logic hosts.",
      [SRC.brd, SRC.product],
    ),
    ARDUINO_HEADER("3V", "power header"),
  ],
);

const hdrGnd = withTraits(Ground({ id: "hdr_gnd", name: "GND", pin: "GND" }), [
  padFunction("GND — common ground (power header GND x2, digital header GND, ICSP GND); shared with the servo and V+ grounds.", [SRC.connections, SRC.brd]),
  ARDUINO_HEADER("GND", "power and digital headers"),
]);

const hdrSda = withTraits(
  Pin({ id: "hdr_sda", name: "SDA", pin: "SDA", capabilities: { i2cSda: true } }),
  [
    padFunction("SDA — I2C data to the PCA9685 (10k pull-up to VCC on the shield). Also connected to A4 on the shield for older Arduinos.", [SRC.connections, SRC.brd]),
    ARDUINO_HEADER("SDA (and A4)", "digital header / analog header"),
  ],
);

const hdrScl = withTraits(
  Pin({ id: "hdr_scl", name: "SCL", pin: "SCL", capabilities: { i2cScl: true, inputOnly: true } }),
  [
    padFunction("SCL — I2C clock to the PCA9685 (10k pull-up to VCC on the shield). Also connected to A5 on the shield.", [SRC.connections, SRC.brd]),
    ARDUINO_HEADER("SCL (and A5)", "digital header / analog header"),
  ],
);

const hdrReset = withTraits(
  Pin({ id: "hdr_reset", name: "RESET", pin: "RESET", defaultActive: false }),
  [
    padFunction("RESET — Arduino reset line; the shield's tactile switch SW1 pulls it to GND (reset button on the shield).", [SRC.brd]),
    ARDUINO_HEADER("RESET", "power header"),
  ],
);

const i2c = I2C({
  id: "i2c",
  name: "I2C target (PCA9685)",
  roles: ["slave"],
  address: 0x40,
  clockFreqHz: [0, 1_000_000],
  sda: "hdr_sda",
  scl: "hdr_scl",
  defaultActive: true,
}).map((i) =>
  i.id === "i2c"
    ? withTraits(i, [
        {
          type: "usage_note",
          params: {
            topic: "I2C address",
            note: "Base address 0x40. Bridging solder jumpers A0-A5 (upper right of the board) adds a binary offset (A0 = bit 0): 0x40-0x7F, up to 62 shields on one bus. The PCA9685 also answers the LED All Call address 0x70 and the Software Reset address at power-up, so don't put another device at 0x70.",
            source: [SRC.stacking, SRC.connections, SRC.faq, SRC.pca9685, SRC.sch],
          },
        },
        {
          type: "source_discrepancy",
          params: {
            field: "I2C address range",
            values: ["0x60-0x80 (product page Technical Details)", "0x40 base, 0x40-0x7F with A0-A5 (Learn guide, schematic note, PCA9685 §7.1)"],
            sources: [SRC.product, SRC.stacking, SRC.pca9685],
            resolution: "Modelled 0x40 default: the manufacturer guide, the schematic and the IC datasheet agree; the product page range is inconsistent with its own \"this shield has address 0x40\".",
          },
        },
        {
          type: "usage_note",
          params: {
            topic: "I2C speed and levels",
            note: "PCA9685 is Fast-mode Plus (up to 1 MHz), 5.5 V tolerant inputs; logic level follows VCC (Arduino 5V, or 3V via SJ1).",
            source: [SRC.pca9685, SRC.connections],
          },
        },
      ])
    : i,
);

// ---------------------------------------------------------------------------
// Servo V+ terminal block J1
// ---------------------------------------------------------------------------

const TERMINAL = connectorTrait("terminal_block", {
  positions: 2,
  pinout: ["V+", "GND"],
  note: "2-pin 3.5 mm pitch terminal block J1 (supplied, soldered by the user, facing out of the board edge). Pin 1 = V+ (PWRIN, through the reverse-polarity P-MOSFET), pin 2 = GND.",
});

const vplusIn = withTraits(
  PowerIn({ id: "vplus_in", name: "V+ (servo power)", pin: "V+", voltageV: [4.8, 6], nominalV: 5 }),
  [
    padFunction(
      "V+ — servo power supply input, \"5 or 6VDC\", reverse-polarity protected. Feeds the V+ (middle) row of all 16 servo headers and the optional capacitor C2. Separate from the Arduino 5V.",
      [SRC.connections, SRC.product, SRC.brd],
    ),
    TERMINAL,
    {
      type: "assumption",
      params: {
        field: "V+ voltage range lower bound",
        value: "4.8 V",
        reason: "Learn says the supply \"should be 5 or 6VDC\" and lists a 4.8 V NiMH 4xAA pack as a good choice; 4.8 V is used as the lower bound. No absolute limit is published.",
        source: SRC.connections,
      },
    },
    {
      type: "data_gap",
      params: { field: "V+ maximum current", note: "No current rating for the terminal block, polarity MOSFET or V+ rail is stated by Adafruit." },
    },
  ],
);

const vplusGnd = withTraits(Ground({ id: "vplus_gnd", name: "GND (terminal)", pin: "GND" }), [
  padFunction("GND — servo supply return on the terminal block; common with Arduino GND.", [SRC.brd, SRC.connections]),
  TERMINAL,
]);

// ---------------------------------------------------------------------------
// Servo / PWM outputs: 16 x 3-pin columns
// ---------------------------------------------------------------------------

const SERVO_HEADER = connectorTrait("pin_header_3x4", {
  gender: "male",
  positions: 12,
  note: "3x4 male header (four 3-pin servo columns, 0.1 in pitch; supplied, soldered by the user); mates a 3-pin RC servo plug. Rows: signal (top), V+ (middle), GND (bottom). Servo plug ground (black/brown) to the bottom row, signal (yellow/white) to the top.",
});

function servoChannel(n: number): InterfaceDef[] {
  const sigBase = Pin({ id: `servo_${n}_signal`, name: `PWM${n}`, pin: `${n} PWM`, driveCurrentmA: 10, capabilities: { pwm: true } });
  const sig: InterfaceDef = {
    ...sigBase,
    capabilities: [...(sigBase.capabilities ?? []), "rc_pwm_out"],
    traits: [
      padFunction(
        `PWM${n} — PCA9685 LED${n} output through a 220 ohm series resistor; signal row of servo column ${n}. Totem pole (25 mA sink / 10 mA source at 5 V) or open-drain, logic level = VCC.`,
        [SRC.brd, SRC.product, SRC.pca9685],
      ),
      SERVO_HEADER,
    ],
  };
  const vp = withTraits(
    { ...PowerOut({ id: `servo_${n}_vplus`, name: `V+ ${n}`, pin: `${n} V+`, voltageV: [4.8, 6], nominalV: 5 }), capabilities: ["power_out"] },
    [padFunction(`V+ — servo power pin of column ${n}, the V+ rail from the terminal block.`, [SRC.brd, SRC.connections]), SERVO_HEADER],
  );
  const g = withTraits(Ground({ id: `servo_${n}_gnd`, name: `GND ${n}`, pin: `${n} GND` }), [
    padFunction(`GND — ground pin of servo column ${n}.`, [SRC.brd, SRC.connections]),
    SERVO_HEADER,
  ]);
  const port: InterfaceDef = {
    id: `servo_${n}`,
    name: `Servo ${n}`,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "pwm", roles: ["host"] }],
    slots: [
      { id: "power", required: true, match: { protocol: "power", role: "output", capability: "power_out" } },
      { id: "ground", required: true, match: { protocol: "power", role: "ground", capability: "ground" } },
      { id: "signal", required: true, match: { protocol: "pwm", role: "output", capability: "rc_pwm_out" } },
    ],
    profiles: [
      {
        id: `servo_${n}_column`,
        label: `Column ${n}: signal / V+ / GND`,
        default_active: true,
        bindings: { power: vp.id, ground: g.id, signal: sig.id },
      },
    ],
    max_instances: 1,
    traits: [
      {
        type: "usage_note",
        params: {
          note: "3-pin RC servo output (host side of a servo's 3-wire lead). Set the PCA9685 PWM frequency to about 50-60 Hz for hobby servos; 12-bit resolution is about 4 us at 60 Hz.",
          source: [SRC.product, SRC.connections],
        },
      },
    ],
  };
  return [sig, vp, g, port];
}

const channels = Array.from({ length: 16 }, (_, n) => servoChannel(n));
const servoLeaves = channels.flatMap((c) => c.slice(0, 3));
const servoPorts = channels.map((c) => c[3]);

const pwmUnit = PWM({
  id: "pwm_16ch",
  name: "PCA9685 16-channel PWM",
  freqHz: [24, 1526],
  resolutionBits: 12,
  channels: channels.map((c) => c[0].id),
}).map((i) =>
  withTraits(i, [
    {
      type: "usage_note",
      params: {
        note: "All 16 outputs share one programmable frequency, typically 24 Hz to 1526 Hz (\"up to about 1.6 KHz\"), each with its own 12-bit duty cycle; free running after configuration over I2C. Outputs can be push-pull (totem pole) or open-drain.",
        source: [SRC.pca9685, SRC.product],
      },
    },
  ]),
);

// ---------------------------------------------------------------------------
// Mechanical
// ---------------------------------------------------------------------------

const mount = withTraits(
  BoltPattern({
    id: "mount",
    name: "Mounting holes (UNO R3 diagonal pair)",
    role: "component",
    shape: "rectangle",
    spacingMm: 61.657,
    spacingYmm: 0,
    holeCount: 2,
    fastener: "M3 (assumed; Φ3.2 mm holes)",
    fastenerDiameterMm: 3,
    threaded: false,
    note: "Board has the four Arduino UNO R3 holes, Φ3.2 mm (Eagle .brd, origin at the board's lower-left): (13.97, 2.54), (15.24, 50.8), (66.04, 7.62), (66.04, 35.56). UNO R3 shield convention (shared with adafruit-1438-motor-shield-v2): 2-hole pattern on the diagonal pair (13.97, 2.54) and (66.04, 35.56), 61.657 mm apart, as a rectangle with spacingYmm 0; frame origin at the pair midpoint (40.005, 19.05) on the board bottom, normal -Z toward the Arduino, xAxis from (13.97, 2.54) toward (66.04, 35.56). Not in the pattern: (15.24, 50.8) and (66.04, 7.62). The shield normally rests on the Arduino's headers rather than being screwed.",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "bolt pattern subset",
        value: "2-hole diagonal pair (13.97, 2.54)-(66.04, 35.56), a rectangle 61.657 x 0 mm",
        reason: "The UNO R3 hole pattern is irregular and no three holes form a rectangle. Library convention for UNO R3 shields: the diagonal pair present on every UNO R3 shield board (the 1438 motor shield lacks (66.04, 7.62)) is the pattern, so stacked shields' mount frames coincide; the other two holes are listed in its note.",
        source: SRC.brd,
      },
    },
    {
      type: "assumption",
      params: {
        field: "fastener",
        value: "M3 (3 mm)",
        reason: "Adafruit gives only the Φ3.2 mm drill (Eagle); M3 is the fastener that hole clears.",
        source: SRC.brd,
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const BASE: ModuleDef = defineModule({
  id: PART,
  name: "Adafruit 16-Channel 12-bit PWM/Servo Shield",
  version: "1.0.0",
  manufacturer: "Adafruit Industries",
  part_number: "1411",
  description:
    "Arduino UNO R3 shield with an NXP PCA9685: 16 free-running 12-bit PWM outputs (24-1526 Hz) on four 3x4 servo headers, controlled over I2C (default 0x40, six address jumpers, up to 62 stacked shields). Logic VCC from the Arduino 5V (or 3V via a jumper); servo V+ 5-6 V through a reverse-polarity-protected 2-pin terminal block. 220 ohm series resistors on all outputs. 70 x 54 x 3 mm board.",
  tags: ["adafruit", "pca9685", "servo", "pwm", "i2c", "arduino-shield", "arduino-uno-r3", "stackable", "led-driver"],
  categories: ["actuator", "actuator.servo_controller", "expansion.arduino_shield"],

  interfaces: [hdr5v, hdr3v3, hdrGnd, hdrSda, hdrScl, hdrReset, ...i2c, vplusIn, vplusGnd, ...servoLeaves, ...servoPorts, ...pwmUnit, mount],

  interfaceGroups: [
    {
      id: "vcc_select",
      label: "PCA9685 VCC source (solder jumper SJ1)",
      members: ["hdr_5v", "hdr_3v3"],
      policy: "one_of",
    },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vcc", name: "Logic VCC (Arduino 5V, or 3V via SJ1)", nominal_voltage_V: 5, voltage_range_V: [2.3, 5.5], max_current_mA: 10 },
        { id: "vplus", name: "Servo V+ (terminal block)", nominal_voltage_V: 5, voltage_range_V: [4.8, 6] },
      ],
      metadata: {
        vcc_note: "PCA9685 VDD 2.3-5.5 V; IDD 6 mA typ / 10 mA max (no load, 1 MHz SCL). The shield feeds it from the Arduino 5V or 3V header pin.",
        output_series_resistor_ohm: 220,
        pwm_frequency_Hz: [24, 1526],
        pwm_resolution_bits: 12,
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 70, width: 54, height: 3 },
      metadata: {
        dimensions_note: "Product page: 2.1\" x 2.7\" x 0.1\" (54 x 70 x 3 mm) without headers or terminal block. Eagle outline: 68.58 x 53.34 mm (Arduino R3 outline).",
        mounting_holes: "4x Φ3.2 mm, Arduino UNO R3 positions",
        mates_with: "Arduino UNO R3 header layout (shield)",
        cad: "Generated from the Adafruit Eagle board (no manufacturer STEP).",
      },
    },
    {
      domain: "thermal",
      operating_temperature_C: [-40, 85],
      metadata: { note: "PCA9685 operating ambient (NXP limiting values); Adafruit states no board rating." },
    },
  ],

  traits: [
    {
      type: "operating_conditions",
      params: {
        vcc_V: [2.3, 5.5],
        servo_vplus_V: "5 or 6 VDC",
        ambient_temperature_C: [-40, 85],
        note: "Temperature is the PCA9685 rating; the shield itself has no published temperature rating.",
        source: [SRC.pca9685, SRC.connections],
      },
    },
    {
      type: "absolute_maximum",
      params: {
        VDD_V: [-0.5, 6.0],
        io_pin_V_max: 5.5,
        output_current_per_LEDn_mA: 25,
        ground_current_mA: 400,
        total_power_mW: 400,
        storage_temperature_C: [-65, 150],
        source: SRC.pca9685,
        note: "PCA9685 limiting values (Table 13).",
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "servo power",
        note: "Power the servos from a dedicated 5-6 V supply on the terminal block, not the Arduino 5V pin (noise and brownouts reset the Arduino). Micro servos draw several hundred mA when moving, high-torque servos over 1 A. A capacitor slot (C2) on V+ is provided but no capacitor is included; start at n x 100 uF for n servos.",
        source: SRC.connections,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "stacking",
        note: "Stackable with shield stacking headers and right-angle 3x4 headers; only three of the four right-angle headers fit when stacking (12 servos). Only the I2C pins are used, so other shields can share the board.",
        source: [SRC.stacking, SRC.product],
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "Arduino compatibility",
        note: "Plugs into Duemilanove, Diecimila, UNO, Leonardo, Mega R3+, ADK R3+. SCL/SDA are also wired to A5/A4; on a Leonardo or Mega cut the A4/A5 traces to reuse those pins; Mega/ADK R2 or earlier need SCL->D21 and SDA->D20 wires.",
        source: SRC.connections,
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "reverse-polarity MOSFET",
        values: ["IRLML6401 SOT-23 (Eagle files, GitHub)", "AOD417 (product page: since 2014-12-03)"],
        sources: [SRC.brd, SRC.product],
        resolution: "Current production uses the AOD417; Adafruit says the board is otherwise identical in code and size, so the Eagle outline, holes and header positions are used for geometry. Learn notes the beefier transistor can obstruct the left-most header when stacking.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "ProtoPart vs manufacturer sources",
        values: [
          "ProtoPart: logic VCC 3.3-5.5 V, OE not mentioned, I2C timing 1 MHz, V+ 4.8-6 V, 4 anonymous mounting holes",
          "Sources: VCC is whatever SJ1 selects (5V or 3V header pin; PCA9685 accepts 2.3-5.5 V); OE is tied low on the shield, not broken out; V+ \"5 or 6VDC\"; holes at the UNO R3 positions",
        ],
        sources: [SRC.protopart, SRC.brd, SRC.connections, SRC.pca9685],
        resolution: "Manufacturer values used; ProtoPart kept only as a starting point.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "manufacturer CAD",
        note: "No STEP/3D model: Adafruit_CAD_Parts (MIT) has no 1411 folder (only 815, the breakout); the product repo adafruit/Adafruit-16-channel-PWM-Servo-Shield has only EagleCAD .brd/.sch (CC BY-SA 3.0); the Learn Downloads page lists Eagle and Fritzing only. Geometry generated from the Eagle board.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "V+ side breakout pads",
        note: "The product page mentions \"0.1\" breakouts on the side\" for power; the published Eagle board (pre-2014 revision) shows no such header, so none is modelled.",
      },
    },
    {
      type: "assumption",
      params: {
        field: "CAD heights",
        value: "PCB 1.6 mm; 3x4 servo header envelope 8.5 mm above the board; terminal block 8.5 mm tall; Arduino male header plastic 2.54 mm below the board",
        reason: "Neither the Eagle files nor the guide give heights; the product page's 3 mm board height includes components. Representative values for the viewer.",
        source: SRC.product,
      },
    },
  ],

  artifacts: [
    { id: "art_product_page", name: "Adafruit product 1411", type: "documentation", url: SRC.product },
    { id: "art_learn_connections", name: "Learn: Shield Connections", type: "documentation", url: SRC.connections },
    { id: "art_learn_stacking", name: "Learn: Stacking Shields", type: "documentation", url: SRC.stacking },
    { id: "art_eagle_brd", name: "EagleCAD board (CC BY-SA 3.0)", type: "pcb", url: SRC.brd },
    { id: "art_eagle_sch", name: "EagleCAD schematic (CC BY-SA 3.0)", type: "schematic", url: SRC.sch },
    { id: "art_pca9685", name: "NXP PCA9685 data sheet Rev. 4", type: "datasheet", url: SRC.pca9685 },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): generated from the Eagle board (library/cad/py/catalog/
// adafruit-1411-16ch-pwm-servo-shield.py). Coordinates: Eagle origin at the
// board's lower-left corner, board bottom z = 0, components +Z.
// ---------------------------------------------------------------------------

const HDR_0_3 = feature("servo_header_0_3", { area_mm2: 77.419, centroid: [15.24, 12.827, 10.1], normal: [0.0, 0.0, 1.0] });
const HDR_4_7 = feature("servo_header_4_7", { area_mm2: 77.419, centroid: [27.94, 12.827, 10.1], normal: [0.0, 0.0, 1.0] });
const HDR_8_11 = feature("servo_header_8_11", { area_mm2: 77.419, centroid: [43.18, 12.827, 10.1], normal: [0.0, 0.0, 1.0] });
const HDR_12_15 = feature("servo_header_12_15", { area_mm2: 77.419, centroid: [55.88, 12.827, 10.1], normal: [0.0, 0.0, 1.0] });
const POWER_HDR = feature("arduino_header_power", { area_mm2: 51.613, centroid: [36.83, 2.54, -2.54], normal: [0.0, 0.0, -1.0] });
const ANALOG_HDR = feature("arduino_header_analog", { area_mm2: 38.71, centroid: [57.15, 2.54, -2.54], normal: [0.0, 0.0, -1.0] });
const DIGITAL_HI_HDR = feature("arduino_header_digital_hi", { area_mm2: 64.516, centroid: [30.226, 50.8, -2.54], normal: [0.0, 0.0, -1.0] });
const TERMINAL_J1 = feature("terminal_block_j1", { area_mm2: 59.5, centroid: [0.083, 25.681, 5.85], normal: [-1.0, 0.0, 0.0] });

const GROUP_FEATURE = [HDR_0_3, HDR_4_7, HDR_8_11, HDR_12_15];
const GROUP_X = [15.24, 27.94, 43.18, 55.88];

const servoGeometry = Object.fromEntries(
  Array.from({ length: 16 }, (_, n) => {
    // channel 4g+k sits at x = group centre - 3.81 + 2.54 k (Eagle 3X04 pads, R180)
    const g = Math.floor(n / 4);
    const x = +(GROUP_X[g] - 3.81 + 2.54 * (n % 4)).toFixed(3);
    return [
      `servo_${n}`,
      {
        // on the header top, middle (V+) row; xAxis toward the signal row
        frame: { origin: [x, 12.827, 10.1] as [number, number, number], normal: [0, 0, 1] as [number, number, number], xAxis: [0, 1, 0] as [number, number, number] },
        refs: [GROUP_FEATURE[g]],
      },
    ];
  }),
);

export const ADAFRUIT_1411_16CH_PWM_SERVO_SHIELD: ModuleDef = withGeometry(
  BASE,
  {
    // UNO R3 shield convention: diagonal pair (13.97, 2.54)-(66.04, 35.56),
    // midpoint on the board bottom; normal -Z toward the Arduino; xAxis from
    // (13.97, 2.54) toward (66.04, 35.56).
    mount: {
      frame: { origin: [40.005, 19.05, 0], normal: [0, 0, -1], xAxis: [0.844509, 0.535542, 0] },
      refs: [feature("mount", { area_mm2: 64.34, centroid: [40.323, 24.13, 0.8] }), procedural("bolt_pattern")],
    },
    hdr_5v: { refs: [POWER_HDR] },
    hdr_3v3: { refs: [POWER_HDR] },
    hdr_reset: { refs: [POWER_HDR] },
    hdr_gnd: { refs: [POWER_HDR, DIGITAL_HI_HDR] },
    hdr_sda: { refs: [DIGITAL_HI_HDR, ANALOG_HDR] },
    hdr_scl: { refs: [DIGITAL_HI_HDR, ANALOG_HDR] },
    i2c: { refs: [DIGITAL_HI_HDR, ANALOG_HDR] },
    // wire entry face of J1 at the board edge; xAxis from pin 1 (V+) to pin 2 (GND)
    vplus_in: { frame: { origin: [0.083, 25.681, 5.85], normal: [-1, 0, 0], xAxis: [0, 1, 0] }, refs: [TERMINAL_J1] },
    vplus_gnd: { frame: { origin: [0.083, 25.681, 5.85], normal: [-1, 0, 0], xAxis: [0, 1, 0] }, refs: [TERMINAL_J1] },
    ...servoGeometry,
  },
  cadArtifacts({
    dir: `library/parts/${PART}/artifacts/cad`,
    name: PART,
    generator: `library/cad/py/catalog/${PART}.py`,
    tool: "build123d",
  }),
);
