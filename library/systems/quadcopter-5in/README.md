# 5-inch 6S quadcopter (reference system)

The first ProtoBoard Stack reference project (PB-763). Purchased modules plus
one custom frame, with existing flight-control firmware (Betaflight). No
custom PCB or flight-control code.

## Component selection

| Role | Part (library id) | Key facts |
| --- | --- | --- |
| Flight controller | `dolphinrc-f405-v3-flight-controller` | STM32F405, ICM-42688-P, 2–6S, 5 V 3 A + 10–12 V 2.5 A BECs, 6 UARTs, 8 DShot outputs, Betaflight MATEKF405TE |
| 4-in-1 ESC | `dolphinrc-am32-60a-4in1-esc` | AM32, 2–6S, 60 A continuous / 65 A burst per channel, 8-pin SH1.0 FC cable |
| Motors ×4 | `meps-neon-2207-v2-1950kv` | 1950KV, 6S, 16 mm bolt circle M3, Ø5 mm shaft with M5 thread |
| Propellers ×4 | `hqprop-ethix-s5` | 5×4×3, polycarbonate, 5 mm bore, 2 CW + 2 CCW per pack |
| Battery | `cnhl-black-series-1100mah-6s-100c` | 6S 1100 mAh, 100C (110 A continuous), XT60, 211 g |
| Receiver | `radiomaster-rp1-v2-elrs-2g4` | ExpressLRS 2.4 GHz, CRSF over UART at 420 000 baud, 5 V |
| Digital video | `dji-o4-air-unit` | 3.7–13.2 V input (not direct 6S), 25.5 mm M2 module mount, 14 mm camera |
| GNSS + compass | `matek-m10q-5883` | u-blox M10 + QMC5883L (I2C 0x0D), 4–9 V; manufacturer lists it EOL |
| Frame | `quadcopter-5in-frame` (custom) | Interfaces mirror the parts above; CAD pending (PB-774) |

## Wiring (stored links in `index.ts`)

- The battery XT60 goes to the ESC battery pads, which also pass VBAT to the FC over the 8-pin cable.
- ESC motor channels M1–M4 go to the arms, using Betaflight Quad-X order: M1 rear-right, M2 front-right, M3 rear-left, M4 front-left.
- The receiver uses CRSF on UART2 and runs from the 5 V BEC.
- The DJI O4 runs from the 10 V BEC and carries MSP DisplayPort on UART5 over the DJI socket.
- GNSS uses UART1, with the compass on I2C1, and runs from the 4.5 V GPS rail.

All links validate as configured with `validateLinks` (see `test/system-links.test.ts`).

## Open questions from part research

- The FC's high-voltage BEC output is 10 V or 12 V depending on the source; the board silkscreen says 10V.
- Pin 1 isn't marked on the FC/ESC 8-pin connector; both parts assume the BAT end.
- DShot rates and bidirectional DShot are supported only by DolphinRC's review blog, not the manual.
- The Matek M10Q-5883 is EOL; choose a successor before building more than one unit.
- The DJI O4 standard is marketed for small frames. Its cooling requirement (airflow, limited ground standby) needs to be covered in the frame design.
