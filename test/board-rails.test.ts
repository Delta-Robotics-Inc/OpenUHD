/**
 * Supply composites over board rails: an adjustable regulator's output port
 * (two output pins and ground) feeding a sensor's supply port (two input
 * pins and two grounds) through the board's 3V3 and GND nets. The parts are
 * invented for the test (shaped like a buck-boost and a ToF sensor's ports).
 *
 * The derived link must be configured: the regulator's adjustable range is
 * validated at the rail's design voltage, the composite pairing is preferred
 * over pairing the regulator's port with the sensor's own pins, and pins on
 * one net are one conductor (either input pin is the pairing the protocol
 * expects; a second input slot on the same rail is not left open).
 */
import { describe, it, expect } from "vitest";
import type { InterfaceDef, ModuleDef } from "../src/types/index.js";
import { checkSystem } from "../src/system/checks.js";
import { Net, defineModule, netLinks } from "../src/protocols/index.js";

const leaf = (id: string, pin: number | string, roles: string[], voltage?: [number, number]): InterfaceDef => ({
  id,
  pin,
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "power", roles }],
  ...(roles.includes("ground") ? { capabilities: ["ground"] } : {}),
  ...(voltage ? { parameters: [{ id: "voltage", unit: "V", range: voltage }] } : {}),
});

const REG: ModuleDef = defineModule({
  id: "test-adjustable-reg",
  name: "Adjustable regulator (test)",
  interfaces: [
    leaf("pin_4", 4, ["output"], [1.2, 5.5]),
    leaf("pin_5", 5, ["output"], [1.2, 5.5]),
    leaf("pgnd", "EP", ["ground"]),
    {
      id: "vout",
      name: "Regulated output",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["output"] }],
      parameters: [{ id: "voltage", unit: "V", range: [1.2, 5.5] }, { id: "max_current", unit: "A", value: 2 }],
      slots: [
        { id: "vout_a", match: { protocol: "power", role: "output" }, required: true },
        { id: "vout_b", match: { protocol: "power", role: "output" }, required: true },
        { id: "gnd", match: { protocol: "power", role: "ground", capability: "ground" }, required: true },
      ],
      profiles: [{ id: "pins", default_active: true, bindings: { vout_a: "pin_4", vout_b: "pin_5", gnd: "pgnd" } }],
    },
  ],
});

const SENSOR: ModuleDef = defineModule({
  id: "test-sensor",
  name: "Sensor (test)",
  interfaces: [
    leaf("pin_1", 1, ["input"], [2.6, 3.5]),
    leaf("pin_11", 11, ["input"], [2.6, 3.5]),
    leaf("pin_2", 2, ["ground"]),
    leaf("pin_3", 3, ["ground"]),
    {
      id: "supply",
      name: "Supply",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["input"] }],
      parameters: [{ id: "voltage", unit: "V", range: [2.6, 3.5], value: 2.8 }, { id: "current_draw", unit: "A", value: 0.022 }],
      slots: [
        { id: "avdd", match: { protocol: "power", role: "input" }, required: true },
        { id: "avddvcsel", match: { protocol: "power", role: "input" }, required: true },
        { id: "gnd", match: { protocol: "power", role: "ground", capability: "ground" }, required: true },
        { id: "avssvcsel", match: { protocol: "power", role: "ground", capability: "ground" }, required: true },
      ],
      profiles: [{ id: "pins", default_active: true, bindings: { avdd: "pin_11", avddvcsel: "pin_1", gnd: "pin_3", avssvcsel: "pin_2" } }],
    },
  ],
});

const board = (rail: number) =>
  defineModule({
    id: "test-rail-board",
    name: "Rail board (test)",
    interfaces: [Net({ id: "v3v3", name: "3V3", voltageV: rail }), Net({ id: "gnd", name: "GND" })],
    children: [
      { id: "u4", moduleDefId: REG.id },
      { id: "u2", moduleDefId: SENSOR.id },
    ],
    links: [...netLinks("v3v3", ["u4:pin_4", "u4:pin_5", "u2:pin_1", "u2:pin_11"]), ...netLinks("gnd", ["u4:pgnd", "u2:pin_2", "u2:pin_3"])],
  });

const lookup = (id: string) => [REG, SENSOR].find((d) => d.id === id);

describe("supply composites over a board rail", () => {
  it("an adjustable output on a 3.3 V rail feeds a 2.6-3.5 V port: one configured link", () => {
    const r = checkSystem(board(3.3), lookup);
    const supply = r.links.filter((l) => l.derived && l.protocol === "power");
    expect(supply.map((l) => `${l.a.path}>${l.b.path}:${l.state}`)).toEqual(["u4:vout>u2:supply:configured"]);
    expect(supply[0].unresolvedSlots).toEqual([]);
    expect(r.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });

  it("the same rail declared at 5 V: the sensor's pins are reported, and the port link fails", () => {
    const r = checkSystem(board(5), lookup);
    const supply = r.links.filter((l) => l.derived && l.protocol === "power");
    expect(supply[0].state).toBe("incompatible");
    expect(r.diagnostics.some((d) => d.rule === "net" && d.message.includes("u2:pin_1"))).toBe(true);
  });
});
