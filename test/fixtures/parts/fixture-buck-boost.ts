/**
 * SYNTHETIC TEST PART. An invented adjustable buck-boost regulator in a
 * 12-pin SON with an exposed ground pad: no real device has this pinout or
 * these ratings. It carries what the board checks read: doubled VIN and VOUT
 * pins grouped by an input and an output port, a rated output current, a
 * feedback pin, two inductor pins and a package.
 */
import type { InterfaceDef, ModuleDef } from "../../../src/types/index.js";
import { pinTable } from "../../../src/protocols/index.js";

const SRC = "fixture: invented part, no datasheet";

const pins = pinTable(
  [
    { pin: 1, name: "VIN", type: "power_in", description: "Power stage input", voltageV: [2.0, 5.5], nominalV: 3.6 },
    { pin: 2, name: "VIN", type: "power_in", description: "Power stage input", voltageV: [2.0, 5.5], nominalV: 3.6 },
    { pin: 3, name: "VAUX", type: "power_in", description: "Control supply", voltageV: [2.0, 5.5], nominalV: 3.6 },
    { pin: 4, name: "EN", type: "input", description: "Enable, active high", voltageV: [0, 5.5], capabilities: ["enable"] },
    { pin: 5, name: "MODE", type: "input", description: "High: forced PWM; low: power save", voltageV: [0, 5.5] },
    [6, "LX1", "passive", "Inductor, input side"],
    [7, "LX2", "passive", "Inductor, output side"],
    { pin: 8, name: "VOUT", type: "power_out", description: "Regulated output", voltageV: [1.0, 5.5] },
    { pin: 9, name: "VOUT", type: "power_out", description: "Regulated output", voltageV: [1.0, 5.5] },
    [10, "FB", "analog_in", "Feedback, 0.6 V reference"],
    [11, "GND", "ground", "Control ground"],
    { pin: 12, name: "PG", type: "output", description: "Power good, open drain", capabilities: ["open_drain", "power_good"] },
    { pin: "EP", id: "pgnd", name: "PGND", type: "ground", description: "Power ground, exposed pad" },
  ],
  { source: SRC },
);

const gnd = { id: "gnd", required: true, match: { protocol: "power", role: "ground", capability: "ground" } };

const vin: InterfaceDef = {
  id: "vin",
  name: "Input supply (VIN + VAUX)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "power", roles: ["input"] }],
  parameters: [{ id: "voltage", unit: "V", value: 3.6, range: [2.0, 5.5] }],
  slots: [
    { id: "vin_a", required: true, match: { protocol: "power", role: "input" } },
    { id: "vin_b", required: true, match: { protocol: "power", role: "input" } },
    { id: "vaux", required: true, match: { protocol: "power", role: "input" } },
    gnd,
  ],
  profiles: [{ id: "vin_pins", label: "VIN 1/2, VAUX 3, PGND", default_active: true, bindings: { vin_a: "pin_1", vin_b: "pin_2", vaux: "pin_3", gnd: "pgnd" } }],
};

const vout: InterfaceDef = {
  id: "vout",
  name: "Regulated output (VOUT)",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "power", roles: ["output"] }],
  parameters: [
    { id: "voltage", unit: "V", range: [1.0, 5.5] },
    { id: "max_current", unit: "A", value: 1.5 },
  ],
  slots: [
    { id: "vout_a", required: true, match: { protocol: "power", role: "output" } },
    { id: "vout_b", required: true, match: { protocol: "power", role: "output" } },
    gnd,
  ],
  profiles: [{ id: "vout_pins", label: "VOUT 8/9, PGND", default_active: true, bindings: { vout_a: "pin_8", vout_b: "pin_9", gnd: "pgnd" } }],
};

export const FIXTURE_BUCK_BOOST: ModuleDef = {
  id: "fixture-buck-boost-son12",
  name: "Fixture buck-boost regulator (synthetic)",
  version: "1.0.0",
  description: "Invented adjustable buck-boost regulator for tests: VIN 2.0-5.5 V, VOUT 1.0-5.5 V set by a divider to a 0.6 V reference, 1.5 A output, 12-pin SON with exposed pad. Not a real part.",
  categories: ["power", "power.regulator"],
  interfaces: [...pins, vin, vout],
  interfaceGroups: [
    { id: "vin_pair", label: "VIN pins 1 and 2 (both must be connected)", members: ["pin_1", "pin_2"], policy: "all_of" },
    { id: "vout_pair", label: "VOUT pins 8 and 9 (both must be connected)", members: ["pin_8", "pin_9"], policy: "all_of" },
  ],
  domains: [
    {
      domain: "mechanical",
      dimensions_mm: { length: 3, width: 3, height: 0.9 },
      package: { name: "SON-12", pin_count: 12, pitch_mm: 0.5, exposed_pad: true, exposed_pad_pin: "EP", exposed_pad_mm: [2.4, 1.7], source: SRC },
    },
  ],
};
