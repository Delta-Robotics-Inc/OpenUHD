import type { InterfaceDef } from "../types/interface.js";
import type { ModuleDef } from "../types/module.js";
import type { DomainMetadata, PackageSpec } from "../types/domain.js";
import type { PassiveTrait, TraitDef } from "../types/trait.js";
import { defineModule } from "./define-module.js";

/**
 * Two-terminal passives (PB-824): resistors, capacitors, inductors and
 * ferrite beads placed on a board.
 *
 * A passive is an ordinary module with two leaf terminals, `pin_1` and
 * `pin_2` (protocol `passive`, role `terminal`), and a `passive` trait with
 * its value. Terminals pair with nothing, so a passive on a net never makes a
 * functional link; checks that care (bus_pullup) read the trait.
 */
export const PASSIVE_PROTOCOL = "passive";

/** One terminal of a passive. */
export function PassiveTerminal(pin: number | string, name?: string): InterfaceDef {
  return {
    id: `pin_${pin}`,
    name: name ?? String(pin),
    pin,
    domain: "electrical",
    exposed: true,
    default_active: true,
    protocols: [{ type: PASSIVE_PROTOCOL, roles: ["terminal"] }],
  };
}

export interface PassiveConfig {
  id: string;
  name: string;
  kind: PassiveTrait["params"]["kind"];
  value: number;
  unit: PassiveTrait["params"]["unit"];
  tolerance?: number;
  manufacturer?: string;
  part_number?: string;
  description?: string;
  /** Package (e.g. "0402", pin_count 2) and its body dimensions. */
  package?: PackageSpec;
  dimensions_mm?: DomainMetadata["dimensions_mm"];
  source?: string;
  assumption?: string;
  traits?: TraitDef[];
}

/** A two-terminal passive component as a module. */
export function Passive(config: PassiveConfig): ModuleDef {
  const trait: PassiveTrait = {
    type: "passive",
    params: {
      kind: config.kind,
      value: config.value,
      unit: config.unit,
      ...(config.tolerance !== undefined ? { tolerance: config.tolerance } : {}),
      ...(config.source ? { source: config.source } : {}),
      ...(config.assumption ? { assumption: config.assumption } : {}),
    },
  };
  const mechanical: DomainMetadata | undefined =
    config.package || config.dimensions_mm
      ? { domain: "mechanical", ...(config.dimensions_mm ? { dimensions_mm: config.dimensions_mm } : {}), ...(config.package ? { package: config.package } : {}) }
      : undefined;
  return defineModule({
    id: config.id,
    name: config.name,
    ...(config.manufacturer ? { manufacturer: config.manufacturer } : {}),
    ...(config.part_number ? { part_number: config.part_number } : {}),
    ...(config.description ? { description: config.description } : {}),
    categories: [`passive.${config.kind}`],
    interfaces: [PassiveTerminal(1), PassiveTerminal(2)],
    ...(mechanical ? { domains: [mechanical] } : {}),
    traits: [trait, ...(config.traits ?? [])],
  });
}

/** The `passive` trait of a module, if it is a passive. */
export function passiveOf(def: ModuleDef): PassiveTrait["params"] | undefined {
  const t = def.traits?.find((x) => x.type === "passive");
  return t ? (t.params as PassiveTrait["params"]) : undefined;
}
