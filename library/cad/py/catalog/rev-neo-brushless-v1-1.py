"""REV Robotics NEO Brushless Motor V1.1 (REV-21-1650): bind UHD interfaces to vendor CAD.

Manufacturer STEP from the product page ("REV-21-1650-V1.1 STEP File",
https://revrobotics.com/content/cad/REV-21-1650-V1.1.STEP), downloaded into
library/parts/rev-neo-brushless-v1-1/.research/cad/ and not committed (REV
states no redistribution licence).

The STEP is one solid labelled "REV-21-1650_V1_1". It is already placed
sensibly, so no transform: the front (mounting) face is at z = 0, the 8 mm
keyed shaft points +Z (pilot to z = 3.5, shaft tip z = 35), the can runs back
to z = -58.35. Front-face holes: seven tapped #10-32 (modelled Φ4.04, 5 mm
deep) on a 50.8 mm bolt circle at 0, 45, 90, 180, 225, 270 and 315 deg; the
135 deg position is where the phase leads and sensor cable leave the can.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vendor_step import VendorStep, build as build_vendor, holes, planar, within_box


def in_box(lo, hi):
    """Every face whose bounding-box centre lies inside lo..hi (mm)."""

    def sel(shape):
        out = []
        for f in shape.faces():
            c = f.bounding_box().center()
            if all(lo[i] <= (c.X, c.Y, c.Z)[i] <= hi[i] for i in range(3)):
                out.append(f)
        return out

    return sel


STEP = VendorStep(
    part_id="rev-neo-brushless-v1-1",
    step="REV-21-1650-V1.1.STEP",
    name="REV-21-1650-V1.1",
    url="https://revrobotics.com/content/cad/REV-21-1650-V1.1.STEP",
    licence="not stated by REV Robotics (not redistributed)",
    features={
        # the seven tapped #10-32 front-face holes (50.8 mm bolt circle)
        "face_holes": within_box(holes(4.04, tol=0.05), (-30, -30, -6), (30, 30, 0.5)),
        # 8 mm keyed output shaft (outer cylinder, pilot top z = 3.5 to tip)
        "shaft": within_box(holes(8.0, tol=0.05), (-5, -5, 3), (5, 5, 35.5)),
        # 19.05 mm (0.75 in) output pilot
        "pilot": holes(19.05, tol=0.05),
        # the front (mounting) face at z = 0
        "front_face": within_box(planar((0, 0, 1), min_area=2000, extreme=None), (-31, -31, -0.1), (31, 31, 0.1)),
        # stubs of the phase leads and sensor cable where they leave the can (135 deg)
        "leads": in_box((-40, 17, -9), (-26, 39, -1)),
    },
    interfaces=["face_holes", "shaft", "leads"],
    notes=[
        "No transform: front (mounting) face at z = 0, shaft axis +Z through the origin.",
        "face_holes: 7 x Φ4.04 (tapped #10-32 minor diameter as modelled, 5 mm deep) on a 50.8 mm circle at 0/45/90/180/225/270/315 deg; none at 135 deg, where the leads exit.",
        "shaft: Φ8.0 from z = 3.5 to 34.5 (+0.5 chamfer), 2 mm keyway; tapped #10-32 hole in the shaft end (Φ4.04, z 19.9-35).",
        "pilot: Φ19.05 x 3.5 mm. Rear tapped #10-32 hole at z = -58.25 (pinion-pressing support).",
        "leads: the STEP cuts the phase leads and sensor cable just outside the can (x -38 .. -27, y 18 .. 38).",
    ],
)


def build() -> None:
    build_vendor(STEP)


if __name__ == "__main__":
    build()
