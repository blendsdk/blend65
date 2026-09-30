import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import { selectC64KernalFacts } from "../profile/c64-kernal.js";
import type { PlatformOperation } from "../semantic/operations.js";
import type { TargetProfile, InterruptVariantFacts } from "../target/profile.js";
import { machineInstruction } from "./lower-control.js";
import type { C64Lowering, C64LoweringSupport } from "./lower-c64.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
  MachineMemoryEffect,
} from "./machine-types.js";

/** Machine entry facts also cover an address-only raw callback outside profile sinks. */
type MachineEntryFacts = Omit<InterruptVariantFacts, "id"> & { readonly id: string };

/** Stable label for a handler body bound to one entry ABI and predecessor depth. */
export function c64InterruptEntryLabel(
  handler: BindingId,
  variant: InterruptVariantFacts,
  depth: number,
  slotId?: string,
): string {
  const entry = `interrupt.${bindingIdentityKey(handler)}.${variant.id}`;
  return slotId === undefined
    ? `${entry}.depth${depth}`
    : `${entry}.slot${Buffer.from(slotId).toString("hex")}`;
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

/** Construct one fixed-address volatile firmware-vector or device-register access. */
function fixedEffect(kind: "read" | "write", address: number, order = 0): MachineMemoryEffect {
  return Object.freeze({
    kind,
    address: Object.freeze({ kind: "absolute", value: address }),
    width: 1,
    volatile: true,
    order,
  });
}

/** Lower only recognized C64 vector transactions; other operations remain with their owner. */
export function lowerC64InterruptOperation(
  operation: PlatformOperation,
  profile: TargetProfile,
  support: C64LoweringSupport,
): C64Lowering | null {
  const sink = profile.interrupts.sinks.find(
    ({ capability }) => capability === operation.capability,
  );
  const restoreVector =
    operation.capability === "c64.system.restoreIRQ"
      ? 0x0314
      : operation.capability === "c64.system.restoreNMI"
        ? 0x0318
        : null;
  if (sink === undefined && restoreVector === null) return null;
  const binding = support.interruptBinding?.(operation);
  if (binding === undefined || (sink !== undefined && binding.entryLabel === null)) {
    throw new Error("Interrupt vector operation has no static ownership binding");
  }
  const cpu = profile.cpu;
  const source = operation.span;
  const vector = sink?.vector ?? restoreVector!;
  const handback = binding.stockCia1Handback ? selectC64KernalFacts(profile.id) : null;
  if (
    binding.stockCia1Handback &&
    (operation.capability !== "c64.system.restoreIRQ" || handback === null)
  ) {
    throw new Error("CIA1 handback requires a proved cooperative final IRQ restore");
  }
  // Named CIA1 register addresses remain tied to the selected machine. Neither
  // device access nor saved-vector access may move across another volatile effect.
  const cia1 = {
    timerALow: profile.machine.cia1Base + 0x04,
    timerAHigh: profile.machine.cia1Base + 0x05,
    interruptControl: profile.machine.cia1Base + 0x0d,
    controlA: profile.machine.cia1Base + 0x0e,
    controlB: profile.machine.cia1Base + 0x0f,
  };
  let memoryOrder = 0;
  /** Keep every consuming read and register write explicit in the machine effects. */
  const deviceAccess = (opcode: "lda" | "sta", address: number) =>
    machineInstruction(
      cpu,
      opcode,
      "absolute",
      Object.freeze({ kind: "absolute", value: address }),
      [fixedEffect(opcode === "lda" ? "read" : "write", address, memoryOrder++)],
      source,
    );
  /** Emit a constant register value or bit operation without requesting scratch storage. */
  const immediate = (opcode: "lda" | "and" | "ora", value: number) =>
    machineInstruction(cpu, opcode, "immediate", { kind: "immediate", value }, [], source);
  const instructions: MachineInstruction[] = [
    machineInstruction(cpu, "php", "implied", null, [], source),
    machineInstruction(cpu, "pha", "implied", null, [], source),
    machineInstruction(cpu, "sei", "implied", null, [], source),
  ];
  if (handback !== null) {
    // Stop both timers before acknowledging pending game events. CRA bit 7
    // selects the TOD input and must survive; CRB returns to the stock stopped
    // one-shot mode. The ICR read consumes events, never the unreadable mask.
    instructions.push(
      immediate("lda", 0x1f),
      deviceAccess("sta", cia1.interruptControl),
      deviceAccess("lda", cia1.controlA),
      immediate("and", 0x80),
      deviceAccess("sta", cia1.controlA),
      immediate("lda", 0x08),
      deviceAccess("sta", cia1.controlB),
      deviceAccess("lda", cia1.interruptControl),
      immediate("lda", handback.kernalTimerAReload & 0xff),
      deviceAccess("sta", cia1.timerALow),
      immediate("lda", handback.kernalTimerAReload >>> 8),
      deviceAccess("sta", cia1.timerAHigh),
    );
  }
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
                order: memoryOrder++,
              }),
            ]
          : [fixedEffect("read", vector + offset, memoryOrder++)],
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
          ? [fixedEffect("write", vector + offset, memoryOrder++)]
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
                order: memoryOrder++,
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
          [fixedEffect("write", vector + offset, memoryOrder++)],
          source,
        ),
      );
    }
  }
  if (handback !== null) {
    // The exact saved predecessor is now installed while CPU IRQ entry remains
    // masked. Enable only stock Timer A, then load/start it before restoring P.
    instructions.push(
      immediate("lda", 0x81),
      deviceAccess("sta", cia1.interruptControl),
      deviceAccess("lda", cia1.controlA),
      immediate("ora", 0x11),
      deviceAccess("sta", cia1.controlA),
    );
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
