/**
 * SYNTHETIC TEST PART. An invented microcontroller in a 32-pin QFN with an
 * exposed ground pad: no real device has this pinout or these ratings. It
 * carries what the board checks read: I/O, analog and regulator-input supply
 * pins, an internal core regulator whose output feeds its own core supply
 * pins (stated with `bridgesTo`), a test-mode strap input, an I2C controller,
 * SWD and a package.
 */
import type { InterfaceDef, ModuleDef } from "../../../src/types/index.js";
import { I2C, pinTable } from "../../../src/protocols/index.js";

const SRC = "fixture: invented part, no datasheet";

const io = (pin: number, name: string, capabilities: string[] = []) => ({ pin, name, type: "io" as const, description: `General-purpose I/O ${name}`, capabilities });
const vddio = (pin: number) => ({ pin, name: "VDDIO", type: "power_in" as const, description: "I/O supply", voltageV: [1.62, 3.6] as [number, number], nominalV: 3.3 });
const vcore = (pin: number) => ({ pin, name: "VCORE", type: "power_in" as const, description: "Core supply, from VREG_OUT", voltageV: [1.1, 1.3] as [number, number], nominalV: 1.2 });

const BRIDGES: Record<string, string[]> = { pin_25: ["pin_26"], pin_26: ["pin_27", "pin_28"] };

const pins: InterfaceDef[] = pinTable(
  [
    vddio(1),
    io(2, "PA0", ["i2c_sda"]),
    io(3, "PA1", ["i2c_scl"]),
    io(4, "PA2", ["interrupt"]),
    io(5, "PA3"),
    io(6, "PA4"),
    io(7, "PA5"),
    io(8, "PA6"),
    vddio(9),
    [10, "TEST", "input", "Factory test mode; tie to GND"],
    io(11, "PA7"),
    io(12, "PB0"),
    io(13, "PB1"),
    io(14, "PB2"),
    io(15, "PB3"),
    { pin: 16, name: "SWCLK", type: "input", description: "Debug clock", capabilities: ["swd_clk"] },
    { pin: 17, name: "SWDIO", type: "io", description: "Debug data", capabilities: ["swd_io"] },
    { pin: 18, name: "NRST", type: "input", description: "Reset, active low", capabilities: ["reset_input"] },
    vddio(19),
    io(20, "PB4"),
    io(21, "PB5"),
    io(22, "PB6"),
    io(23, "PB7"),
    { pin: 24, name: "VDDA", type: "power_in", description: "Analog supply", voltageV: [1.62, 3.6], nominalV: 3.3 },
    { pin: 25, name: "VREG_IN", type: "power_in", description: "Core regulator input", voltageV: [1.62, 3.6], nominalV: 3.3 },
    { pin: 26, name: "VREG_OUT", type: "power_out", description: "Core regulator output, 1.2 V", voltageV: 1.2 },
    vcore(27),
    vcore(28),
    io(29, "PC0"),
    io(30, "PC1"),
    io(31, "PC2"),
    io(32, "PC3"),
    { pin: 33, id: "pad_gnd", name: "GND", type: "ground", description: "Ground, exposed pad" },
  ],
  { source: SRC, logicV: [1.62, 3.6] },
).map((p) => {
  const withBridge = BRIDGES[p.id] ? { ...p, bridgesTo: BRIDGES[p.id] } : p;
  // the core regulator is rated 100 mA
  return p.id === "pin_26" ? { ...withBridge, parameters: [...(p.parameters ?? []), { id: "max_current", unit: "A", value: 0.1 }] } : withBridge;
});

const swd: InterfaceDef = {
  id: "swd",
  name: "SWD (serial wire debug)",
  domain: "electrical",
  exposed: true,
  default_active: false,
  protocols: [{ type: "swd", roles: ["target"] }],
  slots: [
    { id: "swclk", required: true, match: { capability: "swd_clk" } },
    { id: "swdio", required: true, match: { capability: "swd_io" } },
  ],
  profiles: [{ id: "swd_pins", label: "SWCLK/SWDIO (pins 16/17)", bindings: { swclk: "pin_16", swdio: "pin_17" } }],
  max_instances: 1,
};

export const FIXTURE_MCU: ModuleDef = {
  id: "fixture-mcu-qfn32",
  name: "Fixture microcontroller (synthetic)",
  version: "1.0.0",
  description: "Invented microcontroller for tests: 24 I/O pins, one I2C controller on PA0/PA1, SWD, VDDIO 1.62-3.6 V, an internal 1.2 V core regulator (VREG_IN to VREG_OUT) that feeds its VCORE pins, 32-pin QFN with exposed pad. Not a real part.",
  categories: ["microcontroller"],
  interfaces: [
    ...pins,
    ...I2C({ id: "i2c_0", name: "I2C 0", roles: ["master", "slave"], clockFreqHz: [100_000, 1_000_000], sda: "pin_2", scl: "pin_3", defaultActive: false }),
    swd,
  ],
  domains: [
    {
      domain: "mechanical",
      dimensions_mm: { length: 5, width: 5, height: 0.9 },
      package: { name: "QFN-32", pin_count: 32, pitch_mm: 0.5, exposed_pad: true, exposed_pad_pin: 33, exposed_pad_mm: [3.5, 3.5], source: SRC },
    },
  ],
};
