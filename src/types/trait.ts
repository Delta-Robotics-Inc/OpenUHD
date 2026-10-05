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
 * output on the same module: e.g. a flight controller's "4.5V"
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
 * A part made in rotation-handed variants under one definition,
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
 * A two-terminal passive component: a resistor, capacitor,
 * inductor or ferrite bead on a board. The value is a fact of the part; its
 * terminals are `passive` leaves (see `Passive()` in src/protocols). The
 * bus_pullup check reads resistors from it.
 *
 * A series part (one definition for a manufacturer series and size, e.g. a
 * chip-resistor range) states its default instance in `kind`, `value`,
 * `unit` and `tolerance`, which is all a tool that knows nothing of series
 * reads, and adds the series fields: the instance `parameters`, categorical
 * `choices`, the keys a placement may set in `ChildModuleRef.overrides`
 * (`overridable`), the `tolerances` grades, a value table (`values`) where
 * only listed values exist, and the `part_number` rule. `passiveOf(def,
 * overrides)` applies a placement's overrides (src/protocols/passive.ts).
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
    /** Series name, e.g. "Yageo RC_L RC0402, standard power". */
    series?: string;
    /**
     * Numeric parameters of an instance, typed with units. `value` is the
     * default instance's; `range` the series limit where the source states
     * one. The value parameter is named for the kind: `resistance`,
     * `capacitance`, `inductance` or `impedance_100mhz`.
     */
    parameters?: Parameter[];
    /** Categorical parameters (an MLCC's dielectric): allowed values and the default. */
    choices?: Record<string, PassiveChoice>;
    /** Keys a placement may set in `ChildModuleRef.overrides`: parameter ids, choice ids, `part_number`. */
    overridable?: string[];
    /** Tolerance grades, each with its ordering code and the value range it is made in. */
    tolerances?: PassiveToleranceGrade[];
    /** Only these values exist (a ferrite bead's impedance table), each with its ordering code. */
    values?: PassiveValueRow[];
    /** How the instance's manufacturer part number is formed and read. */
    part_number?: PassivePartNumberRule;
  };
}

export interface PassiveChoice {
  values: string[];
  default: string;
  source?: string;
}

export interface PassiveToleranceGrade {
  /** Fraction, as in `tolerance` (0.01 = ±1 %). */
  tolerance: number;
  /** Ordering-code letter. */
  code: string;
  /** Values this grade is made in, in the passive's unit. */
  range?: [number, number];
}

export interface PassiveValueRow {
  value: number;
  /** Ordering code of this value. */
  code: string;
  /** Parameters this value fixes (a bead's rated current, DC resistance). */
  parameters?: Record<string, number>;
}

/**
 * The ordering-code rule of a series. The rule itself is data of the part;
 * `passiveOf` only interprets it.
 */
export interface PassivePartNumberRule {
  /** The default instance's MPN. */
  default: string;
  /**
   * How the MPN is formed from the instance: `{value}` and `{tolerance}` are
   * replaced by their codes. Null when the MPN carries a manufacturer code no
   * parameter decides: the placement then names `part_number` itself.
   */
  pattern: string | null;
  /**
   * How `{value}` is written: `rkm` R/K/M as the decimal point (4K7), or
   * three EIA digits, significand and number of zeros, in pF (`eia3_pf`) or
   * in the unit (`eia3_ohm`).
   */
  value_code: "rkm" | "eia3_pf" | "eia3_ohm";
  /** Decodes an MPN: a regular expression whose named groups are `value` or keys of `codes`. */
  decode?: string;
  /** Code tables used by `decode`: group name -> code -> parameter value. */
  codes?: Record<string, Record<string, number | string>>;
  source?: string;
}

/** An axis-aligned box in the module's own coordinates (mm). */
export interface Region {
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * Requirements a custom module (a board, an enclosure) must meet, stated
 * before it is designed: the largest body it may have and regions it
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

/**
 * A strap: a configuration input the part samples as a fixed level,
 * set on the board by tying the pin to a supply or ground, directly or
 * through a resistor (an IMU's address pin selects its I2C address; a boot-mode
 * pin). On an interface leaf. A pin shared by several functions is a strap
 * only while the part runs the interfaces in `when` (an IMU's address pin may
 * also be its SPI MISO, and an address strap only in I2C mode): the strap applies when a
 * link to one of them is derived on the board. Without `when` it always is.
 *
 * The net rule reports a strap on a net that carries another part's signal
 * (a bus line): its level then follows that signal instead of being set.
 */
export interface StrapTrait extends TraitDef {
  type: "strap";
  params: {
    /** What the level selects, e.g. "I2C address bit 0". */
    function: string;
    /** Interface ids on the same part whose use makes the pin a strap. */
    when?: string[];
    /** What each level selects, e.g. { low: "address 0x68", high: "address 0x69" }. */
    levels?: Record<string, string>;
    source?: string;
  };
}

/**
 * An LED, an LED package with several emitters, or an LED display:
 * what it emits and at what drive. `ledTrait()` and `Led()` in
 * src/protocols build it. Facts are per emitter (a die or a segment colour);
 * `anode` and `cathode` name the emitter's terminal interfaces where they
 * are pins of the part.
 */
export interface LedTrait extends TraitDef {
  type: "led";
  params: {
    kind:
      | "indicator"
      | "bicolor"
      | "rgb"
      | "rgbw"
      | "addressable"
      | "infrared"
      | "ultraviolet"
      | "high_power"
      | "seven_segment"
      | "matrix"
      | "bar_graph";
    emitters: LedEmitter[];
    /** Shared terminal on multi-emitter packages and displays. */
    common?: "anode" | "cathode" | "none";
    /** Integrated driver or controller (an addressable LED's protocol chip, e.g. "WS2812B"). */
    driver?: string;
    /** Full viewing angle (2θ½) in degrees. */
    viewing_angle_deg?: number;
    /** Displays: digits, segments per digit, rows and columns. */
    digits?: number;
    segments?: number;
    rows?: number;
    columns?: number;
    source?: string;
    assumption?: string;
  };
}

export interface LedEmitter {
  /** Colour name as the source gives it ("red", "warm white", "940 nm IR"). */
  color: string;
  /** Wavelength in nm; say which in `wavelength_kind`. */
  wavelength_nm?: number;
  wavelength_kind?: "peak" | "dominant";
  /** White LEDs: correlated colour temperature in K. */
  cct_k?: number;
  /** Forward voltage in V: typical, or [min, max], at `test_current_mA`. */
  forward_voltage_V?: number | [number, number];
  /** Current the electro-optical figures are stated at, in mA. */
  test_current_mA?: number;
  /** Absolute maximum continuous forward current in mA. */
  max_current_mA?: number;
  /** Luminous intensity in mcd (or radiant intensity in mW/sr for IR, say so in `color`), at `test_current_mA`. */
  luminous_intensity_mcd?: number | [number, number];
  /** Interface ids of this emitter's terminals on the part. */
  anode?: string;
  cathode?: string;
}

/**
 * A relay: an electromechanical, reed or solid-state switch whose
 * coil (or input) is isolated from its contacts (or output). `relayTrait()`
 * in src/protocols builds and checks it; `RelayCoil` and `RelayContacts`
 * declare the pins.
 */
export interface RelayTrait extends TraitDef {
  type: "relay";
  params: {
    kind: "electromechanical" | "reed" | "solid_state";
    /**
     * Contact form: poles then a letter, "1A" (SPST-NO), "1B" (SPST-NC),
     * "1C" (SPDT), "2A", "2C" (DPDT)... Solid-state relays are "1A" or "1B".
     */
    form: string;
    poles: number;
    throws: 1 | 2;
    latching?: "none" | "single_coil" | "dual_coil";
    /** Coil (electromechanical, reed) or input (solid state). */
    coil: {
      /** Rated (nominal) coil voltage in V, or an SSR's input range [min, max]. */
      voltage_V: number | [number, number];
      ac?: boolean;
      resistance_ohm?: number;
      current_mA?: number;
      power_mW?: number;
      /** Must-operate (pick-up) voltage in V, at most. */
      must_operate_V?: number;
      /** Must-release (drop-out) voltage in V, at least. */
      must_release_V?: number;
      /** Highest coil voltage allowed, in V. */
      max_V?: number;
      /** The coil has a polarity (a built-in diode, a latching coil). */
      polarized?: boolean;
    };
    /** Contact (or output) ratings. */
    contacts: {
      ratings: { voltage_V: number; current_A: number; current: "ac" | "dc"; load?: "resistive" | "inductive" | "motor" | "lamp"; note?: string }[];
      max_switching_voltage_V?: number;
      max_switching_current_A?: number;
      max_switching_power_W?: number;
      material?: string;
      /** SSR output: zero-cross switching. */
      zero_cross?: boolean;
    };
    operate_time_ms?: number;
    release_time_ms?: number;
    /** Coil-to-contact dielectric strength in V rms. */
    isolation_V?: number;
    /** Operations: mechanical and electrical (at a stated rating). */
    life?: { mechanical?: number; electrical?: number };
    source?: string;
    assumption?: string;
  };
}

/**
 * A storage device or memory: a memory chip, an eMMC, a memory
 * card, an SSD. `storageTrait()` in src/protocols builds and checks it. The
 * interfaces it is reached over are interfaces of the part (`SPI`, `I2C`,
 * `SDCard`, `M2`...); `interfaces` names them for search and review.
 */
export interface StorageTrait extends TraitDef {
  type: "storage";
  params: {
    medium:
      | "nor_flash"
      | "nand_flash"
      | "eeprom"
      | "fram"
      | "mram"
      | "sram"
      | "psram"
      | "dram"
      | "emmc"
      | "ufs"
      | "sd_card"
      | "ssd"
      | "hdd"
      | "usb_flash";
    /** User capacity in bytes (a 256 Kbit memory is 32768). */
    capacity_bytes: number;
    /** Loses its data without power. Set by the medium unless given. */
    volatile: boolean;
    /** Organisation as the source writes it ("32K × 8"). */
    organization?: string;
    interfaces: (
      | "spi"
      | "dual_spi"
      | "quad_spi"
      | "octal_spi"
      | "i2c"
      | "microwire"
      | "parallel"
      | "sdio"
      | "sd_spi"
      | "emmc"
      | "nvme"
      | "sata"
      | "usb"
      | "onfi"
    )[];
    /** "M.2 2280", "microSD", "2.5 inch". */
    form_factor?: string;
    removable?: boolean;
    /** Write endurance: per-cell cycles and/or terabytes written. */
    endurance?: { cycles?: number; tbw?: number };
    retention_years?: number;
    /** Sequential speeds in MB/s and speed classes ("U3", "V30", "A2"). */
    speed?: { read_MBps?: number; write_MBps?: number; classes?: string[] };
    source?: string;
    assumption?: string;
  };
}
