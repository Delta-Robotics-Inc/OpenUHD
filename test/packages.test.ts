/**
 * Package facts and pin tables: what a PCB provider needs from a part that is
 * true of the part, and the designator checks a part verifier runs.
 */
import { describe, it, expect } from "vitest";
import type { ModuleDef } from "../src/types/index.js";
import { I2C, Passive, defineModule, partPackage, pinDesignatorIssues, pinTable } from "../src/protocols/index.js";
import { FIXTURE_BUCK_BOOST } from "./fixtures/parts/fixture-buck-boost.js";
import { FIXTURE_IMU } from "./fixtures/parts/fixture-imu.js";
import { FIXTURE_MCU } from "./fixtures/parts/fixture-mcu.js";

const SRC = "https://example.com/datasheet.pdf (Table 1)";

describe("pinTable", () => {
  const pins = pinTable(
    [
      [1, "SDO", "io", "Serial data output"],
      { pin: 2, name: "VDD", type: "power_in", voltageV: [1.71, 3.6], nominalV: 1.8 },
      [3, "GND", "ground"],
      { pin: 4, name: "SDA", type: "io", capabilities: ["i2c_sda"] },
      { pin: 5, name: "SCL", type: "input", capabilities: ["i2c_scl"] },
      { pin: 6, name: "INT", type: "output", protocols: [{ type: "interrupt", roles: ["output"] }] },
      [7, "NC", "nc"],
      [8, "LX", "passive", "Inductor connection"],
    ],
    { source: SRC, logicV: [1.71, 3.6] },
  );

  it("gives every row its designator, datasheet name and id", () => {
    expect(pins.map((p) => [p.id, p.pin, p.name])).toEqual([
      ["pin_1", 1, "SDO"], ["pin_2", 2, "VDD"], ["pin_3", 3, "GND"], ["pin_4", 4, "SDA"],
      ["pin_5", 5, "SCL"], ["pin_6", 6, "INT"], ["pin_7", 7, "NC"], ["pin_8", 8, "LX"],
    ]);
  });

  it("maps types to the canonical protocols and cites the description", () => {
    const by = Object.fromEntries(pins.map((p) => [p.id, p]));
    expect(by.pin_1.protocols).toEqual([{ type: "digital", roles: ["input", "output", "bidirectional"] }]);
    expect(by.pin_1.parameters).toEqual([{ id: "voltage", unit: "V", range: [1.71, 3.6] }]);
    expect(by.pin_1.traits).toEqual([{ type: "pin_functions", params: { description: "Serial data output", source: SRC } }]);
    expect(by.pin_2.protocols).toEqual([{ type: "power", roles: ["input"] }]);
    expect(by.pin_3.protocols).toEqual([{ type: "power", roles: ["ground"] }]);
    expect(by.pin_4.capabilities).toEqual(["digital_io", "i2c_sda"]);
    expect(by.pin_6.protocols.map((p) => p.type)).toEqual(["digital", "interrupt"]);
    expect(by.pin_7.protocols).toEqual([{ type: "custom", roles: ["no_connect"] }]);
    expect(by.pin_8.protocols).toEqual([{ type: "passive", roles: ["terminal"] }]);
  });

  it("composes with the bus builders", () => {
    const def = defineModule({ id: "t", name: "t", interfaces: [...pins, ...I2C({ id: "i2c", roles: ["slave"], sda: "pin_4", scl: "pin_5" })] });
    expect(def.interfaces.find((i) => i.id === "i2c")?.profiles?.[0].bindings).toEqual({ sda: "pin_4", scl: "pin_5" });
  });

  it("refuses repeated designators and power pins without a voltage", () => {
    expect(() => pinTable([[1, "A", "io"], [1, "B", "io"]], { source: SRC })).toThrow(/designator 1 appears twice/);
    expect(() => pinTable([[1, "VDD", "power_in"]], { source: SRC })).toThrow(/needs voltageV/);
  });
});

describe("package facts", () => {
  const chip = (interfaces: ModuleDef["interfaces"], pkg: Record<string, unknown> = {}): ModuleDef => ({
    id: "chip",
    name: "chip",
    interfaces,
    domains: [{ domain: "mechanical", dimensions_mm: { length: 3, width: 2.5, height: 0.83 }, package: { name: "LGA-4", pin_count: 4, pitch_mm: 0.5, exposed_pad: false, ...pkg } }],
  });
  const four = pinTable([[1, "A", "io"], [2, "B", "io"], [3, "GND", "ground"], { pin: 4, name: "VDD", type: "power_in", voltageV: 3.3 }], { source: SRC });

  it("partPackage reads the package and the body size", () => {
    expect(partPackage(chip(four))).toEqual({ name: "LGA-4", pin_count: 4, pitch_mm: 0.5, exposed_pad: false, size_mm: { length: 3, width: 2.5, height: 0.83 } });
    expect(partPackage({ id: "m", name: "m", interfaces: [] })).toBeUndefined();
  });

  it("a complete pin table has no designator issues", () => {
    expect(pinDesignatorIssues(chip(four))).toEqual([]);
  });

  it("reports leaves with no designator, duplicates, uncovered and stray pins", () => {
    const [a, b, gnd, vdd] = four;
    const { pin: _unused, ...noPin } = b;
    expect(pinDesignatorIssues(chip([a, noPin, gnd, vdd])).join("\n")).toMatch(/1 leaf pin\(s\) have no designator: pin_2[\s\S]*no leaf carries 2/);
    expect(pinDesignatorIssues(chip([a, { ...b, pin: 1 }, gnd, vdd])).join("\n")).toMatch(/designator 1 is on 2 leaves \(pin_1, pin_2\)/);
    expect(pinDesignatorIssues(chip([...four, { ...a, id: "x", pin: 9 }]))).toContain("designator(s) 9 are outside LGA-4's pins 1–4");
  });

  it("logical function interfaces and the named exposed pad are accepted", () => {
    const fn = { id: "pwm", domain: "electrical" as const, exposed: true, protocols: [{ type: "pwm", roles: ["output"] }], geometry: { logical: true } };
    const ep = { ...four[2], id: "pad", pin: "EP" };
    expect(pinDesignatorIssues(chip([...four, fn, ep], { exposed_pad: true, exposed_pad_pin: "EP" }))).toEqual([]);
    expect(pinDesignatorIssues(chip(four, { exposed_pad: true, exposed_pad_pin: "EP" }))).toEqual(["the exposed pad (EP) has no leaf"]);
  });

  it("grid designators are compared by count", () => {
    const grid = pinTable([["A1", "A", "io"], ["A2", "B", "io"], ["B1", "GND", "ground"]], { source: SRC });
    expect(pinDesignatorIssues(chip(grid))).toEqual(["LGA-4 has 4 pins but 3 designators are used"]);
  });

  it("parts with no package fact are not checked", () => {
    expect(pinDesignatorIssues({ id: "m", name: "m", interfaces: [{ ...four[0], pin: undefined }] })).toEqual([]);
  });
});

describe("Passive", () => {
  it("is a two-terminal module with its value as a trait", () => {
    const r = Passive({ id: "r", name: "R 10k", kind: "resistor", value: 10e3, unit: "Ω", tolerance: 0.01 });
    expect(r.interfaces.map((i) => [i.id, i.pin, i.protocols[0].type])).toEqual([["pin_1", 1, "passive"], ["pin_2", 2, "passive"]]);
    expect(r.traits).toEqual([{ type: "passive", params: { kind: "resistor", value: 10e3, unit: "Ω", tolerance: 0.01 } }]);
  });
});

describe("chip fixtures carry package facts and complete designators", () => {
  const cases: [ModuleDef, string, number, boolean][] = [
    [FIXTURE_IMU, "LGA-12", 12, false],
    [FIXTURE_BUCK_BOOST, "SON-12", 12, true],
    [FIXTURE_MCU, "QFN-32", 32, true],
  ];
  for (const [def, name, count, ep] of cases) {
    it(`${def.id}: ${name}, ${count} pins${ep ? " + exposed pad" : ""}`, () => {
      const pkg = partPackage(def)!;
      expect([pkg.name, pkg.pin_count, pkg.exposed_pad]).toEqual([name, count, ep]);
      expect(pkg.source).toBeTruthy();
      expect(pkg.size_mm?.length).toBeGreaterThan(0);
      expect(pinDesignatorIssues(def)).toEqual([]);
      // the package is stated once, not also as free-form metadata
      const meta = def.domains?.find((d) => d.domain === "mechanical")?.metadata ?? {};
      expect(Object.keys(meta).filter((k) => /package|exposed_pad|pitch/.test(k))).toEqual([]);
      if (ep) expect(pkg.exposed_pad_mm).toHaveLength(2);
    });
  }
});
