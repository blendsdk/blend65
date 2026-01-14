import { Lexer } from './packages/compiler/dist/lexer/lexer.js';
import { Parser } from './packages/compiler/dist/parser/parser.js';
import { SymbolTableBuilder } from './packages/compiler/dist/semantic/visitors/symbol-table-builder.js';
import { TypeResolver } from './packages/compiler/dist/semantic/visitors/type-resolver.js';
import { TypeChecker } from './packages/compiler/dist/semantic/visitors/type-checker/type-checker.js';

const source = `let result = 10 + 20 * 3;`;

const lexer = new Lexer(source);
const tokens = lexer.tokenize();

const parser = new Parser(tokens);
const program = parser.parse();

const symbolBuilder = new SymbolTableBuilder();
symbolBuilder.walk(program);
const symbolTable = symbolBuilder.getSymbolTable();

const resolver = new TypeResolver(symbolTable);
resolver.walk(program);
const typeSystem = resolver.getTypeSystem();

const checker = new TypeChecker(symbolTable, typeSystem);
checker.walk(program);

const varDecl = program.getDeclarations()[0];
const initializer = varDecl.getInitializer();

console.log('Initializer node type:', initializer.getNodeType());
console.log('Initializer typeInfo:', initializer.getTypeInfo());
console.log('Has typeInfo?', initializer.getTypeInfo() !== undefined);

if (initializer.getNodeType() === 'BinaryExpression') {
    console.log('Left node:', initializer.getLeft().getNodeType());
    console.log('Left typeInfo:', initializer.getLeft().getTypeInfo());
    console.log('Right node:', initializer.getRight().getNodeType());
    console.log('Right typeInfo:', initializer.getRight().getTypeInfo());

    if (initializer.getRight().getNodeType() === 'BinaryExpression') {
        console.log('Right-Left typeInfo:', initializer.getRight().getLeft().getTypeInfo());
        console.log('Right-Right typeInfo:', initializer.getRight().getRight().getTypeInfo());
    }
}
