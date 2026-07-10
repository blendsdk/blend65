/**
 * Pass 4 — `main()` validity, all-paths-return, and recursion rejection.
 *
 * Over all programs this verifies the entry point: no `main` → E10020, multiple
 * `main` → E10021, and the single `main` must have signature `function main():
 * void` (no parameters, `void` return) → E10022 (a spec-designated F004 code,
 * registered additively). Gating: E10020 fires only when ≥1 function was
 * collected — so empty / unparseable / function-free inputs stay silent
 * (preserving the analyzer's passthrough contract). Calling `main` directly
 * is rejected at the call site (E10023, call typing). {@link checkRecursion}
 * rejects every call cycle with one E10174 carrying the full path — static
 * frame allocation gives each function a single fixed frame, so recursion can
 * never be compiled, and the poisoned model must never reach frame planning.
 * Never throws.
 *
 * This is the real body wired into the `passes.ts` Pass-4 seam.
 */

import { DiagCode } from "@blend65/core";
import type {
  BlockNode,
  CallGraph,
  DiagnosticBag,
  FunctionDeclNode,
  InterruptDeclNode,
  ProgramNode,
  SourceSpan,
  StmtNode,
  Symbol,
} from "@blend65/core";

/**
 * Validates the program entry point. Emits E10020/E10021/E10022 as
 * appropriate; silent when valid or when no function was collected.
 *
 * @param programs The parsed program ASTs.
 * @param bag The shared diagnostic accumulator.
 */
export function checkMainValidity(programs: readonly ProgramNode[], bag: DiagnosticBag): void {
  const mains: FunctionDeclNode[] = [];
  let functionCount = 0;
  for (const program of programs) {
    for (const item of program.items) {
      if (item.kind !== "FunctionDecl") continue;
      functionCount++;
      if (item.name === "main") mains.push(item);
    }
  }

  if (mains.length === 0) {
    // Only report a missing entry point when functions exist (so a
    // pure data / library module — or empty / unparseable input — stays silent).
    if (functionCount >= 1) {
      bag.addError(
        DiagCode.NoMainFunction, // E10020
        null,
        "No 'main' function found — every program needs 'function main(): void'",
      );
    }
    return;
  }

  if (mains.length >= 2) {
    bag.addError(
      DiagCode.MultipleMainFunctions, // E10021
      mains[1].nameSpan,
      "Multiple 'main' functions found — only one is allowed",
    );
    return;
  }

  const main = mains[0];
  if (!isValidMainSignature(main)) {
    bag.addError(
      DiagCode.InvalidMainSignature, // E10022 (F004)
      main.nameSpan,
      "Entry point 'main' must have signature 'function main(): void'",
    );
  }
}

/** `true` iff `fn` has no parameters and a `void` return type. */
function isValidMainSignature(fn: FunctionDeclNode): boolean {
  return (
    fn.params.length === 0 &&
    fn.returnType.kind === "PrimitiveType" &&
    fn.returnType.name === "void"
  );
}

/**
 * All-paths-return validation. Every non-void `function` whose body does not
 * return a value on **all** control-flow paths emits E10102. Interrupts
 * (always void) and void functions carry no obligation. The analysis is a
 * conservative structural reachability check ({@link definitelyReturns}); it
 * never throws.
 *
 * @param programs The parsed program ASTs.
 * @param bag The shared diagnostic accumulator.
 */
export function checkAllPathsReturn(programs: readonly ProgramNode[], bag: DiagnosticBag): void {
  for (const program of programs) {
    for (const item of program.items) {
      if (item.kind !== "FunctionDecl") continue; // interrupts are void
      if (isVoidReturn(item)) continue;
      if (!definitelyReturns(item.body)) {
        bag.addError(
          DiagCode.NotAllPathsReturn, // E10102
          item.nameSpan,
          `Not all code paths return a value in function '${item.name}'`,
        );
      }
    }
  }
}

/** `true` iff `fn` declares a `void` return type (no all-paths obligation). */
function isVoidReturn(fn: FunctionDeclNode): boolean {
  return fn.returnType.kind === "PrimitiveType" && fn.returnType.name === "void";
}

/**
 * Structural "definitely returns on every path" over a block. A block
 * definitely returns if any statement in sequence definitely returns (a `return`
 * makes the rest unreachable):
 * - `ReturnStmt` → the block returns from here on;
 * - `IfStmt` with an `else` where **both** arms definitely return → returns;
 * - a nested `Block` → recurse.
 * Loops, one-armed `if`s, and other statements do **not** establish a definite
 * return (a loop may run zero times; a one-armed `if` may fall through). This is
 * intentionally conservative — refinement (constant loop conditions) is out of
 * scope.
 *
 * @param block The block to analyse.
 * @returns Whether control definitely returns a value before falling off the end.
 */
function definitelyReturns(block: BlockNode): boolean {
  for (const stmt of block.statements) {
    if (statementDefinitelyReturns(stmt)) return true;
  }
  return false;
}

/**
 * Rejects every call cycle with exactly one E10174 per cycle.
 *
 * Each cycle arrives anchored at its first-declared member with members in
 * call order (see the call graph's cycle finder); the message renders the
 * full path closed back to the anchor (`ping → pong → ping`), and the
 * diagnostic anchors to the anchor's recursive call site when one was
 * recorded (falling back to the anchor's name span).
 *
 * @param callGraph The model's call graph (functions + edges + cycle finder).
 * @param callSiteSpans First call-site span per caller → callee edge.
 * @param bag The diagnostic accumulator (receives E10174).
 */
export function checkRecursion(
  callGraph: CallGraph,
  callSiteSpans: ReadonlyMap<Symbol, ReadonlyMap<Symbol, SourceSpan>>,
  bag: DiagnosticBag,
): void {
  for (const cycle of callGraph.findCycles()) {
    if (cycle.length === 0) continue;
    const anchor = cycle[0];
    const next = cycle.length > 1 ? cycle[1] : anchor;
    const path = [...cycle, anchor].map((s) => s.name).join(" → ");
    const span = callSiteSpans.get(anchor)?.get(next) ?? functionNameSpan(anchor);
    bag.addError(
      DiagCode.RecursionDetected, // E10174
      span,
      `Recursion detected — cycle: ${path}. Blend65 uses static frame ` +
        `allocation, which does not support recursion — use iteration instead`,
    );
  }
}

/** The name span of a function symbol's declaration, or `null` defensively. */
function functionNameSpan(fn: Symbol): SourceSpan | null {
  return isFunctionLikeDecl(fn.decl) ? fn.decl.nameSpan : null;
}

/** Narrows a declaring node to a function-like declaration. */
function isFunctionLikeDecl(
  node: Symbol["decl"],
): node is FunctionDeclNode | InterruptDeclNode {
  return node.kind === "FunctionDecl" || node.kind === "InterruptDecl";
}

/** Whether a single statement guarantees a return on every path through it. */
function statementDefinitelyReturns(stmt: StmtNode): boolean {
  switch (stmt.kind) {
    case "ReturnStmt":
      return true;
    case "Block":
      return definitelyReturns(stmt);
    case "IfStmt": {
      // Both arms must definitely return; a missing `else` can fall through.
      if (stmt.elseClause === null) return false;
      const thenReturns = definitelyReturns(stmt.thenBlock);
      const elseReturns =
        stmt.elseClause.kind === "Block"
          ? definitelyReturns(stmt.elseClause)
          : statementDefinitelyReturns(stmt.elseClause); // else-if chain
      return thenReturns && elseReturns;
    }
    default:
      return false;
  }
}
