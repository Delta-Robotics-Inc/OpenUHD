import type { Parameter } from "./parameter.js";

export interface TraitDef {
  type: string;
  params?: Record<string, unknown>;
}

export interface CanBridgeTrait extends TraitDef {
  type: "can_bridge";
  params: {
    from: string[];
    to: string[];
  };
}

export interface ProvidesPowerTrait extends TraitDef {
  type: "provides_power";
  params: {
    interfaceId: string;
    voltage: Parameter;
    maxCurrent: Parameter;
  };
}

export interface IsPickableTrait extends TraitDef {
  type: "is_pickable";
  params: {
    category: string;
    matchParams: string[];
  };
}

/**
 * A power output that is not its own regulator but a branch of another
 * output on the same module (PB-797): e.g. a flight controller's "4.5V"
 * receiver/GPS pads fed from its 5 V BEC through a diode. Loads on it count
 * against the parent output's rating in the supply_budget check.
 *
 * `source` cites where the relation is stated; without one, `assumption`
 * must say why it is believed (and the part should also carry an
 * `assumption` trait for the field).
 */
export interface SuppliedFromTrait extends TraitDef {
  type: "supplied_from";
  params: {
    /** Interface id of the parent power output on the same module. */
    interfaceId: string;
    /** Series element between the two, if known (e.g. "diode"). */
    via?: string;
    source?: string;
    assumption?: string;
  };
}
