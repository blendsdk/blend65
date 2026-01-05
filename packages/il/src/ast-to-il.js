/**
 * AST to IL Transformer for Blend65
 * Task 2.3: Create AST to IL Transformer
 *
 * This file implements the transformation from validated Blend65 AST to IL representation.
 * The transformer uses the visitor pattern to systematically convert each AST node type
 * to appropriate IL instruction sequences.
 *
 * Key Responsibilities:
 * - Transform all Blend65 language constructs to IL instructions
 * - Generate temporary variables for complex expression evaluation
 * - Integrate semantic analysis optimization metadata into IL
 * - Handle all storage classes and addressing mode preferences
 * - Support callback function transformation and indirect calls
 * - Generate proper control flow graphs for optimization passes
 *
 * Educational Focus:
 * - How compilers transform high-level constructs to intermediate representation
 * - Temporary variable management in expression evaluation
 * - Control flow transformation for optimization-friendly representation
 * - Integration of semantic analysis metadata with code generation
 */
import { ILInstructionType, createILConstant, createILVariable, createILTemporary, createILLabel, createILInstruction, createILProgram, createILModule, createILFunction, } from './il-types';
// ============================================================================
// MAIN AST TO IL TRANSFORMER
// ============================================================================
/**
 * Main AST to IL transformer class.
 * Implements the visitor pattern to transform AST nodes to IL instructions.
 */
export class ASTToILTransformer {
    context;
    constructor(symbolTable, options = {}) {
        this.context = {
            currentModule: createILModule([]),
            currentFunction: null,
            symbolTable,
            nextTemporaryId: 0,
            nextInstructionId: 0,
            breakTarget: null,
            continueTarget: null,
            labelCounter: 0,
            errors: [],
            warnings: [],
            useOptimizationMetadata: options.useOptimizationMetadata ?? true,
            targetPlatform: options.targetPlatform ?? 'c64',
        };
    }
    /**
     * Transform a complete Blend65 program to IL.
     */
    transformProgram(program) {
        // Create IL program structure
        const ilProgram = createILProgram(program.module.name.parts.join('.'));
        // Set up module context
        this.context.currentModule = createILModule(program.module.name.parts);
        ilProgram.modules.push(this.context.currentModule);
        // Transform imports
        for (const importDecl of program.imports) {
            this.transformImport(importDecl);
        }
        // Transform declarations
        for (const declaration of program.body) {
            this.transformDeclaration(declaration);
        }
        // Transform exports
        for (const exportDecl of program.exports) {
            this.transformExport(exportDecl);
        }
        return {
            success: this.context.errors.length === 0,
            program: ilProgram,
            errors: this.context.errors,
            warnings: this.context.warnings,
        };
    }
    // ============================================================================
    // IMPORT/EXPORT TRANSFORMERS
    // ============================================================================
    transformImport(importDecl) {
        for (const specifier of importDecl.specifiers) {
            const ilImport = {
                importedName: specifier.imported,
                localName: specifier.local || specifier.imported,
                sourceModule: importDecl.source.parts,
                importType: this.determineImportType(specifier.imported),
            };
            this.context.currentModule.imports.push(ilImport);
        }
    }
    transformExport(exportDecl) {
        // Transform the declaration first
        this.transformDeclaration(exportDecl.declaration);
        // Create export entry
        let exportName;
        let exportType;
        switch (exportDecl.declaration.type) {
            case 'FunctionDeclaration':
                exportName = exportDecl.declaration.name;
                exportType = 'function';
                break;
            case 'VariableDeclaration':
                exportName = exportDecl.declaration.name;
                exportType = 'variable';
                break;
            default:
                this.addError(`Unsupported export declaration type: ${exportDecl.declaration.type}`, exportDecl);
                return;
        }
        const ilExport = {
            exportedName: exportName,
            localName: exportName,
            exportType,
            value: createILVariable(exportName, { kind: 'primitive', name: 'void' }),
        };
        this.context.currentModule.exports.push(ilExport);
    }
    // ============================================================================
    // DECLARATION TRANSFORMERS
    // ============================================================================
    transformDeclaration(declaration) {
        switch (declaration.type) {
            case 'FunctionDeclaration':
                this.transformFunctionDeclaration(declaration);
                break;
            case 'VariableDeclaration':
                this.transformVariableDeclaration(declaration);
                break;
            case 'TypeDeclaration':
                this.transformTypeDeclaration(declaration);
                break;
            case 'EnumDeclaration':
                this.transformEnumDeclaration(declaration);
                break;
            default:
                this.addError(`Unknown declaration type: ${declaration.type}`, declaration);
        }
    }
    transformFunctionDeclaration(funcDecl) {
        // Get function symbol from semantic analysis
        const functionSymbol = this.getSymbol(funcDecl.name);
        if (!functionSymbol || functionSymbol.symbolType !== 'Function') {
            this.addError(`Function symbol not found: ${funcDecl.name}`, funcDecl);
            return;
        }
        // Create IL function
        const ilFunction = createILFunction(funcDecl.name, [...this.context.currentModule.qualifiedName, funcDecl.name], this.transformType(funcDecl.returnType), funcDecl.metadata?.start ?? { line: 0, column: 0, offset: 0 });
        // Set function properties
        ilFunction.isCallback = funcDecl.callback;
        ilFunction.isExported = funcDecl.exported;
        // Transform parameters
        for (let i = 0; i < funcDecl.params.length; i++) {
            const param = funcDecl.params[i];
            const ilParam = {
                name: param.name,
                type: this.transformType(param.paramType),
                index: i,
                passingMethod: this.determineParameterPassingMethod(param, i, functionSymbol),
                optimizationHints: this.createParameterOptimizationHints(param, functionSymbol),
            };
            ilFunction.parameters.push(ilParam);
        }
        // Add optimization metadata
        if (functionSymbol.optimizationMetadata && this.context.useOptimizationMetadata) {
            ilFunction.optimizationMetadata = functionSymbol.optimizationMetadata;
        }
        // Set up function context
        this.context.currentFunction = ilFunction;
        // Transform function body
        for (const statement of funcDecl.body) {
            const result = this.transformStatement(statement);
            ilFunction.instructions.push(...result.instructions);
            // Merge labels
            for (const [labelName, instruction] of result.labels) {
                ilFunction.labels.set(labelName, instruction);
            }
        }
        // Add implicit return if function doesn't end with return
        if (ilFunction.instructions.length === 0 ||
            ilFunction.instructions[ilFunction.instructions.length - 1].type !== ILInstructionType.RETURN) {
            const returnInstruction = createILInstruction(ILInstructionType.RETURN, this.isVoidType(ilFunction.returnType)
                ? []
                : [this.createDefaultValue(ilFunction.returnType)], this.context.nextInstructionId++);
            ilFunction.instructions.push(returnInstruction);
        }
        // Add to module
        this.context.currentModule.functions.push(ilFunction);
        // Clear function context
        this.context.currentFunction = null;
    }
    transformVariableDeclaration(varDecl) {
        // Get variable symbol from semantic analysis
        const variableSymbol = this.getSymbol(varDecl.name);
        if (!variableSymbol || variableSymbol.symbolType !== 'Variable') {
            this.addError(`Variable symbol not found: ${varDecl.name}`, varDecl);
            return;
        }
        if (this.context.currentFunction) {
            // Local variable declaration
            this.transformLocalVariableDeclaration(varDecl, variableSymbol);
        }
        else {
            // Module-level variable declaration
            this.transformModuleVariableDeclaration(varDecl, variableSymbol);
        }
    }
    transformLocalVariableDeclaration(varDecl, variableSymbol) {
        if (!this.context.currentFunction) {
            this.addError('Local variable declaration outside function context', varDecl);
            return;
        }
        // Create IL local variable
        const ilLocalVar = {
            name: varDecl.name,
            type: this.transformType(varDecl.varType),
            allocationMethod: this.determineLocalVariableAllocation(variableSymbol),
            optimizationMetadata: variableSymbol.optimizationMetadata,
            ilOptimizationHints: this.createLocalVariableOptimizationHints(variableSymbol),
        };
        // Add to function
        this.context.currentFunction.localVariables.push(ilLocalVar);
        // Generate declaration instruction
        const declareInstruction = createILInstruction(ILInstructionType.DECLARE_LOCAL, [createILVariable(varDecl.name, ilLocalVar.type, [], varDecl.storageClass, 'local')], this.context.nextInstructionId++, {
            sourceLocation: varDecl.metadata?.start,
            sixtyTwoHints: this.createVariableOptimizationHints(variableSymbol),
        });
        this.context.currentFunction.instructions.push(declareInstruction);
        // Handle initializer
        if (varDecl.initializer) {
            const initResult = this.transformExpression(varDecl.initializer);
            // Add evaluation instructions
            this.context.currentFunction.instructions.push(...initResult.instructions);
            // Generate store instruction
            const storeInstruction = createILInstruction(ILInstructionType.STORE_VARIABLE, [
                createILVariable(varDecl.name, ilLocalVar.type, [], varDecl.storageClass, 'local'),
                initResult.value,
            ], this.context.nextInstructionId++, {
                sourceLocation: varDecl.metadata?.start,
                sixtyTwoHints: this.createVariableOptimizationHints(variableSymbol),
            });
            this.context.currentFunction.instructions.push(storeInstruction);
        }
    }
    transformModuleVariableDeclaration(varDecl, variableSymbol) {
        // Create IL module data
        const ilModuleData = {
            name: varDecl.name,
            type: this.transformType(varDecl.varType),
            storageClass: varDecl.storageClass,
            initialValue: varDecl.initializer
                ? this.evaluateConstantExpression(varDecl.initializer)
                : undefined,
            isExported: varDecl.exported,
            optimizationMetadata: variableSymbol.optimizationMetadata,
        };
        this.context.currentModule.moduleData.push(ilModuleData);
    }
    transformTypeDeclaration(_typeDecl) {
        // Type declarations don't generate IL instructions directly
        // They are handled by the type system in semantic analysis
        // This is a no-op for IL generation
    }
    transformEnumDeclaration(enumDecl) {
        // Get enum symbol from semantic analysis
        const enumSymbol = this.getSymbol(enumDecl.name);
        if (!enumSymbol || enumSymbol.symbolType !== 'Enum') {
            this.addError(`Enum symbol not found: ${enumDecl.name}`, enumDecl);
            return;
        }
        // Generate constants for enum members
        for (const [memberName, memberInfo] of enumSymbol.members) {
            const ilConstant = {
                name: `${enumDecl.name}_${memberName}`,
                type: enumSymbol.underlyingType,
                storageClass: 'const',
                initialValue: createILConstant(enumSymbol.underlyingType, memberInfo.value, 'decimal'),
                isExported: enumDecl.exported,
            };
            this.context.currentModule.moduleData.push(ilConstant);
        }
    }
    // ============================================================================
    // STATEMENT TRANSFORMERS
    // ============================================================================
    transformStatement(statement) {
        switch (statement.type) {
            case 'ExpressionStatement':
                return this.transformExpressionStatement(statement);
            case 'ReturnStatement':
                return this.transformReturnStatement(statement);
            case 'IfStatement':
                return this.transformIfStatement(statement);
            case 'WhileStatement':
                return this.transformWhileStatement(statement);
            case 'ForStatement':
                return this.transformForStatement(statement);
            case 'MatchStatement':
                return this.transformMatchStatement(statement);
            case 'BlockStatement':
                return this.transformBlockStatement(statement);
            case 'BreakStatement':
                return this.transformBreakStatement(statement);
            case 'ContinueStatement':
                return this.transformContinueStatement(statement);
            default:
                this.addError(`Unknown statement type: ${statement.type}`, statement);
                return { instructions: [], alwaysTransfersControl: false, labels: new Map() };
        }
    }
    transformExpressionStatement(exprStmt) {
        const result = this.transformExpression(exprStmt.expression);
        return {
            instructions: result.instructions,
            alwaysTransfersControl: false,
            labels: new Map(),
        };
    }
    transformReturnStatement(returnStmt) {
        const instructions = [];
        const operands = [];
        if (returnStmt.value) {
            const valueResult = this.transformExpression(returnStmt.value);
            instructions.push(...valueResult.instructions);
            operands.push(valueResult.value);
        }
        const returnInstruction = createILInstruction(ILInstructionType.RETURN, operands, this.context.nextInstructionId++, {
            sourceLocation: returnStmt.metadata?.start,
        });
        instructions.push(returnInstruction);
        return {
            instructions,
            alwaysTransfersControl: true,
            labels: new Map(),
        };
    }
    transformIfStatement(ifStmt) {
        const instructions = [];
        const labels = new Map();
        // Transform condition
        const conditionResult = this.transformExpression(ifStmt.condition);
        instructions.push(...conditionResult.instructions);
        // Generate labels
        const elseLabel = this.generateLabel('if_else');
        const endLabel = this.generateLabel('if_end');
        // Branch to else if condition is false
        const branchToElse = createILInstruction(ILInstructionType.BRANCH_IF_FALSE, [conditionResult.value, createILLabel(elseLabel)], this.context.nextInstructionId++);
        instructions.push(branchToElse);
        // Transform then body
        let thenTransfersControl = false;
        for (const stmt of ifStmt.thenBody) {
            const stmtResult = this.transformStatement(stmt);
            instructions.push(...stmtResult.instructions);
            if (stmtResult.alwaysTransfersControl) {
                thenTransfersControl = true;
            }
            // Merge labels
            for (const [labelName, instruction] of stmtResult.labels) {
                labels.set(labelName, instruction);
            }
        }
        // Branch to end if then body doesn't transfer control
        if (!thenTransfersControl) {
            const branchToEnd = createILInstruction(ILInstructionType.BRANCH, [createILLabel(endLabel)], this.context.nextInstructionId++);
            instructions.push(branchToEnd);
        }
        // Else label
        const elseLabelInstruction = createILInstruction(ILInstructionType.LABEL, [createILLabel(elseLabel)], this.context.nextInstructionId++);
        instructions.push(elseLabelInstruction);
        labels.set(elseLabel, instructions.length - 1);
        // Transform else body
        let elseTransfersControl = false;
        if (ifStmt.elseBody) {
            for (const stmt of ifStmt.elseBody) {
                const stmtResult = this.transformStatement(stmt);
                instructions.push(...stmtResult.instructions);
                if (stmtResult.alwaysTransfersControl) {
                    elseTransfersControl = true;
                }
                // Merge labels
                for (const [labelName, instruction] of stmtResult.labels) {
                    labels.set(labelName, instruction);
                }
            }
        }
        // End label
        const endLabelInstruction = createILInstruction(ILInstructionType.LABEL, [createILLabel(endLabel)], this.context.nextInstructionId++);
        instructions.push(endLabelInstruction);
        labels.set(endLabel, instructions.length - 1);
        return {
            instructions,
            alwaysTransfersControl: thenTransfersControl && elseTransfersControl,
            labels,
        };
    }
    transformMatchStatement(matchStmt) {
        const instructions = [];
        const labels = new Map();
        // Transform discriminant
        const discriminantResult = this.transformExpression(matchStmt.discriminant);
        instructions.push(...discriminantResult.instructions);
        // Generate end label
        const endLabel = this.generateLabel('match_end');
        // Transform each case
        for (let i = 0; i < matchStmt.cases.length; i++) {
            const caseStmt = matchStmt.cases[i];
            const caseLabel = this.generateLabel(`match_case_${i}`);
            if (caseStmt.test) {
                // Conditional case
                const testResult = this.transformExpression(caseStmt.test);
                instructions.push(...testResult.instructions);
                // Compare discriminant with case test
                const compareTemp = createILTemporary(this.context.nextTemporaryId++, {
                    kind: 'primitive',
                    name: 'boolean',
                });
                const compareInstruction = createILInstruction(ILInstructionType.COMPARE_EQ, [discriminantResult.value, testResult.value], this.context.nextInstructionId++, { result: compareTemp });
                instructions.push(compareInstruction);
                // Branch to next case if not equal
                const nextCaseLabel = i < matchStmt.cases.length - 1 ? `match_case_${i + 1}` : endLabel;
                const branchToNext = createILInstruction(ILInstructionType.BRANCH_IF_FALSE, [compareTemp, createILLabel(nextCaseLabel)], this.context.nextInstructionId++);
                instructions.push(branchToNext);
            }
            // Case label
            const caseLabelInstruction = createILInstruction(ILInstructionType.LABEL, [createILLabel(caseLabel)], this.context.nextInstructionId++);
            instructions.push(caseLabelInstruction);
            labels.set(caseLabel, instructions.length - 1);
            // Transform case body
            for (const stmt of caseStmt.consequent) {
                const stmtResult = this.transformStatement(stmt);
                instructions.push(...stmtResult.instructions);
                // Merge labels
                for (const [labelName, instruction] of stmtResult.labels) {
                    labels.set(labelName, instruction);
                }
            }
            // Branch to end after case body
            const branchToEnd = createILInstruction(ILInstructionType.BRANCH, [createILLabel(endLabel)], this.context.nextInstructionId++);
            instructions.push(branchToEnd);
        }
        // Default case
        if (matchStmt.defaultCase) {
            for (const stmt of matchStmt.defaultCase.consequent) {
                const stmtResult = this.transformStatement(stmt);
                instructions.push(...stmtResult.instructions);
                // Merge labels
                for (const [labelName, instruction] of stmtResult.labels) {
                    labels.set(labelName, instruction);
                }
            }
        }
        // End label
        const endLabelInstruction = createILInstruction(ILInstructionType.LABEL, [createILLabel(endLabel)], this.context.nextInstructionId++);
        instructions.push(endLabelInstruction);
        labels.set(endLabel, instructions.length - 1);
        return {
            instructions,
            alwaysTransfersControl: false,
            labels,
        };
    }
    transformBlockStatement(blockStmt) {
        const instructions = [];
        const labels = new Map();
        let alwaysTransfersControl = false;
        // Transform each statement in the block
        for (const stmt of blockStmt.statements) {
            const stmtResult = this.transformStatement(stmt);
            instructions.push(...stmtResult.instructions);
            if (stmtResult.alwaysTransfersControl) {
                alwaysTransfersControl = true;
            }
            // Merge labels
            for (const [labelName, instruction] of stmtResult.labels) {
                labels.set(labelName, instruction);
            }
        }
        return {
            instructions,
            alwaysTransfersControl,
            labels,
        };
    }
    transformBreakStatement(breakStmt) {
        if (!this.context.breakTarget) {
            this.addError('Break statement outside loop', breakStmt);
            return { instructions: [], alwaysTransfersControl: false, labels: new Map() };
        }
        const branchInstruction = createILInstruction(ILInstructionType.BRANCH, [createILLabel(this.context.breakTarget)], this.context.nextInstructionId++);
        return {
            instructions: [branchInstruction],
            alwaysTransfersControl: true,
            labels: new Map(),
        };
    }
    transformContinueStatement(continueStmt) {
        if (!this.context.continueTarget) {
            this.addError('Continue statement outside loop', continueStmt);
            return { instructions: [], alwaysTransfersControl: false, labels: new Map() };
        }
        const branchInstruction = createILInstruction(ILInstructionType.BRANCH, [createILLabel(this.context.continueTarget)], this.context.nextInstructionId++);
        return {
            instructions: [branchInstruction],
            alwaysTransfersControl: true,
            labels: new Map(),
        };
    }
    // ============================================================================
    // EXPRESSION TRANSFORMERS
    // ============================================================================
    transformExpression(expression) {
        switch (expression.type) {
            case 'BinaryExpr':
                return this.transformBinaryExpression(expression);
            case 'UnaryExpr':
                return this.transformUnaryExpression(expression);
            case 'AssignmentExpr':
                return this.transformAssignmentExpression(expression);
            case 'CallExpr':
                return this.transformCallExpression(expression);
            case 'MemberExpr':
                return this.transformMemberExpression(expression);
            case 'IndexExpr':
                return this.transformIndexExpression(expression);
            case 'Identifier':
                return this.transformIdentifier(expression);
            case 'Literal':
                return this.transformLiteral(expression);
            case 'ArrayLiteral':
                return this.transformArrayLiteral(expression);
            default:
                this.addError(`Unknown expression type: ${expression.type}`, expression);
                return {
                    value: createILConstant({ kind: 'primitive', name: 'void' }, 0),
                    instructions: [],
                    temporaries: [],
                };
        }
    }
    transformBinaryExpression(binaryExpr) {
        const instructions = [];
        const temporaries = [];
        // Transform left and right operands
        const leftResult = this.transformExpression(binaryExpr.left);
        const rightResult = this.transformExpression(binaryExpr.right);
        instructions.push(...leftResult.instructions);
        instructions.push(...rightResult.instructions);
        temporaries.push(...leftResult.temporaries, ...rightResult.temporaries);
        // Create temporary for result
        const resultType = this.inferBinaryExpressionType(binaryExpr.operator, leftResult.value, rightResult.value);
        const resultTemp = createILTemporary(this.context.nextTemporaryId++, resultType);
        temporaries.push(resultTemp);
        // Generate appropriate instruction based on operator
        let instruction;
        switch (binaryExpr.operator) {
            case '+':
                instruction = createILInstruction(ILInstructionType.ADD, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '-':
                instruction = createILInstruction(ILInstructionType.SUB, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '*':
                instruction = createILInstruction(ILInstructionType.MUL, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '/':
                instruction = createILInstruction(ILInstructionType.DIV, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '%':
                instruction = createILInstruction(ILInstructionType.MOD, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '==':
                instruction = createILInstruction(ILInstructionType.COMPARE_EQ, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '!=':
                instruction = createILInstruction(ILInstructionType.COMPARE_NE, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '<':
                instruction = createILInstruction(ILInstructionType.COMPARE_LT, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '<=':
                instruction = createILInstruction(ILInstructionType.COMPARE_LE, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '>':
                instruction = createILInstruction(ILInstructionType.COMPARE_GT, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '>=':
                instruction = createILInstruction(ILInstructionType.COMPARE_GE, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case 'and':
                instruction = createILInstruction(ILInstructionType.AND, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case 'or':
                instruction = createILInstruction(ILInstructionType.OR, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '&':
                instruction = createILInstruction(ILInstructionType.BITWISE_AND, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '|':
                instruction = createILInstruction(ILInstructionType.BITWISE_OR, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '^':
                instruction = createILInstruction(ILInstructionType.BITWISE_XOR, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '<<':
                instruction = createILInstruction(ILInstructionType.SHIFT_LEFT, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '>>':
                instruction = createILInstruction(ILInstructionType.SHIFT_RIGHT, [leftResult.value, rightResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            default:
                this.addError(`Unknown binary operator: ${binaryExpr.operator}`, binaryExpr);
                instruction = createILInstruction(ILInstructionType.NOP, [], this.context.nextInstructionId++);
        }
        instructions.push(instruction);
        return {
            value: resultTemp,
            instructions,
            temporaries,
        };
    }
    transformUnaryExpression(unaryExpr) {
        const instructions = [];
        const temporaries = [];
        // Transform operand
        const operandResult = this.transformExpression(unaryExpr.operand);
        instructions.push(...operandResult.instructions);
        temporaries.push(...operandResult.temporaries);
        // Create temporary for result
        const resultTemp = createILTemporary(this.context.nextTemporaryId++, this.inferUnaryExpressionType(unaryExpr.operator, operandResult.value));
        temporaries.push(resultTemp);
        // Generate appropriate instruction based on operator
        let instruction;
        switch (unaryExpr.operator) {
            case '-':
                instruction = createILInstruction(ILInstructionType.NEG, [operandResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case 'not':
                instruction = createILInstruction(ILInstructionType.NOT, [operandResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            case '~':
                instruction = createILInstruction(ILInstructionType.BITWISE_NOT, [operandResult.value], this.context.nextInstructionId++, { result: resultTemp });
                break;
            default:
                this.addError(`Unknown unary operator: ${unaryExpr.operator}`, unaryExpr);
                instruction = createILInstruction(ILInstructionType.COPY, [operandResult.value], this.context.nextInstructionId++, { result: resultTemp });
        }
        instructions.push(instruction);
        return {
            value: resultTemp,
            instructions,
            temporaries,
        };
    }
    transformAssignmentExpression(assignExpr) {
        const instructions = [];
        const temporaries = [];
        // Transform right-hand side
        const rightResult = this.transformExpression(assignExpr.right);
        instructions.push(...rightResult.instructions);
        temporaries.push(...rightResult.temporaries);
        // Handle left-hand side assignment target
        if (assignExpr.left.type === 'Identifier') {
            const identifier = assignExpr.left;
            const variable = createILVariable(identifier.name, rightResult.value.valueType === 'constant'
                ? rightResult.value.type
                : { kind: 'primitive', name: 'byte' });
            const storeInstruction = createILInstruction(ILInstructionType.STORE_VARIABLE, [variable, rightResult.value], this.context.nextInstructionId++);
            instructions.push(storeInstruction);
            return {
                value: rightResult.value,
                instructions,
                temporaries,
            };
        }
        // Handle array assignments: arr[index] = value
        if (assignExpr.left.type === 'IndexExpr') {
            const indexExpr = assignExpr.left;
            // Transform array and index expressions
            const arrayResult = this.transformExpression(indexExpr.object);
            const indexResult = this.transformExpression(indexExpr.index);
            instructions.push(...arrayResult.instructions);
            instructions.push(...indexResult.instructions);
            temporaries.push(...arrayResult.temporaries, ...indexResult.temporaries);
            // Generate store array instruction
            const storeArrayInstruction = createILInstruction(ILInstructionType.STORE_ARRAY, [arrayResult.value, indexResult.value, rightResult.value], this.context.nextInstructionId++);
            instructions.push(storeArrayInstruction);
            return {
                value: rightResult.value,
                instructions,
                temporaries,
            };
        }
        // Handle member assignments: obj.member = value
        if (assignExpr.left.type === 'MemberExpr') {
            const memberExpr = assignExpr.left;
            // For now, treat member assignment as a specialized variable assignment
            // TODO: Enhance when full record/struct support is added
            const memberVariable = createILVariable(`${memberExpr.object}.${memberExpr.property}`, rightResult.value.valueType === 'constant'
                ? rightResult.value.type
                : { kind: 'primitive', name: 'byte' });
            const storeMemberInstruction = createILInstruction(ILInstructionType.STORE_VARIABLE, [memberVariable, rightResult.value], this.context.nextInstructionId++);
            instructions.push(storeMemberInstruction);
            return {
                value: rightResult.value,
                instructions,
                temporaries,
            };
        }
        this.addError(`Unsupported assignment target: ${assignExpr.left.type}`, assignExpr);
        return {
            value: rightResult.value,
            instructions,
            temporaries,
        };
    }
    transformCallExpression(callExpr) {
        const instructions = [];
        const temporaries = [];
        // Transform arguments
        const argValues = [];
        for (const arg of callExpr.args) {
            const argResult = this.transformExpression(arg);
            instructions.push(...argResult.instructions);
            temporaries.push(...argResult.temporaries);
            argValues.push(argResult.value);
        }
        // Transform callee
        const calleeResult = this.transformExpression(callExpr.callee);
        instructions.push(...calleeResult.instructions);
        temporaries.push(...calleeResult.temporaries);
        // Create call instruction
        const callInstruction = createILInstruction(ILInstructionType.CALL, [calleeResult.value, ...argValues], this.context.nextInstructionId++);
        instructions.push(callInstruction);
        // Create temporary for return value
        const returnTemp = createILTemporary(this.context.nextTemporaryId++, {
            kind: 'primitive',
            name: 'byte',
        });
        temporaries.push(returnTemp);
        return {
            value: returnTemp,
            instructions,
            temporaries,
        };
    }
    transformMemberExpression(memberExpr) {
        const instructions = [];
        const temporaries = [];
        // Transform the object expression first
        const objectResult = this.transformExpression(memberExpr.object);
        instructions.push(...objectResult.instructions);
        temporaries.push(...objectResult.temporaries);
        // Try to resolve member access from semantic analysis
        if (memberExpr.object.type === 'Identifier') {
            const objectName = memberExpr.object.name;
            const objectSymbol = this.getSymbol(objectName);
            if (objectSymbol && objectSymbol.varType.kind === 'named') {
                // This is a proper record/struct member access
                // For now, treat as offset-based member access
                const memberVariable = createILVariable(`${objectName}.${memberExpr.property}`, { kind: 'primitive', name: 'byte' }, // TODO: Get actual member type from semantic analysis
                [], objectSymbol.storageClass);
                const resultTemp = createILTemporary(this.context.nextTemporaryId++, {
                    kind: 'primitive',
                    name: 'byte',
                });
                const loadMemberInstruction = createILInstruction(ILInstructionType.LOAD_VARIABLE, [memberVariable], this.context.nextInstructionId++, { result: resultTemp });
                instructions.push(loadMemberInstruction);
                temporaries.push(resultTemp);
                return {
                    value: resultTemp,
                    instructions,
                    temporaries,
                };
            }
        }
        // Fallback: treat as simple qualified name access (like c64.sprites.setSpritePosition)
        const qualifiedName = `${memberExpr.object}.${memberExpr.property}`;
        const qualifiedVariable = createILVariable(qualifiedName, {
            kind: 'primitive',
            name: 'byte',
        });
        const resultTemp = createILTemporary(this.context.nextTemporaryId++, {
            kind: 'primitive',
            name: 'byte',
        });
        const loadInstruction = createILInstruction(ILInstructionType.LOAD_VARIABLE, [qualifiedVariable], this.context.nextInstructionId++, { result: resultTemp });
        instructions.push(loadInstruction);
        temporaries.push(resultTemp);
        return {
            value: resultTemp,
            instructions,
            temporaries,
        };
    }
    transformIndexExpression(indexExpr) {
        const instructions = [];
        const temporaries = [];
        // Transform array and index expressions
        const arrayResult = this.transformExpression(indexExpr.object);
        const indexResult = this.transformExpression(indexExpr.index);
        instructions.push(...arrayResult.instructions);
        instructions.push(...indexResult.instructions);
        temporaries.push(...arrayResult.temporaries, ...indexResult.temporaries);
        // Create temporary for result
        const resultTemp = createILTemporary(this.context.nextTemporaryId++, {
            kind: 'primitive',
            name: 'byte',
        });
        temporaries.push(resultTemp);
        // Generate load array instruction
        const loadArrayInstruction = createILInstruction(ILInstructionType.LOAD_ARRAY, [arrayResult.value, indexResult.value], this.context.nextInstructionId++, { result: resultTemp });
        instructions.push(loadArrayInstruction);
        return {
            value: resultTemp,
            instructions,
            temporaries,
        };
    }
    transformIdentifier(identifier) {
        // Look up symbol to determine if it's a variable, function, etc.
        const symbol = this.getSymbol(identifier.name);
        if (symbol && symbol.symbolType === 'Variable') {
            const variableSymbol = symbol;
            const variable = createILVariable(identifier.name, variableSymbol.varType, [], variableSymbol.storageClass, variableSymbol.isLocal ? 'local' : 'global');
            const resultTemp = createILTemporary(this.context.nextTemporaryId++, variableSymbol.varType);
            const loadInstruction = createILInstruction(ILInstructionType.LOAD_VARIABLE, [variable], this.context.nextInstructionId++, { result: resultTemp });
            return {
                value: resultTemp,
                instructions: [loadInstruction],
                temporaries: [resultTemp],
            };
        }
        // For now, treat unknown identifiers as variables
        const variable = createILVariable(identifier.name, { kind: 'primitive', name: 'byte' });
        const resultTemp = createILTemporary(this.context.nextTemporaryId++, {
            kind: 'primitive',
            name: 'byte',
        });
        const loadInstruction = createILInstruction(ILInstructionType.LOAD_VARIABLE, [variable], this.context.nextInstructionId++, { result: resultTemp });
        return {
            value: resultTemp,
            instructions: [loadInstruction],
            temporaries: [resultTemp],
        };
    }
    transformLiteral(literal) {
        const type = this.inferLiteralType(literal);
        const ilConstant = createILConstant(type, literal.value, this.getConstantRepresentation(literal));
        return {
            value: ilConstant,
            instructions: [],
            temporaries: [],
        };
    }
    transformArrayLiteral(arrayLiteral) {
        const instructions = [];
        const temporaries = [];
        if (arrayLiteral.elements.length === 0) {
            // Handle empty array literal
            const resultTemp = createILTemporary(this.context.nextTemporaryId++, {
                kind: 'array',
                elementType: { kind: 'primitive', name: 'byte' },
                size: 0,
            });
            return {
                value: resultTemp,
                instructions: [],
                temporaries: [resultTemp],
            };
        }
        // Determine array element type from first element
        const firstElementResult = this.transformExpression(arrayLiteral.elements[0]);
        const elementType = firstElementResult.value.valueType === 'constant'
            ? firstElementResult.value.type
            : { kind: 'primitive', name: 'byte' };
        // Create array type
        const arrayType = {
            kind: 'array',
            elementType,
            size: arrayLiteral.elements.length,
        };
        // Create temporary for the array
        const arrayTemp = createILTemporary(this.context.nextTemporaryId++, arrayType);
        temporaries.push(arrayTemp);
        // Generate array allocation instruction
        const allocateInstruction = createILInstruction(ILInstructionType.DECLARE_LOCAL, [arrayTemp], this.context.nextInstructionId++);
        instructions.push(allocateInstruction);
        // Transform and store each element
        for (let i = 0; i < arrayLiteral.elements.length; i++) {
            const elementResult = this.transformExpression(arrayLiteral.elements[i]);
            instructions.push(...elementResult.instructions);
            temporaries.push(...elementResult.temporaries);
            // Create index constant
            const indexConstant = createILConstant({ kind: 'primitive', name: 'byte' }, i, 'decimal');
            // Store element at index
            const storeElementInstruction = createILInstruction(ILInstructionType.STORE_ARRAY, [arrayTemp, indexConstant, elementResult.value], this.context.nextInstructionId++);
            instructions.push(storeElementInstruction);
        }
        return {
            value: arrayTemp,
            instructions,
            temporaries,
        };
    }
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    addError(message, astNode) {
        this.context.errors.push({
            message,
            location: astNode?.metadata?.start,
            astNode,
        });
    }
    getSymbol(name) {
        return this.context.symbolTable.get(name);
    }
    determineImportType(importedName) {
        // Try to resolve the imported symbol from semantic analysis
        const symbol = this.getSymbol(importedName);
        if (symbol) {
            switch (symbol.symbolType) {
                case 'Function':
                    return 'function';
                case 'Variable':
                    const varSymbol = symbol;
                    return varSymbol.storageClass === 'const' ? 'constant' : 'variable';
                case 'Enum':
                    return 'constant';
                default:
                    return 'function'; // Default fallback
            }
        }
        // If symbol not found in current table, assume function (most common import)
        return 'function';
    }
    generateLabel(prefix) {
        return `${prefix}_${this.context.labelCounter++}`;
    }
    transformType(typeAnnotation) {
        switch (typeAnnotation.type) {
            case 'PrimitiveType':
                const primType = typeAnnotation;
                return {
                    kind: 'primitive',
                    name: primType.name,
                };
            case 'ArrayType':
                const arrayType = typeAnnotation;
                return {
                    kind: 'array',
                    elementType: this.transformType(arrayType.elementType),
                    size: typeof arrayType.size === 'number' ? arrayType.size : 256, // Default size
                };
            case 'NamedType':
                const namedType = typeAnnotation;
                return { kind: 'named', name: namedType.name };
            case 'RecordType':
                const recordType = typeAnnotation;
                return { kind: 'named', name: recordType.name };
            default:
                return { kind: 'primitive', name: 'byte' };
        }
    }
    isVoidType(type) {
        return type.kind === 'primitive' && type.name === 'void';
    }
    createDefaultValue(type) {
        switch (type.kind) {
            case 'primitive':
                const primType = type;
                switch (primType.name) {
                    case 'boolean':
                        return createILConstant(type, false, 'boolean');
                    case 'byte':
                    case 'word':
                        return createILConstant(type, 0, 'decimal');
                    default:
                        return createILConstant(type, 0, 'decimal');
                }
            default:
                return createILConstant({ kind: 'primitive', name: 'byte' }, 0, 'decimal');
        }
    }
    determineParameterPassingMethod(_param, index, _functionSymbol) {
        // Simple parameter passing strategy
        if (index === 0)
            return 'register_A';
        if (index === 1)
            return 'register_X';
        if (index === 2)
            return 'register_Y';
        return 'stack';
    }
    createParameterOptimizationHints(_param, _functionSymbol) {
        return {
            isReadOnly: true,
            usedInHotPath: false,
            preferredPassingMethod: 'register_A',
        };
    }
    determineLocalVariableAllocation(variableSymbol) {
        // Simple allocation strategy based on optimization metadata
        if (variableSymbol.optimizationMetadata?.registerCandidate?.isCandidate) {
            return 'register';
        }
        if (variableSymbol.storageClass === 'zp' ||
            variableSymbol.optimizationMetadata?.zeroPageCandidate?.isCandidate) {
            return 'zero_page';
        }
        return 'stack';
    }
    createLocalVariableOptimizationHints(variableSymbol) {
        return {
            canRegisterAllocate: variableSymbol.optimizationMetadata?.registerCandidate?.isCandidate ?? false,
            preferredAllocation: this.determineLocalVariableAllocation(variableSymbol),
            registerPriority: 'medium',
        };
    }
    createVariableOptimizationHints(variableSymbol) {
        return {
            preferredRegister: 'A',
            preferredAddressingMode: variableSymbol.storageClass === 'zp' ? 'zero_page' : 'absolute',
            estimatedCycles: 3,
            isHotPath: variableSymbol.optimizationMetadata?.usageStatistics?.estimatedAccessFrequency === 'hot',
        };
    }
    evaluateConstantExpression(expression) {
        // Simple constant evaluation for literals
        if (expression.type === 'Literal') {
            const literal = expression;
            const type = this.inferLiteralType(literal);
            return createILConstant(type, literal.value, this.getConstantRepresentation(literal));
        }
        // TODO: Implement full constant expression evaluation
        return undefined;
    }
    inferBinaryExpressionType(operator, _left, _right) {
        // Comparison operators return boolean
        if (['==', '!=', '<', '<=', '>', '>='].includes(operator)) {
            return { kind: 'primitive', name: 'boolean' };
        }
        // Logical operators return boolean
        if (['and', 'or'].includes(operator)) {
            return { kind: 'primitive', name: 'boolean' };
        }
        // For now, return byte for arithmetic operations
        return { kind: 'primitive', name: 'byte' };
    }
    inferUnaryExpressionType(operator, operand) {
        if (operator === 'not') {
            return { kind: 'primitive', name: 'boolean' };
        }
        // For now, return the same type as the operand
        if (operand.valueType === 'constant') {
            return operand.type;
        }
        return { kind: 'primitive', name: 'byte' };
    }
    inferLiteralType(literal) {
        switch (typeof literal.value) {
            case 'boolean':
                return { kind: 'primitive', name: 'boolean' };
            case 'number':
                return literal.value <= 255 && literal.value >= 0
                    ? { kind: 'primitive', name: 'byte' }
                    : { kind: 'primitive', name: 'word' };
            case 'string':
                return {
                    kind: 'array',
                    elementType: { kind: 'primitive', name: 'byte' },
                    size: literal.value.length,
                };
            default:
                return { kind: 'primitive', name: 'byte' };
        }
    }
    getConstantRepresentation(literal) {
        switch (typeof literal.value) {
            case 'boolean':
                return 'boolean';
            case 'string':
                return 'string';
            case 'number':
                if (literal.raw.startsWith('0x') || literal.raw.startsWith('$')) {
                    return 'hexadecimal';
                }
                if (literal.raw.startsWith('0b')) {
                    return 'binary';
                }
                return 'decimal';
            default:
                return 'decimal';
        }
    }
    transformWhileStatement(whileStmt) {
        const instructions = [];
        const labels = new Map();
        // Generate labels
        const loopLabel = this.generateLabel('while_loop');
        const endLabel = this.generateLabel('while_end');
        // Set up loop targets for break/continue
        const oldBreakTarget = this.context.breakTarget;
        const oldContinueTarget = this.context.continueTarget;
        this.context.breakTarget = endLabel;
        this.context.continueTarget = loopLabel;
        // Loop label
        const loopLabelInstruction = createILInstruction(ILInstructionType.LABEL, [createILLabel(loopLabel)], this.context.nextInstructionId++);
        instructions.push(loopLabelInstruction);
        labels.set(loopLabel, instructions.length - 1);
        // Transform condition
        const conditionResult = this.transformExpression(whileStmt.condition);
        instructions.push(...conditionResult.instructions);
        // Branch to end if condition is false
        const branchToEnd = createILInstruction(ILInstructionType.BRANCH_IF_FALSE, [conditionResult.value, createILLabel(endLabel)], this.context.nextInstructionId++);
        instructions.push(branchToEnd);
        // Transform body
        for (const stmt of whileStmt.body) {
            const stmtResult = this.transformStatement(stmt);
            instructions.push(...stmtResult.instructions);
            // Merge labels
            for (const [labelName, instruction] of stmtResult.labels) {
                labels.set(labelName, instruction);
            }
        }
        // Branch back to loop
        const branchToLoop = createILInstruction(ILInstructionType.BRANCH, [createILLabel(loopLabel)], this.context.nextInstructionId++);
        instructions.push(branchToLoop);
        // End label
        const endLabelInstruction = createILInstruction(ILInstructionType.LABEL, [createILLabel(endLabel)], this.context.nextInstructionId++);
        instructions.push(endLabelInstruction);
        labels.set(endLabel, instructions.length - 1);
        // Restore loop targets
        this.context.breakTarget = oldBreakTarget;
        this.context.continueTarget = oldContinueTarget;
        return {
            instructions,
            alwaysTransfersControl: false,
            labels,
        };
    }
    transformForStatement(forStmt) {
        const instructions = [];
        const labels = new Map();
        // Generate labels
        const loopLabel = this.generateLabel('for_loop');
        const continueLabel = this.generateLabel('for_continue');
        const endLabel = this.generateLabel('for_end');
        // Set up loop targets for break/continue
        const oldBreakTarget = this.context.breakTarget;
        const oldContinueTarget = this.context.continueTarget;
        this.context.breakTarget = endLabel;
        this.context.continueTarget = continueLabel;
        // Transform start value
        const startResult = this.transformExpression(forStmt.start);
        instructions.push(...startResult.instructions);
        // Initialize loop variable
        const loopVar = createILVariable(forStmt.variable, { kind: 'primitive', name: 'byte' });
        const initInstruction = createILInstruction(ILInstructionType.STORE_VARIABLE, [loopVar, startResult.value], this.context.nextInstructionId++);
        instructions.push(initInstruction);
        // Loop label
        const loopLabelInstruction = createILInstruction(ILInstructionType.LABEL, [createILLabel(loopLabel)], this.context.nextInstructionId++);
        instructions.push(loopLabelInstruction);
        labels.set(loopLabel, instructions.length - 1);
        // Transform end condition
        const endResult = this.transformExpression(forStmt.end);
        instructions.push(...endResult.instructions);
        // Load loop variable for comparison
        const loadVar = createILTemporary(this.context.nextTemporaryId++, loopVar.type);
        const loadInstruction = createILInstruction(ILInstructionType.LOAD_VARIABLE, [loopVar], this.context.nextInstructionId++, { result: loadVar });
        instructions.push(loadInstruction);
        // Compare loop variable with end value
        const compareTemp = createILTemporary(this.context.nextTemporaryId++, {
            kind: 'primitive',
            name: 'boolean',
        });
        const compareInstruction = createILInstruction(ILInstructionType.COMPARE_LE, [loadVar, endResult.value], this.context.nextInstructionId++, { result: compareTemp });
        instructions.push(compareInstruction);
        // Branch to end if condition is false
        const branchToEnd = createILInstruction(ILInstructionType.BRANCH_IF_FALSE, [compareTemp, createILLabel(endLabel)], this.context.nextInstructionId++);
        instructions.push(branchToEnd);
        // Transform body
        for (const stmt of forStmt.body) {
            const stmtResult = this.transformStatement(stmt);
            instructions.push(...stmtResult.instructions);
            // Merge labels
            for (const [labelName, instruction] of stmtResult.labels) {
                labels.set(labelName, instruction);
            }
        }
        // Continue label (for continue statements)
        const continueLabelInstruction = createILInstruction(ILInstructionType.LABEL, [createILLabel(continueLabel)], this.context.nextInstructionId++);
        instructions.push(continueLabelInstruction);
        labels.set(continueLabel, instructions.length - 1);
        // Increment loop variable
        const stepValue = forStmt.step
            ? this.transformExpression(forStmt.step).value
            : createILConstant({ kind: 'primitive', name: 'byte' }, 1);
        const incrementTemp = createILTemporary(this.context.nextTemporaryId++, loopVar.type);
        const addInstruction = createILInstruction(ILInstructionType.ADD, [loadVar, stepValue], this.context.nextInstructionId++, { result: incrementTemp });
        instructions.push(addInstruction);
        const storeIncrement = createILInstruction(ILInstructionType.STORE_VARIABLE, [loopVar, incrementTemp], this.context.nextInstructionId++);
        instructions.push(storeIncrement);
        // Branch back to loop
        const branchToLoop = createILInstruction(ILInstructionType.BRANCH, [createILLabel(loopLabel)], this.context.nextInstructionId++);
        instructions.push(branchToLoop);
        // End label
        const endLabelInstruction = createILInstruction(ILInstructionType.LABEL, [createILLabel(endLabel)], this.context.nextInstructionId++);
        instructions.push(endLabelInstruction);
        labels.set(endLabel, instructions.length - 1);
        // Restore loop targets
        this.context.breakTarget = oldBreakTarget;
        this.context.continueTarget = oldContinueTarget;
        return {
            instructions,
            alwaysTransfersControl: false,
            labels,
        };
    }
}
// ============================================================================
// UTILITY FUNCTIONS FOR AST TO IL TRANSFORMATION
// ============================================================================
/**
 * Create a new AST to IL transformer instance.
 */
export function createASTToILTransformer(symbolTable, options) {
    return new ASTToILTransformer(symbolTable, options);
}
/**
 * Transform a complete Blend65 program to IL.
 * Convenience function for one-shot transformation.
 */
export function transformProgramToIL(program, symbolTable, options) {
    const transformer = createASTToILTransformer(symbolTable, options);
    return transformer.transformProgram(program);
}
//# sourceMappingURL=ast-to-il.js.map