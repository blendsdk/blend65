/**
 * The pair-access classification for by-reference parameters.
 *
 * A by-ref parameter needs a zero-page pointer pair only when its function
 * body accesses memory THROUGH it: an element (`p[i]`) or field (`p.f`)
 * access rooted at the parameter, or a whole-struct copy with the parameter
 * as either endpoint. Passing the parameter on to another call reads only its
 * 2-byte frame home (the canonical address copy), and a never-used parameter
 * needs nothing — both are excluded, so forwarding wrappers cost no pair and
 * no prologue copy.
 *
 * The computed set lives on the semantic model and is the SINGLE source of
 * truth for this classification: frame planning sizes/colors the pointer pool
 * from it, and lowering emits prologue copies from it. Divergence between
 * those consumers is impossible by construction; a pair symbol missing at
 * translate time is therefore a compiler defect, reported loudly there.
 *
 * This module lives in `@blend65/frontend` and imports `@blend65/core` only.
 */

import { walkChildren, walkNode } from "@blend65/core";
import type {
  AssignExprNode,
  AstNode,
  AstVisitor,
  ExprNode,
  LetDeclNode,
  ProgramNode,
  Scope,
  Symbol,
} from "@blend65/core";

/**
 * Computes the set of pair-accessed by-reference parameter symbols across
 * every function body (see the module doc for the classification rule).
 *
 * @param programs The parsed programs.
 * @param scopeByNode Function decl → its body scope (params live there).
 * @returns The parameters that need a bound pointer pair.
 */
export function computePairAccessedParams(
  programs: readonly ProgramNode[],
  scopeByNode: ReadonlyMap<AstNode, Scope>,
): Set<Symbol> {
  const accessed = new Set<Symbol>();

  for (const program of programs) {
    for (const item of program.items) {
      if (item.kind !== "FunctionDecl") continue;
      const bodyScope = scopeByNode.get(item);
      if (bodyScope === undefined) continue;
      collectAccesses(item.body, bodyScope, accessed);
    }
  }
  return accessed;
}

/** Walks one function body, adding every pair-accessed by-ref param root. */
function collectAccesses(root: AstNode, bodyScope: Scope, accessed: Set<Symbol>): void {
  const visit = (node: AstNode): void => {
    if (node.kind === "IndexExpr" || node.kind === "FieldAccessExpr") {
      addIfByRefParam(chainRoot(node as ExprNode), bodyScope, accessed);
    } else if (node.kind === "AssignExpr") {
      // A whole-struct copy reads/writes THROUGH the pair on both ends: a
      // bare by-ref param as the copy target or the copy source.
      const assign = node as AssignExprNode;
      if (assign.target.kind === "IdentExpr") {
        addIfByRefParam(assign.target.name, bodyScope, accessed);
      }
      if (assign.value.kind === "IdentExpr") {
        addIfByRefParam(assign.value.name, bodyScope, accessed);
      }
    } else if (node.kind === "LetDecl") {
      // `let s: S = p;` copies the whole aggregate out of the parameter.
      const init = (node as LetDeclNode).initialiser;
      if (init !== null && init.kind === "IdentExpr") {
        addIfByRefParam(init.name, bodyScope, accessed);
      }
    }
    walkChildren(node, visitor);
  };
  const visitor = new Proxy({} as AstVisitor<void>, { get: () => visit });
  walkNode(root, visitor);
}

/** The root identifier name of an `a`, `a[i]`, `s.f`, `s.f[i].g` chain, or `null`. */
function chainRoot(expr: ExprNode): string | null {
  let node: ExprNode = expr;
  while (node.kind === "IndexExpr" || node.kind === "FieldAccessExpr") {
    node = node.object;
  }
  return node.kind === "IdentExpr" ? node.name : null;
}

/** Adds the named symbol when it is a by-ref parameter of THIS body scope. */
function addIfByRefParam(name: string | null, bodyScope: Scope, accessed: Set<Symbol>): void {
  if (name === null) return;
  const sym = bodyScope.symbols.get(name);
  if (sym !== undefined && sym.kind === "parameter" && sym.byRef) {
    accessed.add(sym);
  }
}
