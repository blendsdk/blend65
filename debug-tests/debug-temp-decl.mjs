#!/usr/bin/env node
/**
 * Debug temp declaration metadata
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SymbolTable } from '../packages/compiler/dist/semantic/symbol-table.js';
import { AliasAnalyzer } from '../packages/compiler/dist/semantic/analysis/alias-analysis.js';

const source = `
function process(value: byte): void
  let temp: byte = value;
end function
`;

console.log('=== TEMP DECLARATION DEBUG ===\n');
console.log('Source:', source.trim());

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const symbolTable = new SymbolTable();
const analyzer = new AliasAnalyzer(symbolTable);
analyzer.analyze(ast);

const funcDecl = ast.declarations[0];
console.log(`\nFunction: ${funcDecl.getName()}`);
console.log(`Body statements: ${funcDecl.getBody().length}`);

const tempDecl = funcDecl.getBody()[0];
console.log(`\nFirst statement in body:`);
console.log(`  NodeType: ${tempDecl.getNodeType()}`);
console.log(`  Name: ${tempDecl.getName()}`);
console.log(`  Has metadata: ${!!tempDecl.metadata}`);

if (tempDecl.metadata) {
  console.log(`  Metadata:`);
  for (const [key, value] of tempDecl.metadata.entries()) {
    if (value instanceof Set) {
      const items = Array.from(value).map(s => s.name || s);
      console.log(`    ${key}: [${items.join(', ')}]`);
    } else {
      console.log(`    ${key}: ${value}`);
    }
  }
} else {
  console.log('  NO METADATA!');
  console.log(`  \nDEBUG: Checking if temp was processed...`);
  console.log(`  Has initializer: ${!!tempDecl.getInitializer()}`);
  if (tempDecl.getInitializer()) {
    const init = tempDecl.getInitializer();
    console.log(`  Initializer type: ${init.getNodeType()}`);
    if (init.getName) {
      console.log(`  Initializer name: ${init.getName()}`);
    }
  }
}

console.log('\n=== END DEBUG ===');