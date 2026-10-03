import type { InterfaceDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import {
  fastenerDiameterMm,
  forceN,
  holeCount,
  holePitchMm,
  holeSpacingMm,
  keyWidthMm,
  leadMm,
  linearSpeedMmS,
  shaftDiameterMm,
  slotLengthMm,
  strokeMm,
  threadPitchMm,
} from "./params.js";

/**
 * Mechanical interface builders: bolt patterns, rotating shafts and bores,
 * and linear motion.
 *
 * Mating features pair by role and their parameters must overlap:
 * a 30.5 mm stack pattern does not accept a 20 mm board, and an M3 pattern
 * does not accept M2 fasteners. The pair checks in `drc/joint-check.ts`
 * compare what parameters cannot: bolt pattern shapes, shaft profiles and
 * genders, and linear travel and force (docs/mechanical-interfaces.md).
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
   * the other `spacingYmm` apart on y. A cross mates another cross; one
   * with equal diagonals d also mates a 4-hole circle of diameter d or a
   * square of side d/√2, which have the same holes.
   *
   * "row": `holeCount` holes in a straight line, `pitchMm` apart (a
   * bracket leg or a channel on a hole grid). hole_spacing is the span from
   * the first hole to the last. A row mates a row whose holes land on its
   * own (same pitch or a whole multiple of it, no longer than it), or a
   * slot at least as long as the row.
   *
   * "slot": a straight slot that takes fasteners anywhere along
   * `slotLengthMm` (an extrusion's T-slot, a slotted bracket). It mates a
   * row, a two-hole rectangle on a line (spacingYmm 0) that fits its length,
   * or another slot when one of them is a through slot. A slot has no fixed
   * holes. For holes slotted so their spacing can vary, keep the shape and
   * give spacingMm a range instead.
   */
  shape: "square" | "rectangle" | "circle" | "cross" | "row" | "slot";
  /**
   * Square side, rectangle X spacing, bolt-circle diameter, or the cross's
   * x diagonal, in mm. Required for those shapes; a row derives it (the
   * span, pitch × (holes − 1)) and a slot has none.
   * A [min, max] range models slotted holes accepting any spacing within it.
   */
  spacingMm?: number | [number, number];
  /** Rectangle Y spacing, or the cross's y diagonal, in mm. */
  spacingYmm?: number | [number, number];
  /** Row: hole-to-hole pitch in mm. */
  pitchMm?: number;
  /** Slot: the length along which fasteners can sit, in mm. */
  slotLengthMm?: number;
  /**
   * Slot: "t_slot" holds a nut or a screw head captive in a channel (an
   * extrusion); "through" is an open slot a fastener passes through (a
   * slotted bracket or plate).
   */
  slotKind?: "t_slot" | "through";
  /** Number of holes. Required except on a slot (any number of fasteners). */
  holeCount?: number;
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
  const fail = (why: string): never => {
    throw new Error(`BoltPattern ${config.id}: ${why}`);
  };
  if (config.shape === "cross" && (config.spacingYmm === undefined || config.holeCount !== 4)) {
    fail("a cross pattern has four holes and needs spacingYmm (the second diagonal)");
  }
  if (config.shape !== "row" && config.pitchMm !== undefined) fail("pitchMm is for a row");
  if (config.shape !== "slot" && (config.slotLengthMm !== undefined || config.slotKind !== undefined)) fail("slotLengthMm and slotKind are for a slot");

  const parameters: Parameter[] = [];
  if (config.shape === "row") {
    if (config.pitchMm === undefined || !(config.pitchMm > 0)) fail("a row needs pitchMm");
    if (config.holeCount === undefined || config.holeCount < 2) fail("a row has two or more holes");
    if (config.spacingMm !== undefined || config.spacingYmm !== undefined) fail("a row's span comes from pitchMm and holeCount; leave spacingMm and spacingYmm out");
    const span = Number((config.pitchMm! * (config.holeCount! - 1)).toFixed(6));
    parameters.push(holeSpacingMm(span), holeCount(config.holeCount!), holePitchMm(config.pitchMm!));
  } else if (config.shape === "slot") {
    if (config.slotLengthMm === undefined || !(config.slotLengthMm > 0)) fail("a slot needs slotLengthMm");
    if (config.spacingMm !== undefined || config.spacingYmm !== undefined) fail("a slot has no hole spacing; give slotLengthMm");
    parameters.push(slotLengthMm(config.slotLengthMm!));
    if (config.holeCount !== undefined) parameters.push(holeCount(config.holeCount));
  } else {
    if (config.spacingMm === undefined) fail(`a ${config.shape} pattern needs spacingMm`);
    if (config.holeCount === undefined) fail(`a ${config.shape} pattern needs holeCount`);
    parameters.push(holeSpacingMm(config.spacingMm!), holeCount(config.holeCount!));
  }
  parameters.push(fastenerDiameterMm(config.fastenerDiameterMm));
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
          ...(config.slotKind !== undefined ? { slot_kind: config.slotKind } : {}),
          ...(config.threaded !== undefined ? { threaded: config.threaded } : {}),
          ...(config.note !== undefined ? { note: config.note } : {}),
        },
      },
    ],
  };
}

/**
 * Cross-section of a shaft and of the bore it fits. shaft_diameter is the
 * across-flats size for hex, rounded hex and square; the nominal diameter
 * for round, D-cut, double-D and keyed; the major diameter for a spline.
 *
 * - round: plain cylinder (torque by set screw, clamp or press fit).
 * - hex: hexagon with sharp corners (REV and FTC 5 mm hex, 1/2 in hex).
 * - rounded_hex: hexagon with turned corners (REV UltraHex); fits a hex
 *   bore of the same across-flats size.
 * - d_cut: one flat; double_d: two opposite flats.
 * - keyed: round with a keyway and key (`keyWidthMm`).
 * - spline: teeth (`spline` names the standard, e.g. "25T" servo spline).
 * - square: square section (across flats).
 */
export type ShaftProfile = "round" | "hex" | "rounded_hex" | "d_cut" | "double_d" | "keyed" | "spline" | "square";

/** "shaft" = the male part (a motor shaft, a hex shaft); "bore" = the female part (a hub, a gear's bore, a hollow output). */
export type ShaftGender = "shaft" | "bore";

export interface ShaftConfig {
  id: string;
  name?: string;
  /**
   * Which way torque flows: "output" drives (a motor's shaft or hollow
   * output), "input" is driven (a propeller hub, a pulley, a gearbox
   * input), "bidirectional" carries torque from a driver to a load (a loose
   * shaft, a spacer, a coupler). Independent of `gender`: a motor with a
   * hollow hex output is an output bore.
   */
  role: "output" | "input" | "bidirectional";
  /** Shaft diameter, or bore diameter, in mm (across flats for hex, rounded hex and square). */
  diameterMm: number;
  /** Cross-section. Stated profiles are checked against the mating side's. */
  profile?: ShaftProfile;
  /** Male shaft or female bore. Two shafts or two bores do not mate. */
  gender?: ShaftGender;
  /** Keyed: key (shaft) or keyway (bore) width in mm. */
  keyWidthMm?: number;
  /** Spline: the standard or tooth count as the source states it ("25T", "MAXSpline"). */
  spline?: string;
  /** Thread designation if threaded, e.g. "M5". */
  thread?: string;
  /** Anything else the source states (shaft length, hub type, rotation). */
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

export function Shaft(config: ShaftConfig): InterfaceDef {
  if (config.keyWidthMm !== undefined && config.profile !== "keyed") {
    throw new Error(`Shaft ${config.id}: keyWidthMm is for a keyed profile`);
  }
  if (config.spline !== undefined && config.profile !== "spline") {
    throw new Error(`Shaft ${config.id}: spline is for a spline profile`);
  }
  const parameters: Parameter[] = [shaftDiameterMm(config.diameterMm)];
  if (config.keyWidthMm !== undefined) parameters.push(keyWidthMm(config.keyWidthMm));
  const params: Record<string, unknown> = {
    ...(config.profile !== undefined ? { profile: config.profile } : {}),
    ...(config.gender !== undefined ? { gender: config.gender } : {}),
    ...(config.spline !== undefined ? { spline: config.spline } : {}),
    ...(config.thread !== undefined ? { thread: config.thread } : {}),
    ...(config.note !== undefined ? { note: config.note } : {}),
  };
  return {
    id: config.id,
    name: config.name,
    domain: "mechanical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "shaft", roles: [config.role] }],
    capabilities: ["shaft"],
    parameters,
    max_instances: 1,
    ...(Object.keys(params).length > 0 ? { traits: [{ type: "shaft", params }] } : {}),
  };
}

/** How a linear output is produced, as the source describes it. */
export type LinearMechanism = "lead_screw" | "ball_screw" | "belt" | "rack_and_pinion" | "pneumatic" | "hydraulic" | "solenoid" | "linear_motor" | "other";

export interface LinearMotionConfig {
  id: string;
  name?: string;
  /**
   * "output": the moving member that pushes or pulls (an actuator's rod or
   * inner tube, a lead screw nut's carriage); "input": a load or slide
   * driven by one. A load may state the stroke and force it needs.
   */
  role: "output" | "input";
  /** Travel in mm: given (output) or needed (input). */
  strokeMm?: number;
  /** Travel per input revolution in mm (pitch × starts). */
  leadMm?: number;
  /** Screw thread pitch in mm. */
  threadPitchMm?: number;
  /** Thread starts (lead = pitch × starts). */
  starts?: number;
  /** Rated axial force in N (output), or the force the load needs (input). Say in `note` whether it is dynamic, static or peak. */
  forceN?: number;
  /** Rated linear speed in mm/s. */
  speedMmS?: number;
  mechanism?: LinearMechanism;
  /** True when a load on the output can turn the input (an unpowered actuator does not hold). */
  backdrivable?: boolean;
  /** Anything else the source states (end stops, rod end, side-load limits). */
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A linear motion interface: the moving output of a linear actuator, lead
 * screw or slide (role output), or the load it drives (role input). Stroke
 * and force are capacities: the pair check requires the output's stroke and
 * force to cover what the load states (`linear_motion_capacity`). Lead and
 * thread pitch must agree when both sides state them (a screw and its nut).
 */
export function LinearMotion(config: LinearMotionConfig): InterfaceDef {
  if (config.starts !== undefined && config.leadMm !== undefined && config.threadPitchMm !== undefined) {
    const lead = config.threadPitchMm * config.starts;
    if (Math.abs(lead - config.leadMm) > 1e-6 * Math.max(1, lead)) {
      throw new Error(`LinearMotion ${config.id}: lead ${config.leadMm} mm is not pitch ${config.threadPitchMm} mm × ${config.starts} starts`);
    }
  }
  const parameters: Parameter[] = [];
  if (config.strokeMm !== undefined) parameters.push(strokeMm(config.strokeMm));
  if (config.leadMm !== undefined) parameters.push(leadMm(config.leadMm));
  if (config.threadPitchMm !== undefined) parameters.push(threadPitchMm(config.threadPitchMm));
  if (config.forceN !== undefined) parameters.push(forceN(config.forceN));
  if (config.speedMmS !== undefined) parameters.push(linearSpeedMmS(config.speedMmS));
  const params: Record<string, unknown> = {
    ...(config.mechanism !== undefined ? { mechanism: config.mechanism } : {}),
    ...(config.starts !== undefined ? { starts: config.starts } : {}),
    ...(config.backdrivable !== undefined ? { backdrivable: config.backdrivable } : {}),
    ...(config.note !== undefined ? { note: config.note } : {}),
  };
  return {
    id: config.id,
    name: config.name,
    domain: "mechanical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "linear_motion", roles: [config.role] }],
    capabilities: ["linear_motion"],
    ...(parameters.length > 0 ? { parameters } : {}),
    max_instances: 1,
    ...(Object.keys(params).length > 0 ? { traits: [{ type: "linear_motion", params }] } : {}),
  };
}
