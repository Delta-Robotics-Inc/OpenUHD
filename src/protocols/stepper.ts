import type { InterfaceDef, SlotDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { maxCurrentA, maxFrequencyHz, voltageRangeV, voltageV } from "./params.js";
import { resolveSignal, type SignalRef } from "./signal.js";
import { connectorTrait } from "./connector.js";

/**
 * Stepper motor builders: the windings between a driver and a motor, and the
 * step/direction command port between a controller and a driver.
 */

// ---------------------------------------------------------------------------
// Stepper windings
// ---------------------------------------------------------------------------

/**
 * The leads of a stepper connection. A bipolar motor has two windings, A and
 * B, each with two ends. A unipolar motor adds a centre tap per winding
 * (`commonA`, `commonB`, six wires) or one shared centre tap (`common`, five
 * wires).
 */
export interface StepperLeads {
  a: SignalRef;
  aBar: SignalRef;
  b: SignalRef;
  bBar: SignalRef;
  /** Shared centre tap of a five-wire unipolar motor. */
  common?: SignalRef;
  /** Centre tap of winding A (six-wire unipolar motor). */
  commonA?: SignalRef;
  /** Centre tap of winding B (six-wire unipolar motor). */
  commonB?: SignalRef;
}

export interface StepperPhasesConfig {
  /** Interface id. Defaults to "stepper_out" (output) or "windings" (input). */
  id?: string;
  name?: string;
  /** "output" = driver channel; "input" = motor windings. */
  role: "output" | "input";
  /**
   * "bipolar" drives each winding end to end (four leads). "unipolar" drives
   * each half winding against its centre tap, which the driver supplies.
   */
  winding: "bipolar" | "unipolar";
  /**
   * A unipolar motor with a centre tap per winding (six or eight wires) can
   * also be driven as bipolar by leaving the taps open. Set this to let a
   * bipolar driver pair with it. Ignored for bipolar windings.
   */
  bipolarCapable?: boolean;
  /** The leads: inline specs or ids of declared leaves. Defaults to generated leaves. */
  leads?: StepperLeads;
  /** Rated (motor) or maximum (driver) current per phase, in amps. */
  maxCurrentA?: number;
  /** Supply or coil voltage: nominal or [min, max]. */
  voltageV?: number | [number, number];
  /** Termination of each lead, e.g. "bare_wire_lead" or "screw_terminal". */
  termination?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

const LEAD_SLOTS = [
  ["a", "phase_a", "A+", "stepper_a"],
  ["aBar", "phase_a_bar", "A-", "stepper_a_bar"],
  ["b", "phase_b", "B+", "stepper_b"],
  ["bBar", "phase_b_bar", "B-", "stepper_b_bar"],
  ["commonA", "common_a", "A COM", "stepper_common"],
  ["commonB", "common_b", "B COM", "stepper_common"],
  ["common", "common", "COM", "stepper_common"],
] as const;

/**
 * A stepper connection: one `stepper_phase` leaf per lead and a composed
 * `bipolar_stepper_phases` or `unipolar_stepper_phases` interface whose slots
 * (phase_a, phase_a_bar, phase_b, phase_b_bar, then any centre taps) pair in
 * order across a connection.
 *
 * Swapping the two ends of one winding reverses rotation; mixing leads of
 * different windings stops the motor from stepping. The driver must limit
 * current to the motor's rated phase current (chopper drive), which a
 * `max_current` on both sides records.
 */
export function StepperPhases(config: StepperPhasesConfig): InterfaceDef[] {
  const role = config.role;
  const id = config.id ?? (role === "output" ? "stepper_out" : "windings");
  const generated: InterfaceDef[] = [];
  const leads: Partial<Record<keyof StepperLeads, SignalRef>> = config.leads ?? {
    a: { pin: "A+" },
    aBar: { pin: "A-" },
    b: { pin: "B+" },
    bBar: { pin: "B-" },
    ...(config.winding === "unipolar" ? { common: { pin: "COM" } } : {}),
  };

  const slots: SlotDef[] = [];
  const bindings: Record<string, string> = {};
  for (const [key, slotId, label, capability] of LEAD_SLOTS) {
    const ref = leads[key];
    if (ref === undefined) continue;
    const isTap = key.startsWith("common");
    if (isTap && config.winding === "bipolar") throw new Error(`StepperPhases ${id}: a bipolar winding has no centre tap (${key})`);
    const leaf = resolveSignal(
      ref,
      { id: `${id}_${slotId}`, defaultName: label, capability, protocols: [{ type: "stepper_phase", roles: [role] }] },
      generated,
    );
    bindings[slotId] = leaf;
    slots.push({
      id: slotId,
      label,
      // A bipolar driver leaves a unipolar motor's taps open, so taps are optional.
      required: !isTap,
      match: { protocol: "stepper_phase", role, ...(typeof ref === "string" ? {} : { capability }) },
    });
  }
  for (const k of ["a", "aBar", "b", "bBar"] as const) {
    if (leads[k] === undefined) throw new Error(`StepperPhases ${id}: lead ${k} is required`);
  }
  if (config.winding === "unipolar" && leads.common === undefined && (leads.commonA === undefined || leads.commonB === undefined)) {
    throw new Error(`StepperPhases ${id}: a unipolar winding needs common, or commonA and commonB`);
  }

  if (config.termination !== undefined) {
    for (const leaf of generated) leaf.traits = [...(leaf.traits ?? []), connectorTrait(config.termination)];
  }

  const parameters: Parameter[] = [];
  if (config.maxCurrentA !== undefined) parameters.push(maxCurrentA(config.maxCurrentA));
  if (config.voltageV !== undefined) {
    parameters.push(Array.isArray(config.voltageV) ? voltageRangeV(config.voltageV[0], config.voltageV[1]) : voltageV(config.voltageV));
  }

  const types =
    config.winding === "bipolar"
      ? ["bipolar_stepper_phases"]
      : config.bipolarCapable && leads.commonA !== undefined && leads.commonB !== undefined
        ? ["unipolar_stepper_phases", "bipolar_stepper_phases"]
        : ["unipolar_stepper_phases"];

  const port: InterfaceDef = {
    id,
    name: config.name ?? (role === "output" ? "Stepper motor out" : "Stepper windings"),
    domain: "electrical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: types.map((type) => ({ type, roles: [role] })),
    ...(parameters.length > 0 ? { parameters } : {}),
    slots,
    profiles: [{ id: `${id}_default`, label: "Winding leads", default_active: true, bindings }],
    max_instances: 1,
    traits: [
      {
        type: "stepper_winding",
        params: {
          winding: config.winding,
          ...(types.length > 1 ? { bipolar_capable: true } : {}),
          note: "Swapping the two ends of one winding reverses rotation; leads of different windings must not be mixed. Drive at or below the rated phase current.",
        },
      },
    ],
  };
  return [...generated, port];
}

// ---------------------------------------------------------------------------
// Step / direction command
// ---------------------------------------------------------------------------

export interface StepDirConfig {
  /** Interface id. Defaults to "step_dir". */
  id?: string;
  name?: string;
  /** "input" = stepper driver; "output" = controller (MCU pins, motion controller). */
  role: "input" | "output";
  step: SignalRef;
  dir: SignalRef;
  enable?: SignalRef;
  /**
   * The return (minus) terminal of each signal on drivers with opto-isolated
   * or differential inputs (PUL-, DIR-, ENA-). On a controller these are the
   * complementary outputs of a differential line driver.
   */
  stepReturn?: SignalRef;
  dirReturn?: SignalRef;
  enableReturn?: SignalRef;
  /** Highest step pulse rate in Hz (driver: accepted; controller: generated). */
  maxStepRateHz?: number | [number, number];
  /** Logic level of the signals: nominal or [min, max]. */
  voltageV?: number | [number, number];
  /** Minimum step pulse width (high or low) in microseconds. */
  minPulseWidthUs?: number;
  /** Minimum DIR-to-step setup time in microseconds. */
  dirSetupUs?: number;
  /** The step edge that moves the motor. */
  activeEdge?: "rising" | "falling";
  /** Level of ENABLE that enables the motor outputs. */
  enableActive?: "high" | "low";
  exposed?: boolean;
  defaultActive?: boolean;
}

const STEP_DIR_SIGNALS = [
  ["step", "step", "STEP", "step"],
  ["dir", "dir", "DIR", "dir"],
  ["enable", "enable", "ENABLE", "enable"],
  ["stepReturn", "step_return", "STEP-", "step_return"],
  ["dirReturn", "dir_return", "DIR-", "dir_return"],
  ["enableReturn", "enable_return", "ENABLE-", "enable_return"],
] as const;

/**
 * A step/direction command port: STEP, DIR and optional ENABLE as `digital`
 * leaves and a composed `step_dir` interface. Slots pair in order (step,
 * dir, enable, then the return terminals), so a controller's port mates a
 * driver's. Step, dir and enable are required on the side that declares
 * them; the return terminals are optional, because a single-ended controller
 * ties them to ground or the logic supply.
 *
 * The step rate is a `max_frequency` parameter on the port, so a controller
 * that steps faster than the driver accepts is a parameter conflict. Timing
 * (pulse width, setup time, active edge, enable level) is recorded in the
 * `step_dir` trait.
 */
export function StepDir(config: StepDirConfig): InterfaceDef[] {
  const role = config.role;
  const id = config.id ?? "step_dir";
  const generated: InterfaceDef[] = [];
  const slots: SlotDef[] = [];
  const bindings: Record<string, string> = {};
  for (const [key, slotId, label, capability] of STEP_DIR_SIGNALS) {
    const ref = config[key];
    if (ref === undefined) continue;
    const leaf = resolveSignal(
      typeof ref === "string" ? ref : { ...(config.voltageV !== undefined ? { voltageV: config.voltageV } : {}), ...ref },
      { id: `${id}_${slotId}`, defaultName: label, capability, protocols: [{ type: "digital", roles: [role] }] },
      generated,
    );
    bindings[slotId] = leaf;
    slots.push({
      id: slotId,
      label,
      required: !slotId.endsWith("_return"),
      match: { protocol: "digital", role, ...(typeof ref === "string" ? {} : { capability }) },
    });
  }

  const parameters: Parameter[] = [];
  if (config.maxStepRateHz !== undefined) parameters.push(maxFrequencyHz(config.maxStepRateHz));
  if (config.voltageV !== undefined) {
    parameters.push(Array.isArray(config.voltageV) ? voltageRangeV(config.voltageV[0], config.voltageV[1]) : voltageV(config.voltageV));
  }
  const timing = {
    ...(config.minPulseWidthUs !== undefined ? { min_pulse_width_us: config.minPulseWidthUs } : {}),
    ...(config.dirSetupUs !== undefined ? { dir_setup_us: config.dirSetupUs } : {}),
    ...(config.activeEdge !== undefined ? { active_edge: config.activeEdge } : {}),
    ...(config.enableActive !== undefined ? { enable_active: config.enableActive } : {}),
    ...(config.stepReturn !== undefined ? { inputs: "differential_or_opto" } : {}),
  };

  const port: InterfaceDef = {
    id,
    name: config.name ?? (role === "input" ? "Step/direction input" : "Step/direction output"),
    domain: "electrical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: "step_dir", roles: [role] }],
    ...(parameters.length > 0 ? { parameters } : {}),
    slots,
    profiles: [{ id: `${id}_default`, label: "Step/direction signals", default_active: true, bindings }],
    max_instances: 1,
    ...(Object.keys(timing).length > 0 ? { traits: [{ type: "step_dir", params: timing }] } : {}),
  };
  return [...generated, port];
}
