/**
 * Sub-assemblies of the 5-inch reference quadcopter.
 *
 * - DOLPHINRC_F405_V3_STACK: a real module (the purchased stack) whose
 *   children are the flight controller and the 4-in-1 ESC, joined by the
 *   FC <-> ESC connector. Its boundary interfaces are explicit exports.
 * - QUADCOPTER_5IN_ARM: a group (motor + propeller). It has no interfaces of
 *   its own; kind "group" exports every child interface not linked inside
 *   it, so the motor's phases and base mount appear on the arm boundary.
 */
import type { ModuleDef } from "../../../src/types/index.js";

export const DOLPHINRC_F405_V3_STACK: ModuleDef = {
  id: "dolphinrc-f405-v3-stack",
  name: "DolphinRC F405 V3 + AM32 60A stack",
  kind: "module",
  manufacturer: "DolphinRC",
  description:
    "30.5 mm flight-controller stack: F405 V3 flight controller over an AM32 60A 4-in-1 ESC, joined by the 8-pin FC/ESC cable.",
  tags: ["stack", "flight-controller", "esc"],
  categories: ["flight-controller"],
  display: { icon: "layers" },
  interfaces: [],
  children: [
    { id: "fc", moduleDefId: "dolphinrc-f405-v3-flight-controller", name: "Flight controller" },
    { id: "esc", moduleDefId: "dolphinrc-am32-60a-4in1-esc", name: "4-in-1 ESC" },
  ],
  links: [
    {
      id: "fc_esc_cable",
      name: "FC/ESC 8-pin cable",
      a: { child: "fc", interfaceId: "esc_port" },
      b: { child: "esc", interfaceId: "fc_port" },
    },
  ],
  exports: [
    { id: "bat_in", name: "Battery +", from: { child: "esc", interfaceId: "bat_in" } },
    { id: "bat_neg", name: "Battery −", from: { child: "esc", interfaceId: "bat_neg" } },
    { id: "motor_1", name: "Motor 1", from: { child: "esc", interfaceId: "motor_1" } },
    { id: "motor_2", name: "Motor 2", from: { child: "esc", interfaceId: "motor_2" } },
    { id: "motor_3", name: "Motor 3", from: { child: "esc", interfaceId: "motor_3" } },
    { id: "motor_4", name: "Motor 4", from: { child: "esc", interfaceId: "motor_4" } },
    { id: "bec_5v", name: "5V BEC", from: { child: "fc", interfaceId: "bec_5v" } },
    { id: "bec_10v", name: "10V BEC", from: { child: "fc", interfaceId: "bec_10v" } },
    { id: "rail_4v5", name: "4.5V rail", from: { child: "fc", interfaceId: "rail_4v5" } },
    { id: "gnd", name: "GND", from: { child: "fc", interfaceId: "gnd" } },
    { id: "uart1", name: "UART1", from: { child: "fc", interfaceId: "uart1" } },
    { id: "uart2", name: "UART2", from: { child: "fc", interfaceId: "uart2" } },
    { id: "uart5", name: "UART5 (DJI)", from: { child: "fc", interfaceId: "uart5" } },
    { id: "i2c1", name: "I2C1", from: { child: "fc", interfaceId: "i2c1" } },
    { id: "usb", name: "USB-C", from: { child: "fc", interfaceId: "usb" } },
    { id: "stack_mount", name: "Stack mount", from: { child: "esc", interfaceId: "stack_mount" } },
  ],
};

export const QUADCOPTER_5IN_ARM: ModuleDef = {
  id: "quadcopter-5in-arm",
  name: "Arm (motor + propeller)",
  kind: "group",
  description: "One propulsion corner: a MEPS NEON 2207 V2 motor driving an HQProp Ethix S5 propeller.",
  tags: ["propulsion", "group"],
  display: { icon: "fan" },
  interfaces: [],
  children: [
    { id: "motor", moduleDefId: "meps-neon-2207-v2-1950kv", name: "Motor" },
    { id: "prop", moduleDefId: "hqprop-ethix-s5", name: "Propeller" },
  ],
  links: [
    {
      id: "prop_on_shaft",
      name: "Prop on shaft",
      a: { child: "motor", interfaceId: "shaft" },
      b: { child: "prop", interfaceId: "hub_bore" },
    },
  ],
};
