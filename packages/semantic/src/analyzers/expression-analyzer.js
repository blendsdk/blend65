/**
 * Expression and Statement Analysis Implementation
 * Task 1.7: Expression and Statement Analysis Implementation
 *
 * This analyzer provides comprehensive expression and statement validation with
 * maximum optimization metadata collection for human-level peephole optimization.
 *
 * Optimization Intelligence Focus:
 * - Collect all data a human 6502 expert would use for manual optimization
 * - Variable usage patterns for zero page promotion decisions
 * - Expression complexity metrics for inlining decisions
 * - Constant folding opportunities identification
 * - Side effect analysis for code motion optimization
 * - Register allocation hints based on usage patterns
 * - Loop context awareness for optimization decisions
 * - Hardware interaction patterns for 6502-specific optimizations
 *
 * Educational Focus:
 * - How compilers collect optimization metadata during semantic analysis
 * - Expression tree traversal patterns for analysis
 * - Side effect detection algorithms
 * - Performance-critical code identification
 * - 6502-specific optimization opportunity recognition
 */
import { isVariableSymbol, isFunctionSymbol, isAssignmentCompatible, typeToString, createPrimitiveType, isPrimitiveType, isArrayType, isCallbackType, createArrayType, } from '../types.js';
// ============================================================================
// EXPRESSION ANALYZER IMPLEMENTATION
// ============================================================================
/**
 * Comprehensive expression and statement analyzer with maximum optimization
 * metadata collection for human-level peephole optimization decisions.
 */
export class ExpressionAnalyzer {
    symbolTable;
    typeChecker;
    errors = [];
    warnings = [];
    optimizationMetadata = new Map();
    statementMetadata = new Map();
    constructor(symbolTable, typeChecker) {
        this.symbolTable = symbolTable;
        this.typeChecker = typeChecker;
    }
    /**
     * Get the type checker instance.
     */
    getTypeChecker() {
        return this.typeChecker;
    }
    // ============================================================================
    // MAIN ANALYSIS METHODS
    // ============================================================================
    /**
     * Analyze an expression with comprehensive optimization metadata collection.
     */
    analyzeExpression(expr, context) {
        const result = {
            expression: expr,
            resolvedType: createPrimitiveType('void'), // Will be determined
            optimizationData: this.createDefaultOptimizationData(),
            errors: [],
            warnings: [],
        };
        // Clear any previous errors for this analysis
        const previousErrorCount = this.errors.length;
        const previousWarningCount = this.warnings.length;
        // Type analysis
        result.resolvedType = this.analyzeExpressionType(expr, context);
        // Optimization metadata collection
        result.optimizationData = this.collectExpressionMetadata(expr, context);
        // Store in cache for later reference
        this.optimizationMetadata.set(expr, result.optimizationData);
        // Copy only new errors/warnings from this analysis into the result
        result.errors.push(...this.errors.slice(previousErrorCount));
        result.warnings.push(...this.warnings.slice(previousWarningCount));
        return result;
    }
    /**
     * Analyze a statement with optimization metadata collection.
     */
    analyzeStatement(stmt, context) {
        const result = {
            statement: stmt,
            expressions: [],
            controlFlow: this.createDefaultControlFlow(),
            optimizationData: this.createDefaultStatementOptimizationData(),
            errors: [],
            warnings: [],
        };
        // Track errors from this analysis
        const previousErrorCount = this.errors.length;
        const previousWarningCount = this.warnings.length;
        try {
            // Analyze expressions within the statement
            result.expressions = this.extractAndAnalyzeExpressions(stmt, context);
            // Analyze control flow
            result.controlFlow = this.analyzeControlFlow(stmt, context);
            // Collect statement-level optimization metadata
            result.optimizationData = this.collectStatementMetadata(stmt, context);
            // Store in cache
            this.statementMetadata.set(stmt, result.optimizationData);
        }
        catch (error) {
            const semanticError = {
                errorType: 'InvalidOperation',
                message: `Statement analysis failed: ${error instanceof Error ? error.message : String(error)}`,
                location: stmt.metadata?.start || { line: 0, column: 0, offset: 0 },
                suggestions: ['Check statement syntax and semantic correctness'],
            };
            result.errors.push(semanticError);
            this.errors.push(semanticError);
        }
        // Copy any new errors/warnings from this analysis into the result
        result.errors.push(...this.errors.slice(previousErrorCount));
        result.warnings.push(...this.warnings.slice(previousWarningCount));
        return result;
    }
    /**
     * Analyze a block of statements.
     */
    analyzeBlock(statements, context) {
        const result = {
            statements: [],
            blockOptimizationData: this.createDefaultBlockOptimizationData(),
            errors: [],
            warnings: [],
        };
        // Analyze each statement
        for (const stmt of statements) {
            const stmtResult = this.analyzeStatement(stmt, context);
            result.statements.push(stmtResult);
            result.errors.push(...stmtResult.errors);
            result.warnings.push(...stmtResult.warnings);
        }
        // Collect block-level optimization metadata
        result.blockOptimizationData = this.collectBlockMetadata(result.statements, context);
        return result;
    }
    // ============================================================================
    // EXPRESSION TYPE ANALYSIS
    // ============================================================================
    /**
     * Determine the type of an expression.
     */
    analyzeExpressionType(expr, context) {
        switch (expr.type) {
            case 'BinaryExpr':
                return this.analyzeBinaryExpressionType(expr, context);
            case 'UnaryExpr':
                return this.analyzeUnaryExpressionType(expr, context);
            case 'AssignmentExpr':
                return this.analyzeAssignmentExpressionType(expr, context);
            case 'CallExpr':
                return this.analyzeCallExpressionType(expr, context);
            case 'MemberExpr':
                return this.analyzeMemberExpressionType(expr, context);
            case 'IndexExpr':
                return this.analyzeIndexExpressionType(expr, context);
            case 'Identifier':
                return this.analyzeIdentifierType(expr, context);
            case 'Literal':
                return this.analyzeLiteralType(expr, context);
            case 'ArrayLiteral':
                return this.analyzeArrayLiteralType(expr, context);
            default:
                this.addError({
                    errorType: 'InvalidOperation',
                    message: `Unknown expression type: ${expr.type}`,
                    location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                });
                return createPrimitiveType('void');
        }
    }
    /**
     * Analyze binary expression type and collect optimization metadata.
     */
    analyzeBinaryExpressionType(expr, context) {
        const leftType = this.analyzeExpressionType(expr.left, context);
        const rightType = this.analyzeExpressionType(expr.right, context);
        // Arithmetic operators
        if (['+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>'].includes(expr.operator)) {
            // For arithmetic, allow mixed byte/word operations (promote to word)
            if (isPrimitiveType(leftType) && isPrimitiveType(rightType)) {
                const leftIsNumeric = leftType.name === 'byte' || leftType.name === 'word';
                const rightIsNumeric = rightType.name === 'byte' || rightType.name === 'word';
                if (!leftIsNumeric || !rightIsNumeric) {
                    this.addError({
                        errorType: 'TypeMismatch',
                        message: `Cannot perform '${expr.operator}' on types '${typeToString(leftType)}' and '${typeToString(rightType)}'`,
                        location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                        suggestions: ['Use explicit type conversion', 'Ensure both operands are numeric types'],
                    });
                }
                // Result type is the "larger" of the two types
                if (leftType.name === 'word' || rightType.name === 'word') {
                    return createPrimitiveType('word');
                }
                return createPrimitiveType('byte');
            }
            return leftType;
        }
        // Comparison operators
        if (['==', '!=', '<', '<=', '>', '>='].includes(expr.operator)) {
            // Comparisons can work with mixed byte/word
            if (isPrimitiveType(leftType) && isPrimitiveType(rightType)) {
                const leftIsComparable = leftType.name === 'byte' || leftType.name === 'word' || leftType.name === 'boolean';
                const rightIsComparable = rightType.name === 'byte' || rightType.name === 'word' || rightType.name === 'boolean';
                if (!leftIsComparable || !rightIsComparable) {
                    this.addError({
                        errorType: 'TypeMismatch',
                        message: `Cannot compare types '${typeToString(leftType)}' and '${typeToString(rightType)}'`,
                        location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                    });
                }
            }
            return createPrimitiveType('boolean');
        }
        // Logical operators
        if (['&&', '||'].includes(expr.operator)) {
            // Both operands should be boolean-compatible
            return createPrimitiveType('boolean');
        }
        this.addError({
            errorType: 'InvalidOperation',
            message: `Unknown binary operator: ${expr.operator}`,
            location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        });
        return createPrimitiveType('void');
    }
    /**
     * Analyze unary expression type.
     */
    analyzeUnaryExpressionType(expr, context) {
        const operandType = this.analyzeExpressionType(expr.operand, context);
        switch (expr.operator) {
            case '-':
            case '+':
            case '~':
                // These preserve the operand type
                return operandType;
            case '!':
                // Logical not always returns boolean
                return createPrimitiveType('boolean');
            case '++':
            case '--':
                // Increment/decrement preserves type but requires numeric type
                if (isPrimitiveType(operandType) &&
                    (operandType.name === 'byte' || operandType.name === 'word')) {
                    return operandType;
                }
                this.addError({
                    errorType: 'TypeMismatch',
                    message: `Cannot apply '${expr.operator}' to type '${typeToString(operandType)}'`,
                    location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                });
                return operandType;
            default:
                this.addError({
                    errorType: 'InvalidOperation',
                    message: `Unknown unary operator: ${expr.operator}`,
                    location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                });
                return createPrimitiveType('void');
        }
    }
    /**
     * Analyze assignment expression type.
     */
    analyzeAssignmentExpressionType(expr, context) {
        const leftType = this.analyzeExpressionType(expr.left, context);
        const rightType = this.analyzeExpressionType(expr.right, context);
        // Check assignment compatibility
        if (!isAssignmentCompatible(leftType, rightType)) {
            this.addError({
                errorType: 'TypeMismatch',
                message: `Cannot assign '${typeToString(rightType)}' to '${typeToString(leftType)}'`,
                location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                suggestions: ['Use explicit type conversion', 'Check variable declaration type'],
            });
        }
        // Assignment expression returns the assigned value type
        return leftType;
    }
    /**
     * Analyze call expression type.
     */
    analyzeCallExpressionType(expr, context) {
        // Analyze callee
        const calleeType = this.analyzeExpressionType(expr.callee, context);
        // If callee is a function identifier, get the function symbol
        if (expr.callee.type === 'Identifier') {
            const functionSymbol = this.symbolTable.lookupSymbol(expr.callee.name);
            if (functionSymbol && isFunctionSymbol(functionSymbol)) {
                // Validate argument count
                if (expr.args.length !== functionSymbol.parameters.length) {
                    this.addError({
                        errorType: 'TypeMismatch',
                        message: `Function '${functionSymbol.name}' expects ${functionSymbol.parameters.length} arguments, got ${expr.args.length}`,
                        location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                    });
                }
                // Validate argument types
                for (let i = 0; i < Math.min(expr.args.length, functionSymbol.parameters.length); i++) {
                    const argType = this.analyzeExpressionType(expr.args[i], context);
                    const paramType = functionSymbol.parameters[i].type;
                    if (!isAssignmentCompatible(paramType, argType)) {
                        this.addError({
                            errorType: 'TypeMismatch',
                            message: `Argument ${i + 1} to function '${functionSymbol.name}': expected '${typeToString(paramType)}', got '${typeToString(argType)}'`,
                            location: expr.args[i].metadata?.start || { line: 0, column: 0, offset: 0 },
                        });
                    }
                }
                return functionSymbol.returnType;
            }
        }
        // Callback function call
        if (isCallbackType(calleeType)) {
            // Validate arguments against callback signature
            if (expr.args.length !== calleeType.parameterTypes.length) {
                this.addError({
                    errorType: 'TypeMismatch',
                    message: `Callback expects ${calleeType.parameterTypes.length} arguments, got ${expr.args.length}`,
                    location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                });
            }
            return calleeType.returnType;
        }
        this.addError({
            errorType: 'TypeMismatch',
            message: `Expression is not callable`,
            location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        });
        return createPrimitiveType('void');
    }
    /**
     * Analyze member expression type.
     */
    analyzeMemberExpressionType(expr, context) {
        this.analyzeExpressionType(expr.object, context);
        // For now, assume member access is valid and return byte type
        // Full implementation would check struct/object field types
        this.addWarning({
            errorType: 'InvalidOperation',
            message: 'Member expression analysis not fully implemented',
            location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        });
        return createPrimitiveType('byte');
    }
    /**
     * Analyze index expression type (array access).
     */
    analyzeIndexExpressionType(expr, context) {
        const arrayType = this.analyzeExpressionType(expr.object, context);
        const indexType = this.analyzeExpressionType(expr.index, context);
        // Index must be numeric
        if (!isPrimitiveType(indexType) || (indexType.name !== 'byte' && indexType.name !== 'word')) {
            this.addError({
                errorType: 'TypeMismatch',
                message: `Array index must be numeric, got '${typeToString(indexType)}'`,
                location: expr.index.metadata?.start || { line: 0, column: 0, offset: 0 },
            });
        }
        // Return element type if array
        if (isArrayType(arrayType)) {
            return arrayType.elementType;
        }
        this.addError({
            errorType: 'TypeMismatch',
            message: `Cannot index into non-array type '${typeToString(arrayType)}'`,
            location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        });
        return createPrimitiveType('void');
    }
    /**
     * Analyze identifier type.
     */
    analyzeIdentifierType(expr, _context) {
        const symbol = this.symbolTable.lookupSymbol(expr.name);
        if (!symbol) {
            this.addError({
                errorType: 'UndefinedSymbol',
                message: `Undefined symbol '${expr.name}'`,
                location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                suggestions: [`Check if '${expr.name}' is declared`, 'Verify variable name spelling'],
            });
            return createPrimitiveType('void');
        }
        if (isVariableSymbol(symbol)) {
            return symbol.varType;
        }
        if (isFunctionSymbol(symbol)) {
            // Function identifiers are treated as callback types when not called
            return {
                kind: 'callback',
                parameterTypes: symbol.parameters.map(p => p.type),
                returnType: symbol.returnType,
            };
        }
        // Other symbol types (types, enums) not directly usable as expressions
        this.addError({
            errorType: 'InvalidOperation',
            message: `Symbol '${expr.name}' cannot be used as an expression`,
            location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        });
        return createPrimitiveType('void');
    }
    /**
     * Analyze literal type.
     */
    analyzeLiteralType(expr, _context) {
        if (typeof expr.value === 'number') {
            // Check range for 6502 compatibility
            if (expr.value < 0 || expr.value > 65535) {
                this.addError({
                    errorType: 'TypeMismatch',
                    message: `Number literal ${expr.value} is out of range for 6502 (0-65535)`,
                    location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                    suggestions: ['Use a number within the valid range'],
                });
                return createPrimitiveType('void');
            }
            // Determine if byte or word
            return expr.value <= 255 ? createPrimitiveType('byte') : createPrimitiveType('word');
        }
        if (typeof expr.value === 'boolean') {
            return createPrimitiveType('boolean');
        }
        if (typeof expr.value === 'string') {
            // String literals are treated as byte arrays
            return createArrayType(createPrimitiveType('byte'), expr.value.length);
        }
        this.addError({
            errorType: 'InvalidOperation',
            message: `Unknown literal type: ${typeof expr.value}`,
            location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
        });
        return createPrimitiveType('void');
    }
    /**
     * Analyze array literal type.
     */
    analyzeArrayLiteralType(expr, context) {
        if (expr.elements.length === 0) {
            this.addError({
                errorType: 'TypeMismatch',
                message: 'Empty array literals are not allowed',
                location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                suggestions: ['Provide at least one element to determine array type'],
            });
            return createPrimitiveType('void');
        }
        // Determine element type from first element
        const firstElementType = this.analyzeExpressionType(expr.elements[0], context);
        // Check that all elements are compatible
        for (let i = 1; i < expr.elements.length; i++) {
            const elementType = this.analyzeExpressionType(expr.elements[i], context);
            if (!isAssignmentCompatible(firstElementType, elementType)) {
                this.addError({
                    errorType: 'TypeMismatch',
                    message: `Array element ${i + 1} type '${typeToString(elementType)}' is not compatible with array type '${typeToString(firstElementType)}'`,
                    location: expr.elements[i].metadata?.start || { line: 0, column: 0, offset: 0 },
                });
            }
        }
        return createArrayType(firstElementType, expr.elements.length);
    }
    // ============================================================================
    // OPTIMIZATION METADATA COLLECTION
    // ============================================================================
    /**
     * Collect comprehensive optimization metadata for an expression.
     */
    collectExpressionMetadata(expr, _context) {
        const metadata = this.createDefaultOptimizationData();
        // Basic properties
        metadata.depth = this.calculateExpressionDepth(expr);
        metadata.nodeCount = this.countExpressionNodes(expr);
        // Constant analysis
        this.analyzeConstantProperties(expr, metadata, _context);
        // Variable usage analysis
        metadata.usedVariables = this.collectVariableReferences(expr, _context);
        metadata.hasVariableAccess = metadata.usedVariables.length > 0;
        metadata.variableAccessPattern = this.analyzeVariableAccessPattern(metadata.usedVariables, _context);
        // Side effect analysis
        this.analyzeSideEffects(expr, metadata, _context);
        // Performance analysis
        this.analyzePerformanceCharacteristics(expr, metadata, _context);
        // 6502-specific hints
        this.collect6502OptimizationHints(expr, metadata, _context);
        // Loop context analysis
        this.analyzeLoopContext(expr, metadata, _context);
        // Optimization opportunities
        this.identifyOptimizationOpportunities(expr, metadata, _context);
        return metadata;
    }
    /**
     * Calculate the depth of an expression tree.
     */
    calculateExpressionDepth(expr) {
        switch (expr.type) {
            case 'BinaryExpr':
                const binaryExpr = expr;
                return (1 +
                    Math.max(this.calculateExpressionDepth(binaryExpr.left), this.calculateExpressionDepth(binaryExpr.right)));
            case 'UnaryExpr':
                const unaryExpr = expr;
                return 1 + this.calculateExpressionDepth(unaryExpr.operand);
            case 'AssignmentExpr':
                const assignExpr = expr;
                return (1 +
                    Math.max(this.calculateExpressionDepth(assignExpr.left), this.calculateExpressionDepth(assignExpr.right)));
            case 'CallExpr':
                const callExpr = expr;
                const calleeDepth = this.calculateExpressionDepth(callExpr.callee);
                const maxArgDepth = callExpr.args.length > 0
                    ? Math.max(...callExpr.args.map(arg => this.calculateExpressionDepth(arg)))
                    : 0;
                return 1 + Math.max(calleeDepth, maxArgDepth);
            case 'MemberExpr':
                const memberExpr = expr;
                return 1 + this.calculateExpressionDepth(memberExpr.object);
            case 'IndexExpr':
                const indexExpr = expr;
                return (1 +
                    Math.max(this.calculateExpressionDepth(indexExpr.object), this.calculateExpressionDepth(indexExpr.index)));
            case 'ArrayLiteral':
                const arrayLit = expr;
                return arrayLit.elements.length > 0
                    ? 1 + Math.max(...arrayLit.elements.map(elem => this.calculateExpressionDepth(elem)))
                    : 1;
            default:
                return 1; // Leaf nodes (Identifier, Literal)
        }
    }
    /**
     * Count total nodes in an expression tree.
     */
    countExpressionNodes(expr) {
        switch (expr.type) {
            case 'BinaryExpr':
                const binaryExpr = expr;
                return (1 +
                    this.countExpressionNodes(binaryExpr.left) +
                    this.countExpressionNodes(binaryExpr.right));
            case 'UnaryExpr':
                const unaryExpr = expr;
                return 1 + this.countExpressionNodes(unaryExpr.operand);
            case 'AssignmentExpr':
                const assignExpr = expr;
                return (1 +
                    this.countExpressionNodes(assignExpr.left) +
                    this.countExpressionNodes(assignExpr.right));
            case 'CallExpr':
                const callExpr = expr;
                const calleeNodes = this.countExpressionNodes(callExpr.callee);
                const argNodes = callExpr.args.reduce((sum, arg) => sum + this.countExpressionNodes(arg), 0);
                return 1 + calleeNodes + argNodes;
            case 'MemberExpr':
                const memberExpr = expr;
                return 1 + this.countExpressionNodes(memberExpr.object);
            case 'IndexExpr':
                const indexExpr = expr;
                return (1 +
                    this.countExpressionNodes(indexExpr.object) +
                    this.countExpressionNodes(indexExpr.index));
            case 'ArrayLiteral':
                const arrayLit = expr;
                return (1 + arrayLit.elements.reduce((sum, elem) => sum + this.countExpressionNodes(elem), 0));
            default:
                return 1; // Leaf nodes
        }
    }
    /**
     * Recursively collect variable references from an expression.
     */
    collectVariableReferences(expr, context) {
        const references = [];
        switch (expr.type) {
            case 'Identifier':
                const identifier = expr;
                const symbol = this.symbolTable.lookupSymbol(identifier.name);
                if (symbol && isVariableSymbol(symbol)) {
                    references.push({
                        symbol: symbol,
                        accessType: context.inAssignment ? 'write' : 'read',
                        location: identifier.metadata?.start || { line: 0, column: 0, offset: 0 },
                        context: context,
                    });
                }
                break;
            case 'BinaryExpr':
                const binaryExpr = expr;
                references.push(...this.collectVariableReferences(binaryExpr.left, context));
                references.push(...this.collectVariableReferences(binaryExpr.right, context));
                break;
            case 'UnaryExpr':
                const unaryExpr = expr;
                references.push(...this.collectVariableReferences(unaryExpr.operand, context));
                break;
            case 'AssignmentExpr':
                const assignExpr = expr;
                // Left side is written to
                const writeContext = { ...context, inAssignment: true };
                references.push(...this.collectVariableReferences(assignExpr.left, writeContext));
                // Right side is read from
                references.push(...this.collectVariableReferences(assignExpr.right, context));
                break;
            case 'CallExpr':
                const callExpr = expr;
                references.push(...this.collectVariableReferences(callExpr.callee, context));
                callExpr.args.forEach(arg => {
                    references.push(...this.collectVariableReferences(arg, context));
                });
                break;
            case 'MemberExpr':
                const memberExpr = expr;
                references.push(...this.collectVariableReferences(memberExpr.object, context));
                break;
            case 'IndexExpr':
                const indexExpr = expr;
                references.push(...this.collectVariableReferences(indexExpr.object, context));
                references.push(...this.collectVariableReferences(indexExpr.index, context));
                break;
            case 'ArrayLiteral':
                const arrayLit = expr;
                arrayLit.elements.forEach(elem => {
                    references.push(...this.collectVariableReferences(elem, context));
                });
                break;
            // Literals have no variable references
            default:
                break;
        }
        return references;
    }
    /**
     * Analyze variable access patterns for optimization.
     */
    analyzeVariableAccessPattern(references, _context) {
        if (references.length === 0) {
            return 'single_use';
        }
        if (references.length === 1) {
            return 'single_use';
        }
        // Check for read-write pattern
        const hasRead = references.some(ref => ref.accessType === 'read');
        const hasWrite = references.some(ref => ref.accessType === 'write' || ref.accessType === 'modify');
        if (hasRead && hasWrite) {
            return 'read_write';
        }
        if (hasRead && !hasWrite) {
            return 'multiple_read';
        }
        if (_context.loopDepth > 0) {
            return 'loop_dependent';
        }
        if (_context.inHotPath) {
            return 'hot_path';
        }
        return 'multiple_read';
    }
    /**
     * Analyze constant properties of an expression.
     */
    analyzeConstantProperties(expr, metadata, _context) {
        switch (expr.type) {
            case 'Literal':
                const literal = expr;
                metadata.isConstant = true;
                metadata.constantValue = literal.value;
                metadata.isCompileTimeConstant = true;
                metadata.constantFoldingCandidate = false; // Already a literal
                break;
            case 'BinaryExpr':
                const binaryExpr = expr;
                const leftMeta = this.createDefaultOptimizationData();
                const rightMeta = this.createDefaultOptimizationData();
                this.analyzeConstantProperties(binaryExpr.left, leftMeta, _context);
                this.analyzeConstantProperties(binaryExpr.right, rightMeta, _context);
                // Binary expressions are NOT constant themselves, but they may be constant folding candidates
                metadata.isConstant = false;
                metadata.constantFoldingCandidate = leftMeta.isConstant && rightMeta.isConstant;
                metadata.isCompileTimeConstant =
                    leftMeta.isCompileTimeConstant && rightMeta.isCompileTimeConstant;
                break;
            case 'UnaryExpr':
                const unaryExpr = expr;
                const operandMeta = this.createDefaultOptimizationData();
                this.analyzeConstantProperties(unaryExpr.operand, operandMeta, _context);
                // Unary expressions are NOT constant themselves, but may be constant folding candidates
                metadata.isConstant = false;
                metadata.constantFoldingCandidate = operandMeta.isConstant;
                metadata.isCompileTimeConstant = operandMeta.isCompileTimeConstant;
                break;
            default:
                metadata.isConstant = false;
                metadata.constantFoldingCandidate = false;
                metadata.isCompileTimeConstant = false;
                break;
        }
    }
    /**
     * Analyze side effects in an expression.
     */
    analyzeSideEffects(expr, metadata, _context) {
        switch (expr.type) {
            case 'AssignmentExpr':
                metadata.hasSideEffects = true;
                metadata.isPure = false;
                metadata.sideEffects.push({
                    type: 'variable_write',
                    target: 'variable',
                    location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                    severity: 'medium',
                    description: 'Assignment modifies variable',
                });
                break;
            case 'CallExpr':
                metadata.hasSideEffects = true;
                metadata.isPure = false;
                metadata.hasNestedCalls = true;
                metadata.sideEffects.push({
                    type: 'function_call',
                    target: 'function',
                    location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                    severity: 'medium',
                    description: 'Function call may have side effects',
                });
                break;
            case 'UnaryExpr':
                const unaryExpr = expr;
                if (unaryExpr.operator === '++' || unaryExpr.operator === '--') {
                    metadata.hasSideEffects = true;
                    metadata.isPure = false;
                    metadata.sideEffects.push({
                        type: 'variable_write',
                        target: 'variable',
                        location: expr.metadata?.start || { line: 0, column: 0, offset: 0 },
                        severity: 'medium',
                        description: 'Increment/decrement modifies variable',
                    });
                }
                break;
            case 'IndexExpr':
                metadata.hasComplexAddressing = true;
                break;
            default:
                // Most expressions are pure
                metadata.hasSideEffects = false;
                metadata.isPure = true;
                break;
        }
        // Recursively analyze sub-expressions
        this.propagateSideEffectsFromSubExpressions(expr, metadata, _context);
    }
    /**
     * Propagate side effects from sub-expressions.
     */
    propagateSideEffectsFromSubExpressions(expr, metadata, _context) {
        const subExpressions = this.getSubExpressions(expr);
        for (const subExpr of subExpressions) {
            const subMeta = this.createDefaultOptimizationData();
            this.analyzeSideEffects(subExpr, subMeta, _context);
            if (subMeta.hasSideEffects) {
                metadata.hasSideEffects = true;
                metadata.isPure = false;
                metadata.sideEffects.push(...subMeta.sideEffects);
            }
            if (subMeta.hasNestedCalls) {
                metadata.hasNestedCalls = true;
            }
            if (subMeta.hasComplexAddressing) {
                metadata.hasComplexAddressing = true;
            }
        }
    }
    /**
     * Get all sub-expressions of an expression.
     */
    getSubExpressions(expr) {
        switch (expr.type) {
            case 'BinaryExpr':
                const binaryExpr = expr;
                return [binaryExpr.left, binaryExpr.right];
            case 'UnaryExpr':
                const unaryExpr = expr;
                return [unaryExpr.operand];
            case 'AssignmentExpr':
                const assignExpr = expr;
                return [assignExpr.left, assignExpr.right];
            case 'CallExpr':
                const callExpr = expr;
                return [callExpr.callee, ...callExpr.args];
            case 'MemberExpr':
                const memberExpr = expr;
                return [memberExpr.object];
            case 'IndexExpr':
                const indexExpr = expr;
                return [indexExpr.object, indexExpr.index];
            case 'ArrayLiteral':
                const arrayLit = expr;
                return arrayLit.elements;
            default:
                return [];
        }
    }
    /**
     * Analyze performance characteristics of an expression.
     */
    analyzePerformanceCharacteristics(expr, metadata, _context) {
        // Calculate complexity score based on operation types and nesting
        metadata.complexityScore = this.calculateComplexityScore(expr);
        // Estimate 6502 cycles for the expression
        metadata.estimatedCycles = this.estimateExecutionCycles(expr);
        // Analyze register pressure
        metadata.registerPressure = this.analyzeRegisterPressure(expr, _context);
    }
    /**
     * Calculate complexity score for an expression.
     */
    calculateComplexityScore(expr) {
        switch (expr.type) {
            case 'Literal':
            case 'Identifier':
                return 1;
            case 'BinaryExpr':
                const binaryExpr = expr;
                const leftScore = this.calculateComplexityScore(binaryExpr.left);
                const rightScore = this.calculateComplexityScore(binaryExpr.right);
                // Multiplication and division are more complex
                const opWeight = ['*', '/', '%'].includes(binaryExpr.operator) ? 3 : 2;
                return opWeight + leftScore + rightScore;
            case 'UnaryExpr':
                const unaryExpr = expr;
                return 1 + this.calculateComplexityScore(unaryExpr.operand);
            case 'AssignmentExpr':
                const assignExpr = expr;
                return (2 +
                    this.calculateComplexityScore(assignExpr.left) +
                    this.calculateComplexityScore(assignExpr.right));
            case 'CallExpr':
                const callExpr = expr;
                const calleeScore = this.calculateComplexityScore(callExpr.callee);
                const argsScore = callExpr.args.reduce((sum, arg) => sum + this.calculateComplexityScore(arg), 0);
                return 5 + calleeScore + argsScore; // Function calls are expensive
            case 'IndexExpr':
                const indexExpr = expr;
                return (3 +
                    this.calculateComplexityScore(indexExpr.object) +
                    this.calculateComplexityScore(indexExpr.index));
            default:
                return 2;
        }
    }
    /**
     * Estimate 6502 execution cycles for an expression.
     */
    estimateExecutionCycles(expr) {
        switch (expr.type) {
            case 'Literal':
                return 2; // LDA #immediate
            case 'Identifier':
                return 3; // LDA zero_page or 4 for absolute
            case 'BinaryExpr':
                const binaryExpr = expr;
                const leftCycles = this.estimateExecutionCycles(binaryExpr.left);
                const rightCycles = this.estimateExecutionCycles(binaryExpr.right);
                switch (binaryExpr.operator) {
                    case '+':
                    case '-':
                        return leftCycles + rightCycles + 3; // ADC/SBC
                    case '*':
                        return leftCycles + rightCycles + 20; // Multiplication routine
                    case '/':
                    case '%':
                        return leftCycles + rightCycles + 40; // Division routine
                    default:
                        return leftCycles + rightCycles + 2;
                }
            case 'CallExpr':
                return 20; // JSR overhead + function execution
            case 'IndexExpr':
                const indexExpr = expr;
                return (this.estimateExecutionCycles(indexExpr.object) +
                    this.estimateExecutionCycles(indexExpr.index) +
                    4); // Indexed addressing
            default:
                return 5; // Conservative estimate
        }
    }
    /**
     * Analyze register pressure for 6502.
     */
    analyzeRegisterPressure(expr, _context) {
        const complexityScore = this.calculateComplexityScore(expr);
        return {
            estimatedRegistersNeeded: Math.min(3, Math.ceil(complexityScore / 3)), // A, X, Y max
            preferredRegister: this.determinePreferredRegister(expr),
            requiresSpillToMemory: complexityScore > 6,
            canUseZeroPage: true, // Most expressions can benefit from zero page
            temporaryVariablesNeeded: Math.max(0, complexityScore - 3),
        };
    }
    /**
     * Determine preferred register for an expression.
     */
    determinePreferredRegister(expr) {
        switch (expr.type) {
            case 'BinaryExpr':
                return 'A'; // Accumulator for arithmetic
            case 'IndexExpr':
                return 'X'; // Index register for array access
            case 'CallExpr':
                return 'A'; // Function results in accumulator
            default:
                return 'A'; // Default to accumulator
        }
    }
    /**
     * Collect 6502-specific optimization hints.
     */
    collect6502OptimizationHints(expr, metadata, _context) {
        metadata.sixtyTwoHints = {
            addressingMode: this.determineAddressingMode(expr, _context),
            zeroPageCandidate: this.isZeroPageCandidate(expr),
            absoluteAddressingRequired: this.requiresAbsoluteAddressing(expr),
            accumulatorOperation: this.isAccumulatorOperation(expr),
            indexRegisterUsage: this.analyzeIndexRegisterUsage(expr),
            requiresIndexing: this.requiresIndexing(expr),
            memoryBankPreference: this.determineMemoryBankPreference(expr, _context),
            alignmentRequirement: 1, // Most expressions have no special alignment
            volatileAccess: false, // Most expressions are not volatile
            branchPredictionHint: 'unpredictable',
            loopOptimizationHint: this.getLoopOptimizationHint(expr, _context),
            inlineCandidate: this.isInlineCandidate(expr),
            hardwareRegisterAccess: false, // Most expressions don't access hardware
            timingCritical: _context.hardwareContext === 'timing_critical',
            interruptSafe: _context.hardwareContext !== 'interrupt_handler',
        };
    }
    /**
     * Determine addressing mode for an expression.
     */
    determineAddressingMode(expr, _context) {
        if (expr.type === 'Literal') {
            return 'immediate';
        }
        if (expr.type === 'Identifier') {
            const symbol = this.symbolTable.lookupSymbol(expr.name);
            if (symbol && isVariableSymbol(symbol) && symbol.storageClass === 'zp') {
                return 'zero_page';
            }
            return 'absolute';
        }
        if (expr.type === 'IndexExpr') {
            return 'indexed_x'; // Prefer X register for indexing
        }
        return 'absolute';
    }
    /**
     * Check if expression is a zero page candidate.
     */
    isZeroPageCandidate(expr) {
        if (expr.type === 'Identifier') {
            const symbol = this.symbolTable.lookupSymbol(expr.name);
            return !!(symbol &&
                isVariableSymbol(symbol) &&
                (symbol.storageClass === 'zp' || symbol.storageClass === undefined));
        }
        return false;
    }
    /**
     * Check if expression requires absolute addressing.
     */
    requiresAbsoluteAddressing(expr) {
        return expr.type === 'CallExpr' || expr.type === 'MemberExpr';
    }
    /**
     * Check if expression is an accumulator operation.
     */
    isAccumulatorOperation(expr) {
        return (expr.type === 'BinaryExpr' &&
            ['+', '-', '&', '|', '^'].includes(expr.operator));
    }
    /**
     * Analyze index register usage.
     */
    analyzeIndexRegisterUsage(expr) {
        if (expr.type === 'IndexExpr') {
            return 'requires_x'; // Array access typically uses X
        }
        if (expr.type === 'CallExpr') {
            return 'prefer_x'; // Function calls may use X for parameters
        }
        return 'none';
    }
    /**
     * Check if expression requires indexing.
     */
    requiresIndexing(expr) {
        return expr.type === 'IndexExpr' || expr.type === 'MemberExpr';
    }
    /**
     * Determine memory bank preference.
     */
    determineMemoryBankPreference(expr, _context) {
        if (expr.type === 'Identifier') {
            const symbol = this.symbolTable.lookupSymbol(expr.name);
            if (symbol && isVariableSymbol(symbol)) {
                switch (symbol.storageClass) {
                    case 'zp':
                        return 'zero_page';
                    case 'io':
                        return 'io';
                    default:
                        return 'ram';
                }
            }
        }
        return 'ram';
    }
    /**
     * Get loop optimization hint for an expression.
     */
    getLoopOptimizationHint(expr, _context) {
        if (_context.loopDepth === 0) {
            return 'invariant_motion'; // Default outside loops
        }
        switch (expr.type) {
            case 'Literal':
                return 'invariant_motion';
            case 'Identifier':
                return 'induction_variable';
            case 'BinaryExpr':
                return 'strength_reduce';
            default:
                return 'invariant_motion';
        }
    }
    /**
     * Check if expression is inline candidate.
     */
    isInlineCandidate(expr) {
        return this.calculateComplexityScore(expr) <= 3;
    }
    /**
     * Analyze loop context for an expression.
     */
    analyzeLoopContext(expr, metadata, _context) {
        metadata.loopInvariant = _context.loopDepth === 0 || expr.type === 'Literal';
        metadata.loopDependent = _context.loopDepth > 0 && !metadata.loopInvariant;
        metadata.hotPathCandidate = _context.inHotPath || _context.loopDepth > 0;
    }
    /**
     * Identify optimization opportunities.
     */
    identifyOptimizationOpportunities(_expr, metadata, _context) {
        // Common subexpression elimination opportunity
        metadata.commonSubexpressionCandidate =
            metadata.complexityScore > 2 && !metadata.hasSideEffects;
        // Dead code elimination
        metadata.deadCodeCandidate = false; // This would be determined at a higher level
        // Caching opportunity
        metadata.cacheCandidate = metadata.loopInvariant && metadata.complexityScore > 3;
    }
    // ============================================================================
    // STATEMENT ANALYSIS METHODS
    // ============================================================================
    /**
     * Extract and analyze all expressions from a statement.
     */
    extractAndAnalyzeExpressions(stmt, context) {
        const expressions = [];
        const results = [];
        // Extract expressions based on statement type
        switch (stmt.type) {
            case 'ExpressionStatement':
                const exprStmt = stmt;
                expressions.push(exprStmt.expression);
                break;
            case 'IfStatement':
                const ifStmt = stmt;
                expressions.push(ifStmt.condition);
                // Note: We don't recursively analyze nested statements here
                break;
            case 'WhileStatement':
                const whileStmt = stmt;
                expressions.push(whileStmt.condition);
                break;
            case 'ForStatement':
                const forStmt = stmt;
                expressions.push(forStmt.start);
                expressions.push(forStmt.end);
                if (forStmt.step)
                    expressions.push(forStmt.step);
                break;
            case 'ReturnStatement':
                const returnStmt = stmt;
                if (returnStmt.value)
                    expressions.push(returnStmt.value);
                break;
            case 'MatchStatement':
                const matchStmt = stmt;
                expressions.push(matchStmt.discriminant);
                break;
            // Break, continue statements have no expressions
            default:
                break;
        }
        // Analyze each extracted expression
        for (const expr of expressions) {
            results.push(this.analyzeExpression(expr, context));
        }
        return results;
    }
    /**
     * Analyze control flow for a statement.
     */
    analyzeControlFlow(stmt, _context) {
        const controlFlow = {
            hasControlFlow: false,
            flowType: 'sequential',
            branches: [],
        };
        switch (stmt.type) {
            case 'IfStatement':
                const ifStmt = stmt;
                controlFlow.hasControlFlow = true;
                controlFlow.flowType = 'conditional';
                controlFlow.condition = ifStmt.condition;
                controlFlow.branches = [
                    { condition: ifStmt.condition, target: 'then', probability: 0.5 },
                    { target: 'else', probability: 0.5 },
                ];
                break;
            case 'WhileStatement':
            case 'ForStatement':
                controlFlow.hasControlFlow = true;
                controlFlow.flowType = 'loop';
                controlFlow.branches = [
                    { target: 'loop_body', probability: 0.8 },
                    { target: 'loop_exit', probability: 0.2 },
                ];
                break;
            case 'ReturnStatement':
                controlFlow.hasControlFlow = true;
                controlFlow.flowType = 'return';
                break;
            case 'BreakStatement':
                controlFlow.hasControlFlow = true;
                controlFlow.flowType = 'break';
                break;
            case 'ContinueStatement':
                controlFlow.hasControlFlow = true;
                controlFlow.flowType = 'continue';
                break;
            case 'MatchStatement':
                const matchStmt = stmt;
                controlFlow.hasControlFlow = true;
                controlFlow.flowType = 'conditional';
                controlFlow.condition = matchStmt.discriminant;
                break;
            default:
                // Sequential statements
                break;
        }
        return controlFlow;
    }
    /**
     * Collect statement-level optimization metadata.
     */
    collectStatementMetadata(stmt, _context) {
        const metadata = {
            isTerminal: false,
            alwaysExecutes: true,
            conditionalExecution: false,
            loopStatement: false,
            deadCodeCandidate: false,
            unreachableCode: false,
            constantCondition: false,
            emptyStatement: false,
            executionFrequency: this.determineExecutionFrequency(_context),
            criticalPath: _context.inHotPath,
            hotPath: _context.inHotPath,
            branchInstruction: false,
            jumpInstruction: false,
            hardwareInteraction: false,
        };
        switch (stmt.type) {
            case 'ReturnStatement':
                metadata.isTerminal = true;
                metadata.jumpInstruction = true;
                break;
            case 'IfStatement':
                const ifStmt = stmt;
                metadata.conditionalExecution = true;
                metadata.branchInstruction = true;
                // Check for constant condition
                if (ifStmt.condition.type === 'Literal') {
                    metadata.constantCondition = true;
                }
                break;
            case 'WhileStatement':
            case 'ForStatement':
            case 'MatchStatement':
                metadata.conditionalExecution = true;
                metadata.branchInstruction = true;
                metadata.loopStatement = stmt.type === 'WhileStatement' || stmt.type === 'ForStatement';
                break;
            case 'BreakStatement':
            case 'ContinueStatement':
                metadata.isTerminal = true;
                metadata.jumpInstruction = true;
                break;
            case 'ExpressionStatement':
                const exprStmt = stmt;
                // Check if expression has constant condition
                if (exprStmt.expression.type === 'Literal') {
                    metadata.constantCondition = true;
                }
                break;
            default:
                break;
        }
        return metadata;
    }
    /**
     * Collect block-level optimization metadata.
     */
    collectBlockMetadata(statements, _context) {
        const metadata = {
            statementCount: statements.length,
            expressionCount: 0,
            variableAccesses: [],
            deadCodeElimination: [],
            commonSubexpressions: [],
            constantPropagation: [],
            loopOptimizations: [],
            estimatedCycles: 0,
            codeSize: statements.length * 2, // Rough estimate
            hotPath: _context.inHotPath,
            criticalSection: false,
        };
        // Aggregate data from statements
        for (const stmtResult of statements) {
            metadata.expressionCount += stmtResult.expressions.length;
            metadata.estimatedCycles += stmtResult.expressions.reduce((sum, expr) => sum + expr.optimizationData.estimatedCycles, 0);
            // Collect variable accesses
            for (const expr of stmtResult.expressions) {
                metadata.variableAccesses.push(...expr.optimizationData.usedVariables);
            }
            // Identify dead code candidates
            if (stmtResult.optimizationData.deadCodeCandidate) {
                metadata.deadCodeElimination.push({
                    statement: stmtResult.statement,
                    reason: 'Unreachable code',
                    canEliminate: true,
                });
            }
        }
        return metadata;
    }
    /**
     * Determine execution frequency based on context.
     */
    determineExecutionFrequency(_context) {
        if (_context.inHotPath) {
            return 'hot';
        }
        if (_context.loopDepth > 1) {
            return 'frequent';
        }
        if (_context.loopDepth === 1) {
            return 'frequent';
        }
        return 'normal';
    }
    // ============================================================================
    // DEFAULT VALUE CREATORS
    // ============================================================================
    /**
     * Create default optimization metadata for expressions.
     */
    createDefaultOptimizationData() {
        return {
            isConstant: false,
            constantValue: undefined,
            isCompileTimeConstant: false,
            usedVariables: [],
            hasVariableAccess: false,
            variableAccessPattern: 'single_use',
            hasSideEffects: false,
            sideEffects: [],
            isPure: true,
            complexityScore: 1,
            estimatedCycles: 1,
            registerPressure: {
                estimatedRegistersNeeded: 1,
                preferredRegister: 'A',
                requiresSpillToMemory: false,
                canUseZeroPage: true,
                temporaryVariablesNeeded: 0,
            },
            sixtyTwoHints: {
                addressingMode: 'absolute',
                zeroPageCandidate: false,
                absoluteAddressingRequired: false,
                accumulatorOperation: false,
                indexRegisterUsage: 'none',
                requiresIndexing: false,
                memoryBankPreference: 'ram',
                alignmentRequirement: 1,
                volatileAccess: false,
                branchPredictionHint: 'unpredictable',
                loopOptimizationHint: 'invariant_motion',
                inlineCandidate: true,
                hardwareRegisterAccess: false,
                timingCritical: false,
                interruptSafe: true,
            },
            loopInvariant: false,
            loopDependent: false,
            hotPathCandidate: false,
            depth: 1,
            nodeCount: 1,
            hasNestedCalls: false,
            hasComplexAddressing: false,
            constantFoldingCandidate: false,
            commonSubexpressionCandidate: false,
            deadCodeCandidate: false,
            cacheCandidate: false,
        };
    }
    /**
     * Create default control flow information.
     */
    createDefaultControlFlow() {
        return {
            hasControlFlow: false,
            flowType: 'sequential',
            branches: [],
        };
    }
    /**
     * Create default statement optimization metadata.
     */
    createDefaultStatementOptimizationData() {
        return {
            isTerminal: false,
            alwaysExecutes: true,
            conditionalExecution: false,
            loopStatement: false,
            deadCodeCandidate: false,
            unreachableCode: false,
            constantCondition: false,
            emptyStatement: false,
            executionFrequency: 'normal',
            criticalPath: false,
            hotPath: false,
            branchInstruction: false,
            jumpInstruction: false,
            hardwareInteraction: false,
        };
    }
    /**
     * Create default block optimization metadata.
     */
    createDefaultBlockOptimizationData() {
        return {
            statementCount: 0,
            expressionCount: 0,
            variableAccesses: [],
            deadCodeElimination: [],
            commonSubexpressions: [],
            constantPropagation: [],
            loopOptimizations: [],
            estimatedCycles: 0,
            codeSize: 0,
            hotPath: false,
            criticalSection: false,
        };
    }
    // ============================================================================
    // ERROR HANDLING METHODS
    // ============================================================================
    /**
     * Add semantic error to the error list.
     */
    addError(error) {
        this.errors.push(error);
    }
    /**
     * Add semantic warning to the warning list.
     */
    addWarning(warning) {
        this.warnings.push(warning);
    }
    // ============================================================================
    // PUBLIC API METHODS
    // ============================================================================
    /**
     * Get all accumulated errors.
     */
    getErrors() {
        return [...this.errors];
    }
    /**
     * Get all accumulated warnings.
     */
    getWarnings() {
        return [...this.warnings];
    }
    /**
     * Clear all errors and warnings.
     */
    clearErrors() {
        this.errors = [];
        this.warnings = [];
    }
    /**
     * Get optimization metadata for an expression.
     */
    getOptimizationMetadata(expr) {
        return this.optimizationMetadata.get(expr);
    }
    /**
     * Get statement metadata.
     */
    getStatementMetadata(stmt) {
        return this.statementMetadata.get(stmt);
    }
}
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Create expression context with optional overrides.
 */
export function createExpressionContext(options = {}) {
    return {
        loopDepth: 0,
        inHotPath: false,
        inCondition: false,
        inAssignment: false,
        hardwareContext: 'normal',
        optimizationLevel: 'balanced',
        ...options,
    };
}
//# sourceMappingURL=expression-analyzer.js.map