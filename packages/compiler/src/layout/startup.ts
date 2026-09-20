import type { TargetProfile } from "../target/profile.js";
import { machineCost, machineInstruction } from "../machine/lower-control.js";
import type { MachineFunction, MachineMemoryEffect } from "../machine/machine-types.js";

/** Inputs needed to construct the selected cooperative C64 startup. */
export interface C64StartupInput {
  /** Module-initializer labels in proved execution order. */
  readonly initializerLabels: readonly string[];
  /** Selected source entry-function label. */
  readonly mainLabel: string;
  /** Exact selected C64 profile. */
  readonly profile: TargetProfile;
}

/** Exact BASIC stub and structured startup, or a terminal profile mismatch. */
export type C64StartupResult =
  | {
      readonly kind: "complete";
      readonly stub: { readonly origin: 0x0801; readonly bytes: readonly number[] };
      readonly startup: MachineFunction & { readonly origin: 0x080d };
    }
  | { readonly kind: "error"; readonly reason: string };

const BASIC_STUB = Object.freeze([
  0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00,
]);

/** One volatile platform-state access. */
function deviceEffect(kind: "read" | "write", address: number): MachineMemoryEffect {
  return Object.freeze({
    kind,
    address: Object.freeze({ kind: "absolute", value: address }),
    width: 1,
    volatile: true,
    order: 0,
  });
}

/** Select the shortest legal form for a fixed device address. */
function deviceMode(address: number): "zero-page" | "absolute" {
  return address <= 0xff ? "zero-page" : "absolute";
}

/**
 * Build the fixed C64 BASIC entry, ordered initializer calls and returning restore path.
 * @param input Initializer/main identities and exact selected profile.
 * @returns The 12-byte stub plus one structured startup function.
 */
export function createC64Startup(input: C64StartupInput): C64StartupResult {
  if (input.profile.id !== "c64-pal-prg-kernal-6581") {
    return Object.freeze({ kind: "error", reason: "Startup requires the selected C64 profile" });
  }
  const cpu = input.profile.cpu;
  const machine = input.profile.machine;
  const preservedAddresses = Object.freeze([
    cpu.portDirectionAddress,
    cpu.portDataAddress,
    machine.cia2DataDirection,
    machine.cia2PortA,
    machine.vicMemoryPointer,
    machine.spriteEnable,
  ]);
  const entry = [
    machineInstruction(cpu, "php", "implied", null),
    machineInstruction(cpu, "cld", "implied", null),
    machineInstruction(cpu, "pha", "implied", null),
    machineInstruction(cpu, "txa", "implied", null),
    machineInstruction(cpu, "pha", "implied", null),
    machineInstruction(cpu, "tya", "implied", null),
    machineInstruction(cpu, "pha", "implied", null),
  ];
  for (const address of preservedAddresses) {
    entry.push(
      machineInstruction(
        cpu,
        "lda",
        deviceMode(address),
        Object.freeze({ kind: "absolute", value: address }),
        [deviceEffect("read", address)],
      ),
      machineInstruction(cpu, "pha", "implied", null),
    );
  }
  entry.push(
    machineInstruction(
      cpu,
      "lda",
      deviceMode(cpu.portDataAddress),
      Object.freeze({ kind: "absolute", value: cpu.portDataAddress }),
      [deviceEffect("read", cpu.portDataAddress)],
    ),
    machineInstruction(cpu, "and", "immediate", Object.freeze({ kind: "immediate", value: 0xf8 })),
    machineInstruction(cpu, "ora", "immediate", Object.freeze({ kind: "immediate", value: 0x06 })),
    machineInstruction(
      cpu,
      "sta",
      deviceMode(cpu.portDataAddress),
      Object.freeze({ kind: "absolute", value: cpu.portDataAddress }),
      [deviceEffect("write", cpu.portDataAddress)],
    ),
    machineInstruction(
      cpu,
      "lda",
      deviceMode(cpu.portDirectionAddress),
      Object.freeze({ kind: "absolute", value: cpu.portDirectionAddress }),
      [deviceEffect("read", cpu.portDirectionAddress)],
    ),
    machineInstruction(cpu, "ora", "immediate", Object.freeze({ kind: "immediate", value: 0x07 })),
    machineInstruction(
      cpu,
      "sta",
      deviceMode(cpu.portDirectionAddress),
      Object.freeze({ kind: "absolute", value: cpu.portDirectionAddress }),
      [deviceEffect("write", cpu.portDirectionAddress)],
    ),
    machineInstruction(
      cpu,
      "lda",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.cia2PortA }),
      [deviceEffect("read", machine.cia2PortA)],
    ),
    machineInstruction(cpu, "ora", "immediate", Object.freeze({ kind: "immediate", value: 0x03 })),
    machineInstruction(
      cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.cia2PortA }),
      [deviceEffect("write", machine.cia2PortA)],
    ),
    machineInstruction(
      cpu,
      "lda",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.cia2DataDirection }),
      [deviceEffect("read", machine.cia2DataDirection)],
    ),
    machineInstruction(cpu, "ora", "immediate", Object.freeze({ kind: "immediate", value: 0x03 })),
    machineInstruction(
      cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.cia2DataDirection }),
      [deviceEffect("write", machine.cia2DataDirection)],
    ),
    machineInstruction(cpu, "lda", "immediate", Object.freeze({ kind: "immediate", value: 0x14 })),
    machineInstruction(
      cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.vicMemoryPointer }),
      [deviceEffect("write", machine.vicMemoryPointer)],
    ),
    machineInstruction(cpu, "lda", "immediate", Object.freeze({ kind: "immediate", value: 0 })),
    machineInstruction(
      cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.spriteEnable }),
      [deviceEffect("write", machine.spriteEnable)],
    ),
  );
  for (const label of input.initializerLabels) {
    entry.push(machineInstruction(cpu, "jsr", "absolute", Object.freeze({ kind: "label", label })));
  }

  const restore = [];
  for (const address of [...preservedAddresses].reverse()) {
    restore.push(
      machineInstruction(cpu, "pla", "implied", null),
      machineInstruction(
        cpu,
        "sta",
        deviceMode(address),
        Object.freeze({ kind: "absolute", value: address }),
        [deviceEffect("write", address)],
      ),
    );
  }
  restore.push(
    machineInstruction(cpu, "pla", "implied", null),
    machineInstruction(cpu, "tay", "implied", null),
    machineInstruction(cpu, "pla", "implied", null),
    machineInstruction(cpu, "tax", "implied", null),
    machineInstruction(cpu, "pla", "implied", null),
    machineInstruction(cpu, "plp", "implied", null),
  );

  return Object.freeze({
    kind: "complete",
    stub: Object.freeze({ origin: 0x0801, bytes: BASIC_STUB }),
    startup: Object.freeze({
      id: "startup",
      origin: 0x080d,
      blocks: Object.freeze([
        Object.freeze({
          label: "startup.entry",
          instructions: Object.freeze(entry),
          terminator: Object.freeze({ kind: "fallthrough", target: input.mainLabel }),
        }),
        Object.freeze({
          label: "startup.restore",
          instructions: Object.freeze(restore),
          terminator: Object.freeze({
            kind: "return",
            opcode: "rts",
            cost: machineCost(cpu, "rts", "implied"),
          }),
        }),
      ]),
    }),
  });
}
