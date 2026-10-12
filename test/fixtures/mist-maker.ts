/**
 * FIXTURE, NOT A REAL PRODUCT: a bench mist maker built from invented parts,
 * for the tests of the piezo drive and battery charge vocabulary. An
 * ultrasonic mesh atomiser disc on its driver board, a two-chamber piezo
 * micropump on its driver, and a single-cell charger with its cell. Every
 * value is chosen for the tests; none is a manufacturer's figure, and no
 * part here should be used to design hardware.
 */
import type { InterfaceLink, ModuleDef } from "../../src/index.js";
import type { ModuleLookup } from "../../src/system/index.js";
import { ChargePort, Connector, Ground, PiezoDrive, PiezoLoad, PowerIn, PowerOut, cellCount, currentDrawA, defineModule } from "../../src/protocols/index.js";

/** A 16 mm mesh disc on two flying leads: resonance 100 to 116 kHz, 70 V peak to peak at most. */
export const DISC = defineModule({
  id: "fixture-atomizer-disc",
  name: "Fixture mesh atomiser disc",
  categories: ["actuator"],
  interfaces: PiezoLoad({
    kind: "atomizer",
    terminals: { plus: { id: "lead_a", name: "Lead A" }, minus: { id: "lead_b", name: "Lead B" } },
    frequencyHz: [100e3, 116e3],
    driveVoltageVpp: 70,
    powerW: 2,
    capacitanceNf: 3,
    impedanceOhm: 200,
  }),
});

/** A driver board with a fixed 108 kHz, 60 V peak-to-peak output on a two-pin socket. */
export const DISC_DRIVER = defineModule({
  id: "fixture-atomizer-driver",
  name: "Fixture atomiser driver board",
  categories: ["expansion.breakout"],
  interfaces: [
    PowerIn({ id: "vin", pin: "VIN", voltageV: 5, parameters: [currentDrawA(0.4)] }),
    Ground({ id: "gnd", pin: "GND" }),
    ...PiezoDrive({ id: "transducer", terminals: { plus: { pin: "J2-1", name: "OUT+" }, minus: { pin: "J2-2", name: "OUT-" } }, frequencyHz: 108e3, driveVoltageVpp: 60, powerW: 2, waveform: "sine" }),
  ],
});

/** A micropump with two piezo actuators driven half a cycle apart: 1 to 300 Hz, 240 V peak to peak at most. */
export const PUMP = defineModule({
  id: "fixture-piezo-pump",
  name: "Fixture piezo micropump",
  categories: ["actuator"],
  interfaces: PiezoLoad({
    id: "actuators",
    kind: "pump",
    terminals: [
      { plus: { pin: 2, name: "+P1" }, minus: { pin: 1, name: "-P1" } },
      { plus: { pin: 3, name: "+P2" }, minus: { pin: 4, name: "-P2" } },
    ],
    frequencyHz: [1, 300],
    driveVoltageVpp: 240,
    polarized: true,
  }),
});

/** A pump driver with two outputs: 10 to 1000 Hz, up to 140 V peak to peak. */
export const PUMP_DRIVER = defineModule({
  id: "fixture-piezo-pump-driver",
  name: "Fixture piezo pump driver",
  categories: ["expansion.breakout"],
  interfaces: [
    PowerIn({ id: "vdd", pin: 16, voltageV: [3, 5.5], parameters: [currentDrawA(0.05)] }),
    Ground({ id: "gnd", pin: 3 }),
    ...PiezoDrive({
      id: "pump_out",
      terminals: [
        { plus: { pin: 8, name: "P1+" }, minus: { pin: 9, name: "P1-" } },
        { plus: { pin: 11, name: "P2+" }, minus: { pin: 10, name: "P2-" } },
      ],
      frequencyHz: [10, 1000],
      driveVoltageVpp: [0, 140],
      waveform: "sine",
    }),
  ],
});

/** A single-cell lithium charger board: 4.2 V, 0.1 to 1 A by a resistor, with a system output and a two-pin battery socket. */
export const CHARGER = defineModule({
  id: "fixture-cell-charger",
  name: "Fixture single-cell charger board",
  categories: ["power.charger"],
  interfaces: [
    PowerIn({ id: "usb_in", pin: "VBUS", voltageV: [4.4, 6], nominalV: 5 }),
    PowerOut({ id: "sys_out", pin: "SYS", voltageV: [3, 5], nominalV: 4.4, maxCurrentA: 2 }),
    PowerOut({ id: "bat", pin: "BAT", voltageV: [3, 4.2], nominalV: 4.2, maxCurrentA: 1 }),
    Ground({ id: "gnd", pin: "GND" }),
    ...ChargePort({ role: "charger", plus: "bat", minus: "gnd", chemistry: ["li_ion", "li_polymer"], cells: 1, chargeVoltageV: 4.2, chargeCurrentA: [0.1, 1] }),
    Connector({ id: "battery_socket", connector: "jst_ph_2", gender: "receptacle", pins: [["-", "gnd"], ["+", "bat"]] }),
  ],
});

/** A 2000 mAh lithium polymer cell on a two-pin plug: charged to 4.2 V at up to 1 A. */
export const CELL = defineModule({
  id: "fixture-lipo-cell",
  name: "Fixture lithium polymer cell",
  categories: ["power.battery"],
  interfaces: [
    PowerOut({ id: "cell_pos", pin: "+", voltageV: [3, 4.2], nominalV: 3.7, maxCurrentA: 2, parameters: [cellCount(1)] }),
    Ground({ id: "cell_neg", pin: "-" }),
    ...ChargePort({ role: "battery", plus: "cell_pos", minus: "cell_neg", chemistry: "li_polymer", cells: 1, chargeVoltageV: 4.2, chargeCurrentA: 1, capacitymAh: 2000 }),
    Connector({ id: "plug", connector: "jst_ph_2", gender: "plug", pins: [["-", "cell_neg"], ["+", "cell_pos"]] }),
  ],
});

const link = (id: string, a: [string, string], b: [string, string]): InterfaceLink => ({ id, a: { child: a[0], interfaceId: a[1] }, b: { child: b[0], interfaceId: b[1] } });

/** The mist maker: the cell plugged into the charger, whose system output feeds both drivers. */
export const MIST_MAKER: ModuleDef = {
  id: "fixture-mist-maker",
  name: "Fixture mist maker",
  kind: "module",
  interfaces: [],
  children: [
    { id: "disc", moduleDefId: DISC.id },
    { id: "disc_driver", moduleDefId: DISC_DRIVER.id },
    { id: "pump", moduleDefId: PUMP.id },
    { id: "pump_driver", moduleDefId: PUMP_DRIVER.id },
    { id: "charger", moduleDefId: CHARGER.id, unconnected: [{ interfaceId: "usb_in", reason: "fixture: runs from the cell; USB is plugged in only to charge" }] },
    { id: "cell", moduleDefId: CELL.id },
  ],
  links: [
    link("disc_drive", ["disc_driver", "transducer"], ["disc", "piezo"]),
    link("pump_drive", ["pump_driver", "pump_out"], ["pump", "actuators"]),
    link("battery_plug", ["charger", "battery_socket"], ["cell", "plug"]),
    link("disc_driver_power", ["charger", "sys_out"], ["disc_driver", "vin"]),
    link("disc_driver_gnd", ["charger", "gnd"], ["disc_driver", "gnd"]),
    link("pump_driver_power", ["charger", "sys_out"], ["pump_driver", "vdd"]),
    link("pump_driver_gnd", ["charger", "gnd"], ["pump_driver", "gnd"]),
  ],
};

export const DEFINITIONS: ModuleDef[] = [MIST_MAKER, DISC, DISC_DRIVER, PUMP, PUMP_DRIVER, CHARGER, CELL];

/** The lookup with some definitions replaced. */
export const lookupWith = (...overrides: ModuleDef[]): ModuleLookup => {
  const byId = new Map([...DEFINITIONS, ...overrides].map((d) => [d.id, d]));
  return (id) => byId.get(id);
};
export const lookup: ModuleLookup = lookupWith();
