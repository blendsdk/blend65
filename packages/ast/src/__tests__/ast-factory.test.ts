import { describe, it, expect } from 'vitest';
import { ASTNodeFactory } from '../ast-factory.js';
import {
  Program,
  ModuleDeclaration,
  QualifiedName,
  VariableDeclaration,
  FunctionDeclaration,
  ImportDeclaration,
  BinaryExpr,
  Literal,
  Identifier
} from '../ast-types/core.js';

describe('ASTNodeFactory', () => {
  const factory = new ASTNodeFactory();
  const mockMetadata = {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 10, offset: 9 }
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
      const args = [
        factory.createLiteral(5, '5'),
        factory.createLiteral(10, '10')
      ];
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
        factory.createLiteral(3, '3')
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
      const condition = factory.createBinaryExpr('==',
        factory.createIdentifier('x'),
        factory.createLiteral(5, '5')
      );
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
      const condition = factory.createBinaryExpr('<',
        factory.createIdentifier('i'),
        factory.createLiteral(10, '10')
      );
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
  });

  describe('Declaration Creation', () => {
    it('should create function declarations', () => {
      const paramType = factory.createPrimitiveType('byte');
      const params = [factory.createParameter('x', paramType)];
      const returnType = factory.createPrimitiveType('void');
      const body = [factory.createExpressionStatement(factory.createIdentifier('test'))];

      const funcDecl = factory.createFunctionDeclaration(
        'testFunc',
        params,
        returnType,
        body,
        true,
        mockMetadata
      );

      expect(funcDecl.type).toBe('FunctionDeclaration');
      expect(funcDecl.name).toBe('testFunc');
      expect(funcDecl.params).toEqual(params);
      expect(funcDecl.returnType).toBe(returnType);
      expect(funcDecl.body).toEqual(body);
      expect(funcDecl.exported).toBe(true);
      expect(funcDecl.metadata).toEqual(mockMetadata);
    });

    it('should create variable declarations', () => {
      const varType = factory.createPrimitiveType('byte');
      const initializer = factory.createLiteral(0, '0');
      const placement = factory.createMemoryPlacement(factory.createLiteral(0xD000, '$D000'));

      const varDecl = factory.createVariableDeclaration(
        'counter',
        varType,
        initializer,
        'zp',
        placement,
        false,
        mockMetadata
      );

      expect(varDecl.type).toBe('VariableDeclaration');
      expect(varDecl.name).toBe('counter');
      expect(varDecl.varType).toBe(varType);
      expect(varDecl.initializer).toBe(initializer);
      expect(varDecl.storageClass).toBe('zp');
      expect(varDecl.placement).toBe(placement);
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

    it('should create memory placement', () => {
      const address = factory.createLiteral(0xD000, '$D000');
      const placement = factory.createMemoryPlacement(address, mockMetadata);

      expect(placement.type).toBe('MemoryPlacement');
      expect(placement.address).toBe(address);
      expect(placement.metadata).toEqual(mockMetadata);
    });
  });

  describe('Generic Node Creation', () => {
    it('should create generic nodes', () => {
      const node = factory.create('CustomNode', {
        customProperty: 'value',
        metadata: mockMetadata
      });

      expect(node.type).toBe('CustomNode');
      expect((node as any).customProperty).toBe('value');
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
