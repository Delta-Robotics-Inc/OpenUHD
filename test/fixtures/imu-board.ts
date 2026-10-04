/**
 * Example custom PCB: a microcontroller reading an IMU over I2C, both on a
 * 3.3 V rail from a buck-boost regulator. It exercises the board convention
 * in docs/boards-and-nets.md: components as children, nets as `Net`
 * interfaces joined by membership links, the board edge as exports.
 *
 * FIXTURE, NOT A MANUFACTURABLE DESIGN. The three chips are synthetic parts
 * (fixtures/parts): invented pinouts and ratings, no real device. The board
 * carries what the system checks need and leaves out what they do not read:
 * clocks, reset, and all decoupling and bulk capacitors.
 *
 * Design choices:
 *   - Regulator: VIN, VAUX, EN and MODE tied to the input; inductor between
 *     LX1 and LX2; VOUT 3.3 V from a 1 MΩ / 220 kΩ divider to its 0.6 V
 *     reference (0.6 × (1 + 1000/220) ≈ 3.33 V).
 *   - IMU: CS high selects I2C; ADDR to GND selects address 0x6A.
 *   - MCU: TEST tied to GND; VCORE from its own VREG_OUT; I2C 0 on PA0/PA1.
 *   - Assumption: the I2C pull-ups are 4.7 kΩ, a common value at 400 kHz and
 *     3.3 V, not sized from a bus-capacitance budget.
 */
import type { ModuleDef } from "../../src/types/index.js";
import { Net, Passive, defineModule, netLinks } from "../../src/protocols/index.js";
import { FIXTURE_BUCK_BOOST } from "./parts/fixture-buck-boost.js";
import { FIXTURE_IMU } from "./parts/fixture-imu.js";
import { FIXTURE_MCU } from "./parts/fixture-mcu.js";

const CHIP_0402 = { name: "0402", code: "1005 metric", pin_count: 2, exposed_pad: false, assumption: "Chip size chosen for the fixture." };
const DIVIDER = "Feedback divider for 3.3 V on the fixture regulator's 0.6 V reference.";

export const R_1M = Passive({
  id: "fixture-r-1m-0402",
  name: "Resistor 1 MΩ 1 % 0402",
  kind: "resistor",
  value: 1e6,
  unit: "Ω",
  tolerance: 0.01,
  package: CHIP_0402,
  assumption: `${DIVIDER} Upper resistor.`,
});

export const R_220K = Passive({
  id: "fixture-r-220k-0402",
  name: "Resistor 220 kΩ 1 % 0402",
  kind: "resistor",
  value: 220e3,
  unit: "Ω",
  tolerance: 0.01,
  package: CHIP_0402,
  assumption: `${DIVIDER} Lower resistor.`,
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

export const L_2U2 = Passive({
  id: "fixture-l-2u2",
  name: "Inductor 2.2 µH",
  kind: "inductor",
  value: 2.2e-6,
  unit: "H",
  assumption: "Inductor value chosen for the fixture regulator.",
});

export const IMU_BOARD: ModuleDef = defineModule({
  id: "fixture-imu-board",
  name: "IMU board (fixture)",
  description: "Synthetic MCU + IMU on I2C 0, 3.3 V from a synthetic buck-boost regulator. Test fixture for the board convention; not a complete design.",
  interfaces: [
    Net({ id: "vin", name: "VIN", voltageV: [2.5, 5.5] }),
    Net({ id: "v3v3", name: "3V3", voltageV: 3.3 }),
    Net({ id: "vcore", name: "VCORE", voltageV: 1.2 }),
    Net({ id: "gnd", name: "GND" }),
    Net({ id: "fb", name: "FB" }),
    Net({ id: "sw1", name: "SW1" }),
    Net({ id: "sw2", name: "SW2" }),
    Net({ id: "sda", name: "SDA" }),
    Net({ id: "scl", name: "SCL" }),
    Net({ id: "imu_int1", name: "IMU_INT1" }),
  ],
  children: [
    { id: "u1", moduleDefId: FIXTURE_MCU.id, name: "MCU" },
    { id: "u2", moduleDefId: FIXTURE_IMU.id, name: "IMU" },
    { id: "u3", moduleDefId: FIXTURE_BUCK_BOOST.id, name: "3V3 buck-boost" },
    { id: "l1", moduleDefId: L_2U2.id },
    { id: "r1", moduleDefId: R_1M.id, name: "FB upper" },
    { id: "r2", moduleDefId: R_220K.id, name: "FB lower" },
    { id: "r3", moduleDefId: R_4K7.id, name: "SDA pull-up" },
    { id: "r4", moduleDefId: R_4K7.id, name: "SCL pull-up" },
  ],
  links: [
    // regulator: VIN ×2, VAUX, EN and MODE on the input
    ...netLinks("vin", ["u3:pin_1", "u3:pin_2", "u3:pin_3", "u3:pin_4", "u3:pin_5"]),
    ...netLinks("sw1", ["u3:pin_6", "l1:pin_1"]),
    ...netLinks("sw2", ["u3:pin_7", "l1:pin_2"]),
    ...netLinks("fb", ["u3:pin_10", "r1:pin_2", "r2:pin_1"]),
    ...netLinks("v3v3", [
      "u3:pin_8", "u3:pin_9", "r1:pin_1",
      // MCU VDDIO ×3, VDDA, VREG_IN
      "u1:pin_1", "u1:pin_9", "u1:pin_19", "u1:pin_24", "u1:pin_25",
      // IMU VDD, VDDIO, and CS high for I2C
      "u2:pin_7", "u2:pin_8", "u2:pin_3",
      "r3:pin_1", "r4:pin_1",
    ]),
    // MCU core: VREG_OUT feeds both VCORE pins
    ...netLinks("vcore", ["u1:pin_26", "u1:pin_27", "u1:pin_28"]),
    ...netLinks("gnd", [
      "u3:pin_11", "u3:pgnd", "r2:pin_2",
      "u1:pad_gnd", "u1:pin_10", // TEST tied to GND
      "u2:pin_9", "u2:pin_10", "u2:pin_4", // ADDR low: I2C address 0x6A
    ]),
    ...netLinks("sda", ["u1:pin_2", "u2:pin_1", "r3:pin_2"]),
    ...netLinks("scl", ["u1:pin_3", "u2:pin_2", "r4:pin_2"]),
    ...netLinks("imu_int1", ["u1:pin_4", "u2:pin_5"]),
  ],
  // the board edge: battery input pads and the debug port
  exports: [
    { id: "power_in", name: "VIN", from: { child: "u3", interfaceId: "pin_1" } },
    { id: "power_gnd", name: "GND", from: { child: "u3", interfaceId: "pin_11" } },
    { id: "swd", name: "SWD", from: { child: "u1", interfaceId: "swd" } },
  ],
  traits: [
    {
      type: "design_envelope",
      params: { max_mm: { length: 30, width: 20, height: 5 }, reason: "Fixture requirement: fits a 30 × 20 mm bay." },
    },
  ],
});

const DEFS = [IMU_BOARD, FIXTURE_MCU, FIXTURE_IMU, FIXTURE_BUCK_BOOST, R_1M, R_220K, R_4K7, L_2U2];

export const lookupBoardModule = (id: string): ModuleDef | undefined => DEFS.find((d) => d.id === id);
