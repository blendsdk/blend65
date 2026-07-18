#!/usr/bin/env node
// Twin parity scoreboard: for every golden with a hand-written twin, build
// the generated side through the real compiler, assemble BOTH sides through
// real ACME, and report parity ratios (generated ÷ hand-written, two
// decimals) — bytes from the assembled PRG sizes, cycles as the max-sum ÷
// max-sum of the classified instruction streams. Every divergence row
// carries exactly one category; goldens without a twin are listed as
// unpaired (exit 0 — the scoreboard is useful from a single pair).
//
//   node scripts/twin-diff.mjs                # markdown scoreboard to stdout
//   node scripts/twin-diff.mjs --json out.json  # additionally write JSON
//
// Fails loudly: the --json path must resolve inside the repository, the
// manifest must be well-formed, and the built packages must be present.

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { basename, dirname, join, resolve, sep } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN_DIR = join(ROOT, "packages", "test-harness", "test", "golden");
const MANIFEST_PATH = join(GOLDEN_DIR, "twins.json");
/** The PRG load-address header excluded from every byte figure. */
const PRG_HEADER_BYTES = 2;

function fail(message) {
  console.error(`twin-diff: ${message}`);
  process.exit(1);
}

/** Canonicalize a user-supplied path and reject anything outside the repo. */
function resolveInsideRepo(inputPath) {
  const canonical = resolve(ROOT, inputPath);
  if (canonical !== ROOT && !canonical.startsWith(ROOT + sep)) {
    fail(`output path '${inputPath}' resolves outside the repository`);
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

/** Read and strictly validate the pair manifest. */
function loadManifest() {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch (error) {
    fail(`cannot read/parse twins.json: ${error.message}`);
  }
  if (typeof parsed !== "object" || parsed === null || typeof parsed.pairs !== "object" || parsed.pairs === null) {
    fail("twins.json must be { pairs: { <golden>: { source, twin } } }");
  }
  for (const [name, pair] of Object.entries(parsed.pairs)) {
    if (typeof pair?.source !== "string" || typeof pair?.twin !== "string") {
      fail(`twins.json pairs.${name} must carry string 'source' and 'twin'`);
    }
  }
  return parsed;
}

/** The X/Y register-variant mnemonic families for register-usage detection. */
const REGISTER_FAMILIES = [
  ["LDX", "LDY"], ["STX", "STY"], ["INX", "INY"], ["DEX", "DEY"],
  ["CPX", "CPY"], ["TAX", "TAY"], ["TXA", "TYA"],
];

/** Count instructions by a key function. */
function countBy(instructions, keyOf) {
  const counts = new Map();
  for (const instruction of instructions) {
    const key = keyOf(instruction);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Total emitted instruction bytes of a stream. */
function streamBytes(instructions) {
  return instructions.reduce((sum, i) => sum + i.bytes.length, 0);
}

/**
 * Classify the divergences between two instruction streams (plus their PRG
 * sizes) into rows, each carrying exactly one of the five categories:
 * instruction selection, layout, data placement, addressing modes,
 * register usage.
 */
export function classifyDivergences(generated, hand, generatedPrgBytes, handPrgBytes) {
  const rows = [];
  const genOps = countBy(generated, (i) => i.opcode);
  const handOps = countBy(hand, (i) => i.opcode);
  const handled = new Set();

  // Opposite-direction imbalances within an X/Y mnemonic family read as a
  // register-allocation difference, not an instruction-selection one.
  for (const [xOp, yOp] of REGISTER_FAMILIES) {
    const dx = (genOps.get(xOp) ?? 0) - (handOps.get(xOp) ?? 0);
    const dy = (genOps.get(yOp) ?? 0) - (handOps.get(yOp) ?? 0);
    if (dx !== 0 && dy !== 0 && Math.sign(dx) !== Math.sign(dy)) {
      rows.push({
        category: "register usage",
        detail:
          `${xOp}/${yOp} split differs: generated ${genOps.get(xOp) ?? 0}/${genOps.get(yOp) ?? 0}, ` +
          `hand-written ${handOps.get(xOp) ?? 0}/${handOps.get(yOp) ?? 0}`,
      });
      handled.add(xOp);
      handled.add(yOp);
    }
  }

  // Remaining per-mnemonic count differences are instruction selection.
  const allOps = new Set([...genOps.keys(), ...handOps.keys()]);
  for (const opcode of [...allOps].sort()) {
    if (handled.has(opcode)) continue;
    const genCount = genOps.get(opcode) ?? 0;
    const handCount = handOps.get(opcode) ?? 0;
    if (genCount !== handCount) {
      rows.push({
        category: "instruction selection",
        detail: `${opcode}: ${genCount} generated vs ${handCount} hand-written`,
      });
    } else {
      // Same mnemonic volume — differing mode mixes are addressing modes.
      const genModes = countBy(generated.filter((i) => i.opcode === opcode), (i) => i.mode);
      const handModes = countBy(hand.filter((i) => i.opcode === opcode), (i) => i.mode);
      const modes = new Set([...genModes.keys(), ...handModes.keys()]);
      for (const mode of [...modes].sort()) {
        if ((genModes.get(mode) ?? 0) !== (handModes.get(mode) ?? 0)) {
          rows.push({
            category: "addressing modes",
            detail:
              `${opcode} ${mode}: ${genModes.get(mode) ?? 0} generated vs ` +
              `${handModes.get(mode) ?? 0} hand-written`,
          });
        }
      }
    }
  }

  // Structural size differences: code stream span → layout; the remainder of
  // the PRG (baked data, headers, padding) → data placement.
  const genCode = streamBytes(generated);
  const handCode = streamBytes(hand);
  if (genCode !== handCode) {
    rows.push({
      category: "layout",
      detail: `code stream is ${genCode} bytes generated vs ${handCode} hand-written`,
    });
  }
  const genData = generatedPrgBytes - genCode;
  const handData = handPrgBytes - handCode;
  if (genData !== handData) {
    rows.push({
      category: "data placement",
      detail: `non-code bytes are ${genData} generated vs ${handData} hand-written`,
    });
  }
  return rows;
}

/** Two-decimal ratio (generated ÷ hand-written) as a number. */
function ratioOf(generated, hand) {
  return Number((generated / hand).toFixed(2));
}

/** Build one pair's generated side into a scratch dir; return its artifacts. */
async function buildGeneratedSide(compiler, sourceDir) {
  const scratch = mkdtempSync(join(tmpdir(), "b65-twin-gen-"));
  for (const file of readdirSync(sourceDir)) {
    if (file.endsWith(".blend") || file.endsWith(".bin")) {
      copyFileSync(join(sourceDir, file), join(scratch, file));
    }
  }
  const outDir = join(scratch, "out");
  const result = await compiler.build({
    platform: "c64",
    cwd: scratch,
    sourceFiles: ["main.blend"],
    outDir,
  });
  if (result.hasErrors || result.binaryPath === undefined) {
    fail(`building '${sourceDir}' failed`);
  }
  return {
    prgBytes: statSync(result.binaryPath).size - PRG_HEADER_BYTES,
    reportPath: result.binaryPath.replace(/\.prg$/, ".report"),
  };
}

/** Assemble a hand-written twin (its own `!to` names the output). */
function assembleTwin(twinPath) {
  const scratch = mkdtempSync(join(tmpdir(), "b65-twin-hand-"));
  const twinDir = dirname(twinPath);
  for (const file of readdirSync(twinDir)) {
    if (file.endsWith(".asm") || file.endsWith(".bin")) {
      copyFileSync(join(twinDir, file), join(scratch, file));
    }
  }
  const source = readFileSync(twinPath, "utf8");
  const toMatch = /^\s*!to\s+"([^"]+)"/m.exec(source);
  const reportPath = join(scratch, "twin.report");
  const argv = ["--cpu", "6510", "--format", "cbm", "--report", reportPath];
  let prgPath;
  if (toMatch !== null) {
    // The twin's own `!to` directive names the output (adding -o would make
    // ACME fall back to its headerless format).
    prgPath = join(scratch, toMatch[1]);
  } else {
    prgPath = join(scratch, "twin.prg");
    argv.push("-o", prgPath);
  }
  argv.push(join(scratch, basename(twinPath)));
  try {
    execFileSync("acme", argv, { cwd: scratch, stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    fail(`ACME failed on twin '${twinPath}':\n${String(error.stderr ?? error.message)}`);
  }
  return { prgBytes: statSync(prgPath).size - PRG_HEADER_BYTES, reportPath };
}

/** Min/max cycle sums of a parsed instruction stream. */
function cycleSums(instructions, cycleRange) {
  let minSum = 0;
  let maxSum = 0;
  for (const instruction of instructions) {
    const range = cycleRange(instruction);
    minSum += range.min;
    maxSum += range.max;
  }
  return { minSum, maxSum };
}

/** Render the markdown scoreboard. */
function renderMarkdown(report) {
  const lines = ["# Twin parity scoreboard", ""];
  lines.push("| Pair | Bytes gen | Bytes hand | Bytes ratio | Cycles max gen | Cycles max hand | Cycles ratio |");
  lines.push("| ---- | --------- | ---------- | ----------- | -------------- | --------------- | ------------ |");
  for (const [name, pair] of Object.entries(report.pairs)) {
    lines.push(
      `| ${name} | ${pair.bytes.generated} | ${pair.bytes.hand} | ${pair.bytes.ratio.toFixed(2)} ` +
        `| ${pair.cycles.generated.maxSum} | ${pair.cycles.hand.maxSum} | ${pair.cycles.ratio.toFixed(2)} |`,
    );
  }
  for (const [name, pair] of Object.entries(report.pairs)) {
    lines.push("", `## ${name} — divergences`, "");
    lines.push("| Category | Detail |");
    lines.push("| -------- | ------ |");
    for (const row of pair.divergences) {
      lines.push(`| ${row.category} | ${row.detail} |`);
    }
  }
  lines.push("", "## unpaired goldens (no twin yet)", "");
  lines.push(report.unpaired.length > 0 ? report.unpaired.join(", ") : "(none)");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  let jsonPath;
  const jsonIndex = args.indexOf("--json");
  if (jsonIndex !== -1) {
    if (args[jsonIndex + 1] === undefined) {
      fail("--json requires a path");
    }
    // Validate the output path BEFORE any other work.
    jsonPath = resolveInsideRepo(args[jsonIndex + 1]);
  }

  const compiler = await loadCompiler();
  const { parseReportFile, cycleRange } = compiler;
  const manifest = loadManifest();

  const goldens = readdirSync(GOLDEN_DIR)
    .filter((file) => file.endsWith(".asm.golden"))
    .map((file) => file.replace(/\.asm\.golden$/, ""));
  const paired = new Set(Object.keys(manifest.pairs));
  const unpaired = goldens.filter((name) => !paired.has(name)).sort();

  const report = { pairs: {}, unpaired };
  for (const [name, pair] of Object.entries(manifest.pairs)) {
    const generatedSide = await buildGeneratedSide(compiler, join(ROOT, pair.source));
    const handSide = assembleTwin(join(ROOT, pair.twin));
    const generated = parseReportFile(readFileSync(generatedSide.reportPath, "utf8"), generatedSide.reportPath);
    const hand = parseReportFile(readFileSync(handSide.reportPath, "utf8"), handSide.reportPath);
    const generatedCycles = cycleSums(generated, cycleRange);
    const handCycles = cycleSums(hand, cycleRange);
    report.pairs[name] = {
      bytes: {
        generated: generatedSide.prgBytes,
        hand: handSide.prgBytes,
        ratio: ratioOf(generatedSide.prgBytes, handSide.prgBytes),
      },
      cycles: {
        generated: generatedCycles,
        hand: handCycles,
        ratio: ratioOf(generatedCycles.maxSum, handCycles.maxSum),
      },
      divergences: classifyDivergences(generated, hand, generatedSide.prgBytes, handSide.prgBytes),
    };
  }

  process.stdout.write(renderMarkdown(report));
  if (jsonPath !== undefined) {
    writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  }
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
