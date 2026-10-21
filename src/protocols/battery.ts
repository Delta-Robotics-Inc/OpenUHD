import type { InterfaceDef, ProtocolDef, SlotDef } from "../types/interface.js";
import type { Parameter } from "../types/parameter.js";
import { linkSlots, type LinkSignal } from "./link.js";
import { capacitymAh, cellCount, chargeCurrentA, chargeVoltageV } from "./params.js";
import type { SignalRef } from "./signal.js";

/**
 * Battery charge ports: a charger's battery terminals and the battery they
 * charge.
 */

/** Cell chemistry, as it decides how a battery is charged. Another chemistry is named as the source names it. */
export type BatteryChemistry = "li_ion" | "li_polymer" | "lifepo4" | "nimh" | "nicd" | "lead_acid" | (string & {});

export interface ChargePortConfig {
  /** Interface id. Defaults to "charge_out" (charger) or "charge_in" (battery). */
  id?: string;
  name?: string;
  /** "charger": the terminals a charger charges a battery through. "battery": a cell or pack, on the terminals it is charged through. */
  role: "charger" | "battery";
  /**
   * The positive and negative terminals, where the pinout is modelled: the
   * ids of the power leaves that carry them (a charger's BAT pin and ground,
   * a battery's positive lead and ground), or inline pins.
   */
  plus?: SignalRef;
  minus?: SignalRef;
  /** A battery's chemistry, or every chemistry a charger charges. */
  chemistry: BatteryChemistry | BatteryChemistry[];
  /** Cells in series: a battery's count (one number), or the count or range [min, max] a charger takes. */
  cells: number | [number, number];
  /**
   * Charge voltage in V, for the whole pack. Charger: the voltage it charges
   * to, or the range it can be set to. Battery: its charge (cut-off)
   * voltage.
   */
  chargeVoltageV: number | [number, number];
  /**
   * Charge current in A. Charger: the current it charges at, or the range
   * it can be set to. Battery: the most it accepts. Left out when the
   * source states none (then not compared).
   */
  chargeCurrentA?: number | [number, number];
  /** Battery: capacity in mAh. */
  capacitymAh?: number;
  note?: string;
  exposed?: boolean;
  defaultActive?: boolean;
}

/**
 * A battery charge port: protocol `battery_charge`, role `charger` or
 * `battery`, with `cell_count`, `charge_voltage` (V) and `charge_current`
 * (A), slots `plus` and `minus`. It is separate from DC `power`: a
 * battery's terminal and a charger's battery pin are both supply outputs
 * there and never pair. A part keeps its `PowerOut` for the loads it
 * supplies and adds the charge port on the same leaves. Cell counts are
 * compared as parameters; the pair check `battery_charge` compares the
 * chemistry, the charge voltage and the charge current.
 */
export function ChargePort(config: ChargePortConfig): InterfaceDef[] {
  const charger = config.role === "charger";
  const id = config.id ?? (charger ? "charge_out" : "charge_in");
  if ((config.plus === undefined) !== (config.minus === undefined)) throw new Error(`ChargePort ${id}: give both terminals`);
  if (config.capacitymAh !== undefined && charger) throw new Error(`ChargePort ${id}: capacitymAh is a battery's`);
  const chemistry = Array.isArray(config.chemistry) ? config.chemistry : [config.chemistry];
  if (!chemistry.length) throw new Error(`ChargePort ${id}: name a chemistry`);
  if (!charger && chemistry.length > 1) throw new Error(`ChargePort ${id}: a battery has one chemistry`);
  // a battery is one pack: one cell count, which a charger's count or range must cover
  if (!charger && Array.isArray(config.cells)) throw new Error(`ChargePort ${id}: a battery has one cell count`);
  const counts = Array.isArray(config.cells) ? config.cells : [config.cells];
  if (counts.some((n) => !Number.isInteger(n) || n < 1)) throw new Error(`ChargePort ${id}: cells must be whole numbers from 1`);
  if (counts.length === 2 && counts[0] > counts[1]) throw new Error(`ChargePort ${id}: cells range [min, max] runs from low to high`);
  const side = charger ? "charge" : "battery";
  const signals: LinkSignal[] = [];
  if (config.plus !== undefined) {
    const plus: ProtocolDef[] = [{ type: "power", roles: ["output"] }];
    const ground: ProtocolDef[] = [{ type: "power", roles: ["ground"] }];
    signals.push({ slot: "plus", label: "+", ref: config.plus, leaf: plus, capability: `${side}_plus`, role: `${side}_plus`, required: true });
    signals.push({ slot: "minus", label: "-", ref: config.minus!, leaf: ground, capability: "ground", role: `${side}_minus`, required: true });
  }
  const generated: InterfaceDef[] = [];
  const { slots, bindings } = linkSlots(id, "battery_charge", signals, generated);
  const parameters: Parameter[] = [cellCount(config.cells), chargeVoltageV(config.chargeVoltageV)];
  if (config.chargeCurrentA !== undefined) parameters.push(chargeCurrentA(config.chargeCurrentA));
  if (config.capacitymAh !== undefined) parameters.push(capacitymAh(config.capacitymAh));
  return [
    ...generated,
    {
      id,
      name: config.name ?? (charger ? "Battery charge output" : "Battery charge input"),
      domain: "electrical",
      exposed: config.exposed ?? true,
      default_active: config.defaultActive ?? true,
      protocols: [{ type: "battery_charge", roles: [config.role] }],
      capabilities: ["battery_charge", charger ? "charge_out" : "charge_in"],
      parameters,
      ...(slots.length ? { slots: slots as SlotDef[], profiles: [{ id: `${id}_default`, label: "+ / -", default_active: true, bindings }] } : {}),
      traits: [{ type: "battery_charge", params: { chemistry, ...(config.note !== undefined ? { note: config.note } : {}) } }],
    },
  ];
}
