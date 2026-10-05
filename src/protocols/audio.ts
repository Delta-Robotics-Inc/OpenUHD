import type { InterfaceDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { bitDepth, channelCount, sampleRateHz } from "./params.js";
import { DIGITAL_IN, DIGITAL_IO, DIGITAL_OUT, linkSlots, type LinkSignal } from "./link.js";
import type { SignalRef } from "./signal.js";

/**
 * Digital audio serial ports: I2S and its relatives (left- and
 * right-justified, TDM, PCM short and long frame, DSP modes).
 *
 * Protocol `i2s` for all of them; the trait `audio_port` lists the frame
 * formats the port speaks (`formats`), and the pair check refuses two ports
 * with none in common (`audio_format`). Roles are the clock roles:
 * `controller` drives BCLK and WS (LRCLK, FSYNC), `target` takes them; a
 * port that can be either lists both. Two controllers or two targets do not
 * pair.
 *
 * Data direction is separate from the clock role: `direction` "out" sends
 * audio (an MCU to a DAC or amplifier), "in" receives it (from a microphone
 * or ADC), "duplex" both. Slots pair BCLK and WS out to in, data out to
 * data in, and MCLK out to in. Two ports that both only send or both only
 * receive are refused (`audio_direction`). Sample rate, bit depth and
 * channel count are parameters and must overlap.
 *
 * PDM microphones are not I2S: they are not covered here.
 */

export type AudioFormat = "i2s" | "left_justified" | "right_justified" | "tdm" | "pcm_short_frame" | "pcm_long_frame" | "dsp_a" | "dsp_b";

export interface I2SConfig {
  /** Interface id. Defaults to "i2s" (or "pcm" from `PCM`). */
  id?: string;
  name?: string;
  /** Clock roles the port can take. */
  clockRole: "controller" | "target" | ("controller" | "target")[];
  /** Audio data direction from this port: "out" sends, "in" receives, "duplex" both. */
  direction: "out" | "in" | "duplex";
  /** Frame formats. Defaults to ["i2s"] (["pcm_short_frame", "pcm_long_frame"] from `PCM`). */
  formats?: AudioFormat[];
  sampleRateHz?: number | [number, number];
  bitDepth?: number | [number, number];
  /** Channels per frame (2 on I2S; slots on TDM). */
  channels?: number | [number, number];
  /** Bit clock (BCLK, SCK). */
  bclk?: SignalRef;
  /** Word select / frame sync (WS, LRCLK, FSYNC). */
  ws?: SignalRef;
  /** Serial data out of this port (SDOUT, DOUT, DIN on the far side). */
  dout?: SignalRef;
  /** Serial data into this port. */
  din?: SignalRef;
  /** Master clock, where the port has one. */
  mclk?: SignalRef;
  /** MCLK direction: "out" (this port generates it) or "in". Defaults to out on a controller, in on a target. */
  mclkDirection?: "out" | "in";
  voltageV?: number | [number, number];
  exposed?: boolean;
  defaultActive?: boolean;
}

function audioPort(config: I2SConfig, defaults: { id: string; formats: AudioFormat[]; label: string }): InterfaceDef[] {
  const id = config.id ?? defaults.id;
  const roles = Array.isArray(config.clockRole) ? config.clockRole : [config.clockRole];
  if (!roles.length) throw new Error(`${defaults.label} ${id}: give a clock role`);
  if (config.dout !== undefined && config.direction === "in") throw new Error(`${defaults.label} ${id}: a receive-only port has no data out`);
  if (config.din !== undefined && config.direction === "out") throw new Error(`${defaults.label} ${id}: a send-only port has no data in`);
  const formats = config.formats ?? defaults.formats;
  // a port that can take either clock role: its clock pins are bidirectional
  const clock = roles.length === 2 ? "io" : roles[0] === "controller" ? "out" : "in";
  const leafFor = (d: string) => (d === "out" ? DIGITAL_OUT : d === "in" ? DIGITAL_IN : DIGITAL_IO);
  const signals: LinkSignal[] = [];
  const add = (slot: string, label: string, ref: SignalRef | undefined, dir: string, required: boolean) => {
    if (ref !== undefined) signals.push({ slot, label, ref, leaf: leafFor(dir), capability: `i2s_${slot}`, role: `${slot}_${dir}`, required });
  };
  add("bclk", "BCLK", config.bclk, clock, true);
  add("ws", "WS", config.ws, clock, true);
  add("dout", "DOUT", config.dout, "out", config.direction === "out");
  add("din", "DIN", config.din, "in", config.direction === "in");
  add("mclk", "MCLK", config.mclk, config.mclkDirection ?? (clock === "in" ? "in" : "out"), false);

  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "i2s", signals, generated, config.voltageV);
  const parameters: Parameter[] = [];
  if (config.sampleRateHz !== undefined) parameters.push(sampleRateHz(config.sampleRateHz));
  if (config.bitDepth !== undefined) parameters.push(bitDepth(config.bitDepth));
  if (config.channels !== undefined) parameters.push(channelCount(config.channels));
  return [
    ...generated,
    {
      id,
      name: config.name ?? `${defaults.label} ${config.direction}`,
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "i2s", roles }],
      capabilities: ["i2s", ...formats.map((f) => `audio_${f}`)],
      ...(parameters.length ? { parameters } : {}),
      traits: [{ type: "audio_port", params: { direction: config.direction, formats } }],
      ...(slots.length ? { slots, profiles: [{ id: `${id}_default`, label: defaults.label, default_active: true, bindings }] } : {}),
    },
  ];
}

/** An I2S (or left/right-justified, TDM) port. */
export function I2S(config: I2SConfig): InterfaceDef[] {
  return audioPort(config, { id: "i2s", formats: ["i2s"], label: "I2S" });
}

/** A PCM port (short or long frame sync): the same protocol as I2S with PCM formats by default. */
export function PCM(config: I2SConfig): InterfaceDef[] {
  return audioPort(config, { id: "pcm", formats: ["pcm_short_frame", "pcm_long_frame"], label: "PCM" });
}
