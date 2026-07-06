/**
 * Pass-1 module-level scalar collection for RD-18 Slice 3b (FR-4; RD-04 §4.2
 * R9/R20). Sibling to `function-collection.ts` (kept separate by concern, AR-10).
 *
 * `collectModuleVariables` registers each top-level `let`/`const` declaration as a
 * `variable`/`constant` `Symbol` in the program's **module** scope — the very
 * scope `collectFunctions` created for that module — so a function body reference
 * resolves to it (innermost-first: body → module → global). A name already
 * declared in the module scope (a function or an earlier variable) is a duplicate
 * declaration → E10003. Module-level `let` initialisers are deferred (spec VAR-2 /
 * AR-2): they are collected but not executed in Slice 3b.
 *
 * Emit-diagnostic-never-throw: a program without a matching module scope simply
 * contributes no module variables. Imports `@blend65/core` only (R15/AR-20).
 */

import { DiagCode } from "@blend65/core";
import type { DiagnosticBag, ProgramNode, Scope, Symbol } from "@blend65/core";
import { resolveTypeNode } from "./type-check/type-resolution.js";

/**
 * Collects top-level `let`/`const` declarations into their module scopes (FR-4).
 * Must run **after** `collectFunctions` (which builds the module scopes) and
 * **before** type checking (which resolves references to these symbols). Never
 * throws.
 *
 * @param programs The parsed program ASTs.
 * @param globalScope The model's global scope (parent of the module scopes).
 * @param bag The shared diagnostic accumulator (E10003 on duplicates).
 */
export function collectModuleVariables(
  programs: readonly ProgramNode[],
  globalScope: Scope,
  bag: DiagnosticBag,
): void {
  for (const program of programs) {
    // The module scope `collectFunctions` created for this program (matched by the
    // very `ModuleDeclNode` it was built from — AR-13).
    const moduleNode = program.moduleDecl ?? null;
    const moduleScope = globalScope.children.find((s) => s.node === moduleNode);
    if (moduleScope === undefined) continue; // malformed/module-less program — skip

    for (const item of program.items) {
      if (item.kind !== "LetDecl" && item.kind !== "ConstDecl") continue;

      // Duplicate top-level declaration (a function or an earlier variable/constant
      // of the same name already occupies the module scope) → E10003 (R9/R20).
      if (moduleScope.symbols.has(item.name)) {
        bag.addError(
          DiagCode.DuplicateDecl,
          item.nameSpan,
          `Duplicate declaration '${item.name}' in this module`,
        );
        continue;
      }

      const sym: Symbol = {
        name: item.name,
        kind: item.kind === "ConstDecl" ? "constant" : "variable",
        type: resolveTypeNode(item.declaredType),
        decl: item,
        scope: moduleScope,
        exported: item.exported,
        mutable: item.kind === "LetDecl",
        byRef: false,
      };
      moduleScope.symbols.set(item.name, sym); // insertion order == declaration order
    }
  }
}
