/**
 * End-to-End Pipeline Validation Test
 * Tests the complete Blend65 compilation pipeline on real source code
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Import all pipeline components
import { Blend65Lexer } from './packages/lexer/src/index.js';
import { Blend65Parser } from './packages/parser/src/index.js';
import { SemanticAnalyzer } from './packages/semantic/src/index.js';
import {
  ASTToILTransformer,
  ILOptimizationFramework,
  createDefaultPatternRegistry,
} from './packages/il/src/index.js';

/**
 * Test complete pipeline on v0.2 game example
 */
async function testCompletePipeline() {
  console.log('🚀 Testing Complete Blend65 Pipeline...\n');

  try {
    // Step 1: Load real Blend65 source code
    console.log('📁 Loading v0.2 game example...');
    const sourceCode = readFileSync(
      join(process.cwd(), 'examples/v02-complete-game-example.blend'),
      'utf8'
    );
    console.log(`   Source: ${sourceCode.split('\n').length} lines loaded\n`);

    // Step 2: Lexical analysis
    console.log('🔤 Step 1: Lexical Analysis...');
    const lexer = new Blend65Lexer(sourceCode);
    const tokens = lexer.tokenize();

    if (!tokens.success) {
      throw new Error(`Lexer failed: ${tokens.errors.map(e => e.message).join(', ')}`);
    }

    console.log(`   ✅ ${tokens.data.length} tokens generated`);
    console.log(`   📊 Keywords: ${tokens.data.filter(t => t.type === 'KEYWORD').length}`);
    console.log(`   📊 Identifiers: ${tokens.data.filter(t => t.type === 'IDENTIFIER').length}`);
    console.log(
      `   📊 Literals: ${tokens.data.filter(t => t.type === 'NUMBER' || t.type === 'STRING').length}\n`
    );

    // Step 3: Syntax analysis
    console.log('🌳 Step 2: Syntax Analysis...');
    const parser = new Blend65Parser(tokens.data);
    const ast = parser.parse();

    if (!ast.success) {
      throw new Error(`Parser failed: ${ast.errors.map(e => e.message).join(', ')}`);
    }

    console.log(`   ✅ AST generated successfully`);
    console.log(`   📊 Module: ${ast.data.module?.name || 'unnamed'}`);
    console.log(`   📊 Imports: ${ast.data.imports.length}`);
    console.log(
      `   📊 Functions: ${ast.data.body.filter(d => d.kind === 'FunctionDeclaration').length}`
    );
    console.log(`   📊 Enums: ${ast.data.body.filter(d => d.kind === 'EnumDeclaration').length}`);
    console.log(
      `   📊 Variables: ${ast.data.body.filter(d => d.kind === 'VariableDeclaration').length}\n`
    );

    // Step 4: Semantic analysis
    console.log('🧠 Step 3: Semantic Analysis...');
    const semanticAnalyzer = new SemanticAnalyzer();
    const semanticResult = semanticAnalyzer.analyzeProgram([ast.data]);

    if (!semanticResult.success) {
      throw new Error(
        `Semantic analysis failed: ${semanticResult.errors.map(e => e.message).join(', ')}`
      );
    }

    console.log(`   ✅ Semantic analysis completed`);
    console.log(`   📊 Symbols: ${semanticResult.data.globalSymbolTable.getSymbolCount()}`);
    console.log(`   📊 Modules: ${semanticResult.data.moduleAnalysis.length}`);
    console.log(`   📊 Functions: ${semanticResult.data.functionAnalysis.length}`);
    console.log(`   📊 Variables: ${semanticResult.data.variableAnalysis.length}\n`);

    // Step 5: IL transformation
    console.log('⚙️  Step 4: IL Transformation...');
    const ilTransformer = new ASTToILTransformer();
    const ilResult = ilTransformer.transformProgram(
      ast.data,
      semanticResult.data.globalSymbolTable,
      semanticResult.data
    );

    if (!ilResult.success) {
      throw new Error(
        `IL transformation failed: ${ilResult.errors.map(e => e.message).join(', ')}`
      );
    }

    console.log(`   ✅ IL transformation completed`);
    console.log(`   📊 Modules: ${ilResult.data.modules.length}`);
    console.log(
      `   📊 Functions: ${ilResult.data.modules.reduce((total, m) => total + m.functions.length, 0)}`
    );
    console.log(
      `   📊 Instructions: ${ilResult.data.modules.reduce(
        (total, m) => total + m.functions.reduce((ftotal, f) => ftotal + f.instructions.length, 0),
        0
      )}\n`
    );

    // Step 6: IL optimization
    console.log('⚡ Step 5: IL Optimization...');
    const patternRegistry = createDefaultPatternRegistry();
    const optimizer = new ILOptimizationFramework(patternRegistry);
    const optimizationResult = await optimizer.optimizeProgram(ilResult.data);

    console.log(`   ✅ IL optimization completed`);
    console.log(`   📊 Patterns Applied: ${optimizationResult.metrics.patternsApplied}`);
    console.log(`   📊 Cycles Saved: ${optimizationResult.metrics.totalCyclesSaved}`);
    console.log(`   📊 Performance Grade: ${optimizationResult.performanceGrade}`);
    console.log(`   📊 Optimization Time: ${optimizationResult.metrics.optimizationTime}ms\n`);

    // Summary
    console.log('🎉 COMPLETE PIPELINE SUCCESS!');
    console.log('✅ All phases completed without errors');
    console.log('✅ Real Blend65 source code fully processed');
    console.log('✅ Optimization framework operational');
    console.log('✅ Ready for code generation phase\n');

    return {
      success: true,
      tokens: tokens.data.length,
      astNodes: countASTNodes(ast.data),
      symbols: semanticResult.data.globalSymbolTable.getSymbolCount(),
      ilInstructions: ilResult.data.modules.reduce(
        (total, m) => total + m.functions.reduce((ftotal, f) => ftotal + f.instructions.length, 0),
        0
      ),
      patternsApplied: optimizationResult.metrics.patternsApplied,
      optimizationGrade: optimizationResult.performanceGrade,
    };
  } catch (error) {
    console.error('❌ Pipeline test failed:', error);
    return { success: false, error: error.message };
  }
}

function countASTNodes(ast: any): number {
  // Simple recursive node counter
  let count = 1;
  for (const key in ast) {
    if (ast[key] && typeof ast[key] === 'object') {
      if (Array.isArray(ast[key])) {
        count += ast[key].reduce((sum: number, item: any) => sum + countASTNodes(item), 0);
      } else {
        count += countASTNodes(ast[key]);
      }
    }
  }
  return count;
}

// Run the test
testCompletePipeline()
  .then(result => {
    if (result.success) {
      console.log('🎯 PIPELINE VALIDATION COMPLETE');
      console.log(`📊 Final Metrics:`);
      console.log(`   - Tokens: ${result.tokens}`);
      console.log(`   - AST Nodes: ${result.astNodes}`);
      console.log(`   - Symbols: ${result.symbols}`);
      console.log(`   - IL Instructions: ${result.ilInstructions}`);
      console.log(`   - Optimization Patterns: ${result.patternsApplied}`);
      console.log(`   - Performance Grade: ${result.optimizationGrade}`);
      console.log('\n🚀 READY FOR PHASE 3: CODE GENERATION');
    } else {
      console.error('❌ Pipeline validation failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
