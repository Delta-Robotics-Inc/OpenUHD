/**
 * Betaflight configuration for the 5-inch quadcopter, derived from its UHD
 * links and part facts (PB-792). CLI syntax and values follow
 * ./betaflight-reference.md (verified against Betaflight 4.5.5, 2025.12.5
 * and 2026.6.2 sources). Output targets Betaflight >= 2025.12.1, which the
 * M9N-5883's QMC5883P compass requires.
 *
 * Every line is emitted with a comment naming the link or part fact it
 * comes from. Nothing here is flight-tested: verify on hardware.
 */
import type { InterfaceDef, ModuleDef, TraitDef } from "../../../src/types/index.js";
import { validateLinks, type LinkResult, type ModuleLookup, type ResolvedEndpoint } from "../../../src/system/index.js";

/** serialPortFunction_e values (betaflight-reference.md §1). */
const FUNCTION = { MSP: 1, GPS: 2, RX_SERIAL: 64, VTX_MSP: 131072 } as const;

interface Line {
  text: string;
  why: string;
}

const traitsOf = (x: { traits?: TraitDef[] }) => x.traits ?? [];

/** All trait params of a module and its interfaces, flattened. */
function facts(def: ModuleDef): Record<string, unknown>[] {
  return [def, ...def.interfaces].flatMap(traitsOf).map((t) => (t.params ?? {}) as Record<string, unknown>);
}

function textOf(def: ModuleDef): string {
  return JSON.stringify(facts(def));
}

const hasProtocol = (iface: InterfaceDef, type: string) => iface.protocols.some((p) => p.type === type);

function kindOf(end: ResolvedEndpoint): "receiver" | "gnss" | "dji" | "other" {
  const words = `${end.owner.name} ${(end.owner.tags ?? []).join(" ")} ${(end.owner.categories ?? []).join(" ")}`.toLowerCase();
  if (hasProtocol(end.iface, "crsf")) return "receiver";
  if (/gnss|gps/.test(words)) return "gnss";
  if (/dji|air unit/.test(words)) return "dji";
  return "other";
}

/** "uart5" → 5, from the flight controller's interface id. */
const uartNumber = (iface: InterfaceDef) => Number(/^uart(\d+)$/.exec(iface.id)?.[1]);

function isFlightController(def: ModuleDef): boolean {
  return /flight controller/i.test(def.name) || (def.categories ?? []).some((c) => /flight/i.test(c));
}

function param(iface: InterfaceDef, id: string) {
  return iface.parameters?.find((p) => p.id === id);
}

export interface BetaflightConfig {
  target?: string;
  minFirmware: string;
  buildOptions: string[];
  lines: Line[];
  warnings: string[];
}

export function betaflightConfig(system: ModuleDef, lookup: ModuleLookup): BetaflightConfig {
  const links = validateLinks(system, lookup);
  const lines: Line[] = [];
  const warnings: string[] = [];
  const features = new Set<string>();
  const buildOptions = new Set<string>(["DSHOT"]);
  let minFirmware = "4.5.5";

  const fcEnd = (r: LinkResult): [ResolvedEndpoint, ResolvedEndpoint] | undefined => {
    if (isFlightController(r.a.owner)) return [r.a, r.b];
    if (isFlightController(r.b.owner)) return [r.b, r.a];
    return undefined;
  };

  // --- target -------------------------------------------------------------
  const fcDef = links.map(fcEnd).find(Boolean)?.[0].owner;
  const target = fcDef ? /\b(MATEK[A-Z0-9]+|[A-Z0-9]{6,}(?=\b[^"]*target))/.exec(textOf(fcDef) + fcDef.description)?.[1] : undefined;

  // --- serial ports ---------------------------------------------------------
  for (const r of links) {
    const ends = fcEnd(r);
    if (!ends || r.protocol !== "uart") continue;
    const [fc, other] = ends;
    const n = uartNumber(fc.iface);
    if (!Number.isFinite(n)) continue;
    const kind = kindOf(other);
    const why = `link ${r.link.id}: ${fc.path} ↔ ${other.path}`;
    if (kind === "receiver") {
      lines.push({ text: `serial UART${n} ${FUNCTION.RX_SERIAL} 115200 57600 0 115200`, why: `${why} (CRSF receiver → RX_SERIAL)` });
      lines.push({ text: "set serialrx_provider = CRSF", why: `${other.path} speaks crsf` });
      features.add("TELEMETRY");
      buildOptions.add("SERIALRX_CRSF");
    } else if (kind === "gnss") {
      lines.push({ text: `serial UART${n} ${FUNCTION.GPS} 115200 115200 0 115200`, why: `${why} (GNSS → GPS)` });
      lines.push({ text: "set gps_provider = UBLOX", why: `${other.owner.name}: u-blox receiver` });
      lines.push({ text: "set gps_auto_config = ON", why: "auto-config sets the module's baud/protocol from its default" });
      features.add("GPS");
      buildOptions.add("GPS");
    } else if (kind === "dji") {
      lines.push({ text: `serial UART${n} ${FUNCTION.MSP + FUNCTION.VTX_MSP} 115200 57600 0 115200`, why: `${why} (DJI MSP DisplayPort → MSP + VTX_MSP)` });
      lines.push({ text: "set osd_displayport_device = MSP", why: "DJI O4 OSD via MSP DisplayPort (onboard analog OSD chip must not win on AUTO)" });
      lines.push({ text: "set vcd_video_system = HD", why: "HD digital video system" });
      features.add("OSD");
      buildOptions.add("OSD_HD");
    } else {
      warnings.push(`${why}: no Betaflight serial function derived for ${other.owner.name}`);
    }
  }

  // --- motors ---------------------------------------------------------------
  const phaseLinks = links.filter((r) => r.protocol === "bldc_3phase");
  const escDef = phaseLinks[0] && (param(phaseLinks[0].a.iface, "max_current") ? phaseLinks[0].a.owner : phaseLinks[0].b.owner);
  const fcRates = fcDef?.interfaces.find((i) => i.capabilities?.includes("esc_signal"))?.parameters?.find((p) => p.id === "esc_signal_rate");
  const escRates = escDef?.interfaces.find((i) => i.capabilities?.includes("esc_signal"))?.parameters?.find((p) => p.id === "esc_signal_rate");
  const maxRate = (p?: { value?: number; range?: [number, number] }) => p?.range?.[1] ?? p?.value;
  const rate = Math.min(maxRate(fcRates) ?? 0, maxRate(escRates) ?? 0);
  if (rate >= 150) {
    const protocol = rate >= 600 ? "DSHOT600" : rate >= 300 ? "DSHOT300" : "DSHOT150";
    lines.push({ text: `set motor_pwm_protocol = ${protocol}`, why: `highest DShot rate both ${fcDef?.id} and ${escDef?.id} state (${rate} kbit/s)` });
  } else {
    warnings.push("no common DShot rate between the FC motor outputs and the ESC inputs");
  }
  const bidir = (def?: ModuleDef) => Boolean(def?.interfaces.some((i) => i.capabilities?.includes("dshot_bidirectional")));
  if (bidir(fcDef) && bidir(escDef)) {
    lines.push({ text: "set dshot_bidir = ON", why: `both ${fcDef?.id} and ${escDef?.id} state bidirectional DShot (source: DolphinRC review blog only — verify)` });
  }
  const motorEnd = phaseLinks[0] && (param(phaseLinks[0].a.iface, "max_current") ? phaseLinks[0].b : phaseLinks[0].a);
  const config = motorEnd && /(\d+)N(\d+)P/.exec(textOf(motorEnd.owner));
  if (config) {
    lines.push({ text: `set motor_poles = ${config[2]}`, why: `${motorEnd.owner.id}: ${config[0]} stator (${config[2]} magnet poles)` });
  }

  // Quad-X motor order check (betaflight-reference.md §3)
  const expected: Record<number, string> = { 1: "rr", 2: "fr", 3: "rl", 4: "fl" };
  for (const r of phaseLinks) {
    const escSide = param(r.a.iface, "max_current") ? r.a : r.b;
    const armSide = escSide === r.a ? r.b : r.a;
    const n = Number(/(\d+)$/.exec(escSide.iface.id)?.[1]);
    const corner = /arm_(\w\w)/.exec(armSide.path)?.[1];
    if (expected[n] && corner && expected[n] !== corner) {
      warnings.push(`motor ${n} is wired to arm_${corner}; Betaflight Quad-X expects arm_${expected[n]} (remap with the resource command or rewire)`);
    }
  }

  // --- current meter ----------------------------------------------------------
  const scale = escDef && /scale[^0-9]{0,12}(\d{2,4})/i.exec(textOf(escDef));
  if (scale) {
    lines.push({ text: "set current_meter = ADC", why: `${escDef?.id}: analog current sensor on the FC connector` });
    lines.push({ text: `set ibata_scale = ${scale[1]}`, why: `${escDef?.id}: manufacturer current scale` });
    lines.push({ text: "set ibata_offset = 0", why: `${escDef?.id}: manufacturer current offset` });
  }

  // --- compass -----------------------------------------------------------------
  const compass = links.find((r) => r.protocol === "i2c" && fcEnd(r));
  if (compass) {
    const [, other] = fcEnd(compass)!;
    const address = param(other.iface, "i2c_address")?.value;
    lines.push({ text: "set mag_hardware = AUTO", why: `link ${compass.link.id}: compass at 0x${address?.toString(16).toUpperCase()} on ${compass.a.path}` });
    buildOptions.add("MAG");
    if (address === 0x2c) {
      minFirmware = "2025.12.1";
      warnings.push(`${other.owner.id}: QMC5883P compass (0x2C) is detected only by Betaflight >= 2025.12.1`);
    }
    const align = /CW\s?(\d+)°?\s*Flip/i.exec(textOf(other.owner));
    if (align) {
      lines.push({ text: `set align_mag = CW${align[1]}FLIP`, why: `${other.owner.id}: manufacturer alignment for arrow-forward mounting — confirm in the Sensors tab` });
    }
  }

  // --- features ------------------------------------------------------------------
  const featureLines = [...features].map((f) => ({ text: `feature ${f}`, why: "required by the serial functions above" }));
  return {
    target,
    minFirmware,
    buildOptions: [...buildOptions].sort(),
    lines: [
      ...lines
        .filter((l) => l.text.startsWith("serial"))
        .sort((a, b) => Number(/UART(\d+)/.exec(a.text)?.[1]) - Number(/UART(\d+)/.exec(b.text)?.[1])),
      ...featureLines,
      ...lines.filter((l) => !l.text.startsWith("serial")),
    ],
    warnings,
  };
}

export function betaflightCli(system: ModuleDef, cfg: BetaflightConfig): string {
  const width = Math.max(...cfg.lines.map((l) => l.text.length)) + 2;
  return [
    `# Betaflight configuration — ${system.name}`,
    `# Generated from UHD by library/systems/quadcopter-5in/generate.ts. Do not edit by hand.`,
    `# Target: ${cfg.target ?? "unknown"} · firmware >= ${cfg.minFirmware} · cloud build options: ${cfg.buildOptions.join(", ")}`,
    `# Syntax and values verified against library/systems/quadcopter-5in/betaflight-reference.md.`,
    `# NOT FLIGHT-TESTED. Verify motor order, directions and compass alignment on the bench before flight.`,
    ...cfg.warnings.map((w) => `# WARNING: ${w}`),
    "",
    ...cfg.lines.map((l) => `${l.text.padEnd(width)}# ${l.why}`),
    "save",
    "",
  ].join("\n");
}
