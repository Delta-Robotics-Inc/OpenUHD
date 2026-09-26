"""ULN2003 stepper driver board (28BYJ-48 companion) — representative geometry (PB-796).

No maker of this generic board publishes a dimensioned drawing or CAD (see
the part's data_gap trait). The layout follows the annotated photo on the
Kiatronics "4 Phase ULN2003 Stepper Motor Driver PCB" sheet
(electronicoscaldas.com/datasheet/ULN2003A-PCB.pdf, src_kiatronics_board):
four LEDs A-D along the top edge, the 5-pin motor socket below them on the
left, the ULN2003AN DIP-16 in the middle, the IN1-IN4 header along the
bottom edge, and the supply pins (- +, 5-12V) with the ON/OFF jumper on the
right edge, plus four corner mounting holes.

ALL dimensions here are assumptions (`assumption` traits on the part):
  - board 35 x 32 x 1.6 mm (ProtoPart's approximate size; "boards from
    different vendors vary by a millimetre or two")
  - four Ø3 corner holes, 2.5 mm from each edge (so 30 x 27 mm centres)
  - JST XH 5-pin top-entry socket body 12.4 x 5.75 x 7 mm (2.5 mm pitch x 5)
  - DIP-16 body 19.3 x 6.4 x 3.3 mm; 2.54 mm pin headers 2.5 mm square x 8.5 mm

Coordinates: board bottom at z = 0, components on +Z, board centred on the
origin, LEDs/motor socket toward +Y, input header toward -Y, power pins +X.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from partkit import GeneratedPart, block, board, cylinders, extreme_face

PART = "generic-uln2003-stepper-driver-board"

L, W, T = 35.0, 32.0, 1.6
INSET = 2.5
HOLE_D = 3.0
HX, HY = L / 2 - INSET, W / 2 - INSET  # 15.0, 13.5


def build() -> None:
    a = GeneratedPart(PART, "generic-uln2003-stepper-driver-board", __file__)

    pcb = board(L, W, T, [(x, y) for x in (-HX, HX) for y in (-HY, HY)], HOLE_D)
    socket = block(-5.0, 6.5, T, 12.4, 5.75, 7.0)  # motor socket A B C D PWR
    ic = block(-3.0, -2.5, T, 19.3, 6.4, 3.3)  # ULN2003AN
    inputs = block(-5.0, -11.5, T, 4 * 2.54, 2.5, 8.5)  # IN1..IN4
    power = block(12.5, -4.0, T, 2.5, 2 * 2.54, 8.5)  # - +
    jumper = block(12.5, 3.0, T, 2.5, 2 * 2.54, 8.5)  # motor ON/OFF jumper pair
    leds = [block(-10.5 + 5.5 * k, 12.5, T, 3.0, 3.0, 3.0) for k in range(4)]

    a.body(pcb, "pcb")
    a.body(socket, "motor_socket")
    a.body(ic, "uln2003an")
    a.body(inputs, "in_header")
    a.body(power, "power_header")
    a.body(jumper, "pwr_jumper")
    for k, led in enumerate(leds):
        a.body(led, f"led_{'ABCD'[k]}")

    a.feature("mount", cylinders(pcb, HOLE_D), axis=(0, 0, 1))
    a.feature("motor_socket", extreme_face(socket, (0, 0, 1)))
    a.feature("in_header", extreme_face(inputs, (0, 0, 1)))
    a.feature("power_header", extreme_face(power, (0, 0, 1)))
    a.feature("pwr_jumper", extreme_face(jumper, (0, 0, 1)))
    a.write()


if __name__ == "__main__":
    build()
