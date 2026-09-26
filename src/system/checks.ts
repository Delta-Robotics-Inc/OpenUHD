/**
 * System-level design checks (PB-789): rules that need the whole system,
 * not one link at a time.
 *
 *   link_state          every stored link, from validateLinks
 *   supply_budget       loads on each power output vs its rating (branch
 *                       rails with `supplied_from` count against their parent)
 *   propulsion_current  summed motor peak current vs battery and ESC ratings
 *   bus_address         duplicate I2C addresses on one master
 *   interface_reuse     a non-shareable interface linked more than once
 *   unpowered           a power input with no link
 *   harness_connector   harness end connectors vs the interfaces they mate
 *   prop_handedness     each motor's spin vs the handed prop on it (rotation.ts)
 *
 * Each diagnostic names canonical paths (`child:interface`, `link:<id>`) so
 * a viewer can select what it refers to.
 */
import type { InterfaceDef } from "../types/interface.js";
import type { ModuleDef } from "../types/module.js";
import type { Parameter } from "../types/parameter.js";
import type { SuppliedFromTrait } from "../types/trait.js";
import {
  boundaryInterfaces,
  validateLinks,
  type LinkResult,
  type ModuleLookup,
  type ResolvedEndpoint,
} from "./index.js";
import { propHandednessRule } from "./rotation.js";

export type SystemRule =
  | "link_state"
  | "supply_budget"
  | "propulsion_current"
  | "bus_address"
  | "interface_reuse"
  | "unpowered"
  | "harness_connector"
  | "prop_handedness";

export interface SystemDiagnostic {
  id: string;
  rule: SystemRule;
  severity: "error" | "warning" | "info";
  message: string;
  /** Canonical paths: `child:interface` for interfaces, `link:<id>` for links. */
  refs: string[];
  details?: Record<string, unknown>;
}

export interface SystemCheckResult {
  links: LinkResult[];
  diagnostics: SystemDiagnostic[];
}

// ---------------------------------------------------------------------------
// Parameter helpers
// ---------------------------------------------------------------------------

function param(iface: InterfaceDef, id: string): Parameter | undefined {
  return iface.parameters?.find((p) => p.id === id);
}

/** Nominal value: the value if given, else the lower bound of the range. */
function nominal(p: Parameter | undefined): number | undefined {
  if (!p) return undefined;
  return p.value ?? p.range?.[0];
}

function toAmps(p: Parameter | undefined): number | undefined {
  const v = nominal(p);
  if (v === undefined) return undefined;
  return p!.unit === "mA" ? v / 1000 : v;
}

const hasRole = (iface: InterfaceDef, type: string, role: string) =>
  iface.protocols.some((p) => p.type === type && p.roles.includes(role));

const fmt = (n: number, unit: string) => `${Number(n.toFixed(2))} ${unit}`;

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function linkStateRule(links: LinkResult[]): SystemDiagnostic[] {
  return links
    .filter((r) => r.state !== "configured")
    .map((r) => ({
      id: `link_state:${r.link.id}`,
      rule: "link_state" as const,
      severity: r.state === "incompatible" ? ("error" as const) : ("warning" as const),
      message: `${r.link.name ?? r.link.id}: ${r.state}${r.diagnostics.length ? ` — ${r.diagnostics.map((d) => d.message).join("; ")}` : ""}`,
      refs: [`link:${r.link.id}`, r.a.path, r.b.path],
    }));
}

interface PowerEdge {
  link: LinkResult;
  source: ResolvedEndpoint;
  load: ResolvedEndpoint;
}

function powerEdges(links: LinkResult[]): PowerEdge[] {
  const out: PowerEdge[] = [];
  for (const r of links) {
    if (r.state === "incompatible") continue;
    if (hasRole(r.a.iface, "power", "output") && hasRole(r.b.iface, "power", "input")) out.push({ link: r, source: r.a, load: r.b });
    else if (hasRole(r.b.iface, "power", "output") && hasRole(r.a.iface, "power", "input")) out.push({ link: r, source: r.b, load: r.a });
  }
  return out;
}

/** The `supplied_from` trait of a power output: the sibling output it branches from. */
function suppliedFrom(iface: InterfaceDef): SuppliedFromTrait["params"] | undefined {
  const t = iface.traits?.find((x) => x.type === "supplied_from");
  return t ? (t.params as SuppliedFromTrait["params"]) : undefined;
}

interface SupplyGroup {
  /** Canonical path of the source output (first link that names it), or `owner#iface` if unlinked. */
  path: string;
  owner: ModuleDef;
  iface: InterfaceDef;
  /** Loads linked directly to this output. */
  edges: PowerEdge[];
  /** Branch outputs whose loads this output also carries (supplied_from). */
  branches: SupplyGroup[];
}

function supplyBudgetRule(links: LinkResult[]): SystemDiagnostic[] {
  const groups = new Map<string, SupplyGroup>();
  const keyOf = (owner: ModuleDef, ifaceId: string) => `${owner.id}#${ifaceId}`;
  for (const edge of powerEdges(links)) {
    const key = keyOf(edge.source.owner, edge.source.iface.id);
    const g = groups.get(key) ?? { path: edge.source.path, owner: edge.source.owner, iface: edge.source.iface, edges: [], branches: [] };
    g.edges.push(edge);
    groups.set(key, g);
  }
  // attach branch rails to their parent output (created if nothing links it directly)
  for (const g of [...groups.values()]) {
    const from = suppliedFrom(g.iface);
    if (!from) continue;
    const parentIface = g.owner.interfaces.find((i) => i.id === from.interfaceId);
    if (!parentIface) continue;
    const key = keyOf(g.owner, parentIface.id);
    const parent = groups.get(key) ?? { path: `${g.path.split(":")[0]}:${parentIface.id}`, owner: g.owner, iface: parentIface, edges: [], branches: [] };
    parent.branches.push(g);
    groups.set(key, parent);
  }

  const out: SystemDiagnostic[] = [];
  for (const g of groups.values()) {
    const { path: sourcePath, iface } = g;
    // batteries feed the propulsion rule instead
    if (param(iface, "cell_count")) continue;
    const from = suppliedFrom(iface);
    const allEdges = [...g.edges, ...g.branches.flatMap((b) => b.edges)];
    const refs = [sourcePath, ...allEdges.map((e) => e.load.path), ...allEdges.map((e) => `link:${e.link.link.id}`), ...g.branches.map((b) => b.path)];
    if (from && g.owner.interfaces.some((i) => i.id === from.interfaceId)) {
      const parentPath = `${sourcePath.split(":")[0]}:${from.interfaceId}`;
      out.push({
        id: `supply_budget:${sourcePath}`,
        rule: "supply_budget",
        severity: "info",
        message: `${sourcePath}: branch of ${parentPath}${from.via ? ` via ${from.via}` : ""}; its ${g.edges.length} load(s) are budgeted there${from.assumption ? " (assumed relation, not a cited source)" : ""}.`,
        refs: [sourcePath, parentPath, ...g.edges.map((e) => e.load.path), ...g.edges.map((e) => `link:${e.link.link.id}`)],
        details: { suppliedFrom: parentPath, assumption: from.assumption, source: from.source },
      });
      continue;
    }
    const volts = nominal(param(iface, "voltage"));
    const amps = toAmps(param(iface, "max_current"));
    const unknown: string[] = [];
    let loadW = 0;
    for (const { load, source } of allEdges) {
      // each load draws at its own rail's voltage (a branch rail may sit lower)
      const railV = nominal(param(source.iface, "voltage")) ?? volts;
      const draw = toAmps(param(load.iface, "current_draw"));
      const minW = nominal(param(load.iface, "min_supply_power"));
      if (minW !== undefined) loadW += minW;
      else if (draw !== undefined && railV !== undefined) loadW += draw * railV;
      if (draw === undefined && minW === undefined) unknown.push(load.path);
    }
    const count = allEdges.length;

    if (amps === undefined || volts === undefined) {
      out.push({
        id: `supply_budget:${sourcePath}`,
        rule: "supply_budget",
        severity: "info",
        message: `${sourcePath}: no current rating on the source, so its ${count} load(s) cannot be budgeted.`,
        refs,
      });
      continue;
    }
    const capacityW = volts * amps;
    const ratio = loadW / capacityW;
    const severity = ratio > 1 ? "error" : ratio > 0.8 ? "warning" : "info";
    const via = g.branches.length ? ` (including ${g.branches.map((b) => b.path).join(", ")})` : "";
    out.push({
      id: `supply_budget:${sourcePath}`,
      rule: "supply_budget",
      severity,
      message:
        `${sourcePath}${via}: known loads need ${fmt(loadW, "W")} of ${fmt(capacityW, "W")} (${fmt(volts, "V")} × ${fmt(amps, "A")}, ${Math.round(ratio * 100)}%)` +
        (unknown.length ? `; ${unknown.length} load(s) state no draw: ${unknown.join(", ")}` : "") +
        ".",
      refs,
      details: { capacityW, loadW: Number(loadW.toFixed(4)), unknownLoads: unknown, branches: g.branches.map((b) => b.path) },
    });
  }
  return out;
}

function propulsionRule(links: LinkResult[]): SystemDiagnostic[] {
  const phaseLinks = links.filter((r) => r.protocol === "bldc_3phase" && r.state !== "incompatible");
  if (!phaseLinks.length) return [];
  const out: SystemDiagnostic[] = [];
  let totalPeak = 0;

  for (const r of phaseLinks) {
    const [escEnd, motorEnd] = hasRole(r.a.iface, "bldc_3phase", "output") ? [r.a, r.b] : [r.b, r.a];
    const motorPeak = toAmps(param(motorEnd.iface, "burst_current")) ?? toAmps(param(motorEnd.iface, "max_current"));
    const escCont = toAmps(param(escEnd.iface, "max_current"));
    const escBurst = toAmps(param(escEnd.iface, "burst_current")) ?? escCont;
    if (motorPeak === undefined) continue;
    totalPeak += motorPeak;
    if (escBurst !== undefined && motorPeak > escBurst) {
      out.push({
        id: `propulsion_current:${r.link.id}`,
        rule: "propulsion_current",
        severity: "error",
        message: `${r.link.name ?? r.link.id}: motor peak ${fmt(motorPeak, "A")} exceeds the ESC channel burst rating ${fmt(escBurst, "A")}.`,
        refs: [`link:${r.link.id}`, escEnd.path, motorEnd.path],
      });
    } else if (escCont !== undefined && motorPeak > escCont) {
      out.push({
        id: `propulsion_current:${r.link.id}`,
        rule: "propulsion_current",
        severity: "warning",
        message: `${r.link.name ?? r.link.id}: motor peak ${fmt(motorPeak, "A")} exceeds the ESC channel continuous rating ${fmt(escCont, "A")} (within burst ${fmt(escBurst ?? escCont, "A")}).`,
        refs: [`link:${r.link.id}`, escEnd.path, motorEnd.path],
      });
    }
  }

  const batteries = new Map<string, PowerEdge>();
  for (const e of powerEdges(links)) {
    if (param(e.source.iface, "cell_count") && !batteries.has(e.source.path)) batteries.set(e.source.path, e);
  }
  for (const { source, link } of batteries.values()) {
    const cont = toAmps(param(source.iface, "max_current"));
    const burst = toAmps(param(source.iface, "burst_current"));
    const refs = [source.path, `link:${link.link.id}`, ...phaseLinks.map((r) => `link:${r.link.id}`)];
    const base = `${phaseLinks.length} motors can peak at ${fmt(totalPeak, "A")} together`;
    if (burst !== undefined && totalPeak > burst) {
      out.push({ id: `propulsion_current:${source.path}`, rule: "propulsion_current", severity: "error", message: `${base}, above the battery burst rating ${fmt(burst, "A")}.`, refs, details: { totalPeak, cont, burst } });
    } else if (cont !== undefined && totalPeak > cont) {
      out.push({
        id: `propulsion_current:${source.path}`,
        rule: "propulsion_current",
        severity: "warning",
        message: `${base}, above the battery continuous rating ${fmt(cont, "A")} but within its burst rating${burst !== undefined ? ` ${fmt(burst, "A")}` : ""}. Sustained full throttle will exceed the pack rating.`,
        refs,
        details: { totalPeak, cont, burst },
      });
    } else {
      out.push({ id: `propulsion_current:${source.path}`, rule: "propulsion_current", severity: "info", message: `${base}, within the battery continuous rating${cont !== undefined ? ` ${fmt(cont, "A")}` : ""}.`, refs, details: { totalPeak, cont, burst } });
    }
  }
  return out;
}

function busAddressRule(links: LinkResult[]): SystemDiagnostic[] {
  const byMaster = new Map<string, { address: number; path: string; link: string }[]>();
  for (const r of links) {
    if (r.protocol !== "i2c" || r.state === "incompatible") continue;
    const [master, slave] = hasRole(r.a.iface, "i2c", "master") ? [r.a, r.b] : [r.b, r.a];
    const address = nominal(param(slave.iface, "i2c_address"));
    if (address === undefined) continue;
    byMaster.set(master.path, [...(byMaster.get(master.path) ?? []), { address, path: slave.path, link: r.link.id }]);
  }
  const out: SystemDiagnostic[] = [];
  for (const [masterPath, slaves] of byMaster) {
    const seen = new Map<number, typeof slaves>();
    for (const s of slaves) seen.set(s.address, [...(seen.get(s.address) ?? []), s]);
    for (const [address, same] of seen) {
      if (same.length < 2) continue;
      out.push({
        id: `bus_address:${masterPath}:${address}`,
        rule: "bus_address",
        severity: "error",
        message: `${masterPath}: ${same.length} devices share I2C address 0x${address.toString(16).padStart(2, "0").toUpperCase()} (${same.map((s) => s.path).join(", ")}).`,
        refs: [masterPath, ...same.map((s) => s.path), ...same.map((s) => `link:${s.link}`)],
      });
    }
  }
  return out;
}

/** Nets and structures that legitimately take many links. */
function shareable(iface: InterfaceDef): boolean {
  return (
    iface.protocols.some((p) => p.type === "power") ||
    hasRole(iface, "bolt_pattern", "structure") ||
    hasRole(iface, "i2c", "master") ||
    hasRole(iface, "spi", "master")
  );
}

function reuseRule(links: LinkResult[]): SystemDiagnostic[] {
  const uses = new Map<string, { end: ResolvedEndpoint; links: string[] }>();
  for (const r of links) {
    for (const end of [r.a, r.b]) {
      const entry = uses.get(end.path) ?? { end, links: [] };
      entry.links.push(r.link.id);
      uses.set(end.path, entry);
    }
  }
  const out: SystemDiagnostic[] = [];
  for (const [path, { end, links: ids }] of uses) {
    if (shareable(end.iface)) continue;
    const limit = end.iface.max_instances ?? 1;
    if (ids.length <= limit) continue;
    out.push({
      id: `interface_reuse:${path}`,
      rule: "interface_reuse",
      severity: "error",
      message: `${path} is linked ${ids.length} times (${ids.join(", ")}) but supports ${limit}.`,
      refs: [path, ...ids.map((id) => `link:${id}`)],
    });
  }
  return out;
}

function unpoweredRule(def: ModuleDef, links: LinkResult[], lookup: ModuleLookup): SystemDiagnostic[] {
  const linked = new Set(links.flatMap((r) => [r.a.path, r.b.path]));
  const out: SystemDiagnostic[] = [];
  for (const ref of def.children ?? []) {
    const child = lookup(ref.moduleDefId);
    if (!child || child.kind === "harness") continue;
    for (const iface of boundaryInterfaces(child, lookup)) {
      if (!hasRole(iface, "power", "input")) continue;
      const path = `${ref.id}:${iface.id}`;
      if (linked.has(path)) continue;
      out.push({
        id: `unpowered:${path}`,
        rule: "unpowered",
        severity: "warning",
        message: `${path} (${iface.name ?? iface.id}) has no supply link.`,
        refs: [path],
      });
    }
  }
  return out;
}

function connectorTypes(iface: InterfaceDef): string[] {
  return (iface.traits ?? [])
    .filter((t) => t.type === "connector")
    .map((t) => String((t.params as Record<string, unknown> | undefined)?.connector_type ?? ""))
    .filter(Boolean);
}

/**
 * For links carried by a harness module: each harness end that declares a
 * connector must match a connector declared on the interface it mates.
 * Harness ends are matched to link ends by `mates` in the harness
 * interface's connector trait (`{ mates: "a" | "b" }`), or by position.
 */
function harnessConnectorRule(def: ModuleDef, links: LinkResult[], lookup: ModuleLookup): SystemDiagnostic[] {
  const out: SystemDiagnostic[] = [];
  for (const r of links) {
    const harnessId = r.link.harness;
    if (!harnessId) continue;
    const ref = def.children?.find((c) => c.id === harnessId);
    const harness = ref ? lookup(ref.moduleDefId) : undefined;
    if (!harness) {
      out.push({
        id: `harness_connector:${r.link.id}`,
        rule: "harness_connector",
        severity: "error",
        message: `${r.link.name ?? r.link.id} names harness "${harnessId}", which is not a child of ${def.id}.`,
        refs: [`link:${r.link.id}`],
      });
      continue;
    }
    for (const hIface of harness.interfaces) {
      const hTypes = connectorTypes(hIface);
      if (!hTypes.length) continue;
      const mates = (hIface.traits ?? []).find((t) => t.type === "connector")?.params as Record<string, unknown> | undefined;
      const side = mates?.mates === "b" ? r.b : mates?.mates === "a" ? r.a : undefined;
      if (!side) continue;
      const sideTypes = connectorTypes(side.iface);
      if (!sideTypes.length) continue;
      if (!hTypes.some((t) => sideTypes.includes(t))) {
        out.push({
          id: `harness_connector:${r.link.id}:${hIface.id}`,
          rule: "harness_connector",
          severity: "error",
          message: `${harnessId}.${hIface.id} is ${hTypes.join("/")} but ${side.path} is ${sideTypes.join("/")}.`,
          refs: [`link:${r.link.id}`, `${harnessId}:${hIface.id}`, side.path],
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

/** Run every system rule over a module's stored links. */
export function checkSystem(def: ModuleDef, lookup: ModuleLookup): SystemCheckResult {
  const links = validateLinks(def, lookup);
  const diagnostics = [
    ...linkStateRule(links),
    ...supplyBudgetRule(links),
    ...propulsionRule(links),
    ...busAddressRule(links),
    ...reuseRule(links),
    ...unpoweredRule(def, links, lookup),
    ...harnessConnectorRule(def, links, lookup),
    ...propHandednessRule(def, lookup),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { links, diagnostics };
}

