/**
 * Custom 5-inch quadcopter frame — the reference project's custom module.
 *
 * This is a design-intent module, not a purchased part: it exists as
 * requirements and mechanical interfaces before its CAD does (PB-781,
 * docs/specs/cad-uhd-integration.md). Every interface mirrors the mating
 * pattern of a selected part, cited by that part's own sources:
 *   - stack_mount: 30.5 x 30.5 mm M3 — dolphinrc-am32-60a-4in1-esc / dolphinrc-f405-v3-flight-controller
 *   - motor_mount_*: the MEPS NEON 2207 V2 base pattern — meps-neon-2207-v2-1950kv
 *   - camera_mount: DJI O4 camera lens-mount side holes — dji-o4-air-unit
 *   - vtx_mount: DJI O4 transmission module 25.5 x 25.5 mm M2 — dji-o4-air-unit
 * Sources: the mating parts' sources.json files; see
 * library/systems/quadcopter-5in/README.md for the brief.
 *
 * The frame has no CAD, material, or mass yet; those are data gaps until the
 * frame CAD workflow (PB-774) produces a source artifact.
 */
import type { ModuleDef } from "../../../src/types/index.js";
import { BoltPattern, defineModule } from "../../../src/protocols/index.js";

const motorMount = (corner: string, label: string) =>
  BoltPattern({
    id: `motor_mount_${corner}`,
    name: `${label} motor mount`,
    role: "structure",
    shape: "circle",
    spacingMm: 16,
    holeCount: 4,
    fastener: "M3",
    fastenerDiameterMm: 3,
    threaded: false,
    note: "Through holes on the arm tip on a 16 mm bolt circle (opposite holes 16 mm apart, adjacent 11.31 mm — the FPV '16x16' pattern). M3 screws thread into the motor base. Mirrors meps-neon-2207-v2-1950kv base_mount.",
  });

export const QUADCOPTER_5IN_FRAME: ModuleDef = defineModule({
  id: "quadcopter-5in-frame",
  name: "5-inch quadcopter frame (custom)",
  version: "0.1.0",
  manufacturer: "Delta Robotics (custom)",
  part_number: "QUAD5-FRAME",
  description:
    "Custom true-X 5-inch frame for the reference quadcopter: 30.5 mm stack mount, four motor mounts, DJI O4 camera and transmission-module mounts, battery strap slots.",
  tags: ["frame", "custom", "quadcopter", "5-inch"],
  categories: ["structure"],
  display: { icon: "hexagon" },

  interfaces: [
    BoltPattern({
      id: "stack_mount",
      name: "Stack mount",
      role: "structure",
      shape: "square",
      spacingMm: 30.5,
      holeCount: 4,
      fastener: "M3",
      fastenerDiameterMm: 3,
      threaded: false,
      note: "M3 standoffs through the bottom plate carry the ESC then the FC (30.5 x 30.5 mm).",
    }),
    motorMount("fl", "Front-left"),
    motorMount("fr", "Front-right"),
    motorMount("rl", "Rear-left"),
    motorMount("rr", "Rear-right"),
    BoltPattern({
      id: "camera_mount",
      name: "Camera side plates",
      role: "structure",
      shape: "rectangle",
      spacingMm: 16,
      spacingYmm: 14,
      holeCount: 4,
      fastener: "M2",
      fastenerDiameterMm: 2,
      note: "Side plates for the 14 mm-wide DJI O4 camera; mirrors dji-o4-air-unit camera_mount.",
    }),
    BoltPattern({
      id: "vtx_mount",
      name: "Transmission module mount",
      role: "structure",
      shape: "square",
      spacingMm: 25.5,
      holeCount: 4,
      fastener: "M2",
      fastenerDiameterMm: 2,
      note: "Rear top-plate holes for the DJI O4 transmission module (25.5 x 25.5 mm, M2); mirrors dji-o4-air-unit tx_module_mount.",
    }),
  ],

  requirements: [
    { type: "capability", description: "Clear 5.1 in (130 mm) propellers on a true-X layout with at least 5 mm prop-to-prop clearance." },
    { type: "capability", description: "Carry a 75 x 39.5 x 35 mm, 211 g 6S 1100 mAh pack on a top-mounted strap." },
    { type: "capability", description: "Protect the DJI O4 camera between side plates and provide airflow to the transmission module (DJI cooling requirement)." },
    { type: "capability", description: "Keep the GNSS/compass module at least 10 cm from power wiring, ESCs and motors (Matek M10Q-5883 guidance)." },
  ],

  domains: [
    {
      domain: "mechanical",
      metadata: {
        layout: "true-X, 5-inch",
        status: "design intent — no CAD artifact yet",
      },
    },
  ],

  traits: [
    {
      type: "data_gap",
      params: {
        fields: ["wheelbase", "material", "plate thickness", "mass", "CAD artifact"],
        note: "Filled in when the frame CAD workflow (PB-774) produces a source artifact.",
      },
    },
  ],

  artifacts: [],
});
