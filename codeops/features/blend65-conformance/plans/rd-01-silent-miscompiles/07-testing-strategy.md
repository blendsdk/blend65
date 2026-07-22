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

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `for (i: byte = 9 downto 0)` | terminates; visits 0 exactly once; emitted exit matches the wrap-safe idiom | AC-1, AC-4 |
| ST-2 | `for (i: byte = 0 to 255)` (literal) | compiles (no ICE); terminates; 256 iterations | R3, AC-1 |
| ST-3 | `const MAX: byte = 255; for (i: byte = 0 to MAX)` | terminates; 256 iterations (named-const spelling) | AC-1, AC-3 |
| ST-4 | `for (i: word = 500 downto 0)` and `const M: word = $FFFF; for (i: word = 0 to M)` | terminate; word-width wrap form | AC-1 (word axis) |
| ST-5 | `for (i: sbyte = 5 downto -128)` | terminates; signed dispatch (V/sign), not carry | AC-1 (signed axis) |
| ST-6 | `for (i: byte = 9 downto 1 step 2)` | terminates (counter 9,7,5,3,1 then would wrap) | AC-1 (non-dividing step) |
| ST-7 | `for (i: byte = 0 to 254 step 2)` (interior bound, escapes by step) | terminates; **no overshoot** (body never runs at 254) | AC-1, AC-3 |
| ST-8 | `for (i: sbyte = 0 to 126 step 3)` (interior, escapes) | terminates; no overshoot | AC-3 |
| ST-9 | `for (i: byte = 0 to 9)` (ordinary interior) | runs 10 bodies and stops; **wrap-safe → no added guard** | AC-1, AC-12 |
| ST-10 | `for (i: byte = 9 to 0)` (init already past bound, ascending) | body runs **zero** times | AC-1 (zero-trip) |
| ST-11 | `for (i: byte = 0 to 254 + 1)` (const-expression bound) | terminates | AC-3 |
| ST-12 | runtime `let limit: byte = 255; for (i: byte = 0 to limit)` | terminates when limit is the type max | AC-3, R2 |
| ST-13 | emitted exit for a wrap-unsafe loop | carries a **value-level `brcmp`** wrap check of post-step vs pre-step counter **in addition to** the bound compare (IL-level assertion) | AC-4 |
| ST-14 | wrap-unsafe loop, end-to-end asm with a small body | terminating exit present (not a bare shape pin) | AC-4 |
| ST-15 | wrap-unsafe loop with a body > 127 bytes | branch relaxes, no out-of-range branch emitted | AC-5 |
| ST-16 | slice4a `1 to 10` and slice7 `0 to 4` goldens | **byte-identical** — no added guard (gated-emission proof) | AC-12 |
| ST-16L | `[local]` VICE: ≥1 `to` + ≥1 `downto` at each of byte/word/sbyte/sword; one non-dividing step each direction; one interior; one zero-trip | actual termination + visit-count observed | AC-1 `[local]` |
| ST-16C | `[local]` VICE, **word** counter: `$FFF0 to $FFFF`=16, `-120 downto -128`=9, `$FFF0 to $FFFF step 3`=6, `0 to 9`=10, `9 to 0`=0 | exact iteration counts | AC-2 `[local]` |

### M-02 — poke width (Phase 2)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-17 | `let w: word = 300; poke($D020, w)` | `E10154`; no second store | AC-6 |
| ST-18 | `poke($D020, w + 1)` (word-valued expression) | `E10154` | AC-6 |
| ST-19 | `poke($D020, peekw($D000))` (`peekw` result) | `E10154` | AC-6 |
| ST-20 | `const W: word = 300; poke($D020, W)` (named `word` const) | `E10154` (fourth spelling) | AC-6 |
| ST-20A | `[test-harness]` `emitAsm` for a wide poke | single store only, no `STX $D020+1` | AC-6 |
| ST-21 | `poke($D020, b)` where `b: byte` | compiles clean | AC-7 |
| ST-22 | `poke($D020, s)` where `s: sbyte` | compiles clean (same-width reinterpret) | AC-7, AR-5 |
| ST-23 | `poke($D020, Color.White)` (enum member) | compiles clean | AC-7, AR-5 |
| ST-24 | `poke($D020, 7)` (in-range literal) | compiles clean | AC-7 |

### M-03 — frame slot (Phase 3)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-25 | local shadowing a **module variable** | `E10101` | AC-8 |
| ST-26 | local shadowing a **parameter** | `E10101` | AC-8 |
| ST-27 | local shadowing an **in-scope local** | `E10101` | AC-8 |
| ST-28 | same-scope **duplicate** | `E10003` | AC-8 |
| ST-29 | **nested** loop reusing its enclosing counter | `E10062` | AC-8, AR-6 |
| ST-30 | sibling `if{ let t:word } else{ let t:byte }` | compiles with **no diagnostic** | AC-9 |
| ST-31 | pop-2 word/byte sibling store | neighbouring variable byte **untouched** (resolved-address assertion) | AC-9 |
| ST-32 | pop-3 `if{ let t:word; pokew($D000,t) } else{ let t:byte }` | wide read lowers `LDA t / LDX t+1 / STA $D000 / STX $D000+1` (value assertion, not address-only) | AC-9 |

### M-04 — IRQ warning (Phase 4)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-33 | function reachable from an address-taken handler **and** the mainline, with frame state | `W10182` once, naming both reachers | AC-10 |
| ST-34 | callee of a **never-address-taken** handler | **no** warning | AC-11 |
| ST-35 | shared function with **no frame state** | **no** warning | AC-11 |

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
| `control-flow-lowering.spec.test.ts` (codegen) | ST-1…ST-15 | M-01 IL/asm | `[CI]` |
| VICE loop-termination suite | ST-16L, ST-16C | M-01 runtime | `[local]` |
| poke-width frontend spec (`frontend`) | ST-17…ST-24 | M-02 diag | `[CI]` |
| poke-width emit spec (`test-harness`) | ST-20A | M-02 asm | `[CI]` |
| shadowing/reuse spec (`frontend`) | ST-25…ST-31 | M-03 diag/addr | `[CI]` |
| wide-read value spec (`test-harness`) | ST-32 | M-03 emit | `[CI]` |
| irq-interference spec (`frontend`/`sfa`) | ST-33…ST-35 | M-04 warn | `[CI]` |
| golden suite + ledger + example build | ST-16, ST-36…ST-38 | closeout | `[CI]` |

### Implementation Tests (edge cases, internals) — written AFTER implementation

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `control-flow-lowering.impl.test.ts` | boundary case (`:62-70` +1); ICE-expectation flip (`:72-78`, assertions `:76-77`) | High |
| frame-computation impl | widest-sizing internals; offset stability of neighbours | High |
| model-adapter impl | provenance threading; address-taken predicate over classification output | High |

## Verification Checklist

- [ ] All ST-cases have concrete input/expected pairs traced to an AC-#
- [ ] Spec tests written and RED before implementation (red phase per phase)
- [ ] Spec tests GREEN after implementation
- [ ] AC-15 perturbation done per new assertion (fail observed, restored)
- [ ] Impl tests cover the moved unit pins
- [ ] No regressions; goldens byte-identical except slice8b; all 18 examples compile clean
- [ ] X-07/X-08 retired; ledger gate green only after retirement
