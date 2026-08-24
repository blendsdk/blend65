/**
 * Whole-program constant propagation for direct-memory intrinsic addresses.
 *
 * A function parameter is normally runtime data, so memory access through it
 * remains unsupported until general indirect addressing is available. There
 * is one sound exception: a non-entry function with one statically visible,
 * reachable call site can specialize an address parameter to that call's
 * constant argument. The resulting fact uses the same call-node identity as
 * ordinary constant-address analysis, so lowering retains its direct absolute
 * addressing path.
 */

import { findCallCycles, isInteger, walkChildren, walkNode } from "@blend65/core";
import type {
  AstNode,
  AstVisitor,
  AssignExprNode,
  CallExprNode,
  ConstValue,
  ExprNode,
  FunctionDeclNode,
  InterruptDeclNode,
  IntrinsicCallExprNode,
  Scope,
  Symbol,
  Type,
} from "@blend65/core";

/** Inputs already established by declaration collection and body typing. */
export interface SingleCallIntrinsicAddressInput {
  /** The selected program entry, or `null` for an invalid/incomplete program. */
  readonly mainFunction: Symbol | null;
  /** Resolved caller-to-callee edges. */
  readonly callEdges: ReadonlyMap<Symbol, ReadonlySet<Symbol>>;
  /** AST reference/callee nodes mapped to their resolved symbols. */
  readonly symbolMap: ReadonlyMap<AstNode, Symbol>;
  /** Types populated for every expression by body checking. */
  readonly typeMap: ReadonlyMap<ExprNode, Type>;
  /** Evaluated module constants. */
  readonly constValues: ReadonlyMap<Symbol, ConstValue>;
  /** Functions whose address escapes the visible call graph. */
  readonly addressTakenFunctions: ReadonlySet<Symbol>;
  /** Function declaration to body scope. */
  readonly scopeByNode: ReadonlyMap<AstNode, Scope>;
  /** Exact intrinsic call-site facts written for lowering. */
  readonly constantIntrinsicAddresses: Map<IntrinsicCallExprNode, number>;
}

/** A resolved user-function call in a statically reachable function body. */
interface ReachableCallSite {
  readonly caller: Symbol;
  readonly callee: Symbol;
  readonly call: CallExprNode;
}

type CallableDeclNode = FunctionDeclNode | InterruptDeclNode;

/** Direct-memory intrinsics whose first argument is an absolute address. */
const DIRECT_MEMORY_INTRINSICS: ReadonlySet<string> = new Set(["peek", "peekw", "poke", "pokew"]);

/** Narrows a declaration node to an ordinary function with parameters. */
function isFunctionDecl(node: AstNode): node is FunctionDeclNode {
  return node.kind === "FunctionDecl";
}

/** Narrows a declaration to a callable body that may contain visible call sites. */
function isCallableDecl(node: AstNode): node is CallableDeclNode {
  return node.kind === "FunctionDecl" || node.kind === "InterruptDecl";
}

/** Collects all nodes of one kind from a subtree in stable source order. */
function collectNodes<T extends AstNode>(
  root: AstNode,
  guard: (node: AstNode) => node is T,
): readonly T[] {
  const found: T[] = [];
  const visit = (node: AstNode): void => {
    if (guard(node)) found.push(node);
    walkChildren(node, visitor);
  };
  const visitor = new Proxy({} as AstVisitor<void>, { get: () => visit });
  walkNode(root, visitor);
  return found;
}

/** Computes functions reachable through visible calls from the selected entry. */
function reachableFunctions(
  roots: ReadonlySet<Symbol>,
  callEdges: ReadonlyMap<Symbol, ReadonlySet<Symbol>>,
): ReadonlySet<Symbol> {
  const reachable = new Set<Symbol>(roots);
  const pending: Symbol[] = [...roots];
  while (pending.length > 0) {
    const caller = pending.pop();
    if (caller === undefined) break;
    for (const callee of callEdges.get(caller) ?? []) {
      if (reachable.has(callee)) continue;
      reachable.add(callee);
      pending.push(callee);
    }
  }
  return reachable;
}

/** Finds every recursive function in one linear-time strongly connected-component pass. */
function recursiveFunctions(
  reachable: ReadonlySet<Symbol>,
  callEdges: ReadonlyMap<Symbol, ReadonlySet<Symbol>>,
): ReadonlySet<Symbol> {
  return new Set(findCallCycles(reachable, callEdges).flat());
}

/** Finds every resolved call site whose caller is reachable from `main`. */
function reachableCallSites(
  reachable: ReadonlySet<Symbol>,
  symbolMap: ReadonlyMap<AstNode, Symbol>,
): readonly ReachableCallSite[] {
  const sites: ReachableCallSite[] = [];
  for (const caller of reachable) {
    if (!isCallableDecl(caller.decl)) continue;
    const calls = collectNodes(
      caller.decl.body,
      (node): node is CallExprNode => node.kind === "CallExpr",
    );
    for (const call of calls) {
      const callee = symbolMap.get(call.callee);
      if (callee?.kind === "function") sites.push({ caller, callee, call });
    }
  }
  return sites;
}

/** Returns parameters assigned anywhere in the callee body. */
function writtenParameters(
  callee: FunctionDeclNode,
  symbolMap: ReadonlyMap<AstNode, Symbol>,
): ReadonlySet<Symbol> {
  const written = new Set<Symbol>();
  const assignments = collectNodes(
    callee.body,
    (node): node is AssignExprNode => node.kind === "AssignExpr",
  );
  for (const assignment of assignments) {
    const target = symbolMap.get(assignment.target);
    if (target?.kind === "parameter") written.add(target);
  }
  return written;
}

/** Resolves only a direct numeric literal or direct scalar named constant. */
function constantActualArgument(
  argument: ExprNode,
  symbolMap: ReadonlyMap<AstNode, Symbol>,
  constValues: ReadonlyMap<Symbol, ConstValue>,
): number | null {
  if (argument.kind === "NumericLitExpr") return argument.value;
  if (argument.kind !== "IdentExpr") return null;
  const symbol = symbolMap.get(argument);
  if (symbol?.kind !== "constant") return null;
  const constant = constValues.get(symbol);
  return constant !== undefined &&
    constant.bytes === undefined &&
    typeof constant.value === "number" &&
    Number.isSafeInteger(constant.value)
    ? constant.value
    : null;
}

/** Maps each scalar parameter to its sole call site's constant actual value. */
function parameterBindings(
  callee: Symbol,
  site: ReachableCallSite,
  input: SingleCallIntrinsicAddressInput,
): ReadonlyMap<Symbol, number> {
  if (!isFunctionDecl(callee.decl)) return new Map();
  const bodyScope = input.scopeByNode.get(callee.decl);
  if (bodyScope === undefined || callee.decl.params.length !== site.call.args.length) {
    return new Map();
  }
  const values = new Map<Symbol, number>();
  const written = writtenParameters(callee.decl, input.symbolMap);
  for (let index = 0; index < callee.decl.params.length; index += 1) {
    const parameter = callee.decl.params[index];
    const argument = site.call.args[index];
    if (parameter === undefined || argument === undefined) continue;
    const symbol = bodyScope.symbols.get(parameter.name);
    if (
      symbol?.kind !== "parameter" ||
      symbol.type.kind !== "primitive" ||
      symbol.type.name !== "word" ||
      written.has(symbol)
    ) {
      continue;
    }
    const value = constantActualArgument(argument, input.symbolMap, input.constValues);
    if (value !== null) values.set(symbol, value);
  }
  return values;
}

/**
 * Folds only address shapes whose word-runtime semantics equal integer math.
 *
 * A direct word parameter and an in-range parameter-plus/minus-literal cannot
 * hide an intermediate wrap. Narrower parameters deliberately stay dynamic:
 * their arithmetic wraps before conversion to the intrinsic's word address.
 * Richer expressions also stay dynamic until a width-aware optimizer can
 * prove every intermediate operation.
 */
function specializedAddress(
  expression: ExprNode,
  bindings: ReadonlyMap<Symbol, number>,
  symbolMap: ReadonlyMap<AstNode, Symbol>,
): number | null {
  if (expression.kind === "IdentExpr") {
    const symbol = symbolMap.get(expression);
    return symbol === undefined ? null : (bindings.get(symbol) ?? null);
  }
  if (
    expression.kind !== "BinaryExpr" ||
    (expression.op !== "+" && expression.op !== "-") ||
    expression.left.kind !== "IdentExpr" ||
    expression.right.kind !== "NumericLitExpr"
  ) {
    return null;
  }
  const symbol = symbolMap.get(expression.left);
  const base = symbol === undefined ? undefined : bindings.get(symbol);
  if (base === undefined) return null;
  const value =
    expression.op === "+" ? base + expression.right.value : base - expression.right.value;
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffff ? value : null;
}

/** Records propagated direct-address facts inside one safely-specializable callee. */
function recordCalleeFacts(
  callee: Symbol,
  bindings: ReadonlyMap<Symbol, number>,
  input: SingleCallIntrinsicAddressInput,
): void {
  if (!isFunctionDecl(callee.decl) || bindings.size === 0) return;
  const calls = collectNodes(
    callee.decl.body,
    (node): node is IntrinsicCallExprNode => node.kind === "IntrinsicCallExpr",
  );
  for (const call of calls) {
    if (!DIRECT_MEMORY_INTRINSICS.has(call.name) || call.args.length === 0) continue;
    if (input.constantIntrinsicAddresses.has(call)) continue;
    const address = call.args[0];
    const addressType = address === undefined ? undefined : input.typeMap.get(address);
    if (address === undefined || addressType === undefined || !isInteger(addressType)) continue;
    const specialized = specializedAddress(address, bindings, input.symbolMap);
    if (specialized !== null) input.constantIntrinsicAddresses.set(call, specialized);
  }
}

/**
 * Specializes direct-memory intrinsic addresses from one constant call site.
 *
 * The optimization deliberately fails closed for entry points, imported
 * callees, multiple reachable call sites, recursion, and address-taken
 * functions. Those shapes may execute with different arguments or through a
 * call edge the compiler cannot see, so treating a parameter as constant
 * would silently access the wrong hardware address.
 *
 * @param input Whole-program semantic facts and the destination address map.
 */
export function propagateSingleCallIntrinsicAddresses(
  input: SingleCallIntrinsicAddressInput,
): void {
  const mainFunction = input.mainFunction;
  if (mainFunction === null) return;
  const roots = new Set<Symbol>([mainFunction, ...input.addressTakenFunctions]);
  for (const caller of input.callEdges.keys()) {
    if (caller.decl.kind === "InterruptDecl") roots.add(caller);
  }
  const reachable = reachableFunctions(roots, input.callEdges);
  const recursive = recursiveFunctions(reachable, input.callEdges);
  const sites = reachableCallSites(reachable, input.symbolMap);
  const incoming = new Map<Symbol, ReachableCallSite[]>();
  for (const site of sites) {
    const existing = incoming.get(site.callee);
    if (existing === undefined) incoming.set(site.callee, [site]);
    else existing.push(site);
  }

  for (const callee of reachable) {
    if (
      callee === mainFunction ||
      callee.kind !== "function" ||
      input.addressTakenFunctions.has(callee) ||
      recursive.has(callee)
    ) {
      continue;
    }
    const calleeSites = incoming.get(callee);
    if (calleeSites?.length !== 1) continue;
    const site = calleeSites[0];
    if (site === undefined || site.caller.scope !== callee.scope) continue;
    recordCalleeFacts(callee, parameterBindings(callee, site, input), input);
  }
}
