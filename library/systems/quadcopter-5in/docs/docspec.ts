/**
 * Documentation spec for the 5-inch quadcopter (skills/uhd-tech-docs).
 *
 * Presentation only: which model values are "key", the order of assembly
 * steps, cameras and notes. Every value is a query into the model
 * (scripts/docs/lib/values.ts); nothing here is a number the documents print,
 * except the battery placement hint, which comes from the frame module's own
 * BATTERY_PAD constant (the pack is strapped, so no mate can place it).
 *
 *   npx tsx scripts/docs/build.ts library/systems/quadcopter-5in
 */
import type { DocConfig } from "../../../../scripts/docs/lib/types.js";
import { BATTERY_PAD } from "../frame.js";

const F405 = "dolphinrc-f405-v3-flight-controller";
const ESC = "dolphinrc-am32-60a-4in1-esc";
const MOTOR = "meps-neon-2207-v2-1950kv";
const PROP = "hqprop-ethix-s5";
const BAT = "cnhl-black-series-1100mah-6s-100c";
const O4 = "dji-o4-air-unit";
const RX = "radiomaster-rp1-v2-elrs-2g4";
const GNSS = "matek-m9n-5883";
const FRAME = "quadcopter-5in-frame";

const p = (mod: string, iface: string, param: string) => `def:${mod}:interfaces[id=${iface}].parameters[id=${param}].value`;
const perf = (mod: string, key: string) => `def:${mod}:traits[type=performance].params.${key}`;
const mech = (mod: string, key: string) => `def:${mod}:domains[domain=mechanical].${key}`;

const config: DocConfig = {
  title: "5-inch 6S Quadcopter",
  subtitle: "Reference system",
  docId: "UHD-QUAD5",
  revision: "A",
  root: ["frame"],
  camera: { dir: [1, -1.18, 0.82] },
  placementHints: [
    {
      path: ["battery"],
      // pack's long side (its Y) onto the frame's X, seated on the top plate at BATTERY_PAD
      matrix: [0, -1, 0, BATTERY_PAD.origin[0], 1, 0, 0, BATTERY_PAD.origin[1], 0, 0, 1, BATTERY_PAD.origin[2], 0, 0, 0, 1],
      note: "frame BATTERY_PAD (strapped, no mechanical interface)",
    },
  ],

  datasheet: {
    keyFigures: [
      { label: "Static thrust", q: "derived:propulsion.thrust_full_total", f: "si|d1", sub: "4 motors, full throttle, maker's test prop" },
      { label: "Battery", q: p(BAT, "battery_out", "voltage"), f: "d1", sub: "6S LiPo" },
      { label: "Capacity", q: p(BAT, "battery_out", "capacity"), sub: "XT60" },
      { label: "Peak current", q: "sys:checks.diagnostics[rule=propulsion_current].details.totalPeak", f: "u=A|d1", sub: "4 × motor 60 s peak" },
      { label: "Stated mass", q: "derived:mass.known_total", f: "d0", sub: "parts with a weight in the model" },
      { label: "Video latency", q: perf(O4, "lowest_latency_ms.goggles_3"), f: "u=ms", sub: "DJI O4, Goggles 3" },
    ],
    specGroups: [
      {
        title: "Airframe",
        rows: [
          { label: "Layout", q: mech(FRAME, "metadata.layout") },
          { label: "Wheelbase", q: mech(FRAME, "metadata.wheelbase_mm") },
          { label: "Bottom plate", q: mech(FRAME, "metadata.plate_thickness_mm") },
          { label: "Standoff height", q: mech(FRAME, "metadata.standoff_height_mm") },
          { label: "Stack pattern", q: p(FRAME, "stack_mount", "hole_spacing"), sub: "square, M3" },
          { label: "Motor pattern", q: p(FRAME, "motor_mount_fl", "hole_spacing"), sub: "bolt circle, M3" },
        ],
      },
      {
        title: "Propulsion",
        rows: [
          { label: "Motor", q: `def:${MOTOR}:name` },
          { label: "KV", q: perf(MOTOR, "kv_rpm_per_V"), f: "u=rpm/V" },
          { label: "Stator / poles", q: perf(MOTOR, "configuration") },
          { label: "Peak current (60 s)", q: perf(MOTOR, "peak_current_A") },
          { label: "Max power", q: perf(MOTOR, "max_power_W") },
          { label: "Motor mass", q: mech(MOTOR, "weight_g") },
          { label: "Propeller", q: `def:${PROP}:name` },
          { label: "Prop mass", q: mech(PROP, "weight_g") },
          { label: "ESC per channel", q: p(ESC, "motor_1", "max_current"), sub: "continuous" },
          { label: "ESC burst", q: p(ESC, "motor_1", "burst_current") },
          { label: "ESC firmware", q: perf(ESC, "firmware") },
        ],
      },
      {
        title: "Power",
        rows: [
          { label: "Battery", q: `def:${BAT}:name` },
          { label: "Nominal voltage", q: p(BAT, "battery_out", "voltage"), f: "d1" },
          { label: "Capacity", q: p(BAT, "battery_out", "capacity") },
          { label: "Energy", q: "derived:power.battery_energy_Wh", f: "d2" },
          { label: "Continuous current", q: p(BAT, "battery_out", "max_current") },
          { label: "Burst current", q: p(BAT, "battery_out", "burst_current") },
          { label: "Pack mass", q: mech(BAT, "weight_g") },
          { label: "ESC input", q: p(ESC, "bat_in", "voltage") },
          { label: "BEC 5 V rating", q: p(F405, "bec_5v", "max_current") },
          { label: "BEC 10 V rating", q: p(F405, "bec_10v", "max_current") },
          { label: "GPS rail", q: p(F405, "rail_4v5", "voltage"), f: "d1" },
        ],
      },
      {
        title: "Flight control",
        rows: [
          { label: "Flight controller", q: `def:${F405}:name` },
          { label: "MCU", q: perf(F405, "mcu") },
          { label: "IMU", q: perf(F405, "imu") },
          { label: "Firmware target", q: perf(F405, "firmware_target") },
          { label: "UARTs", q: perf(F405, "uarts") },
          { label: "Receiver", q: `def:${RX}:name` },
          { label: "RC link", q: perf(RX, "protocol") },
          { label: "CRSF baud rate", q: p(RX, "crsf", "baud_rate"), f: "u=Bd" },
        ],
      },
      {
        title: "Video",
        rows: [
          { label: "Air unit", q: `def:${O4}:name` },
          { label: "Image sensor", q: perf(O4, "image_sensor") },
          { label: "Field of view", q: perf(O4, "fov_deg"), f: "u=deg" },
          { label: "Max bitrate", q: perf(O4, "max_bitrate_Mbps"), f: "u=Mbit/s" },
          { label: "Supply range", q: p(O4, "vcc", "voltage"), f: "d1" },
          { label: "Operating temperature", q: `def:${O4}:traits[type=operating_conditions].params.operating_temperature_C` },
        ],
      },
      {
        title: "Navigation",
        rows: [
          { label: "GNSS module", q: `def:${GNSS}:name` },
          { label: "Receiver", q: perf(GNSS, "receiver") },
          { label: "Compass address", q: p(GNSS, "i2c_compass", "i2c_address"), f: "hex" },
          { label: "Supply current", q: `def:${GNSS}:traits[type=operating_conditions].params.supply_current_mA` },
        ],
      },
    ],
    mechanicalCallouts: [
      "frame.stack_mount",
      "frame.motor_mount_fr",
      "frame.vtx_mount",
      "frame.camera_mount",
      "frame.standoff_mount",
      "top_plate.gps_mount",
    ],
    hub: "stack/fc",
  },

  assembly: {
    explode: 16,
    steps: [
      {
        id: "motors",
        title: "Mount the motors",
        mates: ["arm_*_mount"],
        camera: { dir: [1, -1.3, 0.42] },
        notes: [{ kind: "tip", text: "Point each motor's leads back along its arm toward the stack; the rotation on the pad is set by the mate." }],
      },
      {
        id: "stack",
        title: "Build the FC and ESC stack",
        mates: ["stack_mount", "fc_mount"],
        wiring: ["stack/*"],
        explode: 13,
        camera: { dir: [1, -1.2, 0.55] },
      },
      {
        id: "motor-wiring",
        title: "Solder the motor leads",
        wiring: ["m*_phases"],
        figure: "wiring",
        notes: [{ kind: "tip", text: "Any two leads of a motor may be swapped to reverse it; set direction in the ESC configurator rather than by re-soldering." }],
      },
      {
        id: "power",
        title: "Solder the battery lead and capacitor",
        wiring: ["battery_*", "bulk_cap_*"],
        figure: "wiring",
        notes: [{ kind: "caution", text: "Observe polarity on the capacitor and the XT60 lead before the first power-up." }],
      },
      {
        id: "air-unit",
        title: "Install the air unit and camera",
        mates: ["vtx_mount", "camera_mount"],
        explode: 12,
        camera: { dir: [1.2, -1.1, 0.6] },
      },
      {
        id: "video-wiring",
        title: "Connect the air unit",
        wiring: ["video_*"],
        figure: "wiring",
      },
      {
        id: "receiver",
        title: "Connect the receiver",
        wiring: ["rx_*"],
        figure: "wiring",
      },
      {
        id: "top-plate",
        title: "Fit the top plate",
        mates: ["top_plate_mount"],
        explode: 14,
      },
      {
        id: "gnss",
        title: "Mount and connect the GNSS",
        mates: ["gps_mount"],
        wiring: ["gnss_*"],
        explode: 10,
        camera: { dir: [0.9, -1.3, 1.0] },
      },
      {
        id: "battery",
        title: "Strap on the battery",
        place: ["battery", "strap"],
        explode: 24,
        notes: [{ kind: "caution", text: "Fit and connect the battery only for flight; remove the props for any bench work." }],
      },
      {
        id: "props",
        title: "Fit the propellers",
        mates: ["arm_*/prop_on_shaft"],
        explode: 24,
        notes: [
          { kind: "warning", text: "Fit propellers last, after configuration and a motor-direction check with the props off." },
          {
            kind: "caution",
            text: "A pack holds {{def:hqprop-ethix-s5:traits[type=performance].params.pack_split.cw}} CW and {{def:hqprop-ethix-s5:traits[type=performance].params.pack_split.ccw}} CCW props. The model does not say which motor spins which way: match each prop to the motor direction set in the flight controller.",
          },
        ],
      },
    ],
  },
  testData: { standins: "multirotor" },
};

export default config;
