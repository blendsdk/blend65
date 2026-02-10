/**
 * Debug script to compile border-cycle at O0 and O3,
 * dumping IL and assembly for comparison.
 *
 * Purpose: Investigate Bugs 4-6 (assembly correctness)
 * - Bug 4: `color += 1` missing from assembly
 * - Bug 5: `color = 0` stores wrong value
 * - Bug 6: Inlined loop counters don't re-init
 */

import { Compiler } from '../packages/compiler/dist/index.js';
import type { ILInstruction } from '../packages/compiler/dist/il/instruction.js';
import type { ILProgram, ILFunction } from '../packages/compiler/dist/il/structures.js';
import type { ILOperand } from '../packages/compiler/dist/il/operands.js';
import type { Blend65Config } from '../packages/compiler/dist/config/types.js';
import * as fs from 'fs';

// ============================================================================
// Helpers
// ============================================================================

/** Format a single IL operand for display */
function formatOperand(op: ILOperand): string {
  switch (op.kind) {
    case 'slot':
      return `slot(${op.slot.name}@$${op.slot.address.toString(16).padStart(2, '0')})`;
    case 'immediate':
      return op.isWord ? `#$${op.value.toString(16).padStart(4, '0')}` : `#$${op.value.toString(16).padStart(2, '0')}`;
    case 'label':
      return `@${op.name}`;
    case 'function':
      return `fn:${op.name}`;
    case 'address':
      const idx = op.indexRegister ? `,${op.indexRegister}` : '';
      return `addr($${op.address.toString(16).padStart(4, '0')}${idx})`;
    case 'asm_raw':
      return `asm(${op.mnemonic} ${op.addressingMode})`;
    default:
      return '?';
  }
}

/** Format a single IL instruction for display */
function formatInstruction(instr: ILInstruction, idx: number): string {
  const ops = instr.operands.map(formatOperand).join(', ');
  const comment = instr.comment ? `  ; ${instr.comment}` : '';
  const vol = instr.isVolatile ? ' [volatile]' : '';
  return `  ${String(idx).padStart(4, ' ')}: ${instr.opcode.padEnd(16)} ${ops}${vol}${comment}`;
}

/** Dump IL for a function */
function dumpILFunction(func: ILFunction): string {
  const lines: string[] = [];
  lines.push(`\n=== IL Function: ${func.name} (exported=${func.isExported}) ===`);
  lines.push(`  Frame slots: ${func.frame.slots.map(s => `${s.name}@$${s.address.toString(16)}`).join(', ')}`);
  lines.push(`  Loops: ${func.loops.length} (maxDepth=${func.maxLoopDepth})`);
  lines.push(`  Instructions: ${func.instructions.length}`);
  lines.push('');
  func.instructions.forEach((instr, i) => {
    lines.push(formatInstruction(instr, i));
  });
  return lines.join('\n');
}

/** Dump the full IL program */
function dumpILProgram(program: ILProgram): string {
  const lines: string[] = [];
  lines.push(`\nIL Program: ${program.moduleName}`);
  lines.push(`  Functions: ${program.functions.length}`);
  lines.push(`  Total instructions: ${program.instructionCount}`);
  lines.push(`  Total cycles: ${program.totalEstimatedCycles}`);

  if (program.globalInit.length > 0) {
    lines.push('\n=== Global Init ===');
    program.globalInit.forEach((instr, i) => {
      lines.push(formatInstruction(instr, i));
    });
  }

  for (const func of program.functions) {
    lines.push(dumpILFunction(func));
  }

  return lines.join('\n');
}

// ============================================================================
// Compilation
// ============================================================================

function compileAtLevel(level: string): { il: ILProgram | null; assembly: string | null; diagnostics: string[] } {
  const config: Blend65Config = {
    target: 'c64',
    compilerOptions: {
      target: 'c64',
      optimization: level as 'O0' | 'O1' | 'O2' | 'O3',
      outputFormat: 'asm',
    },
  };

  const compiler = new Compiler();

  // First get IL (stop after optimize)
  const ilResult = compiler.compile({
    files: ['examples/border-cycle/main.blend'],
    config,
    stopAfterPhase: 'optimize',
  });

  // Then get full assembly
  const fullResult = compiler.compile({
    files: ['examples/border-cycle/main.blend'],
    config,
  });

  const diagnostics = fullResult.diagnostics.map(d => `[${d.severity}] ${d.message}`);

  return {
    il: ilResult.phases.optimize?.data ?? ilResult.phases.il?.data ?? null,
    assembly: fullResult.output?.assembly ?? null,
    diagnostics,
  };
}

// ============================================================================
// Main
// ============================================================================

console.log('=== Border Cycle Debug: O0 vs O3 ===\n');

const source = fs.readFileSync('examples/border-cycle/main.blend', 'utf-8');
console.log('--- Source ---');
console.log(source);

// Compile at O0
console.log('\n\n' + '='.repeat(80));
console.log('  OPTIMIZATION LEVEL: O0 (no optimization)');
console.log('='.repeat(80));

const o0 = compileAtLevel('O0');
if (o0.diagnostics.length > 0) {
  console.log('\nDiagnostics:');
  o0.diagnostics.forEach(d => console.log(`  ${d}`));
}
if (o0.il) {
  console.log(dumpILProgram(o0.il));
}
if (o0.assembly) {
  console.log('\n--- Assembly (O0) ---');
  console.log(o0.assembly);
} else {
  console.log('\nNo assembly output!');
}

// Compile at O3
console.log('\n\n' + '='.repeat(80));
console.log('  OPTIMIZATION LEVEL: O3 (aggressive optimization)');
console.log('='.repeat(80));

const o3 = compileAtLevel('O3');
if (o3.diagnostics.length > 0) {
  console.log('\nDiagnostics:');
  o3.diagnostics.forEach(d => console.log(`  ${d}`));
}
if (o3.il) {
  console.log(dumpILProgram(o3.il));
}
if (o3.assembly) {
  console.log('\n--- Assembly (O3) ---');
  console.log(o3.assembly);
} else {
  console.log('\nNo assembly output!');
}

// ============================================================================
// Analysis: Look for Bug 4, 5, 6 patterns
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('  BUG ANALYSIS');
console.log('='.repeat(80));

// Bug 4: Look for INC or ADC in main function IL
if (o0.il) {
  const mainFunc = o0.il.functions.find(f => f.name === 'main');
  if (mainFunc) {
    const hasIncrement = mainFunc.instructions.some(
      i => i.opcode === 'INC_BYTE' || i.opcode === 'ADD_IMM' || i.opcode === 'ADD_BYTE'
    );
    console.log(`\nBug 4: O0 main has increment instruction: ${hasIncrement}`);
    const incrementInstrs = mainFunc.instructions.filter(
      i => i.opcode === 'INC_BYTE' || i.opcode === 'ADD_IMM' || i.opcode === 'ADD_BYTE'
    );
    incrementInstrs.forEach(i => console.log(`  Found: ${i.opcode} ${i.operands.map(formatOperand).join(', ')}`));
  }
}

if (o3.il) {
  const mainFunc = o3.il.functions.find(f => f.name === 'main');
  if (mainFunc) {
    const hasIncrement = mainFunc.instructions.some(
      i => i.opcode === 'INC_BYTE' || i.opcode === 'ADD_IMM' || i.opcode === 'ADD_BYTE'
    );
    console.log(`Bug 4: O3 main has increment instruction: ${hasIncrement}`);
    const incrementInstrs = mainFunc.instructions.filter(
      i => i.opcode === 'INC_BYTE' || i.opcode === 'ADD_IMM' || i.opcode === 'ADD_BYTE'
    );
    incrementInstrs.forEach(i => console.log(`  Found: ${i.opcode} ${i.operands.map(formatOperand).join(', ')}`));
  }
}

// Bug 5: Look for LOAD_IMM #0 followed by STORE in assembly
if (o0.assembly) {
  const hasLdaZeroSta = /LDA\s+#\$00\s*\n\s*STA/.test(o0.assembly);
  console.log(`\nBug 5: O0 has LDA #$00 + STA pattern: ${hasLdaZeroSta}`);
}
if (o3.assembly) {
  const hasLdaZeroSta = /LDA\s+#\$00\s*\n\s*STA/.test(o3.assembly);
  console.log(`Bug 5: O3 has LDA #$00 + STA pattern: ${hasLdaZeroSta}`);
  // Check for bare STA without LDA #$00
  const lines = o3.assembly.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('STA') && i > 0) {
      const prev = lines[i - 1].trim();
      if (!prev.startsWith('LDA') && !prev.startsWith('TXA') && !prev.startsWith('TYA') && !prev.startsWith('PLA')) {
        // STA without preceding load - might be bug 5
        // But only report if it looks like color = 0 context
      }
    }
  }
}

// Bug 6: Check if delay/inlined functions have proper init
if (o3.il) {
  const mainFunc = o3.il.functions.find(f => f.name === 'main');
  if (mainFunc) {
    // After inlining, check if there are LOAD_IMM #0 before each loop counter STORE
    console.log(`\nBug 6: O3 main function instructions count: ${mainFunc.instructions.length}`);
    const hasDelay = o3.il.functions.some(f => f.name === 'delay');
    console.log(`Bug 6: O3 still has delay function: ${hasDelay}`);
  }
}

// Write outputs to files for easier analysis
fs.mkdirSync('build', { recursive: true });
if (o0.assembly) fs.writeFileSync('build/border-cycle-o0.asm', o0.assembly);
if (o3.assembly) fs.writeFileSync('build/border-cycle-o3.asm', o3.assembly);
if (o0.il) fs.writeFileSync('build/border-cycle-o0.il', dumpILProgram(o0.il));
if (o3.il) fs.writeFileSync('build/border-cycle-o3.il', dumpILProgram(o3.il));

console.log('\nOutput files written to build/');
console.log('  build/border-cycle-o0.asm');
console.log('  build/border-cycle-o3.asm');
console.log('  build/border-cycle-o0.il');
console.log('  build/border-cycle-o3.il');
