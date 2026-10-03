import type { Parameter } from "../types/parameter.js";

/**
 * Canonical parameter builders.
 *
 * Every protocol builder emits parameters through these helpers so that
 * parameter IDs and units stay identical across all part definitions
 * ("voltage" is always volts, "clock_freq" is always Hz, etc.).
 * The matching/constraint engines key off these IDs.
 */

/** Fixed operating voltage, optionally with an allowed range. */
export function voltageV(value: number, range?: [number, number]): Parameter {
  return range
    ? { id: "voltage", unit: "V", value, range }
    : { id: "voltage", unit: "V", value };
}

/** Voltage specified only as a min/max range (no single nominal value). */
export function voltageRangeV(min: number, max: number, nominal?: number): Parameter {
  return nominal !== undefined
    ? { id: "voltage", unit: "V", value: nominal, range: [min, max] }
    : { id: "voltage", unit: "V", range: [min, max] };
}

/** Maximum continuous supply current in amps (power interfaces). */
export function maxCurrentA(value: number): Parameter {
  return { id: "max_current", unit: "A", value };
}

/** Per-pin drive/sink current in milliamps (signal pins). */
export function driveCurrentmA(value: number): Parameter {
  return { id: "drive_current", unit: "mA", value };
}

/** Bus clock frequency in Hz — a fixed value or a supported range. */
export function clockFreqHz(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "clock_freq", unit: "Hz", range: value }
    : { id: "clock_freq", unit: "Hz", value };
}

/** UART baud rate — a fixed value or a supported range. */
export function baudRate(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "baud_rate", unit: "Hz", range: value }
    : { id: "baud_rate", unit: "Hz", value };
}

/** Maximum signal frequency a pin supports, in Hz — fixed or [min, max]. */
export function maxFrequencyHz(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "max_frequency", unit: "Hz", range: value }
    : { id: "max_frequency", unit: "Hz", value };
}

/** Converter resolution in bits (ADC/DAC/PWM). */
export function resolutionBits(value: number): Parameter {
  return { id: "resolution", unit: "dimensionless", value };
}

/** Additional burst (peak) current in amps, with the rated duration noted on the part. */
export function burstCurrentA(value: number): Parameter {
  return { id: "burst_current", unit: "A", value };
}

/** Battery series cell count (e.g. 6 for 6S) — fixed, or [min, max] accepted by an input. */
export function cellCount(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "cell_count", unit: "dimensionless", range: value }
    : { id: "cell_count", unit: "dimensionless", value };
}

/** Battery capacity in milliamp-hours. */
export function capacitymAh(value: number): Parameter {
  return { id: "capacity", unit: "mAh", value };
}

/**
 * Hole-to-hole spacing of a bolt pattern in mm (square side, rectangle axis,
 * or bolt-circle diameter). A range models slotted holes that accept any
 * spacing within it.
 */
export function holeSpacingMm(value: number | [number, number], axis?: "y"): Parameter {
  const id = axis === "y" ? "hole_spacing_y" : "hole_spacing";
  return Array.isArray(value) ? { id, unit: "mm", range: value } : { id, unit: "mm", value };
}

/** Number of holes in a bolt pattern. */
export function holeCount(value: number): Parameter {
  return { id: "hole_count", unit: "dimensionless", value };
}

/** Nominal fastener diameter in mm (M3 → 3). */
export function fastenerDiameterMm(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "fastener_diameter", unit: "mm", range: value }
    : { id: "fastener_diameter", unit: "mm", value };
}

/** Shaft (or mating bore) diameter in mm. */
export function shaftDiameterMm(value: number): Parameter {
  return { id: "shaft_diameter", unit: "mm", value };
}

/** ESC command-signal bit rate in kbit/s (e.g. DShot150..DShot600 → [150, 600]). */
export function escSignalRateKbps(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "esc_signal_rate", unit: "kbit/s", range: value }
    : { id: "esc_signal_rate", unit: "kbit/s", value };
}

/** Typical current a load draws from its supply, in amps (capacity checks, not overlap). */
export function currentDrawA(value: number): Parameter {
  return { id: "current_draw", unit: "A", value };
}

/** Minimum supply power a load requires from its source, in watts (capacity checks). */
export function minSupplyPowerW(value: number): Parameter {
  return { id: "min_supply_power", unit: "W", value };
}

/** Servo command pulse width range in microseconds (e.g. [500, 2500]). */
export function pulseWidthUs(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "pulse_width", unit: "us", range: value }
    : { id: "pulse_width", unit: "us", value };
}

/** Servo command frame (refresh) rate in Hz: fixed, or [min, max] accepted. */
export function frameRateHz(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "frame_rate", unit: "Hz", range: value }
    : { id: "frame_rate", unit: "Hz", value };
}

/** Encoder counts (or pulses) per revolution, as the source states it. */
export function countsPerRev(value: number): Parameter {
  return { id: "counts_per_rev", unit: "dimensionless", value };
}

/** Bus bit rate in bit/s (CAN): fixed, or [min, max] supported. */
export function bitRateBps(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "bit_rate", unit: "bit/s", range: value }
    : { id: "bit_rate", unit: "bit/s", value };
}

/**
 * Fluid pressure in bar. A source states the pressure it delivers (value or
 * range); a port, fitting or consumer states the working range it is rated
 * for. The pair check requires the two to overlap.
 */
export function pressureBar(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "pressure", unit: "bar", range: value }
    : { id: "pressure", unit: "bar", value };
}

/** Tube outside diameter in mm (push-to-connect fittings and the tube they take). */
export function tubeOdMm(value: number): Parameter {
  return { id: "tube_od", unit: "mm", value };
}

/** Tube inside diameter in mm (hose barbs and the hose they take). */
export function tubeIdMm(value: number): Parameter {
  return { id: "tube_id", unit: "mm", value };
}

/**
 * The least continuous current a load needs its source to be rated for, in
 * amps: a supply rail, a power distribution channel or a motor controller
 * channel. Stated on an input; the pair check compares it with the source's
 * `max_current` (`supply_current_rating`).
 */
export function minSupplyCurrentA(value: number): Parameter {
  return { id: "min_supply_current", unit: "A", value };
}

/** Hole-to-hole pitch of a row of holes in mm (BoltPattern shape "row"). */
export function holePitchMm(value: number): Parameter {
  return { id: "hole_pitch", unit: "mm", value };
}

/** Usable length of a mounting slot in mm: fasteners sit anywhere along it (BoltPattern shape "slot"). */
export function slotLengthMm(value: number): Parameter {
  return { id: "slot_length", unit: "mm", value };
}

/** Width of a shaft key and of the keyway that takes it, in mm. */
export function keyWidthMm(value: number): Parameter {
  return { id: "key_width", unit: "mm", value };
}

/**
 * Linear travel in mm. An actuator's output states the stroke it gives; a
 * driven load may state the stroke it needs. A capacity: the pair check
 * requires the output's stroke to cover the load's (`linear_motion_capacity`).
 */
export function strokeMm(value: number): Parameter {
  return { id: "stroke", unit: "mm", value };
}

/** Travel per revolution of the input in mm (a screw's lead: pitch × starts). */
export function leadMm(value: number): Parameter {
  return { id: "lead", unit: "mm", value };
}

/** Thread pitch in mm (crest to crest), e.g. a lead screw and its nut. */
export function threadPitchMm(value: number): Parameter {
  return { id: "thread_pitch", unit: "mm", value };
}

/**
 * Axial force in newtons. An actuator's output states the force it is
 * rated for; a driven load may state the force it needs. A capacity, like
 * `stroke`.
 */
export function forceN(value: number): Parameter {
  return { id: "force", unit: "N", value };
}

/** Linear speed in mm/s: an actuator's rated speed (at its rated force, say which in a trait). */
export function linearSpeedMmS(value: number): Parameter {
  return { id: "linear_speed", unit: "mm/s", value };
}
