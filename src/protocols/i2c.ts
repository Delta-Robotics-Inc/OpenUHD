import type { InterfaceDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { clockFreqHz, voltageV } from "./params.js";
import { resolveSignal, DIGITAL_BIDIR, type SignalRef } from "./signal.js";

/**
 * I2C bus interface builder.
 *
 * Returns the bus InterfaceDef plus any pin InterfaceDefs generated from
 * inline signal specs — spread the result into the module's interfaces:
 *
 *   ...I2C({
 *     instance: 1,                              // -> id "i2c1", names SDA1/SCL1
 *     roles: ["master"],
 *     clockFreqHz: 400_000,
 *     sda: { pin: 42, name: "SDA1", voltageV: [1.8, 3.6], maxCurrentmA: 40 },
 *     scl: { pin: 39, name: "SCL1", voltageV: [1.8, 3.6], maxCurrentmA: 40 },
 *   })
 *
 * A signal may instead be a string referencing an already-declared pin
 * interface id (the MCU/GPIO-matrix style). Either way the default
 * profile is wired automatically. Declare a second controller by calling
 * I2C() again with a different instance number.
 */
export type I2CRole = "master" | "slave";

export interface I2CProfile {
  id: string;
  label?: string;
  /** Pin interface ID bound to the SDA slot. */
  sda: string;
  /** Pin interface ID bound to the SCL slot. */
  scl: string;
  defaultActive?: boolean;
}

export interface I2CConfig {
  /** Interface id. Defaults to "i2c<instance>" (e.g. "i2c0"). */
  id?: string;
  /** Instance number for multi-controller parts; also suffixes default signal names. */
  instance?: number;
  name?: string;
  /** Roles this controller can take (default ["master"]). */
  roles?: I2CRole[];
  /** Max SCL clock in Hz (default 400 kHz Fast-mode). */
  clockFreqHz?: number | [number, number];
  /** Bus logic voltage. */
  voltageV?: number;
  /** 7-bit device address, for slave-only devices such as sensors. */
  address?: number;
  /**
   * Other 7-bit addresses the device answers at by default, by name: a
   * PCA9685's all-call address `{ all_call: 0x70 }`, enabled sub-addresses.
   * Each becomes an `i2c_address_<name>` parameter; a bus scan finds them and
   * no other device on the bus may use them.
   */
  otherAddresses?: Record<string, number>;
  /** SDA signal: inline spec (pin number, name, V/mA/Hz) or existing pin interface id. */
  sda?: SignalRef;
  /** SCL signal: inline spec or existing pin interface id. */
  scl?: SignalRef;
  /** Extra named pin routings beyond the auto-generated default. */
  profiles?: I2CProfile[];
  /** Max simultaneous instances (profiles) of this controller. */
  maxInstances?: number;
  exposed?: boolean;
  defaultActive?: boolean;
}

export function I2C(config: I2CConfig): InterfaceDef[] {
  const instance = config.instance;
  const id = config.id ?? `i2c${instance ?? 0}`;
  const sfx = instance !== undefined ? String(instance) : "";

  const generated: InterfaceDef[] = [];
  const profiles = [...(config.profiles ?? [])];

  if (config.sda !== undefined && config.scl !== undefined) {
    const sdaId = resolveSignal(
      config.sda,
      { id: `${id}_sda`, defaultName: `SDA${sfx}`, capability: "i2c_sda", protocols: DIGITAL_BIDIR },
      generated,
    );
    const sclId = resolveSignal(
      config.scl,
      { id: `${id}_scl`, defaultName: `SCL${sfx}`, capability: "i2c_scl", protocols: DIGITAL_BIDIR },
      generated,
    );
    profiles.unshift({ id: `${id}_default`, label: config.name ?? id.toUpperCase(), sda: sdaId, scl: sclId });
  }

  const parameters: Parameter[] = [clockFreqHz(config.clockFreqHz ?? 400_000)];
  if (config.voltageV !== undefined) parameters.push(voltageV(config.voltageV));
  if (config.address !== undefined) {
    parameters.push({ id: "i2c_address", unit: "dimensionless", value: config.address });
  }
  for (const [name, value] of Object.entries(config.otherAddresses ?? {})) {
    parameters.push({ id: `i2c_address_${name}`, unit: "dimensionless", value });
  }

  const bus: InterfaceDef = {
    id,
    name: config.name ?? `I2C${sfx}`,
    domain: "electrical",
    exposed: config.exposed ?? true,
    default_active: config.defaultActive ?? false,
    protocols: [{ type: "i2c", roles: config.roles ?? ["master"] }],
    parameters,
    slots: [
      { id: "sda", required: true, match: { protocol: "i2c", role: "data", capability: "i2c_sda" } },
      { id: "scl", required: true, match: { protocol: "i2c", role: "clock", capability: "i2c_scl" } },
    ],
    ...(profiles.length > 0
      ? {
          profiles: profiles.map((p) => ({
            id: p.id,
            label: p.label,
            bindings: { sda: p.sda, scl: p.scl },
            ...(p.defaultActive !== undefined ? { default_active: p.defaultActive } : {}),
          })),
        }
      : {}),
    ...(config.maxInstances !== undefined ? { max_instances: config.maxInstances } : {}),
  };

  return [...generated, bus];
}

/**
 * The 7-bit addresses an I2C interface answers at: its `i2c_address` first,
 * then every other `i2c_address_<name>` parameter (an all-call address,
 * enabled sub-addresses), each with its name.
 */
export function i2cAddresses(iface: { parameters?: { id: string; value?: number; range?: [number, number] }[] }): { name: string; address: number }[] {
  const out: { name: string; address: number }[] = [];
  for (const p of iface.parameters ?? []) {
    const m = /^i2c_address(?:_(.+))?$/.exec(p.id);
    const v = p.value ?? p.range?.[0];
    if (!m || v === undefined) continue;
    out.push({ name: m[1] ?? "address", address: v });
  }
  return out.sort((a, b) => (a.name === "address" ? -1 : b.name === "address" ? 1 : 0));
}
