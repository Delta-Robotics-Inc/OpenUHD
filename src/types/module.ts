import type { InterfaceDef } from "./interface.js";
import type { HarnessDef } from "./harness.js";
import type { ArtifactDef } from "./artifact.js";
import type { DomainMetadata } from "./domain.js";
import type { ConstraintExpr } from "./parameter.js";
import type { TraitDef } from "./trait.js";

export interface ChildModuleRef {
  id: string;
  moduleDefId: string;
  /** Instance label, e.g. "Front-left motor". Defaults to the definition name. */
  name?: string;
  /**
   * Identical units represented by this one child (e.g. 4 screws). Defaults
   * to 1. Use separate children when units connect differently.
   */
  quantity?: number;
  /**
   * @deprecated Never read by the engine. Use `ModuleDef.exports` to surface
   * child interfaces on the parent boundary.
   */
  exposedInterfaces?: string[];
  overrides?: Record<string, unknown>;
}

/**
 * What a module definition represents (viewer design D2, D8).
 * - "module": a part or assembly with its own interfaces (default).
 * - "group": an organisational module with no interfaces of its own; by
 *   default it exports every child interface not linked internally.
 * - "harness": a physical carrier of interface links between modules
 *   (cable, bus backbone, splice, switch).
 */
export type ModuleKind = "module" | "group" | "harness";

/**
 * One end of an interface link: an interface on the module itself (`self`)
 * or on one of its children. Replaces the implicit "no childModuleId means
 * the parent" rule used by harness endpoints.
 */
export type EndpointTarget =
  | { self: true; interfaceId: string }
  | { child: string; interfaceId: string; profileInstanceId?: string };

/** A child interface surfaced on this module's boundary. */
export interface InterfaceExport {
  /** Boundary interface id, unique among this module's interfaces and exports. */
  id: string;
  name?: string;
  from: { child: string; interfaceId: string; profileInstanceId?: string };
}

/**
 * A stored mapping between child interfaces (slots or leaves) under a
 * composed link, e.g. SDA↔SDA or a deliberate phase swap B↔C. Stored child
 * links take precedence over the ones DRC derives.
 */
export interface ChildLink {
  /** Slot id (or leaf interface id) on the `a` side. */
  a: string;
  /** Slot id (or leaf interface id) on the `b` side. */
  b: string;
  /** Set by a user to pin a mapping DRC would derive differently. */
  locked?: boolean;
}

/**
 * A direct 1:1 connection between two interfaces (viewer design D1). No
 * harness is needed; `harness` names the harness module carrying it when
 * there is one.
 */
export interface InterfaceLink {
  id: string;
  name?: string;
  a: EndpointTarget;
  b: EndpointTarget;
  childLinks?: ChildLink[];
  /** Child id of the harness module carrying this link, if any. */
  harness?: string;
}

/** Optional presentation hints. Per-project layout lives outside UHD. */
export interface DisplayHints {
  /** Icon name (Lucide), e.g. "cpu", "battery-full". */
  icon?: string;
  shape?: "rectangle" | "rounded_rectangle" | "circle";
  /** Interfaces shown on the outline by default; others are grouped by type. */
  visibleInterfaces?: string[];
}

export interface InterfaceGroup {
  id: string;
  label?: string;
  members: string[]; // interface IDs
  policy: "one_of" | "any_of" | "all_of";
}

export interface RequirementDef {
  type: "capability" | "interface" | "power";
  description: string;
  capability?: string;
  interface_protocol?: string;
  voltage_V?: number | [number, number];
  current_mA?: number;
}

export interface NodeGeometry {
  xScale?: number;
  yScale?: number;
  outline?: {
    preset?: "rectangle" | "rounded_rectangle" | "circle" | "rounded_triangle";
  };
}

export interface ModuleDef {
  id: string;
  name: string;
  /** Defaults to "module". */
  kind?: ModuleKind;
  /** For kind "harness": how the carried links are arranged. */
  topology?: "wire" | "bus" | "split" | "or";
  description?: string;
  version?: string;

  manufacturer?: string;
  part_number?: string;
  tags?: string[];
  categories?: string[];

  interfaces: InterfaceDef[];

  children?: ChildModuleRef[];
  harnesses?: HarnessDef[];
  /** Child interfaces surfaced on this module's boundary. */
  exports?: InterfaceExport[];
  /** Direct interface links between this module and/or its children. */
  links?: InterfaceLink[];

  artifacts?: ArtifactDef[];

  interfaceGroups?: InterfaceGroup[];

  requirements?: RequirementDef[];

  domains?: DomainMetadata[];

  constraints?: ConstraintExpr[];

  traits?: TraitDef[];

  geometry?: NodeGeometry;

  display?: DisplayHints;
}
