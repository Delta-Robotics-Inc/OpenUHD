/**
 * PB-866, mechanical round: gears, bearings and seats, bolt grids and
 * partial circles, threads, T-slots, axial faces, wheels and the round bore
 * clamped on a hex shaft.
 */
import { describe, expect, it } from "vitest";
import { holesFitOn, validatePair } from "../src/drc/index.js";
import {
  AxialFace,
  Bearing,
  BearingSeat,
  BoltPattern,
  Gear,
  RollingSurface,
  Shaft,
  TSlot,
  Thread,
  Wheel,
  defineModule,
  latticeHoles,
  type BoltPatternConfig,
} from "../src/protocols/index.js";
import { boltPatternHoles } from "../src/system/geometry.js";
import type { InterfaceDef, ModuleDef } from "../src/types/index.js";

const mod = (id: string, interfaces: InterfaceDef[]): ModuleDef => defineModule({ id, name: id, interfaces });
const connection = (a: ModuleDef, b: ModuleDef, protocol: string) => validatePair(a, b).connections.find((c) => c.protocol === protocol);
const diags = (a: ModuleDef, b: ModuleDef, protocol: string) => connection(a, b, protocol)?.diagnostics ?? [];
const codes = (a: ModuleDef, b: ModuleDef, protocol: string) => diags(a, b, protocol).map((d) => `${d.severity}:${d.code}`);

describe("gears", () => {
  const gear = (id: string, teeth: number, extra: Partial<Parameters<typeof Gear>[0]> = {}) =>
    mod(id, [Gear({ moduleMm: 0.75, pressureAngleDeg: 20, teeth, faceWidthMm: 11, ...extra })]);

  it("emits gear_mesh with module, pressure angle, teeth and face width; the trait carries the diameters", () => {
    const g = Gear({ moduleMm: 0.75, pressureAngleDeg: 20, teeth: 15, faceWidthMm: 11 });
    expect(g.protocols).toEqual([{ type: "gear_mesh", roles: ["mesh"] }]);
    expect(g.parameters!.map((p) => [p.id, p.value])).toEqual([["gear_module", 0.75], ["pressure_angle", 20], ["tooth_count", 15], ["face_width", 11]]);
    expect(g.traits![0].params).toMatchObject({ kind: "spur", pitch_system: "module", pitch_diameter_mm: 11.25, outside_diameter_mm: 12.75 });
    // a diametral pitch is stored as a module
    expect(Gear({ diametralPitch: 32, pressureAngleDeg: 20, teeth: 32 }).parameters![0]).toEqual({ id: "gear_module", unit: "mm", value: 0.79375 });
  });

  it("refuses a gear with no pitch, both pitches, or a helix on a spur gear", () => {
    expect(() => Gear({ pressureAngleDeg: 20, teeth: 10 })).toThrow(/moduleMm or diametralPitch/);
    expect(() => Gear({ moduleMm: 1, diametralPitch: 24, pressureAngleDeg: 20, teeth: 10 })).toThrow(/one of them/);
    expect(() => Gear({ moduleMm: 1, pressureAngleDeg: 20, teeth: 10, hand: "left" })).toThrow(/no helix/);
    expect(() => Gear({ kind: "helical", moduleMm: 1, pressureAngleDeg: 20, teeth: 10 })).toThrow(/helixAngleDeg and hand/);
  });

  it("two gears of one module and pressure angle mesh; the pair states the ratio and centre distance", () => {
    const c = connection(gear("g15", 15), gear("g72", 72, { faceWidthMm: 8 }), "gear_mesh")!;
    expect(c.state).toBe("valid");
    expect(c.diagnostics).toEqual([expect.objectContaining({ severity: "info", code: "gear_mesh", message: "15 teeth to 72: ratio 4.8:1; centre distance 32.625 mm; engaged face width 8 mm" })]);
  });

  it("another module or pressure angle does not mesh", () => {
    expect(codes(gear("a", 15), gear("b", 30, { moduleMm: 0.8 }), "gear_mesh")).toEqual(["error:gear_mesh"]);
    expect(diags(gear("a", 15), gear("b", 30, { pressureAngleDeg: 14.5 }), "gear_mesh")[0].message).toBe("pressure angles 20° and 14.5° do not mesh");
  });

  it("checks kinds: racks, internal gears, helical hands, worms", () => {
    const rack = gear("rack", 40, { kind: "rack" });
    expect(diags(gear("p", 20), rack, "gear_mesh")[0]).toMatchObject({ severity: "info", message: expect.stringMatching(/pitch line; 47.124 mm of travel per turn/) });
    expect(codes(rack, gear("rack2", 40, { kind: "rack" }), "gear_mesh")).toEqual(["error:gear_mesh"]);
    const ring = gear("ring", 60, { kind: "internal" });
    expect(diags(gear("p", 20), ring, "gear_mesh")[0].message).toMatch(/centre distance 15 mm/);
    expect(diags(gear("big", 60), ring, "gear_mesh")[0].message).toBe("a 60-tooth pinion does not fit inside a 60-tooth internal gear");
    const h = (hand: "left" | "right", angle = 15) => gear(`h${hand}${angle}`, 20, { kind: "helical", helixAngleDeg: angle, hand });
    expect(connection(h("left"), h("right"), "gear_mesh")!.state).toBe("valid");
    expect(diags(h("left"), h("left"), "gear_mesh")[0].message).toMatch(/opposite hands/);
    expect(diags(h("left"), h("right", 20), "gear_mesh")[0].message).toMatch(/same angle/);
    expect(codes(gear("s", 20), h("left"), "gear_mesh")).toEqual(["error:gear_mesh"]);
    expect(diags(gear("worm", 1, { kind: "worm" }), gear("wheel", 30, { kind: "worm_wheel" }), "gear_mesh")[0].message).toBe("ratio 30:1 (30 teeth, 1 start); engaged face width 11 mm");
  });
});

describe("bearings and seats", () => {
  const bearing = (od: number, extra: Partial<Parameters<typeof Bearing>[0]> = {}) =>
    mod(`bearing-${od}`, Bearing({ kind: "ball", designation: "x", boreMm: 5, odMm: od, widthMm: 4, ...extra }));
  const seat = (od: number | [number, number], extra: Partial<Parameters<typeof BearingSeat>[0]> = {}) => mod(`seat-${od}`, [BearingSeat({ odMm: od, ...extra })]);

  it("a bearing is an outside (bearing_fit) and a round Shaft bore", () => {
    const [outer, bore] = Bearing({ kind: "ball", designation: "MR105ZZ", boreMm: 5, odMm: 10, widthMm: 4, flange: { odMm: 11.5, widthMm: 1 } });
    expect(outer.protocols).toEqual([{ type: "bearing_fit", roles: ["bearing"] }]);
    expect(outer.parameters!.map((p) => p.id)).toEqual(["bearing_od", "bearing_width", "bearing_bore"]);
    expect(bore.protocols).toEqual([{ type: "shaft", roles: ["bidirectional"] }]);
    expect(bore.traits![0].params).toMatchObject({ gender: "bore", profile: "round" });
    expect(Bearing({ kind: "plain", boreMm: 5, odMm: 9, widthMm: 6, bore: { profile: "hex" } })[1].traits![0].params).toMatchObject({ profile: "hex" });
    expect(() => Bearing({ kind: "ball", boreMm: 10, odMm: 8, widthMm: 3 })).toThrow(/larger than the bore/);
  });

  it("a seat takes a bearing of its outside diameter, and no other", () => {
    expect(connection(bearing(9), seat(9), "bearing_fit")!.state).toBe("valid");
    expect(connection(bearing(9), seat([8.9, 9.1]), "bearing_fit")!.state).toBe("valid");
    expect(diags(bearing(10), seat(9), "bearing_fit")[0]).toMatchObject({ severity: "error", code: "bearing_fit", message: "a Ø10 mm bearing does not fit a Ø9 mm seat" });
  });

  it("warns on a kind the seat is not for, and says when the bearing stands proud", () => {
    expect(codes(bearing(9, { kind: "plain" }), seat(9, { kinds: ["ball"] }), "bearing_fit")).toEqual(["warning:bearing_fit"]);
    expect(diags(bearing(9), seat(9, { depthMm: 3 }), "bearing_fit")[0].message).toBe("the 4 mm wide bearing stands 1 mm proud of the 3 mm deep seat");
    expect(diags(bearing(9), seat(9, { depthMm: 3, through: true }), "bearing_fit")).toEqual([]);
  });

  it("the bearing's bore carries a shaft", () => {
    const hex = mod("hex-shaft", [Shaft({ id: "shaft", role: "bidirectional", gender: "shaft", profile: "hex", diameterMm: 5 })]);
    const b = mod("b", Bearing({ kind: "ball", boreMm: 5, odMm: 9, widthMm: 4, bore: { profile: "hex" } }));
    expect(connection(b, hex, "shaft")!.state).toBe("valid");
  });
});

describe("bolt pattern grids and partial circles", () => {
  const M3 = { fastener: "M3", fastenerDiameterMm: 3 } as const;
  const pat = (id: string, role: "structure" | "component", cfg: Omit<BoltPatternConfig, "id" | "role" | "fastener" | "fastenerDiameterMm">) => mod(id, [BoltPattern({ id: "mount", role, ...M3, ...cfg })]);

  it("a rectangular grid places rows × columns centred; a triangular disc grid every lattice point in the disc", () => {
    const g = BoltPattern({ id: "g", role: "structure", shape: "grid", rows: 2, columns: 3, pitchMm: 8, ...M3 });
    expect(g.parameters!.map((p) => [p.id, p.value])).toEqual([["hole_count", 6], ["hole_pitch", 8], ["hole_pitch_y", 8], ["fastener_diameter", 3]]);
    expect(boltPatternHoles(g)).toEqual([[-8, -4], [0, -4], [8, -4], [-8, 4], [0, 4], [8, 4]]);
    // REV's 0.75 module gears: the 8 mm triangular grid out to Ø32 without the hub
    const tri = BoltPattern({ id: "t", role: "component", shape: "grid", lattice: "triangular", pitchMm: 8, withinDiameterMm: 32, minDiameterMm: 1, holeCount: 18, ...M3 });
    expect(tri.traits![0].params).toMatchObject({ shape: "grid", lattice: "triangular", within_diameter_mm: 32, min_diameter_mm: 1 });
    expect(boltPatternHoles(tri)).toHaveLength(18);
    expect(latticeHoles({ lattice: "triangular", pitch: 8, withinDiameter: 16, minDiameter: 1 }).map(([x, y]) => Math.round(Math.hypot(x, y) * 1000) / 1000)).toEqual([8, 8, 8, 8, 8, 8]);
  });

  it("refuses a grid without an extent, a one-row grid, and a hole count the lattice does not give", () => {
    expect(() => BoltPattern({ id: "g", role: "structure", shape: "grid", pitchMm: 8, ...M3 })).toThrow(/rows and columns, or withinDiameterMm/);
    expect(() => BoltPattern({ id: "g", role: "structure", shape: "grid", pitchMm: 8, rows: 1, columns: 5, ...M3 })).toThrow(/use shape "row"/);
    expect(() => BoltPattern({ id: "g", role: "structure", shape: "grid", pitchMm: 8, rows: 2, columns: 2, holeCount: 5, ...M3 })).toThrow(/give 4 holes, not 5/);
    expect(() => BoltPattern({ id: "g", role: "structure", shape: "circle", spacingMm: 16, holeCount: 6, rows: 2, ...M3 })).toThrow(/for a grid/);
  });

  it("an arc places its holes from the start angle, and refuses a whole circle", () => {
    const arc = BoltPattern({ id: "a", role: "component", shape: "arc", spacingMm: 16, holeCount: 4, angularPitchDeg: 60, ...M3 });
    expect(arc.parameters!.map((p) => [p.id, p.value])).toEqual([["hole_spacing", 16], ["hole_count", 4], ["angular_pitch", 60], ["fastener_diameter", 3]]);
    expect(boltPatternHoles(arc).map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100])).toEqual([[8, 0], [4, 6.93], [-4, 6.93], [-8, 0]]);
    expect(() => BoltPattern({ id: "a", role: "component", shape: "arc", spacingMm: 16, holeCount: 6, angularPitchDeg: 60, ...M3 })).toThrow(/use shape "circle"/);
  });

  it("a grid takes a row along a grid line, a square on the grid and a six-hole circle on a triangular grid", () => {
    const plate = pat("plate", "structure", { shape: "grid", rows: 4, columns: 6, pitchMm: 8 });
    expect(connection(plate, pat("leg", "component", { shape: "row", holeCount: 5, pitchMm: 8 }), "bolt_pattern")!.state).toBe("valid");
    expect(connection(plate, pat("sq", "component", { shape: "square", spacingMm: 16, holeCount: 4 }), "bolt_pattern")!.state).toBe("valid");
    expect(codes(plate, pat("leg7", "component", { shape: "row", holeCount: 7, pitchMm: 8 }), "bolt_pattern")).toEqual(["error:bolt_pattern_holes"]);
    expect(codes(plate, pat("sq15", "component", { shape: "square", spacingMm: 15, holeCount: 4 }), "bolt_pattern")).toEqual(["error:bolt_pattern_holes"]);
    const gear = pat("gear", "component", { shape: "grid", lattice: "triangular", pitchMm: 8, withinDiameterMm: 32, minDiameterMm: 1 });
    expect(connection(gear, pat("motion", "structure", { shape: "circle", spacingMm: 16, holeCount: 6 }), "bolt_pattern")!.state).toBe("valid");
    expect(codes(gear, pat("square", "structure", { shape: "square", spacingMm: 16, holeCount: 4 }), "bolt_pattern")).toEqual(["error:bolt_pattern_holes"]);
  });

  it("an arc mates the full circle it is part of; a grid fits a slot, an arc does not", () => {
    const fiveOfSix = pat("arc", "component", { shape: "arc", spacingMm: 32, holeCount: 5, angularPitchDeg: 60, startAngleDeg: -30 });
    expect(connection(fiveOfSix, pat("circle", "structure", { shape: "circle", spacingMm: 32, holeCount: 6 }), "bolt_pattern")!.state).toBe("valid");
    expect(codes(fiveOfSix, pat("circle5", "structure", { shape: "circle", spacingMm: 32, holeCount: 5 }), "bolt_pattern")).toEqual(["error:bolt_pattern_holes"]);
    expect(codes(fiveOfSix, pat("c28", "structure", { shape: "circle", spacingMm: 28, holeCount: 6 }), "bolt_pattern")).toEqual(["error:bolt_pattern_holes"]);
    const slot = pat("slot", "structure", { shape: "slot", slotLengthMm: 120, slotKind: "t_slot" });
    expect(codes(pat("plate", "component", { shape: "grid", rows: 2, columns: 3, pitchMm: 8 }), slot, "bolt_pattern")).toEqual(["info:bolt_pattern_holes"]);
    expect(codes(fiveOfSix, slot, "bolt_pattern")).toEqual(["error:bolt_pattern_holes"]);
  });

  it("holesFitOn allows a rotation, a shift and a mirror image", () => {
    const tri: [number, number][] = [[0, 0], [10, 0], [0, 5]];
    expect(holesFitOn(tri, [[1, 1], [1, 11], [-4, 1], [50, 50]])).toBe(true);
    expect(holesFitOn(tri, [[0, 0], [-10, 0], [0, 5]])).toBe(true); // mirrored
    expect(holesFitOn(tri, [[0, 0], [10, 0], [0, 6]])).toBe(false);
  });
});

describe("the round bore clamped on a hex shaft", () => {
  const hex = mod("hex", [Shaft({ id: "shaft", role: "bidirectional", gender: "shaft", profile: "hex", diameterMm: 5 })]);
  const collar = mod("collar", [Shaft({ id: "bore", role: "bidirectional", gender: "bore", profile: "round", diameterMm: 6, clampsOn: { profile: "hex", diameterMm: 5, by: "set_screw" } })]);

  it("fits the hex shaft it clamps on, with an info", () => {
    const c = connection(collar, hex, "shaft")!;
    expect(c.state).toBe("valid");
    expect(c.diagnostics).toEqual([expect.objectContaining({ severity: "info", code: "shaft_fit", message: "the Ø6 mm round bore goes over the 5 mm hex shaft and is held by set screw" })]);
  });

  it("fits a round shaft of its own diameter, and refuses another hex", () => {
    expect(connection(collar, mod("r6", [Shaft({ id: "s", role: "bidirectional", gender: "shaft", profile: "round", diameterMm: 6 })]), "shaft")!.state).toBe("valid");
    expect(codes(collar, mod("h8", [Shaft({ id: "s", role: "bidirectional", gender: "shaft", profile: "hex", diameterMm: 8 })]), "shaft")).toEqual(["error:shaft_fit"]);
  });

  it("refuses a bore that does not clear the corners, or clampsOn on a non-round bore", () => {
    expect(() => Shaft({ id: "b", role: "bidirectional", gender: "bore", profile: "round", diameterMm: 5.5, clampsOn: { profile: "hex", diameterMm: 5, by: "set_screw" } })).toThrow(/across corners/);
    expect(() => Shaft({ id: "b", role: "bidirectional", gender: "bore", profile: "hex", diameterMm: 6, clampsOn: { profile: "hex", diameterMm: 5, by: "set_screw" } })).toThrow(/round bore/);
  });
});

describe("threads", () => {
  const screw = (extra: Partial<Parameters<typeof Thread>[0]> = {}) => mod("screw", [Thread({ gender: "external", designation: "M3 x 0.5", diameterMm: 3, pitchMm: 0.5, lengthMm: 8, kind: "screw", ...extra })]);
  const nut = (extra: Partial<Parameters<typeof Thread>[0]> = {}) => mod("nut", [Thread({ gender: "internal", designation: "M3 x 0.5", diameterMm: 3, pitchMm: 0.5, lengthMm: 4, through: true, kind: "nut", lock: "nylon_insert", ...extra })]);

  it("an external thread goes into an internal one of the same size, pitch and hand", () => {
    const c = connection(screw(), nut(), "thread")!;
    expect(c.state).toBe("valid");
    expect(c.diagnostics[0].message).toBe("up to 4 mm of thread engaged (8 mm external, 4 mm internal, through)");
    expect(validatePair(screw(), screw()).connections.filter((x) => x.protocol === "thread")).toEqual([]);
  });

  it("refuses another diameter, pitch or hand; TPI is stored as a pitch", () => {
    expect(diags(screw(), nut({ diameterMm: 2.5, designation: "M2.5" }), "thread")[0].message).toBe("M3 x 0.5 and M2.5 do not fit: diameters 3 mm and 2.5 mm");
    expect(codes(screw(), nut({ pitchMm: 0.35 }), "thread")).toEqual(["error:thread_fit"]);
    expect(codes(screw(), nut({ hand: "left" }), "thread")).toEqual(["error:thread_fit"]);
    expect(Thread({ gender: "external", designation: "1/4-20 UNC", diameterMm: 6.35, tpi: 20 }).parameters![1]).toEqual({ id: "thread_pitch", unit: "mm", value: 1.27 });
    expect(() => Thread({ gender: "external", designation: "x", diameterMm: 3, pitchMm: 0.5, through: true })).toThrow(/internal/);
    expect(() => Thread({ gender: "external", designation: "x", diameterMm: 3, pitchMm: 0.5, tpi: 20 })).toThrow(/not both/);
    // a source that states no pitch: the pitch is not compared
    expect(connection(screw({ pitchMm: undefined, designation: "M3" }), nut(), "thread")!.state).toBe("valid");
  });
});

describe("T-slots", () => {
  const track = mod("extrusion", [TSlot({ role: "track", profile: "REV 15 mm", openingMm: 3.2, channelWidthMm: 6.2, channelDepthMm: 2.2, lengthMm: 120, entry: ["end"] })]);
  const head = (w: number, extra: Partial<Parameters<typeof TSlot>[0]> = {}) => mod(`head${w}`, [TSlot({ role: "insert", profile: "REV 15 mm", neckWidthMm: 3, headWidthMm: w, headHeightMm: 1.8, entry: ["end"], ...extra })]);

  it("an insert whose neck passes the opening and whose head fits the channel slides in", () => {
    expect(connection(track, head(5.5), "t_slot")!.state).toBe("valid");
  });

  it("refuses a head that passes the opening or does not fit the channel, and an entry the track does not allow", () => {
    expect(diags(track, head(3), "t_slot").map((d) => d.message)).toEqual(["the 3 mm head passes through the 3.2 mm opening: the lips do not hold it"]);
    expect(diags(track, head(7), "t_slot").map((d) => d.message)).toEqual(["the 7 mm head is wider than the 6.2 mm channel"]);
    expect(diags(track, head(5.5, { entry: ["drop_in"] }), "t_slot").map((d) => d.message)).toEqual(["the insert goes in drop-in; the track takes from an end"]);
    expect(codes(mod("t", [TSlot({ role: "track", profile: "2020 B-type" })]), mod("n", [TSlot({ role: "insert", profile: "REV 15 mm" })]), "t_slot")).toEqual(["warning:t_slot_fit"]);
    expect(() => TSlot({ role: "insert", openingMm: 3, headWidthMm: 5 })).toThrow(/for a track/);
  });
});

describe("axial faces and wheels", () => {
  const face = (id: string, od: number, idMm: number, turnsWith?: "shaft" | "housing") => mod(id, [AxialFace({ id: "face", kind: "spacer", odMm: od, idMm, turnsWith })]);

  it("faces that overlap and turn together are valid; one inside the other's bore does not touch; relative turning rubs", () => {
    expect(connection(face("a", 8, 5, "shaft"), face("b", 9, 5, "shaft"), "axial_stop")!.state).toBe("valid");
    expect(codes(face("a", 8, 5), face("b", 14, 9), "axial_stop")).toEqual(["error:axial_face"]);
    expect(codes(face("a", 8, 5, "shaft"), face("b", 12, 7, "housing"), "axial_stop")).toEqual(["warning:axial_face"]);
  });

  it("a wheel rolls on a surface; one smaller than the surface needs is refused", () => {
    const wheel = mod("w", [Wheel({ kind: "omni", diameterMm: 90, treadWidthMm: 15, rollers: 10 })]);
    expect(wheel.interfaces[0].parameters!.map((p) => p.id)).toEqual(["wheel_diameter", "tread_width"]);
    expect(connection(wheel, mod("floor", [RollingSurface({ surface: "field_tile" })]), "rolling_contact")!.state).toBe("valid");
    expect(codes(wheel, mod("rail", [RollingSurface({ surface: "rail", minWheelDiameterMm: 100 })]), "rolling_contact")).toEqual(["error:rolling_contact"]);
    expect(() => Wheel({ kind: "mecanum", diameterMm: 96 })).toThrow(/hand/);
    expect(() => Wheel({ kind: "traction", diameterMm: 90, rollers: 3 })).toThrow(/omni or mecanum/);
  });
});

describe("interchangeable twins", () => {
  const M3 = { fastener: "M3", fastenerDiameterMm: 3 } as const;
  const extrusion = mod("extrusion", ["px", "nx", "py", "ny"].map((f) => BoltPattern({ id: `slot_${f}`, name: `Slot ${f}`, role: "structure", shape: "slot", slotLengthMm: 120, slotKind: "t_slot", ...M3 })));
  const bracket = mod("bracket", ["a", "b"].map((l) => BoltPattern({ id: `leg_${l}`, name: `Leg ${l}`, role: "component", shape: "row", pitchMm: 8, holeCount: 5, ...M3 })));

  it("a bracket's identical legs on an extrusion's identical slots make one connection; the other placements stay potentials", () => {
    const r = validatePair(bracket, extrusion);
    expect(r.verdict.state).toBe("valid");
    expect(r.connections.map((c) => `${c.a.regionPath[0]}~${c.b.regionPath[0]}`)).toEqual(["leg_a~slot_nx"]);
    expect(r.potentials).toHaveLength(7);
  });

  it("features that differ are still a choice", () => {
    const mixed = mod("mixed", [
      BoltPattern({ id: "short", role: "structure", shape: "slot", slotLengthMm: 60, slotKind: "t_slot", ...M3 }),
      BoltPattern({ id: "long", role: "structure", shape: "slot", slotLengthMm: 120, slotKind: "t_slot", ...M3 }),
    ]);
    const leg = mod("leg", [BoltPattern({ id: "leg", role: "component", shape: "row", pitchMm: 8, holeCount: 5, ...M3 })]);
    expect(validatePair(leg, mixed).verdict.state).toBe("not_configured");
  });
});

