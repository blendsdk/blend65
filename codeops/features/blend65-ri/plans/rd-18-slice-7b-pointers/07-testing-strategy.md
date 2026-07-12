# Testing Strategy: RD-18 Slice 7b — Pointer surface

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Semantics (param typing, const rules, tiers) | 90% |
| SFA pair coloring / scratch predicate | 90% |
| Lowering + translate framings | 90% |
| Fixture/harness glue | 60% |

- Repo conventions: `*.spec.test.ts` (immutable oracle) / `*.impl.test.ts`; emulator suites
  `skipIf(!hasVice()/!hasAcme())`, sequential locally; goldens minted only after VICE proof.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from the frozen spec chapters (Ch 06/07/08/11), RD-18, and the
> Ambiguity Register. IMMUTABLE ORACLE RULE: a failing spec test means the implementation is
> wrong, never the test. In-code traceability comments quote behavior in plain language —
> never ST/AR ids or plan paths.

### Parser & AST (03-01)

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-1 | `function f(p: const byte[4]): void {}` | parses; param `isConst: true`, `ArrayType` size 4 | CP-1 / AR-6 |
| ST-2 | `function f(p: const Enemy, q: word): void {}` | `p.isConst` true, `q.isConst` false | CP-1 / AR-6 |
| ST-3 | `function f(d: byte[]): void {}` | parses; `ArrayTypeNode.size === null` | Ch 08 §8.2 / AR-5 |
| ST-4 | `let x: const byte = 1;` | E10303 at `const` (unchanged non-param behavior) | AR-6 |
| ST-5 | AST corpus with const + unsized params | node-kind count still 51; printer round-trips `const` | AR-6 |

### Param typing & const rules (03-02)

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-6 | struct param declared; callee writes `e.hp = 0` | compiles (by-ref, mutable) — no E90001 anywhere | FN-3 / AR-1 |
| ST-7 | `let big: byte[300];` declared | compiles WITH W10142; type constructs (no E90001) | Ch 08 AR-3 / AR-1/AR-9 |
| ST-8 | CP-2 matrix: `let` arg → mutable param | OK | CP-2 |
| ST-9 | CP-2: `let` arg → const param | OK (safe direction) | CP-2 |
| ST-10 | CP-2: const aggregate arg → MUTABLE by-ref param | **E10122** | CP-2 / AR-6 |
| ST-11 | CP-2: const aggregate arg → const param | OK | CP-2 |
| ST-12 | const PARAM forwarded to a mutable by-ref param | **E10122** (CP-5 propagation) | CP-5 / AR-6 |
| ST-13 | `e.hp = 0` where `e` is const param | **E10123** | CP-3 / AR-6 |
| ST-14 | nested `e.pos.x = 1` and `t[0] = 1` and `t[i] += 1` through const params | **E10123** each (chain + compound) | CP-5 / AR-6 |
| ST-15 | const SCALAR param written | **E10123**; reading it is OK | AR-6 |
| ST-16 | word index on `byte[100]` (var or sized param) | **E10117** | Ch 08 AR-3 |
| ST-17 | byte index on `byte[300]` (var or sized param) | **E10118** (now emittable) | Ch 08 AR-3 / AR-9 |
| ST-18 | word index on `byte[300]`; byte AND word index on unsized param | all OK | AR-5 |
| ST-18a | literal index on tier-2 (`big[4]`, `big[260]`) | OK — the contextual hint follows the tier (no cast) | 03-02 §Index / AR-9 |
| ST-19 | `word[128]` byte-indexed OK (256 B tier-1); `word[129]` needs word index | boundary per Ch 08 AR-3 | Ch 08 AR-3 |
| ST-20 | `sum(small10, …)` where param is `byte[40]` | **E10171** size mismatch | Ch 08 §8.1 / AR-9 |
| ST-21 | `byte[N]` arg → `byte[]` param, several N; `word[N]` → `word[]` | OK; `sbyte[N]` → `byte[]` rejects E10171 | AR-5 |
| ST-22 | `length(sizedParam)` in const position | folds to the declared count | Ch 08 §9 |
| ST-23 | `length(unsizedParam)` | **E10080** with explicit-length remedy | Ch 08 §9 / AR-10 |
| ST-24 | same root symbol as two by-ref args in ONE call | **W10112** once, compiles | Ch 07 §4.7 / AR-8 |
| ST-24a | array ≥25% of platform RAM declared | **W10143** (+W10142); 300 B on c64 → W10142 only | AR-11 |
| ST-24b | aggregate ARG that is `enemies[i]` (runtime index) or `p.field` (pair-relative) | loud ICE via `emitIl`, precise wording | AR-3 |

### SFA pointers (03-03)

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-25 | one function, one accessed by-ref param | `__zp_ptr_<fq>_<param>` symbol def exists; 2 bytes, pointer category | Ch 11 §4.2 / AR-2 |
| ST-26 | sequential callees `f(s); g(s);` each one accessed param | pairs SHARE an address (2 pointer bytes total) | Ch 11 §4.3 |
| ST-27 | nested `f→g→h` all with accessed params | 6 pointer bytes (disjoint) | Ch 11 §4.3 |
| ST-28 | pass-through-only param; dead param | NO pair symbol, NO prologue for them | AR-2 |
| ST-29 | program with by-ref params OR a >256 B array/const aggregate | `__zp_ptr_scratch` reserved | AR-4 |
| ST-30 | `const TABLE: byte[300]` only (no by-ref, no big vars) | scratch STILL reserved (challenger case) | AR-4 |
| ST-31 | pointer-free program (any prior-slice fixture) | ZP allocations byte-identical to 7a output | AR-4 |
| ST-32 | ZP-budget-busting pair demand | **E10032** once, no partial garbage | Ch 11 §4.4 |
| ST-33 | by-ref param frame slot | 2 bytes in the frame (spec accounting) | Ch 11 §3.3 |

### Lowering (03-04)

| # | Input / Scenario | Expected IL (via `emitIl`) | Source |
|---|------------------|----------------------------|--------|
| ST-34 | `f(boss)` whole-var arg | `store(addr __var_…_boss → __frame_<f>_<param>)` before bare `call` | FN-3 / AR-2/AR-12 |
| ST-35 | `f(enemies[3])` const-indexed arg; `f(Mod.v)`; `f(TABLE)` const aggregate | addr store with folded offset / module symbol / `__data_*` label | AR-3 |
| ST-36 | `relay(e)` pass-through | word copy frame→frame; NO pair read | AR-2/AR-3 |
| ST-37 | accessed by-ref param | entry block starts with the two byte frame→pair copies | AR-2 |
| ST-38 | `e.hp` read / `e.pos.y = v` through param | `load_indirect`/`store_indirect` with `ptr: loc(pair)`, `offset: imm(field)` | FN-3 / AR-7 |
| ST-39 | `data[i]` byte index through unsized param | `offset` carries the scaled byte operand; no scratch | AR-5 |
| ST-45 | `big[i]` word index (tier-2) | the §5 formation: addr-seed → word add → `load_indirect(ptr: scratch, offset: imm(0))` | Ch 08 §10.3 / AR-4 |
| ST-46 | `p = q` both by-ref struct params | per-byte indirect copy, both pairs | R37 / AR-1 |
| ST-47 | word-index compound assign through pair; struct field at offset >255 | scratch-add path; no LDY >255 ever | AR-7 |

### Translate (03-05)

| # | Input / Scenario (constructed IL) | Expected instr text | Source |
|---|-----------------------------------|---------------------|--------|
| ST-48 | byte `load_indirect(v, pair, imm 2)` folded to store | `LDY #$02 / LDA (pair),Y / STA home` | Ch 07 §5.2 / AR-2 |
| ST-49 | byte `store_indirect` value-in-A fast path | no reload; `LDY / STA (pair),Y` | AR-2 |
| ST-50 | word load/store indirect via memory home | `LDA/STA (pair),Y`, `INY`, second pair; regY cleared after | AR-2 |
| ST-51 | word indirect store from register-resident value | loud ICE (assign-to-variable wording) | AR-2 |
| ST-52 | `addr` store to absolute + to ZP pair targets | `LDA #<sym / STA … / LDA #>sym / STA …+1` | AR-12 |
| ST-53 | `addr` operand injected into an ALU op | ICE via exhaustiveness | AR-12 |
| ST-54 | two same-offset accesses, no Y clobber between | ONE `LDY` (mirror reuse); INY/copy-loop invalidates | AR-2 |
| ST-55 | staging demanded, plan lacks scratch symbol | loud backstop ICE | AR-4 |
| ST-56 | `JSR` between pair accesses | regY (and A/X) mirrors cleared | AR-2 |
| ST-57 | non-location `ptr` operand | ICE (lowering contract) | AR-2 |
| ST-58 | prior-slice IL corpora | zero emission changes (golden safety at instr level) | AR-4 |

### Acceptance (03-06)

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-59 | `examples/slice7b/` through real ACME | loadable PRG, zero undefined symbols (incl. `__zp_ptr_*`) | RD-18 bar (a) |
| ST-60 | `emitAsm` vs committed golden | byte-exact + landmarks (`__zp_ptr_` defs, `),Y`, `#<`, prologue) | RD-18 bar (b) |
| ST-61 | real VICE 3.10 run | the full `$C000..$C006` byte contract of 03-06 | RD-18 bar (c) / AR-13 |
| ST-62 | negatives via `compile()` | E10122, E10123 (direct/nested/compound), E10117, E10118, E10171, E10080-length, E10032 | AR-6/9/10 |
| ST-63 | the two AR-3 ICE shapes via `emitIl` | loud, precise, never silent | AR-3 |
| ST-64 | advisories | W10112 + W10142 compile-WITH-warning; W10143 platform case | AR-8/9/11 |
| ST-65 | all eight prior slice goldens | byte-exact, unchanged | AR-4 |
| ST-66 | 7a negative suite re-run | unchanged (no regression from retiring the two E90001s — every deferred form still loud) | AR-1 |

> **⚠️ AUTHORING RULE:** expectations above derive from the spec chapters and the register.
> If an expected output cannot be determined from them at execution time, STOP — new AR row.

## Test Categories

### Specification Tests (files)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `frontend/src/parser/param-const-unsized.spec.test.ts` | ST-1..5 | 03-01 |
| `frontend/src/semantics/param-typing.spec.test.ts` | ST-6..24b | 03-02 |
| `frontend/src/sfa/pointer-pairs.spec.test.ts` | ST-25..33 | 03-03 |
| `codegen/src/il/lower-indirect.spec.test.ts` | ST-34..47 | 03-04 |
| `codegen/src/instr/translate-indirect.spec.test.ts` | ST-48..58 | 03-05 |
| `test-harness/src/slice7b.spec.test.ts` (+golden, +negatives) | ST-59..66 | 03-06 |

### Implementation Tests (after green)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `param-typing.impl.test.ts` | root-walk internals, signature resolution edges, unsized never escaping params | High |
| `pointer-pairs.impl.test.ts` | chain-max coloring ≤ peak on adversarial graphs; determinism | High |
| `lower-indirect.impl.test.ts` | place classification tables; formation determinism | Med |
| `translate-indirect.impl.test.ts` | mirror state machine; protectA/offsetIntoY interplay | High |

### Integration / E2E

| Scenario | Steps | Expected |
| -------- | ----- | -------- |
| Full pipeline | `build()` on the fixture with real ACME | PRG + report deltas (pointer ZP bytes visible in ResourceReport) |
| VICE | RD-12 harness | ST-61 contract |

## Test Data

- Fixtures: `examples/slice7b/{game,main}.blend` (03-06). Negatives inline per suite.
- Mocks: none (real objects; ACME/VICE gated by `hasAcme`/`hasVice`).

## Verification Checklist

- [ ] Every ST row traces to spec/AR; red phase witnessed per phase; green before impl tests
- [ ] Prior goldens byte-exact at every phase boundary (not just at the end)
- [ ] `git status --porcelain spec/` empty throughout
