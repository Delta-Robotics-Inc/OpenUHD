import type { InterfaceDef } from "../types/interface.js";
import type { ModuleDef } from "../types/module.js";
import type { DomainMetadata, PackageSpec } from "../types/domain.js";
import type { PassivePartNumberRule, PassiveTrait, TraitDef } from "../types/trait.js";
import { defineModule } from "./define-module.js";

/**
 * Two-terminal passives (PB-824): resistors, capacitors, inductors and
 * ferrite beads placed on a board.
 *
 * A passive is an ordinary module with two leaf terminals, `pin_1` and
 * `pin_2` (protocol `passive`, role `terminal`), and a `passive` trait with
 * its value. Terminals pair with nothing, so a passive on a net never makes a
 * functional link; checks that care (bus_pullup) read the trait.
 */
export const PASSIVE_PROTOCOL = "passive";

/** One terminal of a passive. */
export function PassiveTerminal(pin: number | string, name?: string): InterfaceDef {
  return {
    id: `pin_${pin}`,
    name: name ?? String(pin),
    pin,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: PASSIVE_PROTOCOL, roles: ["terminal"] }],
  };
}

export interface PassiveConfig {
  id: string;
  name: string;
  kind: PassiveTrait["params"]["kind"];
  value: number;
  unit: PassiveTrait["params"]["unit"];
  tolerance?: number;
  manufacturer?: string;
  part_number?: string;
  description?: string;
  /** Package (e.g. "0402", pin_count 2) and its body dimensions. */
  package?: PackageSpec;
  dimensions_mm?: DomainMetadata["dimensions_mm"];
  source?: string;
  assumption?: string;
  traits?: TraitDef[];
}

/** A two-terminal passive component as a module. */
export function Passive(config: PassiveConfig): ModuleDef {
  const trait: PassiveTrait = {
    type: "passive",
    params: {
      kind: config.kind,
      value: config.value,
      unit: config.unit,
      ...(config.tolerance !== undefined ? { tolerance: config.tolerance } : {}),
      ...(config.source ? { source: config.source } : {}),
      ...(config.assumption ? { assumption: config.assumption } : {}),
    },
  };
  const mechanical: DomainMetadata | undefined =
    config.package || config.dimensions_mm
      ? { domain: "mechanical", ...(config.dimensions_mm ? { dimensions_mm: config.dimensions_mm } : {}), ...(config.package ? { package: config.package } : {}) }
      : undefined;
  return defineModule({
    id: config.id,
    name: config.name,
    ...(config.manufacturer ? { manufacturer: config.manufacturer } : {}),
    ...(config.part_number ? { part_number: config.part_number } : {}),
    ...(config.description ? { description: config.description } : {}),
    categories: [`component.passive.${config.kind}`],
    interfaces: [PassiveTerminal(1), PassiveTerminal(2)],
    ...(mechanical ? { domains: [mechanical] } : {}),
    traits: [trait, ...(config.traits ?? [])],
  });
}

/** The keys of `ChildModuleRef.overrides` that a placement of a passive may set. */
export function overridableKeys(def: ModuleDef): string[] {
  const t = def.traits?.find((x) => x.type === "passive");
  return ((t?.params as PassiveTrait["params"] | undefined)?.overridable ?? []).slice();
}

/**
 * The `passive` trait of a module, if it is a passive, as one placement has
 * it: with `overrides` (`ChildModuleRef.overrides`) the instance's `value`
 * and `tolerance` replace the defaults. Overrides that the part does not
 * allow are ignored here; `passiveInstance` reports them.
 */
export function passiveOf(def: ModuleDef, overrides?: Record<string, unknown>): PassiveTrait["params"] | undefined {
  const t = def.traits?.find((x) => x.type === "passive");
  if (!t) return undefined;
  const params = t.params as PassiveTrait["params"];
  if (!overrides || !Object.keys(overrides).length) return params;
  const inst = passiveInstance(def, overrides)!;
  const { tolerance: _t, ...rest } = params;
  return { ...rest, value: inst.value, ...(inst.tolerance !== undefined ? { tolerance: inst.tolerance } : {}) };
}

/** One placement of a passive: its value, tolerance, MPN and parameters, and what is wrong with its overrides. */
export interface PassiveInstance {
  kind: PassiveTrait["params"]["kind"];
  value: number;
  unit: PassiveTrait["params"]["unit"];
  tolerance?: number;
  /**
   * The placement's manufacturer part number: the one the overrides name,
   * the one the series rule forms, or the definition's own for the default
   * instance. Undefined when none can be stated.
   */
  part_number?: string;
  /** Every parameter and choice of the instance, by id (series parts). */
  parameters: Record<string, number | string>;
  /** True when the overrides set anything. */
  overridden: boolean;
  /** Overrides the part does not allow or that disagree with the series. Empty when the placement is sound. */
  problems: string[];
}

/** The parameter that holds a passive's value, by kind. */
export const PASSIVE_VALUE_PARAMETER: Record<PassiveTrait["params"]["kind"], string> = {
  resistor: "resistance",
  capacitor: "capacitance",
  inductor: "inductance",
  ferrite_bead: "impedance_100mhz",
};

/**
 * Resolve one placement of a passive (`ChildModuleRef.overrides` on the
 * board's child) against its part:
 *
 *   - each key must be in the trait's `overridable`; a part with no series
 *     fields allows none;
 *   - a choice must be one of its values, a number within its parameter's
 *     series `range`;
 *   - the tolerance must be a grade of the series, and the value one that
 *     grade is made in; in a table series (`values`) the value must be a row,
 *     which also fixes the row's parameters;
 *   - the MPN is the named `part_number`, else the default for an unchanged
 *     placement, else formed by the part's `part_number.pattern`; a named or
 *     formed MPN must decode (`part_number.decode`) to the instance's own
 *     parameters.
 *
 * Pure: the rules are the part's data. Undefined for a module that is not a
 * passive.
 */
export function passiveInstance(def: ModuleDef, overrides: Record<string, unknown> = {}): PassiveInstance | undefined {
  const t = def.traits?.find((x) => x.type === "passive");
  if (!t) return undefined;
  const s = t.params as PassiveTrait["params"];
  const problems: string[] = [];
  const valueId = PASSIVE_VALUE_PARAMETER[s.kind];
  const overridable = s.overridable ?? [];
  const parameters: Record<string, number | string> = {};
  for (const p of s.parameters ?? []) if (p.value !== undefined) parameters[p.id] = p.value;
  for (const [id, c] of Object.entries(s.choices ?? {})) parameters[id] = c.default;
  if (parameters[valueId] === undefined) parameters[valueId] = s.value;
  if (s.tolerance !== undefined) parameters.tolerance = s.tolerance;

  const applied: string[] = [];
  for (const [key, v] of Object.entries(overrides)) {
    if (!overridable.includes(key)) {
      problems.push(
        overridable.length
          ? `${key} is not an instance parameter of ${def.id} (overridable: ${overridable.join(", ")})`
          : `${key}: ${def.id} is a fixed-value part; a placement cannot override it (use another part)`,
      );
      continue;
    }
    applied.push(key);
    if (key === "part_number") {
      if (typeof v !== "string" || !v) problems.push("part_number must be a non-empty string");
      continue;
    }
    const choice = s.choices?.[key];
    if (choice) {
      if (typeof v !== "string" || !choice.values.includes(v)) problems.push(`${key} ${JSON.stringify(v)} is not one of ${choice.values.join(", ")}`);
      else parameters[key] = v;
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) {
      problems.push(`${key} must be a number`);
      continue;
    }
    const param = s.parameters?.find((p) => p.id === key);
    if (param?.range && (v < param.range[0] || v > param.range[1])) {
      problems.push(`${key} ${v} ${param.unit} is outside the series range ${param.range[0]}–${param.range[1]} ${param.unit}`);
    }
    parameters[key] = v;
  }
  const overridden = applied.length > 0;

  // tolerance grade, and the value range it is made in
  const value = Number(parameters[valueId]);
  const tolerance = typeof parameters.tolerance === "number" ? parameters.tolerance : undefined;
  const grade = s.tolerances?.find((g) => Math.abs(g.tolerance - (tolerance ?? NaN)) < 1e-12);
  if (overridden && s.tolerances && !grade) problems.push(`tolerance ${tolerance} is not a grade of the series (${s.tolerances.map((g) => g.tolerance).join(", ")})`);
  if (overridden && grade?.range && (value < grade.range[0] || value > grade.range[1])) {
    problems.push(`${valueId} ${value} ${s.unit} is not made at ±${trimPercent(grade.tolerance)} % (${grade.range[0]}–${grade.range[1]} ${s.unit})`);
  }

  // a table series: the value must be a row, which fixes its other parameters
  const row = s.values?.find((r) => Math.abs(r.value - value) < 1e-9 * Math.max(1, value));
  if (overridden && s.values && !row) problems.push(`${valueId} ${value} ${s.unit} is not made in this series (${s.values.map((r) => r.value).join(", ")})`);
  if (row?.parameters) Object.assign(parameters, row.parameters);

  // part number: named, the default, or formed from the rule
  const rule = s.part_number;
  const named = typeof overrides.part_number === "string" && overridable.includes("part_number") ? overrides.part_number : undefined;
  const changed = applied.some((k) => k !== "part_number");
  let partNumber: string | undefined = named || undefined;
  if (!partNumber) {
    if (!changed) partNumber = rule?.default ?? def.part_number;
    else if (rule?.pattern) {
      const code = row?.code ?? valueCode(rule, value);
      if (!code) problems.push(`no ordering code for ${valueId} ${value} ${s.unit}`);
      if (rule.pattern.includes("{tolerance}") && !grade) problems.push(`no ordering code for tolerance ${tolerance}`);
      partNumber = code && (grade || !rule.pattern.includes("{tolerance}")) ? rule.pattern.replace("{value}", code).replace("{tolerance}", grade?.code ?? "") : undefined;
    } else if (rule || def.part_number) {
      problems.push(`${def.id}: name the exact part_number for a non-default placement (no rule forms the MPN from the parameters)`);
    }
  }

  // a named or formed MPN must agree with the parameters
  if (partNumber && rule?.decode && (named || changed)) {
    const m = new RegExp(rule.decode).exec(partNumber);
    if (!m?.groups) problems.push(`part_number ${partNumber} is not a ${s.series ?? def.id} ordering code`);
    else {
      for (const [group, code] of Object.entries(m.groups)) {
        if (code === undefined) continue;
        const decoded = group === "value" ? decodeValue(rule, code) : rule.codes?.[group]?.[code];
        const id = group === "value" ? valueId : group;
        if (decoded === undefined) continue;
        const have = parameters[id];
        const same = typeof decoded === "number" && typeof have === "number" ? Math.abs(decoded - have) <= 1e-6 * Math.max(Math.abs(decoded), 1e-15) : decoded === have;
        if (!same) problems.push(`part_number ${partNumber} says ${id} ${decoded}, the placement has ${have}`);
      }
    }
  }

  return {
    kind: s.kind,
    value,
    unit: s.unit,
    ...(tolerance !== undefined ? { tolerance } : {}),
    ...(partNumber ? { part_number: partNumber } : {}),
    parameters,
    overridden,
    problems,
  };
}

const trimPercent = (f: number) => String(Number((f * 100).toPrecision(2)));

// ---------------------------------------------------------------------------
// Value codes of a part-number rule
// ---------------------------------------------------------------------------

const trim3 = (n: number) => String(Number(n.toPrecision(3)));

/** R, K or M as the decimal point: 97R6, 9K76, 10K, 1M, 4K7. */
export function rkmCode(value: number): string {
  const [div, letter] = value >= 1e6 ? [1e6, "M"] : value >= 1e3 ? [1e3, "K"] : [1, "R"];
  const [whole, frac = ""] = trim3(value / div).split(".");
  return `${whole}${letter}${frac}`;
}

/** Inverse of `rkmCode`: 4K7 = 4700. */
export function rkmValue(code: string): number | undefined {
  const m = /^(\d*)([RKM])(\d*)$/.exec(code);
  if (!m || !(m[1] || m[3])) return undefined;
  return Number(`${m[1] || "0"}.${m[3] || "0"}`) * { R: 1, K: 1e3, M: 1e6 }[m[2] as "R" | "K" | "M"];
}

/** Three EIA digits: two significant figures and the number of zeros (104 = 10 × 10⁴). */
export function eia3Code(value: number): string | undefined {
  if (value < 10) return undefined;
  const zeros = Math.floor(Math.log10(value)) - 1;
  const sig = Math.round(value / 10 ** zeros);
  if (Math.abs(sig * 10 ** zeros - value) > 1e-9 * value || sig >= 100) return undefined;
  return `${sig}${zeros}`;
}

const eia3Value = (code: string) => Number(code.slice(0, 2)) * 10 ** Number(code[2]);

function decodeValue(rule: PassivePartNumberRule, code: string): number | undefined {
  if (rule.value_code === "rkm") return rkmValue(code);
  if (!/^\d{3}$/.test(code)) return undefined;
  return rule.value_code === "eia3_pf" ? eia3Value(code) * 1e-12 : eia3Value(code);
}

function valueCode(rule: PassivePartNumberRule, value: number): string | undefined {
  if (rule.value_code === "rkm") return rkmCode(value);
  if (rule.value_code === "eia3_pf") return eia3Code(Math.round(value * 1e12 * 1e6) / 1e6);
  return eia3Code(value);
}
