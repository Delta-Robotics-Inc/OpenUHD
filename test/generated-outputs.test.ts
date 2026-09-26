import { describe, it, expect } from "vitest";
import { SYSTEM, lookup } from "../library/systems/quadcopter-5in/index.js";
import { SCENARIOS } from "../library/systems/quadcopter-5in/scenarios.js";
import { betaflightConfig } from "../library/systems/quadcopter-5in/betaflight.js";
import { wiringChecklist } from "../src/system/wiring.js";
import { buildBom } from "../scripts/bom.js";

describe("Betaflight configuration from UHD", () => {
  const cfg = betaflightConfig(SYSTEM, lookup);
  const text = cfg.lines.map((l) => l.text);

  it("assigns serial functions from the UART links (reference §1)", () => {
    expect(text).toContain("serial UART1 2 115200 115200 0 115200");
    expect(text).toContain("serial UART2 64 115200 57600 0 115200");
    expect(text).toContain("serial UART5 131073 115200 57600 0 115200");
  });

  it("derives motor, current-meter and compass settings from part facts", () => {
    expect(text).toEqual(
      expect.arrayContaining([
        "set motor_pwm_protocol = DSHOT600",
        "set motor_poles = 14",
        "set ibata_scale = 150",
        "set align_mag = CW270FLIP",
        "set serialrx_provider = CRSF",
      ]),
    );
  });

  it("requires Betaflight 2025.12.1 for the QMC5883P compass and the MAG build option", () => {
    expect(cfg.minFirmware).toBe("2025.12.1");
    expect(cfg.buildOptions).toContain("MAG");
    expect(cfg.target).toBe("MATEKF405TE");
  });

  it("the legacy M10Q (QMC5883L) works on 4.5.5", () => {
    const legacy = SCENARIOS.find((s) => s.id === "legacy-m10q")!;
    expect(betaflightConfig(legacy.system, legacy.lookup).minFirmware).toBe("4.5.5");
  });
});

describe("wiring checklist", () => {
  it("flags UART crossovers and labels motor phases individually", () => {
    const steps = wiringChecklist(SYSTEM, lookup);
    const crsf = steps.find((s) => s.linkId === "rx_crsf")!;
    expect(crsf.connections.every((c) => c.crossover)).toBe(true);
    const m1 = steps.find((s) => s.linkId === "m1_phases")!;
    expect(new Set(m1.connections.map((c) => c.from)).size).toBe(3);
  });
});

describe("BOM", () => {
  it("every purchased line has a source and quantities multiply through the tree", () => {
    const rows = buildBom(SYSTEM, lookup);
    expect(rows.filter((r) => r.buy === "purchase" && !r.source)).toEqual([]);
    expect(rows.find((r) => r.partId === "meps-neon-2207-v2-1950kv")?.quantity).toBe(4);
    expect(rows.find((r) => r.partId === "ettinger-005-83-060-m3-nylon-spacer-6mm")?.quantity).toBe(8);
  });
});
