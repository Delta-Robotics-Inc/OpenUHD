import type { TraitDef } from "../types/trait.js";

/**
 * Physical connector or termination on an interface.
 *
 * Emits the `connector` trait shape the audited parts library already uses
 * (`{ connector_type }`), plus optional detail such as gender, pin count,
 * and the physical pin order.
 */
export interface ConnectorDetail {
  /** e.g. "female", "male", "receptacle", "plug". */
  gender?: string;
  /** Number of positions on the connector. */
  positions?: number;
  /** Signal names in physical pin order, pin 1 first. */
  pinout?: string[];
  /** Free-form note citing the source for the connector details. */
  note?: string;
  /**
   * On a harness module's end: which end of the links it carries this
   * connector mates with ("a" or "b"). Checked by the harness_connector rule.
   */
  mates?: "a" | "b";
}

/**
 * Build a `connector` trait. `connectorType` is a lowercase slug such as
 * "xt60", "jst_sh_8", "solder_pad", "bare_wire_lead", or "mmcx".
 */
export function connectorTrait(connectorType: string, detail: ConnectorDetail = {}): TraitDef {
  return {
    type: "connector",
    params: {
      connector_type: connectorType,
      ...(detail.gender !== undefined ? { gender: detail.gender } : {}),
      ...(detail.positions !== undefined ? { positions: detail.positions } : {}),
      ...(detail.pinout !== undefined ? { pinout: detail.pinout } : {}),
      ...(detail.note !== undefined ? { note: detail.note } : {}),
      ...(detail.mates !== undefined ? { mates: detail.mates } : {}),
    },
  };
}
