/**
 * Fastener joints and their tightening torques (PB-797).
 *
 * A joint is a harness module with a `fastenerStack`. `jointTorques` lists
 * the torqued items of each; the fastener_torque rule reports joints with no
 * torque, and torques that cite neither a source nor an assumption.
 */
import type { FastenerTorque } from "../types/geometry.js";
import type { ModuleDef } from "../types/module.js";
import type { ModuleLookup } from "./index.js";
import type { SystemDiagnostic } from "./checks.js";

export interface JointTorque {
  /** Harness module id. */
  harness: string;
  /** Index into the harness's fastenerStack (for value queries). */
  index: number;
  /** Stack child id and the part it places. */
  child: string;
  part?: ModuleDef;
  torque: FastenerTorque;
  basis: "source" | "assumption" | "unsupported";
}

/** Torqued items of one fastener harness. */
export function jointTorques(harness: ModuleDef, lookup: ModuleLookup): JointTorque[] {
  return (harness.fastenerStack ?? []).flatMap((item, index) => {
    if (!item.torque) return [];
    const ref = harness.children?.find((c) => c.id === item.child);
    const basis = item.torque.source ? "source" : item.torque.assumption ? "assumption" : "unsupported";
    return [{ harness: harness.id, index, child: item.child, part: ref ? lookup(ref.moduleDefId) : undefined, torque: item.torque, basis } as JointTorque];
  });
}

/** Every fastener harness under a system (by definition, once each) with the instance paths that use it. */
export function fastenerHarnesses(system: ModuleDef, lookup: ModuleLookup): { def: ModuleDef; paths: string[] }[] {
  const byId = new Map<string, { def: ModuleDef; paths: string[] }>();
  const visit = (d: ModuleDef, prefix: string[]) => {
    for (const c of d.children ?? []) {
      const def = lookup(c.moduleDefId);
      if (!def) continue;
      const path = [...prefix, c.id];
      if (def.fastenerStack?.length) {
        const e = byId.get(def.id) ?? { def, paths: [] };
        e.paths.push(path.join("/"));
        byId.set(def.id, e);
      }
      visit(def, path);
    }
  };
  visit(system, []);
  return [...byId.values()];
}

const fmtNm = (n: number) => `${Number(n.toFixed(2))} N·m`;

/** System rule: every fastener joint states a torque, and each torque says where it comes from. */
export function fastenerTorqueRule(system: ModuleDef, lookup: ModuleLookup): SystemDiagnostic[] {
  const out: SystemDiagnostic[] = [];
  const summary: string[] = [];
  let assumed = 0;
  for (const { def, paths } of fastenerHarnesses(system, lookup)) {
    const torques = jointTorques(def, lookup);
    if (!torques.length) {
      out.push({ id: `fastener_torque:${def.id}`, rule: "fastener_torque", severity: "warning", message: `${def.name}: no tightening torque on any part of its fastener stack.`, refs: paths });
      continue;
    }
    for (const t of torques) {
      if (t.basis === "unsupported") {
        out.push({
          id: `fastener_torque:${def.id}:${t.index}`,
          rule: "fastener_torque",
          severity: "error",
          message: `${def.name}: ${t.child} torque ${fmtNm(t.torque.torqueNm)} cites no source and states no assumption.`,
          refs: paths,
        });
      }
      if (t.basis === "assumption") assumed++;
    }
    summary.push(`${def.name} ${[...new Set(torques.map((t) => fmtNm(t.torque.torqueNm)))].join("/")}`);
  }
  if (summary.length) {
    out.push({
      id: "fastener_torque:summary",
      rule: "fastener_torque",
      severity: "info",
      message: `${summary.length} fastener joint(s) have a torque${assumed ? ` (${assumed} assumed, not stated by a maker)` : ""}: ${summary.join("; ")}.`,
      refs: [],
      details: { joints: summary.length, assumed },
    });
  }
  return out;
}
