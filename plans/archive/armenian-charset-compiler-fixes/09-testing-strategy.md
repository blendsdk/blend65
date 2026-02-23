# Testing Strategy: Armenian Charset Compiler Fixes (A→L)

> **Document**: 09-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **Scope**: Comprehensive test plan for all 12 items

## Testing Overview

### Coverage Goals
- Unit tests: Every modified function has targeted tests
- Integration tests: Key workflows tested end-to-end through the pipeline
- E2E tests: armenian-charset program compiles and produces correct ASM at all optimization levels

### Test Infrastructure
- Test runner: `./compiler-test` (Vitest)
- Targeted: `./compiler-test il` / `./compiler-test codegen` / `./compiler-test optimizer`
- Full suite: `./compiler-test`

---

## Phase 1 Tests: Items A, B, C (IL Generation Correctness)

### Item A: Address-Of Word Path

#### Unit Tests (IL Generator)

| # | Test | Description | File |
|---|------|-------------|------|
| A.1 | `inferWordWidthFromExpression` recognizes `@var` | UnaryExpression with AT operator → returns true | `__tests__/il/` |
| A.2 | `inferWordWidthFromExpression` still works for identifiers | IdentifierExpression with word slot → returns true (no regression) | `__tests__/il/` |
| A.3 | `inferWordWidthFromExpression` returns false for byte ident | IdentifierExpression with byte slot → returns false | `__tests__/il/` |
| A.4 | `@dataVar + i` routes to word binary path | Verify IL output contains ADD_WORD_BYTE_SLOT, not ADD_IMM | `__tests__/il/` |
| A.5 | `generateTier3Address` no double promotion | When expression already word-width, no PROMOTE_BYTE_WORD emitted | `__tests__/il/` |

#### Integration Tests

| # | Test | Description | File |
|---|------|-------------|------|
| A.6 | peek(@dataVar + wordIndex) correct address | Full pipeline: source → IL → ASM, verify address computation | `__tests__/integration/` or `__tests__/e2e/` |
| A.7 | poke(@dataVar + wordIndex, value) correct address | Full pipeline: verify STA uses correct 16-bit address | `__tests__/integration/` |

#### Blend Source Fixtures

```js
// Fixture: address-of-word-binary.blend
module test;
@data let myData: byte[] = [1, 2, 3, 4, 5, 6, 7, 8];
export function main(): void {
  let i: word = 0;
  let val: byte = peek(@myData + i);
  poke($0400, val);
}
```

---

### Item B: For-Loop Stack Balance

#### Unit Tests (IL Generator)

| # | Test | Description | File |
|---|------|-------------|------|
| B.1 | Dynamic-bound for-loop PHA/PLA balanced | Count PUSH_A vs POP_A in IL output — must be equal | `__tests__/il/` |
| B.2 | Constant-bound for-loop no PHA/PLA | IL output for `for i = 0 to 9` has zero PUSH_A/POP_A | `__tests__/il/` |
| B.3 | Nested for-loops stack balanced | Two nested loops — each has balanced stack ops | `__tests__/il/` |

#### Integration Tests

| # | Test | Description | File |
|---|------|-------------|------|
| B.4 | For-loop in function that returns | Function with for-loop + return — ASM has balanced PHA/PLA before RTS | `__tests__/integration/` |
| B.5 | For-loop with break/continue stack safe | break inside for-loop doesn't corrupt stack | `__tests__/integration/` |

#### Blend Source Fixtures

```js
// Fixture: for-loop-stack-balance.blend
module test;
export function loopAndReturn(): byte {
  let sum: byte = 0;
  for (let i: byte = 0 to 9) {
    sum += i;
  }
  return sum;  // Must return correctly — stack must be clean
}
export function main(): void {
  let result: byte = loopAndReturn();
  poke($0400, result);
}
```

---

### Item C: Constant vs Dynamic Loop Condition Split

#### Unit Tests (IL Generator)

| # | Test | Description | File |
|---|------|-------------|------|
| C.1 | Constant-bound uses `generateForConditionConstant` | IL for `for i = 0 to 62` uses CMP_IMM, no stack ops | `__tests__/il/` |
| C.2 | Dynamic-bound uses `generateForConditionDynamic` | IL for `for i = 0 to n` uses proper dynamic comparison | `__tests__/il/` |
| C.3 | No CMP #$FF in constant-bound loops | Constant bound path never emits the 255 fallback | `__tests__/il/` |

---

## Phase 2 Tests: Item D (Type Propagation)

#### Unit Tests (Semantic Analyzer)

| # | Test | Description | File |
|---|------|-------------|------|
| D.1 | IdentifierExpression typed from symbol table | `let x: word = 0` → `x` reference has TypeKind.Word | `__tests__/semantic/` |
| D.2 | LiteralExpression byte type | `5` → TypeKind.Byte | `__tests__/semantic/` |
| D.3 | Address-of typed as word | `@myData` → TypeKind.Word | `__tests__/semantic/` |
| D.4 | BinaryExpression type widening | `byteVar + wordVar` → TypeKind.Word result | `__tests__/semantic/` |
| D.5 | UnaryExpression inherits operand type | `-byteVar` → TypeKind.Byte | `__tests__/semantic/` |
| D.6 | CallExpression typed from return type | Function returning word → call has TypeKind.Word | `__tests__/semantic/` |
| D.7 | TernaryExpression wider type | `flag ? byteVal : wordVal` → TypeKind.Word | `__tests__/semantic/` |

#### Integration Tests

| # | Test | Description | File |
|---|------|-------------|------|
| D.8 | Type info flows to IL generator | After type annotation, `getTypeInfo()` returns non-null in IL generator | `__tests__/integration/` |
| D.9 | Word binary path via type info | `@data + i` routes to word binary using getTypeInfo() instead of inferWordWidth | `__tests__/integration/` |

#### Regression Tests

| # | Test | Description | File |
|---|------|-------------|------|
| D.10 | All existing 6500+ tests pass | No regressions from adding type annotation pass | Full suite |

---

## Phase 3 Tests: Items E, F (Codegen Improvements)

### Item E: Word Index Guard

| # | Test | Description | File |
|---|------|-------------|------|
| E.1 | Word index >255 uses Tier 3 | `poke($0400 + wordVar, 32)` where wordVar is word → indirect addressing | `__tests__/il/` |
| E.2 | Byte index ≤255 still uses Tier 2 | `poke($D800 + byteVar, 1)` → X-indexed (no regression) | `__tests__/il/` |
| E.3 | clearScreen pattern 1000 positions | Full pipeline: `for i: word = 0 to 999 { poke($0400+i, 32) }` → all 1000 bytes | `__tests__/e2e/` |

### Item F: Register Preservation

| # | Test | Description | File |
|---|------|-------------|------|
| F.1 | poke(dest+i, peek(src+i)) correct | Both addresses computed correctly, no clobbering | `__tests__/il/` |
| F.2 | Simple literal value still uses Tier 2 | `poke($0400+i, 32)` with byte i → efficient X-indexed | `__tests__/il/` |
| F.3 | Complex value forces Tier 3 | `poke($0400+i, peek($1000+i))` → indirect addressing for safety | `__tests__/il/` |

#### Blend Source Fixtures

```js
// Fixture: word-index-clear-screen.blend
module test;
export function main(): void {
  let i: word = 0;
  for (i = 0 to 999) {
    poke($0400 + i, 32);
  }
}
```

```js
// Fixture: peek-poke-register-safety.blend
module test;
@data let srcData: byte[] = [1, 2, 3, 4, 5, 6, 7, 8];
export function main(): void {
  let i: byte = 0;
  for (i = 0 to 7) {
    poke($0400 + i, peek(@srcData + i));
  }
}
```

---

## Phase 4 Tests: Items G, H, I (Optimizer Enhancements)

### Item G: Peephole Rules

| # | Test | Description | File |
|---|------|-------------|------|
| G.1 | STA/LDA same address → LDA eliminated | Before/after IL: store then load same slot → load removed | `__tests__/optimizer/` |
| G.2 | JMP to next instruction → JMP eliminated | Before/after: JMP .label / .label: → JMP removed | `__tests__/optimizer/` |
| G.3 | PHA/PLA pair → both eliminated | Adjacent PUSH_A/POP_A with no intervening ops → removed | `__tests__/optimizer/` |
| G.4 | Redundant LOAD_IMM → second eliminated | LOAD_IMM N ... LOAD_IMM N (A unchanged) → second removed | `__tests__/optimizer/` |
| G.5 | Safety: STA/LDA with intervening write preserved | STA $07 / INC $07 / LDA $07 → LDA NOT removed | `__tests__/optimizer/` |
| G.6 | Safety: PHA/PLA with A modification preserved | PHA / LDA #5 / PLA → NOT removed (PLA restores old A) | `__tests__/optimizer/` |
| G.7 | O0 output unchanged | Peephole rules don't fire at O0 | `__tests__/optimizer/` |

### Item H: Loop Canonicalization

| # | Test | Description | File |
|---|------|-------------|------|
| H.1 | Delay loop detected | Loop with only barrier() → recognized as delay loop | `__tests__/optimizer/` |
| H.2 | Canonical DEX/BNE emitted | Delay loop → DEX/BNE output | `__tests__/optimizer/` |
| H.3 | Non-delay loop unchanged | Loop with poke() in body → NOT canonicalized | `__tests__/optimizer/` |

### Item I: Constant Folding

| # | Test | Description | File |
|---|------|-------------|------|
| I.1 | LOAD_IMM + ADD_IMM folded | `LOAD_IMM 12 / ADD_IMM 3` → `LOAD_IMM 15` | `__tests__/optimizer/` |
| I.2 | LOAD_IMM + SUB_IMM folded | `LOAD_IMM 12 / SUB_IMM 1` → `LOAD_IMM 11` | `__tests__/optimizer/` |
| I.3 | LOAD_IMM + AND_IMM folded | `LOAD_IMM 0xFF / AND_IMM 0x0F` → `LOAD_IMM 0x0F` | `__tests__/optimizer/` |
| I.4 | Byte overflow handled | `LOAD_IMM 250 / ADD_IMM 10` → `LOAD_IMM 4` (260 & 0xFF) | `__tests__/optimizer/` |
| I.5 | Non-immediate not folded | `LOAD_SLOT x / ADD_IMM 5` → NOT folded (x not constant) | `__tests__/optimizer/` |

---

## Phase 5 Tests: Items J, K (Future Enhancements)

### Item J: Block Copy

| # | Test | Description | File |
|---|------|-------------|------|
| J.1 | Pattern detection: simple copy loop | `for i = 0 to N { poke(dst+i, peek(src+i)) }` → detected | `__tests__/optimizer/` or `__tests__/il/` |
| J.2 | Pattern NOT detected: loop with extra ops | `for i = 0 to N { poke(dst+i, peek(src+i)); count += 1; }` → NOT detected | Same |
| J.3 | Block copy semantically correct | Output bytes match original loop (runtime verification) | `__tests__/e2e/` |

### Item K: Memory Map

| # | Test | Description | File |
|---|------|-------------|------|
| K.1 | ROM shadow warning at $1000 | Data placed at $1000 in VIC bank 0 → warning emitted | `__tests__/codegen/` or `__tests__/pipeline/` |
| K.2 | No warning at $2000 | Data placed at $2000 in VIC bank 0 → no warning | Same |
| K.3 | Warning suppressible | Flag/pragma disables warning | Same |

---

## Phase 6 Tests: Item L (Diagnose.md Update)

No code tests needed. Validation is manual review:
- [ ] New sections follow existing `diagnose.md` style
- [ ] Templates are actionable
- [ ] Section numbering is consistent
- [ ] No existing sections removed

---

## E2E Tests: Armenian Charset Program

### Full Pipeline Verification

| # | Test | Description |
|---|------|-------------|
| E2E.1 | armenian-charset compiles at O0 | `diag_app` passes compilation |
| E2E.2 | armenian-charset assembles at O0 | ACME produces .prg without errors |
| E2E.3 | armenian-charset compiles at all levels | O0 through Oz all pass |
| E2E.4 | copyCharset() address computation correct | ASM shows correct 16-bit address math |
| E2E.5 | clearScreen() writes all 1000 positions | ASM uses word-width loop or page-based approach |
| E2E.6 | For-loop stack balanced | PHA/PLA count balanced in all functions |
| E2E.7 | No size regressions at Os/Oz | PRG size ≤ O0 PRG size |

---

## Verification Checklist

Before marking any item complete:

- [ ] All targeted tests pass: `./compiler-test <component>`
- [ ] Full test suite passes: `./compiler-test`
- [ ] No regressions in existing tests
- [ ] New tests added for the specific fix
- [ ] Edge cases covered (boundary conditions, error paths)
- [ ] armenian-charset `diag_app` re-run confirms fix

## Test Count Estimates

| Phase | Items | Estimated Tests |
|-------|-------|----------------|
| Phase 1 | A, B, C | ~15 tests |
| Phase 2 | D | ~10 tests |
| Phase 3 | E, F | ~8 tests |
| Phase 4 | G, H, I | ~15 tests |
| Phase 5 | J, K | ~6 tests |
| Phase 6 | L | Manual review |
| E2E | All | ~7 tests |
| **Total** | | **~61 tests** |
