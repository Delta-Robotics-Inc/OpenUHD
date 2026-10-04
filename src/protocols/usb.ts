import type { InterfaceDef } from "../types/interface.js";
import { diffSignals, linkSlots, type DiffPair, type LinkSignal } from "./link.js";
import type { SignalRef } from "./signal.js";

/**
 * USB data ports, for the `usb` type parts already used.
 *
 * Protocol `usb`, role `host`, `device` or `dual_role` (a USB-C DRP or an
 * OTG port); a host pairs with a device, a dual-role port with either.
 * Parts that used role `bidirectional` keep pairing with host, device and
 * dual_role. The `usb` trait holds the speeds; the pair check states the
 * speed the two run at when it is below either end's fastest (`usb_speed`,
 * info), as USB falls back, and refuses two ports with no speed in common
 * (error).
 *
 * Pins are optional: D+ and D−, the SuperSpeed pairs (TX from this side,
 * RX into it) and the USB-C CC pins. Slots pair D+ to D+, D− to D−, TX to
 * RX and CC to CC. VBUS is a `PowerIn` or `PowerOut` of its own; the
 * receptacle or plug is a `connectorTrait` on the port.
 */

export type USBSpeed = "low" | "full" | "high" | "super" | "super_plus" | "super_plus_2x2" | "usb4";

const SPEED_MBPS: Record<USBSpeed, number> = { low: 1.5, full: 12, high: 480, super: 5000, super_plus: 10000, super_plus_2x2: 20000, usb4: 40000 };

export interface USBConfig {
  /** Interface id. Defaults to "usb". */
  id?: string;
  name?: string;
  role: "host" | "device" | "dual_role";
  /** Speeds the port runs: "low" (1.5 Mbit/s), "full" (12), "high" (480), "super" (5 Gbit/s), "super_plus" (10), "super_plus_2x2" (20), "usb4". */
  speeds: USBSpeed[];
  dp?: SignalRef;
  dm?: SignalRef;
  /** SuperSpeed pairs, lane 0 first (two on a USB-C 2×2 port). */
  superSpeed?: { tx: DiffPair; rx: DiffPair }[];
  /** USB-C configuration channel pins. */
  cc?: [SignalRef, SignalRef];
  exposed?: boolean;
  defaultActive?: boolean;
}

/** A USB data port: protocol `usb` with a `usb` trait (speeds) and optional D+/D−, SuperSpeed and CC slots. */
export function USB(config: USBConfig): InterfaceDef[] {
  const id = config.id ?? "usb";
  if (!config.speeds.length) throw new Error(`USB ${id}: give the speeds it runs`);
  if ((config.dp === undefined) !== (config.dm === undefined)) throw new Error(`USB ${id}: give D+ and D- together`);
  const speeds = [...config.speeds].sort((a, b) => SPEED_MBPS[a] - SPEED_MBPS[b]);
  const signals: LinkSignal[] = [];
  const io = [{ type: "usb_signal", roles: ["bidirectional"] }];
  if (config.dp !== undefined && config.dm !== undefined) signals.push(...diffSignals("d", ["D+", "D-"], [config.dp, config.dm], io, "usb_d", "d", true));
  (config.superSpeed ?? []).forEach((ss, i) => {
    signals.push(...diffSignals(`ss${i}_tx`, [`SSTX${i}+`, `SSTX${i}-`], ss.tx, [{ type: "usb_signal", roles: ["transmitter"] }], "usb_sstx", "sstx", false));
    signals.push(...diffSignals(`ss${i}_rx`, [`SSRX${i}+`, `SSRX${i}-`], ss.rx, [{ type: "usb_signal", roles: ["receiver"] }], "usb_ssrx", "ssrx", false));
  });
  if (config.cc) {
    signals.push({ slot: "cc1", label: "CC1", ref: config.cc[0], leaf: io, capability: "usb_cc1", role: "cc", required: false });
    signals.push({ slot: "cc2", label: "CC2", ref: config.cc[1], leaf: io, capability: "usb_cc2", role: "cc", required: false });
  }
  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "usb", signals, generated);
  const top = speeds[speeds.length - 1]!;
  return [
    ...generated,
    {
      id,
      name: config.name ?? `USB ${top.replace(/_/g, " ")}-speed ${config.role.replace("_", "-")}`,
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "usb", roles: [config.role] }],
      capabilities: ["usb", ...speeds.map((s) => `usb_${s}_speed`)],
      traits: [{ type: "usb", params: { speeds } }],
      ...(slots.length ? { slots, profiles: [{ id: `${id}_default`, label: "USB", default_active: true, bindings }] } : {}),
    },
  ];
}

/** The speed two USB ports run at: the fastest both list, or undefined. */
export function usbLinkSpeed(a: USBSpeed[], b: USBSpeed[]): USBSpeed | undefined {
  return a.filter((s) => b.includes(s)).sort((x, y) => SPEED_MBPS[y] - SPEED_MBPS[x])[0];
}
