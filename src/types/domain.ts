export type DomainKind =
  | "electrical"
  | "mechanical"
  | "pneumatic"
  | "hydraulic"
  | "thermal"
  | "software"
  | "network";

export interface PowerDomainDef {
  id: string;
  name?: string;
  nominal_voltage_V?: number;
  voltage_range_V?: [number, number];
  max_current_mA?: number;
  regulation_type?: "regulated" | "unregulated";
}

/**
 * What a part is made of, for mass from geometry (PB-797). Declared on the
 * mechanical domain of custom parts and of standard parts with no stated
 * mass; `systemMass` multiplies it by the CAD body volume. A stated
 * `weight_g` always wins over a computed one.
 */
export interface MaterialSpec {
  /** E.g. "3K woven carbon fibre / epoxy laminate", "A2 (304) stainless steel". */
  name: string;
  /** g/cm³. */
  density_g_cm3: number;
  /** URL stating the density. */
  source?: string;
  /**
   * What is assumed rather than stated: the material itself (when the part's
   * sources do not name it), the density row chosen, or that the CAD body is
   * nominal geometry rather than the real part.
   */
  assumption?: string;
}

/**
 * The package of a component as its manufacturer states it (PB-824). Declared
 * on the mechanical domain of chips and other board-mounted components, next
 * to `dimensions_mm`, which holds the package's overall length × width ×
 * height (leads included where they extend past the body, as on an SOIC).
 *
 * Only facts true of the part go here. Which footprint or land pattern a PCB
 * tool uses for this package is the tool's own choice and never part of UHD
 * (docs/boards-and-nets.md).
 */
export interface PackageSpec {
  /** Package name as the manufacturer prints it, e.g. "LGA-14", "VSON-14", "QFN-56". */
  name: string;
  /** Manufacturer package code or outline drawing, e.g. "DSJ (R-PVSON-N14)". */
  code?: string;
  /** Numbered terminals (pins, pads, balls, leads), not counting an exposed pad. */
  pin_count: number;
  /** Terminal pitch, where the source states one. */
  pitch_mm?: number;
  /** The package has an exposed (thermal or ground) pad on its underside. */
  exposed_pad: boolean;
  /**
   * Designator of the exposed pad's leaf interface: the manufacturer's number
   * when it gives one (57 on the RP2040), else the label the part uses ("EP").
   */
  exposed_pad_pin?: number | string;
  /** Exposed pad size, length × width. */
  exposed_pad_mm?: [number, number];
  /** URL (and section) stating the package facts. */
  source?: string;
  /** What is assumed rather than stated (a nominal height chosen from a range). */
  assumption?: string;
}

export interface DomainMetadata {
  domain: DomainKind;
  power_domains?: PowerDomainDef[];
  // Mechanical
  /** Overall length × width × height. For a component with a `package`, the package (leads included). */
  dimensions_mm?: { length?: number; width?: number; height?: number };
  weight_g?: number;
  /** Material of the whole body, for mass = CAD volume × density when no weight_g is stated. */
  material?: MaterialSpec;
  /** Component package (mechanical domain), e.g. a chip's LGA-14 or QFN-56. */
  package?: PackageSpec;
  // Thermal
  operating_temperature_C?: [number, number];
  // Extensible
  metadata?: Record<string, unknown>;
}
