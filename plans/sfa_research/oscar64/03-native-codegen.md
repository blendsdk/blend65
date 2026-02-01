# Oscar64 Native Code Generation

> **Document**: 03-native-codegen.md
> **Purpose**: SFA Research - Oscar64 Native Code Generation for Frame Operations
> **Created**: 2025-01-31
> **Status**: Complete

## Executive Summary

Oscar64 generates native 6502 code using a sophisticated approach with dual frame modes (stack-relative vs frame-pointer-relative), extensive peephole optimization, and value forwarding. The code generator uses ZP registers for stack/frame pointers and supports both software stack and frame pointer access patterns.

## ZP Register Layout

Default C64 ZP layout for frame operations:

```cpp
// MachineTypes.cpp defaults
BC_REG_STACK  = 0x23;  // Software stack pointer (2 bytes)
BC_REG_LOCALS = 0x25;  // Frame pointer (2 bytes)

// Configured aliases in parser
__sp = BC_REG_STACK   // Assembly alias
__fp = BC_REG_LOCALS  // Assembly alias
```

### Extended ZP Mode

For extended ZP configurations, different registers are used:

| Mode | BC_REG_STACK | BC_REG_LOCALS |
|------|--------------|---------------|
| Default C64 | $23 | $25 |
| Extended | $A1 | $A3 |
| Custom (parser) | Configurable | Configurable |

## Frame Modes

Oscar64 supports two frame modes controlled by `mNoFrame`:

### 1. No Frame Pointer Mode (`mNoFrame = true`)

When functions have small frame requirements, locals are accessed directly via the stack pointer:

```cpp
// Frame selection logic
if (mStackExpand + proc->mCommonFrameSize + proc->mParamVarsSize < 256)
    mNoFrame = true;
else
    mNoFrame = false;
```

**Characteristics:**
- Locals accessed via `BC_REG_STACK` + offset
- No frame pointer save/restore overhead
- Limited to frames < 256 bytes
- Faster function entry/exit

### 2. Frame Pointer Mode (`mNoFrame = false`)

For larger frames or when debugging is enabled:

```cpp
// Debug mode forces frame pointer
if (!(proc->mCompilerOptions & COPT_OPTIMIZE_BASIC) && 
    (proc->mCompilerOptions & COPT_DEBUGINFO))
    mNoFrame = false;
```

**Characteristics:**
- Frame pointer (`BC_REG_LOCALS`) points to frame base
- Locals accessed via `BC_REG_LOCALS` + offset
- Required for frames >= 256 bytes
- Required for dynamic stack allocation

## Frame Index Calculation

The `CheckFrameIndex` function calculates final frame offsets:

```cpp
void NativeCodeBasicBlock::CheckFrameIndex(
    const InterInstruction* ins, 
    int& reg, 
    int& index, 
    int size, 
    int treg)
{
    // Determine base register
    int areg = mNoFrame ? BC_REG_STACK : BC_REG_LOCALS;
    
    // Calculate index based on memory type
    if (ins->mSrc[0].mMemory == IM_LOCAL) {
        // Local variable: add var offset + local size + saved frame pointer
        index += ins->mSrc[0].mVarIndex + proc->mLocalSize + 2;
    }
    
    // Add frame offset (temp save area)
    index += mFrameOffset;
}
```

### Offset Components

| Component | Meaning |
|-----------|---------|
| `mVarIndex` | Variable offset within locals area |
| `mLocalSize` | Total size of all locals |
| `+2` | Saved frame pointer (when applicable) |
| `mFrameOffset` | Temp save area size |

## Stack Frame Layout

```
High Address
+-------------------+
| Caller's Frame    |
+-------------------+
| Return Address    |  (on HW stack)
+-------------------+
| Saved FP (if any) |  +2 bytes
+-------------------+
| Saved Temps       |  mFrameOffset bytes
+-------------------+
| Local Variables   |  mLocalSize bytes
+-------------------+ <- BC_REG_LOCALS (if !mNoFrame)
| Parameters        |  mParamVarsSize bytes (stackcall)
+-------------------+ <- BC_REG_STACK
Low Address
```

## Code Generation Patterns

### Function Entry (No Frame Mode)

```asm
; Stack allocation
SEC
LDA BC_REG_STACK
SBC #frameSize
STA BC_REG_STACK
BCS +2
DEC BC_REG_STACK+1
```

### Function Entry (Frame Mode)

```asm
; Stack allocation
SEC
LDA BC_REG_STACK
SBC #stackExpand
STA BC_REG_STACK
LDA BC_REG_STACK+1
SBC #(stackExpand >> 8)
STA BC_REG_STACK+1

; Save frame pointer
LDY #tempSave
LDA BC_REG_LOCALS
STA (BC_REG_STACK),Y
INY
LDA BC_REG_LOCALS+1
STA (BC_REG_STACK),Y

; Set up new frame pointer
CLC
LDA BC_REG_STACK
ADC #(frameSpace + 2)
STA BC_REG_LOCALS
LDA BC_REG_STACK+1
ADC #0
STA BC_REG_LOCALS+1
```

### Local Variable Access (No Frame)

```asm
; Load local at offset
LDY #(index)
LDA (BC_REG_STACK),Y
```

### Local Variable Access (Frame Mode)

```asm
; Load local at offset
LDY #(index)
LDA (BC_REG_LOCALS),Y
```

### 16-bit Local Store

```asm
; Store 16-bit value to local
LDY #(index)
LDA zp_temp
STA (BC_REG_STACK),Y
LDY #(index + 1)
LDA zp_temp+1
STA (BC_REG_STACK),Y
```

### Function Exit (Frame Mode)

```asm
; Restore frame pointer
LDY #tempSave
LDA (BC_REG_STACK),Y
STA BC_REG_LOCALS
INY
LDA (BC_REG_STACK),Y
STA BC_REG_LOCALS+1

; Deallocate stack
CLC
LDA BC_REG_STACK
ADC #stackExpand
STA BC_REG_STACK
LDA BC_REG_STACK+1
ADC #(stackExpand >> 8)
STA BC_REG_STACK+1
```

## Optimization Techniques

### 1. Value Forwarding

The `ValueForwarding` pass tracks register contents and eliminates redundant loads:

```cpp
bool NativeCodeInstruction::ValueForwarding(
    NativeRegisterDataSet& data, 
    AsmInsType& carryop, 
    bool initial, 
    bool final, 
    int fastCallBase)
{
    // Track what's in A, X, Y, ZP registers
    // Eliminate redundant loads/stores
}
```

### 2. Peephole Optimization

Multi-level peephole passes optimize instruction sequences:

```cpp
bool NativeCodeBasicBlock::PeepHoleOptimizer(int pass);
bool NativeCodeBasicBlock::PeepHoleOptimizerIterate1(int i, int pass);
bool NativeCodeBasicBlock::PeepHoleOptimizerIterate2(int i, int pass);
// ... up to Iterate6 and IterateN
```

**Example optimizations:**
- Combine ADC/STA sequences with INC/DEC
- Eliminate redundant flag tests
- Simplify Y-indexed indirect accesses

### 3. Register Data Tracking

`NativeRegisterDataSet` tracks what each register contains:

```cpp
struct NativeRegisterData {
    LinkerObject* mLinkerObject;  // Object reference (if any)
    int mValue;                    // Known value
    int mUnique;                   // Uniqueness tracking
    uint32 mFlags;                 // Status flags
    NativeRegisterDataMode mMode;  // How loaded (immediate, ZP, etc.)
    uint8 mMinVal, mMaxVal, mMask; // Value range
};
```

### 4. Cross-Block Optimization

Oscar64 performs cross-block optimizations:

```cpp
bool NativeCodeBasicBlock::CrossBlockStoreLoadBypass(NativeCodeProcedure* proc);
bool NativeCodeBasicBlock::CrossBlockXYFlood(NativeCodeProcedure* proc);
bool NativeCodeBasicBlock::CrossBlock16BitFlood(NativeCodeProcedure* proc);
```

## Addressing Mode Selection

Oscar64 chooses addressing modes based on operand type:

| IC Memory | Addressing Mode | Notes |
|-----------|-----------------|-------|
| IM_LOCAL | Indirect Y | Via frame pointer |
| IM_PARAM | Indirect Y | Via stack pointer |
| IM_FPARAM | Zero Page | Direct fastcall access |
| IM_GLOBAL | Absolute | Linker-resolved |
| IM_ABSOLUTE | Absolute | Fixed address |

## Leaf Procedure Optimization

Leaf procedures (no calls) can use simplified frame handling:

```cpp
if (proc->mLeafProcedure && 
    proc->mFastCallProcedure && 
    !proc->mInterrupt && 
    !proc->mDispatchedCall && 
    mNoFrame && 
    mStackExpand == 0 && 
    commonFrameSize == 0 && 
    proc->mTempSize <= BC_REG_TMP_SAVED - BC_REG_TMP)
{
    // Fast path: no frame setup needed
    MapFastParamsToTemps();
}
```

## Interrupt Handling

Interrupts require special frame handling:

```cpp
if (!mNoFrame || commonFrameSize > 0)
    mErrors->Error(mLocation, ERRR_INTERRUPT_TO_COMPLEX, 
        "Function too complex for interrupt");
```

**Interrupt constraints:**
- Must use no-frame mode
- No common frame allocation
- Must preserve all registers
- Special save/restore for ZP registers used

## Debug Information

When debugging is enabled, frame information is emitted:

```cpp
// With frame pointer
fprintf(file, "{\"name\": \"%s\", \"start\": %d, \"end\": %d, \"base\": %d}",
    v->mIdent->mString, v->mOffset, v->mOffset + v->mSize, BC_REG_LOCALS);

// Without frame pointer
fprintf(file, "{\"name\": \"%s\", \"start\": %d, \"end\": %d, \"base\": %d}",
    v->mIdent->mString, v->mOffset, v->mOffset + v->mSize, BC_REG_STACK);
```

## Key Insights for Blend SFA

### 1. Dual Frame Modes

Oscar64's dual frame mode approach is efficient:
- Small functions: stack-relative (no frame pointer overhead)
- Large functions: frame pointer for >256 byte frames

### 2. Software Stack Design

The software stack uses ZP pointers:
- 16-bit pointer for >256 byte addressability
- Indirect Y addressing for frame access
- Efficient stack push/pop via pointer arithmetic

### 3. Optimization Integration

Frame operations are optimized together with other code:
- Value forwarding tracks frame loads
- Peephole optimizer handles frame patterns
- Cross-block optimization spans function boundaries

### 4. Debug Compatibility

Frame design supports debugging:
- Variable locations tracked in JSON format
- Frame pointer available for stack unwinding
- Symbol information tied to frame offsets

## Next Steps

- [x] Session 3.4.5: Native codegen documented
- [ ] Session 3.4.6: Global analysis documentation
- [ ] Session 3.4.7: Complete overview