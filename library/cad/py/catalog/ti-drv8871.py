"""TI DRV8871 (DDA, 8-pin HSOP PowerPAD) — representative package geometry (PB-796).

No manufacturer STEP could be downloaded: TI's product page links CAD/CAE only
through Ultra Librarian (https://www.ultralibrarian.com/TI/embedded/?gpn=DRV8871&package=DDA&pin=8),
which requires a login. So the package is generated from TI's mechanical
drawing DDA0008B (4214849/B 09/2025), appended to datasheet SLVSCY9B:

  body length (along the pin rows, Y)  4.8-5.0  -> 4.9   (nominal, midpoint)
  body width (X)                        3.8-4.0  -> 3.9
  lead span tip to tip (X)              5.8-6.2  -> 6.0
  pitch                                 1.27 (6X), rows 3.81 apart (2X)
  lead width                            0.31-0.51 -> 0.41
  lead thickness                        0.10-0.25 -> 0.18
  foot length                           0.40-1.27 -> 0.8  (see assumption)
  standoff                              0.00-0.15
  height                                1.7 MAX
  exposed thermal pad (pad 9)           2.11-2.71 (X) x 2.8-3.4 (Y) -> 2.41 x 3.1

Assumed (the drawing gives only limits): body underside at z = 0.075
(standoff midpoint), body top at z = 1.6 (<= 1.7 max), foot length 0.8 mm,
lead shoulder height 0.8 mm. Recorded as assumption traits on the part.

Coordinates: mm, body centred on the origin, seating plane z = 0, Z up.
Pins 1-4 on -X from +Y to -Y (pin 1 at +Y), pins 5-8 on +X from -Y to +Y,
as in the datasheet top view (GND 1, IN2 2, IN1 3, ILIM 4, VM 5, OUT1 6,
PGND 7, OUT2 8).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build123d as bd  # noqa: E402

from partkit import GeneratedPart, block  # noqa: E402

PART = "ti-drv8871"

BODY_X, BODY_Y = 3.9, 4.9
BODY_Z0, BODY_Z1 = 0.075, 1.6
SPAN = 6.0
PITCH = 1.27
LEAD_W, LEAD_T = 0.41, 0.18
FOOT = 0.8
SHOULDER_Z = 0.8
PAD_X, PAD_Y = 2.41, 3.1

# y of pins 1..4 (left, -X) and 5..8 (right, +X)
YS = [1.5 * PITCH, 0.5 * PITCH, -0.5 * PITCH, -1.5 * PITCH]
PINS = {1: (-1, YS[0]), 2: (-1, YS[1]), 3: (-1, YS[2]), 4: (-1, YS[3]),
        5: (1, YS[3]), 6: (1, YS[2]), 7: (1, YS[1]), 8: (1, YS[0])}


def lead(side: int, y: float):
    """Gull-wing lead: shoulder out of the body, a drop, and a foot on the seating plane."""
    edge = BODY_X / 2
    tip = SPAN / 2
    knee = tip - FOOT  # inner end of the foot
    shoulder = block(side * (edge + knee) / 2, y, SHOULDER_Z - LEAD_T, knee - edge, LEAD_W, LEAD_T)
    drop = block(side * (knee + LEAD_T / 2), y, LEAD_T, LEAD_T, LEAD_W, SHOULDER_Z - LEAD_T)
    foot = block(side * (knee + tip) / 2, y, 0, FOOT, LEAD_W, LEAD_T)
    return foot, shoulder.fuse(drop).fuse(foot)


def bottom(shape) -> list:
    return [f for f in shape.faces() if f.geom_type == bd.GeomType.PLANE and f.normal_at().Z < -0.99 and abs(f.center().Z) < 1e-6]


def build() -> None:
    a = GeneratedPart(PART, "ti-drv8871-dda", __file__)
    body = block(0, 0, BODY_Z0, BODY_X, BODY_Y, BODY_Z1 - BODY_Z0)
    pad = block(0, 0, 0, PAD_X, PAD_Y, BODY_Z0)
    a.body(body, "package")
    a.body(pad, "thermal_pad")
    a.feature("thermal_pad", bottom(pad))
    a.feature("package_top", [f for f in body.faces() if f.normal_at().Z > 0.99])
    for n, (side, y) in PINS.items():
        foot, whole = lead(side, y)
        a.body(whole, f"lead_{n}")
        a.feature(f"pin_{n}", bottom(foot))
    a.write()


if __name__ == "__main__":
    build()
