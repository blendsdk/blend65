# RD-04: Compare-and-Branch Fusion

> **Document**: RD-04-compare-and-branch-fusion.md
> **Status**: Draft
> **Created**: 2026-07-19
> **Project**: blend65 — Asm-Parity Initiative
> **Issue**: [#50](https://github.com/blendsdk/blend65/issues/50) (Prime Directive audit finding #1)
> **Depends On**: RD-01 (parity instruments, ✅), RD-02 (twin corpus + scoreboard baseline, ✅)
> **CodeOps Skills Version**: 3.9.0

---

## Feature Overview

Every condition in every Blend65 program today pays for its comparison twice: the comparison
materializes a 0/1 boolean byte in A (consuming the CPU flags the `CMP` already produced), and
the branch then reloads and retests that byte. The hottest loop in any C64 game — the raster
sync `while (peek($D012) != 251) {}` — compiles to a 9-instruction loop (≈17 cycles per
executed poll) where an expert assembly developer writes 3 instructions (9 cycles). The same
shape taxes every `if`, `while`, `for`, and `switch` in the
corpus, and compound guards (`if (x >= 8 && x < 40)`) additionally join through a frame slot
in memory.

This RD makes conditions compile the way that developer writes them: when a comparison or
boolean expression is consumed only by a branch, the compare's flag state feeds the
conditional branch directly — no 0/1 materialization, no reload, no retest. Materialization
remains for value contexts (`let b: boolean = x > y;`). It is the lead item of the hot-loop
wave: the cycle lever (baseline 6.51× cycles is the worse corpus metric) with corpus-wide
reach and no language-surface change.

## Functional Requirements

### Must Have

- [ ] **Fused compare-and-branch terminator (IL).** The IL gains a fused terminator (working
  name `brcmp`; final name is the plan's choice) carrying the comparison op (`eq`/`ne`/`lt`/
  `le`/`gt`/`ge`), `left`, `right`, the promoted operand `ILType`, and `trueTarget`/
  `falseTarget`. Lowering emits it for condition-position comparisons; the translator selects
  the framing. Fusion is thereby true by construction — never a downstream pattern-match that
  can silently stop firing. *(AR #23)*
- [ ] **All framings branch directly.** Each existing comparison framing — 8-bit unsigned
  (carry), 8-bit signed (N⊕V per `spec/02-type-system.md`), 16-bit equality, 16-bit unsigned,
  16-bit signed — emits its terminal flag test as a conditional branch to the true target
  followed by `JMP` to the false target, with no 0/1 materialization. `gt`/`le` keep the
  operand-swap framing. Both operand orders and both immediate/memory right-hand sides are
  covered.
- [ ] **Condition-position lowering.** The condition expressions of `if`, `while`,
  `do-while`, `for`, and the `switch` dispatch chain lower through a branch-context recursion
  (condition → true-label/false-label edges): comparisons emit the fused terminator; `!`
  recurses with swapped targets (zero extra code); `&&`/`||` recurse as short-circuit CFG
  edges with **no synthetic-slot claim** in condition position; any other boolean expression
  (variable read, call result) falls back to materialize + `brcond`. *(AR #22)*
- [ ] **SFA slot preorder updated in step.** The frontend SFA adapter's slot-site predicate
  and the lowering's claim sites derive "condition position" identically (the predicate
  becomes position-dependent; today it is deliberately position-independent). Structural
  definition: a node is in condition position iff it is the condition child of
  `if`/`while`/`do-while`, or an operand of a condition-position `!`/`&&`/`||`. For-loop
  bounds are numeric (they cannot contain `&&`/`||`) and a `switch` discriminant is
  value-position (its slot rules are unchanged) — which is why the definition names only the
  three condition statements. Drift between
  the two walks must remain a loud ICE (the existing name/size verification), never a silent
  mis-address. *(AR #22)*
- [ ] **Boolean-literal conditions fold at lowering.** A `brcond`/fused-terminator site whose
  condition is a boolean literal emits an unconditional `br`: `while (true)` produces zero
  condition-evaluation code; `if (false)` branches straight to the else/end edge. *(AR #21)*
- [ ] **Value contexts keep materialization.** `let b: boolean = x > y;`, boolean
  parameters/returns, and any comparison whose result is consumed as data compile exactly as
  today. A comparison consumed both as value and branch materializes the value; correctness
  over cleverness.
- [ ] **Boolean reads in condition position do not regress.** `if (b)` stays a load plus one
  conditional branch (`brcond` path unchanged).
- [ ] **MMIO discipline is preserved.** A condition containing `peek()` performs exactly the
  same loads, in the same order, the same number of times per evaluation as today; fusion
  changes only the flag-to-branch plumbing. Short-circuit remains a language guarantee: a
  right-hand clause's reads execute only when the left clause does not decide.
- [ ] **Corpus supersession, same change.** Affected spec-test expectations are rewritten to
  the fused idiom; all goldens regenerated and hand-reviewed; `budgets.json` tightened to the
  new exact values (ratchet, AR #12); `SCOREBOARD.md` regenerated (freshness gate, AR #17).
  *(AR #24)*
- [ ] **Acceptance shapes have named homes.** The AC-3/4/5/7 program shapes land as
  unit-tier cases — CFG/IL shape in `il/control-flow-lowering.spec.test.ts`, framing ×
  polarity bytes in `instr/translate.spec.test.ts`, end-to-end text in
  `instr/generate.golden.spec.test.ts` — **plus one new small corpus fixture** (compound
  guard + `!` + signed compare + `peek`-in-right-clause; name is the plan's choice) with
  golden, hand-written twin, VICE observables, `twins.json` routing, and a scoreboard row —
  execution-tier proof of the slot-free short-circuit path, and a scoreboard row that
  evidences the fix to the worst divergence.

### Should Have

- [ ] Word-framing simplification: the 16-bit ordered framings' internal true/false label
  structure maps directly onto the real targets (their `LDA #$01/#$00` tails disappear
  entirely), yielding the compact high-byte-first chains.
- [ ] Closeout delta record: per-fixture before/after bytes and straight-line cycles for the
  corpus (the scoreboard diff), quoted in the area report on the issue.

### Won't Have (Out of Scope)

- **The 3-instruction raster idiom** — jump threading (`BNE body; body: JMP cond` →
  `BNE cond`) and fall-through elision are RD-05 (#51); the twin-byte-comparable acceptance
  criterion transfers there in writing. This RD's acceptance is the exact fused
  branch-over-jump form. *(AR #20)*
- **Computed-constant conditions and unreachable-block removal** — the wave's conservative
  const-fold pass (folds the fused terminator on constant operands to `br`) and RD-05's
  layout own these. *(AR #21)*
- **Branch relaxation** for out-of-range conditional branches — pre-existing exposure
  ([#65](https://github.com/blendsdk/blend65/issues/65), routed to #51 because relaxation
  needs final block geometry). This RD knowingly widens the exposed surface: framing-internal
  branches now target real block labels instead of nearby local ones. *(AR #25)*
- **`?:` in condition position** — falls through the materialize + `brcond` fallback; no
  special lowering.
- **Peephole catalog rewrites** (RD-06 / #52) and **ABI/call lowering** (RD-10 / #59).

## Technical Requirements

### IL terminator (complexity: M)

Discriminated-union addition beside `br`/`brcond`/`ret`/`unreachable`
(`packages/codegen/src/il/instruction.ts:159-168`), carrying
`{op, left, right, type, trueTarget, falseTarget}` with `type` = the promoted operand type
(the framing selector, mirroring the comparison instruction's convention at
`instruction.ts:102-109`). Touch set: printer (`print-il.ts`), termination analysis
(`termination.ts`), CFG successors, and the translator's terminator switch +
operand-liveness reads. `brcond` remains for branching on boolean *values*. New tripwire: a
terminator target label that resolves to no block becomes a translation-time ICE — today a
dangling label is silently ignored (`termination.ts:56`) and surfaces only as an ACME symbol
error, and the branch-context recursion is exactly the code most able to mint one.

### Lowering (complexity: L)

Branch-context recursion beside `lowerExpr` (`packages/codegen/src/il/lower.ts`): the
statement lowerers (`lower.ts:491-533`, `:549-563`, for/switch sites) call it with their
true/false labels instead of `lowerExpr` + `brcond`. Case analysis: comparison → fused
terminator; `!` → swap targets; `&&` → recurse left into (fresh mid-label, false), open mid,
recurse right; `||` dual; boolean literal → `br` (the fold, AR #21); fallback → materialize +
`brcond`. Condition-position `&&`/`||` claim no synthetic slot (`claimResultSlot` untouched
for value-position sites, `lower.ts:1230-1248`); staging fallback recorded in AR #22's note —
claim-and-discard to keep the counter advancing if the adapter change needs to land
separately.

### SFA adapter coupling (complexity: M — the one cross-package edit)

`packages/frontend/src/sfa/model-adapter.ts:107-139` (`collectSyntheticSlots`/`isSlotSite`):
the predicate gains the position test using the structural definition above, implemented on
the AST walk (parent context), with **no import from `@blend65/codegen`** — the R15 boundary
is untouched; the two packages stay coupled only by the shared structural definition. The
existing loud verification (frame-miss / size-mismatch ICE) is the drift tripwire and must
keep firing on any disagreement.

### Translator framings (complexity: M)

The four framing emitters (`packages/codegen/src/instr/translate.ts:1022-1193`) gain a
branch-form terminal: where they call `materialiseOnBranch(b)` (or the carry-based compact
form), the fused path emits `b → trueTarget` + `JMP falseTarget`. The 16-bit ordered
framings' internal `trueL`/`falseL` labels become the real targets. Register-residency
tracking (`bindA`/`clearRegs`) keeps its current semantics; the fused path binds nothing (no
0/1 value exists).

## Integration Points

### With RD-01 (parity instruments)
Budget tier asserts the tightened `budgets.json`; the annotator/resource report quantify the
per-fixture cycle deltas for the closeout record.

### With RD-02 (twin corpus + scoreboard)
`SCOREBOARD.md` regenerates against the same twins (existing twins never change here; the
new acceptance fixture adds one pair/row); the twin tier and fixture VICE tiers must stay
green — fused control flow is observationally identical.

### With RD-05 / #51 (block layout)
Consumes this RD's fused output; owns the twin-byte-comparable raster idiom (acceptance
transferred, AR #20) and the branch-range defect #65 (AR #25). The fused terminator threads
like `brcond` in its passes.

### With the wave's const-fold pass (split from #58)
The fused terminator folds to `br` on constant operands — the pass handles propagated
constants; this RD's lowering fold handles syntactic literals only. *(AR #21)*

### With blend65-ri R15 / AR-20 boundary
All codegen changes live in `@blend65/codegen`; the frontend edit is AST-side only. The
boundary tier (`test/boundary.spec.test.ts`) must stay green.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Acceptance bar | fused form now, idiom → RD-05 / special-case empty-body threading | Fused branch-over-jump form; twin-byte criterion transferred to #51 in writing | The remaining gap is exactly RD-05's two transforms; duplicating them here is dead logic one item later | AR #20 |
| Constant conditions | fold literals at lowering / route all to const-fold pass | Literal fold at lowering | Meets issue #50's own acceptance with no dependency on an unlanded pass; pass still owns propagated constants | AR #21 |
| Compound conditions | full condition-position lowering / simple compares only | Full lowering incl. `&&`/`||`/`!`, slot-free in condition position, SFA in step | Compound guards are the worst divergence and a stated issue case; drift is a loud ICE | AR #22 |
| Mechanism | translator-local deferral / fused IL terminator / defer to plan | Fused IL terminator | True by construction; no silently-unfiring heuristic; composes with const-fold + RD-05; challenger-reconciled | AR #23 |
| Test supersession | rewrite to fused idiom / keep old assertions | Rewrite; goldens regenerated + reviewed; budgets tightened same-change | The old expectations assert the defect this RD removes | AR #24 |
| Branch range | out of scope + defect filed / relax in this RD | Out of scope; #65 filed, routed to #51 | Relaxation needs final block geometry, which RD-05 is about to change | AR #25 |

## Security Considerations

- **Data sensitivity**: none — compiler-internal transformation; no PII, credentials, or
  runtime data surfaces.
- **Input validation**: no new input surface; source programs pass the existing
  lexer/parser/analyzer validation before reaching lowering. Malformed fused-terminator
  shapes are unrepresentable in the IL's discriminated unions; the representable hazard — a
  target label resolving to no block — is a translation-time ICE, never silent emission.
- **Injection risks**: none — no shell, SQL, HTML, or path handling.
- **Correctness as the security property**: the hazard is miscompiled control flow (a fused
  branch with inverted polarity is a logic inversion). Mitigations: spec tests per framing ×
  polarity × width, byte-exact goldens, the VICE fixture/twin tiers, and MMIO
  volatile-discipline assertions (load count/order preserved).
- **Rate limiting / encryption / infrastructure**: N/A (no runtime/product surface; NFR
  governance per blend65-ri RD-13 and the Prime Directive, as recorded in the requirements
  README).

## Acceptance Criteria

1. [x] **Raster-poll fused form**: the regenerated raster-poll golden's condition block is
   exactly `LDA $D012 · CMP #$FB · <conditional branch to body> · JMP <end>` — 4
   instructions, 10 bytes, ≤12 static cycles on the polling path (was 9 instructions /
   ~17 cycles) — with zero `_cmp`-style materialization labels in the function. *(AR #20)*
2. [x] **`while (true)` emits zero condition code**: its condition block contains no loads,
   compares, or conditional branches — only an unconditional `JMP`. *(AR #21)*
3. [x] **Compound guard**: `if (x >= 8 && x < 40)` (unsigned bytes) compiles to exactly two
   `CMP`-based fused sequences with no synthetic-slot store/load (no `0sc` frame traffic)
   and no 0/1 materialization; the second clause's code is reachable only via the first
   clause's true edge. *(AR #22)*
4. [x] **Negation is free**: `if (!b)` emits the same instruction count as `if (b)` (targets
   swapped; no `not` materialization).
5. [x] **Signed framing fuses**: `if (sx < sy)` (signed bytes) emits
   `SEC · SBC · BVC skip · EOR #$80 · skip:` followed directly by `BMI <true>` + `JMP
   <false>` (per `spec/02-type-system.md` N⊕V), with no materialization; the three 16-bit
   framings likewise branch to real targets.
6. [x] **Value context unchanged**: the golden for `let b: boolean = x > y;` (comparison
   consumed as data) is byte-identical to today's output.
7. [x] **MMIO discipline**: the raster-poll loop performs exactly one `LDA $D012` per
   iteration (assertable from the golden); in `if (a && peek(addr) == v)`, the `peek` load
   sits in the right-clause block only.
8. [x] **Corpus health**: all goldens regenerated and hand-reviewed; the new acceptance
   fixture's golden/twin/observables land with `twins.json` routing and budget entries;
   local VICE fixture and twin tiers green; `budgets.json` tightened to the new exact values
   in the same change; `SCOREBOARD.md` regenerated and the CI freshness gate passes.
   *(AR #24, AR #12, AR #17)*
9. [x] **Boundary intact**: `test/boundary.spec.test.ts` green — no `@blend65/codegen`
   import appears in `frontend`/`language-server`.
10. [x] **Security requirements verified**: a terminator target that resolves to no block
    ICEs at translation (never a silent ACME symbol error downstream); malformed terminator
    shapes are unrepresentable in the IL type; framing × polarity spec tests cover both
    branch senses so no inversion can land unnoticed.

### Acceptance walk (2026-07-19, against the landed state)

Every criterion checked against committed artifacts, not against intent.

| AC | Evidence |
| -- | -------- |
| 1 | `rasterpoll.asm.golden` condition block is `LDA $D012 · CMP #$FB · BNE <body> · JMP <end>` — 4 instructions, 10 bytes (3+2+2+3); the walked polling path is LDA 4 + CMP 2 + BNE taken 3 + the body block's JMP back 3 = **12 cycles**, meeting the ≤12 bound exactly. `_cmp` labels in the file: **0**. |
| 2 | The same golden's `while (true)` head is `Main_main_L0: JMP Main_main_L1` — one unconditional jump, no load, no compare. |
| 3 | `guards.asm.golden` compound guard is two `CMP`-based fused blocks (`CMP #$08 · BCS`, `CMP #$28 · BCC`); the frame no longer declares `0sc0`/`0sc1` at all, and the upper-bound block is entered only from the lower-bound block's true edge. |
| 4 | `if (!active)` is `LDA active · BNE <else> · JMP <then>` — identical instruction count to an un-negated boolean test with the targets swapped, and the `CMP #$00` residue is gone. Pinned by a spec case that lowers `if (b)` and `if (!b)`, swaps the printed targets of the first, and asserts full-text equality. |
| 5 | `guards.asm.golden` signed compare is `LDA dx · SEC · SBC dy · BVC _cmp0 · EOR #$80 · _cmp0: · BMI <true> · JMP <false>` — the twin's own sequence. The 16-bit framings are covered by the framing × polarity suite in `instr/translate-brcmp.spec.test.ts`. |
| 6 | `slice6` is entirely value-position comparisons and short-circuits; its golden is **byte-identical** across the phase diff, as are `gate`, `slice3a`, `slice3b`, `slice5a`, `slice5b`. |
| 7 | Exactly one `LDA $D012` in each of the rasterpoll and guards goldens. The `LDA $DC00` sits inside the right-clause block, reachable only via `BNE` from the `armed` test — so the port is not read when the left clause already decided. |
| 8 | 8 goldens regenerated and hand-reviewed with their twins; `guards` registered end to end since phase 3; `budgets.json` at exact current values (incl. re-measured balloon 133); `SCOREBOARD.md` regenerated with the freshness gate green; local VICE fixture + all 15 twin pairs green. |
| 9 | Root boundary tier green (33 tests). The adapter change imports `@blend65/core` only. |
| 10 | Dangling-target ICE pinned in `instr/translate.spec.test.ts` ("terminator target '_LX' resolves to no block"); the terminator union makes malformed shapes unrepresentable; `instr/translate-brcmp.spec.test.ts` covers all five framings and asserts BOTH branch senses per framing, so a polarity inversion cannot land unnoticed. |

Known limitation, filed not fixed: a `switch` whose discriminant is itself a slot-claiming
expression (a `?:`) ICEs — the planner counts the site once, the dispatch chain re-lowers it
per case value. Pre-existing (reproduced at the pre-phase commit), tracked as
[#66](https://github.com/blendsdk/blend65/issues/66).
