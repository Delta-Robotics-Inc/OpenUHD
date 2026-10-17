/**
 * Net ports, derivation through them, and the board marker
 * (docs/boards-and-nets.md, "Sub-circuits and net ports"). The fixture is the
 * IMU board of imu-board.ts drawn hierarchically (fixtures/nested-board.ts):
 * the IMU and its pull-ups are a sub-circuit whose nets are net ports.
 */
import { describe, it, expect } from "vitest";
import type { InterfaceLink, ModuleDef } from "../src/types/index.js";
import { checkSystem } from "../src/system/checks.js";
import { systemLinks } from "../src/system/derive.js";
import { boundaryInterfaces, isBoard, resolveEndpoint, resolveExports, validateLinks } from "../src/system/index.js";
import { moduleNets } from "../src/system/nets.js";
import { Net, defineModule, netLinks } from "../src/protocols/index.js";
import { IMU_MODULE, NESTED_BOARD, lookupNested } from "./fixtures/nested-board.js";
import { IMU_BOARD, L_2U2, R_1M, R_220K, R_4K7, lookupBoardModule } from "./fixtures/imu-board.js";
import { FIXTURE_BUCK_BOOST } from "./fixtures/parts/fixture-buck-boost.js";
import { FIXTURE_IMU } from "./fixtures/parts/fixture-imu.js";
import { FIXTURE_MCU } from "./fixtures/parts/fixture-mcu.js";

const lookup = lookupNested();
const check = (def: ModuleDef, l = lookup) => checkSystem(def, l).diagnostics;
const problems = (def: ModuleDef, l = lookup) => check(def, l).filter((d) => d.severity !== "info");

/** The nested board with some links dropped (by id) and others added. */
function variant(changes: { drop?: (id: string) => boolean; add?: InterfaceLink[]; nets?: ModuleDef["interfaces"]; children?: ModuleDef["children"] }): ModuleDef {
  return {
    ...NESTED_BOARD,
    interfaces: [...NESTED_BOARD.interfaces.filter((i) => !changes.nets?.some((n) => n.id === i.id)), ...(changes.nets ?? [])],
    children: [...NESTED_BOARD.children!.filter((c) => !changes.children?.some((n) => n.id === c.id)), ...(changes.children ?? [])],
    links: [...NESTED_BOARD.links!.filter((l) => !changes.drop?.(l.id)), ...(changes.add ?? [])],
  };
}

/** The IMU sub-circuit with its VDD net restated. */
const imuModuleWithVdd = (id: string, voltageV?: number) =>
  defineModule({ ...IMU_MODULE, id, interfaces: IMU_MODULE.interfaces.map((i) => (i.id === "vdd" ? Net({ id: "vdd", name: "VDD", ...(voltageV !== undefined ? { voltageV } : {}) }) : i)) });

describe("net ports: authoring", () => {
  it("a net port may take its net's id, and is on the module's boundary", () => {
    const vdd = boundaryInterfaces(IMU_MODULE, lookup).find((i) => i.id === "vdd")!;
    expect(vdd.protocols[0].type).toBe("net");
    expect(vdd.exposed).toBe(true);
    const ex = resolveExports(IMU_MODULE, lookup).find((e) => e.id === "vdd")!;
    expect(ex.childDef).toBe(IMU_MODULE);
    expect(ex.implicit).toBe(false);
  });

  it("refuses a net port of something that is not a net, a net exported twice, and a port id that is another interface's", () => {
    const base = { ...IMU_MODULE, exports: [] };
    expect(() => defineModule({ ...base, interfaces: [...base.interfaces, { id: "pin_x", domain: "electrical" as const, exposed: true, protocols: [] }], exports: [{ id: "x", from: { self: true, interfaceId: "pin_x" } }] })).toThrow(/net port "x" exports "pin_x", which is not a net of the module/);
    expect(() => defineModule({ ...base, exports: [{ id: "vdd", from: { self: true, interfaceId: "vdd" } }, { id: "vdd2", from: { self: true, interfaceId: "vdd" } }] })).toThrow(/net "vdd" is exported by more than one net port/);
    expect(() => defineModule({ ...base, exports: [{ id: "gnd", from: { self: true, interfaceId: "vdd" } }] })).toThrow(/export "gnd" has the id of an interface/);
    // a child export still may not take a net's id
    expect(() => defineModule({ ...base, exports: [{ id: "vdd", from: { child: "u1", interfaceId: "pin_7" } }] })).toThrow(/export "vdd" has the id of an interface/);
  });

  it("a net port under another id: the port resolves, the net's own id does not", () => {
    const renamed = defineModule({ ...IMU_MODULE, id: "imu-renamed", exports: [{ id: "vdd_in", from: { self: true, interfaceId: "vdd" } }] });
    const board = { ...NESTED_BOARD, children: NESTED_BOARD.children!.map((c) => (c.id === "imu" ? { ...c, moduleDefId: renamed.id } : c)) };
    const l = lookupNested(renamed);
    const viaPort = resolveEndpoint(board, { child: "imu", interfaceId: "vdd_in" }, l);
    expect(viaPort.netPort).toBe(true);
    expect(viaPort.iface.id).toBe("vdd");
    expect(viaPort.ownerPath).toEqual(["imu"]);
    const r = validateLinks({ ...board, links: netLinks("v3v3", ["imu:vdd_in", "imu:vdd"]) }, l);
    expect(r.map((x) => x.state)).toEqual(["configured", "incompatible"]);
    // as before net ports: a child's net joined to this module's net
    expect(r[1].diagnostics.map((d) => d.code)).toEqual(["net_to_net", "net_not_own"]);
  });

  it("two net ports join through a net of the module, not to each other", () => {
    const r = validateLinks({ ...NESTED_BOARD, links: [{ id: "pp", a: { child: "imu", interfaceId: "sda" }, b: { child: "imu", interfaceId: "scl" } }] }, lookup)[0];
    expect(r.state).toBe("incompatible");
    expect(r.diagnostics.map((d) => d.code)).toEqual(["net_to_net"]);
    expect(r.diagnostics[0].message).toMatch(/both net ports/);
  });

  it("a group exports a child's net port like any other boundary interface", () => {
    const group = defineModule({ id: "imu-group", name: "IMU group", kind: "group", interfaces: [], children: [{ id: "s", moduleDefId: IMU_MODULE.id }] });
    const parent = defineModule({ id: "p", name: "P", interfaces: [Net({ id: "v" })], children: [{ id: "g", moduleDefId: group.id }], links: netLinks("v", ["g:s__vdd"]) });
    const l = lookupNested(group);
    const end = resolveEndpoint(parent, { child: "g", interfaceId: "s__vdd" }, l);
    expect(end.netPort).toBe(true);
    expect(end.ownerPath).toEqual(["g", "s"]);
    expect(validateLinks(parent, l)[0].state).toBe("configured");
  });
});

describe("derivation through net ports: the hierarchical IMU board", () => {
  const result = checkSystem(NESTED_BOARD, lookup);
  const flat = checkSystem(IMU_BOARD, lookupBoardModule);
  const key = (r: { protocol: string; a: { path: string }; b: { path: string } }) => `${r.protocol} ${r.a.path} > ${r.b.path}`;

  it("joins each net port to a net of the board", () => {
    const stored = validateLinks(NESTED_BOARD, lookup);
    for (const r of stored) expect(r.state, r.link.id).toBe("configured");
    const vdd = stored.find((r) => r.link.id === "v3v3.imu.vdd")!;
    expect(vdd.a.netPort).toBe(true);
    expect(vdd.a.owner.id).toBe(IMU_MODULE.id);
  });

  it("derives the flat board's functional links, with the IMU at its path in the sub-circuit", () => {
    const nested = result.links.filter((r) => r.derived).map(key).sort();
    const flatKeys = flat.links.filter((r) => r.derived).map(key).map((k) => k.replaceAll("u2:", "imu/u1:")).sort();
    expect(nested).toEqual(flatKeys);
    const i2c = result.links.find((r) => r.protocol === "i2c")!;
    expect([i2c.a.path, i2c.b.path, i2c.state]).toEqual(["u1:i2c_0", "imu/u1:i2c", "configured"]);
    expect(i2c.derived?.nets).toEqual(["imu:scl", "imu:sda", "scl", "sda"]);
    expect(i2c.children.map((c) => `${c.a.leafId}>${c.b.leafId}`)).toEqual(["pin_2>pin_1", "pin_3>pin_2"]);
  });

  it("reports no errors or warnings on the board, nor on the sub-circuit checked alone", () => {
    expect(result.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
    expect(problems(IMU_MODULE)).toEqual([]);
  });

  it("indexes a net with its ports, the nets behind them and the pins they reach", () => {
    const v3v3 = moduleNets(NESTED_BOARD, result.links, lookup).find((n) => n.iface.id === "v3v3")!;
    expect(v3v3.ports?.map((p) => p.path)).toEqual(["imu:vdd"]);
    expect(v3v3.nested?.map((n) => n.path)).toEqual(["imu:vdd"]);
    const inside = v3v3.members.filter((m) => m.through);
    expect(inside.map((m) => m.path)).toEqual(["imu/u1:pin_7", "imu/u1:pin_8", "imu/u1:pin_3", "imu/r1:pin_1", "imu/r2:pin_1"]);
    expect(inside[0].through).toEqual(["imu:vdd"]);
    expect(inside[0].link).toBe("imu/vdd.u1.pin_7");
    // without a lookup, the ports are listed and not followed
    const shallow = moduleNets(NESTED_BOARD, result.links).find((n) => n.iface.id === "v3v3")!;
    expect(shallow.members.some((m) => m.through)).toBe(false);
    expect(shallow.ports).toHaveLength(1);
  });

  it("budgets the regulator with the sub-circuit's loads counted once", () => {
    const flatBudget = flat.diagnostics.find((x) => x.id === "supply_budget:u3:vout")!;
    const d = result.diagnostics.find((x) => x.id === "supply_budget:u3:vout")!;
    expect(d.details?.unknownLoads).toEqual((flatBudget.details?.unknownLoads as string[]).map((p) => p.replace("u2:", "imu/u1:")));
  });
});

describe("derivation through net ports: across the boundary", () => {
  it("two instances of one definition are two sets of parts and nets, and share the bus: an address conflict", () => {
    const board = variant({
      children: [{ id: "imu2", moduleDefId: IMU_MODULE.id, name: "IMU 2" }],
      add: [...netLinks("v3v3", ["imu2:vdd"]), ...netLinks("gnd", ["imu2:gnd"]), ...netLinks("sda", ["imu2:sda"]), ...netLinks("scl", ["imu2:scl"])],
    });
    const r = checkSystem(board, lookup);
    const sda = moduleNets(board, r.links, lookup).find((n) => n.iface.id === "sda")!;
    expect(sda.nested?.map((n) => n.path)).toEqual(["imu:sda", "imu2:sda"]);
    expect(sda.members.map((m) => m.path)).toEqual(["u1:pin_2", "imu/u1:pin_1", "imu/r1:pin_2", "imu2/u1:pin_1", "imu2/r1:pin_2"]);
    expect(r.links.filter((x) => x.protocol === "i2c").map((x) => x.b.path)).toEqual(["imu/u1:i2c", "imu2/u1:i2c"]);
    const d = r.diagnostics.find((x) => x.rule === "bus_address")!;
    expect(d.severity).toBe("error");
    expect(d.message).toMatch(/0x6A \(imu\/u1:i2c, imu2\/u1:i2c\)/);
  });

  it("a bus crossed at the ports (the board's SDA on the sub-circuit's SCL) is miswiring", () => {
    const board = variant({ drop: (id) => id === "sda.imu.sda" || id === "scl.imu.scl", add: [...netLinks("sda", ["imu:scl"]), ...netLinks("scl", ["imu:sda"])] });
    const i2c = systemLinks(board, lookup).find((x) => x.protocol === "i2c")!;
    expect(i2c.state).toBe("incompatible");
    expect(i2c.diagnostics.map((d) => d.code)).toContain("harness_wiring");
  });

  it("one conductor has one voltage: the sub-circuit's 1.8 V VDD on the board's 3.3 V net", () => {
    const m18 = imuModuleWithVdd("imu-1v8", 1.8);
    const board = variant({ children: [{ id: "imu", moduleDefId: m18.id }] });
    const errors = check(board, lookupNested(m18)).filter((d) => d.severity === "error");
    expect(errors.map((d) => d.id)).toEqual(["net:v3v3:port_voltage:imu:vdd"]);
    expect(errors[0].message).toMatch(/3\.3 V, but imu:vdd \(VDD\), joined to it through a net port, is 1\.8 V/);
  });

  it("pins inside the sub-circuit are checked against the board net's voltage when their own net states none", () => {
    const m0 = imuModuleWithVdd("imu-no-v");
    const board = variant({ children: [{ id: "imu", moduleDefId: m0.id }], nets: [Net({ id: "v3v3", name: "3V3", voltageV: 5 })] });
    const ids = check(board, lookupNested(m0)).map((d) => d.id);
    expect(ids).toContain("net:v3v3:voltage:imu/u1:pin_7");
    expect(ids).toContain("net:v3v3:voltage:imu/u1:pin_8");
    expect(ids.some((id) => id.includes("port_voltage"))).toBe(false);
    // the same faults the flat board reports for its IMU, and the supply links to it are incompatible
    expect(ids).toContain("link_state:imu/vdd.u1.pin_7+v3v3.imu.vdd+v3v3.u3.pin_8~pin_8~pin_7");
  });

  it("a sub-circuit's supply net that nothing feeds is unpowered at the board, unless marked", () => {
    const board = variant({ drop: (id) => id === "v3v3.imu.vdd" });
    const d = check(board).find((x) => x.id === "unpowered:imu:vdd")!;
    expect(d.severity).toBe("warning");
    expect(d.message).toMatch(/net port feeding imu\/u1:pin_7, imu\/u1:pin_8/);
    const marked = { ...board, children: board.children!.map((c) => (c.id === "imu" ? { ...c, unconnected: [{ interfaceId: "vdd", reason: "fitted later" }] } : c)) };
    expect(check(marked).find((x) => x.id === "unpowered:imu:vdd")?.severity).toBe("info");
  });

  it("the sub-circuit's ground on the board's 3V3 is a short", () => {
    const board = variant({ drop: (id) => id === "gnd.imu.gnd", add: netLinks("v3v3", ["imu:gnd"]) });
    const d = check(board).find((x) => x.id === "net:v3v3:ground")!;
    expect(d.message).toMatch(/joins ground \(imu\/u1:pin_9, imu\/u1:pin_10\)/);
  });

  it("a port on two of the board's nets joins them", () => {
    const board = variant({ add: netLinks("vin", ["imu:vdd"]) });
    expect(check(board).map((d) => d.id)).toContain("net:short:imu:vdd");
  });

  it("a pull-up inside the sub-circuit with both ends put on 3V3 by the board is shorted", () => {
    const board = variant({ drop: (id) => id === "sda.imu.sda", add: netLinks("v3v3", ["imu:sda"]) });
    expect(check(board).map((d) => d.id)).toContain("net:v3v3:shorted:imu/r1");
  });

  it("a pin linked straight to a net port is on the sub-circuit's net", () => {
    const board = variant({
      nets: [],
      drop: (id) => id.startsWith("imu_int1."),
      add: [{ id: "int", a: { child: "u1", interfaceId: "pin_4" }, b: { child: "imu", interfaceId: "int1" } }],
    });
    const trimmed = { ...board, interfaces: board.interfaces.filter((i) => i.id !== "imu_int1") };
    const r = checkSystem(trimmed, lookup);
    expect(r.links.find((x) => x.link.id === "int")!.state).toBe("configured");
    const int = r.links.find((x) => x.derived && x.b.path === "imu/u1:pin_5")!;
    expect([int.a.path, int.state, int.derived?.nets]).toEqual(["u1:pin_4", "configured", ["imu:int1"]]);
    const net = moduleNets(trimmed, r.links, lookup).find((n) => n.iface.id === "imu:int1")!;
    expect(net.members.map((m) => m.path)).toEqual(["u1:pin_4", "imu/u1:pin_5"]);
    expect(r.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });

  it("follows net ports through several levels: a wrapper's own net joined to its child's port", () => {
    const wrapper = defineModule({
      id: "imu-wrapper",
      name: "IMU with a bleeder",
      interfaces: [Net({ id: "vdd", voltageV: 3.3 }), Net({ id: "gnd" })],
      children: [
        { id: "imu", moduleDefId: IMU_MODULE.id },
        { id: "rb", moduleDefId: R_4K7.id, name: "bleeder" },
      ],
      links: [...netLinks("vdd", ["imu:vdd", "rb:pin_1"]), ...netLinks("gnd", ["imu:gnd", "rb:pin_2"])],
      exports: [
        { id: "vdd", from: { self: true, interfaceId: "vdd" } },
        { id: "gnd", from: { self: true, interfaceId: "gnd" } },
        // a child's net port re-exported as it is
        { id: "sda", from: { child: "imu", interfaceId: "sda" } },
        { id: "scl", from: { child: "imu", interfaceId: "scl" } },
      ],
    });
    const board = variant({
      children: [{ id: "imu", moduleDefId: wrapper.id }],
      drop: (id) => id.startsWith("imu_int1."),
      nets: [],
    });
    const trimmed = { ...board, interfaces: board.interfaces.filter((i) => i.id !== "imu_int1") };
    const l = lookupNested(wrapper);
    const r = checkSystem(trimmed, l);
    const v3v3 = moduleNets(trimmed, r.links, l).find((n) => n.iface.id === "v3v3")!;
    expect(v3v3.nested?.map((n) => n.path)).toEqual(["imu:vdd", "imu/imu:vdd"]);
    expect(v3v3.members.find((m) => m.path === "imu/imu/u1:pin_7")?.through).toEqual(["imu:vdd", "imu/imu:vdd"]);
    expect(v3v3.members.find((m) => m.path === "imu/rb:pin_1")?.through).toEqual(["imu:vdd"]);
    const i2c = r.links.find((x) => x.protocol === "i2c")!;
    expect([i2c.b.path, i2c.state]).toEqual(["imu/imu/u1:i2c", "configured"]);
    expect(r.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });

  it("a pair wholly inside a sub-circuit is derived by the sub-circuit's check, not the board's", () => {
    // a power stage with its own local load: the regulator feeds the IMU inside, and the MCU outside
    const stage = defineModule({
      id: "power-stage",
      name: "3V3 power stage with a local IMU",
      interfaces: [Net({ id: "vin", voltageV: [2.5, 5.5] }), Net({ id: "vout", voltageV: 3.3 }), Net({ id: "gnd" }), Net({ id: "fb" }), Net({ id: "sw1" }), Net({ id: "sw2" })],
      children: [
        { id: "u3", moduleDefId: FIXTURE_BUCK_BOOST.id },
        { id: "l1", moduleDefId: L_2U2.id },
        { id: "r1", moduleDefId: R_1M.id },
        { id: "r2", moduleDefId: R_220K.id },
        { id: "imu", moduleDefId: FIXTURE_IMU.id },
      ],
      links: [
        ...netLinks("vin", ["u3:pin_1", "u3:pin_2", "u3:pin_3", "u3:pin_4", "u3:pin_5"]),
        ...netLinks("sw1", ["u3:pin_6", "l1:pin_1"]),
        ...netLinks("sw2", ["u3:pin_7", "l1:pin_2"]),
        ...netLinks("fb", ["u3:pin_10", "r1:pin_2", "r2:pin_1"]),
        ...netLinks("vout", ["u3:pin_8", "u3:pin_9", "r1:pin_1", "imu:pin_7", "imu:pin_8", "imu:pin_3"]),
        ...netLinks("gnd", ["u3:pin_11", "u3:pgnd", "r2:pin_2", "imu:pin_9", "imu:pin_10", "imu:pin_4"]),
      ],
      exports: ["vin", "vout", "gnd"].map((id) => ({ id, from: { self: true as const, interfaceId: id } })),
    });
    const board = defineModule({
      id: "mcu-on-stage",
      name: "MCU on a power stage",
      kind: "board",
      interfaces: [Net({ id: "vbat", voltageV: [3.0, 4.2] }), Net({ id: "v3v3", voltageV: 3.3 }), Net({ id: "vcore", voltageV: 1.2 }), Net({ id: "gnd" })],
      children: [
        { id: "pwr", moduleDefId: stage.id },
        { id: "u1", moduleDefId: FIXTURE_MCU.id },
      ],
      links: [
        ...netLinks("vbat", ["pwr:vin"]),
        ...netLinks("v3v3", ["pwr:vout", "u1:pin_1", "u1:pin_9", "u1:pin_19", "u1:pin_24", "u1:pin_25"]),
        ...netLinks("vcore", ["u1:pin_26", "u1:pin_27", "u1:pin_28"]),
        ...netLinks("gnd", ["pwr:gnd", "u1:pad_gnd", "u1:pin_10"]),
      ],
      // the battery net is the board's edge, as a net port
      exports: [{ id: "vbat", from: { self: true, interfaceId: "vbat" } }, { id: "gnd", from: { self: true, interfaceId: "gnd" } }],
    });
    const l = lookupNested(stage, board);
    const atBoard = checkSystem(board, l);
    const power = atBoard.links.filter((x) => x.derived && x.protocol === "power").map((x) => `${x.a.path}>${x.b.path}`);
    expect(power).toContain("pwr/u3:pin_8>u1:pin_1");
    expect(power.some((p) => p.includes("pwr/imu"))).toBe(false);
    expect(atBoard.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
    const atStage = checkSystem(stage, l);
    expect(atStage.links.filter((x) => x.derived).map((x) => `${x.a.path}>${x.b.path}`)).toContain("u3:pin_8>imu:pin_7");
    // the stage's input is fed through its net port, so the stage checked alone does not call it unpowered
    expect(atStage.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });
});

describe("without net ports", () => {
  it("a sub-circuit that exports pins is read as before: the parent does not derive the bus inside it", () => {
    const pins = defineModule({
      ...IMU_MODULE,
      id: "imu-pin-exports",
      exports: [
        { id: "vdd_pin", from: { child: "u1", interfaceId: "pin_7" } },
        { id: "gnd_pin", from: { child: "u1", interfaceId: "pin_9" } },
        // SDA and SCL are bound into the IMU's I2C port, so only the pull-ups' pins can be the edge
        { id: "sda_pull", from: { child: "r1", interfaceId: "pin_2" } },
        { id: "scl_pull", from: { child: "r2", interfaceId: "pin_2" } },
      ],
    });
    const board = variant({
      children: [{ id: "imu", moduleDefId: pins.id }],
      drop: (id) => id.includes(".imu."),
      add: netLinks("sda", ["imu:sda_pull"]).concat(netLinks("scl", ["imu:scl_pull"]), netLinks("v3v3", ["imu:vdd_pin"]), netLinks("gnd", ["imu:gnd_pin"])),
    });
    const r = checkSystem(board, lookupNested(pins));
    expect(r.links.filter((x) => x.protocol === "i2c")).toEqual([]);
    // the exported supply pin is reached, as it always was
    expect(r.links.some((x) => x.derived && x.b.path === "imu:vdd_pin")).toBe(true);
    const v3v3 = moduleNets(board, r.links, lookupNested(pins)).find((n) => n.iface.id === "v3v3")!;
    expect(v3v3.ports).toBeUndefined();
    expect(v3v3.members.some((m) => m.through)).toBe(false);
  });
});

describe("the board marker", () => {
  it("marks a module as one PCB; design_envelope alone does not", () => {
    expect(isBoard(NESTED_BOARD)).toBe(true);
    expect(isBoard(IMU_BOARD)).toBe(false);
    expect(isBoard(IMU_MODULE)).toBe(false);
  });

  it("a board behaves as a module in every check", () => {
    const marked = { ...IMU_BOARD, kind: "board" as const };
    const summary = (def: ModuleDef) => {
      const r = checkSystem(def, lookupBoardModule);
      return { links: r.links.map((x) => [x.link.id, x.protocol, x.state, x.a.path, x.b.path]), diagnostics: r.diagnostics };
    };
    expect(summary(marked)).toEqual(summary(IMU_BOARD));
    // no implicit exports, unlike a group
    expect(resolveExports({ ...marked, exports: [] }, lookupBoardModule)).toEqual([]);
  });

  it("design_envelope is checked on a marked board as before", () => {
    const big = { ...IMU_BOARD, kind: "board" as const, domains: [{ domain: "mechanical" as const, dimensions_mm: { length: 40, width: 20, height: 4 } }] };
    expect(check(big, lookupBoardModule).find((d) => d.id === "design_envelope:length")?.severity).toBe("error");
  });
});
