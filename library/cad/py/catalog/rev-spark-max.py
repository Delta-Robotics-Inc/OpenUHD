"""REV Robotics SPARK MAX Motor Controller (REV-11-2158): bind UHD interfaces to vendor CAD.

Manufacturer STEP from the product page's "CAD & Drawings" section
(https://www.revrobotics.com/content/cad/REV-11-2158.STEP, downloaded into
library/parts/rev-spark-max/.research/cad/, not committed: REV states no
redistribution licence).

The STEP is one unlabelled body (18 solids, no component names), so every
feature is selected by geometry. Vendor frame: length along X, the heat-sink
(bottom) face at Y = +22.95, the top (data port, cable-retention loop) facing
-Y. `transform` turns it Z-up with the bottom face at z = 0:
    (x, y, z)  ->  (x, z, 22.95 - y)
so the top face is at z = 24.95 (drawing: 25.0 mm), the power-input end
(CAN/PWM port, USB-C, V+/V- leads) at -X and the motor-output end (ENCODER
port, A/B/C leads) at +X.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build123d as bd
from build123d import Pos, Rot

from vendor_step import VendorStep, build as build_vendor, planar


def in_box(lo, hi):
    """Every face whose bounding-box centre lies inside lo..hi (mm, after the transform)."""

    def sel(shape):
        out = []
        for f in shape.faces():
            c = f.bounding_box().center()
            if all(lo[i] <= (c.X, c.Y, c.Z)[i] <= hi[i] for i in range(3)):
                out.append(f)
        return out

    return sel


STEP = VendorStep(
    part_id="rev-spark-max",
    step="REV-11-2158.STEP",
    name="REV-11-2158",
    url="https://www.revrobotics.com/content/cad/REV-11-2158.STEP",
    licence="not stated by REV Robotics (not redistributed)",
    transform=Pos(0, 0, 22.95) * Rot(-90, 0, 0),
    features={
        # 4-pin JST-PH CAN/PWM port on the power-input end face (-X)
        "can_pwm_port": in_box((-30.5, -11.8, 12.5), (-20.0, -0.8, 19.2)),
        # USB-C receptacle beside it
        "usb_c": in_box((-30.5, 0.3, 16.3), (-22.4, 10.6, 20.2)),
        # 6-pin JST-PH ENCODER port on the motor-output end face (+X)
        "encoder_port": in_box((22.0, -7.6, 18.7), (29.7, 7.6, 24.8)),
        # 10-pin 1.27 mm Data Port on the top face
        "data_port": in_box((11.8, -6.8, 24.1), (17.9, 6.8, 25.9)),
        # stubs of the three motor leads (A/B/C) and two power leads (V+/V-) where the STEP cuts them
        "motor_leads": in_box((40.5, -11.0, 5.0), (40.7, 11.0, 10.2)),
        "power_leads": in_box((-40.7, -11.0, 5.0), (-40.5, 11.0, 10.2)),
        # heat-sink / bottom face (z = 0)
        "bottom": planar((0, 0, -1), min_area=1000),
    },
    interfaces=["can_pwm_port", "usb_c", "encoder_port", "data_port"],
    notes=[
        "Vendor STEP is a single unlabelled body; features are selected by position (in_box) after the transform.",
        "transform: Rot(-90, 0, 0) then Pos(0, 0, 22.95): vendor (x, y, z) -> (x, z, 22.95 - y). Bottom (heat-sink) face at z = 0, top at z = 24.95.",
        "Power-input end (CAN/PWM JST-PH 4, USB-C, V+/V- leads) at -X; motor-output end (ENCODER JST-PH 6, A/B/C leads) at +X; Data Port on top (+Z).",
        "Body 69.3 x 34.5 x 25 mm (drawing); bbox X +/-40.6 includes the cut lead stubs, Z to 29.65 includes the cable-retention loop.",
        "No mounting holes: the SPARK MAX has zip-tie notches only (drawing: 44.0 mm apart, 6.0 mm wide).",
    ],
)


def build() -> None:
    build_vendor(STEP)


if __name__ == "__main__":
    build()
