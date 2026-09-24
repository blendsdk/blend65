import type { SourceSpan } from "../project/types.js";
import type { PackedHome } from "./lower-aggregate-copy.js";
import { machineCost, machineInstruction, machineState } from "./lower-control.js";
import type {
  MachineBlock,
  MachineInstruction,
  MachineOperand,
  MachineTerminator,
} from "./machine-types.js";
import { loweringFailure, type FunctionLoweringState } from "./lower.js";

/** Copy potentially overlapping borrowed objects in the safe address direction. */
export function lowerDirectionalCopyLoops(
  from: PackedHome,
  to: PackedHome,
  bytes: number,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
  source: SourceSpan,
): { readonly blocks: readonly MachineBlock[]; readonly continuation: string } {
  if (
    !from.indirect ||
    !to.indirect ||
    from.value.kind !== "storage" ||
    to.value.kind !== "storage"
  ) {
    throw loweringFailure("Directional copy requires two complete pointer pairs", source);
  }
  const cpu = state.input.profile.cpu;
  const fromId = from.value.requestId;
  const toId = to.value.requestId;
  const base = `${entryLabel}.move.${ordinal}`;
  const label = (suffix: string) => `${base}.${suffix}`;
  const fromByte = (offset: number): MachineOperand =>
    Object.freeze({ kind: "storage", requestId: fromId, offset });
  const toByte = (offset: number): MachineOperand =>
    Object.freeze({ kind: "storage", requestId: toId, offset });
  const fromData: MachineOperand = Object.freeze({
    kind: "indirect-y",
    requestId: fromId,
    offset: 0,
  });
  const toData: MachineOperand = Object.freeze({
    kind: "indirect-y",
    requestId: toId,
    offset: 0,
  });
  const instruction = (opcode: string, mode: string, operand: MachineOperand | null = null) =>
    machineInstruction(cpu, opcode, mode, operand, [], source);
  const immediate = (value: number): MachineOperand => Object.freeze({ kind: "immediate", value });
  const fallthrough = (target: string): MachineTerminator =>
    Object.freeze({ kind: "fallthrough", target });
  const branch = (opcode: "bcc" | "beq" | "bne", target: string, next: string): MachineTerminator =>
    Object.freeze({
      kind: "branch",
      opcode,
      target,
      fallthrough: next,
      uses: machineState([], [opcode === "bcc" ? "c" : "z"]),
      cost: machineCost(cpu, opcode, "relative"),
    });
  const blocks: MachineBlock[] = [];
  const add = (
    name: string,
    instructions: readonly MachineInstruction[],
    terminator: MachineTerminator,
  ): void => {
    blocks.push(
      Object.freeze({ label: name, instructions: Object.freeze([...instructions]), terminator }),
    );
  };
  const done = label("done");
  const forward = label("forward");
  const backward = label("backward");

  // Comparing whole addresses is enough because complete fixed objects never wrap the
  // 16-bit address space. A higher destination copies backward; equality is a no-op.
  add(
    entryLabel,
    [
      ...prefix,
      instruction("lda", "storage", toByte(1)),
      instruction("cmp", "storage", fromByte(1)),
    ],
    branch("bcc", forward, label("high")),
  );
  add(label("high"), [], branch("bne", backward, label("low")));
  add(
    label("low"),
    [instruction("lda", "storage", toByte(0)), instruction("cmp", "storage", fromByte(0))],
    branch("beq", done, label("low-order")),
  );
  add(label("low-order"), [], branch("bcc", forward, backward));

  const fullPages = Math.floor(bytes / 256);
  const partialBytes = bytes % 256;
  if (fullPages > 0) {
    add(
      forward,
      fullPages === 1 ? [] : [instruction("ldx", "immediate", immediate(fullPages))],
      fallthrough(label("forward-page")),
    );
    add(
      label("forward-page"),
      [instruction("ldy", "immediate", immediate(0))],
      fallthrough(label("forward-byte")),
    );
    add(
      label("forward-byte"),
      [
        instruction("lda", "indirect-indexed-y", fromData),
        instruction("sta", "indirect-indexed-y", toData),
        instruction("iny", "implied"),
      ],
      branch("bne", label("forward-byte"), label("forward-next")),
    );
    add(
      label("forward-next"),
      [
        ...(partialBytes > 0 || fullPages > 1
          ? [instruction("inc", "storage", fromByte(1)), instruction("inc", "storage", toByte(1))]
          : []),
        ...(fullPages > 1 ? [instruction("dex", "implied")] : []),
      ],
      fullPages === 1
        ? fallthrough(partialBytes > 0 ? label("forward-partial") : done)
        : branch("bne", label("forward-page"), partialBytes > 0 ? label("forward-partial") : done),
    );
  } else {
    add(forward, [], fallthrough(label("forward-partial")));
  }
  if (partialBytes > 0) {
    add(
      label("forward-partial"),
      [instruction("ldy", "immediate", immediate(0))],
      fallthrough(label("forward-partial-byte")),
    );
    add(
      label("forward-partial-byte"),
      [
        instruction("lda", "indirect-indexed-y", fromData),
        instruction("sta", "indirect-indexed-y", toData),
        instruction("iny", "implied"),
        instruction("cpy", "immediate", immediate(partialBytes)),
      ],
      branch("bne", label("forward-partial-byte"), done),
    );
  }

  const lastPage = partialBytes > 0 ? fullPages : fullPages - 1;
  const backwardSetup: MachineInstruction[] = [];
  for (const pointer of [fromByte(1), toByte(1)]) {
    if (lastPage === 1) backwardSetup.push(instruction("inc", "storage", pointer));
    else if (lastPage > 1)
      backwardSetup.push(
        instruction("clc", "implied"),
        instruction("lda", "storage", pointer),
        instruction("adc", "immediate", immediate(lastPage)),
        instruction("sta", "storage", pointer),
      );
  }
  if (partialBytes > 0) {
    backwardSetup.push(instruction("ldy", "immediate", immediate(partialBytes - 1)));
    add(backward, backwardSetup, fallthrough(label("backward-partial-byte")));
    add(
      label("backward-partial-byte"),
      [
        instruction("lda", "indirect-indexed-y", fromData),
        instruction("sta", "indirect-indexed-y", toData),
        instruction("dey", "implied"),
        instruction("cpy", "immediate", immediate(0xff)),
      ],
      branch("bne", label("backward-partial-byte"), fullPages > 0 ? label("backward-full") : done),
    );
  } else {
    add(backward, backwardSetup, fallthrough(label("backward-full")));
  }
  if (fullPages > 0) {
    const fullSetup =
      partialBytes > 0
        ? [instruction("dec", "storage", fromByte(1)), instruction("dec", "storage", toByte(1))]
        : [];
    add(
      label("backward-full"),
      [
        ...fullSetup,
        ...(fullPages === 1 ? [] : [instruction("ldx", "immediate", immediate(fullPages))]),
      ],
      fallthrough(label("backward-page")),
    );
    add(
      label("backward-page"),
      [instruction("ldy", "immediate", immediate(0xff))],
      fallthrough(label("backward-byte")),
    );
    add(
      label("backward-byte"),
      [
        instruction("lda", "indirect-indexed-y", fromData),
        instruction("sta", "indirect-indexed-y", toData),
        instruction("dey", "implied"),
        instruction("cpy", "immediate", immediate(0xff)),
      ],
      branch("bne", label("backward-byte"), label("backward-next")),
    );
    add(
      label("backward-next"),
      fullPages === 1
        ? []
        : [
            instruction("dec", "storage", fromByte(1)),
            instruction("dec", "storage", toByte(1)),
            instruction("dex", "implied"),
          ],
      fullPages === 1 ? fallthrough(done) : branch("bne", label("backward-page"), done),
    );
  }
  return Object.freeze({ blocks: Object.freeze(blocks), continuation: done });
}
