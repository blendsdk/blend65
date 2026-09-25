import type { SourceSpan } from "../project/types.js";
import type { PlatformOperation } from "../semantic/operations.js";
import type { StorageRequest } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import type { InterruptVariantFacts } from "../target/profile.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import {
  machineInstruction,
  modeForValue,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type {
  MachineDataObject,
  MachineInstruction,
  MachineMemoryEffect,
  MachineFunction,
  MachineBlock,
} from "./machine-types.js";

/** Machine entry facts also cover an address-only raw callback outside profile sinks. */
type MachineEntryFacts = Omit<InterruptVariantFacts, "id"> & { readonly id: string };

/** Direct storage callback for a dynamic shared-register update. */
export interface C64LoweringSupport {
  /** Request one finite function-owned temporary. */
  readonly requestScratch: (
    suffix: string,
    bytes: number,
    source: SourceSpan,
    reason: string,
  ) => StorageRequest;
  /** Bind a recognized vector operation to its compile-time predecessor word. */
  readonly interruptBinding?: (operation: PlatformOperation) => {
    readonly linkRequestId: string;
    readonly entryLabel: string | null;
  };
}

/** Successful direct platform lowering and its directly consumed immutable tables. */
export interface C64Lowering {
  /** Exact inline machine operations. */
  readonly instructions: readonly MachineInstruction[];
  /** Retained semantic result. */
  readonly result: LoweredValue | null;
  /** Compiler-owned constant tables required by the selected sequence. */
  readonly data: readonly MachineDataObject[];
}

const BIT_MASKS = Object.freeze([0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80]);
const MASK_TABLE: MachineDataObject = Object.freeze({
  id: "compiler.c64.sprite-bit-mask",
  kind: "immutable",
  alignment: 1,
  bytes: BIT_MASKS,
});
const CLEAR_TABLE: MachineDataObject = Object.freeze({
  id: "compiler.c64.sprite-bit-clear",
  kind: "immutable",
  alignment: 1,
  bytes: Object.freeze(BIT_MASKS.map((mask) => mask ^ 0xff)),
});
const SELECTION_TABLE: MachineDataObject = Object.freeze({
  id: "compiler.c64.sprite-bit-selection",
  kind: "immutable",
  alignment: 1,
  bytes: Object.freeze([...new Array<number>(8).fill(0), ...BIT_MASKS]),
});

/** Stable label for a handler body bound to one entry ABI and predecessor depth. */
export function c64InterruptEntryLabel(
  handler: BindingId,
  variant: InterruptVariantFacts,
  depth: number,
): string {
  return `interrupt.${bindingIdentityKey(handler)}.${variant.id}.depth${depth}`;
}

/** A raw handler value has the CPU-entry ABI even when no raw installer is exposed. */
export const RAW_HANDLER_ENTRY: MachineEntryFacts = Object.freeze({
  id: "raw_handler_address",
  registerSaveOwner: "compiler",
  handlerEntryStackBytes: 6,
  decimalModeOnBodyEntry: "binary",
  entryStatusPolicy: "restore-by-rti",
  terminal: "rti",
  staticLinkBytes: 0,
});

/** Build one fixed, page-safe firmware entry around a callback-only source body. */
export function createC64InterruptEntry(
  body: MachineFunction,
  id: string,
  variant: MachineEntryFacts,
  linkRequestId: string | null,
  profile: TargetProfile,
): MachineFunction {
  const cpu = profile.cpu;
  const instruction = (
    opcode: string,
    mode: "implied" | "absolute" | "indirect",
    operand: MachineInstruction["operand"] = null,
  ) => machineInstruction(cpu, opcode, mode, operand, []);
  const saveRegisters = [
    instruction("pha", "implied"),
    instruction("txa", "implied"),
    instruction("pha", "implied"),
    instruction("tya", "implied"),
    instruction("pha", "implied"),
  ];
  const restoreRegisters = [
    instruction("pla", "implied"),
    instruction("tay", "implied"),
    instruction("pla", "implied"),
    instruction("tax", "implied"),
    instruction("pla", "implied"),
  ];
  const chain = variant.terminal === "jump-saved-vector";
  const saves = variant.registerSaveOwner === "compiler";
  const prologue = [
    ...(chain ? [instruction("php", "implied")] : []),
    ...(saves ? saveRegisters : []),
    instruction("cld", "implied"),
  ];
  const epilogue = [
    ...(saves ? restoreRegisters : []),
    ...(chain ? [instruction("plp", "implied")] : []),
  ];
  if (chain) {
    if (linkRequestId === null) throw new Error("Chained interrupt entry has no saved vector");
    epilogue.push(
      instruction(
        "jmp",
        "indirect",
        Object.freeze({ kind: "storage", requestId: linkRequestId, offset: 0 }),
      ),
    );
  } else if (variant.terminal === "jump-firmware-tail") {
    if (variant.terminalAddress === undefined) throw new Error("Firmware tail has no address");
    epilogue.push(
      instruction(
        "jmp",
        "absolute",
        Object.freeze({ kind: "absolute", value: variant.terminalAddress }),
      ),
    );
  } else {
    epilogue.push(instruction("rti", "implied"));
  }
  const labels = new Map(
    body.blocks.map((block) => [block.label, `${block.label}.${id}`] as const),
  );
  const renamed = (label: string) => labels.get(label) ?? label;
  const blocks: MachineBlock[] = body.blocks.map((block, index) => {
    const terminator = block.terminator;
    const nextTerminator =
      terminator.kind === "return"
        ? Object.freeze({ kind: "unreachable" as const })
        : terminator.kind === "jump"
          ? Object.freeze({ ...terminator, target: renamed(terminator.target) })
          : terminator.kind === "branch"
            ? Object.freeze({
                ...terminator,
                target: renamed(terminator.target),
                fallthrough: renamed(terminator.fallthrough),
              })
            : terminator.kind === "fallthrough"
              ? Object.freeze({ ...terminator, target: renamed(terminator.target) })
              : terminator;
    return Object.freeze({
      ...block,
      label: renamed(block.label),
      instructions: Object.freeze([
        ...(index === 0 ? prologue : []),
        ...block.instructions.map((op) =>
          op.operand?.kind === "label" && labels.has(op.operand.label)
            ? Object.freeze({
                ...op,
                operand: Object.freeze({ ...op.operand, label: renamed(op.operand.label) }),
              })
            : op,
        ),
        ...(terminator.kind === "return" ? epilogue : []),
      ]),
      terminator: nextTerminator,
    });
  });
  return Object.freeze({
    id,
    blocks: Object.freeze(blocks),
    ...(body.placement === undefined ? {} : { placement: body.placement }),
  });
}

/** Return one already evaluated argument. */
function argument(
  operation: PlatformOperation,
  values: ReadonlyMap<string, LoweredValue>,
  index: number,
): LoweredValue {
  const value = values.get(operation.arguments[index]!);
  if (value === undefined || value.kind === "condition") {
    throw new Error(`Platform operation '${operation.capability}' is missing argument ${index}`);
  }
  return value;
}

/** Return the mathematical value of one constant argument. */
function constant(value: LoweredValue): number | null {
  return value.kind === "constant" ? value.value : null;
}

/** Construct one exact fixed-address volatile access. */
function fixedEffect(kind: "read" | "write", address: number, order = 0): MachineMemoryEffect {
  return Object.freeze({
    kind,
    address: Object.freeze({ kind: "absolute", value: address }),
    width: 1,
    volatile: true,
    order,
  });
}

/** Construct one indexed device or compiler-table access. */
function indexedEffect(
  kind: "read" | "write",
  label: string,
  volatile: boolean,
): MachineMemoryEffect {
  return Object.freeze({
    kind,
    address: Object.freeze({ kind: "symbolic", label }),
    width: 1,
    volatile,
    order: 0,
  });
}

/** Make one retained byte current in A. */
function loadA(
  instructions: MachineInstruction[],
  profile: TargetProfile,
  value: LoweredValue,
  offset: number,
  source: SourceSpan,
): void {
  if (value.kind === "register") {
    if (offset !== 0) throw new Error("Register value does not retain another byte");
    return;
  }
  instructions.push(
    machineInstruction(
      profile.cpu,
      "lda",
      modeForValue(value, offset),
      operandForValue(value, offset),
      [],
      source,
    ),
  );
}

/** Normalize a runtime sprite index to the eight physical VIC sprite slots. */
function loadSpriteIndexX(
  instructions: MachineInstruction[],
  profile: TargetProfile,
  value: LoweredValue,
  source: SourceSpan,
): void {
  loadA(instructions, profile, value, 0, source);
  instructions.push(
    machineInstruction(
      profile.cpu,
      "and",
      "immediate",
      Object.freeze({ kind: "immediate", value: 0x07 }),
      [],
      source,
    ),
    machineInstruction(profile.cpu, "tax", "implied", null, [], source),
  );
}

/** Load one immediate byte into A. */
function immediate(profile: TargetProfile, value: number, source: SourceSpan): MachineInstruction {
  return machineInstruction(
    profile.cpu,
    "lda",
    "immediate",
    Object.freeze({ kind: "immediate", value: value & 0xff }),
    [],
    source,
  );
}

/** Store A to one fixed register address. */
function store(profile: TargetProfile, address: number, source: SourceSpan): MachineInstruction {
  return machineInstruction(
    profile.cpu,
    "sta",
    "absolute",
    Object.freeze({ kind: "absolute", value: address }),
    [fixedEffect("write", address)],
    source,
  );
}

/** Store A through one X-indexed register array. */
function storeIndexed(
  profile: TargetProfile,
  address: number,
  label: string,
  source: SourceSpan,
): MachineInstruction {
  return machineInstruction(
    profile.cpu,
    "sta",
    "absolute-x",
    Object.freeze({ kind: "absolute", value: address }),
    [indexedEffect("write", label, true)],
    source,
  );
}

/** Read a compiler-owned table through X. */
function tableRead(
  profile: TargetProfile,
  table: MachineDataObject,
  opcode: "lda" | "and" | "ora",
  source: SourceSpan,
): MachineInstruction {
  return machineInstruction(
    profile.cpu,
    opcode,
    "absolute-x",
    Object.freeze({ kind: "label", label: table.id }),
    [indexedEffect("read", table.id, false)],
    source,
  );
}

/** Lower a runtime-selected shared bit while preserving every other bit in the register. */
function lowerDynamicSharedBit(
  operation: PlatformOperation,
  values: ReadonlyMap<string, LoweredValue>,
  profile: TargetProfile,
  support: C64LoweringSupport,
  targetAddress: number,
  selectedValue: LoweredValue,
  selectedOffset: number,
  suffix: string,
): C64Lowering {
  const source = operation.span;
  const index = argument(operation, values, 0);
  const scratch = support.requestScratch(suffix, 2, source, "Selected sprite bit and table index");
  const instructions: MachineInstruction[] = [];
  loadA(instructions, profile, selectedValue, selectedOffset, source);
  instructions.push(
    machineInstruction(
      profile.cpu,
      "and",
      "immediate",
      Object.freeze({ kind: "immediate", value: 1 }),
      [],
      source,
    ),
    machineInstruction(profile.cpu, "asl", "accumulator", null, [], source),
    machineInstruction(profile.cpu, "asl", "accumulator", null, [], source),
    machineInstruction(profile.cpu, "asl", "accumulator", null, [], source),
    machineInstruction(
      profile.cpu,
      "sta",
      "storage",
      Object.freeze({ kind: "storage", requestId: scratch.id, offset: 0 }),
      [],
      source,
    ),
  );
  loadA(instructions, profile, index, 0, source);
  instructions.push(
    machineInstruction(
      profile.cpu,
      "and",
      "immediate",
      Object.freeze({ kind: "immediate", value: 0x07 }),
      [],
      source,
    ),
    machineInstruction(
      profile.cpu,
      "ora",
      "storage",
      Object.freeze({ kind: "storage", requestId: scratch.id, offset: 0 }),
      [],
      source,
    ),
    machineInstruction(profile.cpu, "tax", "implied", null, [], source),
    tableRead(profile, SELECTION_TABLE, "lda", source),
    machineInstruction(
      profile.cpu,
      "sta",
      "storage",
      Object.freeze({ kind: "storage", requestId: scratch.id, offset: 1 }),
      [],
      source,
    ),
  );
  loadSpriteIndexX(instructions, profile, index, source);
  instructions.push(
    machineInstruction(
      profile.cpu,
      "lda",
      "absolute",
      Object.freeze({ kind: "absolute", value: targetAddress }),
      [fixedEffect("read", targetAddress)],
      source,
    ),
    tableRead(profile, CLEAR_TABLE, "and", source),
    machineInstruction(
      profile.cpu,
      "ora",
      "storage",
      Object.freeze({ kind: "storage", requestId: scratch.id, offset: 1 }),
      [],
      source,
    ),
    machineInstruction(
      profile.cpu,
      "sta",
      "absolute",
      Object.freeze({ kind: "absolute", value: targetAddress }),
      [fixedEffect("write", targetAddress)],
      source,
    ),
  );
  return Object.freeze({
    instructions: Object.freeze(instructions),
    result: null,
    data: Object.freeze([CLEAR_TABLE, SELECTION_TABLE]),
  });
}

/**
 * Lower one admitted C64 operation directly, with no call, dispatcher, or runtime service.
 * @param operation Target-neutral semantic operation.
 * @param values Values already evaluated in source order.
 * @param profile Exact selected C64 profile.
 * @param support Direct finite storage callback for shared-register staging.
 * @returns Inline instructions, retained result and directly consumed constant data.
 */
export function lowerC64Operation(
  operation: PlatformOperation,
  values: ReadonlyMap<string, LoweredValue>,
  profile: TargetProfile,
  support: C64LoweringSupport,
): C64Lowering {
  const cpu = profile.cpu;
  const machine = profile.machine;
  const source = operation.span;

  const sink = profile.interrupts.sinks.find(
    ({ capability }) => capability === operation.capability,
  );
  const restoreVector =
    operation.capability === "c64.system.restoreIRQ"
      ? 0x0314
      : operation.capability === "c64.system.restoreNMI"
        ? 0x0318
        : null;
  if (sink !== undefined || restoreVector !== null) {
    const binding = support.interruptBinding?.(operation);
    if (binding === undefined || (sink !== undefined && binding.entryLabel === null)) {
      throw new Error("Interrupt vector operation has no static ownership binding");
    }
    const vector = sink?.vector ?? restoreVector!;
    const instructions: MachineInstruction[] = [
      machineInstruction(cpu, "php", "implied", null, [], source),
      machineInstruction(cpu, "pha", "implied", null, [], source),
      machineInstruction(cpu, "sei", "implied", null, [], source),
    ];
    for (let offset = 0; offset < 2; offset += 1) {
      instructions.push(
        machineInstruction(
          cpu,
          "lda",
          sink === undefined ? "storage" : "absolute",
          sink === undefined
            ? Object.freeze({ kind: "storage", requestId: binding.linkRequestId, offset })
            : Object.freeze({ kind: "absolute", value: vector + offset }),
          sink === undefined
            ? [
                Object.freeze({
                  kind: "read",
                  address: Object.freeze({
                    kind: "storage",
                    requestId: binding.linkRequestId,
                    offset,
                  }),
                  width: 1,
                  volatile: false,
                  order: offset,
                }),
              ]
            : [fixedEffect("read", vector + offset, offset)],
          source,
        ),
        machineInstruction(
          cpu,
          "sta",
          sink === undefined ? "absolute" : "storage",
          sink === undefined
            ? Object.freeze({ kind: "absolute", value: vector + offset })
            : Object.freeze({ kind: "storage", requestId: binding.linkRequestId, offset }),
          sink === undefined
            ? [fixedEffect("write", vector + offset, offset + 2)]
            : [
                Object.freeze({
                  kind: "write",
                  address: Object.freeze({
                    kind: "storage",
                    requestId: binding.linkRequestId,
                    offset,
                  }),
                  width: 1,
                  volatile: false,
                  order: offset + 2,
                }),
              ],
          source,
        ),
      );
    }
    if (sink !== undefined) {
      for (let offset = 0; offset < 2; offset += 1) {
        instructions.push(
          machineInstruction(
            cpu,
            "lda",
            "immediate",
            Object.freeze({
              kind: "label",
              label: binding.entryLabel!,
              addressByte: offset === 0 ? "low" : "high",
            }),
            [],
            source,
          ),
          machineInstruction(
            cpu,
            "sta",
            "absolute",
            Object.freeze({ kind: "absolute", value: vector + offset }),
            [fixedEffect("write", vector + offset, offset + 4)],
            source,
          ),
        );
      }
    }
    instructions.push(
      machineInstruction(cpu, "pla", "implied", null, [], source),
      machineInstruction(cpu, "plp", "implied", null, [], source),
    );
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: null,
      data: Object.freeze([]),
    });
  }

  if (operation.capability === "c64.video.waitNextFrame") {
    const instructions = [0, 1].flatMap((order) => [
      machineInstruction(
        cpu,
        "lda",
        "absolute",
        Object.freeze({ kind: "absolute", value: machine.vicRaster }),
        [fixedEffect("read", machine.vicRaster, order)],
        source,
      ),
      machineInstruction(
        cpu,
        "cmp",
        "immediate",
        Object.freeze({ kind: "immediate", value: machine.frameWaitRasterLine }),
        [],
        source,
      ),
    ]);
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: null,
      data: Object.freeze([]),
    });
  }

  if (operation.capability === "c64.input.readJoystick2") {
    return Object.freeze({
      instructions: Object.freeze([
        machineInstruction(
          cpu,
          "lda",
          "absolute",
          Object.freeze({ kind: "absolute", value: machine.joystick2 }),
          [fixedEffect("read", machine.joystick2)],
          source,
        ),
        machineInstruction(cpu, "tax", "implied", null, [], source),
      ]),
      result: Object.freeze({ kind: "register", registers: "a", bytes: 1, signed: false }),
      data: Object.freeze([]),
    });
  }

  const joystickMasks: Readonly<Record<string, number>> = Object.freeze({
    "c64.input.joystickLeft": 0x04,
    "c64.input.joystickRight": 0x08,
    "c64.input.joystickFire": 0x10,
  });
  const joystickMask = joystickMasks[operation.capability];
  if (joystickMask !== undefined) {
    const instructions: MachineInstruction[] = [];
    loadA(instructions, profile, argument(operation, values, 0), 0, source);
    instructions.push(
      machineInstruction(
        cpu,
        "and",
        "immediate",
        Object.freeze({ kind: "immediate", value: joystickMask }),
        [],
        source,
      ),
    );
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: Object.freeze({ kind: "condition", whenTrue: "beq", usesFlag: "z" }),
      data: Object.freeze([]),
    });
  }

  if (operation.capability === "c64.vic.vicSpriteBlock") {
    const addressValue = argument(operation, values, 0);
    const address = constant(addressValue);
    if (address === null && addressValue.kind === "label") {
      return Object.freeze({
        instructions: Object.freeze([]),
        result: Object.freeze({
          kind: "label",
          label: addressValue.label,
          bytes: 1,
          signed: false,
          transform: "vic-sprite-block",
        }),
        data: Object.freeze([]),
      });
    }
    if (
      address === null ||
      address < machine.vicBankStart ||
      address > machine.vicBankEnd ||
      address % 64 !== 0
    ) {
      throw new Error("Sprite address is not a 64-byte-aligned address in the selected VIC bank");
    }
    return Object.freeze({
      instructions: Object.freeze([]),
      result: Object.freeze({
        kind: "constant",
        value: (address - machine.vicBankStart) / 64,
        bytes: 1,
        signed: false,
      }),
      data: Object.freeze([]),
    });
  }

  if (operation.capability === "c64.vic.setBorderColor") {
    const instructions: MachineInstruction[] = [];
    loadA(instructions, profile, argument(operation, values, 0), 0, source);
    instructions.push(store(profile, machine.borderColor, source));
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: null,
      data: Object.freeze([]),
    });
  }

  const indexValue = argument(operation, values, 0);
  const index = constant(indexValue);
  if (index !== null && (!Number.isInteger(index) || index < 0 || index > 7)) {
    throw new Error("C64 sprite index must be in 0..7");
  }

  if (operation.capability === "c64.vic.setSpriteEnabled") {
    const enabledValue = argument(operation, values, 1);
    const enabled = constant(enabledValue);
    if (index !== null && enabled !== null) {
      const mask = 1 << index;
      return Object.freeze({
        instructions: Object.freeze([
          machineInstruction(
            cpu,
            "lda",
            "absolute",
            Object.freeze({ kind: "absolute", value: machine.spriteEnable }),
            [fixedEffect("read", machine.spriteEnable)],
            source,
          ),
          machineInstruction(
            cpu,
            enabled !== 0 ? "ora" : "and",
            "immediate",
            Object.freeze({ kind: "immediate", value: enabled !== 0 ? mask : 0xff ^ mask }),
            [],
            source,
          ),
          machineInstruction(
            cpu,
            "sta",
            "absolute",
            Object.freeze({ kind: "absolute", value: machine.spriteEnable }),
            [fixedEffect("write", machine.spriteEnable)],
            source,
          ),
        ]),
        result: null,
        data: Object.freeze([]),
      });
    }
    if (enabled === null) {
      return lowerDynamicSharedBit(
        operation,
        values,
        profile,
        support,
        machine.spriteEnable,
        enabledValue,
        0,
        "sprite-enable-bit",
      );
    }
    const instructions: MachineInstruction[] = [];
    loadSpriteIndexX(instructions, profile, indexValue, source);
    const table = enabled !== 0 ? MASK_TABLE : CLEAR_TABLE;
    instructions.push(
      machineInstruction(
        cpu,
        "lda",
        "absolute",
        Object.freeze({ kind: "absolute", value: machine.spriteEnable }),
        [fixedEffect("read", machine.spriteEnable)],
        source,
      ),
      tableRead(profile, table, enabled !== 0 ? "ora" : "and", source),
      machineInstruction(
        cpu,
        "sta",
        "absolute",
        Object.freeze({ kind: "absolute", value: machine.spriteEnable }),
        [fixedEffect("write", machine.spriteEnable)],
        source,
      ),
    );
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: null,
      data: Object.freeze([table]),
    });
  }

  if (operation.capability === "c64.vic.setSpritePosition") {
    const xValue = argument(operation, values, 1);
    const yValue = argument(operation, values, 2);
    const x = constant(xValue);
    const y = constant(yValue);
    if (index !== null && x !== null && y !== null) {
      const xAddress = machine.spritePositionBase + index * 2;
      const yAddress = xAddress + 1;
      const mask = 1 << index;
      return Object.freeze({
        instructions: Object.freeze([
          immediate(profile, x, source),
          store(profile, xAddress, source),
          immediate(profile, y, source),
          store(profile, yAddress, source),
          machineInstruction(
            cpu,
            "lda",
            "absolute",
            Object.freeze({ kind: "absolute", value: machine.spriteXHigh }),
            [fixedEffect("read", machine.spriteXHigh)],
            source,
          ),
          machineInstruction(
            cpu,
            x >= 0x100 ? "ora" : "and",
            "immediate",
            Object.freeze({ kind: "immediate", value: x >= 0x100 ? mask : 0xff ^ mask }),
            [],
            source,
          ),
          machineInstruction(
            cpu,
            "sta",
            "absolute",
            Object.freeze({ kind: "absolute", value: machine.spriteXHigh }),
            [fixedEffect("write", machine.spriteXHigh)],
            source,
          ),
        ]),
        result: null,
        data: Object.freeze([]),
      });
    }

    const instructions: MachineInstruction[] = [];
    loadSpriteIndexX(instructions, profile, indexValue, source);
    instructions.push(
      machineInstruction(cpu, "txa", "implied", null, [], source),
      machineInstruction(cpu, "asl", "accumulator", null, [], source),
      machineInstruction(cpu, "tax", "implied", null, [], source),
    );
    loadA(instructions, profile, xValue, 0, source);
    instructions.push(
      storeIndexed(profile, machine.spritePositionBase, "vic.sprite-x[index]", source),
    );
    loadA(instructions, profile, yValue, 0, source);
    instructions.push(
      storeIndexed(profile, machine.spritePositionBase + 1, "vic.sprite-y[index]", source),
    );
    if (xValue.kind === "condition" || (xValue.bytes < 2 && x === null)) {
      throw new Error("Dynamic sprite X position does not retain its high byte");
    }
    const highBit =
      x === null
        ? lowerDynamicSharedBit(
            operation,
            values,
            profile,
            support,
            machine.spriteXHigh,
            xValue,
            1,
            "sprite-x-high-bit",
          )
        : lowerDynamicSharedBit(
            operation,
            values,
            profile,
            support,
            machine.spriteXHigh,
            Object.freeze({
              kind: "constant",
              value: (x >> 8) & 1,
              bytes: 1,
              signed: false,
            }),
            0,
            "sprite-x-high-bit",
          );
    instructions.push(...highBit.instructions);
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: null,
      data: highBit.data,
    });
  }

  if (
    operation.capability === "c64.vic.setSpritePointer" ||
    operation.capability === "c64.vic.setSpriteColor"
  ) {
    const value = argument(operation, values, 1);
    const pointer = operation.capability === "c64.vic.setSpritePointer";
    const base = pointer ? machine.spritePointerBase : machine.spriteColorBase;
    const instructions: MachineInstruction[] = [];
    if (index === null) loadSpriteIndexX(instructions, profile, indexValue, source);
    loadA(instructions, profile, value, 0, source);
    instructions.push(
      index === null
        ? storeIndexed(
            profile,
            base,
            pointer ? "vic.sprite-pointer[index]" : "vic.sprite-color[index]",
            source,
          )
        : store(profile, base + index, source),
    );
    return Object.freeze({
      instructions: Object.freeze(instructions),
      result: null,
      data: Object.freeze([]),
    });
  }

  throw new Error(`Unknown C64 platform capability '${operation.capability}'`);
}
