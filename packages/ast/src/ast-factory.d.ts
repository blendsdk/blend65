/**
 * AST Node Factory for Blend65
 *
 * Provides factory methods for creating AST nodes with proper metadata.
 * Adapted from blend-lang for Blend65 multi-target 6502 language.
 */
import { SourcePosition } from '@blend65/lexer';
import { ASTNode, Program, ModuleDeclaration, QualifiedName, Expression, Statement, Declaration, BinaryExpr, UnaryExpr, AssignmentExpr, CallExpr, MemberExpr, IndexExpr, Identifier, Literal, ArrayLiteral, IfStatement, WhileStatement, ForStatement, MatchStatement, MatchCase, ReturnStatement, ExpressionStatement, BreakStatement, ContinueStatement, FunctionDeclaration, VariableDeclaration, EnumDeclaration, EnumMember, Parameter, ImportDeclaration, ImportSpecifier, ExportDeclaration, PrimitiveType, ArrayType, StorageClass, TypeAnnotation } from './ast-types/core.js';
import { ReexportDeclaration } from './ast-types/modules.js';
/**
 * Metadata for AST node creation
 */
export interface NodeMetadata {
    start: SourcePosition;
    end: SourcePosition;
}
/**
 * Factory class for creating AST nodes
 */
export declare class ASTNodeFactory {
    /**
     * Helper method to conditionally add metadata to nodes
     */
    private addMetadata;
    createProgram(module: ModuleDeclaration, imports?: ImportDeclaration[], exports?: ExportDeclaration[], body?: Declaration[], metadata?: NodeMetadata): Program;
    createModuleDeclaration(name: QualifiedName, metadata?: NodeMetadata): ModuleDeclaration;
    createQualifiedName(parts: string[], metadata?: NodeMetadata): QualifiedName;
    createBinaryExpr(operator: string, left: Expression, right: Expression, metadata?: NodeMetadata): BinaryExpr;
    createUnaryExpr(operator: string, operand: Expression, metadata?: NodeMetadata): UnaryExpr;
    createAssignmentExpr(operator: string, left: Expression, right: Expression, metadata?: NodeMetadata): AssignmentExpr;
    createCallExpr(callee: Expression, args: Expression[], metadata?: NodeMetadata): CallExpr;
    createMemberExpr(object: Expression, property: string, metadata?: NodeMetadata): MemberExpr;
    createIndexExpr(object: Expression, index: Expression, metadata?: NodeMetadata): IndexExpr;
    createIdentifier(name: string, metadata?: NodeMetadata): Identifier;
    createLiteral(value: string | number | boolean, raw: string, metadata?: NodeMetadata): Literal;
    createArrayLiteral(elements: Expression[], metadata?: NodeMetadata): ArrayLiteral;
    createExpressionStatement(expression: Expression, metadata?: NodeMetadata): ExpressionStatement;
    createReturnStatement(value: Expression | null, metadata?: NodeMetadata): ReturnStatement;
    createIfStatement(condition: Expression, thenBody: Statement[], elseBody?: Statement[] | null, metadata?: NodeMetadata): IfStatement;
    createWhileStatement(condition: Expression, body: Statement[], metadata?: NodeMetadata): WhileStatement;
    createForStatement(variable: string, start: Expression, end: Expression, step: Expression | null, body: Statement[], metadata?: NodeMetadata): ForStatement;
    createMatchStatement(discriminant: Expression, cases: MatchCase[], defaultCase?: MatchCase | null, metadata?: NodeMetadata): MatchStatement;
    createMatchCase(test: Expression | null, consequent: Statement[], metadata?: NodeMetadata): MatchCase;
    createBreakStatement(metadata?: NodeMetadata): BreakStatement;
    createContinueStatement(metadata?: NodeMetadata): ContinueStatement;
    createFunctionDeclaration(name: string, params: Parameter[], returnType: TypeAnnotation, body: Statement[], exported?: boolean, callback?: boolean, // NEW: Callback flag parameter
    metadata?: NodeMetadata): FunctionDeclaration;
    createParameter(name: string, paramType: TypeAnnotation, optional?: boolean, defaultValue?: Expression | null, metadata?: NodeMetadata): Parameter;
    createVariableDeclaration(name: string, varType: TypeAnnotation, initializer?: Expression | null, storageClass?: StorageClass | null, exported?: boolean, metadata?: NodeMetadata): VariableDeclaration;
    createEnumDeclaration(name: string, members: EnumMember[], exported?: boolean, metadata?: NodeMetadata): EnumDeclaration;
    createEnumMember(name: string, value?: Expression | null, metadata?: NodeMetadata): EnumMember;
    createImportDeclaration(specifiers: ImportSpecifier[], source: QualifiedName, metadata?: NodeMetadata): ImportDeclaration;
    createImportSpecifier(imported: string, local?: string | null, metadata?: NodeMetadata): ImportSpecifier;
    createExportDeclaration(declaration: Declaration, metadata?: NodeMetadata): ExportDeclaration;
    createReexportDeclaration(specifiers: ImportSpecifier[], source: QualifiedName, metadata?: NodeMetadata): ReexportDeclaration;
    createPrimitiveType(name: 'byte' | 'word' | 'boolean' | 'void' | 'callback', // Add 'callback'
    metadata?: NodeMetadata): PrimitiveType;
    createArrayType(elementType: TypeAnnotation, size: Expression, metadata?: NodeMetadata): ArrayType;
    /**
     * Generic method for creating any AST node
     */
    create(type: string, props?: any): ASTNode;
}
export declare const factory: ASTNodeFactory;
//# sourceMappingURL=ast-factory.d.ts.map