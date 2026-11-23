import type { MachineInstruction } from "./machine-types.js";

/** Stack bytes each recognised push or pull moves, as a signed depth change. */
const STACK_MOVE: Readonly<Record<string, number>> = Object.freeze({
  pha: 1,
  php: 1,
  pla: -1,
  plp: -1,
});

/** Whether an instruction reads or writes the stack pointer. */
function touchesStackPointer(instruction: MachineInstruction): boolean {
  return instruction.uses.registers.includes("s") || instruction.defines.registers.includes("s");
}

/**
 * The index of the `plp` which restores the status register one `php` saved,
 * given that the flags named in `live` must survive the pair.
 *
 * A save followed by its own restore preserves the flags rather than consuming
 * them: whatever N and Z held at the `php` is written back by the `plp`, so the
 * instructions in between cannot be read as having spent them, and the ones that
 * define N or Z in between cannot be read as having replaced them either. The
 * caller therefore resumes after the restore with the same flags still live.
 *
 * The window is deliberately confined to straight-line instructions in one
 * block. That makes two awkward questions disappear: no path can reach the
 * restore without the save, and no path can leave the window with the saved byte
 * still on the stack. Anything else refuses, which is the answer the proof gave
 * before this test existed.
 *
 * Only `pha`, `php`, `pla` and `plp` may move the stack inside the window, and
 * the depth has to come back to the save's own byte exactly at a `plp`. Any other
 * instruction that reads or writes the stack pointer — a call, a return, a frame
 * unwind — refuses, because then which byte the restore pops is no longer known
 * from the sequence alone.
 *
 * @param instructions - Instructions of the block holding the save.
 * @param save - Index of the `php`.
 * @param live - Flags the walk still needs an answer for.
 * @returns The matched `plp`'s index, or `null` when no such window exists.
 *
 * @example
 * // php | pha | sei | lda $0314 | sta $08c5 | pla | plp
 * matchedStatusRestore(block.instructions, 0, new Set(["n", "z"])); // 6
 */
export function matchedStatusRestore(
  instructions: readonly MachineInstruction[],
  save: number,
  live: ReadonlySet<string>,
): number | null {
  if (instructions[save]?.opcode !== "php") return null;
  let depth = 1;
  for (let at = save + 1; at < instructions.length; at += 1) {
    const instruction = instructions[at]!;
    if (instruction.uses.flags.some((flag) => live.has(flag))) return null;
    const move = STACK_MOVE[instruction.opcode];
    if (move === undefined) {
      if (touchesStackPointer(instruction)) return null;
      continue;
    }
    depth += move;
    // Only a pull can bring the depth back to the save's own byte, so this is
    // also where a `pla` consuming it refuses: the restored flags would then be
    // whatever that byte happens to hold, not the pair the save put there.
    if (depth === 0) return instruction.opcode === "plp" ? at : null;
  }
  return null;
}
