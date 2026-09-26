# Betaflight CLI reference: 5" quad (DolphinRC F405 V3 / MATEKF405TE)

Every item below was checked against the Betaflight source or the official docs. Nothing here comes from memory. Anything that could not be checked is marked **UNVERIFIED**.

## 0. Versions checked

| Source | Ref | Commit |
|---|---|---|
| Firmware (primary) | `betaflight/betaflight` tag **4.5.5**, the newest 4.5.x tag | `4adbd3ef7cb546947600e5f747bd5453c9573063` |
| Firmware (delta check) | tag **2025.12.5** | `7348054f268f0058574719c134e9f149565bb8ea` |
| Firmware (delta check) | tag **2026.6.2**, the newest stable release on 2026-09-26 | `e0b7bb01b17b21351057e9ead2d1ab39dd44fa16` |
| Target config (4.5) | `betaflight/config` branch `4.5-config`, `configs/MATEKF405TE/config.h` | `7b1f01a25d8cb6379ebeeeca9f0e91c24925e907` |
| Target config (master) | `betaflight/config` branch `master`, `configs/MTKS/MATEKF405TE/config.h` (the file has moved into a manufacturer folder) | `96910e90881573589b2a6c41f7392b7afad63973` |
| Docs | `betaflight/betaflight.com` master | `0589eb3b938ca3b9782aae6eb91f323604b9a39c` |

The `config.h` for MATEKF405TE is **byte-identical** on `4.5-config` and `master`. The `2025.12-config` branch points at the same commit as `4.5-config`.

Note: 4.5.x is **no longer the current stable line**. 2025.12.x and 2026.6.x have both shipped since. Where they differ from 4.5.5, the difference is flagged with a **Δ** marker.

Short link prefixes used below:
- `BF` = `https://github.com/betaflight/betaflight/blob/4.5.5/`
- `BF25` = `https://github.com/betaflight/betaflight/blob/2025.12.5/`
- `BF26` = `https://github.com/betaflight/betaflight/blob/2026.6.2/`
- `CFG` = `https://github.com/betaflight/config/blob/4.5-config/configs/MATEKF405TE/config.h`

---

## Final CLI block (4.5.5)

```
# ports: serial <identifier> <functionMask> <msp_baud> <gps_baud> <telem_baud> <blackbox_baud>
serial 0 2 115200 115200 0 115200        # UART1 -> GPS (FUNCTION_GPS=2), GPS baud 115200
serial 1 64 115200 57600 0 115200        # UART2 -> Serial RX (FUNCTION_RX_SERIAL=64) (already the target default)
serial 4 131073 115200 57600 0 115200    # UART5 -> MSP(1) + VTX_MSP(131072) = MSP DisplayPort for DJI O4

feature GPS
feature TELEMETRY          # needed for CRSF/ELRS telemetry back to the TX
feature OSD

set serialrx_provider = CRSF
set gps_provider = UBLOX
set gps_auto_config = ON
set osd_displayport_device = MSP
set vcd_video_system = HD
set motor_pwm_protocol = DSHOT600      # or DSHOT300
set dshot_bidir = ON
set motor_poles = 14
set current_meter = ADC
set ibata_scale = 150
set ibata_offset = 0
set mag_hardware = QMC5883             # AUTO also works; needs a MAG-enabled build (see section 4)
set align_mag = CW270FLIP
save
```

**Δ 2025.12.x / 2026.6.x:** the `serial` command takes a port *name* instead: `serial UART1 2 115200 115200 0 115200`, `serial UART2 64 ...`, `serial UART5 131073 ...`. The old numeric identifiers 0-19 are still accepted and are remapped as legacy values (see section 1). All the `set` lines are unchanged.

---

## 1. `serial` command, function bitmask, UART mapping

### Syntax (4.5.5)

`serial <identifier> <functionMask> <msp_baud> <gps_baud> <telemetry_baud> <blackbox_baud>`. All **6 arguments** are required.

- Parser: `BF src/main/cli/cli.c#L1288-L1375`. Output format `"serial %d %d %ld %ld %ld %ld"` is at L1290. The command fails with an invalid-argument error when `validArgumentCount < 6` (L1361-L1364).
- Baud limits the parser enforces (`cli.c#L1320-L1359`):
  - MSP: 9600 to 1000000
  - GPS: 9600 to **115200**
  - Telemetry: `0` (= AUTO) or up to 115200
  - Blackbox: 19200 to 2470000
- Baud table: `baudRates[] = {0, 9600, 19200, 38400, 57600, 115200, 230400, 250000, 400000, 460800, 500000, 921600, 1000000, 1500000, 2000000, 2470000}` at `BF src/main/io/serial.c#L114-L115`. `0` is `BAUD_AUTO` (`src/main/io/serial.h#L60`).
- Per-port defaults: MSP 115200, GPS 57600, telemetry AUTO, blackbox 115200 (`BF src/main/io/serial.c#L136-L142`).
- Docs: https://betaflight.com/docs/wiki/guides/current/Serial ("The `serial` CLI command takes 6 arguments").

### Function bitmask (`serialPortFunction_e`, `BF src/main/io/serial.h#L35-L54`)

| Function | Value |
|---|---|
| FUNCTION_MSP | 1 (L37) |
| FUNCTION_GPS | 2 (L38) |
| FUNCTION_TELEMETRY_SMARTPORT | 32 (L42) |
| FUNCTION_RX_SERIAL | 64 (L43) |
| FUNCTION_BLACKBOX | 128 (L44) |
| FUNCTION_VTX_MSP | 131072 (L53) |

The values are identical in 2025.12.5 and 2026.6.2 (`serial.h` L37, L38, L43, L53).

**TELEMETRY for ELRS:** there is **no CRSF telemetry function bit**. CRSF telemetry runs on the RX_SERIAL port itself:
- `initCrsfTelemetry()` enables only if `crsfRxIsActive()` (`BF src/main/telemetry/crsf.c#L731-L739`).
- It only runs when `FEATURE_TELEMETRY` is on (`BF src/main/fc/init.c#L976-L980`).

So ELRS needs `64` on the RX port plus `feature TELEMETRY`, and no extra bit. The docs confirm: "CRSF, GHST and F.Port receivers cannot share their port with a telemetry slot — they carry telemetry over the receiver protocol itself" (Serial guide, "Validation and Recovery").

### UART to identifier mapping (4.5.5)

`serialPortIdentifier_e` (`BF src/main/io/serial.h#L81-L101`):
- `SERIAL_PORT_USART1 = 0`, USART2 = 1, USART3 = 2, UART4 = 3, **UART5 = 4**, USART6 = 5
- `SERIAL_PORT_USB_VCP = 20`, SOFTSERIAL1 = 30

So in 4.5.5 **UART1 = 0, UART2 = 1, UART5 = 4**. These are fixed identifiers, not array positions. The `portConfigs[]` array puts VCP first (`serial.c#L69-L90`), but the CLI takes the identifier.

**Δ 2025.12+:**
- UART identifiers moved to 51+ (`SERIAL_PORT_USART1 = SERIAL_PORT_UART_FIRST = 51`, `BF25 src/main/io/serial.h#L97-L105`).
- The CLI prints and accepts names (`"serial %s %d ..."`, `BF25 src/main/cli/cli.c#L1292`). Names come from `serialPortNames[]` (`"UART1"`, `"UART5"`, ..., `BF25 src/main/io/serial.c#L147-L170`).
- Numeric 0-19 is still accepted: `identifier += SERIAL_PORT_UART1` for the legacy range 0..19 (`BF25 src/main/cli/cli.c#L1306-L1316`, `serial.h#L86-L87`). 2026.6.2 behaves the same (`BF26 src/main/cli/cli.c#L1414-L1509`).

**Δ future 2026.12 (unreleased):** the docs say `serial` becomes read-only and ports are assigned with `rx_uart`, `gps_uart`, `msp_uart_N`, `vtx_uart` and similar settings (Serial guide, "Per-Feature Port Assignment"). This does not apply to 4.5.5, 2025.12 or 2026.6.

### MATEKF405TE hardware UARTs

- The MCU target enables `USE_UART1` through `USE_UART6` plus VCP and softserial (`BF src/main/target/STM32F405/target.h#L35-L50`).
- The config defines pins for UART1 to UART6 (`CFG#L52-L63`):

| UART | TX | RX |
|---|---|---|
| UART1 | PA9 | PA10 |
| UART2 | PA2 | PA3 |
| UART3 | PC10 | PC11 |
| UART4 | PA0 | PA1 |
| UART5 | PC12 | PD2 |
| UART6 | PC6 | PC7 |

- No special or remapped UART numbering. The only target serial default is `SERIALRX_UART SERIAL_PORT_USART2` (`CFG#L123`). That makes UART2 = RX_SERIAL by default through `pgResetFn_serialConfig` (`BF src/main/io/serial.c#L160-L165`).
- **UNVERIFIED:** that the DolphinRC F405 V3 pads are labelled to match MATEK's UART numbering. Check the DolphinRC wiring diagram.

---

## 2. Settings

### Serial RX (ELRS)
- `set serialrx_provider = CRSF`. The setting is at `BF src/main/cli/settings.c#L769`, and the name comes from `src/main/fc/parameter_names.h#L45`.
- Allowed values (`lookupTableSerialRX`, `settings.c#L239-L256`): `NONE, SPEK2048, SBUS, SUMD, SUMH, XB-B, XB-B-RJ01, IBUS, JETIEXBUS, CRSF, SRXL, CUSTOM, FPORT, SRXL2, GHST, SPEK1024`.
- The default is already CRSF when the build includes `USE_SERIALRX_CRSF` (`BF src/main/pg/rx.c#L37-L40`, `L84`). Setting it explicitly is harmless.
- `feature RX_SERIAL` is already the target default (`DEFAULT_RX_FEATURE FEATURE_RX_SERIAL`, `CFG#L124`, applied at `BF src/main/config/feature.c#L35`).

### GPS (u-blox M10)
- `feature GPS` (feature name list `BF src/main/cli/cli.c#L234-L237`). GPS init is gated on `FEATURE_GPS` (`BF src/main/fc/init.c#L762-L763`).
- `set gps_provider = UBLOX`. Values are `NMEA, UBLOX, MSP` (`settings.c#L201-L203`, setting at `L1020`). UBLOX is the default (`BF src/main/pg/gps.c#L35`). **Δ** 2025.12 adds `VIRTUAL` (`BF25 settings.c#L254-L256`).
- `gps_auto_config` defaults to ON (`pg/gps.c#L37`). With UBLOX and auto-config on, the FC probes baud rates with MON-VER and then commands the module to the port's configured GPS baud (`BF src/main/io/gps.c#L425-L452`, `#L1044-L1052`). M10 is recognised (`gps.c#L479`, `UBX_VERSION_M10`).
- `gps_auto_baud` defaults to OFF (`pg/gps.c#L38`). In 4.5.5 it is referenced only by CLI GPS passthrough (`cli.c#L4813`), so you do not need to set it.
- Optional settings:
  - `gps_ublox_use_galileo` (ON/OFF, default OFF, `settings.c#L1028`)
  - `gps_ublox_flight_model` (default `AIRBORNE_4G`; values `PORTABLE, STATIONARY, PEDESTRIAN, AUTOMOTIVE, AT_SEA, AIRBORNE_1G, AIRBORNE_2G, AIRBORNE_4G`, `settings.c#L209-L211`)
  - `gps_update_rate_hz` (default 10)
- GPS baud goes in the `serial` line's 4th field. The CLI accepts at most 115200.
- **UNVERIFIED:** the Matek M10Q-5883 factory baud rate. It does not matter much because UBLOX auto-config probes for it.

### MSP DisplayPort OSD (DJI O4)
- **`displayport_msp_serial` does not exist in 4.5.5.** A grep of `src/main` finds no hits. The DisplayPort UART is chosen as the **first non-VCP port whose mask includes both `FUNCTION_MSP` and `FUNCTION_VTX_MSP`** (`BF src/main/config/config.c#L616-L630`). So the port setting is the `serial ... 131073 ...` line. The same logic is in 2025.12.5 (`config.c#L537`) and 2026.6.2 (`config.c#L576`).
- `set osd_displayport_device = MSP`. Values are `NONE, AUTO, MAX7456, MSP, FRSKYOSD` (`settings.c#L491-L493`, setting at `L1514`). **Δ** 2026.6 adds `FBOSD`.
- `set vcd_video_system = HD`. Values are `AUTO, PAL, NTSC, HD` (`settings.c#L392-L394`, setting at `L1570`). When `vcd_video_system == HD`, init forces the MSP device (`BF src/main/fc/init.c#L896-L900`) and uses the canvas size (`src/main/io/displayport_msp.c#L215-L217`).
- **Why both settings matter on this board:** MATEKF405TE has an onboard MAX7456 (`USE_MAX7456`, `CFG#L34`). With `AUTO`, init falls through to the MAX7456 case before MSP (`init.c#L920-L937`).
- Firmware defaults are already MSP and HD when `USE_OSD_HD` is built (`BF src/main/osd/osd.c#L415-L419`, `src/main/pg/vcd.c#L33-L37`), but set them explicitly anyway.
- The 4.4 release notes give exactly these two lines: https://betaflight.com/docs/wiki/release/Betaflight-4-4-Release-Notes (section "2. HD OSD").
- `displayport_msp_fonts` (`settings.c#L1588`) is **not required**.
- HD canvas defaults to 53x20 and is renegotiated by the VTX (`osd.h#L89-L90`; 4.4 notes).
- **UNVERIFIED (not in Betaflight sources):** DJI "Canvas mode" is a goggle/O4 menu option on the DJI side and needs no extra Betaflight setting beyond the above.

### Motor protocol, bidirectional DShot, poles
- `set motor_pwm_protocol = DSHOT600` (or `DSHOT300`). Values are `PWM, ONESHOT125, ONESHOT42, MULTISHOT, BRUSHED, DSHOT150, DSHOT300, DSHOT600, PROSHOT1000, DISABLED` (`settings.c#L302-L306`, setting at `L865`). The default is DSHOT600 (`BF src/main/pg/motor.c#L71`). **Δ** 2026.6 appends `DRONECAN`.
- `set dshot_bidir = ON`. Values are OFF/ON (`settings.c#L856`). The default is OFF (`pg/motor.c#L47-L48`, `L118`).
- `USE_DSHOT_TELEMETRY` is defined whenever `USE_DSHOT` is (`BF src/main/target/common_pre.h#L56-L60`). That block is outside the `CLOUD_BUILD` guard, so selecting DSHOT in a cloud build includes bidir.
- `set motor_poles = 14`. The range is 4 to 255 (`settings.c#L868`), and the default is already 14 (`pg/motor.c#L107`).
- **UNVERIFIED:** AM32 bidirectional DShot support on this particular ESC. Confirm in the Motors tab (RPM readout / 0% error) after setup.

### Current and voltage meter
- `set current_meter = ADC`. Values are `NONE, ADC, VIRTUAL, ESC, MSP` (`BF src/main/sensors/current.c#L45-L47`, setting at `settings.c#L902`). The target default is already ADC (`CFG#L108`).
- `battery_meter` values are `NONE, ADC, ESC` (`src/main/sensors/voltage.c#L51-L53`). The target default is ADC (`CFG#L109`). `vbat_scale` target default is 210 (`CFG#L110`).
- `set ibata_scale = 150`. The range is -16000 to 16000 (`settings.c#L924`). The target default is already 150 (`CFG#L111`).
- `set ibata_offset = 0`. The range is -32000 to 32000 (`settings.c#L925`). The default is 0 (`BF src/main/sensors/current.c#L97-L105`).

### Compass (QMC5883L on I2C1, 0x0D)
- `set mag_hardware = QMC5883` (or `AUTO`). Values are `AUTO, NONE, HMC5883, AK8975, AK8963, QMC5883, LIS2MDL, LIS3MDL, MPU925X_AK8963, IST8310` (`BF src/main/cli/settings.c#L159-L161`, setting at `L731`). The docs recommend `AUTO` (https://betaflight.com/docs/wiki/guides/current/Magnetometer, "set mag_hardware = AUTO").
- `set align_mag = CW270FLIP`. Values are `DEFAULT, CW0, CW90, CW180, CW270, CW0FLIP, CW90FLIP, CW180FLIP, CW270FLIP, CUSTOM` (`settings.c#L181-L192`, setting at `L723`). Enum value 8 is `CW270_DEG_FLIP` (`src/main/common/sensor_alignment.h#L39`). "Flip" means a 180 degree rotation about Y (Magnetometer doc). **UNVERIFIED:** that CW270FLIP is right for this mounting. It comes from the module vendor, so verify it in the Sensors tab.
- Bus settings need **no change**:
  - The target sets `MAG_I2C_INSTANCE I2CDEV_1` (`CFG#L105`).
  - `pgResetFn_compassConfig` sets `mag_bustype = I2C`, `mag_i2c_device = I2C_DEV_TO_CFG(I2CDEV_1) = 1`, `mag_i2c_address = 0` (`BF src/main/sensors/compass.c#L125-L130`; `I2C_DEV_TO_CFG(x) = x+1`, `src/main/drivers/bus_i2c.h#L50`).
  - Address 0 makes the QMC driver use `0x0D` (`src/main/drivers/compass/compass_qmc5883l.c#L43`, `#L148-L149`).
  - If you set them explicitly: `set mag_bustype = I2C`, `set mag_i2c_device = 1`, `set mag_i2c_address = 13` (`settings.c#L727-L729`).
- `USE_MAG` is **not** defined by the target config. `CFG` defines only `MAG_I2C_INSTANCE`. I2C1 (PB8 SCL / PB7 SDA, `CFG#L64-L65`) is the only I2C bus defined, and it is **shared with the onboard DPS310 baro** (`BARO_I2C_INSTANCE I2CDEV_1`, `CFG#L106-L107`). **UNVERIFIED:** which physical pads on the DolphinRC board expose I2C1.

---

## 3. Motor order (Quad-X) and motor resources

`mixerQuadX[]` (`BF src/main/flight/mixer_init.c#L72-L77`). The row comments give the positions:

| Motor | Position |
|---|---|
| Motor 1 | REAR_R (rear-right) |
| Motor 2 | FRONT_R (front-right) |
| Motor 3 | REAR_L (rear-left) |
| Motor 4 | FRONT_L (front-left) |

The order is identical in 2025.12.5 and 2026.6.2 (`mixer_init.c#L85-L88`). QUADX is the default mixer (`DEFAULT_MIXER MIXER_QUADX`, `BF src/main/target/common_defaults_post.h#L108`), so no `mixer` line is needed. The docs point to the same expected mapping (https://betaflight.com/docs/wiki/getting-started/troubleshooting, motor order section).

Motor pin defaults (`CFG#L39-L46`):

| Motor | Pin | Timer map (`CFG#L86-L94`) |
|---|---|---|
| M1 | PC9 | timer index 2 |
| M2 | PC8 | timer index 2 |
| M3 | PB15 | timer index 1 |
| M4 | PA8 | timer index 1 |

M5 to M8 are PB11, PB10, PB3 and PA15. The pins are loaded into `motorConfig->dev.ioTags[]` (`BF src/main/pg/motor.c#L81-L104`). **No `resource` changes are needed** unless the ESC harness order differs. In that case remap with `resource MOTOR n <pin>`, or use the Motors tab reorder (`motorOutputReordering`, `pg/motor.c#L109-L110`).

### 3a. Motor spin direction (added PB-797, fetched 2026-09-26 from `master`)

Quad-X default, viewed from above: **M1 rear-right CW, M2 front-right CCW, M3 rear-left CCW, M4 front-left CW** ("props in"). `set yaw_motors_reversed = ON` reverses every motor ("props out").

- `yaw_motors_reversed` is an OFF/ON setting on `mixerConfig_t` (`BF src/main/cli/settings.c`, `{ "yaw_motors_reversed", VAR_INT8 | MASTER_VALUE | MODE_LOOKUP, .config.lookup = { TABLE_OFF_ON }, PG_MIXER_CONFIG, ... }`). The default comes from `#define YAW_MOTORS_REVERSED 0` (`BF src/main/flight/mixer_init.c#L50-L51`), and `configs/MATEKF405TE/config.h` does not override it. So the default is OFF.
- `mixerQuadX[]` yaw column (`mixer_init.c#L84-L89`): REAR_R −1, FRONT_R +1, REAR_L +1, FRONT_L −1. In the same file, `mixerY4[]` labels its rows `// REAR_TOP CW` (yaw −1) and `// REAR_BOTTOM CCW` (yaw +1). With that sign convention, M1 and M4 turn CW and M2 and M3 turn CCW. Source file sha256 `0b080d762403ca067fc4c5728d9dd5651a68311bcc1407f2ade9a6cf278d8418`.
- Docs, motors tab (https://github.com/betaflight/betaflight.com, `docs/wiki/app/motors-tab.md`): "The normal setting assumes your props will spin in towards the camera at the front of your quad "props in"".
- Docs, reversed motor direction (`docs/wiki/guides/current/Reversed-motor-direction.md`): "Reversed motors would be spinning outwards (contrary to the standard inwards), that is the front left spins counterclockwise, front right clockwise". The default is the opposite: front-left CW, front-right CCW. Diagonal motors share a direction.
- The setup guide's props-in/props-out diagram is `static/img/betaflight_props_in_out.png` in the same repo.

The UHD model records direction as `ChildModuleRef.spin` on each arm instance. `betaflight.ts` emits `yaw_motors_reversed` from it, and the `prop_handedness` check compares it with the prop variant on each motor.

---

## 4. Target defaults, compatibility, gotchas

| Item | Target default | Source |
|---|---|---|
| Serial RX on UART2 | Yes (`SERIALRX_UART SERIAL_PORT_USART2`, mask 64) | `CFG#L123`, `BF serial.c#L160-L165` |
| RX feature | `FEATURE_RX_SERIAL` | `CFG#L124` |
| serialrx_provider | Not set by target. The firmware default is CRSF if built in. | `BF pg/rx.c#L37-L40` |
| Blackbox | `BLACKBOX_DEVICE_FLASH` (M25P16 on SPI2) | `CFG#L116`, `#L35-L36`, `#L118` |
| Current/voltage source | ADC / ADC, scale 150 / 210 | `CFG#L108-L111` |
| Gyro | ICM42688P, SPI1, `GYRO_1_ALIGN CW270_DEG_FLIP` (the gyro, not the mag) | `CFG#L29-L32`, `#L120-L121` |
| Baro | DPS310 on I2C1 | `CFG#L33`, `#L106-L107` |
| OSD chip | MAX7456 on SPI1 | `CFG#L34`, `#L117` |
| GPS / MSP UART | None defined (no `GPS_UART` / `MSP_UART`) | `CFG` |

Gotchas:

1. **The compass needs a custom build with `MAG`.**
   - `USE_MAG` is only auto-defined for builds *without* a board config (`#if !defined(USE_CONFIG)` inside `#if !defined(CLOUD_BUILD)`, `BF src/main/target/common_pre.h#L72-L77`).
   - MATEKF405TE does not define it, so `mag_hardware` and the QMC driver are compiled out unless you select **"MAG"** under "Other Options" in the cloud build (`https://betaflight.com/docs/development/API/Cloud-Build-API`, "Other Options" list). For local builds use `-DUSE_MAG` (Magnetometer doc: "Betaflight's build system must include `Magnetometers`... or `-DUSE_MAG`").
   - With `USE_MAG`, the QMC5883 driver is pulled in automatically (`BF src/main/target/common_post.h#L88-L101`).
   - Also select `GPS`, `OSD_HD` (or both SD and HD), `SERIALRX_CRSF` and `DSHOT`. CRSF telemetry is included automatically (Cloud-Build-API note).
2. **Onboard MAX7456.** Because of it, `osd_displayport_device = MSP` and `vcd_video_system = HD` must be set explicitly (section 2).
3. **UART5 mask must be 131073, not 131072.** A port with VTX_MSP alone is not picked for DisplayPort (`config.c#L625`), and the docs say "MSP VTX is alone on a port — it has to share with MSP" (Serial guide).
4. **Features.** `feature TELEMETRY` is required for ELRS telemetry (`init.c#L978`). `feature GPS` is required for GPS init (`init.c#L762`). `DEFAULT_FEATURES` is 0 (`BF src/main/config/feature.h#L25-L26`). FEATURE_OSD is auto-enabled only on an unconfigured board (`BF src/main/config/config.c#L484-L494`), so add `feature OSD` to be safe.
5. **QMC5883P variant.** 4.5.5 supports only the QMC5883**L** (`compass_qmc5883l.c`, address 0x0D). 2025.12+ adds a QMC5883**P** driver at address 0x2C (`BF25 src/main/drivers/compass/compass_qmc5883.c#L82-L83`). The Magnetometer doc notes the L was "Discontinued in 2025 and replaced by the QMC5883P". If a newer M10Q-5883 ships with the P variant, 4.5.5 will not detect it. **UNVERIFIED:** which chip this unit carries. The user states 0x0D, which is the L variant.
6. **Target file path.** The user-supplied path `configs/MATEKF405TE/config.h` is correct only on the `4.5-config` / `2025.12-config` branches. On `master` the file is at `configs/MTKS/MATEKF405TE/config.h`. Contents are identical.
7. **DolphinRC F405 V3 → MATEKF405TE.** **UNVERIFIED** from Betaflight sources. DolphinRC is a registered manufacturer (`DOLP`, `Manufacturers.md#L44`), but its only config is `configs/DOLP/DOLPHINRC_F722`. There is no DolphinRC F405 config, so the pin compatibility is taken from the vendor's claim.
