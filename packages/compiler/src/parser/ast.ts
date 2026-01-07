/**
 * AST node definitions shared by the parser, analyzer, optimizer, and codegen.
 *
 * This file intentionally mirrors the rich node taxonomy outlined in the
 * roadmap. Even if some nodes are not constructed in Phase 1 yet, defining the
 * shapes early keeps future phases consistent and helps contributors
 * understand the bigger picture.
 */

import type { SourceSpan } from './source.js';
import { UNKNOWN_SOURCE_SPAN } from './source.js';

/**
 * Enumerates every concrete node the Blend compiler can emit.
 * Keeping string literal enums avoids repeating hard-coded names.
 *
 * @enum {string}
 */
export enum AstNodeKind {
  Program = 'Program',
  ModuleDeclaration = 'ModuleDeclaration',
  ImportDeclaration = 'ImportDeclaration',
  ExportDeclaration = 'ExportDeclaration',
  FunctionDeclaration = 'FunctionDeclaration',
  TypeAliasDeclaration = 'TypeAliasDeclaration',
  EnumDeclaration = 'EnumDeclaration',
  VariableDeclaration = 'VariableDeclaration',
  BlockStatement = 'BlockStatement',
  ExpressionStatement = 'ExpressionStatement',
  IfStatement = 'IfStatement',
  WhileStatement = 'WhileStatement',
  ForStatement = 'ForStatement',
  MatchStatement = 'MatchStatement',
  CaseClause = 'CaseClause',
  DefaultClause = 'DefaultClause',
  ReturnStatement = 'ReturnStatement',
  BreakStatement = 'BreakStatement',
  ContinueStatement = 'ContinueStatement',
  BinaryExpression = 'BinaryExpression',
  UnaryExpression = 'UnaryExpression',
  CallExpression = 'CallExpression',
  IndexExpression = 'IndexExpression',
  MemberExpression = 'MemberExpression',
  AssignmentExpression = 'AssignmentExpression',
  Identifier = 'Identifier',
  Literal = 'Literal',
  Decorator = 'Decorator',
}

/**
 * Decorator kinds that annotate declarations or statements (future-proofing for
 * `@zp`, `#pragma interrupt`, etc.).
 *
 * @enum {string}
 */
export enum DecoratorKind {
  StorageClass = 'StorageClass',
  Pragma = 'Pragma',
  Custom = 'Custom',
}

/**
 * Base contract shared by every AST node. Keeping this shape identical across
 * node kinds allows tagged unions plus consistent metadata propagation.
 *
 * @interface AstNodeBase
 * @property {AstNodeKind} kind - Discriminant for TypeScript's tagged unions.
 * @property {SourceSpan} span - Half-open span covering the node's source text
 * for diagnostics.
 * @property {string} [docComment] - Optional doc comment text carried through
 * parsing so later stages can surface it to tooling.
 * @property {DecoratorNode[]} [decorators] - Optional decorators applied to the
 * node so downstream passes can reason about metadata without re-parsing.
 */
export interface AstNodeBase {
  kind: AstNodeKind;
  span: SourceSpan;
  docComment?: string;
  decorators?: DecoratorNode[];
}

/**
 * Program root node that stores the original declaration/statement ordering.
 * Serializers rely on the preserved order to emit deterministic outputs.
 *
 * @interface ProgramNode
 * @extends AstNodeBase
 * @property {Array<DeclarationNode | StatementNode>} body - Mixed list that
 * mirrors the source file layout.
 */
export interface ProgramNode extends AstNodeBase {
  kind: AstNodeKind.Program;
  body: Array<DeclarationNode | StatementNode>;
}

/**
 * Union of every top-level declaration permitted inside a program body. Having
 * a central union simplifies exhaustiveness checks across passes.
 */
export type DeclarationNode =
  | ModuleDeclarationNode
  | ImportDeclarationNode
  | ExportDeclarationNode
  | FunctionDeclarationNode
  | TypeAliasDeclarationNode
  | EnumDeclarationNode
  | VariableDeclarationNode;

/**
 * Represents a `module foo.bar` declaration. Segmented identifiers keep nested
 * module hierarchies explicit instead of string-parsed later.
 *
 * @interface ModuleDeclarationNode
 * @extends AstNodeBase
 * @property {IdentifierNode[]} name - Qualified module path.
 */
export interface ModuleDeclarationNode extends AstNodeBase {
  kind: AstNodeKind.ModuleDeclaration;
  name: IdentifierNode[];
}

/**
 * Represents `import` statements that pull named symbols from another module.
 * Explicitly storing both symbol list and source path keeps analyzers simple.
 *
 * @interface ImportDeclarationNode
 * @extends AstNodeBase
 * @property {IdentifierNode[]} symbols - Imported symbol identifiers.
 * @property {IdentifierNode[]} source - Qualified module path.
 */
export interface ImportDeclarationNode extends AstNodeBase {
  kind: AstNodeKind.ImportDeclaration;
  symbols: IdentifierNode[];
  source: IdentifierNode[];
}

/**
 * Wraps a declaration that has been exported from the current module scope.
 * This wrapper avoids repeating export metadata across declaration shapes.
 *
 * @interface ExportDeclarationNode
 * @extends AstNodeBase
 * @property {DeclarationNode} declaration - Inner declaration being exported.
 */
export interface ExportDeclarationNode extends AstNodeBase {
  kind: AstNodeKind.ExportDeclaration;
  declaration: DeclarationNode;
}

/**
 * Describes a function definition, including inputs, output, and body. Flags
 * capture syntax sugar so later passes can reason about callbacks and exports.
 *
 * @interface FunctionDeclarationNode
 * @extends AstNodeBase
 * @property {IdentifierNode} name - Function identifier.
 * @property {ParameterNode[]} parameters - Ordered parameter list.
 * @property {TypeReferenceNode} [returnType] - Optional declared return type.
 * @property {BlockStatementNode} body - Function body block.
 * @property {boolean} isCallback - Indicates the function used callback syntax
 * which affects allowed capture rules.
 * @property {boolean} isExported - Tracks whether the declaration is exported
 * at parse time to save downstream re-checks.
 */
export interface FunctionDeclarationNode extends AstNodeBase {
  kind: AstNodeKind.FunctionDeclaration;
  name: IdentifierNode;
  parameters: ParameterNode[];
  returnType?: TypeReferenceNode;
  body: BlockStatementNode;
  isCallback: boolean;
  isExported: boolean;
}

/**
 * Represents a `type Foo = ...` alias definition. Alias nodes are required so
 * analyzers can distinguish between structural and nominal references.
 *
 * @interface TypeAliasDeclarationNode
 * @extends AstNodeBase
 * @property {IdentifierNode} name - Alias identifier.
 * @property {TypeReferenceNode} type - Target type definition.
 */
export interface TypeAliasDeclarationNode extends AstNodeBase {
  kind: AstNodeKind.TypeAliasDeclaration;
  name: IdentifierNode;
  type: TypeReferenceNode;
}

/**
 * Models an enum and its ordered member list. Enums maintain declaration order
 * for deterministic layout and to preserve explicit initializer ordering.
 *
 * @interface EnumDeclarationNode
 * @extends AstNodeBase
 * @property {IdentifierNode} name - Enum identifier.
 * @property {EnumMemberNode[]} members - Ordered member list.
 */
export interface EnumDeclarationNode extends AstNodeBase {
  kind: AstNodeKind.EnumDeclaration;
  name: IdentifierNode;
  members: EnumMemberNode[];
}

/**
 * Describes a variable declared in the current scope. Optional storage class
 * decorator enables backend-specific lowering decisions without re-reading
 * decorator syntax.
 *
 * @interface VariableDeclarationNode
 * @extends AstNodeBase
 * @property {IdentifierNode} name - Variable identifier.
 * @property {TypeReferenceNode} [type] - Optional explicit type annotation.
 * @property {ExpressionNode} [initializer] - Optional initializer expression.
 * @property {DecoratorNode} [storageClass] - Storage class metadata extracted
 * from decorators to streamline semantic analysis.
 * @property {boolean} isConst - Tracks `const` vs `mut` for mutability checks.
 */
export interface VariableDeclarationNode extends AstNodeBase {
  kind: AstNodeKind.VariableDeclaration;
  name: IdentifierNode;
  type?: TypeReferenceNode;
  initializer?: ExpressionNode;
  storageClass?: DecoratorNode;
  isConst: boolean;
}

/**
 * Represents individual enum members as literal nodes so evaluators can reuse
 * expression evaluators for enum initializer expressions.
 *
 * @interface EnumMemberNode
 * @extends AstNodeBase
 * @property {IdentifierNode} name - Member identifier.
 * @property {ExpressionNode} [value] - Optional initializer expression.
 */
export interface EnumMemberNode extends AstNodeBase {
  kind: AstNodeKind.Literal;
  name: IdentifierNode;
  value?: ExpressionNode;
}

/**
 * Defines a function parameter with its identifier and type information. The
 * parser encodes parameters as variable declarations to reuse downstream logic.
 *
 * @interface ParameterNode
 * @extends AstNodeBase
 * @property {IdentifierNode} name - Parameter identifier.
 * @property {TypeReferenceNode} type - Required parameter type.
 */
export interface ParameterNode extends AstNodeBase {
  kind: AstNodeKind.VariableDeclaration;
  name: IdentifierNode;
  type: TypeReferenceNode;
}

/**
 * References a previously declared type, optionally parameterized as an array.
 * Explicit arrayLength storage lets analyzers detect unsized arrays early.
 *
 * @interface TypeReferenceNode
 * @extends AstNodeBase
 * @property {IdentifierNode[]} name - Qualified type identifier.
 * @property {ExpressionNode} [arrayLength] - Optional array length expression.
 */
export interface TypeReferenceNode extends AstNodeBase {
  kind: AstNodeKind.Identifier;
  name: IdentifierNode[];
  arrayLength?: ExpressionNode;
}

/**
 * Union of all legal statement nodes, ensuring tagged unions narrow correctly.
 */
export type StatementNode =
  | BlockStatementNode
  | ExpressionStatementNode
  | IfStatementNode
  | WhileStatementNode
  | ForStatementNode
  | MatchStatementNode
  | ReturnStatementNode
  | BreakStatementNode
  | ContinueStatementNode;

/**
 * Represents a `{ ... }` block that scopes nested statements. Blocks preserve
 * declaration order for hoisting analysis.
 *
 * @interface BlockStatementNode
 * @extends AstNodeBase
 * @property {StatementNode[]} statements - Ordered statement list.
 */
export interface BlockStatementNode extends AstNodeBase {
  kind: AstNodeKind.BlockStatement;
  statements: StatementNode[];
}

/**
 * Wraps an expression used in statement position so analyzers can reason about
 * side effects even when expressions are discarded.
 *
 * @interface ExpressionStatementNode
 * @extends AstNodeBase
 * @property {ExpressionNode} expression - Expression evaluated for side effects.
 */
export interface ExpressionStatementNode extends AstNodeBase {
  kind: AstNodeKind.ExpressionStatement;
  expression: ExpressionNode;
}

/**
 * Classic `if` statement structure with optional `else` block.
 *
 * @interface IfStatementNode
 * @extends AstNodeBase
 * @property {ExpressionNode} test - Condition expression.
 * @property {BlockStatementNode} consequent - Block executed when the test is
 * truthy.
 * @property {BlockStatementNode} [alternate] - Optional `else` block.
 */
export interface IfStatementNode extends AstNodeBase {
  kind: AstNodeKind.IfStatement;
  test: ExpressionNode;
  consequent: BlockStatementNode;
  alternate?: BlockStatementNode;
}

/**
 * Represents `while (condition) { ... }` loops.
 *
 * @interface WhileStatementNode
 * @extends AstNodeBase
 * @property {ExpressionNode} test - Loop guard evaluated each iteration.
 * @property {BlockStatementNode} body - Loop body block.
 */
export interface WhileStatementNode extends AstNodeBase {
  kind: AstNodeKind.WhileStatement;
  test: ExpressionNode;
  body: BlockStatementNode;
}

/**
 * Models counted `for` loops with explicit start and end bounds. Encoding the
 * iterator identifier here allows analyzers to validate scope rules.
 *
 * @interface ForStatementNode
 * @extends AstNodeBase
 * @property {IdentifierNode} iterator - Loop variable identifier.
 * @property {ExpressionNode} start - Starting expression (inclusive).
 * @property {ExpressionNode} end - Ending expression (exclusive or inclusive
 * based on language semantics handled later).
 * @property {BlockStatementNode} body - Loop body block.
 */
export interface ForStatementNode extends AstNodeBase {
  kind: AstNodeKind.ForStatement;
  iterator: IdentifierNode;
  start: ExpressionNode;
  end: ExpressionNode;
  body: BlockStatementNode;
}

/**
 * Describes pattern-style branching using `match` and its clauses. Storing the
 * default clause separately avoids sentinel values inside `cases` arrays.
 *
 * @interface MatchStatementNode
 * @extends AstNodeBase
 * @property {ExpressionNode} test - Expression being matched.
 * @property {CaseClauseNode[]} cases - Ordered case clauses.
 * @property {DefaultClauseNode} [defaultClause] - Optional default clause.
 */
export interface MatchStatementNode extends AstNodeBase {
  kind: AstNodeKind.MatchStatement;
  test: ExpressionNode;
  cases: CaseClauseNode[];
  defaultClause?: DefaultClauseNode;
}

/**
 * Specific `case` clause within a `match` statement.
 *
 * @interface CaseClauseNode
 * @extends AstNodeBase
 * @property {ExpressionNode} test - Pattern expression to compare against.
 * @property {BlockStatementNode} body - Block executed when pattern matches.
 */
export interface CaseClauseNode extends AstNodeBase {
  kind: AstNodeKind.CaseClause;
  test: ExpressionNode;
  body: BlockStatementNode;
}

/**
 * Default clause executed when no prior `case` matches. Separating this node
 * prevents analyzers from accidentally treating it like a pattern.
 *
 * @interface DefaultClauseNode
 * @extends AstNodeBase
 * @property {BlockStatementNode} body - Block executed when no case matches.
 */
export interface DefaultClauseNode extends AstNodeBase {
  kind: AstNodeKind.DefaultClause;
  body: BlockStatementNode;
}

/**
 * Represents `return` with an optional expression. The argument is optional to
 * model bare `return` statements.
 *
 * @interface ReturnStatementNode
 * @extends AstNodeBase
 * @property {ExpressionNode} [argument] - Optional expression to return.
 */
export interface ReturnStatementNode extends AstNodeBase {
  kind: AstNodeKind.ReturnStatement;
  argument?: ExpressionNode;
}

/**
 * Signals exiting the nearest loop or switch. Explicit node keeps control flow
 * analysis straightforward.
 *
 * @interface BreakStatementNode
 * @extends AstNodeBase
 */
export interface BreakStatementNode extends AstNodeBase {
  kind: AstNodeKind.BreakStatement;
}

/**
 * Signals continuing to the next loop iteration.
 *
 * @interface ContinueStatementNode
 * @extends AstNodeBase
 */
export interface ContinueStatementNode extends AstNodeBase {
  kind: AstNodeKind.ContinueStatement;
}

/**
 * Union of all expression-level nodes for type narrowing. Keeping this union in
 * one place prevents drift between passes.
 */
export type ExpressionNode =
  | IdentifierNode
  | LiteralNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | CallExpressionNode
  | IndexExpressionNode
  | MemberExpressionNode
  | AssignmentExpressionNode;

/**
 * Identifier token referencing a named symbol.
 *
 * @interface IdentifierNode
 * @extends AstNodeBase
 * @property {string} name - Identifier text as written in source.
 */
export interface IdentifierNode extends AstNodeBase {
  kind: AstNodeKind.Identifier;
  name: string;
}

/**
 * Primitive literal values Blend currently supports.
 */
export type LiteralValue = string | number | boolean;

/**
 * Concrete literal expression node, annotated with its primitive type to avoid
 * type-testing at every consumer site.
 *
 * @interface LiteralNode
 * @extends AstNodeBase
 * @property {LiteralValue} value - Literal value payload.
 * @property {'string' | 'number' | 'boolean'} literalType - Explicit literal
 * variant name for quick comparisons.
 */
export interface LiteralNode extends AstNodeBase {
  kind: AstNodeKind.Literal;
  value: LiteralValue;
  literalType: 'string' | 'number' | 'boolean';
}

/**
 * Binary operator expression such as `a + b`.
 *
 * @interface BinaryExpressionNode
 * @extends AstNodeBase
 * @property {string} operator - Operator token text.
 * @property {ExpressionNode} left - Left-hand operand.
 * @property {ExpressionNode} right - Right-hand operand.
 */
export interface BinaryExpressionNode extends AstNodeBase {
  kind: AstNodeKind.BinaryExpression;
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
}

/**
 * Unary operator expression such as `!flag` or `-value`.
 *
 * @interface UnaryExpressionNode
 * @extends AstNodeBase
 * @property {string} operator - Operator token text.
 * @property {ExpressionNode} argument - Operand expression.
 * @property {boolean} isPrefix - Indicates prefix vs postfix form for analyzers.
 */
export interface UnaryExpressionNode extends AstNodeBase {
  kind: AstNodeKind.UnaryExpression;
  operator: string;
  argument: ExpressionNode;
  isPrefix: boolean;
}

/**
 * Function or method invocation expression.
 *
 * @interface CallExpressionNode
 * @extends AstNodeBase
 * @property {ExpressionNode} callee - Invoked expression.
 * @property {ExpressionNode[]} arguments - Ordered argument expressions.
 */
export interface CallExpressionNode extends AstNodeBase {
  kind: AstNodeKind.CallExpression;
  callee: ExpressionNode;
  arguments: ExpressionNode[];
}

/**
 * Array or buffer indexing expression (`target[index]`).
 *
 * @interface IndexExpressionNode
 * @extends AstNodeBase
 * @property {ExpressionNode} target - Indexed expression.
 * @property {ExpressionNode} index - Index expression.
 */
export interface IndexExpressionNode extends AstNodeBase {
  kind: AstNodeKind.IndexExpression;
  target: ExpressionNode;
  index: ExpressionNode;
}

/**
 * Property access such as `foo.bar`.
 *
 * @interface MemberExpressionNode
 * @extends AstNodeBase
 * @property {ExpressionNode} target - Expression whose property is accessed.
 * @property {IdentifierNode} property - Property identifier.
 */
export interface MemberExpressionNode extends AstNodeBase {
  kind: AstNodeKind.MemberExpression;
  target: ExpressionNode;
  property: IdentifierNode;
}

/**
 * Assignment expression with explicit operator tracking.
 *
 * @interface AssignmentExpressionNode
 * @extends AstNodeBase
 * @property {string} operator - Operator token (e.g., `=`, `+=`).
 * @property {ExpressionNode} target - Assignment target.
 * @property {ExpressionNode} value - Assigned value expression.
 */
export interface AssignmentExpressionNode extends AstNodeBase {
  kind: AstNodeKind.AssignmentExpression;
  operator: string;
  target: ExpressionNode;
  value: ExpressionNode;
}

/**
 * Decorator application wrapping metadata such as `@storage`. Capturing parsed
 * arguments ensures later stages do not need to interpret raw source text.
 *
 * @interface DecoratorNode
 * @extends AstNodeBase
 * @property {DecoratorKind} decoratorKind - High-level decorator classification.
 * @property {IdentifierNode} name - Decorator identifier.
 * @property {ExpressionNode[]} args - Decorator argument expressions.
 */
export interface DecoratorNode extends AstNodeBase {
  kind: AstNodeKind.Decorator;
  decoratorKind: DecoratorKind;
  name: IdentifierNode;
  args: ExpressionNode[];
}

/**
 * Options shared by all builder helpers so we do not repeat optional fields.
 * This keeps metadata propagation consistent across node factory helpers.
 *
 * @interface NodeFactoryOptions
 * @property {SourceSpan} [span] - Optional explicit span overriding the
 * default `UNKNOWN_SOURCE_SPAN` placeholder.
 * @property {DecoratorNode[]} [decorators] - Optional decorator list to attach.
 * @property {string} [docComment] - Optional doc comment captured from source.
 */
export interface NodeFactoryOptions {
  span?: SourceSpan;
  decorators?: DecoratorNode[];
  docComment?: string;
}

/**
 * Attaches Blend-standard metadata to an arbitrary payload and returns a node.
 * Keeping a single helper guarantees consistent defaults (e.g., span fallbacks)
 * that every parser call site benefits from.
 *
 * @template TKind extends AstNodeKind
 * @template TPayload extends object
 * @param {TKind} kind - Node discriminant, supplied by the caller.
 * @param {TPayload} payload - Properties specific to the node flavor being
 * created.
 * @param {NodeFactoryOptions} [options] - Optional metadata such as span,
 * decorators, docs. Defaults to empty object, and missing spans fall back to
 * `UNKNOWN_SOURCE_SPAN` so diagnostics still have a range.
 * @returns {AstNodeBase & TPayload & { kind: TKind }} A node object typed to the
 * provided discriminant, merging metadata with payload.
 */
export function createNode<TKind extends AstNodeKind, TPayload extends object>(
  kind: TKind,
  payload: TPayload,
  options: NodeFactoryOptions = {}
): AstNodeBase & TPayload & { kind: TKind } {
  return {
    kind,
    span: options.span ?? UNKNOWN_SOURCE_SPAN,
    docComment: options.docComment,
    decorators: options.decorators,
    ...payload,
  } as AstNodeBase & TPayload & { kind: TKind };
}
