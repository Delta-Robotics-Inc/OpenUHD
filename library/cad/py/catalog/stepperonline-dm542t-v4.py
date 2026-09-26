"""STEPPERONLINE DM542T (V4.0) stepper drive — representative geometry (PB-796).

Dimensions from Figure 1 "Mechanical specifications" of the DM542T(V4.0)
user manual (omc-stepperonline.com/download/DM542T_V4.0.pdf, identical to
the drawing in the older DM542T.pdf), see
library/parts/stepperonline-dm542t-v4/sources.json (src_manual_v4):

  - footprint 118 x 75.5 mm (base plate); body between the end flanges
    112 mm wide (the "112" dimension between the side-mount slots)
  - 4-Φ3.5 base holes, 112 mm apart in X, at 25.3 and 47.8 mm from the
    75.5 mm edge (so 22.5 mm apart in Y)
  - side view: 25.5 mm overall with side-mount slots 4.5 mm wide at 14 mm

Coordinates: base (mounting face) at z = 0, drive above it, footprint
centred on the origin, the 75.5 mm "bottom" edge of the drawing at
y = -37.75. Connectors P1 (control), P2 (fault) and P3 (power + motor) sit
along the +Y long side (manual Figure 2 shows them along one long edge).

Assumed (not dimensioned; `assumption` traits on the part):
  - overall height 25.5 mm (the only vertical dimension on the side view;
    ProtoPart states 34 mm)
  - base plate thickness 3 mm; end flanges (x beyond ±56) only 3 mm tall
  - connector block sizes and positions along the +Y edge (representative,
    from the Figure 2 photo order: P3 left, P2 middle, P1 right)
Manufacturer CAD (DM542T(V4.0).STEP, 1.98 MB, on the product page) is
behind a Cloudflare browser check; see the part's data_gap trait.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import Align, BuildPart, Box, Cylinder, Locations, Mode, Pos

from partkit import GeneratedPart, block, cylinders, extreme_face

PART = "stepperonline-dm542t-v4"
MIN = (Align.CENTER, Align.CENTER, Align.MIN)

L, W, H = 118.0, 75.5, 25.5
BODY_L = 112.0
BASE_T = 3.0  # assumption
HOLE_D = 3.5
HOLE_X = 112.0 / 2
HOLE_Y = (-W / 2 + 25.3, -W / 2 + 47.8)  # -12.45, 10.05


def build() -> None:
    a = GeneratedPart(PART, "stepperonline-dm542t-v4", __file__)

    with BuildPart() as base:
        Box(L, W, BASE_T, align=MIN)
        with Locations(*[(x, y) for x in (-HOLE_X, HOLE_X) for y in HOLE_Y]):
            Cylinder(HOLE_D / 2, BASE_T, align=MIN, mode=Mode.SUBTRACT)
    with BuildPart() as housing:
        with Locations(Pos(0, 0, BASE_T)):
            Box(BODY_L - 12, W, H - BASE_T, align=MIN)  # leaves the hole columns clear

    # Terminal blocks along the +Y side, mating faces facing +Y (representative).
    y_face = W / 2
    p3 = block(-28.0, y_face - 4, BASE_T, 36.0, 8.0, 12.0)  # GND +Vdc A+ A- B+ B-
    p2 = block(4.0, y_face - 4, BASE_T, 10.0, 8.0, 12.0)  # ALM+ ALM-
    p1 = block(30.0, y_face - 4, BASE_T, 30.0, 8.0, 12.0)  # PUL+ PUL- DIR+ DIR- ENA+ ENA-

    a.body(base.part, "base_plate")
    a.body(housing.part, "housing")
    a.body(p3, "P3")
    a.body(p2, "P2")
    a.body(p1, "P1")

    a.feature("base_mount", cylinders(base.part, HOLE_D), axis=(0, 0, 1))
    a.feature("base_face", extreme_face(base.part, (0, 0, -1)))
    a.feature("P3", extreme_face(p3, (0, 1, 0)))
    a.feature("P2", extreme_face(p2, (0, 1, 0)))
    a.feature("P1", extreme_face(p1, (0, 1, 0)))
    a.write()


if __name__ == "__main__":
    build()
