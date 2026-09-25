import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { TypedBlock, TypedIfStatement, TypedStatement } from "./semantic-types.js";

interface StatusFlow {
  readonly normal: number | null;
  readonly breaks: readonly number[];
  readonly continues: readonly number[];
  readonly peak: number;
}

/** Prove that source PHP/PLP only consume saves made in the current function. */
export function checkStatusStack(body: TypedBlock): {
  readonly diagnostics: readonly ProjectDiagnostic[];
  readonly peak: number;
} {
  const diagnostics: ProjectDiagnostic[] = [];
  const report = (span: SourceSpan, message: string): void => {
    diagnostics.push(projectDiagnostic("E10248", message, span));
  };
  const join = (left: number | null, right: number | null, span: SourceSpan): number | null => {
    if (left !== null && right !== null && left !== right) {
      report(span, "Unequal status-save depths at a reachable control-flow join");
    }
    return left ?? right;
  };
  const merge = (flows: readonly StatusFlow[], normal: number | null): StatusFlow => ({
    normal,
    breaks: flows.flatMap((flow) => flow.breaks),
    continues: flows.flatMap((flow) => flow.continues),
    peak: Math.max(0, ...flows.map((flow) => flow.peak)),
  });
  const analyzeIf = (statement: TypedIfStatement, entry: number): StatusFlow => {
    if (statement.condition.constant === true) return analyzeBlock(statement.then, entry);
    if (statement.condition.constant === false) {
      if (statement.otherwise === null) {
        return { normal: entry, breaks: [], continues: [], peak: entry };
      }
      return statement.otherwise.kind === "block"
        ? analyzeBlock(statement.otherwise, entry)
        : analyzeIf(statement.otherwise, entry);
    }
    const yes = analyzeBlock(statement.then, entry);
    const no =
      statement.otherwise === null
        ? { normal: entry, breaks: [], continues: [], peak: entry }
        : statement.otherwise.kind === "block"
          ? analyzeBlock(statement.otherwise, entry)
          : analyzeIf(statement.otherwise, entry);
    return merge([yes, no], join(yes.normal, no.normal, statement.span));
  };
  const analyzeLoop = (
    statement: Extract<TypedStatement, { readonly kind: "while" | "for" | "do-while" }>,
    entry: number,
  ): StatusFlow => {
    const condition =
      statement.kind === "for" ? statement.condition?.constant : statement.condition.constant;
    if (condition === false && statement.kind !== "do-while") {
      return { normal: entry, breaks: [], continues: [], peak: entry };
    }
    const bodyFlow = analyzeBlock(statement.body, entry);
    const backedges = [bodyFlow.normal, ...bodyFlow.continues].filter(
      (depth): depth is number => depth !== null,
    );
    if (condition !== false) {
      for (const depth of backedges) {
        if (depth !== entry) report(statement.span, "Unequal status-save depth at a loop backedge");
      }
    }
    let exit: number | null =
      statement.kind === "do-while" || condition === true || statement.condition === null
        ? null
        : entry;
    if (statement.kind === "do-while" && condition !== true) {
      for (const depth of backedges) exit = join(exit, depth, statement.span);
    }
    for (const depth of bodyFlow.breaks) exit = join(exit, depth, statement.span);
    return { normal: exit, breaks: [], continues: [], peak: bodyFlow.peak };
  };
  const analyzeSwitch = (
    statement: Extract<TypedStatement, { readonly kind: "switch" }>,
    entry: number,
  ): StatusFlow => {
    if (typeof statement.value.constant === "bigint") {
      const chosen = statement.clauses.findIndex((clause) =>
        clause.values?.some((value) => value.constant === statement.value.constant),
      );
      const first =
        chosen >= 0 ? chosen : statement.clauses.findIndex((clause) => clause.values === null);
      if (first < 0) return { normal: entry, breaks: [], continues: [], peak: entry };
      let normal: number | null = entry;
      let peak = entry;
      const breaks: number[] = [];
      const continues: number[] = [];
      for (const clause of statement.clauses.slice(first)) {
        if (normal === null) break;
        const arm = analyzeBlock(clause.body, normal);
        normal = arm.normal;
        peak = Math.max(peak, arm.peak);
        breaks.push(...arm.breaks);
        continues.push(...arm.continues);
        if (!clause.fallthrough) break;
      }
      return { normal, breaks, continues, peak };
    }
    let exit: number | null = statement.clauses.some((clause) => clause.values === null)
      ? null
      : entry;
    let fallthrough: number | null = null;
    let peak = entry;
    const breaks: number[] = [];
    const continues: number[] = [];
    for (const clause of statement.clauses) {
      const armEntry = join(entry, fallthrough, clause.span) ?? entry;
      const arm = analyzeBlock(clause.body, armEntry);
      peak = Math.max(peak, arm.peak);
      continues.push(...arm.continues);
      breaks.push(...arm.breaks);
      if (clause.fallthrough) fallthrough = arm.normal;
      else {
        exit = join(exit, arm.normal, clause.span);
        fallthrough = null;
      }
    }
    return { normal: exit, breaks, continues, peak };
  };
  const analyzeBlock = (block: TypedBlock, entry: number): StatusFlow => {
    let normal: number | null = entry;
    let peak = entry;
    const breaks: number[] = [];
    const continues: number[] = [];
    for (const statement of block.statements) {
      if (normal === null) break;
      const current: number = normal;
      if (statement.kind === "expression-statement" && statement.expression.kind === "call") {
        const name = statement.expression.callee?.name;
        if (name === "asm_php") normal = current + 1;
        if (name === "asm_plp") {
          if (current === 0)
            report(statement.span, "asm_plp() has no function-local status save to restore");
          else normal = current - 1;
        }
      } else if (statement.kind === "return") {
        if (current !== 0)
          report(statement.span, "Function exit leaves a status save on the hardware stack");
        normal = null;
      } else if (statement.kind === "break") {
        breaks.push(current);
        normal = null;
      } else if (statement.kind === "continue") {
        continues.push(current);
        normal = null;
      } else if (statement.kind === "block") {
        const nested = analyzeBlock(statement, current);
        normal = nested.normal;
        breaks.push(...nested.breaks);
        continues.push(...nested.continues);
        peak = Math.max(peak, nested.peak);
      } else if (statement.kind === "if") {
        const branch = analyzeIf(statement, current);
        normal = branch.normal;
        breaks.push(...branch.breaks);
        continues.push(...branch.continues);
        peak = Math.max(peak, branch.peak);
      } else if (
        statement.kind === "while" ||
        statement.kind === "for" ||
        statement.kind === "do-while"
      ) {
        const loop = analyzeLoop(statement, current);
        normal = loop.normal;
        peak = Math.max(peak, loop.peak);
      } else if (statement.kind === "switch") {
        const selected = analyzeSwitch(statement, current);
        normal = selected.normal;
        breaks.push(...selected.breaks);
        continues.push(...selected.continues);
        peak = Math.max(peak, selected.peak);
      }
      peak = Math.max(peak, normal ?? 0);
    }
    return { normal, breaks, continues, peak };
  };
  const result = analyzeBlock(body, 0);
  if (result.normal !== null && result.normal !== 0) {
    report(body.span, "Function exit leaves a status save on the hardware stack");
  }
  return { diagnostics: Object.freeze(diagnostics), peak: result.peak };
}
