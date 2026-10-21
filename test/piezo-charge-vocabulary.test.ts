/**
 * Piezo loads and their drivers (an ultrasonic atomiser disc, a piezo
 * micropump) and battery charge ports, on the invented mist maker
 * (fixtures/mist-maker.ts).
 */
import { describe, expect, it } from "vitest";
import { validatePair } from "../src/drc/index.js";
import { areRolesCompatible } from "../src/matching/roles.js";
import { ChargePort, Ground, Net, PiezoDrive, PiezoLoad, PowerIn, PowerOut, defineModule, netLinks } from "../src/protocols/index.js";
import { checkSystem } from "../src/system/checks.js";
import { deriveLinks } from "../src/system/derive.js";
import type { InterfaceDef, ModuleDef } from "../src/types/index.js";
import { CELL, CHARGER, DISC, DISC_DRIVER, MIST_MAKER, PUMP, PUMP_DRIVER, lookup, lookupWith } from "./fixtures/mist-maker.js";

const mod = (id: string, interfaces: InterfaceDef[]): ModuleDef => defineModule({ id, name: id, interfaces });
const connection = (a: ModuleDef, b: ModuleDef, protocol: string) => validatePair(a, b).connections.find((c) => c.protocol === protocol);
const diags = (a: ModuleDef, b: ModuleDef, protocol: string) => connection(a, b, protocol)?.diagnostics ?? [];
const codes = (a: ModuleDef, b: ModuleDef, protocol: string) => diags(a, b, protocol).map((d) => `${d.severity}:${d.code}`);
const links = (a: ModuleDef, b: ModuleDef, protocol: string) => connection(a, b, protocol)!.subLinks.map((l) => `${l.from.interfaceId}->${l.to.interfaceId}`);
const param = (iface: InterfaceDef, id: string) => iface.parameters?.find((p) => p.id === id);

describe("piezo loads", () => {
  const disc = (extra: Partial<Parameters<typeof PiezoLoad>[0]> = {}) => mod("disc", PiezoLoad({ kind: "atomizer", frequencyHz: [100e3, 116e3], driveVoltageVpp: 70, ...extra }));
  const driver = (extra: Partial<Parameters<typeof PiezoDrive>[0]> = {}) => mod("driver", PiezoDrive({ frequencyHz: 108e3, driveVoltageVpp: 60, ...extra }));

  it("a driver output links with the disc it drives, lead to lead", () => {
    expect(connection(DISC_DRIVER, DISC, "piezo_drive")!.state).toBe("valid");
    expect(links(DISC_DRIVER, DISC, "piezo_drive")).toEqual(["transducer_to_plus->lead_a", "transducer_to_minus->lead_b"]);
    expect(validatePair(DISC_DRIVER, DISC).potentials).toEqual([]);
  });

  it("states the drive frequency in Hz, the voltage peak to peak and the rest in its trait", () => {
    const piezo = DISC.interfaces.at(-1)!;
    expect(piezo.protocols).toEqual([{ type: "piezo_drive", roles: ["load"] }]);
    expect(param(piezo, "drive_frequency")).toEqual({ id: "drive_frequency", unit: "Hz", range: [100e3, 116e3] });
    expect(param(piezo, "drive_voltage")).toEqual({ id: "drive_voltage", unit: "Vpp", value: 70 });
    expect(piezo.traits).toEqual([{ type: "piezo_load", params: { kind: "atomizer", elements: 1, power_w: 2, capacitance_nf: 3, impedance_ohm: 200 } }]);
    expect(DISC.interfaces.map((i) => [i.id, i.pin, i.protocols[0].type])).toEqual([["lead_a", undefined, "piezo_terminal"], ["lead_b", undefined, "piezo_terminal"], ["piezo", undefined, "piezo_drive"]]);
    expect(DISC_DRIVER.interfaces.at(-1)!.traits).toEqual([{ type: "piezo_drive", params: { outputs: 1, power_w: 2, waveform: "sine" } }]);
  });

  it("a driver outside the resonance band does not drive the disc", () => {
    expect(codes(driver({ frequencyHz: 1.7e6 }), disc(), "piezo_drive")).toEqual(["error:param_range_disjoint"]);
    expect(connection(driver({ frequencyHz: [90e3, 130e3] }), disc(), "piezo_drive")!.state).toBe("valid");
    expect(connection(driver(), disc({ frequencyHz: undefined }), "piezo_drive")!.state).toBe("valid");
  });

  it("compares the driver's voltage with what the element takes", () => {
    expect(diags(driver({ driveVoltageVpp: 120 }), disc(), "piezo_drive").map((d) => `${d.severity}: ${d.message}`)).toEqual(["error: the driver puts out 120 V peak to peak; the element takes 70"]);
    expect(diags(driver({ driveVoltageVpp: [20, 120] }), disc(), "piezo_drive").map((d) => `${d.severity}: ${d.message}`)).toEqual([
      "warning: the driver can put out 120 V peak to peak; the element takes 70: set the amplitude no higher",
    ]);
    expect(codes(driver({ driveVoltageVpp: [20, 70] }), disc({ driveVoltageVpp: [40, 70] }), "piezo_drive")).toEqual([]);
  });

  it("a two-output pump driver drives both actuators of a pump, output 1 to element 1", () => {
    expect(connection(PUMP_DRIVER, PUMP, "piezo_drive")!.state).toBe("valid");
    expect(links(PUMP_DRIVER, PUMP, "piezo_drive")).toEqual([
      "pump_out_to1_plus->actuators_element1_plus",
      "pump_out_to1_minus->actuators_element1_minus",
      "pump_out_to2_plus->actuators_element2_plus",
      "pump_out_to2_minus->actuators_element2_minus",
    ]);
    expect(PUMP.interfaces.at(-1)!.traits).toEqual([{ type: "piezo_load", params: { kind: "pump", elements: 2, polarized: true } }]);
  });

  it("a pump driver does not drive an atomiser, nor an atomiser driver a pump", () => {
    expect(codes(PUMP_DRIVER, DISC, "piezo_drive")).toEqual(["error:param_range_disjoint", "warning:piezo_drive"]);
    expect(diags(DISC_DRIVER, PUMP, "piezo_drive").map((d) => d.message)).toEqual([
      "drive_frequency: 108000 Hz vs 1–300 Hz (ranges do not overlap)",
      "the load has 2 elements driven separately; the driver has 1 output",
    ]);
    expect(connection(DISC_DRIVER, PUMP, "piezo_drive")!.state).toBe("incompatible");
  });

  it("ports without terminals pair as a whole; the element count is still compared", () => {
    const pump = mod("pump", PiezoLoad({ kind: "pump", elements: 2, driveVoltageVpp: 240 }));
    expect(connection(mod("two", PiezoDrive({ outputs: 2, frequencyHz: [10, 1000], driveVoltageVpp: 140 })), pump, "piezo_drive")!.state).toBe("valid");
    expect(codes(mod("one", PiezoDrive({ frequencyHz: [10, 1000], driveVoltageVpp: 140 })), pump, "piezo_drive")).toEqual(["error:piezo_drive"]);
  });

  it("takes existing leaves, and refuses terminal lists that disagree with the count", () => {
    const leaf = (id: string, pin: number): InterfaceDef => ({ id, pin, domain: "electrical", exposed: true, default_active: true, protocols: [{ type: "passive", roles: ["terminal"] }] });
    const buzzer = mod("buzzer", [leaf("t1", 1), leaf("t2", 2), ...PiezoLoad({ kind: "buzzer", terminals: { plus: "t1", minus: "t2" }, frequencyHz: 4000, driveVoltageVpp: 30 })]);
    expect(buzzer.interfaces.at(-1)!.profiles![0].bindings).toEqual({ element_plus: "t1", element_minus: "t2" });
    expect(connection(driver({ frequencyHz: [2000, 5000], driveVoltageVpp: 10 }), buzzer, "piezo_drive")!.state).toBe("valid");
    expect(() => PiezoLoad({ kind: "pump", elements: 2, terminals: { plus: { pin: 1 }, minus: { pin: 2 } }, driveVoltageVpp: 240 })).toThrow(/1 terminal pair\(s\) for 2 element\(s\)/);
    expect(() => PiezoDrive({ outputs: 0, frequencyHz: 100, driveVoltageVpp: 100 })).toThrow(/whole number/);
  });

  it("has its own role table: a driver pairs with a load and nothing else", () => {
    expect(areRolesCompatible("piezo_drive", "driver", "load")).toBe(true);
    expect(areRolesCompatible("piezo_drive", "drive_plus", "element_plus")).toBe(true);
    expect(areRolesCompatible("piezo_drive", "drive_plus", "element_minus")).toBe(false);
    expect(areRolesCompatible("piezo_drive", "driver", "driver")).toBe(false);
    expect(areRolesCompatible("piezo_drive", "input", "output")).toBe(false);
    expect(areRolesCompatible("piezo_terminal", "terminal", "terminal")).toBe(false);
    expect(validatePair(DISC_DRIVER, mod("rail", [PowerIn({ id: "vin", voltageV: 60 })])).connections.map((c) => c.protocol)).toEqual([]);
  });
});

describe("battery charge ports", () => {
  const charger = (extra: Partial<Parameters<typeof ChargePort>[0]> = {}) => mod("charger", ChargePort({ role: "charger", chemistry: ["li_ion", "li_polymer"], cells: 1, chargeVoltageV: 4.2, chargeCurrentA: [0.1, 1], ...extra }));
  const battery = (extra: Partial<Parameters<typeof ChargePort>[0]> = {}) => mod("battery", ChargePort({ role: "battery", chemistry: "li_polymer", cells: 1, chargeVoltageV: 4.2, chargeCurrentA: 1, capacitymAh: 2000, ...extra }));

  it("a charger's battery terminals link with the battery, + to + and - to -", () => {
    expect(connection(CHARGER, CELL, "battery_charge")!.state).toBe("valid");
    expect(links(CHARGER, CELL, "battery_charge")).toEqual(["bat->cell_pos", "gnd->cell_neg"]);
  });

  it("states cells, charge voltage, charge current and capacity as parameters, the chemistry in its trait", () => {
    const port = CELL.interfaces.find((i) => i.id === "charge_in")!;
    expect(port.protocols).toEqual([{ type: "battery_charge", roles: ["battery"] }]);
    expect(port.parameters).toEqual([
      { id: "cell_count", unit: "dimensionless", value: 1 },
      { id: "charge_voltage", unit: "V", value: 4.2 },
      { id: "charge_current", unit: "A", value: 1 },
      { id: "capacity", unit: "mAh", value: 2000 },
    ]);
    expect(port.traits).toEqual([{ type: "battery_charge", params: { chemistry: ["li_polymer"] } }]);
    expect(port.profiles![0].bindings).toEqual({ plus: "cell_pos", minus: "cell_neg" });
    expect(param(CHARGER.interfaces.find((i) => i.id === "charge_out")!, "charge_current")).toEqual({ id: "charge_current", unit: "A", range: [0.1, 1] });
  });

  it("inline terminals are power leaves, so the same pins still supply loads", () => {
    const inline = ChargePort({ role: "charger", plus: { pin: 2, name: "BAT" }, minus: { pin: 8, name: "VSS" }, chemistry: "li_ion", cells: 1, chargeVoltageV: 4.2 });
    expect(inline.map((i) => [i.id, i.pin, i.protocols[0]])).toEqual([
      ["charge_out_plus", 2, { type: "power", roles: ["output"] }],
      ["charge_out_minus", 8, { type: "power", roles: ["ground"] }],
      ["charge_out", undefined, { type: "battery_charge", roles: ["charger"] }],
    ]);
  });

  it("refuses another chemistry or cell count", () => {
    expect(diags(charger(), battery({ chemistry: "lifepo4", chargeVoltageV: 3.65 }), "battery_charge").map((d) => `${d.severity}: ${d.message}`)).toEqual([
      "error: the charger charges li_ion, li_polymer; the battery is lifepo4",
      "error: the charger charges to 4.2 V; the battery's charge voltage is 3.65 V",
    ]);
    expect(codes(charger(), battery({ cells: 2, chargeVoltageV: 8.4 }), "battery_charge")).toEqual(["error:param_range_disjoint", "warning:battery_charge"]);
    expect(connection(charger({ cells: [1, 2], chargeVoltageV: [4.2, 8.4] }), battery({ cells: 2, chargeVoltageV: 8.4 }), "battery_charge")!.state).toBe("valid");
    expect(connection(charger({ chemistry: ["Li-Ion", "LiFePO4"], chargeVoltageV: [3.6, 4.2] }), battery({ chemistry: "lifepo4", chargeVoltageV: 3.65 }), "battery_charge")!.state).toBe("warning");
  });

  it("compares the charge voltage with the battery's", () => {
    expect(codes(charger({ chargeVoltageV: 4.35 }), battery(), "battery_charge")).toEqual(["error:battery_charge"]);
    expect(diags(charger({ chargeVoltageV: [4.1, 4.4] }), battery(), "battery_charge").map((d) => `${d.severity}: ${d.message}`)).toEqual([
      "warning: the charger can be set to 4.4 V; the battery's charge voltage is 4.2 V: set it no higher",
    ]);
    expect(diags(charger(), battery({ chargeVoltageV: 4.35 }), "battery_charge").map((d) => `${d.severity}: ${d.message}`)).toEqual([
      "warning: the charger charges to 4.2 V; the battery's charge voltage is 4.35 V, so it is not charged fully",
    ]);
  });

  it("compares the charge current with what the battery accepts", () => {
    expect(diags(charger({ chargeCurrentA: 2 }), battery(), "battery_charge").map((d) => `${d.severity}: ${d.message}`)).toEqual(["error: the charger charges at 2 A; the battery accepts 1 A"]);
    expect(diags(charger({ chargeCurrentA: [0.1, 1.5] }), battery(), "battery_charge").map((d) => `${d.severity}: ${d.message}`)).toEqual([
      "warning: the charger can charge at 1.5 A; the battery accepts 1 A: set the charge current no higher",
    ]);
    expect(codes(charger(), battery({ chargeCurrentA: undefined }), "battery_charge")).toEqual([]);
  });

  it("is not DC power: a charge port pairs with no supply rail, and two batteries or two chargers do not pair", () => {
    expect(areRolesCompatible("battery_charge", "charger", "battery")).toBe(true);
    expect(areRolesCompatible("battery_charge", "charge_plus", "battery_plus")).toBe(true);
    expect(areRolesCompatible("battery_charge", "charge_plus", "battery_minus")).toBe(false);
    expect(areRolesCompatible("battery_charge", "input", "output")).toBe(false);
    expect(validatePair(charger(), charger()).connections).toEqual([]);
    expect(validatePair(battery(), battery()).connections).toEqual([]);
    expect(validatePair(charger(), mod("load", [PowerIn({ id: "vin", voltageV: 4.2 })])).connections).toEqual([]);
    expect(validatePair(battery(), mod("rail", [PowerOut({ id: "out", voltageV: 4.2 })])).connections).toEqual([]);
  });

  it("checks what the builder is given", () => {
    expect(() => ChargePort({ role: "charger", plus: "bat", chemistry: "li_ion", cells: 1, chargeVoltageV: 4.2 })).toThrow(/give both terminals/);
    expect(() => ChargePort({ role: "charger", chemistry: "li_ion", cells: 1, chargeVoltageV: 4.2, capacitymAh: 500 })).toThrow(/capacitymAh is a battery's/);
    expect(() => ChargePort({ role: "battery", chemistry: ["li_ion", "nimh"], cells: 1, chargeVoltageV: 4.2 })).toThrow(/one chemistry/);
    expect(() => ChargePort({ role: "charger", chemistry: [], cells: 1, chargeVoltageV: 4.2 })).toThrow(/name a chemistry/);
  });
});

describe("the mist maker as a system", () => {
  const diagnostics = checkSystem(MIST_MAKER, lookup).diagnostics;

  it("has no errors or warnings", () => {
    expect(diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });

  it("derives the charge link from the cell's plug in the charger's battery socket", () => {
    expect(deriveLinks(MIST_MAKER, lookup).map((r) => `${r.a.path} ↔ ${r.b.path} [${r.protocol}, ${r.state}]`)).toEqual(["charger:charge_out ↔ cell:charge_in [battery_charge, configured]"]);
  });

  it("the charge port takes nothing from the supply budget, and the cell's terminal still supplies", () => {
    expect(diagnostics.filter((d) => d.rule === "supply_budget").map((d) => d.id)).toEqual(["supply_budget:charger:sys_out"]);
    expect(diagnostics.some((d) => d.rule === "unpowered" && d.severity === "warning")).toBe(false);
  });

  it("reports a disc swapped for one the driver cannot drive, and a cell the charger overcharges", () => {
    const farDisc = { ...DISC, interfaces: PiezoLoad({ kind: "atomizer", terminals: { plus: { id: "lead_a" }, minus: { id: "lead_b" } }, frequencyHz: [1.6e6, 1.8e6], driveVoltageVpp: 70 }) };
    const d1 = checkSystem(MIST_MAKER, lookupWith(farDisc)).diagnostics;
    expect(d1.find((x) => x.rule === "link_state" && x.refs.includes("link:disc_drive"))?.severity).toBe("error");
    const lowCell = { ...CELL, interfaces: CELL.interfaces.map((i) => (i.id === "charge_in" ? ChargePort({ role: "battery", plus: "cell_pos", minus: "cell_neg", chemistry: "lifepo4", cells: 1, chargeVoltageV: 3.65 }).at(-1)! : i)) };
    const derived = deriveLinks(MIST_MAKER, lookupWith(lowCell));
    expect(derived.map((r) => r.state)).toEqual(["incompatible"]);
    expect(derived[0].diagnostics.map((d) => d.code)).toEqual(["battery_charge", "battery_charge"]);
  });
});

describe("a cell and its charger on a board", () => {
  // the cell's + gives and takes power: a storage terminal (docs/boards-and-nets.md)
  const cell = defineModule({
    id: "fixture-board-cell",
    name: "Fixture soldered cell",
    interfaces: [
      { id: "pos", name: "+", pin: 1, domain: "electrical", exposed: true, default_active: true, protocols: [{ type: "power", roles: ["input", "output"] }], parameters: [{ id: "voltage", unit: "V", range: [3.0, 4.2] }] },
      Ground({ id: "neg", pin: 2 }),
      ...ChargePort({ role: "battery", plus: "pos", minus: "neg", chemistry: "li_ion", cells: 1, chargeVoltageV: 4.2, chargeCurrentA: 0.5 }),
    ],
  });
  const chip = (currentA: number | [number, number]) =>
    defineModule({
      id: "fixture-board-charger",
      name: "Fixture charger chip",
      interfaces: ChargePort({ role: "charger", plus: { pin: 3, name: "BAT", voltageV: [3.0, 4.2] }, minus: { pin: 2, name: "VSS" }, chemistry: "li_ion", cells: 1, chargeVoltageV: 4.2, chargeCurrentA: currentA }),
    });
  const board: ModuleDef = {
    id: "fixture-charge-board",
    name: "Fixture charge board",
    interfaces: [Net({ id: "vbat", name: "VBAT", voltageV: [3.0, 4.2] }), Net({ id: "gnd", name: "GND", voltageV: 0 })],
    children: [{ id: "u1", moduleDefId: "fixture-board-charger" }, { id: "bt1", moduleDefId: cell.id }],
    links: [...netLinks("vbat", ["u1:charge_out_plus", "bt1:pos"]), ...netLinks("gnd", ["u1:charge_out_minus", "bt1:neg"])],
  };
  const lookupBoard = (charger: ModuleDef) => (id: string) => [charger, cell].find((d) => d.id === id);
  const charge = (charger: ModuleDef) => deriveLinks(board, lookupBoard(charger)).filter((r) => r.protocol === "battery_charge");

  it("derives the charge link over the nets, and the cell is not a second driver of the rail", () => {
    expect(charge(chip(0.5)).map((r) => `${r.a.path} ↔ ${r.b.path} [${r.state}]`)).toEqual(["u1:charge_out ↔ bt1:charge_in [configured]"]);
    expect(checkSystem(board, lookupBoard(chip(0.5))).diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("reports a charge current the cell does not accept", () => {
    const r = charge(chip(1))[0];
    expect(r.state).toBe("incompatible");
    expect(r.diagnostics.map((d) => d.message)).toEqual(["the charger charges at 1 A; the battery accepts 0.5 A"]);
    expect(checkSystem(board, lookupBoard(chip(1))).diagnostics.filter((d) => d.severity === "error").map((d) => d.rule)).toEqual(["link_state"]);
  });
});

