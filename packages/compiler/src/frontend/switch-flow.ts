import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceRecord, SourceSpan } from "../project/types.js";
import { fitsInteger, isIntegerType, scalarWarning } from "./constants.js";
import { semanticTypeName, semanticTypesEqual } from "./semantic-type-relations.js";
import {
  captureBranchFacts,
  mergeScalarFacts,
  restoreScalarFacts,
  snapshotScalarFacts,
} from "./flow-facts.js";
import type { ScalarExpressionAnalyzer } from "./scalar-expressions.js";
import type {
  BindingId,
  ScalarExpressionContext,
  ScalarScope,
  ScalarFactSnapshot,
  SemanticType,
  TypedBlock,
  TypedExpr,
  TypedSwitchClause,
  TypedSwitchStatement,
} from "./semantic-types.js";
import type { Block, Statement, SwitchStatement } from "./syntax.js";

/** Existing analyzer callbacks used to check one switch body. */
export interface SwitchFlowHost {
  /** Check a case body in its own lexical scope. */
  readonly analyzeBlock: (
    block: Block,
    scope: ScalarScope,
    module: string,
    caller: BindingId,
    returnType: SemanticType,
    loopDepth: number,
  ) => TypedBlock;
  /** Append a semantic diagnostic. */
  readonly diagnose: (diagnostic: ProjectDiagnostic) => void;
  /** Source record used for the duplicate label's first location. */
  readonly source: SourceRecord | undefined;
}

/** Render the source location of an earlier case label using raw UTF-8 bytes. */
function sourceLocation(source: SourceRecord | undefined, span: SourceSpan): string {
  if (source === undefined) return `${span.sourceId}:1:1`;
  const prefix = Buffer.from(source.text, "utf8").subarray(0, span.start);
  const lines = prefix.toString("utf8").split(/\r\n|\r|\n/);
  return `${span.sourceId}:${lines.length}:${Buffer.byteLength(lines.at(-1) ?? "", "utf8") + 1}`;
}

/** Find a fallthrough nested below a case's top-level statement list. */
function nestedFallthrough(statement: Statement): SourceSpan | null {
  if (statement.kind === "fallthrough") return statement.span;
  if (statement.kind === "block") {
    for (const child of statement.statements) {
      const found = nestedFallthrough(child);
      if (found !== null) return found;
    }
  }
  if (statement.kind === "if") {
    const then = nestedFallthrough(statement.then);
    if (then !== null) return then;
    return statement.otherwise === null ? null : nestedFallthrough(statement.otherwise);
  }
  if (statement.kind === "while" || statement.kind === "do-while" || statement.kind === "for") {
    return nestedFallthrough(statement.body);
  }
  return null;
}

/** Check source case values before building the typed arm. */
function checkCaseValues(
  statement: SwitchStatement,
  selector: TypedExpr,
  scope: ScalarScope,
  module: string,
  caller: BindingId,
  expressions: ScalarExpressionAnalyzer,
  host: SwitchFlowHost,
): readonly (readonly TypedExpr[] | null)[] {
  const seen = new Map<bigint, SourceSpan>();
  return statement.clauses.map((clause) => {
    if (clause.values === null) return null;
    const values: TypedExpr[] = [];
    for (const expression of clause.values) {
      const context: ScalarExpressionContext = {
        scope,
        module,
        sourceId: expression.span.sourceId,
        caller,
        constantContext: true,
        caseContext: true,
      };
      const result = expressions.analyze(expression, null, context);
      const node = result.node;
      if (node === null) continue;
      if (typeof node.constant !== "bigint") {
        host.diagnose(
          projectDiagnostic(
            "E10071",
            `Case value must be a compile-time constant — '${expressions.host.sourceText(expression.span)}' cannot be evaluated at compile time`,
            expression.span,
          ),
        );
        continue;
      }
      const compatible =
        selector.type.kind === "enum"
          ? semanticTypesEqual(node.type, selector.type)
          : (isIntegerType(node.type) || node.type.kind === "enum") &&
            fitsInteger(selector.type, node.constant);
      if (!compatible) {
        host.diagnose(
          projectDiagnostic(
            "E10072",
            `Case value type '${semanticTypeName(node.type)}' does not match switch expression type '${semanticTypeName(selector.type)}'`,
            expression.span,
          ),
        );
        continue;
      }
      const first = seen.get(node.constant);
      if (first !== undefined) {
        host.diagnose(
          projectDiagnostic(
            "E10070",
            `Duplicate case value ${node.constant} — already used at ${sourceLocation(host.source, first)}`,
            expression.span,
            null,
            [Object.freeze({ span: first, message: "First case value is here" })],
          ),
        );
      } else {
        seen.set(node.constant, expression.span);
      }
      values.push(node);
    }
    return Object.freeze(values);
  });
}

/** Check one switch and join only facts proved by every reachable exit. */
export function analyzeStructuredSwitch(
  statement: SwitchStatement,
  scope: ScalarScope,
  module: string,
  caller: BindingId,
  returnType: SemanticType,
  loopDepth: number,
  expressions: ScalarExpressionAnalyzer,
  host: SwitchFlowHost,
): TypedSwitchStatement | null {
  const selector = expressions.analyze(statement.value, null, {
    scope,
    module,
    sourceId: statement.span.sourceId,
    caller,
    constantContext: false,
  }).node;
  if (selector === null) return null;
  if (selector.type.kind !== "enum" && !isIntegerType(selector.type)) {
    host.diagnose(
      projectDiagnostic(
        "E10075",
        `Cannot switch on type '${semanticTypeName(selector.type)}' — use an integer or enum expression`,
        statement.value.span,
      ),
    );
    return null;
  }
  const values = checkCaseValues(statement, selector, scope, module, caller, expressions, host);
  if (
    selector.type.kind === "scalar" &&
    selector.type.name === "word" &&
    values.some((caseValues) => caseValues !== null && caseValues.length > 0) &&
    values.every(
      (caseValues) =>
        caseValues === null ||
        caseValues.every((value) => typeof value.constant === "bigint" && value.constant <= 255n),
    )
  ) {
    host.diagnose(
      scalarWarning(
        "W10070",
        "Switch expression is 'word' but every case fits in 'byte' — a byte value is cheaper to compare",
        statement.value.span,
      ),
    );
  }
  const baseline = snapshotScalarFacts(scope);
  const exits: ScalarFactSnapshot[] = [];
  const clauses: TypedSwitchClause[] = [];
  let defaultSeen = false;
  let priorFallthrough: ScalarFactSnapshot | null = null;
  for (const [index, clause] of statement.clauses.entries()) {
    if (clause.values === null) {
      if (defaultSeen) {
        host.diagnose(
          projectDiagnostic(
            "E10076",
            "Only one 'default' clause is allowed per switch statement",
            clause.span,
          ),
        );
      }
      defaultSeen = true;
    }
    restoreScalarFacts(baseline);
    if (priorFallthrough !== null) mergeScalarFacts(baseline, [baseline, priorFallthrough]);
    const last = clause.statements.at(-1);
    const falls = last?.kind === "fallthrough";
    for (const [position, child] of clause.statements.entries()) {
      const misplaced =
        child.kind === "fallthrough"
          ? position === clause.statements.length - 1
            ? null
            : child.span
          : nestedFallthrough(child);
      if (misplaced !== null) {
        host.diagnose(
          projectDiagnostic(
            "E10074",
            "'fallthrough' must be the last statement in a case body and cannot be nested in another control-flow block",
            misplaced,
          ),
        );
        break;
      }
    }
    if (falls && index === statement.clauses.length - 1) {
      host.diagnose(
        projectDiagnostic(
          "E10073",
          "'fallthrough' has no effect in the last case of a switch",
          last.span,
        ),
      );
    }
    const bodySource: Block = {
      kind: "block",
      span: clause.span,
      statements: Object.freeze(clause.statements.filter((child) => child.kind !== "fallthrough")),
    };
    const body = host.analyzeBlock(bodySource, scope, module, caller, returnType, loopDepth);
    const after = captureBranchFacts(baseline);
    priorFallthrough = falls ? after : null;
    if (!falls) exits.push(after);
    clauses.push(
      Object.freeze({
        values: values[index] ?? null,
        body,
        fallthrough: falls,
        span: Object.freeze({ ...clause.span }),
      }),
    );
  }
  if (!defaultSeen) exits.push(baseline);
  mergeScalarFacts(baseline, exits);
  return Object.freeze({
    kind: "switch",
    span: Object.freeze({ ...statement.span }),
    value: selector,
    clauses: Object.freeze(clauses),
  });
}
