# Changelog

All notable changes to the Blend65 language specification are recorded here.
The format is loosely based on [Keep a Changelog](https://keepachangelog.com/),
and the project follows a major-version contract: breaking changes to a
**stable** feature require a major version bump.

---

## [Unreleased] — Compiler Discovery

### Repository layout

- **Renamed `language-specification-v3/` → `spec/`** (per AR-19), via `git mv` so
  full file history is preserved. Live path references in `requirements/` and
  `.clinerules/` were updated; the historical "renamed from" notes were kept
  intentionally.

### Discovery closed — Zero-Ambiguity Gate PASSED (2026-05-30)


The compiler requirements discovery phase is complete. All ambiguity-register
threads (**AR-1..AR-93**) are resolved and the **Zero-Ambiguity Gate is PASSED**,
unblocking RD (requirements document) authoring against the frozen `spec-v3.0`.

- **Preflight protocol** added (`requirements/01-preflight-checklist.md`): a
  repeatable five-gate audit (spec-hygiene, spec-contradiction, AR-coverage,
  RD-traceability, MVP-reachability). First run recorded as PASS.
- **AR-86**: VIC-20 accepted as the 6th and final target platform (after
  `c64 → c64u → cx16 → a7800 → a800xl`); rides the c64 toolchain with zero
  core-language impact — spec row, appendix, and profile variants deferred to the
  final platform phase.
- **AR-87..AR-93**: preflight gap sweep surfaced a class of *under-specified
  algorithms* in Ch 11 ("the compiler computes X from the static call graph" with
  no algorithm). Registered as delegation entries owned by RD-05 (frame coloring,
  interrupt frames, ZP allocation, frame-region peak) and RD-04 (module-init
  topological sort), with FN-A9 raw-vector escape declared out-of-scope and a
  FUT-003 (typed function pointers) "escape-set" forward-insurance note. Soundness
  rests on the **provably complete v3 call graph** (FN-12: functions are not
  values; no indirect calls; recursion forbidden).

---

## [spec-v3.0] — 2026-05-30 — Frozen Baseline


The first frozen baseline of the Blend65 v3 language specification. This tag is
the **stable reference** against which compiler implementation begins. No further
changes land on this baseline; subsequent spec work proceeds toward a future
version.

### Contents

- **15 specification chapters** (`00`–`15`): introduction, lexical structure,
  type system, variables, expressions & operators, statements & control flow,
  functions, structs, arrays & strings, enums, modules, memory model,
  intrinsics, data inclusion, diagnostics, platform profile.
- **Master grammar** (`grammar.ebnf.md`): ISO 14977 EBNF, 85 productions,
  LL(2) maximum lookahead, Gate G4 certified (PASS).
- **23 feature evaluations** (`evaluations/F001`–`F024`): every feature passed
  the 23-rule Language Guard across all five target platforms.
- **5 platform appendices**: Commodore 64, C64 Ultimate, Commander X16,
  Atari 800XL, Atari 7800.
- **Supporting documents**: feature index, future considerations, v2→v3
  migration guide, pre-flight report, build plan.

### Pre-flight audit (resolved in this baseline)

- Undefined behavior eliminated in favor of an explicit **unspecified-value**
  model — every input yields a defined result or a compile-time error.
- Source file extension standardized to `.blend` (was `.b65` in v2).
- Identifier length limit specified.
- `for`-loop range keywords `until` (exclusive), `to`/`downto` (inclusive),
  and `step` fully specified as **contextual keywords** with bound-range
  semantics and codegen notes.
- Module initialization order defined, with circular-initializer detection.
- Matching diagnostics added: use-before-assign warning, loop-bound error,
  circular-initializer error.

### Stability

- Baseline commit: `c2dded1`
- Spec internal version: **3.0**
- This baseline is **stable**.
