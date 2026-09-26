/**
 * Loading a UHD system for documentation, and turning its assembly into
 * renderable bodies. Everything here is read from the model at run time:
 * `assemble()` placements and hardware, artifacts, manifests.
 */
import { existsSync, readFileSync } from "fs";
import { join, relative, resolve } from "path";
import { pathToFileURL } from "url";
import type { ArtifactDef, GeometryFrame, ModuleDef } from "../../../src/types/index.js";
import type { ModuleLookup } from "../../../src/system/index.js";
import { applyMat4, assemble, bodyKey, multiplyMat4, type Assembly, type Mat4 } from "../../../src/system/geometry.js";
import { REPO_ROOT } from "./render/server.js";
import type { DocConfig } from "./types.js";

export interface LoadedSystem {
  /** Repo-relative system directory, e.g. library/systems/quadcopter-5in. */
  dir: string;
  absDir: string;
  system: ModuleDef;
  lookup: ModuleLookup;
  scenarios: { id: string; label: string; description: string; system: ModuleDef; lookup: ModuleLookup }[];
  config: DocConfig;
}

/** Import `<dir>/index.ts` (SYSTEM + lookup), optional `scenarios.ts`, and `<dir>/docs/docspec.ts`. */
export async function loadSystem(dirArg: string): Promise<LoadedSystem> {
  const absDir = resolve(REPO_ROOT, dirArg);
  const dir = relative(REPO_ROOT, absDir);
  const mod = await import(pathToFileURL(join(absDir, "index.ts")).href);
  if (!mod.SYSTEM || !mod.lookup) throw new Error(`${dir}/index.ts must export SYSTEM and lookup`);
  let scenarios: LoadedSystem["scenarios"] = [];
  if (existsSync(join(absDir, "scenarios.ts"))) {
    const s = await import(pathToFileURL(join(absDir, "scenarios.ts")).href);
    scenarios = s.SCENARIOS ?? [];
  }
  let config: DocConfig = {};
  const spec = join(absDir, "docs", "docspec.ts");
  if (existsSync(spec)) config = (await import(pathToFileURL(spec).href)).default ?? {};
  return { dir, absDir, system: mod.SYSTEM, lookup: mod.lookup, scenarios, config };
}

// ---------------------------------------------------------------------------
// Classification (drawing palette only; never shown as data)
// ---------------------------------------------------------------------------

export function category(def: ModuleDef): string {
  const id = def.id;
  const tags = new Set(def.tags ?? []);
  const cats = (def.categories ?? []).join(" ");
  if (tags.has("screw")) return "screw";
  if (tags.has("nut")) return "nut";
  if (tags.has("standoff")) return "standoff";
  if (tags.has("spacer")) return "spacer";
  if (id.includes("top-plate")) return "top_plate";
  if (tags.has("frame") || cats.includes("structure") && id.includes("frame")) return "frame";
  if (cats.includes("motor")) return "motor";
  if (cats.includes("propeller") || tags.has("propeller")) return "prop";
  if (cats.includes("esc")) return "esc";
  if (cats.includes("flight_controller")) return "fc";
  if (cats.includes("video")) return "video";
  if (cats.includes("battery")) return "battery";
  if (cats.includes("gnss")) return "gnss";
  if (cats.includes("receiver")) return "receiver";
  if (cats.includes("capacitor")) return "capacitor";
  return "generic";
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

/** Body GLB for a module (or for one of its bodies, by the STEP/vendor artifact id). */
export function glbFor(def: ModuleDef, bodyArtifact?: string): ArtifactDef | undefined {
  const arts = def.artifacts ?? [];
  if (bodyArtifact) return arts.find((a) => a.format === "glb" && (a.id === bodyArtifact || a.provenance?.generatedFrom === bodyArtifact));
  return arts.find((a) => a.role === "body" && a.format === "glb");
}

/** Feature names in the manifest of the STEP a GLB was generated from (sub-shapes to hide or call out). */
export function featureNames(def: ModuleDef, glb?: ArtifactDef): string[] {
  const src = glb?.provenance?.generatedFrom;
  const manifest = (def.artifacts ?? []).find((a) => a.format === "json" && a.provenance?.generatedFrom === src && a.filePath);
  if (!manifest?.filePath) return [];
  const p = join(REPO_ROOT, manifest.filePath);
  if (!existsSync(p)) return [];
  try {
    return Object.keys(JSON.parse(readFileSync(p, "utf8")).features ?? {});
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Scene bodies from the assembly
// ---------------------------------------------------------------------------

export interface SceneBody {
  key: string;
  path: string[];
  def: ModuleDef;
  glb?: string;
  matrix: Mat4;
  category: string;
  features: string[];
  vendor: boolean;
  /** Link that placed it; "hint:<note>" for doc-config placements. */
  via?: string;
  /** Hardware only. */
  harness?: string;
  child?: string;
  linkId?: string;
}

export interface SceneModel {
  assembly: Assembly;
  bodies: SceneBody[];
  hardware: SceneBody[];
  byKey: Map<string, SceneBody>;
}

export function buildScene(sys: LoadedSystem): SceneModel {
  const fixed: Record<string, Mat4> = {};
  for (const h of sys.config.placementHints ?? []) fixed[bodyKey(h.path)] = h.matrix;
  const assembly = assemble(sys.system, sys.lookup, { root: sys.config.root ?? [], fixed });
  const defs = new Map(assembly.instances.map((i) => [bodyKey(i.path), i.def]));
  const bodies: SceneBody[] = [];
  for (const p of assembly.placements) {
    const def = defs.get(bodyKey(p.path));
    if (!def) continue;
    const glb = glbFor(def, p.body);
    const hint = (sys.config.placementHints ?? []).find((h) => bodyKey(h.path) === p.key);
    bodies.push({
      key: p.key,
      path: p.path,
      def,
      glb: glb?.filePath,
      matrix: p.matrix,
      category: category(def),
      features: featureNames(def, glb),
      vendor: Boolean(glb?.id.startsWith("cad_vendor")),
      via: p.via ?? (hint ? `hint:${hint.note}` : undefined),
    });
  }
  const counters = new Map<string, number>();
  const hardware: SceneBody[] = assembly.hardware.map((h) => {
    const base = `${h.harness}/${h.child}`;
    const n = (counters.get(base) ?? 0) + 1;
    counters.set(base, n);
    const glb = glbFor(h.def);
    return {
      key: `${base}#${n}`,
      path: [...h.harness.split("/"), h.child],
      def: h.def,
      glb: glb?.filePath,
      matrix: h.matrix,
      category: category(h.def),
      features: featureNames(h.def, glb),
      vendor: false,
      harness: h.harness,
      child: h.child,
      linkId: h.linkId,
    };
  });
  const byKey = new Map([...bodies, ...hardware].map((b) => [b.key, b]));
  return { assembly, bodies, hardware, byKey };
}

/** World position and direction of an interface frame on a placed body. */
export function worldFrame(matrix: Mat4, frame: GeometryFrame): { origin: number[]; normal: number[] } {
  const o = applyMat4(matrix, frame.origin);
  const tip = applyMat4(matrix, [frame.origin[0] + frame.normal[0], frame.origin[1] + frame.normal[1], frame.origin[2] + frame.normal[2]]);
  const n = [tip[0] - o[0], tip[1] - o[1], tip[2] - o[2]];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return { origin: o, normal: n.map((x) => x / len) };
}

export const translate = (v: number[]): Mat4 => [1, 0, 0, v[0], 0, 1, 0, v[1], 0, 0, 1, v[2], 0, 0, 0, 1];
export const offsetMatrix = (m: Mat4, v: number[]): Mat4 => multiplyMat4(translate(v), m);
export const matTranslation = (m: Mat4): number[] => [m[3], m[7], m[11]];
