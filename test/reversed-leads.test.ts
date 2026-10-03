/**
 * PB-869: a two-lead part soldered the wrong way round through a harness.
 *
 * The cell's leads (+ and -) are bound by a composite supply port; the board
 * has two lone pads (BAT+ and BAT-). Reversing the link-scoped composition
 * puts + on BAT- and - on BAT+. Each derived link must then be validated pad
 * against pad: validating the cell's composite against the lone pad finds the
 * composite's own matching pad and passes the wire that is wrong (the
 * regression the smart bottle's cell-leads-reversed scenario caught, from the
 * merge of the watch and bottle board rules, d63a5ed).
 */
import { describe, expect, it } from "vitest";
import type { InterfaceDef, ModuleDef } from "../src/types/index.js";
import { Connector, Ground } from "../src/protocols/index.js";
import { checkSystem } from "../src/system/checks.js";
import { deriveLinks } from "../src/system/derive.js";

const leadPos: InterfaceDef = {
  id: "lead_pos",
  name: "Lead +",
  pin: "+",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "power", roles: ["output", "input"] }],
  capabilities: ["battery_out"],
};

const CELL: ModuleDef = {
  id: "test-cell",
  name: "1S cell with leads",
  interfaces: [
    leadPos,
    { ...Ground({ id: "lead_neg", name: "Lead -" }), pin: "-" },
    {
      id: "battery_out",
      name: "Battery output",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["output"] }],
      capabilities: ["battery_out"],
      slots: [
        { id: "pos", label: "+", required: true, match: { protocol: "power", role: "output", capability: "battery_out" } },
        { id: "gnd", label: "-", required: true, match: { protocol: "power", role: "ground", capability: "ground" } },
      ],
      profiles: [{ id: "default", label: "+ / -", default_active: true, bindings: { pos: "lead_pos", gnd: "lead_neg" } }],
    },
  ],
};

const BOARD: ModuleDef = {
  id: "test-pad-board",
  name: "Board with BAT pads",
  interfaces: [
    { id: "bat_pos", name: "BAT+ pad", pin: "1", domain: "electrical", exposed: true, default_active: true, protocols: [{ type: "power", roles: ["input"] }], capabilities: ["battery_in"] },
    { ...Ground({ id: "bat_neg", name: "BAT- pad" }), pin: "2" },
  ],
};

const LEADS: ModuleDef = {
  id: "test-cell-leads",
  name: "Cell leads",
  kind: "harness",
  topology: "wire",
  interfaces: [
    Connector({ id: "end_cell", connector: "flying_leads", pins: ["+", "-"] }),
    Connector({ id: "end_board", connector: "flying_leads", pins: ["+", "-"] }),
  ],
  links: [{ id: "wires", a: { self: true, interfaceId: "end_cell" }, b: { self: true, interfaceId: "end_board" } }],
};

const system = (pads: Record<string, string>): ModuleDef => ({
  id: "test-cell-on-board",
  name: "Cell soldered to a board",
  interfaces: [],
  children: [
    { id: "cell", moduleDefId: CELL.id },
    { id: "board", moduleDefId: BOARD.id },
    { id: "leads", moduleDefId: LEADS.id },
  ],
  links: [
    { id: "cell_leads", a: { child: "cell", interfaceId: "leads", compose: { p1: "lead_pos", p2: "lead_neg" } }, b: { child: "leads", interfaceId: "end_cell" } },
    { id: "bat_pads", a: { child: "leads", interfaceId: "end_board" }, b: { child: "board", interfaceId: "bat_pads", compose: pads } },
  ],
});

const DEFS = [CELL, BOARD, LEADS];
const lookup = (id: string) => DEFS.find((d) => d.id === id);
const derived = (def: ModuleDef) => deriveLinks(def, lookup).map((r) => `${r.a.path} ↔ ${r.b.path} [${r.state}]`).sort();

describe("leads soldered through a harness (PB-869)", () => {
  it("pair + with BAT+ and - with BAT- when soldered right", () => {
    expect(derived(system({ p1: "bat_pos", p2: "bat_neg" }))).toEqual([
      "cell:lead_neg ↔ board:bat_neg [configured]",
      "cell:lead_pos ↔ board:bat_pos [configured]",
    ]);
    expect(checkSystem(system({ p1: "bat_pos", p2: "bat_neg" }), lookup).diagnostics.filter((d) => d.rule === "link_state" && d.severity === "error")).toEqual([]);
  });

  it("validate reversed leads pad against pad, not the cell's composite against a lone pad", () => {
    expect(derived(system({ p1: "bat_neg", p2: "bat_pos" }))).toEqual([
      "cell:lead_neg ↔ board:bat_pos [incompatible]",
      "cell:lead_pos ↔ board:bat_neg [incompatible]",
    ]);
  });

  it("report reversed leads as link_state errors", () => {
    const errors = checkSystem(system({ p1: "bat_neg", p2: "bat_pos" }), lookup).diagnostics.filter((d) => d.rule === "link_state" && d.severity === "error");
    expect(errors.length).toBe(2);
    expect(errors.map((d) => d.refs).flat()).toEqual(expect.arrayContaining(["link:bat_pads", "link:cell_leads"]));
  });
});
