# Wiring and assembly checklist — 5-inch 6S quadcopter

## xt60_lead

- [ ] **VBAT** — `battery:battery_out` ↔ `stack:bat_in` (power)
- [ ] **Battery GND** — `battery:battery_gnd` ↔ `stack:bat_neg` (power)

## direct wiring

- [ ] **Bulk cap +** — `battery:battery_out` ↔ `bulk_cap:pos` (power)
- [ ] **Bulk cap −** — `battery:battery_gnd` ↔ `bulk_cap:neg` (power)
- [ ] **Motor 2** — `stack:motor_2` ↔ `arm_fr:motor__phases` (bldc_3phase)
  - [ ] `stack:motor_2 M2 PHASE_A` → `arm_fr:motor__phases A`
  - [ ] `stack:motor_2 M2 PHASE_B` → `arm_fr:motor__phases B`
  - [ ] `stack:motor_2 M2 PHASE_C` → `arm_fr:motor__phases C`
- [ ] **Motor 1** — `stack:motor_1` ↔ `arm_rr:motor__phases` (bldc_3phase)
  - [ ] `stack:motor_1 M1 PHASE_A` → `arm_rr:motor__phases A`
  - [ ] `stack:motor_1 M1 PHASE_B` → `arm_rr:motor__phases B`
  - [ ] `stack:motor_1 M1 PHASE_C` → `arm_rr:motor__phases C`
- [ ] **Motor 3** — `stack:motor_3` ↔ `arm_rl:motor__phases` (bldc_3phase)
  - [ ] `stack:motor_3 M3 PHASE_A` → `arm_rl:motor__phases A`
  - [ ] `stack:motor_3 M3 PHASE_B` → `arm_rl:motor__phases B`
  - [ ] `stack:motor_3 M3 PHASE_C` → `arm_rl:motor__phases C`
- [ ] **Motor 4** — `stack:motor_4` ↔ `arm_fl:motor__phases` (bldc_3phase)
  - [ ] `stack:motor_4 M4 PHASE_A` → `arm_fl:motor__phases A`
  - [ ] `stack:motor_4 M4 PHASE_B` → `arm_fl:motor__phases B`
  - [ ] `stack:motor_4 M4 PHASE_C` → `arm_fl:motor__phases C`
- [ ] **CRSF** — `stack:uart2` ↔ `receiver:crsf` (uart)
  - [ ] `stack:uart2 RX2` → `receiver:crsf TX` — crossover
  - [ ] `stack:uart2 TX2` → `receiver:crsf RX` — crossover
- [ ] **RX 5V** — `stack:bec_5v` ↔ `receiver:vcc_5v` (power)
- [ ] **RX GND** — `stack:gnd` ↔ `receiver:gnd` (power)
- [ ] **GPS** — `stack:uart1` ↔ `gnss:uart_gnss` (uart)
  - [ ] `stack:uart1 RX1` → `gnss:uart_gnss TX` — crossover
  - [ ] `stack:uart1 TX1` → `gnss:uart_gnss RX` — crossover
- [ ] **Compass** — `stack:i2c1` ↔ `gnss:i2c_compass` (i2c)
  - [ ] `stack:i2c1 SDA` → `gnss:i2c_compass DA`
  - [ ] `stack:i2c1 SCL` → `gnss:i2c_compass CL`
- [ ] **GPS 4.5V** — `stack:rail_4v5` ↔ `gnss:vin_5v` (power)
- [ ] **GPS GND** — `stack:gnd` ↔ `gnss:gnd` (power)

## dji_cable

- [ ] **O4 10V** — `stack:bec_10v` ↔ `video:vcc` (power)
- [ ] **O4 GND** — `stack:gnd` ↔ `video:gnd` (power)
- [ ] **MSP DisplayPort** — `stack:uart5` ↔ `video:uart_osd` (uart)
  - [ ] `stack:uart5 R5` → `video:uart_osd TX` — crossover
  - [ ] `stack:uart5 TX5` → `video:uart_osd RX` — crossover

## arm_fr_hardware

- [ ] **Front-right arm mount** — `arm_fr:motor__base_mount` ↔ `frame:motor_mount_fr` (bolt_pattern)

## arm_rr_hardware

- [ ] **Rear-right arm mount** — `arm_rr:motor__base_mount` ↔ `frame:motor_mount_rr` (bolt_pattern)

## arm_rl_hardware

- [ ] **Rear-left arm mount** — `arm_rl:motor__base_mount` ↔ `frame:motor_mount_rl` (bolt_pattern)

## arm_fl_hardware

- [ ] **Front-left arm mount** — `arm_fl:motor__base_mount` ↔ `frame:motor_mount_fl` (bolt_pattern)

## stack_hardware

- [ ] **ESC on frame** — `stack:stack_mount` ↔ `frame:stack_mount` (bolt_pattern)
- [ ] **FC on frame** — `stack:fc_stack_mount` ↔ `frame:stack_mount` (bolt_pattern)

## frame_hardware

- [ ] **Top plate on standoffs** — `frame:standoff_mount` ↔ `top_plate:standoff_mount` (bolt_pattern)

## camera_hardware

- [ ] **Camera plates** — `video:camera_mount` ↔ `frame:camera_mount` (bolt_pattern)

## vtx_hardware

- [ ] **Air unit mount** — `video:tx_module_mount` ↔ `frame:vtx_mount` (bolt_pattern)

## gps_hardware

- [ ] **GPS mount** — `gnss:mount` ↔ `top_plate:gps_mount` (bolt_pattern)
