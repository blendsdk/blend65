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
import type { DiagnosticBag, FunctionDeclNode, ProgramNode } from "@blend65/core";

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
