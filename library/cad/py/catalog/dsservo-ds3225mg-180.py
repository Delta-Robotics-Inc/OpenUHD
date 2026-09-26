"""DSSERVO DS3225MG — bound to DSSERVO's own STEP (PB-796).

DSSERVO publishes no DS3225 model; its download page offers "DS3218-3d.rar"
(DS3218.stp). The DS3218 and DS3225 datasheets carry the identical case
drawing (40 x 20 x 40.4 mm case, 54.5 mm flange, 49.5 x 10 mm holes,
27.7 mm to the flange), so the DS3218 STEP is used as the DS3225MG body.
This is recorded as an `assumption` trait on the part (same housing,
different gearbox/motor inside). The STEP is not committed (no licence is
stated); the rar is fetched into .research/cad by the part research.

Vendor model: Y-up (output spline along +Y at x = 10), case bottom at
y = -20, flange underside at y = 7.6. `transform` rotates +90° about X so
the spline points +Z: (x, y, z) -> (x, -z, y). After it, the flange
underside is at z = 7.6, the case bottom at z = -20, the spline axis at
(10, 0), and the flange holes at (±24.75, ±5).

Vendor components (names are pinyin/Chinese abbreviations): ZK (middle
case), DG-SZ (bottom cover), GE (gear/output), XIANTAO (cable gland),
SG-JIANRONG-MG996 (flange with rubber grommets), LV-DUOBAN (aluminium
horn, an accessory, included in the model). Selectors use geometry boxes,
not `within=` component names, because component lookups bypass the
transform (vendor_step.find returns the untransformed child).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import Location

from vendor_step import VendorStep, build as build_vendor, holes, planar, within_box

PART = "dsservo-ds3225mg-180"


def build():
    build_vendor(
        VendorStep(
            part_id=PART,
            step="DS3218.stp",
            archive="DS3218-3d.rar",
            name="DS3218",
            transform=Location((0, 0, 0), (90, 0, 0)),
            features={
                # 4 x Ø4.5 flange holes on 49.5 x 10 mm (drawing), axis +Z after the transform
                "flange_mount": within_box(holes(4.5), (-26, -6, 5), (26, 6, 13)),
                # underside of the flange ears: the face that sits on the mounting plate
                "flange_underside": within_box(planar((0, 0, -1), extreme=None, min_area=5.0), (-28, -11, 7.0), (28, 11, 8.2)),
                # Ø6.0 output spline / horn hub cylinder on the output axis above the case
                "output_spline": within_box(holes(6.0, axis=(0, 0, 1)), (8, -2, 17), (12, 2, 21.7)),
                # the three Ø1.5 wire stubs where the lead leaves the cable gland (XIANTAO), axis +X
                "servo_lead": within_box(holes(1.5, axis=(1, 0, 0)), (28, -3, -13), (36, 3, -10)),
            },
            interfaces=["flange_mount", "output_spline"],
            url="https://www.dsservo.com/down.asp?id=25",
            licence="not stated on the DSSERVO download page; not redistributed",
            notes=[
                "DS3218 STEP used for the DS3225MG: DSSERVO's DS3218 and DS3225 datasheets show the identical case drawing.",
                "transform: +90 deg about X (vendor Y-up -> Z-up); spline axis at (10, 0), flange underside z = 7.6, case bottom z = -20.",
                "LV-DUOBAN is the aluminium horn accessory; it is part of the vendor model.",
            ],
        )
    )


if __name__ == "__main__":
    build()
