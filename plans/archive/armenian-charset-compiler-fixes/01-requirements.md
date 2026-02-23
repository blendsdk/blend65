# Requirements: Armenian Charset Compiler Fixes (A→L)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Priority**: ALL CRITICAL

## Item A: Address-Of Word Path in IL Generator

**Problem:** `inferWordWidthFromExpression()` in `expressions.ts` only recognizes `IdentifierExpression` as potentially word-typed. Address-of expressions (`@variable`) are `UnaryExpression` and return `false`, causing `@armenianFont + i` to route through the BYTE path instead of the WORD path.

**Impact:** Any `peek(@data_var + word_index)` or `poke(@data_var + word_index, value)` reads/writes the wrong address. The high byte of the address is destroyed by `PROMOTE_BYTE_WORD` (LDX #$00).

**Fix Location:** `packages/compiler/src/il/generator/expressions.ts` → `inferWordWidthFromExpression()`, `isWordTyped()`, `generateTier3Address()`

**Acceptance Criteria:**
- [ ] `inferWordWidthFromExpression` recognizes `@` unary expressions as word-typed
- [ ] `@data_var + word_index` routes to `generateBinaryWord` path
- [ ] `generateTier3Address` doesn't re-apply `PROMOTE_BYTE_WORD` after word binary
- [ ] armenian-charset `copyCharset()` generates correct address computation
- [ ] Tests: word binary with address-of left operand

---

## Item B: Double PLA Stack Corruption in For-Loops

**Problem:** Byte `for` loops with `to` syntax emit 1×PHA + 2×PLA per iteration, causing stack pointer drift of -1 byte per iteration. The second PLA has no matching PHA.

**Impact:** Stack corruption. Programs with for-loops that return from the calling function will crash. The armenian-charset program survives only because `main()` never returns (infinite while loop).

**Fix Location:** `packages/compiler/src/il/generator/control-flow.ts` → `generateForStatement()`, `generateForCondition()`

**Acceptance Criteria:**
- [ ] For-loop prologue has balanced PHA/PLA (net stack delta = 0 per iteration)
- [ ] All existing for-loop tests still pass
- [ ] New test: verify stack pointer is preserved across for-loop execution
- [ ] armenian-charset for-loops emit clean prologue

---

## Item C: Constant-Bound Loop Template Specialization

**Problem:** All for-loops use the same generic dynamic-bound template, even when bounds are compile-time constants. This emits unnecessary PHA/PLA stack traffic, `CMP #$FF` dynamic fallback, and recomputes bounds every iteration.

**Impact:** Wasted bytes and cycles in every constant-bound loop. Also the root cause enabling Bug B.

**Fix Location:** `packages/compiler/src/il/generator/control-flow.ts` → `generateForStatement()`, `generateForCondition()`

**Acceptance Criteria:**
- [ ] Constant-bound loops use simplified template: `LDA i / CMP #end / BCS exit`
- [ ] No PHA/PLA in constant-bound loop prologue
- [ ] No `CMP #$FF` dynamic fallback for constant bounds
- [ ] Bounds computed once, not every iteration
- [ ] Dynamic-bound loops still work correctly (no regression)

---

## Item D: Type Info Propagation in Semantic Analyzer

**Problem:** `getTypeInfo()` returns null for most expressions because `setTypeInfo()` is never called during compilation. The IL generator falls back to `inferWordWidthFromExpression()` which is incomplete.

**Impact:** Root cause of entire class of "wrong width" bugs. If type info was propagated, Bug A wouldn't exist.

**Fix Location:** `packages/compiler/src/semantic/` + AST expression nodes

**Acceptance Criteria:**
- [ ] Semantic analyzer calls `setTypeInfo()` on all expression nodes
- [ ] `getTypeInfo()` returns valid type for literals, identifiers, binary expressions, unary expressions, function calls
- [ ] Address-of (`@`) expressions are typed as `word`
- [ ] IL generator can rely on `getTypeInfo()` instead of `inferWordWidthFromExpression()`
- [ ] All existing tests pass (no regressions)

---

## Item E: Word Index >256 for Indexed Addressing

**Problem:** When a word index variable is used for indexed addressing (`STA $0400,X`), only the low byte of the word goes into X. For indices >255, the high byte is lost.

**Impact:** `clearScreen()` only clears 256 positions instead of 1000. Any `poke(CONSTANT + word_var, value)` where word_var >255 writes to wrong address.

**Fix Location:** `packages/compiler/src/il/generator/expressions.ts` → Tier 2 indexed addressing path

**Acceptance Criteria:**
- [ ] Detect when word index exceeds byte range and switch to page-based or indirect addressing
- [ ] `clearScreen()` pattern correctly writes all 1000 screen positions
- [ ] Tests: poke with word index >255

---

## Item F: Register X Clobbering in Complex Expressions

**Problem:** In `poke(dest + i, peek(src + i))`, the destination index X is computed first, then the source computation overwrites X. No register preservation.

**Impact:** Destination address is corrupted — poke writes to wrong location.

**Fix Location:** `packages/compiler/src/codegen/` or `il/generator/expressions.ts`

**Acceptance Criteria:**
- [ ] When both poke destination and peek source need A:X, preserve first result
- [ ] Strategy: save/restore X to temp, or reorder computation
- [ ] `copyCharset()` correctly computes both source and destination addresses
- [ ] Tests: poke(expr1, peek(expr2)) where both expressions need A:X

---

## Item G: Asm-IL Peephole Optimizer Enhancement

**Problem:** Several redundant patterns survive in generated ASM that a peephole optimizer should catch.

**Patterns to add:**
1. Store-reload elimination: `STA $xx / LDA $xx` → eliminate LDA
2. Dead jump elimination: `JMP .label` where `.label:` is next instruction → eliminate JMP
3. PHA/PLA pair elimination: consecutive PHA/PLA with no intervening stack use → eliminate both
4. Redundant register loads: `LDA #N / ... / LDA #N` (A unchanged between) → eliminate second

**Fix Location:** `packages/compiler/src/optimizer/` asm-il peephole rules

**Acceptance Criteria:**
- [ ] Each pattern has a peephole rule with safety conditions
- [ ] All patterns detected and eliminated at O1+
- [ ] Tests: each pattern with before/after ASM verification

---

## Item H: Loop Canonicalization in Asm-IL Optimizer

**Problem:** Delay loops (`while barrier()`) use generic loop codegen (load/compare/branch/increment) instead of canonical 6502 `DEX/BNE` or `DEY/BNE` patterns.

**Impact:** Wasted bytes and cycles in every delay loop.

**Fix Location:** `packages/compiler/src/optimizer/` asm-il level

**Acceptance Criteria:**
- [ ] Detect delay loop pattern (loop body = barrier() only)
- [ ] Rewrite to canonical `DEX/BNE` or `DEY/BNE` form
- [ ] Preserve loop iteration count
- [ ] Tests: delay loop canonicalization

---

## Item I: ASM-Level Constant Folding

**Problem:** Runtime math on compile-time constants survives to ASM level. Example: `HELLO_LENGTH - 1` computed at runtime (`LDA #$0C / SEC / SBC #$01`) instead of folded to `LDA #$0B`.

**Impact:** Wasted bytes and cycles for every constant expression.

**Fix Location:** `packages/compiler/src/optimizer/` — constant folding at asm-il or IL level

**Acceptance Criteria:**
- [ ] Constant arithmetic expressions folded before codegen
- [ ] `LDA #const / SEC / SBC #const2` → `LDA #(const - const2)`
- [ ] Works for ADD, SUB, AND, OR, XOR, shifts
- [ ] Tests: constant folding patterns

---

## Item J: Block Copy Pattern Recognition

**Problem:** `copyCharset()` is a 2048-byte memory copy via individual peek/poke in a for-loop. The compiler doesn't recognize this as a memcpy pattern.

**Canonical 6502 memcpy:**
```asm
LDY #0
.loop: LDA (src),Y / STA (dst),Y / INY / BNE .loop
       INC src+1 / INC dst+1 / DEX / BNE .loop
```

**Impact:** ~10 bytes per page vs ~30 bytes per iteration × 2048 iterations.

**Fix Location:** Research phase → codegen pattern matching

**Acceptance Criteria:**
- [ ] Research: identify `for i=0 to N { poke(dst+i, peek(src+i)) }` pattern
- [ ] Design: memcpy intrinsic or pattern-based codegen
- [ ] Implement: block copy lowering for recognized patterns
- [ ] Tests: memcpy pattern recognition and correct output

---

## Item K: Memory Map Awareness / ROM Shadow Detection

**Problem:** VIC bank 0 has ROM shadow at $1000-$1FFF and $9000-$9FFF. If charset data is placed at $1000, VIC reads ROM instead of RAM. The compiler has no awareness of this.

**Impact:** Visual bugs when data lands in ROM shadow regions.

**Fix Location:** Compiler infrastructure — memory map model

**Acceptance Criteria:**
- [ ] Research: document VIC bank memory map constraints
- [ ] Design: compile-time memory region conflict detection
- [ ] Implement: warning when @data/@charset lands in ROM shadow area
- [ ] Tests: ROM shadow detection warnings

---

## Item L: Diagnose.md Update with New Analysis Techniques

**Problem:** `diagnose.md` lacks several analysis techniques identified through external ASM diagnostics.

**New sections to add:**
1. **Phase 4.9: Stack Discipline Audit** — PHA/PLA balance per basic block
2. **Phase 4.10: Canonical 6502 Lowering Comparison** — compare loop structures against idioms
3. **Phase 3.6: Cross-Level ASM Metrics Table** — line count + text size + PRG size
4. **Phase 8.1: Regression Test Suggestions** — specific test patterns per finding

**Fix Location:** `.clinerules/diagnose.md`

**Acceptance Criteria:**
- [ ] All 4 new sections added with templates and examples
- [ ] Existing sections preserved (no regression)
- [ ] New sections follow existing document style
