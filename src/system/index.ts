/**
 * System-level helpers for modules with children: canonical paths, boundary
 * interfaces (own + exported), and validation of stored interface links.
 */
import type { InterfaceDef } from "../types/interface.js";
import type {
  ChildLink,
  EndpointTarget,
  InterfaceExport,
  InterfaceLink,
  ModuleDef,
} from "../types/module.js";
import type { ConnectionResult, ConnectionState, Diagnostic, SubLinkResult } from "../drc/types.js";
import { validatePair } from "../drc/validate-pair.js";
import { matchProtocols } from "../matching/protocol-match.js";

/** Resolves a child's `moduleDefId` to its definition. */
export type ModuleLookup = (moduleDefId: string) => ModuleDef | undefined;

// ---------------------------------------------------------------------------
// Canonical paths
// ---------------------------------------------------------------------------

/**
 * Canonical path of a module instance or interface below a root module:
 * `child/grandchild` for modules, `child/grandchild:interface` for interfaces,
 * and `...:interface/slot` for a child interface under a composed one.
 */
export function formatPath(modules: string[], interfaceId?: string, slotId?: string): string {
  const base = modules.join("/");
  if (interfaceId === undefined) return base;
  return `${base}:${interfaceId}${slotId !== undefined ? `/${slotId}` : ""}`;
}

export function parsePath(path: string): { modules: string[]; interfaceId?: string; slotId?: string } {
  const [modulePart, interfacePart] = path.split(":");
  const modules = modulePart ? modulePart.split("/") : [];
  if (interfacePart === undefined) return { modules };
  const [interfaceId, slotId] = interfacePart.split("/");
  return { modules, interfaceId, ...(slotId !== undefined ? { slotId } : {}) };
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * Interfaces that appear on a module's outline: every interface that is not
 * bound as a leaf into another interface's profile (pins behind a UART port
 * are revealed by opening the link, not drawn on the outline). Power and
 * ground leaves stay primary even when a connector binds them, because a
 * supply net is shared by every consumer.
 */
export function primaryInterfaces(def: ModuleDef): InterfaceDef[] {
  const bound = new Set<string>();
  for (const iface of def.interfaces) {
    for (const profile of iface.profiles ?? []) {
      for (const value of Object.values(profile.bindings)) {
        for (const id of Array.isArray(value) ? value : [value]) {
          if (id !== iface.id) bound.add(id);
        }
      }
    }
  }
  const isPower = (iface: InterfaceDef) => iface.protocols.some((p) => p.type === "power");
  return def.interfaces.filter((iface) => iface.exposed && (!bound.has(iface.id) || isPower(iface)));
}

/** Interfaces reachable from `iface` through its profiles (the slice DRC needs). */
function boundClosure(def: ModuleDef, root: InterfaceDef): InterfaceDef[] {
  const byId = new Map(def.interfaces.map((i) => [i.id, i]));
  const seen = new Map<string, InterfaceDef>([[root.id, root]]);
  const queue = [root];
  while (queue.length) {
    const current = queue.shift()!;
    for (const profile of current.profiles ?? []) {
      for (const value of Object.values(profile.bindings)) {
        for (const id of Array.isArray(value) ? value : [value]) {
          const leaf = byId.get(id);
          if (leaf && !seen.has(id)) {
            seen.set(id, leaf);
            queue.push(leaf);
          }
        }
      }
    }
  }
  return [...seen.values()];
}

export interface ResolvedExport extends InterfaceExport {
  /** The child module the export comes from. */
  childDef: ModuleDef;
  /** The child interface being exported. */
  iface: InterfaceDef;
  /** True when implied by `kind: "group"` rather than declared. */
  implicit: boolean;
}

function childDef(def: ModuleDef, childId: string, lookup: ModuleLookup): ModuleDef {
  const ref = def.children?.find((c) => c.id === childId);
  if (!ref) throw new Error(`Module "${def.id}" has no child "${childId}"`);
  const resolved = lookup(ref.moduleDefId);
  if (!resolved) throw new Error(`Child "${childId}" of "${def.id}" references unknown module "${ref.moduleDefId}"`);
  return resolved;
}

/**
 * Exports of a module: its declared `exports`, plus — for `kind: "group"` —
 * every primary interface of every child that no internal link consumes.
 * Implicit export ids are `<child>__<interface>`.
 */
export function resolveExports(def: ModuleDef, lookup: ModuleLookup): ResolvedExport[] {
  const out: ResolvedExport[] = [];
  const declared = new Set<string>();
  for (const ex of def.exports ?? []) {
    const child = childDef(def, ex.from.child, lookup);
    const iface = boundaryInterfaces(child, lookup).find((i) => i.id === ex.from.interfaceId);
    if (!iface) throw new Error(`Export "${ex.id}" of "${def.id}": child "${ex.from.child}" has no interface "${ex.from.interfaceId}"`);
    out.push({ ...ex, childDef: child, iface, implicit: false });
    declared.add(`${ex.from.child}:${ex.from.interfaceId}`);
  }
  if (def.kind !== "group") return out;

  const linkedInternally = new Set<string>();
  for (const link of def.links ?? []) {
    for (const end of [link.a, link.b]) {
      if ("child" in end) linkedInternally.add(`${end.child}:${end.interfaceId}`);
    }
  }
  for (const ref of def.children ?? []) {
    const child = childDef(def, ref.id, lookup);
    for (const iface of boundaryInterfaces(child, lookup)) {
      const key = `${ref.id}:${iface.id}`;
      if (declared.has(key) || linkedInternally.has(key)) continue;
      out.push({
        id: `${ref.id}__${iface.id}`,
        name: `${ref.name ?? child.name} · ${iface.name ?? iface.id}`,
        from: { child: ref.id, interfaceId: iface.id },
        childDef: child,
        iface,
        implicit: true,
      });
    }
  }
  return out;
}

/** Everything a neighbour can attach to: primary own interfaces plus exports. */
export function boundaryInterfaces(def: ModuleDef, lookup: ModuleLookup): InterfaceDef[] {
  const own = primaryInterfaces(def);
  if (!def.exports?.length && def.kind !== "group") return own;
  const exported = resolveExports(def, lookup).map((ex) => ({
    ...ex.iface,
    id: ex.id,
    name: ex.name ?? ex.iface.name,
  }));
  return [...own, ...exported];
}

// ---------------------------------------------------------------------------
// Link validation
// ---------------------------------------------------------------------------

export interface ResolvedEndpoint {
  /** Canonical path of the endpoint interface relative to the linking module. */
  path: string;
  /** The module that finally owns the interface (after following exports). */
  owner: ModuleDef;
  iface: InterfaceDef;
}

/** Follow an endpoint through exports down to the module that owns the interface. */
export function resolveEndpoint(def: ModuleDef, end: EndpointTarget, lookup: ModuleLookup): ResolvedEndpoint {
  let owner = "child" in end ? childDef(def, end.child, lookup) : def;
  let interfaceId = end.interfaceId;
  const modules = "child" in end ? [end.child] : [];

  for (let depth = 0; depth < 16; depth++) {
    const own = owner.interfaces.find((i) => i.id === interfaceId);
    if (own) return { path: formatPath(modules, end.interfaceId), owner, iface: own };
    const ex = resolveExports(owner, lookup).find((e) => e.id === interfaceId);
    if (!ex) break;
    owner = ex.childDef;
    interfaceId = ex.from.interfaceId;
  }
  throw new Error(`Link endpoint ${formatPath(modules, end.interfaceId)} not found on "${owner.id}"`);
}

export type LinkState = "configured" | "partial" | "incompatible" | "unconfigured";

export interface LinkChildResult {
  a: { slotId?: string; leafId: string; pin?: string };
  b: { slotId?: string; leafId: string; pin?: string };
  method: "protocol" | "manual";
  locked: boolean;
}

export interface LinkResult {
  link: InterfaceLink;
  a: ResolvedEndpoint;
  b: ResolvedEndpoint;
  state: LinkState;
  /** Protocol type the pairing matched on (or the a-side's first type if none matched). */
  protocol: string;
  children: LinkChildResult[];
  unresolvedSlots: string[];
  diagnostics: Diagnostic[];
}

const STATE_MAP: Record<ConnectionState, LinkState> = {
  valid: "configured",
  valid_inferred: "configured",
  valid_manual: "configured",
  configuration_needed: "partial",
  warning: "partial",
  incompatible: "incompatible",
  not_configured: "unconfigured",
};

function slice(owner: ModuleDef, iface: InterfaceDef): ModuleDef {
  return { ...owner, interfaces: boundClosure(owner, iface), interfaceGroups: [] };
}

function leafPin(owner: ModuleDef, leafId: string): string | undefined {
  const pin = owner.interfaces.find((i) => i.id === leafId)?.pin;
  return pin === undefined ? undefined : String(pin);
}

function childFromSubLink(sub: SubLinkResult, aOwner: ModuleDef, bOwner: ModuleDef): LinkChildResult {
  return {
    a: { slotId: sub.from.slotId, leafId: sub.from.interfaceId, pin: leafPin(aOwner, sub.from.interfaceId) },
    b: { slotId: sub.to.slotId, leafId: sub.to.interfaceId, pin: leafPin(bOwner, sub.to.interfaceId) },
    method: "protocol",
    locked: false,
  };
}

function storedChildren(stored: ChildLink[], a: ResolvedEndpoint, b: ResolvedEndpoint): LinkChildResult[] {
  const leafFor = (end: ResolvedEndpoint, slotOrLeaf: string) => {
    const binding = end.iface.profiles?.[0]?.bindings[slotOrLeaf];
    const leafId = typeof binding === "string" ? binding : slotOrLeaf;
    return { slotId: binding !== undefined ? slotOrLeaf : undefined, leafId, pin: leafPin(end.owner, leafId) };
  };
  return stored.map((c) => ({
    a: leafFor(a, c.a),
    b: leafFor(b, c.b),
    method: "manual",
    locked: c.locked ?? false,
  }));
}

/**
 * Validate one stored interface link: DRC runs on slices of the two owning
 * modules containing just the linked interfaces and the leaves they bind, so
 * the result describes exactly this connection (auto-discovery ambiguity
 * elsewhere on a module does not matter).
 */
export function validateLink(def: ModuleDef, link: InterfaceLink, lookup: ModuleLookup): LinkResult {
  const a = resolveEndpoint(def, link.a, lookup);
  const b = resolveEndpoint(def, link.b, lookup);
  const pair = validatePair(slice(a.owner, a.iface), slice(b.owner, b.iface), { includePotentials: false });
  const connection: ConnectionResult | undefined = pair.connections.find(
    (c) => c.a.regionPath[0] === a.iface.id && c.b.regionPath[0] === b.iface.id,
  );

  if (!connection) {
    const match = matchProtocols(a.iface, b.iface);
    const reason = a.iface.domain !== b.iface.domain
      ? `domains differ (${a.iface.domain} vs ${b.iface.domain})`
      : match.compatible
        ? "interfaces match by protocol but parameters conflict"
        : `no compatible protocol/role between ${a.path} and ${b.path}`;
    const paramDiagnostics = pair.connections.flatMap((c) => c.diagnostics);
    return {
      link,
      a,
      b,
      state: "incompatible",
      protocol: a.iface.protocols[0]?.type ?? "custom",
      children: link.childLinks ? storedChildren(link.childLinks, a, b) : [],
      unresolvedSlots: [],
      diagnostics: [{ severity: "error", code: "link_incompatible", message: reason, refs: [] }, ...paramDiagnostics],
    };
  }

  const storedProblems = link.childLinks ? childLinkProblems(link.childLinks) : [];
  const children = link.childLinks
    ? storedChildren(link.childLinks, a, b)
    : connection.subLinks
        .filter((s) => s.from.interfaceId !== a.iface.id || s.to.interfaceId !== b.iface.id)
        .map((s) => childFromSubLink(s, a.owner, b.owner));

  const state: LinkState = storedProblems.length
    ? "incompatible"
    : link.childLinks && STATE_MAP[connection.state] === "partial"
      ? "configured"
      : STATE_MAP[connection.state];
  return {
    link,
    a,
    b,
    state,
    protocol: connection.protocol,
    children,
    unresolvedSlots: connection.unresolvedSlots.map((u) => `${u.moduleId}:${u.slotId}`),
    diagnostics: [...storedProblems, ...connection.diagnostics],
  };
}

/** Stored child links must use each slot at most once on each side. */
function childLinkProblems(stored: ChildLink[]): Diagnostic[] {
  const problems: Diagnostic[] = [];
  for (const side of ["a", "b"] as const) {
    const seen = new Map<string, number>();
    for (const c of stored) seen.set(c[side], (seen.get(c[side]) ?? 0) + 1);
    for (const [slot, n] of seen) {
      if (n > 1) {
        problems.push({
          severity: "error",
          code: "child_link_duplicate",
          message: `stored child links map ${side}-side ${slot} ${n} times; each conductor must land on a distinct slot`,
          refs: [slot],
        });
      }
    }
  }
  return problems;
}

/** Validate every stored link on a module. */
export function validateLinks(def: ModuleDef, lookup: ModuleLookup): LinkResult[] {
  return (def.links ?? []).map((link) => validateLink(def, link, lookup));
}
