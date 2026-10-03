/**
 * Standardized protocol interface builders.
 *
 * One file per protocol. Part definition files import these builders and
 * supply part-specific parameters (pins, voltages, currents, frequencies);
 * the builders emit InterfaceDef objects with the canonical protocol types,
 * roles, capability tags, and parameter IDs that the matching engine
 * (matching/roles.ts) and slot binding (binding/) understand.
 */
export * from "./params.js";
export * from "./signal.js";
export * from "./pin.js";
export * from "./gpio.js";
export * from "./power.js";
export * from "./i2c.js";
export * from "./spi.js";
export * from "./uart.js";
export * from "./pwm.js";
export * from "./analog.js";
export * from "./connector.js";
export * from "./motor.js";
export * from "./stepper.js";
export * from "./encoder.js";
export * from "./servo.js";
export * from "./can.js";
export * from "./shield.js";
export * from "./fluid.js";
export * from "./link.js";
export * from "./pcie.js";
export * from "./mipi.js";
export * from "./ethernet.js";
export * from "./audio.js";
export * from "./camera.js";
export * from "./wireless.js";
export * from "./storage.js";
export * from "./led.js";
export * from "./relay.js";
export * from "./usb.js";
export * from "./rc.js";
export * from "./mechanical.js";
export * from "./define-module.js";
export * from "./net.js";
export * from "./passive.js";
export * from "./package.js";
