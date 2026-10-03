import { describe, it, expect } from "vitest";
import { ISO_4762_SOCKET_MM, systemTools, toolFor, toolLabel } from "../src/system/tools.js";
import { DRONE, GPS_SCREW, GPS_SPACER, M2_NUT, M3_NUT, MOTOR_SCREW, STACK_SPACER, STANDOFF, lookup } from "./fixtures/drone.js";

describe("tool sizes from the fasteners (PB-797)", () => {
  it("ISO 4762 socket sizes: M2 takes 1.5 mm, M3 takes 2.5 mm", () => {
    expect(ISO_4762_SOCKET_MM["2"]).toBe(1.5);
    expect(ISO_4762_SOCKET_MM["3"]).toBe(2.5);
  });

  it("uses a screw's own stated socket before the standard's table", () => {
    expect(toolFor(MOTOR_SCREW)).toMatchObject({ kind: "hex_key", sizeMm: 2.5, basis: "part" });
    expect(toolFor(GPS_SCREW)).toMatchObject({ kind: "hex_key", sizeMm: 1.5, basis: "standard" });
  });

  it("sizes nut drivers and standoff spanners by across-flats; spacers need none", () => {
    expect(toolFor(M3_NUT)).toMatchObject({ kind: "nut_driver", sizeMm: 5.5 });
    expect(toolFor(M2_NUT)).toMatchObject({ kind: "nut_driver", sizeMm: 4 });
    expect(toolFor(STANDOFF)).toMatchObject({ kind: "spanner", sizeMm: 5.5, use: "hold" });
    expect(toolFor(STACK_SPACER)).toBeUndefined();
    expect(toolFor(GPS_SPACER)).toBeUndefined();
  });

  it("lists a system's tools once each, smallest first by kind", () => {
    expect(systemTools(DRONE, lookup).map(toolLabel)).toEqual([
      "1.5 mm hex key",
      "2.5 mm hex key",
      "4 mm nut driver",
      "5.5 mm nut driver",
      "5.5 mm spanner",
    ]);
  });
});
