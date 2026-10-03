/**
 * Boards and nets (PB-824): a custom PCB as a module whose nets are `Net`
 * interfaces joined by membership links. Uses the fixture board in
 * fixtures/imu-board.ts (RP2040 + BMI270 + TPS63020, real library parts).
 */
import { describe, it, expect } from "vitest";
import type { InterfaceLink, ModuleDef } from "../src/types/index.js";
import { checkSystem } from "../src/system/checks.js";
import { systemLinks } from "../src/system/derive.js";
import { validateLinks } from "../src/system/index.js";
import { moduleNets } from "../src/system/nets.js";
import { Ground, Net, PowerOut, defineModule, netLinks, pinTable } from "../src/protocols/index.js";
import { IMU_BOARD, lookupBoardModule } from "./fixtures/imu-board.js";
import { BOSCH_BMI270 } from "../library/parts/bosch-bmi270.js";
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
    expect(netLinks("gnd", ["u2:pin_6"])).toEqual([{ id: "gnd.u2.pin_6", a: { child: "u2", interfaceId: "pin_6" }, b: { self: true, interfaceId: "gnd" } }]);
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
    expect(nets.get("sda")).toEqual(["u1:pin_2", "u2:pin_14", "r3:pin_2"]);
    expect(nets.get("v3v3")).toHaveLength(17);
  });

  it("derives the I2C link from the SDA and SCL nets, lifted to the controllers", () => {
    const i2c = result.links.filter((r) => r.protocol === "i2c");
    expect(i2c).toHaveLength(1);
    expect([i2c[0].a.path, i2c[0].b.path]).toEqual(["u1:i2c_0", "u2:i2c"]);
    expect(i2c[0].state).toBe("configured");
    expect(i2c[0].derived?.nets).toEqual(["scl", "sda"]);
    expect(i2c[0].children.map((c) => `${c.a.leafId}>${c.b.leafId}`)).toEqual(["pin_2>pin_14", "pin_3>pin_13"]);
  });

  it("derives supply links from the regulator to every load on 3V3, and none between two loads", () => {
    const supply = result.links.filter((r) => r.derived?.nets?.includes("v3v3") && r.protocol === "power");
    expect(new Set(supply.map((r) => r.a.path))).toEqual(new Set(["u3:pin_4", "u3:pin_5"]));
    expect(new Set(supply.map((r) => r.b.path))).toEqual(
      new Set(["u1:pin_1", "u1:pin_10", "u1:pin_22", "u1:pin_33", "u1:pin_42", "u1:pin_49", "u1:pin_43", "u1:pin_44", "u1:pin_48", "u2:pin_8", "u2:pin_5"]),
    );
  });

  it("derives the RP2040's own regulator feeding its core through the 1V1 net", () => {
    const core = result.links.filter((r) => r.derived?.nets?.includes("v1v1"));
    expect(core.map((r) => `${r.a.path}>${r.b.path}`)).toEqual(["u1:pin_45>u1:pin_23", "u1:pin_45>u1:pin_50"]);
  });

  it("makes no link for passives, straps or pads that only share a net", () => {
    const paths = result.links.filter((r) => r.derived).flatMap((r) => [r.a.path, r.b.path]);
    expect(paths.some((p) => /^(r\d|l1):/.test(p))).toBe(false);
    expect(paths).not.toContain("u2:pin_12"); // CSB strapped to 3V3
    expect(paths).not.toContain("u2:pin_1"); // SDO strapped to GND
    expect(paths).not.toContain("u1:pin_19"); // TESTEN strapped to GND
  });

  it("derives only power links over a rail, and none between ground pins", () => {
    const onRails = result.links.filter((r) => r.derived?.nets?.some((n) => ["gnd", "v3v3", "v1v1", "vin"].includes(n)));
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
    expect(d.details?.capacityW).toBeCloseTo(6.6, 6); // 3.3 V net × 2 A port rating
    expect((d.details?.unknownLoads as string[]).length).toBe(11);
  });

  it("lifted links are one use of a pin, however many pins share its net", () => {
    expect(result.diagnostics.some((d) => d.rule === "interface_reuse")).toBe(false);
  });
});

describe("seeded board faults", () => {
  it("IMU on a 5 V net: the net's design voltage exceeds VDD", () => {
    const board = variant({
      nets: [Net({ id: "v5", name: "5V", voltageV: 5 })],
      drop: ["v3v3.u2.pin_8"],
      add: netLinks("v5", ["u2:pin_8"]),
    });
    const d = check(board).filter((x) => x.rule === "net" && x.severity === "error");
    expect(d.map((x) => x.id)).toContain("net:v5:voltage:u2:pin_8");
    expect(d.find((x) => x.id === "net:v5:voltage:u2:pin_8")!.message).toMatch(/1\.71–3\.6 V but net v5 \(5V\) is 5 V/);
  });

  it("3V3 net declared at 5 V: every 3.3 V pin is flagged, the adjustable regulator is not", () => {
    const board = variant({ nets: [Net({ id: "v3v3", name: "3V3", voltageV: 5 })] });
    const flagged = check(board).filter((x) => x.id.startsWith("net:v3v3:voltage:")).map((x) => x.refs[1]);
    expect(flagged).toContain("u2:pin_8");
    expect(flagged).toContain("u1:pin_1");
    expect(flagged).not.toContain("u3:pin_4"); // VOUT is 1.2–5.5 V
    // CSB is a logic input: flagged because 5 V is above its maximum
    const csb = check(board).find((x) => x.id === "net:v3v3:voltage:u2:pin_12")!;
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

  it("a second BMI270 on the same bus with SDO low is an address conflict", () => {
    const board = variant({
      children: [{ id: "u4", moduleDefId: BOSCH_BMI270.id, name: "IMU 2" }],
      add: [
        ...netLinks("sda", ["u4:pin_14"]),
        ...netLinks("scl", ["u4:pin_13"]),
        ...netLinks("v3v3", ["u4:pin_8", "u4:pin_5", "u4:pin_12"]),
        ...netLinks("gnd", ["u4:pin_6", "u4:pin_7", "u4:pin_1"]),
      ],
    });
    const d = check(board).find((x) => x.rule === "bus_address")!;
    expect(d.severity).toBe("error");
    expect(d.message).toMatch(/0x68 \(u2:i2c, u4:i2c\)/);
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
      drop: ["sda.u2.pin_14", "scl.u2.pin_13"],
      add: [...netLinks("sda", ["u2:pin_13"]), ...netLinks("scl", ["u2:pin_14"])],
    });
    const i2c = checkSystem(board, lookupBoardModule).links.find((r) => r.protocol === "i2c")!;
    expect(i2c.state).toBe("incompatible");
    expect(i2c.diagnostics.map((d) => d.code)).toContain("harness_wiring");
  });

  it("SDx and INT1 swapped at the IMU leave the I2C bus incomplete", () => {
    const board = variant({
      drop: ["sda.u2.pin_14", "imu_int1.u2.pin_4"],
      add: [...netLinks("sda", ["u2:pin_4"]), ...netLinks("imu_int1", ["u2:pin_14"])],
    });
    const r = checkSystem(board, lookupBoardModule);
    const i2c = r.links.find((x) => x.protocol === "i2c")!;
    expect(i2c.state).toBe("incompatible");
    expect(i2c.children.map((c) => `${c.a.leafId}>${c.b.leafId}`)).toEqual(["pin_3>pin_13"]);
    expect(i2c.diagnostics.find((d) => d.code === "bus_incomplete")!.message).toMatch(/sda: u1:i2c_0 pin_2 and u2:i2c pin_14 are not wired/);
    expect(r.diagnostics.some((d) => d.rule === "link_state" && d.severity === "error")).toBe(true);
  });

  it("ground joined to 3V3 is a short", () => {
    const board = variant({ add: netLinks("v3v3", ["u2:pin_7"]) });
    const d = check(board);
    expect(d.map((x) => x.id)).toContain("net:v3v3:ground");
    expect(d.map((x) => x.id)).toContain("net:short:u2:pin_7"); // on GND and 3V3
  });

  it("a second supply driving 3V3 is reported", () => {
    const ldo = defineModule({ id: "fixture-ldo", name: "Fixture LDO", interfaces: [PowerOut({ id: "vout", pin: 5, voltageV: 3.3, maxCurrentA: 0.3 })] });
    const board = variant({ children: [{ id: "u5", moduleDefId: ldo.id }], add: netLinks("v3v3", ["u5:vout"]) });
    const d = checkSystem(board, (id) => (id === ldo.id ? ldo : lookupBoardModule(id))).diagnostics.find((x) => x.id === "net:v3v3:drivers")!;
    expect(d.severity).toBe("error");
    expect(d.refs).toEqual(expect.arrayContaining(["u3:pin_4", "u5:vout"]));
  });

  it("a net with one pin, and a removed regulator output, leave loads unpowered", () => {
    const board = variant({ drop: IMU_BOARD.links!.filter((l) => l.id.startsWith("v3v3.u3.")).map((l) => l.id) });
    const d = check(board);
    expect(d.filter((x) => x.rule === "unpowered").map((x) => x.refs[0])).toEqual(expect.arrayContaining(["u2:pin_8", "u1:pin_1"]));
    const lonely = check(variant({ drop: ["imu_int1.u2.pin_4"] })).find((x) => x.id === "net:imu_int1:members")!;
    expect(lonely.message).toMatch(/joins only u1:pin_4/);
  });

  it("without the board-edge export, the regulator's input pins are unpowered", () => {
    const board = { ...IMU_BOARD, exports: IMU_BOARD.exports!.filter((e) => e.id !== "power_in") };
    const unpowered = check(board).filter((x) => x.rule === "unpowered").map((x) => x.refs[0]);
    expect(unpowered).toEqual(expect.arrayContaining(["u3:pin_10", "u3:pin_11", "u3:pin_1", "u3:vin"]));
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
    expect(() => defineModule({ ...IMU_BOARD, exports: [{ id: "gnd", from: { child: "u3", interfaceId: "pin_2" } }] })).toThrow(/export "gnd" has the id of an interface/);
  });

  it("links to the board's edge export, and the nets stay inside the board", () => {
    const r = checkSystem(system, lookup);
    const battery = r.links.find((x) => x.link.id === "battery")!;
    expect(battery.state).toBe("configured");
    expect(battery.b.owner.id).toBe("ti-tps63020dsjr");
    expect(battery.b.iface.id).toBe("pin_10");
    expect(r.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });
});

/**
 * Rules as a real board needs them (found on the wearable watch's main board,
 * protoboard-cli examples/wearable-watch): a supply input takes the whole
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
      drop: ["v3v3.u2.pin_8"],
      add: netLinks("vbat", ["u2:pin_8"]),
    });
    const d = check(board).find((x) => x.id === "net:vbat:voltage:u2:pin_8")!;
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
