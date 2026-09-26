/**
 * Adafruit Motor/Stepper/Servo Shield for Arduino v2 (product 1438, board
 * v2.3) — datasheet-honest UHD part.
 *
 * Sources (see ./adafruit-1438-motor-shield-v2/sources.json):
 *   - src_guide:   Adafruit Learning System guide "Adafruit Motor Shield V2"
 *                  (PDF, updated 2025-09-09) — https://cdn-learn.adafruit.com/downloads/pdf/adafruit-motor-shield-v2-for-arduino.pdf
 *   - src_product: Adafruit product page 1438 (specs, dimensions, revision
 *                  history) — https://www.adafruit.com/product/1438
 *   - src_pcb:     Adafruit Eagle board "Adafruit Motor Shield v2.3.brd"
 *                  (CC-BY-SA 3.0) — https://github.com/adafruit/Adafruit-Motor-Shield-V2-PCB
 *   - src_tb6612:  Toshiba TB6612FNG datasheet (driver IC, linked by Adafruit)
 *   - src_cad:     Adafruit_CAD_Parts "1438 Adafruit MotorShield.step" (MIT)
 *   - src_protopart: ProtoPart definition (community starting point only)
 *
 * Modelling notes:
 *   - Arduino UNO R3 shield. It mates with the Arduino UNO R3 header layout
 *     (power, analog, and the two digital headers); only the header pins the
 *     shield uses are leaves: 5V, GND, VIN, IOREF (power header), SDA/SCL
 *     (the R3 SDA/SCL pins on the 10-pin digital header), D9/D10 (servo
 *     signals). The UNO part (arduino-uno-rev3) was being ported
 *     concurrently, so no pair DRC against it was run.
 *   - Control is I2C only: PCA9685 PWM driver at 0x60 (default; 0x60-0x7F
 *     with the five A0-A4 jumpers, 0x70 is the PCA9685 all-call address),
 *     driving two TB6612 H-bridge ICs. Board revision of March 2024: A4/A5 are
 *     no longer tied to SDA/SCL and logic defaults to IOREF (product page);
 *     the v2.3 Eagle file (2019) still ties A4/A5 and has a 5v/3v Logic
 *     jumper. Modelled as the current revision (source_discrepancy trait).
 *   - Motor outputs M1-M4: brushed DC has no UHD builder, so they mirror
 *     l298n-motor-driver: PowerOut leaves (capabilities power_out +
 *     motor_out) and one `dc_motor_output` interface with a profile per
 *     port (max_instances 4). The two stepper ports (M1+M2, M3+M4) reuse the
 *     library's `bipolar_stepper_phases` type with role "driver"
 *     (vocabulary gap recorded in .research/gaps.json).
 *   - Servo headers: Servo 1 carries Arduino D10 and Servo 2 carries D9
 *     (Eagle netlist; the guide only says "pins 9 and 10"). The shield
 *     does not generate servo PWM; it passes the Arduino pins through
 *     (bridgesTo) and powers the servos from the Arduino 5V.
 *   - Mounting: the shield has only 3 of the UNO's 4 holes (Φ3.2 at
 *     (13.97, 2.54), (15.24, 50.8), (66.04, 35.56) mm; no (66.04, 7.62)),
 *     which contain no rectangle. UNO R3 shield convention (same as
 *     adafruit-1411-16ch-pwm-servo-shield): the diagonal pair
 *     (13.97, 2.54)-(66.04, 35.56) as a 2-hole "rectangle" 61.657 x 0 mm,
 *     frame at the pair midpoint on the board bottom, normal -Z, xAxis
 *     toward (66.04, 35.56). The third hole is in its note and an
 *     assumption trait. Shields are normally held by the headers.
 *   - Omitted: the PWMs header (#0 #1 #14 #15, spare PCA9685 channels), the
 *     analog breakout pads, the 2-pad SDA/SCL breakout JP4, the unpopulated
 *     "Opt Servo" 2-pin terminal SERPWR (servo 5 V input after cutting the
 *     5v trace), the prototyping area, the reset button (no interface
 *     vocabulary). Weight is not stated by Adafruit (data gap).
 *   - CAD: manufacturer STEP from Adafruit_CAD_Parts, MIT, committed.
 *     Board bottom at z = 0. It has no servo headers, so the servo
 *     interfaces have no geometry.
 *   - verify-part warnings: non-canonical trait types come only from reused
 *     builders; none are added here.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  defineModule,
  PowerIn,
  PowerOut,
  Ground,
  I2C,
  Pin,
  BoltPattern,
  connectorTrait,
  maxCurrentA,
  voltageRangeV,
} from "../../src/protocols/index.js";
import { procedural, vendorCadArtifacts, vendorFeature, vendorOwn, withGeometry } from "../cad/artifacts.js";

const SRC = {
  guide: "https://cdn-learn.adafruit.com/downloads/pdf/adafruit-motor-shield-v2-for-arduino.pdf",
  product: "https://www.adafruit.com/product/1438",
  pcb: "https://github.com/adafruit/Adafruit-Motor-Shield-V2-PCB/blob/master/Adafruit%20Motor%20Shield%20v2.3.brd",
  tb6612: "https://cdn-shop.adafruit.com/datasheets/TB6612FNG_datasheet_en_20121101.pdf",
  cad: "https://raw.githubusercontent.com/adafruit/Adafruit_CAD_Parts/main/1438%20Adafruit%20MotorShield/1438%20Adafruit%20MotorShield.step",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/adafruit-motor-shield-v2/definition.json",
} as const;

/** Motor supply range: "Can run motors on 4.5VDC to 13.5VDC" (guide, product page). */
const VMOTOR: [number, number] = [4.5, 13.5];
/** "1.2A per bridge (3A for brief 20ms peaks)". */
const MOTOR_CONT_A = 1.2;
const MOTOR_PEAK_A = 3;

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function pinFn(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

const ARDUINO_HEADER = connectorTrait("pin_header", {
  note: "Arduino UNO R3 shield header (plain or stacking header, soldered by the user).",
});
const TERMINAL_5 = connectorTrait("screw_terminal", {
  positions: 5,
  note: "5-position 3.5 mm terminal block, 18-26 AWG. J1 pads: M2A M2B GND M1B M1A; J2 pads: M3A M3B GND M4B M4A (Eagle v2.3).",
});
const TERMINAL_2 = connectorTrait("screw_terminal", {
  positions: 2,
  pinout: ["-", "+"],
  note: "2-position 3.5 mm terminal block silkscreened \"5-12V Motor Power\", polarity protected by a P-FET (AOD417). Eagle v2.3 MPOWER pad 1 = GND (-), pad 2 = VMOTOR (+).",
});

// ---------------------------------------------------------------------------
// Arduino-side header pins
// ---------------------------------------------------------------------------

const ard5v = withTraits(PowerIn({ id: "arduino_5v", name: "5V", pin: "5V", voltageV: 5 }), [
  pinFn("Arduino 5V: powers the servo headers (+5V net) and, on v2.3 boards with the Logic jumper at 5v, the logic.", [SRC.guide, SRC.pcb]),
  ARDUINO_HEADER,
]);

const ardIoref = withTraits(PowerIn({ id: "arduino_ioref", name: "IOREF", pin: "IOREF", voltageV: [3.3, 5] }), [
  pinFn("Arduino IOREF: logic supply of the PCA9685/TB6612 logic on boards from March 2024 (\"We changed the default logic voltage to IOref instead of 5V\"). 5 V or 3.3 V logic.", [SRC.product, SRC.guide]),
  ARDUINO_HEADER,
]);

const ardGnd = withTraits(Ground({ id: "arduino_gnd", name: "GND", pin: "GND" }), [
  pinFn("Arduino GND: common ground with the motor supply, motor terminals and servo headers.", [SRC.guide, SRC.pcb]),
  ARDUINO_HEADER,
]);

const ardVin = withTraits(
  PowerIn({ id: "arduino_vin", name: "VIN", pin: "VIN", voltageV: VMOTOR, defaultActive: false }),
  [
    pinFn("Arduino VIN: connected to the motor supply rail only when the VIN (PWR) jumper is fitted, so the motors run from the Arduino DC jack. Remove the jumper when a separate motor supply is on the terminal block.", [SRC.guide, SRC.pcb]),
    ARDUINO_HEADER,
    { type: "usage_note", params: { topic: "VIN jumper", note: "Jumper fitted: motors are powered from the Arduino DC barrel jack via VIN (or the terminal block also feeds VIN). Jumper removed: separate motor supply on the terminal block (the recommended split supply). Do not use a 9 V battery.", source: SRC.guide } },
  ],
);

const i2c = I2C({
  id: "i2c",
  name: "I2C (PCA9685)",
  roles: ["slave"],
  address: 0x60,
  sda: { pin: "SDA", name: "SDA" },
  scl: { pin: "SCL", name: "SCL" },
});
const i2cIfaces = i2c.map((i) =>
  i.id === "i2c"
    ? withTraits(i, [
        { type: "usage_note", params: { topic: "address", note: "Default 7-bit address 0x60. Five solder jumpers A0-A4 add a binary offset (0x60-0x7F, up to 32 stacked shields). 0x70 is the PCA9685 all-call address: every shield answers it, so no other device may use 0x70.", source: SRC.guide } },
        { type: "usage_note", params: { topic: "pull-ups", note: "10 kOhm pull-ups (R7, R8) from SDA/SCL to the shield logic supply are fitted.", source: SRC.pcb } },
        {
          type: "source_discrepancy",
          params: {
            field: "I2C address range",
            values: ["0x60-0x7F (guide, 5 address bits)", "0x60-0x80 (product page)", "6 jumpers A0-A5 (ProtoPart design_rules)"],
            sources: [SRC.guide, SRC.product, SRC.protopart],
            resolution: "0x60-0x7F: five jumpers A0-A4 on the Eagle board, base 0x60 plus a 5-bit offset (guide stacking section).",
          },
        },
      ])
    : withTraits(i, [
        pinFn(i.id === "i2c_sda" ? "SDA: I2C data to the PCA9685 (R3 SDA pin)." : "SCL: I2C clock to the PCA9685 (R3 SCL pin).", [SRC.guide, SRC.pcb]),
        ARDUINO_HEADER,
      ]),
);

// Arduino D9/D10 pass straight through to the servo headers.
function ardServoPin(n: 9 | 10, servo: 1 | 2): InterfaceDef {
  return {
    ...withTraits(Pin({ id: `arduino_d${n}`, name: `D${n}`, pin: `D${n}`, capabilities: { inputOnly: true } }), [
      pinFn(`Arduino D${n}: wired straight to the Servo ${servo} signal pin. Unused if no servo is plugged in.`, [SRC.guide, SRC.pcb]),
      ARDUINO_HEADER,
    ]),
    bridgesTo: [`servo${servo}_sig`],
  };
}

// ---------------------------------------------------------------------------
// Servo headers (2 x 3-pin 0.1", GND / +5V / signal)
// ---------------------------------------------------------------------------

const SERVO_HEADER = connectorTrait("pin_header", {
  positions: 3,
  pinout: ["GND", "+5V", "SIG"],
  note: "3-pin 0.1\" male header for a hobby servo lead (Eagle SERVO1/SERVO2: pad 1 GND, 2 +5V, 3 signal).",
});

function servoPort(servo: 1 | 2, arduinoPin: 9 | 10): InterfaceDef[] {
  const sig: InterfaceDef = {
    id: `servo${servo}_sig`,
    name: `Servo ${servo} signal (D${arduinoPin})`,
    pin: `SERVO${servo}-3`,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "pwm", roles: ["output"] }],
    capabilities: ["pwm_out", "rc_pwm_out"],
    traits: [
      pinFn(`Servo ${servo} signal: Arduino pin D${arduinoPin} (the Arduino's high-resolution timer; use the Arduino Servo library).`, [SRC.guide, SRC.pcb]),
      SERVO_HEADER,
    ],
  };
  const v5 = withTraits(PowerOut({ id: `servo${servo}_5v`, name: `Servo ${servo} +5V`, pin: `SERVO${servo}-2`, voltageV: 5 }), [
    pinFn(`Servo ${servo} +5V: the Arduino 5V net. For an external 5-6 V servo supply, cut the 5v trace and use the Opt Servo terminal.`, [SRC.guide, SRC.pcb]),
    SERVO_HEADER,
  ]);
  const gnd = withTraits(Ground({ id: `servo${servo}_gnd`, name: `Servo ${servo} GND`, pin: `SERVO${servo}-1` }), [
    pinFn(`Servo ${servo} GND.`, SRC.pcb),
    SERVO_HEADER,
  ]);
  const port: InterfaceDef = {
    id: `servo${servo}`,
    name: `Servo ${servo} header (D${arduinoPin})`,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "pwm", roles: ["host"] }],
    slots: [
      { id: "power", required: true, match: { protocol: "power", role: "output" } },
      { id: "ground", required: true, match: { protocol: "power", role: "ground", capability: "ground" } },
      { id: "signal", required: true, match: { protocol: "pwm", role: "output", capability: "rc_pwm_out" } },
    ],
    profiles: [{ id: `servo${servo}_header`, label: `SERVO${servo} GND/+5V/SIG`, default_active: true, bindings: { power: v5.id, ground: gnd.id, signal: sig.id } }],
    max_instances: 1,
    traits: [
      { type: "usage_note", params: { note: "Servos are powered from the Arduino's 5V regulator; fine for small hobby servos. Servo pulse timing is set by the Arduino sketch, not the shield.", source: SRC.guide } },
    ],
  };
  return [gnd, v5, sig, port];
}

// ---------------------------------------------------------------------------
// Motor power terminal
// ---------------------------------------------------------------------------

const vmotor = withTraits(
  PowerIn({ id: "vmotor_in", name: "Motor power +", pin: "MPOWER+", voltageV: VMOTOR }),
  [
    pinFn("Motor supply + (\"5-12V Motor Power\" terminal): feeds both TB6612 VM pins through the polarity-protection FET. Green power LED lit = motor supply present.", [SRC.guide, SRC.pcb]),
    TERMINAL_2,
    {
      type: "source_discrepancy",
      params: {
        field: "motor supply voltage",
        values: ["4.5-13.5 VDC (spec list)", "5-12 VDC (setup instructions and silkscreen)", "nominal 6 V (ProtoPart)"],
        sources: [SRC.guide, SRC.product, SRC.pcb, SRC.protopart],
        resolution: "Range 4.5-13.5 V from the spec list (also the TB6612 VM operating maximum 13.5 V); 5-12 V is Adafruit's recommended practical range. ProtoPart's nominal 6 V has no source and is dropped.",
      },
    },
  ],
);

const vmotorGnd = withTraits(Ground({ id: "vmotor_gnd", name: "Motor power -", pin: "MPOWER-" }), [
  pinFn("Motor supply - : common ground with the Arduino GND.", [SRC.pcb]),
  TERMINAL_2,
]);

// ---------------------------------------------------------------------------
// Motor output terminals
// ---------------------------------------------------------------------------

type Coil = "phase_a" | "phase_a_bar" | "phase_b" | "phase_b_bar";

function motorOut(pad: string, port: number, terminal: "J1" | "J2", coil: Coil): InterfaceDef {
  const base = PowerOut({ id: pad.toLowerCase(), name: pad, pin: pad, voltageV: VMOTOR, maxCurrentA: MOTOR_CONT_A });
  return {
    ...base,
    capabilities: ["power_out", "motor_out", coil],
    traits: [
      pinFn(`${pad}: TB6612 H-bridge output, motor port M${port} (terminal ${terminal}). 1.2 A continuous, 3 A for brief 20 ms peaks; thermal shutdown and internal flyback diodes.`, [SRC.guide, SRC.pcb]),
      TERMINAL_5,
    ],
  };
}

const outs = [
  motorOut("M1A", 1, "J1", "phase_a"),
  motorOut("M1B", 1, "J1", "phase_a_bar"),
  motorOut("M2A", 2, "J1", "phase_b"),
  motorOut("M2B", 2, "J1", "phase_b_bar"),
  motorOut("M3A", 3, "J2", "phase_a"),
  motorOut("M3B", 3, "J2", "phase_a_bar"),
  motorOut("M4A", 4, "J2", "phase_b"),
  motorOut("M4B", 4, "J2", "phase_b_bar"),
];

const termGnd = [
  withTraits(Ground({ id: "j1_gnd", name: "GND (M1/M2 terminal)", pin: "J1-3" }), [
    pinFn("Centre pin of the M1/M2 terminal: GND, for the common wire of a unipolar stepper. Leave unconnected for a bipolar stepper.", [SRC.guide, SRC.pcb]),
    TERMINAL_5,
  ]),
  withTraits(Ground({ id: "j2_gnd", name: "GND (M3/M4 terminal)", pin: "J2-3" }), [
    pinFn("Centre pin of the M3/M4 terminal: GND, for the common wire of a unipolar stepper. Leave unconnected for a bipolar stepper.", [SRC.guide, SRC.pcb]),
    TERMINAL_5,
  ]),
];

const dcMotorOutput: InterfaceDef = {
  id: "dc_motor_output",
  name: "DC motor output (M1-M4)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "power", roles: ["output"] }],
  parameters: [voltageRangeV(VMOTOR[0], VMOTOR[1]), maxCurrentA(MOTOR_CONT_A), { id: "burst_current", unit: "A", value: MOTOR_PEAK_A }],
  slots: [
    { id: "phase_a", required: true, match: { protocol: "power", role: "output", capability: "motor_out" } },
    { id: "phase_b", required: true, match: { protocol: "power", role: "output", capability: "motor_out" } },
  ],
  profiles: [1, 2, 3, 4].map((n) => ({
    id: `m${n}`,
    label: `Motor port M${n} (M${n}A + M${n}B)`,
    default_active: true,
    bindings: { phase_a: `m${n}a`, phase_b: `m${n}b` },
  })),
  max_instances: 4,
  traits: [
    { type: "usage_note", params: { note: "Up to 4 bi-directional brushed DC motors, 8-bit speed each, set over I2C by the Adafruit_MotorShield library. Motors are disabled at power-up. Motors rated for 1.5-3 V will not work. Peak current can only be tolerated for milliseconds; near 1.2 A continuous, heat-sink the driver.", source: SRC.guide } },
    { type: "usage_note", params: { topic: "burst duration", note: "burst_current 3 A for brief ~20 ms peaks (Adafruit). TB6612FNG: 2 A for 20 ms pulses at <= 20 % duty, 3.2 A for a 10 ms single pulse.", source: [SRC.guide, SRC.tb6612] } },
  ],
};

const stepperOutput: InterfaceDef = {
  id: "stepper_output",
  name: "Stepper output (M1+M2 or M3+M4)",
  domain: "electrical",
  exposed: true,
  default_active: false,
  protocols: [{ type: "bipolar_stepper_phases", roles: ["driver"] }],
  parameters: [voltageRangeV(VMOTOR[0], VMOTOR[1]), maxCurrentA(MOTOR_CONT_A)],
  slots: (["phase_a", "phase_a_bar", "phase_b", "phase_b_bar"] as const).map((c) => ({
    id: c,
    required: true,
    match: { protocol: "power", role: "output", capability: c },
  })),
  profiles: [
    { id: "stepper_1", label: "Stepper 1: coil 1 on M1, coil 2 on M2", default_active: true, bindings: { phase_a: "m1a", phase_a_bar: "m1b", phase_b: "m2a", phase_b_bar: "m2b" } },
    { id: "stepper_2", label: "Stepper 2: coil 1 on M3, coil 2 on M4", default_active: true, bindings: { phase_a: "m3a", phase_a_bar: "m3b", phase_b: "m4a", phase_b_bar: "m4b" } },
  ],
  max_instances: 2,
  traits: [
    { type: "usage_note", params: { note: "Up to 2 unipolar (5- or 6-wire, common to the centre GND pin) or bipolar (4-wire) steppers; single, double, interleaved or micro-stepping. No active current limiting: choose a motor that stays under 1.2 A per phase (rule of thumb: phase resistance >= 10 Ohm up to 12 V).", source: SRC.guide } },
  ],
};

// Stepper and DC use share M1-M4.
const motorModes = [dcMotorOutput, stepperOutput];

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
    fastener: "M3 (Φ3.2 mm through holes; fastener not named)",
    fastenerDiameterMm: 3,
    threaded: false,
    note: "UNO R3 shield convention (shared with adafruit-1411-16ch-pwm-servo-shield): 2-hole pattern on the diagonal pair (13.97, 2.54) and (66.04, 35.56) mm from the lower-left board corner, 61.657 mm apart, as a rectangle with spacingYmm 0; frame origin at the pair midpoint (40.005, 19.05) on the board bottom, normal -Z toward the Arduino, xAxis from (13.97, 2.54) toward (66.04, 35.56). This shield has three Φ3.2 mm holes; the third, (15.24, 50.8), is not in the pattern. The UNO's fourth hole (66.04, 7.62) is not on this shield. The holes line up with the Arduino UNO R3 holes below.",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "bolt pattern",
        value: "2-hole diagonal pair (13.97, 2.54)-(66.04, 35.56), a rectangle 61.657 x 0 mm",
        reason: "The three holes contain no square or rectangle. Library convention for UNO R3 shields: the diagonal pair present on every UNO R3 shield board (the longest pair here) is the pattern, so stacked shields' mount frames coincide; the third hole (15.24, 50.8) is listed in the note. Hole positions from the Eagle board and the Adafruit STEP.",
        source: [SRC.pcb, SRC.cad],
      },
    },
    {
      type: "assumption",
      params: { field: "fastener diameter", value: "3 mm (M3)", reason: "Holes are Φ3.2 mm (Eagle drill, STEP); Adafruit names no fastener.", source: [SRC.pcb, SRC.cad] },
    },
  ],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const BASE: ModuleDef = defineModule({
  id: "adafruit-1438-motor-shield-v2",
  name: "Adafruit Motor/Stepper/Servo Shield v2.3",
  version: "1.0.0",
  manufacturer: "Adafruit Industries",
  part_number: "1438",
  description:
    "Arduino UNO R3 shield driving up to 4 brushed DC motors or 2 steppers from two TB6612 H-bridges (1.2 A per bridge, 3 A 20 ms peaks, 4.5-13.5 V motor supply) under a PCA9685 PWM driver on I2C (0x60, 0x60-0x7F by jumper, stackable to 32 shields), plus two 5 V hobby-servo headers wired to Arduino D9/D10. Polarity-protected motor power terminal, VIN jumper, 5 V or 3.3 V logic (IOREF). 70 x 55 x 10 mm assembled.",
  tags: ["adafruit", "motor-shield", "arduino-shield", "arduino-uno-r3", "tb6612", "pca9685", "i2c", "dc-motor", "stepper", "servo", "h-bridge"],
  categories: ["actuator.motor_controller", "expansion.arduino_shield"],

  interfaces: [
    ard5v,
    ardIoref,
    ardGnd,
    ardVin,
    ...i2cIfaces,
    ardServoPin(10, 1),
    ardServoPin(9, 2),
    ...servoPort(1, 10),
    ...servoPort(2, 9),
    vmotor,
    vmotorGnd,
    ...outs,
    ...termGnd,
    ...motorModes,
    mount,
  ],

  interfaceGroups: [
    { id: "motor_port_mode", label: "M1-M4 as DC motors or steppers", members: ["dc_motor_output", "stepper_output"], policy: "one_of" },
  ],

  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vmotor", name: "Motor supply (terminal block, or Arduino VIN with the jumper)", voltage_range_V: VMOTOR },
        { id: "logic", name: "Logic (IOREF; 5V or 3.3V)", voltage_range_V: [3.3, 5] },
        { id: "servo_5v", name: "Servo supply (Arduino 5V)", nominal_voltage_V: 5 },
      ],
      metadata: {
        motor_driver: "2 x Toshiba TB6612FNG",
        pwm_controller: "NXP PCA9685 (I2C)",
        polarity_protection: "P-FET AOD417 on the motor power terminal",
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 70, width: 55, height: 10 },
      metadata: {
        pcb_mm: [68.58, 53.34, 1.64],
        form_factor: "Arduino UNO R3 shield (R3 header layout incl. SDA/SCL and IOREF)",
        mounting_holes: "3 x Φ3.2 mm (UNO positions minus (66.04, 7.62))",
        terminal_blocks: "2 x 5-pos + 1 x 2-pos 3.5 mm, 18-26 AWG",
        cad: "Adafruit_CAD_Parts 1438 STEP (MIT), committed",
      },
    },
    {
      domain: "thermal",
      operating_temperature_C: [-20, 85],
      metadata: { basis: "TB6612FNG Topr; Adafruit states no board rating (assumption trait)", cooling_method: "passive; heat-sink the drivers near 1.2 A continuous" },
    },
  ],

  traits: [
    {
      type: "operating_conditions",
      params: { motor_supply_V: VMOTOR, logic_V: [3.3, 5], operating_temperature_C: [-20, 85], source: [SRC.guide, SRC.tb6612] },
    },
    {
      type: "assumption",
      params: { field: "operating temperature", value: "-20 to 85 C", reason: "Adafruit states no board operating temperature; the TB6612FNG driver's Topr is used as the limit.", source: SRC.tb6612 },
    },
    {
      type: "absolute_maximum",
      params: { note: "TB6612FNG: VM 15 V max, output 1.2 A average per channel, 3.2 A single 10 ms pulse.", source: SRC.tb6612 },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "board revision: A4/A5 and logic supply",
        values: ["A4/A5 tied to SDA/SCL, Logic jumper 5v/3v (v2.3 Eagle 2019, guide)", "A4/A5 disconnected, logic from IOREF by default (product page, from March 7 2024)"],
        sources: [SRC.pcb, SRC.guide, SRC.product],
        resolution: "Modelled as the current (2024) revision: only the R3 SDA/SCL pins and IOREF are used. Older boards also tie A4/A5 to SDA/SCL, so A4/A5 must not be used as GPIO with them.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "dimensions",
        values: ["70 x 55 x 10 mm assembled (product page)", "PCB 68.58 x 53.34 mm (Eagle, STEP)", "70 x 55 x 15 mm (ProtoPart)"],
        sources: [SRC.product, SRC.pcb, SRC.cad, SRC.protopart],
        resolution: "Product page for the envelope, Eagle/STEP for the PCB; ProtoPart height 15 mm has no source.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "servo pin mapping and servo headers",
        values: ["Servo 1 = D10, Servo 2 = D9, two 1x3 headers (Eagle v2.3 netlist and silkscreen)", "\"pins #9 and #10\" (guide)", "3x4 right-angle servo header block (ProtoPart)"],
        sources: [SRC.pcb, SRC.guide, SRC.protopart],
        resolution: "Eagle netlist: SERVO1 pad 3 on D10, SERVO2 pad 3 on D9, two 3-pin headers. ProtoPart's 3x4 block likely counts the 4-pin PWMs header too; not modelled.",
      },
    },
    { type: "data_gap", params: { field: "weight", note: "Adafruit states no weight; ProtoPart's 28 g has no source, so it is omitted." } },
    { type: "data_gap", params: { field: "I2C clock rate, logic current", note: "Not stated in the guide or product page (the PCA9685 datasheet was not consulted)." } },
    {
      type: "usage_note",
      params: { topic: "power", note: "Recommended split supply: Arduino on USB or its DC jack, motors on the shield terminal block, VIN jumper removed. The green LED next to the terminal must be lit brightly for the DC/stepper outputs to work. Servo ports use the Arduino 5V, not the motor supply.", source: SRC.guide },
    },
    {
      type: "usage_note",
      params: { topic: "stacking", note: "Stackable with stacking headers; each shield needs a unique address. Stacking does not add servo ports (always D9/D10). Works with UNO, Leonardo, Mega/ADK R3, Due (3.3 V logic); Mega R2 and older need wires from SDA/SCL to D20/D21.", source: SRC.guide },
    },
  ],

  artifacts: [
    { id: "art_guide", name: "Adafruit Motor Shield V2 guide (PDF)", type: "datasheet", url: SRC.guide },
    { id: "art_product", name: "Adafruit product 1438 page", type: "documentation", url: SRC.product },
    { id: "art_pcb", name: "Motor Shield v2.3 Eagle board (CC-BY-SA 3.0)", type: "pcb", url: SRC.pcb },
    { id: "art_tb6612", name: "TB6612FNG datasheet", type: "datasheet", url: SRC.tb6612 },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796): Adafruit's own STEP (MIT, committed). PCB bottom at
// z = 0, lower-left board corner at the origin; features selected by
// geometry (the STEP has no component names).
// ---------------------------------------------------------------------------

const HDR_POWER = vendorFeature("HDR_POWER", { area_mm2: 267.6, centroid: [37.266, 2.5, -1.5] });
const HDR_DIGITAL_HIGH = vendorFeature("HDR_DIGITAL_HIGH", { area_mm2: 299.35, centroid: [30.215, 50.99, -1.5] });
const J1 = vendorFeature("J1_M1_M2", { area_mm2: 647.673, centroid: [3.721, 22.86, 5.698] });
const J2 = vendorFeature("J2_M3_M4", { area_mm2: 647.673, centroid: [63.279, 14.224, 5.698] });
const MPOWER = vendorFeature("MPOWER", { area_mm2: 320.485, centroid: [20.447, 3.712, 5.704] });

export const ADAFRUIT_1438_MOTOR_SHIELD_V2: ModuleDef = withGeometry(
  BASE,
  {
    // UNO R3 shield convention: diagonal pair (13.97, 2.54)-(66.04, 35.56),
    // midpoint on the board bottom face; normal -Z toward the Arduino below;
    // xAxis from (13.97, 2.54) toward (66.04, 35.56). No symmetryDeg: the
    // shield only fits one way on the headers.
    mount: {
      frame: { origin: [40.005, 19.05, 0], normal: [0, 0, -1], xAxis: [0.844509, 0.535542, 0] },
      refs: [vendorFeature("mount", { area_mm2: 49.461, centroid: [31.75, 29.633, 0.82] }), vendorOwn("mount"), procedural("bolt_pattern")],
    },
    arduino_5v: { refs: [HDR_POWER] },
    arduino_ioref: { refs: [HDR_POWER] },
    arduino_gnd: { refs: [HDR_POWER] },
    arduino_vin: { refs: [HDR_POWER] },
    i2c: { refs: [HDR_DIGITAL_HIGH] },
    i2c_sda: { refs: [HDR_DIGITAL_HIGH] },
    i2c_scl: { refs: [HDR_DIGITAL_HIGH] },
    arduino_d9: { refs: [HDR_DIGITAL_HIGH] },
    arduino_d10: { refs: [HDR_DIGITAL_HIGH] },
    vmotor_in: { refs: [MPOWER, vendorOwn("MPOWER")] },
    vmotor_gnd: { refs: [MPOWER, vendorOwn("MPOWER")] },
    m1a: { refs: [J1] },
    m1b: { refs: [J1] },
    m2a: { refs: [J1] },
    m2b: { refs: [J1] },
    j1_gnd: { refs: [J1] },
    m3a: { refs: [J2] },
    m3b: { refs: [J2] },
    m4a: { refs: [J2] },
    m4b: { refs: [J2] },
    j2_gnd: { refs: [J2] },
    dc_motor_output: { refs: [J1, J2] },
    stepper_output: { refs: [J1, J2] },
  },
  vendorCadArtifacts({
    partId: "adafruit-1438-motor-shield-v2",
    name: "1438-Adafruit-MotorShield",
    url: SRC.cad,
    stepFile: "1438 Adafruit MotorShield.step",
    sha256: "600a37b31421d17d8141c0bbef370992ce12716ddd24f7274d180ac75380504b",
    licence: "MIT License, Copyright (c) 2016 Adafruit Industries",
    committedStep: "library/parts/adafruit-1438-motor-shield-v2/artifacts/cad/1438-Adafruit-MotorShield.step",
    interfaces: ["mount", "MPOWER"],
  }),
);
