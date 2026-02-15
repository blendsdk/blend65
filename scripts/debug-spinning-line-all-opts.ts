/**
 * Debug script: Compile spinning-line at ALL optimization levels.
 *
 * Compiles examples/spinning-line/main.blend at O0, O1, O2, O3, Os, Oz
 * and saves each ASM output to build/spinning-line-O{level}.asm
 *
 * Reports compilation success/failure for each level and any diagnostics.
 */

import { Compiler } from '../packages/compiler/dist/index.js';
import * as fs from 'fs';

const LEVELS = ['O0', 'O1', 'O2', 'O3', 'Os', 'Oz'] as const;
const SOURCE_FILE = 'examples/spinning-line/main.blend';
const OUTPUT_DIR = 'build';

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

console.log('=== Spinning Line — All Optimization Levels ===\n');
console.log(`Source: ${SOURCE_FILE}\n`);

const results: { level: string; success: boolean; error?: string; lines?: number }[] = [];

for (const level of LEVELS) {
  console.log(`--- Compiling at ${level} ---`);

  try {
    const compiler = new Compiler();
    const result = compiler.compile({
      files: [SOURCE_FILE],
      config: {
        target: 'c64',
        compilerOptions: {
          optimization: level,
          debug: 'inline',
          outputFormat: 'asm',
        },
      },
    });

    if (result.diagnostics && result.diagnostics.length > 0) {
      console.log(`  Diagnostics (${result.diagnostics.length}):`);
      for (const d of result.diagnostics) {
        console.log(`    [${d.severity}] ${d.message}`);
      }
    }

    if (result.success && result.output?.assembly) {
      const asm = result.output.assembly;
      const outFile = `${OUTPUT_DIR}/spinning-line-${level}.asm`;
      fs.writeFileSync(outFile, asm);
      const lineCount = asm.split('\n').length;
      console.log(`  ✅ Success → ${outFile} (${lineCount} lines)`);
      results.push({ level, success: true, lines: lineCount });
    } else {
      console.log(`  ❌ Failed — no assembly output`);
      results.push({ level, success: false, error: 'No assembly output' });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ CRASH: ${msg}`);
    if (err instanceof Error && err.stack) {
      // Show first 3 lines of stack trace
      const stackLines = err.stack.split('\n').slice(0, 4);
      stackLines.forEach(l => console.log(`    ${l}`));
    }
    results.push({ level, success: false, error: msg });
  }

  console.log();
}

// Summary
console.log('=== SUMMARY ===\n');
console.log('Level | Status  | Lines | Notes');
console.log('------|---------|-------|------');
for (const r of results) {
  const status = r.success ? '✅ OK' : '❌ FAIL';
  const lines = r.lines !== undefined ? String(r.lines) : '-';
  const notes = r.error || '';
  console.log(`${r.level.padEnd(6)}| ${status.padEnd(8)}| ${lines.padEnd(6)}| ${notes}`);
}

console.log(`\nOutput files saved to ${OUTPUT_DIR}/spinning-line-O*.asm`);
