"""EMAX RS2205 2300KV (Cooling Series): representative geometry (PB-796).

No manufacturer CAD is published (emaxmodel.com product page and
/pages/downloads: manuals and firmware only), so the motor is generated from
the EMAX dimension drawing (RS2205-1.jpg, sources.json src_drawing):

  bell ø27.9, overall height 31.7, prop shaft ø5 / M5 extending 15 above the
  bell, 4-M3 base holes on "16 x 19", centre boss ø8, leads 77 long.

"16 x 19" is the usual motor cross pattern, not a rectangle: the drawing
dimensions one diagonal hole pair 16 apart and the other 19 apart (the
extension lines run through the opposite holes of each pair, and the pairs
cross at the centre at ~90°). Holes are therefore on radius 8 and 9.5.

Coordinates: Z up, the base (mounting face) at z = 0, shaft on the Z axis.
Assumptions (also `assumption` traits on the part):
  - pattern orientation: as drawn (bottom view, leads exit +X), the 16 mm
    pair lies along (1, -1) and the 19 mm pair along (1, 1), i.e. both at 45°
    to the lead exit; the angle is not dimensioned;
  - base flange 3 mm thick; M3 holes modelled at the 2.5 mm tap drill
    (tapped "4-M3"), depth = the flange;
  - everything below the bell (base boss, the ø3 shaft end and circlip) is
    folded into the 31.7 - 15 = 16.7 mm body height;
  - leads modelled as 12 mm stubs of ø1.6 (20AWG insulated, representative),
    not their full 77 mm.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import Box, BuildPart, Cylinder, Locations, Mode, PolarLocations, Pos, Rot  # noqa: E402

from partkit import MIN, GeneratedPart  # noqa: E402

PART_ID = "emax-rs2205-2300kv"

BELL_D = 27.9  # drawing
OVERALL_H = 31.7  # drawing
PROP_SHAFT_L = 15.0  # drawing ("15" above the bell)
SHAFT_D = 5.0  # drawing ø5, M5 thread
BODY_H = OVERALL_H - PROP_SHAFT_L  # 16.7
HOLE_PAIR_16, HOLE_PAIR_19 = 16.0, 19.0  # drawing "16" / "19": diagonal pair spacings
R2 = 0.5 ** 0.5  # 45° to the lead exit, as drawn (not dimensioned: assumption)
TAP_D = 2.5  # M3 tap drill (assumption)
BASE_H = 3.0  # assumption: not dimensioned
BOSS_D = 8.0  # drawing ø8


def hole_walls(centres, d: float, z0: float, h: float):
    """Lateral faces of standalone cylinders at the hole positions.

    Boolean-cut hole walls sometimes come back as trimmed surfaces whose
    build123d `Face.radius` is None (which partkit.cylinders / hole_axes
    cannot read), so the feature uses coincident untrimmed walls instead.
    """
    out = []
    for x, y in centres:
        c = Pos(x, y, z0) * Cylinder(d / 2, h, align=MIN)
        out += [f for f in c.faces() if f.geom_type.name == "CYLINDER"]
    return out


def build() -> None:
    a = GeneratedPart(PART_ID, "emax-rs2205", __file__)

    holes16 = [(s * HOLE_PAIR_16 / 2 * R2, -s * HOLE_PAIR_16 / 2 * R2) for s in (1, -1)]  # along (1, -1)
    holes19 = [(s * HOLE_PAIR_19 / 2 * R2, s * HOLE_PAIR_19 / 2 * R2) for s in (1, -1)]  # along (1, 1)
    holes = holes16 + holes19
    with BuildPart() as base:
        Cylinder(BELL_D / 2 - 0.6, BASE_H, align=MIN)
        with Locations(*holes):
            Cylinder(TAP_D / 2, BASE_H, align=MIN, mode=Mode.SUBTRACT)
        Cylinder(BOSS_D / 2 - 1.5, 1.0, align=MIN, mode=Mode.SUBTRACT)  # centre relief around the ø3 shaft end
    with BuildPart() as bell:
        with Locations(Pos(0, 0, BASE_H)):
            Cylinder(BELL_D / 2, BODY_H - BASE_H, align=MIN)
        # cooling-fin slots on the bell top, for recognisability
        with Locations(Pos(0, 0, BODY_H - 1.2)):
            with PolarLocations(9, 6):
                Box(7, 2.0, 1.3, align=MIN, mode=Mode.SUBTRACT)
    with BuildPart() as shaft:
        with Locations(Pos(0, 0, BODY_H)):
            Cylinder(SHAFT_D / 2, PROP_SHAFT_L, align=MIN)

    leads = {}
    for letter, dy in (("a", -2.0), ("b", 0.0), ("c", 2.0)):
        with BuildPart() as lead:
            with Locations(Pos(BELL_D / 2 - 1, dy, 1.5) * Rot(0, 90, 0)):
                Cylinder(0.8, 12, align=MIN)
        leads[letter] = lead.part

    a.body(base.part, "base")
    a.body(bell.part, "bell")
    a.body(shaft.part, "prop_shaft")
    for letter, lead in leads.items():
        a.body(lead, f"lead_{letter}")

    a.feature("base_mount", hole_walls(holes16, TAP_D, 0, BASE_H), axis=(0, 0, 1))
    a.feature("base_mount_19", hole_walls(holes19, TAP_D, 0, BASE_H), axis=(0, 0, 1))
    a.feature("base_face", [f for f in base.part.faces() if f.geom_type.name == "PLANE" and f.normal_at().Z < -0.9 and abs(f.center().Z) < 1e-6])
    a.feature("shaft", hole_walls([(0, 0)], SHAFT_D, BODY_H, PROP_SHAFT_L), axis=(0, 0, 1))
    for letter, lead in leads.items():
        a.feature(f"phases_{letter}", [f for f in lead.faces() if f.geom_type.name == "PLANE" and f.normal_at().X > 0.9])
    a.write()


if __name__ == "__main__":
    build()
