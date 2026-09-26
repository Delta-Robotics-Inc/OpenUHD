"""Espressif ESP32-C3-DevKitM-1 (N4X): representative geometry (PB-796).

Espressif publishes no 3D model for this board. The user guide's Related
Documents give the schematic, the PCB layout and a 2D dimensions drawing
(PDF + DXF, sources.json src_dimensions / src_dimensions_dxf), so the board
is generated from the DXF:

  outline 25.40 x 38.91 mm, no mounting holes; header pad centres at
  x = 1.27 / 24.13 mm, y = 1.29 .. 36.85 mm (15 per row, 2.54 pitch; J1 on
  the left, pin 1 at the top); Micro-USB J2 on the bottom edge (pads
  x 9.1-16.3, y 1.7-6.2); ESP32-C3-MINI-1 (13.2 x 16.6 x 2.4, module
  datasheet) with its antenna overhanging the top edge by ~5.5 mm (drawing).

Coordinates: the DXF shifted so the board centre is the origin
(x' = x - 12.70, y' = y - 19.456), PCB bottom at z = 0, components up (+Z),
USB toward -Y.
Assumptions (also `assumption` traits on the part):
  - 1.6 mm PCB; male 2.54 mm headers soldered pins-down (2.5 mm plastic,
    6 mm pins); Micro-B receptacle 7.5 x 5.5 x 2.6 mm overhanging the edge
    by 0.8 mm; module top edge 5.5 mm past the board (scaled from the PDF).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from partkit import GeneratedPart, block, board  # noqa: E402

PART_ID = "espressif-esp32-c3-devkitm-1-n4x"

L, W = 25.40, 38.91  # dimensions drawing (x, y)
OX, OY = 12.70, 19.456  # DXF -> board-centred
PCB = 1.6  # assumption
PITCH = 2.54
ROW_X = (1.27 - OX, 24.13 - OX)  # J1 left, J3 right (DXF pad centres)
PIN_Y = [36.85 - k * PITCH - OY for k in range(15)]  # pin 1 at the top
HDR_H, PIN_L, PIN_W = 2.5, 6.0, 0.64  # assumption: standard male header


def build() -> None:
    a = GeneratedPart(PART_ID, "esp32-c3-devkitm-1", __file__)
    pcb = board(L, W, PCB, [], 0)

    headers = {}
    for name, x in (("j1", ROW_X[0]), ("j3", ROW_X[1])):
        yc = (PIN_Y[0] + PIN_Y[-1]) / 2
        plastic = block(x, yc, -HDR_H, PITCH, 15 * PITCH, HDR_H)
        pins = [block(x, y, -HDR_H - PIN_L, PIN_W, PIN_W, PIN_L + HDR_H) for y in PIN_Y]
        headers[name] = (plastic, pins)

    # Micro-USB J2: centred on the pad group (x 9.1-16.3 -> 12.7), overhanging the bottom edge
    usb_d = 5.5
    usb = block(0, -OY - 0.8 + usb_d / 2, PCB, 7.5, usb_d, 2.6)
    # ESP32-C3-MINI-1: 13.2 x 16.6 x 2.4, top edge 5.5 mm past the board's top edge
    module = block(0, W / 2 + 5.5 - 16.6 / 2, PCB, 13.2, 16.6, 2.4)

    a.body(pcb, "pcb")
    a.body(usb, "micro_usb")
    a.body(module, "esp32_c3_mini_1")
    for name, (plastic, pins) in headers.items():
        a.body(plastic, f"header_{name}")
        for k, p in enumerate(pins, start=1):
            a.body(p, f"{name}_pin{k}")

    a.feature("usb", [f for f in usb.faces() if f.geom_type.name == "PLANE" and f.normal_at().Y < -0.9])
    for name, (plastic, _) in headers.items():
        a.feature(f"header_{name}", [f for f in plastic.faces() if f.geom_type.name == "PLANE" and f.normal_at().Z < -0.9])
    a.feature("pcb_bottom", [f for f in pcb.faces() if f.geom_type.name == "PLANE" and f.normal_at().Z < -0.9])
    a.write()


if __name__ == "__main__":
    build()
