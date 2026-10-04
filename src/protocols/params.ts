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

/** Hole-to-hole pitch of a row of holes in mm (BoltPattern shape "row"; a grid's pitch along x, or with axis "y" along y). */
export function holePitchMm(value: number, axis?: "y"): Parameter {
  return { id: axis === "y" ? "hole_pitch_y" : "hole_pitch", unit: "mm", value };
}

/** Angle between neighbouring holes of a partial bolt circle in degrees (BoltPattern shape "arc"). */
export function angularPitchDeg(value: number): Parameter {
  return { id: "angular_pitch", unit: "deg", value };
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

// ---------------------------------------------------------------------------
// Links and buses (PB-866): PCIe, M.2, MIPI, Ethernet, audio, cameras, radios
// ---------------------------------------------------------------------------

/**
 * Lane counts a link can run at, as [min, max] (a single number is one
 * count). PCIe trains down to any width, so a PCIe port states [1, lanes];
 * a MIPI receiver states [1, lanes]; a MIPI transmitter states the counts
 * its modes use. The pair check requires the two to overlap.
 */
export function laneCount(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "lane_count", unit: "dimensionless", range: value }
    : { id: "lane_count", unit: "dimensionless", value };
}

/** PCIe generations a port supports, [1, highest]: links train to the highest both support. */
export function pcieGeneration(highest: number): Parameter {
  return { id: "pcie_generation", unit: "dimensionless", range: [1, highest] };
}

/**
 * Data rate per lane in Mbit/s (MIPI D-PHY, C-PHY symbol rate × 2.28):
 * the highest the port supports, or [min, max]. Checked by `checkPairLinks`
 * (`lane_rate`), not by overlap: a transmitter faster than the receiver
 * still works in its slower modes.
 */
export function laneRateMbps(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "lane_rate", unit: "Mbit/s", range: value }
    : { id: "lane_rate", unit: "Mbit/s", value };
}

/**
 * Link speeds in Mbit/s (Ethernet, SFP), as [slowest, fastest] of the
 * speeds the port supports. The exact list is on the port's trait
 * (`speeds_mbps`); `checkPairLinks` compares the lists (`ethernet_speed`).
 */
export function linkSpeedMbps(speeds: number[]): Parameter {
  const s = [...speeds].sort((a, b) => a - b);
  return s.length === 1 ? { id: "link_speed", unit: "Mbit/s", value: s[0] } : { id: "link_speed", unit: "Mbit/s", range: [s[0], s[s.length - 1]] };
}

/**
 * Power over Ethernet in watts: on a PSE port, the power it delivers per
 * port; on a powered device, the most it draws at its input. Checked by
 * `checkPairLinks` (`poe_power`).
 */
export function poePowerW(value: number): Parameter {
  return { id: "poe_power", unit: "W", value };
}

/** Audio sample rate in Hz: fixed, or [min, max] supported. */
export function sampleRateHz(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "sample_rate", unit: "Hz", range: value }
    : { id: "sample_rate", unit: "Hz", value };
}

/** Audio sample word length in bits: fixed, or [min, max] supported. */
export function bitDepth(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "bit_depth", unit: "dimensionless", range: value }
    : { id: "bit_depth", unit: "dimensionless", value };
}

/** Audio channels (slots per frame on TDM): fixed, or [min, max] supported. */
export function channelCount(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "channel_count", unit: "dimensionless", range: value }
    : { id: "channel_count", unit: "dimensionless", value };
}

/**
 * Width of a parallel data bus in bits (a DVP camera port). Checked by
 * `checkPairLinks` (`dvp_width`), not by overlap: a narrower host takes a
 * wider camera's upper bits.
 */
export function busWidthBits(value: number): Parameter {
  return { id: "bus_width", unit: "dimensionless", value };
}

/**
 * Radio frequency band in MHz, [low, high] (e.g. 2400–2483.5 for the 2.4 GHz
 * ISM band), for `rf` interfaces: an antenna and the radio port it serves
 * must overlap. Wireless interfaces state their bands in the `wireless`
 * trait instead (`WIRELESS_BANDS`).
 */
export function rfBandMHz(low: number, high: number): Parameter {
  return { id: "rf_band", unit: "MHz", range: [low, high] };
}

/** Optical wavelength in nm (fibre transceivers). */
export function wavelengthNm(value: number): Parameter {
  return { id: "wavelength", unit: "nm", value };
}

/**
 * Current through an LED in mA: on an LED, [0, its maximum continuous
 * forward current]; on an LED driver channel, the current it can be set to
 * ([min, max]) or the one it gives. The pair check requires the two to
 * overlap; `checkPairLinks` warns when a driver can be set above the LED's
 * maximum (`led_drive_current`).
 */
export function ledCurrentmA(value: number | [number, number]): Parameter {
  return Array.isArray(value)
    ? { id: "led_current", unit: "mA", range: value }
    : { id: "led_current", unit: "mA", value };
}

// ---------------------------------------------------------------------------
// Drive train, bearings, fasteners and wheels (PB-866, mechanical round)
// ---------------------------------------------------------------------------

/**
 * Gear module in mm (pitch diameter ÷ tooth count). A diametral pitch P
 * (teeth per inch of pitch diameter) is module 25.4 / P. Two gears mesh only
 * with the same module and pressure angle (`gear_mesh`).
 */
export function gearModuleMm(value: number): Parameter {
  return { id: "gear_module", unit: "mm", value };
}

/** Gear pressure angle in degrees (20° is the common standard; 14.5° older inch gears). */
export function pressureAngleDeg(value: number): Parameter {
  return { id: "pressure_angle", unit: "deg", value };
}

/** Number of teeth on a gear, or on the length of a rack. Not compared between two gears. */
export function toothCount(value: number): Parameter {
  return { id: "tooth_count", unit: "dimensionless", value };
}

/** Face width of gear teeth in mm (axial length of the teeth). Not compared: the engaged width is the narrower. */
export function faceWidthMm(value: number): Parameter {
  return { id: "face_width", unit: "mm", value };
}

/** Outside diameter of a bearing (or bushing), and the bore of the seat that holds it, in mm. */
export function bearingOdMm(value: number | [number, number]): Parameter {
  return Array.isArray(value) ? { id: "bearing_od", unit: "mm", range: value } : { id: "bearing_od", unit: "mm", value };
}

/** Bore of a bearing in mm (the shaft it takes). The bore itself is a `Shaft` bore; this is the bearing's nominal size. */
export function bearingBoreMm(value: number): Parameter {
  return { id: "bearing_bore", unit: "mm", value };
}

/** Width of a bearing in mm (its outer ring, or a plain bearing's length). */
export function bearingWidthMm(value: number): Parameter {
  return { id: "bearing_width", unit: "mm", value };
}

/** Depth of a bearing seat (the counterbore that holds a bearing) in mm. */
export function seatDepthMm(value: number): Parameter {
  return { id: "seat_depth", unit: "mm", value };
}

/** Length of thread in mm: a screw's threaded length, a tapped hole's or insert's thread depth, a nut's height. */
export function threadLengthMm(value: number): Parameter {
  return { id: "thread_length", unit: "mm", value };
}

/** Width of a T-slot's opening (the gap the fastener's neck passes through) in mm. */
export function slotOpeningMm(value: number): Parameter {
  return { id: "slot_opening", unit: "mm", value };
}

/** Wheel outside diameter in mm. */
export function wheelDiameterMm(value: number): Parameter {
  return { id: "wheel_diameter", unit: "mm", value };
}

/** Tread (contact) width of a wheel in mm. */
export function treadWidthMm(value: number): Parameter {
  return { id: "tread_width", unit: "mm", value };
}

/** Rated load in N: a wheel's or bearing's load rating (a capacity: not range-compared). */
export function loadRatingN(value: number): Parameter {
  return { id: "load_rating", unit: "N", value };
}

/** Outside diameter of an annular contact face in mm (a spacer's or collar's end face). */
export function faceOdMm(value: number): Parameter {
  return { id: "face_od", unit: "mm", value };
}

/** Inside diameter of an annular contact face in mm (its bore). */
export function faceIdMm(value: number): Parameter {
  return { id: "face_id", unit: "mm", value };
}

/** Axial length in mm (a spacer's or collar's length along the shaft). */
export function axialLengthMm(value: number): Parameter {
  return { id: "axial_length", unit: "mm", value };
}

/** AC line frequency in Hz: fixed (60) or [min, max] ([47, 63]). */
export function lineFrequencyHz(value: number | [number, number]): Parameter {
  return Array.isArray(value) ? { id: "line_frequency", unit: "Hz", range: value } : { id: "line_frequency", unit: "Hz", value };
}

/** IR carrier (modulation) frequency in kHz, e.g. 38. Compared by `ir_carrier`, not by overlap. */
export function irCarrierKHz(value: number | [number, number]): Parameter {
  return Array.isArray(value) ? { id: "ir_carrier", unit: "kHz", range: value } : { id: "ir_carrier", unit: "kHz", value };
}

/** Coil current in A at the rated voltage (a solenoid, valve or brake coil). A draw: compared with the driver's rating by `inductive_load`. */
export function coilCurrentA(value: number): Parameter {
  return { id: "coil_current", unit: "A", value };
}

/** Coil resistance in Ω. */
export function coilResistanceOhm(value: number): Parameter {
  return { id: "coil_resistance", unit: "Ω", value };
}
