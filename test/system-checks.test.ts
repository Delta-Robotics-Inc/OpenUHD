import { describe, it, expect } from "vitest";
import { checkSystem } from "../src/system/checks.js";
import { BoltPattern, connectorTrait } from "../src/protocols/index.js";
import type { InterfaceLink, ModuleDef } from "../src/types/index.js";
import { DRONE, FC, FRAME, GNSS_ALT, VIDEO_CABLE, lookup, lookupWith } from "./fixtures/drone.js";

const relink = (id: string, patch: Partial<InterfaceLink>): ModuleDef => ({ ...DRONE, links: DRONE.links!.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

describe("system checks on the nominal fixture", () => {
  const diagnostics = checkSystem(DRONE, lookup).diagnostics;

  it("reports no errors", () => {
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("warns that four motors at peak exceed the pack's continuous rating", () => {
    const d = diagnostics.find((x) => x.rule === "propulsion_current")!;
    expect(d.severity).toBe("warning");
    expect(d.details).toEqual({ totalPeak: 160, cont: 120, burst: 200 });
  });

  it("budgets the 10 V BEC against the video unit's 10 W requirement", () => {
    const d = diagnostics.find((x) => x.id === "supply_budget:stack:bec_10v")!;
    expect(d.severity).toBe("info");
    expect(d.details?.loadW).toBe(10);
    expect(d.details?.capacityW).toBe(25);
  });

  it("lists loads with no stated draw instead of guessing", () => {
    const d = diagnostics.find((x) => x.id === "supply_budget:stack:bec_5v")!;
    expect(d.details?.unknownLoads).toEqual(["receiver:vcc_5v"]);
  });

  it("budgets a branch rail on the output it is supplied from (assumed relation)", () => {
    const rail = diagnostics.find((x) => x.id === "supply_budget:stack:rail_4v5")!;
    expect(rail.details?.suppliedFrom).toBe("stack:bec_5v");
    expect(String(rail.details?.assumption)).toMatch(/^Fixture: the 4.5 V rail/);
    const bec = diagnostics.find((x) => x.id === "supply_budget:stack:bec_5v")!;
    expect(bec.details?.branches).toEqual(["stack:rail_4v5"]);
    // GNSS 50 mA at the rail's 4.5 V lower bound; the receiver states no draw
    expect(bec.details?.loadW).toBeCloseTo(0.225, 6);
    expect(bec.refs).toContain("gnss:vin_5v");
  });

  it("without the branch relation the branch rail cannot be budgeted", () => {
    const bare = { ...FC, interfaces: FC.interfaces.map((i) => (i.id === "rail_4v5" ? { ...i, traits: (i.traits ?? []).filter((t) => t.type !== "supplied_from") } : i)) };
    const d = checkSystem(DRONE, lookupWith(bare)).diagnostics.find((x) => x.id === "supply_budget:stack:rail_4v5")!;
    expect(d.message).toMatch(/no current rating/);
  });
});

describe("fault scenarios", () => {
  it("the video unit on raw 6S is incompatible", () => {
    const d = checkSystem(relink("video_power", { a: { child: "battery", interfaceId: "battery_out" } }), lookup).diagnostics;
    expect(d.find((x) => x.rule === "link_state" && x.refs.includes("link:video_power"))?.severity).toBe("error");
  });

  it("a 20 x 20 frame mount does not accept the 30.5 stack", () => {
    const frame20: ModuleDef = {
      ...FRAME,
      interfaces: FRAME.interfaces.map((i) =>
        i.id === "stack_mount" ? { ...BoltPattern({ id: "stack_mount", role: "structure", shape: "square", spacingMm: 20, holeCount: 4, fastener: "M2", fastenerDiameterMm: 2 }), geometry: i.geometry } : i,
      ),
    };
    const d = checkSystem(DRONE, lookupWith(frame20)).diagnostics.find((x) => x.rule === "link_state" && x.refs.includes("link:stack_mount"));
    expect(d?.severity).toBe("error");
  });

  it("GNSS and receiver on one UART is interface reuse", () => {
    const d = checkSystem(relink("gnss_uart", { a: { child: "stack", interfaceId: "uart2" } }), lookup).diagnostics.find((x) => x.rule === "interface_reuse");
    expect(d?.refs[0]).toBe("stack:uart2");
    expect(d?.severity).toBe("error");
  });

  it("two compasses at the same address on I2C1 is an address conflict", () => {
    const system: ModuleDef = {
      ...DRONE,
      children: [...DRONE.children!, { id: "gnss_2", moduleDefId: "fixture-gnss" }],
      links: [
        ...DRONE.links!,
        { id: "gnss2_i2c", a: { child: "stack", interfaceId: "i2c1" }, b: { child: "gnss_2", interfaceId: "i2c_compass" } },
        { id: "gnss2_power", a: { child: "stack", interfaceId: "rail_4v5" }, b: { child: "gnss_2", interfaceId: "vin_5v" } },
      ],
    };
    const d = checkSystem(system, lookup).diagnostics.find((x) => x.rule === "bus_address");
    expect(d?.message).toMatch(/0x2C/);
    expect(d?.severity).toBe("error");
  });

  it("an interchangeable GNSS swaps in with no errors", () => {
    const system: ModuleDef = { ...DRONE, children: DRONE.children!.map((c) => (c.id === "gnss" ? { ...c, moduleDefId: GNSS_ALT.id } : c)) };
    expect(checkSystem(system, lookup).diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });
});

describe("harness checks", () => {
  it("a cable whose end does not fit the FC's socket is a connector mismatch", () => {
    const wrong = { ...VIDEO_CABLE, interfaces: VIDEO_CABLE.interfaces.map((i) => (i.id === "end_fc" ? { ...i, traits: [connectorTrait("jst_gh_6", { mates: "a" })] } : i)) };
    const d = checkSystem(DRONE, lookupWith(wrong)).diagnostics.filter((x) => x.rule === "harness_connector");
    expect(d.length).toBeGreaterThan(0);
    expect(d[0].message).toMatch(/jst_gh_6/);
  });

  it("the battery lead's ends match the pack's XT60 and the ESC's pads", () => {
    expect(checkSystem(DRONE, lookup).diagnostics.filter((x) => x.rule === "harness_connector")).toEqual([]);
  });

  it("a link naming a harness that is not a child is reported", () => {
    const d = checkSystem(relink("rx_crsf", { harness: "missing" }), lookup).diagnostics.find((x) => x.rule === "harness_connector");
    expect(d?.message).toMatch(/not a child/);
  });
});
