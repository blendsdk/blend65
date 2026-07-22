# Current State: RD-01 Silent miscompiles

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

All line numbers verified at HEAD (`feat/asm-parity`, 2026-07-22). RD-01 §"The defects" owns the
root-cause narrative and the probe evidence; this document records only the code as it stands at
the six sites the plan modifies, so the executor starts from ground truth rather than the RD's
prose.

## Existing Implementation

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/codegen/src/il/lower.ts` | for-loop lowering; use-site width at 6 `slotIlType` sites | Gated `brcmp` wrap exit (`next` vs immediate) in the incr block (M-01); read width from per-declaration type at `:701`,`:525`,`:1184`,`:1634` (M-03 pop-3/PF-012) |
| `packages/frontend/src/semantics/type-check/statement-typing.ts` | for-stmt typing; `evalConst(bound)` at `:798` (no resolver); step check `:810-825` (only `≥1`) | Stamp wrap-safe via the **resolver-backed** engine (PF-010); range-check the folded step (PF-009) |
| `packages/frontend/src/semantics/type-check/expression-typing.ts` | intrinsic-call typing; poke value width never checked `:1608-1620` | Emit `E10154`/`E10152` on a wide/kind-mismatched value (M-02) — the **only** viable seam (PF-028) |
| `packages/frontend/src/semantics/intrinsic-validation.ts` | intrinsic arity + **literal-only** range check `:178-188`; runs **before** typing (no type access) | unchanged for the width check (PF-028 rules it out); literal-range stays |
| `packages/frontend/src/semantics/function-collection.ts` | flat, last-wins symbol collection (`:326`) — the **actual** collapse site | Retain per-declaration types; distinguish disjoint siblings (M-03, R5) |
| `packages/frontend/src/sfa/model-adapter.ts` | projects `scope.symbols.values()` → `FunctionInfo.locals` `:429-441`; `computeIrqClassification` `:443-488`, discards witnesses `:473-481` | Widest-slot projection where widths still exist (M-03/PF-002); thread provenance + `W10182` (M-04) |
| **`packages/core/src/semantics/{semantic-model,symbol}.ts`, `diagnostics/diagnostic-codes.ts`** | `SemanticModel` (whole-program maps only), `Symbol`, the code registry | Wrap-safe node-keyed map + `createEmptyModel` mirror; per-declaration `Symbol` types; register `E10062`/`W10182` (impact missed first draft — PF-003) |
| **`packages/compiler/src/api/run-frontend.ts`** | `:185` `modelToFunctionInfo`, bagless | thread the `DiagnosticBag` for the M-04 emission seam (PF-030) |
| `packages/frontend/src/sfa/frame-computation.ts` | one `FrameSlot` per name, `:52-66`; **never sees a collision** (already collapsed upstream) | assigns offsets over the correctly-sized slots — **not** the sizing site (PF-002) |
| `packages/test-harness/test/golden/expressiveness-ledger.json` | X-07/X-08 defect pins | Retire both in P1; update X-08's stale carry-exit note (AR-P8) |
| `codeops/00-spec-errata.md` | E-08 still prescribes the **rejected** carry mechanism; no W10182 entry | refresh E-08 to the `brcmp` form; add the W10182 minted-code entry (PF-023) |
| `packages/test-harness/test/golden/slice8b.asm.golden` | pins the hang-shaped `LDA last / CMP i / BCC` exit `:79-82` | Re-golden to the wrap-safe idiom (AR-10); source `examples/slice8b/` stays frozen (R8/PF-029) |

### Code Analysis — the load-bearing facts

**M-01.** `lowerFor` (`lower.ts:700-742`) builds the classic `cond → body → incr → cond` CFG.
`cond` terminates on `branchOnCounter` (`:841-861`) — already a **type-stamped `brcmp`** (`le`
for `to`, `ge` for `downto`). `incr` runs `incrementCounter` (`:864-883`): it loads `current`
(`:872`), computes `next = current ± step` (`:875-882`), stores `next`, then the block
unconditionally `br(condL)` (`:739`). `current`/`next` are live temps at the **IL** level — but
NOT at the translator level, where liveness is A-residency + a memory home. **This is the it.1
CRITICAL (PF-001):** an added `brcmp(next, current)` makes both temps multi-use, which
`translate.ts` cannot honour — the 16-bit `add` requires a single-use store-folded dest
(`foldStoreHome:1134` → ICE at `:760`) and the byte `add` rebinds A to `next` with no spill of
`current` (`:754`). So the wrap test is reconstructed from `next` alone against an immediate
(AR-P3, revised). The full-range ICE guard at `:717-726` inspects only `NumericLitExpr`, which is
why named-const M-01b slips past it. `constStep` (`:891-896`) folds only `NumericLitExpr`; the step
site (`:810-825`) checks only `step ≥ 1` — a `step ≥ 2^width` is unguarded (PF-009).

**M-01 / AR-2.** `statement-typing.ts:798` calls `evalConst(stmt.bound)` with **no resolver**, so
for a named-const/const-ref bound it returns `nonConst` (`const-eval.ts:187`) — the E10064 check is
skipped and the value is discarded. The wrap-safe stamp must therefore use the **resolver-backed**
engine (`ctx.engine.evalExpr`, as `expression-typing.ts:1601` does), not this bare call, or every
named-const interior loop is wrongly marked wrap-unsafe and guarded (PF-010).

**M-02.** Poke value typing (`expression-typing.ts:1608-1620`) returns `void` without inspecting
the value operand's width. The only range check (`intrinsic-validation.ts:178-188`) fires solely
when `arg.kind === "NumericLitExpr"`; a `word` variable, expression, `peekw` result, or named
`word` constant passes unchecked and codegen emits the two-byte store.

**M-03.** The name-collapse is **upstream** of frame computation (PF-002): `function-collection.ts`
harvests case/if/for locals flat into one function scope and `bodyScope.symbols.set(name, sym)`
(`:326`) keeps last-wins; `model-adapter.ts:429-441` then projects `scope.symbols.values()` into
`FunctionInfo.locals` (one entry per name), and `frame-computation.ts:52-66` pushes one slot each
with **no collision logic** — it never sees more than one width per name. So widest-sizing must
consume the retained widths at the projection seam, **not** `frame-computation`. At use sites,
`slotIlType` (`lower.ts:2822-2825`) resolves width by name — reads (`:1184`), stores (`:525`,
`:1634`), and the **for-counter** (`:701`, missed in the first draft — PF-012) all pick the
last-wins width, so a wider sibling's read truncates (pop-3) and a wider sibling's store overruns
(pop-2). Per-declaration types do not survive to any use site today.

**M-04.** `computeIrqClassification` (`model-adapter.ts:443-488`) computes `irqReachable` and
`irqOnly` and returns membership sets; the full mainline closure and the identity of which handler
and which mainline root reach a shared function are computed at `:473-481` and discarded. The
adapter seam takes no `DiagnosticBag`. Handlers are installed only via `&` (`:450-457`), which
AR-8's address-taken filter relies on.

## Gaps Identified

Each gap maps 1:1 to an RD defect (M-01…M-04) and is fully specified in the RD; not restated here.
The **plan-relevant** delta from current state:

- **Gap M-01:** incr block exits unconditionally → needs a gated `brcmp next` vs a type/step immediate (AR-P3 revised), plus a resolver-backed wrap-safe stamp and a step range-check.
- **Gap M-02:** value width/kind unchecked → needs `E10154`/`E10152` in `expression-typing` (the only viable seam).
- **Gap M-03 pop-2/3:** upstream last-wins collapse → needs per-declaration retention (core `Symbol`) + widest projection + per-use width at all local consumers incl. `:701`.
- **Gap M-03 R5:** nested reuse/shadow undiagnosed → needs E10062/E10101/E10003 (E10062 unregistered — a core edit).
- **Gap M-04:** witnesses discarded, no emission seam → needs provenance threading + the compiler-package `DiagnosticBag` seam + `W10182`.

## Dependencies

### Internal

- **R15 boundary (load-bearing):** `frontend` and `language-server` MUST NOT import
  `@blend65/codegen`. M-02 and M-03's *diagnostics* live in `frontend`; their *emitted-asm*
  assertions live in the `test-harness` tier. Spec tests split accordingly (§07, AC-6/AC-9).
- **E10062 registration** (M-03/R5) precedes its emission (RD AR-6).
- **Phase order:** M-01 first (RD Notes); M-02/M-03/M-04 independent.

### External

- VICE 3.10 + ACME for the `[local]` termination/visit-count tier (AC-1/AC-2) — skipped in CI (AR-27).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Wrap `brcmp` reads a value with no translator home → ICE / stale-reload silent hang (the it.1 CRITICAL) | — (found) | High | AR-P3 reconstruction-immediate: `brcmp next` vs an immediate, `next` single-use — no cross-op liveness; a `translate.ts`-seam verification task proves it at both widths |
| Retained bound compare leaves `downto 0` emitting `CMP #$00 / BCC`, so X-08 stays green and AC-14's forcing function is void | Med | High | P1 perturbs X-08 against the chosen idiom, retightens the signature to the wrap form (RD Notes; AR-P8) |
| Unconditional / mis-stamped wrap-guard emission regenerates provably-interior loops (incl. named-const bounds) → AC-12 byte-identity fails / meet-or-beat regression | Med | High | Emission gated on the **resolver-backed** wrap-safe bit (AR-P5/PF-010); slice4a/slice7 + a named-const interior loop pinned as no-guard proof (AC-12, ST-9/ST-9b) |
| A spec test is green before the fix for the wrong reason (harness-bounded loop, `[CI]` row asserting behaviour it can't see, golden never exercising the shape) | High | High | Tier discipline (`[CI]`=shape, `[local]`=behaviour); AC-15 perturbs every new assertion incl. goldens (PF-005/PF-007/PF-024) |
| M-03 pop-3 "fixed properly" via scope-qualified slots → re-homes slots, manufacturing the M-03 defect class | Med | High | AR-3/AR-P4: per-use type resolution only; allocation stays positional; sizing is a width rule at the retention seam |
| M-04 provenance threading grows a new adapter seam taking a `DiagnosticBag` (in `packages/compiler`) | Low | Med | Confined to a separate address-taken predicate over the classification output; the classification BFS (pinned by `irq-interference.spec.test.ts:71-118`) stays untouched (AR-8) |
