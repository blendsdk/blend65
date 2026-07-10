# Testing Strategy: RD-18 Slice 5a — User Functions, Parameters & Calls

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
|-----------|--------|
| Semantic validators (call/return/recursion/imports) | 90% |
| Adapter + interference wiring | 90% |
| Codegen (lowerCall/translateCall) | 90% |
| Harness/fixture glue | 60% |

- Test names state behavior: `should [expected behavior] when [condition]`.
- File tiers per repo convention: `*.spec.test.ts` (immutable oracles, written first),
  `*.impl.test.ts` (internals, written after green).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from `spec/06-functions.md`, `spec/10-modules.md` §4, RD-18, and the
> Ambiguity Register. IMMUTABLE ORACLE RULE: a failing spec test means the implementation is
> wrong, never the test. In-code traceability comments quote behavior in plain language,
> never ST/AR ids or plan paths.

### Phase 0 — data region + overlap guard

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-01 | All five existing fixtures re-emitted after the base move | byte-exact against re-minted goldens; every `__var_*`/`__frame_*` equate ≥ `$2000`; zero other line changes | AR-2 |
| ST-02 | Overlap check: load `$0801`, size `0x17FF` (end `$2000`), dataBase `$2000` | accepted (boundary: end == dataBase) | AR-2 |
| ST-03 | Overlap check: load `$0801`, size `0x1800` (end `$2001`), dataBase `$2000` | E10033-band error; `build()` fails, no success result | AR-2 |
| ST-04 | Local VICE: all five re-based fixtures | prior observable assertions unchanged (`$D020==0xF5`, slice3b/4a/4b memory cells) | AR-2; RD-18 bar |

### Call semantics (frontend)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-05 | `add(10, 7)` where `add(a: byte, b: byte): byte` | call expression types as `byte`; `typeMap` covers callee args; no diagnostics | Ch 06 §4.2; AR-5 |
| ST-06 | `add(1)` (one arg for two params) | **E10170**, message names `add`, expected 2, got 1; no per-arg type errors (count failure suppresses them) | Ch 06 §10; AR-5 |
| ST-07 | `add(w, 1)` with `w: word` | **E10171** naming parameter `a`, expected `byte`, found `word`; strict same-type | AR-5 |
| ST-08 | `let x: byte = 1; x();` | **E10175** NotCallable | Ch 06 §4.2 (spec table); AR-9 |
| ST-09 | call to an undeclared name `nope();` | **E10100** (existing wording), poison, no cascade | AR-5; R114 |
| ST-10 | `interrupt function h(): void {}` called as `h();` | **E10051** CallToInterruptFunction | Ch 06 §7.3; AR-10 |
| ST-11 | `main()` called from another function | **E10023** CallingMainDirectly | Ch 10 §5.2; AR-11 |
| ST-12 | `return;` in `function f(): byte` | **E10172** MissingReturnValue | Ch 06 FN-5; AR-6 |
| ST-13 | `return w;` (`w: word`) in a `byte` function | **E10154** (narrowing) with return-context wording naming `f` | Ch 06 FN-5; AR-6 |
| ST-14 | direct recursion `f → f` | **E10174**, exactly one diagnostic, path contains `f → f` | Ch 06 FN-6; AR-7 |
| ST-15 | indirect recursion `ping → pong → ping` | **E10174**, exactly ONE diagnostic for the cycle, message carries `ping → pong → ping` | Ch 06 FN-6; AR-7 |
| ST-16 | duplicate param name `f(a: byte, a: byte)` | **E10003** on the second `a` | Ch 06 FN-8/R65; AR-8 |
| ST-17 | param shadowing module-level: `let score: word;` + `f(score: word)` | **E10101** naming both | Ch 06 FN-13; AR-8 |
| ST-18 | import of a non-exported function | **E10012** on the imported name | Ch 10 §4.3; AR-1 |
| ST-19 | valid `import { add } from Math;` then `add(…)` | resolves; call types normally; edge `caller → Math.add` recorded in `model.callGraph.edges` | Ch 10 §4; AR-1/14 |
| ST-20 | function declared AFTER its call site (same module) | resolves and types (declaration-order independence) | Ch 06 FN-7 |

### SFA wiring

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-21 | model with `f(a: byte, x: word)` + one local | `modelToFunctionInfo`: `parameters` = [a, x] in declaration order, `locals` after; frame slots params-first (offsets 0,1,3) | Ch 06 §5.2; AR-8 |
| ST-22 | `main → f`, `main → g`, `f → g` edges | `callees` projected as FQNs; interference has `f↔g` (ancestor-descendant); coloring keeps `f`/`g` frames disjoint | Ch 06 §5.2; AR-3 |
| ST-23 | `main → f(1, g())`, `g → h`, `h` sibling of `f` | `f.argWindowInterferes` ⊇ reach(g) = {g, h}; `f`/`h` frames disjoint in the plan | AR-3 |
| ST-24 | recursive program reaching the frontend driver | `planAllocation` NOT invoked (model poisoned by E10174 first); no plan, no binary | AR-7 |

### Codegen

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-25 | IL for `r1 = add(x, 7)` | store of `x`'s value to `__frame_Math_add_a`, store `#7` to `__frame_Math_add_b` (that order), then `call Math.add` with a dest temp, then the store to `__var_Main_r1` — IL printer golden | Ch 06 §5.4/§6.1; AR-3 |
| ST-26 | ASM for the same | caller sequence `STA __frame_Math_add_a` … `STA __frame_Math_add_b` … `JSR Math_add` … result-store from A (byte) | Ch 06 §6.1; AR-3 |
| ST-27 | word round-trip `r2 = triple(300)` | two-byte arg store to `__frame_Math_triple_v(+1)`; `JSR Math_triple`; result consumed from A(lo)/X(hi) | Ch 06 §6.2; AR-3 |
| ST-28 | `f(1, g())` where `g` transitively calls `f` | lowering ICE (E9xxxx band), message names the callee-in-own-argument shape; NO binary | AR-3 |
| ST-29 | `f() + g()` | translate ICE (E9xxxx band), "value live across a call" message; NO binary | AR-4 |
| ST-30 | `f(g(1), 2)` — nested call in the FIRST argument only | compiles clean (guards not over-broad); correct value | AR-3 |

### Acceptance (three-part bar)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-31 | `examples/slice5a/` (both files) through `build()` + real ACME | assemble-clean, loadable PRG, zero undefined symbols | RD-18 bar; AR-16 |
| ST-32 | `emitAsmSlice5a()` | byte-exact against `slice5a.asm.golden` | RD-18 bar |
| ST-33 | real VICE run | `$C000==$11`, `$C001==$84`, `$C002==$03`, `$C003==$10` | AR-16; 03-04 derivation |
| ST-34 | prior goldens after all 5a work | gate/slice3a/3b/4a/4b byte-exact (no regression beyond the Phase-0 re-mint) | RD-18 bar |

> **⚠️ AUTHORING RULE:** every expectation above derives from the spec chapters, RD-18, or
> an AR entry — never from implementation output. If an executor cannot determine an
> expected value from these sources, that is a new ambiguity → register → user.

## Test Categories

### Specification Tests (from ST-cases above)

| Test File | ST Cases | Component |
|-----------|----------|-----------|
| `packages/core/src/report/overlap-check.spec.test.ts` (or the checkBinaryBudget suite) | ST-02, ST-03 | overlap guard |
| `packages/test-harness/src/golden-*.spec.test.ts` (re-minted) + `packages/test-harness/src/*.spec.test.ts` | ST-01, ST-04 | Phase 0 |
| `packages/frontend/src/semantics/type-check/call-typing.spec.test.ts` | ST-05..ST-11, ST-20 | call typing |
| `packages/frontend/src/semantics/type-check/return-completion.spec.test.ts` | ST-12, ST-13 | returns |
| `packages/frontend/src/semantics/recursion.spec.test.ts` | ST-14, ST-15, ST-24 | call graph |
| `packages/frontend/src/semantics/param-collection.spec.test.ts` | ST-16, ST-17 | params |
| `packages/frontend/src/semantics/import-resolution.spec.test.ts` | ST-18, ST-19 | imports |
| `packages/frontend/src/sfa/adapter-params.spec.test.ts` (or extend the model-adapter suite) | ST-21..ST-23 | SFA wiring |
| `packages/codegen/src/il/lower-call.spec.test.ts` | ST-25, ST-28, ST-30 | lowering |
| `packages/codegen/src/instr/translate-call.spec.test.ts` | ST-26, ST-27, ST-29 | translate |
| `packages/test-harness/src/golden-slice5a.spec.test.ts` + `slice5a.spec.test.ts` | ST-31..ST-34 | acceptance |

(Exact filenames may fold into existing suites per package convention; the ST→file mapping
in the execution plan's task lines is binding.)

### Implementation Tests (after green)

| Test File | Description | Priority |
|-----------|-------------|----------|
| call-typing/impl | signature cache reuse, poison-cascade internals, void-result-consumed path | High |
| recursion/impl | Tarjan determinism (anchor = first-declared), self-loop vs SCC, diamond graphs | High |
| adapter/impl | FrameVar ordering, `argWindowInterferes` dedup/sort, reach() on diamonds AND cyclic input (visited-set bound, must terminate — PF-002) | Med |
| translate-call/impl | register mirror cleared after JSR, `sanitize` labels for multi-module names, remaining-use map internals (separate from `useCount`, per-occurrence decrement — PF-001) | Med |
| import/impl | user-module-name shadowing a platform id (AR-14 edge), duplicate import E10003, duplicate module name across files → unsupported ICE (PF-005) | Med |

### Integration / E2E

| Test | Components | Description |
|------|-----------|-------------|
| slice5a assemble-clean | compiler `build()` + ACME | ST-31 |
| slice5a VICE runtime | test-harness `setupEmulator` | ST-33, `skipIf(!(hasVice && hasAcme))`, `fileParallelism:false` tier |
| golden regression | emitAsm + assertGolden | ST-32, ST-34 (CI) |

## Test Data

- Fixtures: `examples/slice5a/{main,math}.blend` (inlined verbatim in
  `testing/slice5a.ts`); negative/guard sources inline in their spec files (03-04 §2/§3
  tables own the shapes).
- Mocks: none — real compiler pipeline, real ACME/VICE at the local tier (repo standard).

## Verification Checklist

- [ ] All ST cases defined with concrete input/output pairs (above)
- [ ] Every ST case traces to a spec chapter, RD-18, or an AR entry
- [ ] Spec tests written BEFORE implementation, verified RED, then GREEN — per phase
- [ ] Impl tests after green; full verify (`00-index.md` command) at each phase end
- [ ] No regressions: all prior slice goldens + suites green throughout
