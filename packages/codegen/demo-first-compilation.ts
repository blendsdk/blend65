/**
 * 🎉 HISTORIC DEMO: First Compiled Blend65 Program
 * This demonstrates the milestone achievement of Task 3.1 -
 * the first successful compilation from Blend65 IL to 6502 assembly!
 */

import {
  createILProgram,
  createILModule,
  createILFunction,
  ILInstructionType,
  createILInstruction,
  createILConstant
} from '@blend65/il';
import { SimpleCodeGenerator } from './src/simple-code-generator.js';

async function demonstrateFirstCompilation() {
  console.log('🎉 HISTORIC MOMENT: First Blend65 Program Compilation');
  console.log('='.repeat(60));

  // Create a simple "Hello 6502" program
  const program = createILProgram('hello_6502');

  // Add a global variable
  program.globalData = [
    {
      name: 'counter',
      qualifiedName: ['Main'],
      type: { name: 'byte' } as any,
      storageClass: 'data',
      initialValue: createILConstant({ name: 'byte' } as any, 0),
      isExported: false
    },
    {
      name: 'max_count',
      qualifiedName: ['Main'],
      type: { name: 'byte' } as any,
      storageClass: 'const',
      initialValue: createILConstant({ name: 'byte' } as any, 255),
      isExported: false
    }
  ];

  // Create a main function that does some basic operations
  const mainFunction = createILFunction(
    'main',
    ['Main', 'main'],
    { name: 'void' } as any,
    { line: 1, column: 1, offset: 0 }
  );

  // Add instructions: Load 42, add 13, store result
  mainFunction.instructions = [
    // Load initial value
    createILInstruction(
      ILInstructionType.LOAD_IMMEDIATE,
      [createILConstant({ name: 'byte' } as any, 42)],
      1,
      { sourceLocation: { line: 1, column: 1, offset: 0 } }
    ),

    // Add 13 to get 55
    createILInstruction(
      ILInstructionType.ADD,
      [
        createILConstant({ name: 'byte' } as any, 42),
        createILConstant({ name: 'byte' } as any, 13)
      ],
      2,
      { sourceLocation: { line: 2, column: 1, offset: 20 } }
    ),

    // Subtract 5 to get 50
    createILInstruction(
      ILInstructionType.SUB,
      [
        createILConstant({ name: 'byte' } as any, 55),
        createILConstant({ name: 'byte' } as any, 5)
      ],
      3,
      { sourceLocation: { line: 3, column: 1, offset: 40 } }
    ),

    // Return
    createILInstruction(
      ILInstructionType.RETURN,
      [],
      4,
      { sourceLocation: { line: 4, column: 1, offset: 60 } }
    )
  ];

  // Create module and add function
  const mainModule = createILModule(['Main']);
  mainModule.functions = [mainFunction];

  // Add module to program
  program.modules = [mainModule];
  program.imports = [];
  program.exports = [];

  // Generate code for multiple platforms
  const platforms = ['c64', 'vic20', 'c128'];

  for (const platform of platforms) {
    console.log(`\n📱 Compiling for ${platform.toUpperCase()}:`);
    console.log('-'.repeat(40));

    const generator = new SimpleCodeGenerator({
      target: platform,
      debug: true,
      autoRun: true
    });

    const result = await generator.generate(program);

    console.log(`✅ Compilation successful!`);
    console.log(`   Instructions: ${result.stats.instructionCount}`);
    console.log(`   Code size: ${result.stats.codeSize} bytes`);
    console.log(`   Compile time: ${result.stats.compilationTime}ms`);
    console.log('\n📄 Generated Assembly:');
    console.log(result.assembly);
    console.log('\n' + '='.repeat(60));
  }
}

// Run the demo
demonstrateFirstCompilation().catch(console.error);
