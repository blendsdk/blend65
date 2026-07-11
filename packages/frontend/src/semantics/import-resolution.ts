/**
 * User-module import resolution.
 *
 * Runs after all module scopes exist (functions + module variables collected)
 * and before type checking, so imported names resolve like locally-declared
 * ones. Module scopes are shared per module NAME (a module may span several
 * files), so every import resolves against the ONE merged scope. For each
 * `import { name, … } from Path;`:
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
 * - The importer→imported user-module relation is returned, so module
 *   initialization ordering can honor import edges.
 *
 * Emit-diagnostics-never-throw; imports `@blend65/core` only.
 */

import { DiagCode } from "@blend65/core";
import type { DiagnosticBag, ProgramNode, Scope } from "@blend65/core";

/**
 * Resolves user-module imports across all programs (see the module doc).
 *
 * @param programs The parsed program ASTs (one per source file).
 * @param moduleScopeByProgram Each program → its module scope (from collection).
 * @param moduleScopeByName User-module name → its (shared) module scope.
 * @param bag The diagnostic accumulator (E10012/E10003).
 * @returns Importer module name → the set of user-module names it imports.
 */
export function resolveImports(
  programs: readonly ProgramNode[],
  moduleScopeByProgram: ReadonlyMap<ProgramNode, Scope>,
  moduleScopeByName: ReadonlyMap<string, Scope>,
  bag: DiagnosticBag,
): ReadonlyMap<string, ReadonlySet<string>> {
  const importEdges = new Map<string, Set<string>>();

  for (const program of programs) {
    const importingScope = moduleScopeByProgram.get(program);
    const importerName = program.moduleDecl?.name;
    if (importingScope === undefined) continue;

    for (const item of program.items) {
      if (item.kind !== "ImportStmt") continue;
      const sourceScope = moduleScopeByName.get(item.modulePath);
      // Not a user module → the platform-intrinsic boundary owns it.
      if (sourceScope === undefined) continue;
      // A module importing from itself (including from another file of the
      // same merged module) contributes nothing new; names would only collide
      // with themselves.
      if (sourceScope === importingScope) continue;

      // Record the module-level import edge (importer → imported) even when an
      // individual name fails below — initialization ordering depends on the
      // module relation, not on every name resolving.
      if (importerName !== undefined) {
        let edges = importEdges.get(importerName);
        if (edges === undefined) {
          edges = new Set<string>();
          importEdges.set(importerName, edges);
        }
        edges.add(item.modulePath);
      }

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

  return importEdges;
}
