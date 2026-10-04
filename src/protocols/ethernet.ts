import type { InterfaceDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { linkSpeedMbps, poePowerW, voltageRangeV, voltageV, wavelengthNm } from "./params.js";
import { diffSignals, linkSlots, type DiffPair, type LinkSignal } from "./link.js";

/**
 * Ethernet ports, Power over Ethernet, and SFP cages and modules.
 *
 * `Ethernet` is one port as its medium sees it: copper (an RJ45 jack, a
 * PHY's MDI pins, a board's magnetics) or fibre (an SFP module's optics, a
 * media converter's fibre side). Protocol `ethernet`, role `port`: any two
 * ports pair (auto MDI-X, or the cable, crosses the pairs). The trait
 * `ethernet` holds the medium and the exact speeds; the parameter
 * `link_speed` holds the slowest and fastest. The pair check
 * (`ethernet_speed`) refuses ports with no speed in common and states the
 * speed they link at; copper does not link to fibre (`ethernet_medium`);
 * fibre ports need the same mode and each side's transmit wavelength at the
 * other's receiver (`fiber_mismatch`).
 *
 * The connector is a `connectorTrait` (RJ45, LC duplex) on the port. The
 * MAC side of a PHY (RMII, RGMII) is not modelled here.
 */

export type EthernetSpeed = 10 | 100 | 1000 | 2500 | 5000 | 10000 | 25000 | 40000 | 50000 | 100000;

/** Power over Ethernet on a port. */
export interface PoEConfig {
  /** "pse" sources power (a PoE switch port, an injector); "pd" is powered by it. */
  role: "pse" | "pd";
  /** "802.3af" (Type 1), "802.3at" (Type 2, PoE+), "802.3bt" (Types 3 and 4), or "passive" (a fixed voltage on spare pairs, no detection). */
  standard: "802.3af" | "802.3at" | "802.3bt" | "passive";
  /** IEEE 802.3 type (1–4) where the source names it. */
  type?: 1 | 2 | 3 | 4;
  /** Power class (0–8) where the source names it. */
  class?: number;
  /** PSE: power it delivers per port in W; PD: the most it draws at its input in W. */
  powerW?: number;
  /** Voltage at the port: nominal or [min, max] (passive PoE states its fixed voltage). */
  voltageV?: number | [number, number];
  /** Pairs the power uses: "A" (data pairs 1-2 / 3-6), "B" (spare pairs 4-5 / 7-8), "4pair", or "any" (a PD that takes either). */
  mode?: "A" | "B" | "4pair" | "any";
  /** PD only: true when PoE is its only power input. */
  required?: boolean;
}

export interface FiberConfig {
  /** Single-mode or multi-mode fibre. */
  mode: "single_mode" | "multi_mode";
  /** Transmit wavelength in nm; a BiDi module transmits and receives on different ones. */
  txNm: number;
  /** Receive wavelength in nm. Defaults to txNm. */
  rxNm?: number;
  /** Strands: 2 (duplex) or 1 (BiDi). Defaults to 2. */
  strands?: 1 | 2;
  /** Link reach in m where the source states it. */
  reachM?: number;
}

export interface EthernetConfig {
  /** Interface id. Defaults to "ethernet". */
  id?: string;
  name?: string;
  /** Speeds the port supports in Mbit/s, e.g. [10, 100, 1000]. */
  speedsMbps: EthernetSpeed[];
  /** Defaults to "copper". */
  medium?: "copper" | "fiber";
  /**
   * Copper MDI pairs: a and b (TX and RX on 10/100), c and d on 1000BASE-T
   * and faster (BI_DA … BI_DD). Each an inline spec or existing pin ids.
   */
  pairs?: { a: DiffPair; b: DiffPair; c?: DiffPair; d?: DiffPair };
  /** The PHY swaps pairs itself (auto MDI-X). */
  autoMdix?: boolean;
  poe?: PoEConfig;
  /** Fibre only. */
  fiber?: FiberConfig;
  exposed?: boolean;
  defaultActive?: boolean;
}

/** An Ethernet port: protocol `ethernet` (role `port`), an `ethernet` trait, optional MDI pair slots and PoE. */
export function Ethernet(config: EthernetConfig): InterfaceDef[] {
  const id = config.id ?? "ethernet";
  const medium = config.medium ?? "copper";
  if (!config.speedsMbps.length) throw new Error(`Ethernet ${id}: give the speeds it supports`);
  if (medium === "fiber" && (config.pairs || config.poe)) throw new Error(`Ethernet ${id}: a fibre port has no MDI pairs and no PoE`);
  if ((medium === "fiber") !== Boolean(config.fiber)) throw new Error(`Ethernet ${id}: give \`fiber\` exactly when the medium is fibre`);
  if (config.poe?.required && config.poe.role !== "pd") throw new Error(`Ethernet ${id}: only a powered device can require PoE`);
  const fast = Math.max(...config.speedsMbps) >= 1000;
  if (config.pairs && fast && (!config.pairs.c || !config.pairs.d)) throw new Error(`Ethernet ${id}: 1000BASE-T and faster use four pairs (c and d)`);

  const signals: LinkSignal[] = [];
  if (config.pairs) {
    const leaf = [{ type: "ethernet_mdi", roles: ["bidirectional"] }];
    const names: Record<string, [string, string]> = fast
      ? { a: ["BI_DA+", "BI_DA-"], b: ["BI_DB+", "BI_DB-"], c: ["BI_DC+", "BI_DC-"], d: ["BI_DD+", "BI_DD-"] }
      : { a: ["TD+", "TD-"], b: ["RD+", "RD-"] };
    for (const k of ["a", "b", "c", "d"] as const) {
      const pair = config.pairs[k];
      if (pair) signals.push(...diffSignals(`pair_${k}`, names[k] ?? [`BI_D${k.toUpperCase()}+`, `BI_D${k.toUpperCase()}-`], pair, leaf, "ethernet_mdi", "mdi", k === "a" || k === "b"));
    }
  }
  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "ethernet", signals, generated);

  const parameters: Parameter[] = [linkSpeedMbps(config.speedsMbps)];
  const poe = config.poe;
  if (poe?.powerW !== undefined) parameters.push(poePowerW(poe.powerW));
  if (poe?.voltageV !== undefined) parameters.push(Array.isArray(poe.voltageV) ? voltageRangeV(poe.voltageV[0], poe.voltageV[1]) : voltageV(poe.voltageV));
  if (config.fiber) parameters.push(wavelengthNm(config.fiber.txNm));

  const traits = [
    {
      type: "ethernet",
      params: {
        medium,
        speeds_mbps: [...config.speedsMbps].sort((a, b) => a - b),
        ...(config.autoMdix !== undefined ? { auto_mdix: config.autoMdix } : {}),
        ...(config.fiber
          ? { fiber: { mode: config.fiber.mode, tx_nm: config.fiber.txNm, rx_nm: config.fiber.rxNm ?? config.fiber.txNm, strands: config.fiber.strands ?? 2, ...(config.fiber.reachM ? { reach_m: config.fiber.reachM } : {}) } }
          : {}),
      },
    },
    ...(poe
      ? [{ type: "poe", params: { role: poe.role, standard: poe.standard, ...(poe.type ? { type: poe.type } : {}), ...(poe.class !== undefined ? { class: poe.class } : {}), ...(poe.mode ? { mode: poe.mode } : {}), ...(poe.required ? { required: true } : {}) } }]
      : []),
  ];
  return [
    ...generated,
    {
      id,
      name: config.name ?? `Ethernet ${speedLabel(config.speedsMbps)}${poe ? ` (PoE ${poe.role.toUpperCase()})` : ""}`,
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "ethernet", roles: ["port"] }],
      capabilities: ["ethernet", `ethernet_${medium}`, ...(poe ? [`poe_${poe.role}`] : [])],
      parameters,
      traits,
      ...(slots.length ? { slots, profiles: [{ id: `${id}_default`, label: "MDI", default_active: true, bindings }] } : {}),
    },
  ];
}

function speedLabel(speeds: number[]): string {
  return [...speeds].sort((a, b) => a - b).map((s) => (s >= 1000 ? `${s / 1000}G` : `${s}M`)).join("/");
}

// ---------------------------------------------------------------------------
// SFP
// ---------------------------------------------------------------------------

/** Pluggable transceiver forms. SFP, SFP+ and SFP28 share one cage; QSFP+ and QSFP28 another. */
export type SFPForm = "sfp" | "sfp+" | "sfp28" | "qsfp+" | "qsfp28";

export interface SFPConfig {
  /** Interface id. Defaults to "sfp". */
  id?: string;
  name?: string;
  /** "cage" = the host's slot; "module" = the pluggable transceiver's edge. */
  role: "cage" | "module";
  form: SFPForm;
  /** Speeds in Mbit/s: those the cage's host runs, or the module's. */
  speedsMbps: EthernetSpeed[];
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * An SFP cage or module edge: protocol `sfp`, role `cage` or `module`, an
 * `sfp` trait (`form`, `speeds_mbps`) and `link_speed`. A module's other
 * side (its optics or its RJ45) is an `Ethernet` port of its own. The pair
 * check refuses a module of another cage family (`sfp_form`) and one with
 * no speed the host runs (`ethernet_speed`).
 */
export function SFP(config: SFPConfig): InterfaceDef {
  const id = config.id ?? "sfp";
  if (!config.speedsMbps.length) throw new Error(`SFP ${id}: give the speeds it supports`);
  return {
    id,
    name: config.name ?? `${config.form.toUpperCase()} ${config.role}`,
    domain: "electrical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "sfp", roles: [config.role] }],
    capabilities: ["sfp", `sfp_${config.form.replace("+", "_plus")}`],
    parameters: [linkSpeedMbps(config.speedsMbps)],
    traits: [{ type: "sfp", params: { form: config.form, speeds_mbps: [...config.speedsMbps].sort((a, b) => a - b) } }],
  };
}
