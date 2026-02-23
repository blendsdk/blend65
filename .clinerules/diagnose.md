# Blend65 Application Diagnostic Protocol

## **TRIGGER KEYWORD: `diag_app`**

When the user types `diag_app <path-to-blend-file>`, execute this comprehensive diagnostic workflow to identify compiler bugs, optimization regressions, and assembly errors.

---

## **Overview**

This protocol automates the full diagnostic pipeline:

1. **Compile** a Blend application at all 10 optimization levels (O0, O1, O1s, O1z, O2, Os, Oz, O3, O3s, O3z)
2. **Assemble** each output with ACME to produce `.prg` binaries
3. **Validate** ACME label files (charset alignment, address ranges) and PRG binaries (load address, BASIC SYS stub)
4. **Diff** assembly output across optimization levels
5. **Analyze** assembly metrics, stack balance, redundancies, and size regressions (automated via `diag_analyze_asm.sh`)
6. **Verify** runtime behavior in VICE emulator against `expected.json` (automated via `diag_vice.sh`)
7. **Diagnose** the root cause and classify the bug (AI analysis)
8. **Report** findings with evidence and recommended next steps

### **Automated vs AI-Assisted Steps**

| Step | Tool | Automated? |
|------|------|------------|
| Compile + Assemble | `diag_app.sh` | ✅ Fully automated |
| Label + PRG validation | `diag_app.sh` | ✅ Fully automated |
| Assembly metrics + analysis | `diag_analyze_asm.sh` | ✅ Fully automated |
| VICE runtime verification | `diag_vice.sh` | ✅ Fully automated (requires expected.json) |
| Batch execution | `diag_batch.sh` | ✅ Fully automated |
| Assembly quality audit | AI | 🧠 Manual AI analysis |
| Codegen strategy audit | AI | 🧠 Manual AI analysis |
| Source code analysis | AI | 🧠 Manual AI analysis |
| Bug classification | AI | 🧠 Manual AI analysis |

---

## **Phase 1: Run the Diagnostic Script**

### **1.1 Execute `diag_app.sh`**

**IMMEDIATELY run the diagnostic script:**

```bash
clear && ./scripts/diag_app.sh <path-to-blend-file>
```

**Example:**
```bash
clear && ./scripts/diag_app.sh examples/spinning-line/main.blend
```

The script automatically performs **8 steps**:

1. **Collect sources** — copies all `.blend` files for reference
2. **Build compiler** — runs `yarn build` (skippable with `BLEND65_SKIP_BUILD=1`)
3. **Compile at all 10 levels** — O0, O1, O1s, O1z, O2, Os, Oz, O3, O3s, O3z + O0-debug build
4. **Assemble with ACME** — produces `.prg` binaries and `.labels` symbol files
5. **Generate diffs** — unified diffs between O0 and all other levels
6. **Validate labels + PRG** — checks charset alignment, address ranges, load address, BASIC SYS stub
7. **Assembly analysis** — cross-level metrics, stack balance (PHA/PLA), redundancy detection, size regressions (via `diag_analyze_asm.sh`)
8. **VICE runtime verification** — if `expected.json` exists alongside the source, runs each PRG in VICE and verifies memory state (via `diag_vice.sh`)
9. **Generate summary** — comprehensive `summary.txt` with all results

### **1.2 Note the Output Directory**

The script outputs to `build/diag/<app-name>/` by default. Remember this path — all analysis files will be here.

---

## **Phase 2: Review Language Specification**

### **2.1 Read Relevant Language Specification Sections**

**BEFORE analyzing any source code or compiler output, ALWAYS read the language specification first.**

This is MANDATORY — you cannot properly diagnose source code issues without understanding what valid Blend code looks like.

**Read these specification files based on what the source code uses:**

| Feature Used in Source | Specification File |
|------------------------|--------------------|
| Module declarations | `docs/language-specification-v2/07-modules.md` |
| Variable declarations (`let`, `const`) | `docs/language-specification-v2/03-variables.md` |
| Types (`byte`, `word`, `bool`, arrays) | `docs/language-specification-v2/02-types.md` |
| Expressions (arithmetic, comparison, etc.) | `docs/language-specification-v2/04-expressions.md` |
| Statements (`if`, `while`, `for`, `return`) | `docs/language-specification-v2/05-statements.md` |
| Functions | `docs/language-specification-v2/06-functions.md` |
| Intrinsics (`poke`, `peek`, `lo`, `hi`, etc.) | `docs/language-specification-v2/08-intrinsics.md` |
| Asm functions | `docs/language-specification-v2/09-asm-functions.md` |
| Storage classes (`@zp`, `@ram`, `@data`, `@sprite`, etc.) | `docs/language-specification-v2/03-variables.md` |
| Compiler directives | `docs/language-specification-v2/10-compiler.md` |
| Lexical structure (comments, literals, etc.) | `docs/language-specification-v2/01-lexical-structure.md` |

### **2.2 Minimum Specification Reading**

**At a minimum, ALWAYS read:**
1. `docs/language-specification-v2/README.md` — Overview and table of contents
2. Any section relevant to features used in the source code

### **2.3 Build a Mental Model**

After reading the specification, you should be able to answer:
- What are valid types and their sizes?
- What operators are supported and their precedence?
- What are the rules for variable declarations and storage classes?
- What intrinsics are available and their signatures?
- What are the rules for function declarations and calls?
- What are the valid statement forms?

**This knowledge is ESSENTIAL for Phase 4 (Source Code Analysis).**

---

## **Phase 3: Read and Analyze the Summary**

### **3.1 Read the Summary File**

```
Read: build/diag/<app-name>/summary.txt
```

### **3.2 Classify the Overall Result**

| Result | Meaning |
|--------|---------|
| ✅ All PASS | Compilation and assembly succeed at all levels |
| ❌ Blend65 FAIL at some levels | Compiler crashes or produces errors |
| ❌ ACME FAIL at some levels | Compiler output is syntactically invalid assembly |
| ❌ Only O0 passes, higher fails | Optimization regression bug |
| ❌ All levels FAIL | Fundamental compiler bug or invalid source code |

### **3.3 Check File Size Anomalies**

Review the PRG sizes in the summary:
- **Sudden size increase** at a level → possible dead code not eliminated
- **Sudden size decrease** at a level → possible code incorrectly eliminated
- **Size of 0** → compilation or assembly failure
- **All sizes identical** across O0–O3 → optimizer may not be running

### **3.4 Detect Size Regressions (CRITICAL)**

**🚨 An optimized level producing LARGER code than O0 is ALWAYS a bug.**

Compare every level's PRG size against O0 (the unoptimized baseline):

| Condition | Classification |
|-----------|----------------|
| O1/O2/O3 PRG > O0 PRG | **Size regression** — optimization made code larger |
| Os/Oz PRG > O0 PRG | **Critical size regression** — size-focused level is LARGER than no-opt |
| O3 PRG > O2 PRG | Possible over-inlining or failed constant folding |
| Os PRG > O1 PRG | Pipeline gating issue — size level missing optimizations |

**Example:** If O0 = 449 bytes but O2 = 513 bytes, that's a **64-byte size regression**. O2 is making the code WORSE. This typically means inlining duplicated expensive code without the follow-up optimization (e.g., constant folding, address-expr folding) that would shrink it.

**Report every size regression as a `MISSOPT` or `REG` bug.**

### **3.5 Build Cross-Level Behavior Summary Table**

Create a table tracking WHAT each optimization level does differently. This is the most powerful diagnostic tool for understanding optimization pipeline issues.

**Template:**

```markdown
| Level | PRG Size | Delta vs O0 | Inlined Functions | Key Optimizations Applied | Notable Behavior |
|-------|----------|-------------|-------------------|---------------------------|------------------|
| O0    | XXX B    | baseline    | none              | none                      | ... |
| O1    | XXX B    | +/-N B     | func1             | ...                       | ... |
| O2    | XXX B    | +/-N B     | func1, func2      | ...                       | ... |
| O3    | XXX B    | +/-N B     | func1, func2      | const-fold, addr-expr     | ... |
| Os    | XXX B    | +/-N B     | none              | modulo-bitmask            | ... |
| Oz    | XXX B    | +/-N B     | none              | modulo-bitmask            | ... |
```

**How to fill this table:**
1. Check for `[inlined from ...]` comments in assembly → which functions are inlined
2. Check for `(address expr folded ...)` comments → address-expr folding applied
3. Check for `AND #$XX` after increment → modulo bitmask optimization
4. Check for `JSR` vs inline code → function call vs inlined
5. Check for shift chains vs constant immediates → strength reduction applied
6. Note any other optimization-specific assembly patterns

**This table immediately reveals pipeline gating problems** — e.g., when Os/Oz should benefit from an optimization that only O3 applies.

### **3.6 Cross-Level ASM Metrics Table**

**🚨 MANDATORY for every diagnostic run.** Create a quantitative metrics table comparing all optimization levels.

**Read the assembly output at every level and count:**

```
Read: build/diag/<app-name>/O0/output.asm
Read: build/diag/<app-name>/O1/output.asm
Read: build/diag/<app-name>/O2/output.asm
Read: build/diag/<app-name>/O3/output.asm
Read: build/diag/<app-name>/Os/output.asm
Read: build/diag/<app-name>/Oz/output.asm
```

**Metrics to collect per level:**

| Metric | How to Count |
|--------|-------------|
| **Total ASM lines** | `wc -l output.asm` (excluding comments/blanks) |
| **JSR count** | Count `JSR` instructions — function call overhead |
| **JMP count** | Count `JMP` instructions — unconditional jumps |
| **LDA #imm count** | Count `LDA #` — immediate loads |
| **PHA/PLA count** | Count `PHA` + `PLA` — stack operations |
| **STA/LDA pair count** | Count adjacent `STA $xx / LDA $xx` — store-reload redundancy |
| **Data segment bytes** | Size of `!byte` / `!word` data sections |

**Template:**

```markdown
| Metric | O0 | O1 | O2 | O3 | Os | Oz |
|--------|----|----|----|----|----|----|
| ASM lines | | | | | | |
| PRG bytes | | | | | | |
| JSR calls | | | | | | |
| JMP instrs | | | | | | |
| LDA #imm | | | | | | |
| PHA+PLA | | | | | | |
| STA/LDA pairs | | | | | | |
| Data bytes | | | | | | |
```

**What this reveals:**
- **JSR count dropping** from O0→O1/O2 indicates function inlining is working
- **PHA/PLA not decreasing** at higher levels indicates missed push/pop elimination
- **STA/LDA pairs persisting** indicates missed store-reload elimination
- **Os/Oz having MORE instructions than O2** indicates size regression

**Report anomalies as `REDUN` or `MISSOPT` bugs with the specific metrics.**

---

## **Phase 4: Investigate Failures**

### **4.1 For Blend65 Compilation Failures**

Read the compiler log for the failing level:

```
Read: build/diag/<app-name>/<level>/blend65.log
```

**Look for:**
- Syntax errors → likely a `.blend` source code bug
- Type errors → likely a `.blend` source code bug or missing type support
- Internal compiler errors / stack traces → **compiler bug**
- "not implemented" messages → missing compiler feature

### **4.2 For ACME Assembly Failures**

Read both the ACME log AND the generated assembly:

```
Read: build/diag/<app-name>/<level>/acme.log
Read: build/diag/<app-name>/<level>/output.asm
```

**Look for:**
- "Undefined label" → compiler generated a reference to a non-existent label
- "Out of range" → branch target too far (codegen needs JMP instead of branch)
- "Syntax error" → compiler generated invalid ACME syntax
- "Duplicate label" → compiler emitted the same label twice
- "Value out of range" → 16-bit value used where 8-bit expected

### **4.3 For Optimization Regressions**

When O0 passes but higher levels fail, read the diff:

```
Read: build/diag/<app-name>/diffs/O0-vs-<failing-level>.diff
```

**The diff reveals exactly what the optimizer changed.** Look for:
- Removed instructions that shouldn't be removed (over-aggressive dead code)
- Reordered code that breaks control flow
- Missing labels after optimization
- Incorrect register reuse
- Broken inlined function code

### **4.4 Use the Debug Build for Context**

The O0 debug build includes inline source comments showing which Blend statement generated which assembly:

```
Read: build/diag/<app-name>/O0/output-debug.asm
```

This maps assembly back to source code — invaluable for understanding what the compiler intended.

### **4.5 Assembly Quality Audit (MANDATORY — Even When All Levels Pass)**

**🚨 This step is NON-OPTIONAL.** Even when all 6 levels compile and assemble successfully, you MUST audit the generated assembly for code quality bugs. "All levels pass" only means there are no compilation/assembly failures — it does NOT mean the compiler produced optimal code.

**Read the assembly output at EVERY optimization level:**

```
Read: build/diag/<app-name>/O0/output.asm
Read: build/diag/<app-name>/O1/output.asm   (or higher levels)
Read: build/diag/<app-name>/Os/output.asm
```

**Check for these specific patterns — each one is a bug:**

#### **Redundant Store/Reload Patterns (REDUN)**

The compiler stores a value to memory and immediately reloads it without any intervening change:

```asm
; BUG: Redundant store/reload — value is already in A/X
  STA $07       ; store parameter
  STX $08
  LDA $07       ; immediately reload — WASTED 4+ cycles
  LDX $08
```

**This is a bug.** The value was already in the registers. The store/reload pair is dead code.

#### **Jump-to-Next-Instruction Patterns (REDUN)**

The compiler emits a jump whose target is the very next instruction:

```asm
; BUG: Jump to next instruction — 3 bytes + 3 cycles wasted
  JMP .label
.label:
```

**This is a bug.** The JMP is a no-op. Control would fall through naturally.

#### **Dead Code After Unconditional Jumps (REDUN)**

Instructions between an unconditional jump/return and the next reachable label:

```asm
  JMP .somewhere
  LDA #$00       ; BUG: Dead code — never executed
  STA $FF        ; BUG: Dead code — never executed
.nextLabel:
```

#### **Redundant Register Loads (REDUN)**

Loading a value into a register when it already contains that value:

```asm
  LDA #$00       ; Load 0 into A
  STA $06        ; Store it
  LDA #$00       ; BUG: A already contains 0
```

#### **Unnecessary Parameter Shuffling During Inlining (REDUN)**

When a function is inlined, the compiler may still store parameters to memory slots and reload them, even though the values are already in registers:

```asm
; @lineFrames — value loaded into A/X
  LDA #<__data_label
  LDX #>__data_label
; [inlined] param spriteAddr (word) — stores to slots
  STA $07
  STX $08
; [inlined] load spriteAddr (word) — reloads from slots
  LDA $07        ; BUG: Value was already in A!
  LDX $08        ; BUG: Value was already in X!
```

**This is a bug.** Inlining should eliminate parameter passing overhead, not preserve it.

#### **Redundant Loads Before Comparison (REDUN)**

Loading a value that was just stored (and is still in the accumulator):

```asm
  STA $06        ; Store frame value
; load frame
  LDA $06        ; BUG: Value is already in A from the STA above
  CMP #$04
```

#### **Missing Peephole Optimizations at Os/Oz (MISSOPT)**

Size-optimizing levels (Os, Oz) MUST catch simple peephole patterns. If Os/Oz still contains redundant instructions that a basic peephole pass would remove, that is a `MISSOPT` bug.

#### **How to Report Assembly Quality Bugs**

For each pattern found, report it as a separate bug with:
- **Category**: `REDUN` or `MISSOPT`
- **Severity**: High
- **Affected Levels**: Which optimization levels exhibit the issue
- **Evidence**: The exact assembly snippet showing the redundancy
- **Wasted Resources**: Bytes wasted + cycles wasted per occurrence
- **Location in Hot Path**: Is this inside a loop? (affects real-world impact)

### **4.6 Codegen Strategy Audit (MANDATORY)**

**🚨 Beyond individual redundant patterns, audit the overall CODE GENERATION STRATEGY for each major operation.** A codegen strategy can be correct but grossly suboptimal — producing the right result with far more instructions than necessary.

#### **16-Bit Shift Lowering (SHR_WORD)**

The compiler generates `SHR_WORD(N)` for word division by power-of-2. Check the lowering strategy:

**Current generic pattern (PHA/TXA/LSR/TAX/PLA/ROR × N):**
```asm
; SHR_WORD 6 — current: 36 bytes, ~90 cycles
  PHA / TXA / LSR / TAX / PLA / ROR   ; ×6 rounds
```

**This is a `STRATEGY` bug when a better lowering exists.** For example:
- **N ≥ 8**: Should use `TXA + LSR × (N-8)` (move high byte to A, shift remaining)
- **N = 3-7 with LO applied**: Should use the **shift-left technique**: `lo(value >> N) = hi(value << (8-N))`, which costs only `2 + 2×(8-N)` instructions instead of `6×N`
- **Constant address inputs**: Should fold to compile-time constant (e.g., `LDA #(addr >> 6)`)

**Audit checklist for shift operations:**
- [ ] Is the shift count known at compile time?
- [ ] Is the input a constant or symbol address?
- [ ] Is `lo()` applied after the shift? (enables shift-left optimization)
- [ ] Could the result be folded to a single immediate load?
- [ ] Is the shift-right count ≥ 8? (enables byte-move optimization)

#### **Busy-Wait Loop Detection**

Check for loop bodies with NO side effects (no memory stores, no I/O) used as delays:

```asm
; Busy-wait pattern — could use DEX/DEY canonical delay
.loop:
  LDA $05        ; load counter
  CMP #$FF       ; compare
  BCS .exit      ; exit if done
  INC $05        ; increment
  JMP .loop      ; loop back
```

**Canonical 6502 delay loops use `DEX/BNE` or `DEY/BNE`** — they are smaller (2-4 bytes per loop level vs 8-10 bytes) and faster per iteration. If a loop body contains only `barrier()` calls and no other side effects, classify this as a `MISSOPT` for delay canonicalization.

#### **Constant Address Operations**

When an operation takes a **compile-time symbol address** as input (e.g., `@spriteData`), the compiler should constant-fold the operation at compile time rather than emitting runtime computation:

```asm
; BAD: Runtime divide of constant address
  LDA #<__data_label    ; load address low byte
  LDX #>__data_label    ; load address high byte
  ; ... 36 bytes of runtime shift code ...

; GOOD: Compile-time fold
  LDA #(__data_label >> 6)   ; single immediate — computed by assembler
```

**If a constant address is passed through a runtime operation that could be folded, report as `MISSOPT`.**

### **4.7 Optimization Pipeline Gating Analysis**

**🚨 When an optimization fires at one level but NOT at another where it should, investigate WHY.**

This analysis identifies **pipeline gating problems** — situations where an optimization is blocked because a prerequisite pass doesn't run at certain levels.

#### **Step 1: Read the Optimizer Configuration**

```
Read: packages/compiler/src/optimizer/options.ts
```

Review `PROGRAM_LEVEL_PASSES` and `LEVEL_PASSES` for each optimization level. Create a matrix:

```markdown
| Pass | O0 | O1 | O1s | O1z | O2 | Os | Oz | O3 | O3s | O3z |
|------|----|----|-----|-----|----|----|----|----|----|-----|
| dead-function-elim | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| function-inline | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| il-peephole | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ... | | | | | | | | | | |
```

#### **Step 2: Identify Gating Chains**

Some optimizations depend on others running first. Common gating chains:

```
function-inline → address-expr-folding (in il-peephole)
                  ↑ folding can only fire if LOAD_ADDRESS + SHR_WORD + LO
                    appear in the same function (requires inlining first)

function-inline → constant-prop → dead-code-elimination
                  ↑ inlined constants can enable further propagation
```

**If a level has `il-peephole` but NOT `function-inline`, the address-expr folding pattern will never appear in the IL — the peephole pass will have nothing to fold.** This is a pipeline gating problem.

#### **Step 3: Classify Gating Issues**

| Gating Pattern | Impact | Fix Strategy |
|----------------|--------|-------------|
| Size level skips inlining → misses folding that REDUCES size | Size regression | Enable profitable-only inlining at size levels |
| No constant-prop after inlining → missed constant elimination | Redundant code | Ensure constant-prop runs after inlining |
| No DCE after constant-prop → dead stores remain | Wasted bytes | Add DCE pass after constant-prop |

**Report each gating issue as a `MISSOPT` bug with the specific pipeline dependency that is broken.**

### **4.8 Strength Reduction & Algebraic Rewrite Audit**

**Check for algebraic simplifications the compiler should apply but doesn't.**

#### **Common 6502 Algebraic Rewrites**

| Pattern | Rewrite | Savings |
|---------|---------|---------|
| `x / 2^N` | `x >> N` | Avoids division subroutine |
| `lo(addr >> N)` where addr is constant | `#(addr >> N)` | Eliminates runtime shift entirely |
| `(base + 64*i) >> 6` | `(base >> 6) + i` | Distributive law — eliminates multiply |
| `x % 2^N` | `x AND (2^N - 1)` | Bitmask instead of modulo |
| `x * 2^N` | `x << N` | Shift instead of multiply |
| `if (x == N) { x = 0; }` where N is power-of-2 | `x AND (N-1)` | Branchless wrap |
| `x + 0` | `x` | Identity elimination |
| `x * 1` | `x` | Identity elimination |

#### **How to Audit**

For each function in the assembly output:
1. **Identify the high-level operation** from source/debug comments
2. **Check if the compiler applied the best algebraic form**
3. **Report missed rewrites** as `MISSOPT` with the before/after transformation

**Example:** If source has `lo(spriteAddr / 64) + frameIndex` and the compiler emits a full 16-bit runtime divide instead of `LDA #(addr >> 6); ADC frameIndex`, that is a missed algebraic rewrite.

### **4.9 Stack Discipline Audit (PHA/PLA Balance)**

**🚨 MANDATORY audit for every diagnostic run.** Stack imbalance is one of the most dangerous 6502 bugs — it silently corrupts return addresses and causes random crashes.

**For each function in the assembly output, verify:**

1. **Every PHA has a matching PLA** — Count PHA and PLA instructions per function. They must be equal on every execution path.
2. **Stack is balanced across loop iterations** — A loop body must have net stack delta = 0. Check that each iteration pushes the same number as it pops.
3. **No stack leak in error paths** — If conditional branches skip PLA instructions, the stack leaks.

**Audit procedure:**

```
For each function in output.asm:
  1. Count all PHA instructions
  2. Count all PLA instructions
  3. If PHA_count ≠ PLA_count → BUG: Stack imbalance
  4. For each loop body:
     a. Count PHA inside loop body
     b. Count PLA inside loop body
     c. If they differ → BUG: Stack leak per iteration
  5. Check for PHA before conditional branch without matching PLA on taken path
```

**Template:**

```markdown
| Function | PHA Count | PLA Count | Balanced? | Loop Delta | Notes |
|----------|-----------|-----------|-----------|------------|-------|
| main | 2 | 2 | ✅ | 0 | Clean |
| copyData | 3 | 2 | ❌ | N/A | Missing PLA on early exit |
| delay | 1 | 1 | ✅ | 0 | OK |
```

**Common stack discipline bugs:**

| Pattern | Bug | Impact |
|---------|-----|--------|
| `PHA` in loop prologue, no `PLA` on byte-255 exit path | Stack leak per overflow exit | Corrupts return address over time |
| Inlined function leaves extra `PHA` | Net +1 per inlined call | Stack grows unbounded |
| `PLA` without preceding `PHA` | Stack underflow | Pops return address bytes |
| Conditional branch skips `PLA` | Stack leak on taken path | Gradual corruption |

**Report each stack imbalance as a `CG` (Code Generation) bug with Critical severity.**

### **4.10 Canonical 6502 Lowering Comparison**

**For key operations, compare the compiler's output against the known-optimal 6502 lowering.** This reveals cases where the codegen produces correct but suboptimal code.

**Delay Loops:**

| Pattern | Compiler Output | Optimal 6502 | Savings |
|---------|----------------|--------------|---------|
| `for i=0 to N { barrier() }` | Full for-loop codegen (10-15 bytes) | `LDX #N / .l: DEX / BNE .l` (5 bytes) | 5-10 bytes |

**Expected after DELAY_LOOP canonicalization:** The compiler should emit the compact `LDX #N / DEX / BNE` form for barrier-only loops. If the generic for-loop form appears at O2+ levels, report as `MISSOPT`.

**Memory Copy:**

| Pattern | Compiler Output | Optimal 6502 | Savings |
|---------|----------------|--------------|---------|
| `for i=0 to N { poke(dst+i, peek(src+i)) }` | Indirect load + store per byte | `LDA (src),Y / STA (dst),Y / INY / BNE` | 50%+ reduction |

**Constant Arithmetic:**

| Pattern | Compiler Output | Optimal 6502 | Savings |
|---------|----------------|--------------|---------|
| `addr / 64` (constant addr) | Runtime 16-bit shift | `LDA #(addr >> 6)` (2 bytes) | 30+ bytes |
| `x % 8` | Runtime modulo | `AND #$07` (2 bytes) | 10+ bytes |

**How to use this table:**

1. For each major operation in the source code, find the corresponding assembly
2. Compare against the "Optimal 6502" column
3. If the compiler output doesn't match, report as `MISSOPT` with:
   - The source pattern
   - What the compiler emitted (bytes + cycles)
   - What it should emit (bytes + cycles)
   - Byte/cycle savings available

---

## **Phase 5: Source Code Analysis**

### **5.1 Read All Source Files**

The diagnostic script copies all `.blend` source files to:

```
Read: build/diag/<app-name>/sources/
```

Read **every** `.blend` file in the sources directory.

### **5.2 Analyze Source Against Language Specification**

Using the language specification knowledge from Phase 2, perform a **thorough code review** of the `.blend` source code. Check for:

**Syntax & Structure Issues:**
- Is the `module` declaration correct?
- Are all statements properly terminated?
- Are block structures (`if`, `while`, `for`) properly formed?
- Is there a valid `export function main(): void` entry point?

**Type System Issues:**
- Are all variable types valid (`byte`, `word`, `bool`, `byte[]`, `word[]`)?
- Are type sizes correct for the intended use? (e.g., `byte` for values > 255)
- Are type conversions explicit where required? (e.g., `lo()` for word→byte)
- Do function return types match the actual return values?
- Are function parameter types correct at call sites?

**Expression & Operator Issues:**
- Are arithmetic operations valid for the operand types?
- Could any expressions overflow? (e.g., `byte + byte` exceeding 255)
- Are comparison operators used correctly?
- Is operator precedence as the programmer intended? (may need parentheses)
- Are bitwise operations used on appropriate types?

**Memory & Hardware Issues:**
- Are `poke`/`peek` addresses valid C64 hardware registers?
- Are `@data` and `@sprite` arrays properly sized?
- Are `poke`/`peek` addresses within valid ranges ($0000–$FFFF)?
- Is sprite data exactly 63 bytes per frame (+1 padding = 64)?
- Are VIC-II register values correct?

**Control Flow Issues:**
- Can `for` loops overflow their counter type? (e.g., `byte` counter to 256)
- Are `while(true)` infinite loops intentional and correct?
- Do all code paths return a value when the function has a return type?
- Are `break` statements used correctly within loops?

**Logic & Algorithm Issues:**
- Does the program logic achieve the intended behavior?
- Are array indices within bounds?
- Are animation frame counts and indices correct?
- Is the delay/timing logic reasonable for C64 speed?

### **5.3 Cross-Reference Source with Assembly**

Use the debug build (`output-debug.asm`) to trace:
- Which source line produced which assembly instruction
- Whether the compiler's interpretation of the source is correct
- Whether type narrowing or promotion happened correctly

### **5.4 Document Source Code Findings**

For each issue found in the source code, document:

1. **File and location** — Which `.blend` file and approximate line
2. **Issue description** — What is wrong or suspicious
3. **Specification reference** — Which language spec section defines the correct behavior
4. **Impact** — Does this cause the compilation/assembly failure?
5. **Suggested fix** — Exact code change to fix the issue

**Example finding:**
```
Issue: Variable `counter` declared as `byte` but used in loop `for counter = 0 to 300`
Location: main.blend, line 42
Spec Reference: docs/language-specification-v2/02-types.md (byte range: 0-255)
Impact: Loop counter overflow — byte cannot reach 300
Suggested Fix: Change type to `word`: `let counter: word = 0;`
```

---

## **Phase 6: Diagnose and Classify**

### **6.1 Bug Classification**

Classify each issue into ONE of these categories. **A single diagnostic may report MULTIPLE bugs.**

| Category | Code | Description | Severity |
|----------|------|-------------|----------|
| **Source Code Bug** | `SRC` | The `.blend` code has a programming error | Critical |
| **Compiler Frontend Bug** | `FE` | Lexer, parser, or semantic analysis is wrong | Critical |
| **IL Generation Bug** | `IL` | Intermediate language generation is incorrect | Critical |
| **Optimizer Bug** | `OPT` | Optimization pass introduces incorrect code | Critical |
| **Code Generation Bug** | `CG` | 6502 assembly generation is wrong | Critical |
| **Emitter Bug** | `EMIT` | ACME syntax emission is malformed | Critical |
| **Optimization Regression** | `REG` | Works at O0 but fails at higher level | Critical |
| **Redundant Code Bug** | `REDUN` | Compiler emits unnecessary/dead instructions | High |
| **Missed Optimization Bug** | `MISSOPT` | Optimizer fails to apply an optimization it should | High |

**Severity Rules:**
- **Critical** — Incorrect behavior: wrong output, crashes, assembly failures, broken semantics
- **High** — All code quality issues: redundant instructions, missed optimizations, wasted cycles/bytes

**🚨 There is NO "Medium" or "Low" severity.** If the compiler emits a single redundant instruction, that is a **High** severity bug. The compiler's job is to produce correct AND efficient code. Any failure in either dimension is a bug that must be reported.

### **6.2 Evidence Requirements**

For each diagnosis, provide:

1. **Category** — One of the codes above
2. **Affected Levels** — Which optimization levels are affected
3. **Root Cause** — Specific explanation of what went wrong
4. **Evidence** — Concrete log excerpts, assembly snippets, or diff sections
5. **Location** — Which compiler source file(s) likely contain the bug
6. **Severity** — Critical / High (see severity rules in 6.1)

### **6.3 Diagnosis Decision Tree**

```
Does it compile at O0?
├── NO → Is the .blend source valid?
│   ├── YES → Compiler Frontend Bug (FE) or IL Bug (IL)
│   └── NO → Source Code Bug (SRC) — fix the .blend code
│
└── YES → Does ACME assemble at O0?
    ├── NO → Code Generation Bug (CG) or Emitter Bug (EMIT)
    │
    └── YES → Does it work at higher levels?
        ├── YES at all levels → Audit assembly quality (Phase 4.5)
        │   ├── Assembly is clean → No bugs found ✅
        │   └── Redundancies found → REDUN and/or MISSOPT bugs
        └── NO at some levels → Optimization Regression (REG)
            └── Read the diff to find what the optimizer broke
```

**🚨 CRITICAL: "All levels pass" does NOT mean "no bugs."** It means there are no compilation or assembly failures. You MUST still perform the assembly quality audit (Phase 4.5) to check for redundant code, missed optimizations, and other code quality issues. These are REAL bugs that must be reported.

---

## **Phase 7: Generate Diagnostic Report**

### **7.1 Report Format**

Present the diagnosis using this format:

```markdown
## 🔍 Diagnostic Report: <app-name>

### Summary
| Item | Value |
|------|-------|
| Application | <app-name> |
| Entry File | <path> |
| Bug Category | <category code and name> |
| Affected Levels | <list of failing levels> |
| Severity | <Critical/High> |

### Source Code Analysis
<Summary of source code review findings>
- ✅ Valid syntax and structure
- ✅ / ❌ Type usage correct
- ✅ / ❌ Memory addresses valid
- ✅ / ❌ Control flow correct
- ✅ / ❌ Logic and algorithms correct

<If source code issues found:>
#### Source Code Issues
| # | File | Issue | Impact | Fix |
|---|------|-------|--------|-----|
| 1 | main.blend | <description> | <impact> | <fix> |
| 2 | ... | ... | ... | ... |

### Diagnosis
<Detailed explanation of the root cause>

### Evidence
<Log excerpts, assembly snippets, diff sections>

### Affected Compiler Code
<List of compiler source files that likely need fixing>
<Or "N/A — source code bug" if category is SRC>

### Recommended Fix
<Specific steps to fix the bug>
<If SRC: provide the exact .blend code changes needed>

### Suggested Plan
<Whether to create a formal plan via `make_plan` or a quick fix>
```

### **7.2 When Source Code Bug is Found (SRC)**

If the `.blend` source code is the problem:

```markdown
## 🔍 Diagnostic Report: <app-name> — Source Code Bug

### Source Code Issues Found
| # | File | Line | Issue | Spec Reference |
|---|------|------|-------|----------------|
| 1 | main.blend | ~42 | byte overflow in loop counter | 02-types.md |

### Suggested Source Code Fix
\`\`\`js
// BEFORE (buggy):
let counter: byte = 0;
for (counter = 0 to 300) { ... }

// AFTER (fixed):
let counter: word = 0;
for (counter = 0 to 300) { ... }
\`\`\`

### Next Step
Fix the source code and re-run: `diag_app <path-to-blend-file>`
```

### **7.3 When No Bug is Found**

If all levels pass AND the assembly quality audit (Phase 4.5) finds NO redundant patterns:

```markdown
## ✅ Diagnostic Report: <app-name>

All 6 optimization levels compiled and assembled successfully.

### Source Code Analysis
✅ Source code reviewed — no issues found

### Assembly Quality Audit
✅ Assembly audited at all optimization levels — no redundant code found

### Assembly Comparison
- O0: <lines> lines, <prg-size> bytes
- O3: <lines> lines, <prg-size> bytes (delta: <diff>)

### Recommendation
No action needed — compiler produced clean, efficient code at all levels.
```

**🚨 IMPORTANT:** This clean report should ONLY be used when:
1. All 6 levels compile and assemble successfully
2. The assembly quality audit (Phase 4.5) found ZERO redundant patterns
3. No dead code, no wasted instructions, no jump-to-next patterns

**If ANY redundant pattern is found, this template MUST NOT be used.** Instead, report each redundancy as a `REDUN` or `MISSOPT` bug using the standard report format from 7.1.

---

## **Phase 8: Next Steps**

Based on the diagnosis:

| Category | Action |
|----------|--------|
| `SRC` | Provide the exact `.blend` code fix, then user re-runs `diag_app` to verify |
| `FE` | Create a plan to fix the compiler frontend |
| `IL` | Create a plan to fix IL generation |
| `OPT` | Create a plan to fix the optimization pass |
| `CG` | Create a plan to fix code generation |
| `EMIT` | Create a plan to fix the ACME emitter |
| `REG` | Create a plan with O0-vs-failing-level diff analysis |
| `REDUN` | Create a plan to add/improve peephole optimization or inlining cleanup |
| `MISSOPT` | Create a plan to fix the optimizer pass that should have caught this |

**For source code bugs (`SRC`):**
1. Provide the exact fix with before/after code
2. Ask the user to apply the fix
3. Suggest re-running `diag_app` to verify the fix resolved the issue

**For compiler bugs:** Ask the user if they want to `make_plan` for the fix.

### **8.1 Regression Test Suggestions**

**After diagnosing any bug, ALWAYS suggest specific regression tests** to prevent the bug from recurring. This ensures each diagnostic produces lasting value beyond the immediate fix.

**For each bug found, suggest tests in this format:**

```markdown
### Suggested Regression Tests

| # | Test Description | Test Type | Component | Input Pattern |
|---|------------------|-----------|-----------|---------------|
| 1 | Verify `@data + word_index` uses word addressing | Unit | IL Generator | `poke(@arr + wordVar, value)` |
| 2 | Stack balanced after byte for-loop 0 to 255 | E2E | Codegen | `for i = 0 to 255 { barrier() }` |
| 3 | DELAY_LOOP emitted for barrier-only loop | Unit | Optimizer | Counted loop with BARRIER body |
```

**Test suggestion guidelines:**

| Bug Category | Test Type to Suggest |
|--------------|---------------------|
| `SRC` | No compiler test needed — suggest source code fix verification via `diag_app` |
| `FE` | Parser/lexer unit test with the specific syntax pattern |
| `IL` | IL generator test verifying correct opcode sequence |
| `OPT` | Optimizer pass test with before/after IL comparison |
| `CG` | Codegen test verifying correct 6502 assembly output |
| `EMIT` | E2E test compiling through ACME successfully |
| `REG` | E2E test at the specific optimization level that regressed |
| `REDUN` | Optimizer test verifying the redundant pattern is eliminated |
| `MISSOPT` | Optimizer test verifying the optimization fires on the pattern |

**What makes a good regression test:**
- ✅ **Minimal** — Tests exactly the bug pattern, nothing extra
- ✅ **Reproducible** — Uses a simple, self-contained Blend source snippet
- ✅ **Specific** — Checks for the exact fix (not just "compiles OK")
- ✅ **Named clearly** — Test name describes the bug it prevents

**Example regression test suggestion:**
```
Bug: PHA/PLA imbalance in byte for-loop with bound=255
Category: CG (Code Generation)
Suggested Test:
  - Source: `for i = 0 to 255 { barrier() }`
  - Verify: PHA count == PLA count in generated assembly
  - Verify: Stack pointer unchanged after loop completes
  - File: `__tests__/codegen/for-loop-stack-balance.test.ts`
```

---

## **Quick Reference**

### Script Usage
```bash
# Single-program diagnostic (default output)
./scripts/diag_app.sh examples/spinning-line/main.blend

# Single-program diagnostic (custom output)
./scripts/diag_app.sh examples/balloon-sprite/main.blend build/diag/balloon

# Batch diagnostic (all test programs)
./scripts/diag_batch.sh examples/test-suite/

# Batch diagnostic (all examples)
./scripts/diag_batch.sh examples/

# Standalone VICE verification
./scripts/diag_vice.sh build/diag/test/O0/output.prg examples/test/expected.json
```

### Output Structure
```
build/diag/<app-name>/
├── sources/                # .blend source files
├── O0/
│   ├── output.asm          # Assembly (no optimization)
│   ├── output-debug.asm    # Assembly with source comments (O0 only)
│   ├── output.prg          # ACME binary
│   ├── output.labels       # ACME symbol/label file
│   ├── blend65.log         # Blend compiler stdout+stderr
│   ├── acme.log            # ACME assembler stdout+stderr
│   ├── vice/               # VICE verification output (if expected.json exists)
│   │   ├── dump_screen.bin # Screen memory dump ($0400-$07FF)
│   │   ├── dump_vic.bin    # VIC-II register dump ($D000-$D3FF)
│   │   ├── dump_zeropage.bin # Zero page dump ($00-$FF)
│   │   ├── vice.log        # VICE emulator log
│   │   └── vice-summary.txt # VICE verification results
│   └── vice-run.log        # VICE runner log
├── O1/ O1s/ O1z/ O2/ Os/ Oz/ O3/ O3s/ O3z/
│   └── ... (same structure per level)
├── analysis/
│   ├── O0-metrics.txt      # Per-level assembly metrics
│   ├── O1-metrics.txt ... O3-metrics.txt ...
│   ├── size-regressions.txt # Size regression report
│   ├── stack-balance-O0.txt # PHA/PLA balance check
│   └── redundancies-O0.txt # Redundancy pattern detection
├── diffs/
│   ├── O0-vs-O1.diff       # Assembly diffs (O0 as baseline)
│   ├── O0-vs-O2.diff
│   └── ...
├── label-map.txt            # ACME label addresses (O0)
├── prg-validation.txt       # PRG binary validation results
└── summary.txt              # Comprehensive summary with all results
```

### Key Files to Read (in order)
1. `summary.txt` — Overall pass/fail, sizes, metrics, stack balance, redundancies
2. Failed `blend65.log` or `acme.log` — Error details
3. `diffs/O0-vs-<level>.diff` — What the optimizer changed
4. `O0/output-debug.asm` — Source-to-assembly mapping
5. `sources/*.blend` — Original source code
6. `O0/vice/vice-summary.txt` — VICE runtime verification results (if available)
7. `analysis/size-regressions.txt` — Optimized levels larger than O0
8. `analysis/stack-balance-O0.txt` — PHA/PLA imbalance detection

---

## **Integration with Other Rules**

This diagnostic protocol:
- ✅ Follows `.clinerules/agents.md` for shell commands (`clear &&` prefix)
- ✅ Uses `yarn build` (never npm) per Rule 1
- ✅ Creates no inline debug scripts per Rule 10
- ✅ Follows `.clinerules/specification-compliance.md` for language feature verification
- ✅ Can trigger `make_plan` for compiler bug fixes

---

## **Trigger Variations**

| Trigger | Behavior |
|---------|----------|
| `diag_app <file>` | Full diagnostic (this protocol) |
| `diag_app <file> <output-dir>` | Full diagnostic with custom output directory |

---

## **VICE Runtime Verification (expected.json)**

### **What It Does**

When an `expected.json` file exists alongside the source `.blend` file, `diag_app.sh` automatically runs each PRG in the VICE C64 emulator and verifies that runtime memory/register state matches expected values. This catches **semantic bugs** that static analysis cannot detect.

### **How It Works**

1. VICE launches in warp mode with `-limitcycles` (default 10M = ~10 sec at 1MHz)
2. A monitor script dumps standard C64 memory regions after execution
3. `diag_vice.sh` compares dump contents against `expected.json` checks
4. Results appear in `vice-summary.txt` per optimization level

### **VICE Memory Regions Dumped**

| Region | Address Range | Dump File | Description |
|--------|--------------|-----------|-------------|
| Zero page | `$0000-$00FF` | `dump_zeropage.bin` | Compiler temp vars |
| Screen | `$0400-$07FF` | `dump_screen.bin` | 40x25 character grid |
| Color RAM | `$D800-$DBFF` | `dump_colorram.bin` | Per-cell color nybbles |
| VIC-II | `$D000-$D3FF` | `dump_vic.bin` | Video chip registers |
| SID | `$D400-$D7FF` | `dump_sid.bin` | Sound chip registers |
| Sprite ptrs | `$07F8-$07FF` | `dump_sprite_ptrs.bin` | Default sprite pointers |
| CIA1 | `$DC00-$DCFF` | `dump_cia1.bin` | Keyboard, joystick |
| CIA2 | `$DD00-$DDFF` | `dump_cia2.bin` | Serial, VIC bank |

**⚠️ NOTE:** All dump files include a 2-byte load address header. Offset formula: `file_offset = (addr - region_start) + 2`

**⚠️ NOTE:** VIC-II color registers ($D020-$D02E) have undefined upper nibble on readback. Always mask with `& $0F`.

### **expected.json Format**

```json
{
  "description": "What this test verifies",
  "cycles": 10000000,
  "memory_checks": [
    {
      "address": "0400",
      "expected": "08",
      "description": "Number of tests",
      "source": "dump_screen.bin",
      "region_start": "0400"
    },
    {
      "address": "0401",
      "expected": "08",
      "description": "Number of passed tests",
      "source": "dump_screen.bin",
      "region_start": "0400"
    }
  ],
  "stack_check": {
    "sp_min": "F0",
    "description": "Stack pointer near top — no leak"
  }
}
```

**Key fields:**
- `address` — Absolute C64 address to check (hex, no `$` prefix)
- `expected` — Expected byte value (hex, 2 chars)
- `source` — Which dump file contains this address
- `region_start` — Base address of the dump region (for offset calc)
- `cycles` — How many cycles to run before dumping (default: 10M)
- `stack_check.sp_min` — Minimum acceptable stack pointer value

### **Test Suite Pattern**

Test programs in `examples/test-suite/` use a standard pattern:
- Write test results to screen memory: `$0400` = test count, `$0401` = pass count, `$0402+` = per-test pass/fail (`$01`=pass, `$00`=fail)
- Signal completion with `poke($C000, $42)` sentinel
- Halt with `while(true) { barrier(); }` to let VICE dump memory

### **Test Suite Programs (18 total)**

| # | Test | Focus | Sub-tests |
|---|------|-------|-----------|
| 01 | byte-arithmetic | Addition, subtraction, multiply, divide, modulo, shifts | 8 |
| 02 | word-arithmetic | Word add, subtract, lo/hi extraction | 6 |
| 03 | bitwise-ops | AND, OR, XOR, NOT, shifts, combined | 8 |
| 04 | control-flow | While loops, if/else, nested while, boolean conditions | 6 |
| 05 | function-calls | Params, return values, multi-param, nested calls | 6 |
| 06 | memory-ops | poke/peek, scratch memory, boundary addresses | 6 |
| 07 | vic-border-bg | VIC-II border/background color registers | 6 |
| 08 | screen-fill | Screen memory fill patterns | 6 |
| 09 | color-ram | Color RAM write/read patterns | 6 |
| 10 | charset-switch | VIC-II charset pointer ($D018) | 3 |
| 11 | sprite-enable | VIC-II sprite registers ($D015, $D000-$D00F) | 6 |
| 12 | data-arrays | @data storage class array access | 6 |
| 13 | large-data | Large @data arrays (32+ elements) | 6 |
| 14 | address-compute | Address-of (@) operator, pokew/peekw | 6 |
| 15 | multi-function | Multi-function calls, recursive factorial, chaining | 6 |
| 16 | loop-memory | While loops writing to scratch memory | 6 |
| 17 | word-index-array | Word-sized pokew/peekw, word addressing | 6 |
| 18 | full-pipeline | Integration: functions+loops+@data+control-flow+word | 6 |

---

## **Batch Mode (diag_batch.sh)**

### **Usage**

```bash
# Run all test programs in the test suite
clear && ./scripts/diag_batch.sh examples/test-suite/

# Run all examples (including non-test programs)
clear && ./scripts/diag_batch.sh examples/

# Custom output directory
clear && ./scripts/diag_batch.sh examples/test-suite/ build/diag/batch-test
```

### **What It Does**

1. **Discovers** test programs (folders containing `main.blend`)
2. **Builds** compiler once (shared across all tests)
3. **Runs** `diag_app.sh` for each test (with `BLEND65_SKIP_BUILD=1`)
4. **Runs** `diag_vice.sh` for tests with `expected.json`
5. **Generates** central `batch-report.md` with summary table
6. **Analyzes** cross-program patterns (common warnings, failure categories)

### **Output**

```
build/diag/batch/
├── <test-name>/           # Per-test diag_app.sh output
│   ├── summary.txt
│   ├── O0/ O1/ ...
│   └── ...
├── batch-report.md        # Central markdown report with summary table
└── batch-summary.txt      # Plain-text summary
```

### **Batch Report Contents**

The `batch-report.md` includes:
- Per-test pass/fail table (compile + ACME + VICE per level)
- VICE verification results (checks passed/failed per test)
- Cross-program analysis (common warnings, failure patterns)
- PRG size comparison across tests

---

## **Success Criteria**

The diagnostic is complete when:

1. ✅ Script has been run and all output captured
2. ✅ Language specification reviewed for relevant features
3. ✅ Summary has been read and analyzed
4. ✅ Source code analyzed against language specification
5. ✅ All failures have been investigated with evidence
6. ✅ Bug has been classified into exactly one category
7. ✅ Diagnostic report has been presented to the user
8. ✅ Next steps have been recommended
