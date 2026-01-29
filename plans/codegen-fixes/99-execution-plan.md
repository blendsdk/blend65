# Execution Plan: Code Generator Fixes

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Total Phases**: 18 (PRE + 0-9 + 2A-2F + 7A)
> **Total Sessions**: 56-75
> **Estimated Time**: 175-250 hours

---

## 🚨 CRITICAL: THIS IS THE FINAL FIX 🚨

**THIS IS OUR FINAL CHANCE TO MAKE THE CODE GENERATOR 100% WORKING.**

After completing this plan, ALL compiler components (lexer → parser → semantic → IL → codegen → ASM output) **MUST BE BUG-FREE**.

### What "100% Working" Means:
- ✅ Every language feature compiles correctly
- ✅ Generated assembly is semantically correct
- ✅ No STUB comments, no WARNING comments
- ✅ All tests pass
- ✅ Real programs work

### What's Excluded (Acceptable):
- Optimizer: Not fully implemented (passthrough OK)
- ASM-IL Optimizer: Not fully implemented (passthrough OK)
- Standard Library: Not complete yet
- Linking: ACME handles this

### NO MORE CYCLES OF:
- ❌ "This is broken"
- ❌ "We forgot this gap"
- ❌ "That feature doesn't work"

**IF THIS PLAN FAILS, THE PROJECT HAS FAILED AND ALL WORK IS FOR NOTHING.**

---

## Overview

This document defines the execution phases and AI chat sessions for implementing ALL code generator fixes. Each session is designed to fit within AI context limits (~30 minutes of focused work).

---

## Implementation Phases Summary

| Phase | Title | Sessions | Est. Hours | REQs |
|-------|-------|----------|------------|------|
| **PRE** | **Comprehensive Test Programs** | **4-6** | **15-20** | **VERIFICATION** |
| 0 | Test Infrastructure | 3-4 | 8-12 | REQ-10 |
| 1 | Value Tracking | 4-5 | 12-16 | REQ-01, REQ-09 |
| 2 | Missing IL Opcodes | 5-6 | 16-20 | REQ-04, REQ-07, REQ-12 |
| **2A** | **Intrinsics Code Generation** | **3-4** | **10-14** | **NEW** |
| **2B** | **Unary Operators** | **2-3** | **6-10** | **NEW** |
| **2C** | **Compound Assignments** | **2-3** | **6-10** | **NEW** |
| **2D** | **Control Flow Completeness** | **3-4** | **10-14** | **NEW** |
| **2E** | **@map Struct Forms** | **2-3** | **6-10** | **NEW** |
| **2F** | **Array Operations** | **2-3** | **6-10** | **NEW** |
| 3 | PHI Node Lowering | 3-4 | 10-14 | REQ-02 |
| 4 | Calling Convention | 3-4 | 10-14 | REQ-03 |
| 5 | String Literals | 2-3 | 6-10 | REQ-05 |
| 6 | Word Operations | 3-4 | 10-14 | REQ-06 |
| 7 | Register Allocation | 4-5 | 12-16 | REQ-08 |
| **7A** | **Callback Functions** | **2-3** | **6-10** | **NEW** |
| 8 | Module System | 2-3 | 6-10 | REQ-11 |
| 9 | Correctness Tests | 6-8 | 20-30 | REQ-10 |

**🚨 NEW PHASES ADDED (7 total, ~50-70 additional hours):**
- Phase 2A: All 15+ compiler intrinsics (peek, poke, sei, cli, etc.)
- Phase 2B: Unary operators (-, ~, !, @)
- Phase 2C: Compound assignments (+=, -=, *=, etc.)
- Phase 2D: Control flow completeness (switch, break, continue, ternary)
- Phase 2E: @map struct forms (sequential and explicit layout)
- Phase 2F: Array operations (complex indexing, word arrays)
- Phase 7A: Callback functions (RTI, function pointers)

---

## 🚨 Phase PRE: Comprehensive Test Programs (MANDATORY FIRST)

**THIS PHASE MUST BE COMPLETED BEFORE ANY IMPLEMENTATION WORK.**

**Objective**: Create comprehensive test programs that exercise EVERY language feature defined in the specification. These programs become the validation criteria for "done".

### Why This Phase is Critical

Without comprehensive test programs:
- ❌ We don't know what's actually broken
- ❌ We might miss features during implementation
- ❌ We can't verify the fixes work
- ❌ We'll discover "forgotten gaps" later

With comprehensive test programs:
- ✅ We know EXACTLY what needs to work
- ✅ We have concrete validation criteria
- ✅ No surprises or "forgotten features"
- ✅ Clear definition of "done"

### Phase PRE Steps (MANDATORY)

#### Step 1: Read Language Specification Systematically

**Files to read in order:**
| Order | Document | Purpose |
|-------|----------|---------|
| 1 | `docs/language-specification/README.md` | Overview |
| 2 | `docs/language-specification/01-lexical-structure.md` | Tokens, literals |
| 3 | `docs/language-specification/02-grammar.md` | EBNF grammar |
| 4 | `docs/language-specification/05-type-system.md` | Types |
| 5 | `docs/language-specification/06-expressions-statements.md` | Operators, precedence |
| 6 | `docs/language-specification/10-variables.md` | Variable declarations |
| 7 | `docs/language-specification/11-functions.md` | Functions |
| 8 | `docs/language-specification/12-memory-mapped.md` | @map system |
| 9 | `docs/language-specification/13-6502-features.md` | Intrinsics |

**Deliverable**: Feature checklist extracted from spec

#### Step 2: Create Comprehensive Test Programs

**Location**: `packages/compiler/fixtures/99-comprehensive/`

**Structure**:
```
fixtures/99-comprehensive/
├── 01-types/
│   ├── byte-operations.blend       # All byte arithmetic
│   ├── word-operations.blend       # All word (16-bit) arithmetic
│   ├── bool-operations.blend       # Boolean logic
│   └── type-conversions.blend      # byte↔word, bool↔byte
├── 02-expressions/
│   ├── arithmetic.blend            # +, -, *, /, %
│   ├── comparison.blend            # ==, !=, <, >, <=, >=
│   ├── bitwise.blend               # &, |, ^, ~, <<, >>
│   ├── logical.blend               # &&, ||, !
│   └── precedence.blend            # Operator precedence
├── 03-control-flow/
│   ├── if-else.blend               # If/else statements
│   ├── while-loop.blend            # While loops
│   ├── for-loop.blend              # For loops
│   └── nested-control.blend        # Nested control flow
├── 04-functions/
│   ├── no-params.blend             # Functions without parameters
│   ├── single-param.blend          # Single parameter
│   ├── multi-params.blend          # Multiple parameters
│   ├── return-byte.blend           # Return byte
│   ├── return-word.blend           # Return word
│   └── recursion.blend             # Recursive functions
├── 05-memory/
│   ├── hardware-access.blend       # @map at $XXXX
│   ├── map-range.blend             # @map range
│   ├── map-struct.blend            # @map struct
│   ├── arrays.blend                # Array operations
│   └── pointers.blend              # Pointer/address operations
├── 06-intrinsics/
│   ├── peek-poke.blend             # peek(), poke()
│   ├── cpu-flags.blend             # sei(), cli(), etc.
│   └── address-ops.blend           # @variable, sizeof()
└── 07-integration/
    ├── simple-program.blend        # Basic complete program
    ├── medium-program.blend        # More complex
    └── c64-demo.blend              # Real C64 patterns
```

**Each file MUST**:
- Test ONE specific feature category
- Include multiple test cases within that category
- Cover edge cases and boundary conditions
- Be syntactically valid according to spec
- Include comments explaining what's being tested

**Deliverable**: 25-30 comprehensive `.blend` test files

#### Step 3: Run Current Compiler on Test Programs

**For each test file:**
```bash
# Compile to ASM
yarn --cwd packages/compiler build
node packages/cli/bin/blend65.js compile fixtures/99-comprehensive/XX-category/test.blend -o build/test.asm

# Inspect output for:
# - STUB comments
# - WARNING comments  
# - Missing code
# - Errors
```

**Deliverable**: Document all failures and issues

#### Step 4: Document All Failures

**Create**: `COMPREHENSIVE-TEST-FAILURES.md`

**Format**:
```markdown
# Comprehensive Test Failures

## Summary
- Total test files: XX
- Compiling successfully: XX
- With errors: XX
- With warnings: XX
- With STUBs: XX

## By Category

### 01-types/byte-operations.blend
- ❌ `a + b` produces STUB
- ❌ `a * b` produces STUB
- ⚠️ WARNING: Unknown value location for...

### 01-types/word-operations.blend
- ❌ 16-bit addition: only low byte handled
- ...
```

**Deliverable**: Complete failure documentation

#### Step 5: Update Plan If Gaps Found

**Compare failure list to codegen-fixes plan:**
- Is every failure addressed by a phase?
- Are there failures NOT covered?
- Are there features in the spec that we missed?

**If gaps found:**
- Add missing tasks to appropriate phase
- Create new phase if needed
- Update task checklist

**Deliverable**: Updated plan covering ALL failures

---

### Phase PRE Sessions

#### Session PRE.1: Read Spec + Create Feature Checklist (3-4 hours)

**Tasks**:
| # | Task | Description |
|---|------|-------------|
| PRE.1.1 | Read language spec sections 1-6 | Understand ALL language features |
| PRE.1.2 | Read language spec sections 10-13 | Variables, functions, @map, intrinsics |
| PRE.1.3 | Create feature checklist | Every feature that must work |
| PRE.1.4 | Identify test categories | Group features for test files |

**Deliverables**:
- [ ] Complete feature checklist from spec
- [ ] Test file category plan

#### Session PRE.2: Create Type & Expression Tests (3-4 hours)

**Tasks**:
| # | Task | Description |
|---|------|-------------|
| PRE.2.1 | Create `01-types/` test files | byte, word, bool, conversions |
| PRE.2.2 | Create `02-expressions/` test files | arithmetic, comparison, bitwise, logical |
| PRE.2.3 | Verify each file is syntactically valid | Parser accepts without errors |

**Deliverables**:
- [ ] 8+ type/expression test files
- [ ] All parse successfully

#### Session PRE.3: Create Control Flow & Function Tests (3-4 hours)

**Tasks**:
| # | Task | Description |
|---|------|-------------|
| PRE.3.1 | Create `03-control-flow/` test files | if, while, for, nested |
| PRE.3.2 | Create `04-functions/` test files | params, returns, recursion |
| PRE.3.3 | Verify each file is syntactically valid | Parser accepts without errors |

**Deliverables**:
- [ ] 10+ control/function test files
- [ ] All parse successfully

#### Session PRE.4: Create Memory & Intrinsic Tests (3-4 hours)

**Tasks**:
| # | Task | Description |
|---|------|-------------|
| PRE.4.1 | Create `05-memory/` test files | @map, arrays, pointers |
| PRE.4.2 | Create `06-intrinsics/` test files | peek, poke, cpu flags |
| PRE.4.3 | Create `07-integration/` test files | Complete programs |

**Deliverables**:
- [ ] 10+ memory/intrinsic test files
- [ ] All parse successfully

#### Session PRE.5: Run Tests & Document Failures (3-4 hours)

**Tasks**:
| # | Task | Description |
|---|------|-------------|
| PRE.5.1 | Run compiler on ALL test files | Capture all output |
| PRE.5.2 | Document EVERY failure/warning | COMPREHENSIVE-TEST-FAILURES.md |
| PRE.5.3 | Compare to current plan | Identify gaps |
| PRE.5.4 | Update plan if needed | Add missing tasks |

**Deliverables**:
- [ ] `COMPREHENSIVE-TEST-FAILURES.md` complete
- [ ] Plan updated to cover ALL failures
- [ ] Confirmation: plan covers EVERY language feature

---

### Phase PRE Checklist

- [ ] PRE.1.1 Read language spec sections 1-6
- [ ] PRE.1.2 Read language spec sections 10-13
- [ ] PRE.1.3 Create feature checklist
- [ ] PRE.1.4 Identify test categories
- [ ] PRE.2.1 Create type test files
- [ ] PRE.2.2 Create expression test files
- [ ] PRE.2.3 Verify type/expression files parse
- [ ] PRE.3.1 Create control flow test files
- [ ] PRE.3.2 Create function test files
- [ ] PRE.3.3 Verify control/function files parse
- [ ] PRE.4.1 Create memory test files
- [ ] PRE.4.2 Create intrinsic test files
- [ ] PRE.4.3 Create integration test files
- [ ] PRE.5.1 Run compiler on all test files
- [ ] PRE.5.2 Document all failures
- [ ] PRE.5.3 Compare to plan
- [ ] PRE.5.4 Update plan if gaps found

**Phase PRE is COMPLETE when:**
- ✅ 25-30 comprehensive test files created
- ✅ All failures documented
- ✅ Plan updated to cover ALL failures
- ✅ No language features missing from plan

---

## Phase 0: Test Infrastructure

**Objective**: Build test tools BEFORE making any fixes to ensure we can verify correctness.

### Session 0.1: ASM Sequence Validator

**Files**: `__tests__/e2e/helpers/asm-validator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 0.1.1 | Create ASM sequence matcher utility | `asm-validator.ts` |
| 0.1.2 | Add pattern matching for instruction sequences | `asm-validator.ts` |
| 0.1.3 | Add tests for the validator itself | `asm-validator.test.ts` |

**Deliverables**:
- [ ] `expectAsmSequence()` function
- [ ] `expectNoStubs()` function
- [ ] Unit tests for validator

### Session 0.2: Golden Output Test Framework

**Files**: `__tests__/e2e/helpers/golden-tests.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 0.2.1 | Create golden output comparison utility | `golden-tests.ts` |
| 0.2.2 | Create initial golden output snapshots | `fixtures/golden/` |
| 0.2.3 | Add snapshot update mechanism | `golden-tests.ts` |

**Deliverables**:
- [ ] `compareGoldenOutput()` function
- [ ] Initial golden snapshots
- [ ] Snapshot update command

### Session 0.3: Value Tracking Test Helpers

**Files**: `__tests__/e2e/helpers/value-tracking.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 0.3.1 | Create value flow analysis helper | `value-tracking.ts` |
| 0.3.2 | Add IL-to-ASM value mapping | `value-tracking.ts` |
| 0.3.3 | Add tests for value tracking | `value-tracking.test.ts` |

**Deliverables**:
- [ ] `analyzeValueFlow()` function
- [ ] IL value to ASM location mapper
- [ ] Test helpers working

**Verify**: `./compiler-test e2e`

---

## Phase 1: Fix Value Tracking

**Objective**: Ensure values are never lost when A register is overwritten.

### Session 1.1: Design Spill Infrastructure

**Files**: `codegen/base-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Design ZP spill area ($60-$7F) | `base-generator.ts` |
| 1.1.2 | Add `nextSpillSlot` tracking | `base-generator.ts` |
| 1.1.3 | Create `allocateSpillSlot()` method | `base-generator.ts` |
| 1.1.4 | Create `freeSpillSlot()` method | `base-generator.ts` |

**Deliverables**:
- [ ] Spill slot allocation working
- [ ] ZP range reserved for spills

### Session 1.2: Implement Spill/Reload

**Files**: `codegen/base-generator.ts`, `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.2.1 | Create `spillValueToZP()` method | `base-generator.ts` |
| 1.2.2 | Create `reloadValueFromZP()` method | `base-generator.ts` |
| 1.2.3 | Update `valueLocations` to track spill slots | `base-generator.ts` |
| 1.2.4 | Add STA/LDA emission for spills | `instruction-generator.ts` |

**Deliverables**:
- [ ] Values can be spilled to ZP
- [ ] Values can be reloaded from ZP
- [ ] Location tracking updated

### Session 1.3: Fix Binary Operations

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.3.1 | Update `generateBinaryOp()` to save left operand | `instruction-generator.ts` |
| 1.3.2 | Load right operand after saving left | `instruction-generator.ts` |
| 1.3.3 | Perform operation with correct operand locations | `instruction-generator.ts` |
| 1.3.4 | Test: `a + b` where both are variables | tests |

**Deliverables**:
- [ ] Binary add with two variables works
- [ ] Binary sub with two variables works
- [ ] Binary mul with two variables works

### Session 1.4: Test Value Tracking

**Files**: `__tests__/e2e/correctness/value-tracking.test.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.4.1 | Create value preservation tests | `value-tracking.test.ts` |
| 1.4.2 | Test multiple operations in sequence | `value-tracking.test.ts` |
| 1.4.3 | Test reuse of same variable | `value-tracking.test.ts` |
| 1.4.4 | Verify no STUB comments | `value-tracking.test.ts` |

**Deliverables**:
- [ ] 20+ value tracking tests
- [ ] All tests pass
- [ ] No STUB comments in output

**Verify**: `./compiler-test e2e`

---

## Phase 2: Missing IL Opcodes

**Objective**: Implement all 15+ missing IL opcode handlers.

### Session 2.1: Type Conversion Opcodes

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Implement ZERO_EXTEND (byte → word) | `instruction-generator.ts` |
| 2.1.2 | Implement TRUNCATE (word → byte) | `instruction-generator.ts` |
| 2.1.3 | Implement BOOL_TO_BYTE | `instruction-generator.ts` |
| 2.1.4 | Implement BYTE_TO_BOOL | `instruction-generator.ts` |

**Deliverables**:
- [ ] Type conversions work correctly
- [ ] Tests for each conversion

### Session 2.2: Struct Access Opcodes

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.2.1 | Implement LOAD_FIELD | `instruction-generator.ts` |
| 2.2.2 | Implement STORE_FIELD | `instruction-generator.ts` |
| 2.2.3 | Implement UNDEF | `instruction-generator.ts` |
| 2.2.4 | Add tests for struct access | tests |

**Deliverables**:
- [ ] Struct field read works
- [ ] Struct field write works

### Session 2.3: @map Struct Opcodes

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.3.1 | Implement MAP_LOAD_FIELD | `instruction-generator.ts` |
| 2.3.2 | Implement MAP_STORE_FIELD | `instruction-generator.ts` |
| 2.3.3 | Implement MAP_LOAD_RANGE | `instruction-generator.ts` |
| 2.3.4 | Implement MAP_STORE_RANGE | `instruction-generator.ts` |

**Deliverables**:
- [ ] @map struct access works
- [ ] @map range access works

### Session 2.4: Short-Circuit Opcodes

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.4.1 | Implement LOGICAL_AND with branching | `instruction-generator.ts` |
| 2.4.2 | Implement LOGICAL_OR with branching | `instruction-generator.ts` |
| 2.4.3 | Test short-circuit behavior | tests |
| 2.4.4 | Verify side effects not evaluated | tests |

**Deliverables**:
- [ ] `&&` short-circuits correctly
- [ ] `||` short-circuits correctly

### Session 2.5: Remaining Opcodes

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.5.1 | Implement CALL_INDIRECT | `instruction-generator.ts` |
| 2.5.2 | Implement INTRINSIC_LENGTH | `instruction-generator.ts` |
| 2.5.3 | Verify no opcodes fall through | `instruction-generator.ts` |
| 2.5.4 | Add tests for all new opcodes | tests |

**Deliverables**:
- [ ] All 15 opcodes implemented
- [ ] No placeholder fallthrough
- [ ] All opcode tests pass

**Verify**: `./compiler-test codegen`

---

## Phase 2A: Intrinsics Code Generation

**Objective**: Implement ALL 15+ compiler intrinsics defined in the language specification.

### Session 2A.1: Memory Access Intrinsics

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2A.1.1 | Implement `peek(addr)` → `LDA addr` | `instruction-generator.ts` |
| 2A.1.2 | Implement `poke(addr, val)` → `STA addr` | `instruction-generator.ts` |
| 2A.1.3 | Implement `peekw(addr)` → `LDA addr / LDX addr+1` | `instruction-generator.ts` |
| 2A.1.4 | Implement `pokew(addr, val)` → `STA addr / STX addr+1` | `instruction-generator.ts` |

**Deliverables**:
- [ ] Memory intrinsics work correctly
- [ ] Tests for peek/poke

### Session 2A.2: CPU Control Intrinsics

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2A.2.1 | Implement `sei()` → `SEI` | `instruction-generator.ts` |
| 2A.2.2 | Implement `cli()` → `CLI` | `instruction-generator.ts` |
| 2A.2.3 | Implement `nop()` → `NOP` | `instruction-generator.ts` |
| 2A.2.4 | Implement `brk()` → `BRK` | `instruction-generator.ts` |

**Deliverables**:
- [ ] CPU control intrinsics work
- [ ] Tests for sei/cli/nop/brk

### Session 2A.3: Stack & Byte Extraction Intrinsics

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2A.3.1 | Implement `pha()` → `PHA` | `instruction-generator.ts` |
| 2A.3.2 | Implement `pla()` → `PLA` | `instruction-generator.ts` |
| 2A.3.3 | Implement `php()` → `PHP` | `instruction-generator.ts` |
| 2A.3.4 | Implement `plp()` → `PLP` | `instruction-generator.ts` |
| 2A.3.5 | Implement `lo(word)` → extract low byte | `instruction-generator.ts` |
| 2A.3.6 | Implement `hi(word)` → extract high byte | `instruction-generator.ts` |

**Deliverables**:
- [ ] Stack intrinsics work
- [ ] Byte extraction works

### Session 2A.4: Compile-Time Intrinsics

**Files**: `codegen/instruction-generator.ts`, `il/generator/expressions.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2A.4.1 | Implement `sizeof(type)` → compile-time constant | `expressions.ts` |
| 2A.4.2 | Verify `length(array)` works | `instruction-generator.ts` |
| 2A.4.3 | Add comprehensive intrinsic tests | tests |
| 2A.4.4 | Verify ALL 15+ intrinsics work | tests |

**Deliverables**:
- [ ] All intrinsics implemented
- [ ] 30+ intrinsic tests

**Verify**: `./compiler-test codegen`

---

## Phase 2B: Unary Operators

**Objective**: Implement all unary operators for correct code generation.

### Session 2B.1: Arithmetic & Bitwise Unary

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2B.1.1 | Implement `-x` (negation) → `SEC / LDA #0 / SBC x` | `instruction-generator.ts` |
| 2B.1.2 | Implement `~x` (bitwise NOT) → `EOR #$FF` | `instruction-generator.ts` |
| 2B.1.3 | Test byte negation | tests |
| 2B.1.4 | Test byte bitwise NOT | tests |

**Deliverables**:
- [ ] Negation works for bytes
- [ ] Bitwise NOT works

### Session 2B.2: Logical NOT & Address-Of

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2B.2.1 | Implement `!x` (logical NOT) → branch pattern | `instruction-generator.ts` |
| 2B.2.2 | Implement `@var` (address-of) → `LDA #<var / LDX #>var` | `instruction-generator.ts` |
| 2B.2.3 | Test logical NOT | tests |
| 2B.2.4 | Test address-of operator | tests |

**Deliverables**:
- [ ] Logical NOT produces 0 or 1
- [ ] Address-of returns correct 16-bit address
- [ ] 15+ unary operator tests

**Verify**: `./compiler-test codegen`

---

## Phase 2C: Compound Assignments

**Objective**: Implement all compound assignment operators.

### Session 2C.1: Arithmetic Compound Assignments

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2C.1.1 | Implement `x += y` → read-modify-write | `instruction-generator.ts` |
| 2C.1.2 | Implement `x -= y` → read-modify-write | `instruction-generator.ts` |
| 2C.1.3 | Implement `x *= y` → read-modify-write | `instruction-generator.ts` |
| 2C.1.4 | Implement `x /= y` → read-modify-write | `instruction-generator.ts` |
| 2C.1.5 | Implement `x %= y` → read-modify-write | `instruction-generator.ts` |

**Deliverables**:
- [ ] Arithmetic compound assignments work
- [ ] Tests for +=, -=, *=, /=, %=

### Session 2C.2: Bitwise Compound Assignments

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2C.2.1 | Implement `x &= y` → AND-and-store | `instruction-generator.ts` |
| 2C.2.2 | Implement `x |= y` → OR-and-store | `instruction-generator.ts` |
| 2C.2.3 | Implement `x ^= y` → XOR-and-store | `instruction-generator.ts` |
| 2C.2.4 | Implement `x <<= n` → shift-and-store | `instruction-generator.ts` |
| 2C.2.5 | Implement `x >>= n` → shift-and-store | `instruction-generator.ts` |

**Deliverables**:
- [ ] Bitwise compound assignments work
- [ ] Shift compound assignments work
- [ ] 20+ compound assignment tests

**Verify**: `./compiler-test codegen`

---

## Phase 2D: Control Flow Completeness

**Objective**: Verify and fix ALL control flow constructs.

### Session 2D.1: Switch Statement

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2D.1.1 | Verify/implement switch statement codegen | `instruction-generator.ts` |
| 2D.1.2 | Implement case label handling | `instruction-generator.ts` |
| 2D.1.3 | Implement default case | `instruction-generator.ts` |
| 2D.1.4 | Test switch with multiple cases | tests |

**Deliverables**:
- [ ] Switch statement generates correct branches
- [ ] Case labels work
- [ ] Default case works

### Session 2D.2: Break & Continue

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2D.2.1 | Verify/implement `break` → JMP to loop exit | `instruction-generator.ts` |
| 2D.2.2 | Verify/implement `continue` → JMP to loop start | `instruction-generator.ts` |
| 2D.2.3 | Test break in while loop | tests |
| 2D.2.4 | Test continue in for loop | tests |

**Deliverables**:
- [ ] Break exits loops correctly
- [ ] Continue skips to next iteration

### Session 2D.3: Ternary Operator

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2D.3.1 | Implement ternary `?:` → branch pattern | `instruction-generator.ts` |
| 2D.3.2 | Test simple ternary `(a > b) ? a : b` | tests |
| 2D.3.3 | Test ternary as expression value | tests |
| 2D.3.4 | Test nested ternary | tests |

**Deliverables**:
- [ ] Ternary operator works
- [ ] 15+ control flow completeness tests

**Verify**: `./compiler-test codegen`

---

## Phase 2E: @map Struct Forms

**Objective**: Implement ALL 4 forms of @map declarations.

### Session 2E.1: Sequential Struct @map

**Files**: `codegen/instruction-generator.ts`, `codegen/globals-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2E.1.1 | Implement sequential struct field offset calculation | `instruction-generator.ts` |
| 2E.1.2 | Implement sequential struct field read | `instruction-generator.ts` |
| 2E.1.3 | Implement sequential struct field write | `instruction-generator.ts` |
| 2E.1.4 | Test: `@map sid at $D400 type { freqLo: byte, freqHi: byte }` | tests |

**Deliverables**:
- [ ] Sequential struct @map reads work
- [ ] Sequential struct @map writes work

### Session 2E.2: Explicit Layout @map

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2E.2.1 | Implement explicit field address lookup | `instruction-generator.ts` |
| 2E.2.2 | Implement explicit field read | `instruction-generator.ts` |
| 2E.2.3 | Implement explicit field write | `instruction-generator.ts` |
| 2E.2.4 | Test: `@map vic at $D000 layout { border: at $D020: byte }` | tests |

**Deliverables**:
- [ ] Explicit layout @map reads work
- [ ] Explicit layout @map writes work
- [ ] 15+ @map struct tests

**Verify**: `./compiler-test codegen`

---

## Phase 2F: Array Operations

**Objective**: Implement ALL array access patterns.

### Session 2F.1: Complex Array Indexing

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2F.1.1 | Verify constant index: `arr[5]` → direct address | `instruction-generator.ts` |
| 2F.1.2 | Verify variable index: `arr[i]` → indexed mode | `instruction-generator.ts` |
| 2F.1.3 | Implement expression index: `arr[i + 1]` | `instruction-generator.ts` |
| 2F.1.4 | Test array read with expression index | tests |

**Deliverables**:
- [ ] Constant index works
- [ ] Variable index works
- [ ] Expression index works

### Session 2F.2: Word Arrays & Multi-dimensional

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 2F.2.1 | Implement word array access (2-byte stride) | `instruction-generator.ts` |
| 2F.2.2 | Implement multi-dimensional array offset calculation | `instruction-generator.ts` |
| 2F.2.3 | Test: `let addrs: word[10]; addrs[i]` | tests |
| 2F.2.4 | Test: `let matrix: byte[25][40]; matrix[y][x]` | tests |

**Deliverables**:
- [ ] Word arrays access correct bytes
- [ ] Multi-dimensional offset calculation correct
- [ ] 15+ array operation tests

**Verify**: `./compiler-test codegen`

---

## Phase 3: PHI Node Lowering

**Objective**: SSA-versioned values flow correctly through control flow.

### Session 3.1: SSA Value Tracking

**Files**: `codegen/base-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Extend valueLocations for SSA names | `base-generator.ts` |
| 3.1.2 | Track `v4:varName.0` format | `base-generator.ts` |
| 3.1.3 | Map versioned to base names | `base-generator.ts` |
| 3.1.4 | Add SSA value lookup | `base-generator.ts` |

**Deliverables**:
- [ ] SSA-versioned values tracked
- [ ] Lookup by versioned name works

### Session 3.2: PHI Source Loading

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.2.1 | Fix `handlePhiMovesForSuccessors()` | `instruction-generator.ts` |
| 3.2.2 | Load actual values, not 0 | `instruction-generator.ts` |
| 3.2.3 | Track PHI merge variables | `instruction-generator.ts` |
| 3.2.4 | Test if/else PHI merging | tests |

**Deliverables**:
- [ ] PHI sources load correct values
- [ ] No "WARNING: Cannot load" for PHI

### Session 3.3: Control Flow Tests

**Files**: `__tests__/e2e/correctness/phi-lowering.test.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.3.1 | Test if/else value merging | `phi-lowering.test.ts` |
| 3.3.2 | Test while loop variables | `phi-lowering.test.ts` |
| 3.3.3 | Test for loop iteration | `phi-lowering.test.ts` |
| 3.3.4 | Test nested control flow | `phi-lowering.test.ts` |

**Deliverables**:
- [ ] 25+ PHI tests
- [ ] All control flow works
- [ ] No PHI warnings

**Verify**: `./compiler-test e2e`

---

## Phase 4: Calling Convention

**Objective**: Functions can receive and return parameters.

### Session 4.1: Define ABI

**Files**: `codegen/base-generator.ts`, docs

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Document ABI (ZP $50-$5F for params) | `base-generator.ts` |
| 4.1.2 | Add parameter slot allocation | `base-generator.ts` |
| 4.1.3 | Define return value convention (A/A-X) | `base-generator.ts` |
| 4.1.4 | Add ABI constants | `base-generator.ts` |

**Deliverables**:
- [ ] ABI documented in code
- [ ] Parameter slots defined

### Session 4.2: Caller Implementation

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.2.1 | Update generateCall() for params | `instruction-generator.ts` |
| 4.2.2 | Load args to parameter slots | `instruction-generator.ts` |
| 4.2.3 | Update generateCallVoid() | `instruction-generator.ts` |
| 4.2.4 | Handle return value in A | `instruction-generator.ts` |

**Deliverables**:
- [ ] Caller sets up parameters
- [ ] No STUB comments for calls

### Session 4.3: Callee Implementation

**Files**: `codegen/code-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.3.1 | Add function prologue for params | `code-generator.ts` |
| 4.3.2 | Map params to parameter slots | `code-generator.ts` |
| 4.3.3 | Handle return statement | `instruction-generator.ts` |
| 4.3.4 | Test function with 1 param | tests |

**Deliverables**:
- [ ] Functions receive parameters
- [ ] Return values work

### Session 4.4: Calling Convention Tests

**Files**: `__tests__/e2e/correctness/calling.test.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.4.1 | Test single param | `calling.test.ts` |
| 4.4.2 | Test multiple params | `calling.test.ts` |
| 4.4.3 | Test return values (byte) | `calling.test.ts` |
| 4.4.4 | Test return values (word) | `calling.test.ts` |

**Deliverables**:
- [ ] 20+ calling tests
- [ ] All param counts work

**Verify**: `./compiler-test e2e`

---

## Phase 5: String Literals

**Objective**: String literals work correctly.

### Session 5.1: String Storage

**Files**: `codegen/globals-generator.ts`, `il/generator/expressions.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.1.1 | Track strings in module | `globals-generator.ts` |
| 5.1.2 | Allocate strings in data section | `globals-generator.ts` |
| 5.1.3 | Add null terminator | `globals-generator.ts` |
| 5.1.4 | Generate unique labels (_str_N) | `globals-generator.ts` |

**Deliverables**:
- [ ] Strings in data section
- [ ] Null-terminated
- [ ] Unique labels

### Session 5.2: String Address Loading

**Files**: `il/generator/expressions.ts`, `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.2.1 | Return string reference in IL | `expressions.ts` |
| 5.2.2 | Load string address (A=low, X=high) | `instruction-generator.ts` |
| 5.2.3 | Remove placeholder warning | `expressions.ts` |
| 5.2.4 | Test string compilation | tests |

**Deliverables**:
- [ ] String address returned correctly
- [ ] No warning about strings

**Verify**: `./compiler-test codegen`

---

## Phase 6: Word Operations

**Objective**: 16-bit operations work correctly.

### Session 6.1: Word Value Tracking

**Files**: `codegen/base-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 6.1.1 | Track A/X pair for words | `base-generator.ts` |
| 6.1.2 | Add word spill/reload (2 bytes) | `base-generator.ts` |
| 6.1.3 | Track high byte location | `base-generator.ts` |
| 6.1.4 | Add word tracking tests | tests |

**Deliverables**:
- [ ] Word values tracked (both bytes)
- [ ] Spill/reload for words

### Session 6.2: Word Arithmetic

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 6.2.1 | Fix word ADD (handle carry) | `instruction-generator.ts` |
| 6.2.2 | Fix word SUB (handle borrow) | `instruction-generator.ts` |
| 6.2.3 | Test word arithmetic | tests |
| 6.2.4 | Verify results are correct | tests |

**Deliverables**:
- [ ] Word addition with carry
- [ ] Word subtraction with borrow

### Session 6.3: Word Comparisons and Returns

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 6.3.1 | Fix word comparisons (both bytes) | `instruction-generator.ts` |
| 6.3.2 | Fix word returns (A/X pair) | `instruction-generator.ts` |
| 6.3.3 | Test word comparisons | tests |
| 6.3.4 | Test word returns | tests |

**Deliverables**:
- [ ] Word comparisons correct
- [ ] Word returns preserve both bytes

**Verify**: `./compiler-test codegen`

---

## Phase 7: Register Allocation

**Objective**: Proper use of A, X, Y registers.

### Session 7.1: Register Tracking

**Files**: `codegen/base-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 7.1.1 | Add register tracking (A, X, Y) | `base-generator.ts` |
| 7.1.2 | Track what value in each register | `base-generator.ts` |
| 7.1.3 | Add `isRegisterAvailable()` | `base-generator.ts` |
| 7.1.4 | Add `getValueRegister()` | `base-generator.ts` |

**Deliverables**:
- [ ] All registers tracked
- [ ] Know what's in each register

### Session 7.2: Register Selection

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 7.2.1 | Use X for temporary storage | `instruction-generator.ts` |
| 7.2.2 | Use Y for array indexing | `instruction-generator.ts` |
| 7.2.3 | Avoid redundant loads | `instruction-generator.ts` |
| 7.2.4 | Test complex expressions | tests |

**Deliverables**:
- [ ] X/Y used appropriately
- [ ] Fewer redundant loads

### Session 7.3: Complex Expression Tests

**Files**: `__tests__/e2e/correctness/expressions.test.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 7.3.1 | Test 3-operand expressions | `expressions.test.ts` |
| 7.3.2 | Test 4-operand expressions | `expressions.test.ts` |
| 7.3.3 | Test deeply nested expressions | `expressions.test.ts` |
| 7.3.4 | Verify mathematical correctness | `expressions.test.ts` |

**Deliverables**:
- [ ] Complex expressions work
- [ ] Results are correct

**Verify**: `./compiler-test e2e`

---

## Phase 7A: Callback Functions

**Objective**: Implement callback (interrupt handler) functions correctly.

### Session 7A.1: Callback Function Basics

**Files**: `codegen/code-generator.ts`, `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 7A.1.1 | Detect `callback function` declarations | `code-generator.ts` |
| 7A.1.2 | Generate RTI instead of RTS for callbacks | `code-generator.ts` |
| 7A.1.3 | Test callback function with RTI | tests |
| 7A.1.4 | Test regular function still uses RTS | tests |

**Deliverables**:
- [ ] Callback functions return with RTI
- [ ] Regular functions return with RTS

### Session 7A.2: Function Pointers

**Files**: `codegen/instruction-generator.ts`

**Tasks**:
| # | Task | File |
|---|------|------|
| 7A.2.1 | Implement function pointer assignment | `instruction-generator.ts` |
| 7A.2.2 | Store function address to variable | `instruction-generator.ts` |
| 7A.2.3 | Test: `let handler: callback = myIRQ` | tests |
| 7A.2.4 | Verify function address is correct | tests |

**Deliverables**:
- [ ] Function pointers work
- [ ] 10+ callback function tests

**Verify**: `./compiler-test codegen`

---

## Phase 8: Module System

**Objective**: Multi-file compilation works.

### Session 8.1: Import/Export Tests

**Files**: `__tests__/e2e/modules/`

**Tasks**:
| # | Task | File |
|---|------|------|
| 8.1.1 | Create multi-file test fixtures | `fixtures/` |
| 8.1.2 | Test import function | `modules.test.ts` |
| 8.1.3 | Test export function | `modules.test.ts` |
| 8.1.4 | Test cross-module calls | `modules.test.ts` |

**Deliverables**:
- [ ] Module tests created
- [ ] Imports work
- [ ] Exports work

### Session 8.2: Cross-Module Variables

**Files**: `__tests__/e2e/modules/`

**Tasks**:
| # | Task | File |
|---|------|------|
| 8.2.1 | Test import variable | `modules.test.ts` |
| 8.2.2 | Test export variable | `modules.test.ts` |
| 8.2.3 | Test library imports | `modules.test.ts` |
| 8.2.4 | Fix any issues found | codegen files |

**Deliverables**:
- [ ] Cross-module variables work
- [ ] Library imports work

**Verify**: `./compiler-test e2e`

---

## Phase 9: Correctness Tests

**Objective**: 300+ tests verifying code correctness.

### Session 9.1-9.4: Test Creation (4 sessions)

Create tests in batches of 50-75 per session:

**Session 9.1**: Value tracking tests (50)
**Session 9.2**: Binary operation tests (60)
**Session 9.3**: Control flow tests (50)
**Session 9.4**: Function call tests (50)

### Session 9.5-9.6: Edge Case Tests (2 sessions)

**Session 9.5**: Edge cases (40)
**Session 9.6**: Regression tests (50)

**Total Deliverables**:
- [ ] 300+ correctness tests
- [ ] All tests pass
- [ ] No STUB comments in any output

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase PRE: Comprehensive Test Programs
- [ ] PRE.1.1 Read language spec sections 1-6
- [ ] PRE.1.2 Read language spec sections 10-13
- [ ] PRE.1.3 Create feature checklist
- [ ] PRE.1.4 Identify test categories
- [ ] PRE.2.1 Create type test files (01-types/)
- [ ] PRE.2.2 Create expression test files (02-expressions/)
- [ ] PRE.2.3 Verify type/expression files parse
- [ ] PRE.3.1 Create control flow test files (03-control-flow/)
- [ ] PRE.3.2 Create function test files (04-functions/)
- [ ] PRE.3.3 Verify control/function files parse
- [ ] PRE.4.1 Create memory test files (05-memory/)
- [ ] PRE.4.2 Create intrinsic test files (06-intrinsics/)
- [ ] PRE.4.3 Create integration test files (07-integration/)
- [ ] PRE.5.1 Run compiler on ALL test files
- [ ] PRE.5.2 Document all failures (COMPREHENSIVE-TEST-FAILURES.md)
- [ ] PRE.5.3 Compare failures to plan - identify gaps
- [ ] PRE.5.4 Update plan if gaps found

### Phase 0: Test Infrastructure
- [ ] 0.1.1 Create ASM sequence matcher
- [ ] 0.1.2 Add pattern matching
- [ ] 0.1.3 Validator tests
- [ ] 0.2.1 Golden output comparison
- [ ] 0.2.2 Initial golden snapshots
- [ ] 0.2.3 Snapshot update mechanism
- [ ] 0.3.1 Value flow analysis
- [ ] 0.3.2 IL-to-ASM mapping
- [ ] 0.3.3 Value tracking tests

### Phase 1: Value Tracking
- [ ] 1.1.1 Design ZP spill area
- [ ] 1.1.2 Add nextSpillSlot
- [ ] 1.1.3 allocateSpillSlot()
- [ ] 1.1.4 freeSpillSlot()
- [ ] 1.2.1 spillValueToZP()
- [ ] 1.2.2 reloadValueFromZP()
- [ ] 1.2.3 Update valueLocations
- [ ] 1.2.4 STA/LDA for spills
- [ ] 1.3.1 Save left operand in binary ops
- [ ] 1.3.2 Load right after saving
- [ ] 1.3.3 Use correct operand locations
- [ ] 1.3.4 Test a + b (variables)
- [ ] 1.4.1-1.4.4 Value tracking tests (20+)

### Phase 2: Missing IL Opcodes
- [ ] 2.1.1 ZERO_EXTEND
- [ ] 2.1.2 TRUNCATE
- [ ] 2.1.3 BOOL_TO_BYTE
- [ ] 2.1.4 BYTE_TO_BOOL
- [ ] 2.2.1 LOAD_FIELD
- [ ] 2.2.2 STORE_FIELD
- [ ] 2.2.3 UNDEF
- [ ] 2.3.1 MAP_LOAD_FIELD
- [ ] 2.3.2 MAP_STORE_FIELD
- [ ] 2.3.3 MAP_LOAD_RANGE
- [ ] 2.3.4 MAP_STORE_RANGE
- [ ] 2.4.1 LOGICAL_AND
- [ ] 2.4.2 LOGICAL_OR
- [ ] 2.5.1 CALL_INDIRECT
- [ ] 2.5.2 INTRINSIC_LENGTH

### Phase 2A: Intrinsics Code Generation
- [ ] 2A.1.1 peek(addr) → LDA addr
- [ ] 2A.1.2 poke(addr, val) → STA addr
- [ ] 2A.1.3 peekw(addr) → LDA/LDX
- [ ] 2A.1.4 pokew(addr, val) → STA/STX
- [ ] 2A.2.1 sei() → SEI
- [ ] 2A.2.2 cli() → CLI
- [ ] 2A.2.3 nop() → NOP
- [ ] 2A.2.4 brk() → BRK
- [ ] 2A.3.1 pha() → PHA
- [ ] 2A.3.2 pla() → PLA
- [ ] 2A.3.3 php() → PHP
- [ ] 2A.3.4 plp() → PLP
- [ ] 2A.3.5 lo(word) → extract low byte
- [ ] 2A.3.6 hi(word) → extract high byte
- [ ] 2A.4.1 sizeof(type) → compile-time
- [ ] 2A.4.2 length(array) verify
- [ ] 2A.4.3 Intrinsic tests (30+)

### Phase 2B: Unary Operators
- [ ] 2B.1.1 -x (negation)
- [ ] 2B.1.2 ~x (bitwise NOT)
- [ ] 2B.2.1 !x (logical NOT)
- [ ] 2B.2.2 @var (address-of)
- [ ] 2B tests (15+)

### Phase 2C: Compound Assignments
- [ ] 2C.1.1 x += y
- [ ] 2C.1.2 x -= y
- [ ] 2C.1.3 x *= y
- [ ] 2C.1.4 x /= y
- [ ] 2C.1.5 x %= y
- [ ] 2C.2.1 x &= y
- [ ] 2C.2.2 x |= y
- [ ] 2C.2.3 x ^= y
- [ ] 2C.2.4 x <<= n
- [ ] 2C.2.5 x >>= n
- [ ] 2C tests (20+)

### Phase 2D: Control Flow Completeness
- [ ] 2D.1.1 switch statement
- [ ] 2D.1.2 case labels
- [ ] 2D.1.3 default case
- [ ] 2D.2.1 break → JMP
- [ ] 2D.2.2 continue → JMP
- [ ] 2D.3.1 ternary ?: operator
- [ ] 2D tests (15+)

### Phase 2E: @map Struct Forms
- [ ] 2E.1.1 Sequential struct offset calc
- [ ] 2E.1.2 Sequential struct read
- [ ] 2E.1.3 Sequential struct write
- [ ] 2E.2.1 Explicit field address lookup
- [ ] 2E.2.2 Explicit field read
- [ ] 2E.2.3 Explicit field write
- [ ] 2E tests (15+)

### Phase 2F: Array Operations
- [ ] 2F.1.1 Constant index → direct
- [ ] 2F.1.2 Variable index → indexed
- [ ] 2F.1.3 Expression index
- [ ] 2F.2.1 Word array (2-byte stride)
- [ ] 2F.2.2 Multi-dimensional offset
- [ ] 2F tests (15+)

### Phase 3: PHI Lowering
- [ ] 3.1.1-3.1.4 SSA value tracking
- [ ] 3.2.1-3.2.4 PHI source loading
- [ ] 3.3.1-3.3.4 Control flow tests (25+)

### Phase 4: Calling Convention
- [ ] 4.1.1-4.1.4 Define ABI
- [ ] 4.2.1-4.2.4 Caller implementation
- [ ] 4.3.1-4.3.4 Callee implementation
- [ ] 4.4.1-4.4.4 Calling tests (20+)

### Phase 5: String Literals
- [ ] 5.1.1-5.1.4 String storage
- [ ] 5.2.1-5.2.4 String address loading

### Phase 6: Word Operations
- [ ] 6.1.1-6.1.4 Word value tracking
- [ ] 6.2.1-6.2.4 Word arithmetic
- [ ] 6.3.1-6.3.4 Word comparisons/returns

### Phase 7: Register Allocation
- [ ] 7.1.1-7.1.4 Register tracking
- [ ] 7.2.1-7.2.4 Register selection
- [ ] 7.3.1-7.3.4 Complex expression tests

### Phase 7A: Callback Functions
- [ ] 7A.1.1 Detect callback function declarations
- [ ] 7A.1.2 Generate RTI instead of RTS
- [ ] 7A.2.1 Function pointer assignment
- [ ] 7A.2.2 Store function address
- [ ] 7A tests (10+)

### Phase 8: Module System
- [ ] 8.1.1-8.1.4 Import/export tests
- [ ] 8.2.1-8.2.4 Cross-module variables

### Phase 9: Correctness Tests
- [ ] 9.1 Value tracking tests (50)
- [ ] 9.2 Binary operation tests (60)
- [ ] 9.3 Control flow tests (50)
- [ ] 9.4 Function call tests (50)
- [ ] 9.5 Edge case tests (40)
- [ ] 9.6 Regression tests (50)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/codegen-fixes/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test

# 2. Update this checklist (mark completed items)

# 3. End agent settings
clear && scripts/agent.sh finished

# 4. Compact conversation
/compact
```

### Between Sessions

1. Review completed tasks in this checklist
2. Mark completed items with [x]
3. Start new conversation for next session
4. Reference next session's tasks

---

## Dependencies

```
Phase PRE (Comprehensive Tests) ← MUST DO FIRST
    ↓
Phase 0 (Test Infrastructure)
    ↓
Phase 1 (Value Tracking) ← FOUNDATION
    ↓
Phase 2 (Missing Opcodes)
    ↓
Phase 2A (Intrinsics) ─────────────┐
    ↓                              │
Phase 2B (Unary Operators)         │ CAN BE DONE
    ↓                              │ IN PARALLEL
Phase 2C (Compound Assignments)    │ AFTER PHASE 2
    ↓                              │
Phase 2D (Control Flow)            │
    ↓                              │
Phase 2E (@map Struct Forms)       │
    ↓                              │
Phase 2F (Array Operations) ───────┘
    ↓
Phase 3 (PHI Lowering)
    ↓
Phase 4 (Calling Convention)
    ↓
Phase 5 (String Literals)
    ↓
Phase 6 (Word Operations)
    ↓
Phase 7 (Register Allocation)
    ↓
Phase 7A (Callback Functions) ← AFTER PHASE 7
    ↓
Phase 8 (Module System)
    ↓
Phase 9 (Correctness Tests)
```

**New Phase Dependencies:**
- Phases 2A-2F can be done in any order after Phase 2
- Phase 7A must be done after Phase 7 (relies on register tracking)

---

---

## Gap Amendments (Documents 13-16)

**⚠️ IMPORTANT: These amendments address gaps identified during plan review.**

The following additional tasks were identified and MUST be completed for a 100% working compiler.

See the individual amendment documents for full details:
- [13-vice-test-rig.md](13-vice-test-rig.md) - VICE emulator integration
- [14-missing-features.md](14-missing-features.md) - Intrinsics, enums, do-while
- [15-runtime-safety.md](15-runtime-safety.md) - Spill area, recursion, runtime lib
- [16-verification-tests.md](16-verification-tests.md) - Storage classes, 2D arrays
- [18-critical-gaps-2026-01-28.md](18-critical-gaps-2026-01-28.md) - **9 CRITICAL gaps for 100% working compiler**

### Amendment Tasks Summary

#### From 13-vice-test-rig.md (Add to Phase 0)

**Session 0.5: VICE Test Rig (4-5 hours)**

| Task | Description |
|------|-------------|
| 0.5.1 | Create ViceRunner class skeleton |
| 0.5.2 | Implement VICE process management |
| 0.5.3 | Implement remote monitor protocol |
| 0.5.4 | Create ACME assembler helper |
| 0.5.5 | Create integrated test helper |
| 0.5.6 | Add environment detection (SKIP_VICE) |
| 0.5.7 | Write tests for VICE helper |
| 0.5.8 | Document usage |

#### From 14-missing-features.md (Add to Phase 2)

**Add to Session 2A.4: Optimization Intrinsics**

| Task | Description |
|------|-------------|
| 2A.4.4 | Implement `barrier()` intrinsic |
| 2A.4.5 | Implement `volatile_read()` intrinsic |
| 2A.4.6 | Implement `volatile_write()` intrinsic |
| 2A.4.7 | Add tests for optimization intrinsics |

**New Phase 2G: Enum Code Generation (1-2 hours)**

| Task | Description |
|------|-------------|
| 2G.1.1 | Verify enum values compile to constants |
| 2G.1.2 | Verify enum member access works |
| 2G.1.3 | Verify switch on enum values |
| 2G.1.4 | Verify enum comparison |
| 2G.1.5 | Test enum with explicit values |

**Add to Session 2D: Do-While Tests**

| Task | Description |
|------|-------------|
| 2D.2.5 | Test do-while basic loop |
| 2D.2.6 | Verify body executes at least once |
| 2D.2.7 | Test do-while with break |
| 2D.2.8 | Test do-while with continue |
| 2D.2.9 | Test nested do-while |

#### From 15-runtime-safety.md (Add to Phase 1 & 4)

**Add to Phase 1: Spill Area Expansion**

| Task | Description |
|------|-------------|
| 1.1.5 | Update SPILL_AREA_END to $9F (64 bytes) |
| 1.1.6 | Add spillSlotUsage tracking |
| 1.1.7 | Implement overflow detection/error |
| 1.1.8 | Implement 75% usage warning |
| 1.1.9 | Test spill overflow error |
| 1.1.10 | Test spill warning at 75% |

**New Phase 1.5: Runtime Library Verification (2-3 hours)**

| Task | Description |
|------|-------------|
| 1.5.1 | Verify _multiply routine exists |
| 1.5.2 | Test byte multiplication (VICE) |
| 1.5.3 | Verify _divide routine exists |
| 1.5.4 | Test byte division (VICE) |
| 1.5.5 | Verify _modulo routine exists |
| 1.5.6 | Test byte modulo (VICE) |
| 1.5.7 | Test edge cases (0, 255, overflow) |

**Add to Phase 4: Recursion Handling**

| Task | Description |
|------|-------------|
| 4.5.1 | Add isRecursiveFunction() detection |
| 4.5.2 | Add isTailRecursive() detection |
| 4.5.3 | Emit recursion warning |
| 4.5.4 | Add ASM comment for recursive functions |
| 4.5.5 | Test recursion detection |
| 4.5.6 | Test tail recursion detection |

#### From 16-verification-tests.md (Add to Phase 2F & 9)

**Add to Phase 2F: 2D Array Tests**

| Task | Description |
|------|-------------|
| 2F.3.1 | Test 2D constant index offset |
| 2F.3.2 | Test 2D variable row offset |
| 2F.3.3 | Test 2D both variable offset |
| 2F.3.4 | Test 3D array offset |
| 2F.3.5 | VICE test 2D write/read |
| 2F.3.6 | VICE test 2D iteration |
| 2F.3.7 | VICE test C64 screen pattern |

**Add to Phase 9: Storage Class Tests**

| Task | Description |
|------|-------------|
| 9.7.1 | Test @zp variables in zero page |
| 9.7.2 | Test @zp uses ZP addressing mode |
| 9.7.3 | Test @ram variables in RAM |
| 9.7.4 | Test default storage is @ram |
| 9.7.5 | Test @data in data section |
| 9.7.6 | Test @data const is read-only |
| 9.7.7 | VICE test for @zp access |
| 9.7.8 | VICE test for @data initialization |

#### From 18-critical-gaps-2026-01-28.md (CRITICAL - ALL Phases)

**🚨 ALL 9 GAPS ARE CRITICAL - Must be addressed for 100% working compiler**

**Add to Phase PRE: Semantic Analyzer Verification**

| Task | Description |
|------|-------------|
| PRE.0.1 | Run ALL semantic analyzer tests |
| PRE.0.2 | Verify 100% semantic test pass rate |
| PRE.0.3 | Check IL output for all language constructs |
| PRE.0.4 | Document any semantic gaps found |
| PRE.0.5 | Fix semantic gaps BEFORE starting codegen |
| PRE.6.1 | Verify semantic analyzer rejects const writes |
| PRE.6.2 | Test: Write to const variable → compile error |
| PRE.6.3 | Test: Write to @data const array → compile error |
| PRE.6.4 | Test: Compound assignment to const → compile error |

**Add to Phase 1: Nested Function Calls in Expressions**

| Task | Description |
|------|-------------|
| 1.5.1 | Track function call results in expression context |
| 1.5.2 | Spill return values before subsequent calls |
| 1.5.3 | Reload spilled values for outer call |
| 1.5.4 | Test: `add(mul(a,b), div(c,d))` produces correct result |
| 1.5.5 | Test: 3-level nested calls |
| 1.5.6 | VICE test: Verify mathematical correctness |

**Add to Phase 2F: Large Array Indexing (>256 elements)**

| Task | Description |
|------|-------------|
| 2F.4.1 | Detect array accesses requiring >8-bit index |
| 2F.4.2 | Implement 16-bit index calculation to ZP pointer |
| 2F.4.3 | Use indirect indexed addressing (ZP),Y for large arrays |
| 2F.4.4 | Test: Access element 500 of byte[1000] |
| 2F.4.5 | Test: Access element 150 of word[200] |
| 2F.4.6 | VICE test: Verify large array read/write |

**Add to Phase 4: ABI + Call Depth**

| Task | Description |
|------|-------------|
| 4.1.5 | Document ABI: packed layout for mixed byte/word params |
| 4.1.6 | Implement packed parameter allocation |
| 4.2.5 | Test: func(byte, word, byte) parameter passing |
| 4.2.6 | Test: func(word, byte, word) parameter passing |
| 4.2.7 | VICE test: Verify parameter values received correctly |
| 4.6.1 | Build call graph during semantic analysis |
| 4.6.2 | Calculate maximum call depth |
| 4.6.3 | Warn if call depth > 50 |
| 4.6.4 | Error if call depth > 100 (configurable) |
| 4.6.5 | Test: Deep call chain warning |

**Add to Phase 7A: Callback Register Preservation**

| Task | Description |
|------|-------------|
| 7A.1.3 | Add PHA/TXA/PHA/TYA/PHA at callback entry |
| 7A.1.4 | Add PLA/TAY/PLA/TAX/PLA before RTI |
| 7A.1.5 | Test: Verify registers preserved in IRQ |
| 7A.1.6 | VICE test: Main program state unchanged after IRQ |

**Add to Phase 8: Global Initialization Order**

| Task | Description |
|------|-------------|
| 8.3.1 | Document global initialization order |
| 8.3.2 | Verify codegen processes modules in dependency order |
| 8.3.3 | Test: Cross-module dependency initialization |
| 8.3.4 | Test: Circular import handling (should error) |

**General: Error Recovery in Codegen**

| Task | Description |
|------|-------------|
| GEN.1.1 | Add try/catch around main codegen loop |
| GEN.1.2 | Emit diagnostic comment on error |
| GEN.1.3 | Collect all errors, don't stop on first |
| GEN.1.4 | Include source location in error messages |
| GEN.1.5 | Test: Graceful handling of edge cases |

---

### Updated Totals (Including Amendments)

| Category | Original | Amendments | New Total |
|----------|----------|------------|-----------|
| Phases | 18 | +3 (0.5, 1.5, 2G) | 21 |
| Sessions | 56-75 | +8-12 | 64-87 |
| Est. Hours | 175-250 | +25-40 | 200-290 |
| Tasks | ~150 | +52 | ~200 |

---

## Success Criteria

**The project is COMPLETE when:**

1. ✅ All 14 issues from CODEGEN-ISSUES-ANALYSIS.md are fixed
2. ✅ All 47 IL opcodes have handlers (no placeholder fallthrough)
3. ✅ 300+ correctness tests pass
4. ✅ No STUB comments in generated assembly
5. ✅ No "Unknown value location" warnings
6. ✅ No "WARNING: Cannot load" for PHI nodes
7. ✅ Example programs compile and run correctly
8. ✅ Multi-file compilation works
9. ✅ **VICE tests verify runtime correctness** (Amendment)
10. ✅ **All gap amendment tasks completed** (Documents 13-18)
11. ✅ **All 11 final gaps addressed** (Document 19)
12. ✅ **43-feature Language Spec Compliance Matrix PASSES** (Document 19)

---

## Final Gaps Amendment (Document 19) - 78 Additional Tasks

**See [19-final-gaps-2026-01-28.md](19-final-gaps-2026-01-28.md) for full details.**

### Summary of 11 Final Gaps

| Gap # | Description | Tasks | Est. Hours |
|-------|-------------|-------|------------|
| 1 | Stub Functions → Compiler Intrinsics | 6 | 2-3 |
| 2 | String Type as Byte Array + Overflow Check | 7 | 3-4 |
| 3 | For Loop step/downto + Overflow Checks | 10 | 4-5 |
| 4 | @address Type Verification | 7 | 2-3 |
| 5 | sizeof/length Compile-Time Only | 8 | 2-3 |
| 6 | 2D Array Optimization | 7 | 3-4 |
| 7 | All 19 Intrinsics Verification | 8 | 3-4 |
| 8 | Enum Explicit Values | 6 | 2-3 |
| 9 | Simple/Range @map Verification | 7 | 2-3 |
| 10 | Multiple Return Statements | 6 | 2-3 |
| 11 | PRE Language Spec Compliance Matrix | 6 | 4-5 |
| **TOTAL** | | **78** | **25-35** |

### Final Gaps Task Checklist

#### Gap 1: Stub Functions → Intrinsics
- [ ] 1.G1.1 Document all stub functions as intrinsics mapping
- [ ] 1.G1.2 Verify semantic analyzer marks stub functions as intrinsic
- [ ] 1.G1.3 Verify IL generator emits intrinsic IL for stub calls
- [ ] 1.G1.4 Test: Call to `peek()` generates LDA inline
- [ ] 1.G1.5 Test: Call to `poke()` generates STA inline
- [ ] 1.G1.6 Test: Call to all 19 intrinsic stub functions works

#### Gap 2: String Type
- [ ] 2.G2.1 Verify string type resolves to byte array in type system
- [ ] 2.G2.2 Add compile-time overflow check for string assignment
- [ ] 2.G2.3 Emit error: "String 'XXXX' (N bytes) exceeds buffer size (M bytes)"
- [ ] 2.G2.4 Test: `let s: string[5] = "Hello"` → OK
- [ ] 2.G2.5 Test: `let s: string[3] = "Hello"` → ERROR (overflow)
- [ ] 2.G2.6 Test: String literal generates byte array with null terminator
- [ ] 2.G2.7 Verify codegen treats string variables as byte arrays

#### Gap 3: For Loop step/downto + Overflow
- [ ] 3.G3.1 Verify IL generator handles `step` keyword
- [ ] 3.G3.2 Verify IL generator handles `downto` keyword
- [ ] 3.G3.3 Verify codegen emits correct increment for `step N`
- [ ] 3.G3.4 Verify codegen emits decrement for `downto`
- [ ] 3.G3.5 Add compile-time overflow check: `for (i: byte = 0 to 300)` → ERROR
- [ ] 3.G3.6 Add compile-time step overflow check warning
- [ ] 3.G3.7 Test: `for (i = 0 to 10 step 2)` generates `i += 2`
- [ ] 3.G3.8 Test: `for (i = 10 downto 0)` generates correct exit condition
- [ ] 3.G3.9 VICE test: step iteration correctness
- [ ] 3.G3.10 VICE test: downto iteration correctness

#### Gap 4: @address Type
- [ ] 4.G4.1 Verify `@address` type resolves to `word` in type system
- [ ] 4.G4.2 Verify `@address` variables allocate 2 bytes
- [ ] 4.G4.3 Test: `let ptr: @address = $0400` allocates word
- [ ] 4.G4.4 Test: `@address` arithmetic works (`ptr + 40`)
- [ ] 4.G4.5 Test: `@address` passed to functions as word
- [ ] 4.G4.6 Test: `let addr: @address = @buffer` gets address of variable
- [ ] 4.G4.7 VICE test: @address values correct at runtime

#### Gap 5: Compile-Time Intrinsics
- [ ] 5.G5.1 Verify IL generator resolves `sizeof(type)` at IL generation time
- [ ] 5.G5.2 Verify IL generator resolves `length(array)` at IL generation time
- [ ] 5.G5.3 Verify no INTRINSIC_SIZEOF or INTRINSIC_LENGTH IL opcodes
- [ ] 5.G5.4 Test: `sizeof(byte)` emits `CONST 1`
- [ ] 5.G5.5 Test: `sizeof(word)` emits `CONST 2`
- [ ] 5.G5.6 Test: `sizeof(byte[10])` emits `CONST 10`
- [ ] 5.G5.7 Test: `length(myArray)` emits `CONST N`
- [ ] 5.G5.8 Verify ASM output has no JSR for sizeof/length

#### Gap 6: 2D Array Optimization
- [ ] 6.G6.1 Detect 2D array access with constant row index
- [ ] 6.G6.2 Compute partial offset at compile time
- [ ] 6.G6.3 Use indexed addressing for column
- [ ] 6.G6.4 Test: `arr[5][x]` generates no runtime multiply
- [ ] 6.G6.5 Test: `arr[y][x]` generates runtime multiply
- [ ] 6.G6.6 Test: `arr[2][3]` generates direct address
- [ ] 6.G6.7 VICE test: 2D array correctness

#### Gap 7: All 19 Intrinsics
- [ ] 7.G7.1 Create intrinsics test file covering all 19
- [ ] 7.G7.2 Verify peek/poke/peekw/pokew (4 tests)
- [ ] 7.G7.3 Verify sei/cli/nop/brk (4 tests)
- [ ] 7.G7.4 Verify pha/pla/php/plp (4 tests)
- [ ] 7.G7.5 Verify lo/hi (2 tests)
- [ ] 7.G7.6 Verify sizeof/length (2 tests - compile-time)
- [ ] 7.G7.7 Verify barrier/volatile_read/volatile_write (3 tests)
- [ ] 7.G7.8 VICE test: Verify intrinsics at runtime

#### Gap 8: Enum Explicit Values
- [ ] 8.G8.1 Verify semantic analyzer stores explicit enum values
- [ ] 8.G8.2 Verify IL generator uses explicit values
- [ ] 8.G8.3 Test: `Key.LEFT` evaluates to explicit value
- [ ] 8.G8.4 Test: Mixed explicit/implicit enum values
- [ ] 8.G8.5 Test: Enum comparison with explicit values
- [ ] 8.G8.6 VICE test: enum values at runtime

#### Gap 9: Simple/Range @map
- [ ] 9.G9.1 Test: Simple @map read
- [ ] 9.G9.2 Test: Simple @map write
- [ ] 9.G9.3 Test: Range @map constant index
- [ ] 9.G9.4 Test: Range @map variable index
- [ ] 9.G9.5 Verify simple @map generates absolute addressing
- [ ] 9.G9.6 Verify range @map generates indexed addressing
- [ ] 9.G9.7 VICE test: @map reads/writes

#### Gap 10: Multiple Returns
- [ ] 10.G10.1 Verify PHI handles multiple return merging
- [ ] 10.G10.2 Test: Function with 2 return paths
- [ ] 10.G10.3 Test: Function with 3+ return paths
- [ ] 10.G10.4 Test: Early return inside loop
- [ ] 10.G10.5 Test: Nested if with multiple returns
- [ ] 10.G10.6 VICE test: correct return value for each path

#### Gap 11: PRE Language Spec Compliance Matrix
- [ ] 11.G11.1 Create PRE compliance matrix
- [ ] 11.G11.2 Create minimal test for EACH of 43 features
- [ ] 11.G11.3 Run all 43 programs through compiler
- [ ] 11.G11.4 Document pass/fail for each feature
- [ ] 11.G11.5 Cross-reference failures to plan phases
- [ ] 11.G11.6 Add phases for uncovered failures

---

### Updated Grand Total (Including All Amendments)

| Category | Tasks | Sessions | Est. Hours |
|----------|-------|----------|------------|
| Original Plan (Phases 0-9) | ~150 | 35-46 | 110-160 |
| Amendment 13-16 | ~52 | 8-12 | 25-40 |
| Amendment 17 | ~5 | 1 | 2-4 |
| Amendment 18 (Critical Gaps) | ~40 | 10-14 | 28-40 |
| Amendment 19 (Final Gaps) | 78 | 10-12 | 25-35 |
| **Amendment 20 (Review Gaps)** | **27** | **3-4** | **9-13** |
| **GRAND TOTAL** | **~352** | **67-89** | **199-292** |

---

## Review Gaps Amendment (Document 20) - 27 Additional Tasks

**See [20-review-gaps-2026-01-28.md](20-review-gaps-2026-01-28.md) for full details.**

---

## Final Completion Amendment (Document 21) - 12 Additional Tasks

**See [21-final-completion-2026-01-28.md](21-final-completion-2026-01-28.md) for full details.**

### Summary of 3 Final Gaps

| Gap | Description | Tasks | Est. Hours |
|-----|-------------|-------|------------|
| A | Complete ISR Flow Testing | 4 | 2-3 |
| B | Compile-Time Array Bounds Checking | 4 | 2-3 |
| C | Word Returns in Nested Expressions | 4 | 2-3 |
| **TOTAL** | | **12** | **7-10** |

### Final Completion Tasks Checklist

#### Gap A: ISR Flow Testing
- [ ] A.1 Create VICE test fixture: IRQ handler
- [ ] A.2 Install handler using pokew($0314, @handler)
- [ ] A.3 Set raster interrupt trigger
- [ ] A.4 Verify handler executes and main resumes

#### Gap B: Compile-Time Bounds Checking
- [ ] B.1 Implement bounds check in semantic analyzer
- [ ] B.2 Test out-of-bounds constant index → ERROR
- [ ] B.3 Test negative index → ERROR
- [ ] B.4 Test valid indices → OK

#### Gap C: Word Returns in Expressions
- [ ] C.1 Test two word returns with addition
- [ ] C.2 Verify 2-byte spill for word values
- [ ] C.3 Verify 16-bit addition with carry
- [ ] C.4 VICE test mathematical correctness

### Summary of 6 Review Gaps

| Gap | Description | Tasks | Est. Hours |
|-----|-------------|-------|------------|
| A | Unsigned Comparison Verification | 4 | 1-2 |
| B | @zp Storage Class Allocation | 5 | 2-3 |
| C | Runtime Array Initialization | 6 | 2-3 |
| D | Interrupt Vector Documentation | 3 | 1 |
| E | Runtime Library Verification | 6 | 2-3 |
| F | PRG Output Format | 3 | 1 |
| **TOTAL** | | **27** | **9-13** |

### Review Gaps Task Checklist

#### Gap A: Unsigned Comparison Verification
- [ ] A.1 Verify all comparisons use BCC/BCS (unsigned)
- [ ] A.2 Test: `255 > 1` evaluates to TRUE
- [ ] A.3 Test: `200 > 100` after arithmetic is correct
- [ ] A.4 VICE test: Verify unsigned comparison at runtime

#### Gap B: @zp Storage Class Allocation
- [ ] B.1 Implement @zp allocation in range $02-$3F
- [ ] B.2 Document user ZP vs compiler ZP ranges
- [ ] B.3 Test: @zp variables allocate in ZP range
- [ ] B.4 Test: @zp uses ZP addressing mode
- [ ] B.5 Test: ZP overflow produces error

#### Gap C: Runtime Array Initialization
- [ ] C.1 Detect arrays with non-constant initializers
- [ ] C.2 Generate initialization code for runtime arrays
- [ ] C.3 Add init code to program startup
- [ ] C.4 Test: `let arr = [x, y, z]` works
- [ ] C.5 Test: `let arr = [func1(), func2()]` works
- [ ] C.6 VICE test: Runtime-initialized arrays

#### Gap D: Interrupt Vector Documentation
- [ ] D.1 Document interrupt installation in spec
- [ ] D.2 Add complete IRQ handler example
- [ ] D.3 Test: `pokew($0314, @handler)` compiles

#### Gap E: Runtime Library Verification
- [ ] E.1 Verify runtime library exists
- [ ] E.2 Document runtime routines
- [ ] E.3 Verify codegen includes runtime
- [ ] E.4 Test: Multiply generates JSR
- [ ] E.5 Test: Divide generates JSR
- [ ] E.6 VICE test: Multiply/divide correctness

#### Gap F: PRG Output Format
- [ ] F.1 Verify codegen emits correct start address
- [ ] F.2 Verify ACME produces PRG format
- [ ] F.3 VICE test: Output loads correctly