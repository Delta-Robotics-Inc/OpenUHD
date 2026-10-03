/**
 * Example custom PCB (PB-824): an RP2040 reading a BMI270 IMU over I2C, both
 * on a 3.3 V rail from a TPS63020 buck-boost converter. It exercises the
 * board convention in docs/boards-and-nets.md: components as children, nets
 * as `Net` interfaces joined by membership links, the board edge as exports.
 *
 * FIXTURE, NOT A MANUFACTURABLE DESIGN. It carries what the system checks
 * need and leaves out what they do not read: the RP2040's QSPI flash,
 * 12 MHz crystal and USB, BOOTSEL, and all decoupling and bulk capacitors.
 *
 * Sources for the design choices:
 *   - Regulator: TPS6302x datasheet SLVS916I, §8.2 Figure 7 application
 *     circuit (VIN 2.5–5.5 V; VINA, EN and PS/SYNC tied to VIN; 1.5 µH
 *     inductor; VOUT 3.3 V) and Table 3 (3.3 V: R1 = 1 MΩ, R2 = 180 kΩ) —
 *     https://www.ti.com/lit/ds/symlink/tps63020.pdf
 *   - IMU: BMI270 datasheet BST-BMI270-DS000-08, Table 22 (I2C mode: CSB to
 *     VDDIO; SDO to GND for address 0x68) —
 *     https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf
 *   - MCU: RP2040 datasheet Table 1 (TESTEN tied to GND; DVDD from
 *     VREG_VOUT; I2C0 on GPIO0/GPIO1) —
 *     https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf
 *   - Assumption: the I2C pull-ups are 4.7 kΩ, a common value at 400 kHz and
 *     3.3 V, not sized from a bus-capacitance budget.
 */
import type { ModuleDef } from "../../src/types/index.js";
import { Net, Passive, defineModule, netLinks } from "../../src/protocols/index.js";
import { BOSCH_BMI270 } from "./parts/bosch-bmi270.js";
import { RP2040 } from "./parts/rp2040.js";
import { TI_TPS63020DSJR } from "./parts/ti-tps63020dsjr.js";

const TPS = "https://www.ti.com/lit/ds/symlink/tps63020.pdf";

const CHIP_0402 = { name: "0402", code: "1005 metric", pin_count: 2, exposed_pad: false, assumption: "Chip size chosen for the fixture." };

export const R_1M = Passive({
  id: "fixture-r-1m-0402",
  name: "Resistor 1 MΩ 1 % 0402",
  kind: "resistor",
  value: 1e6,
  unit: "Ω",
  tolerance: 0.01,
  package: CHIP_0402,
  source: `${TPS} (Table 3, VOUT 3.3 V: R1)`,
});

export const R_180K = Passive({
  id: "fixture-r-180k-0402",
  name: "Resistor 180 kΩ 1 % 0402",
  kind: "resistor",
  value: 180e3,
  unit: "Ω",
  tolerance: 0.01,
  package: CHIP_0402,
  source: `${TPS} (Table 3, VOUT 3.3 V: R2)`,
});

export const R_4K7 = Passive({
  id: "fixture-r-4k7-0402",
  name: "Resistor 4.7 kΩ 1 % 0402",
  kind: "resistor",
  value: 4.7e3,
  unit: "Ω",
  tolerance: 0.01,
  package: CHIP_0402,
  assumption: "I2C pull-up value: a common choice at 400 kHz and 3.3 V, not sized from bus capacitance.",
});

export const L_1U5 = Passive({
  id: "fixture-l-1u5",
  name: "Inductor 1.5 µH",
  kind: "inductor",
  value: 1.5e-6,
  unit: "H",
  source: `${TPS} (§8.2 Figure 7, §8.2.2.2)`,
});

export const IMU_BOARD: ModuleDef = defineModule({
  id: "fixture-imu-board",
  name: "IMU board (fixture)",
  description: "RP2040 + BMI270 on I2C0, 3.3 V from a TPS63020 buck-boost. Test fixture for the board convention; not a complete design.",
  interfaces: [
    Net({ id: "vin", name: "VIN", voltageV: [2.5, 5.5] }),
    Net({ id: "v3v3", name: "3V3", voltageV: 3.3 }),
    Net({ id: "v1v1", name: "1V1", voltageV: 1.1 }),
    Net({ id: "gnd", name: "GND" }),
    Net({ id: "fb", name: "FB" }),
    Net({ id: "sw1", name: "SW1" }),
    Net({ id: "sw2", name: "SW2" }),
    Net({ id: "sda", name: "SDA" }),
    Net({ id: "scl", name: "SCL" }),
    Net({ id: "imu_int1", name: "IMU_INT1" }),
  ],
  children: [
    { id: "u1", moduleDefId: RP2040.id, name: "MCU" },
    { id: "u2", moduleDefId: BOSCH_BMI270.id, name: "IMU" },
    { id: "u3", moduleDefId: TI_TPS63020DSJR.id, name: "3V3 buck-boost" },
    { id: "l1", moduleDefId: L_1U5.id },
    { id: "r1", moduleDefId: R_1M.id, name: "FB upper" },
    { id: "r2", moduleDefId: R_180K.id, name: "FB lower" },
    { id: "r3", moduleDefId: R_4K7.id, name: "SDA pull-up" },
    { id: "r4", moduleDefId: R_4K7.id, name: "SCL pull-up" },
  ],
  links: [
    // TPS63020: VIN, VINA, EN and PS/SYNC on the input (Figure 7)
    ...netLinks("vin", ["u3:pin_10", "u3:pin_11", "u3:pin_1", "u3:pin_12", "u3:pin_13"]),
    ...netLinks("sw1", ["u3:pin_8", "u3:pin_9", "l1:pin_1"]),
    ...netLinks("sw2", ["u3:pin_6", "u3:pin_7", "l1:pin_2"]),
    ...netLinks("fb", ["u3:pin_3", "r1:pin_2", "r2:pin_1"]),
    ...netLinks("v3v3", [
      "u3:pin_4", "u3:pin_5", "r1:pin_1",
      // RP2040 IOVDD ×6, ADC_AVDD, VREG_VIN, USB_VDD
      "u1:pin_1", "u1:pin_10", "u1:pin_22", "u1:pin_33", "u1:pin_42", "u1:pin_49", "u1:pin_43", "u1:pin_44", "u1:pin_48",
      // BMI270 VDD, VDDIO, and CSB high for I2C
      "u2:pin_8", "u2:pin_5", "u2:pin_12",
      "r3:pin_1", "r4:pin_1",
    ]),
    // RP2040 core: VREG_VOUT feeds both DVDD pins
    ...netLinks("v1v1", ["u1:pin_45", "u1:pin_23", "u1:pin_50"]),
    ...netLinks("gnd", [
      "u3:pin_2", "u3:pgnd", "r2:pin_2",
      "u1:pad_gnd", "u1:pin_19", // TESTEN tied to GND
      "u2:pin_6", "u2:pin_7", "u2:pin_1", // SDO low: I2C address 0x68
    ]),
    ...netLinks("sda", ["u1:pin_2", "u2:pin_14", "r3:pin_2"]),
    ...netLinks("scl", ["u1:pin_3", "u2:pin_13", "r4:pin_2"]),
    ...netLinks("imu_int1", ["u1:pin_4", "u2:pin_4"]),
  ],
  // the board edge: battery input pads and the debug port
  exports: [
    { id: "power_in", name: "VIN", from: { child: "u3", interfaceId: "pin_10" } },
    { id: "power_gnd", name: "GND", from: { child: "u3", interfaceId: "pin_2" } },
    { id: "swd", name: "SWD", from: { child: "u1", interfaceId: "swd" } },
  ],
  traits: [
    {
      type: "design_envelope",
      params: { max_mm: { length: 30, width: 20, height: 5 }, reason: "Fixture requirement: fits a 30 × 20 mm bay." },
    },
  ],
});

const DEFS = [IMU_BOARD, RP2040, BOSCH_BMI270, TI_TPS63020DSJR, R_1M, R_180K, R_4K7, L_1U5];

export const lookupBoardModule = (id: string): ModuleDef | undefined => DEFS.find((d) => d.id === id);
