/**
 * Harness modules of the 5-inch quadcopter (PB-790): the physical carriers of
 * interface links. Each is `kind: "harness"`; stored links name the harness
 * that carries them (`InterfaceLink.harness`), and each harness end declares
 * the connector it mates so the harness_connector check can compare them.
 *
 * Sources: the mating parts' sources (DolphinRC F405 V3 stack manual for the
 * SH1.0 8-pin cable, XT60 lead and M3 grommets; DJI O4 user manual for the
 * 3-in-1 cable). Hardware quantities for the stack bolts come from the
 * fastener parts once they are in the library (PB-791).
 *
 * Mechanical harnesses carry a `fastenerStack` (PB-775): where each part sits
 * along the joint's structure-side normal, from the structure face. `assemble`
 * places every screw, spacer, standoff and nut from it and checks that each
 * nut sits on thread.
 */
import type { ModuleDef } from "../../../src/types/index.js";
import { connectorTrait } from "../../../src/protocols/index.js";

const end = (id: string, name: string, connector: string, mates: "a" | "b", note?: string) => ({
  id,
  name,
  domain: "electrical" as const,
  exposed: false,
  protocols: [{ type: "custom", roles: ["peer"] }],
  traits: [connectorTrait(connector, { mates, ...(note ? { note } : {}) })],
});

/** The 50 mm SH1.0 8-pin cable between the FC and the 4-in-1 ESC (ships with the stack). */
export const DOLPHINRC_SH8_FC_ESC_CABLE: ModuleDef = {
  id: "dolphinrc-sh8-fc-esc-cable",
  name: "FC/ESC SH1.0 8-pin cable",
  kind: "harness",
  topology: "wire",
  manufacturer: "DolphinRC",
  description: "50 mm SH1.0 8-pin cable joining the flight controller and the 4-in-1 ESC, wired 1:1 (BAT GND CUR VOID M1 M2 M3 M4).",
  tags: ["harness", "cable", "jst-sh"],
  display: { icon: "cable" },
  interfaces: [
    end("end_fc", "FC end", "jst_sh_8", "a"),
    end("end_esc", "ESC end", "jst_sh_8", "b"),
  ],
  traits: [
    { type: "usage_note", params: { note: "Included with the DolphinRC F405 V3 stack (manual: 'SH1.0mm 8Pin Cable 50mm'). Straight-through, so pin 1 maps to pin 1.", included_with: "dolphinrc-f405-v3-flight-controller" } },
  ],
};

/** The DJI O4 3-in-1 cable, FC end (DJI 6-pin socket on the FC). */
export const DJI_O4_3IN1_CABLE: ModuleDef = {
  id: "dji-o4-3in1-cable",
  name: "DJI O4 3-in-1 cable",
  kind: "harness",
  topology: "wire",
  manufacturer: "DJI",
  description: "The O4 Air Unit's 3-in-1 cable carrying power, ground, UART (MSP DisplayPort) and S.Bus to the flight controller's DJI socket.",
  tags: ["harness", "cable", "dji"],
  display: { icon: "cable" },
  interfaces: [
    end("end_fc", "FC end (DJI 6-pin)", "dji_6pin", "a"),
    end("end_o4", "Air unit end", "dji_3in1_cable_6pin", "b"),
  ],
  traits: [
    { type: "usage_note", params: { note: "Ships with the DJI O4 Air Unit. Wire order VCC, GND, RX, TX, GND, S.Bus (O4 user manual).", included_with: "dji-o4-air-unit" } },
  ],
};

/** The ESC's 12 AWG battery lead with an XT60 plug. */
export const DOLPHINRC_XT60_BATTERY_LEAD: ModuleDef = {
  id: "dolphinrc-xt60-battery-lead",
  name: "XT60 battery lead (12 AWG)",
  kind: "harness",
  topology: "wire",
  manufacturer: "DolphinRC",
  description: "12 AWG, 12 cm red/black lead with an XT60 male plug, soldered to the ESC battery pads.",
  tags: ["harness", "power", "xt60"],
  display: { icon: "plug" },
  interfaces: [
    end("end_battery", "XT60 plug", "xt60", "a"),
    end("end_esc", "ESC pads", "solder_pad", "b"),
  ],
  traits: [
    { type: "performance", params: { kind: "cable", length_mm: 120, wire_gauge_awg: 12 } },
    { type: "usage_note", params: { note: "Included with the stack (product page: '12AWG 12cm red/black lead and XT60 male plug'). Solder the bundled 470 uF capacitor across the same pads.", included_with: "dolphinrc-am32-60a-4in1-esc" } },
  ],
};

/**
 * The M3 hardware that bolts the frame, ESC and FC together — the "bolt
 * joining plates" harness. A bus: every board shares the same four bolts.
 */
export const QUADCOPTER_5IN_STACK_HARDWARE: ModuleDef = {
  id: "quadcopter-5in-stack-hardware",
  name: "Stack hardware (M3)",
  kind: "harness",
  topology: "bus",
  description: "Four M3 x 30 bolts through the frame's 30.5 mm stack holes, a 6 mm spacer, the ESC grommet, a 6 mm spacer and the FC grommet, closed by nyloc nuts.",
  tags: ["harness", "mechanical", "fasteners"],
  display: { icon: "wrench" },
  children: [
    { id: "screws", moduleDefId: "iso-4762-m3x30-socket-head-cap-screw", name: "M3 x 30 screw", quantity: 4 },
    { id: "spacers", moduleDefId: "ettinger-005-83-060-m3-nylon-spacer-6mm", name: "6 mm nylon spacer", quantity: 8 },
    { id: "nuts", moduleDefId: "iso-10511-m3-nyloc-nut", name: "M3 nyloc nut", quantity: 4 },
  ],
  interfaces: [
    {
      id: "bolts",
      name: "4 x M3 through-bolts",
      domain: "mechanical",
      exposed: false,
      protocols: [{ type: "bolt_pattern", roles: ["component"] }],
      parameters: [
        { id: "hole_spacing", unit: "mm", value: 30.5 },
        { id: "fastener_diameter", unit: "mm", value: 3 },
      ],
    },
  ],
  // from the bottom plate's top face (z = 0): head under the 5 mm plate,
  // spacer, ESC grommet (6–10), spacer, FC grommet (16–20), nut (20–24)
  fastenerStack: [
    { child: "screws", atMm: -5 },
    { child: "spacers", atMm: 0 },
    { child: "spacers", atMm: 10 },
    { child: "nuts", atMm: 20 },
  ],
  traits: [
    { type: "usage_note", params: { note: "Per post, bottom to top: screw head under the 5 mm bottom plate, 6 mm spacer, ESC in its grommet (4 mm), 6 mm spacer, FC in its grommet (4 mm), nyloc nut; 1 mm of thread protrudes. Boards use the M3 x 8 grommets included with the DolphinRC stack. Stack-up worked out in the fastener parts' usage notes (assumes a 5 mm plate and 4 mm grommet clamp)." } },
  ],
};

const bolts = (id: string, name: string, size: number, spacing: number, spacingY?: number) => ({
  id,
  name,
  domain: "mechanical" as const,
  exposed: false,
  protocols: [{ type: "bolt_pattern", roles: ["component"] }],
  parameters: [
    { id: "hole_spacing", unit: "mm", value: spacing },
    ...(spacingY ? [{ id: "hole_spacing_y", unit: "mm", value: spacingY }] : []),
    { id: "fastener_diameter", unit: "mm", value: size },
  ],
});

/** One motor's four screws, up through the arm into the motor base. */
export const QUADCOPTER_5IN_MOTOR_HARDWARE: ModuleDef = {
  id: "quadcopter-5in-motor-hardware",
  name: "Motor hardware (M3)",
  kind: "harness",
  topology: "bus",
  description: "Four M3 x 8 screws (included with the motor) up through the arm pad into the motor base's 16 mm bolt circle.",
  tags: ["harness", "mechanical", "fasteners"],
  display: { icon: "wrench" },
  children: [{ id: "screws", moduleDefId: "motor-screw-m3x8", name: "M3 x 8 motor screw", quantity: 4 }],
  interfaces: [bolts("bolts", "4 x M3 on 16 mm", 3, 16)],
  // from the pad top (z = 0): heads under the 5 mm arm + 0.5 mm pad
  fastenerStack: [{ child: "screws", atMm: -5.5 }],
};

/** Standoffs and screws joining the bottom and top plates. */
export const QUADCOPTER_5IN_FRAME_HARDWARE: ModuleDef = {
  id: "quadcopter-5in-frame-hardware",
  name: "Frame hardware (M3 standoffs)",
  kind: "harness",
  topology: "bus",
  description: "Four 30 mm M3 aluminium standoffs, each held by an M3 x 8 screw from below the bottom plate and from above the top plate.",
  tags: ["harness", "mechanical", "fasteners"],
  display: { icon: "wrench" },
  children: [
    { id: "standoffs", moduleDefId: "m3-aluminium-standoff-30mm", name: "30 mm standoff", quantity: 4 },
    { id: "screws", moduleDefId: "iso-4762-m3x8", name: "M3 x 8 screw", quantity: 8 },
  ],
  interfaces: [bolts("bolts", "4 x M3 on 56 x 48 mm", 3, 56, 48)],
  // from the bottom plate's top face: screw from below, standoff 0–30, top plate 30–32, screw from above
  fastenerStack: [
    { child: "screws", atMm: -5 },
    { child: "standoffs", atMm: 0 },
    { child: "screws", atMm: 32, direction: -1 },
  ],
};

/** GPS: screws down through the board, spacers, nuts under the top plate. */
export const QUADCOPTER_5IN_GPS_HARDWARE: ModuleDef = {
  id: "quadcopter-5in-gps-hardware",
  name: "GPS hardware (M2)",
  kind: "harness",
  topology: "bus",
  description: "Four M2 x 12 screws down through the GPS board, 5 mm nylon spacers, and M2 nyloc nuts under the top plate.",
  tags: ["harness", "mechanical", "fasteners"],
  display: { icon: "wrench" },
  children: [
    { id: "screws", moduleDefId: "iso-4762-m2x12", name: "M2 x 12 screw", quantity: 4 },
    { id: "spacers", moduleDefId: "m2-nylon-spacer-5mm", name: "5 mm spacer", quantity: 4 },
    { id: "nuts", moduleDefId: "iso-10511-m2-nyloc-nut", name: "M2 nyloc nut", quantity: 4 },
  ],
  interfaces: [bolts("bolts", "4 x M2 on 26 mm", 2, 26)],
  // from the top plate's top face: nut under the 2 mm plate, spacer 0–5, board 5–5.62, screw head on the board
  fastenerStack: [
    { child: "nuts", atMm: -2, direction: -1 },
    { child: "spacers", atMm: 0 },
    { child: "screws", atMm: 5.62, direction: -1 },
  ],
};

/** O4 transmission module on the bottom plate. */
export const QUADCOPTER_5IN_VTX_HARDWARE: ModuleDef = {
  id: "quadcopter-5in-vtx-hardware",
  name: "Air unit hardware (M2)",
  kind: "harness",
  topology: "bus",
  description: "Four M2 x 18 screws up through the bottom plate, 3 mm airflow spacers, the module, M2 nyloc nuts.",
  tags: ["harness", "mechanical", "fasteners"],
  display: { icon: "wrench" },
  children: [
    { id: "screws", moduleDefId: "iso-4762-m2x18", name: "M2 x 18 screw", quantity: 4 },
    { id: "spacers", moduleDefId: "m2-nylon-spacer-3mm", name: "3 mm spacer", quantity: 4 },
    { id: "nuts", moduleDefId: "iso-10511-m2-nyloc-nut", name: "M2 nyloc nut", quantity: 4 },
  ],
  interfaces: [bolts("bolts", "4 x M2 on 25.5 mm", 2, 25.5)],
  fastenerStack: [
    { child: "screws", atMm: -5 },
    { child: "spacers", atMm: 0 },
    { child: "nuts", atMm: 9 },
  ],
};

/** O4 camera between the side plates: two screws per side (O4 manual p.6). */
export const QUADCOPTER_5IN_CAMERA_HARDWARE: ModuleDef = {
  id: "quadcopter-5in-camera-hardware",
  name: "Camera hardware (M2)",
  kind: "harness",
  topology: "bus",
  description: "Four M2 x 5 screws (included with the O4) through the 2 mm side plates into the camera's side holes, 16 mm apart.",
  tags: ["harness", "mechanical", "fasteners"],
  display: { icon: "wrench" },
  children: [{ id: "screws", moduleDefId: "o4-camera-screw-m2x5", name: "M2 x 5 camera screw", quantity: 4 }],
  interfaces: [bolts("bolts", "2 x M2 per side, 16 mm", 2, 16, 14)],
  // frame: mid-plane of the clamp, normal toward the left plate, y = up; plates' outer faces at ±9
  fastenerStack: [
    { child: "screws", atMm: -9, positions: [[0, -8], [0, 8]] },
    { child: "screws", atMm: 9, direction: -1, positions: [[0, -8], [0, 8]] },
  ],
};

export const HARNESSES: ModuleDef[] = [
  DOLPHINRC_SH8_FC_ESC_CABLE,
  DJI_O4_3IN1_CABLE,
  DOLPHINRC_XT60_BATTERY_LEAD,
  QUADCOPTER_5IN_STACK_HARDWARE,
  QUADCOPTER_5IN_MOTOR_HARDWARE,
  QUADCOPTER_5IN_FRAME_HARDWARE,
  QUADCOPTER_5IN_GPS_HARDWARE,
  QUADCOPTER_5IN_VTX_HARDWARE,
  QUADCOPTER_5IN_CAMERA_HARDWARE,
];
