"""SparkFun ROB-28633 N20 motor with encoder: representative geometry (PB-796).

No manufacturer CAD is published (SparkFun product page: datasheet only;
the sparkfun GitHub organisation has no N20 repository), so one motor of the
pair is generated from the SparkFun figures (sources.json src_product,
src_datasheet):

  envelope 10 x 12 x 41.5 mm; 3 mm D-shaft, 10 mm long ("d-axis 10mm");
  100 mm cable to a JST-SH 6-pin plug.

Coordinates: shaft axis +Z, the gearbox output face at z = 0, the body
extending to -Z; 12 mm along X, 10 mm along Y.
Assumptions (also `assumption` traits on the part):
  - 41.5 mm includes the 10 mm shaft, so the body is 31.5 mm long;
  - the body split (gearbox 9 mm, motor can 15 mm with Ø12 rounded sides and
    10 mm flats, encoder 7.5 mm) is representative, not dimensioned;
  - shaft centred on the gearbox face; D-flat 0.5 mm deep over the full length;
  - the cable is not modelled; `cable_exit` marks where it leaves the
    encoder cap (the JST-SH plug is 100 mm away on the cable).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import Box, BuildPart, Cylinder, Locations, Mode, Pos  # noqa: E402

from partkit import MIN, GeneratedPart, block  # noqa: E402

PART_ID = "sparkfun-rob-28633"

W, H = 12.0, 10.0  # product page 10 x 12
TOTAL_L = 41.5  # product page
SHAFT_D, SHAFT_L = 3.0, 10.0  # product page "10mm long 3mm diameter D-shaft"
BODY_L = TOTAL_L - SHAFT_L  # 31.5, assumption: 41.5 includes the shaft
GEAR_L, CAN_L = 9.0, 15.0  # assumption
ENC_L = BODY_L - GEAR_L - CAN_L  # 7.5
D_FLAT = 0.5  # assumption


def build() -> None:
    a = GeneratedPart(PART_ID, "sparkfun-n20-encoder", __file__)

    gearbox = block(0, 0, -GEAR_L, W, H, GEAR_L)
    with BuildPart() as can:
        with Locations(Pos(0, 0, -GEAR_L - CAN_L)):
            Cylinder(W / 2, CAN_L, align=MIN)
            Box(W, H, CAN_L, align=MIN, mode=Mode.INTERSECT)
    encoder = block(0, 0, -BODY_L, W, H, ENC_L)
    with BuildPart() as shaft:
        Cylinder(SHAFT_D / 2, SHAFT_L, align=MIN)
        with Locations(Pos(SHAFT_D / 2 - D_FLAT / 2, 0, 0)):
            Box(D_FLAT, SHAFT_D, SHAFT_L, align=MIN, mode=Mode.SUBTRACT)
    # untrimmed wall coincident with the round part of the D-shaft: its axis goes in the manifest
    wall = Cylinder(SHAFT_D / 2, SHAFT_L, align=MIN)
    shaft_wall = [f for f in wall.faces() if f.geom_type.name == "CYLINDER"]
    # cable exit: a small grommet on the encoder cap
    exit_ = block(0, 0, -BODY_L - 1.0, 4.0, 2.0, 1.0)

    a.body(gearbox, "gearbox")
    a.body(can.part, "motor_can")
    a.body(encoder, "encoder")
    a.body(shaft.part, "shaft_body")
    a.body(exit_, "cable_exit_body")

    a.feature("shaft", shaft_wall, axis=(0, 0, 1))
    a.feature("gearbox_face", [f for f in gearbox.faces() if f.geom_type.name == "PLANE" and f.normal_at().Z > 0.9])
    a.feature("cable_exit", [f for f in exit_.faces() if f.geom_type.name == "PLANE" and f.normal_at().Z < -0.9])
    a.write()


if __name__ == "__main__":
    build()
