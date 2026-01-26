# Part 4: Code Generation & Documentation Tasks

> **Document**: 03-codegen-docs.md
> **Phase Coverage**: Phase 5 (Code Generation) + Phase 6 (Documentation)
> **Status**: Complete

---

## Phase 5: Code Generation Changes

### Context

The code generator must be updated to handle new AST structures and generate correct 6502 assembly for enhanced for loops (with step, downto, 16-bit counters), do-while loops, and ternary expressions.

### Dependencies

- Phase 3 complete (AST changes)
- Phase 4 complete (semantic analysis, type inference)

### Deliverables

- 8-bit for loop code generation (existing, verify still works)
- 16-bit for loop code generation (new)
- For loop with step value
- For loop with downto direction
- Do-while loop code generation
- Ternary expression code generation
- Switch statement (renamed from match)
- All codegen tests pass

---

### Phase 5 Tasks

#### Task 5.1: Update For Loop Code Generation - 8-bit Counter

**Objective**: Ensure existing 8-bit for loop generation still works with new AST structure.

**File**: `packages/compiler/src/codegen/` (relevant generator files)

**8-bit for-to loop** `for (i = 0 to 255)`:
```asm
    ; Initialize counter
    LDA #0
    STA _i
    
.loop_start:
    ; Body code here
    
    ; Increment and check
    INC _i
    LDA _i
    CMP #256        ; end + 1 (wraps to 0, so use 256 check or BNE)
    BNE .loop_start
```

**8-bit for-downto loop** `for (i = 255 downto 0)`:
```asm
    ; Initialize counter
    LDA #255
    STA _i
    
.loop_start:
    ; Body code here
    
    ; Decrement and check
    DEC _i
    BPL .loop_start   ; Branch while >= 0
```

**Tests**:
- Unit: `for (i = 0 to 10)` generates correct code
- Unit: `for (i = 10 downto 0)` generates correct code
- Unit: Counter uses zero-page when possible
- Integration: Generated code assembles and runs correctly

---

#### Task 5.2: Implement 16-bit For Loop Code Generation

**Objective**: Generate 16-bit counter loops when inferred type is word.

**File**: `packages/compiler/src/codegen/`

**16-bit for-to loop** `for (i = 0 to 5000)`:
```asm
    ; Initialize 16-bit counter
    LDA #<0
    STA _i_lo
    LDA #>0
    STA _i_hi
    
.loop_start:
    ; Calculate address for indexed access (if needed)
    ; ... body code ...
    
    ; 16-bit increment
    INC _i_lo
    BNE .skip_hi
    INC _i_hi
.skip_hi:
    
    ; 16-bit compare with end (5001)
    LDA _i_hi
    CMP #>5001
    BCC .loop_start     ; hi < end_hi, continue
    BNE .loop_done      ; hi > end_hi, exit
    LDA _i_lo
    CMP #<5001
    BCC .loop_start     ; lo < end_lo, continue
    
.loop_done:
```

**16-bit for-downto loop** `for (i = 5000 downto 0)`:
```asm
    ; Initialize 16-bit counter
    LDA #<5000
    STA _i_lo
    LDA #>5000
    STA _i_hi
    
.loop_start:
    ; ... body code ...
    
    ; 16-bit decrement
    LDA _i_lo
    BNE .skip_hi
    DEC _i_hi
.skip_hi:
    DEC _i_lo
    
    ; Check for underflow (went below 0)
    ; If hi byte is $FF after decrement from 0, we're done
    LDA _i_hi
    CMP #$FF
    BNE .loop_start
    LDA _i_lo
    CMP #$FF
    BNE .loop_start
    
.loop_done:
```

**Tests**:
- Unit: `for (i = 0 to 1000)` generates 16-bit code
- Unit: 16-bit increment is correct
- Unit: 16-bit compare is correct
- Integration: Generated code handles large ranges

---

#### Task 5.3: Implement For Loop with Step

**Objective**: Generate code for for loops with step values.

**File**: `packages/compiler/src/codegen/`

**8-bit with step** `for (i = 0 to 100 step 5)`:
```asm
    LDA #0
    STA _i
    
.loop_start:
    ; ... body code ...
    
    ; Add step
    LDA _i
    CLC
    ADC #5
    STA _i
    
    ; Compare with end + 1 (or end + step for boundary)
    CMP #101        ; end + 1
    BCC .loop_start ; continue if < end + 1
```

**16-bit with step** `for (i = 0 to 5000 step 100)`:
```asm
    ; Initialize
    LDA #0
    STA _i_lo
    STA _i_hi
    
.loop_start:
    ; ... body code ...
    
    ; 16-bit add step
    CLC
    LDA _i_lo
    ADC #<100
    STA _i_lo
    LDA _i_hi
    ADC #>100
    STA _i_hi
    
    ; 16-bit compare
    ; ...compare logic...
```

**Tests**:
- Unit: `for (i = 0 to 10 step 2)` generates correct step
- Unit: Step value is added correctly
- Unit: Boundary checking accounts for step

---

#### Task 5.4: Implement Do-While Code Generation

**Objective**: Generate code for do-while loops.

**File**: `packages/compiler/src/codegen/`

**Do-while loop** `do { body } while (condition)`:
```asm
.loop_start:
    ; ... body code ...
    
    ; Evaluate condition
    ; ... condition code ...
    
    ; Branch back if true
    BNE .loop_start     ; or appropriate branch for condition
```

The key difference from while: condition check is at the end, so body executes at least once.

**Tests**:
- Unit: `do { x++; } while (x < 10);` generates correct code
- Unit: Body executes before condition
- Unit: Break/continue work within do-while

---

#### Task 5.5: Implement Ternary Expression Code Generation

**Objective**: Generate code for ternary conditional expressions.

**File**: `packages/compiler/src/codegen/`

**Ternary** `result = (a > b) ? a : b`:
```asm
    ; Evaluate condition (a > b)
    LDA _a
    CMP _b
    BCC .else_branch    ; Branch if a < b (not a > b)
    BEQ .else_branch    ; Branch if a == b (not a > b)
    
.then_branch:
    LDA _a
    JMP .ternary_end
    
.else_branch:
    LDA _b
    
.ternary_end:
    STA _result
```

For complex ternary (with side effects), generate full branches:
```asm
    ; condition
    ; ... condition code ...
    BEQ .else_branch
    
.then_branch:
    ; ... then expression code ...
    JMP .ternary_end
    
.else_branch:
    ; ... else expression code ...
    
.ternary_end:
```

**Tests**:
- Unit: Simple ternary `x ? 1 : 0` generates correct code
- Unit: Ternary with expressions `x > y ? x : y` generates correct code
- Unit: Nested ternary generates correct code
- Unit: Result type matches inferred type

---

#### Task 5.6: Update Switch Statement Code Generation

**Objective**: Update match/switch code generation for new syntax (logic unchanged, just rename).

**File**: `packages/compiler/src/codegen/`

**Switch with dense values** (jump table):
```asm
    ; Load value
    LDA _value
    ASL A           ; multiply by 2 for word-sized addresses
    TAX
    JMP (.jump_table,X)
    
.jump_table:
    .word .case_0, .case_1, .case_2, .case_3
    
.case_0:
    ; ... case 0 code ...
    JMP .switch_end
    
.case_1:
    ; ... case 1 code ...
    JMP .switch_end
    
; ... more cases ...

.switch_end:
```

**Switch with sparse values** (comparison chain):
```asm
    LDA _value
    CMP #10
    BEQ .case_10
    CMP #50
    BEQ .case_50
    JMP .default_case
    
.case_10:
    ; ...
    JMP .switch_end
    
; ... more cases ...
```

**Tests**:
- Unit: Dense values use jump table
- Unit: Sparse values use comparison chain
- Unit: Default case works
- Unit: Fall-through works (no break)

---

#### Task 5.7: Update IL Generator (if applicable)

**Objective**: Update intermediate representation for new constructs.

**File**: `packages/compiler/src/il/`

**Updates needed**:
- ForStatement with direction, step
- DoWhileStatement
- TernaryExpression
- Ensure IL visitor handles new nodes

---

#### Task 5.8: Update Code Generator Tests

**Objective**: Comprehensive tests for all code generation changes.

**Files to Modify**:
- `packages/compiler/src/__tests__/codegen/`

**Test Categories**:
- For loop variations (8-bit, 16-bit, step, downto)
- Do-while loop
- Ternary expression
- Switch statement
- Edge cases (boundary values, overflow prevention)
- Integration tests (assemble and verify)

---

## Phase 6: Documentation & Testing

### Context

Update all language specification documents, example files, and tests to reflect the new C-style syntax.

### Dependencies

- Phases 1-5 substantially complete
- Can start once parser (Phase 2) is stable

### Deliverables

- All 13 language spec documents updated
- All EBNF grammar sections rewritten
- All code examples converted to new syntax
- All 13 example .blend files converted
- All ~130 test files updated
- End-to-end tests pass

---

### Phase 6 Tasks

#### Task 6.1: Update Language Specification - Grammar

**Objective**: Update grammar document with new syntax.

**File**: `docs/language-specification/02-grammar.md`

**Changes**:
- Update EBNF for all statement types
- Add do-while grammar
- Add ternary expression grammar
- Update for loop grammar (step, downto)
- Remove `end`, `then`, `next` from grammar
- Add curly braces to all block rules

**Example EBNF Updates**:
```ebnf
(* Updated if statement *)
if_stmt = "if" , "(" , expression , ")" , "{" , { statement } , "}"
        , [ "else" , ( if_stmt | "{" , { statement } , "}" ) ] ;

(* Updated while statement *)
while_stmt = "while" , "(" , expression , ")" , "{" , { statement } , "}" ;

(* New do-while statement *)
do_while_stmt = "do" , "{" , { statement } , "}" , "while" , "(" , expression , ")" , ";" ;

(* Updated for statement *)
for_stmt = "for" , "(" , [ "let" , identifier , [ ":" , type ] ]
         , identifier , "=" , expression , ( "to" | "downto" ) , expression
         , [ "step" , expression ] , ")" , "{" , { statement } , "}" ;

(* Updated switch statement *)
switch_stmt = "switch" , "(" , expression , ")" , "{"
            , { case_clause }
            , [ default_clause ]
            , "}" ;

(* Ternary expression *)
conditional_expr = logical_or_expr , [ "?" , expression , ":" , conditional_expr ] ;
```

---

#### Task 6.2: Update Language Specification - Statements

**Objective**: Update expressions/statements document.

**File**: `docs/language-specification/06-expressions-statements.md`

**Changes**:
- Update all control flow examples
- Add ternary operator section
- Add do-while section
- Update for loop section with step/downto
- Update operator precedence table (add ternary)

---

#### Task 6.3: Update Language Specification - Functions

**Objective**: Update functions document.

**File**: `docs/language-specification/11-functions.md`

**Changes**:
- Update all function examples to use curly braces
- Keep stub function syntax (already uses semicolon)
- Update callback function examples

---

#### Task 6.4: Update Language Specification - Modules

**Objective**: Update module system document.

**File**: `docs/language-specification/04-module-system.md`

**Changes**:
- Update module declaration examples (add semicolon)
- Update import examples (add curly braces, semicolon)

---

#### Task 6.5: Update Language Specification - Variables

**Objective**: Update variables document.

**File**: `docs/language-specification/10-variables.md`

**Changes**:
- Ensure examples use correct new syntax
- Update any function/control flow examples within

---

#### Task 6.6: Update Language Specification - Memory Mapped

**Objective**: Update memory-mapped variables document.

**File**: `docs/language-specification/12-memory-mapped.md`

**Changes**:
- Update @map type/layout examples to use curly braces
- Update related function examples

---

#### Task 6.7: Update Language Specification - Type System

**Objective**: Update type system document.

**File**: `docs/language-specification/05-type-system.md`

**Changes**:
- Update enum examples to use curly braces
- Update any other examples

---

#### Task 6.8: Update Language Specification - Examples

**Objective**: Update complete examples document.

**File**: `docs/language-specification/21-examples.md`

**Changes**:
- Rewrite all complete code examples
- Ensure examples showcase new features (ternary, do-while, step, downto)

---

#### Task 6.9: Update Language Specification - Overview

**Objective**: Update overview and lexical structure documents.

**Files**: 
- `docs/language-specification/00-overview.md`
- `docs/language-specification/01-lexical-structure.md`
- `docs/language-specification/README.md`

**Changes**:
- Update quick syntax examples
- Update keyword list
- Note the syntax style change

---

#### Task 6.10: Convert Example .blend Files

**Objective**: Convert all example files to new syntax.

**Files**:
- `examples/simple/main.blend`
- `examples/simple/system.blend`
- `examples/snake-game/game-state.blend`
- `examples/snake-game/hardware.blend`
- All other .blend files (13 total)

**Strategy**:
1. Systematic find/replace for syntax patterns
2. Manual review for edge cases
3. Verify they parse correctly

---

#### Task 6.11: Update Parser Tests

**Objective**: Update all parser test files.

**Files**:
- All files in `packages/compiler/src/__tests__/parser/`

**Strategy**:
1. Search for VB-style patterns in test strings
2. Convert to C-style syntax
3. Add tests for new features
4. Verify all tests pass

---

#### Task 6.12: Update Lexer Tests

**Objective**: Update lexer tests for new token set.

**Files**:
- All files in `packages/compiler/src/__tests__/lexer/`

**Changes**:
- Remove tests for obsolete keywords
- Add tests for new keywords
- Add tests for new operators (?)

---

#### Task 6.13: Update Semantic Analyzer Tests

**Objective**: Update semantic tests to use new syntax.

**Files**:
- All files in `packages/compiler/src/__tests__/semantic/`

**Changes**:
- Update test source code strings
- Add tests for new features

---

#### Task 6.14: Update Code Generator Tests

**Objective**: Update codegen tests to use new syntax.

**Files**:
- All files in `packages/compiler/src/__tests__/codegen/`

**Changes**:
- Update test source code strings
- Add tests for new codegen features

---

#### Task 6.15: Update IL Generator Tests

**Objective**: Update IL tests to use new syntax.

**Files**:
- All files in `packages/compiler/src/__tests__/il/`

**Changes**:
- Update test source code strings
- Add tests for new IL constructs

---

#### Task 6.16: Update E2E Tests

**Objective**: Update end-to-end tests.

**Files**:
- All files in `packages/compiler/src/__tests__/e2e/`
- All .blend fixture files

**Changes**:
- Convert all fixture files
- Verify complete pipeline works

---

#### Task 6.17: Final Integration Testing

**Objective**: Run complete test suite and verify everything works.

**Actions**:
1. Run full test suite: `yarn clean && yarn build && yarn test`
2. Fix any failing tests
3. Verify example files compile
4. Manual smoke testing

---

## Task Implementation Checklist

### Phase 5: Code Generation

| Task | Description | Dependencies | Status |
|------|-------------|--------------|--------|
| 5.1 | Update 8-bit for loop codegen | Phase 3-4 | [ ] |
| 5.2 | Implement 16-bit for loop codegen | 5.1 | [ ] |
| 5.3 | Implement for loop with step | 5.1, 5.2 | [ ] |
| 5.4 | Implement do-while codegen | Phase 3-4 | [ ] |
| 5.5 | Implement ternary codegen | Phase 3-4 | [ ] |
| 5.6 | Update switch codegen | Phase 3-4 | [ ] |
| 5.7 | Update IL generator | Phase 3-4 | [ ] |
| 5.8 | Update codegen tests | 5.1-5.7 | [ ] |

### Phase 6: Documentation & Testing

| Task | Description | Dependencies | Status |
|------|-------------|--------------|--------|
| 6.1 | Update spec - grammar | Phase 2 | [x] |
| 6.2 | Update spec - statements | Phase 2 | [x] |
| 6.3 | Update spec - functions | Phase 2 | [ ] |
| 6.4 | Update spec - modules | Phase 2 | [ ] |
| 6.5 | Update spec - variables | Phase 2 | [ ] |
| 6.6 | Update spec - memory mapped | Phase 2 | [ ] |
| 6.7 | Update spec - type system | Phase 2 | [ ] |
| 6.8 | Update spec - examples | Phase 2 | [ ] |
| 6.9 | Update spec - overview | Phase 2 | [ ] |
| 6.10 | Convert example files | Phase 2 | [ ] |
| 6.11 | Update parser tests | Phase 2 | [ ] |
| 6.12 | Update lexer tests | Phase 1 | [ ] |
| 6.13 | Update semantic tests | Phase 4 | [ ] |
| 6.14 | Update codegen tests | Phase 5 | [ ] |
| 6.15 | Update IL tests | Phase 5 | [ ] |
| 6.16 | Update E2E tests | All phases | [ ] |
| 6.17 | Final integration testing | All tasks | [ ] |

---

## Success Criteria

### Phase 5 Complete When:
- [ ] 8-bit for loops generate correct code
- [ ] 16-bit for loops generate correct code
- [ ] For loops with step generate correct code
- [ ] For loops with downto generate correct code
- [ ] Do-while loops generate correct code
- [ ] Ternary expressions generate correct code
- [ ] Switch statements generate correct code
- [ ] All codegen tests pass

### Phase 6 Complete When:
- [ ] All 13 spec documents updated
- [ ] All example files converted
- [ ] All test files updated
- [ ] Full test suite passes
- [ ] End-to-end tests pass
- [ ] Manual verification complete

---

## Overall Project Success Criteria

When ALL phases are complete:

- [ ] **Phase 1**: Lexer recognizes all new tokens, removes obsolete ones
- [ ] **Phase 2**: Parser handles C-style syntax for all constructs
- [ ] **Phase 3**: AST supports new node types and fields
- [ ] **Phase 4**: Semantic analyzer performs type inference and overflow detection
- [ ] **Phase 5**: Code generator produces correct 6502 assembly
- [ ] **Phase 6**: All documentation and tests updated
- [ ] **FINAL**: `yarn clean && yarn build && yarn test` passes completely

---

## Estimated Timeline

| Phase | Duration | Sessions |
|-------|----------|----------|
| Phase 1 (Lexer) | 1-2 days | 2 |
| Phase 2 (Parser) | 3-5 days | 6 |
| Phase 3 (AST) | 1 day | 1 |
| Phase 4 (Semantic) | 2-3 days | 3 |
| Phase 5 (CodeGen) | 2-3 days | 3 |
| Phase 6 (Docs/Tests) | 3-4 days | 4 |
| **Total** | **12-18 days** | **~19 sessions** |

---

## Implementation Notes

1. **Start with Phase 1** - Lexer changes are the foundation
2. **Phase 2 is largest** - Parser rewrite is most complex
3. **Phases can overlap** - AST (Phase 3) can start before Phase 2 completes
4. **Documentation can start early** - Phase 6.1-6.9 can start once Phase 2 is stable
5. **Test frequently** - Run tests after each task to catch regressions
6. **Commit often** - Small, focused commits for easy rollback

---

## Return to Index

[← Back to INDEX.md](INDEX.md)