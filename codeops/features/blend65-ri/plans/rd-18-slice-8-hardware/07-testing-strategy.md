# Testing Strategy: RD-18 Slice 8a — Hardware

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Semantic checks, SFA classification, lowering (core logic) | 90% |
| Translate/emitter additions, projection glue | 80% |
| Harness/fixture glue | 60% |

- Test names state behavior: `should [expected behavior] when [condition]`.
- Tiers per house convention: `*.spec.test.ts` (spec/acceptance, from the ST-cases below,
  written FIRST) and `*.impl.test.ts` (internals, written after green). Slice acceptance =
  the `slice8*` trio in `packages/test-harness/src/` (03-06). Emulator tier local-only
  (AR-27); everything else runs in CI.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from RD-18, the frozen spec chapters cited per component doc, and the
> Ambiguity Register. IMMUTABLE ORACLE: a failing spec test means the implementation is wrong.
> In-code traceability comments quote the behavior in plain language — never ST/AR ids or
> planning-folder paths.

### Address-of (03-01)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `let m: byte; let a: word = &m;` (module var; also local-var and zeropage-var variants) | types `word`, compiles; ASM materializes the operand's symbol address (`#<`/`#>` pattern) | Ch 04 §8; AR-10 |
| ST-2 | `pokew($FFFE, &onIRQ)` where `onIRQ` is an interrupt fn | compiles; the words stored are the handler's entry-label address | Ch 04 §8; AR-11/16 |
| ST-3 | `&someFunction` (plain fn) assigned to a `word` | compiles; function marked address-taken (`isEscaped` true in the projection) | Ch 06 FN-12/§8; AR-11 |
| ST-4 | `&Math.fn` (exported fn, qualified) from another module | compiles; same label address as `&fn` in-module; the 5b value-position ICE no longer fires for the `&`-wrapped form | AR-11 |
| ST-5 | `const K: byte = 5; … &K` | **E10047**, no binary | Ch 04 §8 (const scalar has no address); AR-10 |
| ST-6 | `function f(p: byte): void { let w: word = &p; }` | **E10048**, no binary | Ch 04 §8/FUT-002; AR-10 |
| ST-7 | `&arr[1]` and `&s.field` | **E10042**, no binary | FUT-001; AR-10 |
| ST-8 | `&42`, `&(x + y)` | **E10049**, no binary | Ch 04 §8; AR-10 |
| ST-9 | `let w: word = &m + 2;` (addr in ALU position) | compiles; address homed per the placement discipline, result = address+2 | AR-11; 03-01 §Lowering |
| ST-10 | `&constArray` (const aggregate) | types `word`; materializes the data-section label | Ch 04 §8; AR-10 |
| ST-10b | by-ref call `f(enemies[i])` (runtime index) and `g(p.field)` (`p` by-ref param) | compile; address formed through the scratch pair into the callee frame home; the two former ICE pins now assert success (retired-row rewrite) | AR-29 |

### Interrupt functions (03-02)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-11 | `interrupt function h() { }` (bare) | parses; collected as interrupt kind | Ch 06 §7.2; AR-12 |
| ST-12 | `interrupt function h(): void { }` | parses identically (annotation consumed) | Ch 06 §7.2; AR-12 |
| ST-13 | `interrupt function h(): word { }` | **E10050** on the annotation; block still parsed | Ch 06 §7.2; AR-12/14 |
| ST-14 | ASM of a handler with a body | label, then `PHA/TXA/PHA/TYA/PHA`, body, `PLA/TAY/PLA/TAX/PLA/RTI` | Ch 06 §7.3; AR-14 |
| ST-15 | handler with an early `return;` | EVERY exit path carries the full restore+RTI | Ch 06 §7.3; AR-14 |
| ST-16 | `h();` (direct call) / `export interrupt` | **E10051** / **E10311** (re-pins) | Ch 06 §7.2; AR-13/14 |

### SFA interrupt path (03-03)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-17 | handler H calls helper G; main calls unrelated F | G's frame does NOT overlap F's (interference edge present; distinct addresses in the plan) | Ch 06 §7.4; AR-15 |
| ST-18 | fn S called from BOTH main and H | S keeps ONE frame home (documented hazard, no diagnostic, compiles) | Ch 06 §7.4; AR-15 |
| ST-19 | two handlers H1, H2 with helpers | the two subtrees' frames mutually disjoint | AR-15 (NMI/IRQ nesting) |
| ST-20 | irq-only fn needing a spill | spill slot named `__zp_irq_tmp_*`, not `__zp_tmp_*` | Ch 06 §7.6; AR-15 |
| ST-21 | mainline fn spill in the same program | stays `__zp_tmp_*` (pool separation both ways) | Ch 06 §7.6; AR-15 |
| ST-22 | irq-reachable code performing runtime pointer formation | `__zp_irq_ptr_scratch` reserved + used; mainline formation still uses `__zp_ptr_scratch` | AR-15 |
| ST-23 | program with NO interrupts (a prior-slice fixture) | classification empty; allocation plan identical (goldens byte-exact) | AR-15; 01-req AC-5 |
| ST-24 | by-ref param on an irq-only fn | its `__zp_ptr_*` pair not shared with any mainline pair | Ch 11 §4; AR-15 |

### Zeropage blocks (03-04)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-25 | `zeropage { count: byte; }` | symbol `__zp_Main_count` equated inside the platform ZP range, 2-digit equate; reads/writes address it | Ch 03 §2.3; AR-18 |
| ST-26 | two blocks, same module, two files | merged; both vars placed | AR-17 |
| ST-27 | ZP name colliding with a module `let` (either order) | **E10003** | Ch 03; AR-17 |
| ST-28 | `zeropage { c: byte = 7; }` | startup (`__init`) writes 7 to the ZP address; VICE-observable | Ch 03 ZP-4; AR-18 |
| ST-29 | uninitialized ZP var | NO init code, NO data-image bytes for it | Ch 03 ZP-4; AR-18 |
| ST-30 | ZP demand > platform budget | **E10032** once; W10030 at ≥75% (separate case) | Ch 11 §4; AR-18 |
| ST-31 | `zeropage { pos: byte[4]; }` + indexed access | compiles; addressed via the ZP symbol (existing framings) | AR-18 |
| ST-32 | `&count` (ZP var) | `word` = the ZP address | Ch 04 §8; AR-10/18 |
| ST-33 | `zeropage { msg: byte[6] = "HELLO"; }` | the existing LOUD string-init rejection (no silent poison) | AR-18 boundary pin |
| ST-33b | non-const / call-bearing ZP initializer | the existing 5b module-init rejection set | AR-18 |

### Startup termination (03-05)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-34 | `main` ending in `while (true) { … }`, `startup:"auto"` | shim = `JMP _main`; no restore/RTS tail | F004; AR-25 |
| ST-35 | returning `main`, `startup:"auto"` | shim = `JSR _main` + restore + RTS (today's bytes) | F004; AR-25 |
| ST-36 | `while (flag)` with non-literal condition, never actually exits | shim = terminating (conservative — analysis must not guess) | AR-25 |
| ST-37 | `--startup terminating` on a `while(true)` main | override wins: terminating shim | AR-25 |
| ST-38 | prior-slice fixtures (all return) | goldens byte-exact | AR-25; 01-req AC-5 |

### Acceptance (03-06)

| # | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-39 | `examples/slice8/` via `build()` | assembles through real ACME to a loadable PRG, zero undefined symbols | RD-18 bar (a) |
| ST-40 | `emitAsm` of the fixture | byte-exact committed golden; landmarks: save/RTI sequence, `JMP _main`, `__zp_Main_frameCount` 2-digit equate | RD-18 bar (b); AR-16 |
| ST-41 | fixture on real VICE 3.10, `runFrames(N)` | ZP counter (and RAM mirror) ≥ saturation threshold | RD-18 bar (c); AR-16 |
| ST-42 | same run | `$D020 & $0F` ≠ boot border color | AR-16 |
| ST-43 | all 13 T1 `asm_*` | each translates to exactly its opcode | AR-26 |
| ST-44 | ten prior goldens | byte-exact, no re-mint | 01-req AC-5 |
| ST-45 | negatives matrix (03-06 table) | each diagnostic, no binary | AR-10/12/13/14/18 |
| ST-46 | `git status --porcelain spec/` after all work | empty | D3 |

> **⚠️ AUTHORING RULE:** expectations above derive from the spec/RD/register only. Any
> expected output that cannot be pinned from those sources during spec-test authoring is a NEW
> ambiguity — stop and gate it (surface-during-authoring rule).

## Test Categories

### Specification Tests (files)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/frontend/src/semantics/type-check/address-of.spec.test.ts` | ST-1..ST-8, ST-10 | 03-01 typing |
| `packages/codegen/src/il/lower-address-of.spec.test.ts` | ST-9, ST-10b (+ the ST-40 rewrite in `lower-indirect.spec.test.ts`) | 03-01 lowering |
| `packages/frontend/src/parser/interrupt-syntax.spec.test.ts` | ST-11..ST-13 | 03-02 parser |
| `packages/codegen/src/instr/translate-interrupt.spec.test.ts` | ST-14, ST-15 | 03-02 ABI |
| `packages/frontend/src/sfa/irq-interference.spec.test.ts` | ST-17..ST-19, ST-23, ST-24 | 03-03 |
| `packages/codegen/src/instr/irq-temp-pool.spec.test.ts` | ST-20..ST-22 | 03-03 |
| `packages/frontend/src/semantics/zeropage.spec.test.ts` | ST-25..ST-30, ST-33, ST-33b | 03-04 semantics |
| `packages/codegen/src/il/lower-zeropage.spec.test.ts` | ST-31, ST-32 | 03-04 lowering |
| `packages/codegen/src/instr/shim-selection.spec.test.ts` | ST-34..ST-37 | 03-05 |
| `packages/test-harness/src/testing/slice8*.spec.test.ts` (trio) | ST-16, ST-38..ST-46 | 03-06 |

### Implementation Tests

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `*.impl.test.ts` beside each touched module | classification internals (BFS edge cases: cycles through both paths, interrupt-calls-interrupt via E10051 unreachable), binder pool sizing, projection ordering determinism, analysis walker on odd CFGs | High |

### Integration / End-to-End

The `slice8` harness trio IS the integration+E2E tier (build → ACME → PRG → VICE), per every
prior slice. No separate mocks — real `build()`, real ACME, real VICE (local).

## Test Data

- Fixtures: `examples/slice8/main.blend` (03-06 shape); small inline sources per spec file.
- Mocks: none (house rule — real objects; the emulator/ACME gates via `skipIf`).

## Verification Checklist

- [ ] All ST-cases defined with concrete input/output pairs — each traces to spec/RD/AR
- [ ] Spec tests written BEFORE implementation, verified RED, then GREEN after
- [ ] Impl tests after green; full verify (AR-27 command) per phase
- [ ] No regressions: ten prior goldens byte-exact; boundary tier green
