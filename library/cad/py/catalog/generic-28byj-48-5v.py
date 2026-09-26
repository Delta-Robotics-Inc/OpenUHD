"""28BYJ-48 5 V geared unipolar stepper — representative geometry (PB-796).

Dimensions from the drawing on the Kiatronics "28BYJ-48 - 5V Stepper Motor"
sheet (robocraft.ru/files/datasheet/28BYJ-48.pdf, byte-identical to the
copy in ProtoPart), see library/parts/generic-28byj-48-5v/sources.json
(src_kiatronics):

  - can Ø28, 19 mm deep
  - 2-Ø4.2±0.15 holes on 35±0.2 mm, ears 2-R3.5 (so 7 mm tall)
  - output shaft offset 8 mm from the can centre; boss Ø9 x 1.5;
    shaft Ø5 (0/-0.1), 10±0.5 from the flange face, double flats
    3 (0/-0.1) across, 6±0.2 long
  - wire cover 14.6 wide, reaching 17 mm from the can centre
  - lead AWG#26 UL1061 x5, 250±10 mm to the end of a JST XHP-5 plug

Coordinates: flange (mounting) face at z = 0, can behind it (z < 0), can
centre at the origin, mounting holes at (±17.5, 0), shaft axis at
(0, 8) along +Z, wire cover on -Y.

Assumed (not dimensioned; `assumption` traits on the part):
  - flange ear thickness 1 mm (ears modelled as a 42 x 7 mm plate, R3.5 ends
    approximated by the plate plus hole)
  - wire cover depth 17 mm (flush with the can back less 2 mm)
  - the plug: a JST XHP-5 housing modelled as a 12.4 x 5.8 x 10 mm block
    placed 30 mm below the cover (representative; the real plug hangs on a
    250 mm lead)
No manufacturer CAD exists for this generic motor (see the part's data_gap).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build123d as bd
from build123d import Align, Box, BuildPart, Cylinder, Locations, Mode, Pos

from partkit import GeneratedPart, block, cylinders, extreme_face

PART = "generic-28byj-48-5v"
MIN = (Align.CENTER, Align.CENTER, Align.MIN)
MAX = (Align.CENTER, Align.CENTER, Align.MAX)

CAN_D, CAN_H = 28.0, 19.0
HOLE_D, HOLE_SPACING = 4.2, 35.0
EAR_T = 1.0  # assumption
SHAFT_Y = 8.0
BOSS_D, BOSS_H = 9.0, 1.5
SHAFT_D, SHAFT_L = 5.0, 10.0
FLAT_ACROSS, FLAT_L = 3.0, 6.0


def build() -> None:
    a = GeneratedPart(PART, "generic-28byj-48-5v", __file__)

    with BuildPart() as can:
        Cylinder(CAN_D / 2, CAN_H, align=MAX)
    with BuildPart() as flange:
        Box(HOLE_SPACING + 7.0, 7.0, EAR_T, align=MAX)
        bd.fillet(flange.edges().filter_by(bd.Axis.Z).group_by(bd.Axis.X)[0], 3.49)
        bd.fillet(flange.edges().filter_by(bd.Axis.Z).group_by(bd.Axis.X)[-1], 3.49)
        with Locations((-HOLE_SPACING / 2, 0), (HOLE_SPACING / 2, 0)):
            Cylinder(HOLE_D / 2, EAR_T, align=MAX, mode=Mode.SUBTRACT)
    with BuildPart() as boss:
        with Locations(Pos(0, SHAFT_Y, 0)):
            Cylinder(BOSS_D / 2, BOSS_H, align=MIN)
    with BuildPart() as shaft:
        with Locations(Pos(0, SHAFT_Y, 0)):
            Cylinder(SHAFT_D / 2, SHAFT_L, align=MIN)
        # double flats, 3 mm across, over the last 6 mm
        for side in (1, -1):
            with Locations(Pos(side * (FLAT_ACROSS / 2 + SHAFT_D / 2), SHAFT_Y, SHAFT_L - FLAT_L)):
                Box(SHAFT_D, SHAFT_D, FLAT_L, align=MIN, mode=Mode.SUBTRACT)
    cover = block(0, -(17.0 - 3.0), -CAN_H, 14.6, 6.0, 17.0)  # reaches y = -17
    plug = block(0, -17.0 - 30.0, -CAN_H / 2 - 5.0, 12.4, 5.8, 10.0)

    a.body(can.part, "can")
    a.body(flange.part, "flange")
    a.body(boss.part, "boss")
    a.body(shaft.part, "shaft_body")
    a.body(cover, "wire_cover")
    a.body(plug, "jst_xhp_5_plug")

    a.feature("mount", cylinders(flange.part, HOLE_D), axis=(0, 0, 1))
    a.feature("shaft", cylinders(shaft.part, SHAFT_D), axis=(0, 0, 1))
    a.feature("plug", extreme_face(plug, (0, 0, 1)))
    a.write()


if __name__ == "__main__":
    build()
