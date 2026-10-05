/**
 * Boards and nets: a custom PCB as a module whose nets are `Net` interfaces
 * joined by membership links. Uses the fixture board in fixtures/imu-board.ts
 * (an MCU, an IMU and a buck-boost regulator, synthetic parts in
 * fixtures/parts).
 */
import { describe, it, expect } from "vitest";
import type { InterfaceDef, InterfaceLink, ModuleDef } from "../src/types/index.js";
import { checkSystem } from "../src/system/checks.js";
import { systemLinks } from "../src/system/derive.js";
import { validateLinks } from "../src/system/index.js";
import { moduleNets } from "../src/system/nets.js";
import { Ground, Net, Passive, PowerIn, PowerOut, defineModule, netLinks, pinTable } from "../src/protocols/index.js";
import { IMU_BOARD, lookupBoardModule } from "./fixtures/imu-board.js";
import { FIXTURE_IMU } from "./fixtures/parts/fixture-imu.js";
import { areRolesCompatible } from "../src/matching/roles.js";

const check = (board: ModuleDef, lookup = lookupBoardModule) => checkSystem(board, lookup).diagnostics;

/** The board with some links replaced or added. */
function variant(changes: { drop?: string[]; add?: InterfaceLink[]; nets?: ModuleDef["interfaces"]; children?: ModuleDef["children"] }): ModuleDef {
  const drop = new Set(changes.drop ?? []);
  return {
    ...IMU_BOARD,
    interfaces: [...IMU_BOARD.interfaces.filter((i) => !changes.nets?.some((n) => n.id === i.id)), ...(changes.nets ?? [])],
    children: [...IMU_BOARD.children!, ...(changes.children ?? [])],
    links: [...IMU_BOARD.links!.filter((l) => !drop.has(l.id)), ...(changes.add ?? [])],
  };
}

describe("netLinks", () => {
  it("joins each member to the net on the board itself", () => {
    expect(netLinks("gnd", ["u2:pin_9"])).toEqual([{ id: "gnd.u2.pin_9", a: { child: "u2", interfaceId: "pin_9" }, b: { self: true, interfaceId: "gnd" } }]);
  });

  it("rejects a member that is not <child>:<interface>", () => {
    expect(() => netLinks("gnd", ["u2"])).toThrow(/not "<child>:<interface>"/);
    expect(() => netLinks("gnd", ["a/b:pin_1"])).toThrow();
  });
});

describe("the fixture board", () => {
  const result = checkSystem(IMU_BOARD, lookupBoardModule);

  it("every membership link is configured", () => {
    const stored = validateLinks(IMU_BOARD, lookupBoardModule);
    expect(stored.length).toBe(IMU_BOARD.links!.length);
    for (const r of stored) expect(r.state, `${r.link.id}: ${r.diagnostics.map((d) => d.message).join("; ")}`).toBe("configured");
    expect(new Set(stored.map((r) => r.protocol))).toEqual(new Set(["net"]));
  });

  it("indexes each net with its pins", () => {
    const nets = new Map(moduleNets(IMU_BOARD, result.links).map((n) => [n.iface.id, n.members.map((m) => m.path)]));
    expect(nets.get("sda")).toEqual(["u1:pin_2", "u2:pin_1", "r3:pin_2"]);
    expect(nets.get("v3v3")).toHaveLength(13);
  });

  it("derives the I2C link from the SDA and SCL nets, lifted to the controllers", () => {
    const i2c = result.links.filter((r) => r.protocol === "i2c");
    expect(i2c).toHaveLength(1);
    expect([i2c[0].a.path, i2c[0].b.path]).toEqual(["u1:i2c_0", "u2:i2c"]);
    expect(i2c[0].state).toBe("configured");
    expect(i2c[0].derived?.nets).toEqual(["scl", "sda"]);
    expect(i2c[0].children.map((c) => `${c.a.leafId}>${c.b.leafId}`)).toEqual(["pin_2>pin_1", "pin_3>pin_2"]);
  });

  it("derives supply links from the regulator to every load on 3V3, and none between two loads", () => {
    const supply = result.links.filter((r) => r.derived?.nets?.includes("v3v3") && r.protocol === "power");
    expect(new Set(supply.map((r) => r.a.path))).toEqual(new Set(["u3:pin_8", "u3:pin_9"]));
    expect(new Set(supply.map((r) => r.b.path))).toEqual(
      new Set(["u1:pin_1", "u1:pin_9", "u1:pin_19", "u1:pin_24", "u1:pin_25", "u2:pin_7", "u2:pin_8"]),
    );
  });

  it("derives the MCU's own regulator feeding its core through the VCORE net", () => {
    const core = result.links.filter((r) => r.derived?.nets?.includes("vcore"));
    expect(core.map((r) => `${r.a.path}>${r.b.path}`)).toEqual(["u1:pin_26>u1:pin_27", "u1:pin_26>u1:pin_28"]);
  });

  it("makes no link for passives, straps or pads that only share a net", () => {
    const paths = result.links.filter((r) => r.derived).flatMap((r) => [r.a.path, r.b.path]);
    expect(paths.some((p) => /^(r\d|l1):/.test(p))).toBe(false);
    expect(paths).not.toContain("u2:pin_3"); // CS strapped to 3V3
    expect(paths).not.toContain("u2:pin_4"); // ADDR strapped to GND
    expect(paths).not.toContain("u1:pin_10"); // TEST strapped to GND
  });

  it("derives only power links over a rail, and none between ground pins", () => {
    const onRails = result.links.filter((r) => r.derived?.nets?.some((n) => ["gnd", "v3v3", "vcore", "vin"].includes(n)));
    expect(onRails.length).toBeGreaterThan(0);
    expect(onRails.filter((r) => r.protocol !== "power")).toEqual([]);
    expect(result.links.filter((r) => r.derived?.nets?.includes("gnd"))).toEqual([]);
  });

  it("a GND net declared at 0 V passes; its straps are driven low, not over-driven", () => {
    const board = variant({ nets: [Net({ id: "gnd", name: "GND", voltageV: 0 })] });
    expect(check(board).filter((d) => d.severity !== "info")).toEqual([]);
  });

  it("reports no errors or warnings", () => {
    expect(result.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });

  it("budgets 3V3 on the regulator's output port at the net's 3.3 V, each load once", () => {
    const d = result.diagnostics.find((x) => x.id === "supply_budget:u3:vout")!;
    expect(d.details?.capacityW).toBeCloseTo(4.95, 6); // 3.3 V net × 1.5 A port rating
    expect((d.details?.unknownLoads as string[]).length).toBe(7);
  });

  it("lifted links are one use of a pin, however many pins share its net", () => {
    expect(result.diagnostics.some((d) => d.rule === "interface_reuse")).toBe(false);
  });
});

describe("seeded board faults", () => {
  it("IMU on a 5 V net: the net's design voltage exceeds VDD", () => {
    const board = variant({
      nets: [Net({ id: "v5", name: "5V", voltageV: 5 })],
      drop: ["v3v3.u2.pin_7"],
      add: netLinks("v5", ["u2:pin_7"]),
    });
    const d = check(board).filter((x) => x.rule === "net" && x.severity === "error");
    expect(d.map((x) => x.id)).toContain("net:v5:voltage:u2:pin_7");
    expect(d.find((x) => x.id === "net:v5:voltage:u2:pin_7")!.message).toMatch(/1\.71–3\.6 V but net v5 \(5V\) is 5 V/);
  });

  it("3V3 net declared at 5 V: every 3.3 V pin is flagged, the adjustable regulator is not", () => {
    const board = variant({ nets: [Net({ id: "v3v3", name: "3V3", voltageV: 5 })] });
    const flagged = check(board).filter((x) => x.id.startsWith("net:v3v3:voltage:")).map((x) => x.refs[1]);
    expect(flagged).toContain("u2:pin_7");
    expect(flagged).toContain("u1:pin_1");
    expect(flagged).not.toContain("u3:pin_8"); // VOUT is 1.0–5.5 V
    // CS is a logic input: flagged because 5 V is above its maximum
    const csb = check(board).find((x) => x.id === "net:v3v3:voltage:u2:pin_3")!;
    expect(csb.message).toMatch(/rated to 3\.6 V but net v3v3 \(3V3\) reaches 5 V/);
  });

  it("a 5 V logic input strapped to GND is neither a link nor a fault", () => {
    // fixture part, not a real one: an enable input rated for 5 V logic
    const driver = defineModule({
      id: "fixture-5v-enable",
      name: "Fixture 5 V-logic driver",
      interfaces: pinTable([[1, "EN", "input", "Enable, 5 V logic"], [2, "GND", "ground"]], { source: "fixture", logicV: [4.5, 5.5] }),
    });
    const board = variant({
      nets: [Net({ id: "gnd", name: "GND", voltageV: 0 })],
      children: [{ id: "u6", moduleDefId: driver.id }],
      add: netLinks("gnd", ["u6:pin_1", "u6:pin_2"]),
    });
    const r = checkSystem(board, (id) => (id === driver.id ? driver : lookupBoardModule(id)));
    expect(r.links.filter((x) => x.derived && (x.a.path.startsWith("u6:") || x.b.path.startsWith("u6:")))).toEqual([]);
    expect(r.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });

  it("a second IMU on the same bus with ADDR low is an address conflict", () => {
    const board = variant({
      children: [{ id: "u4", moduleDefId: FIXTURE_IMU.id, name: "IMU 2" }],
      add: [
        ...netLinks("sda", ["u4:pin_1"]),
        ...netLinks("scl", ["u4:pin_2"]),
        ...netLinks("v3v3", ["u4:pin_7", "u4:pin_8", "u4:pin_3"]),
        ...netLinks("gnd", ["u4:pin_9", "u4:pin_10", "u4:pin_4"]),
      ],
    });
    const d = check(board).find((x) => x.rule === "bus_address")!;
    expect(d.severity).toBe("error");
    expect(d.message).toMatch(/0x6A \(u2:i2c, u4:i2c\)/);
  });

  it("no pull-ups on SDA and SCL is a warning on each net", () => {
    const board = variant({ drop: ["sda.r3.pin_2", "scl.r4.pin_2"] });
    const d = check(board).filter((x) => x.rule === "bus_pullup");
    expect(d.map((x) => x.id).sort()).toEqual(["bus_pullup:scl", "bus_pullup:sda"]);
    expect(d[0].severity).toBe("warning");
  });

  it("a pull-up to ground is not a pull-up", () => {
    const board = variant({ drop: ["v3v3.r3.pin_1"], add: netLinks("gnd", ["r3:pin_1"]) });
    expect(check(board).map((x) => x.id)).toContain("bus_pullup:sda");
  });

  it("SDA and SCL swapped at the IMU is caught as miswiring", () => {
    const board = variant({
      drop: ["sda.u2.pin_1", "scl.u2.pin_2"],
      add: [...netLinks("sda", ["u2:pin_2"]), ...netLinks("scl", ["u2:pin_1"])],
    });
    const i2c = checkSystem(board, lookupBoardModule).links.find((r) => r.protocol === "i2c")!;
    expect(i2c.state).toBe("incompatible");
    expect(i2c.diagnostics.map((d) => d.code)).toContain("harness_wiring");
  });

  it("SDA and INT1 swapped at the IMU leave the I2C bus incomplete", () => {
    const board = variant({
      drop: ["sda.u2.pin_1", "imu_int1.u2.pin_5"],
      add: [...netLinks("sda", ["u2:pin_5"]), ...netLinks("imu_int1", ["u2:pin_1"])],
    });
    const r = checkSystem(board, lookupBoardModule);
    const i2c = r.links.find((x) => x.protocol === "i2c")!;
    expect(i2c.state).toBe("incompatible");
    expect(i2c.children.map((c) => `${c.a.leafId}>${c.b.leafId}`)).toEqual(["pin_3>pin_2"]);
    expect(i2c.diagnostics.find((d) => d.code === "bus_incomplete")!.message).toMatch(/sda: u1:i2c_0 pin_2 and u2:i2c pin_1 are not wired/);
    expect(r.diagnostics.some((d) => d.rule === "link_state" && d.severity === "error")).toBe(true);
  });

  it("ground joined to 3V3 is a short", () => {
    const board = variant({ add: netLinks("v3v3", ["u2:pin_10"]) });
    const d = check(board);
    expect(d.map((x) => x.id)).toContain("net:v3v3:ground");
    expect(d.map((x) => x.id)).toContain("net:short:u2:pin_10"); // on GND and 3V3
  });

  it("a second supply driving 3V3 is reported", () => {
    const ldo = defineModule({ id: "fixture-ldo", name: "Fixture LDO", interfaces: [PowerOut({ id: "vout", pin: 5, voltageV: 3.3, maxCurrentA: 0.3 })] });
    const board = variant({ children: [{ id: "u5", moduleDefId: ldo.id }], add: netLinks("v3v3", ["u5:vout"]) });
    const d = checkSystem(board, (id) => (id === ldo.id ? ldo : lookupBoardModule(id))).diagnostics.find((x) => x.id === "net:v3v3:drivers")!;
    expect(d.severity).toBe("error");
    expect(d.refs).toEqual(expect.arrayContaining(["u3:pin_8", "u5:vout"]));
  });

  it("a net with one pin, and a removed regulator output, leave loads unpowered", () => {
    const board = variant({ drop: IMU_BOARD.links!.filter((l) => l.id.startsWith("v3v3.u3.")).map((l) => l.id) });
    const d = check(board);
    expect(d.filter((x) => x.rule === "unpowered").map((x) => x.refs[0])).toEqual(expect.arrayContaining(["u2:pin_7", "u1:pin_1"]));
    const lonely = check(variant({ drop: ["imu_int1.u2.pin_5"] })).find((x) => x.id === "net:imu_int1:members")!;
    expect(lonely.message).toMatch(/joins only u1:pin_4/);
  });

  it("without the board-edge export, the regulator's input pins are unpowered", () => {
    const board = { ...IMU_BOARD, exports: IMU_BOARD.exports!.filter((e) => e.id !== "power_in") };
    const unpowered = check(board).filter((x) => x.rule === "unpowered").map((x) => x.refs[0]);
    expect(unpowered).toEqual(expect.arrayContaining(["u3:pin_1", "u3:pin_2", "u3:pin_3", "u3:vin"]));
  });

  it("a membership link to a composite or a child's net is invalid", () => {
    const board = variant({ add: [...netLinks("sda", ["u2:i2c"])] });
    const r = validateLinks(board, lookupBoardModule).find((x) => x.link.id === "sda.u2.i2c")!;
    expect(r.state).toBe("incompatible");
    expect(r.diagnostics[0].code).toBe("net_member_composite");
    // the invalid membership is left out of derivation
    expect(systemLinks(board, lookupBoardModule).filter((x) => x.protocol === "i2c")).toHaveLength(1);
  });

  it("a stated outline larger than the design envelope is an error", () => {
    const board = { ...IMU_BOARD, domains: [{ domain: "mechanical" as const, dimensions_mm: { length: 32, width: 18, height: 4 } }] };
    const d = check(board).filter((x) => x.rule === "design_envelope");
    expect(d.map((x) => x.details?.axis)).toEqual(["length"]);
    expect(check({ ...board, domains: [{ domain: "mechanical", dimensions_mm: { length: 28, width: 18 } }] }).some((x) => x.rule === "design_envelope")).toBe(false);
  });
});

describe("the board inside a system", () => {
  const cell = defineModule({
    id: "fixture-1s-cell",
    name: "1S LiPo cell (fixture)",
    interfaces: [PowerOut({ id: "out", voltageV: [3.0, 4.2], nominalV: 3.7, maxCurrentA: 2 }), Ground()],
  });
  const system = defineModule({
    id: "fixture-imu-system",
    name: "IMU board on a 1S cell",
    interfaces: [],
    children: [
      { id: "board", moduleDefId: IMU_BOARD.id },
      { id: "cell", moduleDefId: cell.id },
    ],
    links: [
      { id: "battery", a: { child: "cell", interfaceId: "out" }, b: { child: "board", interfaceId: "power_in" } },
      { id: "battery_gnd", a: { child: "cell", interfaceId: "gnd" }, b: { child: "board", interfaceId: "power_gnd" } },
    ],
  });
  const lookup = (id: string) => (id === cell.id ? cell : lookupBoardModule(id));

  it("a parent cannot join a child board's internal net", () => {
    const bad = { ...system, links: [{ id: "tap", a: { child: "cell", interfaceId: "out" }, b: { child: "board", interfaceId: "v3v3" } }] };
    const r = validateLinks(bad, lookup)[0];
    expect(r.state).toBe("incompatible");
    expect(r.diagnostics.map((d) => d.code)).toEqual(["net_not_own"]);
  });

  it("an export may not reuse a net's id", () => {
    expect(() => defineModule({ ...IMU_BOARD, exports: [{ id: "gnd", from: { child: "u3", interfaceId: "pin_11" } }] })).toThrow(/export "gnd" has the id of an interface/);
  });

  it("links to the board's edge export, and the nets stay inside the board", () => {
    const r = checkSystem(system, lookup);
    const battery = r.links.find((x) => x.link.id === "battery")!;
    expect(battery.state).toBe("configured");
    expect(battery.b.owner.id).toBe("fixture-buck-boost-son12");
    expect(battery.b.iface.id).toBe("pin_1");
    expect(r.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });
});

/**
 * Rules as a real board needs them (found on a wearable's main board): a supply input takes the whole
 * rail, a connector or a storage terminal is not a second driver, and an
 * I2C target's lines need pull-ups even when no I2C link is derived.
 */
describe("board rules from a real board", () => {
  // fixture parts, not real ones
  const pads = defineModule({
    id: "fixture-power-pads",
    name: "Fixture power pads",
    categories: ["connector.power_connector"],
    interfaces: [
      { id: "pin_1", name: "+", pin: 1, domain: "electrical", exposed: true, default_active: true, protocols: [{ type: "power", roles: ["output"] }], parameters: [{ id: "voltage", unit: "V", value: 3.3 }] },
      { ...Ground({ id: "pin_2", name: "-", pin: 2 }) },
    ],
  });
  const cell = defineModule({
    id: "fixture-cell-terminal",
    name: "Fixture cell terminal (charged and discharged on one pin)",
    interfaces: [{ id: "pin_1", name: "+", pin: 1, domain: "electrical", exposed: true, default_active: true, protocols: [{ type: "power", roles: ["input", "output"] }], parameters: [{ id: "voltage", unit: "V", range: [3.0, 4.2] }] }],
  });
  const ldo = defineModule({
    id: "fixture-ldo-out",
    name: "Fixture regulator output",
    interfaces: [{ id: "pin_1", name: "OUT", pin: 1, domain: "electrical", exposed: true, default_active: true, protocols: [{ type: "power", roles: ["output"] }], parameters: [{ id: "voltage", unit: "V", value: 3.3 }] }],
  });
  const extra = new Map([pads, cell, ldo].map((d) => [d.id, d]));
  const lookup = (id: string) => extra.get(id) ?? lookupBoardModule(id);
  const drivers = (board: ModuleDef) => checkSystem(board, lookup).diagnostics.filter((d) => d.rule === "net" && /driven by/.test(d.message));

  it("a supply input must take the whole rail, not just overlap it", () => {
    // the IMU's VDD (1.71-3.6 V) on a 3.0-4.2 V cell rail: it overlaps, but 4.2 V is above its rating
    const board = variant({
      nets: [Net({ id: "vbat", name: "VBAT", voltageV: [3.0, 4.2] })],
      drop: ["v3v3.u2.pin_7"],
      add: netLinks("vbat", ["u2:pin_7"]),
    });
    const d = check(board).find((x) => x.id === "net:vbat:voltage:u2:pin_7")!;
    expect(d.severity).toBe("error");
    expect(d.message).toMatch(/outside its rating at one end/);
  });

  it("a connector's pad and a storage terminal on a rail are not second drivers; a second regulator is", () => {
    const withPads = variant({ children: [{ id: "j9", moduleDefId: pads.id }], add: netLinks("v3v3", ["j9:pin_1"]) });
    expect(drivers(withPads)).toEqual([]);
    const withCell = variant({
      nets: [Net({ id: "vin", name: "VIN", voltageV: [3.0, 4.2] })],
      children: [{ id: "bt1", moduleDefId: cell.id }],
      add: netLinks("vin", ["bt1:pin_1"]),
    });
    expect(drivers(withCell)).toEqual([]);
    const withLdo = variant({ children: [{ id: "u9", moduleDefId: ldo.id }], add: netLinks("v3v3", ["u9:pin_1"]) });
    expect(drivers(withLdo).map((d) => d.message)).toEqual([expect.stringMatching(/net v3v3 \(3V3\) is driven by 2 supplies/)]);
  });

  it("an I2C target's line without a pull-up is reported when no I2C link is derived", () => {
    // the controller's SDA pin taken off the net (as when its bus pins are assigned in firmware), and the pull-up's top left open
    const board = variant({ drop: ["sda.u1.pin_2", "v3v3.r3.pin_1"] });
    const r = checkSystem(board, lookupBoardModule);
    expect(r.links.filter((x) => x.protocol === "i2c" && x.state !== "incompatible")).toEqual([]);
    expect(r.diagnostics.map((d) => d.id)).toContain("bus_pullup:sda");
  });

  it("passive terminals pair with each other (a lead soldered to a pad)", () => {
    expect(areRolesCompatible("passive", "terminal", "terminal")).toBe(true);
  });
});

describe("drive levels on a board's nets", () => {
  // a charger whose STAT output is push-pull to its VDD (as the MCP73831's is), and a 3 V microcontroller input
  const pin = (id: string, roles: string[], range: [number, number], capabilities: string[] = ["digital_io"]): InterfaceDef => ({
    id,
    name: id.toUpperCase(),
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: "digital", roles }],
    capabilities,
    parameters: [{ id: "voltage", unit: "V", range }],
  });
  const charger = (statCaps: string[] = ["digital_io", "tri_state"]): ModuleDef =>
    defineModule({ id: "fixture-charger", name: "Fixture charger", interfaces: [{ ...PowerIn({ id: "vdd", pin: 4, voltageV: [3.75, 6] }) }, pin("stat", ["output"], [0, 6], statCaps), Ground({ id: "vss", pin: 2 })] });
  const mcu = defineModule({ id: "fixture-mcu", name: "Fixture MCU", interfaces: [pin("gpio", ["input", "output", "bidirectional"], [1.7, 3.6])] });
  const board = (statCaps?: string[]): { board: ModuleDef; lookup: (id: string) => ModuleDef | undefined } => {
    const parts = [charger(statCaps), mcu];
    return {
      board: defineModule({
        id: "fixture-stat-board",
        name: "STAT board",
        interfaces: [Net({ id: "vbus", name: "VBUS", voltageV: 5 }), Net({ id: "gnd", name: "GND" }), Net({ id: "chg", name: "CHG" })],
        children: [{ id: "u1", moduleDefId: "fixture-mcu" }, { id: "u2", moduleDefId: "fixture-charger" }],
        links: [...netLinks("vbus", ["u2:vdd"]), ...netLinks("gnd", ["u2:vss"]), ...netLinks("chg", ["u2:stat", "u1:gpio"])],
      }),
      lookup: (id) => parts.find((p) => p.id === id),
    };
  };

  it("a push-pull output drives its net to its supply: a 3 V input on it is overdriven", () => {
    const { board: b, lookup } = board();
    const d = checkSystem(b, lookup).diagnostics.find((x) => x.id === "net:chg:drive:u1:gpio")!;
    expect(d.severity).toBe("error");
    expect(d.message).toMatch(/u2:stat \(STAT\) drives net chg \(CHG\) up to its supply VBUS \(5 V\), but u1:gpio \(GPIO\) is rated to 3\.6 V/);
    expect(d.details).toMatchObject({ driver: "u2:stat", level: 5 });
  });

  it("an open-drain output does not drive its net high", () => {
    const { board: b, lookup } = board(["digital_io", "open_drain"]);
    expect(checkSystem(b, lookup).diagnostics.filter((x) => x.id.includes(":drive:"))).toEqual([]);
  });
});

describe("a part's own pins on the board's nets", () => {
  // fixture part: a 100 nF decoupling capacitor
  const C100N = Passive({ id: "fixture-c-100n-0402", name: "Capacitor 100 nF 0402", kind: "capacitor", value: 100e-9, unit: "F", assumption: "Fixture value." });
  const withCap = (id: string) => (x: string) => (x === C100N.id ? C100N : lookupBoardModule(x));
  const lookupC = withCap(C100N.id);
  const errors = (board: ModuleDef, lookup = lookupC) => check(board, lookup).filter((x) => x.severity === "error");

  it("a decoupling capacitor across 3V3 and GND is not a fault", () => {
    const board = variant({ children: [{ id: "c1", moduleDefId: C100N.id }], add: [...netLinks("v3v3", ["c1:pin_1"]), ...netLinks("gnd", ["c1:pin_2"])] });
    expect(errors(board)).toEqual([]);
  });

  it("a capacitor with both terminals on one net is shorted", () => {
    const board = variant({ children: [{ id: "c1", moduleDefId: C100N.id }], add: netLinks("v3v3", ["c1:pin_1", "c1:pin_2"]) });
    const d = errors(board).find((x) => x.id === "net:v3v3:shorted:c1")!;
    expect(d.rule).toBe("net");
    expect(d.message).toMatch(/c1 \(capacitor, .*\) has every terminal on net v3v3 \(3V3\)/);
    expect(d.refs).toEqual(expect.arrayContaining(["c1:pin_1", "c1:pin_2"]));
  });

  it("the same rule holds for any passive: the SDA pull-up with both ends on SDA", () => {
    const board = variant({ drop: ["v3v3.r3.pin_1"], add: netLinks("sda", ["r3:pin_1"]) });
    expect(errors(board).map((x) => x.id)).toContain("net:sda:shorted:r3");
  });

  it("a passive with a terminal on no net is not reported as shorted", () => {
    const board = variant({ children: [{ id: "c1", moduleDefId: C100N.id }], add: netLinks("v3v3", ["c1:pin_1"]) });
    expect(errors(board).some((x) => x.id.includes(":shorted:"))).toBe(false);
  });

  it("the regulator's VOUT tied to its VIN shorts output to input", () => {
    const board = variant({ drop: ["v3v3.u3.pin_8"], add: netLinks("vin", ["u3:pin_8"]) });
    const d = errors(board).find((x) => x.id === "net:vin:feedback:u3")!;
    expect(d.message).toMatch(/ties u3's output u3:pin_8 \(VOUT\) to its own input .*u3:pin_1 \(VIN\)/);
    expect(d.refs).toEqual(expect.arrayContaining(["u3:pin_8", "u3:pin_1", "u3:pin_2", "u3:pin_3"]));
  });

  it("a part that states its bridges may feed its own other inputs: the MCU's VREG_OUT on VCORE", () => {
    expect(check(IMU_BOARD).some((x) => x.id.includes(":feedback:"))).toBe(false);
    // its regulator's own input (VREG_IN bridges to VREG_OUT) on the VCORE net is the fault
    const board = variant({ drop: ["v3v3.u1.pin_25"], add: netLinks("vcore", ["u1:pin_25"]) });
    const d = check(board).find((x) => x.id === "net:vcore:feedback:u1")!;
    expect(d.severity).toBe("error");
    expect(d.details?.inputs).toEqual(["u1:pin_25"]);
  });

  it("the IMU's address strap ADDR moved from GND onto SDA follows the bus", () => {
    const board = variant({ drop: ["gnd.u2.pin_4"], add: netLinks("sda", ["u2:pin_4"]) });
    const d = errors(board).find((x) => x.id === "net:sda:strap:u2:pin_4")!;
    expect(d.message).toMatch(/u2:pin_4 \(ADDR\) is a strap \(I2C address bit 0\) but net sda \(SDA\) carries .*u1:pin_2/);
  });

  it("a strap is at a fixed level on a supply net, or on a net of its own through a resistor", () => {
    const high = variant({ drop: ["gnd.u2.pin_4"], add: netLinks("v3v3", ["u2:pin_4"]) });
    expect(check(high).some((x) => x.id.includes(":strap:"))).toBe(false);
    const pulled = variant({
      drop: ["gnd.u2.pin_4"],
      nets: [Net({ id: "addr", name: "ADDR" })],
      children: [{ id: "r9", moduleDefId: "fixture-r-4k7-0402" }],
      add: [...netLinks("addr", ["u2:pin_4", "r9:pin_1"]), ...netLinks("gnd", ["r9:pin_2"])],
    });
    expect(check(pulled).some((x) => x.id.includes(":strap:"))).toBe(false);
  });

  it("a strap with `when` applies only while its part runs that interface", () => {
    // fixture part: a sensor whose MODE pin is a strap only in I2C mode, and a BOOT pin that always is
    const sensor = defineModule({
      id: "fixture-strapped-sensor",
      name: "Fixture strapped sensor",
      interfaces: [
        ...pinTable([[1, "MODE", "input", "Mode select"], [2, "BOOT", "input", "Boot select"], [3, "GND", "ground"]], { source: "fixture", logicV: [0, 3.6] }).map((i) =>
          i.id === "pin_1"
            ? { ...i, traits: [...(i.traits ?? []), { type: "strap", params: { function: "mode", when: ["i2c"] } }] }
            : i.id === "pin_2"
              ? { ...i, traits: [...(i.traits ?? []), { type: "strap", params: { function: "boot mode" } }] }
              : i,
        ),
      ],
    });
    const board = variant({ children: [{ id: "u6", moduleDefId: sensor.id }], add: [...netLinks("imu_int1", ["u6:pin_1", "u6:pin_2"]), ...netLinks("gnd", ["u6:pin_3"])] });
    const ids = check(board, (x) => (x === sensor.id ? sensor : lookupBoardModule(x))).map((x) => x.id);
    expect(ids).toContain("net:imu_int1:strap:u6:pin_2");
    expect(ids).not.toContain("net:imu_int1:strap:u6:pin_1");
  });
});
