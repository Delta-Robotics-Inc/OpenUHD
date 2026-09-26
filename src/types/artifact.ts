import type { ArtifactProvenance } from "./geometry.js";

export type ArtifactType =
  | "pcb"
  | "schematic"
  | "3d_model"
  | "firmware"
  | "datasheet"
  | "simulation"
  | "documentation"
  | "cad"
  | "custom";

export interface ArtifactDef {
  id: string;
  name: string;
  type: ArtifactType;
  url?: string;
  filePath?: string;
  storageRef?: string;
  description?: string;
  mimeType?: string;
  tags?: string[];
  /** CAD file format: "kcl", "step", "glb", "stl", … */
  format?: string;
  /** Length unit of geometric artifacts (UHD geometry is in mm). */
  units?: "mm" | "m" | "in";
  /**
   * What the artifact represents for its module: the whole body, the
   * geometry of one interface, or a source that other artifacts derive from.
   */
  role?: "body" | "interface" | "source" | "drawing";
  /** For role "interface": the interface id it depicts. */
  interfaceId?: string;
  provenance?: ArtifactProvenance;
}
