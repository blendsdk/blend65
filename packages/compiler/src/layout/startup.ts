import type { TargetProfile } from "../target/profile.js";
import { selectC64KernalFacts } from "../profile/c64-kernal.js";
import type { C64ProfileOwnership } from "../profile/c64-kernal.js";
import { machineCost, machineInstruction, machineState } from "../machine/lower-control.js";
import type {
  MachineBlock,
  MachineDataObject,
  MachineFunction,
  MachineInstruction,
  MachineMemoryEffect,
} from "../machine/machine-types.js";
import type { StorageHome, StartupStackDemand } from "../storage/storage-types.js";
import type { MachineProgram } from "../machine/machine-types.js";
import {
  C64_STARTUP_STATE_ID,
  createStartupStatus,
  startupStateLayout,
  startupStateInstruction as stateInstruction,
} from "./startup-status.js";
import type { C64StartupPolicy } from "./startup-status.js";

export { C64_STARTUP_STATE_ID } from "./startup-status.js";
export type { C64StartupPolicy } from "./startup-status.js";

/** Inputs needed to construct the selected cooperative C64 startup. */
export interface C64StartupInput {
  /** Closed-program proof that no source owner depends on the display defaults. */
  readonly displayIndependent?: boolean;
  /** Selected construction; omitted keeps the established proof-derived compact default. */
  readonly startupPolicy?: C64StartupPolicy;
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
      /** Actual platform-only stack behavior of the emitted constructor. */
      readonly stackDemand: StartupStackDemand;
      readonly stub: { readonly origin: 0x0801; readonly bytes: readonly number[] };
      readonly startup: MachineFunction & { readonly origin: 0x080d };
      /** Compiler-owned default raw entries; present only for takeover profiles. */
      readonly entries?: readonly MachineFunction[];
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
  input: Pick<C64StartupInput, "displayIndependent" | "startupPolicy" | "borrowedZeroPage"> = {},
  ownership: C64ProfileOwnership = "cooperative",
): MachineDataObject {
  const state = startupStateLayout(compactPolicy(input, ownership).policy);
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

/** Resolve the explicit construction while preserving the established compact default. */
function compactPolicy(
  input: Pick<C64StartupInput, "displayIndependent" | "startupPolicy">,
  ownership: C64ProfileOwnership = "cooperative",
): {
  readonly policy: C64StartupPolicy;
  readonly compact: boolean;
  readonly looped: boolean;
} {
  if (ownership === "takeover")
    return Object.freeze({ policy: "takeover", compact: false, looped: false });
  const policy =
    input.startupPolicy ?? (input.displayIndependent === true ? "compact-unrolled" : "full");
  if (policy === "takeover") throw new Error("Takeover startup policy requires a takeover profile");
  if (policy !== "full" && input.displayIndependent !== true)
    throw new Error("Compact startup requires its display-independence proof");
  return Object.freeze({
    policy,
    compact: policy !== "full",
    looped: policy === "compact-looped",
  });
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
  const previous = createC64StartupStateData(configuration, profile.machine.ownership);
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
        data.id === C64_STARTUP_STATE_ID
          ? createC64StartupStateData(bound, profile.machine.ownership)
          : data,
      ),
    ),
  });
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
  if (input.profile.machine.ownership === "takeover") {
    return createC64TakeoverStartup(input);
  }
  const cpu = input.profile.cpu;
  let policy: ReturnType<typeof compactPolicy>;
  try {
    policy = compactPolicy(input);
  } catch (error) {
    return Object.freeze({
      kind: "error",
      reason: error instanceof Error ? error.message : "Invalid startup policy",
    });
  }
  const { compact, looped } = policy;
  const status = createStartupStatus(cpu, policy.policy);
  const { state } = status;
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
  const entry: MachineInstruction[] = [...status.entry];
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
  if (!looped) {
    for (const [index, address] of borrowed.entries()) {
      entry.push(...saveDevice(cpu, address, state.bytes + index));
    }
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
  const loopedCapture = looped && borrowed.length > 0;
  if (loopedCapture) {
    entry.push(
      machineInstruction(
        cpu,
        "ldx",
        "immediate",
        Object.freeze({ kind: "immediate", value: borrowed.length - 1 }),
      ),
    );
  }
  entry.push(...status.beforeInitializers);
  const initializers =
    input.initializers ??
    input.initializerLabels.map((label) => Object.freeze({ kind: "call" as const, label }));
  const initializerInstructions: MachineInstruction[] = [];
  for (const initializer of initializers) {
    if (initializer.kind === "inline") {
      (loopedCapture ? initializerInstructions : entry).push(...initializer.instructions);
    } else {
      (loopedCapture ? initializerInstructions : entry).push(
        machineInstruction(
          cpu,
          "jsr",
          "absolute",
          Object.freeze({ kind: "label", label: initializer.label }),
        ),
      );
    }
  }
  const mainEntry = status.beforeMain;
  if (!looped) entry.push(...mainEntry);

  const restorePrefix: MachineInstruction[] = compact
    ? [machineInstruction(cpu, "sei", "implied", null)]
    : [];
  for (const { address, offset } of preservedDevices.slice(2)) {
    restorePrefix.push(...restoreDevice(cpu, address, offset));
  }
  const restoreSuffix: MachineInstruction[] = [
    ...restoreDevice(cpu, machine.cia2DataDirection, state.cia2Direction),
    ...restoreDevice(cpu, cpu.portDataAddress, state.cpuPort),
    ...restoreDevice(cpu, cpu.portDirectionAddress, state.cpuDirection),
    ...status.restore,
  ];
  const borrowedRestores = borrowed.flatMap((address, index) =>
    restoreDevice(cpu, address, state.bytes + index),
  );
  const restore: MachineInstruction[] = [
    ...restorePrefix,
    ...(looped ? [] : borrowedRestores),
    ...restoreSuffix,
  ];

  if (looped && borrowed.length > 0) {
    const first = borrowed[0]!;
    if (borrowed.some((address, index) => address !== first + index))
      return Object.freeze({
        kind: "error",
        reason: "Compact looped startup requires one contiguous borrowed range",
      });
    restorePrefix.push(
      machineInstruction(
        cpu,
        "ldx",
        "immediate",
        Object.freeze({ kind: "immediate", value: borrowed.length - 1 }),
      ),
    );
    restore.splice(0, restore.length, ...restorePrefix, ...restoreSuffix);
    const captureDone =
      initializerInstructions.length > 0 ? "startup.entry.initializers" : "startup.entry.main";
    return Object.freeze({
      kind: "complete",
      stackDemand: Object.freeze({ heldBytes: 1, transientPeakBytes: 2 }),
      stub: Object.freeze({ origin: 0x0801, bytes: BASIC_STUB }),
      startup: Object.freeze({
        id: "startup",
        origin: 0x080d,
        blocks: Object.freeze([
          Object.freeze({
            label: "startup.entry",
            instructions: Object.freeze(entry),
            terminator: Object.freeze({ kind: "fallthrough", target: "startup.capture" }),
          }),
          Object.freeze({
            label: "startup.capture",
            instructions: Object.freeze([
              machineInstruction(
                cpu,
                "lda",
                "absolute-x",
                Object.freeze({ kind: "absolute", value: first }),
                [
                  Object.freeze({
                    kind: "read" as const,
                    address: Object.freeze({ kind: "absolute" as const, value: first }),
                    width: 1,
                    volatile: false,
                    order: 0,
                  }),
                ],
              ),
              machineInstruction(
                cpu,
                "sta",
                "absolute-x",
                Object.freeze({ kind: "label", label: C64_STARTUP_STATE_ID, offset: state.bytes }),
                [
                  Object.freeze({
                    kind: "write" as const,
                    address: Object.freeze({
                      kind: "symbolic" as const,
                      label: C64_STARTUP_STATE_ID,
                      offset: state.bytes,
                    }),
                    width: 1,
                    volatile: false,
                    order: 0,
                  }),
                ],
              ),
              machineInstruction(cpu, "dex", "implied", null),
            ]),
            terminator: Object.freeze({
              kind: "branch" as const,
              opcode: "bpl" as const,
              target: "startup.capture",
              fallthrough: captureDone,
              uses: machineState([], ["n"]),
              cost: machineCost(cpu, "bpl", "relative"),
            }),
          }),
          ...(initializerInstructions.length > 0
            ? [
                Object.freeze({
                  label: "startup.entry.initializers",
                  instructions: Object.freeze(initializerInstructions),
                  terminator: Object.freeze({
                    kind: "fallthrough" as const,
                    target: "startup.entry.main",
                  }),
                }),
              ]
            : []),
          Object.freeze({
            label: "startup.entry.main",
            instructions: Object.freeze(mainEntry),
            terminator: Object.freeze({ kind: "fallthrough", target: input.mainLabel }),
          }),
          Object.freeze({
            label: "startup.restore",
            instructions: Object.freeze(restorePrefix),
            terminator: Object.freeze({
              kind: "fallthrough",
              target: "startup.restore.borrow",
            }),
          }),
          Object.freeze({
            label: "startup.restore.borrow",
            instructions: Object.freeze([
              machineInstruction(
                cpu,
                "lda",
                "absolute-x",
                Object.freeze({ kind: "label", label: C64_STARTUP_STATE_ID, offset: state.bytes }),
                [
                  Object.freeze({
                    kind: "read" as const,
                    address: Object.freeze({
                      kind: "symbolic" as const,
                      label: C64_STARTUP_STATE_ID,
                      offset: state.bytes,
                    }),
                    width: 1,
                    volatile: false,
                    order: 0,
                  }),
                ],
              ),
              machineInstruction(
                cpu,
                "sta",
                "absolute-x",
                Object.freeze({ kind: "absolute", value: first }),
                [
                  Object.freeze({
                    kind: "write" as const,
                    address: Object.freeze({ kind: "absolute" as const, value: first }),
                    width: 1,
                    volatile: false,
                    order: 0,
                  }),
                ],
              ),
              machineInstruction(cpu, "dex", "implied", null),
            ]),
            terminator: Object.freeze({
              kind: "branch" as const,
              opcode: "bpl" as const,
              target: "startup.restore.borrow",
              fallthrough: "startup.restore.tail",
              uses: machineState([], ["n"]),
              cost: machineCost(cpu, "bpl", "relative"),
            }),
          }),
          Object.freeze({
            label: "startup.restore.tail",
            instructions: Object.freeze(restoreSuffix),
            terminator: Object.freeze({
              kind: "return" as const,
              opcode: "rts" as const,
              cost: machineCost(cpu, "rts", "implied"),
            }),
          }),
        ]),
      }),
    });
  }

  return Object.freeze({
    kind: "complete",
    stackDemand: status.stackDemand,
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

/** Write one complete labelled hardware vector into underlying RAM. */
function takeoverVectorWrite(
  cpu: TargetProfile["cpu"],
  address: number,
  label: string,
): readonly MachineInstruction[] {
  const byte = (offset: 0 | 1) =>
    machineInstruction(
      cpu,
      "lda",
      "immediate",
      Object.freeze({ kind: "label", label, addressByte: offset === 0 ? "low" : "high" }),
      [],
    );
  const store = (target: number) =>
    machineInstruction(cpu, "sta", "absolute", Object.freeze({ kind: "absolute", value: target }), [
      deviceEffect("write", target),
    ]);
  return Object.freeze([byte(0), store(address), byte(1), store(address + 1)]);
}

/** Build one fixed raw entry with no source body and no fallthrough path. */
function takeoverDefaultEntry(
  id: "startup.rawIrqDefault" | "startup.rawNmiDefault",
  blocks: readonly MachineBlock[],
): MachineFunction {
  return Object.freeze({
    // The ACME routine label and its first block label must stay distinct.
    id: `${id}.fn`,
    ...(id === "startup.rawNmiDefault" ? { nmiPublicationEntry: true as const } : {}),
    blocks,
  });
}

/**
 * Build the raw ownership constructor. The PRG still enters through the shared BASIC
 * stub, but application execution owns both hardware vectors and the exposed RAM bank.
 * @param input Initializer/main identities and exact selected takeover profile.
 * @returns The stub, startup entry/restore and the two compiler-owned default entries.
 */
function createC64TakeoverStartup(input: C64StartupInput): C64StartupResult {
  const cpu = input.profile.cpu;
  const machine = input.profile.machine;
  const status = createStartupStatus(cpu, "takeover");
  const { state } = status;
  const borrowed = borrowedBasicBytes(input);
  // Keep the two owned processor-port bytes in X/Y across the vector writes so the
  // mapping transaction needs no state reloads after the CIA2 capture.
  const entry: MachineInstruction[] = [
    ...status.entry,
    machineInstruction(
      cpu,
      "ldx",
      deviceMode(cpu.portDirectionAddress),
      Object.freeze({ kind: "absolute", value: cpu.portDirectionAddress }),
      [deviceEffect("read", cpu.portDirectionAddress)],
    ),
    stateInstruction(cpu, "stx", state.cpuDirection),
    machineInstruction(
      cpu,
      "ldy",
      deviceMode(cpu.portDataAddress),
      Object.freeze({ kind: "absolute", value: cpu.portDataAddress }),
      [deviceEffect("read", cpu.portDataAddress)],
    ),
    stateInstruction(cpu, "sty", state.cpuPort),
    ...saveDevice(cpu, machine.cia2DataDirection, state.cia2Direction),
  ];
  for (const [index, address] of borrowed.entries()) {
    entry.push(...saveDevice(cpu, address, state.bytes + index));
  }
  // The ROM still supplies active reads here; stores reach the RAM beneath it.
  entry.push(
    ...takeoverVectorWrite(cpu, machine.rawNmiVector, "startup.rawNmiDefault.fn"),
    ...takeoverVectorWrite(cpu, machine.rawIrqVector, "startup.rawIrqDefault.fn"),
  );
  entry.push(
    machineInstruction(cpu, "tya", "implied", null),
    machineInstruction(cpu, "and", "immediate", Object.freeze({ kind: "immediate", value: 0xf8 })),
    machineInstruction(cpu, "ora", "immediate", Object.freeze({ kind: "immediate", value: 0x05 })),
    machineInstruction(
      cpu,
      "sta",
      deviceMode(cpu.portDataAddress),
      Object.freeze({ kind: "absolute", value: cpu.portDataAddress }),
      [deviceEffect("write", cpu.portDataAddress)],
    ),
    machineInstruction(cpu, "txa", "implied", null),
    machineInstruction(cpu, "ora", "immediate", Object.freeze({ kind: "immediate", value: 0x07 })),
    machineInstruction(
      cpu,
      "sta",
      deviceMode(cpu.portDirectionAddress),
      Object.freeze({ kind: "absolute", value: cpu.portDirectionAddress }),
      [deviceEffect("write", cpu.portDirectionAddress)],
    ),
    // Clear the owned CIA2 direction bits so the external pull-ups select VIC bank zero.
    stateInstruction(cpu, "lda", state.cia2Direction),
    machineInstruction(cpu, "and", "immediate", Object.freeze({ kind: "immediate", value: 0xfc })),
    machineInstruction(
      cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: machine.cia2DataDirection }),
      [deviceEffect("write", machine.cia2DataDirection)],
    ),
    machineInstruction(cpu, "cli", "implied", null),
  );
  const initializers =
    input.initializers ??
    input.initializerLabels.map((label) => Object.freeze({ kind: "call" as const, label }));
  for (const initializer of initializers) {
    if (initializer.kind === "inline") entry.push(...initializer.instructions);
    else
      entry.push(
        machineInstruction(
          cpu,
          "jsr",
          "absolute",
          Object.freeze({ kind: "label", label: initializer.label }),
        ),
      );
  }

  const restore: MachineInstruction[] = [
    machineInstruction(cpu, "sei", "implied", null),
    ...restoreDevice(cpu, machine.cia2DataDirection, state.cia2Direction),
    ...borrowed.flatMap((address, index) => restoreDevice(cpu, address, state.bytes + index)),
    ...restoreDevice(cpu, cpu.portDataAddress, state.cpuPort),
    ...restoreDevice(cpu, cpu.portDirectionAddress, state.cpuDirection),
    ...status.restore,
  ];

  const irqEntry = takeoverDefaultEntry(
    "startup.rawIrqDefault",
    Object.freeze([
      Object.freeze({
        label: "startup.rawIrqDefault",
        instructions: Object.freeze([
          machineInstruction(cpu, "pha", "implied", null),
          machineInstruction(
            cpu,
            "lda",
            "absolute",
            Object.freeze({ kind: "absolute", value: machine.cia1Base + 0x0d }),
            [deviceEffect("read", machine.cia1Base + 0x0d)],
          ),
          machineInstruction(
            cpu,
            "lda",
            "absolute",
            Object.freeze({ kind: "absolute", value: 0xd019 }),
            [deviceEffect("read", 0xd019)],
          ),
          machineInstruction(
            cpu,
            "sta",
            "absolute",
            Object.freeze({ kind: "absolute", value: 0xd019 }),
            [deviceEffect("write", 0xd019)],
          ),
          machineInstruction(cpu, "pla", "implied", null),
          machineInstruction(cpu, "rti", "implied", null),
        ]),
        terminator: Object.freeze({ kind: "unreachable" as const }),
      }),
    ]),
  );
  const nmiEntry = takeoverDefaultEntry(
    "startup.rawNmiDefault",
    Object.freeze([
      Object.freeze({
        label: "startup.rawNmiDefault",
        instructions: Object.freeze([
          // BIT reads the ICR without changing A; RTI restores the interrupted flags.
          machineInstruction(
            cpu,
            "bit",
            "absolute",
            Object.freeze({ kind: "absolute", value: machine.cia2Base + 0x0d }),
            [deviceEffect("read", machine.cia2Base + 0x0d)],
          ),
          machineInstruction(cpu, "rti", "implied", null),
        ]),
        terminator: Object.freeze({ kind: "unreachable" as const }),
      }),
    ]),
  );

  return Object.freeze({
    kind: "complete",
    stackDemand: status.stackDemand,
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
    entries: Object.freeze([irqEntry, nmiEntry]),
  });
}
