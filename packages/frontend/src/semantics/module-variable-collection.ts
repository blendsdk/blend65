/**
 * Pass-1 module-level scalar collection. Sibling to `function-collection.ts`
 * (kept separate by concern).
 *
 * `collectModuleVariables` registers each top-level `let`/`const` declaration as a
 * `variable`/`constant` `Symbol` in the program's **module** scope — the very
 * scope `collectFunctions` created (or, for a module spanning several files,
 * reused) for that program — so a function body reference resolves to it
 * (innermost-first: body → module → global). A name already declared in the
 * module scope (a function or an earlier variable, from any file of the merged
 * module) is a duplicate declaration → E10003. The returned map records each
 * `let`'s initialiser expression so initialization ordering and init codegen
 * know which variables occupy an init position.
 *
 * Emit-diagnostic-never-throw: a program without a matching module scope simply
 * contributes no module variables. Imports `@blend65/core` only — never
 * `@blend65/codegen`.
 */

import { DiagCode } from "@blend65/core";
import type { DiagnosticBag, ExprNode, ProgramNode, Scope, Symbol } from "@blend65/core";
import { resolveTypeNode } from "./type-check/type-resolution.js";

/**
 * Collects top-level `let`/`const` declarations into their module scopes.
 * Must run **after** `collectFunctions` (which builds the module scopes) and
 * **before** type checking (which resolves references to these symbols). Never
 * throws.
 *
 * @param programs The parsed program ASTs.
 * @param moduleScopeByProgram Each program → its module scope (from collection).
 * @param bag The shared diagnostic accumulator (E10003 on duplicates).
 * @returns Each module `let` symbol that has an initialiser → that expression.
 */
export function collectModuleVariables(
  programs: readonly ProgramNode[],
  moduleScopeByProgram: ReadonlyMap<ProgramNode, Scope>,
  bag: DiagnosticBag,
): ReadonlyMap<Symbol, ExprNode> {
  const initializers = new Map<Symbol, ExprNode>();
  for (const program of programs) {
    // The module scope `collectFunctions` created (or reused) for this program.
    const moduleScope = moduleScopeByProgram.get(program);
    if (moduleScope === undefined) continue; // malformed/module-less program — skip

    for (const item of program.items) {
      // Zeropage fields are module variables with zero-page storage: same
      // namespace, same duplicate rule, always mutable (the block form has no
      // const slot), initialisers joining the same startup stream. Multiple
      // blocks — in one file or across a module's files — merge here exactly
      // like every other top-level declaration.
      if (item.kind === "ZeropageBlock") {
        for (const field of item.fields) {
          if (moduleScope.symbols.has(field.name)) {
            bag.addError(
              DiagCode.DuplicateDecl,
              field.nameSpan,
              `Duplicate declaration '${field.name}' in this module`,
            );
            continue;
          }
          const sym: Symbol = {
            name: field.name,
            kind: "variable",
            type: resolveTypeNode(field.fieldType),
            decl: field,
            scope: moduleScope,
            exported: false,
            mutable: true,
            byRef: false,
            storage: "zeropage",
          };
          moduleScope.symbols.set(field.name, sym);
          if (field.initialiser !== null) initializers.set(sym, field.initialiser);
        }
        continue;
      }
      if (item.kind !== "LetDecl" && item.kind !== "ConstDecl") continue;

      // Duplicate top-level declaration (a function or an earlier variable/constant
      // of the same name already occupies the module scope) → E10003.
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

      if (item.kind === "LetDecl" && item.initialiser !== null) {
        initializers.set(sym, item.initialiser);
      }
    }
  }
  return initializers;
}
