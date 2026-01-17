/**
 * Debug Test 2: Deep dive into assignment sets
 * 
 * Let's see what assignment sets are computed for each node
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

console.log('=== DEBUG: Assignment Sets Computation ===\n');

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parsing successful:', !parser.hasErrors());

console.log('\n--- Semantic Analysis ---');

const analyzer = new SemanticAnalyzer();
const result = analyzer.analyze(ast);

console.log('Analysis success:', result.success);

const errors = result.diagnostics.filter(d => d.severity === DiagnosticSeverity.ERROR);
console.log('Total errors:', errors.length);

if (errors.length > 0) {
  console.log('\n--- Errors ---');
  errors.forEach((err, idx) => {
    console.log(`${idx + 1}. ${err.message}`);
    if (err.location && err.location.source) {
      const lines = err.location.source.split('\n');
      const line = err.range?.start.line || 0;
      if (line < lines.length) {
        console.log(`   Context: ${lines[line].trim()}`);
      }
    }
  });
}

console.log('\n--- CFG Structure ---');
const cfg = analyzer.getCFG('test');
if (cfg) {
  const nodes = cfg.getNodes();
  console.log(`Total nodes: ${nodes.length}`);
  
  nodes.forEach((node, idx) => {
    console.log(`\nNode ${idx}: ${node.id}`);
    console.log(`  Kind: ${node.kind}`);
    console.log(`  Predecessors: ${node.predecessors.map(p => p.id).join(', ') || 'none'}`);
    console.log(`  Successors: ${node.successors.map(s => s.id).join(', ') || 'none'}`);
    if (node.statement) {
      const stmtType = node.statement.getNodeType();
      console.log(`  Statement: ${stmtType}`);
      if (stmtType === 'VariableDecl') {
        console.log(`    Variable: ${node.statement.getName()}`);
      }
    } else {
      console.log(`  Statement: none`);
    }
  });
}

console.log('\n=== Analysis Complete ===');