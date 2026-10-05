import type { InterfaceDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { Shaft, type ShaftProfile } from "./mechanical.js";
import {
  axialLengthMm,
  bearingBoreMm,
  bearingOdMm,
  bearingWidthMm,
  faceIdMm,
  faceOdMm,
  faceWidthMm,
  fastenerDiameterMm,
  gearModuleMm,
  loadRatingN,
  pressureAngleDeg,
  seatDepthMm,
  slotLengthMm,
  slotOpeningMm,
  threadLengthMm,
  threadPitchMm,
  toothCount,
  treadWidthMm,
  wheelDiameterMm,
} from "./params.js";

/**
 * Drive-train and fastening vocabulary: gears,
 * bearings and the seats that hold them, threads, T-slot tracks and what
 * slides in them, axial faces (spacers, collars, hubs), and wheels.
 *
 * Every builder emits one interface in the mechanical domain with a
 * protocol whose role table is complete (`src/matching/roles.ts`): gears
 * mesh with gears, a bearing goes in a seat, an external thread into an
 * internal one, an insert into a track, a face against a face, a wheel on a
 * surface. The pair checks in `drc/drive-check.ts` compare what parameters
 * cannot (docs/mechanical-interfaces.md).
 */

const mech = (
  id: string,
  name: string | undefined,
  protocol: string,
  role: string,
  parameters: Parameter[],
  trait: Record<string, unknown>,
  extra: { capabilities?: string[]; exposed?: boolean; defaultActive?: boolean; maxInstances?: number } = {},
): InterfaceDef => {
  const params = Object.fromEntries(Object.entries(trait).filter(([, v]) => v !== undefined));
  return {
    id,
    ...(name !== undefined ? { name } : {}),
    domain: "mechanical",
    exposed: extra.exposed ?? true,
    default_active: extra.defaultActive ?? true,
    protocols: [{ type: protocol, roles: [role] }],
    capabilities: extra.capabilities ?? [protocol],
    ...(parameters.length ? { parameters } : {}),
    ...(extra.maxInstances !== undefined ? { max_instances: extra.maxInstances } : {}),
    traits: [{ type: protocol, params }],
  };
};

const r6 = (v: number) => Number(v.toFixed(6));

// ---------------------------------------------------------------------------
// Gears
// ---------------------------------------------------------------------------

/**
 * - spur: straight teeth on parallel shafts.
 * - helical: teeth at `helixAngleDeg`; two helical gears on parallel shafts
 *   need the same angle and opposite hands.
 * - internal: a ring gear's inward teeth; it meshes with a smaller external
 *   spur or helical gear.
 * - rack: straight teeth on a bar (`teeth` counts its length).
 * - bevel, worm, worm_wheel: shafts at an angle; bevel meshes bevel, a worm
 *   meshes a worm wheel.
 */
export type GearKind = "spur" | "helical" | "internal" | "rack" | "bevel" | "worm" | "worm_wheel";

export interface GearConfig {
  /** Interface id. Defaults to "teeth". */
  id?: string;
  name?: string;
  /** Default "spur". */
  kind?: GearKind;
  /** Module in mm (pitch diameter ÷ teeth; the normal module of a helical gear). Give this or `diametralPitch`. */
  moduleMm?: number;
  /** Diametral pitch in teeth per inch (inch gears: 32 DP, 20 DP). Stored as module 25.4 / P. */
  diametralPitch?: number;
  /** Pressure angle in degrees (20, 14.5, 25). */
  pressureAngleDeg: number;
  /** Tooth count (a worm: its starts). */
  teeth: number;
  /** Face width of the teeth in mm. */
  faceWidthMm?: number;
  /** Helical and worm: helix (lead) angle in degrees. */
  helixAngleDeg?: number;
  /** Helical and worm: hand of the helix. */
  hand?: "left" | "right";
  /** Material as the source states it ("acetal", "7075 aluminium"). */
  material?: string;
  /** Anything else the source states (backlash, profile shift, quality grade). */
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A gear's teeth: protocol `gear_mesh`, role `mesh`, with `gear_module`,
 * `pressure_angle`, `tooth_count` and `face_width`, and a `gear_mesh` trait
 * (kind, pitch system, pitch and outside diameters, helix). Two gears mesh
 * only with the same module and pressure angle and kinds that go together
 * (`gear_mesh` pair check, which also states the ratio and centre distance).
 * The bore or hub that carries the gear is a separate `Shaft`.
 */
export function Gear(config: GearConfig): InterfaceDef {
  const id = config.id ?? "teeth";
  const fail = (why: string): never => {
    throw new Error(`Gear ${id}: ${why}`);
  };
  const kind = config.kind ?? "spur";
  if ((config.moduleMm === undefined) === (config.diametralPitch === undefined)) fail("give moduleMm or diametralPitch (one of them)");
  const module = config.moduleMm ?? r6(25.4 / config.diametralPitch!);
  if (!(module > 0)) fail("the module must be positive");
  if (!(config.pressureAngleDeg > 0 && config.pressureAngleDeg < 45)) fail("pressureAngleDeg is in degrees, between 0 and 45");
  if (!Number.isInteger(config.teeth) || config.teeth < 1) fail("teeth is a whole number");
  const helical = kind === "helical" || kind === "worm" || kind === "worm_wheel";
  if (!helical && (config.helixAngleDeg !== undefined || config.hand !== undefined)) fail(`a ${kind} gear has no helix`);
  if (kind === "helical" && (config.helixAngleDeg === undefined || config.hand === undefined)) fail("a helical gear needs helixAngleDeg and hand");
  const beta = ((kind === "helical" ? config.helixAngleDeg! : 0) * Math.PI) / 180;
  const pitchD = kind === "rack" || kind === "worm" ? undefined : r6((module * config.teeth) / Math.cos(beta));
  const outsideD = pitchD === undefined ? undefined : r6(kind === "internal" ? pitchD - 2 * module : pitchD + 2 * module);
  const parameters: Parameter[] = [gearModuleMm(module), pressureAngleDeg(config.pressureAngleDeg), toothCount(config.teeth)];
  if (config.faceWidthMm !== undefined) parameters.push(faceWidthMm(config.faceWidthMm));
  return mech(
    id,
    config.name,
    "gear_mesh",
    "mesh",
    parameters,
    {
      kind,
      pitch_system: config.diametralPitch !== undefined ? "diametral_pitch" : "module",
      diametral_pitch: config.diametralPitch,
      pitch_diameter_mm: pitchD,
      [kind === "internal" ? "inside_diameter_mm" : "outside_diameter_mm"]: outsideD,
      helix_angle_deg: config.helixAngleDeg,
      hand: config.hand,
      material: config.material,
      note: config.note,
    },
    { capabilities: ["gear_mesh", `${kind}_gear`], exposed: config.exposed, defaultActive: config.defaultActive, maxInstances: 1 },
  );
}

// ---------------------------------------------------------------------------
// Bearings and seats
// ---------------------------------------------------------------------------

/** Rolling-element kinds, and `plain` for a bushing or sleeve bearing (bronze, PTFE, acetal). */
export type BearingKind = "ball" | "roller" | "needle" | "tapered_roller" | "thrust" | "plain";

export interface BearingConfig {
  /** Id of the outside (the ring a seat holds). Defaults to "outer". */
  id?: string;
  name?: string;
  kind: BearingKind;
  /** Designation as the source writes it ("608-2RS", "MR105ZZ", "flanged bronze bushing 5 x 8 x 6"). */
  designation?: string;
  /** Bore in mm (across flats for a hex bore). */
  boreMm: number;
  /** Outside diameter in mm. */
  odMm: number;
  /** Width of the outer ring in mm (a plain bearing's length, without its flange). */
  widthMm: number;
  /** A flanged bearing: the flange's outside diameter and thickness in mm. */
  flange?: { odMm: number; widthMm: number };
  seals?: "open" | "shielded" | "sealed";
  material?: string;
  /** Dynamic (C) and static (C0) load ratings in N. */
  dynamicLoadN?: number;
  staticLoadN?: number;
  /** Highest speed the source rates, in rpm. */
  maxRpm?: number;
  /**
   * The bore as a `Shaft` bore (role bidirectional: the bearing carries the
   * shaft, it does not drive it). Default: a round bore of `boreMm` with id
   * "bore". `false` leaves it out (a bearing modelled inside a larger part
   * that declares its own bore).
   */
  bore?: false | { id?: string; name?: string; profile?: ShaftProfile; note?: string };
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A bearing: its outside as protocol `bearing_fit` role `bearing`
 * (`bearing_od`, `bearing_width`, `bearing_bore`, load ratings as
 * `load_rating` in the trait), and its bore as a `Shaft` bore. It goes in a
 * `BearingSeat` of the same outside diameter (`bearing_fit` pair check).
 */
export function Bearing(config: BearingConfig): InterfaceDef[] {
  const id = config.id ?? "outer";
  const fail = (why: string): never => {
    throw new Error(`Bearing ${id}: ${why}`);
  };
  if (!(config.odMm > config.boreMm && config.boreMm > 0)) fail("the outside diameter must be larger than the bore");
  if (!(config.widthMm > 0)) fail("widthMm must be positive");
  if (config.flange && !(config.flange.odMm > config.odMm)) fail("a flange is larger than the outside diameter");
  const parameters: Parameter[] = [bearingOdMm(config.odMm), bearingWidthMm(config.widthMm), bearingBoreMm(config.boreMm)];
  if (config.dynamicLoadN !== undefined) parameters.push(loadRatingN(config.dynamicLoadN));
  const outer = mech(
    id,
    config.name ?? `${config.kind === "plain" ? "Plain bearing" : "Bearing"} outside Ø${config.odMm}`,
    "bearing_fit",
    "bearing",
    parameters,
    {
      kind: config.kind,
      designation: config.designation,
      flange_od_mm: config.flange?.odMm,
      flange_width_mm: config.flange?.widthMm,
      seals: config.seals,
      material: config.material,
      dynamic_load_n: config.dynamicLoadN,
      static_load_n: config.staticLoadN,
      max_rpm: config.maxRpm,
      note: config.note,
    },
    { capabilities: ["bearing_fit", `${config.kind}_bearing`], exposed: config.exposed, defaultActive: config.defaultActive, maxInstances: 1 },
  );
  if (config.bore === false) return [outer];
  const b = config.bore ?? {};
  return [
    outer,
    Shaft({
      id: b.id ?? "bore",
      name: b.name ?? `Bearing bore Ø${config.boreMm}`,
      role: "bidirectional",
      gender: "bore",
      profile: b.profile ?? "round",
      diameterMm: config.boreMm,
      note: b.note ?? `The bearing's ${config.kind === "plain" ? "bore" : "inner ring"}: it carries the shaft and turns with it${config.kind === "plain" ? " (a plain bearing: the shaft turns in it)" : ""}.`,
    }),
  ];
}

export interface BearingSeatConfig {
  /** Interface id. Defaults to "seat". */
  id?: string;
  name?: string;
  /** The bearing outside diameter the seat takes, in mm ([min, max] for a seat made for several). */
  odMm: number | [number, number];
  /** Depth of the seat in mm (the counterbore's depth, or the wall thickness of a through seat). */
  depthMm?: number;
  /** A through bore (the bearing can sit at either face) rather than a blind counterbore. */
  through?: boolean;
  /** How the bearing is held: a press fit, a slip fit with a shoulder, a snap ring, or its own flange against the face. */
  retention?: "press" | "slip" | "shoulder" | "snap_ring" | "flange";
  /** Bearing kinds the source says the seat is for. */
  kinds?: BearingKind[];
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A bearing seat (a housing bore, a bracket's bearing pocket): protocol
 * `bearing_fit`, role `seat`, with `bearing_od` and `seat_depth`. It takes
 * a bearing whose outside diameter it states (`bearing_fit` pair check).
 */
export function BearingSeat(config: BearingSeatConfig): InterfaceDef {
  const id = config.id ?? "seat";
  const parameters: Parameter[] = [bearingOdMm(config.odMm)];
  if (config.depthMm !== undefined) parameters.push(seatDepthMm(config.depthMm));
  const od = Array.isArray(config.odMm) ? `${config.odMm[0]}–${config.odMm[1]}` : `${config.odMm}`;
  return mech(
    id,
    config.name ?? `Bearing seat Ø${od}`,
    "bearing_fit",
    "seat",
    parameters,
    { through: config.through, retention: config.retention, kinds: config.kinds, note: config.note },
    { exposed: config.exposed, defaultActive: config.defaultActive },
  );
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

/** What carries the thread, as the source describes the part. */
export type ThreadedKind = "screw" | "bolt" | "set_screw" | "stud" | "threaded_rod" | "standoff" | "nut" | "tapped_hole" | "insert";

export interface ThreadConfig {
  /** Interface id. Defaults to "thread". */
  id?: string;
  name?: string;
  /** External (a screw, a stud) or internal (a nut, a tapped hole, an insert). */
  gender: "external" | "internal";
  /** Designation as the source writes it ("M3 x 0.5", "1/4-20 UNC", "#10-32 UNF"). */
  designation: string;
  /** Nominal (major) diameter in mm. */
  diameterMm: number;
  /** Thread pitch in mm. Give this or `tpi`, or neither when the source states no pitch (say so in an assumption). */
  pitchMm?: number;
  /** Threads per inch (unified threads); stored as pitch 25.4 / tpi. */
  tpi?: number;
  /** Thread length in mm: an external thread's threaded length, an internal thread's depth (a nut's height). */
  lengthMm?: number;
  /** An internal thread open at both ends (a nut, a through-tapped hole). */
  through?: boolean;
  /** Default "right". */
  hand?: "right" | "left";
  kind?: ThreadedKind;
  /** A thread-locking feature: a nylon insert (nyloc), a nylon or adhesive patch. */
  lock?: "nylon_insert" | "nylon_patch" | "adhesive_patch" | "all_metal";
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A screw thread: protocol `thread`, role `external` or `internal`, with
 * `fastener_diameter`, `thread_pitch` and `thread_length`. An external
 * thread goes into an internal one of the same diameter, pitch and hand
 * (`thread_fit` pair check, which also states the engaged length). The
 * head, a hex or a drive recess is not a thread: describe it in the part's
 * metadata, or as a `TSlot` insert when it slides in a track.
 */
export function Thread(config: ThreadConfig): InterfaceDef {
  const id = config.id ?? "thread";
  const fail = (why: string): never => {
    throw new Error(`Thread ${id}: ${why}`);
  };
  if (config.pitchMm !== undefined && config.tpi !== undefined) fail("give pitchMm or tpi, not both");
  if (config.through && config.gender !== "internal") fail("through is for an internal thread");
  const pitch = config.pitchMm ?? (config.tpi !== undefined ? r6(25.4 / config.tpi) : undefined);
  const parameters: Parameter[] = [fastenerDiameterMm(config.diameterMm)];
  if (pitch !== undefined) parameters.push(threadPitchMm(pitch));
  if (config.lengthMm !== undefined) parameters.push(threadLengthMm(config.lengthMm));
  return mech(
    id,
    config.name ?? `${config.designation} ${config.gender} thread`,
    "thread",
    config.gender,
    parameters,
    {
      designation: config.designation,
      ...(config.tpi !== undefined ? { tpi: config.tpi } : {}),
      hand: config.hand ?? "right",
      kind: config.kind,
      through: config.through,
      lock: config.lock,
      note: config.note,
    },
    { capabilities: ["thread", `${config.gender}_thread`], exposed: config.exposed, defaultActive: config.defaultActive },
  );
}

// ---------------------------------------------------------------------------
// T-slot tracks
// ---------------------------------------------------------------------------

export interface TSlotConfig {
  /** Interface id. Defaults to "t_slot". */
  id?: string;
  name?: string;
  /**
   * "track": the channel (an extrusion's slot, a linear track, a slotted
   * rail). "insert": what slides in it and is held by its lips (a T-nut, a
   * screw head, a slide or carriage foot).
   */
  role: "track" | "insert";
  /** The profile as the source names it ("15 mm extrusion", "2020 B-type slot 6", "10 series"). */
  profile?: string;
  /** Track: the opening between the lips, in mm. */
  openingMm?: number;
  /** Track: the channel's inside width under the lips, and its depth below them, in mm. */
  channelWidthMm?: number;
  channelDepthMm?: number;
  /** Track: usable length in mm. */
  lengthMm?: number;
  /** Insert: the neck that passes through the opening, its width in mm. */
  neckWidthMm?: number;
  /** Insert: the head held under the lips, its width (across the slot) and height in mm. */
  headWidthMm?: number;
  headHeightMm?: number;
  /** How an insert goes in: slid in from an open end, or dropped in and turned (a roll-in or hammer nut). Track: which it allows. */
  entry?: ("end" | "drop_in")[];
  /** The fastener the insert carries or the track is made for ("M3"), with its nominal diameter in mm. */
  fastener?: string;
  fastenerDiameterMm?: number;
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A T-slot (or other undercut linear track) and what it holds: protocol
 * `t_slot`, role `track` or `insert`. The track states its opening, channel
 * width and depth and length; the insert its neck and head. The pair check
 * `t_slot_fit` requires the neck to pass the opening, the head to be wider
 * than the opening (so the lips hold it) and to fit the channel, and an
 * entry both allow. Where the track is also a place to bolt things (a
 * bracket's row of holes against the slot), keep its `BoltPattern` slot as
 * well: that pairs with hole patterns, this with the hardware in the slot.
 */
export function TSlot(config: TSlotConfig): InterfaceDef {
  const id = config.id ?? "t_slot";
  const fail = (why: string): never => {
    throw new Error(`TSlot ${id}: ${why}`);
  };
  const track = config.role === "track";
  const trackOnly = ["openingMm", "channelWidthMm", "channelDepthMm", "lengthMm"] as const;
  const insertOnly = ["neckWidthMm", "headWidthMm", "headHeightMm"] as const;
  for (const k of track ? insertOnly : trackOnly) if (config[k] !== undefined) fail(`${k} is for ${track ? "an insert" : "a track"}`);
  if (track && config.openingMm === undefined && config.profile === undefined) fail("a track needs openingMm or a profile");
  if (!track && config.headWidthMm === undefined && config.profile === undefined) fail("an insert needs headWidthMm or a profile");
  const p: Parameter[] = [];
  const mm = (pid: string, v?: number) => v !== undefined && p.push({ id: pid, unit: "mm", value: v });
  if (track) {
    if (config.openingMm !== undefined) p.push(slotOpeningMm(config.openingMm));
    mm("channel_width", config.channelWidthMm);
    mm("channel_depth", config.channelDepthMm);
    if (config.lengthMm !== undefined) p.push(slotLengthMm(config.lengthMm));
  } else {
    mm("neck_width", config.neckWidthMm);
    mm("head_width", config.headWidthMm);
    mm("head_height", config.headHeightMm);
  }
  if (config.fastenerDiameterMm !== undefined) p.push(fastenerDiameterMm(config.fastenerDiameterMm));
  return mech(
    id,
    config.name ?? (track ? `T-slot${config.profile ? ` (${config.profile})` : ""}` : `T-slot insert${config.profile ? ` (${config.profile})` : ""}`),
    "t_slot",
    config.role,
    p,
    { profile: config.profile, entry: config.entry, fastener: config.fastener, note: config.note },
    { exposed: config.exposed, defaultActive: config.defaultActive },
  );
}

// ---------------------------------------------------------------------------
// Axial faces
// ---------------------------------------------------------------------------

/** What an axial face belongs to. */
export type AxialFaceKind = "spacer" | "collar" | "hub" | "bearing_inner" | "bearing_outer" | "shoulder" | "washer" | "housing";

export interface AxialFaceConfig {
  id: string;
  name?: string;
  kind: AxialFaceKind;
  /** Outside and inside diameter of the annular contact face, in mm. */
  odMm: number;
  idMm: number;
  /** Length of the part along the shaft in mm (a spacer's length), stated on one of its faces. */
  axialLengthMm?: number;
  /**
   * What the face turns with: "shaft" (a spacer, collar or hub on the shaft,
   * a bearing's inner ring) or "housing" (a bracket, a bearing's outer ring).
   * Faces that turn relative to each other rub (`axial_face`).
   */
  turnsWith?: "shaft" | "housing";
  /** A collar that clamps the shaft and takes axial load (set screw or clamp), rather than a loose spacer. */
  clamps?: boolean;
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * An annular face that stops or spaces parts along a shaft: protocol
 * `axial_stop`, role `face`, with `face_od`, `face_id` (and `axial_length`).
 * Two faces pair when they touch: their annuli overlap and they turn
 * together (`axial_face`). A spacer has two, one per end.
 */
export function AxialFace(config: AxialFaceConfig): InterfaceDef {
  if (!(config.odMm > config.idMm && config.idMm >= 0)) throw new Error(`AxialFace ${config.id}: odMm must be larger than idMm`);
  const parameters: Parameter[] = [faceOdMm(config.odMm), faceIdMm(config.idMm)];
  if (config.axialLengthMm !== undefined) parameters.push(axialLengthMm(config.axialLengthMm));
  return mech(
    config.id,
    config.name,
    "axial_stop",
    "face",
    parameters,
    { kind: config.kind, turns_with: config.turnsWith, clamps: config.clamps, note: config.note },
    { exposed: config.exposed, defaultActive: config.defaultActive },
  );
}

// ---------------------------------------------------------------------------
// Wheels
// ---------------------------------------------------------------------------

/**
 * - traction: a solid or treaded wheel that grips in its rolling direction.
 * - omni: rollers round the rim let it slide sideways.
 * - mecanum: rollers at 45° (a left or right hand).
 * - caster: a swivelling wheel; pneumatic: an air tyre; roller: a plain roller or idler.
 */
export type WheelKind = "traction" | "omni" | "mecanum" | "caster" | "pneumatic" | "roller";

export interface WheelConfig {
  /** Interface id. Defaults to "tread". */
  id?: string;
  name?: string;
  kind: WheelKind;
  diameterMm: number;
  treadWidthMm?: number;
  /** Tread material and hardness as the source states them ("TPE, 60A"). */
  tread?: string;
  /** Omni and mecanum: rollers round the rim. */
  rollers?: number;
  /** Mecanum: the hand of the rollers. */
  hand?: "left" | "right";
  /** Load rating in N, as the source states it. */
  loadRatingN?: number;
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A wheel's rolling contact: protocol `rolling_contact`, role `wheel`, with
 * `wheel_diameter`, `tread_width` and `load_rating`. It pairs with a
 * `RollingSurface` (a floor, a field tile, a rail, a belt). The hub that
 * carries it is a `Shaft` and its bolt holes `BoltPattern`s.
 */
export function Wheel(config: WheelConfig): InterfaceDef {
  const id = config.id ?? "tread";
  if (config.kind === "mecanum" && config.hand === undefined) throw new Error(`Wheel ${id}: a mecanum wheel needs its hand`);
  if (config.kind !== "mecanum" && config.hand !== undefined) throw new Error(`Wheel ${id}: hand is for a mecanum wheel`);
  if (config.rollers !== undefined && config.kind !== "omni" && config.kind !== "mecanum") throw new Error(`Wheel ${id}: rollers are for an omni or mecanum wheel`);
  const parameters: Parameter[] = [wheelDiameterMm(config.diameterMm)];
  if (config.treadWidthMm !== undefined) parameters.push(treadWidthMm(config.treadWidthMm));
  if (config.loadRatingN !== undefined) parameters.push(loadRatingN(config.loadRatingN));
  return mech(
    id,
    config.name ?? `${config.kind} wheel Ø${config.diameterMm}`,
    "rolling_contact",
    "wheel",
    parameters,
    { kind: config.kind, tread: config.tread, rollers: config.rollers, hand: config.hand, note: config.note },
    { capabilities: ["rolling_contact", `${config.kind}_wheel`], exposed: config.exposed, defaultActive: config.defaultActive, maxInstances: 1 },
  );
}

export interface RollingSurfaceConfig {
  /** Interface id. Defaults to "surface". */
  id?: string;
  name?: string;
  surface: "floor" | "field_tile" | "rail" | "belt" | "roller" | "other";
  /** The least wheel diameter the surface is made for (a rail's flange clearance, a gap in tiles), in mm. */
  minWheelDiameterMm?: number;
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/** The surface a wheel rolls on: protocol `rolling_contact`, role `surface`. */
export function RollingSurface(config: RollingSurfaceConfig): InterfaceDef {
  const parameters: Parameter[] = config.minWheelDiameterMm !== undefined ? [{ id: "min_wheel_diameter", unit: "mm", value: config.minWheelDiameterMm }] : [];
  return mech(config.id ?? "surface", config.name, "rolling_contact", "surface", parameters, { surface: config.surface, note: config.note }, { exposed: config.exposed, defaultActive: config.defaultActive });
}
