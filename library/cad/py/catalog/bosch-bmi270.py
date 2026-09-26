"""Bosch BMI270 (LGA-14, 2.5 x 3.0 x 0.83 mm): representative package geometry.

No manufacturer CAD: the Bosch product page lists no 3D model; Digi-Key and
SnapEDA returned 403 to the fetch and Ultra Librarian needs a login
(see library/parts/bosch-bmi270/.research/gaps.json).

Every dimension is from datasheet BST-BMI270-DS000-08 rev 1.6, section 8.1
(package outline) and section 7.1 (pin-out):
  D = 3.00 (x), E = 2.50 (y), A = 0.83 (height)
  pads: side columns 4 x 0.475 (x) x 0.25 (y), pitch 0.5 (ZE 0.50 BSC);
        top/bottom rows 3 x 0.25 (x) x 0.475 (y), pitch e = 0.5 (D1 1.00 BSC);
        L1 = 0.10 nominal pad-to-edge distance (4xL1, 3xL1).
Pin placement (top view, pin 1 top-left, x along D): left column 1-4
top to bottom, bottom row 5-7 left to right, right column 8-11 bottom to
top, top row 12-14 right to left.

Coordinates: package centred on the origin, seating plane (pad face) at
z = 0, top at z = 0.83, x along D (3.0 mm), y along E (2.5 mm), pin 1 at -x/+y.
Pads are drawn 0.02 mm thick inside the body so their faces lie on the
seating plane (assumption: pad thickness is not dimensioned).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import Axis, Box, BuildPart, Locations, Pos  # noqa: E402

from partkit import MIN, GeneratedPart  # noqa: E402

D, E, A = 3.00, 2.50, 0.83
PAD_L, PAD_W, L1, PITCH = 0.475, 0.25, 0.10, 0.5
PAD_T = 0.02  # assumption: drawing gives no pad thickness

XS = D / 2 - L1 - PAD_L / 2  # side-column pad centre x (1.1625)
YR = E / 2 - L1 - PAD_L / 2  # top/bottom-row pad centre y (0.9125)

# pin -> (x, y, long axis along x?)
PINS = {
    1: (-XS, 0.75, True), 2: (-XS, 0.25, True), 3: (-XS, -0.25, True), 4: (-XS, -0.75, True),
    5: (-0.5, -YR, False), 6: (0.0, -YR, False), 7: (0.5, -YR, False),
    8: (XS, -0.75, True), 9: (XS, -0.25, True), 10: (XS, 0.25, True), 11: (XS, 0.75, True),
    12: (0.5, YR, False), 13: (0.0, YR, False), 14: (-0.5, YR, False),
}


def build() -> None:
    a = GeneratedPart("bosch-bmi270", "bosch-bmi270-lga14", __file__)
    with BuildPart() as body:
        Box(D, E, A, align=MIN)
    with BuildPart() as pads:
        for x, y, horiz in PINS.values():
            with Locations(Pos(x, y, 0)):
                Box(PAD_L if horiz else PAD_W, PAD_W if horiz else PAD_L, PAD_T, align=MIN)
    a.body(body.part, "package")
    a.body(pads.part, "pads")
    # pcb_mount (land pads): the 14 pad faces on the seating plane (normal -z)
    a.feature("pcb_mount", pads.part.faces().filter_by(Axis.Z).sort_by(Axis.Z)[:14])
    a.write()


if __name__ == "__main__":
    build()
