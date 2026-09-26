/**
 * ULN2003 stepper motor driver board (generic 28BYJ-48 companion) —
 * datasheet-honest UHD part.
 *
 * Identity caveat: a generic breakout sold by many vendors. The documented
 * representative is the Kiatronics (Welten Holdings, NZ) "4 Phase ULN2003
 * Stepper Motor Driver PCB" sheet, the same maker whose 28BYJ-48 sheet
 * documents generic-28byj-48-5v; the driver IC is the TI ULN2003A(N).
 * No maker publishes board dimensions (all mechanical values are
 * `assumption` traits).
 *
 * Sources (see ./generic-uln2003-stepper-driver-board/sources.json):
 *   - src_kiatronics_board: Kiatronics 4 Phase ULN2003 Stepper Motor Driver PCB
 *                  sheet (annotated photo, supply 5-12 VDC, 500 mA per output) —
 *                  https://www.electronicoscaldas.com/datasheet/ULN2003A-PCB.pdf
 *   - src_ti:      TI ULN200x/ULQ200x datasheet SLRS027T (Mar 2025) —
 *                  https://www.ti.com/lit/ds/symlink/uln2003a.pdf
 *   - src_protopart: ProtoPart uln2003-stepper-driver-board (community; starting point only).
 *
 * Modelling notes:
 *   - Inputs IN1-IN4 (the MCU header; silkscreen "MCU IO", pads IN5-IN7 are
 *     unpopulated): digital inputs to the ULN2003A bases through its 2.7 kΩ
 *     resistors. The Kiatronics photo labels IN1-IN4 as A-D, the same
 *     letters as the LEDs and the socket pins, so INn drives output n.
 *     `voltage` 2.4-30 V: VI(on) max 2.4 V at IC = 200 mA (ULN2003A,
 *     VCE = 2 V) up to the 30 V absolute maximum input.
 *   - Supply: the "- +" pins marked 5-12V, PowerIn 5-12 V (Kiatronics).
 *     The ON/OFF jumper "isolates power to the stepper motor" (between the
 *     supply and the socket's V+ pin); it is described in a usage_note, not
 *     modelled as an interface, because the source gives it no other
 *     function (ProtoPart's "separate motor supply on the jumper pin" is not
 *     in any maker source).
 *   - Motor socket: 5 pins A B C D V+ (photo), a 5-pin JST XH-style header
 *     that accepts the 28BYJ-48 plug. A-D are ULN2003A open-collector
 *     outputs (stepper_phase, role output), max 500 mA each (Kiatronics;
 *     TI peak collector current 500 mA); V+ is the switched supply (PowerOut
 *     5-12 V). `unipolar_stepper` (role output) composes them in socket
 *     order so it pairs slot-for-slot with generic-28byj-48-5v.
 *   - Mounting: four corner holes are visible in the photo; size and spacing
 *     are assumptions (35 x 32 mm board, Ø3 holes, 30 x 27 mm centres), one
 *     `assumption` trait each. Dimensions are representative; measure your
 *     board before designing a mount. No dimensioned drawing exists.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  BoltPattern,
  Ground,
  PowerIn,
  PowerOut,
  connectorTrait,
  defineModule,
  maxCurrentA,
  voltageRangeV,
} from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, procedural, withGeometry } from "../cad/artifacts.js";

const SRC = {
  board: "https://www.electronicoscaldas.com/datasheet/ULN2003A-PCB.pdf",
  ti: "https://www.ti.com/lit/ds/symlink/uln2003a.pdf",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/uln2003-stepper-driver-board/definition.json",
} as const;

const SOCKET = connectorTrait("jst_xh_5", {
  gender: "receptacle",
  positions: 5,
  pinout: ["A", "B", "C", "D", "V+"],
  note: "5-pin motor header labelled A B C D V+ on the Kiatronics photo; accepts the 28BYJ-48 JST XHP-5 plug directly (\"If you use one of our stepper motors they will just plug directly into the header\"). The XH series is inferred from the mating plug (assumption).",
});
const IN_HEADER = connectorTrait("pin_header_2.54", {
  gender: "male",
  positions: 4,
  pinout: ["IN1", "IN2", "IN3", "IN4"],
  note: "\"MCU IO\" header, pins IN1-IN4 (labelled A-D on the photo); pads IN5-IN7 unpopulated.",
});
const POWER_PINS = connectorTrait("pin_header_2.54", {
  gender: "male",
  positions: 2,
  pinout: ["-", "+"],
  note: "Supply pins marked - + and 5-12V, beside the stepper motor ON/OFF jumper.",
});

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function fn(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

// ---------------------------------------------------------------------------
// Microcontroller inputs
// ---------------------------------------------------------------------------

function input(n: number, letter: string): InterfaceDef {
  return {
    id: `in${n}`,
    name: `IN${n}`,
    pin: `IN${n}`,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "digital", roles: ["input"] }],
    capabilities: ["digital_io"],
    parameters: [voltageRangeV(2.4, 30)],
    traits: [
      fn(
        `IN${n} (${letter}): ULN2003A input ${n} through the IC's 2.7 kΩ base resistor. High turns output ${letter} on (sinks the coil to GND) and lights LED ${letter}. ULN2003A VI(on) max 2.4 V at 200 mA; input absolute max 30 V.`,
        [SRC.board, SRC.ti],
      ),
      IN_HEADER,
    ],
  };
}

const inputs = [input(1, "A"), input(2, "B"), input(3, "C"), input(4, "D")];

// ---------------------------------------------------------------------------
// Supply
// ---------------------------------------------------------------------------

const vcc = withTraits(PowerIn({ id: "vcc", name: "+ (5-12V)", pin: "+", voltageV: [5, 12] }), [
  fn("+: motor supply, 5-12 VDC; must match the stepper motor's rating (5 V for a 28BYJ-48 5 V).", SRC.board),
  POWER_PINS,
]);
const gnd = withTraits(Ground({ id: "gnd", name: "-", pin: "-" }), [
  fn("-: supply ground and the ULN2003A emitter (E); common with the microcontroller ground.", [SRC.board, SRC.ti]),
  POWER_PINS,
]);

// ---------------------------------------------------------------------------
// Motor socket
// ---------------------------------------------------------------------------

function output(letter: string, n: number): InterfaceDef {
  return {
    id: `out_${letter.toLowerCase()}`,
    name: letter,
    pin: letter,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "stepper_phase", roles: ["output"] }],
    capabilities: ["stepper_phase", "open_collector"],
    parameters: [maxCurrentA(0.5)],
    traits: [
      fn(
        `${letter}: ULN2003A output ${n}, open-collector Darlington sink with clamp diode to COM; on while IN${n} is high. Max 500 mA per output (board sheet; TI peak collector current 500 mA). VCE(sat) typ 1.0 V at 200 mA.`,
        [SRC.board, SRC.ti],
      ),
      SOCKET,
    ],
  };
}

const outs = [output("A", 1), output("B", 2), output("C", 3), output("D", 4)];
const vPlus = withTraits(PowerOut({ id: "out_vplus", name: "V+", pin: "V+", voltageV: [5, 12] }), [
  fn("V+: motor common, the board supply switched by the ON/OFF jumper; feeds the red centre-tap lead of a unipolar motor.", SRC.board),
  SOCKET,
]);

const socket: InterfaceDef = {
  id: "unipolar_stepper",
  name: "Unipolar stepper socket (A B C D V+)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "unipolar_stepper", roles: ["output"] }],
  max_instances: 1,
  parameters: [
    voltageRangeV(5, 12),
    { id: "phase_current", name: "Sink current per output", unit: "A", range: [0, 0.5] },
  ],
  slots: [
    { id: "coil_1", label: "A", required: true, match: { protocol: "stepper_phase", role: "output", capability: "stepper_phase" } },
    { id: "coil_2", label: "B", required: true, match: { protocol: "stepper_phase", role: "output", capability: "stepper_phase" } },
    { id: "coil_3", label: "C", required: true, match: { protocol: "stepper_phase", role: "output", capability: "stepper_phase" } },
    { id: "coil_4", label: "D", required: true, match: { protocol: "stepper_phase", role: "output", capability: "stepper_phase" } },
    { id: "common", label: "V+", required: true, match: { protocol: "power", role: "output" } },
  ],
  profiles: [
    {
      id: "socket_order",
      label: "A B C D V+",
      default_active: true,
      bindings: { coil_1: "out_a", coil_2: "out_b", coil_3: "out_c", coil_4: "out_d", common: "out_vplus" },
    },
  ],
  traits: [
    SOCKET,
    {
      type: "usage_note",
      params: {
        topic: "operation",
        note: "The board takes a four-bit command from the microcontroller (IN1-IN4) and switches the matching motor phase; LEDs A-D show the active inputs. With a 28BYJ-48 (1/64 gearbox) it takes 4096 steps to turn the output shaft 360°. Use a separate supply from the microcontroller where possible, with grounds common.",
        source: SRC.board,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "ON/OFF jumper",
        note: "The stepper motor ON/OFF jumper isolates power to the stepper motor (V+); remove it to de-power the motor while the inputs and LEDs stay wired.",
        source: SRC.board,
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
    name: "Corner mounting holes",
    role: "component",
    shape: "rectangle",
    spacingMm: 30,
    spacingYmm: 27,
    holeCount: 4,
    fastener: "M3 (assumed)",
    fastenerDiameterMm: 3,
    threaded: false,
    note: "Four corner holes are visible on the Kiatronics photo; no maker gives their size or spacing. Modelled as Ø3 holes 2.5 mm in from the edges of a 35 x 32 mm board.",
  }),
  [
    {
      type: "assumption",
      params: {
        field: "board size",
        value: "35 x 32 x 1.6 mm",
        reason: "No maker publishes a drawing. 35 x 32 mm is ProtoPart's approximate size (\"boards from different vendors vary by a millimetre or two\"); 1.6 mm is standard PCB thickness. Dimensions are representative; measure your board before designing a mount.",
        source: SRC.protopart,
      },
    },
    {
      type: "assumption",
      params: {
        field: "hole diameter",
        value: "3 mm (M3 clearance)",
        reason: "Four corner holes are visible on the Kiatronics photo but no source gives their size; Ø3 is representative. Measure your board before designing a mount.",
        source: SRC.board,
      },
    },
    {
      type: "assumption",
      params: {
        field: "hole spacing",
        value: "30 x 27 mm centres (2.5 mm in from each edge of the assumed 35 x 32 mm board)",
        reason: "No source gives hole positions; the inset is representative. Measure your board before designing a mount.",
      },
    },
    {
      type: "assumption",
      params: {
        field: "motor socket series",
        value: "JST XH 5-pin (2.5 mm pitch)",
        reason: "The Kiatronics sheet says its 28BYJ-48 plugs directly into the header but does not name the series; XH is inferred from the mating plug.",
        source: SRC.board,
      },
    },
  ],
);

const GENERIC_ULN2003_STEPPER_DRIVER_BOARD_BASE: ModuleDef = defineModule({
  id: "generic-uln2003-stepper-driver-board",
  name: "ULN2003 stepper motor driver board",
  version: "1.0.0",
  manufacturer: "Generic (Kiatronics 4 Phase ULN2003 driver PCB sheet as reference)",
  part_number: "ULN2003 stepper driver PCB (ULN2003AN)",
  description:
    "Generic 4-phase unipolar stepper driver breakout: TI ULN2003A(N) Darlington array, four inputs IN1-IN4 from a microcontroller, 5-12 VDC motor supply, 500 mA max per output, 5-pin motor header (A B C D V+) that takes the 28BYJ-48 plug directly, motor ON/OFF jumper and four step-state LEDs. No maker publishes a drawing: the 35 x 32 mm board size and Ø3 holes on 30 x 27 mm centres are representative; measure your board before designing a mount.",
  tags: ["uln2003", "uln2003a", "stepper-driver", "unipolar", "darlington", "28byj-48", "breakout"],
  categories: ["actuator.motor_controller"],

  interfaces: [...inputs, vcc, gnd, ...outs, vPlus, socket, mount],

  domains: [
    {
      domain: "electrical",
      power_domains: [{ id: "motor_supply", name: "Motor supply (+/-, V+)", voltage_range_V: [5, 12] }],
      metadata: {
        driver_ic: "TI ULN2003A (ULN2003AN, PDIP-16) 7-channel Darlington array; 4 channels used",
        max_current_per_output_mA: 500,
        ic_collector_emitter_voltage_max_V: 50,
        ic_total_emitter_current_max_A: 2.5,
        input_base_resistor_kohm: 2.7,
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 35, width: 32 },
      metadata: { note: "Board size is an assumption (no maker drawing)." },
    },
    {
      domain: "thermal",
      operating_temperature_C: [-40, 70],
      metadata: { note: "ULN2003A (ULN200xA) operating free-air temperature; the board itself has no rating.", junction_max_C: 150 },
    },
  ],

  traits: [
    {
      type: "operating_conditions",
      params: {
        supply_voltage_V: [5, 12],
        max_current_per_output_mA: 500,
        ic_operating_temperature_C: [-40, 70],
        source: [SRC.board, SRC.ti],
      },
    },
    {
      type: "absolute_maximum",
      params: {
        ic: "ULN2003A",
        collector_emitter_voltage_V: 50,
        clamp_diode_reverse_voltage_V: 50,
        input_voltage_V: 30,
        peak_collector_current_mA: 500,
        output_clamp_current_mA: 500,
        total_emitter_terminal_current_A: 2.5,
        source: SRC.ti,
      },
    },
    {
      type: "usage_note",
      params: {
        topic: "identity",
        note: "Generic board sold by many vendors in near-identical layouts (the Kiatronics photo shows the common green PCB with ULN2003AN, white 5-pin motor header, 4 LEDs, IN1-IN4 header and 5-12V supply pins). Board dimensions and hole positions vary by vendor.",
        source: [SRC.board, SRC.protopart],
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "jumper function",
        values: ["\"ON/OFF Jumper: Isolates power to the stepper Motor\" (Kiatronics)", "\"remove it to power the motor from a separate supply on the PWR pin\" (ProtoPart)"],
        sources: [SRC.board, SRC.protopart],
        resolution: "Only the maker's isolation function is modelled; feeding a separate motor supply through the jumper pin is not claimed.",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "manufacturer CAD",
        note: "No maker publishes CAD or a dimensioned drawing for this generic board. Checked the Kiatronics sheet (photo only), kiatronics.com (placeholder page, no downloads), TI (IC package models only, not the board) and the ProtoPart artifacts (none). Geometry is representative (library/cad/py/catalog/generic-uln2003-stepper-driver-board.py).",
      },
    },
    {
      type: "data_gap",
      params: {
        field: "board dimensions, hole size/spacing, LED resistor values, input logic threshold at 3.3 V",
        note: "Not stated by any maker source. The ULN2003A is characterised at VI(on) max 2.4 V for 200 mA; 3.3 V GPIO drive is not specified by the board maker.",
      },
    },
    {
      type: "assumption",
      params: {
        field: "CAD component layout",
        value: "socket at (-5, 6.5), IC at (-3, -2.5), IN header at (-5, -11.5), power pins at (12.5, -4), jumper at (12.5, 3) mm; XH socket 12.4 x 5.75 x 7 mm",
        reason: "Positions follow the Kiatronics photo layout, not a dimensioned drawing.",
      },
    },
  ],

  artifacts: [
    { id: "art_board_sheet", name: "Kiatronics 4 Phase ULN2003 Stepper Motor Driver PCB sheet", type: "datasheet", url: SRC.board },
    { id: "art_ti_datasheet", name: "TI ULN200x datasheet SLRS027T", type: "datasheet", url: SRC.ti },
  ],
});

// ---------------------------------------------------------------------------
// Geometry (PB-796), generated: library/cad/py/catalog/generic-uln2003-stepper-driver-board.py.
// Board bottom at z = 0, components on +Z. Every dimension is representative.
// ---------------------------------------------------------------------------

const SOCKET_REF = feature("motor_socket", { area_mm2: 71.3, centroid: [-5.0, 6.5, 8.6], normal: [0.0, 0.0, 1.0] });
const IN_REF = feature("in_header", { area_mm2: 25.4, centroid: [-5.0, -11.5, 10.1], normal: [0.0, 0.0, 1.0] });
const PWR_REF = feature("power_header", { area_mm2: 12.7, centroid: [12.5, -4.0, 10.1], normal: [0.0, 0.0, 1.0] });

export const GENERIC_ULN2003_STEPPER_DRIVER_BOARD: ModuleDef = withGeometry(
  GENERIC_ULN2003_STEPPER_DRIVER_BOARD_BASE,
  {
    // Standoffs come from below (-Z). The rectangle repeats every 180°, but the
    // connector sides matter, so no symmetry is declared.
    mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0] },
      refs: [feature("mount", { area_mm2: 60.319, centroid: [0.0, 0.0, 0.8] }), own("mount"), procedural("bolt_pattern")],
    },
    unipolar_stepper: { frame: { origin: [-5, 6.5, 8.6], normal: [0, 0, 1], xAxis: [1, 0, 0] }, refs: [SOCKET_REF] },
    out_a: { refs: [SOCKET_REF] },
    out_b: { refs: [SOCKET_REF] },
    out_c: { refs: [SOCKET_REF] },
    out_d: { refs: [SOCKET_REF] },
    out_vplus: { refs: [SOCKET_REF] },
    in1: { refs: [IN_REF] },
    in2: { refs: [IN_REF] },
    in3: { refs: [IN_REF] },
    in4: { refs: [IN_REF] },
    vcc: { refs: [PWR_REF] },
    gnd: { refs: [PWR_REF] },
  },
  cadArtifacts({
    dir: "library/parts/generic-uln2003-stepper-driver-board/artifacts/cad",
    name: "generic-uln2003-stepper-driver-board",
    generator: "library/cad/py/catalog/generic-uln2003-stepper-driver-board.py",
    tool: "build123d 0.13.0",
    interfaces: ["mount"],
  }),
);
