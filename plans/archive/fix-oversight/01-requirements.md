# Requirements: Fix All Critical Oversights

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

This plan addresses **all critical gaps discovered during real-world testing** of the Blend65 compiler. The compiler currently produces non-functional assembly code despite having a 99.97% test pass rate.

**Goal**: Make the Blend65 compiler produce **working, executable** Commodore 64 programs.

## Functional Requirements

### Must Have (🔴 CRITICAL - Blocking)

These issues completely prevent any real program from working:

- [x] **REQ-01**: Fix member access type resolution
  - `vic.borderColor` shows "type unknown" 
  - Must resolve member types from module/struct definitions
  
- [ ] **REQ-02**: Fix binary operation code generation
  - `ADD`, `SUB` operations use `ADC #$00` placeholder
  - Must use actual operand values from IL
  
- [ ] **REQ-03**: Fix comparison operation code generation
  - `CMP_EQ`, `CMP_LT`, etc. use `CMP #$00` placeholder
  - Must compare against actual operand values
  
- [ ] **REQ-04**: Implement PHI node lowering
  - PHI nodes (SSA form) just emit `NOP`
  - Must convert to explicit register/memory moves
  
- [ ] **REQ-05**: Fix undefined label generation
  - `_main`, `_data` labels referenced but not defined
  - Must generate all referenced labels

### Should Have (🟠 HIGH - Important Features)

These are needed for non-trivial programs:

- [ ] **REQ-06**: Implement MUL (multiplication)
  - 8-bit × 8-bit → 16-bit result
  - Software multiplication routine
  
- [ ] **REQ-07**: Implement SHL/SHR (shift operations)
  - Left shift (ASL chain for multi-bit)
  - Right shift (LSR chain for multi-bit)
  
- [ ] **REQ-08**: Implement LOAD_ARRAY (array read)
  - Indexed memory access: `array[index]`
  - Must handle byte and word arrays
  
- [ ] **REQ-09**: Implement STORE_ARRAY (array write)
  - Indexed memory write: `array[index] = value`
  - Must handle byte and word arrays

### Could Have (🟡 MEDIUM - Quality Improvements)

- [ ] **REQ-10**: Implement function call ABI
  - Parameter passing convention
  - Currently marked as STUB
  
- [ ] **REQ-11**: Fix double-dot label syntax
  - `..block_if_then_0` may break ACME
  - Use single-dot or no-dot for block labels
  
- [ ] **REQ-12**: Add execution verification tests
  - Tests that verify generated code correctness
  - Pattern matching or behavioral tests

### Won't Have (Out of Scope)

- Floating point operations
- Signed multiplication/division (unsigned only)
- Advanced optimizer features (separate plan exists)
- Multi-byte arithmetic beyond word (16-bit)
- Inline assembly support (separate plan exists)

## Technical Requirements

### Value Tracking System

The code generator needs to track where IL values are located:

```
Value Location Types:
- ACCUMULATOR (A register)
- X_REGISTER (X register)  
- Y_REGISTER (Y register)
- ZERO_PAGE (ZP address)
- ABSOLUTE (RAM address)
- IMMEDIATE (constant value)
```

This is needed for REQ-02, REQ-03, and REQ-04.

### SSA PHI Node Lowering

PHI nodes appear at merge points in SSA form:

```
PHI(x.1, x.2) → x.3  // Select between x.1 and x.2 based on which block we came from
```

This must be converted to explicit moves before the merge point:

```
block1:
  STA x_merged   ; Save x.1
  
block2:
  STA x_merged   ; Save x.2
  
merge:
  LDA x_merged   ; Use merged value
```

### Software Multiplication

8-bit multiply requires a shift-and-add algorithm:

```
; result = a * b
; Uses shift-add: for each bit in b, if set, add shifted a to result
MUL:
  result = 0
  while b != 0:
    if (b & 1):
      result += a
    a <<= 1
    b >>= 1
```

### Array Access Code Generation

Array read pattern:
```asm
; value = array[index]
LDA index
TAY              ; Y = index
LDA array,Y      ; A = array[index]
```

Array write pattern:
```asm
; array[index] = value
LDY index        ; Y = index  
LDA value        ; A = value to store
STA array,Y      ; array[index] = value
```

## Scope Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Value tracking | Simple (A only) vs Full (A,X,Y,ZP) | Full | Needed for correct code |
| PHI lowering | Before codegen vs During codegen | During | Simpler to implement |
| Multiply | Inline vs Subroutine | Subroutine | Reusable, smaller code |
| Array access | Direct vs Computed | Both | Direct for const index, computed for var |

## Acceptance Criteria

### For REQ-01 (Member Access):
- [ ] `vic.borderColor = 0` compiles without "type unknown" error
- [ ] Member type correctly resolved from module definition
- [ ] snake-game/hardware.blend compiles successfully

### For REQ-02/03 (Binary/Comparison Ops):
- [ ] `ADD` generates `ADC` with actual operand value
- [ ] `SUB` generates `SBC` with actual operand value
- [ ] `CMP_*` generates `CMP` with actual operand value
- [ ] print-demo.blend arithmetic works correctly

### For REQ-04 (PHI Lowering):
- [ ] PHI nodes generate actual move instructions
- [ ] Control flow merge points have correct values
- [ ] No `NOP ; Placeholder` in output for PHI

### For REQ-05 (Label Generation):
- [ ] All referenced labels are defined
- [ ] main.blend compiles without "undefined label" error
- [ ] ACME assembler produces binary without errors

### For REQ-06/07 (MUL/Shift):
- [ ] `a * b` generates working multiply code
- [ ] `a << n` generates ASL chain
- [ ] `a >> n` generates LSR chain

### For REQ-08/09 (Arrays):
- [ ] `array[i]` read generates LDA with indexed addressing
- [ ] `array[i] = x` write generates STA with indexed addressing
- [ ] Both constant and variable indices work

### Overall Acceptance:
- [ ] **print-demo.blend** produces working .prg that runs in VICE
- [ ] **main.blend** produces working .prg that runs in VICE
- [ ] **snake-game/hardware.blend** compiles without errors
- [ ] All existing 7,059 tests still pass
- [ ] New execution tests added and passing