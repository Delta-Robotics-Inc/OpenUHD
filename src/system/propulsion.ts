/**
 * Propulsion helpers (PB-797): read a motor's manufacturer thrust tables and
 * interpolate them. Figures derived here come straight from the table rows
 * (linear interpolation between neighbouring rows, zero at zero throttle),
 * so a document can say exactly which rows a number sits between.
 */
import type { ModuleDef } from "../types/module.js";
import type { ThrustTest, ThrustTestRow } from "../types/performance.js";

/** The `thrust_tests` of a module's performance trait, if any. */
export function thrustTests(def: ModuleDef): ThrustTest[] {
  const perf = def.traits?.find((t) => t.type === "performance")?.params as { thrust_tests?: ThrustTest[] } | undefined;
  return perf?.thrust_tests ?? [];
}

/** The row printed at exactly this throttle, if the table has one. */
export function thrustRow(test: ThrustTest, throttlePct: number): ThrustTestRow | undefined {
  return test.rows.find((r) => r.throttle_pct === throttlePct);
}

const NUMERIC: (keyof ThrustTestRow)[] = ["voltage_V", "current_A", "rpm", "thrust_g", "power_W"];

function lerpRow(a: ThrustTestRow, b: ThrustTestRow, f: number): ThrustTestRow {
  const out = { throttle_pct: a.throttle_pct + (b.throttle_pct - a.throttle_pct) * f } as ThrustTestRow;
  for (const k of NUMERIC) (out as unknown as Record<string, number>)[k] = (a[k] as number) + ((b[k] as number) - (a[k] as number)) * f;
  out.efficiency_g_per_W = out.power_W ? out.thrust_g / out.power_W : undefined;
  return out;
}

/** Origin row: nothing flows at zero throttle; voltage is the table's supply. */
const zeroRow = (test: ThrustTest): ThrustTestRow => ({ throttle_pct: 0, voltage_V: test.supply_V, current_A: 0, rpm: 0, thrust_g: 0, power_W: 0 });

/** Interpolate a table at any throttle between 0 and its highest row. */
export function thrustAtThrottle(test: ThrustTest, throttlePct: number): ThrustTestRow {
  const rows = [zeroRow(test), ...[...test.rows].sort((a, b) => a.throttle_pct - b.throttle_pct)];
  if (throttlePct <= 0) return rows[0];
  for (let i = 1; i < rows.length; i++) {
    if (throttlePct <= rows[i].throttle_pct) {
      const a = rows[i - 1];
      const b = rows[i];
      return lerpRow(a, b, (throttlePct - a.throttle_pct) / (b.throttle_pct - a.throttle_pct));
    }
  }
  return rows[rows.length - 1];
}

/**
 * The operating point that produces a given thrust (hover: all-up weight /
 * motors). Undefined when the thrust is above the table's top row.
 */
export function thrustAtThrust(test: ThrustTest, thrustG: number): ThrustTestRow | undefined {
  const rows = [zeroRow(test), ...[...test.rows].sort((a, b) => a.thrust_g - b.thrust_g)];
  for (let i = 1; i < rows.length; i++) {
    if (thrustG <= rows[i].thrust_g) {
      const a = rows[i - 1];
      const b = rows[i];
      return lerpRow(a, b, (thrustG - a.thrust_g) / (b.thrust_g - a.thrust_g));
    }
  }
  return undefined;
}

/** The highest-throttle row (the "100 %" figures). */
export function fullThrottle(test: ThrustTest): ThrustTestRow {
  return test.rows.reduce((m, r) => (r.throttle_pct > m.throttle_pct ? r : m), test.rows[0]);
}
