/**
 * Per-placement passive values: a series passive (one definition for a
 * manufacturer series and size) placed at several values through
 * `ChildModuleRef.overrides`. The parts here are fixtures with invented
 * ordering codes, not real series.
 */
import { describe, expect, it } from "vitest";
import type { ModuleDef, PassiveTrait } from "../src/types/index.js";
import { Passive, defineModule, eia3Code, overridableKeys, passiveInstance, passiveOf, PassiveTerminal, rkmCode, rkmValue } from "../src/protocols/index.js";
import { checkSystem } from "../src/system/checks.js";

const SRC = "test fixture (not a real series)";

function series(id: string, params: PassiveTrait["params"], part_number?: string): ModuleDef {
  return defineModule({
    id,
    name: id,
    manufacturer: "Fixture Co",
    ...(part_number ? { part_number } : {}),
    categories: [`component.passive.${params.kind}`],
    interfaces: [PassiveTerminal(1), PassiveTerminal(2)],
    traits: [{ type: "passive", params: params as unknown as Record<string, unknown> }],
  });
}

/** A chip-resistor series: grades F (1 %) and J (5 %), R/K/M value codes. */
const FX_R = series(
  "fx-r0402",
  {
    kind: "resistor",
    value: 10e3,
    unit: "Ω",
    tolerance: 0.01,
    source: SRC,
    series: "Fixture FXR 0402",
    parameters: [
      { id: "resistance", unit: "Ω", value: 10e3, range: [1, 10e6] },
      { id: "tolerance", unit: "dimensionless", value: 0.01, range: [0.01, 0.05] },
      { id: "rated_power", unit: "W", value: 1 / 16 },
    ],
    overridable: ["resistance", "tolerance", "part_number"],
    tolerances: [
      { tolerance: 0.01, code: "F", range: [1, 1e6] },
      { tolerance: 0.05, code: "J", range: [1, 10e6] },
    ],
    part_number: {
      default: "FXR0402F-10KT",
      pattern: "FXR0402{tolerance}-{value}T",
      value_code: "rkm",
      decode: "^FXR0402(?<tolerance>[FJ])-(?<value>[0-9]*[RKM][0-9]*)(?<pack>[TB])$",
      codes: { tolerance: { F: 0.01, J: 0.05 } },
      source: SRC,
    },
  },
  "FXR0402F-10KT",
);

/** An MLCC series with a dielectric choice and EIA pF codes, whose MPN cannot be formed (a control code). */
const FX_C = series("fx-c0402", {
  kind: "capacitor",
  value: 100e-9,
  unit: "F",
  tolerance: 0.1,
  series: "Fixture FXC 0402",
  parameters: [{ id: "capacitance", unit: "F", value: 100e-9, range: [1e-12, 1e-6] }],
  choices: { dielectric: { values: ["X5R", "X7R"], default: "X7R", source: SRC } },
  overridable: ["capacitance", "dielectric", "part_number"],
  part_number: { default: "FXC155R71C104KA01", pattern: null, value_code: "eia3_pf", decode: "^FXC155(?<dielectric>R6|R7)1C(?<value>\\d{3})KA\\d\\d$", codes: { dielectric: { R6: "X5R", R7: "X7R" } } },
});

/** A ferrite-bead table: only listed impedances exist. */
const FX_FB = series("fx-fb0402", {
  kind: "ferrite_bead",
  value: 600,
  unit: "Ω",
  parameters: [{ id: "impedance_100mhz", unit: "Ω", value: 600 }, { id: "rated_current", unit: "A", value: 0.2 }],
  overridable: ["impedance_100mhz"],
  values: [
    { value: 120, code: "121", parameters: { rated_current: 0.5 } },
    { value: 600, code: "601", parameters: { rated_current: 0.2 } },
  ],
  part_number: { default: "FXB15601", pattern: "FXB15{value}", value_code: "eia3_ohm" },
});

const R_FIXED = Passive({ id: "fx-r-4k7", name: "4.7 kΩ", kind: "resistor", value: 4.7e3, unit: "Ω", tolerance: 0.01, part_number: "FIX-4K7" });

describe("value codes", () => {
  it("writes and reads R/K/M codes and EIA digits", () => {
    expect([4.7e3, 10e3, 97.6, 1e6, 2.2].map(rkmCode)).toEqual(["4K7", "10K", "97R6", "1M", "2R2"]);
    expect(rkmValue("4K7")).toBe(4700);
    expect(eia3Code(100e3)).toBe("104");
    expect(eia3Code(5)).toBeUndefined();
  });
});

describe("passiveInstance", () => {
  it("is the default instance without overrides", () => {
    expect(passiveInstance(FX_R)).toMatchObject({ value: 10e3, tolerance: 0.01, part_number: "FXR0402F-10KT", overridden: false, problems: [] });
    expect(passiveInstance(R_FIXED)).toMatchObject({ value: 4.7e3, part_number: "FIX-4K7", problems: [] });
    expect(passiveInstance(defineModule({ id: "x", name: "x", interfaces: [] }))).toBeUndefined();
  });

  it("applies a value and a tolerance and forms the MPN from the rule", () => {
    expect(passiveInstance(FX_R, { resistance: 4700 })).toMatchObject({ value: 4700, tolerance: 0.01, part_number: "FXR0402F-4K7T", overridden: true, problems: [] });
    expect(passiveInstance(FX_R, { resistance: 2.2e6, tolerance: 0.05 })).toMatchObject({ value: 2.2e6, tolerance: 0.05, part_number: "FXR0402J-2M2T", problems: [] });
  });

  it("accepts a named MPN that agrees with the parameters and rejects one that does not", () => {
    expect(passiveInstance(FX_R, { resistance: 4700, part_number: "FXR0402F-4K7B" })).toMatchObject({ part_number: "FXR0402F-4K7B", problems: [] });
    expect(passiveInstance(FX_R, { resistance: 4700, part_number: "FXR0402F-10KT" })!.problems).toEqual(["part_number FXR0402F-10KT says resistance 10000, the placement has 4700"]);
    expect(passiveInstance(FX_R, { part_number: "NOPE" })!.problems).toEqual(["part_number NOPE is not a Fixture FXR 0402 ordering code"]);
  });

  it("reports keys the part does not allow, values outside the series and grades it does not make", () => {
    expect(passiveInstance(FX_R, { power: 1 })!.problems).toEqual(["power is not an instance parameter of fx-r0402 (overridable: resistance, tolerance, part_number)"]);
    expect(passiveInstance(FX_R, { resistance: "4k7" })!.problems).toEqual(["resistance must be a number"]);
    expect(passiveInstance(FX_R, { resistance: 2e6 })!.problems).toEqual(["resistance 2000000 Ω is not made at ±1 % (1–1000000 Ω)"]);
    expect(passiveInstance(FX_R, { tolerance: 0.02 })!.problems).toEqual([
      "tolerance 0.02 is not a grade of the series (0.01, 0.05)",
      "no ordering code for tolerance 0.02",
    ]);
    expect(passiveInstance(R_FIXED, { resistance: 10e3 })!.problems).toEqual(["resistance: fx-r-4k7 is a fixed-value part; a placement cannot override it (use another part)"]);
  });

  it("asks for the MPN where no rule forms it, and checks a named one against the choices", () => {
    expect(passiveInstance(FX_C, { capacitance: 1e-6 })!.problems).toEqual(["fx-c0402: name the exact part_number for a non-default placement (no rule forms the MPN from the parameters)"]);
    expect(passiveInstance(FX_C, { capacitance: 1e-6, dielectric: "X5R", part_number: "FXC155R61C105KA12" })).toMatchObject({ value: 1e-6, part_number: "FXC155R61C105KA12", parameters: { dielectric: "X5R" }, problems: [] });
    expect(passiveInstance(FX_C, { capacitance: 1e-6, part_number: "FXC155R61C105KA12" })!.problems).toEqual(["part_number FXC155R61C105KA12 says dielectric X5R, the placement has X7R"]);
    expect(passiveInstance(FX_C, { dielectric: "C0G" })!.problems[0]).toBe('dielectric "C0G" is not one of X5R, X7R');
  });

  it("takes a table row with the parameters it fixes, and refuses a value off the table", () => {
    expect(passiveInstance(FX_FB, { impedance_100mhz: 120 })).toMatchObject({ value: 120, part_number: "FXB15121", parameters: { rated_current: 0.5 }, problems: [] });
    expect(passiveInstance(FX_FB, { impedance_100mhz: 330 })!.problems).toContain("impedance_100mhz 330 Ω is not made in this series (120, 600)");
  });
});

describe("passiveOf with overrides", () => {
  it("gives the trait as the placement has it, and the trait itself without overrides", () => {
    expect(passiveOf(FX_R)).toBe(FX_R.traits![0].params);
    expect(passiveOf(FX_R, { resistance: 4700, tolerance: 0.05 })).toMatchObject({ kind: "resistor", value: 4700, tolerance: 0.05, unit: "Ω" });
    expect(overridableKeys(FX_R)).toEqual(["resistance", "tolerance", "part_number"]);
    expect(overridableKeys(R_FIXED)).toEqual([]);
  });
});

describe("passive_override rule", () => {
  const BOARD = defineModule({
    id: "fx-board",
    name: "Fixture board",
    interfaces: [],
    children: [
      { id: "r1", moduleDefId: "fx-r0402", overrides: { resistance: 4700 } },
      { id: "r2", moduleDefId: "fx-r0402" },
      { id: "r3", moduleDefId: "fx-r0402", overrides: { resistance: 2e6 } },
      { id: "r4", moduleDefId: "fx-r-4k7", overrides: { resistance: 1e3 } },
    ],
  });
  const SYSTEM = defineModule({ id: "fx-system", name: "System", interfaces: [], children: [{ id: "board", moduleDefId: "fx-board" }] });
  const defs = [FX_R, R_FIXED, BOARD, SYSTEM];
  const lookup = (id: string) => defs.find((d) => d.id === id);

  it("reports each placement whose overrides the part does not allow, at any depth", () => {
    const found = checkSystem(SYSTEM, lookup).diagnostics.filter((d) => d.rule === "passive_override");
    expect(found.map((d) => [d.severity, d.refs[0]])).toEqual([
      ["error", "board/r3"],
      ["error", "board/r4"],
    ]);
    expect(found[0].message).toBe("board/r3 (fx-r0402): resistance 2000000 Ω is not made at ±1 % (1–1000000 Ω)");
  });
});
