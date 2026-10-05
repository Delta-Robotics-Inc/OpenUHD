import type { InterfaceDef, SlotDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { frameRateHz, pulseWidthUs, voltageRangeV, voltageV } from "./params.js";
import { resolveSignal, type SignalRef } from "./signal.js";
import { connectorTrait } from "./connector.js";

/**
 * RC servo port builder: the three-wire hobby servo connection (signal,
 * V+, ground) between a servo and a servo controller, servo shield, receiver
 * or MCU header.
 */

export interface ServoPortConfig {
  /** Interface id. Defaults to "servo" (input) or "servo_out" (output). */
  id?: string;
  name?: string;
  /** "output" = the channel that drives a servo; "input" = the servo. */
  role: "output" | "input";
  /** The signal wire or pin: inline spec or the id of a declared leaf. */
  signal: SignalRef;
  /** The V+ leaf: the servo's supply input, or the channel's supply output. */
  power?: string;
  ground?: string;
  /**
   * Command pulse width in microseconds: the range the servo responds to, or
   * the range the channel can produce.
   */
  pulseWidthUs?: number | [number, number];
  /** Frame (refresh) rate in Hz: accepted by the servo, or produced by the channel. */
  frameRateHz?: number | [number, number];
  /** Signal logic level: nominal or [min, max]. */
  signalVoltageV?: number | [number, number];
  /** Connector type, e.g. "servo_3pin" for the 0.1 in (2.54 mm) three-position plug. */
  connector?: string;
  /** Pin order of the connector, pin 1 first (e.g. ["GND", "V+", "SIG"]). */
  pinout?: string[];
  /** "plug" on a servo lead, "header" on a controller. */
  gender?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A three-wire RC servo port: a `pwm` signal leaf (capability
 * `servo_signal`) and a composed `rc_servo` interface with slots signal,
 * power and ground, which pair in order across a connection. The pulse
 * width and frame rate are parameters, so a channel that cannot produce the
 * servo's pulse range or frame rate is a parameter conflict. The supply
 * voltage is checked on the power leaves themselves.
 */
export function ServoPort(config: ServoPortConfig): InterfaceDef[] {
  const role = config.role;
  const id = config.id ?? (role === "input" ? "servo" : "servo_out");
  const generated: InterfaceDef[] = [];
  const signalRef = config.signal;
  const signal = resolveSignal(
    typeof signalRef === "string" ? signalRef : { ...(config.signalVoltageV !== undefined ? { voltageV: config.signalVoltageV } : {}), ...signalRef },
    { id: `${id}_signal`, defaultName: "SIG", capability: "servo_signal", protocols: [{ type: "pwm", roles: [role] }] },
    generated,
  );
  const slots: SlotDef[] = [
    { id: "signal", label: "SIG", required: true, match: { protocol: "pwm", role, ...(typeof signalRef === "string" ? {} : { capability: "servo_signal" }) } },
  ];
  const bindings: Record<string, string> = { signal };
  if (config.power !== undefined) {
    slots.push({ id: "power", label: "V+", required: false, match: { protocol: "power", role: role === "input" ? "input" : "output" } });
    bindings.power = config.power;
  }
  if (config.ground !== undefined) {
    slots.push({ id: "ground", label: "GND", required: false, match: { protocol: "power", role: "ground" } });
    bindings.ground = config.ground;
  }

  const parameters: Parameter[] = [];
  if (config.pulseWidthUs !== undefined) parameters.push(pulseWidthUs(config.pulseWidthUs));
  if (config.frameRateHz !== undefined) parameters.push(frameRateHz(config.frameRateHz));
  if (config.signalVoltageV !== undefined) {
    const v = config.signalVoltageV;
    parameters.push(Array.isArray(v) ? voltageRangeV(v[0], v[1]) : voltageV(v));
  }

  const port: InterfaceDef = {
    id,
    name: config.name ?? (role === "input" ? "Servo lead" : "Servo channel"),
    domain: "electrical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "rc_servo", roles: [role] }],
    ...(parameters.length > 0 ? { parameters } : {}),
    slots,
    profiles: [{ id: `${id}_default`, label: "Servo wires", default_active: true, bindings }],
    max_instances: 1,
    ...(config.connector !== undefined
      ? { traits: [connectorTrait(config.connector, { ...(config.gender !== undefined ? { gender: config.gender } : {}), ...(config.pinout !== undefined ? { positions: config.pinout.length, pinout: config.pinout } : {}) })] }
      : {}),
  };
  return [...generated, port];
}
