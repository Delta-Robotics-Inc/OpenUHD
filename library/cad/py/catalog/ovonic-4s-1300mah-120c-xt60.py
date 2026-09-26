"""Ovonic 120C 14.8V 1300mAh 4S LiPo (XT60): representative pack geometry.

No manufacturer CAD: ovonicshop.com publishes no drawing or 3D model for
this pack (product page checked; see .research/gaps.json).

Dimensions from the Ovonic product page specification list:
  Length (dev. 5 mm) 76 mm, Width (dev. 2 mm) 35 mm, Height (dev. 2 mm) 30 mm.
The pack is a plain box (shrink-wrapped cells). The XT60 discharge lead and
JST-XH balance lead are flexible and their length is not stated, so the
connectors are not drawn; both leads are bound to the end face they exit
from. Which end face the leads exit is not stated: +X is assumed (the usual
layout: leads leave one short end).

Coordinates: pack centred in x/y, bottom face at z = 0, x along the 76 mm
length, y along the 35 mm width, z along the 30 mm height.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import Box, BuildPart  # noqa: E402

from partkit import MIN, GeneratedPart, extreme_face  # noqa: E402

LENGTH, WIDTH, HEIGHT = 76.0, 35.0, 30.0


def build() -> None:
    a = GeneratedPart("ovonic-4s-1300mah-120c-xt60", "ovonic-4s-1300", __file__)
    with BuildPart() as pack:
        Box(LENGTH, WIDTH, HEIGHT, align=MIN)
    a.body(pack.part, "pack")
    a.feature("lead_exit", extreme_face(pack.part, (1, 0, 0)))
    a.write()


if __name__ == "__main__":
    build()
