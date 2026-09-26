/**
 * Value queries: every number or fact a document shows is a query string,
 * resolved against the live UHD model at build time and again at verify
 * time. Nothing is typed into a document by hand.
 *
 *   def:<moduleId>:<path>     a field of a module definition
 *       def:dolphinrc-f405-v3-flight-controller:interfaces[id=bec_5v].parameters[id=voltage].value
 *       def:cnhl-black-series-1100mah-6s-100c:domains[domain=mechanical].weight_g
 *   inst:<instance path>:<path>   the same, addressed by instance (stack/fc, arm_fl/motor)
 *   sys:<path>                system-level results: checks, bom, assembly, wiring, scenarios
 *       sys:checks.diagnostics[rule=propulsion_current].details.totalPeak
 *   derived:<name>            a named derivation (derived.ts) with its inputs listed
 *   derived:<name>(a,b)       a parameterised derivation, e.g. derived:frameDistance(frame.motor_mount_fl,frame.motor_mount_fr)
 *   ver:<partId>:<path>       the part's committed verification record (verification.json)
 *   test:<test-id>:<path>     a test-data file (docs/test-data/<test-id>.json); rows[i][j] takes columns[j].unit
 *
 * Paths: `.key`, `[n]`, `[key=value]` (first match), `.length`.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { ModuleDef } from "../../../src/types/index.js";
import { bodyKey } from "../../../src/system/geometry.js";
import type { SystemCheckResult } from "../../../src/system/checks.js";
import type { WiringStep } from "../../../src/system/wiring.js";
import { REPO_ROOT } from "./render/server.js";
import type { LoadedSystem, SceneModel } from "./model.js";
import { unitFromKey } from "./format.js";
import type { TestData } from "./testdata.js";

export type ValueStatus = "source" | "model" | "assumption" | "derived" | "standin" | "measured" | "gap";

export interface ResolvedValue {
  q: string;
  value: unknown;
  unit?: string;
  status: ValueStatus;
  /** URL or repo path the value is cited from. */
  source?: string;
  note?: string;
  /** For derived values: the input queries. */
  inputs?: string[];
  formula?: string;
}

export interface DerivedDef {
  label: string;
  unit?: string;
  formula: string;
  compute: (ctx: DocContext, args?: string[]) => { value: unknown; inputs: string[]; note?: string; unit?: string };
}

export interface DocContext {
  sys: LoadedSystem;
  scene: SceneModel;
  bom: any[];
  checks: SystemCheckResult;
  wiring: WiringStep[];
  scenarioChecks: { id: string; label: string; description: string; diagnostics: SystemCheckResult["diagnostics"] }[];
  tests: Map<string, TestData>;
  derived: Record<string, DerivedDef>;
  /** Instance path -> module definition (leaf and assembly instances). */
  instances: Map<string, ModuleDef>;
  /** A value lookup (resolve). */
  resolve: (q: string) => ResolvedValue;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

type Seg = { key: string } | { index: number } | { match: [string, string] };

export function parsePath(path: string): Seg[] {
  const segs: Seg[] = [];
  let i = 0;
  while (i < path.length) {
    const c = path[i];
    if (c === ".") {
      i++;
      continue;
    }
    if (c === "[") {
      const end = path.indexOf("]", i);
      if (end < 0) throw new Error(`unclosed [ in ${path}`);
      const body = path.slice(i + 1, end);
      const eq = body.indexOf("=");
      if (eq >= 0) segs.push({ match: [body.slice(0, eq), body.slice(eq + 1)] });
      else segs.push({ index: Number(body) });
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < path.length && path[j] !== "." && path[j] !== "[") j++;
    segs.push({ key: path.slice(i, j) });
    i = j;
  }
  return segs;
}

interface Walk {
  value: unknown;
  parent?: any;
  lastKey?: string;
  sources: string[];
  trail: any[];
}

export function walk(root: unknown, path: string): Walk {
  let cur: any = root;
  let parent: any;
  let lastKey: string | undefined;
  const sources: string[] = [];
  const trail: any[] = [root];
  const noteSource = (o: any) => {
    if (o && typeof o === "object" && !Array.isArray(o)) {
      const s = o.source ?? o.params?.source ?? o.metadata?.source;
      if (typeof s === "string") sources.push(s);
      else if (Array.isArray(s) && typeof s[0] === "string") sources.push(s[0]);
    }
  };
  noteSource(cur);
  for (const seg of parsePath(path)) {
    if (cur === undefined || cur === null) return { value: undefined, parent, lastKey, sources, trail };
    parent = cur;
    if ("key" in seg) {
      if (seg.key === "length" && Array.isArray(cur)) cur = cur.length;
      else cur = cur[seg.key];
      lastKey = seg.key;
    } else if ("index" in seg) cur = cur[seg.index];
    else {
      const [k, v] = seg.match;
      cur = Array.isArray(cur) ? cur.find((x) => String(x?.[k]) === v) : undefined;
      lastKey = v;
    }
    trail.push(cur);
    noteSource(cur);
  }
  return { value: cur, parent, lastKey, sources, trail };
}

// ---------------------------------------------------------------------------
// Evidence per module
// ---------------------------------------------------------------------------

const partDir = (id: string) => join(REPO_ROOT, "library/parts", id);

export function moduleSources(id: string): { id: string; title: string; url: string; authority?: string }[] {
  const p = join(partDir(id), "sources.json");
  if (!existsSync(p)) return [];
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    return Array.isArray(j) ? j : j.sources ?? [];
  } catch {
    return [];
  }
}

export function moduleVerification(id: string): any | undefined {
  const p = join(partDir(id), "verification.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : undefined;
}

function assumptionFor(def: ModuleDef, keys: string[]): string | undefined {
  const lower = keys.filter(Boolean).map((k) => k.toLowerCase());
  for (const t of def.traits ?? []) {
    if (t.type !== "assumption") continue;
    const field = String(t.params?.field ?? "").toLowerCase();
    if (field && lower.some((k) => k === field || field.split(/[ ,/]+/).includes(k))) return String(t.params?.reason ?? t.params?.note ?? field);
  }
  return undefined;
}

function resolveDef(q: string, def: ModuleDef | undefined, path: string): ResolvedValue {
  if (!def) return { q, value: undefined, status: "gap", note: "module not found" };
  const w = walk(def, path);
  // a parameter stated as a range has no `value`: use the range
  if ((w.value === undefined || w.value === null) && w.lastKey === "value" && Array.isArray(w.parent?.range)) w.value = w.parent.range;
  let unit: string | undefined;
  if (w.lastKey === "value" || w.lastKey === "range") unit = w.parent?.unit;
  else if (w.lastKey === "weight_g") unit = "g";
  else if (w.lastKey) unit = unitFromKey(w.lastKey);
  const keys = w.trail.filter((x) => x && typeof x === "object" && !Array.isArray(x) && typeof x.id === "string").map((x) => x.id);
  // an assumption trait, or any trait/spec object carrying its own `assumption` note (supplied_from, torque, material)
  const inAssumptionTrait = w.trail.some((x) => x && typeof x === "object" && (x.type === "assumption" || (typeof x.assumption === "string" && x.assumption) || (typeof x.params?.assumption === "string" && x.params.assumption)));
  const assumption = inAssumptionTrait ? "assumption trait" : assumptionFor(def, [...keys, w.lastKey ?? ""]);
  const srcs = moduleSources(def.id);
  const verified = Boolean(moduleVerification(def.id));
  const source = w.sources.at(-1) ?? srcs[0]?.url ?? (def.artifacts ?? []).find((a) => a.url)?.url;
  let status: ValueStatus = verified || srcs.length ? "source" : "model";
  if (assumption) status = "assumption";
  if (w.value === undefined || w.value === null) status = "gap";
  return { q, value: w.value, unit, status, source: status === "model" ? `model: ${def.id}` : source, note: assumption };
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export function makeResolver(ctx: Omit<DocContext, "resolve">): (q: string) => ResolvedValue {
  const memo = new Map<string, ResolvedValue>();
  const resolve = (q: string): ResolvedValue => {
    if (memo.has(q)) return memo.get(q)!;
    const r = resolveUncached(q);
    memo.set(q, r);
    return r;
  };
  const full = ctx as DocContext;
  full.resolve = resolve;

  const resolveUncached = (q: string): ResolvedValue => {
    const colon = q.indexOf(":");
    const scheme = q.slice(0, colon);
    const rest = q.slice(colon + 1);
    if (scheme === "def" || scheme === "inst") {
      const c = rest.indexOf(":");
      const target = c < 0 ? rest : rest.slice(0, c);
      const path = c < 0 ? "" : rest.slice(c + 1);
      const def = scheme === "def" ? ctx.sys.lookup(target) : ctx.instances.get(target);
      return resolveDef(q, def, path);
    }
    if (scheme === "sys") {
      const root = {
        system: ctx.sys.system,
        checks: ctx.checks,
        bom: ctx.bom,
        wiring: ctx.wiring,
        scenarios: ctx.scenarioChecks,
        assembly: {
          mates: ctx.scene.assembly.mates.length,
          placements: ctx.scene.assembly.placements.length,
          hardware: ctx.scene.assembly.hardware.length,
          issues: ctx.scene.assembly.issues,
        },
      };
      const w = walk(root, rest);
      return { q, value: w.value, unit: w.lastKey ? unitFromKey(w.lastKey) : undefined, status: w.value === undefined ? "gap" : "model", source: `UHD ${rest.split(/[.[]/)[0]}` };
    }
    if (scheme === "derived") {
      const call = rest.match(/^([\w.]+)\((.*)\)$/);
      const d = call ? ctx.derived[call[1]] : ctx.derived[rest];
      if (d && call) {
        const r = d.compute(full, call[2].split(",").map((x) => x.trim()));
        const inputs = r.inputs.map(resolve);
        const status: ValueStatus = inputs.some((i) => i.status === "standin") ? "standin" : r.value === undefined ? "gap" : inputs.some((i) => i.status === "assumption") ? "assumption" : "derived";
        return { q, value: r.value, unit: r.unit ?? d.unit, status, inputs: r.inputs, formula: d.formula, note: r.note };
      }
      if (!d) return { q, value: undefined, status: "gap", note: `no derivation "${rest}"` };
      const r = d.compute(full);
      const inputs = r.inputs.map(resolve);
      const status: ValueStatus = inputs.some((i) => i.status === "standin")
        ? "standin"
        : inputs.some((i) => i.status === "gap") && r.value === undefined
          ? "gap"
          : inputs.some((i) => i.status === "assumption")
            ? "assumption"
            : "derived";
      return { q, value: r.value, unit: r.unit ?? d.unit, status, inputs: r.inputs, formula: d.formula, note: r.note };
    }
    if (scheme === "ver") {
      const c = rest.indexOf(":");
      const id = c < 0 ? rest : rest.slice(0, c);
      const v = moduleVerification(id);
      if (!v) return { q, value: undefined, status: "gap", note: `no verification record for ${id}` };
      const w = walk(v, c < 0 ? "" : rest.slice(c + 1));
      return { q, value: w.value, status: w.value === undefined ? "gap" : "model", source: `library/parts/${id}/verification.json` };
    }
    if (scheme === "test") {
      const c = rest.indexOf(":");
      const id = c < 0 ? rest : rest.slice(0, c);
      const t = ctx.tests.get(id);
      if (!t) return { q, value: undefined, status: "gap", note: `no test data "${id}"` };
      const path = c < 0 ? "" : rest.slice(c + 1);
      const w = walk(t, path);
      const cell = path.match(/^rows\[(\d+)\]\[(\d+)\]$/);
      const unit = cell ? t.columns[Number(cell[2])]?.unit || undefined : w.parent?.unit || (w.lastKey ? unitFromKey(w.lastKey) : undefined);
      return { q, value: w.value, unit, status: t.status === "measured" ? "measured" : "standin", source: t.file };
    }
    throw new Error(`unknown value query scheme in "${q}"`);
  };
  return resolve;
}

/** Instance path -> def for every child at every level (assemblies included). */
export function instanceMap(system: ModuleDef, lookup: (id: string) => ModuleDef | undefined): Map<string, ModuleDef> {
  const out = new Map<string, ModuleDef>();
  const visit = (d: ModuleDef, prefix: string[]) => {
    for (const c of d.children ?? []) {
      const def = lookup(c.moduleDefId);
      if (!def) continue;
      const path = [...prefix, c.id];
      out.set(bodyKey(path), def);
      visit(def, path);
    }
  };
  visit(system, []);
  return out;
}
