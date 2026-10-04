import type { InterfaceDef } from "../types/interface.js";
import type { Diagnostic } from "./types.js";
import { getEffectiveRange } from "../parameters/range.js";

/**
 * Pair checks for the drive-train and fastening vocabulary (PB-866,
 * mechanical round; `protocols/drive.ts`):
 *
 * - `gear_mesh`: two gears with a different module or pressure angle
 *   (error); kinds that do not go together (two racks, two internal gears,
 *   a spur gear against a helical one, a bevel against a spur, a worm
 *   without its wheel); helical gears on parallel shafts whose helix angles
 *   differ or whose hands are the same; an internal gear against a pinion
 *   with as many teeth or more. Otherwise an info with the ratio, the centre
 *   distance and the engaged face width.
 * - `bearing_fit`: a bearing whose outside diameter is not the seat's
 *   (error, within 0.05 mm); a kind the seat is not made for (warning); a
 *   bearing wider than a blind seat is deep (info: it stands proud).
 * - `thread_fit`: threads of a different diameter, pitch or hand (error);
 *   otherwise an info with the engaged length when both state a length.
 * - `t_slot_fit`: an insert whose neck does not pass the track's opening,
 *   whose head is no wider than the opening (nothing holds it) or wider or
 *   taller than the channel (errors); an insert that only slides in from an
 *   end on a track that only takes drop-in hardware (error); different named
 *   profiles when the dimensions cannot be compared (warning).
 * - `axial_face`: two faces whose annuli do not overlap (one passes inside
 *   the other: error), or that turn relative to each other (warning: they rub).
 * - `rolling_contact`: a wheel smaller than the surface is made for (error).
 */
export function checkPairDrive(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  return [...gearMesh(a, b), ...bearingFit(a, b), ...threadFit(a, b), ...tSlotFit(a, b), ...axialFace(a, b), ...rollingContact(a, b)];
}

/** Parameters `checkPairDrive` compares itself, by protocol: the pairwise overlap check skips them for that pair. */
const DRIVE_CHECKED: Record<string, string[]> = {
  gear_mesh: ["gear_module", "pressure_angle", "tooth_count", "face_width"],
  bearing_fit: ["bearing_od", "bearing_width", "bearing_bore", "seat_depth", "load_rating"],
  thread: ["fastener_diameter", "thread_pitch", "thread_length"],
  t_slot: ["slot_opening", "channel_width", "channel_depth", "slot_length", "neck_width", "head_width", "head_height"],
  axial_stop: ["face_od", "face_id", "axial_length"],
  rolling_contact: ["wheel_diameter", "tread_width", "load_rating", "min_wheel_diameter"],
};

/** The drive-checked parameters of this pair (both ends speak the same drive protocol). */
export function driveCheckedParams(a: InterfaceDef, b: InterfaceDef): Set<string> {
  for (const [protocol, ids] of Object.entries(DRIVE_CHECKED)) if (speaks(a, protocol) && speaks(b, protocol)) return new Set(ids);
  return new Set();
}

const TOL_MM = 0.05;

const speaks = (iface: InterfaceDef, type: string) => iface.protocols.some((p) => p.type === type);
const rolesOf = (iface: InterfaceDef, type: string) => new Set(iface.protocols.filter((p) => p.type === type).flatMap((p) => p.roles));
const trait = (iface: InterfaceDef, type: string): Record<string, unknown> => (iface.traits?.find((t) => t.type === type)?.params as Record<string, unknown>) ?? {};
const range = (iface: InterfaceDef, id: string): [number, number] | undefined => {
  const p = iface.parameters?.find((x) => x.id === id);
  return (p && getEffectiveRange(p)) ?? undefined;
};
const value = (iface: InterfaceDef, id: string): number | undefined => {
  const r = range(iface, id);
  return r ? r[0] : undefined;
};
const fmt = (v: number) => `${+v.toFixed(3)}`;
const fmtR = (r: [number, number]) => (Math.abs(r[1] - r[0]) <= 1e-9 ? fmt(r[0]) : `${fmt(r[0])}–${fmt(r[1])}`);
const diag = (severity: Diagnostic["severity"], code: string, message: string, a: InterfaceDef, b: InterfaceDef): Diagnostic => ({ severity, code, message, refs: [a.id, b.id] });
const overlaps = (x: [number, number], y: [number, number], tol: number) => x[0] <= y[1] + tol && y[0] <= x[1] + tol;

// ---------------------------------------------------------------------------
// Gears
// ---------------------------------------------------------------------------

/** Kinds that mesh with each other (unordered). */
const GEAR_MATES: Record<string, string[]> = {
  spur: ["spur", "internal", "rack"],
  helical: ["helical", "internal", "rack"],
  internal: ["spur", "helical"],
  rack: ["spur", "helical"],
  bevel: ["bevel"],
  worm: ["worm_wheel"],
  worm_wheel: ["worm"],
};

function gearMesh(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "gear_mesh") || !speaks(b, "gear_mesh")) return [];
  const [ta, tb] = [trait(a, "gear_mesh"), trait(b, "gear_mesh")];
  const [ka, kb] = [String(ta.kind ?? "spur"), String(tb.kind ?? "spur")];
  const err = (why: string) => [diag("error", "gear_mesh", why, a, b)];
  const [ma, mb] = [value(a, "gear_module"), value(b, "gear_module")];
  if (ma !== undefined && mb !== undefined && Math.abs(ma - mb) > 1e-3 * Math.max(ma, mb)) return err(`module ${fmt(ma)} mm and module ${fmt(mb)} mm teeth do not mesh`);
  const [pa, pb] = [value(a, "pressure_angle"), value(b, "pressure_angle")];
  if (pa !== undefined && pb !== undefined && Math.abs(pa - pb) > 0.01) return err(`pressure angles ${fmt(pa)}° and ${fmt(pb)}° do not mesh`);
  if (!(GEAR_MATES[ka] ?? []).includes(kb)) return err(`a ${ka.replace(/_/g, " ")} gear does not mesh with a ${kb.replace(/_/g, " ")} gear`);
  const [za, zb] = [value(a, "tooth_count"), value(b, "tooth_count")];
  if (ka === "helical" && kb === "helical") {
    const [ha, hb] = [Number(ta.helix_angle_deg), Number(tb.helix_angle_deg)];
    if (Math.abs(ha - hb) > 0.01) return err(`helix angles ${fmt(ha)}° and ${fmt(hb)}° differ: helical gears on parallel shafts need the same angle`);
    if (ta.hand !== undefined && ta.hand === tb.hand) return err(`both are ${ta.hand}-hand: helical gears on parallel shafts need opposite hands`);
  }
  if ((ka === "internal" || kb === "internal") && za !== undefined && zb !== undefined) {
    const [ring, pinion] = ka === "internal" ? [za, zb] : [zb, za];
    if (pinion >= ring) return err(`a ${pinion}-tooth pinion does not fit inside a ${ring}-tooth internal gear`);
  }
  if (ma === undefined || za === undefined || zb === undefined) return [];
  const parts: string[] = [];
  if (ka === "rack" || kb === "rack") {
    const z = ka === "rack" ? zb : za;
    parts.push(`the pinion's axis sits ${fmt((ma * z) / 2)} mm from the rack's pitch line; ${fmt(Math.PI * ma * z)} mm of travel per turn`);
  } else if (ka === "worm" || kb === "worm") {
    const [worm, wheel] = ka === "worm" ? [za, zb] : [zb, za];
    parts.push(`ratio ${fmt(wheel / worm)}:1 (${wheel} teeth, ${worm} start${worm === 1 ? "" : "s"})`);
  } else {
    const internal = ka === "internal" || kb === "internal";
    const beta = ka === "helical" ? (Number(ta.helix_angle_deg) * Math.PI) / 180 : 0;
    const centre = ((internal ? Math.abs(za - zb) : za + zb) * ma) / (2 * Math.cos(beta));
    parts.push(`ratio ${za}:${zb} (${fmt(zb / za)}); centre distance ${fmt(centre)} mm`);
  }
  const [fa, fb] = [value(a, "face_width"), value(b, "face_width")];
  if (fa !== undefined && fb !== undefined) parts.push(`engaged face width ${fmt(Math.min(fa, fb))} mm`);
  return [diag("info", "gear_mesh", parts.join("; "), a, b)];
}

// ---------------------------------------------------------------------------
// Bearings
// ---------------------------------------------------------------------------

function bearingFit(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "bearing_fit") || !speaks(b, "bearing_fit")) return [];
  const [bearing, seat] = rolesOf(a, "bearing_fit").has("bearing") ? [a, b] : [b, a];
  if (!rolesOf(seat, "bearing_fit").has("seat") || !rolesOf(bearing, "bearing_fit").has("bearing")) return [];
  const out: Diagnostic[] = [];
  const [od, seatOd] = [range(bearing, "bearing_od"), range(seat, "bearing_od")];
  if (od && seatOd && !overlaps(od, seatOd, TOL_MM)) {
    return [diag("error", "bearing_fit", `a Ø${fmtR(od)} mm bearing does not fit a Ø${fmtR(seatOd)} mm seat`, bearing, seat)];
  }
  const [tb, ts] = [trait(bearing, "bearing_fit"), trait(seat, "bearing_fit")];
  const kinds = Array.isArray(ts.kinds) ? ts.kinds.map(String) : [];
  if (kinds.length && tb.kind !== undefined && !kinds.includes(String(tb.kind))) {
    out.push(diag("warning", "bearing_fit", `the seat is made for ${kinds.join(" or ")} bearings, not a ${tb.kind} bearing`, bearing, seat));
  }
  const [w, depth] = [value(bearing, "bearing_width"), value(seat, "seat_depth")];
  if (w !== undefined && depth !== undefined && !ts.through && w > depth + TOL_MM) {
    const flange = tb.flange_od_mm !== undefined ? " (its flange outside the seat)" : "";
    out.push(diag("info", "bearing_fit", `the ${fmt(w)} mm wide bearing stands ${fmt(w - depth)} mm proud of the ${fmt(depth)} mm deep seat${flange}`, bearing, seat));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

function threadFit(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "thread") || !speaks(b, "thread")) return [];
  const [ta, tb] = [trait(a, "thread"), trait(b, "thread")];
  const name = (t: Record<string, unknown>) => String(t.designation ?? "thread");
  const err = (why: string) => [diag("error", "thread_fit", `${name(ta)} and ${name(tb)} do not fit: ${why}`, a, b)];
  const [da, db] = [range(a, "fastener_diameter"), range(b, "fastener_diameter")];
  if (da && db && !overlaps(da, db, TOL_MM)) return err(`diameters ${fmtR(da)} mm and ${fmtR(db)} mm`);
  const [pa, pb] = [range(a, "thread_pitch"), range(b, "thread_pitch")];
  if (pa && pb && !overlaps(pa, pb, 0.005)) return err(`pitches ${fmtR(pa)} mm and ${fmtR(pb)} mm`);
  if ((ta.hand ?? "right") !== (tb.hand ?? "right")) return err(`a ${ta.hand ?? "right"}-hand and a ${tb.hand ?? "right"}-hand thread`);
  const [la, lb] = [value(a, "thread_length"), value(b, "thread_length")];
  if (la === undefined || lb === undefined) return [];
  const internal = rolesOf(a, "thread").has("internal") ? a : b;
  const ti = internal === a ? ta : tb;
  const [li, le] = internal === a ? [la, lb] : [lb, la];
  const engaged = ti.through ? Math.min(li, le) : Math.min(li, le);
  return [diag("info", "thread_fit", `up to ${fmt(engaged)} mm of thread engaged (${fmt(le)} mm external, ${fmt(li)} mm internal${ti.through ? ", through" : ""})`, a, b)];
}

// ---------------------------------------------------------------------------
// T-slots
// ---------------------------------------------------------------------------

const normProfile = (s: unknown) => String(s ?? "").replace(/[\s_-]/g, "").toLowerCase();

function tSlotFit(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "t_slot") || !speaks(b, "t_slot")) return [];
  const [track, insert] = rolesOf(a, "t_slot").has("track") ? [a, b] : [b, a];
  if (!rolesOf(track, "t_slot").has("track") || !rolesOf(insert, "t_slot").has("insert")) return [];
  const [tt, ti] = [trait(track, "t_slot"), trait(insert, "t_slot")];
  const err = (why: string) => diag("error", "t_slot_fit", why, track, insert);
  const out: Diagnostic[] = [];
  const opening = value(track, "slot_opening");
  const [neck, head, height] = [value(insert, "neck_width"), value(insert, "head_width"), value(insert, "head_height")];
  const [cw, cd] = [value(track, "channel_width"), value(track, "channel_depth")];
  let compared = false;
  if (opening !== undefined && neck !== undefined) {
    compared = true;
    if (neck > opening + TOL_MM) out.push(err(`the ${fmt(neck)} mm neck does not pass the ${fmt(opening)} mm opening`));
  }
  if (opening !== undefined && head !== undefined) {
    compared = true;
    if (head <= opening + TOL_MM) out.push(err(`the ${fmt(head)} mm head passes through the ${fmt(opening)} mm opening: the lips do not hold it`));
  }
  if (cw !== undefined && head !== undefined) {
    compared = true;
    if (head > cw + TOL_MM) out.push(err(`the ${fmt(head)} mm head is wider than the ${fmt(cw)} mm channel`));
  }
  if (cd !== undefined && height !== undefined) {
    compared = true;
    if (height > cd + TOL_MM) out.push(err(`the ${fmt(height)} mm head is taller than the ${fmt(cd)} mm channel is deep`));
  }
  const [et, ei] = [Array.isArray(tt.entry) ? tt.entry.map(String) : [], Array.isArray(ti.entry) ? ti.entry.map(String) : []];
  if (et.length && ei.length && !ei.some((e) => et.includes(e))) out.push(err(`the insert goes in ${ei.join(" or ")}; the track takes ${et.join(" or ")}`.replace(/drop_in/g, "drop-in").replace(/\bend\b/g, "from an end")));
  if (!compared && tt.profile !== undefined && ti.profile !== undefined && normProfile(tt.profile) !== normProfile(ti.profile)) {
    out.push(diag("warning", "t_slot_fit", `the track is a ${tt.profile} slot and the insert is made for ${ti.profile}: no dimensions to compare`, track, insert));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Axial faces
// ---------------------------------------------------------------------------

function axialFace(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "axial_stop") || !speaks(b, "axial_stop")) return [];
  const [oa, ob, ia, ib] = [value(a, "face_od"), value(b, "face_od"), value(a, "face_id"), value(b, "face_id")];
  if (oa === undefined || ob === undefined) return [];
  const contactOd = Math.min(oa, ob);
  const contactId = Math.max(ia ?? 0, ib ?? 0);
  if (contactOd <= contactId + TOL_MM) {
    return [diag("error", "axial_face", `the faces do not touch: a Ø${fmt(contactOd)} mm face passes inside the other's Ø${fmt(contactId)} mm bore`, a, b)];
  }
  const [ta, tb] = [trait(a, "axial_stop"), trait(b, "axial_stop")];
  if (ta.turns_with !== undefined && tb.turns_with !== undefined && ta.turns_with !== tb.turns_with) {
    return [diag("warning", "axial_face", `one face turns with the ${ta.turns_with}, the other with the ${tb.turns_with}: they rub (touch only the bearing's inner ring, or use a thrust washer)`, a, b)];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Wheels
// ---------------------------------------------------------------------------

function rollingContact(a: InterfaceDef, b: InterfaceDef): Diagnostic[] {
  if (!speaks(a, "rolling_contact") || !speaks(b, "rolling_contact")) return [];
  const [wheel, surface] = rolesOf(a, "rolling_contact").has("wheel") ? [a, b] : [b, a];
  const [d, min] = [value(wheel, "wheel_diameter"), value(surface, "min_wheel_diameter")];
  if (d !== undefined && min !== undefined && d + TOL_MM < min) return [diag("error", "rolling_contact", `a Ø${fmt(d)} mm wheel is smaller than the Ø${fmt(min)} mm the surface is made for`, wheel, surface)];
  return [];
}
