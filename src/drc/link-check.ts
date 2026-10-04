import type { InterfaceDef } from "../types/interface.js";
import type { Diagnostic } from "./types.js";
import { getEffectiveRange } from "../parameters/range.js";

/**
 * Pair checks on links that negotiate or must agree beyond overlapping
 * parameters: PCIe, M.2, MIPI, Ethernet and PoE, SFP, I2S, DVP,
 * SD, LED drive, and wireless.
 *
 * - `link_width` (info): a PCIe link (or an M.2 socket and card carrying PCIe) trains to the widest width and
 *   highest generation both ends support; when that is less than either
 *   end has, the check says what it runs at. MIPI states the lane count the
 *   two can share.
 * - `lane_rate` (warning): a MIPI transmitter whose highest lane rate is
 *   above the receiver's: its faster modes do not work.
 * - `m2_key`, `m2_size`, `m2_interface` (errors): a card whose keys do not
 *   include the socket's key; a card length the socket has no standoff
 *   for; a socket and card with no interface in common.
 * - `ethernet_speed`: no speed in common (error), or the speed they link
 *   at when it is below either end's fastest (info). Ethernet and SFP.
 * - `ethernet_medium` (error): copper against fibre.
 * - `fiber_mismatch` (error): single-mode against multi-mode, a transmit
 *   wavelength that is not the other end's receive wavelength, or a duplex
 *   module against a BiDi one.
 * - `poe_power`: a powered device that needs more power than the PSE gives
 *   (error); passive PoE against an 802.3 end (warning); a device powered
 *   only by PoE on a port that gives none (warning).
 * - `sfp_form` (error): an SFP-family module in a QSFP cage, or the reverse.
 * - `audio_format` (error): I2S ports with no frame format in common.
 * - `audio_direction` (error): two ports that both only send, or both only
 *   receive.
 * - `dvp_width`: a host narrower than the camera takes its upper bits
 *   (warning); a wider host leaves its low bits unused (info).
 * - `sd_form`, `sd_mode`, `sd_capacity` (errors): another card form, no
 *   bus mode in common, a card class the host does not read.
 * - `led_drive_current` (warning): a driver that can be set above the
 *   LED's maximum current.
 * - `usb_speed`: USB ports with no speed in common (error), or the speed
 *   they fall back to when it is below either end's fastest (info).
 * - `wireless_band` (error): radios with no band in common.
 * - `wireless_stack` (error): Bluetooth with no mode in common (Classic
 *   against LE), 802.15.4 radios with no stack in common (Zigbee against
 *   Thread).
 * - `zigbee_roles` (warning): two Zigbee radios that can only be end
 *   devices.
 */
export function checkPairLinks(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  return [
    ...linkWidth(a, b),
    ...laneRate(a, b),
    ...m2(a, b),
    ...ethernet(a, b),
    ...poe(a, b),
    ...sfp(a, b),
    ...audio(a, b),
    ...dvp(a, b),
    ...sd(a, b),
    ...ledDrive(a, b),
    ...usb(a, b),
    ...wireless(a, b),
  ];
}

/** Parameters `checkPairLinks` compares itself, which the pairwise overlap check skips. */
export const LINK_CHECKED_PARAMS = new Set(["link_speed", "lane_rate", "bus_width", "poe_power", "wavelength"]);

/** The link-checked parameters this pair carries (both ends speak a link protocol that `checkPairLinks` covers). */
export function linkCheckedParams(a: InterfaceDef, b: InterfaceDef): Set<string> {
  const ids = (x: InterfaceDef) => new Set((x.parameters ?? []).map((p) => p.id));
  const [ia, ib] = [ids(a), ids(b)];
  return new Set([...LINK_CHECKED_PARAMS].filter((id) => ia.has(id) && ib.has(id)));
}

const trait = (iface: InterfaceDef, type: string): Record<string, unknown> | undefined =>
  iface.traits?.find((t) => t.type === type)?.params as Record<string, unknown> | undefined;
const speaks = (iface: InterfaceDef, type: string) => iface.protocols.some((p) => p.type === type);
const rolesOf = (iface: InterfaceDef, type: string) => new Set(iface.protocols.filter((p) => p.type === type).flatMap((p) => p.roles));
const range = (iface: InterfaceDef, id: string): [number, number] | undefined => {
  const p = iface.parameters?.find((x) => x.id === id);
  return (p && getEffectiveRange(p)) ?? undefined;
};
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v === undefined ? [] : [String(v)]);
const common = (x: unknown, y: unknown) => list(x).filter((v) => list(y).includes(v));
const diag = (severity: Diagnostic["severity"], code: string, message: string, a: InterfaceDef, b: InterfaceDef): Diagnostic => ({ severity, code, message, refs: [a.id, b.id] });

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

function linkWidth(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if ((speaks(a, "pcie") && speaks(b, "pcie")) || (speaks(a, "m2") && speaks(b, "m2"))) {
    const [la, lb, ga, gb] = [range(a, "lane_count"), range(b, "lane_count"), range(a, "pcie_generation"), range(b, "pcie_generation")];
    if (!la || !lb) return [];
    const lanes = Math.min(la[1], lb[1]);
    const gen = ga && gb ? Math.min(ga[1], gb[1]) : undefined;
    const narrower = lanes < Math.max(la[1], lb[1]);
    const slower = ga && gb ? gen! < Math.max(ga[1], gb[1]) : false;
    if (!narrower && !slower) return [];
    return [diag("info", "link_width", `the link trains at x${lanes}${gen ? ` Gen ${gen}` : ""} (x${la[1]}${ga ? ` Gen ${ga[1]}` : ""} against x${lb[1]}${gb ? ` Gen ${gb[1]}` : ""})`, a, b)];
  }
  for (const type of ["mipi_csi2", "mipi_dsi"]) {
    if (!speaks(a, type) || !speaks(b, type)) continue;
    const [la, lb] = [range(a, "lane_count"), range(b, "lane_count")];
    if (!la || !lb) return [];
    const hi = Math.min(la[1], lb[1]);
    const lo = Math.max(la[0], lb[0]);
    if (lo > hi) return []; // the overlap check reports it
    if (hi < Math.max(la[1], lb[1])) return [diag("info", "link_width", `the link runs on at most ${hi} lane${hi === 1 ? "" : "s"}`, a, b)];
  }
  return [];
}

function laneRate(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  for (const type of ["mipi_csi2", "mipi_dsi"]) {
    if (!speaks(a, type) || !speaks(b, type)) continue;
    const tx = rolesOf(a, type).has("transmitter") ? a : rolesOf(b, type).has("transmitter") ? b : undefined;
    if (!tx) return [];
    const rx = tx === a ? b : a;
    const [rt, rr] = [range(tx, "lane_rate"), range(rx, "lane_rate")];
    if (rt && rr && rt[1] > rr[1]) return [diag("warning", "lane_rate", `the transmitter runs lanes up to ${rt[1]} Mbit/s, the receiver up to ${rr[1]} Mbit/s: modes above ${rr[1]} Mbit/s per lane do not work`, a, b)];
  }
  return [];
}

// ---------------------------------------------------------------------------
// M.2
// ---------------------------------------------------------------------------

function m2(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const [ta, tb] = [trait(a, "m2"), trait(b, "m2")];
  if (!ta || !tb) return [];
  const socketSide = rolesOf(a, "m2").has("socket") ? a : rolesOf(b, "m2").has("socket") ? b : undefined;
  if (!socketSide) return [];
  const [socket, card] = socketSide === a ? [ta, tb] : [tb, ta];
  const out: Diagnostic[] = [];
  const key = list(socket.key)[0];
  if (key && !list(card.key).includes(key)) out.push(diag("error", "m2_key", `a ${list(card.key).join("+")}-key card does not fit an ${key}-key socket`, a, b));
  const size = list(card.sizes)[0];
  if (size && list(socket.sizes).length && !list(socket.sizes).includes(size)) out.push(diag("error", "m2_size", `the socket holds ${list(socket.sizes).join(", ")} cards, not ${size}`, a, b));
  if (!common(socket.carries, card.carries).length) out.push(diag("error", "m2_interface", `the socket carries ${list(socket.carries).join(", ")}; the card uses ${list(card.carries).join(", ")}`, a, b));
  return out;
}

// ---------------------------------------------------------------------------
// Ethernet, PoE, SFP
// ---------------------------------------------------------------------------

const speedsOf = (iface: InterfaceDef) => (trait(iface, "ethernet") ?? trait(iface, "sfp"))?.speeds_mbps as number[] | undefined;
const fmtSpeed = (s: number) => (s >= 1000 ? `${s / 1000} Gbit/s` : `${s} Mbit/s`);

function ethernet(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const both = (speaks(a, "ethernet") && speaks(b, "ethernet")) || (speaks(a, "sfp") && speaks(b, "sfp"));
  if (!both) return [];
  const out: Diagnostic[] = [];
  const [sa, sb] = [speedsOf(a), speedsOf(b)];
  if (sa && sb) {
    const shared = sa.filter((s) => sb.includes(s));
    if (!shared.length) out.push(diag("error", "ethernet_speed", `no speed in common (${sa.map(fmtSpeed).join(", ")} against ${sb.map(fmtSpeed).join(", ")})`, a, b));
    else if (Math.max(...shared) < Math.max(...sa, ...sb)) out.push(diag("info", "ethernet_speed", `the link runs at ${fmtSpeed(Math.max(...shared))}`, a, b));
  }
  const [ea, eb] = [trait(a, "ethernet"), trait(b, "ethernet")];
  if (ea && eb) {
    if (ea.medium !== eb.medium) out.push(diag("error", "ethernet_medium", `a ${ea.medium} port does not link to a ${eb.medium} port without a media converter`, a, b));
    const [fa, fb] = [ea.fiber as Record<string, number | string> | undefined, eb.fiber as Record<string, number | string> | undefined];
    if (fa && fb) {
      if (fa.mode !== fb.mode) out.push(diag("error", "fiber_mismatch", `${String(fa.mode).replace("_", "-")} optics against ${String(fb.mode).replace("_", "-")}`, a, b));
      if (fa.strands !== fb.strands) out.push(diag("error", "fiber_mismatch", `a ${fa.strands}-strand port against a ${fb.strands}-strand one`, a, b));
      if (fa.tx_nm !== fb.rx_nm || fb.tx_nm !== fa.rx_nm) out.push(diag("error", "fiber_mismatch", `wavelengths do not cross over: ${fa.tx_nm}/${fa.rx_nm} nm (tx/rx) against ${fb.tx_nm}/${fb.rx_nm} nm`, a, b));
    }
  }
  return out;
}

function poe(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "ethernet") || !speaks(b, "ethernet")) return [];
  const [pa, pb] = [trait(a, "poe"), trait(b, "poe")];
  const out: Diagnostic[] = [];
  for (const [pd, pdIf, other, otherIf] of [[pa, a, pb, b], [pb, b, pa, a]] as const) {
    if (pd?.role !== "pd") continue;
    if (other?.role !== "pse") {
      if (pd.required) out.push(diag("warning", "poe_power", `${pdIf.id} is powered only over Ethernet; ${otherIf.id} gives no PoE, so it needs an injector`, a, b));
      continue;
    }
    if ((pd.standard === "passive") !== (other.standard === "passive")) {
      out.push(diag("warning", "poe_power", `${other.standard === "passive" ? "passive PoE" : `${other.standard} PoE`} feeding ${pd.standard === "passive" ? "a passive PoE device" : `an ${pd.standard} device`}: one side does no 802.3 detection, so the device may not power up, or may be damaged`, a, b));
    }
    const need = range(pdIf, "poe_power");
    const give = range(otherIf, "poe_power");
    if (need && give && give[1] + 1e-9 < need[1]) out.push(diag("error", "poe_power", `${otherIf.id} gives ${give[1]} W; ${pdIf.id} draws up to ${need[1]} W`, a, b));
  }
  return out;
}

const SFP_FAMILY: Record<string, string> = { sfp: "sfp", "sfp+": "sfp", sfp28: "sfp", "qsfp+": "qsfp", qsfp28: "qsfp" };

function sfp(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const [ta, tb] = [trait(a, "sfp"), trait(b, "sfp")];
  if (!ta || !tb) return [];
  if (SFP_FAMILY[String(ta.form)] === SFP_FAMILY[String(tb.form)]) return [];
  return [diag("error", "sfp_form", `an ${String(ta.form).toUpperCase()} ${[...rolesOf(a, "sfp")][0]} does not take an ${String(tb.form).toUpperCase()} ${[...rolesOf(b, "sfp")][0]}`, a, b)];
}

// ---------------------------------------------------------------------------
// Audio, cameras, SD, LEDs
// ---------------------------------------------------------------------------

function audio(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const [ta, tb] = [trait(a, "audio_port"), trait(b, "audio_port")];
  if (!ta || !tb) return [];
  const out: Diagnostic[] = [];
  if (!common(ta.formats, tb.formats).length) out.push(diag("error", "audio_format", `no frame format in common (${list(ta.formats).join(", ")} against ${list(tb.formats).join(", ")})`, a, b));
  if (ta.direction !== "duplex" && ta.direction === tb.direction) out.push(diag("error", "audio_direction", `both ports only ${ta.direction === "out" ? "send" : "receive"} audio`, a, b));
  return out;
}

function dvp(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "dvp") || !speaks(b, "dvp")) return [];
  const cam = rolesOf(a, "dvp").has("camera") ? a : rolesOf(b, "dvp").has("camera") ? b : undefined;
  if (!cam) return [];
  const host = cam === a ? b : a;
  const [wc, wh] = [range(cam, "bus_width")?.[1], range(host, "bus_width")?.[1]];
  if (wc === undefined || wh === undefined || wc === wh) return [];
  return wh < wc
    ? [diag("warning", "dvp_width", `an ${wh}-bit host takes the upper ${wh} of the camera's ${wc} data bits (D${wc - 1}..D${wc - wh})`, a, b)]
    : [diag("info", "dvp_width", `the camera's ${wc} data bits land on the host's upper bits; D${wh - wc - 1}..D0 of the host are unused`, a, b)];
}

function sd(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const [ta, tb] = [trait(a, "sd_card"), trait(b, "sd_card")];
  if (!ta || !tb) return [];
  const out: Diagnostic[] = [];
  if (ta.form && tb.form && ta.form !== tb.form) out.push(diag("error", "sd_form", `a ${ta.form} ${[...rolesOf(a, "sd_card")][0]} against a ${tb.form} ${[...rolesOf(b, "sd_card")][0]}`, a, b));
  if (!common(ta.modes, tb.modes).length) out.push(diag("error", "sd_mode", `no bus mode in common (${list(ta.modes).join(", ")} against ${list(tb.modes).join(", ")})`, a, b));
  const hostSide = rolesOf(a, "sd_card").has("host") ? ta : rolesOf(b, "sd_card").has("host") ? tb : undefined;
  const cardSide = hostSide === ta ? tb : ta;
  if (hostSide?.capacity_classes && cardSide.capacity_classes && !common(hostSide.capacity_classes, cardSide.capacity_classes).length) {
    out.push(diag("error", "sd_capacity", `the host reads ${list(hostSide.capacity_classes).join(", ").toUpperCase()} cards, not ${list(cardSide.capacity_classes).join(", ").toUpperCase()}`, a, b));
  }
  return out;
}

function ledDrive(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "led_drive") || !speaks(b, "led_drive")) return [];
  const isLed = (x: InterfaceDef) => [...rolesOf(x, "led_drive")].some((r) => r === "anode" || r === "cathode");
  const led = isLed(a) ? a : isLed(b) ? b : undefined;
  if (!led) return [];
  const driver = led === a ? b : a;
  const [max, set] = [range(led, "led_current")?.[1], range(driver, "led_current")];
  if (max === undefined || !set || set[0] > max) return []; // disjoint: the overlap check reports it
  return set[1] > max ? [diag("warning", "led_drive_current", `the driver can be set up to ${set[1]} mA, above the LED's ${max} mA maximum: set it at or below ${max} mA`, a, b)] : [];
}

const USB_ORDER = ["low", "full", "high", "super", "super_plus", "super_plus_2x2", "usb4"];

function usb(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const [ta, tb] = [trait(a, "usb"), trait(b, "usb")];
  if (!ta || !tb) return [];
  const shared = common(ta.speeds, tb.speeds).sort((x, y) => USB_ORDER.indexOf(y) - USB_ORDER.indexOf(x));
  if (!shared.length) return [diag("error", "usb_speed", `no speed in common (${list(ta.speeds).join(", ")} against ${list(tb.speeds).join(", ")})`, a, b)];
  const top = Math.max(...[...list(ta.speeds), ...list(tb.speeds)].map((s) => USB_ORDER.indexOf(s)));
  return USB_ORDER.indexOf(shared[0]!) < top ? [diag("info", "usb_speed", `the ports run at ${shared[0]!.replace(/_/g, " ")} speed`, a, b)] : [];
}

// ---------------------------------------------------------------------------
// Wireless
// ---------------------------------------------------------------------------

function wireless(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  const [wa, wb] = [trait(a, "wireless"), trait(b, "wireless")];
  if (!wa || !wb || wa.standard !== wb.standard) return [];
  const out: Diagnostic[] = [];
  if (!common(wa.bands, wb.bands).length) out.push(diag("error", "wireless_band", `no band in common (${list(wa.bands).join(", ")} against ${list(wb.bands).join(", ")})`, a, b));
  if ((wa.standard === "bluetooth" || wa.standard === "ieee802154") && !common(wa.stacks, wb.stacks).length) {
    out.push(diag("error", "wireless_stack", `nothing in common to speak (${list(wa.stacks).join(", ")} against ${list(wb.stacks).join(", ")})`, a, b));
  }
  if (wa.standard === "ieee802154" && common(wa.stacks, wb.stacks).includes("zigbee")) {
    const endOnly = (w: Record<string, unknown>) => list(w.zigbee_roles).length > 0 && list(w.zigbee_roles).every((r) => r === "end_device");
    if (endOnly(wa) && endOnly(wb)) out.push(diag("warning", "zigbee_roles", "two Zigbee end devices do not talk directly: the network needs a coordinator (and routers)", a, b));
  }
  return out;
}
