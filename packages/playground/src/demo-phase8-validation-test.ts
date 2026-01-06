/**
 * Demo: Phase 8 Validation and Optimization Test
 * Simple focused test to validate Phase 8 features are working correctly
 */

import { SimpleCodeGenerator } from '@blend65/codegen';
import {
  createILProgram,
  createILModule,
  createILFunction,
  createILConstant,
  createILVariable,
  ILInstructionFactory
} from '@blend65/il';

async function testPhase8Features() {
  console.log('🔍 Phase 8 Feature Validation Test');
  console.log('='.repeat(50));

  // Create simple test program
  const program = createILProgram('ValidationTest');
  const module = createILModule(['Test']);
  const mainFunction = createILFunction(
    'test',
    ['Test', 'test'],
    { kind: 'primitive', name: 'void' },
    { line: 1, column: 1, offset: 0 }
  );

  // Zero page address (should be optimized)
  const zeroPageAddr = createILConstant({ kind: 'primitive', name: 'word' }, 0x02, 'hexadecimal');

  // C64 hardware register (should trigger hardware validation)
  const borderReg = createILConstant({ kind: 'primitive', name: 'word' }, 0xD020, 'hexadecimal');

  // Simple values
  const blueColor = createILConstant({ kind: 'primitive', name: 'byte' }, 6);
  const tempVar = createILVariable('temp', { kind: 'primitive', name: 'byte' });

  // Simple test sequence
  mainFunction.instructions = [
    // Zero page access (should be optimized)
    ILInstructionFactory.poke(zeroPageAddr, blueColor),
    ILInstructionFactory.peek(tempVar, zeroPageAddr),

    // Hardware register access (should be validated)
    ILInstructionFactory.poke(borderReg, blueColor),
    ILInstructionFactory.peek(tempVar, borderReg),

    ILInstructionFactory.return()
  ];

  module.functions.push(mainFunction);
  program.modules.push(module);

  console.log('Testing C64 with all Phase 8 features enabled...\n');

  const generator = new SimpleCodeGenerator({
    target: 'c64',
    debug: true,
    autoRun: true,
    optimize: true,
    validateAddresses: true
  } as any);

  try {
    const result = await generator.generate(program);

    console.log('✅ Generation successful!');
    console.log(`📊 Stats: ${result.stats.instructionCount} instructions`);

    const stats = result.stats as any;
    if (stats.optimizations !== undefined) {
      console.log(`🚀 Optimizations applied: ${stats.optimizations}`);
    }

    if (stats.validationWarnings !== undefined) {
      console.log(`⚠️  Validation warnings: ${stats.validationWarnings.length}`);
      if (stats.validationWarnings.length > 0) {
        stats.validationWarnings.forEach((w: any) => console.log(`   - ${w.message}`));
      }
    }

    console.log('\n📝 Generated Assembly:');
    console.log(result.assembly);

    // Analyze specific features
    const lines = result.assembly.split('\n');
    const zeroPageOps = lines.filter(line =>
      (line.includes('LDA $02') || line.includes('STA $02')) && !line.includes('$020')
    );
    const hardwareOps = lines.filter(line => line.includes('$D020'));
    const optimizationComments = lines.filter(line => line.includes('(optimized)'));
    const hardwareComments = lines.filter(line => line.includes('Hardware I/O'));

    console.log('\n🔍 Feature Analysis:');
    console.log(`   Zero page operations: ${zeroPageOps.length}`);
    console.log(`   Hardware register ops: ${hardwareOps.length}`);
    console.log(`   Optimization markers: ${optimizationComments.length}`);
    console.log(`   Hardware comments: ${hardwareComments.length}`);

    if (zeroPageOps.length > 0) {
      console.log('\n🎯 Zero Page Operations:');
      zeroPageOps.forEach(line => console.log(`   ${line.trim()}`));
    }

    if (hardwareOps.length > 0) {
      console.log('\n🔧 Hardware Register Operations:');
      hardwareOps.forEach(line => console.log(`   ${line.trim()}`));
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPhase8Features().catch(console.error);
