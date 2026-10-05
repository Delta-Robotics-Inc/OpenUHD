import type { InterfaceDef, ProtocolDef, SlotDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { DIGITAL_IN, DIGITAL_IO, DIGITAL_OUT, linkSlots, type LinkSignal } from "./link.js";
import { baudRate, bitRateBps, channelCount, frameRateHz, voltageRangeV, voltageV } from "./params.js";
import type { SignalRef } from "./signal.js";

/**
 * Serial links beyond logic-level UART: RS-485, RS-232, SWD and
 * PPM. Each is a composite whose slots carry a sub-role per conductor
 * (`link.ts`), so two ports pair conductor by conductor. Pins are optional:
 * a port without them is a logical port (a connector on a controller whose
 * pinout is not modelled) and pairs as a whole.
 */

const volts = (v: number | [number, number]): Parameter => (Array.isArray(v) ? voltageRangeV(v[0], v[1]) : voltageV(v));

const composite = (
  id: string,
  name: string,
  protocol: string,
  role: string,
  capabilities: string[],
  parameters: Parameter[],
  slots: SlotDef[],
  bindings: Record<string, string>,
  traitParams: Record<string, unknown>,
  extra: { exposed?: boolean; defaultActive?: boolean; label?: string },
): InterfaceDef => {
  const params = Object.fromEntries(Object.entries(traitParams).filter(([, v]) => v !== undefined));
  return {
    id,
    name,
    domain: "electrical",
    exposed: extra.exposed ?? true,
    default_active: extra.defaultActive ?? true,
    protocols: [{ type: protocol, roles: [role] }],
    capabilities,
    ...(parameters.length ? { parameters } : {}),
    ...(slots.length ? { slots, profiles: [{ id: `${id}_default`, label: extra.label ?? name, default_active: true, bindings }] } : {}),
    ...(Object.keys(params).length ? { traits: [{ type: protocol, params }] } : {}),
  };
};

const groundSlot = (signals: LinkSignal[], ground?: string) => {
  if (ground !== undefined) signals.push({ slot: "ground", label: "GND", ref: ground, leaf: [], capability: "ground", role: "ground", required: false });
};

// ---------------------------------------------------------------------------
// RS-485
// ---------------------------------------------------------------------------

export interface RS485Config {
  /** Interface id. Defaults to "rs485". */
  id?: string;
  name?: string;
  /** "half": one pair, A/B, shared by every node. "full": a driver pair Y/Z (TX+/TX−) and a receiver pair A/B (RX+/RX−). Default "half". */
  duplex?: "half" | "full";
  /**
   * Half duplex: the bus pair. Full duplex: the receiver pair. Manufacturers
   * disagree on which line is "A" (TIA-485 names A the inverting line; many
   * transceivers label A the non-inverting one): follow the part's own
   * labels, and say which in `note`.
   */
  a?: SignalRef;
  b?: SignalRef;
  /** Full duplex: the driver pair, Y (non-inverting) and Z. */
  y?: SignalRef;
  z?: SignalRef;
  /** Ground or common-mode reference leaf id, where the connector carries one. */
  ground?: string;
  /** Bit rate in bit/s: fixed or [min, max]. */
  bitRateBps?: number | [number, number];
  /** Termination on this node: always on, switchable (jumper or software), or none. A bus needs 120 Ω at each end. */
  termination?: "built_in" | "switchable" | "none";
  /** The node biases the idle bus (fail-safe resistors). */
  failSafeBias?: boolean;
  /** Protocol carried, as the source names it ("Modbus RTU", "DMX512", a vendor's expansion bus). */
  carries?: string;
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * An RS-485 port: protocol `rs485`, role `node` (every node pairs with every
 * other), slots `a`/`b` (half duplex) or `tx_p`/`tx_n` and `rx_p`/`rx_n`
 * (full duplex: one side's driver pair to the other's receiver pair), and
 * an optional ground. A half-duplex port does not pair conductor by
 * conductor with a full-duplex one: `rs485_duplex` says so.
 */
export function RS485(config: RS485Config): InterfaceDef[] {
  const id = config.id ?? "rs485";
  const duplex = config.duplex ?? "half";
  const fail = (why: string): never => {
    throw new Error(`RS485 ${id}: ${why}`);
  };
  if (duplex === "half" && (config.y !== undefined || config.z !== undefined)) fail("Y and Z are the driver pair of a full-duplex port");
  if ((config.a === undefined) !== (config.b === undefined) || (config.y === undefined) !== (config.z === undefined)) fail("give both lines of a pair");
  if (duplex === "full" && (config.a === undefined) !== (config.y === undefined)) fail("a full-duplex port with pins gives both pairs (A/B and Y/Z)");
  const leaf: ProtocolDef[] = [{ type: "rs485_signal", roles: ["line"] }];
  const signals: LinkSignal[] = [];
  if (duplex === "half" && config.a !== undefined) {
    signals.push({ slot: "a", label: "A", ref: config.a, leaf, capability: "rs485_a", role: "a", required: true });
    signals.push({ slot: "b", label: "B", ref: config.b!, leaf, capability: "rs485_b", role: "b", required: true });
  }
  if (duplex === "full" && config.a !== undefined) {
    signals.push({ slot: "tx_p", label: "Y", ref: config.y!, leaf, capability: "rs485_y", role: "tx_p", required: true });
    signals.push({ slot: "tx_n", label: "Z", ref: config.z!, leaf, capability: "rs485_z", role: "tx_n", required: true });
    signals.push({ slot: "rx_p", label: "A", ref: config.a, leaf, capability: "rs485_a", role: "rx_p", required: true });
    signals.push({ slot: "rx_n", label: "B", ref: config.b!, leaf, capability: "rs485_b", role: "rx_n", required: true });
  }
  groundSlot(signals, config.ground);
  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "rs485", signals, generated);
  const parameters: Parameter[] = config.bitRateBps !== undefined ? [bitRateBps(config.bitRateBps)] : [];
  return [
    ...generated,
    composite(id, config.name ?? `RS-485 (${duplex} duplex)`, "rs485", "node", ["rs485", `rs485_${duplex}_duplex`], parameters, slots, bindings,
      { duplex, termination: config.termination, fail_safe_bias: config.failSafeBias, carries: config.carries, note: config.note }, config),
  ];
}

// ---------------------------------------------------------------------------
// RS-232
// ---------------------------------------------------------------------------

/** RS-232 signals named from the DTE (a computer's port): what each side drives. */
const RS232_DTE_DRIVES = new Set(["txd", "rts", "dtr"]);
const RS232_LABEL: Record<string, string> = { txd: "TXD", rxd: "RXD", rts: "RTS", cts: "CTS", dtr: "DTR", dsr: "DSR", dcd: "DCD", ri: "RI" };

export interface RS232Config {
  /** Interface id. Defaults to "rs232". */
  id?: string;
  name?: string;
  /**
   * "dte": data terminal equipment (a computer, a controller's serial
   * port): it sends on TXD. "dce": data communication equipment (a modem, a
   * device with a DB9 female): it receives on TXD. Signals are named from the
   * DTE's side on both, as the standard does.
   */
  role: "dte" | "dce";
  txd?: SignalRef;
  rxd?: SignalRef;
  rts?: SignalRef;
  cts?: SignalRef;
  dtr?: SignalRef;
  dsr?: SignalRef;
  dcd?: SignalRef;
  ri?: SignalRef;
  ground?: string;
  baudRate?: number | [number, number];
  /** Line levels the port drives or accepts, in V (±5 to ±15 under TIA-232). */
  levelsV?: [number, number];
  /** Connector as the source names it ("DB9 male", "RJ12", "4-pin JST"). */
  connector?: string;
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * An RS-232 port: protocol `rs232`, role `dte` or `dce`, with a slot per
 * signal (sub-role `<signal>_out` or `<signal>_in` by which side drives it).
 * A DTE and a DCE pair straight through (TXD to TXD); two DTEs or two DCEs
 * pair crossed (TXD to RXD, RTS to CTS, DTR to DSR), which takes a
 * null-modem cable: `rs232_null_modem` warns. RS-232 does not pair with a
 * logic-level UART (another protocol): that needs a level shifter (MAX3232).
 */
export function RS232(config: RS232Config): InterfaceDef[] {
  const id = config.id ?? "rs232";
  if ((config.txd === undefined) !== (config.rxd === undefined)) throw new Error(`RS232 ${id}: give TXD and RXD together`);
  const dte = config.role === "dte";
  const signals: LinkSignal[] = [];
  for (const s of ["txd", "rxd", "rts", "cts", "dtr", "dsr", "dcd", "ri"] as const) {
    const ref = config[s];
    if (ref === undefined) continue;
    const drives = RS232_DTE_DRIVES.has(s) === dte;
    signals.push({ slot: s, label: RS232_LABEL[s], ref, leaf: [{ type: "rs232_signal", roles: [drives ? "output" : "input"] }], capability: `rs232_${s}`, role: `${s}_${drives ? "out" : "in"}`, required: s === "txd" || s === "rxd" });
  }
  groundSlot(signals, config.ground);
  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "rs232", signals, generated);
  const parameters: Parameter[] = [];
  if (config.baudRate !== undefined) parameters.push(baudRate(config.baudRate));
  return [
    ...generated,
    composite(id, config.name ?? `RS-232 (${config.role.toUpperCase()})`, "rs232", config.role, ["rs232"], parameters, slots, bindings,
      { levels_v: config.levelsV, connector: config.connector, note: config.note }, config),
  ];
}

// ---------------------------------------------------------------------------
// SWD
// ---------------------------------------------------------------------------

export interface SWDConfig {
  /** Interface id. Defaults to "swd". */
  id?: string;
  name?: string;
  /** "target": the chip or board being debugged. "probe": the debugger (J-Link, ST-Link, a Pico probe). */
  role: "target" | "probe";
  swdio?: SignalRef;
  swclk?: SignalRef;
  /** Trace output (SWO), from the target. */
  swo?: SignalRef;
  /** Reset (nRESET), from the probe. */
  nreset?: SignalRef;
  /** The target's reference voltage pin (VTref), which the probe senses. */
  vtref?: SignalRef;
  ground?: string;
  /** Logic level, for the leaves declared inline (a probe states the range it adapts to). */
  voltageV?: number | [number, number];
  /** Connector as the source names it ("Cortex Debug 10-pin 1.27 mm", "Tag-Connect TC2030", "pads"). */
  connector?: string;
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * An Arm Serial Wire Debug port: protocol `swd`, role `target` or `probe`,
 * slots `swdio`, `swclk` (probe out, target in), optional `swo` (target
 * out), `nreset` (probe out), `vtref` (target out, the probe senses it) and
 * ground. The voltage the leaves state is compared as a parameter.
 */
export function SWD(config: SWDConfig): InterfaceDef[] {
  const id = config.id ?? "swd";
  const probe = config.role === "probe";
  if ((config.swdio === undefined) !== (config.swclk === undefined)) throw new Error(`SWD ${id}: give SWDIO and SWCLK together`);
  const signals: LinkSignal[] = [];
  const add = (slot: string, label: string, ref: SignalRef | undefined, probeDrives: boolean | "both", required: boolean) => {
    if (ref === undefined) return;
    const drives = probeDrives === "both" ? undefined : probeDrives === probe;
    signals.push({ slot, label, ref, leaf: drives === undefined ? DIGITAL_IO : drives ? DIGITAL_OUT : DIGITAL_IN, capability: `swd_${slot}`, role: drives === undefined ? slot : `${slot}_${drives ? "out" : "in"}`, required });
  };
  add("swdio", "SWDIO", config.swdio, "both", true);
  add("swclk", "SWCLK", config.swclk, true, true);
  add("swo", "SWO", config.swo, false, false);
  add("nreset", "nRESET", config.nreset, true, false);
  if (config.vtref !== undefined) {
    signals.push({ slot: "vtref", label: "VTref", ref: config.vtref, leaf: [{ type: "power", roles: [probe ? "input" : "output"] }], capability: "swd_vtref", role: `vtref_${probe ? "in" : "out"}`, required: false });
  }
  groundSlot(signals, config.ground);
  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "swd", signals, generated, config.voltageV);
  const parameters: Parameter[] = config.voltageV !== undefined ? [volts(config.voltageV)] : [];
  return [...generated, composite(id, config.name ?? `SWD (${config.role})`, "swd", config.role, ["swd"], parameters, slots, bindings, { connector: config.connector, note: config.note }, config)];
}

// ---------------------------------------------------------------------------
// PPM
// ---------------------------------------------------------------------------

export interface PPMConfig {
  /** Interface id. Defaults to "ppm". */
  id?: string;
  name?: string;
  /** "output": a receiver's or trainer port's PPM stream. "input": a flight controller's or trainer input that decodes it. */
  role: "output" | "input";
  signal?: SignalRef;
  /** Channels in the frame: an output states how many it sends; an input the range it decodes ([1, 16]). */
  channels?: number | [number, number];
  /** Frame rate in Hz (a 22.5 ms frame is 44.4 Hz). */
  frameRateHz?: number | [number, number];
  /** Pulse polarity: "positive" (high pulses), "negative" (inverted), or "either" (an input that detects it). */
  polarity?: "positive" | "negative" | "either";
  voltageV?: number | [number, number];
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * Pulse-position modulation (CPPM), several RC channels on one wire:
 * protocol `ppm`, role `output` or `input`, one `signal` slot. The pair
 * check compares the channel counts (`ppm_channels`: an input that decodes
 * fewer channels than the output sends drops the rest) and the polarities
 * (`ppm_polarity`).
 */
export function PPM(config: PPMConfig): InterfaceDef[] {
  const id = config.id ?? "ppm";
  const out = config.role === "output";
  const signals: LinkSignal[] = [];
  if (config.signal !== undefined) {
    signals.push({ slot: "signal", label: "PPM", ref: config.signal, leaf: out ? DIGITAL_OUT : DIGITAL_IN, capability: "ppm", role: out ? "signal_out" : "signal_in", required: true });
  }
  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "ppm", signals, generated, config.voltageV);
  const parameters: Parameter[] = [];
  if (config.channels !== undefined) parameters.push(channelCount(config.channels));
  if (config.frameRateHz !== undefined) parameters.push(frameRateHz(config.frameRateHz));
  if (config.voltageV !== undefined) parameters.push(volts(config.voltageV));
  return [...generated, composite(id, config.name ?? `PPM ${config.role}`, "ppm", config.role, ["ppm"], parameters, slots, bindings, { polarity: config.polarity, note: config.note }, config)];
}
