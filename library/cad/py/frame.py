"""Custom 5-inch frame, generated from UHD (PB-775).

The frame is the one module whose CAD is *derived* from its interfaces: every
mounting feature is placed from a bolt pattern the frame's UHD definition
mirrors (quadcopter-5in-frame), and the frame's interface frames are written
back to UHD from the same numbers (FRAMES below → frame.geometry.json).

Coordinates: X forward, Y left, Z up; origin at the stack centre on the
underside of the bottom plate. Motor order is Betaflight Quad-X.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

from build123d import (
    Align,
    Axis,
    Box,
    CenterOf,
    BuildPart,
    Cylinder,
    Locations,
    Mode,
    Pos,
    Rot,
    fillet,
)

from common import PARAMS, Artifact, system_dir

HERE = Path(__file__)
MIN = (Align.CENTER, Align.CENTER, Align.MIN)

F = PARAMS["frame"]
T = F["plate_thickness"]
TOP_Z = T + 30  # 30 mm standoffs between plates (design)
TOP_T = 2.0
BOSS = 0.5  # raised motor pads: the motor face mates on a distinct planar face
HALF = F["wheelbase"] / 2 / math.sqrt(2)  # motor centre offset on X and Y
CORNERS = {"fl": (1, 1), "fr": (1, -1), "rl": (-1, 1), "rr": (-1, -1)}
STANDOFFS = [(x, y) for x in (-28, 28) for y in (-24, 24)]
VTX_X = -45.0
GPS_X = -52.0
CAMERA_X = 50.0
CAM_Z = T + 10.0
cam_inner = F["camera_width"] / 2


def square(spacing: float) -> list[tuple[float, float]]:
    s = spacing / 2
    return [(x, y) for x in (-s, s) for y in (-s, s)]


def build() -> dict:
    a = Artifact("quadcopter-5in-frame", system_dir("quadcopter-5in"), HERE)

    with BuildPart() as bottom:
        with Locations(Pos(-1.5, 0, 0)):
            Box(127, 56, T, align=MIN)  # body, x -65 … 62
        for key, (sx, sy) in CORNERS.items():
            ang = math.degrees(math.atan2(sy, sx))
            length = math.hypot(HALF, HALF)
            with Locations(Rot(0, 0, ang) * Pos(length / 2, 0, 0)):
                Box(length, F["arm_width"], T, align=MIN)
            with Locations(Pos(sx * HALF, sy * HALF, 0)):
                Cylinder(12, T, align=MIN)
        fillet(bottom.edges().filter_by(Axis.Z), radius=1.5)
        # stack holes and standoff holes
        with Locations(*square(F["stack_spacing"])):
            Cylinder(1.6, T, align=MIN, mode=Mode.SUBTRACT)
        with Locations(*STANDOFFS):
            Cylinder(1.6, T, align=MIN, mode=Mode.SUBTRACT)
        with Locations(*[(VTX_X + x, y) for x, y in square(F["vtx_spacing"])]):
            Cylinder(1.1, T, align=MIN, mode=Mode.SUBTRACT)
        # lightening slot down the middle of each arm
        for key, (sx, sy) in CORNERS.items():
            ang = math.degrees(math.atan2(sy, sx))
            with Locations(Rot(0, 0, ang) * Pos(72, 0, 0)):
                Box(40, 5, T, align=MIN, mode=Mode.SUBTRACT)

    with BuildPart() as pads:
        for key, (sx, sy) in CORNERS.items():
            with Locations(Pos(sx * HALF, sy * HALF, T)):
                Cylinder(11, BOSS, align=MIN)
                with Locations(*[(r * math.cos(math.radians(90 * k)), r * math.sin(math.radians(90 * k))) for k in range(4) for r in [F["motor_bolt_circle"] / 2]]):
                    Cylinder(1.6, BOSS, align=MIN, mode=Mode.SUBTRACT)
                Cylinder(3.5, BOSS, align=MIN, mode=Mode.SUBTRACT)  # shaft/circlip relief
    # through holes under the pads
    for key, (sx, sy) in CORNERS.items():
        with BuildPart() as holes:
            with Locations(Pos(sx * HALF, sy * HALF, 0)):
                with Locations(*[(8 * math.cos(math.radians(90 * k)), 8 * math.sin(math.radians(90 * k))) for k in range(4)]):
                    Cylinder(1.6, T, align=MIN)
                Cylinder(3.5, T, align=MIN)
        bottom.part = bottom.part - holes.part

    with BuildPart() as plates:  # camera side plates
        for side in (1, -1):
            with Locations(Pos(CAMERA_X, side * (cam_inner + 1), T)):
                Box(20, 2, 22, align=MIN)
        # two M2 holes per side, 16 mm apart vertically (O4 camera side holes)
        for dz in (-8, 8):
            with Locations(Pos(CAMERA_X, 0, CAM_Z + dz) * Rot(90, 0, 0)):
                Cylinder(1.1, 2 * (cam_inner + 2), mode=Mode.SUBTRACT)

    # standoff holes in the bottom plate (the standoffs are hardware now)
    with BuildPart() as standoff_holes:
        with Locations(*STANDOFFS):
            Cylinder(1.6, T, align=MIN)
    bottom.part = bottom.part - standoff_holes.part

    a.body(bottom.part, "bottom_plate")
    a.body(pads.part, "motor_pads")
    a.body(plates.part, "camera_plates")

    # ---- interface features (D1 names = UHD interface ids) -----------------
    def near(faces, x, y, r):
        return [f for f in faces if math.hypot(f.center(CenterOf.MASS).X - x, f.center(CenterOf.MASS).Y - y) < r]

    at = lambda f: f.center(CenterOf.MASS)
    pad_tops = pads.part.faces().filter_by(Axis.Z).filter_by(lambda f: at(f).Z > T + BOSS / 2)
    for key, (sx, sy) in CORNERS.items():
        a.feature(f"motor_mount_{key}", near(pad_tops, sx * HALF, sy * HALF, 12))
    cyl = lambda part: [f for f in part.faces() if f.geom_type.name == "CYLINDER"]
    a.feature("stack_mount", [f for f in cyl(bottom.part) if abs(abs(at(f).X) - F["stack_spacing"] / 2) < 0.2 and abs(abs(at(f).Y) - F["stack_spacing"] / 2) < 0.2 and f.radius < 2])
    a.feature("vtx_mount", [f for f in cyl(bottom.part) if abs(abs(at(f).X - VTX_X) - F["vtx_spacing"] / 2) < 0.2 and f.radius < 1.2])
    a.feature("standoff_mount", [f for f in cyl(bottom.part) if any(math.hypot(at(f).X - x, at(f).Y - y) < 0.2 for x, y in STANDOFFS)])
    a.feature("camera_mount", [f for f in plates.part.faces() if f.geom_type.name == "PLANE" and abs(f.normal_at().Y) > 0.9 and abs(at(f).Y) < cam_inner + 0.5])
    a.write()

    # ---- top plate: its own module; origin at the standoff centre, underside
    t = Artifact("quadcopter-5in-top-plate", system_dir("quadcopter-5in"), HERE)
    with BuildPart() as top:
        with Locations(Pos(-10, 0, 0)):
            Box(120, 56, TOP_T, align=MIN)  # x -70 … 50
        fillet(top.edges().filter_by(Axis.Z), radius=4)
        with Locations(*STANDOFFS):
            Cylinder(1.6, TOP_T, align=MIN, mode=Mode.SUBTRACT)
        with Locations(*[Pos(GPS_X + x, y, 0) for x, y in square(F["gps_spacing"])]):
            Cylinder(1.1, TOP_T, align=MIN, mode=Mode.SUBTRACT)
        for x in (-14, 28):  # battery strap slots
            with Locations(Pos(x, 0, 0)):
                Box(3, 22, TOP_T, align=MIN, mode=Mode.SUBTRACT)
    t.body(top.part, "top_plate")
    t.feature("standoff_mount", [f for f in cyl(top.part) if any(math.hypot(at(f).X - x, at(f).Y - y) < 0.2 for x, y in STANDOFFS)])
    t.feature("gps_mount", [f for f in cyl(top.part) if abs(abs(at(f).X - GPS_X) - F["gps_spacing"] / 2) < 0.2 and f.radius < 1.2])
    t.write()

    # ---- frames for UHD (same numbers as the geometry above) ---------------
    frames = {
        "stack_mount": {"origin": [0, 0, T], "normal": [0, 0, 1], "xAxis": [1, 0, 0], "symmetryDeg": 90},
        "vtx_mount": {"origin": [VTX_X, 0, T], "normal": [0, 0, 1], "xAxis": [1, 0, 0], "symmetryDeg": 90},
        "standoff_mount": {"origin": [0, 0, T], "normal": [0, 0, 1], "xAxis": [1, 0, 0], "symmetryDeg": 180},
        "camera_mount": {"origin": [CAMERA_X, 0, CAM_Z], "normal": [0, -1, 0], "xAxis": [1, 0, 0]},  # mid-plane of the clamp
        # circle patterns: xAxis points at hole 1. The pads' holes are at k·90°,
        # i.e. 45° off the arm, so motor leads (between two holes) run down the arm.
        **{
            f"motor_mount_{k}": {"origin": [round(sx * HALF, 3), round(sy * HALF, 3), T + BOSS], "normal": [0, 0, 1], "xAxis": [1, 0, 0], "symmetryDeg": 90}
            for k, (sx, sy) in CORNERS.items()
        },
    }
    out = system_dir("quadcopter-5in") / "quadcopter-5in-frame.frames.json"
    out.write_text(json.dumps(frames, indent=2) + "\n")
    top_frames = {
        "standoff_mount": {"origin": [0, 0, 0], "normal": [0, 0, -1], "xAxis": [1, 0, 0], "symmetryDeg": 180},
        "gps_mount": {"origin": [GPS_X, 0, TOP_T], "normal": [0, 0, 1], "xAxis": [1, 0, 0], "symmetryDeg": 90},
    }
    (system_dir("quadcopter-5in") / "quadcopter-5in-top-plate.frames.json").write_text(json.dumps(top_frames, indent=2) + "\n")
    return frames


if __name__ == "__main__":
    print("frame:")
    build()
