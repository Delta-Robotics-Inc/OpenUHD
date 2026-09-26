"""HAKRC BLS 35A 4IN1 ESC (20 x 20 mm, board HK88201 V1.2): representative geometry.

No manufacturer CAD: hakrc.com publishes no drawing, STEP or 3D model for
this ESC (product page checked; see .research/gaps.json).

From the HAKRC product page specification list (src_product):
  Product size 31*30*6 mm; fixed hole position 20*20 mm; fixed aperture M3.
From the HAKRC product pinout image (src_pinout_image, top side):
  8-pin connector at the top edge labelled "Curr NC 4 3 2 1 + -";
  motor pad groups: M2 top-left, M1 bottom-left, M4 top-right, M3
  bottom-right (three pads each on the side edges); battery pads at the
  bottom edge, "-" left and "+" right.
Assumptions (not dimensioned by any source; also `assumption` traits):
  - 30 mm along x (motor-pad edges), 31 mm along y;
  - PCB 1.6 mm thick; a component envelope up to the 6 mm stated height;
  - hole diameter 3.2 mm (M3 clearance; the page says only "M3");
  - pad, pad-group, battery-pad and connector positions and sizes are
    estimated from the photo (about 10.75 px/mm from the 20 mm callout);
  - connector body 10.0 x 4.25 x 2.9 mm (1.0 mm pitch 8-pin, JST-SH class).

Coordinates: board centred, PCB bottom at z = 0, component side +Z,
x to the right and y up as in the pinout image (connector at +y).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import Axis, Box, BuildPart, Locations, Pos  # noqa: E402

from partkit import MIN, GeneratedPart, block, board, cylinders  # noqa: E402

LX, LY, H = 30.0, 31.0, 6.0
PCB = 1.6
SPACING, HOLE_D = 20.0, 3.2
S = SPACING / 2

PAD = (2.5, 2.0, 0.3)  # motor pad x, y, z
GROUP_Y = 6.0  # motor group centre offset (photo estimate)
GROUP_PITCH = 3.0
MOTORS = {"motor_1": (-1, -1), "motor_2": (-1, 1), "motor_3": (1, -1), "motor_4": (1, 1)}

CONN = (10.0, 4.25, 2.9)  # connector body x, y, z
CONN_XY = (-1.2, LY / 2 - 2.5)


def build() -> None:
    a = GeneratedPart("hakrc-bls-35a-4in1-esc", "hakrc-bls-35a-4in1", __file__)
    pcb = board(LX, LY, PCB, [(x, y) for x in (-S, S) for y in (-S, S)], HOLE_D, corner_r=1.5)
    a.body(pcb, "pcb")
    # component envelope inside the hole square, up to the stated 6 mm height
    inset = SPACING - HOLE_D - 2
    a.body(block(0, 0, PCB, inset, inset, H - PCB), "components")
    a.feature("stack_mount", cylinders(pcb, HOLE_D), axis=(0, 0, 1))

    for iface, (sx, sy) in MOTORS.items():
        with BuildPart() as pads:
            for k in (-1, 0, 1):
                with Locations(Pos(sx * (LX / 2 - PAD[0] / 2), sy * GROUP_Y + k * GROUP_PITCH, PCB)):
                    Box(*PAD, align=MIN)
        a.body(pads.part, f"{iface}_pads")
        a.feature(iface, pads.part.faces().filter_by(Axis.Z).sort_by(Axis.Z)[-3:])

    with BuildPart() as bat:
        for x in (-3.0, 3.0):
            with Locations(Pos(x, -(LY / 2 - 1.5), PCB)):
                Box(3.0, 3.0, 0.3, align=MIN)
    a.body(bat.part, "battery_pads")
    top = bat.part.faces().filter_by(Axis.Z).sort_by(Axis.Z)[-2:]
    a.feature("bat_in", [f for f in top if f.center().X > 0])
    a.feature("bat_neg", [f for f in top if f.center().X < 0])

    conn = block(CONN_XY[0], CONN_XY[1], PCB, *CONN)
    a.body(conn, "fc_connector")
    # mating face: the connector's +Y face (the cable plugs in from the board edge side)
    a.feature("fc_port", conn.faces().filter_by(Axis.Y).sort_by(Axis.Y)[-1:])
    a.write()


if __name__ == "__main__":
    build()
