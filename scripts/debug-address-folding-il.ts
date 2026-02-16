/**
 * Debug script: Inspect IL and ASM output of spinning-line at O3 after inlining.
 * Looking for LOAD_ADDRESS → SHR_WORD → LO patterns that can be folded
 * into LOAD_ADDRESS_EXPR.
 */

import { Compiler } from '../packages/compiler/dist/index.js';

const compiler = new Compiler();

console.log('=== Compiling spinning-line at O3 ===\n');

const result = compiler.compile({
  files: ['examples/spinning-line/main.blend'],
  config: {
    target: 'c64',
    compilerOptions: {
      optimization: 'O3',
      debug: 'inline',
      outputFormat: 'asm',
    },
  },
});

if (!result.success) {
  console.log('FAILED');
  process.exit(1);
}

// Dump assembly context around LOAD_ADDRESS lines
const asm = (result as any).output?.assembly as string;
const lines = asm.split('\n');

console.log('=== Assembly around LOAD_ADDRESS patterns ===\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('#<__data_') || lines[i].includes('LOAD_ADDRESS')) {
    const start = Math.max(0, i - 3);
    const end = Math.min(lines.length, i + 20);
    console.log(`--- Context at line ${i + 1} ---`);
    for (let j = start; j < end; j++) {
      const marker = j === i ? '>>>' : '   ';
      console.log(`${marker} ${j + 1}: ${lines[j]}`);
    }
    console.log();
  }
}

// Dump IL data (phases.il.data should have the IL functions)
const ilPhase = (result as any).phases?.il;
if (ilPhase?.data) {
  const ilData = ilPhase.data;
  console.log('=== IL Phase Data ===');
  console.log('IL data type:', typeof ilData);
  if (typeof ilData === 'object') {
    console.log('IL data keys:', Object.keys(ilData));
    if (ilData.functions) {
      console.log(`Functions: ${ilData.functions.length}`);
      for (const func of ilData.functions) {
        console.log(`\n  Function: ${func.name} (${func.instructions?.length} instructions)`);
        // Look for LOAD_ADDRESS and SHR_WORD in IL
        const instrs = func.instructions || [];
        for (let i = 0; i < instrs.length; i++) {
          const instr = instrs[i];
          if (instr.opcode === 'LOAD_ADDRESS' || instr.opcode === 'SHR_WORD' || instr.opcode === 'LO') {
            const start = Math.max(0, i - 3);
            const end = Math.min(instrs.length, i + 5);
            console.log(`\n  --- IL context at ${i}: ${instr.opcode} ---`);
            for (let j = start; j < end; j++) {
              const ii = instrs[j];
              const marker = j === i ? '>>>' : '   ';
              const ops = (ii.operands || []).map((op: any) => {
                if (op.slot) return `slot:${op.slot.name}${op.slot.dataLabel ? `[${op.slot.dataLabel}]` : ''}`;
                if (op.value !== undefined) return `imm:${op.value}${op.isWord ? '(word)' : ''}`;
                if (op.name) return `label:${op.name}`;
                return JSON.stringify(op);
              }).join(', ');
              const comment = ii.comment ? ` ; ${ii.comment}` : '';
              console.log(`  ${marker} [${j}] ${ii.opcode} ${ops}${comment}`);
            }
          }
        }
      }
    }
  }
}

// Also check the optimized IL (after optimization)
const optPhase = (result as any).phases?.optimize;
if (optPhase?.data) {
  const optData = optPhase.data;
  console.log('\n=== Optimized IL ===');
  if (typeof optData === 'object') {
    console.log('Optimized IL keys:', Object.keys(optData));
    if (optData.functions) {
      for (const func of optData.functions) {
        const instrs = func.instructions || [];
        for (let i = 0; i < instrs.length; i++) {
          const instr = instrs[i];
          if (instr.opcode === 'LOAD_ADDRESS' || instr.opcode === 'SHR_WORD' || instr.opcode === 'LO') {
            const start = Math.max(0, i - 3);
            const end = Math.min(instrs.length, i + 5);
            console.log(`\n  --- Optimized IL at ${i}: ${instr.opcode} in ${func.name} ---`);
            for (let j = start; j < end; j++) {
              const ii = instrs[j];
              const marker = j === i ? '>>>' : '   ';
              const ops = (ii.operands || []).map((op: any) => {
                if (op.slot) return `slot:${op.slot.name}${op.slot.dataLabel ? `[${op.slot.dataLabel}]` : ''}`;
                if (op.value !== undefined) return `imm:${op.value}${op.isWord ? '(word)' : ''}`;
                if (op.name) return `label:${op.name}`;
                return JSON.stringify(op);
              }).join(', ');
              const comment = ii.comment ? ` ; ${ii.comment}` : '';
              console.log(`  ${marker} [${j}] ${ii.opcode} ${ops}${comment}`);
            }
          }
        }
      }
    }
  }
}

console.log('\n=== Done ===');
