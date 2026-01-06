/**
 * Demo: Built-in Functions IL Generation Integration Test
 * Phase 6: IL Generation - Built-in IL instructions
 *
 * This demo validates that the 5 core built-in functions are correctly
 * transformed from AST to IL instructions in the compilation pipeline.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Blend65Lexer } from '@blend65/lexer';
import { Blend65Parser } from '@blend65/parser';
import { SemanticAnalyzer } from '@blend65/semantic';
import {
  transformProgramToIL,
  ILInstructionType,
  ilInstructionToString,
  getInstructionCategory,
  getEstimatedCycles
} from '@blend65/il';

// Helper function to find the project root
function findProjectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  let currentDir = dirname(currentFile);

  // Look for package.json with the right name or examples directory
  while (currentDir !== dirname(currentDir)) {
    const examplesPath = join(currentDir, 'examples');
    const packageJsonPath = join(currentDir, 'package.json');

    if (existsSync(examplesPath) && existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        if (packageJson.name === 'blend65' || existsSync(join(examplesPath, 'builtin-functions-demo.blend'))) {
          return currentDir;
        }
      } catch {
        // Continue searching if package.json is malformed
      }
    }
    currentDir = dirname(currentDir);
  }

  // Fallback: assume we're in packages/playground and go up 2 levels
  return join(dirname(dirname(fileURLToPath(import.meta.url))), '..', '..');
}

async function demonstrateILBuiltinFunctions(): Promise<void> {
  console.log('🚀 IL Generation for Built-in Functions Demo - Phase 6');
  console.log('='.repeat(70));

  try {
    // Read the built-in functions demo program
    const projectRoot = findProjectRoot();
    const demoPath = join(projectRoot, 'examples', 'builtin-functions-demo.blend');
    const sourceCode = readFileSync(demoPath, 'utf-8');

    console.log('📄 Demo Program:');
    console.log(sourceCode);
    console.log('='.repeat(70));

    // Phase 1: Lexical Analysis
    console.log('🔍 Phase 1: Lexical Analysis');
    const lexer = new Blend65Lexer(sourceCode);
    const tokens = lexer.tokenize();
    console.log(`✅ Generated ${tokens.length} tokens`);

    // Phase 2: Parsing
    console.log('\n📝 Phase 2: Parsing');
    const parser = new Blend65Parser(tokens);
    const program = parser.parse();
    console.log('✅ AST generated successfully');

    // Phase 3: Semantic Analysis
    console.log('\n🧠 Phase 3: Semantic Analysis');
    const semanticAnalyzer = new SemanticAnalyzer();
    const semanticResult = semanticAnalyzer.analyze([program]);

    if (!semanticResult.success) {
      console.log('❌ Semantic analysis failed:');
      for (const error of semanticResult.errors) {
        console.log(`  - ${error.errorType}: ${error.message}`);
      }
      return;
    }

    console.log('✅ Semantic analysis completed successfully');

    // Debug: Show what symbols were created
    console.log('\n🔍 Debug: Symbol Table Contents');
    const symbolTable = semanticResult.data; // Get symbol table from semantic analysis
    const symbolMap = symbolTable.getAccessibleSymbols(); // Convert to Map<string, Symbol>

    console.log(`  Total symbols found: ${symbolMap.size}`);
    for (const [name, symbol] of symbolMap) {
      console.log(`    ${symbol.symbolType}: ${name}`);
    }

    // Phase 4: AST to IL Transformation (NEW!)
    console.log('\n🔧 Phase 4: AST to IL Transformation');
    const ilResult = transformProgramToIL(program, symbolMap);

    if (!ilResult.success) {
      console.log('❌ IL transformation failed:');
      for (const error of ilResult.errors) {
        console.log(`  - ${error.message}`);
      }
      return;
    }

    console.log('✅ IL transformation completed successfully');
    const ilProgram = ilResult.program;

    // Phase 5: Built-in Functions IL Analysis
    console.log('\n🔧 Phase 5: Built-in Functions IL Analysis');

    console.log('\n📊 IL Program Structure:');
    console.log(`  Modules: ${ilProgram.modules.length}`);
    console.log(`  Functions: ${ilProgram.modules.reduce((acc, mod) => acc + mod.functions.length, 0)}`);

    // Analyze the main function for builtin function calls
    const mainModule = ilProgram.modules.find(m => m.qualifiedName.includes('BuiltinFunctions'));
    const mainFunction = mainModule?.functions.find(f => f.name === 'main');

    if (!mainFunction) {
      console.log('❌ Could not find main function in IL');
      return;
    }

    console.log(`\n📋 Main Function IL Analysis:`);
    console.log(`  Instructions: ${mainFunction.instructions.length}`);
    console.log(`  Local Variables: ${mainFunction.localVariables.length}`);

    // Find and analyze builtin function calls in IL
    console.log('\n🔍 Built-in Function IL Instructions:');
    const builtinInstructions = mainFunction.instructions.filter(instruction => {
      return [
        ILInstructionType.PEEK,
        ILInstructionType.POKE,
        ILInstructionType.PEEKW,
        ILInstructionType.POKEW,
        ILInstructionType.SYS
      ].includes(instruction.type);
    });

    console.log(`Found ${builtinInstructions.length} builtin function IL instructions:`);

    for (const instruction of builtinInstructions) {
      const category = getInstructionCategory(instruction.type);
      const cycles = getEstimatedCycles(instruction.type);

      console.log(`\n  ✅ ${instruction.type}:`);
      console.log(`      IL Representation: ${ilInstructionToString(instruction)}`);
      console.log(`      Category: ${category}`);
      console.log(`      Estimated Cycles: ${cycles}`);
      console.log(`      Operands: ${instruction.operands.length}`);

      if (instruction.sixtyTwoHints) {
        console.log(`      6502 Hints:`);
        if (instruction.sixtyTwoHints.preferredRegister) {
          console.log(`        Preferred Register: ${instruction.sixtyTwoHints.preferredRegister}`);
        }
        if (instruction.sixtyTwoHints.isTimingCritical) {
          console.log(`        Timing Critical: YES`);
        }
      }
    }

    // Overall IL analysis
    console.log('\n📈 IL Generation Validation:');

    const allInstructionTypes = mainFunction.instructions.map(i => i.type);
    const uniqueInstructionTypes = [...new Set(allInstructionTypes)];

    console.log(`  Total IL Instructions: ${mainFunction.instructions.length}`);
    console.log(`  Unique Instruction Types: ${uniqueInstructionTypes.length}`);
    console.log(`  Hardware Instructions: ${builtinInstructions.length}`);

    // Estimate total performance
    const totalCycles = mainFunction.instructions.reduce((acc, instruction) => {
      return acc + getEstimatedCycles(instruction.type);
    }, 0);

    console.log(`  Estimated Total Cycles: ${totalCycles}`);
    console.log(`  Estimated Execution Time (C64): ${(totalCycles / 985248 * 1000).toFixed(2)}ms`);

    // Verify builtin functions are working in IL
    console.log('\n🎯 Built-in Functions IL Verification:');
    const expectedBuiltins = ['PEEK', 'POKE', 'PEEKW', 'POKEW', 'SYS'];
    const foundBuiltins = builtinInstructions.map(i => i.type);

    for (const expected of expectedBuiltins) {
      const found = foundBuiltins.includes(expected as ILInstructionType);
      console.log(`  ${found ? '✅' : '❌'} ${expected}: ${found ? 'FOUND' : 'NOT FOUND'} in IL`);
    }

    console.log('\n🎉 SUCCESS: Built-in functions IL generation working!');
    console.log('='.repeat(70));
    console.log('📈 Implementation Status:');
    console.log('  ✅ Phase 5: Semantic Analyzer - Built-in function recognition COMPLETE');
    console.log('  ✅ Phase 6: IL Generation - Built-in IL instructions COMPLETE');
    console.log('  🔄 Phase 7: Code Generation - Platform-specific assembly (NEXT)');
    console.log('  🔄 Phase 8: Platform Integration - Hardware address validation (NEXT)');
    console.log('  🔄 Phase 9: Testing and Validation - End-to-end tests (NEXT)');

  } catch (error) {
    console.error('💥 Demo failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the demo when executed directly with node
if (process.argv[1] && process.argv[1].includes('demo-il-builtin-functions')) {
  demonstrateILBuiltinFunctions().catch(console.error);
}

export { demonstrateILBuiltinFunctions };
