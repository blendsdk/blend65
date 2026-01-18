/**
 * Debug script to understand loop detection issues
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';
import { LoopAnalyzer } from '../packages/compiler/dist/semantic/analysis/loop-analysis.js';

const source = `
module Test

function test(): void
  let i: byte = 0
  while i < 10
    i = i + 1
  end while
end function
`;

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const analyzer = new SemanticAnalyzer();
analyzer.analyze(ast);

const symbolTable = analyzer.getSymbolTable();
const cfgs = analyzer.getAllCFGs();

console.log('=== CFG Analysis ===');
console.log('CFGs found:', cfgs.size);

for (const [name, cfg] of cfgs.entries()) {
  console.log('\nCFG for function:', name);
  console.log('  Entry node:', cfg.entry.id);
  console.log('  Total nodes:', cfg.getNodes().length);
  
  const nodes = cfg.getNodes();
  for (const node of nodes) {
    const stmtType = node.statement?.constructor.name || 'null';
    console.log(`  Node ${node.id}:`);
    console.log(`    Statement: ${stmtType}`);
    console.log(`    Predecessors: [${node.predecessors.map(p => p.id).join(', ')}]`);
    console.log(`    Successors: [${node.successors.map(s => s.id).join(', ')}]`);
  }
}

console.log('\n=== Loop Analysis ===');
const loopAnalyzer = new LoopAnalyzer(cfgs, symbolTable);
loopAnalyzer.analyze(ast);

const loops = loopAnalyzer.getLoopsForFunction('test');
console.log('Loops detected for test:', loops ? loops.length : 'undefined');

if (loops && loops.length > 0) {
  for (const loop of loops) {
    console.log('\nLoop:');
    console.log('  Header:', loop.header.id);
    console.log('  Body nodes:', [...loop.body].map(n => n.id).join(', '));
    console.log('  Basic IVs:', [...loop.basicInductionVars.keys()]);
    for (const [name, info] of loop.basicInductionVars) {
      console.log(`    ${name}: stride=${info.stride}, initial=${info.initialValue}`);
    }
  }
} else {
  console.log('No loops detected!');
  console.log('This indicates the dominance/back-edge detection is not working.');
}

console.log('\nDone.');