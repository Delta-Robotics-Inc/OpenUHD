/**
 * Routed harnesses: a harness whose ends carry
 * frames is placed by the part it lands on, never the other way round, and
 * every other end is checked against the frame it should meet.
 */
import { describe, expect, it } from "vitest";
import { applyMat4, assemble, combineFrames } from "../src/index.js";
import { Connector } from "../src/protocols/index.js";
import type { ModuleDef } from "../src/types/index.js";

const board = (id: string, x: number): ModuleDef => ({
  id,
  name: id,
  version: "1.0.0",
  interfaces: [
    {
      id: "mount",
      domain: "mechanical",
      exposed: true,
      protocols: [{ type: "bolt_pattern", roles: ["component"] }],
      geometry: { frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0] } },
    },
    { id: "pwr", domain: "electrical", exposed: true, protocols: [{ type: "power", roles: [x > 0 ? "input" : "output"] }], geometry: { frame: { origin: [2, -1, 1.6], normal: [0, 0, 1] } } },
    { id: "gnd", domain: "electrical", exposed: true, protocols: [{ type: "power", roles: ["ground"] }], geometry: { frame: { origin: [2, 1, 1.6], normal: [0, 0, 1] } } },
  ],
});

const plate: ModuleDef = {
  id: "plate",
  name: "plate",
  version: "1.0.0",
  interfaces: [
    { id: "left", domain: "mechanical", exposed: true, protocols: [{ type: "bolt_pattern", roles: ["structure"] }], geometry: { frame: { origin: [0, 0, 5], normal: [0, 0, 1], xAxis: [1, 0, 0] } } },
    { id: "right", domain: "mechanical", exposed: true, protocols: [{ type: "bolt_pattern", roles: ["structure"] }], geometry: { frame: { origin: [60, 0, 5], normal: [0, 0, 1], xAxis: [1, 0, 0] } } },
  ],
};

/** A two-wire lead routed in root coordinates: ends sit on board A's pads (x = 2) and board B's (x = 62). */
const lead = (bEndX: number): ModuleDef => ({
  id: "lead",
  name: "lead",
  version: "1.0.0",
  kind: "harness",
  topology: "wire",
  interfaces: [
    { ...Connector({ id: "end_a", connector: "solder_leads", pins: ["+", "-"] }), geometry: { frame: { origin: [2, 0, 6.6], normal: [0, 0, -1], xAxis: [0, 1, 0] } } },
    { ...Connector({ id: "end_b", connector: "solder_leads", pins: ["+", "-"] }), geometry: { frame: { origin: [bEndX, 0, 6.6], normal: [0, 0, -1], xAxis: [0, 1, 0] } } },
  ],
  links: [{ id: "wires", a: { self: true, interfaceId: "end_a" }, b: { self: true, interfaceId: "end_b" } }],
});

const system = (bEndX: number) => {
  const defs = [plate, board("a", -1), board("b", 1), lead(bEndX)];
  const lookup = (id: string) => defs.find((d) => d.id === id);
  const root: ModuleDef = {
    id: "sys",
    name: "sys",
    version: "1.0.0",
    interfaces: [],
    children: [
      { id: "plate", moduleDefId: "plate" },
      { id: "a", moduleDefId: "a" },
      { id: "b", moduleDefId: "b" },
      { id: "lead", moduleDefId: "lead" },
    ],
    links: [
      { id: "a_mount", a: { child: "plate", interfaceId: "left" }, b: { child: "a", interfaceId: "mount" } },
      { id: "b_mount", a: { child: "plate", interfaceId: "right" }, b: { child: "b", interfaceId: "mount" } },
      { id: "a_pads", a: { child: "a", interfaceId: "a_pads", compose: { p1: "pwr", p2: "gnd" } }, b: { child: "lead", interfaceId: "end_a" } },
      { id: "b_pads", a: { child: "lead", interfaceId: "end_b" }, b: { child: "b", interfaceId: "b_pads", compose: { p1: "pwr", p2: "gnd" } } },
    ],
  };
  return assemble(root, lookup, { root: ["plate"] });
};

describe("combineFrames", () => {
  it("averages origins and runs xAxis from pin 1 to pin N", () => {
    const f = combineFrames([
      { origin: [0, -1, 0], normal: [0, 0, 1] },
      { origin: [0, 1, 0], normal: [0, 0, 1] },
    ])!;
    expect(f.origin).toEqual([0, 0, 0]);
    expect(f.normal).toEqual([0, 0, 1]);
    expect(f.xAxis).toEqual([0, 1, 0]);
  });
});

describe("routed harnesses", () => {
  it("places the harness by its first end and confirms the other end", () => {
    const asm = system(62);
    expect(asm.harnesses).toHaveLength(1);
    const h = asm.harnesses[0];
    expect(h.via).toBe("a_pads");
    // generated in root coordinates, so the placement is the identity
    applyMat4(h.matrix, [10, 20, 30]).forEach((v, i) => expect(v).toBeCloseTo([10, 20, 30][i], 6));
    expect(h.ends.map((e) => [e.interfaceId, e.status])).toEqual([
      ["end_a", "anchor"],
      ["end_b", "matches"],
    ]);
    expect(h.ends[1].counterpart).toBe("b.b_pads");
    expect(asm.issues.filter((i) => i.severity === "warning")).toEqual([]);
    // the harness ends are not reported as plain routes or unrouted links
    expect(asm.routes).toEqual([]);
    expect(asm.unrouted).toEqual([]);
  });

  it("reports an end that no longer meets its part as stale", () => {
    const asm = system(58);
    const end = asm.harnesses[0].ends.find((e) => e.interfaceId === "end_b")!;
    expect(end.status).toBe("stale");
    expect(end.offsetMm).toBeCloseTo(4, 6);
    expect(asm.issues.some((i) => i.severity === "warning" && i.message.includes("regenerate"))).toBe(true);
  });
});
