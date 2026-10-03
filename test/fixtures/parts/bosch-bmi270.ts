/**
 * FIXTURE: a frozen copy of a part definition (BMI270 datasheet BST-BMI270-DS000-08) for UHD's own tests:
 * interfaces, pin table, package and the traits the checks read. Evidence,
 * CAD and notes are left out. It is not maintained as a part: change it only
 * when a test needs it.
 */
import type { ModuleDef } from "../../../src/types/index.js";

export const BOSCH_BMI270: ModuleDef = {
  "id": "bosch-bmi270",
  "name": "Bosch BMI270",
  "version": "1.2.0",
  "manufacturer": "Bosch Sensortec",
  "part_number": "BMI270",
  "description": "6-axis IMU (16-bit accelerometer ±2/4/8/16 g, 16-bit gyroscope ±125-2000 dps) in a 14-pad LGA, 3.0 x 2.5 x 0.83 mm. Primary I2C (0x68/0x69, up to 1 MHz) or SPI (up to 10 MHz) target interface; secondary AUX I2C / OIS SPI. VDD 1.71-3.6 V, VDDIO 1.2-3.6 V.",
  "tags": [
    "bmi270",
    "bosch",
    "imu",
    "accelerometer",
    "gyroscope",
    "6-axis",
    "i2c",
    "spi",
    "lga-14"
  ],
  "categories": [
    "sensor",
    "sensor.motion"
  ],
  "interfaces": [
    {
      "id": "pin_1",
      "name": "SDO",
      "pin": 1,
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
        "spi_miso"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            3.6
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "SDO — primary interface: serial data output in SPI 4W; I2C address bit-0 select in I2C mode.",
            "connect_to": "SPI4W: SDO; SPI3W: DNC; I2C: GND for default I2C address",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        },
        {
          "type": "strap",
          "params": {
            "function": "I2C address bit 0",
            "when": [
              "i2c"
            ],
            "levels": {
              "low": "address 0x68 (SDO to GND)",
              "high": "address 0x69 (SDO to VDDIO)"
            },
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (§6.5, Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_2",
      "name": "ASDx",
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
        }
      ],
      "capabilities": [
        "digital_io",
        "i2c_sda",
        "spi_mosi"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            3.6
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "ASDx — secondary interface: Aux interface / OIS interface data (Aux SDA or OIS SDI).",
            "connect_to": "VDDIO or DNC or Aux SDA or OIS SDI; do not connect to GND if unused",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_3",
      "name": "ASCx",
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
        }
      ],
      "capabilities": [
        "digital_io",
        "i2c_scl",
        "spi_sck"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            3.6
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "ASCx — secondary interface: Aux interface / OIS interface clock (Aux SCL or OIS SCK).",
            "connect_to": "VDDIO or DNC or Aux SCL or OIS SCK; do not connect to GND if unused",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_4",
      "name": "INT1",
      "pin": 4,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "interrupt",
          "roles": [
            "output"
          ]
        },
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
        "interrupt"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            3.6
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "INT1 — interrupt pin 1. If unused, do not connect. Can be configured as input for FIFO external data synchronization.",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_5",
      "name": "VDDIO",
      "pin": 5,
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
          "value": 1.8,
          "range": [
            1.2,
            3.6
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "VDDIO — digital I/O supply voltage (1.2 … 3.6V).",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_6",
      "name": "GNDIO",
      "pin": 6,
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
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "GNDIO — ground for I/O.",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_7",
      "name": "GND",
      "pin": 7,
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
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "GND — ground for digital & analog.",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_8",
      "name": "VDD",
      "pin": 8,
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
          "value": 1.8,
          "range": [
            1.71,
            3.6
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "VDD — power supply analog & digital domain (1.71V – 3.6V).",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_9",
      "name": "INT2",
      "pin": 9,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "interrupt",
          "roles": [
            "output"
          ]
        },
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
        "interrupt"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            3.6
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "INT2 — interrupt pin 2. If unused, do not connect. Can be configured as input for FIFO external data synchronization.",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_10",
      "name": "OCSB",
      "pin": 10,
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
        "digital_io",
        "spi_ss"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            3.6
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "OCSB — secondary OIS interface chip select (digital in).",
            "connect_to": "DNC or OIS CSB; tie to GND only if IF_CONF.ois_en = 0",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_11",
      "name": "OSDO",
      "pin": 11,
      "domain": "electrical",
      "exposed": true,
      "default_active": true,
      "protocols": [
        {
          "type": "digital",
          "roles": [
            "output"
          ]
        }
      ],
      "capabilities": [
        "digital_io",
        "spi_miso"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            3.6
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "OSDO — secondary OIS interface serial data out (digital out).",
            "connect_to": "DNC or OIS SDO; tie to GND only if IF_CONF.ois_en = 0",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_12",
      "name": "CSB",
      "pin": 12,
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
        "digital_io",
        "spi_ss"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            3.6
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "CSB — primary interface chip select for SPI mode.",
            "connect_to": "SPI: CSB; I2C: VDDIO (DNC possible with internal pull-up, not recommended)",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_13",
      "name": "SCx",
      "pin": 13,
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
        "digital_io",
        "spi_sck",
        "i2c_scl"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            3.6
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "SCx — primary interface: SCK for SPI serial clock, SCL for I2C serial clock.",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "pin_14",
      "name": "SDx",
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
        }
      ],
      "capabilities": [
        "digital_io",
        "spi_mosi",
        "i2c_sda"
      ],
      "parameters": [
        {
          "id": "voltage",
          "unit": "V",
          "range": [
            1.2,
            3.6
          ]
        }
      ],
      "traits": [
        {
          "type": "pin_functions",
          "params": {
            "description": "SDx — primary interface: SDA serial data I/O in I2C; SDI serial data input in SPI 4W; SDA (SDIO) serial data I/O in SPI 3W.",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 22)"
          }
        }
      ]
    },
    {
      "id": "i2c",
      "name": "Primary I2C (target)",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "i2c",
          "roles": [
            "slave"
          ]
        }
      ],
      "parameters": [
        {
          "id": "clock_freq",
          "unit": "Hz",
          "range": [
            0,
            1000000
          ]
        },
        {
          "id": "i2c_address",
          "unit": "dimensionless",
          "value": 104
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
          "id": "i2c_default",
          "label": "Primary I2C (target)",
          "bindings": {
            "sda": "pin_14",
            "scl": "pin_13"
          }
        }
      ]
    },
    {
      "id": "spi_4wire",
      "name": "Primary SPI 4-wire (target)",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "spi",
          "roles": [
            "slave"
          ]
        }
      ],
      "parameters": [
        {
          "id": "clock_freq",
          "unit": "Hz",
          "range": [
            0,
            10000000
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
          "id": "spi_4wire_default",
          "label": "Primary SPI 4-wire (target)",
          "bindings": {
            "mosi": "pin_14",
            "miso": "pin_1",
            "sck": "pin_13",
            "ss": "pin_12"
          }
        }
      ]
    },
    {
      "id": "aux_i2c",
      "name": "Secondary AUX I2C (controller)",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "i2c",
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
          "id": "aux_i2c_default",
          "label": "Secondary AUX I2C (controller)",
          "bindings": {
            "sda": "pin_2",
            "scl": "pin_3"
          }
        }
      ]
    },
    {
      "id": "ois_spi",
      "name": "Secondary OIS SPI (target)",
      "domain": "electrical",
      "exposed": true,
      "default_active": false,
      "protocols": [
        {
          "type": "spi",
          "roles": [
            "slave"
          ]
        }
      ],
      "parameters": [
        {
          "id": "clock_freq",
          "unit": "Hz",
          "range": [
            0,
            10000000
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
          "id": "ois_spi_default",
          "label": "Secondary OIS SPI (target)",
          "bindings": {
            "mosi": "pin_2",
            "miso": "pin_11",
            "sck": "pin_3",
            "ss": "pin_10"
          }
        }
      ]
    },
    {
      "id": "pcb_mount",
      "name": "LGA-14 pads (SMD)",
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
        "surface_mount",
        "lga14_2p5x3p0_0p5mm"
      ],
      "traits": [
        {
          "type": "connector",
          "params": {
            "connector_type": "lga_14",
            "note": "14 metallized Cu pads on the underside, pitch 0.5 mm; side pads 0.475 x 0.25 mm, top/bottom pads 0.25 x 0.475 mm; package 3.00 x 2.50 x 0.83 mm.",
            "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (§8.1)"
          }
        }
      ]
    }
  ],
  "interfaceGroups": [
    {
      "id": "primary_host_interface",
      "label": "Primary host interface (I2C or SPI, shared pads)",
      "members": [
        "i2c",
        "spi_4wire"
      ],
      "policy": "one_of"
    },
    {
      "id": "secondary_interface",
      "label": "Secondary interface (AUX I2C or OIS SPI, shared pads)",
      "members": [
        "aux_i2c",
        "ois_spi"
      ],
      "policy": "one_of"
    },
    {
      "id": "required_power_pins",
      "label": "Supply pads",
      "members": [
        "pin_5",
        "pin_6",
        "pin_7",
        "pin_8"
      ],
      "policy": "all_of"
    }
  ],
  "artifacts": [
    {
      "id": "datasheet",
      "name": "BMI270 datasheet BST-BMI270-DS000-08 rev 1.6",
      "type": "datasheet",
      "url": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf"
    }
  ],
  "domains": [
    {
      "domain": "electrical",
      "power_domains": [
        {
          "id": "vdd",
          "name": "VDD (analog & digital)",
          "nominal_voltage_V": 1.8,
          "voltage_range_V": [
            1.71,
            3.6
          ]
        },
        {
          "id": "vddio",
          "name": "VDDIO (digital I/O)",
          "nominal_voltage_V": 1.8,
          "voltage_range_V": [
            1.2,
            3.6
          ]
        }
      ]
    },
    {
      "domain": "mechanical",
      "dimensions_mm": {
        "length": 3,
        "width": 2.5,
        "height": 0.83
      },
      "package": {
        "name": "LGA-14",
        "pin_count": 14,
        "pitch_mm": 0.5,
        "exposed_pad": false,
        "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Basic description: \"LGA mold package, 14 pins, footprint 2.5x3.0mm², height 0.83mm\"; §8.1 package outline)"
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
  "traits": [
    {
      "type": "operating_conditions",
      "params": {
        "vdd_V": [
          1.71,
          3.6
        ],
        "vddio_V": [
          1.2,
          3.6
        ],
        "temperature_C": [
          -40,
          85
        ],
        "power_on_time_ms": 2,
        "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 1)"
      }
    },
    {
      "type": "absolute_maximum",
      "params": {
        "vdd_V": [
          -0.3,
          4
        ],
        "vddio_V": [
          -0.3,
          4
        ],
        "logic_pin_V": "-0.3 to VDDIO+0.3, < 4",
        "storage_temperature_C": [
          -50,
          150
        ],
        "esd": "HBM 2 kV, CDM 500 V, MM 200 V",
        "mechanical_shock": "20,000 g (<= 200 us), 2,000 g (<= 1.0 ms)",
        "source": "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf (Table 5)"
      }
    }
  ]
};
