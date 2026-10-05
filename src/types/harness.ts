import type { DomainKind } from "./domain.js";
import type { SlotMatch } from "./interface.js";
import type { Parameter } from "./parameter.js";
import type { ArtifactDef } from "./artifact.js";
import type { TraitDef } from "./trait.js";

export interface HarnessEndpointDef {
  id: string;
  label: string;
  childModuleId?: string;
  interfaceId?: string;
  profileInstanceId?: string;
  match?: SlotMatch;
  /**
   * Role of this endpoint in the topology: the source of a split, the trunk
   * or a drop of a bus, or one alternative of an OR/switch.
   */
  role?: "source" | "drop" | "trunk" | "alt";
}

export interface HarnessDef {
  id: string;
  name?: string;
  topology: "wire" | "bus" | "split" | "or";
  domain: DomainKind;
  endpoints: HarnessEndpointDef[];
  /** Physical facts about the carrier: length, wire gauge, rated current. */
  parameters?: Parameter[];
  artifacts?: ArtifactDef[];
  traits?: TraitDef[];
}
