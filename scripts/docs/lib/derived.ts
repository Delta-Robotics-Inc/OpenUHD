/**
 * Named derivations (`derived:<name>` queries). Each lists the model queries
 * it reads, so a document can show the formula and inputs, and the verifier
 * can recompute it. Derivations find modules by what they are (category),
 * so they work for any system that has the parts, not just the quadcopter.
 */
import type { ModuleDef } from "../../../src/types/index.js";
import { fullThrottle, thrustTests } from "../../../src/system/propulsion.js";
import { category } from "./model.js";
import type { DerivedDef, DocContext } from "./values.js";

const weightOf = (d: ModuleDef): number | undefined => d.domains?.find((x) => x.domain === "mechanical")?.weight_g;

/** Leaf module instances plus placed hardware, as (instance label, def) pairs. */
export function massItems(ctx: DocContext): { path: string; def: ModuleDef }[] {
  const items = ctx.scene.assembly.instances.filter((i) => i.kind === "module").map((i) => ({ path: i.path.join("/"), def: i.def }));
  for (const h of ctx.scene.hardware) items.push({ path: h.key, def: h.def });
  return items;
}

export function massBreakdown(ctx: DocContext) {
  const groups = new Map<string, { def: ModuleDef; count: number; weight?: number }>();
  for (const it of massItems(ctx)) {
    const g = groups.get(it.def.id) ?? { def: it.def, count: 0, weight: weightOf(it.def) };
    g.count++;
    groups.set(it.def.id, g);
  }
  return [...groups.values()];
}

const motors = (ctx: DocContext) => ctx.scene.assembly.instances.filter((i) => i.kind === "module" && category(i.def) === "motor");
const firstOf = (ctx: DocContext, cat: string) => ctx.scene.assembly.instances.find((i) => i.kind === "module" && category(i.def) === cat)?.def;

export const DERIVED: Record<string, DerivedDef> = {
  "mass.known_total": {
    label: "Mass of parts with a stated weight",
    unit: "g",
    formula: "∑ (count × domains[mechanical].weight_g) over leaf instances and placed hardware",
    compute: (ctx) => {
      const b = massBreakdown(ctx).filter((g) => g.weight !== undefined);
      return {
        value: Number(b.reduce((s, g) => s + g.count * g.weight!, 0).toFixed(2)),
        inputs: b.map((g) => `def:${g.def.id}:domains[domain=mechanical].weight_g`),
      };
    },
  },
  "mass.missing_count": {
    label: "Parts without a stated weight",
    formula: "count of leaf instances and placed hardware whose definition has no weight_g",
    compute: (ctx) => {
      const b = massBreakdown(ctx).filter((g) => g.weight === undefined);
      return { value: b.reduce((s, g) => s + g.count, 0), inputs: [], note: b.map((g) => `${g.def.id} ×${g.count}`).join(", ") };
    },
  },
  "propulsion.motor_count": {
    label: "Motors",
    formula: "count of motor instances",
    compute: (ctx) => ({ value: motors(ctx).length, inputs: [] }),
  },
  "propulsion.thrust_full_total": {
    label: "Static thrust, all motors at full throttle",
    unit: "g",
    formula: "motors × performance.thrust_tests[0].rows[throttle_pct=100].thrust_g",
    compute: (ctx) => {
      const m = motors(ctx);
      const d = m[0]?.def;
      const t = d && thrustTests(d)[0];
      const top = t ? fullThrottle(t) : undefined;
      return {
        value: top ? m.length * top.thrust_g : undefined,
        inputs: d && top ? [`def:${d.id}:traits[type=performance].params.thrust_tests[0].rows[throttle_pct=${top.throttle_pct}].thrust_g`] : [],
        note: t ? `manufacturer table with ${t.propeller} at ${t.supply_V} V (not the fitted propeller)` : "no thrust test in the motor model",
      };
    },
  },
  "propulsion.current_full_total": {
    label: "Static current, all motors at full throttle",
    unit: "A",
    formula: "motors × performance.thrust_tests[0].rows[throttle_pct=100].current_A",
    compute: (ctx) => {
      const m = motors(ctx);
      const d = m[0]?.def;
      const t = d && thrustTests(d)[0];
      const top = t ? fullThrottle(t) : undefined;
      return {
        value: top ? Number((m.length * top.current_A).toFixed(2)) : undefined,
        inputs: d && top ? [`def:${d.id}:traits[type=performance].params.thrust_tests[0].rows[throttle_pct=${top.throttle_pct}].current_A`] : [],
      };
    },
  },
  "power.battery_c_ratio_peak": {
    label: "Peak propulsion current / battery continuous rating",
    formula: "checks propulsion_current totalPeak ÷ battery max_current",
    compute: (ctx) => {
      const d = ctx.checks.diagnostics.find((x) => x.rule === "propulsion_current");
      const det = (d as any)?.details;
      return {
        value: det ? Number((det.totalPeak / det.cont).toFixed(3)) : undefined,
        inputs: ["sys:checks.diagnostics[rule=propulsion_current].details.totalPeak", "sys:checks.diagnostics[rule=propulsion_current].details.cont"],
      };
    },
  },
  "power.battery_energy_Wh": {
    label: "Battery energy",
    unit: "Wh",
    formula: "battery voltage × capacity",
    compute: (ctx) => {
      const b = firstOf(ctx, "battery");
      const out = b?.interfaces.find((i) => i.parameters?.some((p) => p.id === "capacity"));
      const v = out?.parameters?.find((p) => p.id === "voltage")?.value;
      const c = out?.parameters?.find((p) => p.id === "capacity")?.value;
      return {
        value: v !== undefined && c !== undefined ? Number(((v * c) / 1000).toFixed(2)) : undefined,
        inputs: b && out ? [`def:${b.id}:interfaces[id=${out.id}].parameters[id=voltage].value`, `def:${b.id}:interfaces[id=${out.id}].parameters[id=capacity].value`] : [],
      };
    },
  },
  frameDistance: {
    label: "Distance between two interface frames in the assembly",
    unit: "mm",
    formula: "|placement(a) · a.frame.origin − placement(b) · b.frame.origin| from assemble()",
    compute: (ctx, args = []) => {
      const pts = args.map((spec) => {
        const dot = spec.lastIndexOf(".");
        const path = spec.slice(0, dot);
        const id = spec.slice(dot + 1);
        const body = ctx.scene.bodies.find((b) => b.path.join("/") === path && b.def.interfaces.some((i) => i.id === id && i.geometry?.frame));
        const f = body?.def.interfaces.find((i) => i.id === id)?.geometry?.frame;
        if (!body || !f) return undefined;
        const m = body.matrix;
        const o = f.origin;
        return [m[0] * o[0] + m[1] * o[1] + m[2] * o[2] + m[3], m[4] * o[0] + m[5] * o[1] + m[6] * o[2] + m[7], m[8] * o[0] + m[9] * o[1] + m[10] * o[2] + m[11]];
      });
      const [a, b] = pts;
      const inst = (spec: string) => {
        const dot = spec.lastIndexOf(".");
        const path = spec.slice(0, dot);
        const id = spec.slice(dot + 1);
        return `inst:${path}:interfaces[id=${id}].geometry.frame.origin`;
      };
      return {
        value: a && b ? Number(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(2)) : undefined,
        inputs: args.map(inst),
      };
    },
  },
  diagCount: {
    label: "Design-check diagnostics of one severity in a scenario",
    formula: "count of checkSystem(scenario).diagnostics with the severity",
    compute: (ctx, args = []) => {
      const [scenario, severity] = args;
      const s = ctx.scenarioChecks.find((x) => x.id === scenario);
      return { value: s ? s.diagnostics.filter((d) => d.severity === severity).length : undefined, inputs: [`sys:scenarios[id=${scenario}].diagnostics`] };
    },
  },
  "mech.hardware_count": {
    label: "Fasteners and spacers placed by the assembly",
    formula: "assemble().hardware.length",
    compute: (ctx) => ({ value: ctx.scene.assembly.hardware.length, inputs: ["sys:assembly.hardware"] }),
  },
};
