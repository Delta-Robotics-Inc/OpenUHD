import type { InterfaceDef } from "../types/interface.js";
import type { InterfaceLink } from "../types/module.js";
import type { TraitDef } from "../types/trait.js";
import { voltageRangeV, voltageV } from "./params.js";

/**
 * Nets (PB-824): the conductors of a board joining two or more pins.
 *
 * A net is an interface on the board module itself (protocol `net`, not
 * exposed). Each pin on the net is joined to it by an ordinary stored link
 * from the pin (`child`) to the net (`self`). The functional links between
 * the pins (supply output to inputs, I2C master to target) are derived from
 * the memberships by `deriveLinks`, so system checks see a board the same way
 * they see a cable. See docs/boards-and-nets.md.
 */
export const NET_PROTOCOL = "net";

export interface NetConfig {
  id: string;
  /** Net name as a schematic would print it, e.g. "3V3", "GND", "SDA". */
  name?: string;
  /**
   * Design voltage of the net: what the board intends this rail to be, not
   * what a part allows (a 1.2–5.5 V adjustable regulator set to 3.3 V). Every
   * pin on the net with a `voltage` parameter is checked against it.
   */
  voltageV?: number | [number, number];
  traits?: TraitDef[];
}

/** True for a net interface. */
export function isNet(iface: InterfaceDef): boolean {
  return iface.protocols.some((p) => p.type === NET_PROTOCOL);
}

/** A net on a board: the node that its pins' membership links join. */
export function Net(config: NetConfig): InterfaceDef {
  const v = config.voltageV;
  return {
    id: config.id,
    name: config.name ?? config.id,
    domain: "electrical",
    exposed: false,
    default_active: true,
    protocols: [{ type: NET_PROTOCOL, roles: ["node"] }],
    ...(v !== undefined ? { parameters: [Array.isArray(v) ? voltageRangeV(v[0], v[1]) : voltageV(v)] } : {}),
    ...(config.traits?.length ? { traits: config.traits } : {}),
  };
}

/**
 * Membership links joining pins to a net on the linking module. Members are
 * `"<child>:<interface>"` (an interface or export of a direct child). Link
 * ids are `<net>.<child>.<interface>`.
 *
 *   links: [...netLinks("gnd", ["u1:pad_gnd", "u2:pin_6", "u2:pin_7", "u3:pgnd"])]
 */
export function netLinks(net: string, members: string[]): InterfaceLink[] {
  return members.map((member) => {
    const [child, interfaceId, extra] = member.split(":");
    if (!child || !interfaceId || extra !== undefined || child.includes("/")) {
      throw new Error(`Net "${net}": member "${member}" is not "<child>:<interface>"`);
    }
    return {
      id: `${net}.${child}.${interfaceId}`,
      a: { child, interfaceId },
      b: { self: true, interfaceId: net },
    };
  });
}
