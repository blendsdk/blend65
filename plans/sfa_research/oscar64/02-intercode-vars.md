# Oscar64 InterCode Variables

> **Document**: 02-intercode-vars.md
> **Purpose**: SFA Research - Oscar64 InterCode Variable Analysis
> **Created**: 2025-01-31
> **Status**: Complete

## Executive Summary

Oscar64 uses a sophisticated intermediate representation (InterCode) where variables are categorized by memory type and can be promoted to temporaries. The system distinguishes between local variables, parameters (stack and fastcall), globals, and temporaries with explicit aliasing tracking to enable optimizations.

## InterMemory Enumeration

The `InterMemory` enum defines all memory access types in the IC:

```cpp
enum InterMemory
{
    IM_NONE,       // No memory access
    IM_PARAM,      // Parameters on software stack
    IM_LOCAL,      // Local variables in stack frame
    IM_GLOBAL,     // Global variables (linker-resolved)
    IM_FRAME,      // Memory for passing params on stack
    IM_PROCEDURE,  // Procedure reference
    IM_INDIRECT,   // Indirect memory access
    IM_TEMPORARY,  // Temporary storage
    IM_ABSOLUTE,   // Absolute memory address
    IM_FPARAM,     // Fastcall params in zero page
    IM_FFRAME,     // Fastcall frame for passing params
};
```

### Memory Type Relationships

| Memory Type | Storage Location | When Used |
|-------------|------------------|-----------|
| `IM_LOCAL` | Stack frame | Local variables |
| `IM_PARAM` | Software stack | Stackcall parameters |
| `IM_FPARAM` | Zero page | Fastcall parameters |
| `IM_FRAME` | Software stack | Passing args to stackcall |
| `IM_FFRAME` | Zero page | Passing args to fastcall |
| `IM_GLOBAL` | BSS/DATA | Global/static variables |
| `IM_TEMPORARY` | ZP temps | Compiler temporaries |
| `IM_INDIRECT` | Via pointer | Dereferenced pointers |
| `IM_ABSOLUTE` | Fixed address | Memory-mapped I/O |

### Memory Selection Logic

```cpp
// In InterCodeProcedure
InterMemory paramMemory = mFastCallProcedure ? IM_FPARAM : IM_PARAM;
```

## InterVariable Class

The `InterVariable` class represents variables in the IC:

```cpp
class InterVariable
{
public:
    bool    mUsed;        // Variable is actually used
    bool    mAliased;     // Address taken (prevents optimization)
    bool    mTemp;        // Promoted to temporary
    bool    mNotAliased;  // Explicitly not aliased
    
    int     mIndex;       // Variable index in array
    int     mSize;        // Size in bytes
    int     mOffset;      // Offset in frame/section
    int     mAlignment;   // Alignment requirement
    int     mTempIndex;   // Temp index if promoted (-1 if not)
    int     mByteIndex;   // Byte-level index for partial access
    int     mNumReferences; // Reference count
    
    const Ident*     mIdent;        // Variable name
    LinkerObject*    mLinkerObject; // For globals
    Declaration*     mDeclaration;  // Source declaration
};
```

### Key Fields Explained

| Field | Purpose |
|-------|---------|
| `mUsed` | Only used variables get allocated |
| `mAliased` | If true, variable can't be optimized away |
| `mTemp` | True if promoted to register/temporary |
| `mTempIndex` | Index into `mTemporaries` array if promoted |
| `mOffset` | Final offset within frame (computed by `MapVariables`) |
| `mLinkerObject` | For globals - links to linker section |

## InterOperand Memory Reference

Each instruction operand tracks its memory reference:

```cpp
class InterOperand
{
public:
    int           mTemp;         // Temporary index (-1 if not temp)
    InterType     mType;         // Data type
    int64         mIntConst;     // Constant offset
    int           mVarIndex;     // Variable index
    int           mOperandSize;  // Access size
    LinkerObject* mLinkerObject; // For globals
    InterMemory   mMemory;       // Primary memory type
    InterMemory   mMemoryBase;   // Base memory (for indexed access)
    // ... value range tracking
};
```

### Memory Access Patterns

**Direct Local Access:**
```cpp
// IC for: local_var = 5
if (ins->mSrc[1].mMemory == IM_LOCAL && ins->mSrc[1].mTemp < 0) {
    // Direct store to local variable
    int vindex = ins->mSrc[1].mVarIndex;
    int offset = proc->mLocalVars[vindex]->mOffset;
}
```

**Fastcall Parameter Access:**
```cpp
// IC for: param = value (fastcall)
if (ins->mSrc[0].mMemory == IM_FPARAM) {
    // Access zero page parameter
    int zpOffset = BC_REG_FPARAMS + ins->mSrc[0].mVarIndex;
}
```

## Variable Collection and Tracking

### InterCodeProcedure Variable State

```cpp
class InterCodeProcedure
{
    // Variable arrays
    GrowingVariableArray mLocalVars;     // Local variables
    GrowingVariableArray mParamVars;     // Parameters
    
    // Aliasing tracking
    NumberSet mLocalAliasedSet;  // Which locals have address taken
    NumberSet mParamAliasedSet;  // Which params have address taken
    
    // Temporaries
    GrowingTypeArray  mTemporaries;   // Type of each temp
    GrowingIntArray   mTempOffset;    // Offset of each temp in ZP
    GrowingIntArray   mTempSizes;     // Size of each temp
    int               mTempSize;      // Total temp space needed
    
    // Frame info
    int mLocalSize;      // Total local frame size
    int mNumLocals;      // Number of local variables
    int mNumParams;      // Number of parameters
    int mParamVarsSize;  // Total param space needed
    
    // Procedure flags
    bool mFastCallProcedure;  // Uses ZP params
    bool mFramePointer;       // Needs frame pointer
    bool mDynamicStack;       // Has dynamic stack usage
};
```

### CollectVariables Flow

```cpp
void InterCodeProcedure::CollectVariables(InterMemory paramMemory)
{
    // Reset aliasing flags
    for (int i = 0; i < mLocalVars.Size(); i++)
        if (mLocalVars[i])
            mLocalVars[i]->mAliased = false;
    for (int i = 0; i < mParamVars.Size(); i++)
        if (mParamVars[i])
            mParamVars[i]->mAliased = false;

    ResetVisited();
    mEntryBlock->CollectVariables(
        mModule->mGlobalVars,  // Global var array
        mLocalVars,            // Local var array
        mParamVars,            // Param var array
        paramMemory            // IM_PARAM or IM_FPARAM
    );
}
```

### Variable Collection in Basic Blocks

```cpp
void InterCodeBasicBlock::CollectVariables(
    GrowingVariableArray& globalVars,
    GrowingVariableArray& localVars,
    GrowingVariableArray& paramVars,
    InterMemory paramMemory)
{
    for (int i = 0; i < mInstructions.Size(); i++) {
        InterInstruction* ins = mInstructions[i];
        
        // Handle different instruction types
        switch (ins->mCode) {
        case IC_CONSTANT:
            if (ins->mConst.mMemory == IM_LOCAL) {
                // Track local variable reference
                EnsureVar(localVars, ins->mConst.mVarIndex);
            }
            break;
            
        case IC_LEA:
            if (ins->mSrc[1].mMemory == IM_LOCAL) {
                // Address-of local - marks as aliased
                EnsureVar(localVars, ins->mSrc[1].mVarIndex);
            }
            break;
            
        case IC_LOAD:
        case IC_STORE:
            // Track all operand memory accesses
            for (int j = 0; j < ins->mNumOperands; j++) {
                if (ins->mSrc[j].mMemory == IM_LOCAL) {
                    EnsureVar(localVars, ins->mSrc[j].mVarIndex);
                }
                else if (ins->mSrc[j].mMemory == IM_FPARAM ||
                         ins->mSrc[j].mMemory == IM_PARAM) {
                    EnsureVar(paramVars, ins->mSrc[j].mVarIndex);
                }
            }
            break;
        }
    }
    
    // Recurse to successors
    if (mTrueJump) mTrueJump->CollectVariables(...);
    if (mFalseJump) mFalseJump->CollectVariables(...);
}
```

## Local-to-Temp Promotion

Oscar64 can promote simple, non-aliased locals to temporaries for better optimization.

### Promotion Criteria

```cpp
void InterCodeProcedure::PromoteSimpleLocalsToTemp(
    InterMemory paramMemory, int nlocals, int nparams)
{
    FastNumberSet complexLocals, simpleLocals;
    FastNumberSet complexParams, simpleParams;
    GrowingTypeArray localTypes, paramTypes;
    
    // Collect which locals can be promoted
    ResetVisited();
    mEntryBlock->CollectSimpleLocals(
        complexLocals, simpleLocals, localTypes,
        complexParams, simpleParams, paramTypes
    );
    
    // Promote simple locals
    for (int vi = 0; vi < nlocals; vi++) {
        if (simpleLocals[vi] && !complexLocals[vi]) {
            // Mark as promoted to temp
            mLocalVars[vi]->mTemp = true;
            mLocalVars[vi]->mTempIndex = AddTemporary(localTypes[vi]);
            
            // Update all references
            ResetVisited();
            mEntryBlock->SimpleLocalToTemp(vi, mLocalVars[vi]->mTempIndex);
        }
    }
}
```

### What Makes a Local "Complex"

A local is marked complex (not promotable) if:

```cpp
case IC_LEA:
    // Address taken - COMPLEX
    if (mSrc[1].mMemory == IM_LOCAL && mSrc[1].mTemp < 0)
        complexLocals += mSrc[1].mVarIndex;
    break;

case IC_COPY:
case IC_FILL:
    // Bulk operations - COMPLEX
    if (mSrc[1].mMemory == IM_LOCAL && mSrc[1].mTemp < 0)
        complexLocals += mSrc[1].mVarIndex;
    break;

case IC_CONSTANT:
    // Pointer to local - COMPLEX
    if (mDst.mType == IT_POINTER && mConst.mMemory == IM_LOCAL)
        complexLocals += mConst.mVarIndex;
    break;
```

### What Makes a Local "Simple"

```cpp
case IC_LOAD:
    // Simple load from local
    if (mSrc[0].mMemory == IM_LOCAL && mSrc[0].mTemp < 0) {
        simpleLocals += mSrc[0].mVarIndex;
        // Track type for temp allocation
        localTypes[mSrc[0].mVarIndex] = mDst.mType;
    }
    break;

case IC_STORE:
    // Simple store to local
    if (mSrc[1].mMemory == IM_LOCAL && mSrc[1].mTemp < 0) {
        simpleLocals += mSrc[1].mVarIndex;
        localTypes[mSrc[1].mVarIndex] = mSrc[0].mType;
    }
    break;
```

## Temporary Management

### Adding Temporaries

```cpp
int InterCodeProcedure::AddTemporary(InterType type)
{
    int index = mTemporaries.Size();
    mTemporaries.Push(type);
    return index;
}
```

### Temporary Allocation in Frame

```cpp
void InterCodeProcedure::MapVariables(void)
{
    // Calculate temp offsets within ZP temp region
    int offset = 0;
    for (int i = 0; i < mTemporaries.Size(); i++) {
        mTempOffset[i] = offset;
        int size = InterTypeSize[mTemporaries[i]];
        mTempSizes[i] = size;
        offset += size;
    }
    mTempSize = offset;
    
    // Calculate local offsets within frame
    mLocalSize = 0;
    for (int i = 0; i < mLocalVars.Size(); i++) {
        if (mLocalVars[i] && mLocalVars[i]->mUsed && 
            !mLocalVars[i]->mLinkerObject) {
            mLocalVars[i]->mOffset = mLocalSize;
            mLocalSize += mLocalVars[i]->mSize;
        }
    }
}
```

## Aliasing Analysis

### Building Alias Sets

```cpp
void InterCodeProcedure::BuildLocalAliasTable(void)
{
    GrowingIntArray localTable, paramTable;
    int nlocals = 0, nparams = 0;
    
    // Collect address-of operations
    ResetVisited();
    mEntryBlock->CollectLocalAddressTemps(
        localTable, paramTable, nlocals, nparams
    );
    
    // Mark aliased variables
    mLocalAliasedSet.Reset(mLocalVars.Size());
    mParamAliasedSet.Reset(mParamVars.Size());
    
    ResetVisited();
    mEntryBlock->MarkAliasedLocalTemps(
        localTable, mLocalAliasedSet,
        paramTable, mParamAliasedSet
    );
}
```

### Using Alias Info for Optimization

```cpp
// In memory colliding check
if (op1.mMemory == IM_LOCAL && !mProc->mLocalVars[op1.mVarIndex]->mAliased)
    // Safe - no aliasing possible
    return false;

// In store forwarding
if ((mem == IM_PARAM && !aliasedParams[vindex]) ||
    (mem == IM_LOCAL && !aliasedLocals[vindex]))
    // Can forward through call - variable not aliased
```

## InterType and Sizing

```cpp
enum InterType
{
    IT_NONE,
    IT_BOOL,      // 1 byte
    IT_INT8,      // 1 byte
    IT_INT16,     // 2 bytes
    IT_INT32,     // 4 bytes
    IT_FLOAT,     // 4 bytes (software float)
    IT_POINTER    // 2 bytes (16-bit address)
};

int InterTypeSize[] = {
    0,  // IT_NONE
    1,  // IT_BOOL
    1,  // IT_INT8
    2,  // IT_INT16
    4,  // IT_INT32
    4,  // IT_FLOAT
    2   // IT_POINTER
};
```

## Key Insights for Blend SFA

### 1. Dual Memory Paths (IM_PARAM vs IM_FPARAM)

Oscar64 maintains parallel memory paths for parameters:
- **IM_PARAM/IM_FRAME** - Software stack-based
- **IM_FPARAM/IM_FFRAME** - Zero page-based

Selection is procedure-wide based on `mFastCallProcedure` flag.

### 2. Local-to-Temp Promotion

Simple scalar locals without address-taken can be promoted to temporaries:
- Removes memory operations
- Enables register allocation
- Improves code quality

### 3. Explicit Aliasing Tracking

Per-variable aliasing flags enable aggressive optimization:
- Non-aliased variables can be cached in temps
- Call boundaries don't invalidate non-aliased locals
- Store forwarding works through calls for non-aliased vars

### 4. Offset Computation

Frame offsets computed late in compilation:
- Locals: `mLocalVars[i]->mOffset` relative to frame base
- Temps: `mTempOffset[i]` relative to ZP temp region
- Params: `mVarIndex` is the offset (pre-computed by caller)

### 5. Value Range Tracking

Oscar64 tracks integer value ranges through IC:
- Enables range-based optimizations
- Simplifies comparisons
- Helps with overflow detection

## Comparison: Oscar64 vs KickC InterCode

| Feature | Oscar64 | KickC |
|---------|---------|-------|
| Memory Model | Explicit `InterMemory` enum | Fragment-based |
| Local Promotion | `mTemp` + `mTempIndex` | Separate passes |
| Aliasing | `mAliased` flag per var | Liveness-based |
| Frame Coalescing | NO | YES |
| Parameter Regions | Dual (stack/ZP) | Separate handling |
| Value Ranges | Integrated | Separate analysis |

## Next Steps

- [x] Session 3.3: InterCode variables documented
- [ ] Session 3.4: Native code generation - how IC vars map to 6502 code