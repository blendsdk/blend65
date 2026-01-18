#!/usr/bin/env node
/**
 * Debug: Test alias analyzer metadata attachment
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SymbolTable } from '../packages/compiler/dist/semantic/symbol-table.js';
import { AliasAnalyzer } from '../packages/compiler/dist/semantic/analysis/alias-analysis.js';

const testCases = [
  {
    name: '@zp variable',
    source: '@zp counter: byte;',
  },
  {
    name: 'Regular variable',
    source: 'let counter: byte = 0;',
  },
  {
    name: '@map hardware register',
    source: '@map vicBorder at $D020: byte;',
  },
];

console.log('=== ALIAS ANALYZER METADATA DEBUG ===\n');

for (const { name, source } of testCases) {
  console.log(`\n--- ${name} ---`);
  console.log(`Source: ${source.trim()}`);
  
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const symbolTable = new SymbolTable();
    const analyzer = new AliasAnalyzer(symbolTable);
    
    console.log('\nBEFORE analyze():');
    console.log(`  Declaration metadata: ${!!ast.declarations[0].metadata}`);
    
    analyzer.analyze(ast);
    
    console.log('\nAFTER analyze():');
    const decl = ast.declarations[0];
    console.log(`  Declaration metadata exists: ${!!decl.metadata}`);
    if (decl.metadata) {
      console.log(`  Metadata keys: ${Array.from(decl.metadata.keys())}`);
      for (const [key, value] of decl.metadata.entries()) {
        console.log(`    ${key}: ${value}`);
      }
    }
    
    const diagnostics = analyzer.getDiagnostics();
    console.log(`\nDiagnostics: ${diagnostics.length}`);
    for (const diag of diagnostics) {
      console.log(`  [${diag.severity}] ${diag.message}`);
    }
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    console.error(error.stack);
  }
}

console.log('\n=== END DEBUG ===');