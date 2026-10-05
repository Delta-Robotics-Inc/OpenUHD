import type { InterfaceDef, ProtocolDef } from "../types/interface.js";
import type { ModuleDef } from "../types/module.js";
import type { DomainMetadata, PackageSpec } from "../types/domain.js";
import type { TraitDef } from "../types/trait.js";
import { Ground, PowerIn, PowerOut } from "./power.js";
import { voltageRangeV, voltageV } from "./params.js";
import { isConnector } from "./connector.js";
import { isNet } from "./net.js";
import { PASSIVE_PROTOCOL } from "./passive.js";

/**
 * Component packages and pin tables: the facts a PCB tool needs from
 * a part that are true of the part — package name, pin count, pitch, exposed
 * pad, body size, and a designator on every pin. Footprints and land patterns
 * are the tool's own choice and stay out of UHD.
 */

/** A part's package with its overall size, read from its mechanical domain. */
export interface PartPackage extends PackageSpec {
  /** Overall size from the same mechanical domain (`dimensions_mm`). */
  size_mm?: DomainMetadata["dimensions_mm"];
}

/** The package fact of a part, or undefined when it states none. */
export function partPackage(def: ModuleDef): PartPackage | undefined {
  const mech = def.domains?.find((d) => d.domain === "mechanical" && d.package);
  if (!mech?.package) return undefined;
  return { ...mech.package, ...(mech.dimensions_mm ? { size_mm: mech.dimensions_mm } : {}) };
}

// ---------------------------------------------------------------------------
// Pin tables
// ---------------------------------------------------------------------------

/**
 * What a pin is electrically, as a datasheet pin table says it:
 * supply input/output, ground, logic (`io`, `input`, `output`), analog, a
 * passive terminal (an inductor or crystal pin), or `nc` (no internal
 * connection; it pairs with nothing).
 */
export type PinType =
  | "power_in"
  | "power_out"
  | "ground"
  | "io"
  | "input"
  | "output"
  | "analog_in"
  | "analog_out"
  | "passive"
  | "nc";

/** One row of a pin table. */
export interface PinRow {
  pin: number | string;
  /** Pin name as printed in the datasheet, e.g. "VDDIO", "AP_SDA / AP_SDIO". */
  name: string;
  type: PinType;
  /** Interface id; default `pin_<pin>`. */
  id?: string;
  /** Verbatim function text from the source; becomes a `pin_functions` trait. */
  description?: string;
  /** Supply voltage (power pins, required there) or logic level (overrides the table default). */
  voltageV?: number | [number, number];
  /** Nominal value when `voltageV` is a range (power pins). */
  nominalV?: number;
  /** Capability tags for slot binding (`i2c_sda`, `spi_sck`, …), added to the type's own. */
  capabilities?: string[];
  /** Extra protocols, e.g. `{ type: "interrupt", roles: ["output"] }`. */
  protocols?: ProtocolDef[];
  traits?: TraitDef[];
}

/** A row in short form: `[pin, name, type, description?]`. */
export type PinRowTuple = [pin: number | string, name: string, type: PinType, description?: string];

export interface PinTableOptions {
  /** URL and section of the pin table; cited on every `pin_functions` trait. */
  source: string;
  /** Default logic level for io/input/output/analog pins. */
  logicV?: number | [number, number];
}

const LOGIC: Record<"io" | "input" | "output" | "analog_in" | "analog_out", { protocols: ProtocolDef[]; capabilities: string[] }> = {
  io: { protocols: [{ type: "digital", roles: ["input", "output", "bidirectional"] }], capabilities: ["digital_io"] },
  input: { protocols: [{ type: "digital", roles: ["input"] }], capabilities: ["digital_io"] },
  output: { protocols: [{ type: "digital", roles: ["output"] }], capabilities: ["digital_io"] },
  analog_in: { protocols: [{ type: "analog", roles: ["input"] }], capabilities: ["analog_in"] },
  analog_out: { protocols: [{ type: "analog", roles: ["output"] }], capabilities: ["analog_out"] },
};

function rowInterface(row: PinRow, options: PinTableOptions): InterfaceDef {
  const id = row.id ?? `pin_${row.pin}`;
  const where = `pin table row ${row.pin} (${row.name})`;
  let iface: InterfaceDef;
  switch (row.type) {
    case "power_in":
    case "power_out": {
      if (row.voltageV === undefined) throw new Error(`${where}: a ${row.type} pin needs voltageV`);
      const build = row.type === "power_in" ? PowerIn : PowerOut;
      iface = build({ id, name: row.name, pin: row.pin, voltageV: row.voltageV, nominalV: row.nominalV });
      break;
    }
    case "ground":
      iface = Ground({ id, name: row.name, pin: row.pin });
      break;
    case "passive":
    case "nc":
      iface = {
        id,
        name: row.name,
        pin: row.pin,
        domain: "electrical",
        exposed: true,
        default_active: true,
        protocols: row.type === "passive" ? [{ type: PASSIVE_PROTOCOL, roles: ["terminal"] }] : [{ type: "custom", roles: ["no_connect"] }],
      };
      break;
    default: {
      const logic = LOGIC[row.type];
      const v = row.voltageV ?? options.logicV;
      iface = {
        id,
        name: row.name,
        pin: row.pin,
        domain: "electrical",
        exposed: true,
        default_active: true,
        protocols: [...logic.protocols],
        capabilities: [...logic.capabilities],
        ...(v !== undefined ? { parameters: [Array.isArray(v) ? voltageRangeV(v[0], v[1]) : voltageV(v)] } : {}),
      };
    }
  }
  const traits: TraitDef[] = [
    ...(iface.traits ?? []),
    ...(row.description ? [{ type: "pin_functions", params: { description: row.description, source: options.source } }] : []),
    ...(row.traits ?? []),
  ];
  return {
    ...iface,
    ...(row.protocols?.length ? { protocols: [...iface.protocols, ...row.protocols] } : {}),
    ...(row.capabilities?.length ? { capabilities: [...new Set([...(iface.capabilities ?? []), ...row.capabilities])] } : {}),
    ...(traits.length ? { traits } : {}),
  };
}

/**
 * A chip's pins as leaf interfaces, one per row, each carrying its designator
 * (`pin`), the datasheet name and a cited `pin_functions` trait. Throws on a
 * repeated designator or interface id, so a table cannot silently lose a pin.
 *
 *   const pins = pinTable([
 *     [1, "SDO", "io", "Serial data output in SPI 4W; I2C address bit 0 select"],
 *     { pin: 5, name: "VDDIO", type: "power_in", voltageV: [1.2, 3.6], nominalV: 1.8 },
 *     [6, "GNDIO", "ground"],
 *     { pin: 14, name: "SDx", type: "io", capabilities: ["i2c_sda", "spi_mosi"] },
 *   ], { source: `${SRC.datasheet} (Table 22)`, logicV: [1.2, 3.6] });
 *
 * Buses are then composed over the returned ids with the bus builders
 * (`I2C({ sda: "pin_14", scl: "pin_13" })`).
 */
export function pinTable(rows: (PinRow | PinRowTuple)[], options: PinTableOptions): InterfaceDef[] {
  const pins = new Set<string>();
  const ids = new Set<string>();
  return rows.map((r) => {
    const row: PinRow = Array.isArray(r) ? { pin: r[0], name: r[1], type: r[2], ...(r[3] ? { description: r[3] } : {}) } : r;
    const iface = rowInterface(row, options);
    if (pins.has(String(row.pin))) throw new Error(`pin table: designator ${row.pin} appears twice`);
    if (ids.has(iface.id)) throw new Error(`pin table: interface id "${iface.id}" appears twice`);
    pins.add(String(row.pin));
    ids.add(iface.id);
    return iface;
  });
}

// ---------------------------------------------------------------------------
// Designator checks
// ---------------------------------------------------------------------------

/**
 * Electrical leaves that stand for physical pins: no slots, not a connector
 * composite or a net, and not marked logical (`geometry.logical`, e.g. a
 * peripheral function such as a PWM block that is not a pin).
 */
export function leafPins(def: ModuleDef): InterfaceDef[] {
  return def.interfaces.filter(
    (i) => i.domain === "electrical" && !i.slots?.length && !isConnector(i) && !isNet(i) && !i.geometry?.logical,
  );
}

/**
 * Problems with a chip's pin designators, for parts that state a package:
 * electrical leaves with no `pin`, designators used by more than one leaf,
 * and numbered package pins that no leaf carries. Empty for parts with no
 * package fact (modules, boards, mechanical parts).
 */
export function pinDesignatorIssues(def: ModuleDef): string[] {
  const pkg = partPackage(def);
  if (!pkg) return [];
  const out: string[] = [];
  const leaves = leafPins(def);

  const missing = leaves.filter((i) => i.pin === undefined).map((i) => i.id);
  if (missing.length) {
    out.push(`${missing.length} leaf pin(s) have no designator: ${missing.join(", ")} (set \`pin\`, or mark a function that is not a pin \`geometry: { logical: true }\`)`);
  }

  const byPin = new Map<string, string[]>();
  for (const i of leaves) {
    if (i.pin === undefined) continue;
    byPin.set(String(i.pin), [...(byPin.get(String(i.pin)) ?? []), i.id]);
  }
  for (const [pin, ids] of byPin) {
    if (ids.length > 1) out.push(`designator ${pin} is on ${ids.length} leaves (${ids.join(", ")}); a pad is one leaf`);
  }

  if (pkg.exposed_pad_pin !== undefined && !byPin.has(String(pkg.exposed_pad_pin))) {
    out.push(`the exposed pad (${pkg.exposed_pad_pin}) has no leaf`);
  }
  const ep = pkg.exposed_pad_pin !== undefined ? String(pkg.exposed_pad_pin) : undefined;
  const terminals = [...byPin.keys()].filter((p) => p !== ep);
  if (terminals.every((p) => /^\d+$/.test(p))) {
    // numbered package: pins 1..pin_count
    const uncovered: number[] = [];
    for (let n = 1; n <= pkg.pin_count; n++) if (!byPin.has(String(n))) uncovered.push(n);
    if (uncovered.length) out.push(`${pkg.name} has ${pkg.pin_count} pins but no leaf carries ${uncovered.join(", ")}`);
    const stray = terminals.filter((p) => Number(p) < 1 || Number(p) > pkg.pin_count);
    if (stray.length) out.push(`designator(s) ${stray.join(", ")} are outside ${pkg.name}'s pins 1–${pkg.pin_count}`);
  } else if (terminals.length !== pkg.pin_count) {
    // grid or named designators (BGA "A7"): compare the count only
    out.push(`${pkg.name} has ${pkg.pin_count} pins but ${terminals.length} designators are used`);
  }
  return out;
}
