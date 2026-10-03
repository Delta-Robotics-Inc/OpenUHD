import { describe, it, expect } from "vitest";
import { fullThrottle, thrustAtThrottle, thrustAtThrust, thrustRow, thrustTests } from "../src/system/propulsion.js";
import { MOTOR } from "./fixtures/drone.js";

describe("motor thrust tables (PB-797)", () => {
  const tests = thrustTests(MOTOR);

  it("reads every table of the performance trait, with its test prop and supply", () => {
    expect(tests.map((t) => [t.propeller, t.supply_V, t.rows.length])).toEqual([
      ["fixture 5 in", 24, 4],
      ["fixture 5.1 in", 24, 2],
    ]);
    expect(thrustTests({ id: "m", name: "m", interfaces: [] })).toEqual([]);
  });

  it("returns printed rows exactly and interpolates between them", () => {
    const t = tests[0];
    expect(fullThrottle(t)).toMatchObject({ throttle_pct: 100, thrust_g: 1300, current_A: 34, power_W: 816 });
    expect(thrustAtThrottle(t, 50)).toMatchObject({ thrust_g: 500, current_A: 8 });
    expect(thrustAtThrottle(t, 62.5).thrust_g).toBeCloseTo((500 + 900) / 2, 6);
    expect(thrustAtThrottle(t, 12.5).thrust_g).toBeCloseTo(75, 6); // half way to the 25 % row from 0
    expect(thrustAtThrottle(t, 120).throttle_pct).toBe(100);
    expect(thrustRow(t, 75)?.rpm).toBe(25000);
    expect(thrustRow(t, 70)).toBeUndefined();
  });

  it("finds the operating point for a thrust, and none above the top row", () => {
    const t = tests[0];
    const hover = thrustAtThrust(t, 325)!;
    expect(hover.throttle_pct).toBeCloseTo(37.5, 6);
    expect(hover.power_W).toBeCloseTo((48 + 192) / 2, 6);
    expect(hover.efficiency_g_per_W).toBeCloseTo(325 / 120, 6);
    expect(thrustAtThrust(t, 2000)).toBeUndefined();
  });
});
