/**
 * UHD bundle: the neutral, self-contained form of a system for tools that
 * only read UHD (the UHD viewer first). A root, every definition it
 * references, optional named variants, and per-definition artifact bases.
 * Producers (a ProtoBoard build, a library script, a hand-written file)
 * resolve origins before writing it; consumers need nothing else.
 */
import type { ModuleDef } from "./module.js";

export const UHD_BUNDLE_SCHEMA = "uhd.bundle/v0";

export interface UhdBundleScenario {
  id: string;
  label: string;
  description?: string;
  /** A variant root definition (replaces the bundle root for this scenario). */
  root?: ModuleDef;
  /** Definitions that replace (by id) or add to the bundle's for this scenario. */
  definitions?: ModuleDef[];
}

export interface UhdBundleDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  /** What it is about: an instance path, link id, definition id… */
  entity?: { kind: string; id: string };
  source?: { file: string; line?: number };
  /** Who produced it (e.g. "protoboard/registry", "uhd/checkSystem"). */
  validator?: string;
}

export interface UhdBundle {
  schema: typeof UHD_BUNDLE_SCHEMA;
  /** Id of the root definition. */
  root: string;
  /** The root and every definition it references (children, harness children). */
  definitions: ModuleDef[];
  /**
   * Base that each definition's relative artifact paths resolve against:
   * definition id → absolute path or URL prefix. Missing: relative to the
   * bundle's own location.
   */
  artifactBases?: Record<string, string>;
  scenarios?: UhdBundleScenario[];
  /** Findings from the producer (a consumer may add its own UHD checks). */
  diagnostics?: UhdBundleDiagnostic[];
  /**
   * Presentation hints keyed by instance path (layout, labels, placement
   * hints, appearance). Opaque to UHD: never topology.
   */
  display?: Record<string, unknown>;
  meta?: { name?: string; producer?: string; producerVersion?: string };
}
