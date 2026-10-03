/**
 * Geometry bindings (PB-775): tying CAD artifacts to modules and interfaces.
 *
 * Geometry stays in the CAD artifact; UHD records *references* into it.
 * Three binding directions are supported, so they can be compared on real
 * parts (docs/geometry-artifacts.md):
 *
 *   "feature"   — a named feature inside the module's own artifact
 *                 (KCL tag, STEP/GLB named sub-shape), optionally narrowed
 *                 to faces, with a geometric signature for stale detection.
 *   "artifact"  — a whole artifact that exists just for this interface
 *                 (e.g. artifacts/interfaces/base_mount.glb).
 *   "procedural"— no file: a viewer or generator derives the geometry from
 *                 the interface's own parameters (bolt pattern, shaft) and
 *                 places it at the interface frame.
 *
 * Every interface with a physical location can also carry a mating frame,
 * which is what assemblies are built from: two linked interfaces are mated
 * by aligning their origins with opposing normals.
 */

/** Millimetres, in the module's own coordinate system. */
export type Vec3 = [number, number, number];

/** Where an interface sits and which way it faces. */
export interface GeometryFrame {
  /**
   * Body artifact whose coordinates the frame is expressed in. Needed when a
   * module has several bodies that move independently (a camera on a cable);
   * defaults to the module's only/first body artifact.
   */
  artifact?: string;
  /** Point on the mating surface (e.g. bolt-circle centre on the base face). */
  origin: Vec3;
  /** Outward normal: the direction a mating part approaches from. */
  normal: Vec3;
  /** In-plane reference direction (hole #1, connector pin 1, cable exit). */
  xAxis?: Vec3;
  /**
   * Rotational symmetry about the normal, in degrees (90 for a 4-hole
   * square/circle pattern). Mating may rotate by any multiple of it.
   */
  symmetryDeg?: number;
}

/** Fingerprint of referenced faces, used to notice when the CAD changed. */
export interface GeometrySignature {
  area_mm2: number;
  centroid: Vec3;
  normal?: Vec3;
  /** Relative tolerance on area / absolute mm on centroid when comparing. */
  tolerance?: number;
}

export type GeometryRef =
  | {
      kind: "feature";
      /** Artifact id on the owning module. */
      artifact: string;
      /** Named feature: a KCL tag or a STEP/GLB sub-shape name. */
      name: string;
      /** Optional face selector inside the feature, e.g. "planar -Z". */
      faces?: string;
      signature?: GeometrySignature;
    }
  | {
      kind: "artifact";
      /** Artifact id on the owning module whose whole content is this interface. */
      artifact: string;
      signature?: GeometrySignature;
    }
  | {
      kind: "procedural";
      /** Which generator derives it from the interface parameters. */
      generator: "bolt_pattern" | "shaft" | "pad" | (string & {});
    };

export interface InterfaceGeometry {
  frame?: GeometryFrame;
  /** One or more representations; a viewer uses the first it can resolve. */
  refs?: GeometryRef[];
  /**
   * The interface is deliberately logical (no physical representation).
   * Distinguishes "not modelled yet" from "has no geometry".
   */
  logical?: boolean;
}

/** How a CAD artifact was produced, so outputs can be traced to their source. */
export interface ArtifactProvenance {
  /** Artifact id (on the same module) this file was generated from. */
  generatedFrom?: string;
  tool?: string;
  toolVersion?: string;
  /** sha256 of the source at generation time. */
  sourceDigest?: string;
}

/**
 * How a fastener harness's parts sit on the joint it carries (PB-775).
 *
 * Positions are measured along the normal of the joint's *structure-side*
 * interface frame (the end whose bolt pattern role is "structure"; else end
 * a), from its origin: negative is behind the structure face (a screw head
 * under a plate), positive toward the mounted part. Each item is placed at
 * every hole of the structure's bolt pattern unless `positions` says
 * otherwise.
 *
 * Every nut must sit on thread: on a screw of the same stack, or, when the
 * structure-side interface is a shaft whose `shaft` trait states a `thread`
 * (a propeller nut on a motor shaft), on that shaft, from its frame outward
 * (to its `length` parameter when it states one).
 */
export interface FastenerStackItem {
  /** Harness child id; its module supplies the geometry and length. */
  child: string;
  /** Where the part's own origin sits along the normal (mm). */
  atMm: number;
  /** Part's own +Z along (+1, default) or against (-1) the normal. */
  direction?: 1 | -1;
  /** In-plane hole positions in the frame's x/y (mm); default: the bolt pattern's holes. */
  positions?: [number, number][];
  /**
   * Tightening torque for this item (PB-797), set on the part that is turned
   * (the screw, or the nut when the screw is held). Omit on parts that are
   * not turned (spacers).
   */
  torque?: FastenerTorque;
}

/**
 * A tightening torque and where it comes from (PB-797). Exactly one of
 * `source` (a maker or supplier statement for this joint) or `assumption`
 * (why this value, when nobody states one) should be given; the
 * fastener_torque check reports a torque with neither. Threadlocker advice
 * is not part of the torque: it is a `usage_note` on the harness.
 */
export interface FastenerTorque {
  /** Newton metres. */
  torqueNm: number;
  /** URL of a statement of this value for this joint. */
  source?: string;
  /** Why this value was chosen when no source states it. */
  assumption?: string;
  /**
   * Published values the choice was made against (supplier tables for the
   * screw grade into steel), so a reader can see how far it was derated.
   */
  reference?: { torqueNm: number; condition: string; source: string }[];
}
