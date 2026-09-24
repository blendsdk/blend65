import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceRecord, SourceSpan } from "../project/types.js";
import { isScalarType, scalarWarning, SCALAR_TYPES, wrapInteger } from "./constants.js";
import type { ScalarExpressionAnalyzer } from "./scalar-expressions.js";
import {
  captureBranchFacts,
  clearMutableScalarFacts,
  mergeScalarFacts,
  restoreScalarFacts,
  snapshotScalarFacts,
} from "./flow-facts.js";
import type {
  BindingId,
  ScalarExpressionContext,
  ScalarFactSnapshot,
  ScalarScope,
  ScalarValueState,
  SemanticType,
  TypedBlock,
  TypedDoWhileStatement,
  TypedExpr,
  TypedForStatement,
  TypedIfStatement,
  TypedVariableStatement,
} from "./semantic-types.js";
import type {
  Block,
  Expr,
  ForStatement,
  DoWhileStatement,
  IfStatement,
  Statement,
  VariableDeclaration,
} from "./syntax.js";

/** Structured exits which may leave a statement or block. */
export interface FlowSummary {
  /** Execution may continue with the next statement. */
  readonly normal: boolean;
  /** At least one path returns from the function. */
  readonly returns: boolean;
  /** At least one path exits the current loop. */
  readonly breaks: boolean;
  /** At least one path continues the current loop. */
  readonly continues: boolean;
}

/** Proof that a fixed-width canonical counter repeats before its bound. */
export interface WrappingLoopProof {
  /** Counter declaration identity. */
  readonly counter: BindingId;
  /** Counter spelling used in the diagnostic. */
  readonly name: string;
  /** Human-readable representable range. */
  readonly range: string;
  /** Invariant condition bound. */
  readonly bound: bigint;
  /** Smallest same-signedness type which represents the bound. */
  readonly suggestedType: "word" | "sword";
}

/** Narrow the parser's readonly initializer-list union. */
function isExpressionList(
  initializer: VariableDeclaration | readonly Expr[],
): initializer is readonly Expr[] {
  return Array.isArray(initializer);
}

/** Narrow a typed readonly loop-initializer list. */
function isTypedExpressionList(
  initializer: TypedVariableStatement | readonly TypedExpr[],
): initializer is readonly TypedExpr[] {
  return Array.isArray(initializer);
}

/** Summarize the structured exits of one typed block without constructing a CFG. */
export function summarizeTypedBlock(block: TypedBlock): FlowSummary {
  let normal = true;
  let returns = false;
  let breaks = false;
  let continues = false;
  for (const statement of block.statements) {
    if (!normal) break;
    if (statement.kind === "return") {
      returns = true;
      normal = false;
    } else if (statement.kind === "break") {
      breaks = true;
      normal = false;
    } else if (statement.kind === "continue") {
      continues = true;
      normal = false;
    } else if (statement.kind === "block") {
      const nested = summarizeTypedBlock(statement);
      returns ||= nested.returns;
      breaks ||= nested.breaks;
      continues ||= nested.continues;
      normal = nested.normal;
    } else if (statement.kind === "if") {
      const thenFlow = summarizeTypedBlock(statement.then);
      const elseFlow = summarizeTypedAlternative(statement.otherwise);
      returns ||= thenFlow.returns || elseFlow.returns;
      breaks ||= thenFlow.breaks || elseFlow.breaks;
      continues ||= thenFlow.continues || elseFlow.continues;
      normal = thenFlow.normal || elseFlow.normal;
    } else if (statement.kind === "while") {
      const bodyFlow = summarizeTypedBlock(statement.body);
      returns ||= bodyFlow.returns;
      const alwaysRepeats =
        statement.condition.kind === "boolean" &&
        statement.condition.value === true &&
        !bodyFlow.breaks;
      normal = !alwaysRepeats;
    } else if (statement.kind === "do-while") {
      const bodyFlow = summarizeTypedBlock(statement.body);
      returns ||= bodyFlow.returns;
      normal =
        bodyFlow.breaks ||
        ((bodyFlow.normal || bodyFlow.continues) && statement.condition.constant !== true);
    } else if (statement.kind === "for") {
      const bodyFlow = summarizeTypedBlock(statement.body);
      returns ||= bodyFlow.returns;
      const conditionAlwaysTrue =
        statement.condition === null ||
        (statement.condition.kind === "boolean" && statement.condition.value === true);
      normal = !conditionAlwaysTrue || bodyFlow.breaks;
    } else if (statement.kind === "switch") {
      let armContinues = false;
      let armReturns = false;
      let nextArmContinues = false;
      for (const clause of [...statement.clauses].reverse()) {
        const arm = summarizeTypedBlock(clause.body);
        const armCanContinue: boolean =
          arm.normal && (clause.fallthrough ? nextArmContinues : true);
        armContinues ||= armCanContinue;
        armReturns ||= arm.returns;
        breaks ||= arm.breaks;
        continues ||= arm.continues;
        nextArmContinues = armCanContinue;
      }
      returns ||= armReturns;
      normal = armContinues || !statement.clauses.some((clause) => clause.values === null);
    }
  }
  return Object.freeze({ normal, returns, breaks, continues });
}

/** Summarize the false side of an if statement, including an absent branch. */
function summarizeTypedAlternative(alternative: TypedBlock | TypedIfStatement | null): FlowSummary {
  if (alternative === null) {
    return Object.freeze({ normal: true, returns: false, breaks: false, continues: false });
  }
  if (alternative.kind === "block") return summarizeTypedBlock(alternative);
  const thenFlow = summarizeTypedBlock(alternative.then);
  const elseFlow = summarizeTypedAlternative(alternative.otherwise);
  return Object.freeze({
    normal: thenFlow.normal || elseFlow.normal,
    returns: thenFlow.returns || elseFlow.returns,
    breaks: thenFlow.breaks || elseFlow.breaks,
    continues: thenFlow.continues || elseFlow.continues,
  });
}

/** Return whether a source block contains an explicit loop or function exit. */
export function blockHasExplicitExit(block: Block, nestedLoopDepth = 0): boolean {
  return block.statements.some((statement) => statementHasExplicitExit(statement, nestedLoopDepth));
}

/** Find returns and breaks which can leave the canonical loop being proved. */
function statementHasExplicitExit(statement: Statement, nestedLoopDepth: number): boolean {
  if (statement.kind === "return") return true;
  if (statement.kind === "break") return nestedLoopDepth === 0;
  if (statement.kind === "block") return blockHasExplicitExit(statement, nestedLoopDepth);
  if (statement.kind === "if") {
    return (
      blockHasExplicitExit(statement.then, nestedLoopDepth) ||
      (statement.otherwise !== null &&
        (statement.otherwise.kind === "block"
          ? blockHasExplicitExit(statement.otherwise, nestedLoopDepth)
          : statementHasExplicitExit(statement.otherwise, nestedLoopDepth)))
    );
  }
  if (statement.kind === "while" || statement.kind === "for" || statement.kind === "do-while") {
    return blockHasExplicitExit(statement.body, nestedLoopDepth + 1);
  }
  if (statement.kind === "switch") {
    return statement.clauses.some((clause) =>
      blockHasExplicitExit(
        { kind: "block", span: clause.span, statements: clause.statements },
        nestedLoopDepth,
      ),
    );
  }
  return false;
}

/**
 * Prove only the narrow canonical loop shape needed for fixed-width reachability.
 * Any body call, counter write, explicit exit, or non-literal bound declines the
 * proof and leaves the ordinary loop legal.
 */
export function proveWrappingForLoop(
  statement: ForStatement,
  counter: BindingId,
  counterType: SemanticType,
): WrappingLoopProof | null {
  if (
    statement.initializer === null ||
    isExpressionList(statement.initializer) ||
    statement.initializer.initializer === null ||
    statement.initializer.initializer.kind !== "number" ||
    statement.condition?.kind !== "binary" ||
    statement.condition.operator !== "<" ||
    statement.condition.left.kind !== "name" ||
    statement.condition.left.name !== statement.initializer.name ||
    statement.condition.right.kind !== "number" ||
    statement.update === null ||
    statement.update.length !== 1 ||
    blockHasExplicitExit(statement.body) ||
    blockTouchesName(statement.body, statement.initializer.name)
  ) {
    return null;
  }
  const update = statement.update[0];
  if (
    update === undefined ||
    update.kind !== "assignment" ||
    update.operator !== "+=" ||
    update.target.kind !== "name" ||
    update.target.name !== statement.initializer.name ||
    update.value.kind !== "number" ||
    update.value.value <= 0n
  ) {
    return null;
  }
  const start = statement.initializer.initializer.value;
  const bound = statement.condition.right.value;
  if (!isScalarType(counterType) || (counterType.name !== "byte" && counterType.name !== "sbyte")) {
    return null;
  }

  const seen = new Set<bigint>();
  let current = wrapInteger(start, counterType);
  while (!seen.has(current)) {
    if (current >= bound) return null;
    seen.add(current);
    current = wrapInteger(current + update.value.value, counterType);
  }
  return Object.freeze({
    counter,
    name: statement.initializer.name,
    range: counterType.name === "byte" ? "0–255" : "-128–127",
    bound,
    suggestedType: counterType.name === "byte" ? "word" : "sword",
  });
}

/** Return whether a loop body may change the counter or hide such a change in a call. */
function blockTouchesName(block: Block, name: string): boolean {
  return block.statements.some((statement) => statementTouchesName(statement, name));
}

/** Conservatively find counter assignments and calls in one source statement. */
function statementTouchesName(statement: Statement, name: string): boolean {
  if (statement.kind === "variable") {
    return statement.initializer !== null && expressionTouchesName(statement.initializer, name);
  }
  if (statement.kind === "expression-statement") {
    return expressionTouchesName(statement.expression, name);
  }
  if (statement.kind === "block") return blockTouchesName(statement, name);
  if (statement.kind === "if") {
    return (
      expressionTouchesName(statement.condition, name) ||
      blockTouchesName(statement.then, name) ||
      (statement.otherwise !== null &&
        (statement.otherwise.kind === "block"
          ? blockTouchesName(statement.otherwise, name)
          : statementTouchesName(statement.otherwise, name)))
    );
  }
  if (statement.kind === "while") {
    return (
      expressionTouchesName(statement.condition, name) || blockTouchesName(statement.body, name)
    );
  }
  if (statement.kind === "do-while") {
    return (
      blockTouchesName(statement.body, name) || expressionTouchesName(statement.condition, name)
    );
  }
  if (statement.kind === "switch") {
    return (
      expressionTouchesName(statement.value, name) ||
      statement.clauses.some((clause) =>
        clause.statements.some((child) => statementTouchesName(child, name)),
      )
    );
  }
  if (statement.kind === "for") return true;
  if (statement.kind === "return") {
    return statement.value !== null && expressionTouchesName(statement.value, name);
  }
  return false;
}

/** Conservatively find a call or assignment to the selected name in an expression tree. */
function expressionTouchesName(expression: Expr, name: string): boolean {
  switch (expression.kind) {
    case "assignment":
      return (
        (expression.target.kind === "name" && expression.target.name === name) ||
        expressionTouchesName(expression.target, name) ||
        expressionTouchesName(expression.value, name)
      );
    case "call":
      return true;
    case "unary":
    case "cast":
      return expressionTouchesName(expression.operand, name);
    case "binary":
      return (
        expressionTouchesName(expression.left, name) ||
        expressionTouchesName(expression.right, name)
      );
    case "conditional":
      return (
        expressionTouchesName(expression.condition, name) ||
        expressionTouchesName(expression.whenTrue, name) ||
        expressionTouchesName(expression.whenFalse, name)
      );
    case "index":
      return (
        expressionTouchesName(expression.object, name) ||
        expressionTouchesName(expression.index, name)
      );
    case "member":
      return expressionTouchesName(expression.object, name);
    case "length":
      return expressionTouchesName(expression.operand, name);
    case "array-literal":
      return (
        expression.elements.some((element) => expressionTouchesName(element, name)) ||
        (expression.fill !== null && expressionTouchesName(expression.fill, name))
      );
    case "struct-literal":
      return expression.fields.some((field) => expressionTouchesName(field.value, name));
    default:
      return false;
  }
}

/** Build a module lookup scope extended by imports from one source contribution. */
export function moduleValueScope(
  moduleValues: ReadonlyMap<string, ScalarValueState> | undefined,
  imports: ReadonlyMap<string, ScalarValueState> | undefined,
): ScalarScope {
  const values = new Map(moduleValues ?? []);
  for (const [name, state] of imports ?? []) values.set(name, state);
  return { parent: null, values };
}

/** Resolve a lexical or qualified value without changing scope state. */
export function resolveScalarName(
  name: string,
  context: ScalarExpressionContext,
  qualified: ReadonlyMap<string, ScalarValueState>,
): ScalarValueState | null {
  for (let scope: ScalarScope | null = context.scope; scope !== null; scope = scope.parent) {
    const state = scope.values.get(name);
    if (state !== undefined) return state;
  }
  return qualified.get(name) ?? null;
}

/** Clear mutable reaching values after a branch or loop join. */
export function clearMutableFacts(scope: ScalarScope): void {
  clearMutableScalarFacts(scope);
}

/** Create the no-truthiness condition diagnostic when an expression is not Boolean. */
export function conditionDiagnostic(
  expression: TypedExpr,
  span: SourceSpan,
): ProjectDiagnostic | null {
  return isScalarType(expression.type) && expression.type.name === "boolean"
    ? null
    : projectDiagnostic(
        "E10100",
        `Condition must have type 'boolean' — found '${expression.type.kind === "scalar" ? expression.type.name : expression.type.kind}'; use an explicit comparison`,
        span,
      );
}

/** Supply a local Boolean recovery node after a condition's root error. */
export function poisonBoolean(span: SourceSpan): TypedExpr {
  return Object.freeze({
    kind: "boolean",
    span: Object.freeze({ ...span }),
    type: SCALAR_TYPES.boolean,
    constant: null,
    binding: null,
    place: null,
    conversion: null,
    integer: null,
  });
}

/** Create a duplicate diagnostic with its first declaration's raw-byte location. */
export function duplicateDeclarationDiagnostic(
  name: string,
  span: SourceSpan,
  first: ScalarValueState,
  source: SourceRecord | undefined,
): ProjectDiagnostic {
  const location =
    source === undefined
      ? `${first.nameSpan.sourceId}:1:1`
      : rawByteLocation(source, first.nameSpan.start);
  return projectDiagnostic(
    "E10003",
    `Duplicate declaration '${name}' in the same scope — also declared at ${location}`,
    span,
    null,
    [Object.freeze({ span: first.nameSpan, message: "First declaration is here" })],
  );
}

/** Render one-based line and raw-byte column for a trusted source offset. */
function rawByteLocation(source: SourceRecord, offset: number): string {
  const bytes = Buffer.from(source.text, "utf8");
  let line = 1;
  let column = 1;
  let previousCR = false;
  for (let index = 0; index < Math.min(offset, bytes.length); index += 1) {
    const byte = bytes[index]!;
    if (byte === 0x0d) {
      line += 1;
      column = 1;
      previousCR = true;
    } else if (byte === 0x0a) {
      if (!previousCR) line += 1;
      column = 1;
      previousCR = false;
    } else {
      column += 1;
      previousCR = false;
    }
  }
  return `${source.sourceId}:${line}:${column}`;
}

/** Decode one exact raw-byte range for a source-facing diagnostic. */
export function sourceText(sources: ReadonlyMap<string, SourceRecord>, span: SourceSpan): string {
  const source = sources.get(span.sourceId);
  return source === undefined
    ? "<expression>"
    : Buffer.from(source.text, "utf8").subarray(span.start, span.end).toString("utf8");
}

/** Direct callbacks used when structured flow recurses into owned analysis. */
interface StructuredFlowHost {
  /** Analyze a nested block. */
  analyzeBlock(
    block: Block,
    scope: ScalarScope,
    module: string,
    caller: BindingId,
    returnType: SemanticType,
    loopDepth: number,
  ): TypedBlock;
  /** Analyze a loop body and retain facts at its own early exits. */
  analyzeLoopBlock(
    block: Block,
    scope: ScalarScope,
    module: string,
    caller: BindingId,
    returnType: SemanticType,
    loopDepth: number,
  ): {
    readonly body: TypedBlock;
    readonly exits: readonly {
      readonly kind: "break" | "continue";
      readonly facts: ScalarFactSnapshot;
    }[];
  };
  /** Analyze one loop-header declaration. */
  analyzeLocal(
    declaration: VariableDeclaration,
    scope: ScalarScope,
    context: ScalarExpressionContext,
  ): TypedVariableStatement | null;
  /** Append one proving diagnostic. */
  diagnose(diagnostic: ProjectDiagnostic): void;
}

/** Analyze an if/else chain and conservatively join reaching values. */
export function analyzeStructuredIf(
  statement: IfStatement,
  scope: ScalarScope,
  module: string,
  caller: BindingId,
  returnType: SemanticType,
  loopDepth: number,
  expressions: ScalarExpressionAnalyzer,
  host: StructuredFlowHost,
): TypedIfStatement {
  const condition = expressions.analyze(statement.condition, null, {
    scope,
    module,
    sourceId: statement.span.sourceId,
    caller,
    constantContext: false,
  }).node;
  if (condition !== null) {
    const diagnostic = conditionDiagnostic(condition, statement.condition.span);
    if (diagnostic !== null) host.diagnose(diagnostic);
  }
  const baseline = snapshotScalarFacts(scope);
  const then = host.analyzeBlock(statement.then, scope, module, caller, returnType, loopDepth);
  const thenFacts = captureBranchFacts(baseline);
  restoreScalarFacts(baseline);
  let otherwise: TypedBlock | TypedIfStatement | null = null;
  if (statement.otherwise?.kind === "block") {
    otherwise = host.analyzeBlock(
      statement.otherwise,
      scope,
      module,
      caller,
      returnType,
      loopDepth,
    );
  } else if (statement.otherwise?.kind === "if") {
    otherwise = analyzeStructuredIf(
      statement.otherwise,
      scope,
      module,
      caller,
      returnType,
      loopDepth,
      expressions,
      host,
    );
  }
  const elseFacts = captureBranchFacts(baseline);
  const thenNormal = summarizeTypedBlock(then).normal;
  const elseNormal =
    otherwise === null
      ? true
      : otherwise.kind === "block"
        ? summarizeTypedBlock(otherwise).normal
        : summarizeTypedAlternative(otherwise).normal;
  const alternatives = [];
  if (condition?.constant !== false && thenNormal) alternatives.push(thenFacts);
  if (condition?.constant !== true && elseNormal) alternatives.push(elseFacts);
  if (alternatives.length > 0) mergeScalarFacts(baseline, alternatives);
  return Object.freeze({
    kind: "if",
    span: Object.freeze({ ...statement.span }),
    condition: condition ?? poisonBoolean(statement.condition.span),
    then,
    otherwise,
  });
}

/** Analyze a post-test loop, retaining body initialization before the first test. */
export function analyzeStructuredDoWhile(
  statement: DoWhileStatement,
  scope: ScalarScope,
  module: string,
  caller: BindingId,
  returnType: SemanticType,
  loopDepth: number,
  expressions: ScalarExpressionAnalyzer,
  host: StructuredFlowHost,
): TypedDoWhileStatement {
  clearMutableScalarFacts(scope);
  const entryFacts = snapshotScalarFacts(scope);
  const { body, exits } = host.analyzeLoopBlock(
    statement.body,
    scope,
    module,
    caller,
    returnType,
    loopDepth + 1,
  );
  const continuationFacts = [
    ...(summarizeTypedBlock(body).normal ? [captureBranchFacts(entryFacts)] : []),
    ...exits.filter((exit) => exit.kind === "continue").map((exit) => exit.facts),
  ];
  if (continuationFacts.length > 0) mergeScalarFacts(entryFacts, continuationFacts);
  const condition = expressions.analyze(statement.condition, null, {
    scope,
    module,
    sourceId: statement.span.sourceId,
    caller,
    constantContext: false,
  }).node;
  if (condition !== null) {
    const diagnostic = conditionDiagnostic(condition, statement.condition.span);
    if (diagnostic !== null) host.diagnose(diagnostic);
  }
  const exitFacts = exits.filter((exit) => exit.kind === "break").map((exit) => exit.facts);
  if (condition?.constant !== true && continuationFacts.length > 0) {
    exitFacts.push(captureBranchFacts(entryFacts));
  }
  if (exitFacts.length > 0) mergeScalarFacts(entryFacts, exitFacts);
  if (condition?.constant !== false) clearMutableScalarFacts(scope);
  return Object.freeze({
    kind: "do-while",
    span: Object.freeze({ ...statement.span }),
    body,
    condition: condition ?? poisonBoolean(statement.condition.span),
  });
}

/** Analyze a three-clause for statement with one header scope and ordered clauses. */
export function analyzeStructuredFor(
  statement: ForStatement,
  outer: ScalarScope,
  module: string,
  caller: BindingId,
  returnType: SemanticType,
  loopDepth: number,
  expressions: ScalarExpressionAnalyzer,
  host: StructuredFlowHost,
): TypedForStatement {
  const scope: ScalarScope = { parent: outer, values: new Map() };
  const context: ScalarExpressionContext = {
    scope,
    module,
    sourceId: statement.span.sourceId,
    caller,
    constantContext: false,
  };
  let initializer: TypedVariableStatement | readonly TypedExpr[] | null = null;
  if (statement.initializer !== null) {
    if (isExpressionList(statement.initializer)) {
      initializer = Object.freeze(
        statement.initializer
          .map((expression) => expressions.analyze(expression, null, context).node)
          .filter((expression): expression is TypedExpr => expression !== null),
      );
    } else {
      initializer = host.analyzeLocal(statement.initializer, scope, context);
    }
  }
  clearMutableScalarFacts(scope);
  const condition =
    statement.condition === null
      ? null
      : expressions.analyze(statement.condition, null, context).node;
  if (condition !== null) {
    const diagnostic = conditionDiagnostic(condition, statement.condition!.span);
    if (diagnostic !== null) host.diagnose(diagnostic);
    if (condition.constant === false) {
      host.diagnose(
        scalarWarning(
          "W10130",
          "Condition is always false — this block cannot execute",
          statement.condition!.span,
        ),
      );
    }
  }
  const loopEntry = snapshotScalarFacts(scope);
  const { body } = host.analyzeLoopBlock(
    statement.body,
    scope,
    module,
    caller,
    returnType,
    loopDepth + 1,
  );
  const update =
    statement.update === null
      ? null
      : Object.freeze(
          statement.update
            .map((expression) => expressions.analyze(expression, null, context).node)
            .filter((expression): expression is TypedExpr => expression !== null),
        );
  const bodyFacts = captureBranchFacts(loopEntry);
  if (initializer !== null && !isTypedExpressionList(initializer)) {
    const state = scope.values.get(initializer.name);
    if (state !== undefined) {
      const proof = proveWrappingForLoop(statement, state.binding.id, state.binding.type!);
      if (proof !== null) {
        host.diagnose(
          projectDiagnostic(
            "E10262",
            `Loop counter '${proof.name}' repeats within ${proof.range} before condition bound ${proof.bound} can be reached — use '${proof.suggestedType}' or make deliberate wrap/infinite control explicit`,
            statement.condition?.span ?? statement.span,
          ),
        );
      }
    }
  }
  mergeScalarFacts(loopEntry, [loopEntry, bodyFacts]);
  return Object.freeze({
    kind: "for",
    span: Object.freeze({ ...statement.span }),
    initializer,
    condition,
    update,
    body,
    continueTarget: "update",
    breakTarget: "exit",
  });
}
