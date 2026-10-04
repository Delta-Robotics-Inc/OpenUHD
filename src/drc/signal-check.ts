import type { InterfaceDef } from "../types/interface.js";
import type { Diagnostic } from "./types.js";
import { getEffectiveRange } from "../parameters/range.js";

/**
 * Pair checks for serial links, IR remotes, AC mains and coils (PB-866;
 * `protocols/serial.ts`, `protocols/actuation.ts`):
 *
 * - `rs485_duplex` (error): a half-duplex port against a full-duplex one.
 * - `rs232_null_modem` (warning): two DTEs or two DCEs: the link needs a
 *   null-modem (crossover) cable.
 * - `ppm_channels` (warning): an input that decodes fewer channels than the
 *   output sends drops the rest. `ppm_polarity` (error): positive pulses
 *   into an input that takes only negative ones, or the reverse.
 * - `ir_link`: a carrier outside the receiver's band (a warning within 10 %,
 *   where range drops; an error beyond); an emitter wavelength outside the
 *   receiver's band (warning); no coding protocol in common (error).
 * - `ac_power`: a plug that does not go into the socket (IEC 60320 and NEMA
 *   pairs; error); an input that needs protective earth on an outlet
 *   without one (error).
 * - `inductive_load`: a coil that draws more than the channel is rated for
 *   (error); nothing that clamps the turn-off spike (warning, or info when
 *   the channel does not say); a polarised coil on a channel that reverses
 *   (warning).
 */
export function checkPairSignals(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  return [...rs485(a, b), ...rs232(a, b), ...ppm(a, b), ...irLink(a, b), ...acPower(a, b), ...inductive(a, b)];
}

const SIGNAL_CHECKED: Record<string, string[]> = {
  ppm: ["channel_count"],
  ir_remote: ["ir_carrier", "wavelength"],
  inductive_load: ["coil_current", "coil_resistance"],
};

/** Parameters `checkPairSignals` compares itself for this pair, which the overlap check skips. */
export function signalCheckedParams(a: InterfaceDef, b: InterfaceDef): Set<string> {
  for (const [protocol, ids] of Object.entries(SIGNAL_CHECKED)) if (speaks(a, protocol) && speaks(b, protocol)) return new Set(ids);
  return new Set();
}

const speaks = (iface: InterfaceDef, type: string) => iface.protocols.some((p) => p.type === type);
const rolesOf = (iface: InterfaceDef, type: string) => new Set(iface.protocols.filter((p) => p.type === type).flatMap((p) => p.roles));
const trait = (iface: InterfaceDef, type: string): Record<string, unknown> => (iface.traits?.find((t) => t.type === type)?.params as Record<string, unknown>) ?? {};
const range = (iface: InterfaceDef, id: string): [number, number] | undefined => {
  const p = iface.parameters?.find((x) => x.id === id);
  return (p && getEffectiveRange(p)) ?? undefined;
};
const fmt = (v: number) => `${+v.toFixed(3)}`;
const fmtR = (r: [number, number]) => (Math.abs(r[1] - r[0]) <= 1e-9 ? fmt(r[0]) : `${fmt(r[0])}–${fmt(r[1])}`);
const diag = (severity: Diagnostic["severity"], code: string, message: string, a: InterfaceDef, b: InterfaceDef): Diagnostic => ({ severity, code, message, refs: [a.id, b.id] });
const pick = (a: InterfaceDef, b: InterfaceDef, type: string, role: string): [InterfaceDef, InterfaceDef] | undefined =>
  rolesOf(a, type).has(role) ? [a, b] : rolesOf(b, type).has(role) ? [b, a] : undefined;

function rs485(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "rs485") || !speaks(b, "rs485")) return [];
  const [da, db] = [trait(a, "rs485").duplex ?? "half", trait(b, "rs485").duplex ?? "half"];
  return da === db ? [] : [diag("error", "rs485_duplex", `a ${da}-duplex RS-485 port does not link with a ${db}-duplex one without an adapter`, a, b)];
}

function rs232(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "rs232") || !speaks(b, "rs232")) return [];
  const ra = rolesOf(a, "rs232");
  const rb = rolesOf(b, "rs232");
  const both = (r: string) => ra.has(r) && rb.has(r) && ra.size === 1 && rb.size === 1;
  if (both("dte") || both("dce")) {
    const r = [...ra][0].toUpperCase();
    return [diag("warning", "rs232_null_modem", `two ${r}s: the link needs a null-modem cable (TXD to RXD, RTS to CTS, DTR to DSR crossed)`, a, b)];
  }
  return [];
}

function ppm(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "ppm") || !speaks(b, "ppm")) return [];
  const p = pick(a, b, "ppm", "output");
  if (!p) return [];
  const [out, inp] = p;
  const res: Diagnostic[] = [];
  const [co, ci] = [range(out, "channel_count"), range(inp, "channel_count")];
  if (co && ci && co[1] > ci[1]) res.push(diag("warning", "ppm_channels", `the output sends ${fmt(co[1])} channels; the input decodes ${fmt(ci[1])}, so the last ${fmt(co[1] - ci[1])} are lost`, out, inp));
  const [po, pi] = [trait(out, "ppm").polarity, trait(inp, "ppm").polarity];
  if (po !== undefined && pi !== undefined && po !== "either" && pi !== "either" && po !== pi) res.push(diag("error", "ppm_polarity", `${po} pulses into an input that takes ${pi} pulses (an inverter between them fixes it)`, out, inp));
  return res;
}

function irLink(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "ir_remote") || !speaks(b, "ir_remote")) return [];
  const p = pick(a, b, "ir_remote", "transmitter");
  if (!p || !rolesOf(p[1], "ir_remote").has("receiver")) return [];
  const [tx, rx] = p;
  const out: Diagnostic[] = [];
  const [ct, cr] = [range(tx, "ir_carrier"), range(rx, "ir_carrier")];
  if (ct && cr) {
    const f = (ct[0] + ct[1]) / 2;
    const off = f < cr[0] ? (cr[0] - f) / cr[0] : f > cr[1] ? (f - cr[1]) / cr[1] : 0;
    if (off > 0.1) out.push(diag("error", "ir_link", `a ${fmtR(ct)} kHz carrier is outside the receiver's ${fmtR(cr)} kHz band`, tx, rx));
    else if (off > 0.005) out.push(diag("warning", "ir_link", `a ${fmtR(ct)} kHz carrier is ${fmt(off * 100)} % off the receiver's ${fmtR(cr)} kHz band: it works at a shorter range`, tx, rx));
  }
  const [wt, wr] = [range(tx, "wavelength"), range(rx, "wavelength")];
  if (wt && wr && wr[1] > wr[0] && (wt[1] < wr[0] || wt[0] > wr[1])) out.push(diag("warning", "ir_link", `the ${fmtR(wt)} nm emitter is outside the receiver's ${fmtR(wr)} nm band`, tx, rx));
  const [pt, pr] = [trait(tx, "ir_remote").protocols, trait(rx, "ir_remote").protocols];
  if (Array.isArray(pt) && Array.isArray(pr) && pt.length && pr.length) {
    const norm = (s: unknown) => String(s).replace(/[\s_-]/g, "").toLowerCase();
    if (!pt.some((x) => pr.map(norm).includes(norm(x)))) out.push(diag("error", "ir_link", `the transmitter codes ${pt.join(", ")}; the receiver decodes ${pr.join(", ")}`, tx, rx));
  }
  return out;
}

/** IEC 60320 inlets (male) and the connectors that go into them; NEMA receptacles and the plugs they take. */
const SOCKET_TAKES: Record<string, string[]> = {
  c2: ["c1"],
  c4: ["c3"],
  c6: ["c5"],
  c8: ["c7"],
  c14: ["c13", "c15"],
  c16: ["c15"],
  c18: ["c17"],
  c20: ["c19", "c21"],
  c22: ["c21"],
  "nema1-15r": ["nema1-15p"],
  "nema5-15r": ["nema1-15p", "nema5-15p"],
  "nema5-20r": ["nema1-15p", "nema5-15p", "nema5-20p"],
  "nema6-15r": ["nema6-15p"],
  "nema6-20r": ["nema6-15p", "nema6-20p"],
};
const normPlug = (s: unknown): string | undefined => {
  const t = String(s ?? "").toLowerCase().replace(/\s+/g, "");
  const iec = /(?:^|iec(?:60320)?-?)c(\d{1,2})(?![\d])/.exec(t);
  if (iec) return `c${iec[1]}`;
  const nema = /nema(\d{1,2}-\d{2}[pr])/.exec(t);
  return nema ? `nema${nema[1]}` : undefined;
};
const isSocket = (k: string) => k in SOCKET_TAKES;
const fits = (x: string, y: string) => (SOCKET_TAKES[x] ?? []).includes(y) || (SOCKET_TAKES[y] ?? []).includes(x);

function acPower(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "ac_power") || !speaks(b, "ac_power")) return [];
  const out: Diagnostic[] = [];
  const [ta, tb] = [trait(a, "ac_power"), trait(b, "ac_power")];
  const [pa, pb] = [normPlug(ta.plug), normPlug(tb.plug)];
  // a cord's two ends are compared against what they plug into: both ends known and neither takes the other
  if (pa && pb && (isSocket(pa) || isSocket(pb)) && !fits(pa, pb)) out.push(diag("error", "ac_power", `a ${ta.plug} does not mate with a ${tb.plug}`, a, b));
  const p = pick(a, b, "ac_power", "input");
  if (p) {
    const [inp, src] = p;
    if (trait(inp, "ac_power").earth === true && trait(src, "ac_power").earth === false) out.push(diag("error", "ac_power", "the input needs protective earth; the outlet has none", inp, src));
  }
  return out;
}

function inductive(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "inductive_load") || !speaks(b, "inductive_load")) return [];
  const p = pick(a, b, "inductive_load", "driver");
  if (!p || !rolesOf(p[1], "inductive_load").has("load")) return [];
  const [drv, load] = p;
  const out: Diagnostic[] = [];
  const [cur, max] = [range(load, "coil_current"), range(drv, "max_current")];
  if (cur && max && cur[1] > max[1] + 1e-9) out.push(diag("error", "inductive_load", `the coil draws ${fmt(cur[1])} A; the channel is rated for ${fmt(max[1])} A`, drv, load));
  const [td, tl] = [trait(drv, "inductive_drive"), trait(load, "inductive_load")];
  const loadClamps = tl.suppression !== undefined && tl.suppression !== "none";
  if (!loadClamps && tl.suppression === "none" && td.flyback === "none") out.push(diag("warning", "inductive_load", "neither the coil nor the channel has a flyback diode or clamp: add one across the coil", drv, load));
  else if (!loadClamps && td.flyback === undefined && td.switching !== "relay") out.push(diag("info", "inductive_load", "the channel does not say whether it clamps the coil's turn-off spike", drv, load));
  if (tl.polarized === true && td.switching === "h_bridge") out.push(diag("warning", "inductive_load", "the channel can reverse the coil, whose suppression is polarised: drive it one way only", drv, load));
  return out;
}
