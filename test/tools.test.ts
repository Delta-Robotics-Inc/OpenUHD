import { describe, it, expect } from "vitest";
import { ISO_4762_SOCKET_MM, systemTools, toolFor, toolLabel } from "../src/system/tools.js";
import { SYSTEM, lookup } from "../library/systems/quadcopter-5in/index.js";

describe("tool sizes from the fasteners (PB-797)", () => {
  it("ISO 4762 socket sizes: M2 takes 1.5 mm, M3 takes 2.5 mm", () => {
    expect(ISO_4762_SOCKET_MM["2"]).toBe(1.5);
    expect(ISO_4762_SOCKET_MM["3"]).toBe(2.5);
  });

  it("uses a screw's own stated socket before the standard's table", () => {
    const m3x30 = toolFor(lookup("iso-4762-m3x30-socket-head-cap-screw")!)!;
    expect(m3x30).toMatchObject({ kind: "hex_key", sizeMm: 2.5, basis: "part" });
    const m2x12 = toolFor(lookup("iso-4762-m2x12")!)!;
    expect(m2x12).toMatchObject({ kind: "hex_key", sizeMm: 1.5, basis: "standard" });
  });

  it("sizes nut drivers and standoff spanners by across-flats; spacers need none", () => {
    expect(toolFor(lookup("iso-10511-m3-nyloc-nut")!)).toMatchObject({ kind: "nut_driver", sizeMm: 5.5 });
    expect(toolFor(lookup("iso-10511-m2-nyloc-nut")!)).toMatchObject({ kind: "nut_driver", sizeMm: 4 });
    expect(toolFor(lookup("m3-aluminium-standoff-30mm")!)).toMatchObject({ kind: "spanner", sizeMm: 5.5, use: "hold" });
    expect(toolFor(lookup("m2-nylon-spacer-5mm")!)).toBeUndefined();
  });

  it("lists the quadcopter's tools once each", () => {
    expect(systemTools(SYSTEM, lookup).map(toolLabel)).toEqual([
      "1.5 mm hex key",
      "2.5 mm hex key",
      "4 mm nut driver",
      "5.5 mm nut driver",
      "5.5 mm spanner",
    ]);
  });
});
