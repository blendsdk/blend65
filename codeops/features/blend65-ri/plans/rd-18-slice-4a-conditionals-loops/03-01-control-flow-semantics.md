# 03-01 — Control-Flow Semantics

> Passes for conditionals + loops: scope/for-counter construction, condition typing, loop context,
> for-bound/step safety, all-paths-return. Traces: FR-1…FR-6, AR-2/AR-5/AR-7/AR-8/AR-9/AR-10.
> **CodeOps Skills Version**: 3.2.0

## A. New diagnostic codes (additive — inherited AR-11 precedent)

Add to `packages/core/src/diagnostics/diagnostic-codes.ts`, each with a multi-line provenance comment
(cite RD-18 Slice 4a / AR-N / spec Ch 05 §; note the Ch-14 drift where relevant). `spec/` stays frozen.

| Name (key) | Code | Group | Message | Trace |
|------------|------|-------|---------|-------|
| `NonBooleanCondition` | `E10134` | Control flow | `Condition must be type 'boolean' — found '<type>'. Use an explicit comparison` | FR-1 / AR-7 |
| `StepValueNotPositive` | `E10061` | Control flow | `For-loop step must be a positive compile-time constant` | FR-4 / AR-8 |
| `ForCounterTypeNotInteger` | `E10065` | Control flow | `For-loop counter must have an explicit integer type (byte/sbyte/word/sword)` | FR-3 / AR-15 |
| `NotAllPathsReturn` | `E10102` | Functions | `Not all code paths return a value in function '<name>'` | FR-6 / AR-4 |

E10065 is free in the registry, spec, and code, sits next to the for-loop code E10064, and has **no**
Ch-05 assignment (the spec table gaps E10064→E10070; §7.4 states the "must be integer" rule with no
code) — recorded as accepted Ch-14-over-Ch-05 drift per the inherited AR-11 precedent (AR-15).

Provenance note to include: E10100 (Ch 05's condition code) and E10102/E10061 (Ch 05 numbers) are the
canonical Ch-05 assignments; E10100 is already taken by `UndeclaredIdentifier` (3b), so the boolean
condition uses the next free control-flow code **E10134**, while all-paths-return (E10102) and
step-positivity (E10061) reuse their **free** Ch-05 numbers to reduce registry↔Ch-05 drift.

Extend `diagnostic-codes.impl.test.ts` with presence spot-checks for the four new codes
(E10134/E10061/E10065/E10102; uniqueness + shape tests already cover them globally).

## B. Scope construction — `function-collection.ts` (FR-2/FR-3, AR-9)

Today `collectFunctions` scans only top-level `body.statements` for `LetDecl`s. Extend it to
**recurse into control-flow bodies** and register:

1. Nested `let` locals inside `if`/`else`/`while`/`do-while`/`for` bodies → into the enclosing
   **function** scope (flat), so SFA assigns each a `__frame_*` slot. Reuse the existing symbol build
   (`kind:"variable"`, `type:resolveTypeNode(declaredType)`, `mutable:true`).
2. The **for-counter**: from `ForStmtNode.varName`/`varType`, add a symbol `{ kind:"variable",
   type:resolveTypeNode(varType), mutable:false, decl:<for node>, scope:<function> }`. `mutable:false`
   records read-only intent but 4a does **not** emit E10060 on assignment (deferred, AR-5).

Recursion walks: `IfStmt` → `thenBlock` + `elseClause` (Block or nested IfStmt); `While`/`DoWhile`/
`For` → `body`. A `Block` statement → its `statements`. **No new `Scope` objects are created** (flat
model, AR-9); the recursion only harvests declarations.

> **Duplicate sibling-block locals silently alias — by design (AR-9), no diagnostic.**
> `function-collection.ts` does **no** duplicate detection (its header: *"Nothing here does typing,
> name resolution, or duplicate detection yet"*); it writes locals with `bodyScope.symbols.set(name,…)`
> (last-wins). E10003 (`DuplicateDecl`) is emitted by a **different** pass — `module-variable-collection.ts:50`,
> over module variables — **not** by the collector for function-body locals. So two `let x` in sibling
> blocks both `.set("x", …)` into the one **function** scope → they alias to a single frame slot
> (last-wins), with **no** E10003. This is acceptable under flat collection (real block-scope lifetime
> and duplicate/shadow detection are deferred with E10101/E10062, AR-2/AR-5) and is **not** exercised
> by the fixtures. Do not assume a dup-check net here.

> **Why flat, not real block scopes:** real block-scope lifetime/shadowing is coupled to E10101
> (deferred, AR-2). Flat collection is the minimum that gives every control-flow-body local and the
> for-counter a frame slot — enough for correct codegen — without the shadow machinery.

## C. Condition + body typing — `statement-typing.ts` (FR-1/FR-2)

Replace the `default` no-op for the four kinds with real cases in `typeStmt`:

- **`IfStmt`**: `typeCondition(stmt.condition)`; `typeBody(stmt.thenBlock)`; if `elseClause` is a
  `Block` → `typeBody`; if it's an `IfStmt` → recurse `typeStmt` (else-if chain).
- **`WhileStmt` / `DoWhileStmt`**: `typeCondition(stmt.condition)`; `typeBody(stmt.body)`.
- **`ForStmt`**: see §D (bound/step/counter), then `typeBody(stmt.body)` with the counter in scope.
- **`BreakStmt` / `ContinueStmt`**: loop-context check (§E).

`typeCondition(expr)`: `const t = typeOfExpr(expr, scope, ctx)`; if `t` is not `ErrorType` and not
`boolean` → `bag.addError(NonBooleanCondition /*E10134*/, expr.span, msg(typeName(t)))`. (Poison `t`
stays silent — cascade suppression, matching 3b R114.) The condition is recorded in `typeMap` by
`typeOfExpr`.

`typeBody(block)` already recurses `typeStmt` over `block.statements` reusing the enclosing scope —
extend it so nested control-flow statements are visited (they are, once the `default` no-op is
replaced). Return statements inside bodies keep the 3b `typeReturn` (E10173) behavior.

## D. For-loop bound / step / counter typing (FR-3/FR-4, AR-8/AR-10)

In the `ForStmt` case, in order:
1. **Counter type (guard off `integerRange` — do NOT rely on cascade suppression).** Resolve
   `counterType = resolveTypeNode(varType)`. The counter type **must** be an integer type
   (`byte`/`sbyte`/`word`/`sword`). Enforce it with a single predicate: **if
   `integerRange(counterType) === null`** (`type-check/type-resolution.ts`), emit a diagnostic (code per
   **AR-15**) at `stmt.varNameSpan` and poison the counter, then skip the range/step checks. This one
   predicate covers **both** failure modes safely:
   - **Omitted annotation** — `varType` is `null` (the parser makes `: type` optional,
     `parse-stmt.ts:175-179`; `for (let i = 0 to 5)` parses with no diagnostic), so
     `resolveTypeNode(null)` → `ERROR_TYPE` and `integerRange(ERROR_TYPE) === null`.
   - **Non-integer annotation** — e.g. `for (let i: boolean = …)`; `integerRange(boolean/void) === null`.

   > **Why not "reuse the existing type-mismatch path":** `ERROR_TYPE`/`boolean` counters
   > cascade-**suppress** — with no explicit guard the check silently passes, E10064/width-adaptation
   > degenerate, and codegen proceeds on a defensively-sized error slot → a **silent miscompile** for
   > malformed input. The frontend never throws (contract holds), but "never throws" is not "never wrong".
   > The guard makes the failure loud. (The counter symbol was already registered in §B; 4a fixtures use
   > `byte` counters and are unaffected.)
2. **init / bound typing**: `typeOfExpr(init, …, contextType=counterType)` and
   `typeOfExpr(bound, …, contextType=counterType)` so literals adapt to the counter's width/signedness
   (reuse 3b literal adaptation + `checkAssignable`-style signedness).
3. **End-bound range (E10064)**: `evalConst(bound)`; if `{value}` and `value` ∉
   `[type_min(counterType), type_max(counterType)]` → `bag.addError(ForEndBoundOutOfRange, bound.span,
   …)`. If `nonConst` → allowed, no check (AR-10). *(Pattern A means an inclusive bound == type_max is
   valid per E10064 but unsupported in codegen — deferred to Pattern B, AR-6; the lowering records an
   ICE, and 4a fixtures avoid it.)*
4. **Step (E10061)**: if `step` present, `evalConst(step)`; require `{value}` integer ≥ 1, else
   `bag.addError(StepValueNotPositive, step.span, …)`. Absent `step` defaults to 1.

## E. Loop-context tracking for `break`/`continue` (FR-5, AR-12-adjacent)

Add a **loop-depth counter** (or boolean stack) to the type-check walk (thread it through `typeBody`/
`typeStmt`, or store on `ctx`). Increment when entering a `while`/`do-while`/`for` body, decrement on
exit. In the `BreakStmt` case: if depth == 0 → `bag.addError(BreakOutsideLoopSwitch /*E10130*/,
stmt.span, …)`. In `ContinueStmt`: if depth == 0 → `bag.addError(ContinueOutsideLoop /*E10131*/,
stmt.span, …)`. (Switch does not exist in 4a, so "loop" is the only context; the E10130 name says
"…LoopSwitch" but 4a only pushes loop context.)

## F. All-paths-return — `post-check.ts` (FR-6, AR-4)

Add `checkAllPathsReturn(programs, bag)` invoked from `postCheck`. For every **non-void** `FunctionDecl`
(return type ≠ `void`; interrupts are void, skipped): if `!definitelyReturns(fn.body)` →
`bag.addError(NotAllPathsReturn /*E10102*/, fn.nameSpan, msg(fn.name))`.

`definitelyReturns(block): boolean` — a **structural** reachability check over `block.statements`:
- `ReturnStmt` → `true` (the block definitely returns from here on).
- `IfStmt` with an `elseClause` where **both** `definitelyReturns(thenBlock)` **and**
  `definitelyReturns(else)` (Block → recurse; nested IfStmt → recurse the chain) → `true`.
- `Block` → `definitelyReturns` of the nested block.
- `while`/`do-while`/`for`/`if`-without-`else`/other statements → do **not** establish a definite
  return (a loop may run zero times; a one-armed `if` may fall through). *(A `do-while(true)` is not
  special-cased in 4a — conservative; the fixture's non-void functions return unconditionally.)*
- The block definitely returns if **any** statement in sequence definitely returns (return makes the
  rest unreachable). Implementation: iterate statements; return `true` on the first
  definitely-returning statement; `false` if none.

This is intentionally conservative (may ask for a redundant final `return` in exotic always-true
loops) and precise for the common cases; refinement (loop-condition constant folding) is out of scope.

## G. Wiring — `analyze.ts`

No pipeline reorder. The new logic lives inside the existing calls: `function-collection` (§B),
`typeCheckPrograms`→`statement-typing` (§C/§D/§E), and `postCheck`→`checkAllPathsReturn` (§F). The
`errorsBefore`/`hasErrors` accounting from 3b already counts the new diagnostics.
