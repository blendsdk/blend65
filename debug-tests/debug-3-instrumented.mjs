/**
 * Debug Test 3: Instrument the definite assignment analyzer
 * 
 * We'll manually trace through the algorithm to see what's happening
 */

import { Lexer } from '../packages/compiler/dist/lexer/lexer.js';
import { Parser } from '../packages/compiler/dist/parser/parser.js';

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

console.log('=== Manual CFG Trace ===\n');

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parsing complete\n');

// Get the function
const funcDecl = ast.getDeclarations()[0];
console.log('Function:', funcDecl.getName());
console.log('Parameters:', funcDecl.getParameters().map(p => p.name || p).join(', '));

// Get the body
const body = funcDecl.getBody();
console.log('\nFunction body has', body.length, 'statements:');
body.forEach((stmt, idx) => {
  console.log(`  ${idx}. ${stmt.getNodeType()}`);
  if (stmt.getNodeType() === 'VariableDecl') {
    console.log(`     Variable: ${stmt.getName()}`);
    console.log(`     Has initializer: ${!!stmt.getInitializer()}`);
  } else if (stmt.getNodeType() === 'IfStatement') {
    console.log(`     Then branch: ${stmt.getThenBranch().length} statements`);
    console.log(`     Else branch: ${stmt.getElseBranch()?.length || 0} statements`);
    stmt.getThenBranch().forEach((s, i) => {
      console.log(`       Then[${i}]: ${s.getNodeType()}`);
      if (s.getNodeType() === 'ExpressionStatement') {
        const expr = s.getExpression();
        console.log(`         Expression: ${expr.getNodeType()}`);
        if (expr.getNodeType() === 'AssignmentExpression') {
          console.log(`           Target: ${expr.getTarget().getName()}`);
        }
      }
    });
    stmt.getElseBranch()?.forEach((s, i) => {
      console.log(`       Else[${i}]: ${s.getNodeType()}`);
      if (s.getNodeType() === 'ExpressionStatement') {
        const expr = s.getExpression();
        console.log(`         Expression: ${expr.getNodeType()}`);
        if (expr.getNodeType() === 'AssignmentExpression') {
          console.log(`           Target: ${expr.getTarget().getName()}`);
        }
      }
    });
  }
});

console.log('\n=== Expected Flow ===');
console.log('1. Entry → let x: byte (x NOT assigned)');
console.log('2. if condition → branch to then/else');
console.log('3. Then: x = 10 (x IS assigned)');
console.log('4. Else: x = 20 (x IS assigned)');
console.log('5. Merge: intersection of {x} and {x} = {x}');
console.log('6. let y: byte = x (x SHOULD be assigned here!)');
console.log('\nBut we\'re getting errors, so something is wrong with step 5 or 6');