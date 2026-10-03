import type { ModuleDef } from "../../src/types/index.js";

export const RobotCar: ModuleDef = {
  id: "robot-car",
  name: "Robot Car",
  version: "1.0.0",
  tags: ["robot", "car", "project"],
  categories: ["robotics.educational"],

  interfaces: [
    // The robot car exposes a power input to the outside
    {
      id: "power_in",
      name: "System Power",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["input"] }],
      parameters: [{ id: "voltage", unit: "V", range: [7, 12] }],
    },
  ],

  children: [
    { id: "arduino", moduleDefId: "arduino-nano" },
    { id: "l298n", moduleDefId: "l298n" },
    { id: "vl53l0x", moduleDefId: "vl53l0x" },
    { id: "motor_left", moduleDefId: "dc-motor" },
    { id: "motor_right", moduleDefId: "dc-motor" },
  ],

  harnesses: [
    // I2C bus: Arduino ↔ VL53L0X
    {
      id: "sensor_bus",
      name: "Sensor I2C Bus",
      topology: "bus",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "MCU I2C", childModuleId: "arduino", interfaceId: "i2c", profileInstanceId: "i2c_0" },
        { id: "b", label: "Sensor I2C", childModuleId: "vl53l0x", interfaceId: "i2c" },
      ],
    },
    // Motor control A: Arduino → L298N channel A (compositional)
    {
      id: "motor_ctrl_a",
      name: "Motor Control A",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "MCU PWM/Digital", childModuleId: "arduino" },
        { id: "b", label: "Motor Driver Ch A", childModuleId: "l298n", interfaceId: "motor_control", profileInstanceId: "channel_a" },
      ],
    },
    // Motor control B: Arduino → L298N channel B
    {
      id: "motor_ctrl_b",
      name: "Motor Control B",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "MCU PWM/Digital", childModuleId: "arduino" },
        { id: "b", label: "Motor Driver Ch B", childModuleId: "l298n", interfaceId: "motor_control", profileInstanceId: "channel_b" },
      ],
    },
    // Motor output A: L298N → Left motor
    {
      id: "motor_a_power",
      name: "Motor A Power",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Driver Output A", childModuleId: "l298n", interfaceId: "motor_output", profileInstanceId: "output_a" },
        { id: "b", label: "Left Motor", childModuleId: "motor_left", interfaceId: "power" },
      ],
    },
    // Motor output B: L298N → Right motor
    {
      id: "motor_b_power",
      name: "Motor B Power",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Driver Output B", childModuleId: "l298n", interfaceId: "motor_output", profileInstanceId: "output_b" },
        { id: "b", label: "Right Motor", childModuleId: "motor_right", interfaceId: "power" },
      ],
    },
    // Power: system → L298N + Arduino
    {
      id: "main_power",
      name: "Main Power Distribution",
      topology: "bus",
      domain: "electrical",
      endpoints: [
        { id: "source", label: "System Power", interfaceId: "power_in" },
        { id: "mcu", label: "MCU Power", childModuleId: "arduino", interfaceId: "power_vin" },
        { id: "driver", label: "Motor Driver Power", childModuleId: "l298n", interfaceId: "power_in" },
      ],
    },
  ],

  artifacts: [
    { id: "wiring_diagram", name: "Wiring Diagram", type: "documentation", url: "https://example.com/robot-car-wiring.pdf" },
  ],
};
