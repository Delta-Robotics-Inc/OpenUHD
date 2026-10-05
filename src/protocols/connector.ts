import type { TraitDef } from "../types/trait.js";
import type { InterfaceDef } from "../types/interface.js";
import type { DomainKind } from "../types/domain.js";

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
  /**
   * How the connector comes with the part: "fitted" (the default)
   * when it is attached, "loose" when it ships in the bag and is fitted
   * during assembly (a shield's header strips, soldered by the builder).
   */
  supplied?: "fitted" | "loose";
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
      ...(detail.supplied !== undefined ? { supplied: detail.supplied } : {}),
    },
  };
}

/** The interfaces of a part whose connector ships loose, to be fitted during assembly (`supplied: "loose"`). */
export function looseConnectors(def: { interfaces: InterfaceDef[] }): { iface: InterfaceDef; connectorType: string; note?: string }[] {
  return def.interfaces.flatMap((iface) =>
    (iface.traits ?? [])
      .filter((t) => t.type === "connector" && (t.params as { supplied?: string } | undefined)?.supplied === "loose")
      .map((t) => {
        const p = t.params as { connector_type?: string; note?: string };
        return { iface, connectorType: String(p.connector_type ?? "connector"), ...(p.note ? { note: p.note } : {}) };
      }),
  );
}

// ---------------------------------------------------------------------------
// Connector composites
// ---------------------------------------------------------------------------


/** One physical position: its printed label and the interface it carries (none: unused, e.g. VOID). */
export type ConnectorPin = string | { label: string; to?: string; note?: string } | [label: string, to?: string];

export interface ConnectorConfig extends ConnectorDetail {
  id: string;
  name?: string;
  /** Connector type slug, e.g. "jst_sh_8", "dji_6pin", "xt60". */
  connector: string;
  /** Positions in physical order, pin 1 first. Slot ids are `p1`, `p2`, …. */
  pins: ConnectorPin[];
  domain?: DomainKind;
  exposed?: boolean;
  /** Other connector types this one mates with (default: the same type only). */
  matesWith?: string[];
  traits?: TraitDef[];
}

/** The protocol type every connector composite speaks. */
export const CONNECTOR_PROTOCOL = "connector";

/** True for a connector composite (or a link-scoped composition). */
export function isConnector(iface: InterfaceDef): boolean {
  return iface.protocols.some((p) => p.type === CONNECTOR_PROTOCOL);
}

/**
 * A physical connector as one interface: one slot per position
 * (`p1…pN`) and a default profile binding each used position to the pad or
 * leaf interface it carries. Links between two connectors are matched by
 * position; the functional links (power, UART, …) are derived by tracing
 * conductors through harnesses (`deriveLinks`).
 *
 * Part-authoring rule: every physical connector on a part is a connector
 * composite. A connector carrying exactly one functional interface (USB-C,
 * an RF jack) may keep the connector trait on that interface instead.
 */
export function Connector(config: ConnectorConfig): InterfaceDef {
  const pins = config.pins.map((p) =>
    typeof p === "string" ? { label: p } : Array.isArray(p) ? { label: p[0], to: p[1] } : p,
  );
  const bindings: Record<string, string> = {};
  pins.forEach((p, i) => {
    if (p.to) bindings[`p${i + 1}`] = p.to;
  });
  const trait = connectorTrait(config.connector, {
    gender: config.gender,
    positions: pins.length,
    pinout: pins.map((p) => p.label),
    note: config.note,
    mates: config.mates,
    supplied: config.supplied,
  });
  if (config.matesWith?.length) (trait.params as Record<string, unknown>).mates_with = config.matesWith;
  return {
    id: config.id,
    name: config.name,
    domain: config.domain ?? "electrical",
    exposed: config.exposed ?? true,
    default_active: true,
    protocols: [{ type: CONNECTOR_PROTOCOL, roles: ["mate"] }],
    slots: pins.map((p, i) => ({ id: `p${i + 1}`, label: p.label, required: false, match: {} })),
    profiles: [{ id: `${config.id}_pinout`, label: "Pinout", default_active: true, bindings }],
    max_instances: 1,
    traits: [trait, ...(config.traits ?? [])],
  };
}
