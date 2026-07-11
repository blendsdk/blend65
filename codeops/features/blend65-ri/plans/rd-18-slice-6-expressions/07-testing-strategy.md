# Testing Strategy: RD-18 Slice 6 — Full Expressions & Mixed Width

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Typing/promotion/const-eval (core business logic) | 90% |
| Lowering/translate additions | 90% (every new op/framing has a direct test) |
| Fixture/builder glue | covered by the acceptance tiers |

- Test names state behavior (`should …`).
- Tiers: frontend unit → codegen IL (`emitIl`) → instr/ASM (golden + translate
  units) → acceptance (ACME/VICE, `skipIf`-gated per AR-27 standing).

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived EXCLUSIVELY from spec Ch 02/04, RD-18 AC-5, the 03-docs, and the
> Ambiguity Register. IMMUTABLE ORACLE: a failing spec test means the
> implementation is wrong. Every case cites its source. In-code traceability
> comments quote behavior in plain language — never ST/AR ids or plan paths.

### Typing & promotion (frontend)

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-1 | `let base: word = 1000; let a: byte = 200; let r: word = base + a;` | accepted; `r` init types `word` (zero-extend promotion) | TS-4 / AR-3 |
| ST-2 | `byteVar < sbyteVar` | E10081 | TS-5, §5.2 |
| ST-3 | `let ok: boolean = byteA < byteB;` accepted; `let n: byte = byteA < byteB;` | second → E10152 (boolean value to integer target) | TS-7 |
| ST-4 | `boolA < boolB` | E10080 (ordered comparison on boolean) | Ch 04 §5 / AR-10e |
| ST-5 | `flag && (a < b)` accepted; `count && flag` (count: byte) | second → E10080 | Ch 04 §6 |
| ST-6 | `!flag` → boolean; `!count` → E10080; `~count` → byte; `~flag` → E10080 | as listed | TS-6, Ch 04 §4/§6 |
| ST-7 | `-sbyteVar` → sbyte; `-byteVar` | second → **E10087** | TS-8 / AR-10b |
| ST-8 | `<word>(byteVar)` → word; `<byte>(wordVar)` → byte; `<sbyte>(byteVar)` → sbyte; `<boolean>(5)` → **E10086**; `<byte>(flag)` → **E10086** | as listed | TS-11/12/13 / AR-14, AR-10a |
| ST-9 | `cond ? 4 : 2` (byte context) → byte; `cond ? byteV : wordV` → word; `cond ? byteV : sbyteV` → **E10088**; `byteV ? 1 : 2` → E10134 | as listed | Ch 04 §7 / AR-10c, AR-10f |
| ST-10 | `wordScore += byteBonus` accepted; `byteVar += sbyteVar` → E10081; `byteVar += wordVar` → E10154; `CONST += 1` → E10191 | as listed | TS-17 |
| ST-11 | `byteV << 2` → byte; `wordV >> 1` → word; `byteV << sbyteAmt` → **E10083** | as listed; result type = left operand | Ch 04 §4 / AR-10d |
| ST-12 | `let w2: word = byteVar;` accepted; `let b2: byte = wordVar;` → E10154 | widening in, narrowing out | §5.3 / AR-3 |
| ST-13 | byte argument to a `word` parameter accepted; sbyte argument to `word` parameter → E10171 | widening args (supersedes the 5a strict pin) | AR-3 |
| ST-14 | `function f(): word { return byteVar; }` | accepted (return widening) | AR-3 |
| ST-15 | `sbyteA < sbyteB` | accepted, types boolean | §5.2 / AR-1 |
| ST-16 | `let r: word = byteA + byteB;` (runtime vars) | compiles + **W10160** | TS-9 / AR-4 |
| ST-17 | `let r: word = <byte>(200) + <byte>(100);` | compiles + **W10161** (wraps to 44 at byte width) | TS-9/TS-20 / AR-4 |
| ST-18 | `byteV << 9` → compiles + **W10174**; `<byte>(300)` (const operand) → compiles + **W10101** (300 → 44) | as listed | Ch 04 §4, TS-12 / AR-4 |

### Width-aware const evaluation

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-19 | `const M: byte = $FF & $0F;` | inlines as $0F (no storage symbol — 5b const machinery) | TS-18 |
| ST-20 | `const H: byte = 1 << 7;` | inlines as 128 | TS-18 |
| ST-21 | `const T: byte = <byte>($1FF);` | inlines as 255 + W10101 | TS-12 / AR-7 |
| ST-22 | `const S: sbyte = <sbyte>($FF);` → −1; `const N: sbyte = <sbyte>(-128) >> 1;` → −64 | reinterpret + arithmetic shift folds | TS-12, TS-19 / AR-7 |

### IL lowering (`emitIl` tier)

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-23 | `word`-operand comparisons through all three emission sites — a `while` condition, a `word` for-loop counter, and a `word` switch discriminant | every IL compare instruction carries the 16-bit operand type (dest stays byte) | AR-9 / AR-5 (DEF-1) |
| ST-24 | `a && bump()` value context | slot diamond: store→brcond→(rhs: call+store)→join load through a `0sc` location; the call sits ONLY in the rhs block | AR-6 / AR-8, Ch 04 §6 |
| ST-25 | `cond ? byteV : wordV` | diamond; the byte arm is widened (`zext`) before its slot store | AR-6, TS-4 |
| ST-26 | `sbyteA / sbyteB` | E90001 ICE at lowering naming signed division; nothing emitted | AR-2 |
| ST-27 | `lo(wordVar)` / `hi(wordVar)` | lower to `trunc` / a direct high-byte `load` (storage location +1) — no E10045, no ICE | Ch 04 §9.2, AC-5 |

### Translate & acceptance

| # | Input / Scenario | Expected | Source |
|---|------------------|----------|--------|
| ST-28 | `emitAsm` of the fixture | byte-exact match with `test/golden/slice6.asm.golden` | AC-5(b) |
| ST-29 | fixture ASM landmarks | `__frame_Main_main_0sc` equate present; `JSR Main_bump`; NO `__rt_` calls | AR-6 / 03-05 |
| ST-30 | full suite pre-mint | all six prior slice goldens + compiler assemble goldens byte-exact, no re-mint | plan-local AC-1 |
| ST-31 | `build()` of the fixture | loadable c64 PRG, zero error diagnostics | AC-5(a) |
| ST-32 | fixture on real VICE | `$C000..$C008 = E7 04 DA 05 07 00 01 44 00` (sentinel `$C007==$44`) | AC-5(c) / 03-05 table |
| ST-33 | negatives N1–N7 (03-05 table) via `compile()`/`emitIl` | exactly the listed code per case, no binary | 03-05 / AR-2, AR-10 |
| ST-34 | N8/N9 | compile succeeds; W10160 / W10174 present in diagnostics | AR-4 |

> **⚠️ AUTHORING RULE:** expectations above come from the spec chapters and the
> register — not from any implementation. ST-17's wrapped value (44) is TS-20
> two's-complement arithmetic; ST-32's bytes are hand-computed in 03-05.

## Test Categories

### Specification tests (files)

| Test File | ST Cases | Tier |
| --------- | -------- | ---- |
| `packages/frontend/src/semantics/type-check/expression-matrix.spec.test.ts` | ST-1…ST-15 | frontend |
| `packages/frontend/src/semantics/type-check/expression-warnings.spec.test.ts` | ST-16 + ST-18's W10174 case (Phase 1) | frontend |
| `packages/frontend/src/semantics/const-eval-widths.spec.test.ts` | ST-17, ST-18's W10101 case, ST-19…ST-22 (Phase 2 — they consume the width folds) | frontend |
| `packages/codegen/src/il/lower-expressions.spec.test.ts` | ST-23…ST-27 | codegen |
| `packages/codegen/src/instr/translate-expressions.spec.test.ts` | 03-04 framing tables (hand-built IL → streams; spec-derived from Ch 04 §5 semantics + 03-04) | codegen |
| `packages/test-harness/src/golden-slice6.spec.test.ts` | ST-28, ST-29, ST-30 | harness (CI) |
| `packages/test-harness/src/slice6.spec.test.ts` | ST-31, ST-32 | harness (local ACME/VICE) |
| `packages/test-harness/src/slice6-negatives.spec.test.ts` | ST-33, ST-34 | harness (CI) |

### Implementation tests (after implementation)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `expression-matrix.impl.test.ts` | full §5.1/§5.2 25-pair sweep per op class; literal adaptation per class; compound dispatch internals | High |
| `const-eval-widths.impl.test.ts` | `toBits`/`fromBits` boundaries; lazy short-circuit folds; ternary selected-arm; 16 cast pairs | High |
| `lower-expressions.impl.test.ts` | slot-count + slot-size parity on nested shapes; coerce quadrants; compound single-store; `__init` pseudo-frame presence/absence; switch-discriminant-with-slot-site loud-ICE witness | High |
| `translate-expressions.impl.test.ts` | exhaustive sext sweep; 4 framings × boundary quads; signed-shr sign retention; variable-shift 0/≥width; **DEF-1 witness** (word `lt` differing only in high byte) | High |

### Integration / E2E

The three harness tiers ARE the integration/E2E layer (03-05). Local suites stay
sequential (`fileParallelism: false` standing).

## Test Data

- Fixture: `examples/slice6/main.blend` (03-05 owns the source + expected table).
- Negatives: inline source strings in the negative/typing suites (5b pattern).
- No mocks — real pipeline seams (`compile`/`emitIl`/`emitAsm`/`build`) throughout.

## Verification Checklist

- [ ] Every ST above has a concrete input→output pair and a source citation
- [ ] Spec tests written BEFORE implementation, red phase documented per phase
- [ ] Green phase = fix implementation, never the test
- [ ] Impl tests cover the boundary sweeps listed
- [ ] ST-30 protected BEFORE the slice golden is minted
- [ ] Full verify green at every phase gate
