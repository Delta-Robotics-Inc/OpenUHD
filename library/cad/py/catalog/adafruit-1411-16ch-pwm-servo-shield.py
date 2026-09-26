"""Adafruit 16-Channel 12-bit PWM/Servo Shield (product 1411): representative geometry (PB-796).

No manufacturer STEP exists: Adafruit_CAD_Parts (MIT) has no 1411 folder (its
"815 Servo Driver 16 Channel" is the breakout, a different board), and the
product's GitHub repo (adafruit/Adafruit-16-channel-PWM-Servo-Shield, CC BY-SA
3.0) holds only the EagleCAD .brd/.sch. So the board is generated from the
Eagle board file (sources.json src_eagle_brd, commit f44d218), in the Eagle
coordinates: origin at the board's lower-left corner (the Arduino power-header
edge along y = 0), board bottom at z = 0, component side +Z.

From the .brd (cited):
  outline   ARDUINOR3_ICSP package, layer 20: 68.58 x 53.34 mm with the R3
            chamfers at (66.04,2.54)-(68.58,5.08), (68.58,37.846)-(66.04,40.386),
            (66.04,51.816)-(64.516,53.34)
  holes     4 x drill 3.2 mm at (13.97,2.54) (15.24,50.8) (66.04,7.62) (66.04,35.56)
  headers   Arduino pads on y = 2.54 (IOREF..VIN x 27.94-45.72; A0..A5 x 50.8-63.5)
            and y = 50.8 (SCL..D8 x 18.796-41.656; D7..D0 x 45.72-63.5), 2.54 pitch
  servo     3X04 headers JP2/JP1/JP6/JP5 centred at x = 15.24/27.94/43.18/55.88,
            y = 12.827, R180: signal row y = 15.367, V+ row 12.827, GND row 10.287;
            channel 0 at x = 11.43, pitch 2.54, groups of 4
  terminal  J1 1X2-3.5MM at (3.683, 25.781) R270: silk body x 0.083-7.083,
            y 22.181-29.181; pin 1 (PWRIN / V+) y = 23.981, pin 2 (GND) y = 27.481;
            wire entry toward the x = 0 board edge

Assumed (not in any source; `assumption` traits on the part):
  PCB thickness 1.6 mm; 3x4 servo header envelope 8.5 mm above the board;
  terminal block 8.5 mm tall; Arduino male header plastic 2.54 mm below the board.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import BuildPart, BuildSketch, Cylinder, Locations, Mode, Polygon, extrude, Align

from partkit import GeneratedPart, block, cylinders, extreme_face

PART = "adafruit-1411-16ch-pwm-servo-shield"
T = 1.6  # PCB thickness (assumed)

OUTLINE = [
    (0, 0), (66.04, 0), (66.04, 2.54), (68.58, 5.08), (68.58, 37.846),
    (66.04, 40.386), (66.04, 51.816), (64.516, 53.34), (0, 53.34),
]
HOLES = [(13.97, 2.54), (15.24, 50.8), (66.04, 7.62), (66.04, 35.56)]
HOLE_D = 3.2

SERVO_GROUPS = {"servo_header_0_3": 15.24, "servo_header_4_7": 27.94, "servo_header_8_11": 43.18, "servo_header_12_15": 55.88}
SERVO_Y, SERVO_H = 12.827, 8.5  # header centre row (V+), envelope height (assumed)

# Arduino R3 header rows (first pad x, last pad x, row y)
ARDUINO_HEADERS = {
    "arduino_header_power": (27.94, 45.72, 2.54),     # RESERVED IOREF RESET 3V 5V GND GND VIN
    "arduino_header_analog": (50.8, 63.5, 2.54),      # A0..A5 (A4 = SDA, A5 = SCL)
    "arduino_header_digital_hi": (18.796, 41.656, 50.8),  # SCL SDA AREF GND D13..D8
    "arduino_header_digital_lo": (45.72, 63.5, 50.8),  # D7..D0
}
HDR = 2.54


def build() -> None:
    a = GeneratedPart(PART, "adafruit-1411-16ch-pwm-servo-shield", __file__)

    with BuildPart() as pcb:
        with BuildSketch():
            Polygon(*OUTLINE, align=None)
        extrude(amount=T)
        with Locations(*HOLES):
            Cylinder(HOLE_D / 2, T, align=(Align.CENTER, Align.CENTER, Align.MIN), mode=Mode.SUBTRACT)
    board = a.body(pcb.part, "pcb")
    a.feature("mount", cylinders(board, HOLE_D), axis=(0, 0, 1))

    for name, cx in SERVO_GROUPS.items():
        hdr = a.body(block(cx, SERVO_Y, T, 4 * HDR, 3 * HDR, SERVO_H), name)
        a.feature(name, extreme_face(hdr, (0, 0, 1)))

    for name, (x0, x1, y) in ARDUINO_HEADERS.items():
        n = round((x1 - x0) / HDR) + 1
        hdr = a.body(block((x0 + x1) / 2, y, -HDR, n * HDR, HDR, HDR), name)
        a.feature(name, extreme_face(hdr, (0, 0, -1)))

    tb = a.body(block(3.583, 25.681, T, 7.0, 7.0, 8.5), "terminal_block_j1")
    a.feature("terminal_block_j1", extreme_face(tb, (-1, 0, 0)))

    a.write()


if __name__ == "__main__":
    build()
