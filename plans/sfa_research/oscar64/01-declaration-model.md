# Oscar64 Declaration Model

> **Document**: 01-declaration-model.md
> **Purpose**: SFA Research - Declaration Analysis
> **Created**: 2025-01-31
> **Status**: Complete

## Overview

Oscar64 uses a unified `Declaration` class for all named entities: types, variables, functions, and constants. The declaration model is central to SFA because it tracks variable metadata needed for allocation decisions.

## Declaration Types (DecType)

### Type Declarations
| Type | Description |
|------|-------------|
| `DT_TYPE_VOID` | Void type |
| `DT_TYPE_INTEGER` | Integer types (1-4 bytes) |
| `DT_TYPE_FLOAT` | Float type |
| `DT_TYPE_POINTER` | Pointer type |
| `DT_TYPE_ARRAY` | Array type |
| `DT_TYPE_STRUCT` | Struct type |
| `DT_TYPE_FUNCTION` | Function type |

### Value Declarations  
| Type | Description |
|------|-------------|
| `DT_CONST_INTEGER` | Integer constant |
| `DT_CONST_FLOAT` | Float constant |
| `DT_CONST_FUNCTION` | Function definition |
| `DT_VARIABLE` | Variable |
| `DT_ARGUMENT` | Function parameter |
| `DT_ELEMENT` | Struct element |

## SFA-Relevant Flags

### Storage Classification
```cpp
DTF_GLOBAL     = (1ULL << 2)   // Global variable
DTF_STATIC     = (1ULL << 5)   // Static variable
DTF_ZEROPAGE   = (1ULL << 22)  // In zero page
DTF_MEMMAP     = (1ULL << 57)  // Memory-mapped
```

### Calling Convention
```cpp
DTF_FASTCALL   = (1ULL << 14)  // ZP-based params
DTF_STACKCALL  = (1ULL << 21)  // Stack-based params
DTF_INTERRUPT  = (1ULL << 18)  // Interrupt handler
DTF_HWINTERRUPT= (1ULL << 20)  // Hardware interrupt
```

### Function Analysis
```cpp
DTF_FUNC_RECURSIVE  = (1ULL << 38)  // Recursive function
DTF_FUNC_ANALYZING  = (1ULL << 39)  // Currently analyzing
DTF_FUNC_INTRSAVE   = (1ULL << 41)  // Interrupt-safe
DTF_FUNC_INTRCALLED = (1ULL << 42)  // Called from interrupt
DTF_FUNC_VARIABLE   = (1ULL << 36)  // Address taken
```

### Variable Analysis
```cpp
DTF_VAR_ADDRESS   = (1ULL << 46)  // Address taken
DTF_VAR_ALIASING  = (1ULL << 48)  // Has aliasing
DTF_ANALYZED      = (1ULL << 16)  // Analysis complete
```

## SFA-Relevant Fields

### Variable Allocation
```cpp
int mVarIndex;       // Index in fastcall param region
int mOffset;         // Offset in struct/frame
int mSize;           // Size in bytes
LinkerSection* mSection;     // Target section (zeropage, data, etc.)
LinkerObject* mLinkerObject; // Final allocated object
```

### Call Graph
```cpp
GrowingArray<Declaration*> mCallers;  // Functions that call this
GrowingArray<Declaration*> mCalled;   // Functions called by this
```

### Fastcall Management
```cpp
int mFastCallBase;   // Base offset in fastcall region
int mFastCallSize;   // Size of fastcall params
int mFastCallBase2;  // Secondary region base
int mFastCallSize2;  // Secondary region size
```

### Usage Tracking
```cpp
int mUseCount;       // Access frequency counter
int mComplexity;     // Function complexity score
int mLocalSize;      // Size of local variables
```

## Variable Categorization

Oscar64 categorizes variables for allocation:

### 1. Global Variables (DTF_GLOBAL)
- Allocated in `data` or `bss` section
- May be promoted to ZP via `AutoZeroPage()`
- Subject to global analysis

### 2. Static Variables (DTF_STATIC)
- Similar to globals but limited scope
- Shared between function invocations
- May be promoted to ZP

### 3. Local Variables
- Non-static variables in functions
- **Fastcall:** Allocated in ZP param region
- **Stackcall:** Allocated on software stack

### 4. Parameters (DT_ARGUMENT)
- **Fastcall:** `mVarIndex` = ZP offset in `BC_REG_FPARAMS`
- **Stackcall:** Offset from frame pointer

### 5. Zero Page Variables (DTF_ZEROPAGE)
- Explicitly marked or promoted by `AutoZeroPage()`
- Highest priority for access frequency

## Scope Management

Oscar64 uses `DeclarationScope` for nested scopes:

```cpp
class DeclarationScope {
    ScopeLevel mLevel;     // SLEVEL_GLOBAL, SLEVEL_FUNCTION, etc.
    DeclarationScope* mParent;
    // Hash table for symbol lookup
};
```

### Scope Levels
| Level | Description |
|-------|-------------|
| `SLEVEL_GLOBAL` | Global scope |
| `SLEVEL_STATIC` | Static namespace |
| `SLEVEL_CLASS` | Class scope |
| `SLEVEL_FUNCTION` | Function scope |
| `SLEVEL_LOCAL` | Block scope |

## Parameter Handling

### Fastcall Parameters
```cpp
// In CheckFastcall():
dec->mVarIndex = nparams;  // Direct ZP offset
nparams += dec->mBase->mSize;
```

- Parameters stored at `BC_REG_FPARAMS + mVarIndex`
- Contiguous allocation in ZP
- Size limited by `BC_REG_FPARAMS_END - BC_REG_FPARAMS`

### Stackcall Parameters
```cpp
dec->mVarIndex = nparams2 + numfpzero;  // Stack offset
nparams2 += dec->mBase->mSize;
```

- Parameters pushed to software stack
- Accessed via frame pointer (`BC_REG_LOCALS`)

## Storage Class Determination

The calling convention determines storage:

```cpp
// In CheckFastcall():
if (recursive || variadic || addressTaken)
    procDec->mBase->mFlags |= DTF_STACKCALL;
else if (paramsInRange && !dynamicStack)
    procDec->mBase->mFlags |= DTF_FASTCALL;
else
    procDec->mBase->mFlags |= DTF_STACKCALL;
```

**Decision Tree:**
1. Recursive? → STACKCALL
2. Variadic? → STACKCALL  
3. Function pointer? → STACKCALL
4. Params fit in ZP? → FASTCALL
5. Otherwise → STACKCALL

## Key Insights for Blend

1. **Unified Declaration Class**
   - All named entities share same structure
   - Flags differentiate behavior
   - Simplifies analysis passes

2. **Direct ZP Indexing**
   - `mVarIndex` directly maps to ZP offset
   - No indirection for fastcall params
   - Very efficient for 6502

3. **Usage Counting**
   - `mUseCount` tracks access frequency
   - Used for ZP promotion priority
   - Weighted by type (pointers > integers)

4. **Call Graph in Declarations**
   - `mCallers` / `mCalled` arrays
   - Enables recursion detection
   - Supports inlining decisions

5. **No Frame Coalescing**
   - Each variable gets unique allocation
   - No call-graph-based memory reuse
   - Simpler but uses more memory