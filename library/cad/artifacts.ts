/**
 * Helpers for attaching CAD artifacts and interface geometry to library
 * modules (PB-775). See docs/geometry-artifacts.md.
 *
 * The generators in library/cad write, per module:
 *   <name>.step            body with each interface as a named sub-shape (D1)
 *   <name>.glb             the same, tessellated, for viewers
 *   <name>.manifest.json   feature name -> signature (area, centroid, normal)
 *   interfaces/<id>.glb    one artifact per interface (D2)
 * and nothing for D3 (procedural), which viewers derive from parameters.
 */
import type { ArtifactDef, GeometryRef, GeometrySignature, InterfaceGeometry, ModuleDef } from "../../src/types/index.js";

export interface CadOptions {
  /** Repo-relative directory holding the generated files. */
  dir: string;
  /** Base name of the generated body files. */
  name: string;
  /** Repo-relative generator source (build123d script or KCL file). */
  generator: string;
  tool: string;
  /** Interfaces that have a per-interface artifact (D2). */
  interfaces?: string[];
  /** Extra id prefix when a module has several bodies (e.g. "camera"). */
  prefix?: string;
}

/** Source, STEP body, GLB body, manifest and per-interface GLBs for one generated body. */
export function cadArtifacts(o: CadOptions): ArtifactDef[] {
  const p = o.prefix ? `${o.prefix}_` : "";
  const provenance = { generatedFrom: `cad_${p}source`, tool: o.tool };
  return [
    {
      id: `cad_${p}source`,
      name: `${o.name} generator`,
      type: "cad",
      role: "source",
      format: o.generator.split(".").pop(),
      filePath: o.generator,
    },
    {
      id: `cad_${p}step`,
      name: `${o.name} (STEP)`,
      type: "3d_model",
      role: "body",
      format: "step",
      units: "mm",
      filePath: `${o.dir}/${o.name}.step`,
      provenance,
      description: "Body plus one named sub-shape per interface feature; features and signatures in the manifest.",
    },
    {
      id: `cad_${p}glb`,
      name: `${o.name} (GLB)`,
      type: "3d_model",
      role: "body",
      format: "glb",
      units: "m",
      filePath: `${o.dir}/${o.name}.glb`,
      provenance: { ...provenance, generatedFrom: `cad_${p}step` },
      description: "Viewer mesh of the STEP body (glTF metres, Y-up).",
    },
    {
      id: `cad_${p}manifest`,
      name: `${o.name} feature manifest`,
      type: "cad",
      role: "source",
      format: "json",
      filePath: `${o.dir}/${o.name}.manifest.json`,
      provenance: { ...provenance, generatedFrom: `cad_${p}step` },
    },
    ...(o.interfaces ?? []).map(
      (id): ArtifactDef => ({
        id: `cad_if_${id}`,
        name: `${id} geometry`,
        type: "3d_model",
        role: "interface",
        interfaceId: id,
        format: "glb",
        units: "m",
        filePath: `${o.dir}/interfaces/${id}.glb`,
        provenance: { ...provenance, generatedFrom: `cad_${p}step` },
      }),
    ),
  ];
}

/** D1: a named feature inside a body artifact. */
export const feature = (name: string, signature?: GeometrySignature, artifact = "cad_step"): GeometryRef => ({
  kind: "feature",
  artifact,
  name,
  ...(signature ? { signature } : {}),
});

/** D2: the interface's own artifact (from cadArtifacts `interfaces`). */
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

// ---------------------------------------------------------------------------
// Vendor CAD (PB-796): manufacturer STEP bound by library/cad/py/vendor_step.py
// ---------------------------------------------------------------------------

export interface VendorCadOptions {
  /** Part id: files live under library/parts/<partId>/. */
  partId: string;
  /** Base name of the converted GLB (vendor_step.py `name`). */
  name: string;
  /** Manufacturer download URL (also a `type: "cad"` row in sources.json). */
  url: string;
  /** STEP file name under library/parts/<partId>/.research/cad/ (or the committed copy, see `committedStep`). */
  stepFile: string;
  /** sha256 of the downloaded bytes (sources.json). */
  sha256: string;
  /** Licence / terms as recorded in sources.json. */
  licence: string;
  /**
   * Repo-relative path of a committed copy of the STEP, only when the
   * licence clearly permits redistribution. Otherwise the STEP stays in the
   * gitignored .research/cad/.
   */
  committedStep?: string;
  /** Features also exported as their own GLB (D2 refs, `vendorOwn`). */
  interfaces?: string[];
}

/** Vendor STEP (source), converted GLB (body, gitignored), committed manifest, per-interface GLBs. */
export function vendorCadArtifacts(o: VendorCadOptions): ArtifactDef[] {
  const dir = `library/parts/${o.partId}/artifacts/cad`;
  const tool = { generatedFrom: "cad_vendor_step", tool: "build123d 0.13.0 (library/cad/py/vendor_step.py)" };
  return [
    {
      id: "cad_vendor_step",
      name: `${o.name} STEP (manufacturer)`,
      type: "3d_model",
      role: "source",
      format: "step",
      units: "mm",
      url: o.url,
      filePath: o.committedStep ?? `library/parts/${o.partId}/.research/cad/${o.stepFile}`,
      description: o.committedStep
        ? `Manufacturer STEP, committed (${o.licence}).`
        : `Manufacturer STEP, not committed (${o.licence}); download from the url.`,
      provenance: { tool: "manufacturer", sourceDigest: o.sha256 },
    },
    {
      id: "cad_vendor_glb",
      name: `${o.name} (GLB)`,
      type: "3d_model",
      role: "body",
      format: "glb",
      units: "m",
      filePath: `${dir}/vendor/${o.name}.glb`,
      description: "Converted locally from the vendor STEP by library/cad/py/vendor_step.py (gitignored).",
      provenance: tool,
    },
    {
      id: "cad_vendor_manifest",
      name: `${o.name} vendor feature manifest`,
      type: "cad",
      role: "source",
      format: "json",
      filePath: `${dir}/${o.partId}-vendor.manifest.json`,
      provenance: tool,
    },
    ...(o.interfaces ?? []).map(
      (id): ArtifactDef => ({
        id: `cad_vendor_if_${id.replace(/[^A-Za-z0-9_]/g, "_")}`,
        name: `${id} geometry (vendor)`,
        type: "3d_model",
        role: "interface",
        format: "glb",
        units: "m",
        filePath: `${dir}/vendor/interfaces/${id}.glb`,
        provenance: tool,
      }),
    ),
  ];
}

/** D1 into vendor CAD: a feature named in the vendor manifest. */
export const vendorFeature = (name: string, signature?: GeometrySignature): GeometryRef => feature(name, signature, "cad_vendor_step");

/** D2 into vendor CAD: a feature exported as its own GLB (listed in `interfaces`). */
export const vendorOwn = (name: string): GeometryRef => ({ kind: "artifact", artifact: `cad_vendor_if_${name.replace(/[^A-Za-z0-9_]/g, "_")}` });
