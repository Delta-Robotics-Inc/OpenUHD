/**
 * 5-inch 6S quadcopter — the ProtoBoard Stack reference system (PB-782).
 *
 * Children are library parts (library/parts) plus the custom frame and two
 * sub-assemblies (./assemblies.ts). Links are stored InterfaceLinks; run
 * `validateLinks(QUADCOPTER_5IN, lookupQuadcopterModule)` for per-link DRC.
 *
 * Motor order follows Betaflight Quad-X: M1 rear-right, M2 front-right,
 * M3 rear-left, M4 front-left.
 */
import type { InterfaceLink, ModuleDef } from "../../../src/types/index.js";
import type { ModuleLookup } from "../../../src/system/index.js";
import * as parts from "../../parts/index.js";
import { DOLPHINRC_F405_V3_STACK, QUADCOPTER_5IN_ARM } from "./assemblies.js";
import { QUADCOPTER_5IN_FRAME } from "./frame.js";
import { HARNESSES } from "./harnesses.js";

const ARMS = [
  { id: "arm_fr", label: "Front-right arm", motor: 2 },
  { id: "arm_rr", label: "Rear-right arm", motor: 1 },
  { id: "arm_rl", label: "Rear-left arm", motor: 3 },
  { id: "arm_fl", label: "Front-left arm", motor: 4 },
] as const;

const corner = (armId: string) => armId.slice(4);

const link = (
  id: string,
  name: string,
  a: [string, string],
  b: [string, string],
  extra: Partial<InterfaceLink> = {},
): InterfaceLink => ({
  id,
  name,
  a: { child: a[0], interfaceId: a[1] },
  b: { child: b[0], interfaceId: b[1] },
  ...extra,
});

export const QUADCOPTER_5IN: ModuleDef = {
  id: "quadcopter-5in",
  name: "5-inch 6S quadcopter",
  kind: "module",
  version: "0.1.0",
  description:
    "Reference 5-inch 6S freestyle quadcopter: DolphinRC F405 V3 + AM32 60A stack, four MEPS NEON 2207 V2 1950KV motors with HQProp Ethix S5 props, CNHL 1100 mAh 6S pack, RadioMaster RP1 V2 ELRS receiver, DJI O4 Air Unit, Matek M10Q-5883 GNSS/compass, custom frame.",
  tags: ["quadcopter", "reference-project", "5-inch", "6s"],
  display: { icon: "plane" },
  interfaces: [],
  children: [
    { id: "frame", moduleDefId: "quadcopter-5in-frame", name: "Frame" },
    { id: "stack", moduleDefId: "dolphinrc-f405-v3-stack", name: "FC + ESC stack" },
    ...ARMS.map((arm) => ({ id: arm.id, moduleDefId: "quadcopter-5in-arm", name: arm.label })),
    { id: "battery", moduleDefId: "cnhl-black-series-1100mah-6s-100c", name: "6S battery" },
    { id: "receiver", moduleDefId: "radiomaster-rp1-v2-elrs-2g4", name: "ELRS receiver" },
    { id: "video", moduleDefId: "dji-o4-air-unit", name: "DJI O4 Air Unit" },
    { id: "gnss", moduleDefId: "matek-m10q-5883", name: "GNSS + compass" },
    // harnesses carrying links
    { id: "xt60_lead", moduleDefId: "dolphinrc-xt60-battery-lead", name: "XT60 battery lead" },
    { id: "dji_cable", moduleDefId: "dji-o4-3in1-cable", name: "DJI 3-in-1 cable" },
    { id: "stack_hardware", moduleDefId: "quadcopter-5in-stack-hardware", name: "Stack hardware" },
  ],
  links: [
    // Power
    link("battery_pos", "VBAT", ["battery", "battery_out"], ["stack", "bat_in"], { harness: "xt60_lead" }),
    link("battery_neg", "Battery GND", ["battery", "battery_gnd"], ["stack", "bat_neg"], { harness: "xt60_lead" }),

    // Propulsion: ESC channel -> arm (exports motor phases), arm -> frame
    ...ARMS.flatMap((arm) => [
      link(`m${arm.motor}_phases`, `Motor ${arm.motor}`, ["stack", `motor_${arm.motor}`], [arm.id, "motor__phases"]),
      link(`${arm.id}_mount`, `${arm.label} mount`, [arm.id, "motor__base_mount"], ["frame", `motor_mount_${corner(arm.id)}`]),
    ]),

    // Stack to frame
    link("stack_mount", "ESC on frame", ["stack", "stack_mount"], ["frame", "stack_mount"], { harness: "stack_hardware" }),
    link("fc_mount", "FC on frame", ["stack", "fc_stack_mount"], ["frame", "stack_mount"], { harness: "stack_hardware" }),

    // Receiver: CRSF on UART2, powered from the 5 V BEC
    link("rx_crsf", "CRSF", ["stack", "uart2"], ["receiver", "crsf"]),
    link("rx_power", "RX 5V", ["stack", "bec_5v"], ["receiver", "vcc_5v"]),
    link("rx_gnd", "RX GND", ["stack", "gnd"], ["receiver", "gnd"]),

    // Video: DJI O4 on the 10 V BEC and UART5 (MSP DisplayPort)
    link("video_power", "O4 10V", ["stack", "bec_10v"], ["video", "vcc"], { harness: "dji_cable" }),
    link("video_gnd", "O4 GND", ["stack", "gnd"], ["video", "gnd"], { harness: "dji_cable" }),
    link("video_osd", "MSP DisplayPort", ["stack", "uart5"], ["video", "uart_osd"], { harness: "dji_cable" }),
    link("camera_mount", "Camera plates", ["video", "camera_mount"], ["frame", "camera_mount"]),
    link("vtx_mount", "Air unit mount", ["video", "tx_module_mount"], ["frame", "vtx_mount"]),

    // GNSS: UART1 + compass on I2C1, powered from the 4.5 V GPS rail
    link("gnss_uart", "GPS", ["stack", "uart1"], ["gnss", "uart_gnss"]),
    link("gnss_i2c", "Compass", ["stack", "i2c1"], ["gnss", "i2c_compass"]),
    link("gnss_power", "GPS 4.5V", ["stack", "rail_4v5"], ["gnss", "vin_5v"]),
    link("gnss_gnd", "GPS GND", ["stack", "gnd"], ["gnss", "gnd"]),
  ],
};

const ASSEMBLIES: ModuleDef[] = [QUADCOPTER_5IN, QUADCOPTER_5IN_FRAME, DOLPHINRC_F405_V3_STACK, QUADCOPTER_5IN_ARM, ...HARNESSES];

const BY_ID = new Map<string, ModuleDef>(
  [...(Object.values(parts) as ModuleDef[]), ...ASSEMBLIES].map((def) => [def.id, def]),
);

/** Resolves every module definition the quadcopter system references. */
export const lookupQuadcopterModule: ModuleLookup = (id) => BY_ID.get(id);

export { DOLPHINRC_F405_V3_STACK, QUADCOPTER_5IN_ARM, QUADCOPTER_5IN_FRAME, HARNESSES };
