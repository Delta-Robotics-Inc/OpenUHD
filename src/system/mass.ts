/**
 * System mass: every instance's mass summed by quantity, with the
 * instances that have none listed instead of guessed.
 *
 * A module's own mass is, in order:
 *   stated      domains[mechanical].weight_g (a source's figure)
 *   cad_volume  CAD body volume × domains[mechanical].material.density_g_cm3
 * A module with neither but with children is the sum of its children; a
 * leaf with neither is reported as missing.
 *
 * CAD volume is supplied by the caller (it reads it from the generator
 * manifest), so this module does no file I/O.
 */
import type { MaterialSpec } from "../types/domain.js";
import type { ModuleDef } from "../types/module.js";
import type { ModuleLookup } from "./index.js";

/** Solid volume of a module's CAD body in mm³, if it has one. */
export type CadVolume = (def: ModuleDef) => number | undefined;

export interface ModuleMass {
  massG: number;
  basis: "stated" | "cad_volume";
  volumeMm3?: number;
  material?: MaterialSpec;
  /** True when any input is an assumption (material.assumption). */
  assumed: boolean;
}

const mech = (def: ModuleDef) => def.domains?.find((d) => d.domain === "mechanical");

/** A module's own mass, or undefined if it states none and cannot compute one. */
export function moduleMass(def: ModuleDef, cadVolume?: CadVolume): ModuleMass | undefined {
  const m = mech(def);
  if (m?.weight_g !== undefined) return { massG: m.weight_g, basis: "stated", assumed: false };
  const material = m?.material;
  const volume = material && cadVolume ? cadVolume(def) : undefined;
  if (material && volume !== undefined) {
    return { massG: (volume / 1000) * material.density_g_cm3, basis: "cad_volume", volumeMm3: volume, material, assumed: Boolean(material.assumption) };
  }
  return undefined;
}

export interface MassEntry {
  /** Instance path below the root. */
  path: string;
  def: ModuleDef;
  /** Units represented, multiplied through parent quantities. */
  quantity: number;
  mass?: ModuleMass;
  /** quantity × unit mass. */
  totalG?: number;
}

export interface SystemMass {
  /** Sum over entries with a mass (g). */
  totalG: number;
  /** Leaf entries (or modules with their own mass), in tree order. */
  entries: MassEntry[];
  /** Entries with no mass: the total leaves them out. */
  missing: MassEntry[];
  /** Mass whose basis is an assumption (g). */
  assumedG: number;
}

export function systemMass(system: ModuleDef, lookup: ModuleLookup, cadVolume?: CadVolume): SystemMass {
  const entries: MassEntry[] = [];
  const visit = (d: ModuleDef, prefix: string[], mult: number) => {
    for (const c of d.children ?? []) {
      const def = lookup(c.moduleDefId);
      if (!def) continue;
      const path = [...prefix, c.id];
      const quantity = mult * (c.quantity ?? 1);
      const mass = moduleMass(def, cadVolume);
      if (!mass && def.children?.length) {
        visit(def, path, quantity);
        continue;
      }
      entries.push({ path: path.join("/"), def, quantity, mass, totalG: mass ? quantity * mass.massG : undefined });
    }
  };
  visit(system, [], 1);
  const known = entries.filter((e) => e.totalG !== undefined);
  return {
    totalG: known.reduce((s, e) => s + e.totalG!, 0),
    entries,
    missing: entries.filter((e) => e.totalG === undefined),
    assumedG: known.filter((e) => e.mass!.assumed).reduce((s, e) => s + e.totalG!, 0),
  };
}

/** Entries grouped by module definition: quantity and mass per definition. */
export function massByDefinition(m: SystemMass): { def: ModuleDef; quantity: number; mass?: ModuleMass; totalG?: number; paths: string[] }[] {
  const out = new Map<string, { def: ModuleDef; quantity: number; mass?: ModuleMass; totalG?: number; paths: string[] }>();
  for (const e of m.entries) {
    const g = out.get(e.def.id) ?? { def: e.def, quantity: 0, mass: e.mass, totalG: e.mass ? 0 : undefined, paths: [] };
    g.quantity += e.quantity;
    if (g.totalG !== undefined && e.totalG !== undefined) g.totalG += e.totalG;
    g.paths.push(e.path);
    out.set(e.def.id, g);
  }
  return [...out.values()];
}
