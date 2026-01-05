import { describe, it, expect } from 'vitest';
import { ASTNodeFactory } from '../ast-factory.js';
describe('ASTNodeFactory', () => {
    const factory = new ASTNodeFactory();
    const mockMetadata = {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 10, offset: 9 },
    };
    describe('Program and Module Creation', () => {
        it('should create a program node', () => {
            const moduleName = factory.createQualifiedName(['Game', 'Main']);
            const module = factory.createModuleDeclaration(moduleName);
            const program = factory.createProgram(module, [], [], [], mockMetadata);
            expect(program.type).toBe('Program');
            expect(program.module).toBe(module);
            expect(program.imports).toEqual([]);
            expect(program.exports).toEqual([]);
            expect(program.body).toEqual([]);
            expect(program.metadata).toEqual(mockMetadata);
        });
        it('should create a module declaration', () => {
            const name = factory.createQualifiedName(['Game', 'Main']);
            const module = factory.createModuleDeclaration(name, mockMetadata);
            expect(module.type).toBe('ModuleDeclaration');
            expect(module.name).toBe(name);
            expect(module.metadata).toEqual(mockMetadata);
        });
        it('should create a qualified name', () => {
            const qualifiedName = factory.createQualifiedName(['Game', 'Main'], mockMetadata);
            expect(qualifiedName.type).toBe('QualifiedName');
            expect(qualifiedName.parts).toEqual(['Game', 'Main']);
            expect(qualifiedName.metadata).toEqual(mockMetadata);
        });
    });
    describe('Expression Creation', () => {
        it('should create binary expressions', () => {
            const left = factory.createIdentifier('x');
            const right = factory.createIdentifier('y');
            const binaryExpr = factory.createBinaryExpr('+', left, right, mockMetadata);
            expect(binaryExpr.type).toBe('BinaryExpr');
            expect(binaryExpr.operator).toBe('+');
            expect(binaryExpr.left).toBe(left);
            expect(binaryExpr.right).toBe(right);
            expect(binaryExpr.metadata).toEqual(mockMetadata);
        });
        it('should create unary expressions', () => {
            const operand = factory.createIdentifier('flag');
            const unaryExpr = factory.createUnaryExpr('not', operand, mockMetadata);
            expect(unaryExpr.type).toBe('UnaryExpr');
            expect(unaryExpr.operator).toBe('not');
            expect(unaryExpr.operand).toBe(operand);
            expect(unaryExpr.metadata).toEqual(mockMetadata);
        });
        it('should create assignment expressions', () => {
            const left = factory.createIdentifier('x');
            const right = factory.createLiteral(5, '5');
            const assignExpr = factory.createAssignmentExpr('=', left, right, mockMetadata);
            expect(assignExpr.type).toBe('AssignmentExpr');
            expect(assignExpr.operator).toBe('=');
            expect(assignExpr.left).toBe(left);
            expect(assignExpr.right).toBe(right);
            expect(assignExpr.metadata).toEqual(mockMetadata);
        });
        it('should create call expressions', () => {
            const callee = factory.createIdentifier('add');
            const args = [factory.createLiteral(5, '5'), factory.createLiteral(10, '10')];
            const callExpr = factory.createCallExpr(callee, args, mockMetadata);
            expect(callExpr.type).toBe('CallExpr');
            expect(callExpr.callee).toBe(callee);
            expect(callExpr.args).toEqual(args);
            expect(callExpr.metadata).toEqual(mockMetadata);
        });
        it('should create member expressions', () => {
            const object = factory.createIdentifier('player');
            const memberExpr = factory.createMemberExpr(object, 'x', mockMetadata);
            expect(memberExpr.type).toBe('MemberExpr');
            expect(memberExpr.object).toBe(object);
            expect(memberExpr.property).toBe('x');
            expect(memberExpr.metadata).toEqual(mockMetadata);
        });
        it('should create index expressions', () => {
            const object = factory.createIdentifier('buffer');
            const index = factory.createLiteral(0, '0');
            const indexExpr = factory.createIndexExpr(object, index, mockMetadata);
            expect(indexExpr.type).toBe('IndexExpr');
            expect(indexExpr.object).toBe(object);
            expect(indexExpr.index).toBe(index);
            expect(indexExpr.metadata).toEqual(mockMetadata);
        });
    });
    describe('Literal Creation', () => {
        it('should create identifiers', () => {
            const identifier = factory.createIdentifier('myVar', mockMetadata);
            expect(identifier.type).toBe('Identifier');
            expect(identifier.name).toBe('myVar');
            expect(identifier.metadata).toEqual(mockMetadata);
        });
        it('should create literals', () => {
            const numLiteral = factory.createLiteral(42, '42', mockMetadata);
            const strLiteral = factory.createLiteral('hello', '"hello"');
            const boolLiteral = factory.createLiteral(true, 'true');
            expect(numLiteral.type).toBe('Literal');
            expect(numLiteral.value).toBe(42);
            expect(numLiteral.raw).toBe('42');
            expect(numLiteral.metadata).toEqual(mockMetadata);
            expect(strLiteral.type).toBe('Literal');
            expect(strLiteral.value).toBe('hello');
            expect(strLiteral.raw).toBe('"hello"');
            expect(boolLiteral.type).toBe('Literal');
            expect(boolLiteral.value).toBe(true);
            expect(boolLiteral.raw).toBe('true');
        });
        it('should create array literals', () => {
            const elements = [
                factory.createLiteral(1, '1'),
                factory.createLiteral(2, '2'),
                factory.createLiteral(3, '3'),
            ];
            const arrayLiteral = factory.createArrayLiteral(elements, mockMetadata);
            expect(arrayLiteral.type).toBe('ArrayLiteral');
            expect(arrayLiteral.elements).toEqual(elements);
            expect(arrayLiteral.metadata).toEqual(mockMetadata);
        });
    });
    describe('Statement Creation', () => {
        it('should create expression statements', () => {
            const expr = factory.createIdentifier('x');
            const exprStmt = factory.createExpressionStatement(expr, mockMetadata);
            expect(exprStmt.type).toBe('ExpressionStatement');
            expect(exprStmt.expression).toBe(expr);
            expect(exprStmt.metadata).toEqual(mockMetadata);
        });
        it('should create return statements', () => {
            const value = factory.createLiteral(42, '42');
            const returnStmt = factory.createReturnStatement(value, mockMetadata);
            expect(returnStmt.type).toBe('ReturnStatement');
            expect(returnStmt.value).toBe(value);
            expect(returnStmt.metadata).toEqual(mockMetadata);
        });
        it('should create if statements', () => {
            const condition = factory.createBinaryExpr('==', factory.createIdentifier('x'), factory.createLiteral(5, '5'));
            const thenBody = [factory.createExpressionStatement(factory.createIdentifier('y'))];
            const elseBody = [factory.createExpressionStatement(factory.createIdentifier('z'))];
            const ifStmt = factory.createIfStatement(condition, thenBody, elseBody, mockMetadata);
            expect(ifStmt.type).toBe('IfStatement');
            expect(ifStmt.condition).toBe(condition);
            expect(ifStmt.thenBody).toEqual(thenBody);
            expect(ifStmt.elseBody).toEqual(elseBody);
            expect(ifStmt.metadata).toEqual(mockMetadata);
        });
        it('should create while statements', () => {
            const condition = factory.createBinaryExpr('<', factory.createIdentifier('i'), factory.createLiteral(10, '10'));
            const body = [factory.createExpressionStatement(factory.createIdentifier('x'))];
            const whileStmt = factory.createWhileStatement(condition, body, mockMetadata);
            expect(whileStmt.type).toBe('WhileStatement');
            expect(whileStmt.condition).toBe(condition);
            expect(whileStmt.body).toEqual(body);
            expect(whileStmt.metadata).toEqual(mockMetadata);
        });
        it('should create for statements', () => {
            const start = factory.createLiteral(0, '0');
            const end = factory.createLiteral(10, '10');
            const step = factory.createLiteral(1, '1');
            const body = [factory.createExpressionStatement(factory.createIdentifier('x'))];
            const forStmt = factory.createForStatement('i', start, end, step, body, mockMetadata);
            expect(forStmt.type).toBe('ForStatement');
            expect(forStmt.variable).toBe('i');
            expect(forStmt.start).toBe(start);
            expect(forStmt.end).toBe(end);
            expect(forStmt.step).toBe(step);
            expect(forStmt.body).toEqual(body);
            expect(forStmt.metadata).toEqual(mockMetadata);
        });
        // v0.2 Statement Creation Tests
        it('should create break statements', () => {
            const breakStmt = factory.createBreakStatement(mockMetadata);
            expect(breakStmt.type).toBe('BreakStatement');
            expect(breakStmt.metadata).toEqual(mockMetadata);
        });
        it('should create continue statements', () => {
            const continueStmt = factory.createContinueStatement(mockMetadata);
            expect(continueStmt.type).toBe('ContinueStatement');
            expect(continueStmt.metadata).toEqual(mockMetadata);
        });
        it('should create break statements without metadata', () => {
            const breakStmt = factory.createBreakStatement();
            expect(breakStmt.type).toBe('BreakStatement');
            expect(breakStmt.metadata).toBeUndefined();
        });
        it('should create continue statements without metadata', () => {
            const continueStmt = factory.createContinueStatement();
            expect(continueStmt.type).toBe('ContinueStatement');
            expect(continueStmt.metadata).toBeUndefined();
        });
        it('should create match statements with default cases', () => {
            const discriminant = factory.createIdentifier('gameState');
            const menuCase = factory.createMatchCase(factory.createIdentifier('MENU'), [
                factory.createExpressionStatement(factory.createIdentifier('showMenu')),
            ]);
            const playingCase = factory.createMatchCase(factory.createIdentifier('PLAYING'), [
                factory.createExpressionStatement(factory.createIdentifier('updateGame')),
            ]);
            const defaultCase = factory.createMatchCase(null, // null test for default case
            [factory.createExpressionStatement(factory.createIdentifier('handleError'))]);
            const matchStmt = factory.createMatchStatement(discriminant, [menuCase, playingCase], defaultCase, mockMetadata);
            expect(matchStmt.type).toBe('MatchStatement');
            expect(matchStmt.discriminant).toBe(discriminant);
            expect(matchStmt.cases).toEqual([menuCase, playingCase]);
            expect(matchStmt.defaultCase).toBe(defaultCase);
            expect(matchStmt.metadata).toEqual(mockMetadata);
        });
        it('should create match statements without default case', () => {
            const discriminant = factory.createIdentifier('value');
            const case1 = factory.createMatchCase(factory.createLiteral(1, '1'), [
                factory.createExpressionStatement(factory.createIdentifier('doOne')),
            ]);
            const matchStmt = factory.createMatchStatement(discriminant, [case1], null, // no default case
            mockMetadata);
            expect(matchStmt.type).toBe('MatchStatement');
            expect(matchStmt.discriminant).toBe(discriminant);
            expect(matchStmt.cases).toEqual([case1]);
            expect(matchStmt.defaultCase).toBe(null);
            expect(matchStmt.metadata).toEqual(mockMetadata);
        });
        it('should create match cases with test expressions', () => {
            const test = factory.createIdentifier('MENU');
            const consequent = [factory.createExpressionStatement(factory.createIdentifier('showMenu'))];
            const matchCase = factory.createMatchCase(test, consequent, mockMetadata);
            expect(matchCase.type).toBe('MatchCase');
            expect(matchCase.test).toBe(test);
            expect(matchCase.consequent).toEqual(consequent);
            expect(matchCase.metadata).toEqual(mockMetadata);
        });
        it('should create match cases for default (null test)', () => {
            const consequent = [
                factory.createExpressionStatement(factory.createIdentifier('handleDefault')),
            ];
            const defaultMatchCase = factory.createMatchCase(null, consequent, mockMetadata);
            expect(defaultMatchCase.type).toBe('MatchCase');
            expect(defaultMatchCase.test).toBe(null);
            expect(defaultMatchCase.consequent).toEqual(consequent);
            expect(defaultMatchCase.metadata).toEqual(mockMetadata);
        });
    });
    describe('Declaration Creation', () => {
        it('should create function declarations', () => {
            const paramType = factory.createPrimitiveType('byte');
            const params = [factory.createParameter('x', paramType)];
            const returnType = factory.createPrimitiveType('void');
            const body = [factory.createExpressionStatement(factory.createIdentifier('test'))];
            const funcDecl = factory.createFunctionDeclaration('testFunc', params, returnType, body, true, // exported
            false, // callback
            mockMetadata);
            expect(funcDecl.type).toBe('FunctionDeclaration');
            expect(funcDecl.name).toBe('testFunc');
            expect(funcDecl.params).toEqual(params);
            expect(funcDecl.returnType).toBe(returnType);
            expect(funcDecl.body).toEqual(body);
            expect(funcDecl.exported).toBe(true);
            expect(funcDecl.metadata).toEqual(mockMetadata);
        });
        it('should create callback function declarations', () => {
            const paramType = factory.createPrimitiveType('byte');
            const params = [factory.createParameter('x', paramType)];
            const returnType = factory.createPrimitiveType('void');
            const body = [factory.createExpressionStatement(factory.createIdentifier('test'))];
            const callbackFuncDecl = factory.createFunctionDeclaration('rasterHandler', params, returnType, body, false, // exported
            true, // callback
            mockMetadata);
            expect(callbackFuncDecl.type).toBe('FunctionDeclaration');
            expect(callbackFuncDecl.name).toBe('rasterHandler');
            expect(callbackFuncDecl.params).toEqual(params);
            expect(callbackFuncDecl.returnType).toBe(returnType);
            expect(callbackFuncDecl.body).toEqual(body);
            expect(callbackFuncDecl.exported).toBe(false);
            expect(callbackFuncDecl.callback).toBe(true); // NEW: Test callback flag
            expect(callbackFuncDecl.metadata).toEqual(mockMetadata);
        });
        it('should create variable declarations', () => {
            const varType = factory.createPrimitiveType('byte');
            const initializer = factory.createLiteral(0, '0');
            const varDecl = factory.createVariableDeclaration('counter', varType, initializer, 'zp', false, mockMetadata);
            expect(varDecl.type).toBe('VariableDeclaration');
            expect(varDecl.name).toBe('counter');
            expect(varDecl.varType).toBe(varType);
            expect(varDecl.initializer).toBe(initializer);
            expect(varDecl.storageClass).toBe('zp');
            expect(varDecl.exported).toBe(false);
            expect(varDecl.metadata).toEqual(mockMetadata);
        });
        it('should create parameters', () => {
            const paramType = factory.createPrimitiveType('byte');
            const defaultValue = factory.createLiteral(0, '0');
            const param = factory.createParameter('x', paramType, true, defaultValue, mockMetadata);
            expect(param.type).toBe('Parameter');
            expect(param.name).toBe('x');
            expect(param.paramType).toBe(paramType);
            expect(param.optional).toBe(true);
            expect(param.defaultValue).toBe(defaultValue);
            expect(param.metadata).toEqual(mockMetadata);
        });
        // v0.2 Declaration Creation Tests
        it('should create enum declarations with explicit values', () => {
            const redMember = factory.createEnumMember('RED', factory.createLiteral(1, '1'));
            const greenMember = factory.createEnumMember('GREEN', factory.createLiteral(2, '2'));
            const blueMember = factory.createEnumMember('BLUE', factory.createLiteral(3, '3'));
            const members = [redMember, greenMember, blueMember];
            const enumDecl = factory.createEnumDeclaration('Color', members, false, mockMetadata);
            expect(enumDecl.type).toBe('EnumDeclaration');
            expect(enumDecl.name).toBe('Color');
            expect(enumDecl.members).toEqual(members);
            expect(enumDecl.exported).toBe(false);
            expect(enumDecl.metadata).toEqual(mockMetadata);
        });
        it('should create enum declarations with auto-increment', () => {
            const upMember = factory.createEnumMember('UP', null); // auto-increment
            const downMember = factory.createEnumMember('DOWN', null);
            const leftMember = factory.createEnumMember('LEFT', null);
            const rightMember = factory.createEnumMember('RIGHT', null);
            const members = [upMember, downMember, leftMember, rightMember];
            const enumDecl = factory.createEnumDeclaration('Direction', members, true, mockMetadata);
            expect(enumDecl.type).toBe('EnumDeclaration');
            expect(enumDecl.name).toBe('Direction');
            expect(enumDecl.members).toEqual(members);
            expect(enumDecl.exported).toBe(true);
            expect(enumDecl.metadata).toEqual(mockMetadata);
        });
        it('should create enum declarations with mixed explicit and auto values', () => {
            const menuMember = factory.createEnumMember('MENU', factory.createLiteral(0, '0'));
            const playingMember = factory.createEnumMember('PLAYING', null); // auto-increment
            const pausedMember = factory.createEnumMember('PAUSED', null); // auto-increment
            const gameOverMember = factory.createEnumMember('GAME_OVER', factory.createLiteral(10, '10'));
            const members = [menuMember, playingMember, pausedMember, gameOverMember];
            const enumDecl = factory.createEnumDeclaration('GameState', members, false, mockMetadata);
            expect(enumDecl.type).toBe('EnumDeclaration');
            expect(enumDecl.name).toBe('GameState');
            expect(enumDecl.members).toEqual(members);
            expect(enumDecl.exported).toBe(false);
            expect(enumDecl.metadata).toEqual(mockMetadata);
        });
        it('should create enum members with explicit values', () => {
            const value = factory.createLiteral(42, '42');
            const member = factory.createEnumMember('ANSWER', value, mockMetadata);
            expect(member.type).toBe('EnumMember');
            expect(member.name).toBe('ANSWER');
            expect(member.value).toBe(value);
            expect(member.metadata).toEqual(mockMetadata);
        });
        it('should create enum members without values (auto-increment)', () => {
            const member = factory.createEnumMember('DEFAULT_VALUE', null, mockMetadata);
            expect(member.type).toBe('EnumMember');
            expect(member.name).toBe('DEFAULT_VALUE');
            expect(member.value).toBe(null);
            expect(member.metadata).toEqual(mockMetadata);
        });
        it('should create enum members without metadata', () => {
            const value = factory.createLiteral(5, '5');
            const member = factory.createEnumMember('TEST', value);
            expect(member.type).toBe('EnumMember');
            expect(member.name).toBe('TEST');
            expect(member.value).toBe(value);
            expect(member.metadata).toBeUndefined();
        });
        it('should create empty enum declarations', () => {
            const enumDecl = factory.createEnumDeclaration('Empty', [], false, mockMetadata);
            expect(enumDecl.type).toBe('EnumDeclaration');
            expect(enumDecl.name).toBe('Empty');
            expect(enumDecl.members).toEqual([]);
            expect(enumDecl.exported).toBe(false);
            expect(enumDecl.metadata).toEqual(mockMetadata);
        });
        it('should create exported enum declarations', () => {
            const member = factory.createEnumMember('VALUE', factory.createLiteral(1, '1'));
            const enumDecl = factory.createEnumDeclaration('ExportedEnum', [member], true, mockMetadata);
            expect(enumDecl.type).toBe('EnumDeclaration');
            expect(enumDecl.name).toBe('ExportedEnum');
            expect(enumDecl.members).toEqual([member]);
            expect(enumDecl.exported).toBe(true);
            expect(enumDecl.metadata).toEqual(mockMetadata);
        });
    });
    describe('Import/Export Creation', () => {
        it('should create import declarations', () => {
            const specifiers = [factory.createImportSpecifier('utils', null)];
            const source = factory.createQualifiedName(['core', 'helpers']);
            const importDecl = factory.createImportDeclaration(specifiers, source, mockMetadata);
            expect(importDecl.type).toBe('ImportDeclaration');
            expect(importDecl.specifiers).toEqual(specifiers);
            expect(importDecl.source).toBe(source);
            expect(importDecl.metadata).toEqual(mockMetadata);
        });
        it('should create import specifiers', () => {
            const specifier = factory.createImportSpecifier('originalName', 'localName', mockMetadata);
            expect(specifier.type).toBe('ImportSpecifier');
            expect(specifier.imported).toBe('originalName');
            expect(specifier.local).toBe('localName');
            expect(specifier.metadata).toEqual(mockMetadata);
        });
        it('should create complex qualified names', () => {
            const simpleQualifiedName = factory.createQualifiedName(['c64', 'sprites'], mockMetadata);
            const complexQualifiedName = factory.createQualifiedName(['c64', 'graphics', 'sprites']);
            expect(simpleQualifiedName.type).toBe('QualifiedName');
            expect(simpleQualifiedName.parts).toEqual(['c64', 'sprites']);
            expect(simpleQualifiedName.metadata).toEqual(mockMetadata);
            expect(complexQualifiedName.type).toBe('QualifiedName');
            expect(complexQualifiedName.parts).toEqual(['c64', 'graphics', 'sprites']);
        });
        it('should create export declarations', () => {
            const funcType = factory.createPrimitiveType('void');
            const funcDecl = factory.createFunctionDeclaration('test', [], funcType, []);
            const exportDecl = factory.createExportDeclaration(funcDecl, mockMetadata);
            expect(exportDecl.type).toBe('ExportDeclaration');
            expect(exportDecl.declaration).toBe(funcDecl);
            expect(exportDecl.metadata).toEqual(mockMetadata);
        });
    });
    describe('Type System Creation', () => {
        it('should create primitive types', () => {
            const byteType = factory.createPrimitiveType('byte', mockMetadata);
            const wordType = factory.createPrimitiveType('word');
            const boolType = factory.createPrimitiveType('boolean');
            const voidType = factory.createPrimitiveType('void');
            expect(byteType.type).toBe('PrimitiveType');
            expect(byteType.name).toBe('byte');
            expect(byteType.metadata).toEqual(mockMetadata);
            expect(wordType.type).toBe('PrimitiveType');
            expect(wordType.name).toBe('word');
            expect(boolType.type).toBe('PrimitiveType');
            expect(boolType.name).toBe('boolean');
            expect(voidType.type).toBe('PrimitiveType');
            expect(voidType.name).toBe('void');
        });
        it('should create array types', () => {
            const elementType = factory.createPrimitiveType('byte');
            const size = factory.createLiteral(256, '256');
            const arrayType = factory.createArrayType(elementType, size, mockMetadata);
            expect(arrayType.type).toBe('ArrayType');
            expect(arrayType.elementType).toBe(elementType);
            expect(arrayType.size).toBe(size);
            expect(arrayType.metadata).toEqual(mockMetadata);
        });
        it('should create callback primitive type', () => {
            const callbackType = factory.createPrimitiveType('callback', mockMetadata);
            expect(callbackType.type).toBe('PrimitiveType');
            expect(callbackType.name).toBe('callback');
            expect(callbackType.metadata).toEqual(mockMetadata);
        });
        it('should create callback array type', () => {
            const callbackElementType = factory.createPrimitiveType('callback');
            const size = factory.createLiteral(4, '4');
            const callbackArrayType = factory.createArrayType(callbackElementType, size, mockMetadata);
            expect(callbackArrayType.type).toBe('ArrayType');
            expect(callbackArrayType.elementType.type).toBe('PrimitiveType');
            expect(callbackArrayType.elementType.name).toBe('callback');
            expect(callbackArrayType.size).toBe(size);
            expect(callbackArrayType.metadata).toEqual(mockMetadata);
        });
    });
    describe('Generic Node Creation', () => {
        it('should create generic nodes', () => {
            const node = factory.create('CustomNode', {
                customProperty: 'value',
                metadata: mockMetadata,
            });
            expect(node.type).toBe('CustomNode');
            expect(node.customProperty).toBe('value');
            expect(node.metadata).toEqual(mockMetadata);
        });
    });
    describe('Metadata Handling', () => {
        it('should handle nodes without metadata', () => {
            const identifier = factory.createIdentifier('test');
            expect(identifier.type).toBe('Identifier');
            expect(identifier.name).toBe('test');
            expect(identifier.metadata).toBeUndefined();
        });
        it('should properly attach metadata when provided', () => {
            const identifier = factory.createIdentifier('test', mockMetadata);
            expect(identifier.type).toBe('Identifier');
            expect(identifier.name).toBe('test');
            expect(identifier.metadata).toEqual(mockMetadata);
        });
    });
});
//# sourceMappingURL=ast-factory.test.js.map