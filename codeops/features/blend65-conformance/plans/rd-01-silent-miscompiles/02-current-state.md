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
| `packages/codegen/src/il/lower.ts` | for-loop lowering; use-site width resolution | Gated `brcmp` wrap exit in the incr block (M-01); read width from per-declaration type, not the name-keyed slot (M-03 pop-3) |
| `packages/frontend/src/semantics/type-check/statement-typing.ts` | for-stmt typing; discards `evalConst(bound)` at `:798` | Stamp the const-evaluated bound + a wrap-safe bit into the model (M-01/AR-2, AR-P5) |
| `packages/frontend/src/semantics/intrinsic-validation.ts` | intrinsic arity + **literal-only** range check `:178-188` | Width check for non-literal `poke`/`pokew` value operands (M-02) |
| `packages/frontend/src/semantics/type-check/expression-typing.ts` | intrinsic-call typing; value width never checked `:1608-1620` | Emit `E10154` on a wide value operand (M-02); see AR-5 accepted set |
| `packages/frontend/src/semantics/function-collection.ts` | flat, last-wins symbol collection | Retain per-declaration types; distinguish disjoint siblings (M-03 pop-3, R5) |
| `packages/frontend/src/sfa/frame-computation.ts` | one `FrameSlot` per name, `:52-64` | Size a name-collapsed slot to the **widest** colliding declaration (M-03 pop-2, R6) |
| `packages/frontend/src/sfa/model-adapter.ts` | `computeIrqClassification` `:443-488`; discards witnesses `:473-481` | Thread provenance; emit `W10182` via a new address-taken predicate over the classification output (M-04) |
| `packages/test-harness/test/golden/expressiveness-ledger.json` | X-07/X-08 defect pins | Retire both in P1; update X-08's stale carry-exit note (AR-P8) |
| `examples/slice8b/` | the one runtime-bound corpus loop | Re-golden the `copyBytes` exit to the wrap-safe idiom (AR-10) |

### Code Analysis — the load-bearing facts

**M-01.** `lowerFor` (`lower.ts:700-742`) builds the classic `cond → body → incr → cond` CFG.
`cond` terminates on `branchOnCounter` (`:841-861`) — already a **type-stamped `brcmp`** (`le`
for `to`, `ge` for `downto`), so the RD's claimed IL form exists. `incr` runs `incrementCounter`
(`:864-883`): it loads `current` (`:872`), computes `next = current ± step` (`:875-882`), stores
`next`, then the block unconditionally `br(condL)` (`:739`). **Both `current` and `next` are live
temps in that block at terminator time** — this is why AR-P3 needs no scratch copy. The full-range
ICE guard at `:717-726` inspects only `NumericLitExpr` (`ilTypeMax` compare), which is exactly why
the named-const spelling M-01b slips past it. `constStep` (`:891-896`) folds only `NumericLitExpr`.

**M-01 / AR-2.** `statement-typing.ts:798` already calls `evalConst(stmt.bound)`, but only to run
the E10064 range check (`:799-808`); the value is discarded and lowering re-derives the AST. The
wrap-safe stamp (AR-P5) rides this existing evaluation.

**M-02.** Poke value typing (`expression-typing.ts:1608-1620`) returns `void` without inspecting
the value operand's width. The only range check (`intrinsic-validation.ts:178-188`) fires solely
when `arg.kind === "NumericLitExpr"`; a `word` variable, expression, `peekw` result, or named
`word` constant passes unchecked and codegen emits the two-byte store.

**M-03.** `frame-computation.ts:52-64` pushes one `FrameSlot {name, kind, type, size, offset}` per
local; a name collision keeps the last. `slotIlType` (`lower.ts:2822-2825`) resolves width by
`slots.find(s => s.name === varName)` — **name-keyed, last-wins**. Every variable read
(`lower.ts:1184`) and store (`:525`, `:1634`) picks width this way, so a wider sibling's read
truncates (pop-3) and a wider sibling's store overruns (pop-2). The symbol table itself is flat:
`function-collection.ts` harvests case/if/for locals into one function scope and
`bodyScope.symbols.set(name, sym)` keeps last-wins — so per-declaration types do not survive to
the use site today.

**M-04.** `computeIrqClassification` (`model-adapter.ts:443-488`) computes `irqReachable` and
`irqOnly` and returns membership sets; the full mainline closure and the identity of which handler
and which mainline root reach a shared function are computed at `:473-481` and discarded. The
adapter seam takes no `DiagnosticBag`. Handlers are installed only via `&` (`:450-457`), which
AR-8's address-taken filter relies on.

## Gaps Identified

Each gap maps 1:1 to an RD defect (M-01…M-04) and is fully specified in the RD; not restated here.
The **plan-relevant** delta from current state:

- **Gap M-01:** incr block exits unconditionally → needs a gated `brcmp lt/gt(next, current)`.
- **Gap M-01/AR-2:** stamped bound absent → lowering re-derives, can't gate emission → needs the frontend stamp.
- **Gap M-02:** value width unchecked → needs `E10154` on non-literal wide operands.
- **Gap M-03 pop-2/3:** name-keyed last-wins slot → needs widest-sizing + per-declaration read width.
- **Gap M-03 R5:** nested reuse/shadow undiagnosed → needs E10062/E10101/E10003 (E10062 unregistered).
- **Gap M-04:** witnesses discarded, no emission seam → needs provenance threading + `W10182`.

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
| Retained bound compare leaves `downto 0` emitting `CMP #$00 / BCC`, so X-08 stays green and AC-14's forcing function is void | Med | High | P1 perturbs X-08 against the chosen idiom, retightens the signature to the wrap form (RD Notes; AR-P8) |
| Unconditional wrap-guard emission regenerates slice4a/slice7 and fails AC-12 byte-identity | Med | High | Emission gated on the frontend wrap-safe bit (AR-P5); slice4a/slice7 byte-identity pinned as positive proof (AC-12) |
| A spec test is green before the fix for the wrong reason (harness-bounded loop, golden that never exercised the shape) | High | High | AC-15: perturb every new assertion once, watch it fail, restore (per-phase oracle discipline) |
| M-03 pop-3 "fixed properly" via scope-qualified slots → re-homes slots, manufacturing the M-03 defect class | Med | High | AR-3/AR-P4: per-use type resolution only; allocation stays positional; frame-computation change is width-only |
| M-04 provenance threading grows a new adapter seam taking a `DiagnosticBag` | Low | Med | Confined to a separate address-taken predicate over the classification output; the classification BFS (pinned by ST-17/18/19) stays untouched (AR-8) |
