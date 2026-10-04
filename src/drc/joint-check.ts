import type { InterfaceDef } from "../types/interface.js";
import type { Diagnostic } from "./types.js";
import { getEffectiveRange } from "../parameters/range.js";
import { arcHoles, latticeHoles, type GridSpec } from "../protocols/mechanical.js";

/**
 * Pair checks on how two matched interfaces physically join, beyond their
 * protocols and parameters:
 *
 * - `fluid_joint_mismatch`: two fluid ports (FluidPort's `fluid_joint`
 *   trait) whose joints do not mate. Threads need the same standard (NPT and
 *   NPTF count as one) and size and opposite genders; a push-to-connect
 *   fitting or a hose barb takes a tube; quick couplers need the same style
 *   and opposite genders. Thread sizes compare without inch marks, spaces
 *   or case, and a BSPP or BSPT size may carry ISO 228's "G" or ISO 7's
 *   "R"/"Rc"/"Rp" prefix ("G1/4" is "1/4"). Tube diameters are checked as
 *   parameters.
 * - `bolt_pattern_shape`: a cross bolt pattern (two diagonals, BoltPattern
 *   shape "cross") against a pattern of another shape whose holes differ. A
 *   cross with equal diagonals d has the holes of a 4-hole circle of
 *   diameter d and of a square of side d/√2, so those pairs are compared by
 *   that diagonal instead (see boltPatternsShareHoles). Square, rectangle and
 *   circle patterns are compared by their parameters only.
 * - `bolt_pattern_line`: a row (BoltPattern shape "row") or a slot (shape
 *   "slot") against a pattern whose holes do not land on it. A row mates a
 *   row whose holes fall on its own: the shorter row's pitch is the
 *   longer's or a whole multiple of it, and it is no longer. A rectangle
 *   with hole_spacing_y 0 counts as a two-hole row (or, when its spacing is
 *   a range from 0, as a slot: the older way to write one). A row fits a
 *   slot no shorter than the row. Two T-slots do not mate (neither has a
 *   hole for the fastener); a through slot mates any slot. A row or slot
 *   never mates a pattern whose holes are not on one line (square, circle,
 *   cross, a rectangle with a y spacing). The check compares the spans,
 *   pitches and lengths itself (see pairCheckedParams).
 * - `bolt_pattern_holes`: a grid (BoltPattern shape "grid") or a partial
 *   circle (shape "arc") against another pattern: the pattern with fewer
 *   holes must land on the other's holes under some rotation and shift (or
 *   their mirror image), within 0.05 mm. A grid fits a slot (fasteners
 *   through one line of the grid); an arc does not.
 * - `shaft_fit`: a shaft and a bore (Shaft `gender`, `profile`) that do not
 *   fit: two shafts or two bores; or profiles that do not fit (a hex shaft
 *   in a round bore, two different splines). A round shaft in a keyed bore,
 *   or a keyed shaft in a round one, fits without its key carrying torque
 *   (warning). Diameters and key widths are compared as parameters.
 * - `linear_motion_capacity`: a linear output whose stroke or force is less
 *   than the load it drives states it needs.
 * - `supply_current_rating`: a source (a power output, a controller
 *   channel) rated for less continuous current than the input it feeds says
 *   its source must be rated for (`min_supply_current`); info when the
 *   source states no rating.
 */
export function checkPairJoints(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  return [...fluidJoint(a, b), ...boltHoles(a, b), ...boltShape(a, b), ...boltLine(a, b), ...shaftFit(a, b), ...linearCapacity(a, b), ...supplyCurrent(a, b)];
}

/**
 * Parameters the joint check compares itself for this pair, which the
 * pairwise overlap check must skip: hole spacings of bolt patterns that share
 * holes in another shape (a cross and a circle), and the spans, counts,
 * pitches and lengths of row and slot patterns.
 */
export function pairCheckedParams(a: InterfaceDef, b: InterfaceDef): Set<string> {
  if (holeRule(a, b)) return new Set(["hole_spacing", "hole_spacing_y", "hole_count", "hole_pitch", "hole_pitch_y", "angular_pitch", "slot_length"]);
  if (clampFit(a, b)) return new Set(["shaft_diameter"]);
  if (lineRule(a, b)) return new Set(["hole_spacing", "hole_spacing_y", "hole_count", "hole_pitch", "slot_length"]);
  if (boltPatternsShareHoles(a, b)) return new Set(["hole_spacing", "hole_spacing_y"]);
  return new Set();
}

const traitParams = (iface: InterfaceDef, type: string): Record<string, unknown> | undefined =>
  iface.traits?.find((t) => t.type === type)?.params as Record<string, unknown> | undefined;

const THREAD_FAMILY: Record<string, string> = { npt: "npt", nptf: "npt" };
const threadFamily = (s: unknown) => {
  const k = String(s ?? "").toLowerCase();
  return THREAD_FAMILY[k] ?? k;
};
/** BSP threads: ISO 228 parallel sizes are written "G1/4", ISO 7 taper sizes "R1/4", "Rc1/4" or "Rp1/4". */
const BSP_PREFIX = /^(g|rc|rp|r)(?=\d)/;
const normSize = (s: unknown, standard?: unknown) => {
  const size = String(s ?? "").replace(/["″\s]/g, "").toLowerCase();
  return /^bsp/.test(String(standard ?? "").toLowerCase()) ? size.replace(BSP_PREFIX, "") : size;
};

/** Joint kinds that mate with each other (unordered). */
const MATES: Record<string, string[]> = {
  thread: ["thread"],
  push_to_connect: ["tube"],
  tube: ["push_to_connect", "barb"],
  barb: ["tube"],
  quick_coupler: ["quick_coupler"],
};

function describe(j: Record<string, unknown>): string {
  if (j.kind === "thread") return `${j.standard} ${j.size} ${j.gender} thread`;
  if (j.kind === "quick_coupler") return `${j.style} ${j.gender} quick coupler`;
  return String(j.kind).replace(/_/g, "-");
}

function fluidJoint(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const ja = traitParams(a, "fluid_joint");
  const jb = traitParams(b, "fluid_joint");
  if (!ja || !jb) return [];
  const problem = (why: string): Diagnostic[] => [
    { severity: "error", code: "fluid_joint_mismatch", message: `${describe(ja)} does not mate with ${describe(jb)}: ${why}`, refs: [a.id, b.id] },
  ];
  if (!(MATES[String(ja.kind)] ?? []).includes(String(jb.kind))) return problem("these joint kinds do not connect without a fitting");
  if (ja.kind === "thread") {
    if (threadFamily(ja.standard) !== threadFamily(jb.standard)) return problem("different thread standards");
    if (normSize(ja.size, ja.standard) !== normSize(jb.size, jb.standard)) return problem("different thread sizes");
  }
  if (ja.kind === "quick_coupler" && String(ja.style).toLowerCase() !== String(jb.style).toLowerCase()) return problem("different coupler styles");
  if ((ja.kind === "thread" || ja.kind === "quick_coupler") && ja.gender === jb.gender) return problem(`both are ${ja.gender}`);
  if ((ja.kind === "barb" || jb.kind === "barb") && ![a, b].every((x) => x.parameters?.some((p) => p.id === "tube_id"))) {
    return [{ severity: "warning", code: "fluid_joint_mismatch", message: "a hose barb's fit cannot be checked: the tube states no inside diameter", refs: [a.id, b.id] }];
  }
  return [];
}

/** How close two hole positions must be to count as the same hole, in mm. */
const HOLE_TOLERANCE_MM = 0.05;

const paramRange = (iface: InterfaceDef, id: string): [number, number] | undefined => {
  const p = iface.parameters?.find((x) => x.id === id);
  return (p && getEffectiveRange(p)) ?? undefined;
};

/**
 * The diagonal of a 4-hole pattern whose holes lie on a square (equal
 * diagonals), as a range in mm, or undefined for any other pattern: a 4-hole
 * circle's diameter, a square's side × √2, or a cross whose two diagonals can
 * be equal (their ranges overlap).
 */
function squareDiagonal(iface: InterfaceDef): [number, number] | undefined {
  const shape = traitParams(iface, "bolt_pattern")?.shape;
  const count = paramRange(iface, "hole_count");
  if (count && (count[0] !== 4 || count[1] !== 4)) return undefined;
  const x = paramRange(iface, "hole_spacing");
  if (!x) return undefined;
  if (shape === "circle") return x;
  if (shape === "square") return [x[0] * Math.SQRT2, x[1] * Math.SQRT2];
  if (shape === "cross") {
    const y = paramRange(iface, "hole_spacing_y") ?? x;
    const lo = Math.max(x[0], y[0]);
    const hi = Math.min(x[1], y[1]);
    return lo <= hi + HOLE_TOLERANCE_MM ? [Math.min(lo, hi), Math.max(lo, hi)] : undefined;
  }
  return undefined;
}

const overlaps = (a: [number, number], b: [number, number]) => a[0] <= b[1] + HOLE_TOLERANCE_MM && b[0] <= a[1] + HOLE_TOLERANCE_MM;

/**
 * Two bolt patterns of different shapes, one a cross, that have the same
 * holes: a cross with equal diagonals against a 4-hole circle or a square of
 * the same diagonal. Their hole_spacing parameters mean different lengths
 * (a square's side, a cross's diagonal), so the pair check compares the
 * diagonal here and does not compare those parameters.
 */
export function boltPatternsShareHoles(a: InterfaceDef, b: InterfaceDef): boolean {
  const sa = traitParams(a, "bolt_pattern")?.shape;
  const sb = traitParams(b, "bolt_pattern")?.shape;
  if (sa === undefined || sb === undefined || sa === sb || (sa !== "cross" && sb !== "cross")) return false;
  const da = squareDiagonal(a);
  const db = squareDiagonal(b);
  return !!da && !!db && overlaps(da, db);
}

const fmtRange = (r: [number, number]) => (Math.abs(r[1] - r[0]) <= HOLE_TOLERANCE_MM ? `${+r[0].toFixed(2)}` : `${+r[0].toFixed(2)}–${+r[1].toFixed(2)}`);

function boltShape(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const sa = traitParams(a, "bolt_pattern")?.shape;
  const sb = traitParams(b, "bolt_pattern")?.shape;
  if (sa === undefined || sb === undefined || sa === sb) return [];
  if (lineRule(a, b) || holeRule(a, b)) return [];
  if (sa !== "cross" && sb !== "cross") return [];
  if (boltPatternsShareHoles(a, b)) return [];
  const [da, db] = [squareDiagonal(a), squareDiagonal(b)];
  const why =
    da && db
      ? `both have four holes on a square, but the diagonals differ (${fmtRange(da)} mm and ${fmtRange(db)} mm)`
      : "their holes are not in the same places";
  return [
    {
      severity: "error",
      code: "bolt_pattern_shape",
      message: `a ${sa} bolt pattern does not line up with a ${sb} one: ${why}`,
      refs: [a.id, b.id],
    },
  ];
}

// ---------------------------------------------------------------------------
// Rows and slots
// ---------------------------------------------------------------------------

/** A pattern's holes as a line: a row (pitch, possibly a range for slotted holes, and count), a slot, or not on a line. */
type Line =
  | { kind: "row"; pitch: [number, number]; count: number }
  | { kind: "slot"; length: number; slotKind?: string }
  | { kind: "plane"; shape: string };

const isLineShape = (iface: InterfaceDef) => {
  const shape = traitParams(iface, "bolt_pattern")?.shape;
  return shape === "row" || shape === "slot";
};

/** The line rule applies when both sides are bolt patterns, at least one is a row or a slot, and neither is a grid or an arc (the hole rule). */
const lineRule = (a: InterfaceDef, b: InterfaceDef) =>
  traitParams(a, "bolt_pattern") !== undefined && traitParams(b, "bolt_pattern") !== undefined && (isLineShape(a) || isLineShape(b)) && !holeRule(a, b);

// ---------------------------------------------------------------------------
// Grids and arcs: compare the holes themselves
// ---------------------------------------------------------------------------

const isHoleShape = (iface: InterfaceDef) => {
  const shape = traitParams(iface, "bolt_pattern")?.shape;
  return shape === "grid" || shape === "arc";
};

/** The hole rule applies when both sides are bolt patterns and at least one is a grid or an arc. */
const holeRule = (a: InterfaceDef, b: InterfaceDef) =>
  traitParams(a, "bolt_pattern") !== undefined && traitParams(b, "bolt_pattern") !== undefined && (isHoleShape(a) || isHoleShape(b));

const paramNum = (iface: InterfaceDef, id: string) => paramRange(iface, id)?.[0];

/**
 * The holes of any bolt pattern in its frame's x/y (mm), from its
 * parameters and trait; undefined for a slot (no fixed holes) or a pattern
 * whose spacing is a range (slotted holes).
 */
export function patternHoles(iface: InterfaceDef): [number, number][] | undefined {
  const t = traitParams(iface, "bolt_pattern");
  if (!t) return undefined;
  const shape = String(t.shape);
  if (shape === "slot") return undefined;
  if (shape === "grid") {
    const spec: GridSpec = {
      lattice: t.lattice === "triangular" ? "triangular" : "rectangular",
      pitch: paramNum(iface, "hole_pitch") ?? 0,
      ...(paramNum(iface, "hole_pitch_y") !== undefined ? { pitchY: paramNum(iface, "hole_pitch_y") } : {}),
      ...(t.within_diameter_mm !== undefined ? { withinDiameter: Number(t.within_diameter_mm) } : { rows: Number(t.rows), columns: Number(t.columns) }),
      ...(t.min_diameter_mm !== undefined ? { minDiameter: Number(t.min_diameter_mm) } : {}),
    };
    return latticeHoles(spec);
  }
  const x = paramRange(iface, "hole_spacing");
  if (!x || x[1] - x[0] > HOLE_TOLERANCE_MM) return undefined;
  const count = paramNum(iface, "hole_count") ?? 4;
  const d = x[0];
  if (shape === "arc") return arcHoles(d, count, paramNum(iface, "angular_pitch") ?? 0, Number(t.start_angle_deg ?? 0));
  if (shape === "row") {
    const pitch = paramNum(iface, "hole_pitch") ?? (count > 1 ? d / (count - 1) : 0);
    return Array.from({ length: count }, (_, k) => [-d / 2 + k * pitch, 0] as [number, number]);
  }
  if (shape === "circle") return arcHoles(d, count, 360 / count, 0);
  const yr = paramRange(iface, "hole_spacing_y");
  if (yr && yr[1] - yr[0] > HOLE_TOLERANCE_MM) return undefined;
  const y = yr?.[0] ?? d;
  if (shape === "cross") return [[-d / 2, 0], [d / 2, 0], [0, -y / 2], [0, y / 2]];
  if (shape === "rectangle" && y <= HOLE_TOLERANCE_MM) return count <= 2 ? [[-d / 2, 0], [d / 2, 0]] : undefined;
  return [[-d / 2, -y / 2], [d / 2, -y / 2], [d / 2, y / 2], [-d / 2, y / 2]];
}

/**
 * Whether every hole of `small` lands on a hole of `large` under one rigid
 * motion of the plane (a rotation and a shift, or their mirror image),
 * within `tol`. Two holes of `small` fix the motion: its first hole and the
 * one farthest from it go onto every pair of `large` holes as far apart.
 */
export function holesFitOn(small: [number, number][], large: [number, number][], tol = HOLE_TOLERANCE_MM): boolean {
  if (small.length === 0) return true;
  if (small.length > large.length) return false;
  if (small.length === 1) return large.length > 0;
  const cell = Math.max(tol * 4, 0.5);
  const key = (x: number, y: number) => `${Math.round(x / cell)},${Math.round(y / cell)}`;
  const index = new Map<string, [number, number][]>();
  for (const p of large) {
    const k = key(p[0], p[1]);
    index.set(k, [...(index.get(k) ?? []), p]);
  }
  const has = (x: number, y: number) => {
    const [i, j] = [Math.round(x / cell), Math.round(y / cell)];
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) for (const p of index.get(`${i + di},${j + dj}`) ?? []) if (Math.hypot(p[0] - x, p[1] - y) <= tol) return true;
    return false;
  };
  const s0 = small[0];
  let s1 = small[1];
  for (const p of small) if (Math.hypot(p[0] - s0[0], p[1] - s0[1]) > Math.hypot(s1[0] - s0[0], s1[1] - s0[1])) s1 = p;
  const d = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
  for (const mirror of [false, true]) {
    const pts = small.map(([x, y]) => [x - s0[0], mirror ? -(y - s0[1]) : y - s0[1]] as [number, number]);
    const v = [s1[0] - s0[0], mirror ? -(s1[1] - s0[1]) : s1[1] - s0[1]];
    const aS = Math.atan2(v[1], v[0]);
    for (const li of large) {
      for (const lj of large) {
        if (li === lj || Math.abs(Math.hypot(lj[0] - li[0], lj[1] - li[1]) - d) > tol) continue;
        const rot = Math.atan2(lj[1] - li[1], lj[0] - li[0]) - aS;
        const [c, s] = [Math.cos(rot), Math.sin(rot)];
        if (pts.every(([x, y]) => has(li[0] + c * x - s * y, li[1] + s * x + c * y))) return true;
      }
    }
  }
  return false;
}

const describeHoles = (iface: InterfaceDef) => {
  const t = traitParams(iface, "bolt_pattern") ?? {};
  const n = paramNum(iface, "hole_count");
  if (t.shape === "grid") return `a ${t.lattice} grid of ${n} holes (pitch ${fmtRange(paramRange(iface, "hole_pitch") ?? [0, 0])} mm)`;
  if (t.shape === "arc") return `a partial circle of ${n} holes on Ø${fmtRange(paramRange(iface, "hole_spacing") ?? [0, 0])} mm`;
  return `a ${t.shape} pattern`;
};

function boltHoles(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!holeRule(a, b)) return [];
  const problem = (why: string): Diagnostic[] => [{ severity: "error", code: "bolt_pattern_holes", message: `${describeHoles(a)} does not line up with ${describeHoles(b)}: ${why}`, refs: [a.id, b.id] }];
  const slotSide = [a, b].find((x) => traitParams(x, "bolt_pattern")?.shape === "slot");
  if (slotSide) {
    const other = slotSide === a ? b : a;
    if (traitParams(other, "bolt_pattern")?.shape === "grid") {
      return [{ severity: "info", code: "bolt_pattern_holes", message: "fasteners go into the slot through one line of the grid's holes", refs: [a.id, b.id] }];
    }
    return problem("a partial circle's holes are not on one line");
  }
  const [ha, hb] = [patternHoles(a), patternHoles(b)];
  if (!ha || !hb) return [];
  const [small, large] = ha.length <= hb.length ? [ha, hb] : [hb, ha];
  if (holesFitOn(small, large)) return [];
  return problem(`the ${small.length} holes of one do not all land on the other's ${large.length}`);
}

function lineOf(iface: InterfaceDef): Line {
  const t = traitParams(iface, "bolt_pattern") ?? {};
  const shape = String(t.shape);
  if (shape === "row") {
    return { kind: "row", pitch: paramRange(iface, "hole_pitch") ?? [0, 0], count: paramRange(iface, "hole_count")?.[0] ?? 2 };
  }
  if (shape === "slot") {
    return { kind: "slot", length: paramRange(iface, "slot_length")?.[1] ?? 0, ...(t.slot_kind !== undefined ? { slotKind: String(t.slot_kind) } : {}) };
  }
  const y = paramRange(iface, "hole_spacing_y");
  const x = paramRange(iface, "hole_spacing");
  if (shape === "rectangle" && x && y && y[1] <= HOLE_TOLERANCE_MM) {
    // the older encodings: a slot as a spacing range from 0, a row as its two end holes
    if (x[0] <= HOLE_TOLERANCE_MM && x[1] > HOLE_TOLERANCE_MM) return { kind: "slot", length: x[1] };
    return { kind: "row", pitch: x, count: 2 };
  }
  return { kind: "plane", shape };
}

const span = (r: { pitch: [number, number]; count: number }) => r.pitch[0] * (r.count - 1);

/** Whether every hole of row s lands on a hole of row l. */
function rowOnRow(s: { pitch: [number, number]; count: number }, l: { pitch: [number, number]; count: number }): boolean {
  const fixed = l.pitch[1] - l.pitch[0] <= HOLE_TOLERANCE_MM;
  if (!fixed) return s.count <= 2 && overlaps(s.pitch, l.pitch); // two holes slotted to any spacing in the range
  const p = l.pitch[0];
  if (s.count <= 1) return true;
  for (let k = 1; (s.count - 1) * k <= l.count - 1; k++) {
    if (overlaps(s.pitch, [k * p, k * p])) return true;
  }
  return false;
}

const describeLine = (l: Line) =>
  l.kind === "row"
    ? `a ${l.count}-hole row (pitch ${fmtRange(l.pitch)} mm)`
    : l.kind === "slot"
      ? `a ${+l.length.toFixed(2)} mm ${l.slotKind === "t_slot" ? "T-slot" : l.slotKind === "through" ? "through slot" : "slot"}`
      : `a ${l.shape} pattern`;

function boltLine(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!lineRule(a, b)) return [];
  const la = lineOf(a);
  const lb = lineOf(b);
  const problem = (why: string): Diagnostic[] => [
    { severity: "error", code: "bolt_pattern_line", message: `${describeLine(la)} does not line up with ${describeLine(lb)}: ${why}`, refs: [a.id, b.id] },
  ];
  if (la.kind === "plane" || lb.kind === "plane") return problem("a row's or a slot's holes lie on one line and the other pattern's do not");
  if (la.kind === "slot" && lb.kind === "slot") {
    return la.slotKind === "t_slot" && lb.slotKind === "t_slot" ? problem("neither T-slot has a hole for the fastener; join them with a bracket") : [];
  }
  if (la.kind === "slot" || lb.kind === "slot") {
    const [slot, row] = (la.kind === "slot" ? [la, lb] : [lb, la]) as [Extract<Line, { kind: "slot" }>, Extract<Line, { kind: "row" }>];
    return span(row) <= slot.length + HOLE_TOLERANCE_MM ? [] : problem(`the row spans ${+span(row).toFixed(2)} mm, longer than the slot`);
  }
  const [ra, rb] = [la, lb] as Extract<Line, { kind: "row" }>[];
  if (rowOnRow(ra, rb) || rowOnRow(rb, ra)) return [];
  return problem("the holes of neither row land on the other's (pitch not a whole multiple, or the row is longer)");
}

// ---------------------------------------------------------------------------
// Shafts and bores
// ---------------------------------------------------------------------------

/** For a shaft profile, the bore profiles it goes into: "ok", or "warn" when it fits without the key carrying torque. */
const SHAFT_FITS: Record<string, Record<string, "ok" | "warn">> = {
  round: { round: "ok", keyed: "warn" },
  hex: { hex: "ok" },
  rounded_hex: { hex: "ok", rounded_hex: "ok" },
  d_cut: { d_cut: "ok", round: "ok" },
  double_d: { double_d: "ok", d_cut: "ok", round: "ok" },
  keyed: { keyed: "ok", round: "warn" },
  spline: { spline: "ok" },
  square: { square: "ok" },
};

const normSpline = (s: unknown) => String(s).replace(/[\s_-]/g, "").toLowerCase();
const profileName = (p: unknown) => String(p).replace(/_/g, "-");

/** A bore that clamps on another profile (Shaft `clampsOn`) against a shaft: [bore, shaft], or undefined. */
function clampFit(a: InterfaceDef, b: InterfaceDef): [InterfaceDef, InterfaceDef] | undefined {
  if (!a.protocols.some((p) => p.type === "shaft") || !b.protocols.some((p) => p.type === "shaft")) return undefined;
  for (const [bore, shaft] of [[a, b], [b, a]] as const) {
    if (traitParams(bore, "shaft")?.clamps_on !== undefined && traitParams(shaft, "shaft")?.gender !== "bore") return [bore, shaft];
  }
  return undefined;
}

function shaftFit(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const ta = traitParams(a, "shaft");
  const tb = traitParams(b, "shaft");
  if (!a.protocols.some((p) => p.type === "shaft") || !b.protocols.some((p) => p.type === "shaft")) return [];
  const diag = (severity: "error" | "warning" | "info", why: string): Diagnostic[] => [{ severity, code: "shaft_fit", message: why, refs: [a.id, b.id] }];
  const clamp = clampFit(a, b);
  if (clamp) {
    const [bore, shaft] = clamp;
    const on = traitParams(bore, "shaft")!.clamps_on as { profile: string; diameter_mm: number; by: string };
    const profile = traitParams(shaft, "shaft")?.profile;
    const d = paramRange(shaft, "shaft_diameter");
    const boreD = paramRange(bore, "shaft_diameter");
    const sameProfile = profile === undefined || profile === on.profile || (on.profile === "hex" && profile === "rounded_hex");
    if (sameProfile && d && overlaps(d, [on.diameter_mm, on.diameter_mm])) {
      return diag("info", `the Ø${boreD ? fmtRange(boreD) : "?"} mm round bore goes over the ${on.diameter_mm} mm ${profileName(on.profile)} shaft and is held by ${String(on.by).replace(/_/g, " ")}`);
    }
    if (profile === "round" && d && boreD && overlaps(d, boreD)) return []; // it is still a round bore
    return diag("error", `the bore clamps on a ${on.diameter_mm} mm ${profileName(on.profile)} shaft, not a ${d ? fmtRange(d) : "?"} mm ${profileName(profile ?? "unstated")} one`);
  }
  const [ga, gb] = [ta?.gender, tb?.gender];
  if (ga !== undefined && ga === gb) return diag("error", ga === "shaft" ? "two shafts do not mate without a coupler" : "two bores need a shaft between them");
  const [pa, pb] = [ta?.profile, tb?.profile];
  if (pa === undefined || pb === undefined) return [];
  if (pa === "spline" && pb === "spline" && ta?.spline !== undefined && tb?.spline !== undefined && normSpline(ta.spline) !== normSpline(tb.spline)) {
    return diag("error", `different splines (${ta.spline} and ${tb.spline})`);
  }
  // which side is the shaft: from either gender; with neither stated, the better fit of the two readings
  const aIsShaft = ga === "shaft" || gb === "bore" ? true : gb === "shaft" || ga === "bore" ? false : undefined;
  const fits = (shaft: unknown, bore: unknown) => SHAFT_FITS[String(shaft)]?.[String(bore)];
  const fit =
    aIsShaft === true ? fits(pa, pb) : aIsShaft === false ? fits(pb, pa) : fits(pa, pb) === "ok" || fits(pb, pa) === "ok" ? "ok" : (fits(pa, pb) ?? fits(pb, pa));
  const [shaftP, boreP] = aIsShaft === false ? [pb, pa] : [pa, pb];
  if (fit === "ok") return [];
  if (fit === "warn") {
    return diag(
      "warning",
      boreP === "keyed"
        ? `a round shaft in a keyed bore: the keyway is unused, so torque relies on a set screw or clamp`
        : `a keyed shaft in a round bore: it fits without its key, so torque relies on a set screw or clamp`,
    );
  }
  return diag("error", `a ${profileName(shaftP)} shaft does not fit a ${profileName(boreP)} bore`);
}

// ---------------------------------------------------------------------------
// Linear motion and supply current: an output's rating against what the input needs
// ---------------------------------------------------------------------------

const hasRoleIn = (iface: InterfaceDef, roles: Set<string>, protocol?: string) =>
  iface.protocols.some((p) => (protocol === undefined || p.type === protocol) && p.roles.some((r) => roles.has(r.toLowerCase())));

/** A parameter's value in its base unit (A for mA), or undefined. "low" takes a range's lower end, "high" its upper end. */
function amount(iface: InterfaceDef, id: string, end: "low" | "high"): number | undefined {
  const p = iface.parameters?.find((x) => x.id === id);
  const r = p && getEffectiveRange(p);
  if (!r) return undefined;
  const v = end === "low" ? r[0] : r[1];
  return p!.unit === "mA" ? v / 1000 : v;
}

const fmtNum = (v: number) => `${+v.toFixed(3)}`;

function linearCapacity(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const out: Diagnostic[] = [];
  const OUTPUT = new Set(["output"]);
  const INPUT = new Set(["input"]);
  for (const [o, load] of [[a, b], [b, a]] as const) {
    if (!hasRoleIn(o, OUTPUT, "linear_motion") || !hasRoleIn(load, INPUT, "linear_motion")) continue;
    for (const [id, what, unit] of [["stroke", "stroke", "mm"], ["force", "force", "N"]] as const) {
      const need = amount(load, id, "low");
      if (need === undefined) continue;
      const give = amount(o, id, "high");
      if (give === undefined) {
        out.push({ severity: "info", code: "linear_motion_capacity", message: `the load needs ${fmtNum(need)} ${unit} of ${what}; the output states no ${what}, so it cannot be checked`, refs: [o.id, load.id] });
      } else if (give + 1e-9 < need) {
        out.push({ severity: "error", code: "linear_motion_capacity", message: `the output gives ${fmtNum(give)} ${unit} of ${what}, less than the ${fmtNum(need)} ${unit} the load needs`, refs: [o.id, load.id] });
      }
    }
  }
  return out;
}

const SUPPLYING = new Set(["output", "source"]);

function supplyCurrent(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [load, source] of [[a, b], [b, a]] as const) {
    const need = amount(load, "min_supply_current", "low");
    if (need === undefined || !hasRoleIn(source, SUPPLYING)) continue;
    const rating = amount(source, "max_current", "high");
    if (rating === undefined) {
      out.push({ severity: "info", code: "supply_current_rating", message: `${load.id} needs a source rated for at least ${fmtNum(need)} A; ${source.id} states no current rating`, refs: [source.id, load.id] });
    } else if (rating + 1e-9 < need) {
      out.push({ severity: "error", code: "supply_current_rating", message: `${source.id} is rated for ${fmtNum(rating)} A; ${load.id} needs a source rated for at least ${fmtNum(need)} A`, refs: [source.id, load.id] });
    }
  }
  return out;
}
