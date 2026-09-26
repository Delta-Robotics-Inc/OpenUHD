/**
 * PB-796: the 30 robotics parts ported from ProtoPart, each with CAD.
 * See docs/protopart-port-pb796.md.
 */
import { existsSync, readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import type { ModuleDef } from "../src/types/index.js";
import * as library from "../library/parts/index.js";
import { checkCad } from "../library/cad/checks.js";
import { manifestLookup } from "../library/cad/manifests.js";

export const PB796_PARTS = [
  // motor controllers / drivers
  "rev-spark-max",
  "rev-spark-flex",
  "ctre-talon-srx",
  "ti-drv8871",
  "ti-l293dne",
  "adafruit-1438-motor-shield-v2",
  "adafruit-1411-16ch-pwm-servo-shield",
  // steppers and drivers
  "stepperonline-17hs08-1004s",
  "stepperonline-dm542t-v4",
  "generic-28byj-48-5v",
  "generic-uln2003-stepper-driver-board",
  // servos
  "rev-41-1097-smart-robot-servo",
  "dsservo-ds3225mg-180",
  // motors and ESC
  "rev-neo-brushless-v1-1",
  "rev-41-1300-core-hex-motor",
  "sparkfun-rob-28633",
  "emax-rs2205-2300kv",
  "hakrc-bls-35a-4in1-esc",
  // encoders
  "rev-through-bore-encoder-v1",
  "ctre-cancoder",
  // IMUs
  "ctre-pigeon-2",
  "bosch-bmi270",
  "st-lsm6ds3tr-c",
  // MCUs / SBCs
  "raspberry-pi-5",
  "arduino-uno-rev3",
  "espressif-esp32-c3-devkitm-1-n4x",
  // distance
  "adafruit-5396-vl53l4cd",
  // power
  "rev-power-distribution-hub",
  "ti-tps63020dsjr",
  "ovonic-4s-1300mah-120c-xt60",
];

const byId = new Map((Object.values(library) as ModuleDef[]).map((d) => [d.id, d]));
const dir = (id: string) => new URL(`../library/parts/${id}/`, import.meta.url);

describe("PB-796 ProtoPart port", () => {
  it("covers 30 distinct parts", () => {
    expect(new Set(PB796_PARTS).size).toBe(30);
  });

  it.each(PB796_PARTS)("%s is registered in library/parts/index.ts", (id) => {
    expect(byId.get(id)).toBeDefined();
  });

  it.each(PB796_PARTS)("%s: CAD body, bindings, frames and frame plausibility check clean", (id) => {
    const def = byId.get(id)!;
    const issues = checkCad(def, manifestLookup(def));
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    // every ref resolves against a committed manifest (vendor or generated)
    expect(issues.filter((i) => /no manifest/.test(i.message))).toEqual([]);
  });

  it.each(PB796_PARTS)("%s: CAD source recorded (vendor licence, or a manufacturer-CAD data gap)", (id) => {
    const def = byId.get(id)!;
    const vendor = (def.artifacts ?? []).filter((a) => a.type === "3d_model" && a.role === "source" && a.url);
    if (vendor.length) {
      const rows = JSON.parse(readFileSync(new URL("sources.json", dir(id)), "utf8")) as Array<Record<string, unknown>>;
      for (const a of vendor) {
        const row = rows.find((r) => r.url === a.url);
        expect(row, a.url).toBeDefined();
        expect(row!.type).toBe("cad");
        expect(row!.sha256).toBeTruthy();
        expect(row!.licence).toBeTruthy();
      }
    } else {
      const gap = (def.traits ?? []).some((t) => t.type === "data_gap" && /manufacturer CAD/i.test(JSON.stringify(t.params ?? {})));
      expect(gap).toBe(true);
    }
  });

  it.each(PB796_PARTS)("%s: independent audit recorded with no wrong or unsupported facts", (id) => {
    const file = new URL("verification.json", dir(id));
    expect(existsSync(file)).toBe(true);
    const v = JSON.parse(readFileSync(file, "utf8"));
    expect(v.audit?.checked).toBeGreaterThanOrEqual(12);
    expect(v.audit.wrong).toBe(0);
    expect(v.audit.unsupported).toBe(0);
  });
});
