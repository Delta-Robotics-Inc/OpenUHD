/**
 * Named derivations (`derived:<name>` queries). Each lists the model queries
 * it reads, so a document can show the formula and inputs, and the verifier
 * can recompute it. Derivations find modules by what they are (category),
 * so they work for any system that has the parts, not just the quadcopter.
 */
import type { ModuleDef } from "../../../src/types/index.js";
import { fullThrottle, thrustTests } from "../../../src/system/propulsion.js";
import { massByDefinition, moduleMass, systemMass, type ModuleMass, type SystemMass } from "../../../src/system/mass.js";
import { cadVolumeMm3 } from "../../../library/cad/manifests.js";
import { category } from "./model.js";
import type { DerivedDef, DocContext } from "./values.js";

/** System mass from the model (src/system/mass.ts): stated weights, else CAD volume × material density. */
export function modelMass(ctx: DocContext): SystemMass {
  return systemMass(ctx.sys.system, ctx.sys.lookup, cadVolumeMm3);
}

/** Model queries a module's mass rests on. */
function massInputs(def: ModuleDef, m?: ModuleMass): string[] {
  if (!m) return [];
  if (m.basis === "stated") return [`def:${def.id}:domains[domain=mechanical].weight_g`];
  return [`def:${def.id}:domains[domain=mechanical].material.density_g_cm3`];
}

const motors = (ctx: DocContext) => ctx.scene.assembly.instances.filter((i) => i.kind === "module" && category(i.def) === "motor");
const firstOf = (ctx: DocContext, cat: string) => ctx.scene.assembly.instances.find((i) => i.kind === "module" && category(i.def) === cat)?.def;

export const DERIVED: Record<string, DerivedDef> = {
  "mass.all_up": {
    label: "All-up weight of parts with a mass in the model",
    unit: "g",
    formula: "systemMass: ∑ quantity × (weight_g, else CAD volume × material density) over every instance; instances with neither are listed, not guessed",
    compute: (ctx) => {
      const m = modelMass(ctx);
      const groups = massByDefinition(m).filter((g) => g.mass);
      return {
        value: Number(m.totalG.toFixed(1)),
        inputs: groups.flatMap((g) => massInputs(g.def, g.mass)),
        note: m.missing.length ? `excludes ${m.missing.length} part(s) with no mass: ${m.missing.map((e) => e.def.name).join(", ")}; ${m.assumedG.toFixed(1)} g of it is computed from assumed material/geometry` : undefined,
      };
    },
  },
  "mass.assumed": {
    label: "Part of the all-up weight computed from assumed material or nominal geometry",
    unit: "g",
    formula: "∑ systemMass entries whose material carries an assumption",
    compute: (ctx) => {
      const m = modelMass(ctx);
      const groups = massByDefinition(m).filter((g) => g.mass?.assumed);
      return { value: Number(m.assumedG.toFixed(1)), inputs: groups.flatMap((g) => massInputs(g.def, g.mass)) };
    },
  },
  "mass.missing_count": {
    label: "Parts without a mass in the model",
    formula: "count (by quantity) of systemMass entries with no weight_g and no material + CAD volume",
    compute: (ctx) => {
      const m = modelMass(ctx);
      return { value: m.missing.reduce((s, e) => s + e.quantity, 0), inputs: [], note: m.missing.map((e) => `${e.def.name} (${e.path})`).join(", ") };
    },
  },
  "mass.module": {
    label: "Mass of one module",
    unit: "g",
    formula: "weight_g if stated, else CAD body volume (generator manifest) × domains[mechanical].material.density_g_cm3",
    compute: (ctx, args = []) => {
      const def = ctx.sys.lookup(args[0] ?? "");
      const m = def ? moduleMass(def, cadVolumeMm3) : undefined;
      return {
        value: m ? Number(m.massG.toFixed(m.massG < 1 ? 2 : 1)) : undefined,
        inputs: def ? massInputs(def, m) : [],
        note: m?.basis === "cad_volume" ? `${(m.volumeMm3! / 1000).toFixed(2)} cm³ × ${m.material!.density_g_cm3} g/cm³ (${m.material!.name})${m.assumed ? "; assumption: " + m.material!.assumption : ""}` : undefined,
      };
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
    formula: "motors × thrust_g of the top (100 %) row of the first thrust table",
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
    formula: "motors × current_A of the top (100 %) row of the first thrust table",
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
