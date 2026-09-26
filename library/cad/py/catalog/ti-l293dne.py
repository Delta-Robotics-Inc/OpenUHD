"""TI L293DNE (NE, 16-pin PDIP) — representative package geometry (PB-796).

No manufacturer STEP could be downloaded: TI's L293D product folder links
CAD/CAE only through Ultra Librarian (app.ultralibrarian.com, login
required), and SLRS008D itself carries no package drawing. The package is
generated from TI mechanical data MPDI003, "NE (R-PDIP-T**)" (drawing
4040054/B 04/95), which the product folder links for L293DNE:

  body length A (16 pins, along the pin rows, Y)  19.80 MAX -> 19.80
                                                  (SLRS008D "body size (nom)" 19.80 x 6.35)
  body width C (X)                                 6.10-6.60 -> 6.35
  pitch                                            2.54
  row spacing (lead centres, X)                    7.37-7.87 -> 7.62
  seating plane to top                             5.08 MAX
  standoff (seating plane to body underside)       0.51 MIN
  lead length below the seating plane              3.17-3.94 -> 3.30
  lead width (below the seating plane)             0.381-0.533 -> 0.457
  lead thickness                                   0.25 NOM
  end-lead shoulder width                          1.78 MAX

Assumed (the drawing gives no value): body thickness 3.30 mm (so the top is
at z = 3.81 <= 5.08 max), shoulder width 1.52 mm, shoulders leave the body
at z = 1.6 mm, and the pin-1 dimple. Recorded as assumption traits on the part.

Coordinates: mm, body centred on the origin, seating plane z = 0 (the body
sits on its standoff shoulders), leads go down to z = -3.30, Z up.
Pins 1-8 on -X from +Y to -Y (pin 1 at +Y), pins 9-16 on +X from -Y to +Y,
as in the datasheet top view (1,2EN 1 ... VCC2 8, 3,4EN 9 ... VCC1 16).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build123d as bd  # noqa: E402
from build123d import BuildPart, Cylinder, Locations, Mode, Pos  # noqa: E402

from partkit import GeneratedPart, block  # noqa: E402

PART = "ti-l293dne"

BODY_X, BODY_Y = 6.35, 19.80
BODY_Z0, BODY_T = 0.51, 3.30  # standoff min (drawing); thickness assumed
BODY_Z1 = BODY_Z0 + BODY_T
PITCH = 2.54
ROW = 7.62
LEAD_W, LEAD_T = 0.457, 0.25
LEAD_L = 3.30
SHOULDER_W = 1.52  # assumed (<= 1.78 end-lead max)
SHOULDER_Z = 1.6  # assumed: height where the leads leave the body

YS = [(3.5 - k) * PITCH for k in range(8)]  # +8.89 .. -8.89
PINS = {k + 1: (-1, YS[k]) for k in range(8)}
PINS.update({k + 9: (1, YS[7 - k]) for k in range(8)})


def lead(side: int, y: float):
    """Through-hole lead: a tab out of the body side, a shoulder down to the seating plane, a pin below it."""
    edge = BODY_X / 2
    x = side * ROW / 2
    tab = block(side * (edge + ROW / 2) / 2, y, SHOULDER_Z, ROW / 2 - edge + LEAD_T / 2, SHOULDER_W, LEAD_T)
    shoulder = block(x, y, 0, LEAD_T, SHOULDER_W, SHOULDER_Z + LEAD_T)
    pin = block(x, y, -LEAD_L, LEAD_T, LEAD_W, LEAD_L)
    return pin, tab.fuse(shoulder).fuse(pin)


def bottom(shape) -> list:
    return [f for f in shape.faces() if f.geom_type == bd.GeomType.PLANE and f.normal_at().Z < -0.99 and abs(f.center().Z + LEAD_L) < 1e-6]


def build() -> None:
    a = GeneratedPart(PART, "ti-l293dne-pdip16", __file__)
    with BuildPart() as pkg:
        with Locations(Pos(0, 0, BODY_Z0)):
            bd.Box(BODY_X, BODY_Y, BODY_T, align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.MIN))
        # pin-1 dimple beside pin 1 (representative)
        with Locations(Pos(-BODY_X / 2 + 1.2, BODY_Y / 2 - 1.2, BODY_Z1 - 0.2)):
            Cylinder(0.5, 0.2, align=(bd.Align.CENTER, bd.Align.CENTER, bd.Align.MIN), mode=Mode.SUBTRACT)
    body = pkg.part
    a.body(body, "package")
    a.feature("package_top", [f for f in body.faces() if f.geom_type == bd.GeomType.PLANE and f.normal_at().Z > 0.99 and abs(f.center().Z - BODY_Z1) < 1e-6])
    a.feature("package_underside", [f for f in body.faces() if f.geom_type == bd.GeomType.PLANE and f.normal_at().Z < -0.99])
    for n, (side, y) in PINS.items():
        pin, whole = lead(side, y)
        a.body(whole, f"lead_{n}")
        a.feature(f"pin_{n}", bottom(pin))
    a.write()


if __name__ == "__main__":
    build()
