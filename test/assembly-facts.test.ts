/**
 * Interfaces an instance leaves unconnected on purpose
 * (ChildModuleRef.unconnected): a marked power input is said, not warned
 * about; a link to a marked interface, or a mark naming no interface, is a
 * warning.
 */
import { describe, expect, it } from "vitest";
import { checkSystem } from "../src/system/checks.js";
import type { InterfaceDef, ModuleDef } from "../src/types/index.js";

const power = (id: string, role: string, v: number): InterfaceDef => ({ id, name: id.toUpperCase(), domain: "electrical", exposed: true, protocols: [{ type: "power", roles: [role] }], parameters: [{ id: "voltage", unit: "V", value: v }] });
const BOARD: ModuleDef = { id: "dev-board", name: "Dev board", interfaces: [power("usb", "input", 5), power("dc_jack", "input", 9), power("vout", "output", 5)] };
const SENSOR: ModuleDef = { id: "sensor", name: "Sensor", interfaces: [power("vin", "input", 5)] };
const lookup = (id: string) => [BOARD, SENSOR].find((d) => d.id === id);
const system = (unconnected?: { interfaceId: string; reason: string }[], extraLinks: ModuleDef["links"] = []): ModuleDef => ({
  id: "bench",
  name: "Bench",
  interfaces: [],
  children: [
    { id: "board", moduleDefId: "dev-board", ...(unconnected ? { unconnected } : {}) },
    { id: "sensor", moduleDefId: "sensor" },
  ],
  links: [{ id: "sensor_power", a: { child: "board", interfaceId: "vout" }, b: { child: "sensor", interfaceId: "vin" } }, ...extraLinks],
});

describe("unconnected interfaces", () => {
  it("without a mark, an open power input is unpowered (warning)", () => {
    const d = checkSystem(system(), lookup).diagnostics.filter((x) => x.rule === "unpowered");
    expect(d.map((x) => [x.refs[0], x.severity])).toEqual([["board:usb", "warning"], ["board:dc_jack", "warning"]]);
  });

  it("a marked input is reported as info with its reason, not as a warning", () => {
    const d = checkSystem(system([{ interfaceId: "dc_jack", reason: "powered from USB" }]), lookup).diagnostics;
    const jack = d.find((x) => x.id === "unpowered:board:dc_jack")!;
    expect(jack.severity).toBe("info");
    expect(jack.message).toBe("board:dc_jack (DC_JACK) is unconnected on purpose: powered from USB.");
    expect(d.find((x) => x.id === "unpowered:board:usb")!.severity).toBe("warning");
    expect(d.filter((x) => x.rule === "unconnected")).toEqual([]);
  });

  it("a link to a marked interface contradicts the mark", () => {
    const s = system([{ interfaceId: "vout", reason: "not used" }]);
    const d = checkSystem(s, lookup).diagnostics.find((x) => x.rule === "unconnected")!;
    expect(d.severity).toBe("warning");
    expect(d.message).toBe("board:vout is marked unconnected (not used), but link sensor_power connects it.");
    expect(d.refs).toEqual(["board:vout", "link:sensor_power"]);
  });

  it("a mark must name an interface of the child", () => {
    const d = checkSystem(system([{ interfaceId: "vin", reason: "typo" }]), lookup).diagnostics.find((x) => x.rule === "unconnected")!;
    expect(d.message).toBe('board marks "vin" as unconnected, but dev-board has no such interface.');
  });
});

describe("I2C addresses other than the device's own", () => {
  const i2c = (id: string, roles: string[], params: [string, number][] = []): InterfaceDef => ({ id, name: "I2C", domain: "electrical", exposed: true, protocols: [{ type: "i2c", roles }], parameters: params.map(([pid, value]) => ({ id: pid, unit: "dimensionless", value })) });
  const MCU: ModuleDef = { id: "mcu", name: "MCU", interfaces: [i2c("i2c", ["master"])] };
  const PWM: ModuleDef = { id: "pwm", name: "PWM driver", interfaces: [i2c("i2c", ["slave"], [["i2c_address", 0x60], ["i2c_address_all_call", 0x70]])] };
  const PWM2: ModuleDef = { id: "pwm2", name: "PWM driver 2", interfaces: [i2c("i2c", ["slave"], [["i2c_address", 0x61], ["i2c_address_all_call", 0x70]])] };
  const AT70: ModuleDef = { id: "at70", name: "Device at 0x70", interfaces: [i2c("i2c", ["slave"], [["i2c_address", 0x70]])] };
  const look = (id: string) => [MCU, PWM, PWM2, AT70].find((d) => d.id === id);
  const bus = (...ids: string[]): ModuleDef => ({
    id: "bus",
    name: "Bus",
    interfaces: [],
    children: [{ id: "mcu", moduleDefId: "mcu" }, ...ids.map((d) => ({ id: d, moduleDefId: d }))],
    links: ids.map((d) => ({ id: `i2c_${d}`, a: { child: "mcu", interfaceId: "i2c" }, b: { child: d, interfaceId: "i2c" } })),
  });
  const clashes = (s: ModuleDef) => checkSystem(s, look).diagnostics.filter((d) => d.rule === "bus_address");

  it("lists the named addresses after the device's own", async () => {
    const { i2cAddresses, I2C } = await import("../src/protocols/i2c.js");
    expect(i2cAddresses(PWM.interfaces[0])).toEqual([{ name: "address", address: 0x60 }, { name: "all_call", address: 0x70 }]);
    const [built] = I2C({ id: "i2c", roles: ["slave"], address: 0x60, otherAddresses: { all_call: 0x70 } });
    expect(built.parameters?.filter((p) => p.id.startsWith("i2c_address")).map((p) => [p.id, p.value])).toEqual([["i2c_address", 0x60], ["i2c_address_all_call", 0x70]]);
  });

  it("two devices may share an all-call address", () => {
    expect(clashes(bus("pwm", "pwm2"))).toEqual([]);
  });

  it("a device whose own address is another's all-call address clashes", () => {
    const [d] = clashes(bus("pwm", "at70"));
    expect(d.message).toBe("mcu:i2c: 2 devices share I2C address 0x70 (pwm:i2c, at70:i2c); pwm:i2c answers at it as an all-call or sub-address.");
  });
});

describe("connectors supplied loose", () => {
  it("connectorTrait and Connector record supplied, and looseConnectors finds them", async () => {
    const { connectorTrait, Connector, looseConnectors } = await import("../src/protocols/connector.js");
    expect(connectorTrait("pin_header", { supplied: "loose" }).params).toEqual({ connector_type: "pin_header", supplied: "loose" });
    expect(connectorTrait("pin_header").params).toEqual({ connector_type: "pin_header" });
    const header = Connector({ id: "j1", connector: "pin_header", pins: ["5V", "GND"], supplied: "loose", note: "header strip in the bag" });
    const fitted = Connector({ id: "j2", connector: "jst_sh_4", pins: ["a", "b", "c", "d"] });
    expect(looseConnectors({ interfaces: [header, fitted] }).map((x) => [x.iface.id, x.connectorType, x.note])).toEqual([["j1", "pin_header", "header strip in the bag"]]);
  });
});
