import type { InterfaceDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { laneCount, laneRateMbps } from "./params.js";
import { diffSignals, linkSlots, type DiffPair, type LinkSignal } from "./link.js";

/**
 * MIPI CSI-2 (cameras) and DSI (displays) (PB-866).
 *
 * Both are one-way links from a transmitter to a receiver: on CSI-2 the
 * camera transmits and the host receives; on DSI the host transmits and the
 * display receives. Protocol `mipi_csi2` or `mipi_dsi`, role `transmitter`
 * or `receiver`; a transmitter pairs with a receiver only.
 *
 * Lanes: `lane_count` holds the lane counts the port can run. A receiver
 * with n data lanes runs [1, n]; a transmitter runs the counts its modes
 * use (`laneModes`, default exactly its `lanes`). The pair check requires
 * them to overlap: a camera that only streams on 4 lanes does not work on a
 * 2-lane connector. `lane_rate` is the highest rate per lane in Mbit/s; a
 * transmitter faster than the receiver is a warning (`lane_rate`), as its
 * slower modes still work.
 *
 * D-PHY pins are optional: a clock pair and up to `lanes` data pairs, lane
 * 0 first. Slots pair clock to clock and data lane to data lane in order.
 * C-PHY ports (trios) are declared without pins; `lanes` then counts trios.
 *
 * A camera's control bus (CCI) is an `I2C` interface of its own. A port
 * that can be either (a Raspberry Pi 5 MIPI connector, camera or display)
 * declares a CSI-2 receiver and a DSI transmitter over the same leaves: the
 * second builder takes the first's leaf ids as its pins.
 */

export interface MipiConfig {
  /** Interface id. Defaults to "csi" or "dsi". */
  id?: string;
  name?: string;
  role: "transmitter" | "receiver";
  /** Data lanes the port has (trios on C-PHY). */
  lanes: number;
  /** Lane counts a transmitter's modes use, e.g. [2, 4]. Defaults to [lanes]. Receivers run 1..lanes. */
  laneModes?: number[];
  /** Physical layer. Defaults to "d-phy". */
  phy?: "d-phy" | "c-phy";
  /** Highest data rate per lane in Mbit/s, or [min, max]. */
  laneRateMbps?: number | [number, number];
  /** D-PHY clock pair. */
  clock?: DiffPair;
  /** D-PHY data pairs, lane 0 first. */
  data?: DiffPair[];
  exposed?: boolean;
  defaultActive?: boolean;
}

function mipi(type: "mipi_csi2" | "mipi_dsi", label: string, config: MipiConfig): InterfaceDef[] {
  const id = config.id ?? (type === "mipi_csi2" ? "csi" : "dsi");
  const phy = config.phy ?? "d-phy";
  if (!Number.isInteger(config.lanes) || config.lanes < 1 || config.lanes > 8) throw new Error(`${label} ${id}: lanes must be 1–8 (got ${config.lanes})`);
  const data = config.data ?? [];
  if (data.length > config.lanes) throw new Error(`${label} ${id}: ${data.length} data pairs for ${config.lanes} lanes`);
  if (phy === "c-phy" && (config.clock || data.length)) throw new Error(`${label} ${id}: C-PHY trios are not modelled as pins; declare the port without clock and data`);
  if (data.length && !config.clock) throw new Error(`${label} ${id}: D-PHY data lanes need the clock pair`);
  const tx = config.role === "transmitter";
  if (!tx && config.laneModes) throw new Error(`${label} ${id}: a receiver runs 1..lanes; laneModes is for transmitters`);
  const modes = config.laneModes ?? [config.lanes];
  if (modes.some((m) => m < 1 || m > config.lanes)) throw new Error(`${label} ${id}: lane modes must be within 1..${config.lanes}`);

  const dir = tx ? "tx" : "rx";
  const leaf = [{ type: "mipi_dphy", roles: [tx ? "transmitter" : "receiver"] }];
  const signals: LinkSignal[] = [];
  if (config.clock) signals.push(...diffSignals("clk", ["CLK+", "CLK-"], config.clock, leaf, "mipi_clk", `clock_${dir}`, true));
  data.forEach((pair, i) => signals.push(...diffSignals(`d${i}`, [`D${i}+`, `D${i}-`], pair, leaf, `mipi_d${i}`, `data_${dir}`, i === 0)));

  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, type, signals, generated);
  const parameters: Parameter[] = [laneCount(tx ? [Math.min(...modes), Math.max(...modes)] : [1, config.lanes])];
  if (config.laneRateMbps !== undefined) parameters.push(laneRateMbps(config.laneRateMbps));
  return [
    ...generated,
    {
      id,
      name: config.name ?? `${label} ${config.lanes}-lane ${config.role}`,
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type, roles: [config.role] }],
      capabilities: [type, `mipi_${phy.replace("-", "")}`],
      parameters,
      traits: [{ type: "mipi", params: { phy, lanes: config.lanes, ...(tx ? { lane_modes: modes } : {}) } }],
      ...(slots.length ? { slots, profiles: [{ id: `${id}_default`, label: `${data.length} lanes`, default_active: true, bindings }] } : {}),
    },
  ];
}

/** A MIPI CSI-2 port: a camera (transmitter) or a host's camera input (receiver). */
export function CSI2(config: MipiConfig): InterfaceDef[] {
  return mipi("mipi_csi2", "MIPI CSI-2", config);
}

/** A MIPI DSI port: a host's display output (transmitter) or a display (receiver). */
export function DSI(config: MipiConfig): InterfaceDef[] {
  return mipi("mipi_dsi", "MIPI DSI", config);
}
