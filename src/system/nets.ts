/**
 * Boards and nets (PB-824): a custom PCB is an ordinary module whose
 * children are its components and whose nets are `Net` interfaces on the
 * board itself, each pin joined to its net by a stored membership link
 * (docs/boards-and-nets.md).
 *
 * Here: validation of membership links, the net index of a module, and the
 * board rules that need whole nets rather than pairs of pins:
 *
 *   net               a net with fewer than two pins; a pin on two nets;
 *                     several modules driving one supply net; ground joined
 *                     to a supply; a pin whose voltage the net's design
 *                     voltage does not meet
 *   bus_pullup        an I2C link over nets with no pull-up resistor to a supply
 *   design_envelope   a stated body larger than the module's design envelope
 *
 * The functional links between the pins of a net are derived in derive.ts.
 */
import type { InterfaceDef } from "../types/interface.js";
import type { InterfaceLink, ModuleDef } from "../types/module.js";
import type { Parameter } from "../types/parameter.js";
import type { DesignEnvelopeTrait } from "../types/trait.js";
import type { Diagnostic } from "../drc/types.js";
import { getEffectiveRange, rangesOverlap } from "../parameters/range.js";
import { isNet, NET_PROTOCOL } from "../protocols/net.js";
import { passiveOf } from "../protocols/passive.js";
import { isConnector } from "../protocols/connector.js";
import { slotBindings } from "./connectors.js";
import { formatPath, type LinkResult, type ModuleLookup, type ResolvedEndpoint } from "./index.js";
import type { SystemDiagnostic } from "./checks.js";

// ---------------------------------------------------------------------------
// Membership links
// ---------------------------------------------------------------------------

/**
 * Validate a stored link with a net at one end: it joins one pin to a net
 * declared on the linking module. Nothing is matched; what the pins on a net
 * carry is checked on the links derived from it.
 */
export function validateNetLink(link: InterfaceLink, a: ResolvedEndpoint, b: ResolvedEndpoint): LinkResult {
  const diagnostics: Diagnostic[] = [];
  const netIsA = isNet(a.iface);
  const [net, member] = netIsA ? [a, b] : [b, a];
  const netTarget = netIsA ? link.a : link.b;
  if (isNet(member.iface)) {
    diagnostics.push({ severity: "error", code: "net_to_net", message: `${a.path} and ${b.path} are both nets; a pin joins a net, and two nets that are one conductor are one net`, refs: [a.path, b.path] });
  } else if (member.iface.slots?.length || isConnector(member.iface)) {
    diagnostics.push({ severity: "error", code: "net_member_composite", message: `${member.path} is a composite interface; a net joins pins, so link its leaves`, refs: [member.path, net.path] });
  }
  if (!("self" in netTarget)) {
    diagnostics.push({ severity: "error", code: "net_not_own", message: `${net.path} is a net of a child; nets join pins on the module that declares them`, refs: [net.path] });
  }
  return {
    link,
    a,
    b,
    state: diagnostics.length ? "incompatible" : "configured",
    protocol: NET_PROTOCOL,
    children: [],
    unresolvedSlots: [],
    diagnostics,
  };
}

/** True for a link result that is a net membership rather than a functional link. */
export function isNetMembership(r: LinkResult): boolean {
  return r.protocol === NET_PROTOCOL;
}

// ---------------------------------------------------------------------------
// Net index
// ---------------------------------------------------------------------------

export interface NetMember {
  /** Canonical path of the pin, e.g. `u2:pin_8`. */
  path: string;
  end: ResolvedEndpoint;
  /** The membership link. */
  link: string;
}

export interface BoardNet {
  iface: InterfaceDef;
  /** Canonical path of the net on the module, `:<id>`. */
  path: string;
  members: NetMember[];
}

/** Every net declared on `def`, with the pins its valid membership links join. */
export function moduleNets(def: ModuleDef, links: LinkResult[]): BoardNet[] {
  const nets = new Map<string, BoardNet>();
  for (const iface of def.interfaces) {
    if (isNet(iface)) nets.set(iface.id, { iface, path: formatPath([], iface.id), members: [] });
  }
  for (const r of links) {
    if (!isNetMembership(r) || r.state === "incompatible") continue;
    const [net, member] = isNet(r.a.iface) ? [r.a, r.b] : [r.b, r.a];
    nets.get(net.iface.id)?.members.push({ path: member.path, end: member, link: r.link.id });
  }
  return [...nets.values()];
}

function param(iface: InterfaceDef, id: string): Parameter | undefined {
  return iface.parameters?.find((p) => p.id === id);
}

const hasRole = (iface: InterfaceDef, type: string, role: string) =>
  iface.protocols.some((p) => p.type === type && p.roles.includes(role));

/** Design voltage of a net (its `voltage` parameter) as a range, if stated. */
export function netVoltageRange(net: InterfaceDef): [number, number] | undefined {
  const p = param(net, "voltage");
  return (p && getEffectiveRange(p)) ?? undefined;
}

/** Nominal design voltage of a net: its value, else the lower end of its range. */
export function netVoltage(net: InterfaceDef): number | undefined {
  const p = param(net, "voltage");
  return p?.value ?? p?.range?.[0];
}

const fmtRange = (r: [number, number]) => (r[0] === r[1] ? `${r[0]} V` : `${r[0]}–${r[1]} V`);

/**
 * Paths a module's boundary supplies from outside: its exported child
 * interfaces, the leaves those exports bind, and every pin on a net that
 * carries one of them. A power input here is fed through the board edge, so
 * the unpowered rule does not report it when the board is checked alone.
 */
export function edgeFedPaths(def: ModuleDef, lookup: ModuleLookup, nets: BoardNet[]): Set<string> {
  const fed = new Set<string>();
  for (const ex of def.exports ?? []) {
    const { child, interfaceId } = ex.from;
    fed.add(`${child}:${interfaceId}`);
    const ref = def.children?.find((c) => c.id === child);
    const iface = ref ? lookup(ref.moduleDefId)?.interfaces.find((i) => i.id === interfaceId) : undefined;
    for (const leaf of iface ? Object.values(slotBindings(iface)) : []) fed.add(`${child}:${leaf}`);
  }
  for (const net of nets) {
    if (net.members.some((m) => fed.has(m.path))) for (const m of net.members) fed.add(m.path);
  }
  return fed;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export function netRule(def: ModuleDef, links: LinkResult[]): SystemDiagnostic[] {
  const nets = moduleNets(def, links);
  const out: SystemDiagnostic[] = [];
  const netsOf = new Map<string, string[]>();

  for (const net of nets) {
    const id = net.iface.id;
    const label = net.iface.name && net.iface.name !== id ? `${id} (${net.iface.name})` : id;
    const refs = [net.path, ...net.members.map((m) => m.path)];
    for (const m of net.members) netsOf.set(m.path, [...(netsOf.get(m.path) ?? []), id]);

    if (net.members.length < 2) {
      out.push({
        id: `net:${id}:members`,
        rule: "net",
        severity: "warning",
        message: net.members.length
          ? `net ${label} joins only ${net.members[0].path}; nothing else is on it.`
          : `net ${label} joins no pins.`,
        refs,
      });
    }

    // more than one module driving a supply net
    const drivers = new Map<string, string[]>();
    for (const m of net.members) {
      if (!hasRole(m.end.iface, "power", "output")) continue;
      const owner = m.end.ownerPath.join("/");
      drivers.set(owner, [...(drivers.get(owner) ?? []), m.path]);
    }
    if (drivers.size > 1) {
      const paths = [...drivers.values()].flat();
      out.push({
        id: `net:${id}:drivers`,
        rule: "net",
        severity: "error",
        message: `net ${label} is driven by ${drivers.size} supplies (${paths.join(", ")}); outputs in parallel fight each other.`,
        refs: [net.path, ...paths],
      });
    }

    // ground joined to a supply rail
    const grounds = net.members.filter((m) => hasRole(m.end.iface, "power", "ground")).map((m) => m.path);
    const rails = net.members
      .filter((m) => hasRole(m.end.iface, "power", "input") || hasRole(m.end.iface, "power", "output"))
      .map((m) => m.path);
    if (grounds.length && rails.length) {
      out.push({
        id: `net:${id}:ground`,
        rule: "net",
        severity: "error",
        message: `net ${label} joins ground (${grounds.join(", ")}) to supply pins (${rails.join(", ")}): a short.`,
        refs: [net.path, ...grounds, ...rails],
      });
    }

    // every pin with a stated voltage accepts the net's design voltage
    const design = netVoltageRange(net.iface);
    if (design) {
      for (const m of net.members) {
        const p = param(m.end.iface, "voltage");
        const range = p && getEffectiveRange(p);
        if (!range || rangesOverlap(range, design)) continue;
        out.push({
          id: `net:${id}:voltage:${m.path}`,
          rule: "net",
          severity: "error",
          message: `${m.path} (${m.end.iface.name ?? m.end.iface.id}) is rated ${fmtRange(range)} but net ${label} is ${fmtRange(design)}.`,
          refs: [net.path, m.path, `link:${m.link}`],
          details: { pin: range, net: design },
        });
      }
    }
  }

  for (const [path, ids] of netsOf) {
    if (ids.length < 2) continue;
    out.push({
      id: `net:short:${path}`,
      rule: "net",
      severity: "error",
      message: `${path} is on nets ${ids.join(", ")}, which joins them into one conductor.`,
      refs: [path, ...ids.map((n) => formatPath([], n))],
    });
  }
  return out;
}

/**
 * An I2C link derived over nets needs a pull-up on each of its nets: a
 * resistor (a `passive` resistor child) with one terminal on the bus net and
 * the other on a supply net (a net with a power output or a positive design
 * voltage). Parts with internal pull-ups are not modelled, so this warns.
 */
export function busPullupRule(def: ModuleDef, links: LinkResult[], lookup: ModuleLookup): SystemDiagnostic[] {
  const nets = moduleNets(def, links);
  const byId = new Map(nets.map((n) => [n.iface.id, n]));
  const netsOfPath = new Map<string, string[]>();
  for (const n of nets) for (const m of n.members) netsOfPath.set(m.path, [...(netsOfPath.get(m.path) ?? []), n.iface.id]);

  const isSupply = (n: BoardNet) =>
    n.members.some((m) => hasRole(m.end.iface, "power", "output")) || (netVoltage(n.iface) ?? 0) > 0;

  const pulledUp = (n: BoardNet) =>
    n.members.some((m) => {
      if (m.end.ownerPath.length !== 1) return false;
      const ref = def.children?.find((c) => c.id === m.end.ownerPath[0]);
      const child = ref ? lookup(ref.moduleDefId) : undefined;
      if (!child || passiveOf(child)?.kind !== "resistor") return false;
      return child.interfaces
        .filter((t) => t.id !== m.end.iface.id)
        .some((t) => (netsOfPath.get(`${ref!.id}:${t.id}`) ?? []).some((other) => {
          const on = byId.get(other);
          return on !== undefined && on !== n && isSupply(on);
        }));
    });

  const out: SystemDiagnostic[] = [];
  const reported = new Set<string>();
  for (const r of links) {
    if (r.protocol !== "i2c" || r.state === "incompatible" || !r.derived?.nets?.length) continue;
    for (const id of r.derived.nets) {
      const n = byId.get(id);
      if (!n || reported.has(id) || pulledUp(n)) continue;
      reported.add(id);
      out.push({
        id: `bus_pullup:${id}`,
        rule: "bus_pullup",
        severity: "warning",
        message: `net ${id} carries I2C (${r.a.path} ↔ ${r.b.path}) but no resistor pulls it up to a supply.`,
        refs: [n.path, `link:${r.link.id}`, r.a.path, r.b.path],
      });
    }
  }
  return out;
}

/** A stated body (`dimensions_mm`) larger than the module's `design_envelope`. */
export function designEnvelopeRule(def: ModuleDef): SystemDiagnostic[] {
  const env = def.traits?.find((t) => t.type === "design_envelope")?.params as DesignEnvelopeTrait["params"] | undefined;
  if (!env) return [];
  const body = def.domains?.find((d) => d.domain === "mechanical" && d.dimensions_mm)?.dimensions_mm;
  if (!body) return [];
  const out: SystemDiagnostic[] = [];
  for (const axis of ["length", "width", "height"] as const) {
    const max = env.max_mm[axis];
    const size = body[axis];
    if (max === undefined || size === undefined || size <= max) continue;
    out.push({
      id: `design_envelope:${axis}`,
      rule: "design_envelope",
      severity: "error",
      message: `${def.id}: ${axis} ${size} mm exceeds the design envelope's ${max} mm${env.reason ? ` (${env.reason})` : ""}.`,
      refs: [],
      details: { axis, size, max },
    });
  }
  return out;
}
