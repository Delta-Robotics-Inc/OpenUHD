import type { InterfaceDef, ProtocolDef, SlotDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { linkSlots, type LinkSignal } from "./link.js";
import {
  coilCurrentA,
  coilResistanceOhm,
  irCarrierKHz,
  lineFrequencyHz,
  maxCurrentA,
  minSupplyPowerW,
  voltageRangeV,
  voltageV,
  wavelengthNm,
} from "./params.js";
import type { SignalRef } from "./signal.js";

/**
 * Infrared remote links, AC mains power, and switched inductive loads
 * (PB-866).
 */

const volts = (v: number | [number, number]): Parameter => (Array.isArray(v) ? voltageRangeV(v[0], v[1]) : voltageV(v));
const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// ---------------------------------------------------------------------------
// Infrared remote
// ---------------------------------------------------------------------------

export interface InfraredRemoteConfig {
  /** Interface id. Defaults to "ir". */
  id?: string;
  name?: string;
  /** "transmitter": a remote control or an IR LED driver. "receiver": a demodulating IR receiver (VS1838B, TSOP382). */
  role: "transmitter" | "receiver";
  /** Carrier frequency in kHz: what a transmitter sends, or the band a receiver passes ([36, 40] or its centre). */
  carrierKHz: number | [number, number];
  /** Coding protocols as the source names them ("NEC", "RC5", "Sony SIRC"). A demodulating receiver decodes none itself: leave it out. */
  protocols?: string[];
  /** Emitter peak wavelength, or a receiver's sensitive band [min, max], in nm. */
  wavelengthNm?: number | [number, number];
  /** Range the source states, in m. */
  rangeM?: number;
  /** The leaf that carries the demodulated output or the drive input, when the part has one (for the record). */
  electrical?: string;
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * An infrared remote-control link (network domain, like the radios):
 * protocol `ir_remote`, role `transmitter` or `receiver`, with `ir_carrier`
 * (kHz) and `wavelength` (nm). The pair check `ir_link` compares the carrier
 * with the receiver's band (a few percent off shortens the range; further
 * off it does not work), the emitter's wavelength with the receiver's band,
 * and the coding protocols when both state them.
 */
export function InfraredRemote(config: InfraredRemoteConfig): InterfaceDef {
  const id = config.id ?? "ir";
  const parameters: Parameter[] = [irCarrierKHz(config.carrierKHz)];
  if (config.wavelengthNm !== undefined) {
    parameters.push(Array.isArray(config.wavelengthNm) ? { id: "wavelength", unit: "nm", range: config.wavelengthNm } : wavelengthNm(config.wavelengthNm));
  }
  const params = clean({ protocols: config.protocols, range_m: config.rangeM, electrical: config.electrical, note: config.note });
  return {
    id,
    name: config.name ?? `IR remote ${config.role}`,
    domain: "network",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "ir_remote", roles: [config.role] }],
    capabilities: ["ir_remote", config.role === "transmitter" ? "ir_transmit" : "ir_receive"],
    parameters,
    ...(Object.keys(params).length ? { traits: [{ type: "ir_remote", params }] } : {}),
  };
}

// ---------------------------------------------------------------------------
// AC mains
// ---------------------------------------------------------------------------

export interface AcPowerConfig {
  /** Interface id. Defaults to "ac_in" (input) or "ac_out" (output). */
  id?: string;
  name?: string;
  /** "input": a mains inlet or a plug on a cord. "output": an outlet, a socket strip, a PDU or UPS output. */
  role: "input" | "output";
  /** RMS voltage: an input's accepted range ([100, 240]), an outlet's nominal (120) or range. */
  voltageV: number | [number, number];
  /** Line frequency in Hz: [50, 60], 60, [47, 63]. Left out when the source states none (then not compared). */
  frequencyHz?: number | [number, number];
  /** Output: rated current in A. Input: the most it draws, as `maxCurrentA` too (the rating on its label). */
  maxCurrentA?: number;
  /** Input: rated input power in W (the supply budget counts it). */
  powerW?: number;
  /** Single or three phase (default 1). */
  phases?: 1 | 3;
  /** Has a protective earth conductor (class I). An input that needs earth on an outlet without it: `ac_earth`. */
  earth?: boolean;
  /** Plug, inlet or socket type ("IEC 60320 C14", "C13", "NEMA 5-15P", "NEMA 5-15R", "CEE 7/7"). */
  plug?: string;
  /** The live, neutral and earth terminals, where the part's pinout is modelled. */
  line?: SignalRef;
  neutral?: SignalRef;
  protectiveEarth?: SignalRef;
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * AC mains power: protocol `ac_power`, role `input` or `output`, with
 * `voltage` (V RMS), `line_frequency` (Hz) and `max_current`; distinct from
 * DC `power`, so a mains inlet never pairs with a DC rail. Voltage and
 * frequency are compared as parameters; `ac_power` checks the plug and
 * socket types (IEC 60320 and NEMA pairs) and protective earth.
 */
export function AcPower(config: AcPowerConfig): InterfaceDef[] {
  const id = config.id ?? (config.role === "input" ? "ac_in" : "ac_out");
  const leaf: ProtocolDef[] = [{ type: "ac_terminal", roles: ["terminal"] }];
  const signals: LinkSignal[] = [];
  const t = (slot: string, label: string, ref: SignalRef | undefined, required: boolean) => ref !== undefined && signals.push({ slot, label, ref, leaf, capability: `ac_${slot}`, role: slot, required });
  t("line", "L", config.line, true);
  t("neutral", "N", config.neutral, true);
  t("earth", "PE", config.protectiveEarth, false);
  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "ac_power", signals, generated);
  const parameters: Parameter[] = [volts(config.voltageV)];
  if (config.frequencyHz !== undefined) parameters.push(lineFrequencyHz(config.frequencyHz));
  if (config.maxCurrentA !== undefined) parameters.push(maxCurrentA(config.maxCurrentA));
  if (config.powerW !== undefined) {
    if (config.role !== "input") throw new Error(`AcPower ${id}: powerW is an input's rating`);
    parameters.push(minSupplyPowerW(config.powerW));
  }
  const params = clean({ phases: config.phases ?? 1, earth: config.earth, plug: config.plug, note: config.note });
  return [
    ...generated,
    {
      id,
      name: config.name ?? `AC mains ${config.role}`,
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "ac_power", roles: [config.role] }],
      capabilities: ["ac_power", config.role === "input" ? "ac_mains_in" : "ac_mains_out"],
      parameters,
      ...(slots.length ? { slots: slots as SlotDef[], profiles: [{ id: `${id}_default`, label: "L / N / PE", default_active: true, bindings }] } : {}),
      traits: [{ type: "ac_power", params }],
    },
  ];
}

// ---------------------------------------------------------------------------
// Switched inductive loads
// ---------------------------------------------------------------------------

/**
 * A coil or drive terminal: a pin (an inline `SignalSpec` or an existing
 * leaf id), or a lead or screw terminal with no designator (`{ id, name }`:
 * a flying lead, a junction-box terminal the source does not number).
 */
export type CoilTerminal = SignalRef | { id?: string; name?: string; pin?: undefined };

/** Resolve a terminal with no designator to a generated leaf; pass pins through to `linkSlots`. */
function terminalRef(t: CoilTerminal, fallbackId: string, fallbackName: string, capability: string, leaf: ProtocolDef[], generated: InterfaceDef[]): SignalRef {
  if (typeof t === "string" || t.pin !== undefined) return t as SignalRef;
  const id = t.id ?? fallbackId;
  generated.push({ id, name: t.name ?? fallbackName, domain: "electrical", exposed: true, default_active: true, protocols: leaf, capabilities: [capability] });
  return id;
}

/** What the coil drives. */
export type CoilKind = "solenoid" | "valve" | "brake" | "clutch" | "relay_coil" | "contactor" | "other";

export interface InductiveLoadConfig {
  /** Interface id. Defaults to "coil". */
  id?: string;
  name?: string;
  kind: CoilKind;
  /** Coil terminals, where they are modelled: pins (a DIN connector's), or leads and terminals with no designator (`{ id, name }`). */
  plus?: CoilTerminal;
  minus?: CoilTerminal;
  /** Rated coil voltage (DC), or the range it operates on. */
  ratedVoltageV: number | [number, number];
  /** Coil current at the rated voltage in A. Derived from `coilResistanceOhm` when only that is given. */
  coilCurrentA?: number;
  coilResistanceOhm?: number;
  /** Coil power in W, as the source states it. */
  powerW?: number;
  /** Suppression built into the coil or its connector: none, a diode, a TVS, a zener and diode, an RC snubber, an LED and diode in the connector, or a protective circuit of a type the source does not state (`built_in`). */
  suppression?: "none" | "diode" | "tvs" | "zener_diode" | "rc" | "led_diode" | "built_in";
  /** The coil must not be reversed (its diode or LED is polarised). */
  polarized?: boolean;
  /** Duty rating as the source states it ("100% ED", "continuous", "25% at 12 V"). */
  duty?: string;
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A switched inductive load (a solenoid, a pneumatic valve coil, a brake or
 * clutch): protocol `inductive_load`, role `load`, with `voltage`,
 * `coil_current` and `coil_resistance`, slots `coil_plus` and `coil_minus`.
 * It pairs with an `InductiveDrive` channel; the pair check
 * `inductive_load` compares the coil current with the channel's rating,
 * looks for something that clamps the turn-off spike, and warns when a
 * channel that reverses polarity drives a polarised coil.
 */
export function InductiveLoad(config: InductiveLoadConfig): InterfaceDef[] {
  const id = config.id ?? "coil";
  if ((config.plus === undefined) !== (config.minus === undefined)) throw new Error(`InductiveLoad ${id}: give both terminals`);
  const leaf: ProtocolDef[] = [{ type: "inductive_terminal", roles: ["terminal"] }];
  const signals: LinkSignal[] = [];
  const generated: InterfaceDef[] = [];
  if (config.plus !== undefined) {
    const plus = terminalRef(config.plus, `${id}_coil_plus`, "Coil +", "coil_plus", leaf, generated);
    const minus = terminalRef(config.minus!, `${id}_coil_minus`, "Coil -", "coil_minus", leaf, generated);
    signals.push({ slot: "coil_plus", label: "+", ref: plus, leaf, capability: "coil_plus", role: "coil_plus", required: true });
    signals.push({ slot: "coil_minus", label: "-", ref: minus, leaf, capability: "coil_minus", role: "coil_minus", required: true });
  }
  const { slots, bindings } = linkSlots(id, "inductive_load", signals, generated);
  const rated = Array.isArray(config.ratedVoltageV) ? config.ratedVoltageV[1] : config.ratedVoltageV;
  const current = config.coilCurrentA ?? (config.coilResistanceOhm ? Number((rated / config.coilResistanceOhm).toFixed(4)) : undefined);
  const parameters: Parameter[] = [volts(config.ratedVoltageV)];
  if (current !== undefined) parameters.push(coilCurrentA(current));
  if (config.coilResistanceOhm !== undefined) parameters.push(coilResistanceOhm(config.coilResistanceOhm));
  const params = clean({ kind: config.kind, power_w: config.powerW, suppression: config.suppression, polarized: config.polarized, duty: config.duty, current_derived: config.coilCurrentA === undefined && current !== undefined ? true : undefined, note: config.note });
  return [
    ...generated,
    {
      id,
      name: config.name ?? `${config.kind.replace(/_/g, " ")} coil`,
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "inductive_load", roles: ["load"] }],
      capabilities: ["inductive_load", `${config.kind}_coil`],
      parameters,
      ...(slots.length ? { slots: slots as SlotDef[], profiles: [{ id: `${id}_default`, label: "+ / -", default_active: true, bindings }] } : {}),
      traits: [{ type: "inductive_load", params }],
    },
  ];
}

export interface InductiveDriveConfig {
  /** Interface id. Defaults to "drive". */
  id?: string;
  name?: string;
  /**
   * "low_side": the channel switches the coil's minus to ground, its plus on
   * the supply. "high_side": it switches the plus, the minus to ground.
   * "h_bridge": both ends driven, either polarity. "relay": a dry contact.
   */
  switching: "low_side" | "high_side" | "h_bridge" | "relay";
  /** The terminal that goes to the coil's plus, and the one to its minus, where the pinout is modelled. */
  toPlus?: SignalRef;
  toMinus?: SignalRef;
  /** Output voltage (the supply it switches), or the range it accepts for an external supply. */
  voltageV: number | [number, number];
  /** Rated continuous current per channel in A. */
  maxCurrentA: number;
  /** A freewheeling or clamp diode on the channel: "internal", or "none" (the coil or the wiring must clamp). */
  flyback?: "internal" | "none";
  /** The channel can PWM the coil (hold-current reduction). */
  pwm?: boolean;
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A channel that switches an inductive load (a pneumatic hub's solenoid
 * output, a valve driver, a relay or MOSFET output made for coils):
 * protocol `inductive_load`, role `driver`, with `voltage` and
 * `max_current`, slots `to_plus` and `to_minus`.
 */
export function InductiveDrive(config: InductiveDriveConfig): InterfaceDef[] {
  const id = config.id ?? "drive";
  if ((config.toPlus === undefined) !== (config.toMinus === undefined)) throw new Error(`InductiveDrive ${id}: give both terminals`);
  const leaf: ProtocolDef[] = [{ type: "inductive_terminal", roles: ["terminal"] }];
  const signals: LinkSignal[] = [];
  if (config.toPlus !== undefined) {
    signals.push({ slot: "to_plus", label: "+", ref: config.toPlus, leaf, capability: "drive_to_plus", role: "drive_plus", required: true });
    signals.push({ slot: "to_minus", label: "-", ref: config.toMinus!, leaf, capability: "drive_to_minus", role: "drive_minus", required: true });
  }
  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "inductive_load", signals, generated);
  const params = clean({ switching: config.switching, flyback: config.flyback, pwm: config.pwm, note: config.note });
  return [
    ...generated,
    {
      id,
      name: config.name ?? "Coil driver",
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "inductive_load", roles: ["driver"] }],
      capabilities: ["inductive_drive", `${config.switching}_switch`],
      parameters: [volts(config.voltageV), maxCurrentA(config.maxCurrentA)],
      ...(slots.length ? { slots: slots as SlotDef[], profiles: [{ id: `${id}_default`, label: "+ / -", default_active: true, bindings }] } : {}),
      traits: [{ type: "inductive_drive", params }],
    },
  ];
}
