import type { InterfaceDef, SlotDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { countsPerRev, maxFrequencyHz, voltageRangeV, voltageV } from "./params.js";
import { resolveSignal, type SignalRef } from "./signal.js";

/**
 * Encoder port builder: an incremental quadrature encoder (A, B, optional
 * index) with an optional absolute duty-cycle (PWM) output, as found on
 * motor encoders, through-bore encoders and the encoder inputs of motor
 * controllers.
 */

export interface QuadratureEncoderConfig {
  /** Interface id. Defaults to "encoder" (output) or "encoder_in" (input). */
  id?: string;
  name?: string;
  /** "output" = the encoder; "input" = the controller or MCU that reads it. */
  role: "output" | "input";
  a: SignalRef;
  b: SignalRef;
  index?: SignalRef;
  /** Absolute position as a PWM duty cycle (e.g. a through-bore encoder's ABS output). */
  absolute?: SignalRef;
  /** Encoder supply: the encoder's power input, or the reader's power output to it. */
  power?: string;
  ground?: string;
  /** Counts (or pulses) per revolution, as the source states it, on the encoder side. */
  countsPerRev?: number;
  /** Highest edge rate in Hz (encoder: produced at top speed; reader: accepted). */
  maxFrequencyHz?: number | [number, number];
  /** Logic level of A/B/index: nominal or [min, max]. */
  voltageV?: number | [number, number];
  /** Output stage of the encoder ("push_pull", "open_collector", "open_drain"); open outputs need pull-ups. */
  outputType?: "push_pull" | "open_collector" | "open_drain";
  exposed?: boolean;
  defaultActive?: boolean;
}

const ENCODER_SIGNALS = [
  ["a", "a", "A", "quadrature_a", "digital"],
  ["b", "b", "B", "quadrature_b", "digital"],
  ["index", "index", "INDEX", "quadrature_index", "digital"],
  ["absolute", "absolute", "ABS (PWM)", "encoder_absolute_pwm", "pwm"],
] as const;

/**
 * A quadrature encoder port: A, B and optional index as `digital` leaves
 * (capabilities `quadrature_a`, `quadrature_b`, `quadrature_index`), an
 * optional absolute `pwm` leaf, and the composed `quadrature_encoder`
 * interface. Slots pair in order (a, b, index, absolute, power, ground), so
 * an encoder mates a controller's encoder input. A and B are required; the
 * rest are optional, so an encoder without an index still mates an input that
 * has one.
 */
export function QuadratureEncoder(config: QuadratureEncoderConfig): InterfaceDef[] {
  const role = config.role;
  const id = config.id ?? (role === "output" ? "encoder" : "encoder_in");
  const generated: InterfaceDef[] = [];
  const slots: SlotDef[] = [];
  const bindings: Record<string, string> = {};
  for (const [key, slotId, label, capability, protocol] of ENCODER_SIGNALS) {
    const ref = config[key];
    if (ref === undefined) continue;
    const protocols = protocol === "pwm" ? [{ type: "pwm", roles: [role] }, { type: "digital", roles: [role] }] : [{ type: "digital", roles: [role] }];
    const leaf = resolveSignal(
      typeof ref === "string" ? ref : { ...(config.voltageV !== undefined ? { voltageV: config.voltageV } : {}), ...ref },
      { id: `${id}_${slotId}`, defaultName: label, capability, protocols },
      generated,
    );
    bindings[slotId] = leaf;
    slots.push({
      id: slotId,
      label,
      required: key === "a" || key === "b",
      match: { protocol, role, ...(typeof ref === "string" ? {} : { capability }) },
    });
  }
  if (config.power !== undefined) {
    slots.push({ id: "power", label: "VCC", required: false, match: { protocol: "power", role: role === "output" ? "input" : "output" } });
    bindings.power = config.power;
  }
  if (config.ground !== undefined) {
    slots.push({ id: "ground", label: "GND", required: false, match: { protocol: "power", role: "ground" } });
    bindings.ground = config.ground;
  }

  const parameters: Parameter[] = [];
  if (config.countsPerRev !== undefined) parameters.push(countsPerRev(config.countsPerRev));
  if (config.maxFrequencyHz !== undefined) parameters.push(maxFrequencyHz(config.maxFrequencyHz));
  if (config.voltageV !== undefined) {
    parameters.push(Array.isArray(config.voltageV) ? voltageRangeV(config.voltageV[0], config.voltageV[1]) : voltageV(config.voltageV));
  }

  const port: InterfaceDef = {
    id,
    name: config.name ?? (role === "output" ? "Encoder" : "Encoder input"),
    domain: "electrical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "quadrature_encoder", roles: [role] }],
    ...(parameters.length > 0 ? { parameters } : {}),
    slots,
    profiles: [{ id: `${id}_default`, label: "Encoder signals", default_active: true, bindings }],
    max_instances: 1,
    ...(config.outputType !== undefined
      ? {
          traits: [
            {
              type: "encoder_output",
              params: {
                output_type: config.outputType,
                ...(config.outputType !== "push_pull" ? { note: "Open-collector or open-drain outputs need pull-up resistors on the reader side." } : {}),
              },
            },
          ],
        }
      : {}),
  };
  return [...generated, port];
}
