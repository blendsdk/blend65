/**
 * AST Node Factory for Blend65
 *
 * Provides factory methods for creating AST nodes with proper metadata.
 * Adapted from blend-lang for Blend65 multi-target 6502 language.
 */
/**
 * Factory class for creating AST nodes
 */
export class ASTNodeFactory {
    /**
     * Helper method to conditionally add metadata to nodes
     */
    addMetadata(node, metadata) {
        if (metadata) {
            node.metadata = metadata;
        }
        return node;
    }
    // ============================================================================
    // Program and Module
    // ============================================================================
    createProgram(module, imports = [], exports = [], body = [], metadata) {
        const node = {
            type: 'Program',
            module,
            imports,
            exports,
            body,
        };
        if (metadata) {
            node.metadata = metadata;
        }
        return node;
    }
    createModuleDeclaration(name, metadata) {
        return this.addMetadata({
            type: 'ModuleDeclaration',
            name,
        }, metadata);
    }
    createQualifiedName(parts, metadata) {
        return this.addMetadata({
            type: 'QualifiedName',
            parts,
        }, metadata);
    }
    // ============================================================================
    // Expressions
    // ============================================================================
    createBinaryExpr(operator, left, right, metadata) {
        return this.addMetadata({
            type: 'BinaryExpr',
            operator,
            left,
            right,
        }, metadata);
    }
    createUnaryExpr(operator, operand, metadata) {
        return this.addMetadata({
            type: 'UnaryExpr',
            operator,
            operand,
        }, metadata);
    }
    createAssignmentExpr(operator, left, right, metadata) {
        return this.addMetadata({
            type: 'AssignmentExpr',
            operator,
            left,
            right,
        }, metadata);
    }
    createCallExpr(callee, args, metadata) {
        return this.addMetadata({
            type: 'CallExpr',
            callee,
            args,
        }, metadata);
    }
    createMemberExpr(object, property, metadata) {
        return this.addMetadata({
            type: 'MemberExpr',
            object,
            property,
        }, metadata);
    }
    createIndexExpr(object, index, metadata) {
        return this.addMetadata({
            type: 'IndexExpr',
            object,
            index,
        }, metadata);
    }
    createIdentifier(name, metadata) {
        return this.addMetadata({
            type: 'Identifier',
            name,
        }, metadata);
    }
    createLiteral(value, raw, metadata) {
        return this.addMetadata({
            type: 'Literal',
            value,
            raw,
        }, metadata);
    }
    createArrayLiteral(elements, metadata) {
        return this.addMetadata({
            type: 'ArrayLiteral',
            elements,
        }, metadata);
    }
    // ============================================================================
    // Statements
    // ============================================================================
    createExpressionStatement(expression, metadata) {
        return this.addMetadata({
            type: 'ExpressionStatement',
            expression,
        }, metadata);
    }
    createReturnStatement(value, metadata) {
        return this.addMetadata({
            type: 'ReturnStatement',
            value,
        }, metadata);
    }
    createIfStatement(condition, thenBody, elseBody = null, metadata) {
        return this.addMetadata({
            type: 'IfStatement',
            condition,
            thenBody,
            elseBody,
        }, metadata);
    }
    createWhileStatement(condition, body, metadata) {
        return this.addMetadata({
            type: 'WhileStatement',
            condition,
            body,
        }, metadata);
    }
    createForStatement(variable, start, end, step, body, metadata) {
        return this.addMetadata({
            type: 'ForStatement',
            variable,
            start,
            end,
            step,
            body,
        }, metadata);
    }
    createMatchStatement(discriminant, cases, defaultCase = null, metadata) {
        return this.addMetadata({
            type: 'MatchStatement',
            discriminant,
            cases,
            defaultCase,
        }, metadata);
    }
    createMatchCase(test, consequent, metadata) {
        return this.addMetadata({
            type: 'MatchCase',
            test,
            consequent,
        }, metadata);
    }
    createBreakStatement(metadata) {
        return this.addMetadata({
            type: 'BreakStatement',
        }, metadata);
    }
    createContinueStatement(metadata) {
        return this.addMetadata({
            type: 'ContinueStatement',
        }, metadata);
    }
    // ============================================================================
    // Declarations
    // ============================================================================
    createFunctionDeclaration(name, params, returnType, body, exported = false, callback = false, // NEW: Callback flag parameter
    metadata) {
        return this.addMetadata({
            type: 'FunctionDeclaration',
            name,
            params,
            returnType,
            body,
            exported,
            callback, // NEW: Include callback flag
        }, metadata);
    }
    createParameter(name, paramType, optional = false, defaultValue = null, metadata) {
        return this.addMetadata({
            type: 'Parameter',
            name,
            paramType,
            optional,
            defaultValue,
        }, metadata);
    }
    createVariableDeclaration(name, varType, initializer = null, storageClass = null, exported = false, metadata) {
        return this.addMetadata({
            type: 'VariableDeclaration',
            storageClass,
            name,
            varType,
            initializer,
            exported,
        }, metadata);
    }
    createEnumDeclaration(name, members, exported = false, metadata) {
        return this.addMetadata({
            type: 'EnumDeclaration',
            name,
            members,
            exported,
        }, metadata);
    }
    createEnumMember(name, value = null, metadata) {
        return this.addMetadata({
            type: 'EnumMember',
            name,
            value,
        }, metadata);
    }
    // ============================================================================
    // Import/Export
    // ============================================================================
    createImportDeclaration(specifiers, source, metadata) {
        return this.addMetadata({
            type: 'ImportDeclaration',
            specifiers,
            source,
        }, metadata);
    }
    createImportSpecifier(imported, local = null, metadata) {
        return this.addMetadata({
            type: 'ImportSpecifier',
            imported,
            local,
        }, metadata);
    }
    createExportDeclaration(declaration, metadata) {
        return this.addMetadata({
            type: 'ExportDeclaration',
            declaration,
        }, metadata);
    }
    createReexportDeclaration(specifiers, source, metadata) {
        return this.addMetadata({
            type: 'ReexportDeclaration',
            specifiers,
            source,
        }, metadata);
    }
    // ============================================================================
    // Type System
    // ============================================================================
    createPrimitiveType(name, // Add 'callback'
    metadata) {
        return this.addMetadata({
            type: 'PrimitiveType',
            name,
        }, metadata);
    }
    createArrayType(elementType, size, metadata) {
        return this.addMetadata({
            type: 'ArrayType',
            elementType,
            size,
        }, metadata);
    }
    // ============================================================================
    // Generic Node Creation
    // ============================================================================
    /**
     * Generic method for creating any AST node
     */
    create(type, props = {}) {
        return {
            type,
            ...props,
        };
    }
}
// Export a default instance
export const factory = new ASTNodeFactory();
//# sourceMappingURL=ast-factory.js.map