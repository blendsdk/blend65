# Testing Strategy: RD-04 Compare-and-Branch Fusion

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| New codegen paths (terminator, framings, lowering recursion) | 90% |
| SFA adapter predicate | 90% |
| Test-harness assets / glue | covered by the tiers themselves |

- Tier map (established by RD-01/RD-02, unchanged): codegen unit tiers + golden tier + budget
  tier + scoreboard freshness run in CI; VICE fixture/twin tiers are local-only
  (`describe.skipIf`, AR-27) and run sequentially.
- Test names state behavior; spec vs impl file naming per the project standard.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from RD-04 (Must-Haves, Technical Requirements, AC-1…AC-10), the
> component specs (03-01…03-04), and the registers (req-AR #20–#25, plan-AR #1–#7).
> **IMMUTABLE ORACLE RULE**: if the implementation does not match, the implementation is wrong.
> The one sanctioned exception is req-AR #24's supersession of PRE-EXISTING spec tests that
> assert the materialize-reload-retest defect — the RD supersedes those oracles in writing;
> the ST-cases below are the replacement oracle and are themselves immutable.
> In-code traceability comments quote behavior in plain language, never ST/AR ids.

### IL terminator, successors, validation (03-01)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-9a | Print a function whose block ends `brcmp lt` on temp `%0` vs immediate 251 (byte operands) → `_L1`/`_L2` | Printer line exactly `brcmp lt i8u %0, 251, _L1, _L2` (format pinned here — the comparison instruction's prefix-tag/operand rendering plus the target list; the tag is `ilTypeTag`'s, per plan-AR #8) | 03-01 §Printer |
| ST-9b | `terminatorTargets` over all five kinds | `br`→`[target]`; `brcond`/`brcmp`→`[trueTarget, falseTarget]`; `ret`/`unreachable`→`[]` | plan-AR #2 |
| ST-9c | `functionCanReturn` on a CFG whose only path to `ret` crosses a `brcmp` | `true` — both `brcmp` edges are live successors | 03-01 §Termination |
| ST-9d | Translate a function whose terminator targets label `_LX` with no such block (each kind: `br`, `brcond`, `brcmp`) | Diagnostic bag holds ICE `terminator target '_LX' resolves to no block …`; no crash, no silent emission | RD AC-10 / plan-AR #2 |
| ST-13 | Program `function main(): void { while (true) { poke($D020, 1); } }` compiled end-to-end | Non-terminating startup shim selected (`JMP _main`), exactly as today | 03-01 §Termination / req-AR #21 |

### Condition-position lowering + SFA (03-03)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-8a | Lower `if (a < b) { … }` (unsigned bytes) | Condition block terminates `brcmp lt i8u a, b, then, else` (pinned printer grammar, ST-9a); NO comparison instruction, NO `brcond`, NO temp for the result | RD Must-Have (condition-position) |
| ST-8b | Lower `while (x != 5)` / `do … while (x != 5)` / `for (let i: byte = 0 to 9)` / `switch (d) { case 3: … }` | Each condition/dispatch block ends in `brcmp` (`ne`/`le`/`eq` respectively); for-init and switch-discriminant lowering otherwise unchanged | RD Must-Have; 03-03 §Statement rewiring |
| ST-8c | Lower `if (!b)` where `b: boolean` | IDENTICAL instruction list to `if (b)` with true/false targets swapped; no `eq b, 0` instruction | RD AC-4 |
| ST-8d | Lower `if (x >= 8 && x < 40)` | Two blocks each ending `brcmp` (`ge` then `lt`); right block reachable ONLY from the first's true edge; zero `0sc` stores/loads; frame has no slot for this site | RD AC-3 / req-AR #22 |
| ST-8e | Lower `if (a \|\| b)` (boolean reads) | Left block `brcond a, then, mid`; `mid` block `brcond b, then, else` — fallback path, still slot-free | 03-03 §lowerCondition |
| ST-8f | Lower `while (true)` and `if (false) { … } else { … }` | Cond site emits unconditional `br` to body / else respectively; zero condition-evaluation instructions | RD AC-2 / req-AR #21 |
| ST-8g | Lower `let c: boolean = x > y;` | Byte-identical IL to today: comparison instruction + store — value context untouched | RD AC-6 |
| ST-14 | Lower `if (f(a && b)) …` and SFA-plan the same program | The inner `&&` (value position: call argument) claims slot `0sc0` in BOTH the adapter count and lowering — position rule holds on both sides; the outer condition falls back to `brcond` on the call result | 03-03 §Slot semantics / req-AR #22 |
| ST-15 | SFA adapter over `if (p && (q ? r : s))` | `&&` claims NO slot (condition position); the `?:` DOES claim (operand of condition-position `&&` but not itself `!`/`&&`/`\|\|`) — counts match lowering's claims exactly (no drift ICE) | RD structural definition |

### Translator branch-form framings (03-02)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-10a | IL `brcmp` per op {eq,ne,lt,le,gt,ge} × width/signedness {byte-u, byte-s, word-eq, word-u, word-s} × RHS {immediate, memory}, constructed directly | Exact instruction sequences per 03-02's framing table: shared compare core + `<branch> true` + `JMP false`; NO `LDA #$00/#$01` anywhere; `gt`/`le` emit the swapped-operand framing; both branch senses asserted per framing (inversion guard) | RD Must-Have (framings) / AC-10 |
| ST-10b | `brcmp lt` on signed bytes | `SEC · SBC · BVC skip · EOR #$80 · skip: · BMI true · JMP false` | RD AC-5 / spec/02-type-system.md N⊕V |
| ST-10c | `brcmp` whose left operand is a single-use deferred load of `$D012` | `LDA $D012 · CMP #<imm> · <branch> · JMP` — the load folds into the compare, no temp traffic | RD AC-1/AC-7; 03-02 §use-count |
| ST-6  | Value-form comparison IL (today's shape) | Translator output byte-identical to current goldens — the value tails are untouched | RD AC-6 |

### End-to-end goldens + corpus (03-04)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | Regenerated `rasterpoll.asm.golden` | Poll condition block exactly `LDA $D012 · CMP #$FB · BNE <body> · JMP <end>` — 4 instructions, 10 bytes, ≤12 static cycles on the polling path; zero `_cmp` labels in the function | RD AC-1 |
| ST-2 | `while (true)` outer loop in the same golden | Its condition site contains only an unconditional `JMP` | RD AC-2 |
| ST-3 | `guards` golden, compound-guard region | Two `CMP`-based fused sequences; no `0sc` frame traffic; second clause's code reachable only via the first's true edge | RD AC-3 |
| ST-4 | `guards` golden, negation region | The `if (!active)` block has the SAME instruction count as the equivalent un-negated test, true/false targets swapped; no `eq …, 0` residue | RD AC-4 |
| ST-5 | `guards` golden, signed-compare region | The ST-10b sequence branching to real block labels, no materialization | RD AC-5 |
| ST-7 | `guards` golden + rasterpoll golden | Exactly one `LDA $D012` per poll iteration; the `peek($DC00)` load appears only inside the right-clause block | RD AC-7 |
| ST-11 | `test/boundary.spec.test.ts` | Green — no `@blend65/codegen` import in `frontend`/`language-server` | RD AC-9 |
| ST-12 | `guards` VICE observables, phase 3 (pre-flip) vs phase 4 (post-flip) | IDENTICAL observable values — fusion is observationally invisible | plan-AR #1; RD Integration w/ RD-02 |

> **⚠️ AUTHORING RULE:** expectations above derive from the RD and spec docs. Where an exact
> byte sequence depends on operand homes chosen at execution (e.g. `guards` addresses), the
> ST-case pins the structural invariant (instruction kinds, label targets, absence of
> materialization) and the golden pins the bytes after hand review.

## Test Categories

### Specification Tests (files)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/codegen/src/il/print-il.spec.test.ts` (+ golden) | ST-9a | 03-01 |
| `packages/codegen/src/il/cfg` successor cases + `termination.spec.test.ts` (new) | ST-9b, ST-9c, ST-13 | 03-01 |
| `packages/codegen/src/instr/translate.spec.test.ts` | ST-9d, ST-10a–c, ST-6 | 03-01/03-02 |
| `packages/codegen/src/il/control-flow-lowering.spec.test.ts` | ST-8a–g, ST-14 | 03-03 |
| `packages/codegen/src/il/switch-lowering.spec.test.ts` | ST-8b (switch rows) | 03-03 |
| `packages/frontend/src/sfa/model-adapter.spec.test.ts` | ST-14, ST-15 | 03-03 |
| `packages/test-harness/src/golden-rasterpoll.spec.test.ts` + `golden-guards.spec.test.ts` (new) + golden suites | ST-1, ST-2, ST-3, ST-4, ST-5, ST-7 | 03-04 |
| `packages/test-harness/src/guards.spec.test.ts` (new, VICE) | ST-12 | 03-04 |
| `test/boundary.spec.test.ts` (existing, unchanged) | ST-11 | — |

### Implementation Tests (after green)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `il/control-flow-lowering.impl.test.ts` | `!!b`, `&&`-under-`||` nesting, `else if` chains, `for downto`, poisoned-type conditions | High |
| `instr/translate.impl.test.ts` | swapped operands, memory-RHS word framings, `_cmp` internal label allocation, register-residency after fused blocks | High |
| `packages/frontend/src/sfa/model-adapter.impl.test.ts` | deep nesting, `?:`-inside-`&&`-inside-`if`, initializer-stream conditions | Med |

### Integration / End-to-End

The golden tier (CI) and the VICE fixture + twin tiers (local) ARE the integration and E2E
tiers — per-fixture, byte-exact, and behavior-observable respectively (03-04 §Supersession
items 2 and 6).

## Test Data

- Fixtures: `guards` (new — 03-04); all 14 existing pairs (superseded goldens only).
- Mocks: none — real compiler facade, real ACME, real VICE (project standard).

## Verification Checklist

- [ ] All ST-cases defined with concrete input/output pairs (above)
- [ ] Every ST case traces to RD/03-doc/AR entry (Source column)
- [ ] Spec tests written BEFORE implementation, verified red (99: each phase's N.1 step)
- [ ] Green phase per phase; impl tests after; full verify per plan-AR #6
- [ ] Supersession rewrites happen ONLY in phase 4 and ONLY for pre-existing tests asserting
      the superseded idiom (req-AR #24)
