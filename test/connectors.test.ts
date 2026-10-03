/**
 * Connector composites, link-scoped composition, physical harnesses
 * and the functional links derived through them. Uses the fixture flight
 * controller, video unit and GNSS (fixtures/drone.ts); the cables are defined here.
 */
import { describe, expect, it } from "vitest";
import type { InterfaceLink, ModuleDef } from "../src/types/index.js";
import { Connector } from "../src/protocols/index.js";
import { checkSystem } from "../src/system/checks.js";
import { deriveLinks } from "../src/system/derive.js";
import { validateLinks } from "../src/system/index.js";
import { FC, GNSS, VIDEO as O4 } from "./fixtures/drone.js";

const DJI_CABLE: ModuleDef = {
  id: "test-dji-3in1-cable",
  name: "Video unit 3-in-1 cable",
  kind: "harness",
  topology: "wire",
  interfaces: [
    Connector({ id: "end_fc", connector: "dji_6pin", gender: "plug", pins: ["10V", "G", "T5", "R5", "G", "Sbus"] }),
    Connector({ id: "end_o4", connector: "dji_3in1_cable_6pin", pins: ["VCC", "GND", "RX", "TX", "GND", "S.Bus"] }),
  ],
  links: [{ id: "wires", a: { self: true, interfaceId: "end_fc" }, b: { self: true, interfaceId: "end_o4" } }],
};

const GNSS_LEAD: ModuleDef = {
  id: "test-gh6p-lead",
  name: "GH6P lead, FC end soldered",
  kind: "harness",
  topology: "wire",
  interfaces: [
    Connector({ id: "end_gnss", connector: "jst_gh_6", gender: "plug", pins: ["5V", "RX", "TX", "CL", "DA", "G"] }),
    Connector({ id: "end_fc", connector: "flying_leads", pins: ["5V", "RX", "TX", "CL", "DA", "G"] }),
  ],
  links: [{ id: "wires", a: { self: true, interfaceId: "end_gnss" }, b: { self: true, interfaceId: "end_fc" } }],
};

const link = (id: string, a: InterfaceLink["a"], b: InterfaceLink["b"]): InterfaceLink => ({ id, a, b });

const SYSTEM: ModuleDef = {
  id: "test-physical-harness",
  name: "FC + video unit + GNSS through cables",
  interfaces: [],
  children: [
    { id: "fc", moduleDefId: FC.id },
    { id: "video", moduleDefId: O4.id },
    { id: "gnss", moduleDefId: GNSS.id },
    { id: "dji_cable", moduleDefId: DJI_CABLE.id },
    { id: "gnss_lead", moduleDefId: GNSS_LEAD.id },
  ],
  links: [
    link("dji_fc", { child: "fc", interfaceId: "dji_socket" }, { child: "dji_cable", interfaceId: "end_fc" }),
    link("dji_o4", { child: "dji_cable", interfaceId: "end_o4" }, { child: "video", interfaceId: "fc_cable_socket" }),
    link("gnss_socket", { child: "gnss", interfaceId: "gh6p_1" }, { child: "gnss_lead", interfaceId: "end_gnss" }),
    link(
      "gnss_pads",
      { child: "gnss_lead", interfaceId: "end_fc" },
      {
        child: "fc",
        interfaceId: "gnss_pads",
        compose: { p1: "rail_4v5", p2: "uart1_tx", p3: "uart1_rx", p4: "i2c1_scl", p5: "i2c1_sda", p6: "gnd" },
      },
    ),
  ],
};

const DEFS = [FC, O4, GNSS, DJI_CABLE, GNSS_LEAD];
const lookupWith = (...overrides: ModuleDef[]) => (id: string) => overrides.find((d) => d.id === id) ?? DEFS.find((d) => d.id === id);
const lookup = lookupWith();

const pairs = (def = SYSTEM, l = lookup) =>
  deriveLinks(def, l).map((r) => `${r.a.path} ↔ ${r.b.path} [${r.state}]`).sort();

describe("connector composites", () => {
  it("bind positions to pads without hiding the pads from the outline", () => {
    const socket = FC.interfaces.find((i) => i.id === "dji_socket")!;
    expect(socket.slots?.map((s) => s.label)).toEqual(["10V", "G", "T5", "R5", "G", "Sbus"]);
    expect(socket.profiles?.[0].bindings).toMatchObject({ p1: "bec_10v", p3: "uart5_tx", p4: "uart5_rx", p6: "sbus" });
  });

  it("mate by position and check type and gender", () => {
    const results = validateLinks(SYSTEM, lookup);
    expect(results.map((r) => [r.link.id, r.protocol, r.state])).toEqual([
      ["dji_fc", "connector", "configured"],
      ["dji_o4", "connector", "configured"],
      ["gnss_socket", "connector", "configured"],
      ["gnss_pads", "connector", "configured"],
    ]);
    const dji = results[0];
    expect(dji.children.map((c) => `${c.a.leafId}>${c.b.slotId}`)).toEqual(["bec_10v>p1", "gnd>p2", "uart5_tx>p3", "uart5_rx>p4", "gnd>p5", "sbus>p6"]);
  });

  it("reports a cable whose plug does not fit the socket", () => {
    const wrong = { ...DJI_CABLE, interfaces: DJI_CABLE.interfaces.map((i) => (i.id === "end_fc" ? Connector({ id: "end_fc", connector: "jst_gh_6", pins: ["1", "2", "3", "4", "5", "6"] }) : i)) };
    const r = validateLinks(SYSTEM, lookupWith(wrong)).find((x) => x.link.id === "dji_fc")!;
    expect(r.state).toBe("incompatible");
    expect(r.diagnostics[0].code).toBe("connector_mismatch");
  });

  it("reports two receptacles", () => {
    const wrong = { ...DJI_CABLE, interfaces: DJI_CABLE.interfaces.map((i) => (i.id === "end_fc" ? Connector({ id: "end_fc", connector: "dji_6pin", gender: "receptacle", pins: ["1", "2", "3", "4", "5", "6"] }) : i)) };
    const r = validateLinks(SYSTEM, lookupWith(wrong)).find((x) => x.link.id === "dji_fc")!;
    expect(r.diagnostics.map((d) => d.code)).toContain("connector_gender");
  });
});

describe("link-scoped composition", () => {
  it("composes pads the FC does not group into a connector for one link", () => {
    const r = validateLinks(SYSTEM, lookup).find((x) => x.link.id === "gnss_pads")!;
    expect(r.b.path).toBe("fc:gnss_pads");
    expect(r.b.composed?.p2.iface.id).toBe("uart1_tx");
    expect(r.children.map((c) => c.b.leafId)).toEqual(["rail_4v5", "uart1_tx", "uart1_rx", "i2c1_scl", "i2c1_sda", "gnd"]);
  });

  it("rejects slots the other end does not have", () => {
    const system = {
      ...SYSTEM,
      links: SYSTEM.links!.map((l) => (l.id === "gnss_pads" && "child" in l.b ? { ...l, b: { ...l.b, compose: { ...l.b.compose, p7: "uart1_tx" } } } : l)),
    };
    const r = validateLinks(system, lookup).find((x) => x.link.id === "gnss_pads")!;
    expect(r.diagnostics.map((d) => d.code)).toContain("compose_unknown_slot");
  });

  it("refuses to shadow an existing interface", () => {
    const system = {
      ...SYSTEM,
      links: SYSTEM.links!.map((l) => (l.id === "gnss_pads" && "child" in l.b ? { ...l, b: { ...l.b, interfaceId: "uart1" } } : l)),
    };
    expect(() => validateLinks(system, lookup)).toThrow(/shadows/);
  });
});

describe("derived links", () => {
  it("resolve every conductor to the functional interfaces it joins", () => {
    expect(pairs()).toEqual([
      "fc:bec_10v ↔ video:vcc [configured]",
      "fc:gnd ↔ gnss:gnd [configured]",
      "fc:gnd ↔ video:gnd [configured]",
      "fc:gnd ↔ video:gnd_signal [configured]",
      "fc:i2c1 ↔ gnss:i2c_compass [configured]",
      "fc:rail_4v5 ↔ gnss:vin_5v [configured]",
      "fc:sbus ↔ video:sbus [configured]",
      "fc:uart1 ↔ gnss:uart_gnss [configured]",
      "fc:uart5 ↔ video:uart_osd [configured]",
    ]);
  });

  it("record the connector links and harness they run through", () => {
    const osd = deriveLinks(SYSTEM, lookup).find((r) => r.a.iface.id === "uart5")!;
    expect(osd.derived).toEqual({ via: ["dji_fc", "dji_o4"], harnesses: ["dji_cable"] });
    expect(osd.link.harness).toBe("dji_cable");
    expect(osd.children.map((c) => `${c.a.leafId}>${c.b.leafId}`).sort()).toEqual(["uart5_rx>uart_osd_tx", "uart5_tx>uart_osd_rx"]);
    expect(osd.children.every((c) => c.method === "wired")).toBe(true);
  });

  it("catch a cable that swaps TX and RX", () => {
    const crossed = { ...DJI_CABLE, links: [{ ...DJI_CABLE.links![0], childLinks: ["p1", "p2", "p4", "p3", "p5", "p6"].map((b, i) => ({ a: `p${i + 1}`, b })) }] };
    const osd = deriveLinks(SYSTEM, lookupWith(crossed)).find((r) => r.a.iface.id === "uart5")!;
    expect(osd.state).toBe("incompatible");
    expect(osd.diagnostics[0].code).toBe("harness_wiring");
  });

  it("feed the system checks: the video unit is budgeted on the 10 V BEC and nothing it needs is unpowered", () => {
    const { diagnostics } = checkSystem(SYSTEM, lookup);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const bec = diagnostics.find((d) => d.id === "supply_budget:fc:bec_10v")!;
    expect(bec.details?.loadW).toBe(10);
    expect(diagnostics.some((d) => d.rule === "unpowered" && d.refs.includes("video:vcc"))).toBe(false);
  });

  it("point diagnostics on a derived link at the stored links it runs through", () => {
    const crossed = { ...DJI_CABLE, links: [{ ...DJI_CABLE.links![0], childLinks: ["p1", "p2", "p4", "p3", "p5", "p6"].map((b, i) => ({ a: `p${i + 1}`, b })) }] };
    const d = checkSystem(SYSTEM, lookupWith(crossed)).diagnostics.find((x) => x.rule === "link_state" && x.severity === "error")!;
    expect(d.refs).toEqual(expect.arrayContaining(["link:dji_fc", "link:dji_o4"]));
  });
});
