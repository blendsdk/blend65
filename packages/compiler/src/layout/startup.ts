import type { TargetProfile } from "../target/profile.js";
import { selectC64KernalFacts } from "../profile/c64-kernal.js";
import { machineCost, machineInstruction } from "../machine/lower-control.js";
import type {
  MachineDataObject,
  MachineFunction,
  MachineInstruction,
  MachineMemoryEffect,
} from "../machine/machine-types.js";
import type { StorageHome } from "../storage/storage-types.js";
import type { MachineProgram } from "../machine/machine-types.js";

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
  cia2Direction: 7,
  vicMemory: 8,
  spriteEnable: 9,
  spriteXHigh: 10,
  spriteYExpand: 11,
  spritePriority: 12,
  spriteMulticolor: 13,
  spriteXExpand: 14,
  border: 15,
  background: 16,
  spritePositions: 17,
  spriteColors: 33,
  spritePointers: 41,
  bytes: 49,
});

/** Balanced display-independent programs need only status and the three mapping bytes. */
const COMPACT_STARTUP_STATE = Object.freeze({
  ...STARTUP_STATE,
  status: 0,
  cpuDirection: 1,
  cpuPort: 2,
  cia2Direction: 3,
  bytes: 4,
});

/** Inputs needed to construct the selected cooperative C64 startup. */
export interface C64StartupInput {
  /** Closed-program proof that no source owner depends on the display defaults. */
  readonly displayIndependent?: boolean;
  /** Actual allocated zero-page bytes borrowed from the cooperative BASIC caller. */
  readonly borrowedZeroPage?: readonly number[];
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
export function createC64StartupStateData(
  input: Pick<C64StartupInput, "displayIndependent" | "borrowedZeroPage"> = {},
): MachineDataObject {
  const state = input.displayIndependent === true ? COMPACT_STARTUP_STATE : STARTUP_STATE;
  return Object.freeze({
    id: C64_STARTUP_STATE_ID,
    kind: "bss",
    alignment: 1,
    bytes: Object.freeze(new Array<number>(state.bytes + borrowedBasicBytes(input).length).fill(0)),
  });
}

/**
 * Preserve only actually borrowed addresses. $02 is free; the remaining admitted
 * BASIC window contains vectors, persistent data, executable CHRGET and temporaries.
 * Without a complete BASIC liveness proof, temporary-looking bytes are not assumed dead.
 */
function borrowedBasicBytes(input: Pick<C64StartupInput, "borrowedZeroPage">): readonly number[] {
  return [...new Set(input.borrowedZeroPage)]
    .filter((address) => address >= 3 && address <= 0x8f)
    .sort((left, right) => left - right);
}

/**
 * Bind platform-owned BASIC snapshots to the existing final ZP allocation. This
 * saves caller state for the whole program; it does not invent a function home or
 * helper spill after storage closure. Direct machine programs keep the full default.
 * A malformed supplied save object remains an error rather than being overwritten.
 */
export function bindC64StartupState(
  program: MachineProgram,
  homes: readonly StorageHome[],
  profile: TargetProfile,
): MachineProgram | null {
  const configuration = program.c64Startup;
  if (configuration === undefined) return program;
  const previous = createC64StartupStateData(configuration);
  const supplied = program.data.find(({ id }) => id === C64_STARTUP_STATE_ID);
  if (
    supplied === undefined ||
    supplied.kind !== previous.kind ||
    supplied.alignment !== previous.alignment ||
    supplied.bytes.length !== previous.bytes.length ||
    supplied.bytes.some((byte) => byte !== 0)
  )
    return null;
  const borrowed = homes
    .filter(({ region }) => region === "zero-page")
    .flatMap(({ address, bytes }) =>
      Array.from({ length: bytes }, (_, offset) => address + offset),
    );
  for (const data of program.data) {
    if (!data.zeropage) continue;
    if (data.placement?.at == null) return null;
    borrowed.push(
      ...Array.from({ length: data.bytes.length }, (_, offset) => data.placement!.at! + offset),
    );
  }
  const bound = Object.freeze({ ...configuration, borrowedZeroPage: Object.freeze(borrowed) });
  const result = createC64Startup({ ...bound, profile });
  if (result.kind !== "complete") return null;
  return Object.freeze({
    ...program,
    c64Startup: bound,
    startup: result.startup,
    data: Object.freeze(
      program.data.map((data) =>
        data.id === C64_STARTUP_STATE_ID ? createC64StartupStateData(bound) : data,
      ),
    ),
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
  if (selectC64KernalFacts(input.profile.id) === null) {
    return Object.freeze({ kind: "error", reason: "Startup requires the selected C64 profile" });
  }
  const cpu = input.profile.cpu;
  const compact = input.displayIndependent === true;
  const state = compact ? COMPACT_STARTUP_STATE : STARTUP_STATE;
  const borrowed = borrowedBasicBytes(input);
  const machine = input.profile.machine;
  const preservedDevices = Object.freeze([
    Object.freeze({ address: cpu.portDirectionAddress, offset: state.cpuDirection }),
    Object.freeze({ address: cpu.portDataAddress, offset: state.cpuPort }),
    ...(compact
      ? []
      : [
          Object.freeze({ address: machine.vicMemoryPointer, offset: state.vicMemory }),
          Object.freeze({ address: machine.spriteEnable, offset: state.spriteEnable }),
          Object.freeze({ address: machine.spriteXHigh, offset: state.spriteXHigh }),
          Object.freeze({ address: machine.spriteYExpand, offset: state.spriteYExpand }),
          Object.freeze({ address: machine.spritePriority, offset: state.spritePriority }),
          Object.freeze({ address: machine.spriteMulticolor, offset: state.spriteMulticolor }),
          Object.freeze({ address: machine.spriteXExpand, offset: state.spriteXExpand }),
          Object.freeze({ address: machine.borderColor, offset: state.border }),
          Object.freeze({ address: machine.backgroundColor, offset: state.background }),
          ...Array.from({ length: 16 }, (_, index) =>
            Object.freeze({
              address: machine.spritePositionBase + index,
              offset: state.spritePositions + index,
            }),
          ),
          ...Array.from({ length: 8 }, (_, index) =>
            Object.freeze({
              address: machine.spriteColorBase + index,
              offset: state.spriteColors + index,
            }),
          ),
          ...Array.from({ length: 8 }, (_, index) =>
            Object.freeze({
              address: machine.spritePointerBase + index,
              offset: state.spritePointers + index,
            }),
          ),
        ]),
  ]);
  const entry: MachineInstruction[] = [
    ...(compact
      ? []
      : [
          stateInstruction(cpu, "sta", state.a),
          stateInstruction(cpu, "stx", state.x),
          stateInstruction(cpu, "sty", state.y),
        ]),
    machineInstruction(cpu, "php", "implied", null),
    machineInstruction(cpu, "pla", "implied", null),
    stateInstruction(cpu, "sta", state.status),
    ...(compact
      ? []
      : [
          machineInstruction(cpu, "tsx", "implied", null),
          stateInstruction(cpu, "stx", state.stack),
        ]),
    machineInstruction(cpu, "cld", "implied", null),
  ];
  if (compact) {
    // Borrowed-byte captures use A only. Keep the direction in X until mapping,
    // then capture the port last so its fresh A value needs no memory reload.
    entry.push(
      machineInstruction(
        cpu,
        "ldx",
        deviceMode(cpu.portDirectionAddress),
        Object.freeze({ kind: "absolute", value: cpu.portDirectionAddress }),
        [deviceEffect("read", cpu.portDirectionAddress)],
      ),
      stateInstruction(cpu, "stx", state.cpuDirection),
    );
  } else {
    for (const { address, offset } of preservedDevices) {
      entry.push(...saveDevice(cpu, address, offset));
    }
  }
  for (const [index, address] of borrowed.entries()) {
    entry.push(...saveDevice(cpu, address, state.bytes + index));
  }
  entry.push(
    ...(compact
      ? saveDevice(cpu, cpu.portDataAddress, state.cpuPort)
      : [
          machineInstruction(
            cpu,
            "lda",
            deviceMode(cpu.portDataAddress),
            Object.freeze({ kind: "absolute", value: cpu.portDataAddress }),
            [deviceEffect("read", cpu.portDataAddress)],
          ),
        ]),
    machineInstruction(cpu, "and", "immediate", Object.freeze({ kind: "immediate", value: 0xf8 })),
    machineInstruction(cpu, "ora", "immediate", Object.freeze({ kind: "immediate", value: 0x06 })),
    machineInstruction(
      cpu,
      "sta",
      deviceMode(cpu.portDataAddress),
      Object.freeze({ kind: "absolute", value: cpu.portDataAddress }),
      [deviceEffect("write", cpu.portDataAddress)],
    ),
    ...(compact
      ? [machineInstruction(cpu, "txa", "implied", null)]
      : [
          machineInstruction(
            cpu,
            "lda",
            deviceMode(cpu.portDirectionAddress),
            Object.freeze({ kind: "absolute", value: cpu.portDirectionAddress }),
            [deviceEffect("read", cpu.portDirectionAddress)],
          ),
        ]),
    machineInstruction(cpu, "ora", "immediate", Object.freeze({ kind: "immediate", value: 0x07 })),
    machineInstruction(
      cpu,
      "sta",
      deviceMode(cpu.portDirectionAddress),
      Object.freeze({ kind: "absolute", value: cpu.portDirectionAddress }),
      [deviceEffect("write", cpu.portDirectionAddress)],
    ),
    // These fixed-bank profiles use input pull-ups for bank zero. Saving and masking DDRA
    // leaves the unreadable PRA output latch untouched; pin readback cannot restore that latch.
    ...saveDevice(cpu, machine.cia2DataDirection, state.cia2Direction),
    machineInstruction(cpu, "and", "immediate", Object.freeze({ kind: "immediate", value: 0xfc })),
    machineInstruction(
      cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.cia2DataDirection }),
      [deviceEffect("write", machine.cia2DataDirection)],
    ),
  );
  if (!compact)
    entry.push(
      machineInstruction(
        cpu,
        "lda",
        "immediate",
        Object.freeze({ kind: "immediate", value: 0x14 }),
      ),
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
  for (const { address, offset } of preservedDevices.slice(2)) {
    restore.push(...restoreDevice(cpu, address, offset));
  }
  for (const [index, address] of borrowed.entries()) {
    restore.push(...restoreDevice(cpu, address, state.bytes + index));
  }
  restore.push(
    ...restoreDevice(cpu, machine.cia2DataDirection, state.cia2Direction),
    ...restoreDevice(cpu, cpu.portDataAddress, state.cpuPort),
    ...restoreDevice(cpu, cpu.portDirectionAddress, state.cpuDirection),
    // The compact proof excludes stack-memory writes; source status saves,
    // calls and returning interrupts already balance SP. No extra save is held.
    ...(compact
      ? []
      : [
          stateInstruction(cpu, "ldx", state.stack),
          machineInstruction(cpu, "txs", "implied", null),
        ]),
    stateInstruction(cpu, "lda", state.status),
    machineInstruction(cpu, "pha", "implied", null),
    ...(compact
      ? []
      : [
          stateInstruction(cpu, "lda", state.a),
          stateInstruction(cpu, "ldx", state.x),
          stateInstruction(cpu, "ldy", state.y),
        ]),
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
