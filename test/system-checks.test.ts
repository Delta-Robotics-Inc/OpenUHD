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

  it("two compasses at 0x0D on I2C1 is an address conflict", () => {
    const d = run("two-compasses").find((x) => x.rule === "bus_address");
    expect(d?.message).toMatch(/0x0D/);
    expect(d?.severity).toBe("error");
  });
});
