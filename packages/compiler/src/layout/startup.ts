import type { TargetProfile } from "../target/profile.js";
import { machineCost, machineInstruction } from "../machine/lower-control.js";
import type {
  MachineDataObject,
  MachineFunction,
  MachineInstruction,
  MachineMemoryEffect,
} from "../machine/machine-types.js";

/** Stable identity of the platform-owned cooperative-startup save area. */
export const C64_STARTUP_STATE_ID = "platform.startup-state";

const STARTUP_STATE = Object.freeze({
  a: 0,
  x: 1,
  y: 2,
  status: 3,
  stack: 4,
  cpuDirection: 5,
  cpuPort: 6,
  cia2Port: 7,
  cia2Direction: 8,
  vicMemory: 9,
  spriteEnable: 10,
  spriteXHigh: 11,
  spriteYExpand: 12,
  spritePriority: 13,
  spriteMulticolor: 14,
  spriteXExpand: 15,
  border: 16,
  background: 17,
  spritePositions: 18,
  spriteColors: 34,
  spritePointers: 42,
  bytes: 50,
});

/** Inputs needed to construct the selected cooperative C64 startup. */
export interface C64StartupInput {
  /** Callable module-initializer labels in proved execution order. */
  readonly initializerLabels: readonly string[];
  /** Exact ordered initializer actions when some operations can be safely inlined. */
  readonly initializers?: readonly C64StartupInitializer[];
  /** Selected source entry-function label. */
  readonly mainLabel: string;
  /** Exact selected C64 profile. */
  readonly profile: TargetProfile;
}

/** One ordered module-initializer action performed before the source entry function. */
export type C64StartupInitializer =
  | { readonly kind: "call"; readonly label: string }
  | { readonly kind: "inline"; readonly instructions: readonly MachineInstruction[] };

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

/** Return the resident data object used to restore the caller and C64 after main returns. */
export function createC64StartupStateData(): MachineDataObject {
  return Object.freeze({
    id: C64_STARTUP_STATE_ID,
    kind: "bss",
    alignment: 1,
    bytes: Object.freeze(new Array<number>(STARTUP_STATE.bytes).fill(0)),
  });
}

/** One non-volatile access to the startup save area. */
function stateEffect(kind: "read" | "write", offset: number): MachineMemoryEffect {
  return Object.freeze({
    kind,
    address: Object.freeze({ kind: "symbolic", label: C64_STARTUP_STATE_ID, offset }),
    width: 1,
    volatile: false,
    order: 0,
  });
}

/** Load or store one byte in the startup save area. */
function stateInstruction(
  cpu: TargetProfile["cpu"],
  opcode: "lda" | "ldx" | "ldy" | "sta" | "stx" | "sty",
  offset: number,
): MachineInstruction {
  return machineInstruction(
    cpu,
    opcode,
    "absolute",
    Object.freeze({ kind: "label", label: C64_STARTUP_STATE_ID, offset }),
    [stateEffect(opcode.startsWith("st") ? "write" : "read", offset)],
  );
}

/** Save one byte from a named device register. */
function saveDevice(
  cpu: TargetProfile["cpu"],
  address: number,
  offset: number,
): readonly MachineInstruction[] {
  return Object.freeze([
    machineInstruction(
      cpu,
      "lda",
      deviceMode(address),
      Object.freeze({ kind: "absolute", value: address }),
      [deviceEffect("read", address)],
    ),
    stateInstruction(cpu, "sta", offset),
  ]);
}

/** Restore one byte to a named device register. */
function restoreDevice(
  cpu: TargetProfile["cpu"],
  address: number,
  offset: number,
): readonly MachineInstruction[] {
  return Object.freeze([
    stateInstruction(cpu, "lda", offset),
    machineInstruction(
      cpu,
      "sta",
      deviceMode(address),
      Object.freeze({ kind: "absolute", value: address }),
      [deviceEffect("write", address)],
    ),
  ]);
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
  const preservedDevices = Object.freeze([
    Object.freeze({ address: cpu.portDirectionAddress, offset: STARTUP_STATE.cpuDirection }),
    Object.freeze({ address: cpu.portDataAddress, offset: STARTUP_STATE.cpuPort }),
    Object.freeze({ address: machine.cia2PortA, offset: STARTUP_STATE.cia2Port }),
    Object.freeze({ address: machine.cia2DataDirection, offset: STARTUP_STATE.cia2Direction }),
    Object.freeze({ address: machine.vicMemoryPointer, offset: STARTUP_STATE.vicMemory }),
    Object.freeze({ address: machine.spriteEnable, offset: STARTUP_STATE.spriteEnable }),
    Object.freeze({ address: machine.spriteXHigh, offset: STARTUP_STATE.spriteXHigh }),
    Object.freeze({ address: machine.spriteYExpand, offset: STARTUP_STATE.spriteYExpand }),
    Object.freeze({ address: machine.spritePriority, offset: STARTUP_STATE.spritePriority }),
    Object.freeze({ address: machine.spriteMulticolor, offset: STARTUP_STATE.spriteMulticolor }),
    Object.freeze({ address: machine.spriteXExpand, offset: STARTUP_STATE.spriteXExpand }),
    Object.freeze({ address: machine.borderColor, offset: STARTUP_STATE.border }),
    Object.freeze({ address: machine.backgroundColor, offset: STARTUP_STATE.background }),
    ...Array.from({ length: 16 }, (_, index) =>
      Object.freeze({
        address: machine.spritePositionBase + index,
        offset: STARTUP_STATE.spritePositions + index,
      }),
    ),
    ...Array.from({ length: 8 }, (_, index) =>
      Object.freeze({
        address: machine.spriteColorBase + index,
        offset: STARTUP_STATE.spriteColors + index,
      }),
    ),
    ...Array.from({ length: 8 }, (_, index) =>
      Object.freeze({
        address: machine.spritePointerBase + index,
        offset: STARTUP_STATE.spritePointers + index,
      }),
    ),
  ]);
  const entry: MachineInstruction[] = [
    stateInstruction(cpu, "sta", STARTUP_STATE.a),
    stateInstruction(cpu, "stx", STARTUP_STATE.x),
    stateInstruction(cpu, "sty", STARTUP_STATE.y),
    machineInstruction(cpu, "php", "implied", null),
    machineInstruction(cpu, "pla", "implied", null),
    stateInstruction(cpu, "sta", STARTUP_STATE.status),
    machineInstruction(cpu, "tsx", "implied", null),
    stateInstruction(cpu, "stx", STARTUP_STATE.stack),
    machineInstruction(cpu, "cld", "implied", null),
  ];
  for (const { address, offset } of preservedDevices) {
    entry.push(...saveDevice(cpu, address, offset));
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
    machineInstruction(
      cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.spriteYExpand }),
      [deviceEffect("write", machine.spriteYExpand)],
    ),
    machineInstruction(
      cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.spritePriority }),
      [deviceEffect("write", machine.spritePriority)],
    ),
    machineInstruction(
      cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.spriteMulticolor }),
      [deviceEffect("write", machine.spriteMulticolor)],
    ),
    machineInstruction(
      cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.spriteXExpand }),
      [deviceEffect("write", machine.spriteXExpand)],
    ),
    machineInstruction(
      cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.borderColor }),
      [deviceEffect("write", machine.borderColor)],
    ),
    machineInstruction(
      cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.backgroundColor }),
      [deviceEffect("write", machine.backgroundColor)],
    ),
  );
  const initializers =
    input.initializers ??
    input.initializerLabels.map((label) => Object.freeze({ kind: "call" as const, label }));
  for (const initializer of initializers) {
    if (initializer.kind === "inline") {
      entry.push(...initializer.instructions);
    } else {
      entry.push(
        machineInstruction(
          cpu,
          "jsr",
          "absolute",
          Object.freeze({ kind: "label", label: initializer.label }),
        ),
      );
    }
  }

  const restore: MachineInstruction[] = [];
  for (const { address, offset } of preservedDevices.slice(4)) {
    restore.push(...restoreDevice(cpu, address, offset));
  }
  restore.push(
    ...restoreDevice(cpu, machine.cia2PortA, STARTUP_STATE.cia2Port),
    ...restoreDevice(cpu, machine.cia2DataDirection, STARTUP_STATE.cia2Direction),
    ...restoreDevice(cpu, cpu.portDataAddress, STARTUP_STATE.cpuPort),
    ...restoreDevice(cpu, cpu.portDirectionAddress, STARTUP_STATE.cpuDirection),
    stateInstruction(cpu, "ldx", STARTUP_STATE.stack),
    machineInstruction(cpu, "txs", "implied", null),
    stateInstruction(cpu, "lda", STARTUP_STATE.status),
    machineInstruction(cpu, "pha", "implied", null),
    stateInstruction(cpu, "lda", STARTUP_STATE.a),
    stateInstruction(cpu, "ldx", STARTUP_STATE.x),
    stateInstruction(cpu, "ldy", STARTUP_STATE.y),
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
