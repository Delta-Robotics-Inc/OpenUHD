"""STEPPERONLINE 17HS08-1004S (NEMA 17, 20 mm body) — representative geometry (PB-796).

Every dimension is from the manufacturer drawing in 17HS08-1004S.pdf
(omc-stepperonline.com/download/17HS08-1004S.pdf, drawing dated 8.18.2018),
see library/parts/stepperonline-17hs08-1004s/sources.json (src_datasheet):

  - frame 42.3 MAX square, body length 20.5±1 (product page says 21.5 mm:
    source_discrepancy trait on the part; the drawing value is used)
  - 4-M3 DEPTH 2.5 MIN on a 31±0.2 mm square, front face
  - pilot boss Ø22 (0/-0.05) x 2±0.25
  - shaft Ø5 (0/-0.012), 20±1 from the front face, D-flat 16.5±0.25 long,
    4.5±0.1 across the flat
  - leads UL1007 AWG24, 400±10 mm, leaving the side of the body

Coordinates: front mounting face at z = 0, body below it (z < 0), shaft
along +Z at the origin, the lead exit on -Y (as drawn: leads leave the
bottom edge in the front view).

Assumed (not dimensioned on the drawing; `assumption` traits on the part):
  - corner chamfer of the 42.3 mm square: 4 mm x 45°
  - M3 tapped holes modelled as Ø3.0 x 2.5 mm blind bores (thread not modelled)
  - lead exit housing 10 x 4 x 6 mm; leads modelled as a 20 mm stub
    (the real leads are 400 mm flying leads with no connector)
Manufacturer CAD (17HS08-1004S.STEP, 1.2 MB, linked from the product page)
exists but its download is behind a Cloudflare browser check; see the
part's data_gap trait.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build123d as bd
from build123d import Align, Axis, Box, BuildPart, Cylinder, Locations, Mode, Pos

from partkit import GeneratedPart, cylinders, extreme_face

PART = "stepperonline-17hs08-1004s"
MIN = (Align.CENTER, Align.CENTER, Align.MIN)
MAX = (Align.CENTER, Align.CENTER, Align.MAX)

FRAME = 42.3  # 42.3 MAX
BODY_L = 20.5  # 20.5±1
HOLE_SQ = 31.0  # 31±0.2
HOLE_D = 3.0  # M3 (thread not modelled)
HOLE_DEPTH = 2.5  # DEPTH 2.5 MIN
CHAMFER = 4.0  # assumption
BOSS_D, BOSS_H = 22.0, 2.0
SHAFT_D, SHAFT_L = 5.0, 20.0
FLAT_L, FLAT_ACROSS = 16.5, 4.5


def build() -> None:
    a = GeneratedPart(PART, "stepperonline-17hs08-1004s", __file__)

    with BuildPart() as body:
        Box(FRAME, FRAME, BODY_L, align=MAX)
        bd.chamfer(body.edges().filter_by(Axis.Z), CHAMFER)
        h = HOLE_SQ / 2
        with Locations(*[(x, y) for x in (-h, h) for y in (-h, h)]):
            Cylinder(HOLE_D / 2, HOLE_DEPTH, align=MAX, mode=Mode.SUBTRACT)
    with BuildPart() as boss:
        Cylinder(BOSS_D / 2, BOSS_H, align=MIN)
    with BuildPart() as shaft:
        Cylinder(SHAFT_D / 2, SHAFT_L, align=MIN)
        # D-flat: remove 0.5 mm (5.0 - 4.5 across the flat) over the last 16.5 mm
        # (flat plane at y = FLAT_ACROSS - SHAFT_D / 2 = 2.0, leaving 4.5 mm across the flat)
        with Locations(Pos(0, FLAT_ACROSS - SHAFT_D / 2, SHAFT_L - FLAT_L)):
            Box(SHAFT_D, SHAFT_D, FLAT_L, align=(Align.CENTER, Align.MIN, Align.MIN), mode=Mode.SUBTRACT)
    with BuildPart() as lead_exit:
        with Locations(Pos(0, -FRAME / 2, -BODY_L / 2)):
            Box(10, 4, 6, align=(Align.CENTER, Align.MAX, Align.CENTER))
    with BuildPart() as leads:
        with Locations(Pos(0, -FRAME / 2 - 4, -BODY_L / 2) * bd.Rot(90, 0, 0)):
            Cylinder(2.0, 20, align=MIN)

    a.body(body.part, "motor_body")
    a.body(boss.part, "pilot_boss")
    a.body(shaft.part, "shaft_body")
    a.body(lead_exit.part, "lead_exit")
    a.body(leads.part, "leads")

    a.feature("front_mount", cylinders(body.part, HOLE_D), axis=(0, 0, 1))
    a.feature("front_face", extreme_face(body.part, (0, 0, 1)))
    a.feature("shaft", cylinders(shaft.part, SHAFT_D), axis=(0, 0, 1))
    a.feature("leads", extreme_face(leads.part, (0, -1, 0)))
    a.write()


if __name__ == "__main__":
    build()
