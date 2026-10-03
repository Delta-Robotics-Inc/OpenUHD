import type { InterfaceDef } from "../types/interface.js";
import type { RelayTrait } from "../types/trait.js";
import { PASSIVE_PROTOCOL } from "./passive.js";

/**
 * Relays (PB-866): the `relay` trait (`relayTrait`), and the coil and
 * contact pins (`RelayCoil`, `RelayContacts`).
 *
 * A relay's pins are `passive` terminals, like a resistor's: they sit on
 * board nets, and what they switch is a fact of the part, not a protocol
 * pairing. Each carries a capability naming its function (`relay_coil_plus`,
 * `relay_coil_minus`, `relay_com`, `relay_no`, `relay_nc`) and the pole in
 * its id, so a tool can find the contacts of pole 2. A relay module (a
 * relay with its transistor and diode on a board) adds its logic input as a
 * `Pin` and its supply as `PowerIn`; its screw terminals are these contact
 * terminals with a `connectorTrait`.
 */

/**
 * The `relay` trait, checked. `poles` and `throws` come from `form` ("1C" is
 * one pole, two throws), so they may be left out; when given they must
 * agree with it.
 */
export function relayTrait(params: Omit<RelayTrait["params"], "poles" | "throws"> & { poles?: number; throws?: 1 | 2 }): RelayTrait {
  const m = /^(\d+)([ABC])$/.exec(params.form);
  if (!m) throw new Error(`relay: form "${params.form}" is poles then A, B or C ("1A", "1C", "2C")`);
  const poles = Number(m[1]);
  const throws: 1 | 2 = m[2] === "C" ? 2 : 1;
  if (params.poles !== undefined && params.poles !== poles) throw new Error(`relay: form ${params.form} has ${poles} poles, not ${params.poles}`);
  if (params.throws !== undefined && params.throws !== throws) throw new Error(`relay: form ${params.form} has ${throws} throws, not ${params.throws}`);
  if (params.kind === "solid_state" && throws !== 1) throw new Error("relay: a solid-state relay is form A or B");
  if (!params.contacts.ratings.length) throw new Error("relay: give at least one contact rating");
  return { type: "relay", params: { ...params, poles, throws } };
}

const terminal = (id: string, name: string, pin: number | string, capability: string): InterfaceDef => ({
  id,
  name,
  pin,
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: PASSIVE_PROTOCOL, roles: ["terminal"] }],
  capabilities: [capability],
});

export interface RelayCoilConfig {
  /** Coil + (or an SSR's input +) pin designator. */
  plus: number | string;
  /** Coil − (or an SSR's input −) pin designator. */
  minus: number | string;
  /** Second coil of a dual-coil latching relay: "reset". Defaults to the single coil. */
  coil?: "set" | "reset";
}

/** Coil terminals: `coil_plus` and `coil_minus` (`coil_reset_plus`... on a dual-coil latching relay's reset coil). */
export function RelayCoil(config: RelayCoilConfig): InterfaceDef[] {
  const sfx = config.coil === "reset" ? "_reset" : "";
  const label = config.coil === "reset" ? "RESET " : "";
  return [
    terminal(`coil${sfx}_plus`, `${label}COIL+`, config.plus, "relay_coil_plus"),
    terminal(`coil${sfx}_minus`, `${label}COIL-`, config.minus, "relay_coil_minus"),
  ];
}

export interface RelayContactsConfig {
  /** Pole number, from 1. */
  pole: number;
  /** Common (or an SSR's output) pin designator. */
  com: number | string;
  /** Normally open contact pin. */
  no?: number | string;
  /** Normally closed contact pin. */
  nc?: number | string;
}

/** One pole's contact terminals: `p<pole>_com`, `p<pole>_no`, `p<pole>_nc`. */
export function RelayContacts(config: RelayContactsConfig): InterfaceDef[] {
  if (config.no === undefined && config.nc === undefined) throw new Error(`RelayContacts pole ${config.pole}: give NO, NC or both`);
  const p = `p${config.pole}`;
  return [
    terminal(`${p}_com`, `COM${config.pole}`, config.com, "relay_com"),
    ...(config.no !== undefined ? [terminal(`${p}_no`, `NO${config.pole}`, config.no, "relay_no")] : []),
    ...(config.nc !== undefined ? [terminal(`${p}_nc`, `NC${config.pole}`, config.nc, "relay_nc")] : []),
  ];
}
