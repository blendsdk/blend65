/**
 * Pure text predicates over one program's emitted 6502 assembly — the shared
 * scanner behind the block-layout shape assertions. Everything here takes the
 * assembly TEXT as a string and does no I/O, so the same helper serves both a
 * committed golden file and freshly emitted output.
 *
 * Segmentation convention (the contract every predicate builds on):
 *
 * - A program is partitioned into function sections by the emitted marker
 *   lines `; --- function: <name> ---`. Text before the first marker (the
 *   preamble and the startup shim) belongs to NO function and is never
 *   scanned — which is what structurally excludes the shim's `JMP _main`.
 * - Within a section, a label is a line whose first character sits at
 *   column 0 and which ends in `:`.
 * - The next emitted label after an instruction is the first such line
 *   following it inside the same section.
 * - A block body is the instruction run between two consecutive labels.
 * - Blank lines and comment-only lines cannot change the assembled
 *   instruction stream, so they are ignored throughout.
 *
 * Test-only support: deliberately NOT re-exported from the package barrel.
 */

/** The emitted function-section marker: `; --- function: <name> ---`. */
const FUNCTION_MARKER = /^;\s*---\s*function:\s*(\S+)\s*---/;

/**
 * A direct unconditional jump: `JMP <label>`. Indirect jumps (`JMP ($...)`)
 * have no static label target, so the label-matching predicates deliberately
 * do not recognise them.
 */
const DIRECT_JMP = /^jmp\s+([A-Za-z_.][\w.]*)\s*$/i;

/** A conditional branch (the relative-only 6502 opcodes) with its target. */
const CONDITIONAL_BRANCH = /^(?:bcc|bcs|beq|bne|bmi|bpl|bvc|bvs)\s+([A-Za-z_.][\w.]*)\s*$/i;

/** Any unconditional jump, target irrelevant (the middle of the trigram). */
const ANY_JMP = /^jmp\s+\S/i;

/**
 * The minted long-branch label: an underscore, `rlx`, then digits — the
 * whole label, exactly as the compiler mints it (`_rlx0`, `_rlx1`, …).
 */
const RELAX_LABEL = /^_rlx\d+$/;

/** One cleaned instruction line (comment stripped, trimmed) with its position. */
export interface ScanInstruction {
  /** The instruction text, e.g. `"JMP Main_main_L3"`. */
  readonly text: string;
  /** 1-based line number in the original assembly text. */
  readonly line: number;
}

/** One labelled block: a label and the instruction run up to the next label. */
export interface ScanBlock {
  /** The block's label, without the trailing `:`. */
  readonly label: string;
  /** 1-based line number of the label line. */
  readonly line: number;
  /** The block body — instructions between this label and the next. */
  readonly body: readonly ScanInstruction[];
}

/** One function section, as delimited by the emitted function markers. */
export interface FunctionSection {
  /** The function name from the marker, e.g. `"Main.main"`. */
  readonly name: string;
  /** 1-based line number of the marker line. */
  readonly line: number;
  /** Instructions between the marker and the section's first label. */
  readonly leading: readonly ScanInstruction[];
  /** The section's labelled blocks, in emission order. */
  readonly blocks: readonly ScanBlock[];
}

/** One shape violation, with enough context for an actionable failure message. */
export interface ScanViolation {
  /** The enclosing function section's name. */
  readonly functionName: string;
  /** The label the violation centres on (jump target or block label). */
  readonly label: string;
  /** 1-based line number of the offending instruction or block label. */
  readonly line: number;
  /** Plain-language description of what is wrong at that line. */
  readonly detail: string;
}

/** What the scanner saw, in aggregate — the scan's own non-vacuity measure. */
export interface ScanCoverage {
  /** How many function sections the marker segmentation produced. */
  readonly functionSections: number;
  /** How many direct unconditional jumps were seen inside those sections. */
  readonly unconditionalJumps: number;
}

/**
 * Partitions emitted assembly into function sections per the segmentation
 * convention in the module doc. Text before the first `; --- function: … ---`
 * marker (preamble, symbol table, startup shim) belongs to no section and is
 * absent from the result.
 *
 * @param asm The emitted assembly text of one program.
 * @returns The function sections in emission order.
 * @example
 * ```typescript
 * const sections = parseFunctionSections(asmText);
 * const main = sections.find((s) => s.name === "Main.main");
 * const labels = main!.blocks.map((b) => b.label);
 * ```
 */
export function parseFunctionSections(asm: string): FunctionSection[] {
  interface MutableSection {
    name: string;
    line: number;
    leading: ScanInstruction[];
    blocks: { label: string; line: number; body: ScanInstruction[] }[];
  }

  const sections: MutableSection[] = [];
  let current: MutableSection | undefined;

  const rawLines = asm.split("\n");
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]!;
    const lineNo = i + 1;

    const marker = FUNCTION_MARKER.exec(raw.trim());
    if (marker !== null) {
      current = { name: marker[1]!, line: lineNo, leading: [], blocks: [] };
      sections.push(current);
      continue;
    }

    // Strip trailing comments; skip blank and comment-only lines — they
    // cannot change the assembled instruction stream.
    const cleaned = raw.replace(/;.*$/, "").trimEnd();
    const text = cleaned.trim();
    if (text.length === 0) {
      continue;
    }

    // A label starts at column 0 and ends in `:`.
    const isLabel = !/^\s/.test(cleaned) && text.endsWith(":");
    if (current === undefined) {
      continue; // Before the first marker: belongs to no function.
    }
    if (isLabel) {
      current.blocks.push({ label: text.slice(0, -1), line: lineNo, body: [] });
      continue;
    }
    const instr: ScanInstruction = { text, line: lineNo };
    const block = current.blocks[current.blocks.length - 1];
    if (block === undefined) {
      current.leading.push(instr);
    } else {
      block.body.push(instr);
    }
  }

  return sections;
}

/**
 * Finds unconditional jumps whose target is the next emitted label within the
 * same function — a jump to the very next instruction. Such a jump is a
 * defect: execution would arrive there anyway by falling through, so the
 * instruction spends bytes and cycles doing literally nothing. The startup
 * shim's `JMP _main` sits before the first function marker, so the
 * segmentation itself keeps it out of scope.
 *
 * @param asm The emitted assembly text of one program.
 * @returns One violation per offending jump; empty means clean.
 * @example
 * ```typescript
 * expect(fallThroughJumps(asmText)).toEqual([]);
 * ```
 */
export function fallThroughJumps(asm: string): ScanViolation[] {
  const violations: ScanViolation[] = [];
  for (const section of parseFunctionSections(asm)) {
    const runs: { body: readonly ScanInstruction[]; nextLabel: string | undefined }[] = [
      { body: section.leading, nextLabel: section.blocks[0]?.label },
    ];
    for (let k = 0; k < section.blocks.length; k++) {
      runs.push({ body: section.blocks[k]!.body, nextLabel: section.blocks[k + 1]?.label });
    }
    for (const { body, nextLabel } of runs) {
      if (nextLabel === undefined) {
        continue;
      }
      for (const instr of body) {
        const jmp = DIRECT_JMP.exec(instr.text);
        if (jmp !== null && jmp[1] === nextLabel) {
          violations.push({
            functionName: section.name,
            label: nextLabel,
            line: instr.line,
            detail: `jump to the very next label: \`${instr.text}\` falls through to \`${nextLabel}:\``,
          });
        }
      }
    }
  }
  return violations;
}

/**
 * Finds trampoline blocks: blocks whose whole body is a single direct
 * unconditional jump. Such a block is a defect — it exists only to bounce
 * execution somewhere else, so every entry pays a full `JMP` that the jump's
 * sources could have taken directly. Two shapes are legitimate and excluded:
 * a self-referential jump (the block jumps to its own label — a spin loop),
 * and a function's entry block (the first label of the section), whose label
 * is the function's call target and cannot be threaded away.
 *
 * @param asm The emitted assembly text of one program.
 * @returns One violation per trampoline block; empty means clean.
 * @example
 * ```typescript
 * expect(trampolineBlocks(asmText)).toEqual([]);
 * ```
 */
export function trampolineBlocks(asm: string): ScanViolation[] {
  const violations: ScanViolation[] = [];
  for (const section of parseFunctionSections(asm)) {
    for (let k = 1; k < section.blocks.length; k++) {
      const block = section.blocks[k]!;
      if (block.body.length !== 1) {
        continue;
      }
      const jmp = DIRECT_JMP.exec(block.body[0]!.text);
      if (jmp === null || jmp[1] === block.label) {
        continue;
      }
      violations.push({
        functionName: section.name,
        label: block.label,
        line: block.line,
        detail: `trampoline block: \`${block.label}:\` exists only to \`${block.body[0]!.text}\``,
      });
    }
  }
  return violations;
}

/**
 * Finds the branch-over-jump trigram: a conditional branch to `L`, then an
 * unconditional jump, then `L:` defined on the very next line — a branch that
 * skips over a jump to the place the branch itself could have gone with its
 * sense inverted. That inversion saves the whole `JMP` on the taken path, so
 * the trigram is a defect wherever a short branch could reach.
 *
 * Carve-out: when `L` is a minted long-branch label (`_rlx` plus digits, the
 * whole label), the trigram is EXEMPT — it is exactly the legal long-branch
 * form emitted when a conditional branch cannot reach its target within the
 * relative range, and banning it would forbid correct code.
 *
 * @param asm The emitted assembly text of one program.
 * @returns One violation per offending trigram; empty means clean.
 * @example
 * ```typescript
 * expect(branchOverJumps(asmText)).toEqual([]);
 * ```
 */
export function branchOverJumps(asm: string): ScanViolation[] {
  const violations: ScanViolation[] = [];
  for (const section of parseFunctionSections(asm)) {
    for (let k = 0; k < section.blocks.length; k++) {
      const block = section.blocks[k]!;
      const next = section.blocks[k + 1];
      if (next === undefined || block.body.length < 2) {
        continue;
      }
      const branch = block.body[block.body.length - 2]!;
      const jump = block.body[block.body.length - 1]!;
      const cond = CONDITIONAL_BRANCH.exec(branch.text);
      if (
        cond !== null &&
        cond[1] === next.label &&
        ANY_JMP.test(jump.text) &&
        !RELAX_LABEL.test(next.label)
      ) {
        violations.push({
          functionName: section.name,
          label: next.label,
          line: branch.line,
          detail:
            `branch over jump: \`${branch.text}\` hops over \`${jump.text}\` ` +
            `to reach \`${next.label}:\` on the next line`,
        });
      }
    }
  }
  return violations;
}

/**
 * Measures what the scan actually saw: how many function sections the marker
 * segmentation produced and how many direct unconditional jumps sit inside
 * them. This is the non-vacuity guard for the three shape predicates — if a
 * marker-format drift ever made the parser see zero sections, every predicate
 * would pass by finding nothing, and this count is what catches that.
 *
 * @param asm The emitted assembly text of one program.
 * @returns The section and in-section jump counts.
 * @example
 * ```typescript
 * expect(scanCoverage(asmText).functionSections).toBeGreaterThan(0);
 * ```
 */
export function scanCoverage(asm: string): ScanCoverage {
  const sections = parseFunctionSections(asm);
  let unconditionalJumps = 0;
  for (const section of sections) {
    const instructions = [...section.leading, ...section.blocks.flatMap((b) => b.body)];
    for (const instr of instructions) {
      if (DIRECT_JMP.test(instr.text)) {
        unconditionalJumps += 1;
      }
    }
  }
  return { functionSections: sections.length, unconditionalJumps };
}
