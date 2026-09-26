import { describe, it, expect } from "vitest";
import { checkSystem } from "../src/system/checks.js";
import { SCENARIOS } from "../library/systems/quadcopter-5in/scenarios.js";

const run = (id: string) => {
  const s = SCENARIOS.find((x) => x.id === id)!;
  return checkSystem(s.system, s.lookup).diagnostics;
};

describe("system checks on the nominal quadcopter", () => {
  const diagnostics = run("nominal");

  it("reports no errors", () => {
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("warns that four motors at peak exceed the pack's continuous rating", () => {
    const d = diagnostics.find((x) => x.rule === "propulsion_current")!;
    expect(d.severity).toBe("warning");
    expect(d.details?.totalPeak).toBeCloseTo(171.88, 1);
    expect(d.details?.cont).toBe(110);
  });

  it("budgets the 10 V BEC against the O4's 10 W requirement", () => {
    const d = diagnostics.find((x) => x.id === "supply_budget:stack:bec_10v")!;
    expect(d.severity).toBe("info");
    expect(d.details?.loadW).toBe(10);
    expect(d.details?.capacityW).toBe(25);
  });

  it("lists loads with no stated draw instead of guessing", () => {
    const d = diagnostics.find((x) => x.id === "supply_budget:stack:bec_5v")!;
    expect(d.details?.unknownLoads).toEqual(["receiver:vcc_5v"]);
  });
});

describe("fault scenarios", () => {
  it("O4 on raw 6S is incompatible", () => {
    const d = run("o4-on-vbat").find((x) => x.rule === "link_state" && x.refs.includes("link:video_power"));
    expect(d?.severity).toBe("error");
  });

  it("a 20 x 20 frame mount does not accept the 30.5 stack", () => {
    const d = run("frame-20mm-stack").find((x) => x.rule === "link_state" && x.refs.includes("link:stack_mount"));
    expect(d?.severity).toBe("error");
  });

  it("GPS and receiver on one UART is interface reuse", () => {
    const d = run("gps-on-rx-uart").find((x) => x.rule === "interface_reuse");
    expect(d?.refs[0]).toBe("stack:uart2");
    expect(d?.severity).toBe("error");
  });

  it("two compasses at the same address on I2C1 is an address conflict", () => {
    const d = run("two-compasses").find((x) => x.rule === "bus_address");
    expect(d?.message).toMatch(/0x2C/);
    expect(d?.severity).toBe("error");
  });
});

describe("interchangeable GNSS", () => {
  it("the legacy M10Q swaps in with no errors", () => {
    expect(run("legacy-m10q").filter((d) => d.severity === "error")).toEqual([]);
  });
});

describe("harness checks", () => {
  const nominal = SCENARIOS.find((s) => s.id === "nominal")!;

  it("every link on the DJI cable, XT60 lead and stack hardware names its harness", () => {
    const carried = (nominal.system.links ?? []).filter((l) => l.harness).map((l) => l.id);
    expect(carried).toEqual(
      expect.arrayContaining(["battery_pos", "battery_neg", "video_power", "video_gnd", "video_osd", "stack_mount", "fc_mount"]),
    );
  });

  it("a JST-GH cable on the FC's DJI socket is a connector mismatch", async () => {
    const { DJI_O4_3IN1_CABLE } = await import("../library/systems/quadcopter-5in/harnesses.js");
    const { connectorTrait } = await import("../src/protocols/index.js");
    const wrong = {
      ...DJI_O4_3IN1_CABLE,
      interfaces: DJI_O4_3IN1_CABLE.interfaces.map((i) =>
        i.id === "end_fc" ? { ...i, traits: [connectorTrait("jst_gh_6", { mates: "a" })] } : i,
      ),
    };
    const lookup = (id: string) => (id === wrong.id ? wrong : nominal.lookup(id));
    const d = checkSystem(nominal.system, lookup).diagnostics.filter((x) => x.rule === "harness_connector");
    expect(d.length).toBeGreaterThan(0);
    expect(d[0].message).toMatch(/jst_gh_6/);
  });

  it("a link naming a harness that is not a child is reported", () => {
    const system = { ...nominal.system, links: nominal.system.links!.map((l) => (l.id === "rx_crsf" ? { ...l, harness: "missing" } : l)) };
    const d = checkSystem(system, nominal.lookup).diagnostics.find((x) => x.rule === "harness_connector");
    expect(d?.message).toMatch(/not a child/);
  });
});
