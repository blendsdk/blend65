/**
 * Branch relaxation — making every conditional branch reachable.
 *
 * A 6502 conditional branch encodes its target as a signed 8-bit displacement
 * from the instruction that follows it, so it can only reach −128..+127 bytes.
 * Nothing upstream of here knows instruction addresses: the translator decides
 * branch targets from control flow alone, long before any byte has an offset.
 * A program whose control flow spans more than that reach therefore emits a
 * branch the assembler rejects outright.
 *
 * This stage is where that is fixed, and it is **correctness, not
 * optimization**: it runs unconditionally, after the peephole, so it measures
 * the geometry actually emitted. A program that assembles with optimization on
 * and fails with it off would be a trap.
 *
 * An out-of-reach branch becomes the form a hand-coder writes for the same
 * situation — the opposite branch hopping over an absolute jump:
 *
 * ```
 *     BEQ far        →      BNE _rlx0
 *                           JMP far
 *                       _rlx0:
 * ```
 *
 * three bytes larger, and one cycle slower only on the path that now jumps.
 * Because that growth can push a *neighbouring* branch past its own limit, the
 * rewrite iterates to a fixpoint. It terminates: a relaxed branch is never
 * un-relaxed, and every iteration relaxes at least one branch from a finite
 * set.
 *
 * Lives in `@blend65/codegen` (never imported by the frontend/
 * language-server).
 */

import type { DiagnosticBag } from "@blend65/core";
import { IceCode } from "@blend65/core";
import type { CpuVariant, InstrStream, StreamEntry } from "./stream.js";
import { instr, isInstr, isLabel, label } from "./stream.js";
import { isLabelRef, labelRef } from "./operand.js";
import { instrByteSize } from "./print-instr.js";
import { invertBranch } from "./branch-tail.js";
import type { InstrProgram } from "./instr-program.js";

/** The most negative displacement a relative branch can encode. */
const MIN_DISPLACEMENT = -128;

/** The most positive displacement a relative branch can encode. */
const MAX_DISPLACEMENT = 127;

/** Stem for the synthetic labels this stage mints (`_rlx0`, `_rlx1`, …). */
const MINTED_LABEL_STEM = "_rlx";

/**
 * Rewrite every out-of-reach conditional branch in `program` into the
 * inverted-branch-over-jump form, iterating until no branch is out of reach.
 *
 * The returned program carries `preamble`, `allocationPlan` and
 * `preambleOptions` through untouched — it differs only in the entries of the
 * code streams that needed a rewrite. When nothing anywhere is out of reach the
 * **input reference itself** is returned, so a caller can cheaply tell that the
 * stage was a no-op.
 *
 * Two situations are reported as compiler bugs (`E90001`) rather than absorbed,
 * because either one would otherwise let a wrong displacement through silently:
 * a branch whose target label is not in its own stream, and an inline directive
 * inside a code stream (directives belong to the preamble and to data streams;
 * one appearing here would make the byte-offset walk wrong).
 *
 * @param program The assembled — and, under `--optimize`, peepholed — program.
 * @param _cpu The target CPU primitive. Reserved: on a 65C02 an out-of-reach
 *   `BRA` relaxes to a bare `JMP` rather than to the three-entry form. Unused
 *   while nothing emits `BRA`.
 * @param bag Diagnostic sink for the two internal-error cases.
 * @returns The relaxed program, or the input reference when nothing changed.
 *
 * @example
 * ```ts
 * // After assembleProgram (and the peephole, when enabled):
 * const relaxed = relaxBranches(program, plugin.profile.cpu, bag);
 * const text = serializeToAcme(relaxed, { runtimeSection });
 * ```
 */
export function relaxBranches(
  program: InstrProgram,
  _cpu: CpuVariant,
  bag: DiagnosticBag,
): InstrProgram {
  const mintLabel = createLabelMinter(visibleLabels(program));
  let changed = false;
  const streams = program.streams.map((stream) => {
    if (stream.segment !== "code") {
      return stream;
    }
    const relaxed = relaxStream(stream, mintLabel, bag);
    if (relaxed === stream) {
      return stream;
    }
    changed = true;
    return relaxed;
  });

  if (!changed) {
    return program;
  }
  return Object.freeze({
    preamble: program.preamble,
    streams: Object.freeze(streams),
    allocationPlan: program.allocationPlan,
    ...(program.preambleOptions !== undefined ? { preambleOptions: program.preambleOptions } : {}),
  });
}

/**
 * Every label name the stage can see: all streams' label entries plus the
 * preamble's. Minted names are checked against this set so a synthetic label
 * can never shadow a real symbol.
 *
 * The appended runtime section is composed as text further downstream and is
 * not part of `streams`, so its labels are outside this set — a collision there
 * would be an assembler duplicate-symbol error, which is loud.
 */
function visibleLabels(program: InstrProgram): Set<string> {
  const names = new Set<string>();
  const add = (entries: readonly StreamEntry[]): void => {
    for (const entry of entries) {
      if (isLabel(entry)) {
        names.add(entry.name);
      }
    }
  };
  add(program.preamble);
  for (const stream of program.streams) {
    add(stream.entries);
  }
  return names;
}

/**
 * A generator of fresh synthetic label names, seeded with the names already in
 * use. One minter serves the whole program: the labels are global assembler
 * symbols, so a per-stream counter would collide as soon as two streams both
 * relaxed.
 */
function createLabelMinter(taken: Set<string>): () => string {
  let next = 0;
  return () => {
    let name = `${MINTED_LABEL_STEM}${next++}`;
    while (taken.has(name)) {
      name = `${MINTED_LABEL_STEM}${next++}`;
    }
    taken.add(name);
    return name;
  };
}

/**
 * Relax one code stream to a fixpoint, returning the input stream unchanged
 * when nothing in it was out of reach.
 */
function relaxStream(
  stream: InstrStream,
  mintLabel: () => string,
  bag: DiagnosticBag,
): InstrStream {
  let entries = stream.entries;
  let changed = false;
  // Each rewrite only ever inserts bytes, so a branch already out of reach can
  // never come back into reach — every branch found out of reach in one
  // snapshot can safely be rewritten together, and the loop reruns only to
  // catch branches the inserted bytes have newly pushed out.
  for (;;) {
    const outOfReach = outOfReachIndexes(entries, stream.symbol, bag);
    if (outOfReach.length === 0) {
      break;
    }
    const rewritten = rewriteBranches(entries, outOfReach, mintLabel, bag);
    // A rewrite replaces one entry with three, so it grows the stream by two
    // entries (three bytes) per branch. Equal length therefore means every
    // candidate was refused — an inverse-less branch, itself reported as a
    // compiler bug — and re-running would spin forever.
    if (rewritten.length === entries.length) {
      break;
    }
    entries = rewritten;
    changed = true;
  }
  return changed ? { ...stream, entries } : stream;
}

/**
 * The indexes of every relative branch in `entries` whose displacement falls
 * outside the encodable range, in stream order.
 *
 * Reports — and then skips — a branch whose target is not a label of this same
 * stream, and a directive found inline in the code stream.
 */
function outOfReachIndexes(
  entries: readonly StreamEntry[],
  streamSymbol: string,
  bag: DiagnosticBag,
): number[] {
  const offsets: number[] = [];
  const labelOffsets = new Map<string, number>();
  let at = 0;
  for (const entry of entries) {
    offsets.push(at);
    if (isLabel(entry)) {
      labelOffsets.set(entry.name, at);
    } else if (!isInstr(entry)) {
      // The offset walk assumes a code stream holds only labels and
      // instructions. A directive here would contribute a size this walk
      // cannot trust, and every displacement after it would be wrong.
      bag.addICE(
        IceCode.Unexpected,
        null,
        `branch relaxation: inline directive in code stream '${streamSymbol}'`,
      );
    }
    at += instrByteSize(entry);
  }

  const indexes: number[] = [];
  entries.forEach((entry, index) => {
    if (!isInstr(entry) || entry.mode !== "Relative" || !isLabelRef(entry.operand)) {
      return;
    }
    const target = entry.operand.label;
    const targetOffset = labelOffsets.get(target);
    if (targetOffset === undefined) {
      // Skipping here is what would produce the silently truncated
      // displacement this stage exists to prevent.
      bag.addICE(
        IceCode.Unexpected,
        null,
        `branch relaxation: branch target '${target}' is not a label of stream '${streamSymbol}'`,
      );
      return;
    }
    // A relative displacement is measured from the instruction that follows
    // the branch, hence the branch's own size.
    const displacement = targetOffset - (offsets[index]! + instrByteSize(entry));
    if (displacement < MIN_DISPLACEMENT || displacement > MAX_DISPLACEMENT) {
      indexes.push(index);
    }
  });
  return indexes;
}

/**
 * Replace each branch named by `indexes` with the inverted-branch / `JMP` /
 * minted-label triple, leaving every other entry exactly as it was.
 *
 * A branch with no polarity partner is a compiler bug: emitting the pair
 * un-inverted would branch the wrong way, and nothing downstream could see it.
 * Such a branch is reported and left alone.
 */
function rewriteBranches(
  entries: readonly StreamEntry[],
  indexes: readonly number[],
  mintLabel: () => string,
  bag: DiagnosticBag,
): StreamEntry[] {
  const targets = new Set(indexes);
  const rewritten: StreamEntry[] = [];
  entries.forEach((entry, index) => {
    if (!targets.has(index) || !isInstr(entry) || !isLabelRef(entry.operand)) {
      rewritten.push(entry);
      return;
    }
    const inverted = invertBranch(entry.opcode);
    if (inverted === undefined) {
      bag.addICE(
        IceCode.Unexpected,
        null,
        `branch relaxation: '${entry.opcode}' is out of reach but has no inverse`,
      );
      rewritten.push(entry);
      return;
    }
    const skipTo = mintLabel();
    const span = entry.sourceSpan;
    rewritten.push(instr(inverted, "Relative", labelRef(skipTo), span));
    rewritten.push(instr("JMP", "Absolute", labelRef(entry.operand.label), span));
    rewritten.push(label(skipTo));
  });
  return rewritten;
}
