/**
 * Tools a build needs, derived from the fasteners in the model
 * rather than listed by hand:
 *
 *   socket head cap screws  hex key sized by the screw's own stated socket
 *                           (metadata.hex_socket_mm), else by the ISO 4762
 *                           socket size s for its thread diameter
 *   nuts                    nut driver sized by the nut's stated across-flats
 *                           (metadata.across_flats_s_mm.max or outer_mm)
 *   hex standoffs           spanner of the standoff's across-flats, to hold it
 *                           while the screw is tightened
 */
import type { ModuleDef } from "../types/module.js";
import type { ModuleLookup } from "./index.js";

/**
 * ISO 4762 / DIN 912 hexagon socket size s (mm) by nominal thread diameter,
 * from Westfield Fasteners' socket head cap screw specification table.
 */
export const ISO_4762_SOCKET_MM: Readonly<Record<string, number>> = {
  "1.6": 1.5,
  "2": 1.5,
  "2.5": 2,
  "3": 2.5,
  "3.5": 2.5,
  "4": 3,
  "5": 4,
  "6": 5,
  "8": 6,
  "10": 8,
  "12": 10,
};
export const ISO_4762_SOCKET_SOURCE = "https://www.westfieldfasteners.co.uk/Datasheets/ScrewBolt_SHCap_M.pdf";

export type ToolKind = "hex_key" | "nut_driver" | "spanner";

export interface ToolNeed {
  kind: ToolKind;
  sizeMm: number;
  /** Module ids of the parts that need it. */
  parts: string[];
  /** "part": the part states the size; "standard": looked up from the standard's table. */
  basis: "part" | "standard";
  source?: string;
  /** Why the tool is needed ("drives", "holds"). */
  use: "drive" | "hold";
}

const meta = (def: ModuleDef) => (def.domains?.find((d) => d.domain === "mechanical")?.metadata ?? {}) as Record<string, any>;

function threadDiameter(def: ModuleDef): number | undefined {
  for (const i of def.interfaces) {
    const p = i.parameters?.find((x) => x.id === "fastener_diameter");
    if (p?.value !== undefined) return p.value;
  }
  const tag = def.tags?.find((t) => /^m\d+(\.\d+)?$/.test(t));
  return tag ? Number(tag.slice(1)) : undefined;
}

const firstSource = (s: unknown) => (typeof s === "string" ? s : Array.isArray(s) && typeof s[0] === "string" ? s[0] : undefined);

/** The tool one fastener part needs, or undefined for parts no tool turns (spacers). */
export function toolFor(def: ModuleDef): ToolNeed | undefined {
  const tags = new Set(def.tags ?? []);
  const m = meta(def);
  if (tags.has("screw") && (tags.has("iso-4762") || /4762|912/.test(String(m.standard ?? "")))) {
    if (typeof m.hex_socket_mm === "number") return { kind: "hex_key", sizeMm: m.hex_socket_mm, parts: [def.id], basis: "part", source: firstSource(m.source), use: "drive" };
    const d = threadDiameter(def);
    const s = d !== undefined ? ISO_4762_SOCKET_MM[String(d)] : undefined;
    return s !== undefined ? { kind: "hex_key", sizeMm: s, parts: [def.id], basis: "standard", source: ISO_4762_SOCKET_SOURCE, use: "drive" } : undefined;
  }
  const af = typeof m.across_flats_s_mm === "object" ? m.across_flats_s_mm?.max : m.across_flats_s_mm ?? m.outer_mm;
  if (typeof af !== "number") return undefined;
  if (tags.has("nut")) return { kind: "nut_driver", sizeMm: af, parts: [def.id], basis: "part", source: firstSource(m.source), use: "drive" };
  if (tags.has("standoff")) return { kind: "spanner", sizeMm: af, parts: [def.id], basis: "part", source: firstSource(m.source), use: "hold" };
  return undefined;
}

/** Every fastener module under a system (any depth, harness children included). */
export function fastenerDefs(system: ModuleDef, lookup: ModuleLookup): ModuleDef[] {
  const out = new Map<string, ModuleDef>();
  const visit = (d: ModuleDef) => {
    for (const c of d.children ?? []) {
      const def = lookup(c.moduleDefId);
      if (!def) continue;
      if (def.tags?.includes("fastener")) out.set(def.id, def);
      visit(def);
    }
  };
  visit(system);
  return [...out.values()];
}

/** The tools a set of parts needs, merged by kind and size (smallest first). */
export function toolsFor(defs: ModuleDef[]): ToolNeed[] {
  const byKey = new Map<string, ToolNeed>();
  for (const def of defs) {
    const t = toolFor(def);
    if (!t) continue;
    const key = `${t.kind}:${t.sizeMm}`;
    const ex = byKey.get(key);
    if (ex) ex.parts = [...new Set([...ex.parts, ...t.parts])];
    else byKey.set(key, t);
  }
  const order: ToolKind[] = ["hex_key", "nut_driver", "spanner"];
  return [...byKey.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.sizeMm - b.sizeMm);
}

/** Tools for a whole system's fasteners. */
export function systemTools(system: ModuleDef, lookup: ModuleLookup): ToolNeed[] {
  return toolsFor(fastenerDefs(system, lookup));
}

/** "2.5 mm hex key", "5.5 mm nut driver". */
export function toolLabel(t: ToolNeed): string {
  const name = { hex_key: "hex key", nut_driver: "nut driver", spanner: "spanner" }[t.kind];
  return `${t.sizeMm} mm ${name}`;
}
