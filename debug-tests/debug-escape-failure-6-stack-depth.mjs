/**
 * Debug Escape Analysis Failure #6: Stack Depth Propagation
 * 
 * Issue: rootDepth should be > middleDepth, but they're equal (both 3)
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler/dist/semantic/analyzer.js';
import { OptimizationMetadataKey } from '../packages/compiler/dist/semantic/analysis/optimization-metadata-keys.js';

const source = `
function leaf(): byte
  let x: byte = 10;
  return x;
end function

function middle(): byte
  let y: byte = leaf();
  return y;
end function

function root(): byte
  let z: byte = middle();
  return z;
end function
`;

console.log('=== DEBUGGING ESCAPE FAILURE #6: Stack Depth Propagation ===\n');
console.log('Source Code:');
console.log(source);
console.log('\n--- Parsing and Analysis ---');

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const analyzer = new SemanticAnalyzer();
analyzer.analyze(ast);

const diagnostics = analyzer.getDiagnostics();
console.log(`Diagnostics: ${diagnostics.length}`);

const leafFunc = ast.getDeclarations()[0];
const middleFunc = ast.getDeclarations()[1];
const rootFunc = ast.getDeclarations()[2];

const leafDepth = leafFunc.metadata?.get(OptimizationMetadataKey.StackDepth);
const middleDepth = middleFunc.metadata?.get(OptimizationMetadataKey.StackDepth);
const rootDepth = rootFunc.metadata?.get(OptimizationMetadataKey.StackDepth);

console.log('\n--- Stack Depths ---');
console.log(`leaf():   ${leafDepth} bytes`);
console.log(`middle(): ${middleDepth} bytes`);
console.log(`root():   ${rootDepth} bytes`);

console.log('\n--- Expected ---');
console.log('leaf: 3 bytes (2 return + 1 local)');
console.log('middle: >3 bytes (2 return + 1 local + leaf depth)');
console.log('root: >middle bytes (2 return + 1 local + middle depth)');

console.log('\n=== ANALYSIS ===');
console.log('The escape analyzer may not be propagating call chain depths correctly.');
console.log('Each calling function should add its depth to the maximum callee depth.');