/**
 * Debug script to identify which compiler phase causes for-loop hang
 * 
 * This script tests IL generation WITH and WITHOUT SSA to isolate the hang.
 * 
 * Run with: npx tsx scripts/debug-for-loop-hang.ts
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';
import { ILGenerator } from '../packages/compiler/dist/il/generator/generator.js';

const source = `
@zp let i: byte;
@zp let j: byte;
function test(): void {
  for (i = 0 to 9) {
    for (j = 0 to 9) {
      nop();
    }
  }
}
`;

console.log('=== For-Loop Hang Diagnostic (Detailed) ===\n');
console.log('Source code:');
console.log(source);
console.log('\n--- Testing pipeline ---\n');

// Step 1: Parse
console.log('1. Parsing...');
const lexer = new Lexer(source, 'test.blend');
const tokens = lexer.tokenize();
const parser = new Parser(tokens, source, 'test.blend');
const program = parser.parse();
console.log(`   ✓ Parse complete: ${program.getDeclarations().length} declarations`);

// Step 2: Semantic Analysis
console.log('2. Semantic analysis...');
const analyzer = new SemanticAnalyzer();
const semanticResult = analyzer.analyze(program);
const semanticErrors = semanticResult.diagnostics?.filter(d => d.severity === 'error') || [];
console.log(`   ✓ Semantic complete: ${semanticErrors.length} errors`);

if (semanticErrors.length > 0) {
  console.log('   Errors:', semanticErrors.map(e => e.message).join(', '));
  process.exit(1);
}

// Step 3: IL Generation WITHOUT SSA
console.log('3. IL generation (SSA DISABLED)...');
const generatorNoSSA = new ILGenerator(semanticResult.symbolTable, null, { 
  enableSSA: false 
});
const ilResultNoSSA = generatorNoSSA.generateModule(program);
console.log(`   ✓ IL complete (no SSA): ${ilResultNoSSA.success ? 'success' : 'failed'}`);

if (ilResultNoSSA.module) {
  const funcNames = ilResultNoSSA.module.getFunctionNames();
  console.log(`   Functions: ${funcNames.join(', ')}`);
  
  for (const funcName of funcNames) {
    const func = ilResultNoSSA.module.getFunction(funcName);
    if (func) {
      console.log(`   - ${funcName}: ${func.getBlockCount()} blocks, ${func.getInstructionCount()} instructions`);
    }
  }
}

// Step 4: Test computeDominators manually
console.log('4. Testing computeDominators on test function...');
const testFunc = ilResultNoSSA.module?.getFunction('test');
if (testFunc) {
  console.log('   Getting blocks in RPO...');
  const blocks = testFunc.getBlocksInReversePostorder();
  console.log(`   ✓ RPO: ${blocks.length} blocks`);
  console.log(`   Block order: ${blocks.map(b => b.label).join(' -> ')}`);
  
  console.log('   Computing dominators...');
  const idom = testFunc.computeDominators();
  console.log(`   ✓ Dominators computed: ${idom.size} entries`);
  for (const [blockId, domId] of idom) {
    const block = testFunc.getBlock(blockId);
    const dom = domId >= 0 ? testFunc.getBlock(domId) : null;
    console.log(`     ${block?.label || blockId} -> idom: ${dom?.label || domId}`);
  }
}

// Step 5: IL Generation WITH SSA
console.log('5. IL generation (SSA ENABLED)...');
const generatorSSA = new ILGenerator(semanticResult.symbolTable, null, { 
  enableSSA: true,
  verbose: true
});
const ilResultSSA = generatorSSA.generateModule(program);
console.log(`   ✓ IL complete (with SSA): ${ilResultSSA.success ? 'success' : 'failed'}`);

console.log('\n=== All steps completed successfully! ===');