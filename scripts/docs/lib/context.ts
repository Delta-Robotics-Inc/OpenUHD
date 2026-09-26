/**
 * Build the document context for a system: model, assembly, checks, wiring
 * (including sub-assemblies), scenarios, BOM, test data and the resolver.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { ModuleDef } from "../../../src/types/index.js";
import { checkSystem } from "../../../src/system/checks.js";
import { wiringChecklist, type WiringStep } from "../../../src/system/wiring.js";
import { buildBom } from "../../bom.js";
import { buildScene, loadSystem } from "./model.js";
import { loadTestData } from "./testdata.js";
import { DERIVED } from "./derived.js";
import { instanceMap, makeResolver, type DocContext } from "./values.js";

export interface BuiltContext extends DocContext {
  testErrors: string[];
  /** generated/bom.json as committed (what documents publish). */
  generatedBom?: any[];
  /** buildBom() from the live model, to detect a stale generated BOM. */
  liveBom: any[];
}

/** Wiring for the system and every sub-assembly that declares links (ids prefixed with the instance path). */
export function fullWiring(system: ModuleDef, lookup: (id: string) => ModuleDef | undefined): WiringStep[] {
  const out: WiringStep[] = [...wiringChecklist(system, lookup)];
  const visit = (d: ModuleDef, prefix: string[]) => {
    for (const c of d.children ?? []) {
      const def = lookup(c.moduleDefId);
      if (!def || def.kind === "harness") continue;
      const path = [...prefix, c.id];
      if (def.links?.length) {
        for (const s of wiringChecklist(def, lookup)) {
          if (s.domain === "mechanical") continue;
          const p = path.join("/");
          out.push({
            ...s,
            linkId: `${p}/${s.linkId}`,
            a: `${p}/${s.a}`,
            b: `${p}/${s.b}`,
            harness: s.harness ? `${p}/${s.harness}` : undefined,
            connections: s.connections.map((c2) => ({ ...c2, from: `${p}/${c2.from}`, to: `${p}/${c2.to}` })),
          });
        }
      }
      visit(def, path);
    }
  };
  visit(system, []);
  return out;
}

export async function buildContext(systemDir: string): Promise<BuiltContext> {
  const sys = await loadSystem(systemDir);
  const scene = buildScene(sys);
  const checks = checkSystem(sys.system, sys.lookup);
  const wiring = fullWiring(sys.system, sys.lookup);
  const scenarioChecks = sys.scenarios.map((s) => ({ id: s.id, label: s.label, description: s.description, diagnostics: checkSystem(s.system, s.lookup).diagnostics }));
  const { tests, errors } = loadTestData(sys.absDir, sys.dir);
  const genPath = join(sys.absDir, "generated", "bom.json");
  const generatedBom = existsSync(genPath) ? JSON.parse(readFileSync(genPath, "utf8")) : undefined;
  const liveBom = buildBom(sys.system, sys.lookup);
  const partial = {
    sys,
    scene,
    bom: generatedBom ?? liveBom,
    checks,
    wiring,
    scenarioChecks,
    tests,
    derived: { ...DERIVED },
    instances: instanceMap(sys.system, sys.lookup),
    testErrors: errors,
    generatedBom,
    liveBom,
  };
  makeResolver(partial as any);
  return partial as unknown as BuiltContext;
}
