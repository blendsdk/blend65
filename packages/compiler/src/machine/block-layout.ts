import type {
  BranchRepairResult,
  MachineBlock,
  MachineFunction,
  MachineTerminator,
} from "./machine-types.js";

const INVERSE_BRANCH: Readonly<Record<string, string>> = Object.freeze({
  bcc: "bcs",
  bcs: "bcc",
  beq: "bne",
  bmi: "bpl",
  bne: "beq",
  bpl: "bmi",
  bvc: "bvs",
  bvs: "bvc",
});

/** Return the encoded size of one structured terminator. */
function terminatorBytes(terminator: MachineTerminator): number {
  if (terminator.kind === "fallthrough" || terminator.kind === "unreachable") return 0;
  if (terminator.kind === "long-branch") return 5;
  return terminator.cost?.bytes ?? (terminator.kind === "return" ? 1 : 0);
}

/** Return one block's encoded byte length. */
function blockBytes(block: MachineBlock): number | null {
  const instructionBytes = block.instructions.reduce(
    (sum, instruction) => sum + instruction.cost.bytes,
    0,
  );
  const total = instructionBytes + terminatorBytes(block.terminator);
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

/** Calculate block origins and complete function length. */
function positions(fn: MachineFunction, origin: number) {
  const byLabel = new Map<string, number>();
  let address = origin;
  for (const block of fn.blocks) {
    const bytes = blockBytes(block);
    if (bytes === null || byLabel.has(block.label)) return null;
    byLabel.set(block.label, address);
    address += bytes;
  }
  return Object.freeze({ byLabel, byteLength: address - origin });
}

/** Put every declared fallthrough immediately after its source block. */
function orderBlocks(fn: MachineFunction): MachineFunction | null {
  if (fn.blocks.length === 0) return fn;
  const byLabel = new Map(fn.blocks.map((block) => [block.label, block] as const));
  if (byLabel.size !== fn.blocks.length) return null;
  const remaining = new Set(byLabel.keys());
  const pending: string[] = [];
  const ordered: MachineBlock[] = [];
  let next: string | undefined = fn.blocks[0]!.label;
  let bridge = 0;

  const enqueue = (label: string): boolean => {
    if (!byLabel.has(label)) return false;
    if (remaining.has(label) && !pending.includes(label)) pending.push(label);
    return true;
  };

  while (remaining.size > 0) {
    while (next !== undefined && !remaining.has(next)) next = pending.shift();
    if (next === undefined) next = fn.blocks.find((block) => remaining.has(block.label))?.label;
    if (next === undefined) return null;
    const original = byLabel.get(next);
    if (original === undefined) return null;
    remaining.delete(next);
    let block = original;
    let follow: string | undefined;

    if (original.terminator.kind === "branch") {
      const { target, fallthrough } = original.terminator;
      if (!byLabel.has(target) || !byLabel.has(fallthrough)) return null;
      if (remaining.has(fallthrough)) {
        follow = fallthrough;
        enqueue(target);
      } else if (remaining.has(target)) {
        const inverse = INVERSE_BRANCH[original.terminator.opcode];
        if (inverse === undefined) return null;
        block = Object.freeze({
          ...original,
          terminator: Object.freeze({
            ...original.terminator,
            opcode: inverse,
            target: fallthrough,
            fallthrough: target,
          }),
        });
        follow = target;
      } else {
        let bridgeLabel: string;
        do {
          bridgeLabel = `${original.label}.fallthrough.${bridge}`;
          bridge += 1;
        } while (byLabel.has(bridgeLabel));
        block = Object.freeze({
          ...original,
          terminator: Object.freeze({ ...original.terminator, fallthrough: bridgeLabel }),
        });
        ordered.push(block);
        ordered.push(
          Object.freeze({
            label: bridgeLabel,
            instructions: Object.freeze([]),
            terminator: Object.freeze({
              kind: "jump" as const,
              opcode: "jmp" as const,
              target: fallthrough,
              cost: Object.freeze({ bytes: 3, minCycles: 3, maxCycles: 3 }),
            }),
          }),
        );
        next = pending.shift();
        continue;
      }
    } else if (original.terminator.kind === "fallthrough") {
      const target = original.terminator.target;
      if (!byLabel.has(target)) return null;
      if (remaining.has(target)) follow = target;
      else {
        block = Object.freeze({
          ...original,
          terminator: Object.freeze({
            kind: "jump" as const,
            opcode: "jmp" as const,
            target,
            cost: Object.freeze({ bytes: 3, minCycles: 3, maxCycles: 3 }),
          }),
        });
      }
    } else if (original.terminator.kind === "long-branch") {
      if (
        !enqueue(original.terminator.jump.target) ||
        !byLabel.has(original.terminator.fallthrough)
      ) {
        return null;
      }
      if (remaining.has(original.terminator.fallthrough)) follow = original.terminator.fallthrough;
    } else if (original.terminator.kind === "jump" && byLabel.has(original.terminator.target)) {
      enqueue(original.terminator.target);
    }

    ordered.push(block);
    next = follow ?? pending.shift();
  }

  return Object.freeze({ ...fn, blocks: Object.freeze(ordered) });
}

/**
 * Keep in-range branches and monotonically replace only out-of-range forms.
 * @param fn Structured function in selected block order.
 * @param origin Final function origin.
 * @returns Repaired function and exact byte length.
 */
export function repairMachineBranches(fn: MachineFunction, origin: number): BranchRepairResult {
  if (!Number.isSafeInteger(origin) || origin < 0 || origin > 0xffff) {
    return Object.freeze({ kind: "error", reason: "invalid-size" });
  }
  const ordered = orderBlocks(fn);
  if (ordered === null) return Object.freeze({ kind: "error", reason: "missing-label" });
  let current = ordered;
  for (let round = 0; round <= fn.blocks.length; round += 1) {
    const placed = positions(current, origin);
    if (placed === null) return Object.freeze({ kind: "error", reason: "invalid-size" });
    let changed = false;
    const blocks = current.blocks.map((block) => {
      if (block.terminator.kind !== "branch") return block;
      const blockOrigin = placed.byLabel.get(block.label)!;
      const instructionBytes = block.instructions.reduce(
        (sum, instruction) => sum + instruction.cost.bytes,
        0,
      );
      const target = placed.byLabel.get(block.terminator.target);
      if (target === undefined) return null;
      const displacement = target - (blockOrigin + instructionBytes + 2);
      if (displacement >= -128 && displacement <= 127) return block;
      const inverse = INVERSE_BRANCH[block.terminator.opcode];
      if (inverse === undefined) return null;
      changed = true;
      return Object.freeze({
        ...block,
        terminator: Object.freeze({
          kind: "long-branch" as const,
          opcode: inverse,
          fallthrough: block.terminator.fallthrough,
          jump: Object.freeze({
            opcode: "jmp" as const,
            target: block.terminator.target,
            cost: Object.freeze({ bytes: 3, minCycles: 3, maxCycles: 3 }),
          }),
          uses: block.terminator.uses,
          cost: Object.freeze({ bytes: 5, minCycles: 3, maxCycles: 5 }),
        }),
      });
    });
    if (blocks.some((block) => block === null)) {
      return Object.freeze({ kind: "error", reason: "missing-label" });
    }
    current = Object.freeze({
      ...current,
      blocks: Object.freeze(blocks.filter((block) => block !== null)),
    });
    if (!changed) {
      const final = positions(current, origin)!;
      return Object.freeze({
        kind: "complete",
        function: Object.freeze({
          ...current,
          origin,
          blocks: Object.freeze(
            current.blocks.map((block) =>
              Object.freeze({ ...block, origin: final.byLabel.get(block.label)! }),
            ),
          ),
        }),
        byteLength: final.byteLength,
      });
    }
  }
  return Object.freeze({ kind: "error", reason: "invalid-size" });
}
