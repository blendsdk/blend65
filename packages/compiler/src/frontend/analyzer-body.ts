import { projectDiagnostic as errorDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceRecord, SourceSpan } from "../project/types.js";
import { scalarWarning } from "./constants.js";
import { analyzeReturnStatement } from "./analyzer-return.js";
import {
  analyzeStructuredFor,
  analyzeStructuredIf,
  analyzeStructuredDoWhile,
  clearMutableFacts,
  conditionDiagnostic,
} from "./flow.js";
import type { ScalarExpressionAnalyzer } from "./scalar-expressions.js";
import { analyzeStructuredSwitch } from "./switch-flow.js";
import type { FunctionInfo } from "./module-bindings.js";
import { captureBranchFacts, mergeScalarFacts, snapshotScalarFacts } from "./flow-facts.js";
import { bindingIdentityKey, freezeSourceSpan } from "./semantic-types.js";
import type {
  BindingId,
  ScalarExpressionContext as ExpressionContext,
  ScalarFactSnapshot,
  ScalarScope as Scope,
  SemanticBinding,
  SemanticType,
  TypedBlock,
  TypedExpr,
  TypedStatement,
  TypedVariableStatement,
} from "./semantic-types.js";
import type { Block, Statement, VariableDeclaration } from "./syntax.js";

/** Shared declaration state and callbacks needed to check a function body. */
export interface BodyAnalysisHost {
  /** Diagnostic sink shared with declaration analysis. */
  readonly diagnostics: ProjectDiagnostic[];
  /** Expression checker using the same binding environment. */
  readonly expressions: ScalarExpressionAnalyzer;
  /** Original sources for structured-statement diagnostics. */
  readonly sources: ReadonlyMap<string, SourceRecord>;
  /** Source binding identities indexed by stable key. */
  readonly bindingByKey: ReadonlyMap<string, SemanticBinding>;
  /** Function signatures and declarations indexed by stable key. */
  readonly functionByKey: ReadonlyMap<string, FunctionInfo>;
  /** Check a local before introducing its binding into the scope. */
  readonly analyzeLocal: (
    declaration: VariableDeclaration,
    scope: Scope,
    context: ExpressionContext,
  ) => TypedVariableStatement | null;
  /** Retain a statement whose implementation is not available. */
  readonly addObligation: (span: SourceSpan, message: string) => void;
}

/** Check structured statements while keeping loop-exit facts local to each body. */
export class BodyAnalyzer {
  /** One active frame per nested loop so jumps credit only their own loop's facts. */
  private readonly loopFactCollectors: {
    readonly baseline: ScalarFactSnapshot;
    readonly exits: { readonly kind: "break" | "continue"; readonly facts: ScalarFactSnapshot }[];
  }[] = [];

  /** Use the declaration analyzer's existing state without duplicating ownership. */
  constructor(private readonly host: BodyAnalysisHost) {}

  /** Analyze a block, optionally sharing its scope with function parameters. */
  analyzeBlock(
    block: Block,
    parent: Scope,
    module: string,
    caller: BindingId,
    returnType: SemanticType,
    loopDepth: number,
    nested = true,
  ): TypedBlock {
    const scope: Scope = nested ? { parent, values: new Map() } : parent;
    const statements: TypedStatement[] = [];
    let terminal: "break" | "continue" | "return" | null = null;
    let warned = false;
    for (const statement of block.statements) {
      if (terminal !== null) {
        if (!warned) {
          this.host.diagnostics.push(
            scalarWarning(
              "W10131",
              `Unreachable code — statements after '${terminal}' cannot execute`,
              statement.span,
            ),
          );
          warned = true;
        }
        continue;
      }
      const typed = this.analyzeStatement(statement, scope, module, caller, returnType, loopDepth);
      if (typed !== null) {
        statements.push(typed);
        if (typed.kind === "break" || typed.kind === "continue" || typed.kind === "return") {
          terminal = typed.kind;
        }
      }
    }
    return Object.freeze({
      kind: "block",
      span: freezeSourceSpan(block.span),
      statements: Object.freeze(statements),
    });
  }

  /** Analyze a loop body while sampling each break/continue before branch joins erase it. */
  private analyzeLoopBlock(
    block: Block,
    scope: Scope,
    module: string,
    caller: BindingId,
    returnType: SemanticType,
    loopDepth: number,
  ) {
    const frame = {
      baseline: snapshotScalarFacts(scope),
      exits: [] as {
        readonly kind: "break" | "continue";
        readonly facts: ScalarFactSnapshot;
      }[],
    };
    this.loopFactCollectors.push(frame);
    try {
      const body = this.analyzeBlock(block, scope, module, caller, returnType, loopDepth);
      return Object.freeze({ body, exits: Object.freeze(frame.exits) });
    } finally {
      this.loopFactCollectors.pop();
    }
  }

  /** Analyze one structured statement while retaining source order. */
  private analyzeStatement(
    statement: Statement,
    scope: Scope,
    module: string,
    caller: BindingId,
    returnType: SemanticType,
    loopDepth: number,
  ): TypedStatement | null {
    const context: ExpressionContext = {
      scope,
      module,
      sourceId: statement.span.sourceId,
      caller,
      constantContext: false,
    };
    if (statement.kind === "variable") return this.host.analyzeLocal(statement, scope, context);
    if (statement.kind === "expression-statement") {
      const expression = this.host.expressions.analyze(statement.expression, null, {
        ...context,
        cpuStatementExpression: statement.expression,
      }).node;
      return expression === null
        ? null
        : Object.freeze({
            kind: "expression-statement",
            span: freezeSourceSpan(statement.span),
            expression,
          });
    }
    if (statement.kind === "block")
      return this.analyzeBlock(statement, scope, module, caller, returnType, loopDepth);
    if (statement.kind === "if")
      return analyzeStructuredIf(
        statement,
        scope,
        module,
        caller,
        returnType,
        loopDepth,
        this.host.expressions,
        this.structuredFlowHost(),
      );
    if (statement.kind === "while") {
      clearMutableFacts(scope);
      const condition = this.host.expressions.analyze(statement.condition, null, context).node;
      if (condition !== null) this.addConditionDiagnostic(condition, statement.condition.span);
      if (condition?.constant === false) {
        this.host.diagnostics.push(
          scalarWarning(
            "W10130",
            "Condition is always false — this block cannot execute",
            statement.condition.span,
          ),
        );
      }
      const loopEntry = snapshotScalarFacts(scope);
      const { body } = this.analyzeLoopBlock(
        statement.body,
        scope,
        module,
        caller,
        returnType,
        loopDepth + 1,
      );
      const bodyFacts = captureBranchFacts(loopEntry);
      mergeScalarFacts(loopEntry, [loopEntry, bodyFacts]);
      return condition === null
        ? null
        : Object.freeze({ kind: "while", span: freezeSourceSpan(statement.span), condition, body });
    }
    if (statement.kind === "for")
      return analyzeStructuredFor(
        statement,
        scope,
        module,
        caller,
        returnType,
        loopDepth,
        this.host.expressions,
        this.structuredFlowHost(),
      );
    if (statement.kind === "do-while")
      return analyzeStructuredDoWhile(
        statement,
        scope,
        module,
        caller,
        returnType,
        loopDepth,
        this.host.expressions,
        this.structuredFlowHost(),
      );
    if (statement.kind === "switch") {
      return analyzeStructuredSwitch(
        statement,
        scope,
        module,
        caller,
        returnType,
        loopDepth,
        this.host.expressions,
        {
          analyzeBlock: (body, parent, owner, functionId, resultType, depth) =>
            this.analyzeBlock(body, parent, owner, functionId, resultType, depth),
          diagnose: (diagnostic) => this.host.diagnostics.push(diagnostic),
          source: this.host.sources.get(statement.span.sourceId),
        },
      );
    }
    if (statement.kind === "return") {
      return analyzeReturnStatement(
        statement,
        returnType,
        this.host.bindingByKey.get(bindingIdentityKey(caller))?.name ?? "<function>",
        context,
        this.host.expressions,
        this.host.diagnostics,
        this.host.functionByKey.get(bindingIdentityKey(caller))!.declaration.nameSpan,
      );
    }
    if (statement.kind === "break" || statement.kind === "continue") {
      if (loopDepth === 0) {
        this.host.diagnostics.push(
          errorDiagnostic("E10063", `'${statement.kind}' can only be used inside a loop body`, {
            ...statement.span,
            end: statement.span.start + statement.kind.length,
          }),
        );
      }
      const frame = this.loopFactCollectors.at(-1);
      if (frame !== undefined) {
        frame.exits.push({ kind: statement.kind, facts: captureBranchFacts(frame.baseline) });
      }
      return Object.freeze({ kind: statement.kind, span: freezeSourceSpan(statement.span) });
    }
    if (statement.kind === "unchecked" || statement.kind === "fallthrough") {
      this.host.addObligation(
        statement.span,
        "Statement is not implemented by this frontend slice",
      );
    }
    return null;
  }

  /** Bind structured-flow callbacks directly to this analysis instance. */
  private structuredFlowHost() {
    return {
      analyzeBlock: (
        block: Block,
        scope: Scope,
        module: string,
        caller: BindingId,
        returnType: SemanticType,
        loopDepth: number,
      ) => this.analyzeBlock(block, scope, module, caller, returnType, loopDepth),
      analyzeLoopBlock: (
        block: Block,
        scope: Scope,
        module: string,
        caller: BindingId,
        returnType: SemanticType,
        loopDepth: number,
      ) => this.analyzeLoopBlock(block, scope, module, caller, returnType, loopDepth),
      analyzeLocal: (declaration: VariableDeclaration, scope: Scope, context: ExpressionContext) =>
        this.host.analyzeLocal(declaration, scope, context),
      diagnose: (diagnostic: ProjectDiagnostic) => this.host.diagnostics.push(diagnostic),
    };
  }

  /** Append a condition diagnostic only when the expression is not Boolean. */
  private addConditionDiagnostic(expression: TypedExpr, span: SourceSpan): void {
    const diagnostic = conditionDiagnostic(expression, span);
    if (diagnostic !== null) this.host.diagnostics.push(diagnostic);
  }
}
