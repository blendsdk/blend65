/**
 * Debug Test 1: "should allow use when both branches initialize"
 * 
 * This test is failing because variables initialized in BOTH if/else branches
 * are still being flagged as uninitialized.
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';
import { DiagnosticSeverity } from '../packages/compiler/dist/ast/diagnostics.js';

const source = `
  function test(condition: boolean): void
    let x: byte;
    if condition then
      x = 10;
    else
      x = 20;
    end if
    let y: byte = x;
  end function
`;

console.log('=== DEBUG: Both Branches Initialize ===\n');
console.log('Source code:');
console.log(source);
console.log('\n--- Parsing ---');

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parsing successful:', !parser.hasErrors());

console.log('\n--- Semantic Analysis ---');

const analyzer = new SemanticAnalyzer();
const result = analyzer.analyze(ast);

console.log('Analysis success:', result.success);
console.log('Total diagnostics:', result.diagnostics.length);

const errors = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
console.log('Errors:', errors.length);

if (errors.length > 0) {
  console.log('\n--- Errors Found ---');
  errors.forEach((err, idx) => {
    console.log(`${idx + 1}. [${err.code}] ${err.message}`);
    if (err.range) {
      console.log(`   Line ${err.range.start.line}, Col ${err.range.start.column}`);
    }
  });
}

console.log('\n--- CFG Analysis ---');
const cfg = analyzer.getCFG('test');
if (cfg) {
  console.log('CFG created for test function');
  console.log('Entry node:', cfg.entry ? 'exists' : 'missing');
  console.log('Exit node:', cfg.exit ? 'exists' : 'missing');
  console.log('Total nodes:', cfg.nodes.length);
  
  console.log('\n--- CFG Nodes ---');
  cfg.nodes.forEach((node, idx) => {
    console.log(`Node ${idx}: ${node.label || 'unlabeled'}`);
    console.log(`  Predecessors: ${node.predecessors.length}`);
    console.log(`  Successors: ${node.successors.length}`);
  });
} else {
  console.log('No CFG found for test function');
}

console.log('\n=== EXPECTED: No errors (x is initialized on both branches) ===');
console.log('=== ACTUAL: ' + (errors.length === 0 ? 'PASS' : 'FAIL - ' + errors.length + ' errors') + ' ===');