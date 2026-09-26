import { describe, it, expect } from "vitest";
import { MEPS_NEON_2207_V2_1950KV } from "../library/parts/meps-neon-2207-v2-1950kv.js";
import { fullThrottle, thrustAtThrottle, thrustAtThrust, thrustRow, thrustTests } from "../src/system/propulsion.js";

describe("motor thrust tables (PB-797)", () => {
  const tests = thrustTests(MEPS_NEON_2207_V2_1950KV);

  it("keeps every row of the maker's KV1950 table, with its test prop and supply", () => {
    expect(tests.map((t) => [t.propeller, t.supply_V, t.rows.length])).toEqual([
      ["MEPS SZ4942", 25.2, 10],
      ["MEPS SZ5145", 25.2, 10],
    ]);
    for (const t of tests) expect(t.rows.map((r) => r.throttle_pct)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it("printed efficiency matches thrust / power within the table's rounding (±0.5 W, ±0.05 g/W)", () => {
    for (const t of tests)
      for (const r of t.rows) {
        expect(r.efficiency_g_per_W! + 0.05).toBeGreaterThanOrEqual(r.thrust_g / (r.power_W + 0.5));
        expect(r.efficiency_g_per_W! - 0.05).toBeLessThanOrEqual(r.thrust_g / (r.power_W - 0.5));
      }
  });

  it("returns printed rows exactly and interpolates between them", () => {
    const t = tests[0];
    expect(fullThrottle(t)).toMatchObject({ throttle_pct: 100, thrust_g: 1584, current_A: 41.8, power_W: 1009 });
    expect(thrustAtThrottle(t, 50)).toMatchObject({ thrust_g: 648, current_A: 9.5 });
    const mid = thrustAtThrottle(t, 55);
    expect(mid.thrust_g).toBeCloseTo((648 + 865) / 2, 6);
    expect(thrustAtThrottle(t, 5).thrust_g).toBeCloseTo(14, 6); // half way to the 10 % row from 0
    expect(thrustRow(t, 70)?.rpm).toBe(26534);
  });

  it("finds the operating point for a thrust, and none above the top row", () => {
    const t = tests[0];
    const hover = thrustAtThrust(t, 200)!;
    expect(hover.throttle_pct).toBeGreaterThan(20);
    expect(hover.throttle_pct).toBeLessThan(30);
    expect(hover.power_W).toBeCloseTo(33 + ((200 - 119) / (277 - 119)) * (83 - 33), 6);
    expect(thrustAtThrust(t, 2000)).toBeUndefined();
  });
});
