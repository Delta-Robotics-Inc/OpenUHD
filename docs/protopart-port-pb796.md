# ProtoPart → UHD port: 30 robotics parts with CAD (PB-796)

Thirty parts from the ProtoPart library
(`Delta-Robotics-Inc/ProtoPart/protoparts/`) are now UHD modules in
`library/parts/`. Each one went through the part skills
(`skills/uhd-part-research`, `uhd-part-author`, `uhd-part-verify`):
cited sources with sha256, a datasheet-honest `ModuleDef`, the automated
checks, and an independent evidence audit. **Each also has 3D CAD bound to
its physical interfaces**, which is new with this issue.

## Selection

The goal was the parts a robot is most often built from, taking the
ProtoPart entries that have good manufacturer documentation and, where
possible, manufacturer CAD. The coverage:

- **Actuation:** FRC/FTC smart controllers (SPARK MAX, SPARK Flex, Talon
  SRX), H-bridge ICs (DRV8871, L293D), Arduino motor and servo shields,
  stepper motors and drivers (NEMA 17 + DM542T, 28BYJ-48 + ULN2003), and
  servos.
- **Motors and ESCs:** brushless (NEO, EMAX 2205) and brushed with encoder
  (Core Hex, N20).
- **Sensing:** encoders (Through Bore, CANcoder), IMUs (Pigeon 2.0, BMI270,
  LSM6DS3TR-C) and ToF distance (VL53L4CD).
- **Compute:** Raspberry Pi 5, Arduino UNO R3, ESP32-C3-DevKitM-1.
- **Power:** PDH (it has per-channel current monitoring), a buck-boost
  regulator, and a LiPo pack.

These were skipped:

- Parts already in UHD: arduino-nano, esp32-devkitc-v4, l298n,
  hcsr04, bme280, icm-42688-p, teensy-4-1, feather-nrf52, sg90, vl53l0x,
  17hs19, rp2040, xiao-esp32c3, esp32-d0wdq6 and attiny85.
- Pure mechanical hardware: brackets, gears, screws and wheels.
- Pneumatics, passives and non-robotics items.

ProtoPart has no CAN or RS485 transceiver ICs and no stand-alone current
sensor. CAN is covered by the bus interfaces of the FRC devices, and current
sensing by the PDH.

## Parts

In the table, "Facts" is confirmed out of checked in the independent audit.
Every part ended with 0 wrong and 0 unsupported facts.

| UHD id | Category | Source ProtoPart | CAD status | Verification |
|---|---|---|---|---|
| rev-spark-max | motor controller | rev-spark-max | vendor | 20/20 facts; verify 0 errors |
| rev-spark-flex | motor controller | rev-spark-flex-rev-11-2159 | vendor | 24/24; 0 errors |
| ctre-talon-srx | motor controller | ctre-talon-srx | vendor | 21/21; 0 errors |
| ti-drv8871 | motor driver IC | texas-instruments-drv8871 | generated | 22/22; 0 errors |
| ti-l293dne | motor driver IC | l293d-motor-driver-ic | generated | 25/25; 0 errors |
| adafruit-1438-motor-shield-v2 | motor driver shield | adafruit-motor-shield-v2 | vendor-committed (MIT) | 18/18; 0 errors |
| adafruit-1411-16ch-pwm-servo-shield | servo driver shield | adafruit-16ch-pwm-servo-shield | generated | 19/19; 0 errors |
| stepperonline-17hs08-1004s | stepper motor | stepperonline-17hs08-1004s | generated | 20/20; 0 errors |
| stepperonline-dm542t-v4 | stepper driver | stepperonline-dm542t | generated | 19/19; 0 errors |
| generic-28byj-48-5v | stepper motor | 28byj-48-stepper-motor-5v | generated | 19/19; 0 errors |
| generic-uln2003-stepper-driver-board | stepper driver | uln2003-stepper-driver-board | generated | 21/21; 0 errors |
| rev-41-1097-smart-robot-servo | servo | rev-41-1097-smart-robot-servo | vendor | 19/19; 0 errors |
| dsservo-ds3225mg-180 | servo | makerfocus-ds3225mg-25kg-digital-servo-high-torque | vendor (DS3218 model, identical drawing) | 19/19; 0 errors |
| rev-neo-brushless-v1-1 | BLDC motor | rev-neo-brushless | vendor | 21/21; 0 errors |
| rev-41-1300-core-hex-motor | DC gearmotor + encoder | rev-41-1300-core-hex-motor | vendor | 17/17; 0 errors |
| sparkfun-rob-28633 | DC gearmotor + encoder | sparkfun-rob-28633 | generated | 20/20; 0 errors |
| emax-rs2205-2300kv | BLDC motor | emax-rs2205-2300kv | generated | 19/19; 0 errors |
| hakrc-bls-35a-4in1-esc | ESC | hakrc-bls-35a-4in1 | generated | 18/18; 0 errors |
| rev-through-bore-encoder-v1 | encoder | rev-through-bore-encoder | vendor | 21/21; 0 errors |
| ctre-cancoder | encoder | ctre-cancoder | vendor | 19/19; 0 errors |
| ctre-pigeon-2 | IMU | ctre-pigeon-2 | vendor | 20/20; 0 errors |
| bosch-bmi270 | IMU IC | bosch-bmi270 | generated | 19/19; 0 errors |
| st-lsm6ds3tr-c | IMU IC | lsm6ds3tr-c | generated | 17/17; 0 errors |
| raspberry-pi-5 | SBC | raspberry-pi-5 | vendor (MIT, 77.6 MB, not committed) | 20/20; 0 errors |
| arduino-uno-rev3 | MCU board | arduino-uno-rev3 | generated (from Arduino's Eagle .brd) | 17/17; 0 errors |
| espressif-esp32-c3-devkitm-1-n4x | MCU board | espressif-esp32-c3-devkitm-1-n4x | generated | 21/21; 0 errors |
| adafruit-5396-vl53l4cd | ToF distance | adafruit-vl53l4cd-breakout | vendor-committed (MIT) | 22/22; 0 errors |
| rev-power-distribution-hub | power distribution + current monitoring | rev-pdh | vendor | 24/24; 0 errors |
| ti-tps63020dsjr | regulator IC | tps63020dsjr | generated | 20/20; 0 errors |
| ovonic-4s-1300mah-120c-xt60 | LiPo battery | ovonic-4s-1300mah-120c-xt60 | generated | 19/19; 0 errors |

### Totals

- **By category:**
  - 7 motor controllers and drivers
  - 4 steppers and stepper drivers
  - 2 servos
  - 4 motors
  - 1 ESC
  - 2 encoders
  - 3 IMUs
  - 3 MCUs and SBCs
  - 1 distance sensor
  - 3 power
- **By CAD status:**
  - 12 vendor (manufacturer STEP, not redistributed)
  - 2 vendor-committed (Adafruit, MIT)
  - 16 generated
- **Audit:** 600 facts checked, all confirmed after repairs.
- **Automated checks:** `scripts/verify-part.ts` reports 0 errors on every part. The warnings are explained in each part's modelling notes; most say that no operating temperature is published.

## CAD

- **Vendor.** `library/cad/py/catalog/<id>.py` configures
  `library/cad/py/vendor_step.py`, which is `gnss_vendor.py` made reusable.
  - It selects features by vendor component name or by geometry (holes of a
    given diameter, planar faces, boxes).
  - It converts the STEP to GLB under `artifacts/cad/vendor/`, which is
    gitignored.
  - It writes the committed manifest `artifacts/cad/<id>-vendor.manifest.json`.
    The manifest holds signatures, hole and shaft axes, the bbox and the licence.
- **Generated.** `library/cad/py/partkit.py` builds representative geometry
  from the datasheet drawing. The STEP, GLB and manifest are committed. The
  part carries a `data_gap` trait for "manufacturer CAD" that says where
  research looked.
- **Checks.** `library/cad/checks.ts` runs from `verify-part.ts` and from
  `test/pb796-parts.test.ts`. It checks for:
  - a body;
  - `checkGeometryBindings` with no errors;
  - a frame on every bolt pattern and shaft;
  - bolt-pattern holes, placed by the frame and the part's parameters, that
    land on CAD hole axes (within 0.5 mm);
  - shaft frames on the shaft axis;
  - vendor CAD recorded in `sources.json` as `type: "cad"` with a sha256 and
    a `licence`.

## Notable ProtoPart discrepancies (manufacturer values used)

Each of these is recorded on the part as a `source_discrepancy` trait.

- **HAKRC BLS 35A 4-in-1**
  - **ProtoPart:** STM32F421/AM32, M2 holes, 28 × 28 mm.
  - **HAKRC's page:** EFM8BB21/BLHeli_S, 20 × 20 mm M3 holes, 31 × 30 × 6 mm.
  - **Open question:** it is unclear which board the ProtoPart build actually has.
- **SPARK MAX:** ProtoPart says 6–16 V; REV says 5.5–24 V. ProtoPart also has no data port, USB or PWM interfaces.
- **PDH:** ProtoPart lists 6 channels. REV lists 20 high-current, 3 low-current and 1 switchable, at 4.7–18 V.
- **Talon SRX:** ProtoPart says 6–16 V, 40 A. CTRE says 6–28 V, 60 A continuous and 100 A for 2 s.
- **CANcoder and Pigeon 2.0:** ProtoPart says 5–24 V, 100 mA for both. CTRE says 6–16 V, 60 mA for the CANcoder and 6–28 V, 46 mA for the Pigeon.
- **Arduino UNO:**
  - The mounting holes are wrong in ProtoPart.
  - VIN: ProtoPart says 7–12 V; Arduino says 6–20 V.
  - Per-pin current: ProtoPart says 40 mA; Arduino's figure is 20 mA.
- **ESP32-C3-DevKitM-1:** ProtoPart lists GPIO11–17, which are not on the headers.
- **EMAX RS2205:**
  - Voltage: ProtoPart gives 9–25.2 V; EMAX gives 3–4S.
  - Current: ProtoPart's 30/45 A has no EMAX source.
  - The "16 × 19" mount is a cross of 16 mm and 19 mm diagonals, not a rectangle.
- **DS3225MG:** ProtoPart says 6.0–7.4 V and IP67; DSSERVO says 4.8–6.8 V and IP66.
- **DM542T:** ProtoPart mixes the old spec and V4.0. The part is locked to V4.0.
- **Motor shield v2:** ProtoPart gets these wrong: the address-jumper count, the servo header layout and the height.
- **DRV8871:** ProtoPart's logic thresholds are wrong.
- **TPS63020:** ProtoPart gives a "4 A input", which is actually the switch current limit.

## Open decisions

1. **CAD licences.**
   - **REV and CTRE** state no licence for their STEP files. REV's IP policy allows only non-commercial use.
   - **DSSERVO** states no licence either.
   - **Storage.** All of these STEP files stay in `.research/cad/`. Only the derived feature manifests are committed.
   - **Decision:** do we ask these vendors for permission?
   - **Raspberry Pi 5.** Its model is MIT but 77.6 MB. It could be committed through Git LFS.
2. **Vocabulary gaps** have been logged but not added. They are:
   - stepper and step/dir types;
   - brushed motor outputs;
   - encoder vocabulary: the Through Bore Encoder does not mate with SPARK MAX;
   - RC servo ports, including DS3225 with the servo shield;
   - Arduino shield headers;
   - CAN as a role family in `roles.ts`;
   - a two-diameter "cross" bolt pattern.
3. **Stepper role names.** The role "motor" on `stepperonline-17hs19-2004s1`
   and the stepper-output role on `adafruit-1438-motor-shield-v2` (both
   copied from older patterns) should converge on the input/output roles the
   new stepper parts use.
4. **Downloads that need a login or a browser:**
   - StepperOnline STEP files (17HS08, DM542T), blocked by a Cloudflare check;
   - TI's Ultra Librarian models;
   - ST's site, which was unreachable.
