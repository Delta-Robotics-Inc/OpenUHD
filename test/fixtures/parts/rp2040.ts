/**
 * FIXTURE: a frozen copy of a part definition (RP2040 datasheet) for UHD's own tests:
 * interfaces, pin table, package and the traits the checks read. Evidence,
 * CAD and notes are left out. It is not maintained as a part: change it only
 * when a test needs it.
 */
import type { ModuleDef } from "../../../src/types/index.js";

export const RP2040: ModuleDef = {
  "id": "rp2040",
  "name": "Raspberry Pi RP2040",
  "version": "2.1.0",
  "manufacturer": "Raspberry Pi",
  "part_number": "RP2040",
  "description": "Bare-chip dual-core Arm Cortex-M0+ microcontroller in QFN-56 7×7 mm package. 264 KB SRAM with NO internal flash (external QSPI flash required for code execution via XIP). 30 multi-function GPIOs (GPIO0..GPIO29), 2x UART, 2x I2C, 2x SPI, 16 PWM channels (8 slices), 4-channel 12-bit ADC, USB 1.1 host/device PHY, and 8 user-programmable I/O state machines (PIO) across two PIO blocks. Flexible system clock up to 133 MHz default.",
  "tags": [
    "rp2040",
    "raspberry-pi",
    "microcontroller",
    "arm-cortex-m0",
    "dual-core",
    "qfn-56",
    "pio",
    "usb",
    "bare-chip"
  ],
  "categories": [
    "microcontroller.raspberry_pi"
  ],
  "interfaces": [
    {
      "id": "pin_1",
      "name": "IOVDD",
      "pin": 1,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 3.3,
          "range": [
            1.8,
            3.3
          ]
        }
      ],
      "capabilities": [
        "power_in",
        "iovdd"
      ]
    },
    {
      "id": "pin_2",
      "name": "GPIO0",
      "pin": 2,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_miso",
        "uart_tx",
        "gpio0",
        "spi0_rx",
        "uart0_tx",
        "i2c0_sda",
        "pwm0_a",
        "usb_ovcur_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_3",
      "name": "GPIO1",
      "pin": 3,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_ss",
        "uart_rx",
        "gpio1",
        "spi0_csn",
        "uart0_rx",
        "i2c0_scl",
        "pwm0_b",
        "usb_vbus_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_4",
      "name": "GPIO2",
      "pin": 4,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_sck",
        "uart_cts",
        "gpio2",
        "spi0_sck",
        "uart0_cts",
        "i2c1_sda",
        "pwm1_a",
        "usb_vbus_en",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_5",
      "name": "GPIO3",
      "pin": 5,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_mosi",
        "uart_rts",
        "gpio3",
        "spi0_tx",
        "uart0_rts",
        "i2c1_scl",
        "pwm1_b",
        "usb_ovcur_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_6",
      "name": "GPIO4",
      "pin": 6,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_miso",
        "uart_tx",
        "gpio4",
        "spi0_rx",
        "uart1_tx",
        "i2c0_sda",
        "pwm2_a",
        "usb_vbus_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_7",
      "name": "GPIO5",
      "pin": 7,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_ss",
        "uart_rx",
        "gpio5",
        "spi0_csn",
        "uart1_rx",
        "i2c0_scl",
        "pwm2_b",
        "usb_vbus_en",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_8",
      "name": "GPIO6",
      "pin": 8,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_sck",
        "uart_cts",
        "gpio6",
        "spi0_sck",
        "uart1_cts",
        "i2c1_sda",
        "pwm3_a",
        "usb_ovcur_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_9",
      "name": "GPIO7",
      "pin": 9,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_mosi",
        "uart_rts",
        "gpio7",
        "spi0_tx",
        "uart1_rts",
        "i2c1_scl",
        "pwm3_b",
        "usb_vbus_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_10",
      "name": "IOVDD",
      "pin": 10,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 3.3,
          "range": [
            1.8,
            3.3
          ]
        }
      ],
      "capabilities": [
        "power_in",
        "iovdd"
      ]
    },
    {
      "id": "pin_11",
      "name": "GPIO8",
      "pin": 11,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_miso",
        "uart_tx",
        "gpio8",
        "spi1_rx",
        "uart1_tx",
        "i2c0_sda",
        "pwm4_a",
        "usb_vbus_en",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_12",
      "name": "GPIO9",
      "pin": 12,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_ss",
        "uart_rx",
        "gpio9",
        "spi1_csn",
        "uart1_rx",
        "i2c0_scl",
        "pwm4_b",
        "usb_ovcur_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_13",
      "name": "GPIO10",
      "pin": 13,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_sck",
        "uart_cts",
        "gpio10",
        "spi1_sck",
        "uart1_cts",
        "i2c1_sda",
        "pwm5_a",
        "usb_vbus_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_14",
      "name": "GPIO11",
      "pin": 14,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_mosi",
        "uart_rts",
        "gpio11",
        "spi1_tx",
        "uart1_rts",
        "i2c1_scl",
        "pwm5_b",
        "usb_vbus_en",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_15",
      "name": "GPIO12",
      "pin": 15,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_miso",
        "uart_tx",
        "gpio12",
        "spi1_rx",
        "uart0_tx",
        "i2c0_sda",
        "pwm6_a",
        "usb_ovcur_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_16",
      "name": "GPIO13",
      "pin": 16,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_ss",
        "uart_rx",
        "gpio13",
        "spi1_csn",
        "uart0_rx",
        "i2c0_scl",
        "pwm6_b",
        "usb_vbus_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_17",
      "name": "GPIO14",
      "pin": 17,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_sck",
        "uart_cts",
        "gpio14",
        "spi1_sck",
        "uart0_cts",
        "i2c1_sda",
        "pwm7_a",
        "usb_vbus_en",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_18",
      "name": "GPIO15",
      "pin": 18,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_mosi",
        "uart_rts",
        "gpio15",
        "spi1_tx",
        "uart0_rts",
        "i2c1_scl",
        "pwm7_b",
        "usb_ovcur_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_19",
      "name": "TESTEN",
      "pin": 19,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input"
          ]
        }
      ],
      "capabilities": [
        "testen",
        "factory_test"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_20",
      "name": "XIN",
      "pin": 20,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "clock",
          "roles": [
            "input"
          ]
        }
      ],
      "capabilities": [
        "xtal_in"
      ],
      "parameters": [
        {
          "id": "clock_freq",
          "unit": "Hz",
          "value": 12000000
        }
      ]
    },
    {
      "id": "pin_21",
      "name": "XOUT",
      "pin": 21,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "clock",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "xtal_out"
      ]
    },
    {
      "id": "pin_22",
      "name": "IOVDD",
      "pin": 22,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 3.3,
          "range": [
            1.8,
            3.3
          ]
        }
      ],
      "capabilities": [
        "power_in",
        "iovdd"
      ]
    },
    {
      "id": "pin_23",
      "name": "DVDD",
      "pin": 23,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 1.1,
          "range": [
            1.05,
            1.16
          ]
        }
      ],
      "capabilities": [
        "power_in",
        "dvdd"
      ]
    },
    {
      "id": "pin_24",
      "name": "SWCLK",
      "pin": 24,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input"
          ]
        }
      ],
      "capabilities": [
        "swd_clk"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_25",
      "name": "SWDIO",
      "pin": 25,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        }
      ],
      "capabilities": [
        "swd_io"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_26",
      "name": "RUN",
      "pin": 26,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input"
          ]
        }
      ],
      "capabilities": [
        "run_reset",
        "reset_input"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_27",
      "name": "GPIO16",
      "pin": 27,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_miso",
        "uart_tx",
        "gpio16",
        "spi0_rx",
        "uart0_tx",
        "i2c0_sda",
        "pwm0_a",
        "usb_vbus_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_28",
      "name": "GPIO17",
      "pin": 28,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_ss",
        "uart_rx",
        "gpio17",
        "spi0_csn",
        "uart0_rx",
        "i2c0_scl",
        "pwm0_b",
        "usb_vbus_en",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_29",
      "name": "GPIO18",
      "pin": 29,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_sck",
        "uart_cts",
        "gpio18",
        "spi0_sck",
        "uart0_cts",
        "i2c1_sda",
        "pwm1_a",
        "usb_ovcur_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_30",
      "name": "GPIO19",
      "pin": 30,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_mosi",
        "uart_rts",
        "gpio19",
        "spi0_tx",
        "uart0_rts",
        "i2c1_scl",
        "pwm1_b",
        "usb_vbus_det",
        "sio",
        "pio0",
        "pio1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_31",
      "name": "GPIO20",
      "pin": 31,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_miso",
        "uart_tx",
        "gpio20",
        "spi0_rx",
        "uart1_tx",
        "i2c0_sda",
        "pwm2_a",
        "usb_vbus_en",
        "sio",
        "pio0",
        "pio1",
        "clock_gpin0",
        "clock_gpin"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_32",
      "name": "GPIO21",
      "pin": 32,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_ss",
        "uart_rx",
        "gpio21",
        "spi0_csn",
        "uart1_rx",
        "i2c0_scl",
        "pwm2_b",
        "usb_ovcur_det",
        "sio",
        "pio0",
        "pio1",
        "clock_gpout0",
        "clock_gpout"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_33",
      "name": "IOVDD",
      "pin": 33,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 3.3,
          "range": [
            1.8,
            3.3
          ]
        }
      ],
      "capabilities": [
        "power_in",
        "iovdd"
      ]
    },
    {
      "id": "pin_34",
      "name": "GPIO22",
      "pin": 34,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_sck",
        "uart_cts",
        "gpio22",
        "spi0_sck",
        "uart1_cts",
        "i2c1_sda",
        "pwm3_a",
        "usb_vbus_det",
        "sio",
        "pio0",
        "pio1",
        "clock_gpin1",
        "clock_gpin"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_35",
      "name": "GPIO23",
      "pin": 35,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_mosi",
        "uart_rts",
        "gpio23",
        "spi0_tx",
        "uart1_rts",
        "i2c1_scl",
        "pwm3_b",
        "usb_vbus_en",
        "sio",
        "pio0",
        "pio1",
        "clock_gpout1",
        "clock_gpout"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_36",
      "name": "GPIO24",
      "pin": 36,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_sda",
        "spi_miso",
        "uart_tx",
        "gpio24",
        "spi1_rx",
        "uart1_tx",
        "i2c0_sda",
        "pwm4_a",
        "usb_ovcur_det",
        "sio",
        "pio0",
        "pio1",
        "clock_gpout2",
        "clock_gpout"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_37",
      "name": "GPIO25",
      "pin": 37,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "i2c_scl",
        "spi_ss",
        "uart_rx",
        "gpio25",
        "spi1_csn",
        "uart1_rx",
        "i2c0_scl",
        "pwm4_b",
        "usb_vbus_det",
        "sio",
        "pio0",
        "pio1",
        "clock_gpout3",
        "clock_gpout"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_38",
      "name": "GPIO26",
      "pin": 38,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        },
        {
          "type": "analog",
          "roles": [
            "input"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "analog_in",
        "i2c_sda",
        "spi_sck",
        "uart_cts",
        "gpio26",
        "spi1_sck",
        "uart1_cts",
        "i2c1_sda",
        "pwm5_a",
        "usb_vbus_en",
        "sio",
        "pio0",
        "pio1",
        "adc_ch0"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_39",
      "name": "GPIO27",
      "pin": 39,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        },
        {
          "type": "analog",
          "roles": [
            "input"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "analog_in",
        "i2c_scl",
        "spi_mosi",
        "uart_rts",
        "gpio27",
        "spi1_tx",
        "uart1_rts",
        "i2c1_scl",
        "pwm5_b",
        "usb_ovcur_det",
        "sio",
        "pio0",
        "pio1",
        "adc_ch1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_40",
      "name": "GPIO28",
      "pin": 40,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        },
        {
          "type": "analog",
          "roles": [
            "input"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "analog_in",
        "i2c_sda",
        "spi_miso",
        "uart_tx",
        "gpio28",
        "spi1_rx",
        "uart0_tx",
        "i2c0_sda",
        "pwm6_a",
        "usb_vbus_det",
        "sio",
        "pio0",
        "pio1",
        "adc_ch2"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_41",
      "name": "GPIO29",
      "pin": 41,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        },
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        },
        {
          "type": "analog",
          "roles": [
            "input"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "pwm_out",
        "analog_in",
        "i2c_scl",
        "spi_ss",
        "uart_rx",
        "gpio29",
        "spi1_csn",
        "uart0_rx",
        "i2c0_scl",
        "pwm6_b",
        "usb_vbus_en",
        "sio",
        "pio0",
        "pio1",
        "adc_ch3"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_42",
      "name": "IOVDD",
      "pin": 42,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 3.3,
          "range": [
            1.8,
            3.3
          ]
        }
      ],
      "capabilities": [
        "power_in",
        "iovdd"
      ]
    },
    {
      "id": "pin_43",
      "name": "ADC_AVDD",
      "pin": 43,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 3.3,
          "range": [
            1.62,
            3.63
          ]
        }
      ],
      "capabilities": [
        "power_in",
        "adc_avdd",
        "analog_supply"
      ]
    },
    {
      "id": "pin_44",
      "name": "VREG_VIN",
      "pin": 44,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 3.3,
          "range": [
            1.8,
            3.3
          ]
        }
      ],
      "capabilities": [
        "power_in",
        "vreg_vin"
      ],
      "bridgesTo": [
        "pin_45"
      ]
    },
    {
      "id": "pin_45",
      "name": "VREG_VOUT",
      "pin": 45,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "output"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 1.1
        },
        {
          "id": "max_current",
          "unit": "A",
          "value": 0.1
        }
      ],
      "capabilities": [
        "power_out",
        "vreg_vout"
      ],
      "bridgesTo": [
        "pin_23",
        "pin_50"
      ]
    },
    {
      "id": "pin_46",
      "name": "USB_DM",
      "pin": 46,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "usb",
          "roles": [
            "data_minus"
          ]
        }
      ],
      "capabilities": [
        "usb_dm"
      ]
    },
    {
      "id": "pin_47",
      "name": "USB_DP",
      "pin": 47,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "usb",
          "roles": [
            "data_plus"
          ]
        }
      ],
      "capabilities": [
        "usb_dp"
      ]
    },
    {
      "id": "pin_48",
      "name": "USB_VDD",
      "pin": 48,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 3.3,
          "range": [
            3.135,
            3.63
          ]
        }
      ],
      "capabilities": [
        "power_in",
        "usb_vdd"
      ]
    },
    {
      "id": "pin_49",
      "name": "IOVDD",
      "pin": 49,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 3.3,
          "range": [
            1.8,
            3.3
          ]
        }
      ],
      "capabilities": [
        "power_in",
        "iovdd"
      ]
    },
    {
      "id": "pin_50",
      "name": "DVDD",
      "pin": 50,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "input"
          ]
        }
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "value": 1.1,
          "range": [
            1.05,
            1.16
          ]
        }
      ],
      "capabilities": [
        "power_in",
        "dvdd"
      ]
    },
    {
      "id": "pin_51",
      "name": "QSPI_SD3",
      "pin": 51,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "qspi_sd3"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_52",
      "name": "QSPI_SCLK",
      "pin": 52,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "qspi_sclk"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_53",
      "name": "QSPI_SD0",
      "pin": 53,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "qspi_sd0"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_54",
      "name": "QSPI_SD2",
      "pin": 54,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "qspi_sd2"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_55",
      "name": "QSPI_SD1",
      "pin": 55,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "qspi_sd1"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pin_56",
      "name": "QSPI_SS_N",
      "pin": 56,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input",
            "output",
            "bidirectional"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "qspi_ss_n"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.8,
            3.3
          ]
        }
      ]
    },
    {
      "id": "pad_gnd",
      "name": "GND (Exposed Pad)",
      "pin": 57,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "power",
          "roles": [
            "ground"
          ]
        }
      ],
      "capabilities": [
        "ground"
      ],
      "parameters": [
        {
          "id": "max_current",
          "unit": "A",
          "value": 1
        }
      ]
    },
    {
      "id": "adc_in",
      "name": "ADC",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "analog",
          "roles": [
            "input"
          ]
        }
      ],
      "slots": [
        {
          "id": "channel",
          "required": true,
          "count": 4,
          "match": {
            "protocol": "analog",
            "role": "input",
            "capability": "analog_in"
          }
        }
      ],
      "profiles": [
        {
          "id": "adc_channels",
          "label": "ADC0-ADC3 (GPIO26-29, pins 38-41)",
          "bindings": {
            "channel": [
              "pin_38",
              "pin_39",
              "pin_40",
              "pin_41"
            ]
          }
        }
      ],
      "parameters": [
        {
          "id": "resolution",
          "unit": "dimensionless",
          "value": 12
        }
      ],
      "max_instances": 1
    },
    {
      "id": "spi_0",
      "name": "SPI 0",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "spi",
          "roles": [
            "master"
          ]
        }
      ],
      "parameters": [
        {
          "id": "clock_freq",
          "unit": "Hz",
          "range": [
            0,
            62500000
          ]
        }
      ],
      "slots": [
        {
          "id": "mosi",
          "required": true,
          "match": {
            "protocol": "spi",
            "role": "data_out",
            "capability": "spi_mosi"
          }
        },
        {
          "id": "miso",
          "required": true,
          "match": {
            "protocol": "spi",
            "role": "data_in",
            "capability": "spi_miso"
          }
        },
        {
          "id": "sck",
          "required": true,
          "match": {
            "protocol": "spi",
            "role": "clock",
            "capability": "spi_sck"
          }
        },
        {
          "id": "ss",
          "required": false,
          "match": {
            "protocol": "spi",
            "role": "select",
            "capability": "spi_ss"
          }
        }
      ],
      "profiles": [
        {
          "id": "spi0_gpio0",
          "label": "SPI0 on GPIO0-3 (pins 2-5)",
          "bindings": {
            "mosi": "pin_5",
            "miso": "pin_2",
            "sck": "pin_4",
            "ss": "pin_3"
          }
        },
        {
          "id": "spi0_gpio4",
          "label": "SPI0 on GPIO4-7 (pins 6-9)",
          "bindings": {
            "mosi": "pin_9",
            "miso": "pin_6",
            "sck": "pin_8",
            "ss": "pin_7"
          }
        },
        {
          "id": "spi0_gpio16",
          "label": "SPI0 on GPIO16-19 (pins 27-30)",
          "bindings": {
            "mosi": "pin_30",
            "miso": "pin_27",
            "sck": "pin_29",
            "ss": "pin_28"
          }
        },
        {
          "id": "spi0_gpio20",
          "label": "SPI0 on GPIO20-23 (pins 31-35)",
          "bindings": {
            "mosi": "pin_35",
            "miso": "pin_31",
            "sck": "pin_34",
            "ss": "pin_32"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "spi_1",
      "name": "SPI 1",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "spi",
          "roles": [
            "master"
          ]
        }
      ],
      "parameters": [
        {
          "id": "clock_freq",
          "unit": "Hz",
          "range": [
            0,
            62500000
          ]
        }
      ],
      "slots": [
        {
          "id": "mosi",
          "required": true,
          "match": {
            "protocol": "spi",
            "role": "data_out",
            "capability": "spi_mosi"
          }
        },
        {
          "id": "miso",
          "required": true,
          "match": {
            "protocol": "spi",
            "role": "data_in",
            "capability": "spi_miso"
          }
        },
        {
          "id": "sck",
          "required": true,
          "match": {
            "protocol": "spi",
            "role": "clock",
            "capability": "spi_sck"
          }
        },
        {
          "id": "ss",
          "required": false,
          "match": {
            "protocol": "spi",
            "role": "select",
            "capability": "spi_ss"
          }
        }
      ],
      "profiles": [
        {
          "id": "spi1_gpio8",
          "label": "SPI1 on GPIO8-11 (pins 11-14)",
          "bindings": {
            "mosi": "pin_14",
            "miso": "pin_11",
            "sck": "pin_13",
            "ss": "pin_12"
          }
        },
        {
          "id": "spi1_gpio12",
          "label": "SPI1 on GPIO12-15 (pins 15-18)",
          "bindings": {
            "mosi": "pin_18",
            "miso": "pin_15",
            "sck": "pin_17",
            "ss": "pin_16"
          }
        },
        {
          "id": "spi1_gpio24",
          "label": "SPI1 on GPIO24-27 (pins 36-39)",
          "bindings": {
            "mosi": "pin_39",
            "miso": "pin_36",
            "sck": "pin_38",
            "ss": "pin_37"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "uart_0",
      "name": "UART 0",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "uart",
          "roles": [
            "host",
            "device"
          ]
        }
      ],
      "slots": [
        {
          "id": "rx",
          "required": true,
          "match": {
            "protocol": "uart",
            "role": "receiver",
            "capability": "uart_rx"
          }
        },
        {
          "id": "tx",
          "required": true,
          "match": {
            "protocol": "uart",
            "role": "transmitter",
            "capability": "uart_tx"
          }
        },
        {
          "id": "rts",
          "required": false,
          "match": {
            "protocol": "uart",
            "role": "transmitter",
            "capability": "uart_rts"
          }
        },
        {
          "id": "cts",
          "required": false,
          "match": {
            "protocol": "uart",
            "role": "receiver",
            "capability": "uart_cts"
          }
        }
      ],
      "profiles": [
        {
          "id": "uart0_gpio0",
          "label": "UART0 on GPIO0-3 (pins 2-5)",
          "bindings": {
            "rx": "pin_3",
            "tx": "pin_2",
            "rts": "pin_5",
            "cts": "pin_4"
          }
        },
        {
          "id": "uart0_gpio12",
          "label": "UART0 on GPIO12-15 (pins 15-18)",
          "bindings": {
            "rx": "pin_16",
            "tx": "pin_15",
            "rts": "pin_18",
            "cts": "pin_17"
          }
        },
        {
          "id": "uart0_gpio16",
          "label": "UART0 on GPIO16-19 (pins 27-30)",
          "bindings": {
            "rx": "pin_28",
            "tx": "pin_27",
            "rts": "pin_30",
            "cts": "pin_29"
          }
        },
        {
          "id": "uart0_gpio28",
          "label": "UART0 on GPIO28/29 (pins 40/41, no flow control)",
          "bindings": {
            "rx": "pin_41",
            "tx": "pin_40"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "uart_1",
      "name": "UART 1",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "uart",
          "roles": [
            "host",
            "device"
          ]
        }
      ],
      "slots": [
        {
          "id": "rx",
          "required": true,
          "match": {
            "protocol": "uart",
            "role": "receiver",
            "capability": "uart_rx"
          }
        },
        {
          "id": "tx",
          "required": true,
          "match": {
            "protocol": "uart",
            "role": "transmitter",
            "capability": "uart_tx"
          }
        },
        {
          "id": "rts",
          "required": false,
          "match": {
            "protocol": "uart",
            "role": "transmitter",
            "capability": "uart_rts"
          }
        },
        {
          "id": "cts",
          "required": false,
          "match": {
            "protocol": "uart",
            "role": "receiver",
            "capability": "uart_cts"
          }
        }
      ],
      "profiles": [
        {
          "id": "uart1_gpio4",
          "label": "UART1 on GPIO4-7 (pins 6-9)",
          "bindings": {
            "rx": "pin_7",
            "tx": "pin_6",
            "rts": "pin_9",
            "cts": "pin_8"
          }
        },
        {
          "id": "uart1_gpio8",
          "label": "UART1 on GPIO8-11 (pins 11-14)",
          "bindings": {
            "rx": "pin_12",
            "tx": "pin_11",
            "rts": "pin_14",
            "cts": "pin_13"
          }
        },
        {
          "id": "uart1_gpio20",
          "label": "UART1 on GPIO20-23 (pins 31-35)",
          "bindings": {
            "rx": "pin_32",
            "tx": "pin_31",
            "rts": "pin_35",
            "cts": "pin_34"
          }
        },
        {
          "id": "uart1_gpio24",
          "label": "UART1 on GPIO24-27 (pins 36-39)",
          "bindings": {
            "rx": "pin_37",
            "tx": "pin_36",
            "rts": "pin_39",
            "cts": "pin_38"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "i2c_0",
      "name": "I2C 0",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "i2c",
          "roles": [
            "master",
            "slave"
          ]
        }
      ],
      "parameters": [
        {
          "id": "clock_freq",
          "unit": "Hz",
          "range": [
            100000,
            1000000
          ]
        }
      ],
      "slots": [
        {
          "id": "sda",
          "required": true,
          "match": {
            "protocol": "i2c",
            "role": "data",
            "capability": "i2c_sda"
          }
        },
        {
          "id": "scl",
          "required": true,
          "match": {
            "protocol": "i2c",
            "role": "clock",
            "capability": "i2c_scl"
          }
        }
      ],
      "profiles": [
        {
          "id": "i2c0_gpio0",
          "label": "I2C0 on GPIO0/1 (pins 2/3)",
          "bindings": {
            "sda": "pin_2",
            "scl": "pin_3"
          }
        },
        {
          "id": "i2c0_gpio4",
          "label": "I2C0 on GPIO4/5 (pins 6/7)",
          "bindings": {
            "sda": "pin_6",
            "scl": "pin_7"
          }
        },
        {
          "id": "i2c0_gpio8",
          "label": "I2C0 on GPIO8/9 (pins 11/12)",
          "bindings": {
            "sda": "pin_11",
            "scl": "pin_12"
          }
        },
        {
          "id": "i2c0_gpio12",
          "label": "I2C0 on GPIO12/13 (pins 15/16)",
          "bindings": {
            "sda": "pin_15",
            "scl": "pin_16"
          }
        },
        {
          "id": "i2c0_gpio16",
          "label": "I2C0 on GPIO16/17 (pins 27/28)",
          "bindings": {
            "sda": "pin_27",
            "scl": "pin_28"
          }
        },
        {
          "id": "i2c0_gpio20",
          "label": "I2C0 on GPIO20/21 (pins 31/32)",
          "bindings": {
            "sda": "pin_31",
            "scl": "pin_32"
          }
        },
        {
          "id": "i2c0_gpio24",
          "label": "I2C0 on GPIO24/25 (pins 36/37)",
          "bindings": {
            "sda": "pin_36",
            "scl": "pin_37"
          }
        },
        {
          "id": "i2c0_gpio28",
          "label": "I2C0 on GPIO28/29 (pins 40/41)",
          "bindings": {
            "sda": "pin_40",
            "scl": "pin_41"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "i2c_1",
      "name": "I2C 1",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "i2c",
          "roles": [
            "master",
            "slave"
          ]
        }
      ],
      "parameters": [
        {
          "id": "clock_freq",
          "unit": "Hz",
          "range": [
            100000,
            1000000
          ]
        }
      ],
      "slots": [
        {
          "id": "sda",
          "required": true,
          "match": {
            "protocol": "i2c",
            "role": "data",
            "capability": "i2c_sda"
          }
        },
        {
          "id": "scl",
          "required": true,
          "match": {
            "protocol": "i2c",
            "role": "clock",
            "capability": "i2c_scl"
          }
        }
      ],
      "profiles": [
        {
          "id": "i2c1_gpio2",
          "label": "I2C1 on GPIO2/3 (pins 4/5)",
          "bindings": {
            "sda": "pin_4",
            "scl": "pin_5"
          }
        },
        {
          "id": "i2c1_gpio6",
          "label": "I2C1 on GPIO6/7 (pins 8/9)",
          "bindings": {
            "sda": "pin_8",
            "scl": "pin_9"
          }
        },
        {
          "id": "i2c1_gpio10",
          "label": "I2C1 on GPIO10/11 (pins 13/14)",
          "bindings": {
            "sda": "pin_13",
            "scl": "pin_14"
          }
        },
        {
          "id": "i2c1_gpio14",
          "label": "I2C1 on GPIO14/15 (pins 17/18)",
          "bindings": {
            "sda": "pin_17",
            "scl": "pin_18"
          }
        },
        {
          "id": "i2c1_gpio18",
          "label": "I2C1 on GPIO18/19 (pins 29/30)",
          "bindings": {
            "sda": "pin_29",
            "scl": "pin_30"
          }
        },
        {
          "id": "i2c1_gpio22",
          "label": "I2C1 on GPIO22/23 (pins 34/35)",
          "bindings": {
            "sda": "pin_34",
            "scl": "pin_35"
          }
        },
        {
          "id": "i2c1_gpio26",
          "label": "I2C1 on GPIO26/27 (pins 38/39)",
          "bindings": {
            "sda": "pin_38",
            "scl": "pin_39"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "qspi_flash",
      "name": "Quad-SPI (XIP Flash Bus)",
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "spi",
          "roles": [
            "master"
          ]
        }
      ],
      "slots": [
        {
          "id": "sclk",
          "required": true,
          "match": {
            "protocol": "spi",
            "role": "clock",
            "capability": "qspi_sclk"
          }
        },
        {
          "id": "ss_n",
          "required": true,
          "match": {
            "protocol": "spi",
            "role": "select",
            "capability": "qspi_ss_n"
          }
        },
        {
          "id": "sd0",
          "required": true,
          "match": {
            "capability": "qspi_sd0"
          }
        },
        {
          "id": "sd1",
          "required": true,
          "match": {
            "capability": "qspi_sd1"
          }
        },
        {
          "id": "sd2",
          "required": true,
          "match": {
            "capability": "qspi_sd2"
          }
        },
        {
          "id": "sd3",
          "required": true,
          "match": {
            "capability": "qspi_sd3"
          }
        }
      ],
      "profiles": [
        {
          "id": "qspi_flash_fixed",
          "label": "Dedicated QSPI pads (pins 51-56)",
          "default_active": true,
          "bindings": {
            "sclk": "pin_52",
            "ss_n": "pin_56",
            "sd0": "pin_53",
            "sd1": "pin_55",
            "sd2": "pin_54",
            "sd3": "pin_51"
          }
        }
      ],
      "parameters": [
        {
          "id": "max_data_rate",
          "name": "Max data rate (QSPI quad-SDR)",
          "unit": "bit/s",
          "value": 133000000
        }
      ],
      "max_instances": 1
    },
    {
      "id": "pwm",
      "name": "PWM",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "pwm",
          "roles": [
            "output"
          ]
        }
      ],
      "slots": [
        {
          "id": "pwm0_a",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm0_a"
          }
        },
        {
          "id": "pwm0_b",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm0_b"
          }
        },
        {
          "id": "pwm1_a",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm1_a"
          }
        },
        {
          "id": "pwm1_b",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm1_b"
          }
        },
        {
          "id": "pwm2_a",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm2_a"
          }
        },
        {
          "id": "pwm2_b",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm2_b"
          }
        },
        {
          "id": "pwm3_a",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm3_a"
          }
        },
        {
          "id": "pwm3_b",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm3_b"
          }
        },
        {
          "id": "pwm4_a",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm4_a"
          }
        },
        {
          "id": "pwm4_b",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm4_b"
          }
        },
        {
          "id": "pwm5_a",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm5_a"
          }
        },
        {
          "id": "pwm5_b",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm5_b"
          }
        },
        {
          "id": "pwm6_a",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm6_a"
          }
        },
        {
          "id": "pwm6_b",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm6_b"
          }
        },
        {
          "id": "pwm7_a",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm7_a"
          }
        },
        {
          "id": "pwm7_b",
          "required": false,
          "match": {
            "protocol": "pwm",
            "role": "output",
            "capability": "pwm7_b"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "pio0",
      "name": "PIO0 (Programmable I/O Block 0)",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "pio",
          "roles": [
            "input",
            "output"
          ]
        }
      ],
      "slots": [
        {
          "id": "gpio",
          "required": false,
          "count": 30,
          "match": {
            "capability": "pio0"
          }
        }
      ],
      "max_instances": 4
    },
    {
      "id": "pio1",
      "name": "PIO1 (Programmable I/O Block 1)",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "pio",
          "roles": [
            "input",
            "output"
          ]
        }
      ],
      "slots": [
        {
          "id": "gpio",
          "required": false,
          "count": 30,
          "match": {
            "capability": "pio1"
          }
        }
      ],
      "max_instances": 4
    },
    {
      "id": "ws2812",
      "name": "NeoPixel / WS2812B LED Control",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "transmitter"
          ]
        }
      ],
      "slots": [
        {
          "id": "data",
          "required": true,
          "match": {
            "protocol": "digital",
            "role": "output",
            "capability": "pio0"
          }
        }
      ],
      "parameters": [
        {
          "id": "bit_rate",
          "name": "NRZ wire bit rate",
          "unit": "Hz",
          "value": 800000
        }
      ],
      "max_instances": 8
    },
    {
      "id": "usb_device",
      "name": "USB 1.1 Device",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "usb",
          "roles": [
            "device"
          ]
        }
      ],
      "slots": [
        {
          "id": "dp",
          "required": true,
          "match": {
            "protocol": "usb",
            "role": "data_plus",
            "capability": "usb_dp"
          }
        },
        {
          "id": "dm",
          "required": true,
          "match": {
            "protocol": "usb",
            "role": "data_minus",
            "capability": "usb_dm"
          }
        }
      ],
      "profiles": [
        {
          "id": "usb_device_pins",
          "label": "USB_DP / USB_DM (pins 47/46)",
          "bindings": {
            "dp": "pin_47",
            "dm": "pin_46"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "usb_host",
      "name": "USB 1.1 Host",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "usb",
          "roles": [
            "host"
          ]
        }
      ],
      "slots": [
        {
          "id": "dp",
          "required": true,
          "match": {
            "protocol": "usb",
            "role": "data_plus",
            "capability": "usb_dp"
          }
        },
        {
          "id": "dm",
          "required": true,
          "match": {
            "protocol": "usb",
            "role": "data_minus",
            "capability": "usb_dm"
          }
        }
      ],
      "profiles": [
        {
          "id": "usb_host_pins",
          "label": "USB_DP / USB_DM (pins 47/46)",
          "bindings": {
            "dp": "pin_47",
            "dm": "pin_46"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "usb_vbus_detect",
      "name": "USB VBUS Detect",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input"
          ]
        }
      ],
      "slots": [
        {
          "id": "signal",
          "required": true,
          "match": {
            "capability": "usb_vbus_det"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "usb_vbus_enable",
      "name": "USB VBUS Enable",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "output"
          ]
        }
      ],
      "slots": [
        {
          "id": "signal",
          "required": true,
          "match": {
            "capability": "usb_vbus_en"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "usb_overcurrent_detect",
      "name": "USB Over-current Detect",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input"
          ]
        }
      ],
      "slots": [
        {
          "id": "signal",
          "required": true,
          "match": {
            "capability": "usb_ovcur_det"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "clock_gp_input",
      "name": "Clock GP Input",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "clock",
          "roles": [
            "input"
          ]
        }
      ],
      "slots": [
        {
          "id": "in",
          "required": true,
          "match": {
            "capability": "clock_gpin"
          }
        }
      ],
      "profiles": [
        {
          "id": "clock_gpin0",
          "label": "CLOCK_GPIN0 (GPIO20, pin 31)",
          "bindings": {
            "in": "pin_31"
          }
        },
        {
          "id": "clock_gpin1",
          "label": "CLOCK_GPIN1 (GPIO22, pin 34)",
          "bindings": {
            "in": "pin_34"
          }
        }
      ],
      "max_instances": 2
    },
    {
      "id": "clock_gp_output",
      "name": "Clock GP Output",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "clock",
          "roles": [
            "output"
          ]
        }
      ],
      "slots": [
        {
          "id": "out",
          "required": true,
          "match": {
            "capability": "clock_gpout"
          }
        }
      ],
      "profiles": [
        {
          "id": "clock_gpout0",
          "label": "CLOCK_GPOUT0 (GPIO21, pin 32)",
          "bindings": {
            "out": "pin_32"
          }
        },
        {
          "id": "clock_gpout1",
          "label": "CLOCK_GPOUT1 (GPIO23, pin 35)",
          "bindings": {
            "out": "pin_35"
          }
        },
        {
          "id": "clock_gpout2",
          "label": "CLOCK_GPOUT2 (GPIO24, pin 36)",
          "bindings": {
            "out": "pin_36"
          }
        },
        {
          "id": "clock_gpout3",
          "label": "CLOCK_GPOUT3 (GPIO25, pin 37)",
          "bindings": {
            "out": "pin_37"
          }
        }
      ],
      "max_instances": 4
    },
    {
      "id": "crystal_oscillator",
      "name": "External Crystal Oscillator (XOSC)",
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "clock",
          "roles": [
            "input"
          ]
        }
      ],
      "slots": [
        {
          "id": "xin",
          "required": true,
          "match": {
            "protocol": "clock",
            "role": "input",
            "capability": "xtal_in"
          }
        },
        {
          "id": "xout",
          "required": false,
          "match": {
            "protocol": "clock",
            "role": "output",
            "capability": "xtal_out"
          }
        }
      ],
      "profiles": [
        {
          "id": "xosc_pins",
          "label": "XIN/XOUT (pins 20/21)",
          "default_active": true,
          "bindings": {
            "xin": "pin_20",
            "xout": "pin_21"
          }
        }
      ],
      "parameters": [
        {
          "id": "clock_freq",
          "unit": "Hz",
          "value": 12000000
        }
      ],
      "max_instances": 1
    },
    {
      "id": "swd",
      "name": "SWD (Serial Wire Debug)",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "swd",
          "roles": [
            "target"
          ]
        }
      ],
      "slots": [
        {
          "id": "swclk",
          "required": true,
          "match": {
            "capability": "swd_clk"
          }
        },
        {
          "id": "swdio",
          "required": true,
          "match": {
            "capability": "swd_io"
          }
        }
      ],
      "profiles": [
        {
          "id": "swd_pins",
          "label": "SWCLK/SWDIO (pins 24/25)",
          "bindings": {
            "swclk": "pin_24",
            "swdio": "pin_25"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "reset_input",
      "name": "RUN Reset",
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "input"
          ]
        }
      ],
      "slots": [
        {
          "id": "run",
          "required": true,
          "match": {
            "capability": "run_reset"
          }
        }
      ],
      "profiles": [
        {
          "id": "run_pin",
          "label": "RUN (pin 26)",
          "default_active": true,
          "bindings": {
            "run": "pin_26"
          }
        }
      ],
      "max_instances": 1
    },
    {
      "id": "footprint_mounting",
      "name": "QFN-56 7×7 mm Surface-Mount Footprint",
      "domain": "mechanical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "mechanical_connection",
          "roles": [
            "mounting_point"
          ]
        }
      ],
      "capabilities": [
        "qfn56_7x7_0p4mm",
        "surface_mount"
      ]
    },
    {
      "id": "thermal_pad",
      "name": "Exposed Thermal Pad",
      "pin": 57,
      "domain": "thermal",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "thermal_connection",
          "roles": [
            "thermal_source"
          ]
        }
      ],
      "capabilities": [
        "heat_sink",
        "pcb_thermal_plane"
      ]
    }
  ],
  "interfaceGroups": [
    {
      "id": "required_power_pins",
      "label": "Required Power Pins",
      "members": [
        "pin_1",
        "pin_10",
        "pin_22",
        "pin_23",
        "pin_33",
        "pin_42",
        "pin_48",
        "pin_49",
        "pin_50",
        "pad_gnd"
      ],
      "policy": "all_of"
    },
    {
      "id": "iovdd_common_net",
      "label": "IOVDD Pins (one 1.8-3.3 V rail)",
      "members": [
        "pin_1",
        "pin_10",
        "pin_22",
        "pin_33",
        "pin_42",
        "pin_49"
      ],
      "policy": "all_of"
    },
    {
      "id": "dvdd_common_net",
      "label": "DVDD Pins (one 1.1 V core rail)",
      "members": [
        "pin_23",
        "pin_50"
      ],
      "policy": "all_of"
    },
    {
      "id": "qspi_flash_pins",
      "label": "Dedicated QSPI Flash Pins",
      "members": [
        "pin_51",
        "pin_52",
        "pin_53",
        "pin_54",
        "pin_55",
        "pin_56"
      ],
      "policy": "all_of"
    },
    {
      "id": "usb_phy_mode",
      "label": "USB PHY Mode (one PHY: device or host)",
      "members": [
        "usb_device",
        "usb_host"
      ],
      "policy": "one_of"
    }
  ],
  "requirements": [
    {
      "type": "power",
      "description": "IOVDD digital I/O ring: six pins (1, 10, 22, 33, 42, 49) tied to one 1.8-3.3 V rail (typical 3.3 V) — mixing rails is not supported. Sets the logic level for all GPIOs and the QSPI interface.",
      "voltage_V": [
        1.8,
        3.3
      ],
      "current_mA": 50
    },
    {
      "type": "power",
      "description": "DVDD digital core: 1.05-1.16 V (typ 1.1 V, Table 634) on pins 23 and 50 — from VREG_VOUT (typical; VREG_VIN accepts 1.8-3.3 V) or an external 1.1 V regulator. Must not be left floating.",
      "voltage_V": [
        1.05,
        1.16
      ],
      "current_mA": 100
    },
    {
      "type": "power",
      "description": "USB_VDD: dedicated 3.135-3.63 V (typ 3.3 V) supply for the USB 1.1 PHY (pin 48). Must be supplied even if USB is unused.",
      "voltage_V": [
        3.135,
        3.63
      ],
      "current_mA": 30
    },
    {
      "type": "interface",
      "description": "No internal flash: the chip cannot boot or run user code without an external QSPI flash (typically 2-16 MB, Winbond W25Q-series compatible with the XIP boot ROM) on the dedicated QSPI pads (pins 51-56).",
      "interface_protocol": "spi"
    },
    {
      "type": "interface",
      "description": "A 12 MHz crystal between XIN/XOUT (or a 12 MHz CMOS clock into XIN with XOUT open) is required for the USB bootloader.",
      "interface_protocol": "clock"
    }
  ],
  "domains": [
    {
      "domain": "electrical",
      "power_domains": [
        {
          "id": "iovdd",
          "name": "IOVDD Digital I/O Supply",
          "nominal_voltage_V": 3.3,
          "voltage_range_V": [
            1.8,
            3.3
          ],
          "max_current_mA": 50
        },
        {
          "id": "dvdd",
          "name": "DVDD Digital Core Supply",
          "nominal_voltage_V": 1.1,
          "voltage_range_V": [
            1.05,
            1.16
          ],
          "max_current_mA": 100
        },
        {
          "id": "vreg_vin",
          "name": "Core LDO Input",
          "nominal_voltage_V": 3.3,
          "voltage_range_V": [
            1.8,
            3.3
          ],
          "max_current_mA": 100,
          "regulation_type": "regulated"
        },
        {
          "id": "usb_vdd",
          "name": "USB PHY Supply",
          "nominal_voltage_V": 3.3,
          "voltage_range_V": [
            3.135,
            3.63
          ],
          "max_current_mA": 30
        },
        {
          "id": "adc_avdd",
          "name": "ADC Analog Supply",
          "nominal_voltage_V": 3.3,
          "voltage_range_V": [
            1.62,
            3.63
          ],
          "max_current_mA": 5
        },
        {
          "id": "gnd",
          "name": "Ground (exposed pad)",
          "nominal_voltage_V": 0,
          "voltage_range_V": [
            0,
            0
          ],
          "max_current_mA": 1000
        }
      ]
    },
    {
      "domain": "mechanical",
      "dimensions_mm": {
        "length": 7,
        "width": 7,
        "height": 0.9
      },
      "package": {
        "name": "QFN-56",
        "pin_count": 56,
        "pitch_mm": 0.4,
        "exposed_pad": true,
        "exposed_pad_pin": 57,
        "exposed_pad_mm": [
          3.1,
          3.1
        ],
        "source": "https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf (build-date 2025-02-20: §5.1 \"The RP2040 7×7 mm QFN-56 package\", \"0.4mm QFN-56\", central GND pad (ePad), D2/E2 3.0-3.2 mm, nominal 3.1; §5.5 Pinout, Table 621: GND 57, \"Common ground connection via central pad\")"
      }
    },
    {
      "domain": "thermal",
      "operating_temperature_C": [
        -40,
        85
      ]
    }
  ],
  "artifacts": [
    {
      "id": "art_datasheet",
      "name": "RP2040 Datasheet",
      "type": "datasheet",
      "url": "https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf"
    },
    {
      "id": "art_hardware_design",
      "name": "Hardware Design with RP2040",
      "type": "datasheet",
      "url": "https://datasheets.raspberrypi.com/rp2040/hardware-design-with-rp2040.pdf"
    }
  ],
  "geometry": {
    "xScale": 1,
    "yScale": 1,
    "outline": {
      "preset": "rectangle"
    }
  }
};
