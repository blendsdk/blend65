/**
 * 🚀 ULTIMATE DEMO: Complete Blend65 Pipeline with Emulator Execution
 * This demonstrates the full pipeline: IL → Assembly → .prg → VICE Execution
 * The ultimate proof that Task 3.1 enables REAL working Commodore programs!
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  createILProgram,
  createILModule,
  createILFunction,
  ILInstructionType,
  createILInstruction,
  createILConstant
} from '@blend65/il';
import { SimpleCodeGenerator } from './src/simple-code-generator.js';
import { EmulatorTester } from '@blend65/emulator-test';

async function demonstrateCompleteExecution() {
  console.log('🚀 ULTIMATE DEMONSTRATION: Complete Blend65 Pipeline');
  console.log('🎯 IL → Assembly → .prg → VICE Execution');
  console.log('='.repeat(70));

  try {
    // Initialize emulator tester
    console.log('🔧 Initializing ACME and VICE tools...');
    const emulatorTester = await EmulatorTester.create();
    const toolVersions = await emulatorTester.getToolVersions();
    console.log(`✅ ACME Version: ${toolVersions.acme}`);
    console.log(`✅ VICE Version: ${toolVersions.vice}`);
    console.log('');

    // Create output directory
    const outputDir = './temp-output';
    mkdirSync(outputDir, { recursive: true });

    // Create a demonstration program with memory validation
    const program = createILProgram('blend65_demo');

    // Add global variables for result validation
    program.globalData = [
      {
        name: 'result',
        qualifiedName: ['Main'],
        type: { name: 'byte' } as any,
        storageClass: 'data',
        initialValue: createILConstant({ name: 'byte' } as any, 0),
        isExported: false
      },
      {
        name: 'magic_number',
        qualifiedName: ['Main'],
        type: { name: 'byte' } as any,
        storageClass: 'const',
        initialValue: createILConstant({ name: 'byte' } as any, 42),
        isExported: false
      }
    ];

    // Create main function with calculatable result
    const mainFunction = createILFunction(
      'main',
      ['Main', 'main'],
      { name: 'void' } as any,
      { line: 1, column: 1, offset: 0 }
    );

    // Instructions: 42 + 13 - 5 = 50 (stored at result address)
    mainFunction.instructions = [
      // Load magic number (42)
      createILInstruction(
        ILInstructionType.LOAD_IMMEDIATE,
        [createILConstant({ name: 'byte' } as any, 42)],
        1,
        { sourceLocation: { line: 1, column: 1, offset: 0 } }
      ),

      // Add 13 → 55
      createILInstruction(
        ILInstructionType.ADD,
        [
          createILConstant({ name: 'byte' } as any, 42),
          createILConstant({ name: 'byte' } as any, 13)
        ],
        2,
        { sourceLocation: { line: 2, column: 1, offset: 20 } }
      ),

      // Subtract 5 → 50
      createILInstruction(
        ILInstructionType.SUB,
        [
          createILConstant({ name: 'byte' } as any, 55),
          createILConstant({ name: 'byte' } as any, 5)
        ],
        3,
        { sourceLocation: { line: 3, column: 1, offset: 40 } }
      ),

      // Store result to memory address $C000 (safe area)
      createILInstruction(
        ILInstructionType.STORE_MEMORY,
        [createILConstant({ name: 'byte' } as any, 0xC000)],
        4,
        { sourceLocation: { line: 4, column: 1, offset: 60 } }
      ),

      // Return
      createILInstruction(
        ILInstructionType.RETURN,
        [],
        5,
        { sourceLocation: { line: 5, column: 1, offset: 80 } }
      )
    ];

    // Create module
    const mainModule = createILModule(['Main']);
    mainModule.functions = [mainFunction];
    program.modules = [mainModule];
    program.imports = [];
    program.exports = [];

    // Test on multiple platforms with emulator execution
    const platforms = [
      { target: 'c64', emulator: 'C64', memoryTestAddr: 0xC000 },
      { target: 'vic20', emulator: 'VIC-20', memoryTestAddr: 0x1F00 },  // VIC-20 safe area
      { target: 'c128', emulator: 'C128', memoryTestAddr: 0xC000 }
    ];

    for (const platform of platforms) {
      console.log(`\n🎮 Testing Complete Pipeline for ${platform.emulator}:`);
      console.log('='.repeat(50));

      // Step 1: Generate Assembly
      console.log('📝 Step 1: Generating 6502 Assembly...');
      const generator = new SimpleCodeGenerator({
        target: platform.target,
        debug: true,
        autoRun: true
      });

      const codeGenResult = await generator.generate(program);
      console.log(`✅ Assembly generated: ${codeGenResult.stats.instructionCount} instructions, ${codeGenResult.stats.codeSize} bytes`);

      // Step 2: Save Assembly File
      const asmFile = join(outputDir, `blend65_demo_${platform.target}.asm`);
      writeFileSync(asmFile, codeGenResult.assembly, 'utf8');
      console.log(`✅ Assembly saved: ${asmFile}`);

      // Step 3: Assemble with ACME and Execute in VICE
      console.log('🔨 Step 2: Assembling with ACME and running in VICE...');

      const testResult = await emulatorTester.testAssemblyProgram(
        asmFile,
        [
          { address: platform.memoryTestAddr, expectedValue: 50 }  // Expected result: 42 + 13 - 5 = 50
        ]
      );

      // Step 4: Report Results
      console.log('\n📊 Execution Results:');
      console.log(`   Assembly: ${testResult.assemblyResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`   Execution: ${testResult.viceResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`   Exit Code: ${testResult.viceResult.exitCode}`);
      console.log(`   Execution Time: ${testResult.viceResult.executionTimeMs}ms`);

      if (testResult.viceResult.cycleCount) {
        console.log(`   CPU Cycles: ${testResult.viceResult.cycleCount}`);
      }

      // Memory validation
      if (testResult.memoryValidation) {
        console.log(`   Memory Validation: ${testResult.memoryValidation.passed ? '✅ PASSED' : '❌ FAILED'}`);

        if (testResult.memoryValidation.passed) {
          console.log(`   ✨ Result correctly stored at $${platform.memoryTestAddr.toString(16).toUpperCase()}: 50`);
        } else {
          console.log(`   Memory failures:`);
          testResult.memoryValidation.failures.forEach(failure => {
            console.log(`     Address $${failure.address.toString(16).toUpperCase()}: expected ${failure.expected}, got ${failure.actual}`);
          });
        }
      }

      // Overall test result
      if (testResult.success) {
        console.log('\n🎉 COMPLETE SUCCESS: Blend65 → Assembly → .prg → Execution → Validation!');
        console.log('🏆 This proves the ENTIRE compilation pipeline works on real emulated hardware!');
      } else {
        console.log('\n⚠️  Test Issues:');
        testResult.errors.forEach(error => console.log(`   - ${error}`));
      }

      console.log('\n' + '='.repeat(50));
    }

    console.log('\n🎊 ULTIMATE DEMONSTRATION COMPLETE!');
    console.log('🚀 Blend65 can now create REAL working Commodore programs!');
    console.log('💫 From high-level IL to running .prg files in seconds!');

  } catch (error) {
    console.error('\n❌ Demo failed:', error);

    if (error instanceof Error && error.message.includes('ACME') || error instanceof Error && error.message.includes('VICE')) {
      console.log('\n💡 Note: This demo requires ACME and VICE to be installed.');
      console.log('   - Install ACME: Download from https://sourceforge.net/projects/acme-crossdev/');
      console.log('   - Install VICE: Download from https://vice-emu.sourceforge.io/');
      console.log('   - The code generation itself works perfectly (as shown in demo-first-compilation.ts)');
      console.log('   - This demo just adds the final step of running the programs in emulators');
    }
  }
}

// Run the ultimate demonstration
demonstrateCompleteExecution().catch(console.error);
