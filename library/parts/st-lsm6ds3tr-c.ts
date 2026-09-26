/**
 * STMicroelectronics LSM6DS3TR-C iNEMO 6-axis IMU (bare LGA-14L) —
 * datasheet-honest UHD part.
 *
 * Sources (see ./st-lsm6ds3tr-c/sources.json):
 *   - src_datasheet: LSM6DS3TR-C datasheet DocID030071 Rev 3 (ST document; the
 *     bytes were fetched from Adafruit's mirror because st.com refused the
 *     connection) — https://cdn-shop.adafruit.com/product-files/4503/4503_LSM6DS3TR-C_datasheet.pdf
 *     canonical: https://www.st.com/resource/en/datasheet/lsm6ds3tr-c.pdf
 *     (Figure 1 + Table 2 pins, Table 4 electrical, Table 6 SPI, Table 9
 *     absolute maximum, §6 digital interfaces, Figure 17 package)
 *   - src_protopart: ProtoPart lsm6ds3tr-c definition (community starting
 *     point; every value re-verified against the datasheet).
 *
 * Modelling notes:
 *   - Pin-honest: all 14 pads are leaves `pin_1`..`pin_14` with Table 2 names
 *     and verbatim `pin_functions` traits. NC pins 10/11 are leaves with a
 *     `custom` protocol so the "leave unconnected and soldered" rule is
 *     visible; they pair with nothing.
 *   - Primary host bus: I2C slave (SDA pin 14 / SCL pin 13, address 0x6A with
 *     SA0 to GND, 0x6B with SA0 to supply, 400 kHz fast mode) or SPI 4-wire
 *     slave (SDI pin 14, SDO pin 1, SPC pin 13, CS pin 12, 10 MHz). One_of
 *     group. SPI 3-wire (SDA/SDI/SDO as SDIO) is a usage_note: the SPI builder
 *     requires a MISO slot.
 *   - Mode 2 sensor-hub I2C master on SDx (MSDA) / SCx (MSCL), with MDRDY on
 *     INT2. In Mode 1 SDx/SCx must be tied to VDDIO or GND.
 *   - `pcb_mount` is the SMD land pattern bound to the 14 pad faces of the
 *     generated package (seating plane frame, normal -Z); no bolt pattern on
 *     a bare IC.
 *   - Height: the cover gives 0.83 mm typ, Figure 17 gives 0.86 mm max;
 *     ProtoPart used 0.86 as the dimension. CAD and dimensions use 0.83 typ
 *     (source_discrepancy trait).
 *   - VDDIO max is "VDD + 0.1 V" (Table 4); ProtoPart's 3.6 V upper bound is
 *     only valid at VDD = 3.6 V (source_discrepancy trait). The parameter
 *     range is 1.62-3.6 V with the VDD + 0.1 V rule in a usage_note.
 *   - Geometry generated from Figure 17 (no manufacturer CAD reachable:
 *     data_gap). Pad-edge distance for the top/bottom rows and pad thickness
 *     are assumption traits.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { Ground, I2C, PowerIn, SPI, defineModule } from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, withGeometry } from "../cad/artifacts.js";

const SRC = {
  datasheet: "https://cdn-shop.adafruit.com/product-files/4503/4503_LSM6DS3TR-C_datasheet.pdf",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/lsm6ds3tr-c/definition.json",
} as const;

const VDD: [number, number] = [1.71, 3.6]; // Table 4
const VDDIO: [number, number] = [1.62, 3.6]; // Table 4: 1.62 V to VDD + 0.1 V

function fn(description: string): TraitDef {
  return { type: "pin_functions", params: { description, source: `${SRC.datasheet} (Table 2, Table 10)` } };
}

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function logicPad(n: number, name: string, protocols: InterfaceDef["protocols"], capabilities: string[], traits: TraitDef[]): InterfaceDef {
  return {
    id: `pin_${n}`,
    name,
    pin: n,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols,
    capabilities,
    parameters: [{ id: "voltage", unit: "V", range: VDDIO }],
    traits,
  };
}

const BIDIR = [{ type: "digital", roles: ["input", "output", "bidirectional"] }];
const IN = [{ type: "digital", roles: ["input"] }];

// ---------------------------------------------------------------------------
// Pads — Table 2
// ---------------------------------------------------------------------------

const pins: InterfaceDef[] = [
  logicPad(1, "SDO/SA0", BIDIR, ["digital_io", "spi_miso"], [
    fn("SDO/SA0 — SPI 4-wire interface serial data output (SDO); I2C least significant bit of the device address (SA0)."),
  ]),
  logicPad(2, "SDx", BIDIR, ["digital_io", "i2c_sda"], [
    fn("SDx — Mode 1: connect to VDDIO or GND. Mode 2: I2C serial data master (MSDA)."),
  ]),
  logicPad(3, "SCx", BIDIR, ["digital_io", "i2c_scl"], [
    fn("SCx — Mode 1: connect to VDDIO or GND. Mode 2: I2C serial clock master (MSCL)."),
  ]),
  logicPad(4, "INT1", [{ type: "interrupt", roles: ["output"] }, ...BIDIR], ["digital_io", "interrupt"], [fn("INT1 — programmable interrupt 1.")]),
  withTraits(PowerIn({ id: "pin_5", name: "VDDIO", pin: 5, voltageV: VDDIO, nominalV: 1.8 }), [
    fn("VDDIO — power supply for I/O pins. Recommended 100 nF filter capacitor."),
  ]),
  withTraits(Ground({ id: "pin_6", name: "GND", pin: 6 }), [fn("GND — 0 V supply.")]),
  withTraits(Ground({ id: "pin_7", name: "GND", pin: 7 }), [fn("GND — 0 V supply.")]),
  withTraits(PowerIn({ id: "pin_8", name: "VDD", pin: 8, voltageV: VDD, nominalV: 1.8 }), [
    fn("VDD — power supply. Recommended 100 nF filter capacitor."),
  ]),
  logicPad(9, "INT2", [{ type: "interrupt", roles: ["output"] }, ...BIDIR], ["digital_io", "interrupt"], [
    fn("INT2 — Mode 1: programmable interrupt 2 (INT2) / data enable (DEN). Mode 2: INT2 / DEN / I2C master external synchronization signal (MDRDY)."),
  ]),
  logicPad(10, "NC", [{ type: "custom", roles: ["peer"] }], ["no_connect"], [fn("NC — leave unconnected (leave pin electrically unconnected and soldered to PCB).")]),
  logicPad(11, "NC", [{ type: "custom", roles: ["peer"] }], ["no_connect"], [fn("NC — leave unconnected (leave pin electrically unconnected and soldered to PCB).")]),
  logicPad(12, "CS", IN, ["digital_io", "spi_ss"], [
    fn("CS — I2C/SPI mode selection (1: SPI idle mode / I2C communication enabled; 0: SPI communication mode / I2C disabled)."),
  ]),
  logicPad(13, "SCL", IN, ["digital_io", "spi_sck", "i2c_scl"], [fn("SCL — I2C serial clock (SCL) / SPI serial port clock (SPC).")]),
  logicPad(14, "SDA", BIDIR, ["digital_io", "spi_mosi", "i2c_sda"], [
    fn("SDA — I2C serial data (SDA) / SPI serial data input (SDI) / 3-wire interface serial data output (SDO)."),
  ]),
];

// ---------------------------------------------------------------------------
// Buses
// ---------------------------------------------------------------------------

const i2c = withTraits(
  I2C({ id: "i2c", name: "I2C (target)", roles: ["slave"], clockFreqHz: [0, 400_000], address: 0x6a, sda: "pin_14", scl: "pin_13" })[0],
  [
    {
      type: "usage_note",
      params: {
        note: "SAD 110101xb: 0x6A with SDO/SA0 to GND, 0x6B with SDO/SA0 to the supply. Standard and fast mode (400 kHz). Tie CS high (VDDIO) for I2C. SDA and SCL need external pull-ups to VDDIO.",
        alternate_address: 0x6b,
        source: `${SRC.datasheet} (§6.1, §6.3)`,
      },
    },
  ],
);

const spi4 = withTraits(
  SPI({ id: "spi_4wire", name: "SPI 4-wire (target)", roles: ["slave"], clockFreqHz: [0, 10_000_000], mosi: "pin_14", miso: "pin_1", sck: "pin_13", ss: "pin_12" })[0],
  [
    {
      type: "usage_note",
      params: { note: "SPI clock up to 10 MHz (tc(SPC) >= 100 ns). 3-wire mode (SIM bit) uses SDA/SDI/SDO as the only data line; not modelled as a separate bus.", source: `${SRC.datasheet} (Table 6, §6.1)` },
    },
  ],
);

const hubI2c = withTraits(
  I2C({ id: "sensor_hub_i2c", name: "Mode 2 sensor-hub I2C (controller)", roles: ["master"], clockFreqHz: 116_300, sda: "pin_2", scl: "pin_3" })[0],
  [
    { type: "usage_note", params: { note: "Mode 2 only: MSDA on SDx, MSCL on SCx, MDRDY (external sync) on INT2. In Mode 1, tie SDx/SCx to VDDIO or GND.", source: `${SRC.datasheet} (Table 2, §6.2)` } },
    { type: "usage_note", params: { note: "I2C master supports Fast Mode only; master SCL clock frequency 116.3 kHz (Table 8, §4.4.2.2). Internal pull-ups on SDx/SCx (30-50 kOhm) enabled by PULL_UP_EN in MASTER_CONFIG (1Ah).", source: `${SRC.datasheet} (§4.4.2.2 Table 8, Table 18)` } },
  ],
);

const pcbMount: InterfaceDef = {
  id: "pcb_mount",
  name: "LGA-14L land pattern (SMD)",
  domain: "mechanical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "mechanical_connection", roles: ["mounting_point"] }],
  capabilities: ["surface_mount", "lga14_2p5x3p0_0p5mm"],
  traits: [
    {
      type: "connector",
      params: {
        connector_type: "lga_14l",
        note: "14 pads 0.475 x 0.25 mm (+-0.05), pitch 0.5 mm; body 3.00 x 2.50 mm (+-0.1), 0.83 mm typ / 0.86 mm max. NC pins 10/11 must be soldered.",
        source: `${SRC.datasheet} (cover, Figure 17, Table 2 note 2)`,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const ST_LSM6DS3TR_C_BASE: ModuleDef = defineModule({
  id: "st-lsm6ds3tr-c",
  name: "ST LSM6DS3TR-C",
  version: "1.0.0",
  manufacturer: "STMicroelectronics",
  part_number: "LSM6DS3TR-C",
  description:
    "iNEMO always-on 6-axis IMU (accelerometer ±2/4/8/16 g, gyroscope ±125-2000 dps) in LGA-14L 2.5 x 3 x 0.83 mm. I2C (0x6A/0x6B, 400 kHz) or SPI (3/4-wire, 10 MHz) target, Mode 2 sensor-hub I2C master, 4 kbyte FIFO. VDD 1.71-3.6 V, VDDIO 1.62 V to VDD + 0.1 V.",
  tags: ["lsm6ds3tr-c", "st", "imu", "accelerometer", "gyroscope", "6-axis", "i2c", "spi", "lga-14"],
  categories: ["sensor", "sensor.motion"],
  interfaces: [...pins, i2c, spi4, hubI2c, pcbMount],
  interfaceGroups: [
    { id: "primary_host_interface", label: "Host interface (I2C or SPI, shared pads, CS selects)", members: ["i2c", "spi_4wire"], policy: "one_of" },
    { id: "required_power_pins", label: "Supply pads", members: ["pin_5", "pin_6", "pin_7", "pin_8"], policy: "all_of" },
  ],
  artifacts: [{ id: "datasheet", name: "LSM6DS3TR-C datasheet DocID030071 Rev 3", type: "datasheet", url: SRC.datasheet }],
  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vdd", name: "VDD", nominal_voltage_V: 1.8, voltage_range_V: VDD },
        { id: "vddio", name: "VDDIO (<= VDD + 0.1 V)", nominal_voltage_V: 1.8, voltage_range_V: VDDIO },
      ],
      metadata: {
        logic_levels: { vih_min: "0.7 VDDIO", vil_max: "0.3 VDDIO", voh_min: "VDDIO - 0.2 V @ 4 mA", vol_max: "0.2 V @ 4 mA" },
        pad_drive_max_mA: 4,
        idd_typ_mA: { combo_high_performance_1k6: 0.9, combo_normal_208Hz: 0.45, combo_low_power_52Hz: 0.29, power_down: 0.003 },
        source: `${SRC.datasheet} (Table 4)`,
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 3.0, width: 2.5, height: 0.83 },
      metadata: { package: "LGA-14L", height_max_mm: 0.86, pitch_mm: 0.5, source: `${SRC.datasheet} (cover, Figure 17)` },
    },
    { domain: "thermal", operating_temperature_C: [-40, 85], metadata: { source: `${SRC.datasheet} (Table 4)` } },
  ],
  traits: [
    {
      type: "operating_conditions",
      params: { vdd_V: VDD, vddio_V: "1.62 V to VDD + 0.1 V", temperature_C: [-40, 85], turn_on_time_ms: 35, source: `${SRC.datasheet} (Table 4)` },
    },
    {
      type: "absolute_maximum",
      params: {
        vdd_V: [-0.3, 4.8],
        control_pin_V: "0.3 to Vdd_IO + 0.3 (as printed; lower bound read as -0.3 V, see assumption trait)",
        any_pin_V_max: 4.8,
        storage_temperature_C: [-40, 125],
        acceleration_0p2ms_g: 10000,
        esd_hbm_kV: 2,
        source: `${SRC.datasheet} (Table 9)`,
      },
    },
    {
      type: "performance",
      params: {
        kind: "imu",
        accel_ranges_g: [2, 4, 8, 16],
        gyro_ranges_dps: [125, 250, 500, 1000, 2000],
        fifo_bytes: 4096,
        embedded: "pedometer, step detector/counter, significant motion, tilt, free-fall, wakeup, 6D/4D, tap/double-tap, temperature sensor",
        source: `${SRC.datasheet} (cover, Table 3)`,
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "package height",
        values: ["0.83 mm typ (datasheet cover)", "0.86 mm max (datasheet Figure 17)", "0.86 mm dimension (ProtoPart)"],
        sources: [SRC.datasheet, SRC.protopart],
        resolution: "0.83 mm typ used for dimensions and CAD; 0.86 mm recorded as the maximum.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "VDDIO maximum",
        values: ["3.6 V (ProtoPart range)", "VDD + 0.1 V (datasheet Table 4)"],
        sources: [SRC.protopart, SRC.datasheet],
        resolution: "Range 1.62-3.6 V kept for DRC (3.6 V only reachable at VDD >= 3.5 V); VDD + 0.1 V rule in operating_conditions.",
      },
    },
    {
      type: "assumption",
      params: { field: "absolute_maximum control_pin_V lower bound", value: "-0.3 V", reason: "Table 9 prints the control-pin Vin range as \"0.3 to Vdd_IO +0.3\"; the minus sign appears to be missing (the Vdd row reads -0.3 to 4.8). Treat -0.3 V as the lower bound." },
    },
    {
      type: "assumption",
      params: { field: "CAD pad geometry", value: "top/bottom-row pads 0.1 mm from the edge; pads 0.02 mm thick", reason: "Figure 17 dimensions the 0.1 mm edge distance only for the side pads and gives no pad thickness." },
    },
    {
      type: "data_gap",
      params: {
        fields: ["manufacturer CAD"],
        note: "st.com refused every fetch (HTTP/2 stream error / timeout), so ST's CAD resources could not be reached; Digi-Key and SnapEDA pages return HTTP 403 to fetch; Ultra Librarian requires a login. Geometry generated from datasheet Figure 17 (library/cad/py/catalog/st-lsm6ds3tr-c.py).",
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// Geometry: generated from Figure 17 (not manufacturer CAD). Package centred,
// seating plane z = 0, x along W (3.0 mm), pin 1 at -x/+y.
// ---------------------------------------------------------------------------

export const ST_LSM6DS3TR_C: ModuleDef = withGeometry(
  ST_LSM6DS3TR_C_BASE,
  {
    pcb_mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0] },
      refs: [feature("pcb_mount", { area_mm2: 1.662, centroid: [0.0, 0.0, 0.0], normal: [0.0, 0.0, -1.0] }), own("pcb_mount")],
    },
  },
  cadArtifacts({
    dir: "library/parts/st-lsm6ds3tr-c/artifacts/cad",
    name: "st-lsm6ds3tr-c-lga14l",
    generator: "library/cad/py/catalog/st-lsm6ds3tr-c.py",
    tool: "build123d 0.13.0",
    interfaces: ["pcb_mount"],
  }),
);
