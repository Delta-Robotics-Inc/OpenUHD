"""Adafruit VL53L4CD breakout (product 5396): vendor STEP binding (PB-796).

Source: adafruit/Adafruit_CAD_Parts "5396 VL53L4CD Sensor/5396 Adafruit VL53L4CD.step"
(MIT, committed as library/parts/adafruit-5396-vl53l4cd/artifacts/cad/). The
STEP is in the Eagle board's coordinates (origin at the board's lower-left
corner, board bottom at z = 0, top at z = 1.6, sensor facing +Z), so no
transform is applied.

Features:
  mount         the four 2.5 mm plated holes (20.32 x 12.7 mm rectangle, centre (12.7, 8.89))
  header        the six 1.0 mm header holes (JP2: VIN GND SCL SDA GPIO XSHUT, y = 2.54)
  stemma_qt_1   JST-SH-4 socket CONN4 on the left edge (x ~ 2.7)
  stemma_qt_2   JST-SH-4 socket CONN3 on the right edge (x ~ 22.7)
  sensor        top face of the VL53L4CD (LGA12_ST): the optical aperture side
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vendor_step import VendorStep, _walk, build as build_vendor, holes, planar  # noqa: E402

PART = "adafruit-5396-vl53l4cd"


def jst(side: str):
    """All faces of the JST_SH4 component on the left (x < 12.7) or right side.

    Both sockets carry the same vendor label, so `label()` alone would return
    the first one only.
    """

    def sel(shape):
        out = []
        for s in _walk(shape):
            if s.label != "JST_SH4":
                continue
            x = s.bounding_box().center().X
            if (side == "left" and x < 12.7) or (side == "right" and x > 12.7):
                out.extend(s.faces())
        return out

    return sel


def build():
    build_vendor(
        VendorStep(
            part_id=PART,
            step="5396-Adafruit-VL53L4CD.step",
            name="5396-Adafruit-VL53L4CD",
            features={
                "mount": holes(2.5),
                "header": holes(1.0),
                "stemma_qt_1": jst("left"),
                "stemma_qt_2": jst("right"),
                "sensor": planar((0, 0, 1), within="LGA12_ST"),
            },
            interfaces=["mount", "stemma_qt_1", "stemma_qt_2"],
            url="https://raw.githubusercontent.com/adafruit/Adafruit_CAD_Parts/main/5396%20VL53L4CD%20Sensor/5396%20Adafruit%20VL53L4CD.step",
            licence="MIT (Copyright (c) 2016 Adafruit Industries, Adafruit_CAD_Parts LICENSE); committed",
            notes=[
                "No transform: STEP coordinates equal the Eagle board (origin at the lower-left board corner, board bottom z = 0, sensor facing +Z).",
                "Holes agree with the Eagle .brd: 2.5 mm drills at (2.54, 2.54), (22.86, 2.54), (2.54, 15.24), (22.86, 15.24).",
                "The 1x6 header is not modelled (pads only); 'header' is its six 1.0 mm holes.",
            ],
        )
    )


if __name__ == "__main__":
    build()
