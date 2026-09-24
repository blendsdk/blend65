import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { LiteralItem } from "./tokens.js";

/** A module name discovered at the beginning of one source. */
export interface ModuleHeader {
  /** Node discriminator. */
  readonly kind: "module";
  /** Complete declaration bytes, including its semicolon. */
  readonly span: SourceSpan;
  /** Qualified module spelling. */
  readonly name: string;
  /** Bytes occupied by the qualified name. */
  readonly nameSpan: SourceSpan;
}

/** One imported name and its optional local alias. */
export interface ImportItem {
  /** Imported declaration name. */
  readonly name: string;
  /** Bytes occupied by the imported name. */
  readonly nameSpan: SourceSpan;
  /** Local alias, or null when the imported name is retained. */
  readonly alias: string | null;
  /** Alias bytes, or null when no alias was written. */
  readonly aliasSpan: SourceSpan | null;
  /** Complete item bytes. */
  readonly span: SourceSpan;
}

/** A source import declaration. */
export interface ImportDeclaration {
  /** Node discriminator. */
  readonly kind: "import";
  /** Complete declaration bytes, including its semicolon. */
  readonly span: SourceSpan;
  /** Qualified source module name. */
  readonly module: string;
  /** Bytes occupied by the source module name. */
  readonly moduleSpan: SourceSpan;
  /** Imported names in source order. */
  readonly items: readonly ImportItem[];
}

/** A primitive or qualified nominal type spelling. */
export interface NamedTypeSyntax {
  /** Node discriminator. */
  readonly kind: "named-type";
  /** Complete type bytes. */
  readonly span: SourceSpan;
  /** Primitive or qualified type name. */
  readonly name: string;
}

/** One array layer around another type. */
export interface ArrayTypeSyntax {
  /** Node discriminator. */
  readonly kind: "array-type";
  /** Complete array type bytes. */
  readonly span: SourceSpan;
  /** Element type inside this array layer. */
  readonly element: TypeSyntax;
  /** Written extent, or null for the contextual unsized form. */
  readonly extent: Expr | null;
}

/** One unnamed type and qualifier in an exact function signature. */
export interface FunctionTypeParameter {
  /** Whether the parameter is read-only. */
  readonly readonly: boolean;
  /** Complete parameter type. */
  readonly type: TypeSyntax;
  /** Complete parameter bytes. */
  readonly span: SourceSpan;
}

/** A typed ordinary-function value, distinct from a raw address. */
export interface FunctionTypeSyntax {
  /** Node discriminator. */
  readonly kind: "function-type";
  /** Complete signature bytes. */
  readonly span: SourceSpan;
  /** Parameters in source order. */
  readonly parameters: readonly FunctionTypeParameter[];
  /** Written return type. */
  readonly returnType: TypeSyntax;
}

/** A bounded language form whose later implementation is still pending. */
export interface UncheckedSyntax {
  /** Node discriminator. */
  readonly kind: "unchecked";
  /** Exact bytes retained for the pending form. */
  readonly span: SourceSpan;
}

/** Type forms currently represented by the parser. */
export type TypeSyntax = NamedTypeSyntax | ArrayTypeSyntax | FunctionTypeSyntax | UncheckedSyntax;

/** An integer literal expression. */
export interface NumberExpr {
  /** Node discriminator. */
  readonly kind: "number";
  /** Complete expression bytes. */
  readonly span: SourceSpan;
  /** Exact nonnegative source value. */
  readonly value: bigint;
}

/** A Boolean literal expression. */
export interface BooleanExpr {
  /** Node discriminator. */
  readonly kind: "boolean";
  /** Complete expression bytes. */
  readonly span: SourceSpan;
  /** Literal truth value. */
  readonly value: boolean;
}

/** An unencoded string or character literal expression. */
export interface LiteralExpr {
  /** Node discriminator. */
  readonly kind: "literal";
  /** Complete expression bytes. */
  readonly span: SourceSpan;
  /** Whether source wrote a single character or a byte-sequence string. */
  readonly literalKind: "character" | "string";
  /** Ordered unencoded literal content. */
  readonly items: readonly LiteralItem[];
}

/** A source name expression. */
export interface NameExpr {
  /** Node discriminator. */
  readonly kind: "name";
  /** Complete name bytes. */
  readonly span: SourceSpan;
  /** Exact qualified or local spelling. */
  readonly name: string;
}

/** A prefix operator expression. */
export interface UnaryExpr {
  /** Node discriminator. */
  readonly kind: "unary";
  /** Complete expression bytes. */
  readonly span: SourceSpan;
  /** Exact operator spelling. */
  readonly operator: string;
  /** Operand evaluated by the prefix operator. */
  readonly operand: Expr;
}

/** A left-associative binary operator expression. */
export interface BinaryExpr {
  /** Node discriminator. */
  readonly kind: "binary";
  /** Complete expression bytes. */
  readonly span: SourceSpan;
  /** Exact operator spelling. */
  readonly operator: string;
  /** Left operand. */
  readonly left: Expr;
  /** Right operand. */
  readonly right: Expr;
}

/** A right-associative conditional expression. */
export interface ConditionalExpr {
  /** Node discriminator. */
  readonly kind: "conditional";
  /** Complete expression bytes. */
  readonly span: SourceSpan;
  /** Condition evaluated first. */
  readonly condition: Expr;
  /** Value selected when the condition is true. */
  readonly whenTrue: Expr;
  /** Value selected when the condition is false. */
  readonly whenFalse: Expr;
}

/** A primitive integer cast written with call-shaped syntax. */
export interface CastExpr {
  /** Node discriminator. */
  readonly kind: "cast";
  /** Complete cast bytes. */
  readonly span: SourceSpan;
  /** Written primitive destination type. */
  readonly type: TypeSyntax;
  /** Value being converted. */
  readonly operand: Expr;
}

/** A right-associative assignment expression. */
export interface AssignmentExpr {
  /** Node discriminator. */
  readonly kind: "assignment";
  /** Complete assignment bytes. */
  readonly span: SourceSpan;
  /** Exact assignment operator spelling. */
  readonly operator: string;
  /** Syntactic assignment target; place validity is checked later. */
  readonly target: Expr;
  /** Assigned value. */
  readonly value: Expr;
}

/** A call expression with source-ordered arguments. */
export interface CallExpr {
  /** Node discriminator. */
  readonly kind: "call";
  /** Complete call bytes. */
  readonly span: SourceSpan;
  /** Expression producing the called value. */
  readonly callee: Expr;
  /** Arguments in source order. */
  readonly arguments: readonly Expr[];
}

/** A compile-time size query over a type spelling. */
export interface SizeofExpr {
  /** Node discriminator. */
  readonly kind: "sizeof";
  /** Complete query bytes. */
  readonly span: SourceSpan;
  /** Queried type. */
  readonly operand: TypeSyntax;
}

/** A compile-time field-offset query. */
export interface OffsetofExpr {
  /** Node discriminator. */
  readonly kind: "offsetof";
  /** Complete query bytes. */
  readonly span: SourceSpan;
  /** Queried qualified aggregate type. */
  readonly operand: NamedTypeSyntax;
  /** Queried field spelling. */
  readonly field: string;
  /** Bytes occupied by the field name. */
  readonly fieldSpan: SourceSpan;
}

/** An array element-count query. */
export interface LengthExpr {
  /** Node discriminator. */
  readonly kind: "length";
  /** Complete query bytes. */
  readonly span: SourceSpan;
  /** Queried expression. */
  readonly operand: Expr;
}

/** An index expression. */
export interface IndexExpr {
  /** Node discriminator. */
  readonly kind: "index";
  /** Complete index bytes. */
  readonly span: SourceSpan;
  /** Indexed expression. */
  readonly object: Expr;
  /** Index value. */
  readonly index: Expr;
}

/** A member-selection expression. */
export interface MemberExpr {
  /** Node discriminator. */
  readonly kind: "member";
  /** Complete selection bytes. */
  readonly span: SourceSpan;
  /** Expression owning the selected member. */
  readonly object: Expr;
  /** Selected member spelling. */
  readonly member: string;
  /** Bytes occupied by the member name. */
  readonly memberSpan: SourceSpan;
}

/** An array literal with optional remaining-element fill. */
export interface ArrayLiteralExpr {
  /** Node discriminator. */
  readonly kind: "array-literal";
  /** Complete literal bytes. */
  readonly span: SourceSpan;
  /** Explicit elements in source order. */
  readonly elements: readonly Expr[];
  /** Remaining-element fill expression, or null. */
  readonly fill: Expr | null;
}

/** One named value inside a contextual struct literal. */
export interface StructLiteralField {
  /** Field spelling. */
  readonly name: string;
  /** Bytes occupied by the field name. */
  readonly nameSpan: SourceSpan;
  /** Field value expression. */
  readonly value: Expr;
  /** Complete field-initializer bytes. */
  readonly span: SourceSpan;
}

/** A contextual struct literal expression. */
export interface StructLiteralExpr {
  /** Node discriminator. */
  readonly kind: "struct-literal";
  /** Complete literal bytes. */
  readonly span: SourceSpan;
  /** Named values in source order. */
  readonly fields: readonly StructLiteralField[];
}

/** Expression forms represented by the parser. */
export type Expr =
  | NumberExpr
  | BooleanExpr
  | LiteralExpr
  | NameExpr
  | UnaryExpr
  | BinaryExpr
  | ConditionalExpr
  | CastExpr
  | AssignmentExpr
  | CallExpr
  | SizeofExpr
  | OffsetofExpr
  | LengthExpr
  | IndexExpr
  | MemberExpr
  | ArrayLiteralExpr
  | StructLiteralExpr;

/** A local or module-level variable declaration. */
export interface VariableDeclaration {
  /** Node discriminator. */
  readonly kind: "variable";
  /** Complete declaration bytes, including its terminator when present. */
  readonly span: SourceSpan;
  /** Declared name. */
  readonly name: string;
  /** Bytes occupied by the declared name. */
  readonly nameSpan: SourceSpan;
  /** Mutable or constant declaration form. */
  readonly declarationKind: "let" | "const";
  /** Package-only constant form. */
  readonly loadable: boolean;
  /** Zero-page block member. */
  readonly zeropage: boolean;
  /** Optional module-level placement constraints. */
  readonly placement: PlacementClause | null;
  /** Whether an export modifier was written. */
  readonly exported: boolean;
  /** Written type, or null only for diagnostic recovery. */
  readonly type: TypeSyntax | null;
  /** Initial value, or null when omitted. */
  readonly initializer: Expr | null;
}

/** One closed placement key and its written value. */
export interface PlacementArgument {
  /** Accepted key spelling. */
  readonly key: "at" | "align" | "noCross" | "region";
  /** Expression for numeric keys, qualified name for region. */
  readonly value: Expr | string;
  /** Complete argument bytes. */
  readonly span: SourceSpan;
}

/** A module-level placement modifier. */
export interface PlacementClause {
  /** Complete clause bytes. */
  readonly span: SourceSpan;
  /** Constraints in source order. */
  readonly arguments: readonly PlacementArgument[];
}

/** Mutable declarations grouped in zero-page storage. */
export interface ZeropageBlock {
  /** Node discriminator. */
  readonly kind: "zeropage";
  /** Complete block bytes. */
  readonly span: SourceSpan;
  /** Variables in source order. */
  readonly variables: readonly VariableDeclaration[];
}

/** One function parameter. */
export interface FunctionParameter {
  /** Parameter name. */
  readonly name: string;
  /** Bytes occupied by the parameter name. */
  readonly nameSpan: SourceSpan;
  /** Written type, or null only for diagnostic recovery. */
  readonly type: TypeSyntax | null;
  /** Whether the aggregate parameter was declared read-only. */
  readonly readonly: boolean;
  /** Complete parameter bytes. */
  readonly span: SourceSpan;
}

/** An ordinary function declaration. */
export interface FunctionDeclaration {
  /** Node discriminator. */
  readonly kind: "function";
  /** Ordinary, compile-time, or interrupt entry source form. */
  readonly mode: "ordinary" | "comptime" | "interrupt";
  /** Optional module-level placement constraints. */
  readonly placement: PlacementClause | null;
  /** Complete declaration bytes. */
  readonly span: SourceSpan;
  /** Declared function name. */
  readonly name: string;
  /** Bytes occupied by the function name. */
  readonly nameSpan: SourceSpan;
  /** Whether an export modifier was written. */
  readonly exported: boolean;
  /** Parameters in source order. */
  readonly parameters: readonly FunctionParameter[];
  /** Written return type, or null only for diagnostic recovery. */
  readonly returnType: TypeSyntax | null;
  /** Structured function body. */
  readonly body: Block;
}

/** One named member of a byte-backed enum. */
export interface EnumMember {
  /** Member spelling. */
  readonly name: string;
  /** Bytes occupied by the member name. */
  readonly nameSpan: SourceSpan;
  /** Optional written constant value. */
  readonly value: Expr | null;
  /** Complete member bytes. */
  readonly span: SourceSpan;
}

/** A nominal enum declaration. */
export interface EnumDeclaration {
  /** Node discriminator. */
  readonly kind: "enum";
  /** Complete declaration bytes. */
  readonly span: SourceSpan;
  /** Declared enum name. */
  readonly name: string;
  /** Bytes occupied by the enum name. */
  readonly nameSpan: SourceSpan;
  /** Whether an export modifier was written. */
  readonly exported: boolean;
  /** Members in source order. */
  readonly members: readonly EnumMember[];
}

/** One field in a struct declaration. */
export interface StructField {
  /** Field name. */
  readonly name: string;
  /** Bytes occupied by the field name. */
  readonly nameSpan: SourceSpan;
  /** Written field type, or null only for diagnostic recovery. */
  readonly type: TypeSyntax | null;
  /** Complete field declaration bytes. */
  readonly span: SourceSpan;
}

/** A nominal struct declaration. */
export interface StructDeclaration {
  /** Node discriminator. */
  readonly kind: "struct";
  /** Complete declaration bytes. */
  readonly span: SourceSpan;
  /** Declared struct name. */
  readonly name: string;
  /** Bytes occupied by the struct name. */
  readonly nameSpan: SourceSpan;
  /** Whether an export modifier was written. */
  readonly exported: boolean;
  /** Fields in source order. */
  readonly fields: readonly StructField[];
}

/** An expression used as a statement. */
export interface ExpressionStatement {
  /** Node discriminator. */
  readonly kind: "expression-statement";
  /** Complete statement bytes, including its semicolon. */
  readonly span: SourceSpan;
  /** Evaluated expression. */
  readonly expression: Expr;
}

/** A brace-delimited statement sequence. */
export interface Block {
  /** Node discriminator. */
  readonly kind: "block";
  /** Complete block bytes. */
  readonly span: SourceSpan;
  /** Statements in source order. */
  readonly statements: readonly Statement[];
}

/** A structured conditional statement. */
export interface IfStatement {
  /** Node discriminator. */
  readonly kind: "if";
  /** Complete conditional bytes. */
  readonly span: SourceSpan;
  /** Branch condition. */
  readonly condition: Expr;
  /** Block taken when the condition is true. */
  readonly then: Block;
  /** Optional block or else-if chain. */
  readonly otherwise: Block | IfStatement | null;
}

/** A pre-test loop. */
export interface WhileStatement {
  /** Node discriminator. */
  readonly kind: "while";
  /** Complete loop bytes. */
  readonly span: SourceSpan;
  /** Loop condition. */
  readonly condition: Expr;
  /** Repeated block. */
  readonly body: Block;
}

/** A post-test loop. */
export interface DoWhileStatement {
  /** Node discriminator. */
  readonly kind: "do-while";
  /** Complete loop bytes, including the semicolon. */
  readonly span: SourceSpan;
  /** Repeated block. */
  readonly body: Block;
  /** Condition checked after the block. */
  readonly condition: Expr;
}

/** One case or default arm of a switch. */
export interface SwitchClause {
  /** Case values, or null for the default arm. */
  readonly values: readonly Expr[] | null;
  /** Arm statements in source order. */
  readonly statements: readonly Statement[];
  /** Complete arm bytes. */
  readonly span: SourceSpan;
}

/** A multi-way branch with explicit fallthrough. */
export interface SwitchStatement {
  /** Node discriminator. */
  readonly kind: "switch";
  /** Complete switch bytes. */
  readonly span: SourceSpan;
  /** Value selected once. */
  readonly value: Expr;
  /** Cases and optional default in source order. */
  readonly clauses: readonly SwitchClause[];
}

/** An explicit request to continue into the next switch arm. */
export interface FallthroughStatement {
  /** Node discriminator. */
  readonly kind: "fallthrough";
  /** Complete statement bytes, including its semicolon. */
  readonly span: SourceSpan;
}

/** An ordinary three-clause loop. */
export interface ForStatement {
  /** Node discriminator. */
  readonly kind: "for";
  /** Complete loop bytes. */
  readonly span: SourceSpan;
  /** Optional declaration or ordered expression list. */
  readonly initializer: VariableDeclaration | readonly Expr[] | null;
  /** Optional continuation condition. */
  readonly condition: Expr | null;
  /** Optional ordered update expressions. */
  readonly update: readonly Expr[] | null;
  /** Repeated block. */
  readonly body: Block;
}

/** A loop exit statement. */
export interface BreakStatement {
  /** Node discriminator. */
  readonly kind: "break";
  /** Complete statement bytes. */
  readonly span: SourceSpan;
}

/** A loop continuation statement. */
export interface ContinueStatement {
  /** Node discriminator. */
  readonly kind: "continue";
  /** Complete statement bytes. */
  readonly span: SourceSpan;
}

/** A function return statement. */
export interface ReturnStatement {
  /** Node discriminator. */
  readonly kind: "return";
  /** Complete statement bytes. */
  readonly span: SourceSpan;
  /** Returned expression, or null for a valueless return. */
  readonly value: Expr | null;
}

/** Rejected syntax retained only to preserve later siblings. */
export interface PoisonStatement {
  /** Node discriminator. */
  readonly kind: "poison";
  /** Exact rejected bytes. */
  readonly span: SourceSpan;
}

/** Statement forms currently represented by the parser. */
export type Statement =
  | VariableDeclaration
  | ExpressionStatement
  | Block
  | IfStatement
  | WhileStatement
  | DoWhileStatement
  | ForStatement
  | SwitchStatement
  | FallthroughStatement
  | BreakStatement
  | ContinueStatement
  | ReturnStatement
  | PoisonStatement
  | UncheckedSyntax;

/** Module-level declarations currently represented by the parser. */
export type Declaration =
  | VariableDeclaration
  | FunctionDeclaration
  | StructDeclaration
  | EnumDeclaration
  | ZeropageBlock
  | PoisonStatement
  | UncheckedSyntax;

/** A partial or complete syntax tree for one source. */
export interface SyntaxUnit {
  /** Bytes covered by the source syntax result. */
  readonly span: SourceSpan;
  /** Leading module declaration, or null when it was missing. */
  readonly header: ModuleHeader | null;
  /** Imports in source order. */
  readonly imports: readonly ImportDeclaration[];
  /** Declarations and retained unchecked forms in source order. */
  readonly declarations: readonly Declaration[];
}

/** Parser output; completion is independent of diagnostic presence. */
export interface ParseResult {
  /** Partial syntax tree, or null when no safe root could be retained. */
  readonly unit: SyntaxUnit | null;
  /** Proving syntax and normative root diagnostics. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** True only when every syntax obligation was checked. */
  readonly complete: boolean;
  /** Exact valid-language regions deferred to a later implementation phase. */
  readonly unchecked: readonly SourceSpan[];
}

/** Module-header discovery output that intentionally ignores the source body. */
export interface HeaderResult {
  /** Parsed leading module declaration, or null. */
  readonly header: ModuleHeader | null;
  /** Header-only diagnostics. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** True when header discovery reached a definitive boundary. */
  readonly complete: boolean;
}
