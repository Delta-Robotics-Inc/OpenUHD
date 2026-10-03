/**
 * Bosch Sensortec BMI270 6-axis IMU (bare LGA-14) — datasheet-honest UHD part.
 *
 * Sources (see ./bosch-bmi270/sources.json):
 *   - src_datasheet: BMI270 datasheet BST-BMI270-DS000-08 rev 1.6 —
 *     https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf
 *     (Table 1 electrical, Table 5 absolute maximum, Table 19 SPI timing,
 *     §6.5 I2C, §6.6.1 AUX I2C, §7.1 pin-out + Table 22 pin connections, §8.1 package outline)
 *   - src_product: Bosch Sensortec BMI270 product page —
 *     https://www.bosch-sensortec.com/en/products/motion-sensors/imus/bmi270/
 *   - src_protopart: ProtoPart bosch-bmi270 definition (community starting
 *     point; every value re-verified against the datasheet).
 *
 * Modelling notes:
 *   - Pin-honest: all 14 LGA pads are leaves `pin_1`..`pin_14`, named with the
 *     Table 22 pin names, each carrying a verbatim `pin_functions` trait.
 *   - Primary host bus: I2C slave (SDx pin 14 / SCx pin 13, address 0x68 with
 *     SDO to GND, 0x69 with SDO to VDDIO, up to 1 MHz fast-mode plus) or SPI
 *     4-wire slave (SDx=SDI, SDO=SDO, SCx=SCK, CSB, up to 10 MHz). They share
 *     pads, so the `primary_host_interface` group is one_of. SPI 3-wire (SDx as
 *     SDIO, Table 22) is not a separate composed interface: the SPI builder's
 *     MISO slot is required and 3-wire has no MISO pad. It is a usage_note.
 *   - Secondary interface: AUX I2C master (ASDx/ASCx, fast-mode plus up to
 *     1 MHz, §6.6.1) for an external sensor, or OIS SPI slave (ASDx=SDI,
 *     ASCx=SCK, OCSB, OSDO, up to 10 MHz per key features); one_of group.
 *     OIS 3-wire is a usage_note, like primary SPI 3-wire.
 *   - INT1/INT2 are interrupt outputs that can also be inputs for FIFO
 *     external sync (Table 22 note *), so they carry interrupt output plus
 *     digital input/output.
 *   - Package facts (LGA-14, 14 pads, 0.5 mm pitch, no exposed pad, body
 *     3.0 x 2.5 x 0.83 mm) are the mechanical domain's `package`; every pad
 *     leaf carries its Table 22 designator.
 *   - `pcb_mount` is the SMD pad set (mechanical_connection), bound to
 *     the 14 pad faces of the generated package; there is no bolt pattern on
 *     a bare IC, so the frame is the seating plane (normal -Z).
 *   - Geometry is generated from the §8.1 drawing (no manufacturer CAD found:
 *     data_gap trait). Pad thickness is an assumption trait.
 *   - ProtoPart gives max_current_mA = 1 per supply; the datasheet states only
 *     typical IDD (685 uA normal, 970 uA performance), so no max_current
 *     parameter is set (source_discrepancy trait).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import { Ground, I2C, PowerIn, SPI, defineModule } from "../../src/protocols/index.js";
import { cadArtifacts, feature, own, withGeometry } from "../cad/artifacts.js";

const SRC = {
  datasheet: "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf",
  product: "https://www.bosch-sensortec.com/en/products/motion-sensors/imus/bmi270/",
  protopart: "https://github.com/Delta-Robotics-Inc/ProtoPart/blob/main/protoparts/bosch-bmi270/definition.json",
} as const;

const VDD: [number, number] = [1.71, 3.6]; // Table 1
const VDDIO: [number, number] = [1.2, 3.6]; // Table 1

function fn(description: string, connect?: string): TraitDef {
  return {
    type: "pin_functions",
    params: { description, ...(connect ? { connect_to: connect } : {}), source: `${SRC.datasheet} (Table 22)` },
  };
}

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

/** A logic pad on the VDDIO domain with explicit protocols and capability tags. */
function logicPad(
  n: number,
  name: string,
  protocols: InterfaceDef["protocols"],
  capabilities: string[],
  traits: TraitDef[],
): InterfaceDef {
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
const OUT = [{ type: "digital", roles: ["output"] }];

// ---------------------------------------------------------------------------
// Pads — Table 22, package order
// ---------------------------------------------------------------------------

const pins: InterfaceDef[] = [
  logicPad(1, "SDO", BIDIR, ["digital_io", "spi_miso"], [
    fn("SDO — primary interface: serial data output in SPI 4W; I2C address bit-0 select in I2C mode.", "SPI4W: SDO; SPI3W: DNC; I2C: GND for default I2C address"),
    {
      type: "strap",
      params: {
        function: "I2C address bit 0",
        when: ["i2c"],
        levels: { low: "address 0x68 (SDO to GND)", high: "address 0x69 (SDO to VDDIO)" },
        source: `${SRC.datasheet} (§6.5, Table 22)`,
      },
    },
  ]),
  logicPad(2, "ASDx", BIDIR, ["digital_io", "i2c_sda", "spi_mosi"], [
    fn("ASDx — secondary interface: Aux interface / OIS interface data (Aux SDA or OIS SDI).", "VDDIO or DNC or Aux SDA or OIS SDI; do not connect to GND if unused"),
  ]),
  logicPad(3, "ASCx", BIDIR, ["digital_io", "i2c_scl", "spi_sck"], [
    fn("ASCx — secondary interface: Aux interface / OIS interface clock (Aux SCL or OIS SCK).", "VDDIO or DNC or Aux SCL or OIS SCK; do not connect to GND if unused"),
  ]),
  logicPad(4, "INT1", [{ type: "interrupt", roles: ["output"] }, ...BIDIR], ["digital_io", "interrupt"], [
    fn("INT1 — interrupt pin 1. If unused, do not connect. Can be configured as input for FIFO external data synchronization."),
  ]),
  withTraits(PowerIn({ id: "pin_5", name: "VDDIO", pin: 5, voltageV: VDDIO, nominalV: 1.8 }), [
    fn("VDDIO — digital I/O supply voltage (1.2 … 3.6V)."),
  ]),
  withTraits(Ground({ id: "pin_6", name: "GNDIO", pin: 6 }), [fn("GNDIO — ground for I/O.")]),
  withTraits(Ground({ id: "pin_7", name: "GND", pin: 7 }), [fn("GND — ground for digital & analog.")]),
  withTraits(PowerIn({ id: "pin_8", name: "VDD", pin: 8, voltageV: VDD, nominalV: 1.8 }), [
    fn("VDD — power supply analog & digital domain (1.71V – 3.6V)."),
  ]),
  logicPad(9, "INT2", [{ type: "interrupt", roles: ["output"] }, ...BIDIR], ["digital_io", "interrupt"], [
    fn("INT2 — interrupt pin 2. If unused, do not connect. Can be configured as input for FIFO external data synchronization."),
  ]),
  logicPad(10, "OCSB", IN, ["digital_io", "spi_ss"], [
    fn("OCSB — secondary OIS interface chip select (digital in).", "DNC or OIS CSB; tie to GND only if IF_CONF.ois_en = 0"),
  ]),
  logicPad(11, "OSDO", OUT, ["digital_io", "spi_miso"], [
    fn("OSDO — secondary OIS interface serial data out (digital out).", "DNC or OIS SDO; tie to GND only if IF_CONF.ois_en = 0"),
  ]),
  logicPad(12, "CSB", IN, ["digital_io", "spi_ss"], [
    fn("CSB — primary interface chip select for SPI mode.", "SPI: CSB; I2C: VDDIO (DNC possible with internal pull-up, not recommended)"),
  ]),
  logicPad(13, "SCx", IN, ["digital_io", "spi_sck", "i2c_scl"], [
    fn("SCx — primary interface: SCK for SPI serial clock, SCL for I2C serial clock."),
  ]),
  logicPad(14, "SDx", BIDIR, ["digital_io", "spi_mosi", "i2c_sda"], [
    fn("SDx — primary interface: SDA serial data I/O in I2C; SDI serial data input in SPI 4W; SDA (SDIO) serial data I/O in SPI 3W."),
  ]),
];

// ---------------------------------------------------------------------------
// Composed buses
// ---------------------------------------------------------------------------

const i2c = withTraits(
  I2C({ id: "i2c", name: "Primary I2C (target)", roles: ["slave"], clockFreqHz: [0, 1_000_000], address: 0x68, sda: "pin_14", scl: "pin_13" })[0],
  [
    {
      type: "usage_note",
      params: {
        note: "7-bit address 0x68 with SDO (pin 1) to GND, 0x69 with SDO to VDDIO. Standard (100 kHz), fast (400 kHz) and fast-mode plus (1000 kHz); 7-bit addressing only. Tie CSB (pin 12) to VDDIO for I2C.",
        alternate_address: 0x69,
        source: `${SRC.datasheet} (§6.5, Table 22)`,
      },
    },
  ],
);

const spi4 = withTraits(
  SPI({ id: "spi_4wire", name: "Primary SPI 4-wire (target)", roles: ["slave"], clockFreqHz: [0, 10_000_000], mosi: "pin_14", miso: "pin_1", sck: "pin_13", ss: "pin_12" })[0],
  [
    {
      type: "usage_note",
      params: {
        note: "fSPI max 10 MHz at VDDIO >= 1.62 V (30 pF load), 7 MHz at VDDIO < 1.62 V. SPI 3-wire is also supported with SDx as SDIO and SDO DNC (not modelled as a separate bus).",
        source: `${SRC.datasheet} (Table 19, Table 22)`,
      },
    },
  ],
);

const auxI2c = withTraits(
  I2C({ id: "aux_i2c", name: "Secondary AUX I2C (controller)", roles: ["master"], clockFreqHz: [0, 1_000_000], sda: "pin_2", scl: "pin_3" })[0],
  [
    {
      type: "usage_note",
      params: {
        note: "Aux interface to connect an I2C slave sensor device (e.g. magnetometer): ASCx push-pull, ASDx open-drain; internal pull-up configured in AUX_IF_TRIM.asda_pupsel, no external pull-ups needed. Secondary I2C timings follow I2C fast-mode plus (up to 1 MHz); fast-mode (400 kHz) operation requires contacting Bosch Sensortec. No other I2C masters/slaves may share this bus.",
        source: `${SRC.datasheet} (§6.6.1, Table 21, Table 22 note **)`,
      },
    },
  ],
);

const oisSpi = withTraits(
  SPI({ id: "ois_spi", name: "Secondary OIS SPI (target)", roles: ["slave"], clockFreqHz: [0, 10_000_000], mosi: "pin_2", miso: "pin_11", sck: "pin_3", ss: "pin_10" })[0],
  [{ type: "usage_note", params: { note: "OIS interface on ASDx (SDI), ASCx (SCK), OCSB, OSDO; enabled with IF_CONF.ois_en; 10 MHz slave SPI. OIS 3-wire (ASDx as SDA/SDIO, OSDO DNC, IF_CONF.spi3_ois) is also supported, not modelled as a separate bus.", source: `${SRC.datasheet} (Key features, §6.6 Table 21, Table 22)` } }],
);

const pcbMount: InterfaceDef = {
  id: "pcb_mount",
  name: "LGA-14 pads (SMD)",
  domain: "mechanical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "mechanical_connection", roles: ["mounting_point"] }],
  capabilities: ["surface_mount", "lga14_2p5x3p0_0p5mm"],
  traits: [
    {
      type: "connector",
      params: {
        connector_type: "lga_14",
        note: "14 metallized Cu pads on the underside, pitch 0.5 mm; side pads 0.475 x 0.25 mm, top/bottom pads 0.25 x 0.475 mm; package 3.00 x 2.50 x 0.83 mm.",
        source: `${SRC.datasheet} (§8.1)`,
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const BOSCH_BMI270_BASE: ModuleDef = defineModule({
  id: "bosch-bmi270",
  name: "Bosch BMI270",
  version: "1.2.0",
  manufacturer: "Bosch Sensortec",
  part_number: "BMI270",
  description:
    "6-axis IMU (16-bit accelerometer ±2/4/8/16 g, 16-bit gyroscope ±125-2000 dps) in a 14-pad LGA, 3.0 x 2.5 x 0.83 mm. Primary I2C (0x68/0x69, up to 1 MHz) or SPI (up to 10 MHz) target interface; secondary AUX I2C / OIS SPI. VDD 1.71-3.6 V, VDDIO 1.2-3.6 V.",
  tags: ["bmi270", "bosch", "imu", "accelerometer", "gyroscope", "6-axis", "i2c", "spi", "lga-14"],
  categories: ["sensor", "sensor.motion"],
  interfaces: [...pins, i2c, spi4, auxI2c, oisSpi, pcbMount],
  interfaceGroups: [
    { id: "primary_host_interface", label: "Primary host interface (I2C or SPI, shared pads)", members: ["i2c", "spi_4wire"], policy: "one_of" },
    { id: "secondary_interface", label: "Secondary interface (AUX I2C or OIS SPI, shared pads)", members: ["aux_i2c", "ois_spi"], policy: "one_of" },
    { id: "required_power_pins", label: "Supply pads", members: ["pin_5", "pin_6", "pin_7", "pin_8"], policy: "all_of" },
  ],
  artifacts: [
    { id: "datasheet", name: "BMI270 datasheet BST-BMI270-DS000-08 rev 1.6", type: "datasheet", url: SRC.datasheet },
    { id: "product", name: "BMI270 product page", type: "documentation", url: SRC.product },
  ],
  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vdd", name: "VDD (analog & digital)", nominal_voltage_V: 1.8, voltage_range_V: VDD },
        { id: "vddio", name: "VDDIO (digital I/O)", nominal_voltage_V: 1.8, voltage_range_V: VDDIO },
      ],
      metadata: {
        logic_levels: { vil_max: "0.3 VDDIO", vih_min: "0.7 VDDIO", vol_max: "0.2 VDDIO", voh_min: "0.8 VDDIO" },
        idd_typ_uA: { ag_performance: 970, ag_normal: 685, ag_low_power_25Hz: 420, a_normal: 210, a_low_power_25Hz: 10, suspend: 3.5 },
        source: `${SRC.datasheet} (Table 1)`,
      },
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 3.0, width: 2.5, height: 0.83 },
      package: {
        name: "LGA-14",
        pin_count: 14,
        pitch_mm: 0.5,
        exposed_pad: false,
        source: `${SRC.datasheet} (Basic description: "LGA mold package, 14 pins, footprint 2.5x3.0mm², height 0.83mm"; §8.1 package outline)`,
      },
    },
    { domain: "thermal", operating_temperature_C: [-40, 85], metadata: { source: `${SRC.datasheet} (Table 1)` } },
  ],
  traits: [
    {
      type: "operating_conditions",
      params: { vdd_V: VDD, vddio_V: VDDIO, temperature_C: [-40, 85], power_on_time_ms: 2, source: `${SRC.datasheet} (Table 1)` },
    },
    {
      type: "absolute_maximum",
      params: {
        vdd_V: [-0.3, 4],
        vddio_V: [-0.3, 4],
        logic_pin_V: "-0.3 to VDDIO+0.3, < 4",
        storage_temperature_C: [-50, 150],
        esd: "HBM 2 kV, CDM 500 V, MM 200 V",
        mechanical_shock: "20,000 g (<= 200 us), 2,000 g (<= 1.0 ms)",
        source: `${SRC.datasheet} (Table 5)`,
      },
    },
    {
      type: "performance",
      params: {
        kind: "imu",
        accel_ranges_g: [2, 4, 8, 16],
        gyro_ranges_dps: [125, 250, 500, 1000, 2000],
        resolution_bits: 16,
        gyro_odr_Hz: [25, 6400],
        accel_odr_Hz: [0.78, 1600],
        fifo_bytes: 2048,
        source: `${SRC.datasheet} (Basic description, key features)`,
      },
    },
    {
      type: "usage_note",
      params: {
        note: "Unused INT1/INT2: do not connect. Unused ASDx/ASCx: VDDIO or DNC, never GND. OCSB/OSDO: DNC, or GND only if IF_CONF.ois_en = 0. The device needs an 8 kB configuration file written to INIT_DATA after power-up before advanced features work.",
        source: `${SRC.datasheet} (Table 22 notes, §4 initialization)`,
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "supply max current",
        values: ["1 mA per supply (ProtoPart power_domains)", "IDD typ 685 uA normal / 970 uA performance, no maximum (datasheet Table 1)"],
        sources: [SRC.protopart, SRC.datasheet],
        resolution: "No max_current set; datasheet typical IDD recorded in electrical metadata.",
      },
    },
    {
      type: "assumption",
      params: { field: "CAD pad thickness", value: "0.02 mm", reason: "§8.1 does not dimension pad thickness; pads are drawn flush with the seating plane." },
    },
    {
      type: "data_gap",
      params: {
        fields: ["manufacturer CAD"],
        note: "No manufacturer CAD: the Bosch product page lists no 3D model; Digi-Key and SnapEDA pages returned HTTP 403 to fetch; Ultra Librarian requires a login. Geometry generated from datasheet §8.1 (library/cad/py/catalog/bosch-bmi270.py).",
      },
    },
  ],
});

// ---------------------------------------------------------------------------
// Geometry: generated from the §8.1 package drawing (not manufacturer CAD).
// Coordinates: package centred, seating plane z = 0, x along D (3.0 mm), pin 1
// at -x/+y. The land pattern frame is the seating plane, normal -Z.
// ---------------------------------------------------------------------------

export const BOSCH_BMI270: ModuleDef = withGeometry(
  BOSCH_BMI270_BASE,
  {
    pcb_mount: {
      frame: { origin: [0, 0, 0], normal: [0, 0, -1], xAxis: [1, 0, 0] },
      refs: [feature("pcb_mount", { area_mm2: 1.662, centroid: [0.0, 0.0, 0.0], normal: [0.0, 0.0, -1.0] }), own("pcb_mount")],
    },
  },
  cadArtifacts({
    dir: "library/parts/bosch-bmi270/artifacts/cad",
    name: "bosch-bmi270-lga14",
    generator: "library/cad/py/catalog/bosch-bmi270.py",
    tool: "build123d 0.13.0",
    interfaces: ["pcb_mount"],
  }),
);
