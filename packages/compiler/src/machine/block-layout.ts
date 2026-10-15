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

/** Identify a direct successor, without inferring reachability through other blocks. */
function directlyReaches(terminator: MachineTerminator, label: string): boolean {
  if (terminator.kind === "jump" || terminator.kind === "fallthrough")
    return terminator.target === label;
  if (terminator.kind === "branch")
    return terminator.target === label || terminator.fallthrough === label;
  if (terminator.kind === "long-branch")
    return terminator.jump.target === label || terminator.fallthrough === label;
  return false;
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
  const declared = new Map(fn.blocks.map((block) => [block.label, block] as const));
  if (declared.size !== fn.blocks.length) return null;
  // Equal pure constant returns need one load/RTS, not one copy per source arm.
  // Keep each old label as an empty alias so existing edge and label ownership
  // stays intact. No other state-producing instruction or memory access may be shared.
  const constantReturns = new Map<number, string>();
  for (const block of fn.blocks) {
    const instruction = block.instructions[0];
    if (
      block.terminator.kind !== "return" ||
      block.instructions.length !== 1 ||
      instruction?.opcode !== "lda" ||
      instruction.mode !== "immediate" ||
      instruction.operand?.kind !== "immediate" ||
      !Number.isInteger(instruction.operand.value) ||
      instruction.operand.value < 0 ||
      instruction.operand.value > 0xff ||
      instruction.memory.length !== 0
    )
      continue;
    const target = constantReturns.get(instruction.operand.value);
    if (target === undefined) {
      constantReturns.set(instruction.operand.value, block.label);
    } else {
      declared.set(
        block.label,
        Object.freeze({
          ...block,
          instructions: Object.freeze([]),
          terminator: Object.freeze({ kind: "fallthrough" as const, target }),
        }),
      );
    }
  }
  /** Resolve only instruction-empty internal aliases; cyclic chains stay unchanged. */
  const resolve = (label: string): string => {
    const seen = new Set<string>();
    let current = label;
    while (!seen.has(current)) {
      seen.add(current);
      const block = declared.get(current);
      if (
        block === undefined ||
        block.instructions.length !== 0 ||
        (block.terminator.kind !== "jump" && block.terminator.kind !== "fallthrough") ||
        !declared.has(block.terminator.target)
      )
        return current;
      current = block.terminator.target;
    }
    return label;
  };
  const resolved = new Map(fn.blocks.map(({ label }) => [label, resolve(label)]));
  const targetOf = (label: string): string => resolved.get(label) ?? label;
  const aliases = new Map<string, MachineBlock[]>();
  const byLabel = new Map<string, MachineBlock>();
  for (const block of declared.values()) {
    const target = targetOf(block.label);
    if (target !== block.label) {
      const group = aliases.get(target) ?? [];
      group.push(block);
      aliases.set(target, group);
      continue;
    }
    const terminator = block.terminator;
    byLabel.set(
      block.label,
      Object.freeze({
        ...block,
        terminator: Object.freeze(
          terminator.kind === "branch"
            ? {
                ...terminator,
                target: targetOf(terminator.target),
                fallthrough: targetOf(terminator.fallthrough),
              }
            : terminator.kind === "jump" || terminator.kind === "fallthrough"
              ? { ...terminator, target: targetOf(terminator.target) }
              : terminator.kind === "long-branch"
                ? {
                    ...terminator,
                    jump: Object.freeze({
                      ...terminator.jump,
                      target: targetOf(terminator.jump.target),
                    }),
                    fallthrough: targetOf(terminator.fallthrough),
                  }
                : terminator,
        ),
      }),
    );
  }
  const remaining = new Set(byLabel.keys());
  const pending: string[] = [];
  const ordered: MachineBlock[] = [];
  let next: string | undefined = targetOf(fn.blocks[0]!.label);
  let bridge = 0;
  const occupiedLabels = new Set(declared.keys());

  const enqueue = (label: string): boolean => {
    if (!byLabel.has(label)) return false;
    if (remaining.has(label) && !pending.includes(label)) pending.push(label);
    return true;
  };
  /** A still-unplaced conditional predecessor should precede its shared return tail. */
  const sharedReturn = (label: string): boolean =>
    byLabel.get(label)?.terminator.kind === "return" &&
    [...remaining].some((pendingLabel) => {
      const terminator = byLabel.get(pendingLabel)!.terminator;
      return (
        (terminator.kind === "branch" || terminator.kind === "long-branch") &&
        directlyReaches(terminator, label)
      );
    });
  /** Preserve every original alias at its target's address, without orphan jump bytes. */
  const appendBlock = (block: MachineBlock): void => {
    const group = aliases.get(block.label) ?? [];
    group.forEach((alias, index) =>
      ordered.push(
        Object.freeze({
          ...alias,
          terminator: Object.freeze({
            kind: "fallthrough" as const,
            target: group[index + 1]?.label ?? block.label,
          }),
        }),
      ),
    );
    ordered.push(block);
  };

  while (remaining.size > 0) {
    while (next !== undefined && !remaining.has(next)) next = pending.shift();
    if (next === undefined) next = [...byLabel.keys()].find((label) => remaining.has(label));
    if (next === undefined) return null;
    const original = byLabel.get(next);
    if (original === undefined) return null;
    remaining.delete(next);
    let block = original;
    let follow: string | undefined;

    if (original.terminator.kind === "branch") {
      const { target, fallthrough } = original.terminator;
      if (!byLabel.has(target) || !byLabel.has(fallthrough)) return null;
      // A successor which also reaches the other arm must precede that shared
      // continuation. Otherwise nested conditions need a bridge back to a label
      // already placed. Inversion keeps exactly the same condition and effects.
      const bothReturn =
        byLabel.get(target)!.terminator.kind === "return" &&
        byLabel.get(fallthrough)!.terminator.kind === "return";
      const targetShared = bothReturn && sharedReturn(target);
      const fallthroughShared = bothReturn && sharedReturn(fallthrough);
      const targetFirst =
        remaining.has(target) &&
        (directlyReaches(byLabel.get(target)!.terminator, fallthrough) ||
          (bothReturn &&
            ((!targetShared && fallthroughShared) ||
              // Two shared tails cannot both follow the remaining predecessor.
              // Place the smaller terminal first, keeping the larger tail last.
              (targetShared &&
                fallthroughShared &&
                blockBytes(byLabel.get(target)!)! < blockBytes(byLabel.get(fallthrough)!)!) ||
              (!targetShared &&
                !fallthroughShared &&
                blockBytes(byLabel.get(target)!)! > blockBytes(byLabel.get(fallthrough)!)!))));
      if (remaining.has(fallthrough) && !targetFirst) {
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
        enqueue(fallthrough);
      } else {
        let bridgeLabel: string;
        do {
          bridgeLabel = `${original.label}.fallthrough.${bridge}`;
          bridge += 1;
        } while (occupiedLabels.has(bridgeLabel));
        occupiedLabels.add(bridgeLabel);
        block = Object.freeze({
          ...original,
          terminator: Object.freeze({ ...original.terminator, fallthrough: bridgeLabel }),
        });
        appendBlock(block);
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
      const target = original.terminator.target;
      if (remaining.has(target)) {
        // This unconditional edge has no alternative successor. Place its target
        // next and keep the same label/effects without paying for a redundant JMP.
        // Back edges and targets already placed still need their original jump.
        follow = target;
        block = Object.freeze({
          ...original,
          terminator: Object.freeze({ kind: "fallthrough" as const, target }),
        });
      }
    }

    appendBlock(block);
    next = follow ?? pending.shift();
  }

  return Object.freeze({
    ...fn,
    blocks: Object.freeze(ordered),
  });
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
