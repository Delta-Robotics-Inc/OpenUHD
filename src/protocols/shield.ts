import type { InterfaceDef } from "../types/interface.js";
import type { TraitDef } from "../types/trait.js";
import { Connector, type ConnectorPin } from "./connector.js";

/**
 * Shield and HAT header builder: the standard header of a host board form
 * factor as one connector composite, so a shield stacks on a host by a
 * single link and every pin it uses is checked through that link.
 */

/** Standard header layouts by form factor: position labels in a fixed order. */
export const HEADER_FORMS = {
  /**
   * Arduino UNO R3 shield headers, in this order: the power header (8, from
   * the unlabelled pin next to IOREF), A0–A5 (6), D0–D7 (8), and D8–D13,
   * GND, AREF, SDA, SCL (10). The host has female headers; a shield has male
   * pins. The 2×3 ICSP header is a separate form.
   */
  arduino_uno_r3: {
    connector: "arduino_uno_r3_header",
    host: "female",
    accessory: "male",
    positions: [
      "NC", "IOREF", "RESET", "3V3", "5V", "GND", "GND", "VIN",
      "A0", "A1", "A2", "A3", "A4", "A5",
      "D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7",
      "D8", "D9", "D10", "D11", "D12", "D13", "GND", "AREF", "SDA", "SCL",
    ],
  },
  /** Arduino 2×3 ICSP header, pins 1–6. */
  arduino_icsp: {
    connector: "arduino_icsp_2x3",
    host: "male",
    accessory: "female",
    positions: ["MISO", "5V", "SCK", "MOSI", "RESET", "GND"],
  },
  /**
   * Raspberry Pi 40-pin GPIO header, physical pins 1–40 (odd pins on the
   * inside row). GPIO numbers are BCM. The host has male pins; a HAT has a
   * female header.
   */
  raspberry_pi_40pin: {
    connector: "raspberry_pi_40pin_header",
    host: "male",
    accessory: "female",
    positions: [
      "3V3", "5V", "GPIO2", "5V", "GPIO3", "GND", "GPIO4", "GPIO14", "GND", "GPIO15",
      "GPIO17", "GPIO18", "GPIO27", "GND", "GPIO22", "GPIO23", "3V3", "GPIO24", "GPIO10", "GND",
      "GPIO9", "GPIO25", "GPIO11", "GPIO8", "GND", "GPIO7", "ID_SD", "ID_SC", "GPIO5", "GND",
      "GPIO6", "GPIO12", "GPIO13", "GND", "GPIO19", "GPIO16", "GPIO26", "GPIO20", "GND", "GPIO21",
    ],
  },
} as const;

export type HeaderForm = keyof typeof HEADER_FORMS;

export interface ShieldHeaderConfig {
  /** Interface id. Defaults to "<form>_header". */
  id?: string;
  name?: string;
  form: HeaderForm;
  /**
   * "host" = the board the shield or HAT plugs into (or the stacking headers
   * on top of a stackable shield); "accessory" = the shield or HAT itself.
   */
  role: "host" | "accessory";
  /**
   * The leaf each used position carries, by position label (`"D9"`,
   * `"SDA"`, `"GPIO18"`). A label that appears more than once (`GND`, `5V`,
   * `3V3`) binds every position with that label. Positions not listed are
   * unused by this module (a shield that leaves D2 free).
   */
  pins: Record<string, string>;
  /** Source of the pin assignment. */
  note?: string;
  traits?: TraitDef[];
}

/**
 * A standard shield or HAT header as one connector composite (`Connector`),
 * with the form's positions in its fixed order and the host's or the
 * accessory's gender. A link between a host header and a shield header of
 * the same form mates position by position: the link checks the connector
 * type, gender and position count, and the links derived from it check what
 * each position carries (a shield's I2C on the host's SDA/SCL, its servo
 * PWM on a host pin that can produce PWM). Unknown labels in `pins` throw.
 */
export function ShieldHeader(config: ShieldHeaderConfig): InterfaceDef {
  const form = HEADER_FORMS[config.form];
  const known = new Set<string>(form.positions);
  for (const label of Object.keys(config.pins)) {
    if (!known.has(label)) throw new Error(`ShieldHeader ${config.form}: no position labelled "${label}" (labels: ${[...known].join(", ")})`);
  }
  const pins: ConnectorPin[] = form.positions.map((label) => (config.pins[label] ? [label, config.pins[label]] : label));
  return Connector({
    id: config.id ?? `${config.form}_header`,
    name: config.name ?? (config.role === "host" ? `${config.form} header (host)` : `${config.form} header`),
    connector: form.connector,
    gender: config.role === "host" ? form.host : form.accessory,
    pins,
    ...(config.note !== undefined ? { note: config.note } : {}),
    traits: [{ type: "header_form", params: { form: config.form, role: config.role } }, ...(config.traits ?? [])],
  });
}
