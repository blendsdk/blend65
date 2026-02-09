/**
 * Debug script: Check what happens when break/continue appears at module level
 */
import { Lexer } from '../packages/compiler/src/lexer/index.js';
import { Parser } from '../packages/compiler/src/parser/index.js';
import { SemanticAnalyzer } from '../packages/compiler/src/semantic/index.js';

const source = `break;`;

const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const program = parser.parse();

console.log('Parser has errors:', parser.hasErrors());
console.log('Parser diagnostics:', parser.getDiagnostics().map(d => `[${d.severity}] ${d.message}`));

const analyzer = new SemanticAnalyzer({ runAdvancedAnalysis: true });
const result = analyzer.analyze(program);

console.log('\nSemantic diagnostics:', result.diagnostics.map(d => `[${d.severity}] ${d.message}`));
