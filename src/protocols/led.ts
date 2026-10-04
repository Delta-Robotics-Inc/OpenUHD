import type { InterfaceDef } from "../types/interface.js";
import type { ModuleDef } from "../types/module.js";
import type { DomainMetadata, PackageSpec } from "../types/domain.js";
import type { LedEmitter, LedTrait, TraitDef } from "../types/trait.js";
import type { Parameter } from "../types/parameter.js";
import { defineModule } from "./define-module.js";
import { ledCurrentmA } from "./params.js";
import { PASSIVE_PROTOCOL } from "./passive.js";
import { linkSlots, type LinkSignal } from "./link.js";
import type { SignalRef } from "./signal.js";

/**
 * LEDs: the `led` trait, `Led()` for a two-terminal LED, and
 * `LedDrive` for pairing an LED with the driver channel that sets its
 * current.
 *
 * An LED's terminals stay `passive` leaves (they sit on board nets like a
 * resistor's), with capabilities `led_anode` and `led_cathode`. Over them,
 * `LedDrive` declares `led_drive` composites with roles `anode` and
 * `cathode`; an LED driver's channel (a constant-current sink, a PWM LED
 * driver pin, an AFE's LED driver) declares one with role `sink` or
 * `source`. A sinking driver pairs with the LED's cathode, a sourcing one
 * with its anode. `led_current` is [0, the LED's maximum] on
 * the LED and what the driver can be set to on the driver; they must
 * overlap, and a driver that can be set above the LED's maximum is a
 * warning (`led_drive_current`).
 */

const KIND_EMITTERS: Partial<Record<LedTrait["params"]["kind"], number>> = { bicolor: 2, rgb: 3, rgbw: 4 };

/** The `led` trait, checked: at least one emitter, and the emitter count a bicolour, RGB or RGBW kind implies. */
export function ledTrait(params: LedTrait["params"]): LedTrait {
  if (!params.emitters.length) throw new Error("led: give at least one emitter");
  const n = KIND_EMITTERS[params.kind];
  if (n !== undefined && params.emitters.length !== n) throw new Error(`led: a ${params.kind} LED has ${n} emitters (got ${params.emitters.length})`);
  for (const e of params.emitters) {
    if (e.max_current_mA !== undefined && e.test_current_mA !== undefined && e.test_current_mA > e.max_current_mA) throw new Error(`led: ${e.color} test current above its maximum`);
  }
  return { type: "led", params };
}

export interface LedDriveConfig {
  /** Interface id (prefix on an LED). Defaults to "led_drive". */
  id?: string;
  name?: string;
  /** "led" on the LED; "driver" on the channel that drives it. */
  role: "led" | "driver";
  /** Driver: it sinks current from the cathode ("sink") or sources it into the anode ("source"). */
  mode?: "sink" | "source";
  /** LED: anode terminal. */
  anode?: SignalRef;
  /** LED: cathode terminal. */
  cathode?: SignalRef;
  /** Driver: its output pin. */
  output?: SignalRef;
  /** LED: its maximum continuous current in mA (stated as [0, max]). Driver: settable [min, max] or fixed current. */
  currentmA?: number | [number, number];
  /** LED only: forward voltage, typical or [min, max] (parameter `forward_voltage`, for review; not pair-checked). */
  forwardVoltageV?: number | [number, number];
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * LED drive composites: protocol `led_drive`.
 *
 * On an LED (`role: "led"`): one composite per terminal given,
 * `<id>_anode` (role `anode`) and `<id>_cathode` (role `cathode`), each
 * with one slot. One per terminal, because a driver reaches one side of the
 * LED and the other side goes to a supply or ground: on a board, a
 * composite lifts over a net only when all its pads reach the same part.
 *
 * On a driver channel (`role: "driver"`): one composite `<id>` with role
 * `sink` (it pulls the cathode) or `source` (it feeds the anode) and one
 * slot over its output. `sink` pairs with `cathode`, `source` with `anode`.
 */
export function LedDrive(config: LedDriveConfig): InterfaceDef[] {
  const id = config.id ?? "led_drive";
  const led = config.role === "led";
  if (led && (config.mode || config.output !== undefined)) throw new Error(`LedDrive ${id}: mode and output are for drivers`);
  if (!led && (config.anode !== undefined || config.cathode !== undefined)) throw new Error(`LedDrive ${id}: a driver has an output, not anode or cathode`);
  if (!led && (!config.mode || config.output === undefined)) throw new Error(`LedDrive ${id}: a driver states its mode (sink or source) and output`);
  if (led && config.anode === undefined && config.cathode === undefined) throw new Error(`LedDrive ${id}: give the anode, the cathode or both`);
  if (!led && config.forwardVoltageV !== undefined) throw new Error(`LedDrive ${id}: forward voltage is the LED's`);

  const parameters: Parameter[] = [];
  if (config.currentmA !== undefined) parameters.push(ledCurrentmA(led && !Array.isArray(config.currentmA) ? [0, config.currentmA] : config.currentmA));
  if (config.forwardVoltageV !== undefined) {
    const v = config.forwardVoltageV;
    parameters.push(Array.isArray(v) ? { id: "forward_voltage", unit: "V", range: v } : { id: "forward_voltage", unit: "V", value: v });
  }
  const generated: InterfaceDef[] = [];
  const composite = (cid: string, role: string, signal: LinkSignal, name: string): InterfaceDef => {
    const { slots, bindings } = linkSlots(led ? id : cid, "led_drive", [signal], generated);
    return {
      id: cid,
      name,
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "led_drive", roles: [role] }],
      ...(parameters.length ? { parameters: parameters.map((p) => ({ ...p })) } : {}),
      slots,
      profiles: [{ id: `${cid}_default`, label: signal.label, default_active: true, bindings }],
    };
  };
  const terminal = [{ type: PASSIVE_PROTOCOL, roles: ["terminal"] }];
  if (!led) {
    const mode = config.mode!;
    const port = composite(id, mode, { slot: mode, label: "OUT", ref: config.output!, leaf: [{ type: "digital", roles: ["output"] }], capability: `led_${mode}`, role: mode, required: true }, config.name ?? `LED driver (${mode})`);
    return [...generated, port];
  }
  const out: InterfaceDef[] = [];
  for (const which of ["anode", "cathode"] as const) {
    const ref = config[which];
    if (ref === undefined) continue;
    out.push(composite(`${id}_${which}`, which, { slot: which, label: which === "anode" ? "A" : "K", ref, leaf: terminal, capability: `led_${which}`, role: which, required: true }, `${config.name ?? "LED"} ${which}`));
  }
  return [...generated, ...out];
}

export interface LedConfig {
  id: string;
  name: string;
  /** Kind; defaults to "indicator" (also "infrared", "ultraviolet", "high_power" for two-terminal LEDs). */
  kind?: "indicator" | "infrared" | "ultraviolet" | "high_power";
  emitter: Omit<LedEmitter, "anode" | "cathode">;
  /** Anode and cathode pin designators. Default 1 (anode) and 2 (cathode); give the datasheet's. */
  pins?: { anode: number | string; cathode: number | string };
  viewing_angle_deg?: number;
  manufacturer?: string;
  part_number?: string;
  description?: string;
  package?: PackageSpec;
  dimensions_mm?: DomainMetadata["dimensions_mm"];
  source?: string;
  assumption?: string;
  traits?: TraitDef[];
}

/**
 * A two-terminal LED as a module: `anode` and `cathode` passive terminals,
 * the `led_anode` and `led_cathode` drive composites over them (`LedDrive`,
 * with the emitter's maximum current and forward voltage), the `led` trait,
 * and category
 * `component.led`.
 */
export function Led(config: LedConfig): ModuleDef {
  const e = config.emitter;
  const pins = config.pins ?? { anode: 1, cathode: 2 };
  const term = (which: "anode" | "cathode"): InterfaceDef => ({
    id: which,
    name: which === "anode" ? "A" : "K",
    pin: pins[which],
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: PASSIVE_PROTOCOL, roles: ["terminal"] }],
    capabilities: [`led_${which}`],
  });
  const drive = LedDrive({
    id: "led",
    role: "led",
    anode: "anode",
    cathode: "cathode",
    ...(e.max_current_mA !== undefined ? { currentmA: e.max_current_mA } : {}),
    ...(e.forward_voltage_V !== undefined ? { forwardVoltageV: e.forward_voltage_V } : {}),
  });
  const trait = ledTrait({
    kind: config.kind ?? "indicator",
    emitters: [{ ...e, anode: "anode", cathode: "cathode" }],
    ...(config.viewing_angle_deg !== undefined ? { viewing_angle_deg: config.viewing_angle_deg } : {}),
    ...(config.source ? { source: config.source } : {}),
    ...(config.assumption ? { assumption: config.assumption } : {}),
  });
  const mechanical: DomainMetadata | undefined =
    config.package || config.dimensions_mm
      ? { domain: "mechanical", ...(config.dimensions_mm ? { dimensions_mm: config.dimensions_mm } : {}), ...(config.package ? { package: config.package } : {}) }
      : undefined;
  return defineModule({
    id: config.id,
    name: config.name,
    ...(config.manufacturer ? { manufacturer: config.manufacturer } : {}),
    ...(config.part_number ? { part_number: config.part_number } : {}),
    ...(config.description ? { description: config.description } : {}),
    categories: ["component.led"],
    interfaces: [term("anode"), term("cathode"), ...drive],
    ...(mechanical ? { domains: [mechanical] } : {}),
    traits: [trait, ...(config.traits ?? [])],
  });
}
