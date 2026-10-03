/**
 * Connector links: a link between two connector composites (or a
 * connector and a link-scoped composition) mates positions, not protocols.
 * Checked here: connector type, gender, position count and compose slots.
 * What the positions carry is checked on the links derived from them
 * (derive.ts).
 */
import type { InterfaceDef } from "../types/interface.js";
import type { InterfaceLink } from "../types/module.js";
import type { Diagnostic } from "../drc/types.js";
import { isConnector } from "../protocols/connector.js";
import type { LinkChildResult, LinkResult, ResolvedEndpoint } from "./index.js";


interface ConnectorParams {
  connector_type?: string;
  gender?: string;
  positions?: number;
  mates_with?: string[];
}

function connectorParams(iface: InterfaceDef): ConnectorParams[] {
  return (iface.traits ?? []).filter((t) => t.type === "connector").map((t) => (t.params ?? {}) as ConnectorParams);
}

/** Connector type slugs declared on an interface (its `connector` traits). */
export function connectorTypes(iface: InterfaceDef): string[] {
  return connectorParams(iface)
    .map((p) => String(p.connector_type ?? ""))
    .filter(Boolean);
}

/** Slot → bound interface id, from the connector's default (first) profile. */
export function slotBindings(iface: InterfaceDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [slot, v] of Object.entries(iface.profiles?.[0]?.bindings ?? {})) {
    const id = Array.isArray(v) ? v[0] : v;
    if (id) out[slot] = id;
  }
  return out;
}

/** Slot ids of a connector, in position order. */
export function slotIds(iface: InterfaceDef): string[] {
  return (iface.slots ?? []).map((s) => s.id);
}

/** Position pairs of a connector link: stored child links, else same slot id. */
export function positionPairs(link: InterfaceLink, a: ResolvedEndpoint, b: ResolvedEndpoint): { a: string; b: string }[] {
  if (link.childLinks?.length) return link.childLinks.map((c) => ({ a: c.a, b: c.b }));
  const bSlots = new Set(slotIds(b.iface));
  return slotIds(a.iface)
    .filter((s) => bSlots.has(s))
    .map((s) => ({ a: s, b: s }));
}

const OPPOSITE_ONLY = new Set(["plug", "receptacle", "male", "female", "socket", "header"]);

function mateProblems(link: InterfaceLink, a: ResolvedEndpoint, b: ResolvedEndpoint): Diagnostic[] {
  const out: Diagnostic[] = [];
  const pa = connectorParams(a.iface);
  const pb = connectorParams(b.iface);
  const ta = connectorTypes(a.iface);
  const tb = connectorTypes(b.iface);
  if (ta.length && tb.length) {
    const accepts = (x: ConnectorParams[], y: string[]) => x.some((p) => (p.mates_with ?? []).some((m) => y.includes(m)));
    if (!ta.some((t) => tb.includes(t)) && !accepts(pa, tb) && !accepts(pb, ta)) {
      out.push({ severity: "error", code: "connector_mismatch", message: `${a.path} is ${ta.join("/")} but ${b.path} is ${tb.join("/")}`, refs: [a.path, b.path] });
    }
  }
  const ga = pa.find((p) => p.gender)?.gender;
  const gb = pb.find((p) => p.gender)?.gender;
  if (ga && gb && ga === gb && OPPOSITE_ONLY.has(ga)) {
    out.push({ severity: "error", code: "connector_gender", message: `${a.path} and ${b.path} are both ${ga}`, refs: [a.path, b.path] });
  }
  if (!a.composed && !b.composed) {
    const na = slotIds(a.iface).length;
    const nb = slotIds(b.iface).length;
    if (na && nb && na !== nb && !link.childLinks?.length) {
      out.push({ severity: "error", code: "connector_positions", message: `${a.path} has ${na} positions but ${b.path} has ${nb}`, refs: [a.path, b.path] });
    }
  }
  for (const [composed, other] of [[a, b], [b, a]] as const) {
    if (!composed.composed) continue;
    const known = new Set(slotIds(other.iface));
    for (const slot of Object.keys(composed.composed)) {
      if (!known.has(slot)) {
        out.push({ severity: "error", code: "compose_unknown_slot", message: `${composed.path} composes ${slot}, which ${other.path} does not have (${[...known].join(", ")})`, refs: [composed.path, other.path] });
      }
    }
  }
  return out;
}

function leafFor(end: ResolvedEndpoint, slot: string): LinkChildResult["a"] {
  const composed = end.composed?.[slot];
  if (composed) return { slotId: slot, leafId: composed.iface.id, pin: composed.iface.pin === undefined ? undefined : String(composed.iface.pin) };
  const leafId = slotBindings(end.iface)[slot];
  const leaf = leafId ? end.owner.interfaces.find((i) => i.id === leafId) : undefined;
  return { slotId: slot, leafId: leafId ?? slot, pin: leaf?.pin === undefined ? undefined : String(leaf.pin) };
}

/** Validate a stored link between two connectors: mating only, by position. */
export function validateConnectorLink(link: InterfaceLink, a: ResolvedEndpoint, b: ResolvedEndpoint): LinkResult {
  const diagnostics = mateProblems(link, a, b);
  const children: LinkChildResult[] = positionPairs(link, a, b).map((p) => ({
    a: leafFor(a, p.a),
    b: leafFor(b, p.b),
    method: link.childLinks?.length ? "manual" : "protocol",
    locked: false,
  }));
  return {
    link,
    a,
    b,
    state: diagnostics.some((d) => d.severity === "error") ? "incompatible" : "configured",
    protocol: "connector",
    children,
    unresolvedSlots: [],
    diagnostics,
  };
}
