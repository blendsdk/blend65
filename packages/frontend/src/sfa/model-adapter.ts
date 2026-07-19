/**
 * The single wiring seam between the semantic model and the SFA planner (spec
 * Ch 11).
 *
 * `modelToFunctionInfo` projects a populated {@link SemanticModel} into the flat
 * {@link FunctionInfo}[] the planner consumes. This is the **only** place the
 * "semantic checker not yet wired" deferral lived: every SFA algorithm operates on
 * `FunctionInfo` fixtures and is fully implemented and tested, so filling in this
 * adapter wires real functions to the planner without touching any SFA pass.
 *
 * Currently implements the scalar surface (functions + local scalars). Under the
 * empty passthrough model (`createEmptyModel()`) it still returns `[]` — an empty
 * `callGraph.functions` projects to an empty array.
 *
 * Imports `@blend65/core` only — never `@blend65/codegen`.
 */

import { byteSize, primitive, walkChildren, walkNode } from "@blend65/core";
import type {
  AstNode,
  AstVisitor,
  BinaryExprNode,
  CallExprNode,
  DoWhileStmtNode,
  ExprNode,
  FrameVar,
  FunctionInfo,
  IfStmtNode,
  LetDeclNode,
  ModuleDeclNode,
  Scope,
  SemanticModel,
  Symbol,
  Type,
  UnaryExprNode,
  WhileStmtNode,
  ZeropageFieldNode,
} from "@blend65/core";
import type { ModuleVarInput } from "./zp-allocator.js";

/**
 * Projects a populated {@link SemanticModel} into the planner's
 * {@link FunctionInfo}[].
 *
 * One entry per function in `model.callGraph.functions`: the module-qualified
 * FQN for `name`; parameters = the body scope's `parameter` symbols in
 * declaration order (placed first in the frame); locals = its `variable`
 * symbols in declaration order; callees = the call graph's outgoing edges as
 * sorted FQNs; interrupt handlers flagged; `argWindowInterferes` = everything
 * reachable from calls nested in later arguments at this function's call
 * sites (see {@link computeArgWindows}). `isEscaped` reflects the model's
 * address-taken set (`&fn` marks a function escaped so its frame never
 * shares memory) and `isReachable` stays `true` (liveness analysis arrives
 * later — an unreachable function costs frame bytes, which is correct but
 * unoptimized). Returns `[]` for the empty passthrough model.
 *
 * @param model The semantic model to project.
 * @returns The projected functions (`[]` under the empty passthrough).
 */
export function modelToFunctionInfo(model: SemanticModel): FunctionInfo[] {
  const windows = computeArgWindows(model);
  const irq = computeIrqClassification(model);
  const result: FunctionInfo[] = [];
  for (const fn of model.callGraph.functions) {
    const scope = model.scopeOf(fn.decl); // the function body scope
    const callees = [...(model.callGraph.edges.get(fn) ?? [])].map(fqName).sort();
    const window = windows.get(fn);
    const synthetic: FrameVar[] = [];
    collectSyntheticSlots(fn.decl, model, synthetic);
    result.push({
      name: fqName(fn), // "<Module>.<function>"
      parameters: collectFrameVars(scope, "parameter", model.pairAccessedParams),
      locals: [...collectFrameVars(scope, "variable", model.pairAccessedParams), ...synthetic],
      isInterrupt: fn.kind === "interrupt",
      // Address-taken functions are escaped: their address may be installed at
      // a hardware vector or handed to a platform routine, so the planner must
      // never share their frame memory.
      isEscaped: model.addressTakenFunctions.has(fn),
      isReachable: true, // liveness analysis arrives later; main is reachable
      isIrqReachable: irq.irqReachable.has(fn),
      isIrqOnly: irq.irqOnly.has(fn),
      callees,
      argWindowInterferes: window === undefined ? [] : [...window].sort(),
    });
  }

  const initEntry = initPseudoFunction(model);
  if (initEntry !== null) result.push(initEntry);
  return result;
}

/**
 * Collects the synthetic short-circuit/conditional result slots of a subtree,
 * appending to `slots` in **preorder** (parent before children, fields in
 * declaration order).
 *
 * Short-circuit `&&`/`||` and the conditional operator lower to multi-block
 * diamonds, and the translator forbids values crossing basic blocks — so each
 * such site's result flows through a frame slot the planner must own. The
 * lowering pass claims slots in the same preorder at node entry, so the
 * indices align; a drift on either side is a loud frame-miss/size-mismatch
 * rejection there, never a silent mis-address.
 *
 * Whether a site claims can depend on WHERE it sits (see {@link isSlotSite}),
 * so the walk threads a condition-position flag down the two edges that carry
 * it: the condition child of `if`/`while`/`do-while`, and the operands of a
 * `!`/`&&`/`||` that is itself in condition position. Those parents enumerate
 * their children here, in the same order the generic walk uses; every other
 * edge lands in the default case and is value position again — including a
 * conditional's arms, a call's arguments, and a comparison's operands, even
 * when they sit inside a condition.
 *
 * The slot name's leading digit (`0sc<N>`) is illegal in source identifiers,
 * so no user local can ever collide; the digit is legal mid-symbol in the
 * assembler's `__frame_*` namespace. A poisoned site still appends a slot
 * with a 1-byte placeholder type (never the 0-byte error type) so the count
 * stays consistent — such programs never reach codegen anyway.
 */
function collectSyntheticSlots(root: AstNode, model: SemanticModel, slots: FrameVar[]): void {
  const visit = (node: AstNode, inCondition: boolean): void => {
    if (isSlotSite(node, inCondition)) {
      const t = model.typeOf(node);
      slots.push({
        name: `0sc${slots.length}`,
        type: t.kind === "error" ? primitive("byte") : t,
        byRef: false,
      });
    }
    switch (node.kind) {
      case "IfStmt": {
        const n = node as IfStmtNode;
        visit(n.condition, true);
        visit(n.thenBlock, false);
        if (n.elseClause !== null) visit(n.elseClause, false);
        return;
      }
      case "WhileStmt": {
        const n = node as WhileStmtNode;
        visit(n.condition, true);
        visit(n.body, false);
        return;
      }
      case "DoWhileStmt": {
        // Body first: the loop runs it before it ever asks the question, and
        // the lowering claims slots in that same order.
        const n = node as DoWhileStmtNode;
        visit(n.body, false);
        visit(n.condition, true);
        return;
      }
      case "UnaryExpr": {
        const n = node as UnaryExprNode;
        visit(n.operand, inCondition && n.op === "!");
        return;
      }
      case "BinaryExpr": {
        const n = node as BinaryExprNode;
        const carries = inCondition && (n.op === "&&" || n.op === "||");
        visit(n.left, carries);
        visit(n.right, carries);
        return;
      }
      default:
        walkChildren(node, valueVisitor);
    }
  };
  const valueVisitor = new Proxy({} as AstVisitor<void>, {
    get: () => (child: AstNode) => visit(child, false),
  });
  walkNode(root, valueVisitor);
}

/**
 * Whether `node` is an expression site that needs a synthetic result slot,
 * given whether it sits in condition position.
 *
 * Short-circuit/conditional results cross basic blocks through their slot —
 * unless the short-circuit never produces a result at all. In condition
 * position `&&`/`||` lower to branches straight to the enclosing statement's
 * targets, so there is no value to carry across a block and nothing to claim.
 * Everywhere else they still produce one, and a conditional produces one in
 * every position (only its arms cross blocks, never the choice itself).
 *
 * An address-of site homes its link-time address through a word slot so the
 * value can feed ALU and byte-extraction consumers (address operands are
 * legal only as store sources and ALU right operands). Every `&` site claims
 * a slot — including plain-store sites that end up not writing theirs — so
 * the counter never depends on how the site is used.
 */
function isSlotSite(node: AstNode, inCondition: boolean): node is ExprNode {
  if (node.kind === "ConditionalExpr") return true;
  if (node.kind === "UnaryExpr") return (node as UnaryExprNode).op === "&";
  if (node.kind !== "BinaryExpr") return false;
  const op = (node as BinaryExprNode).op;
  return (op === "&&" || op === "||") && !inCondition;
}

/**
 * The `__init` pseudo-function carrying the synthetic slots of the
 * module-variable initializer stream, or `null` when no initializer needs
 * one (slot-free programs project nothing — their layout is unchanged).
 *
 * Initializer expressions lower into one generated stream that runs to
 * completion before the entry function, so its frame plans like any leaf
 * frame (no callees, no params) and may share bytes with user frames.
 * Slots accumulate across ALL initializers in initialization order —
 * matching the stream's single lowering counter.
 */
function initPseudoFunction(model: SemanticModel): FunctionInfo | null {
  const slots: FrameVar[] = [];
  for (const sym of model.initOrder) {
    const decl = sym.decl;
    // Both initializer owners — module lets and zeropage fields — feed the
    // one startup stream, so both contribute their expression slots here in
    // the same initialization order the lowering pass claims them in.
    const init =
      decl.kind === "LetDecl"
        ? (decl as LetDeclNode).initialiser
        : decl.kind === "ZeropageField"
          ? (decl as ZeropageFieldNode).initialiser
          : null;
    if (init !== null) collectSyntheticSlots(init, model, slots);
  }
  if (slots.length === 0) return null;
  return {
    name: "__init",
    parameters: [],
    locals: slots,
    isInterrupt: false,
    isEscaped: false,
    isReachable: true,
    callees: [],
    argWindowInterferes: [],
  };
}

/**
 * Computes each function's argument-window interference set.
 *
 * When a call `C(a1, …, aN)` is lowered, arguments are stored into `C`'s
 * frame slots one at a time; a call nested in any argument AFTER the first
 * executes while earlier arguments already sit in `C`'s frame. Everything
 * reachable from such a nested call must therefore never share frame bytes
 * with `C`. The first argument is exempt — nothing is stored before it.
 *
 * For every call site of `C` in any function body, every nested call `G(…)`
 * inside arguments 2..N contributes `reach(G)` (a visited-set-bounded DFS
 * over the call graph — terminates on any input, cyclic included, as
 * defense in depth; cycles are rejected upstream) to `C`'s set, keyed by
 * fully-qualified name. Deterministic: callers sort + dedupe on projection.
 *
 * @param model The semantic model (bodies, symbols, call graph).
 * @returns Per-callee sets of FQNs that may run during argument marshalling.
 */
function computeArgWindows(model: SemanticModel): Map<Symbol, Set<string>> {
  const windows = new Map<Symbol, Set<string>>();

  for (const fn of model.callGraph.functions) {
    for (const call of collectCalls(fn.decl)) {
      const callee = userCalleeOf(call, model);
      if (callee === null || call.args.length < 2) continue;

      for (const arg of call.args.slice(1)) {
        for (const nested of collectCalls(arg)) {
          const nestedCallee = userCalleeOf(nested, model);
          if (nestedCallee === null) continue;
          let window = windows.get(callee);
          if (window === undefined) {
            window = new Set();
            windows.set(callee, window);
          }
          for (const reached of reach(nestedCallee, model)) {
            window.add(fqName(reached));
          }
        }
      }
    }
  }
  return windows;
}

/**
 * The resolved user-function symbol a call targets, or `null`. Both callee
 * shapes — a bare identifier and a qualified `Module.member` access — carry
 * their resolved symbol in the model's symbol map, so one lookup serves both.
 */
function userCalleeOf(call: CallExprNode, model: SemanticModel): Symbol | null {
  const kind = call.callee.kind;
  if (kind !== "IdentExpr" && kind !== "FieldAccessExpr") return null;
  const sym = model.symbolOf(call.callee);
  return sym !== null && sym.kind === "function" ? sym : null;
}

/**
 * Everything reachable from `start` along call edges, INCLUDING `start`
 * itself (the nested callee runs too). Visited-set-bounded: terminates on
 * any graph, cyclic included.
 */
function reach(start: Symbol, model: SemanticModel): Set<Symbol> {
  const visited = new Set<Symbol>([start]);
  const stack: Symbol[] = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    for (const callee of model.callGraph.edges.get(current) ?? []) {
      if (visited.has(callee)) continue;
      visited.add(callee);
      stack.push(callee);
    }
  }
  return visited;
}

/** Collects every plain call expression in a subtree (uniform visitor walk). */
function collectCalls(root: AstNode): CallExprNode[] {
  const found: CallExprNode[] = [];
  const visit = (node: AstNode): void => {
    if (node.kind === "CallExpr") {
      found.push(node as CallExprNode);
    }
    walkChildren(node, visitor);
  };
  const visitor = new Proxy({} as AstVisitor<void>, { get: () => visit });
  walkNode(root, visitor);
  return found;
}

/**
 * Projects the module-scope scalar `variable` symbols of a populated
 * {@link SemanticModel} into the planner's {@link ModuleVarInput}[]. One entry per
 * `kind: "variable"` symbol in each module scope (`globalScope.children`),
 * carrying its module name, variable name, resolved type, and `byteSize`.
 * Functions and constants are excluded (only RAM-backed variables get a
 * `__var_*` slot). Deterministic order = module order × declaration order.
 * Returns `[]` for the empty passthrough model.
 *
 * @param model The semantic model to project.
 * @returns The module variables as planner inputs (`[]` when there are none).
 */
export function modelToModuleVars(model: SemanticModel): ModuleVarInput[] {
  const result: ModuleVarInput[] = [];
  for (const moduleScope of model.globalScope.children) {
    if (moduleScope.kind !== "module") continue;
    const modNode = moduleScope.node;
    const moduleName = isModuleDecl(modNode) ? modNode.name : "";
    for (const sym of moduleScope.symbols.values()) {
      if (sym.kind !== "variable") continue; // functions / constants are not RAM-backed
      if (sym.storage === "zeropage") continue; // zero-page vars place via the ZP category
      // An imported variable is the SAME symbol aliased into the importing
      // scope — only its declaring module projects a RAM slot; a second
      // (importer-side) slot would double-count the variable in the layout.
      if (sym.scope !== moduleScope) continue;
      result.push({
        moduleName,
        variableName: sym.name,
        type: sym.type,
        size: byteSize(sym.type),
      });
    }
  }
  return result;
}

/** Narrows a scope's introducing node to a {@link ModuleDeclNode}. */
function isModuleDecl(node: AstNode | null): node is ModuleDeclNode {
  return node !== null && node.kind === "ModuleDecl";
}

/**
 * Projects the `zeropage {}` variables of a populated {@link SemanticModel}
 * into the allocator's user-category inputs: one `__zp_<Module>_<name>`
 * entry per zero-page-storage variable, in deterministic module order ×
 * declaration order (placement freedom inside the range belongs to the
 * allocator). Returns `[]` when no zeropage blocks exist, keeping
 * zeropage-free programs byte-identical.
 *
 * @param model The semantic model to project.
 * @returns The zeropage user variables as planner inputs.
 */
export function modelToZpUserVars(model: SemanticModel): { name: string; size: number }[] {
  const result: { name: string; size: number }[] = [];
  for (const moduleScope of model.globalScope.children) {
    if (moduleScope.kind !== "module") continue;
    const modNode = moduleScope.node;
    const moduleName = isModuleDecl(modNode) ? modNode.name : "";
    for (const sym of moduleScope.symbols.values()) {
      if (sym.kind !== "variable" || sym.storage !== "zeropage") continue;
      if (sym.scope !== moduleScope) continue;
      result.push({ name: `__zp_${moduleName}_${sym.name}`, size: byteSize(sym.type) });
    }
  }
  return result;
}

/**
 * The module-qualified FQN matching the IL lowering pass's
 * `` `${moduleName}.${fn.name}` ``, so `plan.frames` is keyed identically and the
 * emitted `__frame_*` reference resolves. The module is read from the function
 * symbol's declaring **module** `Scope` (`fn.scope.node`, a `ModuleDeclNode`) —
 * model-only, no AST re-walk, no core-type change. A mis-wired module scope yields
 * a `".<fn>"` name, which the assemble-clean test catches at ACME time.
 *
 * @param fn The function symbol.
 * @returns The fully-qualified `Module.function` name.
 */
function fqName(fn: Symbol): string {
  const modNode = fn.scope.node; // the declaring ModuleDeclNode
  const moduleName = isModuleDecl(modNode) ? modNode.name : "";
  return `${moduleName}.${fn.name}`;
}

/**
 * Reads a scope's symbols of `kind` as ordered {@link FrameVar}[] (Map
 * insertion order == declaration order; parameters are inserted before
 * locals at collection).
 *
 * A frame variable's `byRef` marks a PAIR-BOUND by-reference parameter: one
 * the body accesses through its pointer, so the planner must reserve and
 * color a zero-page pair for it. Dead and pass-through-only by-ref
 * parameters project `byRef: false` — they keep their 2-byte frame home
 * (sized by the slot rule, which keys on the aggregate type, not this flag)
 * but consume no pointer-pool bytes. Locals are never by-reference.
 *
 * @param scope The function body scope.
 * @param kind The symbol kind to project (`"parameter"` or `"variable"`).
 * @param pairAccessed The model's pair-accessed parameter set.
 * @returns The matching symbols as frame variables, in declaration order.
 */
function collectFrameVars(
  scope: Scope,
  kind: "parameter" | "variable",
  pairAccessed: ReadonlySet<Symbol>,
): FrameVar[] {
  const vars: FrameVar[] = [];
  for (const sym of scope.symbols.values()) {
    if (sym.kind === kind) {
      vars.push({ name: sym.name, type: sym.type, byRef: sym.byRef && pairAccessed.has(sym) });
    }
  }
  return vars;
}

/**
 * The interrupt-reachability classification, computed ONCE from the call
 * graph and consumed by three mechanisms: the always-live interference tier
 * (frames and pairs), the spill-pool selector, and the irq formation-scratch
 * reservation.
 *
 * `irqReachable` is the BFS closure from every interrupt handler.
 * `mainlineReachable` is the BFS closure from `main`, and from every escaped
 * NON-interrupt function (an escaped plain function may be invoked from
 * mainline through a platform seam; an escaped HANDLER is excluded — taking
 * a handler's address is precisely how it gets installed, and handlers are
 * uncallable/unexportable from mainline, so counting them here would empty
 * the interrupt-only set in every real program). Exported functions
 * participate only through real call edges — a helper only a handler calls
 * stays interrupt-only whether or not it is exported. The module
 * initializer stream is call-free, so it contributes no edges of its own.
 *
 * `irqOnly` = irqReachable ∖ mainlineReachable.
 */
function computeIrqClassification(model: SemanticModel): {
  irqReachable: Set<Symbol>;
  irqOnly: Set<Symbol>;
} {
  const irqReachable = new Set<Symbol>();
  for (const fn of model.callGraph.functions) {
    if (fn.kind !== "interrupt") continue;
    for (const reached of reach(fn, model)) irqReachable.add(reached);
  }
  if (irqReachable.size === 0) return { irqReachable, irqOnly: new Set() };

  const mainlineReachable = new Set<Symbol>();
  const mainRoots: Symbol[] = [];
  if (model.mainFunction !== null) mainRoots.push(model.mainFunction);
  for (const taken of model.addressTakenFunctions) {
    if (taken.kind !== "interrupt") mainRoots.push(taken);
  }
  for (const root of mainRoots) {
    for (const reached of reach(root, model)) mainlineReachable.add(reached);
  }

  const irqOnly = new Set<Symbol>();
  for (const fn of irqReachable) {
    if (!mainlineReachable.has(fn)) irqOnly.add(fn);
  }
  return { irqReachable, irqOnly };
}

/**
 * Whether the program can demand runtime pointer FORMATION, requiring the
 * shared `__zp_ptr_scratch` pair: any pair-accessed by-ref parameter exists,
 * or any declared storage or constant aggregate transitively contains an
 * array bigger than the 256-byte direct-addressing tier (a runtime index
 * into it must form base+index in a pointer). Conservative by design — a
 * program that reserves the pair without ever staging spends 2 ZP bytes.
 *
 * @param model The semantic model.
 * @returns `true` when the scratch pair must be reserved.
 */
export function modelNeedsPointerScratch(model: SemanticModel): boolean {
  if (model.pairAccessedParams.size > 0) return true;
  return hasBigArrayStorage(model);
}

/**
 * Whether some interrupt-ONLY function can demand runtime pointer formation,
 * requiring the dedicated `__zp_irq_ptr_scratch` pair (mainline formation
 * must never share its staging bytes with code an interrupt can run at any
 * moment). Exact where cheap — a pair-accessed by-ref parameter owned by an
 * interrupt-only function — and conservative for the big-array arm (any
 * over-256-byte storage anywhere reserves the pair when interrupt-only code
 * exists; an unused reservation spends 2 ZP bytes, matching the mainline
 * predicate's stance).
 *
 * @param model The semantic model.
 * @returns `true` when the irq scratch pair must be reserved.
 */
export function modelNeedsIrqPointerScratch(model: SemanticModel): boolean {
  const { irqOnly } = computeIrqClassification(model);
  if (irqOnly.size === 0) return false;
  for (const param of model.pairAccessedParams) {
    const owner = owningFunction(param, model);
    if (owner !== null && irqOnly.has(owner)) return true;
  }
  return hasBigArrayStorage(model);
}

/** The function symbol whose declaration owns `param`'s body scope, or `null`. */
function owningFunction(param: Symbol, model: SemanticModel): Symbol | null {
  const bodyNode = param.scope.node;
  for (const fn of model.callGraph.functions) {
    if (fn.decl === bodyNode) return fn;
  }
  return null;
}

/** Whether any declared storage transitively contains a >256-byte array. */
function hasBigArrayStorage(model: SemanticModel): boolean {
  const scopeHasBigStorage = (scope: Scope): boolean => {
    for (const sym of scope.symbols.values()) {
      if (sym.kind !== "variable" && sym.kind !== "constant") continue;
      if (sym.scope !== scope) continue; // import aliases: the declaring module owns them
      if (containsBigArray(sym.type)) return true;
    }
    return scope.children.some(scopeHasBigStorage);
  };
  return model.globalScope.children.some(scopeHasBigStorage);
}

/** Whether `t` transitively contains an array totalling more than 256 bytes. */
function containsBigArray(t: Type): boolean {
  if (t.kind === "array") {
    if (t.size !== null && byteSize(t) > 256) return true;
    return containsBigArray(t.element);
  }
  if (t.kind === "struct") {
    for (const field of t.fields.values()) {
      if (containsBigArray(field.type)) return true;
    }
  }
  return false;
}
