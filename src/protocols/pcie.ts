import type { InterfaceDef, SlotDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { laneCount, pcieGeneration, voltageV as voltageParam } from "./params.js";
import { DIGITAL_IN, DIGITAL_OUT, diffSignals, linkSlots, type DiffPair, type LinkSignal } from "./link.js";
import type { SignalRef } from "./signal.js";

/**
 * PCI Express and M.2.
 *
 * `PCIe` is one PCIe port: protocol `pcie`, role `root` (a root port, a
 * switch's downstream port, the host side of a slot, socket or cable) or
 * `endpoint` (a card, an SSD, a switch's upstream port). A root pairs with
 * an endpoint only. Lanes and generation are parameters: `lane_count`
 * [1, lanes] and `pcie_generation` [1, highest], since a link trains to the
 * widest width and the highest generation both ends support; the pair check
 * states what the link trains at (`link_width`, info).
 *
 * Pins are optional. Give them on a chip or a connector whose pinout is
 * modelled; a port without pins is a logical port and pairs as a whole.
 * Lane signals are named from this side: `tx` is what this side transmits
 * (PETp/PETn), `rx` what it receives (PERp/PERn). Slots pair TX with RX
 * lane by lane, REFCLK out to REFCLK in (the root sends the clock unless
 * `refclk` says otherwise), PERST# from the root, and CLKREQ# and WAKE#
 * from the endpoint.
 */

export type PCIeRole = "root" | "endpoint";

export interface PCIeLane {
  /** Pair this side transmits on (PETp/PETn on its pins). */
  tx: DiffPair;
  /** Pair this side receives on (PERp/PERn on its pins). */
  rx: DiffPair;
}

export interface PCIeConfig {
  /** Interface id. Defaults to "pcie". */
  id?: string;
  name?: string;
  role: PCIeRole;
  /** Lanes the port has (1, 2, 4, 8 or 16). */
  lanes: number;
  /** Highest PCIe generation supported (1–6). */
  generation: number;
  /** Lane pins, lane 0 first. At most `lanes`. */
  laneSignals?: PCIeLane[];
  /** Reference clock pair, REFCLK+ / REFCLK−. */
  refclk?: DiffPair;
  /** Who sends the reference clock. Defaults to the root. */
  refclkFrom?: PCIeRole;
  /** PERST#: reset from the root. */
  perst?: SignalRef;
  /** CLKREQ#: clock request from the endpoint (open drain). */
  clkreq?: SignalRef;
  /** WAKE#: wake from the endpoint (open drain). */
  wake?: SignalRef;
  /** Sideband logic level, for the PERST#, CLKREQ# and WAKE# leaves declared inline. */
  sidebandVoltageV?: number | [number, number];
  exposed?: boolean;
  defaultActive?: boolean;
}

const PCIE_LANES = new Set([1, 2, 4, 8, 12, 16, 32]);

/** A PCIe port: a `pcie` composite (root or endpoint) with optional lane, clock and sideband slots. */
export function PCIe(config: PCIeConfig): InterfaceDef[] {
  const id = config.id ?? "pcie";
  if (!PCIE_LANES.has(config.lanes)) throw new Error(`PCIe ${id}: lanes must be 1, 2, 4, 8, 12, 16 or 32 (got ${config.lanes})`);
  if (!Number.isInteger(config.generation) || config.generation < 1 || config.generation > 7) throw new Error(`PCIe ${id}: generation must be 1–7 (got ${config.generation})`);
  const lanes = config.laneSignals ?? [];
  if (lanes.length > config.lanes) throw new Error(`PCIe ${id}: ${lanes.length} lane pin sets for a x${config.lanes} port`);

  const root = config.role === "root";
  const signals: LinkSignal[] = [];
  lanes.forEach((lane, i) => {
    signals.push(...diffSignals(`lane${i}_tx`, [`PETp${i}`, `PETn${i}`], lane.tx, [{ type: "pcie_lane", roles: ["transmitter"] }], "pcie_tx", "tx", i === 0));
    signals.push(...diffSignals(`lane${i}_rx`, [`PERp${i}`, `PERn${i}`], lane.rx, [{ type: "pcie_lane", roles: ["receiver"] }], "pcie_rx", "rx", i === 0));
  });
  if (config.refclk) {
    const sends = (config.refclkFrom ?? "root") === config.role;
    signals.push(...diffSignals("refclk", ["REFCLK+", "REFCLK-"], config.refclk, [{ type: "pcie_refclk", roles: [sends ? "source" : "sink"] }], "pcie_refclk", sends ? "refclk_out" : "refclk_in", false));
  }
  const side = (slot: string, label: string, ref: SignalRef | undefined, rootDrives: boolean) => {
    if (ref === undefined) return;
    const drives = rootDrives === root;
    signals.push({ slot, label, ref, leaf: drives ? DIGITAL_OUT : DIGITAL_IN, capability: `pcie_${slot}`, role: `${slot}_${drives ? "out" : "in"}`, required: false });
  };
  side("perst", "PERST#", config.perst, true);
  side("clkreq", "CLKREQ#", config.clkreq, false);
  side("wake", "WAKE#", config.wake, false);

  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "pcie", signals, generated);
  // the sideband leaves take the sideband level; lanes and clock are differential
  if (config.sidebandVoltageV !== undefined) {
    for (const g of generated) if (g.protocols[0]?.type === "digital") g.parameters = [...(g.parameters ?? []), Array.isArray(config.sidebandVoltageV) ? { id: "voltage", unit: "V", range: config.sidebandVoltageV } : voltageParam(config.sidebandVoltageV)];
  }
  const parameters: Parameter[] = [laneCount([1, config.lanes]), pcieGeneration(config.generation)];
  return [
    ...generated,
    {
      id,
      name: config.name ?? `PCIe Gen ${config.generation} x${config.lanes}`,
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "pcie", roles: [config.role] }],
      capabilities: ["pcie", `pcie_gen${config.generation}`, `pcie_x${config.lanes}`],
      parameters,
      ...(slots.length ? { slots: slots as SlotDef[], profiles: [{ id: `${id}_default`, label: `x${lanes.length || config.lanes}`, default_active: true, bindings }] } : {}),
    },
  ];
}

// ---------------------------------------------------------------------------
// M.2
// ---------------------------------------------------------------------------

/** M.2 key letters in use (PCI-SIG M.2 specification). */
export type M2Key = "A" | "B" | "E" | "M";

/** Interfaces an M.2 socket or card can carry. */
export type M2Interface =
  | "pcie"
  | "sata"
  | "usb2"
  | "usb3"
  | "sdio"
  | "uart"
  | "i2c"
  | "i2s"
  | "pcm"
  | "cnvi"
  | "ssic"
  | "hsic"
  | "displayport"
  | "smbus"
  | "sim";

export interface M2Config {
  /** Interface id. Defaults to "m2". */
  id?: string;
  name?: string;
  /** "socket" = the connector on the host board; "card" = the module's edge. */
  role: "socket" | "card";
  /**
   * Keys: a socket has one; a card has the notches it is cut for (one, or
   * two such as ["B", "M"]). A card fits a socket whose key is one of its own.
   */
  key: M2Key | M2Key[];
  /**
   * Sizes as width and length in mm, "2230", "2242", "2280", "22110": the
   * card's own size, or every length a socket has a standoff position for.
   */
  sizes: string[];
  /** Interfaces it carries (on a socket: wired to the host; on a card: used by it). */
  carries: M2Interface[];
  /** When it carries PCIe: lanes and highest generation. */
  pcie?: { lanes: number; generation: number };
  /** PCI-SIG socket number where the source names one: 1 (A/E keys), 2 (B), 3 (M). */
  socket?: 1 | 2 | 3;
  /** Supply the socket gives or the card takes (3.3 V on most). */
  voltageV?: number | [number, number];
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * An M.2 socket or card edge: protocol `m2`, role `socket` or `card`, with
 * an `m2` trait (`key`, `sizes`, `carries`, `socket`) and, when it carries
 * PCIe, the `lane_count` and `pcie_generation` parameters. The pair check
 * refuses a card whose keys do not include the socket's (`m2_key`), a card
 * size the socket has no standoff for (`m2_size`), and a pair that carries
 * no interface in common (`m2_interface`: a SATA SSD in an NVMe-only socket).
 *
 * The pins inside the socket are not modelled here. Where a part routes
 * them, declare a `PCIe` (or `I2S`, `UART`...) composite on the same leaves.
 * The screw that holds the card is a `BoltPattern` on the host.
 */
export function M2(config: M2Config): InterfaceDef {
  const id = config.id ?? "m2";
  const keys = Array.isArray(config.key) ? config.key : [config.key];
  if (config.role === "socket" && keys.length !== 1) throw new Error(`M2 ${id}: a socket has exactly one key (got ${keys.join("+")})`);
  if (!keys.length || keys.some((k) => !["A", "B", "E", "M"].includes(k))) throw new Error(`M2 ${id}: keys are A, B, E or M`);
  if (config.role === "card" && config.sizes.length !== 1) throw new Error(`M2 ${id}: a card has one size`);
  for (const s of config.sizes) if (!/^\d{4,5}$/.test(s)) throw new Error(`M2 ${id}: size "${s}" is not width and length in mm, e.g. "2280"`);
  if (config.carries.includes("pcie") !== Boolean(config.pcie)) throw new Error(`M2 ${id}: give \`pcie\` (lanes, generation) exactly when it carries pcie`);
  const parameters: Parameter[] = [];
  if (config.pcie) parameters.push(laneCount([1, config.pcie.lanes]), pcieGeneration(config.pcie.generation));
  if (config.voltageV !== undefined) parameters.push(Array.isArray(config.voltageV) ? { id: "voltage", unit: "V", range: config.voltageV } : voltageParam(config.voltageV));
  return {
    id,
    name: config.name ?? `M.2 ${keys.join("+")}-key ${config.role}`,
    domain: "electrical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "m2", roles: [config.role] }],
    capabilities: ["m2", ...keys.map((k) => `m2_key_${k.toLowerCase()}`), ...config.carries.map((c) => `m2_${c}`)],
    ...(parameters.length ? { parameters } : {}),
    traits: [{ type: "m2", params: { key: keys, sizes: config.sizes, carries: config.carries, ...(config.socket ? { socket: config.socket } : {}) } }],
  };
}
