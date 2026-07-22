# Testing Strategy: RD-01 Silent miscompiles

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

Every ST-case derives from RD-01 (requirements, AR-#, AC-#) and the spec — never from imagined
implementation behavior. Expectations are the RD's acceptance oracle. Tiers: `[CI]` runs
everywhere; `[local]` is the VICE tier CI skips (AR-27). The RD's AC-# is the owning oracle; the
`Source` column cites it.

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Loop lowering + frontend diagnostics (core) | 90% |
| SFA / frame / classification (supporting) | 80% |
| Golden / example glue | pinned by goldens, not %-measured |

- Test names state behavior: `should [expected] when [condition]`.
- **Per-phase oracle discipline (AC-15, non-negotiable):** every new assertion is perturbed once,
  watched to fail, then restored — because several assertions here are green before the fix for
  the wrong reason (a harness-bounded loop; a golden that never exercised the shape).

## 🚨 Specification Test Cases (MANDATORY)

> **IMMUTABLE ORACLE RULE:** do not modify these expectations to match the implementation. A
> failing spec test means the implementation is wrong.
> In-code traceability comments quote the behavior in **plain language** — never an `ST-`/`AC-`/RD
> id or a `codeops/` path (the planning folder is ephemeral; the test must stand alone).

### M-01 — loop exit (Phase 1)

> **Tier discipline (PF-005/PF-007, load-bearing).** A `[CI]` codegen test **cannot observe
> termination or visit-count** (no in-process interpreter; VICE is `[local]`, CI-skipped — AR-27;
> RD AC-1's own oracle). So `[CI]` M-01 rows assert only **emitted shape and gating**; all
> termination/count claims live in the `[local]` ST-16L/ST-16C rows. Every loop header carries the
> grammar-mandatory `let` (PF-018) — the rows are transcribed verbatim.

| #    | Input / Scenario | Expected Output / Behavior | Tier · Source |
|------|------------------|----------------------------|--------|
| ST-1 | `for (let i: byte = 9 downto 0)` | emitted exit carries the wrap guard (`brcmp` of post-step vs the descending immediate) **and** the retained bound compare | `[CI]` shape · AC-1, AC-4 |
| ST-2 | `for (let i: byte = 0 to 255)` (literal) | compiles — **no ICE**; wrap guard present | `[CI]` shape · R3, AC-1 |
| ST-3 | `const MAX: byte = 255; for (let i: byte = 0 to MAX)` (named const) | wrap guard present (named-const spelling reaches the same gating) | `[CI]` shape · AC-1, AC-3 |
| ST-4 | `for (let i: word = 500 downto 0)`; `const M: word = $FFFF; for (let i: word = 0 to M)` | wrap guard present at **word** width | `[CI]` shape · AC-1 (word axis) |
| ST-5 | `for (let i: sbyte = 5 downto -128)` | wrap guard present, **signed** compare framing | `[CI]` shape · AC-1 (signed axis) |
| ST-5b | `for (let i: sword = 100 downto -32768)` | wrap guard present, **signed word** framing (the sword axis — no `[CI]` row before, PF-008) | `[CI]` shape · AC-1 (sword axis) |
| ST-5c | `let lim: sbyte = 100; for (let i: sbyte = -5 to lim)` (guarded, signed **ascending** through negatives) | wrap guard present; the ascending immediate is **`typeMin + step`** (raw `$80 + s`), signed compare — NOT `step` (PF-032). A `next < step` immediate would exit at the first negative | `[CI]` shape · AC-1, PF-032 |
| ST-6 | `for (let i: byte = 9 downto 1 step 2)` | wrap guard present (non-dividing step) | `[CI]` shape · AC-1 |
| ST-6b | `for (let i: byte = 0 to 10 step 256)` (step ≥ 2^width) | **`E10061`** (the step-validity code, extended to the over-range case) | `[CI]` diag · PF-009, AR-P10, spec/05 §7.3 |
| ST-7 | `for (let i: byte = 0 to 254 step 2)` (step lands on the bound, next step wraps) | wrap guard present; **[local] behavior**: body runs at 0 once (init) and at 254 once; **128 visits total**; no visit occurs after 254 (no wrapped re-entry at 0) | `[CI]` shape + `[local]` · AC-1, AC-3, PF-014/PF-047 |
| ST-8 | `for (let i: sbyte = 0 to 126 step 3)` (interior, next step escapes) | wrap guard present | `[CI]` shape · AC-3 |
| ST-9 | `for (let i: byte = 0 to 9)` (ordinary interior, literal) | **wrap-safe → NO added guard** (today's exact code) | `[CI]` gating · AC-1, AC-12 |
| ST-9b | `const N: byte = 10; for (let i: byte = 0 to N)` (named-const interior) | **wrap-safe → NO added guard** — the resolver-backed stamp evaluates `N` (PF-010); a resolver-less stamp would wrongly guard this | `[CI]` gating · PF-010, AC-12 |
| ST-10 | `for (let i: byte = 9 to 0)` (init past bound, ascending) | emitted exit lets the bound compare fall straight to end (zero-trip); `[local]`: body runs **zero** times | `[CI]` shape + `[local]` · AC-1 |
| ST-11 | `for (let i: byte = 0 to 254 + 1)` (const-expression bound) | wrap guard present (const-expr evaluates to 255) | `[CI]` shape · AC-3 |
| ST-12 | `let limit: byte = 255; for (let i: byte = 0 to limit)` (runtime bound) | wrap guard present (runtime bound never provably safe) | `[CI]` gating · AC-3, R2 |
| ST-13 | emitted **IL** for a wrap-unsafe loop | the `incr` terminator is a `brcmp` of a **freshly-reloaded** post-step counter temp (the schematic's `next2`, NOT the `add`'s dest temp — that identity is load-bearing, PF-052) against the type/step **immediate**, in addition to the `cond` bound compare | `[CI]` IL · AC-4 |
| ST-14 | wrap-unsafe loop, end-to-end **asm**, small body | inversion/relaxation-tolerant + **direction-tolerant**: **exactly one** of the wrap compare's operand pair reads the counter slot and the other is the derived immediate — **never both read the slot** (that predicate rules out the stale-reload trap and survives the translator's `gt`-operand swap on descending loops, PF-034); its taken edge resolves to the loop-exit label | `[CI]` asm · AC-4 |
| ST-15 | wrap-unsafe loop, body > 127 bytes | branch relaxes; no out-of-range branch emitted | `[CI]` · AC-5 |
| ST-16 | slice4a `1 to 10` and slice7 `0 to 4` goldens | **byte-identical** — no added guard (gated-emission proof); pinned by the existing golden suite, not a new test (PF-024) | `[CI]` golden · AC-12 |
| ST-16L | `[local]` VICE: ≥1 `to` + ≥1 `downto` at **each** of byte/word/**sbyte**/**sword**; one non-dividing step each direction; ST-7's interior-escape; one zero-trip | **actual termination + visit-set** observed on hardware | `[local]` · AC-1 |
| ST-16C | `[local]` VICE, **visit tally held in a word** (loop counters typed per cell): `0 to 255`=**256**, `9 downto 0`=**10**, `$FFF0 to $FFFF`=16, `-120 downto -128`=9, **`sbyte -5 to 127`=133** (guarded signed ascending through negatives — the PF-032 cell), `$FFF0 to $FFFF step 3`=6, `0 to 9`=10, `9 to 0`=0 | exact iteration counts (256 and 10 are the headline-defect counts — PF-005; the `-5 to 127` cell fails under the wrong ascending immediate — PF-032) | `[local]` · AC-2 |

### M-02 — poke width (Phase 2)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-17 | `let w: word = 300; poke($D020, w)` | `E10154` (the emission consequence is ST-20A's, test-harness tier — not observable here, PF-042) | `[CI]` frontend · AC-6 |
| ST-18 | `poke($D020, w + 1)` (word-valued expression) | `E10154` | AC-6 |
| ST-19 | `poke($D020, peekw($D000))` (`peekw` result) | `E10154` | AC-6 |
| ST-20 | `const W: word = 300; poke($D020, W)` (named `word` const) | `E10154` (fourth spelling) | `[CI]` frontend · AC-6 |
| ST-20A | wide poke, test-harness tier | on the erroring program `emitAsm` yields **no text** (emission blocked by the error, PF-006); the "exactly one store, no `STX $D020+1`" check is asserted on the **accepted** ST-21 `byte` control | `[CI]` test-harness · AC-6 |
| ST-21 | `poke($D020, b)` where `b: byte` | compiles clean; emits exactly one store (also the positive control for ST-20A) | `[CI]` · AC-7 |
| ST-22 | `poke($D020, s)` where `s: sbyte` | compiles clean (same-width reinterpret) | `[CI]` · AC-7, AR-5 |
| ST-23 | `poke($D020, Color.White)` (enum member) | compiles clean | `[CI]` · AC-7, AR-5 |
| ST-24 | `poke($D020, 7)` (in-range literal) | compiles clean | `[CI]` · AC-7 |
| ST-24b | `poke($D020, true)` (boolean) | rejected as a **kind mismatch** (`E10152` family), **not** `E10154` (boolean is same-width, not a narrowing) | `[CI]` frontend · PF-027 |

### M-03 — frame slot (Phase 3)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-25 | local shadowing a **module variable** | `E10101` | AC-8 |
| ST-26 | local shadowing a **parameter** | `E10101` | AC-8 |
| ST-27 | local shadowing an **in-scope local** | `E10101` | AC-8 |
| ST-28 | same-scope **duplicate** | `E10003` | AC-8 |
| ST-29 | **nested** loop reusing its enclosing counter | `E10062` | AC-8, AR-6 |
| ST-30 | sibling `if{ let t:word } else{ let t:byte }` | compiles with **no diagnostic** | `[CI]` frontend · AC-9 |
| ST-30b | sibling for-counters `for(let i:byte…){} for(let i:word…){}` | compiles with **no diagnostic** | `[CI]` frontend · PF-012 |
| ST-30c | same sibling for-counters, **codegen tier** | the byte loop's counter compare/step emit at **byte** width (no `+1`-byte counter ops), the word loop's at **word** width — proves the `:701` per-declaration fix, which the frontend tier (ST-30b) cannot observe (PF-037/PF-012) | `[CI]` codegen · PF-012 |
| ST-31 | pop-2 word/byte sibling, **layout** | the widened slot's neighbour is at a **non-overlapping** offset (layout assertion — frontend tier sees plan, not asm) | `[CI]` frontend · AC-9 |
| ST-32 | pop-3 `if{ let t:word; pokew($D000,t) } else{ let t:byte }`, **test-harness** | the wide read lowers `LDA t / LDX t+1 / STA $D000 / STX $D000+1` (value assertion), **and** the pop-2 store writes no byte outside its slot — the emitted-extent evidence R15 keeps out of the frontend tier (PF-025) | `[CI]` test-harness · AC-9 |

### M-04 — IRQ warning (Phase 4)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-33 | function reachable from an address-taken handler **and** the mainline, with frame state | `W10182` once, naming both reachers | AC-10 |
| ST-33b | function reached by a **taken AND a never-taken** handler (mixed roots) | `W10182`, naming the **taken** handler (witness from the taken-rooted closure) | PF-031 |
| ST-34 | callee of a **never-address-taken** handler | **no** warning | AC-11 |
| ST-35 | shared function with **no frame state** per the AR-P9 proxy (no params/locals, syntactically spill-free body) | **no** warning | AC-11, AR-P9 |

### Closeout pins (Phase 1 forcing / Phase 5 discharge)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-36 | slice8b `copyBytes` golden | re-goldened to the wrap-safe runtime-bound idiom; the committed idiom pin | AC-13, AR-10 |
| ST-37 | ledger X-07 and X-08 | retired in the fixing change; the ledger gate goes red until they are | AC-14 |
| ST-38 | all 14 corpus goldens except slice8b | byte-identical; all 18 examples compile clean under the new diagnostics | AC-12 |

> **⚠️ AUTHORING RULE:** derive expectations from RD-01 / spec above. If an expected output cannot
> be determined from the spec, it is an ambiguity — add it to the register, do not guess. These
> rows are excerpted verbatim into the spec-test-author agent's packet (quality profile active);
> keep each row self-contained.

## Test Categories

### Specification Tests (from ST-cases)

| Test File | ST Cases | Component | Tier |
| --------- | -------- | --------- | ---- |
| `control-flow-lowering.spec.test.ts` (codegen) | ST-1…ST-5, ST-5b, ST-5c, ST-6, ST-6b, ST-7…ST-9, ST-9b, ST-10…ST-15 (shape/gating/diag) | M-01 IL/asm | `[CI]` |
| VICE loop-termination suite | ST-16L, ST-16C | M-01 runtime | `[local]` |
| poke-width frontend spec (`frontend`) | ST-17…ST-20, ST-21…ST-24, ST-24b | M-02 diag | `[CI]` |
| poke-width emit spec (`test-harness`) | ST-20A | M-02 asm | `[CI]` |
| shadowing/reuse spec (`frontend`) | ST-25…ST-30, ST-30b, ST-31 | M-03 diag/layout | `[CI]` |
| sibling-counter width + wide-read/store extent spec (`test-harness`/codegen) | ST-30c, ST-32 | M-03 emit | `[CI]` |
| irq-interference spec (`frontend`/`sfa`) | ST-33, ST-33b, ST-34, ST-35 | M-04 warn | `[CI]` |
| golden suite + ledger + example build | ST-16, ST-36…ST-38 | closeout | `[CI]` |

### Implementation Tests (edge cases, internals) — written AFTER implementation

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `control-flow-lowering.impl.test.ts` | boundary case (`:62-70` +1); ICE-expectation flip (`:72-78`, assertions `:76-77`) | High |
| frame-computation impl | widest-sizing internals; **later-slot offsets equal the recomputed running sum, no overlap** (NOT offset identity — PF-011) | High |
| model-adapter impl | provenance threading; address-taken predicate over classification output; AR-P9 spill-free-body proxy | High |
| **golden perturbation (AC-15, PF-024)** | regenerated goldens can't be red-first, so perturb them explicitly: mutate one byte of `slice8b.asm.golden` (ST-36) and of an unchanged corpus golden (ST-38) → observe the suite fail → restore | High |

## Verification Checklist

- [ ] All ST-cases have concrete input/expected pairs traced to an AC-#
- [ ] Spec tests written and RED before implementation (red phase per phase)
- [ ] Spec tests GREEN after implementation
- [ ] AC-15 perturbation done per new assertion (fail observed, restored)
- [ ] Impl tests cover the moved unit pins
- [ ] No regressions; goldens byte-identical except slice8b; all 18 examples compile clean
- [ ] X-07/X-08 retired; ledger gate green only after retirement
