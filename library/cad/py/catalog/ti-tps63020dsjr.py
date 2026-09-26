"""TI TPS63020DSJR (VSON-14, DSJ / R-PVSON-N14): representative package geometry.

No manufacturer CAD downloaded: TI's product page routes CAD/3D models to
Ultra Librarian, which needs a login; the Digi-Key model page returned 403
(see library/parts/ti-tps63020dsjr/.research/gaps.json).

Dimensions from TI drawing 4208212-3/C (MPSS014A, also datasheet SLVS916I
p.31) and the exposed-pad drawing 4208549-3/G (datasheet p.32):
  body 3.85-4.15 x 2.85-3.15 mm, height 0.80-1.00 mm -> nominal 4.0 x 3.0 x 0.9
  (0.9 is the range midpoint: assumption)
  14 leads, pitch 0.50, span 3.00 BSC between pins 1 and 7;
  lead width 0.18-0.30 (0.24 used), length 0.30-0.50 (0.40 used)
  exposed thermal pad 2.85 x 1.58 mm (+-0.10), connected to PGND.
The four 0.20 mm PGND tie bars at the pad's short ends are not modelled.

Coordinates: body centred, seating plane z = 0, x along the 4.0 mm length,
y along 3.0 mm. Top view: pins 1-7 along the -y edge from x = -1.5 to +1.5,
pins 8-14 along the +y edge from x = +1.5 back to -1.5 (counter-clockwise).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import Axis, Box, BuildPart, Locations, Pos  # noqa: E402

from partkit import MIN, GeneratedPart  # noqa: E402

L, W, H = 4.0, 3.0, 0.9
LEAD_W, LEAD_L, PITCH = 0.24, 0.40, 0.5
EP_X, EP_Y = 2.85, 1.58
PAD_T = 0.02  # assumption: pad thickness not dimensioned (0.20 REF is the lead frame)

Y_LEAD = W / 2 - LEAD_L / 2
PINS = {n: (-1.5 + PITCH * (n - 1), -Y_LEAD) for n in range(1, 8)}
PINS.update({n: (1.5 - PITCH * (n - 8), Y_LEAD) for n in range(8, 15)})


def build() -> None:
    a = GeneratedPart("ti-tps63020dsjr", "ti-tps63020-dsj14", __file__)
    with BuildPart() as body:
        Box(L, W, H, align=MIN)
    with BuildPart() as leads:
        with Locations(*[Pos(x, y, 0) for x, y in PINS.values()]):
            Box(LEAD_W, LEAD_L, PAD_T, align=MIN)
    with BuildPart() as ep:
        Box(EP_X, EP_Y, PAD_T, align=MIN)
    a.body(body.part, "package")
    a.body(leads.part, "leads")
    a.body(ep.part, "exposed_pad")
    a.feature("pcb_mount", leads.part.faces().filter_by(Axis.Z).sort_by(Axis.Z)[:14])
    a.feature("thermal_pad", ep.part.faces().filter_by(Axis.Z).sort_by(Axis.Z)[:1])
    a.write()


if __name__ == "__main__":
    build()
