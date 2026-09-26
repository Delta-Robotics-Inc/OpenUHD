/**
 * Resolve the generator manifest for a module's CAD artifact (PB-775): the
 * module's JSON artifact whose provenance says it was generated from it.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import type { GeometryManifest } from "../../src/system/geometry.js";
import type { ModuleDef } from "../../src/types/index.js";

const REPO = fileURLToPath(new URL("../../", import.meta.url));

export function manifestLookup(def: ModuleDef): (artifactId: string) => GeometryManifest | undefined {
  return (artifactId) => {
    const art = (def.artifacts ?? []).find((a) => a.format === "json" && a.provenance?.generatedFrom === artifactId);
    if (!art?.filePath) return undefined;
    const file = join(REPO, art.filePath);
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as GeometryManifest) : undefined;
  };
}
