import type { InterfaceDef, SlotDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { bitRateBps } from "./params.js";
import { resolveSignal, type SignalRef } from "./signal.js";

/**
 * CAN builders: the bus side (CANH/CANL between nodes) and the logic side
 * (a CAN controller's TX/RX to a transceiver's TXD/RXD).
 *
 * Role family (matching/roles.ts):
 * - `can` (bus): every node pairs with every other. Older parts declared
 *   the bus as "transceiver" or "peer"; both pair with "node".
 * - `can_logic`: "controller" (the MCU's CAN peripheral) pairs only with
 *   "transceiver" (the PHY chip or module); two controllers or two
 *   transceivers do not pair.
 */

export interface CANConfig {
  /** Interface id. Defaults to "can". */
  id?: string;
  name?: string;
  canH: SignalRef;
  canL: SignalRef;
  /** Ground or signal reference leaf id, where the connector carries one. */
  ground?: string;
  /** Supported bit rate in bit/s: fixed, or [min, max]. All nodes on a bus must share one. */
  bitRateBps?: number | [number, number];
  /** Supports CAN FD frames. */
  fd?: boolean;
  /**
   * Bus termination on this node: "built_in" (always on), "switchable"
   * (jumper or software), or "none". A bus needs 120 Ω at each end.
   */
  termination?: "built_in" | "switchable" | "none";
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A CAN bus port: CANH and CANL as `can_signal` leaves (capabilities
 * `can_h`, `can_l`) and a composed `can` interface with role "node", slots
 * can_h, can_l and optional ground. (The leaves have their own protocol type
 * so that a port pairs with the other port, not with one of its wires.) Two nodes' ports pair slot by slot. A node with
 * two connectors in parallel (daisy-chain in and out) declares two ports
 * bound to the same leaves, or one port per connector's leaves.
 */
export function CAN(config: CANConfig): InterfaceDef[] {
  const id = config.id ?? "can";
  const generated: InterfaceDef[] = [];
  const leaf = (ref: SignalRef, which: "can_h" | "can_l") =>
    resolveSignal(ref, { id: `${id}_${which.slice(4)}`, defaultName: which === "can_h" ? "CANH" : "CANL", capability: which, protocols: [{ type: "can_signal", roles: ["node"] }] }, generated);
  const h = leaf(config.canH, "can_h");
  const l = leaf(config.canL, "can_l");
  const slots: SlotDef[] = [
    { id: "can_h", label: "CANH", required: true, match: { protocol: "can_signal", role: "node", ...(typeof config.canH === "string" ? {} : { capability: "can_h" }) } },
    { id: "can_l", label: "CANL", required: true, match: { protocol: "can_signal", role: "node", ...(typeof config.canL === "string" ? {} : { capability: "can_l" }) } },
  ];
  const bindings: Record<string, string> = { can_h: h, can_l: l };
  if (config.ground !== undefined) {
    slots.push({ id: "ground", label: "GND", required: false, match: { protocol: "power", role: "ground" } });
    bindings.ground = config.ground;
  }
  const parameters: Parameter[] = config.bitRateBps !== undefined ? [bitRateBps(config.bitRateBps)] : [];
  return [
    ...generated,
    {
      id,
      name: config.name ?? "CAN bus",
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "can", roles: ["node"] }],
      capabilities: config.fd ? ["can", "can_fd"] : ["can"],
      ...(parameters.length > 0 ? { parameters } : {}),
      slots,
      profiles: [{ id: `${id}_default`, label: "CANH / CANL", default_active: true, bindings }],
      ...(config.termination !== undefined
        ? { traits: [{ type: "can_termination", params: { termination: config.termination, note: "A CAN bus needs 120 Ω termination at each end and none in between." } }] }
        : {}),
    },
  ];
}

export interface CANLogicConfig {
  /** Interface id. Defaults to "can_logic". */
  id?: string;
  name?: string;
  /** "controller" = an MCU's CAN peripheral; "transceiver" = the PHY's logic side. */
  role: "controller" | "transceiver";
  /** Controller TX / transceiver TXD (data toward the bus). */
  tx: SignalRef;
  /** Controller RX / transceiver RXD (data from the bus). */
  rx: SignalRef;
  /** Logic level, for the leaves declared inline. */
  voltageV?: number | [number, number];
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * The logic side of CAN: a controller's TX and RX to a transceiver's TXD and
 * RXD. The composed `can_logic` interface has slots tx then rx; the
 * controller drives TX (digital output) and reads RX, the transceiver reads
 * TXD (digital input) and drives RXD, so the slots pair TX→TXD and RXD→RX.
 * An MCU pin that can be its CAN TX or RX carries capability `can_tx` or
 * `can_rx`.
 */
export function CANLogic(config: CANLogicConfig): InterfaceDef[] {
  const id = config.id ?? "can_logic";
  const controller = config.role === "controller";
  const generated: InterfaceDef[] = [];
  const signal = (ref: SignalRef, which: "tx" | "rx") => {
    const drives = (which === "tx") === controller;
    const inline = typeof ref === "string" ? ref : { ...(config.voltageV !== undefined ? { voltageV: config.voltageV } : {}), ...ref };
    const leafId = resolveSignal(
      inline,
      { id: `${id}_${which}`, defaultName: controller ? which.toUpperCase() : `${which.toUpperCase()}D`, capability: `can_${which}`, protocols: [{ type: "digital", roles: [drives ? "output" : "input"] }] },
      generated,
    );
    const slot: SlotDef = { id: which, label: controller ? which.toUpperCase() : `${which.toUpperCase()}D`, required: true, match: { protocol: "digital", role: drives ? "output" : "input", ...(typeof ref === "string" ? {} : { capability: `can_${which}` }) } };
    return { leafId, slot };
  };
  const tx = signal(config.tx, "tx");
  const rx = signal(config.rx, "rx");
  return [
    ...generated,
    {
      id,
      name: config.name ?? (controller ? "CAN controller" : "CAN transceiver logic"),
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "can_logic", roles: [config.role] }],
      slots: [tx.slot, rx.slot],
      profiles: [{ id: `${id}_default`, label: "TX / RX", default_active: true, bindings: { tx: tx.leafId, rx: rx.leafId } }],
      max_instances: 1,
    },
  ];
}
