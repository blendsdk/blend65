/**
 * Debug script: Address-Of Operator Diagnosis
 *
 * Compiles the balloon-sprite example and dumps IL instructions for main()
 * at two stages:
 *   1. Pre-optimizer (IL phase output)
 *   2. Post-optimizer (Optimize phase output)
 *
 * Goal: Determine whether LOAD_ADDRESS is emitted by the IL generator
 * and whether the optimizer preserves or removes it.
 *
 * Hypotheses:
 *   A: tryResolveVariable('balloonData') returns undefined → NOP emitted
 *   B: generateAddressOf is never called (AST or dispatch issue)
 *   C: Optimizer replaces/removes LOAD_ADDRESS
 */

import { Compiler } from '../packages/compiler/dist/index.js';

// ============================================================================
// Compile balloon-sprite at O0 (no optimization) to isolate IL generation
// ============================================================================

console.log('=== Compiling balloon-sprite at O0 (no optimization) ===\n');

const compilerO0 = new Compiler();
const resultO0 = compilerO0.compile({
  files: ['examples/balloon-sprite/main.blend'],
  config: {
    target: 'c64',
    compilerOptions: {
      optimization: 'O0',
      outputFormat: 'asm',
    },
  },
});

console.log('Success:', resultO0.success);

if (resultO0.diagnostics.length > 0) {
  console.log('\nDiagnostics:');
  for (const d of resultO0.diagnostics) {
    console.log(`  [${d.severity}] ${d.message}`);
  }
}

// ============================================================================
// Dump IL instructions for main() — pre-optimizer
// ============================================================================

const ilProgram = resultO0.phases.il?.data;
if (ilProgram) {
  console.log('\n=== IL Program (pre-optimizer) ===');
  console.log('Module:', ilProgram.moduleName);
  console.log('Functions:', ilProgram.functions.map(f => f.name).join(', '));
  console.log('Entry point:', ilProgram.entryPoint);

  const mainFunc = ilProgram.functions.find(f => f.name === 'main');
  if (mainFunc) {
    console.log(`\n--- IL for main() [${mainFunc.instructions.length} instructions] ---`);
    for (let i = 0; i < mainFunc.instructions.length; i++) {
      const instr = mainFunc.instructions[i];
      const operandStr = instr.operands.map((op: any) => {
        if (op.kind === 'slot') return `slot:${op.slot?.name}(addr=$${op.slot?.address?.toString(16)},label=${op.slot?.dataLabel || 'none'})`;
        if (op.kind === 'immediate') return `imm:${op.value}`;
        if (op.kind === 'address') return `addr:$${op.address?.toString(16)}`;
        if (op.kind === 'label') return `label:${op.label}`;
        return JSON.stringify(op);
      }).join(', ');

      const comment = instr.comment ? `  ; ${instr.comment}` : '';
      console.log(`  [${i.toString().padStart(3)}] ${instr.opcode}${operandStr ? ' ' + operandStr : ''}${comment}`);
    }

    // Check for LOAD_ADDRESS presence
    const hasLoadAddress = mainFunc.instructions.some(
      (instr: any) => instr.opcode === 'LOAD_ADDRESS'
    );
    console.log(`\n>>> LOAD_ADDRESS present in pre-optimizer IL: ${hasLoadAddress ? 'YES ✅' : 'NO ❌'}`);

    // Check for NOP instructions (might indicate failed address-of)
    const nopCount = mainFunc.instructions.filter(
      (instr: any) => instr.opcode === 'NOP'
    ).length;
    if (nopCount > 0) {
      console.log(`>>> NOP count: ${nopCount} (may indicate generateAddressOf failure)`);
    }
  } else {
    console.log('\n❌ main() function not found in IL program!');
  }
} else {
  console.log('\n❌ No IL program data available!');
}

// ============================================================================
// Dump IL instructions for main() — post-optimizer
// ============================================================================

const optProgram = resultO0.phases.optimize?.data;
if (optProgram) {
  const mainFuncOpt = optProgram.functions.find(f => f.name === 'main');
  if (mainFuncOpt) {
    console.log(`\n--- IL for main() post-optimizer [${mainFuncOpt.instructions.length} instructions] ---`);
    for (let i = 0; i < mainFuncOpt.instructions.length; i++) {
      const instr = mainFuncOpt.instructions[i];
      const operandStr = instr.operands.map((op: any) => {
        if (op.kind === 'slot') return `slot:${op.slot?.name}(addr=$${op.slot?.address?.toString(16)},label=${op.slot?.dataLabel || 'none'})`;
        if (op.kind === 'immediate') return `imm:${op.value}`;
        if (op.kind === 'address') return `addr:$${op.address?.toString(16)}`;
        if (op.kind === 'label') return `label:${op.label}`;
        return JSON.stringify(op);
      }).join(', ');

      const comment = instr.comment ? `  ; ${instr.comment}` : '';
      console.log(`  [${i.toString().padStart(3)}] ${instr.opcode}${operandStr ? ' ' + operandStr : ''}${comment}`);
    }

    const hasLoadAddress = mainFuncOpt.instructions.some(
      (instr: any) => instr.opcode === 'LOAD_ADDRESS'
    );
    console.log(`\n>>> LOAD_ADDRESS present in post-optimizer IL: ${hasLoadAddress ? 'YES ✅' : 'NO ❌'}`);
  }
} else {
  console.log('\n❌ No optimizer output data available!');
}

// ============================================================================
// Also show the generated ASM for the relevant section
// ============================================================================

if (resultO0.output?.assembly) {
  console.log('\n=== Generated ASM (first 80 lines) ===');
  const lines = resultO0.output.assembly.split('\n');
  for (let i = 0; i < Math.min(80, lines.length); i++) {
    console.log(lines[i]);
  }

  // Search for balloonData references in ASM
  console.log('\n=== ASM lines mentioning "balloonData" or "balloon" ===');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('balloon')) {
      console.log(`  [${idx + 1}] ${line}`);
    }
  });
}

// ============================================================================
// Summary
// ============================================================================

console.log('\n=== DIAGNOSIS SUMMARY ===');
const preIL = resultO0.phases.il?.data;
const preMain = preIL?.functions.find(f => f.name === 'main');
if (preMain) {
  const hasLA = preMain.instructions.some((i: any) => i.opcode === 'LOAD_ADDRESS');
  const hasNOP = preMain.instructions.some((i: any) => i.opcode === 'NOP');
  const hasLoadByte = preMain.instructions.some((i: any) =>
    (i.opcode === 'LOAD_BYTE' || i.opcode === 'LOAD_SLOT') &&
    i.comment?.includes('balloonData')
  );

  if (!hasLA && hasNOP) {
    console.log('🔴 Hypothesis A CONFIRMED: LOAD_ADDRESS not emitted, NOP found');
    console.log('   → generateAddressOf() called but tryResolveVariable() returned undefined');
    console.log('   → Fix needed in IL generator variable resolution for @data const arrays');
  } else if (!hasLA && hasLoadByte) {
    console.log('🔴 Hypothesis B CONFIRMED: generateAddressOf never called');
    console.log('   → LOAD_BYTE/LOAD_SLOT emitted instead of LOAD_ADDRESS');
    console.log('   → AST dispatch or semantic transform issue');
  } else if (hasLA) {
    console.log('🟢 LOAD_ADDRESS is emitted in IL');
    const postMain = optProgram?.functions.find(f => f.name === 'main');
    const postHasLA = postMain?.instructions.some((i: any) => i.opcode === 'LOAD_ADDRESS');
    if (!postHasLA) {
      console.log('🔴 Hypothesis C CONFIRMED: Optimizer removes LOAD_ADDRESS');
      console.log('   → Fix needed in optimizer passes');
    } else {
      console.log('🟢 LOAD_ADDRESS survives optimization');
      console.log('   → Bug may be in codegen (check genLoadAddress)');
    }
  } else {
    console.log('🔴 Unknown issue — LOAD_ADDRESS not found and no clear pattern');
  }
}
