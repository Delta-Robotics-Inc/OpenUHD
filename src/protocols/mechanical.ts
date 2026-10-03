import type { InterfaceDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import {
  fastenerDiameterMm,
  holeCount,
  holeSpacingMm,
  shaftDiameterMm,
} from "./params.js";

/**
 * Mechanical interface builders: bolt patterns and rotating shafts.
 *
 * Mating features pair by role and their parameters must overlap:
 * a 30.5 mm stack pattern does not accept a 20 mm board, and an M3 pattern
 * does not accept M2 fasteners.
 */

/** "structure" = frame / plate providing the holes; "component" = part mounted to it. */
export type BoltPatternRole = "structure" | "component";

export interface BoltPatternConfig {
  id: string;
  name?: string;
  role: BoltPatternRole;
  /**
   * "cross": four holes on two perpendicular diagonals of different
   * lengths, as on motor bases ("16 × 19"): one pair `spacingMm` apart on x,
   * the other `spacingYmm` apart on y. A cross mates only another cross.
   */
  shape: "square" | "rectangle" | "circle" | "cross";
  /**
   * Square side, rectangle X spacing, bolt-circle diameter, or the cross's
   * x diagonal, in mm.
   * A [min, max] range models slotted holes accepting any spacing within it.
   */
  spacingMm: number | [number, number];
  /** Rectangle Y spacing, or the cross's y diagonal, in mm. */
  spacingYmm?: number | [number, number];
  holeCount: number;
  /** Fastener designation, e.g. "M3". */
  fastener: string;
  /** Nominal fastener diameter in mm (M3 → 3). A range for holes that take several sizes. */
  fastenerDiameterMm: number | [number, number];
  /** Holes are threaded (true) or clearance/through holes (false). */
  threaded?: boolean;
  /** Anything else the source states (grommets, countersink, slot length). */
  note?: string;
  maxInstances?: number;
  exposed?: boolean;
  defaultActive?: boolean;
}

export function BoltPattern(config: BoltPatternConfig): InterfaceDef {
  if (config.shape === "cross" && (config.spacingYmm === undefined || config.holeCount !== 4)) {
    throw new Error(`BoltPattern ${config.id}: a cross pattern has four holes and needs spacingYmm (the second diagonal)`);
  }
  const parameters: Parameter[] = [
    holeSpacingMm(config.spacingMm),
    holeCount(config.holeCount),
    fastenerDiameterMm(config.fastenerDiameterMm),
  ];
  if (config.spacingYmm !== undefined) parameters.push(holeSpacingMm(config.spacingYmm, "y"));

  return {
    id: config.id,
    name: config.name,
    domain: "mechanical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "bolt_pattern", roles: [config.role] }],
    capabilities: ["bolt_pattern"],
    parameters,
    ...(config.maxInstances !== undefined ? { max_instances: config.maxInstances } : {}),
    traits: [
      {
        type: "bolt_pattern",
        params: {
          shape: config.shape,
          fastener: config.fastener,
          ...(config.threaded !== undefined ? { threaded: config.threaded } : {}),
          ...(config.note !== undefined ? { note: config.note } : {}),
        },
      },
    ],
  };
}

export interface ShaftConfig {
  id: string;
  name?: string;
  /** "output" = driving shaft (motor); "input" = driven hub/bore (propeller, pulley). */
  role: "output" | "input";
  /** Shaft diameter, or bore diameter for an input, in mm. */
  diameterMm: number;
  /** Thread designation if threaded, e.g. "M5". */
  thread?: string;
  /** Anything else the source states (shaft length, hub type, rotation). */
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

export function Shaft(config: ShaftConfig): InterfaceDef {
  return {
    id: config.id,
    name: config.name,
    domain: "mechanical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "shaft", roles: [config.role] }],
    capabilities: ["shaft"],
    parameters: [shaftDiameterMm(config.diameterMm)],
    max_instances: 1,
    ...(config.thread !== undefined || config.note !== undefined
      ? {
          traits: [
            {
              type: "shaft",
              params: {
                ...(config.thread !== undefined ? { thread: config.thread } : {}),
                ...(config.note !== undefined ? { note: config.note } : {}),
              },
            },
          ],
        }
      : {}),
  };
}
