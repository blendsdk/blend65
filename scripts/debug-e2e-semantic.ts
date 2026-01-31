/**
 * Debug script to analyze why E2E semantic tests are failing
 */
import { Lexer } from '../packages/compiler-v2/src/lexer/lexer.js';
import { Parser } from '../packages/compiler-v2/src/parser/parser.js';
import { SemanticAnalyzer } from '../packages/compiler-v2/src/semantic/analyzer.js';

// Helper to analyze source code and print diagnostics
function analyze(name: string, source: string): void {
  console.log('\n' + '='.repeat(60));
  console.log(`TEST: ${name}`);
  console.log('='.repeat(60));
  console.log('Source:');
  console.log(source);
  console.log('-'.repeat(60));
  
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, source);
    const ast = parser.parse();
    
    if (parser.hasErrors()) {
      console.log('PARSER ERRORS:');
      parser.getDiagnostics().forEach(e => console.log(`  - ${e.message}`));
      return;
    }
    
    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(ast);
    
    console.log(`Success: ${result.success}`);
    console.log(`Errors: ${result.stats.errorCount}`);
    console.log(`Warnings: ${result.stats.warningCount}`);
    
    if (result.diagnostics.length > 0) {
      console.log('\nDIAGNOSTICS:');
      result.diagnostics.forEach(d => {
        console.log(`  [${d.severity}] ${d.code}: ${d.message}`);
        if (d.location) {
          console.log(`    at line ${d.location.start.line}, col ${d.location.start.column}`);
        }
      });
    }
    
    console.log('\nPASS RESULTS:');
    console.log(`  symbolTable: ${result.passResults.symbolTable ? 'defined' : 'undefined'}`);
    console.log(`  typeResolution: ${result.passResults.typeResolution ? 'defined' : 'undefined'}`);
    console.log(`  typeCheck: ${result.passResults.typeCheck ? 'defined' : 'undefined'}`);
    console.log(`  cfgBuild: ${result.passResults.cfgBuild ? 'defined' : 'undefined'}`);
    console.log(`  callGraph: ${result.passResults.callGraph ? 'defined' : 'undefined'}`);
    console.log(`  recursionCheck: ${result.passResults.recursionCheck ? 'defined' : 'undefined'}`);
    console.log(`  advancedAnalysis: ${result.passResults.advancedAnalysis ? 'defined' : 'undefined'}`);
    
  } catch (error) {
    console.log('EXCEPTION:', error);
  }
}

// Test 1: Simple function (from complete-analysis.test.ts line 69)
analyze('Simple function', `
  module test;
  
  function add(a: byte, b: byte): byte {
    return a + b;
  }
`);

// Test 2: Binary literals (from type-checking.test.ts)
analyze('Binary literals', `
  module test;
  let x: byte = 0b00001111;
`);

// Test 3: Variables and functions (from complete-analysis.test.ts line 164)
analyze('Variables and functions', `
  module test;
  
  let globalVar: byte = 0;
  
  function helper(x: byte): byte {
    return x * 2;
  }
  
  function process(a: byte, b: byte): byte {
    let local: byte = helper(a);
    return local + b;
  }
  
  function main(): void {
    globalVar = process(5, 10);
  }
`);

// Test 4: Control flow (from complete-analysis.test.ts line 193)
analyze('Control flow', `
  module test;
  
  function abs(x: byte): byte {
    if (x < 0) {
      return 0 - x;
    }
    return x;
  }
  
  function max(a: byte, b: byte): byte {
    if (a > b) {
      return a;
    }
    return b;
  }
  
  function clamp(val: byte, low: byte, high: byte): byte {
    if (val < low) {
      return low;
    }
    if (val > high) {
      return high;
    }
    return val;
  }
`);

// Test 5: Non-recursive simple function (from recursion-errors.test.ts)
analyze('Non-recursive simple function', `
  module test;
  
  function double(x: byte): byte {
    return x * 2;
  }
`);

// Test 6: Iterative factorial (from recursion-errors.test.ts)
analyze('Iterative factorial', `
  module test;
  
  function factorialIterative(n: byte): word {
    let result: word = 1;
    for (let i: byte = 1 to n step 1) {
      result = result * i;
    }
    return result;
  }
`);

console.log('\n' + '='.repeat(60));
console.log('DONE');
console.log('='.repeat(60));