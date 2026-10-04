import type { InterfaceDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import {
  angularPitchDeg,
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
   *
   * "grid": holes on every point of a lattice (a plate, a channel or a gear
   * web drilled on a hole grid). `lattice` "rectangular" (rows `pitchYmm`
   * apart, columns `pitchMm` apart) or "triangular" (every hole six
   * neighbours `pitchMm` away: rows pitch × √3/2 apart, every other row
   * offset by half a pitch; one grid line along x). The extent is `rows` ×
   * `columns`, centred on the frame, or a disc: every lattice point within
   * `withinDiameterMm` of the frame origin (a lattice point) and outside
   * `minDiameterMm` (a hub or bore). The hole count is derived; give
   * `holeCount` to have the builder confirm it. A grid mates any pattern
   * whose holes all land on its points (`bolt_pattern_holes`): a row along a
   * grid line, a square on the grid, a six-hole circle of diameter 2 ×
   * pitch on a triangular grid. Fasteners through one line of a grid fit a
   * slot.
   *
   * "arc": a partial bolt circle: `holeCount` holes on a circle of diameter
   * `spacingMm`, `angularPitchDeg` apart, the first at `startAngleDeg` from
   * the frame's x axis (counter-clockwise about the normal): five of six
   * positions drilled (start −30°, pitch 60°) or four (0°, 60°, 120°,
   * 180°). An arc mates a full circle whose holes include its own, an arc
   * or grid that has its holes, or a pattern whose holes are among its own.
   */
  shape: "square" | "rectangle" | "circle" | "cross" | "row" | "slot" | "grid" | "arc";
  /**
   * Square side, rectangle X spacing, bolt-circle diameter, or the cross's
   * x diagonal, in mm. Required for those shapes; a row derives it (the
   * span, pitch × (holes − 1)) and a slot has none.
   * A [min, max] range models slotted holes accepting any spacing within it.
   */
  spacingMm?: number | [number, number];
  /** Rectangle Y spacing, or the cross's y diagonal, in mm. */
  spacingYmm?: number | [number, number];
  /** Row: hole-to-hole pitch in mm. Grid: the pitch along x (rectangular), or between neighbours (triangular). */
  pitchMm?: number;
  /** Rectangular grid: the pitch along y (between rows), when it is not `pitchMm`. */
  pitchYmm?: number;
  /** Grid: the lattice (default "rectangular"). */
  lattice?: "rectangular" | "triangular";
  /** Grid: number of rows (along y) and columns (along x), centred on the frame. */
  rows?: number;
  columns?: number;
  /** Grid: a disc extent instead of rows × columns: lattice points within this diameter of the origin. */
  withinDiameterMm?: number;
  /** Grid with a disc extent: leave out the points closer to the origin than half this (a hub). */
  minDiameterMm?: number;
  /** Arc: the angle between neighbouring holes, in degrees. */
  angularPitchDeg?: number;
  /** Arc: the first hole's angle from the frame's x axis, counter-clockwise, in degrees (default 0). */
  startAngleDeg?: number;
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
  const gridFields = ["pitchYmm", "lattice", "rows", "columns", "withinDiameterMm", "minDiameterMm"] as const;
  if (config.shape !== "grid" && gridFields.some((k) => config[k] !== undefined)) fail(`${gridFields.filter((k) => config[k] !== undefined).join(", ")}: for a grid`);
  if (config.shape !== "arc" && (config.angularPitchDeg !== undefined || config.startAngleDeg !== undefined)) fail("angularPitchDeg and startAngleDeg are for an arc");
  if (config.shape === "grid" || config.shape === "arc") return holePatternInterface(config, fail);
  if (config.shape === "cross" && (config.spacingYmm === undefined || config.holeCount !== 4)) {
    fail("a cross pattern has four holes and needs spacingYmm (the second diagonal)");
  }
  if (config.shape !== "row" && config.pitchMm !== undefined) fail("pitchMm is for a row or a grid");
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

/** Lattice description a grid's `bolt_pattern` trait carries; `latticeHoles` places its holes. */
export interface GridSpec {
  lattice: "rectangular" | "triangular";
  pitch: number;
  pitchY?: number;
  rows?: number;
  columns?: number;
  withinDiameter?: number;
  minDiameter?: number;
}

const r6 = (v: number) => Number(v.toFixed(6)) + 0;

/**
 * The holes of a grid in its frame's x/y, in mm: rows × columns centred on
 * the origin, or every lattice point (the origin is one) within the disc.
 * Rows run along x; a triangular lattice offsets every other row by half a
 * pitch, rows pitch × √3/2 apart.
 */
export function latticeHoles(g: GridSpec): [number, number][] {
  const tri = g.lattice === "triangular";
  const dy = tri ? (g.pitch * Math.sqrt(3)) / 2 : (g.pitchY ?? g.pitch);
  const out: [number, number][] = [];
  if (g.withinDiameter !== undefined) {
    const rMax = g.withinDiameter / 2 + 1e-6;
    const rMin = (g.minDiameter ?? 0) / 2 - 1e-6;
    const nj = Math.ceil(rMax / dy) + 1;
    const ni = Math.ceil(rMax / g.pitch) + 2;
    for (let j = -nj; j <= nj; j++) {
      for (let i = -ni - Math.abs(j); i <= ni + Math.abs(j); i++) {
        const x = g.pitch * i + (tri ? (g.pitch / 2) * j : 0);
        const y = dy * j;
        const r = Math.hypot(x, y);
        if (r <= rMax && r >= rMin) out.push([r6(x), r6(y)]);
      }
    }
    return out.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  }
  const rows = g.rows ?? 1;
  const cols = g.columns ?? 1;
  const shift = tri && rows > 1 ? g.pitch / 4 : 0; // centre the offset rows
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const off = tri && j % 2 === 1 ? g.pitch / 2 : 0;
      out.push([r6(-((cols - 1) * g.pitch) / 2 + i * g.pitch + off - shift), r6(-((rows - 1) * dy) / 2 + j * dy)]);
    }
  }
  return out;
}

/** The holes of a partial bolt circle in its frame's x/y, in mm. */
export function arcHoles(diameter: number, count: number, pitchDeg: number, startDeg = 0): [number, number][] {
  return Array.from({ length: count }, (_, k) => {
    const a = ((startDeg + k * pitchDeg) * Math.PI) / 180;
    return [r6((Math.cos(a) * diameter) / 2), r6((Math.sin(a) * diameter) / 2)] as [number, number];
  });
}

function holePatternInterface(config: BoltPatternConfig, fail: (why: string) => never): InterfaceDef {
  const parameters: Parameter[] = [];
  const params: Record<string, unknown> = { shape: config.shape, fastener: config.fastener };
  if (config.slotLengthMm !== undefined || config.slotKind !== undefined) fail("slotLengthMm and slotKind are for a slot");
  if (config.spacingYmm !== undefined) fail(`a ${config.shape} has no spacingYmm`);
  if (config.shape === "grid") {
    const lattice = config.lattice ?? "rectangular";
    if (config.pitchMm === undefined || !(config.pitchMm > 0)) fail("a grid needs pitchMm");
    if (config.spacingMm !== undefined) fail("a grid has no spacingMm; give pitchMm and the extent");
    if (lattice === "triangular" && config.pitchYmm !== undefined) fail("a triangular grid has one pitch; leave pitchYmm out");
    const disc = config.withinDiameterMm !== undefined;
    if (disc && (config.rows !== undefined || config.columns !== undefined)) fail("give rows and columns, or withinDiameterMm, not both");
    if (!disc && (config.rows === undefined || config.columns === undefined)) fail("a grid needs rows and columns, or withinDiameterMm");
    if (config.minDiameterMm !== undefined && !disc) fail("minDiameterMm is for a disc extent");
    if (!disc && (config.rows! < 1 || config.columns! < 1 || !Number.isInteger(config.rows) || !Number.isInteger(config.columns))) fail("rows and columns are whole numbers from 1");
    if (!disc && (config.rows === 1 || config.columns === 1)) fail("a grid of one row or one column is a row: use shape \"row\"");
    const spec: GridSpec = {
      lattice,
      pitch: config.pitchMm!,
      ...(config.pitchYmm !== undefined ? { pitchY: config.pitchYmm } : {}),
      ...(disc ? { withinDiameter: config.withinDiameterMm! } : { rows: config.rows!, columns: config.columns! }),
      ...(config.minDiameterMm !== undefined ? { minDiameter: config.minDiameterMm } : {}),
    };
    const count = latticeHoles(spec).length;
    if (count < 2) fail("the extent holds fewer than two lattice points");
    if (config.holeCount !== undefined && config.holeCount !== count) fail(`the lattice and extent give ${count} holes, not ${config.holeCount}`);
    parameters.push(holeCount(count), holePitchMm(config.pitchMm!));
    if (lattice === "rectangular") parameters.push(holePitchMm(config.pitchYmm ?? config.pitchMm!, "y"));
    params.lattice = lattice;
    if (disc) {
      params.within_diameter_mm = config.withinDiameterMm;
      if (config.minDiameterMm !== undefined) params.min_diameter_mm = config.minDiameterMm;
    } else {
      params.rows = config.rows;
      params.columns = config.columns;
    }
  } else {
    if (config.spacingMm === undefined || Array.isArray(config.spacingMm) || !(config.spacingMm > 0)) fail("an arc needs spacingMm, the circle's diameter");
    if (config.holeCount === undefined || config.holeCount < 2) fail("an arc has two or more holes");
    if (config.angularPitchDeg === undefined || !(config.angularPitchDeg > 0)) fail("an arc needs angularPitchDeg");
    if (config.pitchMm !== undefined) fail("pitchMm is for a row or a grid");
    if (config.angularPitchDeg! * config.holeCount! >= 360 - 1e-9) fail("the holes go round the whole circle (or overlap): use shape \"circle\"");
    parameters.push(holeSpacingMm(config.spacingMm as number), holeCount(config.holeCount!), angularPitchDeg(config.angularPitchDeg!));
    params.start_angle_deg = config.startAngleDeg ?? 0;
  }
  parameters.push(fastenerDiameterMm(config.fastenerDiameterMm));
  if (config.threaded !== undefined) params.threaded = config.threaded;
  if (config.note !== undefined) params.note = config.note;
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
    traits: [{ type: "bolt_pattern", params }],
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
  /**
   * A round bore made to go over a shaft of another profile and clamp on it
   * (an adapter: a shaft collar's Ø6 bore on a 5 mm hex shaft, held by a set
   * screw on a flat). The pair check fits it to a shaft of that profile and
   * size instead of comparing the diameters; `by` says what holds it.
   * Only on a round bore, which must clear the shaft's corners.
   */
  clampsOn?: { profile: ShaftProfile; diameterMm: number; by: "set_screw" | "clamp_screw" | "press" | "adhesive" };
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
  if (config.clampsOn !== undefined) {
    if (config.gender !== "bore" || (config.profile ?? "round") !== "round") throw new Error(`Shaft ${config.id}: clampsOn is for a round bore`);
    const c = config.clampsOn;
    const corners = c.profile === "hex" ? (c.diameterMm * 2) / Math.sqrt(3) : c.profile === "square" ? c.diameterMm * Math.SQRT2 : c.diameterMm;
    if (config.diameterMm + 1e-9 < corners - 0.05) {
      throw new Error(`Shaft ${config.id}: a Ø${config.diameterMm} mm bore does not clear a ${c.diameterMm} mm ${c.profile} shaft (${+corners.toFixed(3)} mm across corners)`);
    }
  }
  const parameters: Parameter[] = [shaftDiameterMm(config.diameterMm)];
  if (config.keyWidthMm !== undefined) parameters.push(keyWidthMm(config.keyWidthMm));
  const params: Record<string, unknown> = {
    ...(config.clampsOn !== undefined ? { clamps_on: { profile: config.clampsOn.profile, diameter_mm: config.clampsOn.diameterMm, by: config.clampsOn.by } } : {}),
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
