import type { InterfaceDef } from "../types/interface.js";
import { UART, type UARTConfig } from "./uart.js";
import { signalPin, type SignalSpec } from "./signal.js";

/**
 * Radio-control receiver link builders.
 *
 * CRSF (TBS Crossfire serial protocol, also used by ExpressLRS) runs over a
 * full-duplex UART, so it is a UART port that additionally speaks `crsf`.
 * A flight controller's UARTs are assigned serial-RX duty in firmware, so
 * flight controllers keep plain UART ports and match receivers on `uart`.
 */

/** A CRSF port on a receiver (default device role, 420000 baud). */
export function CRSF(config: UARTConfig): InterfaceDef[] {
  const roles = config.roles ?? ["device"];
  const interfaces = UART({
    ...config,
    id: config.id ?? "crsf",
    name: config.name ?? "CRSF",
    roles,
    baudRate: config.baudRate ?? 420_000,
    defaultActive: config.defaultActive ?? true,
  });
  const port = interfaces[interfaces.length - 1];
  port.protocols = [...port.protocols, { type: "crsf", roles: [...roles] }];
  port.traits = [
    ...(port.traits ?? []),
    {
      type: "serial_rx_protocol",
      params: {
        protocol: "crsf",
        note: "CRSF framing over full-duplex UART; the flight controller assigns serial RX to one of its UARTs in firmware.",
      },
    },
  ];
  return interfaces;
}

export interface SbusConfig extends SignalSpec {
  /** Interface id. Defaults to "sbus". */
  interfaceId?: string;
  /** "output" = receiver; "input" = flight controller SBUS pad. */
  role: "output" | "input";
}

/** A single-wire SBUS signal (inverted serial, 100000 baud). */
export function SBUS(config: SbusConfig): InterfaceDef {
  const leaf = signalPin({
    id: config.interfaceId ?? "sbus",
    defaultName: "SBUS",
    capability: "sbus",
    protocols: [{ type: "sbus", roles: [config.role] }],
    spec: config,
  });
  return {
    ...leaf,
    parameters: [...(leaf.parameters ?? []), { id: "baud_rate", unit: "Hz", value: 100_000 }],
  };
}
