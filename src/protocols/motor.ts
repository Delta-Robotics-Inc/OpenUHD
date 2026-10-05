import type { InterfaceDef, ProtocolDef, SlotDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import {
  burstCurrentA,
  escSignalRateKbps,
  maxCurrentA,
  minSupplyCurrentA,
  voltageRangeV,
  voltageV,
} from "./params.js";
import { resolveSignal, signalPin, type SignalRef } from "./signal.js";
import { connectorTrait } from "./connector.js";

/**
 * Brushless motor drive builders: 3-phase power, ESC command signals, and
 * the flight-controller ↔ ESC connector.
 */

// ---------------------------------------------------------------------------
// 3-phase brushless power
// ---------------------------------------------------------------------------

/** "output" = motor driver / ESC channel; "input" = motor windings. */
export type PhaseRole = "output" | "input";

export interface BrushlessPhasesConfig {
  /** Interface id. Defaults to "motor_out" (output) or "phases" (input). */
  id?: string;
  name?: string;
  role: PhaseRole;
  /**
   * The three phase terminals: inline specs (pad/lead designator, name) or
   * ids of already-declared leaves. Defaults to generated leaves A/B/C.
   */
  phases?: [SignalRef, SignalRef, SignalRef];
  /** Continuous current per phase in amps. */
  maxCurrentA?: number;
  /** Burst current per phase in amps (note the duration in a trait). */
  burstCurrentA?: number;
  /**
   * Input (motor) only: the least continuous current per channel the driver
   * or controller channel must be rated for, in amps, when the source states
   * one. The pair check compares it with the channel's `max_current`.
   */
  minSupplyCurrentA?: number;
  /** Supply voltage the phases operate at: nominal or [min, max]. */
  voltageV?: number | [number, number];
  /** Termination of each phase, e.g. "solder_pad" or "bare_wire_lead". */
  termination?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

const PHASES = ["a", "b", "c"] as const;

/**
 * A 3-phase brushless connection. Generates one leaf per phase (capability
 * `bldc_phase`, protocol `bldc_phase`) and the composed `bldc_3phase`
 * interface whose slots phase_a/b/c pair in order across a connection.
 * Phases are not polarity-sensitive: swapping any two reverses rotation.
 */
export function BrushlessPhases(config: BrushlessPhasesConfig): InterfaceDef[] {
  const role = config.role;
  const id = config.id ?? (role === "output" ? "motor_out" : "phases");
  const leafProtocols: ProtocolDef[] = [{ type: "bldc_phase", roles: [role] }];
  const generated: InterfaceDef[] = [];

  const ids = PHASES.map((letter, index) => {
    const ref = config.phases?.[index] ?? { pin: letter.toUpperCase() };
    return resolveSignal(
      ref,
      {
        id: `${id}_${letter}`,
        defaultName: `Phase ${letter.toUpperCase()}`,
        capability: "bldc_phase",
        protocols: leafProtocols,
      },
      generated,
    );
  });

  if (config.termination !== undefined) {
    for (const leaf of generated) {
      leaf.traits = [...(leaf.traits ?? []), connectorTrait(config.termination)];
    }
  }

  const parameters: Parameter[] = [];
  if (config.maxCurrentA !== undefined) parameters.push(maxCurrentA(config.maxCurrentA));
  if (config.burstCurrentA !== undefined) parameters.push(burstCurrentA(config.burstCurrentA));
  if (config.minSupplyCurrentA !== undefined) {
    if (role !== "input") throw new Error(`${id}: minSupplyCurrentA is what a motor needs from its channel; a channel states maxCurrentA`);
    parameters.push(minSupplyCurrentA(config.minSupplyCurrentA));
  }
  if (config.voltageV !== undefined) {
    parameters.push(
      Array.isArray(config.voltageV)
        ? voltageRangeV(config.voltageV[0], config.voltageV[1])
        : voltageV(config.voltageV),
    );
  }

  const port: InterfaceDef = {
    id,
    name: config.name ?? (role === "output" ? "Motor phases out" : "Motor phases"),
    domain: "electrical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "bldc_3phase", roles: [role] }],
    ...(parameters.length > 0 ? { parameters } : {}),
    slots: PHASES.map((letter) => ({
      id: `phase_${letter}`,
      required: true,
      match: { protocol: "bldc_phase", role, capability: "bldc_phase" },
    })),
    profiles: [
      {
        id: `${id}_default`,
        label: "Phase A/B/C",
        default_active: true,
        bindings: { phase_a: ids[0], phase_b: ids[1], phase_c: ids[2] },
      },
    ],
    traits: [
      {
        type: "phase_order",
        params: {
          note: "Brushless phases are not polarity-sensitive: swapping any two phase connections reverses rotation direction.",
        },
      },
    ],
  };

  return [...generated, port];
}

// ---------------------------------------------------------------------------
// ESC command signal
// ---------------------------------------------------------------------------

export type EscSignalProtocol =
  | "dshot150"
  | "dshot300"
  | "dshot600"
  | "dshot1200"
  | "oneshot125"
  | "oneshot42"
  | "multishot"
  | "pwm";

export interface EscSignalConfig {
  id: string;
  name?: string;
  /** Physical pad/pin designator. */
  pin?: number | string;
  /** "output" = flight controller motor output; "input" = ESC signal input. */
  role: "output" | "input";
  /** Command protocols the pin supports, as stated by the source. */
  protocols: EscSignalProtocol[];
  /** Bidirectional DShot (eRPM telemetry on the signal wire) supported. */
  bidirectional?: boolean;
  /** Logic level: nominal or [min, max]. */
  voltageV?: number | [number, number];
  /** 1-based motor/channel index (M1..M8), recorded as a parameter. */
  motorIndex?: number;
  exposed?: boolean;
  defaultActive?: boolean;
}

const DSHOT_RATE: Record<string, number> = {
  dshot150: 150,
  dshot300: 300,
  dshot600: 600,
  dshot1200: 1200,
};

/**
 * One ESC command-signal pin. All DShot rates collapse to protocol type
 * `dshot` with an `esc_signal_rate` range (kbit/s) so rate mismatches show up
 * as parameter conflicts; analog protocols keep their own types (`oneshot125`,
 * `oneshot42`, `multishot`, and `pwm_esc` for 1–2 ms servo-style PWM).
 */
export function EscSignal(config: EscSignalConfig): InterfaceDef {
  const role = config.role;
  const types = new Set<string>();
  const dshotRates: number[] = [];
  for (const p of config.protocols) {
    if (p in DSHOT_RATE) {
      types.add("dshot");
      dshotRates.push(DSHOT_RATE[p]);
    } else {
      types.add(p === "pwm" ? "pwm_esc" : p);
    }
  }

  const leaf = signalPin({
    id: config.id,
    defaultName: config.name ?? config.id.toUpperCase(),
    capability: "esc_signal",
    protocols: [...types].map((type) => ({ type, roles: [role] })),
    spec: {
      pin: config.pin ?? config.id,
      ...(config.name !== undefined ? { name: config.name } : {}),
      ...(config.voltageV !== undefined ? { voltageV: config.voltageV } : {}),
    },
  });
  if (config.pin === undefined) delete leaf.pin;

  const parameters = [...(leaf.parameters ?? [])];
  if (dshotRates.length > 0) {
    const min = Math.min(...dshotRates);
    const max = Math.max(...dshotRates);
    parameters.push(escSignalRateKbps(min === max ? min : [min, max]));
  }
  if (config.motorIndex !== undefined) {
    parameters.push({ id: "motor_index", unit: "dimensionless", value: config.motorIndex });
  }

  return {
    ...leaf,
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    capabilities: [
      "esc_signal",
      ...(config.bidirectional ? ["dshot_bidirectional"] : []),
    ],
    ...(parameters.length > 0 ? { parameters } : {}),
    traits: [
      {
        type: "esc_signal_protocols",
        params: {
          protocols: config.protocols,
          bidirectional_dshot: config.bidirectional ?? false,
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Flight controller ↔ ESC connector
// ---------------------------------------------------------------------------

export interface FcEscPortConfig {
  /** Interface id. Defaults to "esc_port". */
  id?: string;
  name?: string;
  /** Which side of the stack this connector is on. */
  side: "fc" | "esc";
  /** Connector slug, e.g. "jst_sh_8". */
  connector?: string;
  /** Signal names in physical pin order, pin 1 first (from the source pinout). */
  pinout?: string[];
  /**
   * EscSignal leaves (or their ids) in M1..Mn order. Pass the leaves so each
   * motor slot takes its protocol from the signal it binds; with bare ids the
   * slots use `signalProtocol`.
   */
  motors: Array<string | InterfaceDef>;
  /** Motor slot protocol when `motors` are ids (default "dshot"). */
  signalProtocol?: string;
  /** Battery voltage passthrough leaf id (ESC supplies, FC receives). */
  vbat?: string;
  /** Ground leaf id. */
  gnd?: string;
  /** Current-sensor analog leaf id (ESC outputs, FC measures). */
  current?: string;
  /** ESC telemetry UART leaf id (ESC transmits, FC receives). */
  telemetry?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * The multi-pin harness connector between a flight controller and a 4-in-1
 * ESC (commonly JST-SH 8: VBAT, GND, CURRENT, TELEMETRY, M1–M4). Slots pair
 * in order across a connection, so motor numbering carries through. Pin
 * order differs between vendors and is recorded in the connector trait; a
 * mismatched pinout needs a remapped cable.
 */
export function FcEscPort(config: FcEscPortConfig): InterfaceDef {
  const fc = config.side === "fc";
  const signalProtocol = (motor: string | InterfaceDef): string => {
    if (typeof motor === "string") return config.signalProtocol ?? "dshot";
    const types = motor.protocols.map((p) => p.type);
    return types.includes("dshot") ? "dshot" : (types[0] ?? "dshot");
  };
  const slots: SlotDef[] = config.motors.map((motor, index) => ({
    id: `motor_${index + 1}`,
    required: true,
    match: { protocol: signalProtocol(motor), role: fc ? "output" : "input", capability: "esc_signal" },
  }));
  const bindings: Record<string, string> = {};
  config.motors.forEach((motor, index) => {
    bindings[`motor_${index + 1}`] = typeof motor === "string" ? motor : motor.id;
  });

  const optional: Array<[keyof FcEscPortConfig, SlotDef]> = [
    ["vbat", { id: "vbat", required: false, match: { protocol: "power", role: fc ? "input" : "output" } }],
    ["gnd", { id: "gnd", required: false, match: { protocol: "power", role: "ground" } }],
    ["current", { id: "current", required: false, match: { protocol: "analog", role: fc ? "input" : "output" } }],
    ["telemetry", { id: "telemetry", required: false, match: { protocol: "uart", role: fc ? "receiver" : "transmitter" } }],
  ];
  for (const [key, slot] of optional) {
    const bound = config[key];
    if (typeof bound === "string") {
      slots.push(slot);
      bindings[slot.id] = bound;
    }
  }

  const id = config.id ?? "esc_port";
  return {
    id,
    name: config.name ?? (fc ? "ESC connector" : "FC connector"),
    domain: "electrical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "fc_esc_connector", roles: [fc ? "host" : "device"] }],
    slots,
    profiles: [{ id: `${id}_default`, label: "Connector pinout", default_active: true, bindings }],
    max_instances: 1,
    ...(config.connector !== undefined || config.pinout !== undefined
      ? {
          traits: [
            connectorTrait(config.connector ?? "custom", {
              ...(config.pinout !== undefined
                ? { positions: config.pinout.length, pinout: config.pinout }
                : {}),
            }),
          ],
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Brushed DC motor terminals
// ---------------------------------------------------------------------------

export interface BrushedMotorTerminalsConfig {
  /** Interface id. Defaults to "motor_out" (output) or "motor" (input). */
  id?: string;
  name?: string;
  /** "output" = H-bridge or motor controller channel; "input" = motor terminals. */
  role: "output" | "input";
  /**
   * The two terminals (M+ then M-, or OUT1 then OUT2): inline specs or ids
   * of declared leaves. Defaults to generated leaves "M+" and "M-".
   */
  terminals?: [SignalRef, SignalRef];
  /** Continuous current (driver: per channel; motor: rated or stall, say which in a trait). */
  maxCurrentA?: number;
  /** Burst or peak current in amps (note the duration in a trait). */
  burstCurrentA?: number;
  /**
   * Input (motor) only: the least continuous current per channel the driver
   * or controller channel must be rated for, in amps, when the source states
   * one. The pair check compares it with the channel's `max_current`.
   */
  minSupplyCurrentA?: number;
  /** Motor or driver voltage: nominal or [min, max]. */
  voltageV?: number | [number, number];
  /** Termination of each terminal, e.g. "screw_terminal", "spade_terminal", "bare_wire_lead". */
  termination?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A brushed DC motor connection: two `dc_motor_terminal` leaves and a
 * composed `dc_motor` interface whose slots terminal_1 and terminal_2 pair in
 * order across a connection. A brushed motor has no fixed polarity: swapping
 * the terminals reverses rotation, which the `motor_polarity` trait states.
 * A driver channel and a motor pair as output and input.
 */
export function BrushedMotorTerminals(config: BrushedMotorTerminalsConfig): InterfaceDef[] {
  const role = config.role;
  const id = config.id ?? (role === "output" ? "motor_out" : "motor");
  const generated: InterfaceDef[] = [];
  const refs = config.terminals ?? [{ pin: "M+" }, { pin: "M-" }];
  const ids = refs.map((ref, index) =>
    resolveSignal(
      ref,
      {
        id: `${id}_${index + 1}`,
        defaultName: index === 0 ? "M+" : "M-",
        capability: "dc_motor_terminal",
        protocols: [{ type: "dc_motor_terminal", roles: [role] }],
      },
      generated,
    ),
  );
  if (config.termination !== undefined) {
    for (const leaf of generated) leaf.traits = [...(leaf.traits ?? []), connectorTrait(config.termination)];
  }

  const parameters: Parameter[] = [];
  if (config.maxCurrentA !== undefined) parameters.push(maxCurrentA(config.maxCurrentA));
  if (config.burstCurrentA !== undefined) parameters.push(burstCurrentA(config.burstCurrentA));
  if (config.minSupplyCurrentA !== undefined) {
    if (role !== "input") throw new Error(`${id}: minSupplyCurrentA is what a motor needs from its channel; a channel states maxCurrentA`);
    parameters.push(minSupplyCurrentA(config.minSupplyCurrentA));
  }
  if (config.voltageV !== undefined) {
    parameters.push(Array.isArray(config.voltageV) ? voltageRangeV(config.voltageV[0], config.voltageV[1]) : voltageV(config.voltageV));
  }

  const port: InterfaceDef = {
    id,
    name: config.name ?? (role === "output" ? "DC motor out" : "DC motor terminals"),
    domain: "electrical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "dc_motor", roles: [role] }],
    ...(parameters.length > 0 ? { parameters } : {}),
    slots: [1, 2].map((n, index) => ({
      id: `terminal_${n}`,
      label: index === 0 ? "M+" : "M-",
      required: true,
      match: { protocol: "dc_motor_terminal", role, ...(typeof refs[index] === "string" ? {} : { capability: "dc_motor_terminal" }) },
    })),
    profiles: [{ id: `${id}_default`, label: "Motor terminals", default_active: true, bindings: { terminal_1: ids[0], terminal_2: ids[1] } }],
    max_instances: 1,
    traits: [
      {
        type: "motor_polarity",
        params: { note: "A brushed DC motor has no fixed polarity: swapping the two terminals reverses rotation." },
      },
    ],
  };
  return [...generated, port];
}
