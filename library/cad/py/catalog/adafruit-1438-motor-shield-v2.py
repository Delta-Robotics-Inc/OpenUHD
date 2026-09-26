"""Adafruit Motor/Stepper/Servo Shield v2.3 (product 1438): vendor STEP binding (PB-796).

Source: adafruit/Adafruit_CAD_Parts "1438 Adafruit MotorShield/1438 Adafruit
MotorShield.step" (MIT, Copyright (c) 2016 Adafruit Industries), committed as
library/parts/adafruit-1438-motor-shield-v2/artifacts/cad/1438-Adafruit-MotorShield.step.

The STEP is one unnamed compound of 9 solids (no component labels), so every
feature is selected by geometry. Coordinates are used as delivered: PCB
68.58 x 53.34 x 1.64 mm with its bottom face at z = 0 and its lower-left
corner at the origin (the same origin as the Eagle board, v2.3.brd), so no
transform is needed. Terminal blocks stand on the top face (z 1.64-10.14);
the Arduino header bodies hang 3 mm below the board (z -3..0).

Checked against the Eagle board (sources.json src_pcb): holes, terminal
block positions and header rows agree to 0.01 mm.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vendor_step import VendorStep, build as build_vendor, holes, within_box  # noqa: E402

PART = "adafruit-1438-motor-shield-v2"
URL = "https://raw.githubusercontent.com/adafruit/Adafruit_CAD_Parts/main/1438%20Adafruit%20MotorShield/1438%20Adafruit%20MotorShield.step"


def every_face(shape):
    return list(shape.faces())


def region(lo, hi):
    """All faces whose centre lies in the box (a whole unnamed vendor solid)."""
    return within_box(every_face, lo, hi)


def build():
    build_vendor(
        VendorStep(
            part_id=PART,
            step="1438 Adafruit MotorShield.step",
            name="1438-Adafruit-MotorShield",
            features={
                # 3 x Φ3.2 through holes (the Arduino UNO holes the shield repeats)
                "mount": holes(3.2),
                # J1: 5-pos 3.5 mm terminal, M1/M2 (pads M2A M2B GND M1B M1A), left edge
                "J1_M1_M2": region((-0.5, 13.5, 1.6), (7.5, 32.5, 10.5)),
                # J2: 5-pos 3.5 mm terminal, M3/M4 (pads M3A M3B GND M4B M4A), right edge
                "J2_M3_M4": region((59.5, 5.0, 1.6), (67.5, 23.5, 10.5)),
                # MPOWER: 2-pos 3.5 mm terminal "5-12V Motor Power" (+/-), bottom edge
                "MPOWER": region((16.5, -0.5, 1.6), (24.5, 7.5, 10.5)),
                # Arduino header bodies below the board (z -3..0)
                "HDR_POWER": region((26.5, 0.5, -3.1), (48.0, 4.5, 0.01)),
                "HDR_ANALOG": region((49.0, 0.5, -3.1), (65.5, 4.5, 0.01)),
                "HDR_DIGITAL_HIGH": region((17.0, 49.5, -3.1), (43.5, 52.5, 0.01)),
                "HDR_DIGITAL_LOW": region((44.0, 49.5, -3.1), (65.5, 52.5, 0.01)),
                # SW1 reset button
                "RESET_BUTTON": region((2.0, 32.5, 1.6), (9.0, 39.5, 5.5)),
            },
            interfaces=["mount", "J1_M1_M2", "J2_M3_M4", "MPOWER"],
            url=URL,
            licence="MIT License, Copyright (c) 2016 Adafruit Industries (Adafruit_CAD_Parts LICENSE)",
            notes=[
                "Coordinates as delivered: PCB bottom at z=0, lower-left corner at the origin (same as the Eagle v2.3 board).",
                "The STEP has no component names; features are selected by geometry (holes(3.2), boxes around each solid).",
                "The STEP models the PCB, 3 terminal blocks, 4 Arduino header bodies and the reset button only: no servo headers, PWM header or ICs.",
                "Only 3 mounting holes: the shield omits the UNO hole at (66.04, 7.62).",
            ],
        )
    )


if __name__ == "__main__":
    build()
