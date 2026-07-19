# Current State: RD-04 Compare-and-Branch Fusion

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The condition pipeline today, end to end:

1. **Lowering** (`packages/codegen/src/il/lower.ts`): every condition statement lowers its
   condition through `lowerExpr` to a materialized boolean operand, then terminates with
   `brcond` — `lowerIf` (:496), `lowerWhile` (:525), `lowerDoWhile` (:549), `lowerFor`'s
   Pattern-A predicate (:579, via the continue-predicate helper at :714), and `lowerSwitch`'s
   per-value dispatch chain (:642, an `eq` instruction + `brcond` per case value, discriminant
   re-lowered fresh per test block). `!` lowers as `eq src, 0` (an instruction, in `lowerUnary`);
   `&&`/`||` lower as value-producing slot diamonds (`lowerShortCircuit`, :1261) that claim a
   synthetic frame slot via `claimResultSlot` (:1230) — the claim verifies slot name AND byte
   size, so any preorder drift against the SFA adapter is a loud ICE, never a mis-address.
   Boolean literals reach `brcond` as immediates — `while (true)` relies on the termination
   analysis's constant-edge special case, and emits a dead compare-free but real `brcond`.
2. **SFA adapter** (`packages/frontend/src/sfa/model-adapter.ts:107-139`):
   `collectSyntheticSlots` walks the AST with a kind-blind visitor and `isSlotSite` is
   deliberately **position-independent** — every `&&`/`||`/`?:`/`&` site claims a slot named
   `0sc<N>` in preorder, whether or not lowering will use it.
3. **Translator** (`packages/codegen/src/instr/translate.ts`): `translateComparison` (:1022)
   dispatches to five framings (four emitter methods plus one inline) — 8-bit
   unsigned/equality (inline, :1050-1073), 8-bit
   signed (`byteSignedOrdered`, :1093), 16-bit equality (`wordEquality`, :1113), 16-bit
   unsigned (`wordUnsignedOrdered`, :1133), 16-bit signed (`wordSignedOrdered`, :1173) — each
   ending in 0/1 materialization (`materialiseOnBranch`, :1077, or the carry-based compact
   form). `translateTerminator`'s `brcond` case (:555-558) then reloads the byte and retests
   with `BNE`/`JMP`. The fusion opportunity is explicitly documented as out of scope in the
   comment at :522-529. `prescanAll` (:284) counts terminator reads (`brcond.cond`,
   `ret.value`) via `terminatorReads` so single-use load deferral (:588) works — this is what
   will let `LDA $D012` fold directly into the fused compare.
4. **Termination analysis** (`packages/codegen/src/il/termination.ts`): enumerates successors
   for `br`/`brcond` only, with a constant-`brcond` taken-edge rule that makes `while (true)`
   analyze as non-returning; a dangling label is **silently ignored** (:56) and surfaces only
   as an ACME symbol error downstream.
5. **Optimizer seam** (`packages/codegen/src/il/optimizer/`): v1 passthrough — no const
   folding, no dead-block removal. Nothing in it inspects terminator kinds today.
6. **Corpus** (`packages/test-harness/`): 14 golden/twin pairs (13 + balloon) with
   `twins.json` routing, ratcheting `budgets.json`, committed `SCOREBOARD.md` + CI freshness
   gate, VICE fixture/twin tiers local-only. Golden regeneration: `UPDATE_GOLDEN=1` (see
   `golden.ts`). Fixture registration model: `examples/rasterpoll/` +
   `src/testing/rasterpoll.ts` + `rasterpoll.spec.test.ts` + `golden-rasterpoll.spec.test.ts`.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/codegen/src/il/instruction.ts` | IL op/terminator unions | Add `brcmp` to `ILTerminator` (03-01) |
| `packages/codegen/src/il/cfg.ts` | Block/function shapes | Add shared `terminatorTargets()` helper (03-01) |
| `packages/codegen/src/il/print-il.ts` | IL printer | Render `brcmp` (03-01) |
| `packages/codegen/src/il/termination.ts` | Startup-shim analysis | Enumerate `brcmp` successors via the helper (03-01) |
| `packages/codegen/src/instr/translate.ts` | IL→6502 | Target-validation pre-pass; `brcmp` terminator case; branch-form framing tails; `terminatorReads` coverage (03-01/03-02) |
| `packages/codegen/src/il/lower.ts` | AST→IL | `lowerCondition` recursion; statement rewiring; literal fold (03-03) |
| `packages/frontend/src/sfa/model-adapter.ts` | Synthetic slot planning | Position-dependent `&&`/`||` predicate (03-03) |
| `examples/guards/` + `packages/test-harness/*` | Corpus | New fixture pair + full supersession surface (03-04) |

## Gaps Identified

### Gap 1: Conditions branch on a re-materialized value
**Current Behavior:** compare → 0/1 in A → `brcond` reloads and `BNE`-retests (9 instructions /
~17 cycles for the raster poll).
**Required Behavior:** compare flags feed the branch directly (4-instruction fused form, RD AC-1).
**Fix Required:** 03-01 + 03-02 + 03-03 together.

### Gap 2: Compound guards join through frame slots
**Current Behavior:** condition-position `&&`/`||` produce slot store/load diamonds (`0sc`
frame traffic) then a single `brcond`.
**Required Behavior:** short-circuit CFG edges, no slot claim in condition position (RD AC-3).
**Fix Required:** 03-03 (lowering + SFA adapter, in step).

### Gap 3: Dangling terminator targets fail silently
**Current Behavior:** ignored by termination analysis (`termination.ts:56`); unresolved symbol
at assemble time.
**Required Behavior:** translation-time ICE (RD AC-10, plan-AR #2).
**Fix Required:** 03-01 pre-pass.

### Gap 4: No terminator-successor single source of truth
**Current Behavior:** `termination.ts` hand-enumerates `br`/`brcond` edges; a new terminator
kind contributing zero successors would misclassify toward the non-terminating startup shim —
the documented crash direction (`termination.ts:6-11`).
**Required Behavior:** one shared successor enumeration all consumers use.
**Fix Required:** 03-01 `terminatorTargets()`.

## Dependencies

### Internal
- RD-01 instruments (timing table, budgets, twin-diff) and RD-02 corpus (twins, scoreboard,
  freshness gate) — both ✅ done; this plan only consumes them.
- R15 boundary: the frontend edit is AST-side only; `test/boundary.spec.test.ts` guards it.

### External
- VICE 3.10 + ACME locally for phases 3–5 emulator tiers (CI runs codec/golden tiers only,
  AR-27).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Inverted branch polarity in a framing (logic inversion) | Med | High | ST-cases cover framing × polarity × operand order, both branch senses (07); `guards` VICE observables green pre-flip (plan-AR #1) |
| SFA preorder drift between adapter and lowering | Med | High | Land both in one phase; the existing name/size ICE stays the loud tripwire; drift ST-case |
| Golden hand-review fatigue (all 14 goldens change in phase 4) | Med | Med | Review per-fixture with the twin beside it; Prime Directive read; delta record quantifies each diff |
| `while (true)` startup-shim regression (fold changes the IL shape termination sees) | Low | High | Fold emits plain `br` — handled natively; explicit ST-case on shim selection |
| Branch-range exposure widens (framing-internal branches now target real labels) | Med | Med | Accepted in the RD (req-AR #25, #65 → #51); corpus assembles under ACME in every tier |
