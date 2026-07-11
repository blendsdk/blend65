# Testing Strategy: RD-18 Slice 7a — Aggregates

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

| Code type | Target |
|-----------|--------|
| Semantic engine (tables, const engine, typing) | 90% |
| Lowering / translate arms | 90% |
| Parser additions | 90% |
| Harness/fixture glue | 60% |

Test names state behavior (`should … when …`). Spec tier `*.spec.test.ts` per package +
the repo-root boundary tier untouched. Snippets below are module-wrapped (`module Main;` +
`function main(): void` where an expression context is implied) by the test helpers.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from `spec/` chapters 07/08/09 (+02/04/12), the ledger rows cited in
> 01-requirements, and the Ambiguity Register. IMMUTABLE ORACLE RULE: a failing spec test means
> the implementation is wrong, never the test. In-code traceability comments quote the behavior
> in plain language, never ST/AR ids or plan paths.

### Parser — array literals (03-01)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | `let a: byte[3] = [1, 2, 3];` | parses; ArrayLit with 3 elements, fill null | AR-2; 08 §4.2 |
| ST-2 | `let a: byte[5] = [1, 2, 3; 0];` | parses; elements [1,2,3], fill 0 | AR-3; 08 §4.1 |
| ST-3 | `let a: byte[8] = [; $FF];` | parses; 0 elements, fill $FF | 08 §4.1 |
| ST-4 | `let a: byte[2] = [1, 2,];` (trailing comma) | parses; 2 elements | AR-2; grammar §6.7 |
| ST-5 | `a = [1, 2];` (assignment RHS) and `p = Point { x: 1, y: 2 };` | both parse | AR-18 |
| ST-6 | `let a: byte[2] = [1, 2;` (unclosed) | E10308; ErrorExpr recovery, parsing continues | AR-2 |
| ST-6a | `const T: byte[3] = [1, 2, 3];` | parses (const initialisers take aggregate literals — the PF-001 flag fix) | AR-18 (amended); grammar `const_expression` |
| ST-6b | `const P: Point = Point { x: 1, y: 2 };` | parses (same fix, struct-literal form) | AR-18 (amended); 07 §4.2 |

### Declarations, tables & Pass 2 (03-02)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-7 | module A `struct Point {x: byte;}` + module B `struct Point {x: word; y: word;}`, both used | compiles; `sizeof` 1 vs 4 — no collision | AR-7 (defect) |
| ST-8 | same module, two files, both `struct Foo` | E10003 | AR-7; ledger R68 |
| ST-9 | `struct S { x: byte; }` + `let S: byte;` same module | E10003 | AR-24 |
| ST-10 | `struct A { b: B; } struct B { a: A; }` | ONE E10165, message path `A → B → A` | AR-5, AR-23; SR-7 |
| ST-11 | `struct S { s: S; }` | ONE E10165 (1-cycle) | AR-5; SR-6 |
| ST-12 | `struct S { v: void; }` / `let a: void[2];` | E10156 each | AR-21; R35 |
| ST-13 | `enum E { A = x }` (x a let) | E10230 | AR-13; EN-3 |
| ST-14 | `enum E { A = 255, B }` | E10143 | AR-13; EN-6 |
| ST-15 | `enum E { OK = 0, READY = 0 }` | compiles clean (aliases legal; E10142 never fires) | AR-4; EN-5 |
| ST-16 | `let a: Unknown[2];` / `let p: Gfx.Hidden;` (non-exported) | E10151 / E10012 | 03-02 §4; AR-7 |

### Const engine (03-03)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-17 | `const N: byte = 3; let a: byte[N * 2 + 2];` | array sized 8 | AR-6; R89/R101 |
| ST-18 | `struct P {x: byte; y: word;} let a: byte[sizeof(P)];` | sized 3 (packed, no padding) | SR-2; TS-21 |
| ST-19 | declaration order reversed (const AFTER the array using it) | identical result to ST-17 | AR-6; 5b precedent |
| ST-20 | `const N: byte = sizeof(S); struct S { a: byte[N]; }` | ONE E10194 with path incl. both nodes | AR-23 |
| ST-21 | `let a: byte[0];` / `let a: byte[n];` (runtime n) | E10111 / E10110 | R101 |
| ST-22 | `const T: byte[4] = [1, 2];` | E10113 | R103; AR-11 |
| ST-23 | `const T: byte[2] = [1, x];` (x a let) | E10193 | AR-11; R91 |
| ST-24 | `const W: word[2] = [$1234, 5];` image | bytes `34 12 05 00` (little-endian) | 08 §2.2; AR-13 |
| ST-25 | `length(TABLE)` on `const TABLE: byte[6]`, `offsetof(Point,y)`, `sizeof(Direction)` in const inits | fold to 6 / 1 / 1; usable as array sizes | R60; 08 §9; 12 §3.3 |
| ST-26 | `let n: byte = length(a);` (10-elem array) | compiles — result typed byte (value-dependent) | AR-16; TS-21 |
| ST-26a | `length(b)` on `b: byte[255]` | folds to 255, typed byte (boundary: still representable) | AR-25 |
| ST-26b | `length(b)` on `b: byte[256]` (legal tier-1), then `let n: byte = length(b);` | folds to 256, typed **word** (representability rule); the byte assignment → E10154 (narrowing needs a cast) | AR-25; TS-21 shape |

### Aggregate typing (03-04)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-27 | `a[i]` where `a: byte[10]`, `i: byte` | element type byte; l-value writable | R57 |
| ST-28 | `a[w]` where `w: word`, a tier-1 array | E10117 (message suggests `<byte>(w)`) | AR-14 |
| ST-29 | `a[s]` where `s: sbyte` / `a[true]` | E10114 each | R104 |
| ST-30 | `a[12]` on `byte[10]` | E10115 ("Index 12 … size 10") | R105 |
| ST-31 | `x[0]` where `x: byte` / `x.f` where `x: word` | E10080 each | AR-22 |
| ST-32 | `let big: byte[300];` | loud 7a-unsupported rejection (tier 2 → 7b), not silence | AR-1 |
| ST-33 | `player.pos.x = 5;` (nested struct) | compiles; typeMap stamps every link | R56; AC-14 |
| ST-34 | `p.hp` unknown field | E10160 | R56 |
| ST-35 | `Point { y: 2, x: 1 }` (wrong order) | E10097 (Ch 07's own code — AR-9 as amended) | AR-9; 07 §4.2 |
| ST-36 | `Point { x: 1 }` (missing y) / `Point { x:1, y:2, z:3 }` | E10161 / E10162 | R62 |
| ST-37 | `let a: byte[3] = [1,2,3,4];` | E10152 (count exceeds size) | AR-22 |
| ST-38 | `let a: byte[] = [1; 0];` | E10126 (fill needs explicit size) | AR-21 |
| ST-39 | `arr1 = arr2;` / `arr1 == arr2` | E10119 / E10121 | AR-13; 08 AR-5/6 |
| ST-40 | `s1 = s2;` same struct type, then `s1 == s2` | assign OK (copy); compare E10080 | R37/R38 |
| ST-41 | `let d: Direction = 0;` / `let b: byte = d;` | E10152 / OK (implicit enum→byte only) | EN-8/EN-9 |
| ST-42 | `<word>(d)` / `<Direction>(9)` / `<DirA>(dirB)` | OK / OK unchecked / E10155 | AR-12; EN-10 |
| ST-43 | `d1 == d2` different enums / `d < Direction.LEFT` same enum | E10080 / OK | EN-11; R50 |
| ST-44 | `function f(): Point` / `(): byte[2]` / `f(p: Point)` | E10093 / E10120 / loud 7a param rejection | AR-1; SR-4/AR-7(ch08) |
| ST-44a | `Point { x: 1, y: 2 };` as a bare statement | E10157 (only calls are valid expression statements) | AR-26; grammar §5.4 |
| ST-44b | `let a: byte[10] = "HELLO";` | loud unsupported-until-Slice-8 rejection — never silent poison | AR-2/AR-26; 08 §4 |

### Switch-on-enum & warnings (03-04)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-45 | `switch (d)` with `case Direction.UP:` arms, no default, NOT exhaustive | compiles clean — no E10133 | AR-4; 09 §8 |
| ST-46 | `switch (d)` with `case 3:` (bare int on enum) | E10077 (first live emission) | R75; 4b deferral |
| ST-47 | `switch (b)` byte discriminant, `case Direction.DOWN:` | OK (EN-9 widening) | 03-04 §7 |
| ST-48 | `let a: byte[5] = [1, 2];` / `let a: byte[5];` | W10140 / W10141 (compile WITH warning) | AR-17 |

### Lowering & translate (03-05/03-06, via `emitIl`/`emitAsm`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-49 | `a[2] = 7;` const index | plain `store` at `loc(sym, +2)` — NO load_indexed, no scaling | AR-15 |
| ST-50 | `a[i]` runtime byte index, byte elements | `load_indexed(base=loc(sym), index=i-temp)` in IL | AR-15; RD-06 R23 |
| ST-51 | `pts[i].x` word-sized elements (struct Point 2 B) | IL tier: index temp = `i×2` emitted through the `mul` path (strength reduction is translate's business — ST-51a); then load_indexed | AR-15 |
| ST-51a | ASM for ST-51 (2-byte element scale, power of two) | `ASL` shift sequence + **W10172** ShiftAndAddMultiply; NO `JSR __rt_mul8`, NO W10170 | PF-003; 08 §10.2; translateMul ladder |
| ST-51b | scale by a non-power-of-two element size (3-byte struct) | `JSR __rt_mul8` + **W10170** RuntimeMultiply | AR-15; PF-003 |
| ST-52 | `const TABLE…` from ST-24 | `constData` entry `__data_Main_TABLE` byte-equal to the image; module const scalars still inline | 03-05 §3 |
| ST-53 | ASM for ST-50 | `LDX`-then-`LDA <sym>,X` (AbsoluteX); result homed per 03-06 §1 obligations | RD-07 R29/R42 |
| ST-53a | ASM for `sum = sum + a[i];` (accumulate through an indexed byte read) | load result homed then consumed — correct sum, no E90001 binder death | PF-002; 03-06 §1 |
| ST-54 | ASM for word-element read | `LDA sym,X / STA lo-home / LDA sym+1,X / STA hi-home` stash pattern | 03-06 §1 |
| ST-54a | `warr[i] = f();` (word store from a live A:X source) | source stashed to home BEFORE `LDX`; never `TXA`-as-data; correct high byte stored | PF-004; 03-06 §1 |
| ST-55 | ASM data section | `__data_…` label + `!byte` rows ≤16 values; data AFTER code | 03-06 §2 |
| ST-56 | any `load_indirect` reaching translate (constructed IL) | E90001 with the 7b message | AR-1 |
| ST-57 | whole-struct copy `b = a;` (3-byte struct) | 3 load/store pairs, offsets 0/1/2 | R37; 03-05 §3 |
| ST-58 | all SEVEN prior slice goldens | byte-exact, NO re-mint | AC-3 (01-req) |

### Acceptance E2E (03-07)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-59 | `examples/slice7/` via `build()` + real ACME | loadable PRG, zero undefined symbols, hasErrors=false | RD-18 bar (a) |
| ST-60 | `emitAsmSlice7()` vs `slice7.asm.golden` | byte-exact | RD-18 bar (b) |
| ST-61 | VICE run (`skipIf(!hasVice)`) | the `$C000..$C009` band per 03-07's table | RD-18 bar (c) |
| ST-62 | negatives catalog (03-07) via `compile()` | each snippet → exactly its listed code, no binary | AR-13/21/22 |
| ST-63 | cycle negatives | E10165/E10194 messages carry full paths | AR-5/23 |
| ST-64 | cross-module `struct Point` twice (ST-7 shape) E2E | builds + runs | AR-7 |
| ST-65 | `Gfx.TABLE[i]` cross-module const read on VICE | correct table value at `$C007` | AR-7/19 |
| ST-66 | warning shapes (ST-48) via facade | compile succeeds, W-codes present in diagnostics | AR-17 |

> **⚠️ AUTHORING RULE:** expectations above derive from the spec chapters/register; if an
> expected output cannot be pinned from those sources, STOP and extend the register first.

## Test Categories

### Specification tests (files)

| Test File | ST Cases | Component |
|-----------|----------|-----------|
| `frontend/src/parser/array-literals.spec.test.ts` | ST-1..6b | 03-01 |
| `frontend/src/semantics/declaration-tables.spec.test.ts` | ST-7..9, ST-12..16 | 03-02 |
| `frontend/src/semantics/const-engine.spec.test.ts` | ST-10, ST-11, ST-17..26b | 03-03 |
| `frontend/src/semantics/aggregate-typing.spec.test.ts` | ST-27..48 (incl. 44a/44b) | 03-04 |
| `codegen/src/il/lower-aggregates.spec.test.ts` | ST-49..52 | 03-05 |
| `codegen/src/instr/translate-indexed.spec.test.ts` | ST-51a/51b, ST-53..58 (incl. 53a/54a) | 03-06 |
| `test-harness/src/slice7*.spec.test.ts` (three files) | ST-59..66 | 03-07 |

### Implementation tests
Per-component `*.impl.test.ts`: parser recovery matrix, table/FQN internals, memo/stack
hygiene + order-shuffling, chain-typing torture, `lowerPlace` matrix, framing units,
data-row formatting. Written AFTER green phase.

### Fixtures / mocks
`examples/slice7/{main,gfx}.blend` (the only new fixtures); no mocks — real ACME/VICE gated by
`hasAcme`/`hasVice` (AR-27 skip in CI).

## Verification Checklist
- [ ] Every ST above has concrete input→output and a Source
- [ ] Spec tests written BEFORE implementation; red phase witnessed per phase
- [ ] Green phase per phase; impl tests after
- [ ] Full verify green; 7 prior goldens byte-exact; `spec/` untouched
