import type { InterfaceDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { busWidthBits, clockFreqHz } from "./params.js";
import { DIGITAL_IN, DIGITAL_OUT, linkSlots, type LinkSignal } from "./link.js";
import type { SignalRef } from "./signal.js";

/**
 * DVP, the parallel camera bus (OV2640, OV7670 and kin).
 *
 * Protocol `dvp`, role `camera` (the sensor) or `host` (an MCU's camera
 * interface, a camera connector on a board). Camera pairs with host only.
 * The camera drives the data lines, PCLK, VSYNC and HREF (HSYNC); the host
 * may drive XCLK, the camera's input clock. PWDN and RESET are ordinary
 * `Pin`s; the control bus (SCCB) is an `I2C` interface.
 *
 * Data pins are given MSB first, D(n−1) down to D0, and the slots pair in
 * that order, so a 10-bit camera on an 8-bit host lands D9..D2 on D7..D0:
 * the usual wiring. The top eight data slots are required. `bus_width` is
 * checked by `checkPairLinks` (`dvp_width`): a host narrower than the
 * camera is a warning (it takes the upper bits), a wider host is info.
 * `clock_freq` is the pixel clock and must overlap.
 */

export interface DVPConfig {
  /** Interface id. Defaults to "dvp". */
  id?: string;
  name?: string;
  role: "camera" | "host";
  /** Data lines: 8, 10, 12 or 16. */
  dataWidth: number;
  /** Data pins MSB first (D[n−1] … D0). Give all of them, or none. */
  data?: SignalRef[];
  pclk?: SignalRef;
  vsync?: SignalRef;
  /** HREF / HSYNC. */
  href?: SignalRef;
  /** XCLK: the camera's input clock, from the host. */
  xclk?: SignalRef;
  /** Pixel clock in Hz: the camera's [min, max], the host's maximum or range. */
  pclkHz?: number | [number, number];
  voltageV?: number | [number, number];
  exposed?: boolean;
  defaultActive?: boolean;
}

/** A DVP camera port or host camera interface: protocol `dvp`, MSB-first data slots, PCLK, VSYNC, HREF and XCLK. */
export function DVP(config: DVPConfig): InterfaceDef[] {
  const id = config.id ?? "dvp";
  const width = config.dataWidth;
  if (![8, 10, 12, 16].includes(width)) throw new Error(`DVP ${id}: dataWidth must be 8, 10, 12 or 16 (got ${width})`);
  const data = config.data ?? [];
  if (data.length && data.length !== width) throw new Error(`DVP ${id}: ${data.length} data pins for a ${width}-bit bus (give all, MSB first, or none)`);
  const cam = config.role === "camera";
  const out = cam ? "out" : "in";
  const signals: LinkSignal[] = [];
  data.forEach((ref, i) => {
    const bit = width - 1 - i;
    signals.push({ slot: `d${bit}`, label: `D${bit}`, ref, leaf: cam ? DIGITAL_OUT : DIGITAL_IN, capability: `dvp_d${bit}`, role: `data_${out}`, required: i < 8 });
  });
  const add = (slot: string, label: string, ref: SignalRef | undefined, cameraDrives: boolean, required: boolean) => {
    if (ref === undefined) return;
    const drives = cameraDrives === cam;
    signals.push({ slot, label, ref, leaf: drives ? DIGITAL_OUT : DIGITAL_IN, capability: `dvp_${slot}`, role: `${slot}_${drives ? "out" : "in"}`, required });
  };
  add("pclk", "PCLK", config.pclk, true, true);
  add("vsync", "VSYNC", config.vsync, true, true);
  add("href", "HREF", config.href, true, true);
  add("xclk", "XCLK", config.xclk, false, false);

  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "dvp", signals, generated, config.voltageV);
  const parameters: Parameter[] = [busWidthBits(width)];
  if (config.pclkHz !== undefined) parameters.push(clockFreqHz(config.pclkHz));
  return [
    ...generated,
    {
      id,
      name: config.name ?? `DVP ${width}-bit ${config.role}`,
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "dvp", roles: [config.role] }],
      capabilities: ["dvp"],
      parameters,
      ...(slots.length ? { slots, profiles: [{ id: `${id}_default`, label: `DVP ${width}-bit`, default_active: true, bindings }] } : {}),
    },
  ];
}
