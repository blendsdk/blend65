/**
 * Tests for AST to IL Transformer
 * Task 2.3: Create AST to IL Transformer - Test Suite
 *
 * This test suite validates the AST to IL transformation for all Blend65 language constructs.
 * Tests cover expression evaluation, statement transformation, control flow, and optimization
 * metadata integration.
 *
 * Educational Focus:
 * - How AST nodes map to IL instruction sequences
 * - Temporary variable management in expression evaluation
 * - Control flow transformation for optimization
 * - Integration testing for semantic analysis metadata
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ASTToILTransformer, createASTToILTransformer, transformProgramToIL } from '../ast-to-il';
import { ILInstructionType } from '../il-types';
// ============================================================================
// TEST HELPER FUNCTIONS
// ============================================================================
function createMockProgram() {
    return {
        type: 'Program',
        module: {
            type: 'ModuleDeclaration',
            name: {
                type: 'QualifiedName',
                parts: ['Test', 'Module'],
            },
        },
        imports: [],
        exports: [],
        body: [],
    };
}
function createMockSymbolTable() {
    const symbolTable = new Map();
    // Add a sample variable symbol
    const variableSymbol = {
        name: 'testVar',
        symbolType: 'Variable',
        sourceLocation: { line: 1, column: 1, offset: 0 },
        scope: {
            scopeType: 'Global',
            parent: null,
            symbols: new Map(),
            children: [],
        },
        isExported: false,
        varType: { kind: 'primitive', name: 'byte' },
        storageClass: null,
        initialValue: null,
        isLocal: false,
    };
    symbolTable.set('testVar', variableSymbol);
    // Add a sample function symbol
    const functionSymbol = {
        name: 'testFunc',
        symbolType: 'Function',
        sourceLocation: { line: 2, column: 1, offset: 10 },
        scope: {
            scopeType: 'Global',
            parent: null,
            symbols: new Map(),
            children: [],
        },
        isExported: false,
        parameters: [],
        returnType: { kind: 'primitive', name: 'void' },
        isCallback: false,
    };
    symbolTable.set('testFunc', functionSymbol);
    return symbolTable;
}
function createMockLiteral(value) {
    return {
        type: 'Literal',
        value,
        raw: String(value),
    };
}
function createMockIdentifier(name) {
    return {
        type: 'Identifier',
        name,
    };
}
function createMockBinaryExpr(operator, left, right) {
    return {
        type: 'BinaryExpr',
        operator,
        left,
        right,
    };
}
// ============================================================================
// TRANSFORMER CREATION TESTS
// ============================================================================
describe('ASTToILTransformer Creation', () => {
    it('should create transformer with default options', () => {
        const symbolTable = createMockSymbolTable();
        const transformer = createASTToILTransformer(symbolTable);
        expect(transformer).toBeInstanceOf(ASTToILTransformer);
    });
    it('should create transformer with custom options', () => {
        const symbolTable = createMockSymbolTable();
        const transformer = createASTToILTransformer(symbolTable, {
            useOptimizationMetadata: false,
            targetPlatform: 'vic20',
        });
        expect(transformer).toBeInstanceOf(ASTToILTransformer);
    });
    it('should create transformer using factory function', () => {
        const symbolTable = createMockSymbolTable();
        const transformer = new ASTToILTransformer(symbolTable);
        expect(transformer).toBeInstanceOf(ASTToILTransformer);
    });
});
// ============================================================================
// PROGRAM TRANSFORMATION TESTS
// ============================================================================
describe('Program Transformation', () => {
    let symbolTable;
    let transformer;
    beforeEach(() => {
        symbolTable = createMockSymbolTable();
        transformer = createASTToILTransformer(symbolTable);
    });
    it('should transform empty program', () => {
        const program = createMockProgram();
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        expect(result.program.name).toBe('Test.Module');
        expect(result.program.modules).toHaveLength(1);
        expect(result.program.modules[0].qualifiedName).toEqual(['Test', 'Module']);
        expect(result.errors).toHaveLength(0);
    });
    it('should handle transformation errors gracefully', () => {
        const program = createMockProgram();
        // Add invalid declaration
        program.body.push({
            type: 'InvalidDeclaration',
            name: 'invalid',
        });
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain('Unknown declaration type');
    });
    it('should use convenience function for transformation', () => {
        const program = createMockProgram();
        const result = transformProgramToIL(program, symbolTable);
        expect(result.success).toBe(true);
        expect(result.program.name).toBe('Test.Module');
    });
});
// ============================================================================
// EXPRESSION TRANSFORMATION TESTS
// ============================================================================
describe('Expression Transformation', () => {
    let symbolTable;
    let transformer;
    beforeEach(() => {
        symbolTable = createMockSymbolTable();
        transformer = createASTToILTransformer(symbolTable);
    });
    it('should transform literal expressions', () => {
        const program = createMockProgram();
        // Add function with literal expression
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: createMockLiteral(42),
                },
            ],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        expect(result.program.modules[0].functions).toHaveLength(1);
        const ilFunction = result.program.modules[0].functions[0];
        expect(ilFunction.name).toBe('testFunc');
        expect(ilFunction.instructions.length).toBeGreaterThan(0);
    });
    it('should transform binary expressions', () => {
        const program = createMockProgram();
        const binaryExpr = createMockBinaryExpr('+', createMockLiteral(10), createMockLiteral(20));
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: binaryExpr,
                },
            ],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        expect(ilFunction.instructions.length).toBeGreaterThan(0);
        // Should contain ADD instruction
        const addInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.ADD);
        expect(addInstruction).toBeDefined();
    });
    it('should transform identifier expressions', () => {
        const program = createMockProgram();
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: createMockIdentifier('testVar'),
                },
            ],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // Should contain LOAD_VARIABLE instruction
        const loadInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.LOAD_VARIABLE);
        expect(loadInstruction).toBeDefined();
    });
    it('should handle complex arithmetic expressions', () => {
        const program = createMockProgram();
        // Create expression: (10 + 20) * 3
        const innerExpr = createMockBinaryExpr('+', createMockLiteral(10), createMockLiteral(20));
        const outerExpr = createMockBinaryExpr('*', innerExpr, createMockLiteral(3));
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: outerExpr,
                },
            ],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // Should contain both ADD and MUL instructions
        const addInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.ADD);
        const mulInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.MUL);
        expect(addInstruction).toBeDefined();
        expect(mulInstruction).toBeDefined();
    });
});
// ============================================================================
// STATEMENT TRANSFORMATION TESTS
// ============================================================================
describe('Statement Transformation', () => {
    let symbolTable;
    let transformer;
    beforeEach(() => {
        symbolTable = createMockSymbolTable();
        transformer = createASTToILTransformer(symbolTable);
    });
    it('should transform return statements', () => {
        const program = createMockProgram();
        const returnStmt = {
            type: 'ReturnStatement',
            value: createMockLiteral(42),
        };
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'byte' },
            body: [returnStmt],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // Should contain RETURN instruction
        const returnInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.RETURN);
        expect(returnInstruction).toBeDefined();
        expect(returnInstruction.operands).toHaveLength(1);
    });
    it('should transform if statements', () => {
        const program = createMockProgram();
        const ifStmt = {
            type: 'IfStatement',
            condition: createMockBinaryExpr('==', createMockLiteral(1), createMockLiteral(1)),
            thenBody: [
                {
                    type: 'ExpressionStatement',
                    expression: createMockLiteral(100),
                },
            ],
            elseBody: [
                {
                    type: 'ExpressionStatement',
                    expression: createMockLiteral(200),
                },
            ],
        };
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [ifStmt],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // Should contain comparison and branch instructions
        const compareInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.COMPARE_EQ);
        const branchInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.BRANCH_IF_FALSE);
        const labelInstructions = ilFunction.instructions.filter(instr => instr.type === ILInstructionType.LABEL);
        expect(compareInstruction).toBeDefined();
        expect(branchInstruction).toBeDefined();
        expect(labelInstructions.length).toBeGreaterThanOrEqual(2); // if_else and if_end labels
    });
    it('should transform while loops', () => {
        const program = createMockProgram();
        const whileStmt = {
            type: 'WhileStatement',
            condition: createMockBinaryExpr('<', createMockIdentifier('testVar'), createMockLiteral(10)),
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: createMockLiteral(1),
                },
            ],
        };
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [whileStmt],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // Should contain loop structure with labels and branches
        const labelInstructions = ilFunction.instructions.filter(instr => instr.type === ILInstructionType.LABEL);
        const branchInstructions = ilFunction.instructions.filter(instr => instr.type === ILInstructionType.BRANCH || instr.type === ILInstructionType.BRANCH_IF_FALSE);
        expect(labelInstructions.length).toBeGreaterThanOrEqual(2); // loop and end labels
        expect(branchInstructions.length).toBeGreaterThanOrEqual(2); // conditional and back branch
    });
    it('should transform for loops', () => {
        const program = createMockProgram();
        const forStmt = {
            type: 'ForStatement',
            variable: 'i',
            start: createMockLiteral(0),
            end: createMockLiteral(10),
            step: null,
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: createMockLiteral(1),
                },
            ],
        };
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [forStmt],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // Should contain initialization, comparison, increment, and loop structure
        const storeInstructions = ilFunction.instructions.filter(instr => instr.type === ILInstructionType.STORE_VARIABLE);
        const compareInstructions = ilFunction.instructions.filter(instr => instr.type === ILInstructionType.COMPARE_LE);
        const addInstructions = ilFunction.instructions.filter(instr => instr.type === ILInstructionType.ADD);
        expect(storeInstructions.length).toBeGreaterThanOrEqual(2); // Init and increment
        expect(compareInstructions.length).toBeGreaterThanOrEqual(1); // Loop condition
        expect(addInstructions.length).toBeGreaterThanOrEqual(1); // Increment
    });
});
// ============================================================================
// FUNCTION DECLARATION TESTS
// ============================================================================
describe('Function Declaration Transformation', () => {
    let symbolTable;
    let transformer;
    beforeEach(() => {
        symbolTable = createMockSymbolTable();
        transformer = createASTToILTransformer(symbolTable);
    });
    it('should transform simple function declaration', () => {
        const program = createMockProgram();
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        expect(result.program.modules[0].functions).toHaveLength(1);
        const ilFunction = result.program.modules[0].functions[0];
        expect(ilFunction.name).toBe('testFunc');
        expect(ilFunction.parameters).toHaveLength(0);
        expect(ilFunction.isCallback).toBe(false);
        expect(ilFunction.isExported).toBe(false);
        // Should have implicit return for void function
        const returnInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.RETURN);
        expect(returnInstruction).toBeDefined();
    });
    it('should transform function with parameters', () => {
        const program = createMockProgram();
        // Add parameter symbol to symbol table
        const paramSymbol = {
            name: 'funcWithParams',
            symbolType: 'Function',
            sourceLocation: { line: 1, column: 1, offset: 0 },
            scope: {
                scopeType: 'Global',
                parent: null,
                symbols: new Map(),
                children: [],
            },
            isExported: false,
            parameters: [
                {
                    name: 'a',
                    type: { kind: 'primitive', name: 'byte' },
                    optional: false,
                    defaultValue: null,
                },
                {
                    name: 'b',
                    type: { kind: 'primitive', name: 'byte' },
                    optional: false,
                    defaultValue: null,
                },
            ],
            returnType: { kind: 'primitive', name: 'byte' },
            isCallback: false,
        };
        symbolTable.set('funcWithParams', paramSymbol);
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'funcWithParams',
            params: [
                {
                    type: 'Parameter',
                    name: 'a',
                    paramType: { type: 'PrimitiveType', name: 'byte' },
                    optional: false,
                    defaultValue: null,
                },
                {
                    type: 'Parameter',
                    name: 'b',
                    paramType: { type: 'PrimitiveType', name: 'byte' },
                    optional: false,
                    defaultValue: null,
                },
            ],
            returnType: { type: 'PrimitiveType', name: 'byte' },
            body: [],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        expect(ilFunction.parameters).toHaveLength(2);
        expect(ilFunction.parameters[0].name).toBe('a');
        expect(ilFunction.parameters[1].name).toBe('b');
        expect(ilFunction.parameters[0].passingMethod).toBe('register_A');
        expect(ilFunction.parameters[1].passingMethod).toBe('register_X');
    });
    it('should transform callback functions', () => {
        const program = createMockProgram();
        // Add callback function symbol
        const callbackSymbol = {
            name: 'onInterrupt',
            symbolType: 'Function',
            sourceLocation: { line: 1, column: 1, offset: 0 },
            scope: {
                scopeType: 'Global',
                parent: null,
                symbols: new Map(),
                children: [],
            },
            isExported: false,
            parameters: [],
            returnType: { kind: 'primitive', name: 'void' },
            isCallback: true,
        };
        symbolTable.set('onInterrupt', callbackSymbol);
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'onInterrupt',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [],
            exported: false,
            callback: true,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        expect(ilFunction.isCallback).toBe(true);
    });
});
// ============================================================================
// VARIABLE DECLARATION TESTS
// ============================================================================
describe('Variable Declaration Transformation', () => {
    let symbolTable;
    let transformer;
    beforeEach(() => {
        symbolTable = createMockSymbolTable();
        transformer = createASTToILTransformer(symbolTable);
    });
    it('should transform module-level variable declarations', () => {
        const program = createMockProgram();
        const varDecl = {
            type: 'VariableDeclaration',
            storageClass: 'ram',
            name: 'testVar',
            varType: { type: 'PrimitiveType', name: 'byte' },
            initializer: createMockLiteral(42),
            exported: false,
        };
        program.body.push(varDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        expect(result.program.modules[0].moduleData).toHaveLength(1);
        const moduleData = result.program.modules[0].moduleData[0];
        expect(moduleData.name).toBe('testVar');
        expect(moduleData.storageClass).toBe('ram');
        expect(moduleData.initialValue).toBeDefined();
    });
    it('should transform basic variable usage', () => {
        const program = createMockProgram();
        // Simple test: just verify the transformer can handle variable references
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: createMockIdentifier('testVar'),
                },
            ],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        expect(ilFunction.instructions.length).toBeGreaterThan(0);
        // Should contain LOAD_VARIABLE instruction
        const loadInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.LOAD_VARIABLE);
        expect(loadInstruction).toBeDefined();
    });
});
// ============================================================================
// CONTROL FLOW TESTS
// ============================================================================
describe('Control Flow Transformation', () => {
    let symbolTable;
    let transformer;
    beforeEach(() => {
        symbolTable = createMockSymbolTable();
        transformer = createASTToILTransformer(symbolTable);
    });
    it('should generate proper labels for control flow', () => {
        const program = createMockProgram();
        const nestedIfStmt = {
            type: 'IfStatement',
            condition: createMockLiteral(true),
            thenBody: [
                {
                    type: 'IfStatement',
                    condition: createMockLiteral(false),
                    thenBody: [
                        {
                            type: 'ExpressionStatement',
                            expression: createMockLiteral(1),
                        },
                    ],
                    elseBody: null,
                },
            ],
            elseBody: null,
        };
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [nestedIfStmt],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // Should have multiple unique labels for nested control flow
        const labelInstructions = ilFunction.instructions.filter(instr => instr.type === ILInstructionType.LABEL);
        expect(labelInstructions.length).toBeGreaterThanOrEqual(4); // Two if statements = 4 labels
        // All labels should have unique names
        const labelNames = labelInstructions.map(instr => instr.operands[0].name);
        const uniqueLabels = new Set(labelNames);
        expect(uniqueLabels.size).toBe(labelNames.length);
    });
    it('should handle break and continue statements', () => {
        const program = createMockProgram();
        const whileWithBreak = {
            type: 'WhileStatement',
            condition: createMockLiteral(true),
            body: [
                {
                    type: 'BreakStatement',
                },
                {
                    type: 'ContinueStatement',
                },
            ],
        };
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [whileWithBreak],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // Should contain branch instructions for break and continue
        const branchInstructions = ilFunction.instructions.filter(instr => instr.type === ILInstructionType.BRANCH);
        expect(branchInstructions.length).toBeGreaterThanOrEqual(3); // break, continue, back to loop
    });
});
// ============================================================================
// OPTIMIZATION METADATA INTEGRATION TESTS
// ============================================================================
describe('Optimization Metadata Integration', () => {
    let symbolTable;
    let transformer;
    beforeEach(() => {
        symbolTable = createMockSymbolTable();
        transformer = createASTToILTransformer(symbolTable, {
            useOptimizationMetadata: true,
            targetPlatform: 'c64',
        });
    });
    it('should integrate variable optimization metadata', () => {
        const program = createMockProgram();
        // Add variable with optimization metadata
        const optimizedVarSymbol = {
            name: 'hotVar',
            symbolType: 'Variable',
            sourceLocation: { line: 1, column: 1, offset: 0 },
            scope: {
                scopeType: 'Global',
                parent: null,
                symbols: new Map(),
                children: [],
            },
            isExported: false,
            varType: { kind: 'primitive', name: 'byte' },
            storageClass: 'zp',
            initialValue: null,
            isLocal: false,
            optimizationMetadata: {
                usageStatistics: {
                    accessCount: 100,
                    readCount: 80,
                    writeCount: 20,
                    modifyCount: 5,
                    loopUsage: [],
                    hotPathUsage: 50,
                    estimatedAccessFrequency: 'hot',
                    accessPattern: 'hot_path',
                },
                zeroPageCandidate: {
                    isCandidate: true,
                    promotionScore: 95,
                    estimatedBenefit: 40,
                    sizeRequirement: 1,
                    promotionFactors: [],
                    antiPromotionFactors: [],
                    recommendation: 'strongly_recommended',
                },
                registerCandidate: {
                    isCandidate: true,
                    preferredRegister: 'A',
                    alternativeRegisters: ['X'],
                    allocationScore: 85,
                    estimatedBenefit: 30,
                    interferenceInfo: {
                        interferingVariables: [],
                        registerPressure: [],
                        requiresSpilling: false,
                        spillingCost: 0,
                    },
                    usagePatterns: [],
                    recommendation: 'strongly_recommended',
                },
                lifetimeInfo: {
                    definitionPoints: [],
                    usePoints: [],
                    liveRanges: [],
                    spansFunctionCalls: false,
                    spansLoops: true,
                    estimatedDuration: 10,
                    interferingVariables: [],
                },
                sixtyTwoHints: {
                    addressingMode: 'zero_page',
                    memoryBank: 'zero_page',
                    alignmentPreference: {
                        requiredAlignment: 1,
                        preferredAlignment: 1,
                        preferPageBoundary: false,
                        reason: 'none',
                    },
                    hardwareInteraction: {
                        isHardwareRegister: false,
                        isMemoryMappedIO: false,
                        isTimingCritical: false,
                        usedInInterrupts: false,
                        hardwareComponents: [],
                    },
                    optimizationOpportunities: [],
                    performanceHints: [],
                },
                memoryLayout: {
                    preferredRegion: 'zero_page_high_priority',
                    sizeInBytes: 1,
                    alignment: {
                        requiredAlignment: 1,
                        preferredAlignment: 1,
                        preferPageBoundary: false,
                        reason: 'none',
                    },
                    groupingPreference: {
                        shouldGroup: false,
                        groupWith: [],
                        groupingReason: 'cache_locality',
                        layoutPreference: 'sequential',
                    },
                    accessPatterns: [],
                    localityInfo: {
                        spatialLocality: 'high',
                        temporalLocality: 'high',
                        coAccessedVariables: [],
                        workingSetSize: 1,
                        isHotData: true,
                    },
                },
            },
        };
        symbolTable.set('hotVar', optimizedVarSymbol);
        const varDecl = {
            type: 'VariableDeclaration',
            storageClass: 'zp',
            name: 'hotVar',
            varType: { type: 'PrimitiveType', name: 'byte' },
            initializer: null,
            exported: false,
        };
        program.body.push(varDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        expect(result.program.modules[0].moduleData).toHaveLength(1);
        const moduleData = result.program.modules[0].moduleData[0];
        expect(moduleData.optimizationMetadata).toBeDefined();
        expect(moduleData.optimizationMetadata?.zeroPageCandidate?.isCandidate).toBe(true);
    });
    it('should handle transformation without optimization metadata', () => {
        const transformerNoOpt = createASTToILTransformer(symbolTable, {
            useOptimizationMetadata: false,
        });
        const program = createMockProgram();
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformerNoOpt.transformProgram(program);
        expect(result.success).toBe(true);
        expect(result.program.modules[0].functions[0].optimizationMetadata).toBeUndefined();
    });
});
// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================
describe('Error Handling', () => {
    let symbolTable;
    let transformer;
    beforeEach(() => {
        symbolTable = createMockSymbolTable();
        transformer = createASTToILTransformer(symbolTable);
    });
    it('should handle missing function symbols', () => {
        const program = createMockProgram();
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'unknownFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain('Function symbol not found');
    });
    it('should handle missing variable symbols', () => {
        const program = createMockProgram();
        const varDecl = {
            type: 'VariableDeclaration',
            storageClass: null,
            name: 'unknownVar',
            varType: { type: 'PrimitiveType', name: 'byte' },
            initializer: null,
            exported: false,
        };
        program.body.push(varDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain('Variable symbol not found');
    });
    it('should handle break statements outside loops', () => {
        const program = createMockProgram();
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [
                {
                    type: 'BreakStatement',
                },
            ],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain('Break statement outside loop');
    });
    it('should handle continue statements outside loops', () => {
        const program = createMockProgram();
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [
                {
                    type: 'ContinueStatement',
                },
            ],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain('Continue statement outside loop');
    });
});
// ============================================================================
// INTEGRATION TESTS
// ============================================================================
describe('IL Transformation Integration', () => {
    let symbolTable;
    beforeEach(() => {
        symbolTable = createMockSymbolTable();
    });
    it('should transform simple program with variable and function', () => {
        const program = createMockProgram();
        // Add global variable
        const globalVar = {
            type: 'VariableDeclaration',
            storageClass: 'ram',
            name: 'globalCounter',
            varType: { type: 'PrimitiveType', name: 'byte' },
            initializer: createMockLiteral(0),
            exported: true,
        };
        // Add global variable symbol
        const globalVarSymbol = {
            name: 'globalCounter',
            symbolType: 'Variable',
            sourceLocation: { line: 1, column: 1, offset: 0 },
            scope: {
                scopeType: 'Global',
                parent: null,
                symbols: new Map(),
                children: [],
            },
            isExported: true,
            varType: { kind: 'primitive', name: 'byte' },
            storageClass: 'ram',
            initialValue: null,
            isLocal: false,
        };
        symbolTable.set('globalCounter', globalVarSymbol);
        // Add simple main function
        const mainFunc = {
            type: 'FunctionDeclaration',
            name: 'main',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: createMockIdentifier('globalCounter'),
                },
            ],
            exported: true,
            callback: false,
        };
        // Add main function symbol
        const mainFuncSymbol = {
            name: 'main',
            symbolType: 'Function',
            sourceLocation: { line: 2, column: 1, offset: 20 },
            scope: {
                scopeType: 'Global',
                parent: null,
                symbols: new Map(),
                children: [],
            },
            isExported: true,
            parameters: [],
            returnType: { kind: 'primitive', name: 'void' },
            isCallback: false,
        };
        symbolTable.set('main', mainFuncSymbol);
        program.body.push(globalVar, mainFunc);
        const result = transformProgramToIL(program, symbolTable);
        expect(result.success).toBe(true);
        expect(result.program.modules[0].moduleData).toHaveLength(1);
        expect(result.program.modules[0].functions).toHaveLength(1);
        const ilFunction = result.program.modules[0].functions[0];
        expect(ilFunction.name).toBe('main');
        expect(ilFunction.isExported).toBe(true);
    });
    it('should maintain instruction ordering and dependencies', () => {
        const program = createMockProgram();
        const transformer = createASTToILTransformer(symbolTable);
        const complexExpr = createMockBinaryExpr('+', createMockBinaryExpr('*', createMockLiteral(2), createMockLiteral(3)), createMockBinaryExpr('/', createMockLiteral(10), createMockLiteral(2)));
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: complexExpr,
                },
            ],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // Should contain MUL, DIV, and ADD instructions in proper dependency order
        const mulInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.MUL);
        const divInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.DIV);
        const addInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.ADD);
        expect(mulInstruction).toBeDefined();
        expect(divInstruction).toBeDefined();
        expect(addInstruction).toBeDefined();
        // ADD should come after both MUL and DIV
        const mulIndex = ilFunction.instructions.indexOf(mulInstruction);
        const divIndex = ilFunction.instructions.indexOf(divInstruction);
        const addIndex = ilFunction.instructions.indexOf(addInstruction);
        expect(addIndex).toBeGreaterThan(mulIndex);
        expect(addIndex).toBeGreaterThan(divIndex);
    });
});
// ============================================================================
// INSTRUCTION VALIDATION TESTS
// ============================================================================
describe('Generated Instruction Validation', () => {
    let symbolTable;
    let transformer;
    beforeEach(() => {
        symbolTable = createMockSymbolTable();
        transformer = createASTToILTransformer(symbolTable);
    });
    it('should generate valid instruction IDs', () => {
        const program = createMockProgram();
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: createMockBinaryExpr('+', createMockLiteral(1), createMockLiteral(2)),
                },
            ],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // All instructions should have unique, sequential IDs
        const instructionIds = ilFunction.instructions.map(instr => instr.id);
        const uniqueIds = new Set(instructionIds);
        expect(uniqueIds.size).toBe(instructionIds.length);
        expect(instructionIds.every(id => id >= 0)).toBe(true);
    });
    it('should generate proper temporary variable IDs', () => {
        const program = createMockProgram();
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: createMockBinaryExpr('*', createMockBinaryExpr('+', createMockLiteral(1), createMockLiteral(2)), createMockBinaryExpr('-', createMockLiteral(5), createMockLiteral(3))),
                },
            ],
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformer.transformProgram(program);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // Should have multiple instructions with temporary results
        const instructionsWithResults = ilFunction.instructions.filter(instr => instr.result);
        expect(instructionsWithResults.length).toBeGreaterThan(2);
        // Check for temporary variables
        const temporaryResults = instructionsWithResults.filter(instr => instr.result?.valueType === 'temporary');
        expect(temporaryResults.length).toBeGreaterThan(0);
    });
});
// ============================================================================
// COMPREHENSIVE TRANSFORMATION TESTS
// ============================================================================
describe('Comprehensive Language Feature Tests', () => {
    let symbolTable;
    beforeEach(() => {
        symbolTable = createMockSymbolTable();
    });
    it('should handle all supported binary operators', () => {
        const program = createMockProgram();
        const operators = [
            '+',
            '-',
            '*',
            '/',
            '%',
            '==',
            '!=',
            '<',
            '<=',
            '>',
            '>=',
            'and',
            'or',
            '&',
            '|',
            '^',
            '<<',
            '>>',
        ];
        const statements = operators.map(op => ({
            type: 'ExpressionStatement',
            expression: createMockBinaryExpr(op, createMockLiteral(5), createMockLiteral(3)),
        }));
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: statements,
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformProgramToIL(program, symbolTable);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // Should contain instructions for all operators
        const instructionTypes = ilFunction.instructions.map(instr => instr.type);
        const uniqueInstructionTypes = new Set(instructionTypes);
        // Should have multiple different instruction types
        expect(uniqueInstructionTypes.size).toBeGreaterThan(10);
    });
    it('should handle all supported unary operators', () => {
        const program = createMockProgram();
        const operators = ['-', 'not', '~'];
        const statements = operators.map(op => ({
            type: 'ExpressionStatement',
            expression: {
                type: 'UnaryExpr',
                operator: op,
                operand: createMockLiteral(5),
            },
        }));
        const funcDecl = {
            type: 'FunctionDeclaration',
            name: 'testFunc',
            params: [],
            returnType: { type: 'PrimitiveType', name: 'void' },
            body: statements,
            exported: false,
            callback: false,
        };
        program.body.push(funcDecl);
        const result = transformProgramToIL(program, symbolTable);
        expect(result.success).toBe(true);
        const ilFunction = result.program.modules[0].functions[0];
        // Should contain NEG, NOT, and BITWISE_NOT instructions
        const negInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.NEG);
        const notInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.NOT);
        const bitwiseNotInstruction = ilFunction.instructions.find(instr => instr.type === ILInstructionType.BITWISE_NOT);
        expect(negInstruction).toBeDefined();
        expect(notInstruction).toBeDefined();
        expect(bitwiseNotInstruction).toBeDefined();
    });
});
//# sourceMappingURL=ast-to-il.test.js.map