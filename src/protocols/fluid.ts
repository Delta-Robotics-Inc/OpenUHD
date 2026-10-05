import type { InterfaceDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import type { TraitDef } from "../types/trait.js";
import { pressureBar, tubeIdMm, tubeOdMm } from "./params.js";

/**
 * Fluid port builder for pneumatic and hydraulic parts: cylinder ports,
 * valve ports, compressor and regulator outlets, fittings, tubing ends and
 * pressure sensor ports.
 *
 * A port says two things:
 * - **Flow role** (protocol `pneumatic` or `hydraulic`): "source" delivers
 *   pressure (compressor, regulator outlet, valve outlet), "sink" consumes it
 *   (cylinder port, valve inlet), "bidirectional" passes it either way
 *   (fittings, tubing, tees, adapters), and "sensing" measures it where it is
 *   plumbed in (gauges, transducers). Pairs: matching/roles.ts.
 * - **Joint** (the `fluid_joint` trait): how the port physically connects.
 *   The pair check (drc/joint-check.ts) requires a mating joint: the same
 *   thread standard and size with opposite genders, a push-to-connect
 *   fitting with a tube of its size, a hose barb with a hose, or the same
 *   quick-coupler style with opposite genders.
 *
 * Pressure is a `pressure` parameter in bar: a source states what it
 * delivers, everything else the working range it is rated for, and the two
 * must overlap. Tube sizes are `tube_od` / `tube_id` parameters in mm.
 */

export type FluidMedium = "pneumatic" | "hydraulic";
export type FluidRole = "source" | "sink" | "bidirectional" | "sensing";

/** Thread standards. NPT and NPTF mate; BSPT (taper) and BSPP (parallel) are kept apart. */
export type ThreadStandard = "NPT" | "NPTF" | "BSPP" | "BSPT" | "metric" | "UNF" | "SAE_ORB" | (string & {});

export type FluidJoint =
  /** A threaded port or fitting end. `size` as the source prints it: "1/4", "1/8", "G1/4", "M5". */
  | { kind: "thread"; standard: ThreadStandard; size: string; gender: "male" | "female" }
  /** A push-to-connect (one-touch) fitting that takes a tube of this outside diameter. */
  | { kind: "push_to_connect"; tubeOdMm: number }
  /** A plain tube or hose end. `tubeIdMm` is needed to mate a hose barb. */
  | { kind: "tube"; tubeOdMm: number; tubeIdMm?: number }
  /** A hose barb that takes a hose of this inside diameter. */
  | { kind: "barb"; tubeIdMm: number }
  /** A quick coupler (plug or socket) of a named style, e.g. "industrial_m" or "iso_6150_b". */
  | { kind: "quick_coupler"; style: string; gender: "male" | "female" };

export interface FluidPortConfig {
  id: string;
  name?: string;
  medium: FluidMedium;
  role: FluidRole;
  joint: FluidJoint;
  /** Delivered pressure (source) or rated working range (everything else), in bar. */
  pressureBar?: number | [number, number];
  /** Burst or proof pressure in bar, as the source states it (recorded, not pair-checked). */
  burstPressureBar?: number;
  /** Fluids the port is rated for, e.g. ["compressed_air"], ["water", "oil"]. */
  fluids?: string[];
  /** Fluid temperature range in °C. */
  fluidTemperatureC?: [number, number];
  /** Seal at the joint, e.g. "thread_sealant", "o_ring", "bonded_washer". */
  seal?: string;
  /** Anything else the source states (port label, function in the circuit). */
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
  maxInstances?: number;
}

/** The `fluid_joint` trait's params, as written by FluidPort and read by the pair check. */
export interface FluidJointParams {
  kind: FluidJoint["kind"];
  standard?: string;
  size?: string;
  gender?: "male" | "female";
  style?: string;
}

/**
 * One fluid port: a leaf in the `pneumatic` or `hydraulic` domain with the
 * medium as its protocol type and the flow role, the `fluid_joint` trait and
 * the pressure and tube parameters.
 */
export function FluidPort(config: FluidPortConfig): InterfaceDef {
  const j = config.joint;
  const parameters: Parameter[] = [];
  if (config.pressureBar !== undefined) parameters.push(pressureBar(config.pressureBar));
  if (j.kind === "push_to_connect" || j.kind === "tube") parameters.push(tubeOdMm(j.tubeOdMm));
  if (j.kind === "barb") parameters.push(tubeIdMm(j.tubeIdMm));
  if (j.kind === "tube" && j.tubeIdMm !== undefined) parameters.push(tubeIdMm(j.tubeIdMm));

  const joint: FluidJointParams = {
    kind: j.kind,
    ...(j.kind === "thread" ? { standard: j.standard, size: j.size, gender: j.gender } : {}),
    ...(j.kind === "quick_coupler" ? { style: j.style, gender: j.gender } : {}),
  };
  const traits: TraitDef[] = [{ type: "fluid_joint", params: { ...joint } }];
  const fluid = {
    ...(config.fluids !== undefined ? { fluids: config.fluids } : {}),
    ...(config.fluidTemperatureC !== undefined ? { temperature_C: config.fluidTemperatureC } : {}),
    ...(config.burstPressureBar !== undefined ? { burst_pressure_bar: config.burstPressureBar } : {}),
    ...(config.seal !== undefined ? { seal: config.seal } : {}),
    ...(config.note !== undefined ? { note: config.note } : {}),
  };
  if (Object.keys(fluid).length > 0) traits.push({ type: "fluid", params: fluid });

  return {
    id: config.id,
    ...(config.name !== undefined ? { name: config.name } : {}),
    domain: config.medium,
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? true,
    protocols: [{ type: config.medium, roles: [config.role] }],
    capabilities: ["fluid_port", `fluid_${j.kind}`],
    ...(parameters.length > 0 ? { parameters } : {}),
    max_instances: config.maxInstances ?? 1,
    traits,
  };
}
