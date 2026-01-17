import { Lexer } from './packages/compiler/dist/lexer/lexer.js';
import { Parser } from './packages/compiler/dist/parser/parser.js';
import { SemanticAnalyzer } from './packages/compiler/dist/semantic/analyzer.js';

const source = `
  function test(x: byte): byte
    return x + 1;
  end function
`;

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const analyzer = new SemanticAnalyzer();
const result = analyzer.analyze(ast);

console.log('Success:', result.success);
console.log('Diagnostics:', result.diagnostics);