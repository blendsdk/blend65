/**
 * Debug script: Compile spinning-line example and analyze generated assembly.
 *
 * Known issues spotted in assembly output:
 *   1. `CMP $FFFF` instead of `CMP #$04` — NUM_FRAMES const comparison
 *      uses absolute addressing instead of immediate
 *   2. Missing second argument passing — frameIndex byte param to
 *      getSpriteFrame() is never stored before JSR
 *
 * This script compiles at O0 with inline debug and dumps the full assembly
 * for manual analysis.
 */

import { Compiler } from '../packages/compiler/dist/index.js';
import * as fs from 'fs';

const source = fs.readFileSync('examples/spinning-line/main.blend', 'utf-8');

console.log('=== Spinning Line Source (first 10 lines) ===');
const lines = source.split('\n');
lines.slice(0, 10).forEach((line, i) => console.log(`  ${i + 1}: ${line}`));
console.log(`  ... (${lines.length} total lines)`);
console.log();

const compiler = new Compiler();
const result = compiler.compile({
  files: ['examples/spinning-line/main.blend'],
  config: {
    target: 'c64',
    compilerOptions: {
      optimization: 'O0',
      debug: 'inline',
      outputFormat: 'asm',
    },
  },
});

console.log('=== Compilation Result ===');
console.log('Success:', result.success);

if (result.diagnostics && result.diagnostics.length > 0) {
  console.log('\nDiagnostics:');
  for (const d of result.diagnostics) {
    console.log(`  [${d.severity}] ${d.message}`);
    if (d.location) {
      console.log(`    at line ${d.location.line}, col ${d.location.column}`);
    }
  }
}

if (result.output?.assembly) {
  const asm = result.output.assembly;
  console.log('\n=== Full Generated Assembly ===');
  console.log(asm);

  // Highlight the two suspected bugs
  console.log('\n=== BUG ANALYSIS ===');

  // Bug 1: CMP $FFFF — should be CMP #$04 (NUM_FRAMES)
  const cmpLines = asm.split('\n').filter(l => l.includes('CMP $FFFF'));
  if (cmpLines.length > 0) {
    console.log('\n🔴 BUG: CMP $FFFF found (should be CMP #$04 for NUM_FRAMES):');
    cmpLines.forEach(l => console.log(`  ${l.trim()}`));
  } else {
    console.log('\n✅ No CMP $FFFF found');
  }

  // Bug 2: Missing argument passing for getSpriteFrame
  const jsrLines: string[] = [];
  const asmLines = asm.split('\n');
  for (let i = 0; i < asmLines.length; i++) {
    if (asmLines[i].includes('JSR getSpriteFrame')) {
      // Check 5 lines before JSR for argument setup
      const context = asmLines.slice(Math.max(0, i - 5), i + 1);
      jsrLines.push(`  --- Call at line ${i + 1} ---`);
      context.forEach(c => jsrLines.push(`    ${c}`));
    }
  }
  if (jsrLines.length > 0) {
    console.log('\n🔍 getSpriteFrame() call sites (check for frameIndex arg passing):');
    jsrLines.forEach(l => console.log(l));
  }

  // Bug 3: Check the getSpriteFrame function body for how it reads frameIndex
  const funcStart = asmLines.findIndex(l => l.includes('getSpriteFrame:'));
  if (funcStart >= 0) {
    const funcEnd = asmLines.findIndex((l, i) => i > funcStart && l.includes('RTS'));
    const funcBody = asmLines.slice(funcStart, funcEnd + 1);
    console.log('\n🔍 getSpriteFrame() function body:');
    funcBody.forEach(l => console.log(`  ${l}`));
  }

  // Write to file for reference
  fs.mkdirSync('build', { recursive: true });
  fs.writeFileSync('build/spinning-line.asm', asm);
  console.log('\n\nWritten to build/spinning-line.asm');
} else {
  console.log('\nNo assembly output generated!');
}
