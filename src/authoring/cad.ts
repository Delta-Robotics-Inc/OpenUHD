/**
 * Pure helpers for binding a module's interfaces to geometry
 * (docs/geometry-artifacts.md): references into artifacts the module
 * declares (D1 a named feature, D2 the interface's own artifact) or derived
 * from parameters (D3 procedural), and `withGeometry` to attach them.
 *
 * Which files a CAD generator writes, and so which artifacts a module
 * declares for them, is the generator's own knowledge and lives with the
 * generator, not in UHD.
 */
import type { ArtifactDef, GeometryRef, GeometrySignature, InterfaceGeometry, ModuleDef } from "../types/index.js";

/** D1: a named feature inside a body artifact. */
export const feature = (name: string, signature?: GeometrySignature, artifact = "cad_step"): GeometryRef => ({
  kind: "feature",
  artifact,
  name,
  ...(signature ? { signature } : {}),
});

/** D2: the interface's own artifact, by the `cad_if_<interface>` id convention. */
export const own = (interfaceId: string): GeometryRef => ({ kind: "artifact", artifact: `cad_if_${interfaceId}` });

/** D3: derived from the interface's parameters by a viewer/generator. */
export const procedural = (generator: string): GeometryRef => ({ kind: "procedural", generator });

/**
 * Return `def` with geometry attached to the named interfaces and the
 * artifacts appended. Throws on an unknown interface id, so a renamed
 * interface cannot silently lose its geometry.
 */
export function withGeometry(def: ModuleDef, geometry: Record<string, InterfaceGeometry>, artifacts: ArtifactDef[]): ModuleDef {
  const ids = new Set(def.interfaces.map((i) => i.id));
  for (const id of Object.keys(geometry)) {
    if (!ids.has(id)) throw new Error(`${def.id}: geometry for unknown interface "${id}"`);
  }
  return {
    ...def,
    interfaces: def.interfaces.map((i) => (geometry[i.id] ? { ...i, geometry: geometry[i.id] } : i)),
    artifacts: [...(def.artifacts ?? []), ...artifacts],
  };
}
