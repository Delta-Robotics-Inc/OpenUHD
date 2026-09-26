"""ST LSM6DS3TR-C (LGA-14L, 2.5 x 3 x 0.83 mm typ.): representative package geometry.

No manufacturer CAD: st.com refused every fetch (HTTP/2 stream error or
timeout), so its CAD resources could not be reached; Digi-Key/SnapEDA return
403 and Ultra Librarian needs a login (see .research/gaps.json).

Dimensions from datasheet DocID030071 Rev 3, Figure 17 (p.111) and Figure 1
(p.18):
  W = 3.00 (x), L = 2.50 (y), height 0.83 typ (cover page) / 0.86 max (Fig. 17)
  14 pads 0.475 x 0.25 (+-0.05); pitch 0.5; side pads 0.1 from the edge
  (4x (0.1)); side columns at y = +-0.75 / +-0.25 (1.5 span); top/bottom rows
  at x = -0.5, 0, +0.5 (1.0 span).
The 0.1 mm edge distance is only dimensioned for the side pads; the same
value is used for the top/bottom rows (assumption).
Pin placement (top view = bottom view mirrored, pin 1 top-left): left
column 1-4 top to bottom, bottom row 5-7 left to right, right column 8-11
bottom to top, top row 12-14 right to left.

Coordinates: package centred, seating plane z = 0, x along W (3.0 mm),
pin 1 at -x/+y. Pads drawn 0.02 mm thick (assumption).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import Axis, Box, BuildPart, Locations, Pos  # noqa: E402

from partkit import MIN, GeneratedPart  # noqa: E402

W, L, H = 3.00, 2.50, 0.83
PAD_L, PAD_W, EDGE = 0.475, 0.25, 0.1
PAD_T = 0.02

XS = W / 2 - EDGE - PAD_L / 2
YR = L / 2 - EDGE - PAD_L / 2

PINS = {
    1: (-XS, 0.75, True), 2: (-XS, 0.25, True), 3: (-XS, -0.25, True), 4: (-XS, -0.75, True),
    5: (-0.5, -YR, False), 6: (0.0, -YR, False), 7: (0.5, -YR, False),
    8: (XS, -0.75, True), 9: (XS, -0.25, True), 10: (XS, 0.25, True), 11: (XS, 0.75, True),
    12: (0.5, YR, False), 13: (0.0, YR, False), 14: (-0.5, YR, False),
}


def build() -> None:
    a = GeneratedPart("st-lsm6ds3tr-c", "st-lsm6ds3tr-c-lga14l", __file__)
    with BuildPart() as body:
        Box(W, L, H, align=MIN)
    with BuildPart() as pads:
        for x, y, horiz in PINS.values():
            with Locations(Pos(x, y, 0)):
                Box(PAD_L if horiz else PAD_W, PAD_W if horiz else PAD_L, PAD_T, align=MIN)
    a.body(body.part, "package")
    a.body(pads.part, "pads")
    a.feature("pcb_mount", pads.part.faces().filter_by(Axis.Z).sort_by(Axis.Z)[:14])
    a.write()


if __name__ == "__main__":
    build()
