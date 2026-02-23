# Requirements: Optimization Pass 2

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Five optimization improvements that address remaining code quality issues found by the enhanced spinning-line diagnostic. These fixes target deeper optimization patterns that require look-ahead analysis, pipeline configuration changes, and improved post-inlining cleanup.

## Functional Requirements

### Must Have

- [ ] **Fix 1**: SHR_WORD+LO shift-left technique for N=3-7 — IL peephole detects SHR_WORD(N)+LO where N<8 and replaces with an optimized form that uses the shift-left approach: `lo(word >> N) = hi(word << (8-N))`
- [ ] **Fix 2**: Profitable inlining at Os/Oz — enable function inlining at size-optimization levels when the net result is smaller code (inlining + subsequent folding produces fewer bytes than JSR + function body)
- [ ] **Fix 3**: Post-inlining dead store elimination — eliminate redundant STORE_WORD/LOAD_WORD patterns at O1 level (currently IL peephole only runs at O2+)
- [ ] **Fix 4**: Parameter slot forwarding — when inlined code copies a value to a param slot and then immediately uses it, the copy-prop or IL peephole should forward the original slot reference
- [ ] **Fix 5**: Constant propagation through inlined params — when a constant value (e.g., 0) is stored to a param slot by the inliner argument setup, subsequent uses of that slot should be replaced with the constant

### Should Have

- [ ] Regression tests for all 5 fixes
- [ ] Verification via `diag_app` on spinning-line showing improved results
- [ ] Size comparison table: before vs after for all 10 optimization levels

### Won't Have (Out of Scope)

- Delay loop canonicalization (DEX/DEY pattern) — future plan
- Algebraic rewrites beyond shift-left technique
- Changes to O0 output (debug builds must remain unchanged)
- Changes to existing LOAD_ADDRESS_EXPR codegen

## Technical Requirements

### Fix 1: SHR_WORD+LO Shift-Left (N=3-7)

**The math:**
- `lo(word >> N)` extracts bits N through N+7 of the original 16-bit value
- `hi(word << (8-N))` extracts the same bits (they shift into the high byte position)
- For N=6 (8-6=2 shifts): `STA tmp / TXA / ASL tmp / ROL A / ASL tmp / ROL A`
- Cost: 2+(8-N)×2 = 2+4 = 6 instructions for N=6 (vs 36 instructions for SHR_WORD×6)

**Implementation approach (peek-ahead):**
The IL peephole pass already scans for SHR_WORD+LO in `shrWordLoNarrowing()` but only handles N≥8. Extend this to handle N=3-7 by replacing SHR_WORD(N)+LO with a new sequence: HI_SHIFT_LEFT(8-N) — which the codegen emits as the shift-left sequence above.

**Why N=3-7 only:**
- N=1-2: The shift-left approach costs more than the direct approach (6-N rounds of shift-left vs N rounds of PHA/TXA/LSR/TAX/PLA/ROR). For N=2: 6×2=12 bytes shift-left vs 6×2=12 bytes direct (break-even). For N=1: 6×1=6 bytes direct wins.
- N=3: shift-left = 5×2=10 instructions vs direct = 6×3=18 instructions → shift-left saves 8
- N≥8: Already handled by existing shrWordLoNarrowing (HI+SHR_BYTE)

### Fix 2: Profitable Inlining at Os/Oz

**Problem:** Os/Oz skip function-inline entirely, so address-expr folding (which only fires on inlined LOAD_ADDRESS+SHR_WORD+LO sequences) never triggers. When O2 inlines but doesn't fold, it causes a size regression.

**Solution:** Add a `profitable-inline` mode to the inliner that only inlines a function when the estimated post-optimization size is smaller than the call overhead.

**Profitability heuristic:**
A function is profitably inlinable at size levels when:
1. It is called from exactly 1 site (single-call-site: always profitable — saves JSR+RTS = 4 bytes)
2. OR: the function body contains LOAD_ADDRESS+SHR_WORD+LO patterns that will fold after inlining (estimated savings exceed duplication cost)

### Fix 3: Post-Inlining Dead Store Elimination

**Problem:** At O1, the `il-peephole` pass does NOT run. The existing `loadStoreElimination` in IL peephole catches STORE_WORD/LOAD_WORD pairs, but at O1 this pass is absent.

**Solution:** Either:
- (A) Add `il-peephole` to O1 function passes, or
- (B) Enhance the DCE pass to catch dead STORE_WORD after STORE_WORD (when the slot is never read before being overwritten)

Option (A) is simpler and leverages existing infrastructure.

### Fix 4: Parameter Slot Forwarding

**Problem:** After inlining, code like `LDA frame / STA $02 / ... / ADC $02` could be `ADC frame` directly. The copy-prop pass should forward the original source slot through to uses.

**Solution:** Enhance copy-prop to detect STORE_BYTE followed by uses of the same slot, and replace the uses with the source slot when it's still live and unmodified.

### Fix 5: Constant Prop Through Inlined Params

**Problem:** After inlining, `LOAD_IMM 0 / STORE_BYTE $02` sets param $02 to constant 0. Subsequent `ADC $02` should become `ADC_IMM 0` (which identity elimination then removes). The constant-prop pass doesn't propagate through inline continuation labels.

**Solution:** Enhance constant-prop to not treat inline continuation labels as full control-flow boundaries (they are just sequencing labels, not branch targets from outside).

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| SHR_WORD+LO approach | New IL opcode vs extend existing pattern | Extend `shrWordLoNarrowing` | Reuses existing infrastructure, no new opcodes needed |
| N threshold for shift-left | N≥1, N≥2, N≥3 | N≥3 | N=1,2 don't save enough to justify complexity |
| Os/Oz inlining | Full inlining, profitable-only, none | Profitable-only | Respects size goal while enabling folding |
| O1 peephole | Add full peephole, partial peephole, none | Add full `il-peephole` to O1 | Simple config change, low risk |

## Acceptance Criteria

1. [ ] spinning-line O2 PRG size ≤ O0 PRG size (no size regression)
2. [ ] spinning-line Os/Oz PRG size ≤ O1 PRG size
3. [ ] All 9100+ existing tests pass
4. [ ] New regression tests for each fix
5. [ ] `diag_app spinning-line` shows no REDUN or MISSOPT bugs at O2+
