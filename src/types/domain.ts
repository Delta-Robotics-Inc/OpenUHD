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

export interface DomainMetadata {
  domain: DomainKind;
  power_domains?: PowerDomainDef[];
  // Mechanical
  dimensions_mm?: { length?: number; width?: number; height?: number };
  weight_g?: number;
  /** Material of the whole body, for mass = CAD volume × density when no weight_g is stated. */
  material?: MaterialSpec;
  // Thermal
  operating_temperature_C?: [number, number];
  // Extensible
  metadata?: Record<string, unknown>;
}
