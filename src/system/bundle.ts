/**
 * Reading a UHD bundle: the root and a lookup, optionally for a scenario.
 */
import type { UhdBundle } from "../types/bundle.js";
import type { ModuleDef } from "../types/module.js";
import type { ModuleLookup } from "./index.js";

export function bundleSystem(bundle: UhdBundle, scenarioId?: string): { root: ModuleDef; lookup: ModuleLookup } {
  const byId = new Map(bundle.definitions.map((d) => [d.id, d]));
  const scenario = scenarioId ? bundle.scenarios?.find((s) => s.id === scenarioId) : undefined;
  for (const d of scenario?.definitions ?? []) byId.set(d.id, d);
  const root = scenario?.root ?? byId.get(bundle.root);
  if (!root) throw new Error(`bundle root "${bundle.root}" is not among its definitions`);
  return { root, lookup: (id) => byId.get(id) };
}

/** Definitions reachable from a root (children and harness children, recursively). */
export function reachableDefinitions(root: ModuleDef, lookup: ModuleLookup): ModuleDef[] {
  const out = new Map<string, ModuleDef>([[root.id, root]]);
  const walk = (d: ModuleDef) => {
    for (const c of d.children ?? []) {
      const child = lookup(c.moduleDefId);
      if (child && !out.has(child.id)) {
        out.set(child.id, child);
        walk(child);
      }
    }
  };
  walk(root);
  return [...out.values()];
}
