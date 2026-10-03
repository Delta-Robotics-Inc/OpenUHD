import type { InterfaceDef } from "../types/interface.js";
import type { Diagnostic } from "./types.js";

/**
 * Pair checks on how two matched interfaces physically join, beyond their
 * protocols and parameters:
 *
 * - `fluid_joint_mismatch`: two fluid ports (FluidPort's `fluid_joint`
 *   trait) whose joints do not mate. Threads need the same standard (NPT and
 *   NPTF count as one) and size and opposite genders; a push-to-connect
 *   fitting or a hose barb takes a tube; quick couplers need the same style
 *   and opposite genders. Tube diameters are checked as parameters.
 * - `bolt_pattern_shape`: a cross bolt pattern (two diagonals, BoltPattern
 *   shape "cross") against a pattern of another shape. Square, rectangle and
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
const normSize = (s: unknown) => String(s ?? "").replace(/["″\s]/g, "").toLowerCase();

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
    if (normSize(ja.size) !== normSize(jb.size)) return problem("different thread sizes");
  }
  if (ja.kind === "quick_coupler" && String(ja.style).toLowerCase() !== String(jb.style).toLowerCase()) return problem("different coupler styles");
  if ((ja.kind === "thread" || ja.kind === "quick_coupler") && ja.gender === jb.gender) return problem(`both are ${ja.gender}`);
  if ((ja.kind === "barb" || jb.kind === "barb") && ![a, b].every((x) => x.parameters?.some((p) => p.id === "tube_id"))) {
    return [{ severity: "warning", code: "fluid_joint_mismatch", message: "a hose barb's fit cannot be checked: the tube states no inside diameter", refs: [a.id, b.id] }];
  }
  return [];
}

function boltShape(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const sa = traitParams(a, "bolt_pattern")?.shape;
  const sb = traitParams(b, "bolt_pattern")?.shape;
  if (sa === undefined || sb === undefined || sa === sb) return [];
  if (sa !== "cross" && sb !== "cross") return [];
  return [
    {
      severity: "error",
      code: "bolt_pattern_shape",
      message: `a ${sa} bolt pattern does not line up with a ${sb} one`,
      refs: [a.id, b.id],
    },
  ];
}
