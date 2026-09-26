"""REV Robotics SPARK Flex Motor Controller (REV-11-2159): bind UHD interfaces to vendor CAD.

REV publishes no stand-alone SPARK Flex STEP: the product page's "NEO Vortex &
SPARK Flex STEP FILE" is the docked pair
(https://revrobotics.com/content/cad/NEO-Vortex-Moter-and-SPARK-Flex-Motor-Controller-with-8mm-Shaft.STEP,
22.5 MB, not committed: REV states no redistribution licence). `extract()`
copies its "REV-11-2159" sub-assembly (the SPARK Flex, unchanged
coordinates) to REV-11-2159-extracted.step next to the download, and the
binding reads that; the manifest's sourceDigest is still the sha256 of the
downloaded file (`archive`).

Extraction detail (audited PB-796): the combined file's top level holds
"REV-11-2159" at identity placement plus REV-21-1652 (NEO Vortex), 4 x
REV-21-3204 (docking screws), REV-21-2807 and REV-21-2805 (shaft parts).
Only "REV-11-2159" is kept, with all 16 of its children (P01 housing, P02,
P03 control wires, 2 x P04, 2 x P08 power leads, 2 x P09, 3 x P11 phase
contacts, ISDF-05-D-M, TFM-105-02-L-DH-TR, the 0.8 mm 2x10 BTB header,
EVQP7-JA-01P); no transform is applied, so the extracted coordinates equal
the combined file's.

Vendor frame (no transform): the mounting face (six #10-32 holes on a 2 in
bolt circle, docking-screw counterbores) is the plane y = 0 and faces -Y; the
body runs to y = 28.2 (28.2 mm body length, not docked) where the NEO Vortex
docks; the 16.5 mm through bore is on the Y axis. The power leads (P08 x2)
and CAN/PWM control wires (P03) leave toward +X and are modelled out to
x = 331.8. A transform is avoided because vendor_step.find() returns
labelled components in their untransformed position.

Labelled direct children are selected by label; nested ones (the Samtec TFM
data-port header and the USB4110 USB-C receptacle inside
"TFM-105-02-L-DH-TR") carry local coordinates, so those two are selected by
position instead.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from build123d import Compound, export_step, import_step

from vendor_step import VendorStep, build as build_vendor, find, holes, label, planar, research_cad, within_box

DOWNLOAD = "NEO-Vortex-Moter-and-SPARK-Flex-Motor-Controller-with-8mm-Shaft.STEP"
EXTRACTED = "REV-11-2159-extracted.step"


def extract() -> None:
    """Write the SPARK Flex sub-assembly of the combined REV STEP to EXTRACTED (once)."""
    d = research_cad("rev-spark-flex")
    if (d / EXTRACTED).exists() or not (d / DOWNLOAD).exists():
        return
    flex = find(import_step(str(d / DOWNLOAD)), "REV-11-2159")
    export_step(Compound(label="REV-11-2159", children=list(flex.children)), str(d / EXTRACTED))


def labelled(name):
    """Faces of every direct component labelled `name` (the STEP repeats labels, e.g. three phase contacts)."""

    def sel(shape):
        return [f for c in shape.children if c.label == name for f in c.faces()]

    return sel


def in_box(lo, hi):
    """Every face whose bounding-box centre lies inside lo..hi (mm)."""

    def sel(shape):
        out = []
        for f in shape.faces():
            c = f.bounding_box().center()
            if all(lo[i] <= (c.X, c.Y, c.Z)[i] <= hi[i] for i in range(3)):
                out.append(f)
        return out

    return sel


STEP = VendorStep(
    part_id="rev-spark-flex",
    step=EXTRACTED,
    archive=DOWNLOAD,
    name="REV-11-2159",
    url="https://revrobotics.com/content/cad/NEO-Vortex-Moter-and-SPARK-Flex-Motor-Controller-with-8mm-Shaft.STEP",
    licence="not stated by REV Robotics (not redistributed)",
    features={
        # six tapped #10-32 holes (modelled Φ4.04) on the 50.8 mm bolt circle, axis Y
        "mount": within_box(holes(4.04, tol=0.02, axis=(0, 1, 0), within="REV-11-2159-P01"), (-26, -1, -26), (26, 7, 26)),
        # the mounting face (y = 0, facing -Y)
        "mount_face": planar((0, -1, 0), within="REV-11-2159-P01", min_area=500),
        # Ø16.5 mm through bore on the Y axis
        "through_bore": holes(16.5, tol=0.05, axis=(0, 1, 0), within="REV-11-2159-P01"),
        # dock interface: three motor-phase contacts and the 2x10 0.8 mm board-to-board sensor connector
        "dock_phases": labelled("REV-11-2159-P11"),
        "dock_sensor": label("0_8BTB_male_7_5H_2X10P--No_side_positioning_plate"),
        # integrated leads: 12 AWG power pair (P08 x2) and 26 AWG CAN/PWM control wires (P03)
        "power_leads": labelled("REV-11-2159-P08"),
        "control_wires": label("REV-11-2159-P03"),
        # Samtec TFM 2x5 1.27 mm Data Port header with its mated ISDF latching housing, and the USB-C receptacle
        "data_port": in_box((14.5, 15.0, 8.5), (32.2, 24.0, 24.7)),
        "usb_c": in_box((14.5, 15.0, -6.5), (28.5, 24.0, 8.0)),
    },
    # dock_sensor and usb_c are left out: some of their faces do not thicken (vendor_step exports interface GLBs by thickening)
    interfaces=["mount", "dock_phases", "data_port"],
    notes=[
        "SPARK Flex sub-assembly 'REV-11-2159' extracted unchanged from REV's combined NEO Vortex + SPARK Flex STEP (sourceDigest = the combined download).",
        "No transform: mounting face y = 0 (normal -Y), body to y = 28.2, through bore on the Y axis.",
        "mount: 6 x Φ4.04 (tapped #10-32 as modelled) on a 50.8 mm circle at 0/45/135/180/225/315 deg in the XZ plane (none at 90/270, the flat sides).",
        "Docking-screw counterbores (Φ3.4 / Φ6.4-6.5) at (±13.25, 0, ±22.37): 4 x M3 x 25 mm SHCS to the NEO Vortex.",
        "Leads are modelled to x = 331.8 (the bbox); REV specifies 450 mm power and control leads.",
    ],
)


def build() -> None:
    extract()
    build_vendor(STEP)


if __name__ == "__main__":
    build()
