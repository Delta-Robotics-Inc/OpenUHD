import type { InterfaceDef } from "../types/interface.js";

/**
 * Wireless interfaces (PB-866): Wi-Fi, Bluetooth and IEEE 802.15.4 (Zigbee,
 * Thread, Matter over Thread), alongside the `wifi` and `bluetooth` types
 * parts already used.
 *
 * Each is a `network` domain interface that pairs with another radio of the
 * same kind over the air. A `wireless` trait states the standard, the bands
 * and what the radio speaks (`stacks`: Wi-Fi generations, Bluetooth modes,
 * 802.15.4 network stacks); the pair check refuses two radios with no band
 * in common (`wireless_band`) or no stack in common (`wireless_stack`: a
 * Classic-only Bluetooth device and an LE-only one, a Zigbee-only and a
 * Thread-only radio) and warns when two Zigbee devices that can only be end
 * devices meet (`zigbee_roles`: they need a coordinator or router).
 *
 * The radio's physical side (its antenna, a U.FL or SMA connector) is an
 * `rf` interface with a `connectorTrait`; name it in `radio` to record
 * which antenna the interface uses.
 *
 * Roles: Wi-Fi `client` ↔ `access_point` (and `peer` ↔ `peer` for Wi-Fi
 * Direct, ESP-NOW and the like); Bluetooth `central` ↔ `peripheral`,
 * `broadcaster` ↔ `observer`, and `peer` with any of central, peripheral
 * and peer; 802.15.4 `node` ↔ `node` (the Zigbee and Thread device roles go
 * in the trait).
 */

export type WirelessBand = "sub_ghz_433" | "sub_ghz_868" | "sub_ghz_915" | "2.4GHz" | "5GHz" | "6GHz";

/** Each band's frequency range in MHz (the ISM and Wi-Fi allocations, widest common span). */
export const WIRELESS_BANDS: Record<WirelessBand, [number, number]> = {
  sub_ghz_433: [433.05, 434.79],
  sub_ghz_868: [863, 870],
  sub_ghz_915: [902, 928],
  "2.4GHz": [2400, 2483.5],
  "5GHz": [5150, 5895],
  "6GHz": [5925, 7125],
};

interface WirelessBase {
  id?: string;
  name?: string;
  /** Bands the radio works in. */
  bands?: WirelessBand[];
  /** Interface id of the `rf` interface (antenna or antenna connector) it uses. */
  radio?: string;
  /** Highest transmit power in dBm. */
  txPowerDbm?: number;
  /** Receive sensitivity in dBm, at the rate the source states. */
  sensitivityDbm?: number;
  exposed?: boolean;
  defaultActive?: boolean;
}

function wireless(type: string, id: string, name: string, roles: string[], stacks: string[], bands: WirelessBand[], base: WirelessBase, extra: Record<string, unknown>): InterfaceDef {
  if (!bands.length) throw new Error(`${type} ${id}: give the bands it works in`);
  if (!stacks.length) throw new Error(`${type} ${id}: give what the radio speaks`);
  return {
    id,
    name,
    domain: "network",
    exposed: base.exposed ?? true,
    default_active: base.defaultActive ?? true,
    protocols: [{ type, roles }],
    capabilities: [type, ...stacks.map((s) => `${type}_${s.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`)],
    traits: [
      {
        type: "wireless",
        params: {
          standard: type,
          bands,
          stacks,
          ...(base.radio ? { radio: base.radio } : {}),
          ...(base.txPowerDbm !== undefined ? { tx_power_dbm: base.txPowerDbm } : {}),
          ...(base.sensitivityDbm !== undefined ? { sensitivity_dbm: base.sensitivityDbm } : {}),
          ...extra,
        },
      },
    ],
  };
}

export interface IEEE802154Config extends WirelessBase {
  /** Network stacks it runs: "zigbee", "thread", "matter" (over Thread), "raw" (plain 802.15.4 MAC). */
  stacks: ("zigbee" | "thread" | "matter" | "raw")[];
  /** Zigbee device roles it can take. */
  zigbeeRoles?: ("coordinator" | "router" | "end_device")[];
  /** Thread device roles it can take. */
  threadRoles?: ("border_router" | "leader" | "router" | "end_device" | "sleepy_end_device")[];
}

/** An IEEE 802.15.4 radio (Zigbee, Thread, Matter over Thread): protocol `ieee802154`, role `node`. Bands default to 2.4 GHz. */
export function IEEE802154(config: IEEE802154Config): InterfaceDef {
  const id = config.id ?? "ieee802154";
  const bands = config.bands ?? ["2.4GHz"];
  if (config.zigbeeRoles && !config.stacks.includes("zigbee")) throw new Error(`IEEE802154 ${id}: Zigbee roles without the zigbee stack`);
  if (config.threadRoles && !config.stacks.some((s) => s === "thread" || s === "matter")) throw new Error(`IEEE802154 ${id}: Thread roles without the thread stack`);
  const label = config.stacks.filter((s) => s !== "raw").map((s) => s[0]!.toUpperCase() + s.slice(1)).join(" / ") || "802.15.4";
  return wireless("ieee802154", id, config.name ?? `IEEE 802.15.4 (${label})`, ["node"], config.stacks, bands, config, {
    ...(config.zigbeeRoles ? { zigbee_roles: config.zigbeeRoles } : {}),
    ...(config.threadRoles ? { thread_roles: config.threadRoles } : {}),
  });
}

export interface WiFiConfig extends WirelessBase {
  /** IEEE 802.11 amendments it supports: "b", "g", "n", "a", "ac", "ax", "be". */
  standards: ("a" | "b" | "g" | "n" | "ac" | "ax" | "be")[];
  /** Roles: "client" (station), "access_point", "peer". Defaults to ["client"]. */
  roles?: ("client" | "access_point" | "peer")[];
}

/** A Wi-Fi interface: protocol `wifi`. Bands default from the standards (2.4 GHz for b/g, 5 GHz for a/ac, both for n, ax). */
export function WiFi(config: WiFiConfig): InterfaceDef {
  const id = config.id ?? "wifi";
  const s = new Set(config.standards);
  const bands: WirelessBand[] = config.bands ?? [
    ...(s.has("b") || s.has("g") ? (["2.4GHz"] as const) : []),
    ...(s.has("a") || s.has("ac") ? (["5GHz"] as const) : []),
  ];
  if (!config.bands && (s.has("n") || s.has("ax") || s.has("be"))) throw new Error(`WiFi ${id}: 802.11${[...s].filter((x) => ["n", "ax", "be"].includes(x)).join("/")} runs in more than one band; give \`bands\``);
  return wireless("wifi", id, config.name ?? `Wi-Fi 802.11${config.standards.join("/")}`, config.roles ?? ["client"], config.standards.map((x) => `802.11${x}`), [...new Set(bands)], config, {});
}

export interface BluetoothConfig extends WirelessBase {
  /** Core specification version, e.g. "5.0". */
  version: string;
  /** "classic" (BR/EDR) and/or "le" (Bluetooth Low Energy). */
  modes: ("classic" | "le")[];
  /** Roles. Defaults to ["peer"]. */
  roles?: ("central" | "peripheral" | "broadcaster" | "observer" | "peer")[];
}

/** A Bluetooth interface: protocol `bluetooth`, 2.4 GHz. */
export function Bluetooth(config: BluetoothConfig): InterfaceDef {
  const id = config.id ?? "bluetooth";
  const label = config.modes.map((m) => (m === "le" ? "LE" : "Classic")).join(" + ");
  return wireless("bluetooth", id, config.name ?? `Bluetooth ${config.version} (${label})`, config.roles ?? ["peer"], config.modes, config.bands ?? ["2.4GHz"], config, { version: config.version });
}
