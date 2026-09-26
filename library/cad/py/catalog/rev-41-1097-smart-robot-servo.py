"""REV Robotics Smart Robot Servo (REV-41-1097): bind UHD interfaces to the vendor STEP (PB-796).

Source: https://www.revrobotics.com/content/cad/REV-41-1097.STEP, linked
("REV-41-1097 STEP File") from the REV product pages. No licence is stated on
the product page; REV's site-wide IP Policy allows non-commercial use per
CC BY-NC-SA 4.0 and requires a licence for commercial use, so the STEP stays
in .research/cad/ (not redistributed).

The STEP is one named assembly ("REV-41-1097") of five unnamed solids, so
features are selected by geometry:

  mount        the four open-ended mounting slots in the two flanges: R2.25
               ends (drawing), slot centres (±5, ±24.75) = a 10 x 49.5 mm
               rectangle (the drawing gives no hole spacing; the CAD does).
  flange_face  the underside of the two flanges (the face that rests on the
               mounting plate), z = 26.42 after the transform, facing -Z.
  spline       the 25T output spline (tooth tips Ø6.0 in the model; the
               drawing dimensions it Ø6.05) on the axis (0, 10.053).

Transform: rotated 180 deg about X so the case bottom is z = 0 and the
spline points +Z (the STEP has it pointing -Z). The spline tip is at
z = 43.55 (drawing 43.70 overall), the case top around the spline at 39.35.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import Location  # noqa: E402

from vendor_step import VendorStep, build as build_vendor, holes, planar, within_box  # noqa: E402

STEP = VendorStep(
    part_id="rev-41-1097-smart-robot-servo",
    step="REV-41-1097.STEP",
    name="REV-41-1097",
    url="https://www.revrobotics.com/content/cad/REV-41-1097.STEP",
    licence="not stated on the product page; REV IP Policy: non-commercial use per CC BY-NC-SA 4.0, commercial use needs a REV licence (not redistributed)",
    transform=Location((0, 0, 0), (180, 0, 0)),
    features={
        "mount": within_box(holes(4.5, tol=0.05), (-8, -28, 26), (8, 28, 30)),
        "flange_face": within_box(planar((0, 0, -1), extreme=None), (-10.2, -27.1, 26.3), (10.2, 27.1, 26.6)),
        "spline": within_box(holes(6.0, tol=0.03), (-4, 6, 39.5), (4, 14.2, 43.6)),
    },
    interfaces=["mount", "spline"],
    notes=[
        "Transform: rotated 180 deg about X; case bottom at z = 0, spline up (+Z).",
        "mount: 4 open slots, R2.25 ends at (±5, ±24.75): 10 x 49.5 mm rectangle; flanges z 26.42-29.25.",
        "spline: 25T, tooth tips Ø6.0 (drawing Ø6.05) on axis (0, 10.053), z 40.25-43.05; tip z 43.55.",
        "Body 20.15 x 40.1 mm, 54 mm over the flanges (drawing 20.06 x 39.80, 54).",
    ],
)


def build() -> None:
    build_vendor(STEP)


if __name__ == "__main__":
    build()
