/**
 * Mechanical and current-rating vocabulary:
 * bolt pattern rows and slots, shaft profiles and genders, linear motion,
 * and the minimum current an input needs from its source.
 */
import { describe, expect, it } from "vitest";
import { CAPACITY_PARAM_IDS, validatePair } from "../src/drc/index.js";
import {
  BoltPattern,
  BrushedMotorTerminals,
  LinearMotion,
  PowerIn,
  PowerOut,
  Shaft,
  defineModule,
  type BoltPatternConfig,
  type ShaftConfig,
} from "../src/protocols/index.js";
import { boltPatternHoles } from "../src/system/geometry.js";
import type { InterfaceDef, ModuleDef } from "../src/types/index.js";

const mod = (id: string, interfaces: InterfaceDef[]): ModuleDef => defineModule({ id, name: id, interfaces });
const connection = (a: ModuleDef, b: ModuleDef, protocol: string) => validatePair(a, b).connections.find((c) => c.protocol === protocol);
const codes = (a: ModuleDef, b: ModuleDef, protocol: string) => connection(a, b, protocol)?.diagnostics.map((d) => d.code) ?? [];

describe("bolt pattern rows and slots", () => {
  const M3 = { fastener: "M3", fastenerDiameterMm: 3 } as const;
  const pattern = (role: "structure" | "component", cfg: Omit<BoltPatternConfig, "id" | "role" | "fastener" | "fastenerDiameterMm"> & Partial<BoltPatternConfig>) =>
    mod(`stub-${role}`, [BoltPattern({ id: "mount", role, ...M3, ...cfg })]);
  const row = (role: "structure" | "component", holeCount: number, pitchMm: number) => pattern(role, { shape: "row", holeCount, pitchMm });
  const slot = (role: "structure" | "component", slotLengthMm: number, slotKind?: "t_slot" | "through") => pattern(role, { shape: "slot", slotLengthMm, slotKind });

  it("a row states its pitch and count and derives its span; its holes are centred on x", () => {
    const r = row("component", 5, 8).interfaces[0];
    expect(r.parameters!.map((p) => [p.id, p.value])).toEqual([["hole_spacing", 32], ["hole_count", 5], ["hole_pitch", 8], ["fastener_diameter", 3]]);
    expect(boltPatternHoles(r)).toEqual([[-16, 0], [-8, 0], [0, 0], [8, 0], [16, 0]]);
    const s = slot("structure", 120, "t_slot").interfaces[0];
    expect(s.parameters!.map((p) => [p.id, p.value])).toEqual([["slot_length", 120], ["fastener_diameter", 3]]);
    expect(s.traits![0].params).toMatchObject({ shape: "slot", slot_kind: "t_slot" });
    expect(boltPatternHoles(s)).toEqual([]);
  });

  it("refuses a row without a pitch or with one hole, a slot without a length, and fields of another shape", () => {
    expect(() => BoltPattern({ id: "x", role: "component", shape: "row", holeCount: 5, ...M3 })).toThrow(/needs pitchMm/);
    expect(() => BoltPattern({ id: "x", role: "component", shape: "row", holeCount: 1, pitchMm: 8, ...M3 })).toThrow(/two or more holes/);
    expect(() => BoltPattern({ id: "x", role: "component", shape: "row", holeCount: 5, pitchMm: 8, spacingMm: 32, ...M3 })).toThrow(/leave spacingMm/);
    expect(() => BoltPattern({ id: "x", role: "structure", shape: "slot", ...M3 })).toThrow(/needs slotLengthMm/);
    expect(() => BoltPattern({ id: "x", role: "structure", shape: "square", spacingMm: 16, holeCount: 4, pitchMm: 8, ...M3 })).toThrow(/pitchMm is for a row/);
    expect(() => BoltPattern({ id: "x", role: "structure", shape: "square", holeCount: 4, ...M3 })).toThrow(/needs spacingMm/);
    expect(() => BoltPattern({ id: "x", role: "structure", shape: "row", holeCount: 4, pitchMm: 8, slotKind: "t_slot", ...M3 })).toThrow(/for a slot/);
  });

  it("a row fits a T-slot at least as long as the row", () => {
    const c = connection(slot("structure", 120, "t_slot"), row("component", 5, 8), "bolt_pattern")!;
    expect([c.state, c.diagnostics]).toEqual(["valid", []]);
    const short = connection(slot("structure", 24, "t_slot"), row("component", 5, 8), "bolt_pattern")!;
    expect(short.state).toBe("incompatible");
    expect(short.diagnostics.map((d) => d.message)).toEqual(["a 24 mm T-slot does not line up with a 5-hole row (pitch 8 mm): the row spans 32 mm, longer than the slot"]);
  });

  it("a row mates a row whose holes land on its own: the same pitch or a whole multiple, no longer", () => {
    const grid = row("structure", 9, 8);
    expect(connection(grid, row("component", 5, 8), "bolt_pattern")!.diagnostics).toEqual([]);
    expect(connection(grid, row("component", 2, 16), "bolt_pattern")!.diagnostics).toEqual([]);
    expect(connection(grid, row("component", 3, 24), "bolt_pattern")!.diagnostics).toEqual([]);
    // the longer row may be either side
    expect(connection(row("structure", 3, 8), row("component", 9, 8), "bolt_pattern")!.diagnostics).toEqual([]);
    expect(codes(grid, row("component", 3, 12), "bolt_pattern")).toContain("bolt_pattern_line");
    expect(codes(grid, row("component", 2, 72), "bolt_pattern")).toContain("bolt_pattern_line");
    expect(codes(row("structure", 4, 8), row("component", 3, 16), "bolt_pattern")).toContain("bolt_pattern_line");
  });

  it("reads a rectangle with no y spacing as a two-hole row, or as a slot when its spacing is a range from 0", () => {
    const twoHole = pattern("component", { shape: "rectangle", spacingMm: 32, spacingYmm: 0, holeCount: 2 });
    expect(connection(row("structure", 9, 8), twoHole, "bolt_pattern")!.diagnostics).toEqual([]);
    expect(codes(row("structure", 9, 8), pattern("component", { shape: "rectangle", spacingMm: 30, spacingYmm: 0, holeCount: 2 }), "bolt_pattern")).toContain("bolt_pattern_line");
    const oldSlot = pattern("structure", { shape: "rectangle", spacingMm: [0, 120], spacingYmm: 0, holeCount: 2 });
    expect(connection(oldSlot, row("component", 5, 8), "bolt_pattern")!.diagnostics).toEqual([]);
    // slotted holes: two holes at any spacing in a range
    const slotted = pattern("component", { shape: "rectangle", spacingMm: [14, 18], spacingYmm: 0, holeCount: 2 });
    expect(connection(row("structure", 5, 8), slotted, "bolt_pattern")!.diagnostics).toEqual([]);
  });

  it("a row or a slot does not mate a pattern whose holes are not on one line", () => {
    const square = pattern("structure", { shape: "square", spacingMm: 16, holeCount: 4 });
    expect(codes(square, row("component", 3, 8), "bolt_pattern")).toEqual(["bolt_pattern_line"]);
    const circle = pattern("component", { shape: "circle", spacingMm: 16, holeCount: 6 });
    expect(codes(slot("structure", 120, "t_slot"), circle, "bolt_pattern")).toEqual(["bolt_pattern_line"]);
    const cross = pattern("component", { shape: "cross", spacingMm: 16, spacingYmm: 19, holeCount: 4 });
    expect(codes(row("structure", 5, 8), cross, "bolt_pattern")).toEqual(["bolt_pattern_line"]);
  });

  it("two T-slots do not mate; a through slot mates a T-slot", () => {
    expect(codes(slot("structure", 120, "t_slot"), slot("component", 355.6, "t_slot"), "bolt_pattern")).toEqual(["bolt_pattern_line"]);
    expect(connection(slot("structure", 120, "t_slot"), slot("component", 40, "through"), "bolt_pattern")!.diagnostics).toEqual([]);
  });

  it("still compares the fastener", () => {
    const m5 = mod("stub-slot", [BoltPattern({ id: "mount", role: "structure", shape: "slot", slotLengthMm: 120, fastener: "M5", fastenerDiameterMm: 5 })]);
    expect(codes(m5, row("component", 5, 8), "bolt_pattern")).toEqual(["param_range_disjoint"]);
  });
});

describe("shaft profiles and genders", () => {
  const shaft = (id: string, cfg: Omit<ShaftConfig, "id">) => mod(`stub-${id}`, [Shaft({ id, ...cfg })]);
  const hexBoreMotor = shaft("motor_bore", { role: "output", gender: "bore", profile: "hex", diameterMm: 5 });
  const hexShaft = shaft("hex_shaft", { role: "bidirectional", gender: "shaft", profile: "hex", diameterMm: 5 });

  it("states the profile and gender in the shaft trait and a key width as a parameter", () => {
    const k = Shaft({ id: "k", role: "output", gender: "shaft", profile: "keyed", diameterMm: 8, keyWidthMm: 3 });
    expect(k.traits![0].params).toEqual({ profile: "keyed", gender: "shaft" });
    expect(k.parameters!.map((p) => p.id)).toEqual(["shaft_diameter", "key_width"]);
    expect(Shaft({ id: "plain", role: "output", diameterMm: 5 }).traits).toBeUndefined();
    expect(() => Shaft({ id: "x", role: "output", profile: "round", diameterMm: 8, keyWidthMm: 3 })).toThrow(/keyed/);
    expect(() => Shaft({ id: "x", role: "output", profile: "hex", diameterMm: 8, spline: "25T" })).toThrow(/spline/);
  });

  it("a 5 mm hex shaft fits a motor's 5 mm hex bore; a bidirectional shaft pairs with a driver and a load", () => {
    const c = connection(hexBoreMotor, hexShaft, "shaft")!;
    expect([c.state, c.diagnostics]).toEqual(["valid", []]);
    const wheel = shaft("wheel_hub", { role: "input", gender: "bore", profile: "hex", diameterMm: 5 });
    expect(connection(hexShaft, wheel, "shaft")!.state).toBe("valid");
  });

  it("a hex shaft of another size, or of another profile, does not", () => {
    expect(codes(hexBoreMotor, shaft("big", { role: "bidirectional", gender: "shaft", profile: "hex", diameterMm: 12.7 }), "shaft")).toEqual(["param_range_disjoint"]);
    const round = connection(hexBoreMotor, shaft("round", { role: "bidirectional", gender: "shaft", profile: "round", diameterMm: 5 }), "shaft")!;
    expect(round.state).toBe("incompatible");
    expect(round.diagnostics[0].message).toBe("a round shaft does not fit a hex bore");
    const roundBore = shaft("round_bore", { role: "input", gender: "bore", profile: "round", diameterMm: 5 });
    expect(connection(hexShaft, roundBore, "shaft")!.diagnostics[0].message).toBe("a hex shaft does not fit a round bore");
  });

  it("a rounded hex shaft fits a hex bore; a sharp hex shaft does not fit a rounded hex bore", () => {
    const ultra = shaft("ultra", { role: "bidirectional", gender: "shaft", profile: "rounded_hex", diameterMm: 12.7 });
    expect(codes(shaft("hex_socket", { role: "input", gender: "bore", profile: "hex", diameterMm: 12.7 }), ultra, "shaft")).toEqual([]);
    const roundedBore = shaft("rounded_bore", { role: "input", gender: "bore", profile: "rounded_hex", diameterMm: 12.7 });
    expect(codes(shaft("hex", { role: "output", gender: "shaft", profile: "hex", diameterMm: 12.7 }), roundedBore, "shaft")).toEqual(["shaft_fit"]);
  });

  it("two shafts or two bores do not mate: discovery leaves them as potentials, an explicit link says why", () => {
    const motorShaft = shaft("motor_shaft", { role: "output", gender: "shaft", profile: "hex", diameterMm: 5 });
    const other = shaft("other", { role: "input", gender: "shaft", profile: "hex", diameterMm: 5 });
    const discovered = validatePair(motorShaft, other);
    expect([discovered.verdict.state, discovered.connections]).toEqual(["not_configured", []]);
    expect(discovered.potentials.map((p) => p.diagnostics[0].message)).toEqual(["two shafts do not mate without a coupler"]);
    const explicit = (a: ModuleDef, b: ModuleDef) => validatePair(a, b, { explicit: true }).connections.find((c) => c.protocol === "shaft")!;
    expect(explicit(motorShaft, other).diagnostics[0].message).toBe("two shafts do not mate without a coupler");
    expect(explicit(hexBoreMotor, shaft("hub", { role: "input", gender: "bore", profile: "hex", diameterMm: 5 })).diagnostics[0].message).toBe("two bores need a shaft between them");
  });

  it("D-cut and keyed shafts: a D-cut shaft fits a round bore; a key without a keyway warns; key widths must agree", () => {
    const roundBore = shaft("pulley", { role: "input", gender: "bore", profile: "round", diameterMm: 8 });
    expect(codes(shaft("d", { role: "output", gender: "shaft", profile: "d_cut", diameterMm: 8 }), roundBore, "shaft")).toEqual([]);
    const keyed = (id: string, gender: "shaft" | "bore", keyWidthMm: number) => shaft(id, { role: gender === "shaft" ? "output" : "input", gender, profile: "keyed", diameterMm: 8, keyWidthMm });
    const k = connection(keyed("k", "shaft", 3), roundBore, "shaft")!;
    expect([k.state, k.diagnostics[0].severity, k.diagnostics[0].message]).toEqual(["warning", "warning", "a keyed shaft in a round bore: it fits without its key, so torque relies on a set screw or clamp"]);
    expect(codes(keyed("k", "shaft", 3), keyed("hub", "bore", 3), "shaft")).toEqual([]);
    expect(codes(keyed("k", "shaft", 3), keyed("hub", "bore", 2), "shaft")).toEqual(["param_range_disjoint"]);
    expect(codes(shaft("plain", { role: "output", gender: "shaft", profile: "round", diameterMm: 8 }), keyed("hub", "bore", 3), "shaft")).toEqual(["shaft_fit"]);
  });

  it("splines must name the same spline when both do", () => {
    const spline = (id: string, gender: "shaft" | "bore", s?: string) => shaft(id, { role: gender === "shaft" ? "output" : "input", gender, profile: "spline", diameterMm: 5.9, ...(s ? { spline: s } : {}) });
    expect(codes(spline("servo", "shaft", "25T"), spline("horn", "bore", "25 t"), "shaft")).toEqual([]);
    expect(connection(spline("servo", "shaft", "25T"), spline("horn", "bore", "24T"), "shaft")!.diagnostics[0].message).toBe("different splines (25T and 24T)");
    expect(codes(spline("servo", "shaft", "25T"), spline("horn", "bore"), "shaft")).toEqual([]);
  });

  it("shafts that state no profile or gender are compared by diameter only, as before", () => {
    const old = shaft("old", { role: "input", diameterMm: 5 });
    expect(codes(shaft("motor", { role: "output", gender: "shaft", profile: "round", diameterMm: 5 }), old, "shaft")).toEqual([]);
    // with no genders, profiles are compared either way round
    expect(codes(shaft("a", { role: "output", profile: "d_cut", diameterMm: 5 }), shaft("b", { role: "input", profile: "round", diameterMm: 5 }), "shaft")).toEqual([]);
    expect(codes(shaft("a", { role: "output", profile: "hex", diameterMm: 5 }), shaft("b", { role: "input", profile: "round", diameterMm: 5 }), "shaft")).toEqual(["shaft_fit"]);
  });
});

describe("linear motion", () => {
  const actuator = (extra: Partial<Parameters<typeof LinearMotion>[0]> = {}) =>
    mod("stub-actuator", [LinearMotion({ id: "output", role: "output", strokeMm: 304.8, leadMm: 12, threadPitchMm: 2, starts: 6, forceN: 667, mechanism: "lead_screw", backdrivable: true, ...extra })]);
  const load = (extra: Partial<Parameters<typeof LinearMotion>[0]> = {}) => mod("stub-load", [LinearMotion({ id: "carriage", role: "input", ...extra })]);

  it("states stroke, lead, thread pitch and force as parameters and the mechanism in a trait", () => {
    const o = actuator().interfaces[0];
    expect(o.protocols).toEqual([{ type: "linear_motion", roles: ["output"] }]);
    expect(o.parameters!.map((p) => [p.id, p.unit, p.value])).toEqual([["stroke", "mm", 304.8], ["lead", "mm", 12], ["thread_pitch", "mm", 2], ["force", "N", 667]]);
    expect(o.traits![0].params).toEqual({ mechanism: "lead_screw", starts: 6, backdrivable: true });
    expect(() => LinearMotion({ id: "x", role: "output", leadMm: 12, threadPitchMm: 2, starts: 5 })).toThrow(/not pitch 2 mm × 5 starts/);
  });

  it("an actuator drives a load that needs no more stroke or force than it gives", () => {
    const c = connection(actuator(), load({ strokeMm: 250, forceN: 500 }), "linear_motion")!;
    expect([c.state, c.diagnostics]).toEqual(["valid", []]);
    const long = connection(actuator(), load({ strokeMm: 400 }), "linear_motion")!;
    expect([long.state, long.diagnostics[0].code, long.diagnostics[0].message]).toEqual(["incompatible", "linear_motion_capacity", "the output gives 304.8 mm of stroke, less than the 400 mm the load needs"]);
    expect(codes(actuator(), load({ forceN: 1000 }), "linear_motion")).toEqual(["linear_motion_capacity"]);
  });

  it("says when the output states no force to check against", () => {
    const c = connection(actuator({ forceN: undefined }), load({ forceN: 500 }), "linear_motion")!;
    expect([c.state, c.diagnostics.map((d) => d.severity)]).toEqual(["valid", ["info"]]);
  });

  it("a screw and its nut must have the same lead and thread pitch", () => {
    expect(codes(actuator(), load({ leadMm: 8 }), "linear_motion")).toEqual(["param_range_disjoint"]);
    expect(codes(actuator(), load({ leadMm: 12, threadPitchMm: 2 }), "linear_motion")).toEqual([]);
  });

  it("two outputs do not pair", () => {
    expect(connection(actuator(), mod("stub-other", [LinearMotion({ id: "rod", role: "output" })]), "linear_motion")).toBeUndefined();
  });
});

describe("minimum supply current", () => {
  const channel = (maxCurrentA?: number) => mod("stub-pdh", [PowerOut({ id: "ch0", voltageV: 12, ...(maxCurrentA !== undefined ? { maxCurrentA } : {}) })]);
  const controller = mod("stub-controller", [PowerIn({ id: "vin", voltageV: [5.5, 24], nominalV: 12, maxCurrentA: 60, minSupplyCurrentA: 40 })]);

  it("is a capacity parameter on the input, not compared by range overlap", () => {
    expect(controller.interfaces[0].parameters!.find((p) => p.id === "min_supply_current")).toEqual({ id: "min_supply_current", unit: "A", value: 40 });
    expect(CAPACITY_PARAM_IDS.has("min_supply_current")).toBe(true);
    expect(() => PowerOut({ id: "x", voltageV: 12, minSupplyCurrentA: 40 })).toThrow(/a source states maxCurrentA/);
  });

  it("a 40 A channel feeds an input that needs 40 A; a 30 A channel does not", () => {
    expect(connection(channel(40), controller, "power")!.diagnostics).toEqual([]);
    const c = connection(channel(30), controller, "power")!;
    expect([c.state, c.diagnostics[0].code, c.diagnostics[0].message]).toEqual(["incompatible", "supply_current_rating", "ch0 is rated for 30 A; vin needs a source rated for at least 40 A"]);
  });

  it("notes a source that states no rating", () => {
    const c = connection(channel(), controller, "power")!;
    expect([c.state, c.diagnostics.map((d) => [d.code, d.severity])]).toEqual(["valid", [["supply_current_rating", "info"]]]);
  });

  it("a motor that needs a 5 A channel is not driven by a 2 A one", () => {
    const driver = mod("stub-driver", BrushedMotorTerminals({ role: "output", maxCurrentA: 2 }));
    const motor = mod("stub-motor", BrushedMotorTerminals({ role: "input", voltageV: 12, minSupplyCurrentA: 5 }));
    expect(codes(driver, motor, "dc_motor")).toEqual(["supply_current_rating"]);
    expect(() => BrushedMotorTerminals({ role: "output", minSupplyCurrentA: 5 })).toThrow(/a channel states maxCurrentA/);
  });
});
