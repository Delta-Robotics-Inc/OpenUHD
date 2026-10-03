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

/**
 * A part made in rotation-handed variants under one definition (PB-797),
 * e.g. a propeller sold as a 2 CW + 2 CCW pack. Which variant an instance is
 * comes from `ChildModuleRef.spin`; the prop_handedness check compares it
 * with the spin of the motor the part is mounted on.
 */
export interface HandednessTrait extends TraitDef {
  type: "handedness";
  params: {
    variants: ("cw" | "ccw")[];
    /** How the variants are sold together, e.g. { cw: 2, ccw: 2 } per pack. */
    pack?: { cw: number; ccw: number };
    source?: string;
    note?: string;
  };
}

/**
 * A two-terminal passive component (PB-824): a resistor, capacitor,
 * inductor or ferrite bead on a board. The value is a fact of the part; its
 * terminals are `passive` leaves (see `Passive()` in src/protocols). The
 * bus_pullup check reads resistors from it.
 */
export interface PassiveTrait extends TraitDef {
  type: "passive";
  params: {
    kind: "resistor" | "capacitor" | "inductor" | "ferrite_bead";
    /** In `unit`: ohms, farads, henries (impedance in ohms for a ferrite bead). */
    value: number;
    unit: "Ω" | "F" | "H";
    /** Fractional tolerance, e.g. 0.01 for ±1 %. */
    tolerance?: number;
    source?: string;
    assumption?: string;
  };
}

/** An axis-aligned box in the module's own coordinates (mm). */
export interface Region {
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * Requirements a custom module (a board, an enclosure) must meet, stated
 * before it is designed (PB-824): the largest body it may have and regions it
 * must keep clear. A design tool honours them; the design_envelope check
 * compares the stated body (`dimensions_mm`) with `max_mm`. Layout itself is
 * never UHD.
 */
export interface DesignEnvelopeTrait extends TraitDef {
  type: "design_envelope";
  params: {
    /** Largest allowed body, length × width × height (any axis may be omitted). */
    max_mm: { length?: number; width?: number; height?: number };
    keep_outs?: { name: string; region: Region; reason?: string }[];
    /** Where the requirement comes from (a brief, an enclosure, a mating part). */
    reason?: string;
    source?: string;
  };
}
