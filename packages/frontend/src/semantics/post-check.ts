/**
 * RD-18 Slice 3b Pass 4 — `main()` validity (FR-5; RD-04 R66, AR-7).
 *
 * Over all programs this verifies the entry point: no `main` → E10020, multiple
 * `main` → E10021, and the single `main` must have signature `function main():
 * void` (no parameters, `void` return) → E10022 (AR-11: spec-designated F004
 * code, registered additively). Gating (AR-12): E10020 fires only when ≥1
 * function was collected — so empty / unparseable / function-free inputs stay
 * silent (preserving the RD-04 passthrough AC-01). Calling `main` directly
 * (E10023) is deferred to Slice 5 (no call sites exist yet). Never throws.
 *
 * This is the real body wired into the `passes.ts` Pass-4 seam.
 */

import { DiagCode } from "@blend65/core";
import type {
  BlockNode,
  DiagnosticBag,
  FunctionDeclNode,
  ProgramNode,
  StmtNode,
} from "@blend65/core";

/**
 * Validates the program entry point (FR-5). Emits E10020/E10021/E10022 as
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
    // AR-12 gate: only report a missing entry point when functions exist (so a
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
      DiagCode.InvalidMainSignature, // E10022 (F004, AR-11)
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
 * All-paths-return validation (RD-18 Slice 4a FR-6, spec Ch 05 §4.2, AR-4). Every
 * non-void `function` whose body does not return a value on **all** control-flow
 * paths emits E10102. Interrupts (always void) and void functions carry no
 * obligation. The analysis is a conservative structural reachability check
 * ({@link definitelyReturns}); it never throws.
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
 * Structural "definitely returns on every path" over a block (AR-4). A block
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
