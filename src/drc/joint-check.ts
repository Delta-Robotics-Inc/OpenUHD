import type { InterfaceDef } from "../types/interface.js";
import type { Diagnostic } from "./types.js";
import { getEffectiveRange } from "../parameters/range.js";

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
 */
export function checkPairJoints(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  return [...fluidJoint(a, b), ...boltShape(a, b)];
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
