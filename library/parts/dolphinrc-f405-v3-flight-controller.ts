/**
 * DolphinRC F405 V3 flight controller (FC of the "DolphinRC F405 V3 50A 60A
 * STACK", SKU DPDZ00041) — datasheet-honest UHD part.
 *
 * Sources (see ./dolphinrc-f405-v3-flight-controller/sources.json):
 *   - src_manual:    DolphinRC F405 V3 FPV Stack User Manual V1.0 (specs p2,
 *                    size drawing p3 = FC top face + ESC, wiring diagram
 *                    p4 = connector-face pads, camera / VTX switch p5-6) —
 *                    https://dolphinrc.com/u_file/2608/24/file/DolphinRCF40520250616153927-165929bb5a.pdf
 *   - src_product:   DolphinRC F405 V3 50A 60A STACK product page —
 *                    https://dolphinrc.com/products/dolphinrc-f405-v3-50a-60a-stack
 *   - src_review:    DolphinRC blog review of the same stack (manufacturer
 *                    published; used only where the manual/product page are
 *                    silent) — https://dolphinrc.com/blog/dolphinrc-f405-v3-50a-60a-stack-review
 *   - src_bf_target: Betaflight MATEKF405TE target config.h (the target the
 *                    manual names) —
 *                    https://raw.githubusercontent.com/betaflight/config/master/configs/MTKS/MATEKF405TE/config.h
 *
 * Modelling notes:
 *   - Identity is the brief's product, confirmed from manufacturer
 *     documentation (no SpeedyBee fallback); see .research/identity.md.
 *   - Leaves are one per signal net with `pin` = silkscreen label. Where the
 *     same net appears as a pad AND a connector pin (VBAT/M1-M4/CUR on the
 *     ESC socket, TX5 on the VTX and DJI sockets, 10V, 4.5V, 5V, GND), it is
 *     one leaf and the connector traits record every position.
 *   - Power: VBAT input 6-30 V (2-6S) from the ESC connector. BECs: 5 V 3 A
 *     (5V pads/camera/LED), and the high rail stated as 12 V 2.5 A in the
 *     manual, "12V 2.5A (Or 10V 2.5A)" on the product page, and printed "10V"
 *     on the board. It is modelled as a 10-12 V range (source_discrepancy).
 *     The brief's "9V" appears in no source. The 3.3 V 0.5 A BEC has no
 *     exposed pad, so it is only a power domain. The receiver/GPS connectors
 *     and two pads are printed "4.5V" while the wiring diagram labels them
 *     5V; modelled as a 4.5-5 V rail without a current rating (discrepancy +
 *     data gap).
 *   - Motor outputs M1-M8: EscSignal outputs with DShot300/DShot600 and
 *     bidirectional DShot (review; the product page only says "8x Dshot
 *     compatible"). M1-M4 run to the ESC connector; M5-M8 are pads.
 *   - ESC connector: FcEscPort side "fc" with M1-M4, VBAT, GND and CUR. The
 *     4th pin is VOID (no ESC telemetry), so no telemetry slot. Pinout array
 *     is identical to dolphinrc-am32-60a-4in1-esc (pin 1 assumption there
 *     and here).
 *   - UARTs 1-6 (role host) bound to their silkscreen pads/connector pins.
 *     UART5 RX exists only on the DJI connector (R5); UART5 TX is on the TX5
 *     pad and the VTX (T5) and DJI (T5) connectors. The 1x softserial TX
 *     option is a firmware feature and is only a usage_note.
 *   - DJI O4 connector: modelled as UART5 + the 10 V rail + GND + SBUS leaf,
 *     with the DJI connector trait on uart5 carrying the 6-pin order
 *     10V G T5 R5 G Sbus. The connector series/pitch is not stated.
 *   - SBUS: one input leaf for the SBUS pad and the DJI "Sbus" pin; which
 *     UART it feeds is not stated (data gap).
 *   - I2C1 (SDA/SCL pads) is master; the barometer sits on I2C1 per target.
 *   - S1/S2 pads are modelled as PWM outputs (product page: 10x PWM outputs,
 *     8 of them DShot). The "ppm" silkscreen near RX3 is not claimed
 *     (low-resolution photo; the target puts PPM on UART2 RX) — data gap.
 *   - RSSI and airspeed ADC channels are listed by the product page but no
 *     pad carries those labels in the drawings, so they are omitted.
 *   - Camera inputs C1/C2 and the VTX video output use protocol `custom`
 *     (no video vocabulary; gaps.json). Buzzer BZ+/BZ- use `custom` too.
 *     USB-C uses the library's existing `usb` type.
 *   - Verify warning "no thermal domain or operating_conditions trait" is
 *     intentional: no source gives an operating temperature (data_gap).
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../src/types/index.js";
import {
  BoltPattern,
  EscSignal,
  FcEscPort,
  Ground,
  I2C,
  Pin,
  PowerIn,
  PowerOut,
  SBUS,
  UART,
  cellCount,
  connectorTrait,
  defineModule,
} from "../../src/protocols/index.js";

const SRC = {
  manual:
    "https://dolphinrc.com/u_file/2608/24/file/DolphinRCF40520250616153927-165929bb5a.pdf",
  product: "https://dolphinrc.com/products/dolphinrc-f405-v3-50a-60a-stack",
  review: "https://dolphinrc.com/blog/dolphinrc-f405-v3-50a-60a-stack-review",
  bfTarget:
    "https://raw.githubusercontent.com/betaflight/config/master/configs/MTKS/MATEKF405TE/config.h",
} as const;

/** FC <-> ESC connector pinout, identical on both parts of the stack. */
const STACK_PINOUT = ["BAT", "GND", "CUR", "VOID", "M1", "M2", "M3", "M4"];

// ---------------------------------------------------------------------------
// Connector traits (manual p4 wiring diagram, silkscreen order; pin 1 unmarked)
// ---------------------------------------------------------------------------

const ESC_SH_8 = connectorTrait("jst_sh_8", {
  gender: "receptacle",
  positions: 8,
  pinout: STACK_PINOUT,
  note: "ESC socket, SH 1.0 mm 8-pin (included 50 mm SH 1.0 mm 8-pin cable). Wire labels BAT GND CUR VOID M1 M2 M3 M4 (manual p4). The same nets are also solder pads VBAT GND M1 M2 M3 M4 and CUR (manual p3). Pin 1 not marked; order from the BAT end.",
});
const RC_SH_4 = connectorTrait("jst_sh_4", {
  gender: "receptacle",
  positions: 4,
  pinout: ["G", "4.5V", "RX6", "TX6"],
  note: "Receiver socket, silkscreen 'G 4.5V RX6 TX6'; wiring diagram labels TX6 RX6 5V GND (receiver TX -> RX6, RX -> TX6). SH 1.0 mm 4-pin cables are included. Pin 1 not marked.",
});
const GPS_SH_4 = connectorTrait("jst_sh_4", {
  gender: "receptacle",
  positions: 4,
  pinout: ["G", "4.5V", "RX4", "TX4"],
  note: "GPS socket, silkscreen 'G 4.5V RX4 TX4'; wiring diagram labels GND 5V RX4 TX4 (GPS TX -> RX4, GPS RX -> TX4). Pin 1 not marked (dot beside G).",
});
const VTX_SH_4 = connectorTrait("jst_sh_4", {
  gender: "receptacle",
  positions: 4,
  pinout: ["G", "10V", "VTX", "T5"],
  note: "Analog VTX socket, silkscreen 'G 10V VTX T5'; T5 goes to the VTX IRC pin. Pin 1 not marked (dot beside G).",
});
const DJI_6 = connectorTrait("dji_6pin", {
  gender: "receptacle",
  positions: 6,
  pinout: ["10V", "G", "T5", "R5", "G", "Sbus"],
  note: "DJI O4 Air Unit socket, silkscreen '10V G T5 R5 G Sbus'; the included 150 mm DJI 6-pin cable maps to O4 10V GND RX TX GND SBUS. Connector series/pitch not stated. Pin 1 not marked.",
});
const CAM_3 = connectorTrait("jst_sh_3", {
  gender: "receptacle",
  positions: 3,
  pinout: ["C1", "5V", "G"],
  note: "Camera socket, silkscreen 'C1 5V G'; included 150 mm 3-pin analog camera cable. Series not stated beyond the 3-pin cable. Pin 1 not marked.",
});
const PAD = connectorTrait("solder_pad");

function withTraits(iface: InterfaceDef, traits: TraitDef[]): InterfaceDef {
  return { ...iface, traits: [...(iface.traits ?? []), ...traits] };
}

function amend(ifaces: InterfaceDef[], id: string, traits: TraitDef[]): InterfaceDef[] {
  return ifaces.map((i) => (i.id === id ? withTraits(i, traits) : i));
}

function padFunction(description: string, source: string | string[]): TraitDef {
  return { type: "pin_functions", params: { description, source } };
}

const VIN: [number, number] = [6, 30];

// ---------------------------------------------------------------------------
// Power
// ---------------------------------------------------------------------------

const vbatIn = withTraits(
  PowerIn({ id: "vbat_in", name: "VBAT", pin: "VBAT", voltageV: VIN, parameters: [cellCount([2, 6])] }),
  [
    padFunction("VBAT pad / BAT pin of the ESC socket — FC supply input, 6~30V (2~6S LiPo); also the VBAT ADC.", [SRC.manual, SRC.product]),
    PAD,
    ESC_SH_8,
  ],
);

const gnd = withTraits(Ground({ id: "gnd", name: "GND", pin: "GND" }), [
  padFunction("GND / G — ground (several pads and every socket's G pin).", SRC.manual),
  PAD,
  ESC_SH_8,
  RC_SH_4,
  GPS_SH_4,
  VTX_SH_4,
  DJI_6,
  CAM_3,
]);

const bec5v = withTraits(
  PowerOut({ id: "bec_5v", name: "5V BEC", pin: "5V", voltageV: 5, maxCurrentA: 3 }),
  [
    padFunction("5V — 5V 3A BEC output: 5V pads (edge, beside LEDS, beside SDA), camera socket 5V pin, LED strip 5V.", [SRC.manual, SRC.product]),
    PAD,
    CAM_3,
  ],
);

const bec10v = withTraits(
  PowerOut({ id: "bec_10v", name: "10V/12V BEC", pin: "10V", voltageV: [10, 12], nominalV: 10, maxCurrentA: 2.5 }),
  [
    padFunction("10V — high-voltage BEC output (2.5 A) for VTX / DJI air unit: 10V pad, VTX socket 10V, DJI socket 10V.", [SRC.manual, SRC.product]),
    PAD,
    VTX_SH_4,
    DJI_6,
    {
      type: "source_discrepancy",
      params: {
        field: "high BEC voltage",
        values: ["12V 2.5A (manual spec table)", "12V 2.5A (Or 10V 2.5A) (product page)", "10V (silkscreen, LED label, wiring diagram)", "9V (project brief; no source)"],
        sources: [SRC.manual, SRC.product, SRC.review],
        resolution: "Project decision (2026-09-26): nominal 10 V per the board silkscreen and wiring diagram, range 10-12 V kept because the manual/product page state 12 V and the selection mechanism is undocumented. Both ends are within the DJI O4 input (3.7-13.2 V); measure the rail on the physical unit.",
      },
    },
    {
      type: "usage_note",
      params: {
        note: "Manual p5-6: a VTX on/off switch is mapped to the USER2 mode (Betaflight PINIO2); when not triggered the VTX is unpowered. Product page: 'BEC switch to slow down VTX heating'. If unused, set the USER2 channel threshold to the maximum.",
        source: [SRC.manual, SRC.product, SRC.bfTarget],
      },
    },
  ],
);

const rail4v5 = withTraits(
  PowerOut({ id: "rail_4v5", name: "4.5V", pin: "4.5V", voltageV: [4.5, 5] }),
  [
    padFunction("4.5V — supply on the receiver (RC) and GPS sockets and two 4.5V pads.", SRC.manual),
    PAD,
    RC_SH_4,
    GPS_SH_4,
    {
      type: "source_discrepancy",
      params: {
        field: "receiver/GPS supply voltage",
        values: ["4.5V (silkscreen)", "5V (wiring diagram wire labels)"],
        sources: [SRC.manual],
        resolution: "modelled as 4.5-5 V; current limit not stated.",
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// Motor outputs and ESC connector
// ---------------------------------------------------------------------------

const motorOut = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
  withTraits(
    EscSignal({
      id: `m${n}`,
      name: `M${n}`,
      pin: `M${n}`,
      role: "output",
      protocols: ["dshot300", "dshot600"],
      bidirectional: true,
      motorIndex: n,
    }),
    [
      padFunction(
        n <= 4
          ? `M${n} — motor ${n} ESC signal output; pad and ESC socket pin.`
          : `M${n} — motor ${n} ESC signal output pad.`,
        [SRC.manual, SRC.product, SRC.review],
      ),
      ...(n <= 4 ? [PAD, ESC_SH_8] : [PAD]),
    ],
  ),
);

const cur: InterfaceDef = {
  id: "cur",
  name: "CUR",
  pin: "CUR",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "analog", roles: ["input"] }],
  capabilities: ["analog_in"],
  traits: [
    padFunction("CUR — current-sensor ADC input (pad and ESC socket pin). Betaflight default current meter scale 150.", [SRC.manual, SRC.product, SRC.bfTarget]),
    PAD,
    ESC_SH_8,
  ],
};

const escPort = withTraits(
  FcEscPort({
    id: "esc_port",
    name: "ESC connector (8-pin SH)",
    side: "fc",
    connector: "jst_sh_8",
    pinout: STACK_PINOUT,
    motors: motorOut.slice(0, 4),
    vbat: "vbat_in",
    gnd: "gnd",
    current: "cur",
  }),
  [
    {
      type: "usage_note",
      params: {
        note: "Connect to the DolphinRC AM32 ESC with the included 50 mm SH 1.0 mm 8-pin cable. VOID pin is unused (no ESC telemetry line).",
        source: [SRC.manual, SRC.product, SRC.review],
      },
    },
    {
      type: "assumption",
      params: {
        field: "connector pin 1",
        value: "BAT end",
        reason: "Pin 1 is not marked in any source; order taken from the BAT end so the FC and ESC parts share one pinout array (the included cable is 1:1).",
      },
    },
  ],
);

// ---------------------------------------------------------------------------
// UARTs
// ---------------------------------------------------------------------------

const uartNote = (n: number, text: string, extra: TraitDef[] = []): TraitDef[] => [
  { type: "usage_note", params: { note: `UART${n}: ${text}`, source: [SRC.manual, SRC.product, SRC.bfTarget] } },
  ...extra,
];

function uartPort(
  n: number,
  rx: string,
  tx: string,
  rxTraits: TraitDef[],
  txTraits: TraitDef[],
  portTraits: TraitDef[],
): InterfaceDef[] {
  let ifaces = UART({
    id: `uart${n}`,
    instance: n,
    name: `UART${n}`,
    roles: ["host"],
    rx: { pin: rx, name: rx },
    tx: { pin: tx, name: tx },
  });
  ifaces = amend(ifaces, `uart${n}_rx`, rxTraits);
  ifaces = amend(ifaces, `uart${n}_tx`, txTraits);
  return amend(ifaces, `uart${n}`, portTraits);
}

const uart1 = uartPort(
  1, "RX1", "TX1",
  [padFunction("RX1 — UART1 receive pad.", SRC.manual), PAD],
  [padFunction("TX1 — UART1 transmit pad.", SRC.manual), PAD],
  uartNote(1, "RX1/TX1 pads."),
);
const uart2 = uartPort(
  2, "RX2", "TX2",
  [padFunction("RX2 — UART2 receive pad.", SRC.manual), PAD],
  [padFunction("TX2 — UART2 transmit pad.", SRC.manual), PAD],
  uartNote(2, "RX2/TX2 pads. The MATEKF405TE target defaults serial RX to UART2 and maps PPM to the UART2 RX pin."),
);
const uart3 = uartPort(
  3, "RX3", "TX3",
  [padFunction("RX3 — UART3 receive pad ('ppm' is also printed near this pad; not claimed).", SRC.manual), PAD],
  [padFunction("TX3 — UART3 transmit pad.", SRC.manual), PAD],
  uartNote(3, "RX3/TX3 pads."),
);
const uart4 = uartPort(
  4, "RX4", "TX4",
  [padFunction("RX4 — UART4 receive; pad and GPS socket.", SRC.manual), PAD, GPS_SH_4],
  [padFunction("TX4 — UART4 transmit; pad and GPS socket.", SRC.manual), PAD, GPS_SH_4],
  uartNote(4, "GPS socket 'G 4.5V RX4 TX4' and RX4/TX4 pads; manual wiring diagram shows a GPS here.", [GPS_SH_4]),
);
const uart5 = uartPort(
  5, "R5", "TX5",
  [padFunction("R5 — UART5 receive, on the DJI socket only.", SRC.manual), DJI_6],
  [padFunction("TX5 / T5 — UART5 transmit: TX5 pad, VTX socket T5 (to VTX IRC), DJI socket T5.", SRC.manual), PAD, VTX_SH_4, DJI_6],
  uartNote(5, "DJI O4 Air Unit link (DJI socket T5/R5) and analog VTX control (VTX socket T5 -> VTX IRC).", [DJI_6]),
);
const uart6 = uartPort(
  6, "RX6", "TX6",
  [padFunction("RX6 — UART6 receive on the receiver socket (wire to receiver TX).", SRC.manual), RC_SH_4],
  [padFunction("TX6 — UART6 transmit on the receiver socket (wire to receiver RX).", SRC.manual), RC_SH_4],
  uartNote(6, "Receiver socket 'G 4.5V RX6 TX6'; manual wiring diagram shows the RC receiver here.", [RC_SH_4]),
);

const sbus = withTraits(SBUS({ interfaceId: "sbus", role: "input", pin: "SBUS", name: "SBUS" }), [
  padFunction("SBUS — SBUS input pad; also the 'Sbus' pin of the DJI socket (O4 SBUS output).", SRC.manual),
  PAD,
  DJI_6,
]);

// ---------------------------------------------------------------------------
// I2C, PWM, LED, buzzer, video, USB
// ---------------------------------------------------------------------------

const i2c1 = amend(
  amend(
    amend(
      I2C({ id: "i2c1", instance: 1, name: "I2C1", roles: ["master"], sda: { pin: "SDA", name: "SDA" }, scl: { pin: "SCL", name: "SCL" } }),
      "i2c1_sda",
      [padFunction("SDA — I2C data pad.", SRC.manual), PAD],
    ),
    "i2c1_scl",
    [padFunction("SCL — I2C clock pad.", SRC.manual), PAD],
  ),
  "i2c1",
  [{ type: "usage_note", params: { note: "I2C1 (target I2C1: SCL PB8, SDA PB7); on-board barometer and external magnetometer use I2C1. Default 400 kHz is the builder default, not a source value.", source: [SRC.manual, SRC.bfTarget] } }],
);

const servo = [1, 2].map((n) =>
  withTraits(
    Pin({ id: `s${n}`, name: `S${n}`, pin: `S${n}`, capabilities: { digital: false, pwm: true } }),
    [padFunction(`S${n} — PWM output pad (product page: 10x PWM outputs, 8x DShot).`, [SRC.manual, SRC.product, SRC.bfTarget]), PAD],
  ),
);

const leds: InterfaceDef = {
  id: "leds",
  name: "LEDS",
  pin: "LEDS",
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "digital", roles: ["output"] }],
  capabilities: ["led_strip"],
  traits: [padFunction("LEDS — WS2812 LED strip data output (wired to LED strip 'LED').", [SRC.manual, SRC.product, SRC.bfTarget]), PAD],
};

const buzzer = (sign: "+" | "-"): InterfaceDef => ({
  id: sign === "+" ? "bz_pos" : "bz_neg",
  name: `BZ${sign}`,
  pin: `BZ${sign}`,
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "custom", roles: ["output"] }],
  capabilities: ["buzzer"],
  traits: [
    padFunction(`BZ${sign} — buzzer ${sign === "+" ? "positive" : "negative"}; wire to buzzer BZ${sign}.`, SRC.manual),
    PAD,
    { type: "usage_note", params: { note: "Buzzer pair; protocol 'custom' (no buzzer vocabulary). Betaflight target sets BEEPER_INVERTED.", source: [SRC.manual, SRC.bfTarget] } },
  ],
});

const video = (id: string, label: string, role: "input" | "output", text: string, traits: TraitDef[]): InterfaceDef => ({
  id,
  name: label,
  pin: label,
  domain: "electrical",
  exposed: true,
  default_active: true,
  protocols: [{ type: "custom", roles: [role] }],
  capabilities: ["analog_video"],
  traits: [
    padFunction(text, SRC.manual),
    ...traits,
    { type: "usage_note", params: { note: "Analog composite video; protocol 'custom' (no video vocabulary, see gaps.json). OSD: AT7456E.", source: [SRC.manual, SRC.product] } },
  ],
});

const cam1 = video("cam_1", "C1", "input", "C1 — camera 1 video input (pad and camera socket 'C1 5V G').", [PAD, CAM_3]);
const cam2 = video("cam_2", "C2", "input", "C2 — camera 2 video input pad (switchable dual camera; USER1 mode selects camera 2).", [PAD]);
const vtxOut = video("vtx_video", "VTX", "output", "VTX — video output to the analog VTX (pad and VTX socket).", [PAD, VTX_SH_4]);

const usb: InterfaceDef = {
  id: "usb",
  name: "USB Type-C",
  domain: "electrical",
  exposed: true,
  default_active: false,
  protocols: [{ type: "usb", roles: ["device"] }],
  traits: [
    connectorTrait("usb_c", { gender: "receptacle", note: "USB Interface: Type-C (manual). Configuration and DFU flashing; boot button beside it (review)." }),
    padFunction("USB Type-C port for configuration and firmware flashing.", [SRC.manual, SRC.review]),
  ],
};

const mount = withTraits(
  BoltPattern({
    id: "stack_mount",
    name: "30.5 x 30.5 mm stack mount",
    role: "component",
    shape: "square",
    spacingMm: 30.5,
    holeCount: 4,
    fastener: "M3",
    fastenerDiameterMm: 3,
    threaded: false,
    note: "Hole: 30.5*30.5mm / Φ4mm (manual). M3*8mm rubber grommets for the FC are included (product page).",
  }),
  [padFunction("Four Φ4 mm corner mounting holes, 30.5 x 30.5 mm pattern.", [SRC.manual, SRC.product])],
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export const DOLPHINRC_F405_V3_FLIGHT_CONTROLLER: ModuleDef = defineModule({
  id: "dolphinrc-f405-v3-flight-controller",
  name: "DolphinRC F405 V3 Flight Controller",
  version: "1.0.0",
  manufacturer: "DolphinRC (Shenzhen DolphinRC Model Technology Co., Ltd.)",
  part_number: "DolphinRC F405 V3 (F405 V3 stack, SKU DPDZ00041 option 'F405-FC')",
  description:
    "STM32F405 flight controller, ICM-42688-P gyro, SPL06-001 baro, AT7456E OSD, 16M blackbox flash, 6 UARTs, 8 DShot motor outputs, 5 V 3 A and 10/12 V 2.5 A BECs, DJI O4 socket, 2-6S input, 30.5 x 30.5 mm. Betaflight target MATEKF405TE.",
  tags: ["flight-controller", "f405", "stm32f405", "betaflight", "30.5x30.5", "6s", "fpv", "drone", "dji-o4"],
  categories: ["flight_controller", "drone"],
  interfaces: [
    vbatIn,
    gnd,
    bec5v,
    bec10v,
    rail4v5,
    ...motorOut,
    cur,
    escPort,
    ...uart1,
    ...uart2,
    ...uart3,
    ...uart4,
    ...uart5,
    ...uart6,
    sbus,
    ...i2c1,
    ...servo,
    leds,
    buzzer("+"),
    buzzer("-"),
    cam1,
    cam2,
    vtxOut,
    usb,
    mount,
  ],
  artifacts: [
    { id: "manual", name: "DolphinRC F405 V3 FPV Stack User Manual V1.0", type: "datasheet", url: SRC.manual },
    { id: "product", name: "DolphinRC F405 V3 50A 60A STACK product page", type: "documentation", url: SRC.product },
    { id: "review", name: "DolphinRC F405 V3 stack review (DolphinRC blog)", type: "documentation", url: SRC.review },
    { id: "bf_target", name: "Betaflight MATEKF405TE target config.h", type: "firmware", url: SRC.bfTarget },
  ],
  domains: [
    {
      domain: "electrical",
      power_domains: [
        { id: "vbat", name: "VBAT", voltage_range_V: VIN, regulation_type: "unregulated" },
        { id: "bec_5v", name: "5V BEC", nominal_voltage_V: 5, max_current_mA: 3000, regulation_type: "regulated" },
        { id: "bec_10v", name: "10V/12V BEC", voltage_range_V: [10, 12], max_current_mA: 2500, regulation_type: "regulated" },
        { id: "bec_3v3", name: "3.3V BEC (no exposed pad)", nominal_voltage_V: 3.3, max_current_mA: 500, regulation_type: "regulated" },
      ],
    },
    {
      domain: "mechanical",
      dimensions_mm: { length: 36, width: 36, height: 8 },
      weight_g: 7.7,
      metadata: { mounting: "30.5 x 30.5 mm, Φ4 mm holes", weight_note: "7.7±0.1 g excluding accessories (manual); product page says 8 g" },
    },
    {
      domain: "software",
      metadata: { firmware: ["Betaflight (default)", "INAV", "ArduPilot"], betaflight_target: "MATEKF405TE" },
    },
  ],
  traits: [
    {
      type: "performance",
      params: {
        kind: "flight_controller",
        mcu: "STM32F405RGT6, Cortex-M4 @ 168MHz",
        imu: "ICM-42688-P",
        barometer: "SPL06-001",
        osd: "AT7456E",
        blackbox: "16M flash",
        uarts: 6,
        esc_outputs: 8,
        pwm_outputs: 10,
        adc: ["VBAT", "Current", "RSSI", "Airspeed"],
        tvs: "SMBJ24A 26V",
        firmware_target: "Betaflight MATEKF405TE",
        source: [SRC.manual, SRC.product],
      },
    },
    {
      type: "usage_note",
      params: {
        note: "Flash Betaflight target MATEKF405TE. With bidirectional DShot (RPM filtering) on this F405, use DShot300 and at most 4K/4K loop time; DShot600 without bidirectional DShot.",
        source: [SRC.manual, SRC.review],
      },
    },
    {
      type: "usage_note",
      params: {
        note: "Camera switch: USER1 mode (PINIO1) — untriggered shows camera 1, triggered shows camera 2. VTX power: USER2 mode (PINIO2).",
        source: [SRC.manual, SRC.bfTarget],
      },
    },
    {
      type: "usage_note",
      params: { note: "6x UARTs plus 1x Softserial_Tx option (INAV/BF).", source: SRC.product },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "board size",
        values: ["36*36*8 mm (spec table)", "35.5 x 35.5 mm (size drawing)"],
        sources: [SRC.manual],
        resolution: "36 x 36 x 8 mm.",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "weight",
        values: ["7.7±0.1 g", "8 g"],
        sources: [SRC.manual, SRC.product],
        resolution: "7.7 g (manual).",
      },
    },
    {
      type: "source_discrepancy",
      params: {
        field: "barometer driver",
        values: ["SPL06-001 (hardware)", "USE_BARO_DPS310 (MATEKF405TE target)"],
        sources: [SRC.manual, SRC.bfTarget],
        resolution: "Hardware per manual; whether the target build detects the SPL06-001 is not stated.",
      },
    },
    {
      type: "data_gap",
      params: {
        fields: [
          "operating temperature",
          "UART logic level",
          "4.5V rail current limit",
          "SBUS pad UART mapping / inversion",
          "'ppm' label near RX3",
          "RSSI / airspeed pad location",
          "connector pin-1 orientation",
          "DJI socket series and pitch",
        ],
        note: "Not stated by any source.",
      },
    },
  ],
});
