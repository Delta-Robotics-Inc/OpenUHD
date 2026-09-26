"""REV Robotics Core Hex Motor (REV-41-1300): bind UHD interfaces to the vendor STEP (PB-796).

Source: https://www.revrobotics.com/content/cad/REV-41-1300.STEP, linked
("REV-41-1300 STEP File") from the REV product page. No licence is stated at the link (REV IP Policy:
non-commercial use per CC BY-NC-SA 4.0), so the STEP stays in .research/cad/ (not redistributed).

The STEP is one named solid body ("REV-41-1300") with no sub-components, so
features are selected by geometry. The output axis is the Z axis at the
origin; the two flat mounting faces are z = +16.25 and z = -18.25 (34.50 mm
apart, drawing), the motor extends toward -X.

  mount_a     the six Ø2.46 holes on a Ø16 mm circle around the output on the
              +Z face (at 0, 60, 120 ... deg), 10.8-16.25 deep.
  mount_b     the six Ø2.46 holes on the -Z face, clocked 30 deg from mount_a
              (at 30, 90, 150 ... deg). REV: "The combination of the Motion
              Pattern is clocked to different angles on each face".
  face_a      the +Z mounting face (z = 16.25), facing +Z.
  face_b      the -Z mounting face (z = -18.25), facing -Z.
  hex_bore    the six flats of the 5 mm female hex output (5.00 mm across
              flats in the model), through z -17.65 ... 16.35.
  output_hub  the Ø9 bores of the output hub on the same axis (records the
              axis for the shaft frame check; the hex flats are planar).
  rear_end    the motor end cap faces (x < -79) where the JST-VH power and
              JST-PH encoder connectors are; the STEP does not model or name
              the connectors separately.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build123d as bd  # noqa: E402

from vendor_step import VendorStep, build as build_vendor, holes, planar, within_box  # noqa: E402


def _all_faces(shape):
    return list(shape.faces())


def _side_flats(shape):
    return [f for f in shape.faces() if f.geom_type == bd.GeomType.PLANE and abs(f.normal_at().Z) < 0.05]


STEP = VendorStep(
    part_id="rev-41-1300-core-hex-motor",
    step="REV-41-1300.STEP",
    name="REV-41-1300",
    url="https://www.revrobotics.com/content/cad/REV-41-1300.STEP",
    licence="no licence at the STEP link; REV IP Policy: non-commercial use per CC BY-NC-SA 4.0, commercial use needs a licence (not redistributed)",
    features={
        "mount_a": within_box(holes(2.46, tol=0.03), (-9, -9, 10), (9, 9, 17)),
        "mount_b": within_box(holes(2.46, tol=0.03), (-9, -9, -18.5), (9, 9, -12)),
        "face_a": within_box(planar((0, 0, 1), extreme=None), (-90, -20, 16.2), (20, 21, 16.3)),
        "face_b": within_box(planar((0, 0, -1), extreme=None), (-90, -20, -18.3), (20, 21, -18.2)),
        "hex_bore": within_box(_side_flats, (-2.6, -2.6, -18), (2.6, 2.6, 17)),
        "output_hub": holes(9.0, tol=0.03),
        "rear_end": within_box(_all_faces, (-85, -17, -19), (-79, 21, 17)),
    },
    interfaces=["mount_a", "mount_b"],
    notes=[
        "No transform: output axis = Z axis at the origin; mounting faces z = +16.25 (face_a) and z = -18.25 (face_b).",
        "mount_a: 6 x Ø2.46 on a Ø16 circle at 0/60/120/180/240/300 deg; mount_b: 6 x Ø2.46 on Ø16 at 30/90/.../330 deg (drawing: Ø16, Ø2.46).",
        "hex_bore: 5 mm female hex through the output, flats 5.00 mm apart (2.50 mm from the axis).",
        "Body 34.50 x 36.47 mm (drawing); the output axis is 16.48 mm from the output-end edge (drawing).",
        "rear_end: motor end cap (x < -79) where the power and encoder connectors are; the connectors are not modelled separately.",
    ],
)


def build() -> None:
    build_vendor(STEP)


if __name__ == "__main__":
    build()
