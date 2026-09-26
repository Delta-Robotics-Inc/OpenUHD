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
  description: "Four M3 bolts through the frame's 30.5 mm stack holes, the ESC and the FC grommets, with spacing hardware between the boards.",
  tags: ["harness", "mechanical", "fasteners"],
  display: { icon: "wrench" },
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
  traits: [
    { type: "usage_note", params: { note: "Boards use the M3 x 8 rubber grommets included with the DolphinRC stack (manual)." } },
  ],
};

export const HARNESSES: ModuleDef[] = [
  DOLPHINRC_SH8_FC_ESC_CABLE,
  DJI_O4_3IN1_CABLE,
  DOLPHINRC_XT60_BATTERY_LEAD,
  QUADCOPTER_5IN_STACK_HARDWARE,
];
