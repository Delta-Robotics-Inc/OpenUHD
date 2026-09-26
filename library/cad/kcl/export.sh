#!/usr/bin/env bash
# Export the KCL track to STEP + GLB and fingerprint the interface artifacts.
# Needs `zoo auth login` (execution runs on the Zoo engine).
set -euo pipefail
cd "$(dirname "$0")"
ZOO=${ZOO:-zoo}
out=../../parts/meps-neon-2207-v2-1950kv/artifacts/cad/kcl
mkdir -p "$out/interfaces" ../../systems/quadcopter-5in/artifacts/cad/kcl
for fmt in step glb; do
  $ZOO kcl export --output-format="$fmt" motor.kcl "$out"
  $ZOO kcl export --output-format="$fmt" motor_base_mount.kcl "$out/interfaces"
  $ZOO kcl export --output-format="$fmt" frame.kcl ../../systems/quadcopter-5in/artifacts/cad/kcl
done
# signature of the motor face (D2): area + centroid from the engine
$ZOO kcl surface-area --output-unit=mm2 motor_base_mount.kcl
$ZOO kcl center-of-mass --output-unit=mm motor_base_mount.kcl
