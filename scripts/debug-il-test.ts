/**
 * Debug script for IL E2E test failures
 */
import { Lexer } from '../packages/compiler-v2/src/lexer/index.js';
import { Parser } from '../packages/compiler-v2/src/parser/index.js';
import { SemanticAnalyzer } from '../packages/compiler-v2/src/semantic/index.js';
import { DiagnosticSeverity } from '../packages/compiler-v2/src/ast/diagnostics.js';
import { ILGenerator, ILOpcode } from '../packages/compiler-v2/src/il/index.js';

const source = `
  module BorderColor;
  
  const BORDER_COLOR: word = $D020;
  
  function setBorderColor(color: byte): void {
    poke(BORDER_COLOR, color);
  }
  
  function main(): void {
    setBorderColor(0);
  }
`;

console.log('=== Debug IL Generation ===');
console.log('Source:', source);
console.log();

try {
  // Step 1: Lexer
  console.log('Step 1: Lexer...');
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  console.log('  Tokens:', tokens.length);

  // Step 2: Parser
  console.log('Step 2: Parser...');
  const parser = new Parser(tokens, { filePath: 'test.blend' });
  const ast = parser.parse();
  console.log('  AST:', ast ? 'OK' : 'FAILED');

  // Step 3: Semantic Analysis
  console.log('Step 3: Semantic Analysis...');
  const semanticAnalyzer = new SemanticAnalyzer({
    runFrameAllocation: true,
    runAdvancedAnalysis: false,
  });
  const analysisResult = semanticAnalyzer.analyze(ast);
  
  console.log('  Success:', analysisResult.success);
  console.log('  Error Count:', analysisResult.stats.errorCount);
  console.log('  Warning Count:', analysisResult.stats.warningCount);

  // Check for errors
  const errors = analysisResult.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
  if (errors.length > 0) {
    console.log();
    console.log('=== SEMANTIC ERRORS ===');
    for (const e of errors) {
      console.log(`  [error] ${e.message}`);
      if (e.location) {
        console.log(`    at line ${e.location.start.line}, col ${e.location.start.column}`);
      }
    }
    process.exit(1);
  }

  // Check frame map
  console.log('  Frame Map:', analysisResult.frameMap ? 'OK' : 'MISSING');

  // Step 4: IL Generation
  console.log('Step 4: IL Generation...');
  const ilGenerator = new ILGenerator(analysisResult.frameMap!, analysisResult.symbolTable);
  const ilProgram = ilGenerator.generate(ast);

  console.log();
  console.log('=== IL PROGRAM ===');
  console.log('Functions:', ilProgram.functions.length);
  
  for (const func of ilProgram.functions) {
    console.log();
    console.log(`Function: ${func.name}`);
    console.log(`  Instructions: ${func.instructions.length}`);
    for (const instr of func.instructions) {
      console.log(`    ${ILOpcode[instr.opcode]} ${instr.operands.map(o => JSON.stringify(o)).join(', ')}`);
    }
  }

} catch (e) {
  console.error('Error:', e);
}