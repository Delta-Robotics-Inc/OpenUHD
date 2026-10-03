import type { InterfaceDef, ProtocolDef, SlotDef } from "../types/interface.js";
import { resolveSignal, type SignalRef } from "./signal.js";

/**
 * Shared plumbing for the link builders (PB-866): PCIe, MIPI, Ethernet, I2S,
 * DVP and SD. A link is a composite whose slots each carry one conductor;
 * every slot names its own sub-role under the link's protocol, so two ports
 * pair conductor by conductor (TX+ to RX+, BCLK out to BCLK in) and nothing
 * else. Slots of one direction pair in the order they are declared, which
 * the builders keep the same on both sides (lane 0 first, a pair's + leg
 * before its − leg, DVP data MSB first).
 */

/** A differential pair: [positive, negative], each an inline spec or an existing pin id. */
export type DiffPair = [SignalRef, SignalRef];

export interface LinkSignal {
  /** Slot id, also the suffix of a generated leaf's id. */
  slot: string;
  /** Default display name of a generated leaf, and the slot label. */
  label: string;
  ref: SignalRef;
  /** Protocols of a generated leaf. */
  leaf: ProtocolDef[];
  /** Capability of a generated leaf (and of the slot, for inline leaves). */
  capability: string;
  /** Sub-role of the slot under the link's protocol. */
  role: string;
  required: boolean;
}

/**
 * Resolve the signals of a link: generate inline leaves into `generated`,
 * and return the slots and the default profile's bindings. A signal given
 * as an existing pin id is bound as is (its slot then matches by protocol
 * and role only, as the pin may not carry the capability).
 */
export function linkSlots(
  id: string,
  protocol: string,
  signals: LinkSignal[],
  generated: InterfaceDef[],
  voltageV?: number | [number, number],
): { slots: SlotDef[]; bindings: Record<string, string> } {
  const slots: SlotDef[] = [];
  const bindings: Record<string, string> = {};
  for (const s of signals) {
    const inline = typeof s.ref === "string" ? s.ref : { ...(voltageV !== undefined ? { voltageV } : {}), ...s.ref };
    bindings[s.slot] = resolveSignal(inline, { id: `${id}_${s.slot}`, defaultName: s.label, capability: s.capability, protocols: s.leaf }, generated);
    slots.push({
      id: s.slot,
      label: s.label,
      required: s.required,
      match: { protocol, role: s.role, ...(typeof s.ref === "string" ? {} : { capability: s.capability }) },
    });
  }
  return { slots, bindings };
}

/** The two legs of a differential pair as link signals: `<slot>_p` and `<slot>_n`, sub-roles `<role>_p` and `<role>_n`. */
export function diffSignals(
  slot: string,
  label: [string, string],
  pair: DiffPair,
  leaf: ProtocolDef[],
  capability: string,
  role: string,
  required: boolean,
): LinkSignal[] {
  return [
    { slot: `${slot}_p`, label: label[0], ref: pair[0], leaf, capability: `${capability}_p`, role: `${role}_p`, required },
    { slot: `${slot}_n`, label: label[1], ref: pair[1], leaf, capability: `${capability}_n`, role: `${role}_n`, required },
  ];
}

/** Digital leaf protocols for a link signal driven by this side (out), read by it (in), or both. */
export const DIGITAL_OUT: ProtocolDef[] = [{ type: "digital", roles: ["output"] }];
export const DIGITAL_IN: ProtocolDef[] = [{ type: "digital", roles: ["input"] }];
export const DIGITAL_IO: ProtocolDef[] = [{ type: "digital", roles: ["bidirectional"] }];
