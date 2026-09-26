/**
 * Spin direction and propeller handedness (PB-797).
 *
 * Spin is instance data (`ChildModuleRef.spin`), inherited down the child
 * tree: an arm instance can say "ccw" once for its motor and prop. A handed
 * part (a `handedness` trait) takes the variant named by its resolved spin.
 * The prop_handedness rule walks every link at every depth that joins a
 * shaft output (the motor) to a handed shaft input (the prop) and compares
 * the two.
 */
import type { HandednessTrait } from "../types/trait.js";
import type { ModuleDef, SpinDirection } from "../types/module.js";
import type { ModuleLookup } from "./index.js";
import type { SystemDiagnostic } from "./checks.js";

export interface SpinInstance {
  /** Instance path below the root, e.g. "arm_fr/motor". */
  path: string;
  def: ModuleDef;
  spin?: SpinDirection;
  /** Path of the child ref that set the spin (itself or an ancestor). */
  setAt?: string;
}

/** Resolved spin of every instance below `system` (any depth). */
export function resolveSpins(system: ModuleDef, lookup: ModuleLookup): Map<string, SpinInstance> {
  const out = new Map<string, SpinInstance>();
  const visit = (d: ModuleDef, prefix: string[], inherited?: { spin: SpinDirection; at: string }) => {
    for (const c of d.children ?? []) {
      const def = lookup(c.moduleDefId);
      if (!def) continue;
      const path = [...prefix, c.id];
      const key = path.join("/");
      const own = c.spin ? { spin: c.spin, at: key } : inherited;
      out.set(key, { path: key, def, spin: own?.spin, setAt: own?.at });
      visit(def, path, own);
    }
  };
  visit(system, []);
  return out;
}

export function handedness(def: ModuleDef): HandednessTrait["params"] | undefined {
  const t = def.traits?.find((x) => x.type === "handedness");
  return t ? (t.params as HandednessTrait["params"]) : undefined;
}

const hasRole = (def: ModuleDef, ifaceId: string, role: string) =>
  def.interfaces.find((i) => i.id === ifaceId)?.protocols.some((p) => p.type === "shaft" && p.roles.includes(role)) ?? false;

export interface PropMount {
  /** Link id, prefixed with the owning instance path ("arm_fr/prop_on_shaft"). */
  linkId: string;
  motor: SpinInstance;
  prop: SpinInstance;
  variants: SpinDirection[];
}

/** Every link joining a shaft output to a handed part, at any depth. */
export function propMounts(system: ModuleDef, lookup: ModuleLookup): PropMount[] {
  const spins = resolveSpins(system, lookup);
  const out: PropMount[] = [];
  const visit = (d: ModuleDef, prefix: string[]) => {
    for (const link of d.links ?? []) {
      if (!("child" in link.a) || !("child" in link.b)) continue;
      const ends = [link.a, link.b].map((e) => {
        const key = [...prefix, (e as { child: string }).child].join("/");
        return { e, inst: spins.get(key) };
      });
      if (ends.some((x) => !x.inst)) continue;
      const propEnd = ends.find((x) => handedness(x.inst!.def));
      const motorEnd = ends.find((x) => x !== propEnd && hasRole(x.inst!.def, x.e.interfaceId, "output"));
      if (!propEnd || !motorEnd) continue;
      out.push({ linkId: [...prefix, link.id].join("/"), motor: motorEnd.inst!, prop: propEnd.inst!, variants: handedness(propEnd.inst!.def)!.variants });
    }
    for (const c of d.children ?? []) {
      const def = lookup(c.moduleDefId);
      if (def) visit(def, [...prefix, c.id]);
    }
  };
  visit(system, []);
  return out;
}

const word = (s: SpinDirection) => s.toUpperCase();

/** System rule: each motor's spin matches the handedness of the prop on it. */
export function propHandednessRule(system: ModuleDef, lookup: ModuleLookup): SystemDiagnostic[] {
  const out: SystemDiagnostic[] = [];
  const ok: string[] = [];
  for (const m of propMounts(system, lookup)) {
    const refs = [`link:${m.linkId}`, m.motor.path, m.prop.path];
    const id = `prop_handedness:${m.linkId}`;
    if (!m.motor.spin || !m.prop.spin) {
      const missing = [!m.motor.spin ? `${m.motor.path} (motor spin)` : "", !m.prop.spin ? `${m.prop.path} (prop variant)` : ""].filter(Boolean);
      out.push({ id, rule: "prop_handedness", severity: "warning", message: `${m.linkId}: no spin set for ${missing.join(" and ")}, so the prop cannot be checked against its motor.`, refs });
      continue;
    }
    if (!m.variants.includes(m.prop.spin)) {
      out.push({ id, rule: "prop_handedness", severity: "error", message: `${m.prop.path}: ${m.prop.def.name} is not made in a ${word(m.prop.spin)} variant (${m.variants.map(word).join("/")}).`, refs });
      continue;
    }
    if (m.motor.spin !== m.prop.spin) {
      out.push({
        id,
        rule: "prop_handedness",
        severity: "error",
        message: `${m.linkId}: ${word(m.prop.spin)} prop on a motor spinning ${word(m.motor.spin)} (${m.motor.path}); it would push air the wrong way. Fit the ${word(m.motor.spin)} prop.`,
        refs,
        details: { motor: m.motor.spin, prop: m.prop.spin },
      });
      continue;
    }
    ok.push(`${m.motor.path} ${word(m.motor.spin)}`);
  }
  if (ok.length) {
    out.push({ id: "prop_handedness:ok", rule: "prop_handedness", severity: "info", message: `${ok.length} prop(s) match their motor's spin: ${ok.join(", ")}.`, refs: [] });
  }
  return out;
}
