/**
 * Derived links (PB-805): the functional connections a physical wiring makes.
 *
 * Stored links between connectors mate positions; harness modules carry
 * conductors between their own ends (internal `self` ↔ `self` links whose
 * child links are the wires, straight through by default). Walking those
 * conductors from a pad on one part to a pad on another gives leaf pairs.
 * Each pad is lifted back to the functional interface it belongs to — the
 * composite (UART, I2C, FC/ESC port…) whose bound pads all travel to the same
 * module, else the pad itself — and each lifted pair becomes an ordinary link
 * result, validated like a stored link and tagged `derived`.
 *
 * System checks run on stored and derived links together, so supply budgets,
 * interface reuse, unpowered inputs and bus addresses see through cables.
 * The walk also checks the wiring: conductor pairs inside a composite must
 * match the pairing the protocol expects (TX to RX).
 *
 * Scope: harnesses that are children of the linking module, and connector
 * links stored on it. Parts may be nested (a pad on stack/fc).
 */
import type { InterfaceDef } from "../types/interface.js";
import type { InterfaceLink, ModuleDef } from "../types/module.js";
import type { Diagnostic } from "../drc/types.js";
import {
  formatPath,
  resolveEndpoint,
  resolveExports,
  validateLinks,
  validateResolved,
  type LinkChildResult,
  type LinkResult,
  type ModuleLookup,
  type ResolvedEndpoint,
} from "./index.js";
import { positionPairs, slotBindings } from "./connectors.js";
import { isConnector } from "../protocols/connector.js";

interface Terminal {
  key: string;
  owner: ModuleDef;
  ownerPath: string[];
  leaf: InterfaceDef;
}

interface Edge {
  to: string;
  link?: string;
  harness?: string;
}

const pathKey = (p: string[]) => p.join("/");

/** The conductor node for one position of a resolved connector end. */
function nodeFor(end: ResolvedEndpoint, slot: string, lookup: ModuleLookup): { key: string; terminal?: Terminal; harness?: string } | undefined {
  const composed = end.composed?.[slot];
  if (composed) {
    const key = `${pathKey(composed.ownerPath)}#${composed.iface.id}`;
    if (composed.owner.kind === "harness") return { key, harness: composed.ownerPath[0] };
    return { key, terminal: { key, owner: composed.owner, ownerPath: composed.ownerPath, leaf: composed.iface } };
  }
  if (end.owner.kind === "harness") return { key: `${pathKey(end.ownerPath)}#${end.iface.id}/${slot}`, harness: end.ownerPath[0] };
  const leafId = slotBindings(end.iface)[slot];
  if (!leafId) return undefined; // unused position (VOID)
  const leaf = end.owner.interfaces.find((i) => i.id === leafId);
  if (!leaf) return undefined;
  const key = `${pathKey(end.ownerPath)}#${leafId}`;
  return { key, terminal: { key, owner: end.owner, ownerPath: end.ownerPath, leaf } };
}

/** Composite interfaces (not connectors) that bind `leafId` in their default profile. */
function compositesBinding(owner: ModuleDef, leafId: string): { iface: InterfaceDef; leaves: string[] }[] {
  const out: { iface: InterfaceDef; leaves: string[] }[] = [];
  for (const iface of owner.interfaces) {
    if (isConnector(iface) || !iface.profiles?.length) continue;
    const leaves = Object.values(slotBindings(iface));
    if (leaves.includes(leafId)) out.push({ iface, leaves });
  }
  return out;
}

/** The functional interface a pad belongs to, given every pad carried to the same module. */
function lift(owner: ModuleDef, leaf: InterfaceDef, carried: Set<string>): InterfaceDef {
  const eligible = compositesBinding(owner, leaf.id)
    .filter((c) => c.leaves.every((l) => carried.has(l)))
    .sort((x, y) => y.leaves.length - x.leaves.length);
  return eligible[0]?.iface ?? leaf;
}

/** Root-relative endpoint for an interface owned at `ownerPath`: through an export when one exists. */
function endpointFor(def: ModuleDef, ownerPath: string[], owner: ModuleDef, iface: InterfaceDef, lookup: ModuleLookup): ResolvedEndpoint {
  if (ownerPath.length > 1) {
    const top = def.children?.find((c) => c.id === ownerPath[0]);
    const topDef = top ? lookup(top.moduleDefId) : undefined;
    for (const ex of topDef ? resolveExports(topDef, lookup) : []) {
      try {
        const r = resolveEndpoint(def, { child: ownerPath[0], interfaceId: ex.id }, lookup);
        if (r.owner === owner && r.iface.id === iface.id && pathKey(r.ownerPath) === pathKey(ownerPath)) return r;
      } catch {
        /* unresolvable export: skip */
      }
    }
  }
  return { path: formatPath(ownerPath, iface.id), owner, iface, ownerPath };
}

const targetFor = (end: ResolvedEndpoint) => {
  const [child] = end.ownerPath;
  const interfaceId = end.path.slice(end.path.indexOf(":") + 1);
  const below = end.ownerPath.length > 1 && !end.path.startsWith(`${child}:`) ? `${end.ownerPath.slice(1).join("/")}:${end.iface.id}` : interfaceId;
  return { child, interfaceId: below };
};

/**
 * Functional links derived from the connector links and harnesses of `def`.
 * Pass `stored` to reuse results from validateLinks.
 */
export function deriveLinks(def: ModuleDef, lookup: ModuleLookup, stored: LinkResult[] = validateLinks(def, lookup)): LinkResult[] {
  const edges = new Map<string, Edge[]>();
  const terminals = new Map<string, Terminal>();
  const order: string[] = [];
  const addEdge = (x: string, y: string, e: Omit<Edge, "to">) => {
    edges.set(x, [...(edges.get(x) ?? []), { to: y, ...e }]);
    edges.set(y, [...(edges.get(y) ?? []), { to: x, ...e }]);
  };

  // 1. mated positions of stored connector links
  for (const r of stored) {
    if (r.protocol !== "connector" || r.state === "incompatible") continue;
    for (const p of positionPairs(r.link, r.a, r.b)) {
      const na = nodeFor(r.a, p.a, lookup);
      const nb = nodeFor(r.b, p.b, lookup);
      if (!na || !nb) continue;
      for (const n of [na, nb]) {
        if (n.terminal && !terminals.has(n.key)) {
          terminals.set(n.key, n.terminal);
          order.push(n.key);
        }
      }
      addEdge(na.key, nb.key, { link: r.link.id });
    }
  }

  // 2. conductors inside harness children
  for (const ref of def.children ?? []) {
    const h = lookup(ref.moduleDefId);
    if (h?.kind !== "harness") continue;
    for (const link of h.links ?? []) {
      if (!("self" in link.a) || !("self" in link.b)) continue;
      const ia = h.interfaces.find((i) => i.id === link.a.interfaceId);
      const ib = h.interfaces.find((i) => i.id === link.b.interfaceId);
      if (!ia || !ib) continue;
      const ra: ResolvedEndpoint = { path: formatPath([ref.id], ia.id), owner: h, iface: ia, ownerPath: [ref.id] };
      const rb: ResolvedEndpoint = { path: formatPath([ref.id], ib.id), owner: h, iface: ib, ownerPath: [ref.id] };
      for (const p of positionPairs(link, ra, rb)) {
        addEdge(`${ref.id}#${ia.id}/${p.a}`, `${ref.id}#${ib.id}/${p.b}`, { harness: ref.id });
      }
    }
  }

  // 3. walk from each terminal through non-terminal nodes to the terminals it reaches
  interface Pair {
    a: Terminal;
    b: Terminal;
    links: Set<string>;
    harnesses: Set<string>;
  }
  const pairs = new Map<string, Pair>();
  for (const start of order) {
    const walk = (node: string, seen: Set<string>, links: Set<string>, harnesses: Set<string>) => {
      for (const e of edges.get(node) ?? []) {
        if (seen.has(e.to)) continue;
        const nextLinks = e.link ? new Set([...links, e.link]) : links;
        const nextHarnesses = e.harness ? new Set([...harnesses, e.harness]) : harnesses;
        const t = terminals.get(e.to);
        if (t) {
          const a = terminals.get(start)!;
          if (pathKey(a.ownerPath) === pathKey(t.ownerPath)) continue;
          const key = [start, e.to].sort().join("|");
          if (!pairs.has(key)) pairs.set(key, { a, b: t, links: nextLinks, harnesses: nextHarnesses });
          continue;
        }
        walk(e.to, new Set([...seen, e.to]), nextLinks, nextHarnesses);
      }
    };
    walk(start, new Set([start]), new Set(), new Set());
  }

  // 4. group by module pair, lift pads to functional interfaces, validate
  const byModules = new Map<string, Pair[]>();
  for (const p of pairs.values()) {
    const fwd = `${pathKey(p.a.ownerPath)}|${pathKey(p.b.ownerPath)}`;
    const rev = `${pathKey(p.b.ownerPath)}|${pathKey(p.a.ownerPath)}`;
    if (byModules.has(rev)) byModules.get(rev)!.push({ ...p, a: p.b, b: p.a });
    else byModules.set(fwd, [...(byModules.get(fwd) ?? []), p]);
  }

  const out: LinkResult[] = [];
  for (const group of byModules.values()) {
    const carriedA = new Set(group.map((p) => p.a.leaf.id));
    const carriedB = new Set(group.map((p) => p.b.leaf.id));
    const functional = new Map<string, { fa: InterfaceDef; fb: InterfaceDef; pairs: Pair[] }>();
    for (const p of group) {
      const fa = lift(p.a.owner, p.a.leaf, carriedA);
      const fb = lift(p.b.owner, p.b.leaf, carriedB);
      const k = `${fa.id}|${fb.id}`;
      const entry = functional.get(k) ?? { fa, fb, pairs: [] };
      entry.pairs.push(p);
      functional.set(k, entry);
    }
    for (const { fa, fb, pairs: wires } of functional.values()) {
      const { a: ta, b: tb } = wires[0];
      const a = endpointFor(def, ta.ownerPath, ta.owner, fa, lookup);
      const b = endpointFor(def, tb.ownerPath, tb.owner, fb, lookup);
      const via = [...new Set(wires.flatMap((w) => [...w.links]))].sort();
      const harnesses = [...new Set(wires.flatMap((w) => [...w.harnesses]))].sort();
      const link: InterfaceLink = {
        id: `${via.join("+")}~${fa.id}~${fb.id}`,
        name: `${fa.name ?? fa.id} ↔ ${fb.name ?? fb.id}`,
        a: targetFor(a),
        b: targetFor(b),
        ...(harnesses.length ? { harness: harnesses[0] } : {}),
      };
      const result = validateResolved(link, a, b);
      const wired: LinkChildResult[] = wires
        .filter((w) => w.a.leaf.id !== fa.id || w.b.leaf.id !== fb.id)
        .map((w) => ({
          a: { slotId: slotOf(fa, w.a.leaf.id), leafId: w.a.leaf.id, pin: pinOf(w.a.leaf) },
          b: { slotId: slotOf(fb, w.b.leaf.id), leafId: w.b.leaf.id, pin: pinOf(w.b.leaf) },
          method: "wired",
          locked: false,
        }));
      const problems = wiringProblems(result, wired);
      out.push({
        ...result,
        state: problems.length ? "incompatible" : result.state,
        children: wired.length ? wired : result.children,
        diagnostics: [...problems, ...result.diagnostics],
        derived: { via, harnesses },
      });
    }
  }
  return out;
}

const pinOf = (leaf: InterfaceDef) => (leaf.pin === undefined ? undefined : String(leaf.pin));

function slotOf(composite: InterfaceDef, leafId: string): string | undefined {
  return Object.entries(slotBindings(composite)).find(([, id]) => id === leafId)?.[0];
}

/** Conductors inside a composite must land where the protocol pairing expects. */
function wiringProblems(result: LinkResult, wired: LinkChildResult[]): Diagnostic[] {
  if (result.state === "incompatible") return [];
  const expected = new Map(result.children.filter((c) => c.method === "protocol").map((c) => [c.a.leafId, c.b.leafId]));
  const out: Diagnostic[] = [];
  for (const w of wired) {
    const want = expected.get(w.a.leafId);
    if (want && want !== w.b.leafId) {
      out.push({
        severity: "error",
        code: "harness_wiring",
        message: `${w.a.leafId} is wired to ${w.b.leafId}, but ${result.protocol} pairs it with ${want}`,
        refs: [result.a.path, result.b.path],
      });
    }
  }
  return out;
}

/** Stored links plus the links derived from them. */
export function systemLinks(def: ModuleDef, lookup: ModuleLookup): LinkResult[] {
  const stored = validateLinks(def, lookup);
  return [...stored, ...deriveLinks(def, lookup, stored)];
}
