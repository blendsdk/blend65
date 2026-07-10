/**
 * User-module import resolution.
 *
 * Runs after all module scopes exist (functions + module variables collected)
 * and before type checking, so imported names resolve like locally-declared
 * ones. For each `import { name, … } from Path;`:
 *
 * - A `Path` that exactly matches a user module's name is resolved here —
 *   a user module always wins over a platform-intrinsic module of the same
 *   name. Anything else is left untouched for the platform-intrinsic import
 *   boundary (which owns E10043/E10046).
 * - Each imported name must exist in the source module's scope **and** be
 *   declared `export` — otherwise E10012.
 * - A resolved import inserts the **same `Symbol` reference** into the
 *   importing module's scope (aliasing, not copying), so the symbol's
 *   declaring scope — and with it the fully-qualified `Module.function`
 *   name — is preserved. A name already present in the importing scope is a
 *   duplicate declaration (E10003).
 *
 * Two files declaring the same module name would merge under the language's
 * module model; merging is not implemented yet, and resolving an import
 * against an arbitrary one of the two scopes could report wrong results for
 * correct source — so that shape is rejected loudly as an internal
 * "unsupported" error rather than mis-resolved.
 *
 * Emit-diagnostics-never-throw; imports `@blend65/core` only.
 */

import { DiagCode, IceCode } from "@blend65/core";
import type { DiagnosticBag, ProgramNode, Scope } from "@blend65/core";

/**
 * Resolves user-module imports across all programs (see the module doc).
 *
 * @param programs The parsed program ASTs (one per source file).
 * @param moduleScopeByProgram Each program → its module scope (from collection).
 * @param bag The diagnostic accumulator (E10012/E10003, unsupported-merge ICE).
 */
export function resolveImports(
  programs: readonly ProgramNode[],
  moduleScopeByProgram: ReadonlyMap<ProgramNode, Scope>,
  bag: DiagnosticBag,
): void {
  // Map user-module name → its scope, rejecting duplicates loudly (see above).
  const userModules = new Map<string, Scope>();
  const collidedNames = new Set<string>();
  for (const program of programs) {
    const scope = moduleScopeByProgram.get(program);
    const name = program.moduleDecl?.name;
    if (scope === undefined || name === undefined) continue;
    if (userModules.has(name)) {
      if (!collidedNames.has(name)) {
        collidedNames.add(name);
        bag.addError(
          IceCode.Unexpected,
          program.moduleDecl?.span ?? null,
          `Module '${name}' is declared in more than one file — merging module ` +
            `declarations is not supported yet`,
        );
      }
      continue;
    }
    userModules.set(name, scope);
  }

  for (const program of programs) {
    const importingScope = moduleScopeByProgram.get(program);
    if (importingScope === undefined) continue;

    for (const item of program.items) {
      if (item.kind !== "ImportStmt") continue;
      // A collided module name must never resolve against an arbitrary file.
      if (collidedNames.has(item.modulePath)) continue;
      const sourceScope = userModules.get(item.modulePath);
      // Not a user module → the platform-intrinsic boundary owns it.
      if (sourceScope === undefined) continue;
      // A module importing from itself contributes nothing new; names would
      // only collide with themselves.
      if (sourceScope === importingScope) continue;

      for (const imported of item.symbols) {
        const sym = sourceScope.symbols.get(imported.name);
        if (sym === undefined || !sym.exported) {
          bag.addError(
            DiagCode.ImportNonExported,
            imported.span,
            `'${imported.name}' is not exported from module '${item.modulePath}'`,
          );
          continue;
        }
        if (importingScope.symbols.has(imported.name)) {
          bag.addError(
            DiagCode.DuplicateDecl,
            imported.span,
            `Duplicate declaration '${imported.name}' in this module`,
          );
          continue;
        }
        // Alias the SAME symbol — its declaring scope (and FQN) stays intact.
        importingScope.symbols.set(imported.name, sym);
      }
    }
  }
}
