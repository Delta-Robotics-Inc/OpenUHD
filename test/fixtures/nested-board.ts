/**
 * The IMU board of imu-board.ts, drawn hierarchically: the IMU and its I2C
 * pull-ups become a sub-circuit with nets of its own (VDD, GND, SDA, SCL,
 * INT1), each exported as a net port, and the board joins those ports to its
 * own nets. The copper is the same as the flat board's; the board's checks
 * see through the ports.
 *
 * FIXTURE, NOT A MANUFACTURABLE DESIGN: the parts are the synthetic parts of
 * imu-board.ts.
 */
import type { ModuleDef } from "../../src/types/index.js";
import { Net, defineModule, netLinks } from "../../src/protocols/index.js";
import { FIXTURE_BUCK_BOOST } from "./parts/fixture-buck-boost.js";
import { FIXTURE_IMU } from "./parts/fixture-imu.js";
import { FIXTURE_MCU } from "./parts/fixture-mcu.js";
import { L_2U2, R_1M, R_220K, R_4K7 } from "./imu-board.js";

/** The IMU sub-circuit: used once or several times on a board. */
export const IMU_MODULE: ModuleDef = defineModule({
  id: "fixture-imu-module",
  name: "IMU sub-circuit (fixture)",
  interfaces: [
    Net({ id: "vdd", name: "VDD", voltageV: 3.3 }),
    Net({ id: "gnd", name: "GND" }),
    Net({ id: "sda", name: "SDA" }),
    Net({ id: "scl", name: "SCL" }),
    Net({ id: "int1", name: "INT1" }),
  ],
  children: [
    { id: "u1", moduleDefId: FIXTURE_IMU.id, name: "IMU" },
    { id: "r1", moduleDefId: R_4K7.id, name: "SDA pull-up" },
    { id: "r2", moduleDefId: R_4K7.id, name: "SCL pull-up" },
  ],
  links: [
    // VDD, VDDIO, and CS high for I2C
    ...netLinks("vdd", ["u1:pin_7", "u1:pin_8", "u1:pin_3", "r1:pin_1", "r2:pin_1"]),
    // ADDR low: I2C address 0x6A
    ...netLinks("gnd", ["u1:pin_9", "u1:pin_10", "u1:pin_4"]),
    ...netLinks("sda", ["u1:pin_1", "r1:pin_2"]),
    ...netLinks("scl", ["u1:pin_2", "r2:pin_2"]),
    ...netLinks("int1", ["u1:pin_5"]),
  ],
  // net ports: each net is on the edge under its own id
  exports: ["vdd", "gnd", "sda", "scl", "int1"].map((id) => ({ id, from: { self: true as const, interfaceId: id } })),
});

/** The board: MCU and regulator on its own nets, the IMU sub-circuit joined through its net ports. */
export const NESTED_BOARD: ModuleDef = defineModule({
  id: "fixture-nested-imu-board",
  name: "IMU board, hierarchical (fixture)",
  kind: "board",
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
    { id: "u3", moduleDefId: FIXTURE_BUCK_BOOST.id, name: "3V3 buck-boost" },
    { id: "l1", moduleDefId: L_2U2.id },
    { id: "r1", moduleDefId: R_1M.id, name: "FB upper" },
    { id: "r2", moduleDefId: R_220K.id, name: "FB lower" },
    { id: "imu", moduleDefId: IMU_MODULE.id, name: "IMU" },
  ],
  links: [
    ...netLinks("vin", ["u3:pin_1", "u3:pin_2", "u3:pin_3", "u3:pin_4", "u3:pin_5"]),
    ...netLinks("sw1", ["u3:pin_6", "l1:pin_1"]),
    ...netLinks("sw2", ["u3:pin_7", "l1:pin_2"]),
    ...netLinks("fb", ["u3:pin_10", "r1:pin_2", "r2:pin_1"]),
    ...netLinks("v3v3", ["u3:pin_8", "u3:pin_9", "r1:pin_1", "u1:pin_1", "u1:pin_9", "u1:pin_19", "u1:pin_24", "u1:pin_25", "imu:vdd"]),
    ...netLinks("vcore", ["u1:pin_26", "u1:pin_27", "u1:pin_28"]),
    ...netLinks("gnd", ["u3:pin_11", "u3:pgnd", "r2:pin_2", "u1:pad_gnd", "u1:pin_10", "imu:gnd"]),
    ...netLinks("sda", ["u1:pin_2", "imu:sda"]),
    ...netLinks("scl", ["u1:pin_3", "imu:scl"]),
    ...netLinks("imu_int1", ["u1:pin_4", "imu:int1"]),
  ],
  exports: [
    { id: "power_in", name: "VIN", from: { child: "u3", interfaceId: "pin_1" } },
    { id: "power_gnd", name: "GND", from: { child: "u3", interfaceId: "pin_11" } },
    { id: "swd", name: "SWD", from: { child: "u1", interfaceId: "swd" } },
  ],
});

const DEFS = [NESTED_BOARD, IMU_MODULE, FIXTURE_MCU, FIXTURE_IMU, FIXTURE_BUCK_BOOST, R_1M, R_220K, R_4K7, L_2U2];

/** Lookup over the fixture's definitions, plus any given (variants built in a test). */
export const lookupNested =
  (...extra: ModuleDef[]) =>
  (id: string): ModuleDef | undefined =>
    extra.find((d) => d.id === id) ?? DEFS.find((d) => d.id === id);
