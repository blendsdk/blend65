#!/usr/bin/env node
// Annotates an ACME report listing with per-instruction cycle counts and
// per-block sums, using the documented NMOS 6502 timings. Final assembled
// addresses make branch page-cross detection exact — which is why the input
// is a report, not raw assembly (a symbolic operand's addressing mode is
// undecidable from text).
//
//   node scripts/annotate-cycles.mjs build/main.report
//   node scripts/annotate-cycles.mjs --assemble examples/foo/foo.asm
//
// A block starts at the stream head or a branch/jump target and ends at a
// control transfer; its sum is the min-max over the block's instructions.
// Fails loudly: input paths must resolve inside the repository, and the
// built packages must be present.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve, sep } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`annotate-cycles: ${message}`);
  process.exit(1);
}

/** Canonicalize a user-supplied path and reject anything outside the repo. */
function resolveInsideRepo(inputPath) {
  const canonical = resolve(ROOT, inputPath);
  if (canonical !== ROOT && !canonical.startsWith(ROOT + sep)) {
    fail(`input path '${inputPath}' resolves outside the repository`);
  }
  return canonical;
}

/** Load the built compiler, with a clear message when dist is missing. */
async function loadCompiler() {
  try {
    return await import("@blend65/compiler");
  } catch {
    fail("cannot load @blend65/compiler — run 'yarn build' first");
  }
}

/** Opcodes that end a block (unconditional transfers; branches end via mode). */
const BLOCK_ENDERS = new Set(["JMP", "JSR", "RTS", "RTI", "BRK"]);

/**
 * Split an instruction stream into blocks: a block starts at the stream head
 * or at any branch/jump target, and ends at a control transfer.
 */
export function blocksOf(instructions) {
  const targets = new Set();
  for (const instruction of instructions) {
    if ((instruction.mode === "Relative" || instruction.opcode === "JMP") && instruction.operand !== null) {
      targets.add(instruction.operand);
    }
  }
  const blocks = [];
  let current = [];
  for (const instruction of instructions) {
    if (current.length > 0 && targets.has(instruction.address)) {
      blocks.push(current);
      current = [];
    }
    current.push(instruction);
    if (BLOCK_ENDERS.has(instruction.opcode) || instruction.mode === "Relative") {
      blocks.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    blocks.push(current);
  }
  return blocks;
}

/** Render an instruction's operand in listing style. */
function formatOperand(instruction) {
  const { mode, operand } = instruction;
  if (operand === null) return mode === "Accumulator" ? "A" : "";
  const hex2 = `$${operand.toString(16).padStart(2, "0")}`;
  const hex4 = `$${operand.toString(16).padStart(4, "0")}`;
  switch (mode) {
    case "Immediate": return `#${hex2}`;
    case "ZeroPage": return hex2;
    case "ZeroPageX": return `${hex2},x`;
    case "ZeroPageY": return `${hex2},y`;
    case "Absolute": return hex4;
    case "AbsoluteX": return `${hex4},x`;
    case "AbsoluteY": return `${hex4},y`;
    case "Indirect": return `(${hex4})`;
    case "IndirectX": return `(${hex2},x)`;
    case "IndirectY": return `(${hex2}),y`;
    case "Relative": return hex4; // resolved target address
    default: return hex4;
  }
}

/** Render `min-max` (or the single number when fixed). */
function formatRange(range) {
  return range.min === range.max ? String(range.min) : `${range.min}-${range.max}`;
}

/**
 * Render the annotated listing: per-instruction cycle ranges and per-block
 * sums.
 */
export function renderAnnotated(instructions, cycleRange) {
  const lines = [];
  for (const block of blocksOf(instructions)) {
    lines.push(`; block @ $${block[0].address.toString(16).padStart(4, "0")}`);
    let min = 0;
    let max = 0;
    for (const instruction of block) {
      const range = cycleRange(instruction);
      min += range.min;
      max += range.max;
      const addr = `$${instruction.address.toString(16).padStart(4, "0")}`;
      const operand = formatOperand(instruction);
      const text = operand === "" ? instruction.opcode : `${instruction.opcode} ${operand}`;
      lines.push(`${addr}  ${text.padEnd(18)} ${formatRange(range)}`);
    }
    lines.push(`; block total: ${min}-${max}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const assemble = args.includes("--assemble");
  const positional = args.filter((a) => a !== "--assemble");
  if (positional.length !== 1) {
    fail("usage: annotate-cycles.mjs [--assemble] <report-or-asm-path>");
  }
  // Validate the input path BEFORE any filesystem access.
  const inputPath = resolveInsideRepo(positional[0]);

  const { parseReportFile, cycleRange } = await loadCompiler();

  let reportPath = inputPath;
  if (assemble) {
    // Convenience: assemble the .asm first (argv array — never a shell
    // string), writing the report into a scratch dir.
    const scratch = mkdtempSync(join(tmpdir(), "b65-annotate-"));
    reportPath = join(scratch, "input.report");
    try {
      execFileSync(
        "acme",
        ["--cpu", "6510", "--format", "cbm", "--report", reportPath, "-o", join(scratch, "input.prg"), inputPath],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
    } catch (error) {
      fail(`ACME failed on '${positional[0]}':\n${String(error.stderr ?? error.message)}`);
    }
  }

  let content;
  try {
    content = readFileSync(reportPath, "utf8");
  } catch {
    fail(`cannot read report '${reportPath}'`);
  }
  const instructions = parseReportFile(content, reportPath);
  process.stdout.write(renderAnnotated(instructions, cycleRange) + "\n");
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
