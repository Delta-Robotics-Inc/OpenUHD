/**
 * SYNTHETIC TEST PART. An invented 6-axis IMU in a 12-pad LGA: no real
 * device has this pinout, these ratings or this address. It carries what
 * the board checks read: a pin table with designators, an I2C target whose
 * address is set by a strap pin, an SPI target on the same pads, two supply
 * pins and a package.
 */
import type { ModuleDef } from "../../../src/types/index.js";
import { I2C, SPI, pinTable } from "../../../src/protocols/index.js";

const SRC = "fixture: invented part, no datasheet";

const pins = pinTable(
  [
    { pin: 1, name: "SDA", type: "io", description: "Serial data (I2C SDA, SPI SDI)", capabilities: ["i2c_sda", "spi_mosi"] },
    { pin: 2, name: "SCL", type: "input", description: "Serial clock (I2C SCL, SPI SCK)", capabilities: ["i2c_scl", "spi_sck"] },
    { pin: 3, name: "CS", type: "input", description: "SPI chip select; tie high for I2C", capabilities: ["spi_ss"] },
    {
      pin: 4,
      name: "ADDR",
      type: "io",
      description: "SPI SDO; I2C address bit 0",
      capabilities: ["spi_miso"],
      traits: [
        {
          type: "strap",
          params: {
            function: "I2C address bit 0",
            when: ["i2c"],
            levels: { low: "address 0x6A (ADDR to GND)", high: "address 0x6B (ADDR to VDDIO)" },
            source: SRC,
          },
        },
      ],
    },
    { pin: 5, name: "INT1", type: "io", description: "Interrupt output 1", capabilities: ["interrupt"], protocols: [{ type: "interrupt", roles: ["output"] }] },
    { pin: 6, name: "INT2", type: "io", description: "Interrupt output 2", capabilities: ["interrupt"], protocols: [{ type: "interrupt", roles: ["output"] }] },
    { pin: 7, name: "VDD", type: "power_in", description: "Core supply", voltageV: [1.71, 3.6], nominalV: 1.8 },
    { pin: 8, name: "VDDIO", type: "power_in", description: "I/O supply", voltageV: [1.2, 3.6], nominalV: 1.8 },
    [9, "GND", "ground", "Ground"],
    [10, "GNDIO", "ground", "I/O ground"],
    [11, "NC", "nc"],
    [12, "NC", "nc"],
  ],
  { source: SRC, logicV: [1.2, 3.6] },
);

export const FIXTURE_IMU: ModuleDef = {
  id: "fixture-imu-lga12",
  name: "Fixture 6-axis IMU (synthetic)",
  version: "1.0.0",
  description: "Invented 6-axis IMU for tests: I2C target at 0x6A/0x6B (ADDR strap) or SPI target on the same pads, VDD 1.71-3.6 V, VDDIO 1.2-3.6 V, 12-pad LGA. Not a real part.",
  categories: ["sensor", "sensor.motion"],
  interfaces: [
    ...pins,
    ...I2C({ id: "i2c", name: "I2C (target)", roles: ["slave"], clockFreqHz: [0, 1_000_000], address: 0x6a, sda: "pin_1", scl: "pin_2", defaultActive: false }),
    ...SPI({ id: "spi", name: "SPI (target)", roles: ["slave"], clockFreqHz: [0, 10_000_000], mosi: "pin_1", miso: "pin_4", sck: "pin_2", ss: "pin_3", defaultActive: false }),
  ],
  interfaceGroups: [{ id: "host_interface", label: "Host interface (I2C or SPI, shared pads)", members: ["i2c", "spi"], policy: "one_of" }],
  domains: [
    {
      domain: "mechanical",
      dimensions_mm: { length: 2.5, width: 2, height: 0.8 },
      package: { name: "LGA-12", pin_count: 12, pitch_mm: 0.5, exposed_pad: false, source: SRC },
    },
  ],
};
