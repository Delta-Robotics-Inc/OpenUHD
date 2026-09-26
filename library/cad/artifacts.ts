/**
 * Library CAD helpers. The general ones (cadArtifacts, feature, own,
 * procedural, withGeometry) moved to the UHD core package
 * (src/authoring/cad.ts) so projects outside this repo can use them; they are
 * re-exported here. The vendor-CAD helpers below assume this library's layout
 * (library/parts/<id>/…), so they stay here.
 */
import type { ArtifactDef, GeometryRef, GeometrySignature } from "../../src/types/index.js";
import { feature } from "../../src/authoring/cad.js";

export * from "../../src/authoring/cad.js";

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
