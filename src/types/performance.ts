/**
 * Performance data carried by a part's `performance` trait (PB-797).
 *
 * Only the shapes that system helpers and generated documents compute from
 * are typed here; other performance fields stay free-form trait params.
 */

/**
 * One row of a manufacturer's static thrust table: the motor on a test
 * stand with the named propeller, at one throttle setting. Every field is
 * as printed in the table (no unit conversion, no rounding).
 */
export interface ThrustTestRow {
  /** Throttle command, % of full scale. */
  throttle_pct: number;
  /** Supply voltage measured at that throttle (sags under load). */
  voltage_V: number;
  current_A: number;
  rpm: number;
  thrust_g: number;
  /** Electrical input power. */
  power_W: number;
  /** Thrust per watt as printed (g/W); recomputable from thrust_g / power_W. */
  efficiency_g_per_W?: number;
}

/**
 * A manufacturer's full throttle table for one propeller and supply. Keep
 * every row the source prints: helpers interpolate between rows instead of
 * fitting curves through two points.
 */
export interface ThrustTest {
  /** Test propeller as the maker names it, e.g. "MEPS SZ4942". */
  propeller: string;
  /** UHD module id of the test propeller when it is in the library. */
  propeller_part?: string;
  /** Supply the table was taken at (unloaded pack / PSU voltage). */
  supply_V: number;
  /** Rows in ascending throttle. */
  rows: ThrustTestRow[];
  source?: string;
  note?: string;
}
