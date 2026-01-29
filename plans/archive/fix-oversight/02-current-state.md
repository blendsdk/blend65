# Current State: Fix All Critical Oversights

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The Blend65 compiler has a complete pipeline:

```
Source → Lexer → Parser → Semantic Analyzer → IL Generator → Code Generator → ASM-IL → ACME
```

All pipeline stages exist and pass tests. However, the **Code Generator** has stub implementations that produce non-functional assembly.

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `codegen/instruction-generator.ts` | IL → 6502 translation | Fix operand values, add PHI/MUL/arrays |
| `codegen/base-generator.ts` | Base utilities | Add value tracking system |
| `codegen/code-generator.ts` | Main generator | Fix label generation |
| `semantic/analyzer.ts` | Type checking | Fix member access resolution |
| `asm-il/emitters/acme-emitter.ts` | ACME output | Fix label prefix handling |

### Code Analysis

#### Issue 1: Binary Operations Use Placeholder `#$00`

**Location**: `codegen/instruction-generator.ts` lines 468-500

```typescript
protected generateBinaryOp(instr: ILBinaryInstruction): void {
  switch (instr.opcode) {
    case ILOpcode.ADD:
      this.emitInstruction('CLC', undefined, 'Clear carry for add', 1);
      this.emitInstruction('ADC', '#$00', 'STUB: Add placeholder', 2);  // ❌ WRONG
      break;
    case ILOpcode.SUB:
      this.emitInstruction('SEC', undefined, 'Set carry for subtract', 1);
      this.emitInstruction('SBC', '#$00', 'STUB: Subtract placeholder', 2);  // ❌ WRONG
      break;
    // ... all comparisons also use #$00
  }
}
```

**Generated Assembly**:
```asm
; v5 = v3 + v4
CLC                    ; ✅ Correct
ADC #$00               ; ❌ WRONG: Should use actual value from v4
```

#### Issue 2: PHI Nodes Emit NOP

**Location**: `codegen/instruction-generator.ts` line 330

```typescript
default:
  this.generatePlaceholder(instr);  // Falls through to this for PHI
  break;

protected generatePlaceholder(instr: ILInstruction): void {
  this.emitComment(`STUB: ${instr.toString()}`);
  this.emitNop('Placeholder');  // ❌ Does nothing
  this.addWarning(`Unsupported IL instruction: ${instr.opcode}`);
}
```

**Generated Assembly**:
```asm
; STUB: v14:i.1 = PHI [(v0:i.0, block0), (v11:i.2, block3)]
NOP                    ; ❌ WRONG: Should be actual move instructions
```

#### Issue 3: Member Access Shows "type unknown"

**Location**: `semantic/analyzer.ts` - member expression handling

```
error[S002]: Member access is not yet fully implemented (accessing 'borderColor' on type 'unknown')
  --> ./examples/snake-game/hardware.blend:329:3
    |
329 |   vic.borderColor = COLOR_BLACK;
    |   ^^^^^^^^^^^^^^^^^
```

The semantic analyzer doesn't resolve member types from imported modules.

#### Issue 4: Undefined Labels

**Location**: `codegen/code-generator.ts`

```
warning: ACME assembly failed: Value not defined (_main).
warning: ACME assembly failed: Value not defined (_data).
```

Labels are referenced (e.g., `JSR _main`) but never defined with `_main:`.

#### Issue 5: Double-Dot Labels

**Location**: `asm-il/emitters/acme-emitter.ts` line 65

```typescript
protected emitLabel(label: AsmLabel): void {
  const prefix = label.exported ? '+' : (label.type === LabelType.Block ? '.' : '');
  const labelText = `${prefix}${label.name}:`;  // If name already has '.', creates '..'
}
```

If the label name is `.block_if_then_0` and prefix is `.`, the result is `..block_if_then_0:`.

## Gaps Identified

### Gap 1: No Value Tracking

**Current Behavior:** Code generator doesn't know where IL values are stored.

**Required Behavior:** Track that `v1` is in accumulator, `v2` is at ZP $50, etc.

**Fix Required:** Add `ValueLocation` tracking system to `base-generator.ts`.

### Gap 2: STUB Operands

**Current Behavior:** All binary/comparison operations use `#$00`.

**Required Behavior:** Use the actual IL operand value.

**Fix Required:** Look up operand location and emit correct addressing mode.

### Gap 3: No PHI Implementation

**Current Behavior:** PHI nodes are ignored (NOP).

**Required Behavior:** Generate moves at the end of predecessor blocks.

**Fix Required:** Add PHI lowering in `generateBasicBlock()`.

### Gap 4: No MUL/SHR/SHL

**Current Behavior:** Unsupported, emits NOP.

**Required Behavior:** Generate software multiply and shift instructions.

**Fix Required:** Add `generateMul()`, `generateShl()`, `generateShr()` methods.

### Gap 5: No Array Operations

**Current Behavior:** LOAD_ARRAY/STORE_ARRAY emit NOP.

**Required Behavior:** Generate indexed addressing mode instructions.

**Fix Required:** Add `generateLoadArray()`, `generateStoreArray()` methods.

### Gap 6: Label Generation Issues

**Current Behavior:** Some labels referenced but not defined.

**Required Behavior:** All labels must be defined before reference.

**Fix Required:** Audit label generation, ensure all referenced labels exist.

### Gap 7: Member Access Resolution

**Current Behavior:** Returns "type unknown" for module members.

**Required Behavior:** Resolve member types from imported modules.

**Fix Required:** Fix semantic analyzer member expression handling.

## Dependencies

### Internal Dependencies

| Component | Depends On |
|-----------|------------|
| Binary ops fix | Value tracking system |
| PHI lowering | Value tracking system |
| MUL implementation | Basic binary ops working |
| Array operations | Index value tracking |

### External Dependencies

- ACME assembler (for binary output)
- VICE emulator (for testing)

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Value tracking complexity | HIGH | HIGH | Start simple (A register only), expand |
| PHI lowering correctness | MEDIUM | HIGH | Comprehensive test coverage |
| Test regressions | MEDIUM | MEDIUM | Run full test suite after each change |
| Performance impact | LOW | LOW | Optimize later if needed |

## Evidence: Generated Assembly Analysis

From `build/print-demo.asm`:

```asm
; function getScreenAddr(): word
._getScreenAddr:
        LDA $0B                 ; Load cursorY ✅
        LDA _SCREEN_WIDTH       ; Load SCREEN_WIDTH ✅
; STUB: v3 = MUL v1, v2
        NOP                     ; Placeholder ❌ MUL not implemented
        LDA $0A                 ; Load cursorX ✅
; v5 = v3 + v4
        CLC                     ; Clear carry for add ✅
        ADC #$00                ; STUB: Add placeholder ❌ Wrong operand
```

**Issues in this snippet:**
1. `MUL` → `NOP` (not implemented)
2. `ADD` → `ADC #$00` (wrong operand)
3. Result never stored properly