import type { ModuleDef } from "../../src/types/index.js";

// Reuse the Arduino Nano and L298N from existing fixtures
// but the arm project also needs a battery and DC motor

export const BatteryPack12V: ModuleDef = {
  id: "battery-12v",
  name: "12V Battery Pack",
  version: "1.0.0",
  tags: ["battery", "12v", "power"],
  categories: ["power.battery"],

  interfaces: [
    {
      id: "power_out",
      name: "12V Output",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["output"] }],
      parameters: [
        { id: "voltage", unit: "V", value: 12, range: [10.8, 12.6] },
        { id: "max_current", unit: "A", value: 5 },
      ],
    },
    {
      id: "gnd",
      name: "Ground",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["ground"] }],
      capabilities: ["ground"],
    },
  ],
};

export const DCMotor12V: ModuleDef = {
  id: "dc-motor-12v",
  name: "12V DC Motor",
  version: "1.0.0",
  tags: ["motor", "dc", "12v"],
  categories: ["actuator.motor"],

  interfaces: [
    {
      id: "motor_in",
      name: "Motor Input",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "dc_motor", roles: ["input"] }],
      slots: [
        { id: "lead_a", required: true, match: { protocol: "dc_motor", role: "lead", capability: "motor_lead" } },
        { id: "lead_b", required: true, match: { protocol: "dc_motor", role: "lead", capability: "motor_lead" } },
      ],
      profiles: [
        { id: "default", bindings: { lead_a: "terminal_a", lead_b: "terminal_b" }, default_active: true },
      ],
      parameters: [
        { id: "voltage", unit: "V", range: [6, 12] },
        { id: "stall_current", unit: "A", value: 1.5 },
      ],
    },

    // Leaf interfaces
    {
      id: "terminal_a",
      name: "Terminal A",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "dc_motor", roles: ["lead"] }],
      capabilities: ["motor_lead"],
    },
    {
      id: "terminal_b",
      name: "Terminal B",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "dc_motor", roles: ["lead"] }],
      capabilities: ["motor_lead"],
    },
  ],
};

/**
 * 6-Axis Robotic Arm — Module-of-Modules
 *
 * Architecture:
 * - 1 Arduino Nano (controller)
 * - 3 L298N motor drivers (2 axes each)
 * - 6 DC motors (one per axis)
 * - 1 12V battery pack
 *
 * Connections:
 * - Arduino → L298N: motor_control per axis (compositional: PWM + 2x digital)
 * - L298N → Motor: dc_motor output per channel
 * - Arduino → L298N: 5V logic power
 * - Battery → L298N: 12V motor power
 */
export const SixAxisArm: ModuleDef = {
  id: "six-axis-arm",
  name: "6-Axis Robotic Arm",
  version: "1.0.0",
  tags: ["robot", "arm", "6-axis", "l298n"],
  categories: ["robotics.educational"],

  interfaces: [
    // The arm exposes a power input to the outside
    {
      id: "power_in",
      name: "System Power",
      domain: "electrical",
      exposed: true,
      default_active: true,
      protocols: [{ type: "power", roles: ["input"] }],
      parameters: [{ id: "voltage", unit: "V", range: [10.8, 12.6] }],
    },
  ],

  children: [
    { id: "nano", moduleDefId: "arduino-nano" },
    { id: "driver_1", moduleDefId: "l298n" },
    { id: "driver_2", moduleDefId: "l298n" },
    { id: "driver_3", moduleDefId: "l298n" },
    { id: "motor_1", moduleDefId: "dc-motor-12v" },
    { id: "motor_2", moduleDefId: "dc-motor-12v" },
    { id: "motor_3", moduleDefId: "dc-motor-12v" },
    { id: "motor_4", moduleDefId: "dc-motor-12v" },
    { id: "motor_5", moduleDefId: "dc-motor-12v" },
    { id: "motor_6", moduleDefId: "dc-motor-12v" },
    { id: "battery", moduleDefId: "battery-12v" },
  ],

  harnesses: [
    // --- Axis Control: Arduino → L298N motor_control channels ---
    // Each axis uses one motor_control profile on the L298N

    // Driver 1: Axes 1-2
    {
      id: "axis1_ctrl",
      name: "Axis 1 Control",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Nano → Axis 1", childModuleId: "nano" },
        { id: "b", label: "Driver 1 Ch A", childModuleId: "driver_1", interfaceId: "motor_control", profileInstanceId: "channel_a" },
      ],
    },
    {
      id: "axis2_ctrl",
      name: "Axis 2 Control",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Nano → Axis 2", childModuleId: "nano" },
        { id: "b", label: "Driver 1 Ch B", childModuleId: "driver_1", interfaceId: "motor_control", profileInstanceId: "channel_b" },
      ],
    },

    // Driver 2: Axes 3-4
    {
      id: "axis3_ctrl",
      name: "Axis 3 Control",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Nano → Axis 3", childModuleId: "nano" },
        { id: "b", label: "Driver 2 Ch A", childModuleId: "driver_2", interfaceId: "motor_control", profileInstanceId: "channel_a" },
      ],
    },
    {
      id: "axis4_ctrl",
      name: "Axis 4 Control",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Nano → Axis 4", childModuleId: "nano" },
        { id: "b", label: "Driver 2 Ch B", childModuleId: "driver_2", interfaceId: "motor_control", profileInstanceId: "channel_b" },
      ],
    },

    // Driver 3: Axes 5-6
    {
      id: "axis5_ctrl",
      name: "Axis 5 Control",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Nano → Axis 5", childModuleId: "nano" },
        { id: "b", label: "Driver 3 Ch A", childModuleId: "driver_3", interfaceId: "motor_control", profileInstanceId: "channel_a" },
      ],
    },
    {
      id: "axis6_ctrl",
      name: "Axis 6 Control",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Nano → Axis 6", childModuleId: "nano" },
        { id: "b", label: "Driver 3 Ch B", childModuleId: "driver_3", interfaceId: "motor_control", profileInstanceId: "channel_b" },
      ],
    },

    // --- Motor Output: L298N → DC Motors ---

    {
      id: "axis1_motor",
      name: "Axis 1 Motor",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Driver 1 Out A", childModuleId: "driver_1", interfaceId: "motor_output", profileInstanceId: "output_a" },
        { id: "b", label: "Motor 1", childModuleId: "motor_1", interfaceId: "motor_in" },
      ],
    },
    {
      id: "axis2_motor",
      name: "Axis 2 Motor",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Driver 1 Out B", childModuleId: "driver_1", interfaceId: "motor_output", profileInstanceId: "output_b" },
        { id: "b", label: "Motor 2", childModuleId: "motor_2", interfaceId: "motor_in" },
      ],
    },
    {
      id: "axis3_motor",
      name: "Axis 3 Motor",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Driver 2 Out A", childModuleId: "driver_2", interfaceId: "motor_output", profileInstanceId: "output_a" },
        { id: "b", label: "Motor 3", childModuleId: "motor_3", interfaceId: "motor_in" },
      ],
    },
    {
      id: "axis4_motor",
      name: "Axis 4 Motor",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Driver 2 Out B", childModuleId: "driver_2", interfaceId: "motor_output", profileInstanceId: "output_b" },
        { id: "b", label: "Motor 4", childModuleId: "motor_4", interfaceId: "motor_in" },
      ],
    },
    {
      id: "axis5_motor",
      name: "Axis 5 Motor",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Driver 3 Out A", childModuleId: "driver_3", interfaceId: "motor_output", profileInstanceId: "output_a" },
        { id: "b", label: "Motor 5", childModuleId: "motor_5", interfaceId: "motor_in" },
      ],
    },
    {
      id: "axis6_motor",
      name: "Axis 6 Motor",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Driver 3 Out B", childModuleId: "driver_3", interfaceId: "motor_output", profileInstanceId: "output_b" },
        { id: "b", label: "Motor 6", childModuleId: "motor_6", interfaceId: "motor_in" },
      ],
    },

    // --- Power: Arduino 5V → L298N logic ---
    {
      id: "logic_pwr_1",
      name: "Logic Power D1",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Nano 5V", childModuleId: "nano", interfaceId: "power_5v_out" },
        { id: "b", label: "Driver 1 Logic", childModuleId: "driver_1", interfaceId: "power_5v" },
      ],
    },
    {
      id: "logic_pwr_2",
      name: "Logic Power D2",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Nano 5V", childModuleId: "nano", interfaceId: "power_5v_out" },
        { id: "b", label: "Driver 2 Logic", childModuleId: "driver_2", interfaceId: "power_5v" },
      ],
    },
    {
      id: "logic_pwr_3",
      name: "Logic Power D3",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Nano 5V", childModuleId: "nano", interfaceId: "power_5v_out" },
        { id: "b", label: "Driver 3 Logic", childModuleId: "driver_3", interfaceId: "power_5v" },
      ],
    },

    // --- Power: Battery → L298N motor power ---
    {
      id: "motor_pwr_1",
      name: "Motor Power D1",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Battery 12V", childModuleId: "battery", interfaceId: "power_out" },
        { id: "b", label: "Driver 1 Vs", childModuleId: "driver_1", interfaceId: "power_in" },
      ],
    },
    {
      id: "motor_pwr_2",
      name: "Motor Power D2",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Battery 12V", childModuleId: "battery", interfaceId: "power_out" },
        { id: "b", label: "Driver 2 Vs", childModuleId: "driver_2", interfaceId: "power_in" },
      ],
    },
    {
      id: "motor_pwr_3",
      name: "Motor Power D3",
      topology: "wire",
      domain: "electrical",
      endpoints: [
        { id: "a", label: "Battery 12V", childModuleId: "battery", interfaceId: "power_out" },
        { id: "b", label: "Driver 3 Vs", childModuleId: "driver_3", interfaceId: "power_in" },
      ],
    },
  ],
};
