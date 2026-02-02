# Oscar64 Architecture Overview

> **Document**: 00-overview.md
> **Purpose**: SFA Research - Oscar64 Compiler Analysis
> **Created**: 2025-01-31
> **Status**: In Progress

## Executive Summary

Oscar64 is a modern C++ compiler for the 6502 processor, featuring sophisticated global analysis, automatic zero-page allocation, and dual calling conventions (fastcall/stackcall). Its approach combines weight-based ZP priority with recursion-aware calling convention selection.

## Repository Structure

```
oscar64/
├── oscar64/             # Main compiler source
│   ├── Compiler.cpp     # Main compiler orchestration
│   ├── Compiler.h       # Compiler interface
│   ├── Scanner.cpp      # Lexer
│   ├── Parser.cpp       # Parser
│   ├── Declaration.*    # Type system & declarations
│   ├── InterCode.*      # Intermediate representation
│   ├── InterCodeGenerator.* # IR generation
│   ├── GlobalAnalyzer.* # Global analysis (SFA critical!)
│   ├── GlobalOptimizer.* # Global optimization
│   ├── NativeCodeGenerator.* # 6502 code gen
│   └── Linker.*         # Linking & memory allocation
├── include/             # Standard library headers
├── samples/             # Example programs
└── autotest/            # Test suite
```

## Compilation Pipeline

```
Source → Scanner → Parser → AST/Declaration
                              ↓
                    GlobalOptimizer (optional)
                              ↓
                    GlobalAnalyzer
                      ├── MarkRecursions()
                      ├── AutoInline()
                      ├── CheckFastcall()
                      ├── CheckInterrupt()
                      └── AutoZeroPage()
                              ↓
                    InterCodeGenerator → InterCode (IC)
                              ↓
                    CompileProcedure()
                      └── NativeCodeGenerator → 6502 Assembly
                              ↓
                    Linker → Final Binary
```

## Memory Sections

Oscar64 uses linker sections to organize memory:

| Section | Purpose |
|---------|---------|
| `zeropage` | Zero page variables ($00-$FF) |
| `stack` | Software stack (default 4096 bytes) |
| `heap` | Heap allocation (default 1024 bytes) |
| `code` | Program code |
| `data` | Initialized data |
| `bss` | Uninitialized data |

### Target Machine Variations

| Machine | Stack Size | ZP Range |
|---------|------------|----------|
| C64 | 4096 | $F7-$FF (default) |
| C64 Extended | 4096 | $80-$FF |
| VIC20 | 512 | $F7-$FF |
| NES | 256 | $80-$FF |
| Atari | 4096 | $E0-$FF |

## Zero Page Register Allocation

Oscar64 reserves ZP for specific purposes:

```c
// C64 Default Layout:
BC_REG_WORK_Y     = 0x02   // Work register Y
BC_REG_WORK       = 0x03   // Work register
BC_REG_FPARAMS    = 0x03   // Fastcall params start
BC_REG_FPARAMS_END= 0x0F   // Fastcall params end
BC_REG_IP         = 0x0F   // Instruction pointer (bytecode)
BC_REG_ACCU       = 0x11   // Accumulator
BC_REG_ADDR       = 0x15   // Address register
BC_REG_STACK      = 0x19   // Stack pointer
BC_REG_LOCALS     = 0x1B   // Frame pointer (LOCALS)
BC_REG_TMP        = 0x1D   // Temporaries start
BC_REG_TMP_SAVED  = 0x3D   // Saved temporaries

// Extended ZP Mode (COPT_EXTENDED_ZERO_PAGE):
BC_REG_FPARAMS    = 0x0D   // More fastcall space
BC_REG_FPARAMS_END= 0x25   // Extended range
```

## Calling Conventions

### 1. Fastcall (DTF_FASTCALL)

**Used when:** Non-recursive, non-variadic, fits in ZP

```
Parameters:  BC_REG_FPARAMS to BC_REG_FPARAMS_END (zero page)
Locals:      BC_REG_LOCALS (frame pointer) or direct ZP
Return:      A/X registers or ZP
```

**Advantages:**
- Zero stack manipulation overhead
- Fast parameter access
- No frame setup/teardown

### 2. Stackcall (DTF_STACKCALL)

**Used when:** Recursive, variadic, function pointers, params overflow ZP

```
Parameters:  Software stack at BC_REG_STACK
Locals:      Frame at BC_REG_LOCALS
Return:      A/X registers or stack
```

**Triggered by:**
- `DTF_FUNC_RECURSIVE` flag
- `DTF_VARIADIC` function type
- Function pointer calls
- Parameters exceeding fastcall region

## Global Analyzer - SFA Core

The `GlobalAnalyzer` is central to Oscar64's SFA implementation:

### MarkRecursions()

Detects recursive functions using DFS cycle detection:

```cpp
void GlobalAnalyzer::MarkRecursions(void)
{
    for (int i = 0; i < mFunctions.Size(); i++)
    {
        Declaration* cf = mFunctions[i];
        for (int j = 0; j < cf->mCalled.Size(); j++)
        {
            if (MarkCycle(cf, cf->mCalled[j]))
                cf->mFlags |= DTF_FUNC_RECURSIVE;
        }
    }
}

bool GlobalAnalyzer::MarkCycle(Declaration* rootDec, Declaration* procDec)
{
    if (rootDec == procDec)
        return true;
    
    if (!(procDec->mFlags & DTF_FUNC_ANALYZING))
    {
        procDec->mFlags |= DTF_FUNC_ANALYZING;
        
        bool cycle = false;
        for (int i = 0; i < procDec->mCalled.Size(); i++)
        {
            if (MarkCycle(rootDec, procDec->mCalled[i]))
                cycle = true;
        }
        if (cycle)
            procDec->mFlags |= DTF_FUNC_RECURSIVE;
        
        procDec->mFlags &= ~DTF_FUNC_ANALYZING;
        return cycle;
    }
    return false;
}
```

### CheckFastcall()

Determines calling convention per function:

**Fastcall Selection Logic:**
1. Not recursive (`DTF_FUNC_RECURSIVE`)
2. Not variadic (`DTF_VARIADIC`)
3. Not address-taken (`DTF_FUNC_VARIABLE`)
4. Parameters fit in `BC_REG_FPARAMS` range
5. No dynamic stack usage (`DTF_DYNSTACK`)

**Parameter Allocation:**
```cpp
// Allocate params in fastcall region
if (nparams + dec->mBase->mSize <= numfpzero)
{
    dec->mVarIndex = nparams;  // ZP offset
    nparams += dec->mBase->mSize;
}
else
{
    // Overflow to secondary region
    dec->mVarIndex = nparams2 + numfpzero;
    nparams2 += dec->mBase->mSize;
}
```

### AutoZeroPage()

Weight-based automatic ZP allocation:

**Weight Calculation:**
```cpp
static int VarUseCountScale(Declaration* type)
{
    if (type->IsIntegerType())
        return 0x100 / type->mSize;   // Smaller = higher priority
    else if (type->mType == DT_TYPE_POINTER)
        return 0x800;                  // Pointers highest priority
    else if (type->mType == DT_TYPE_ARRAY)
        return VarUseCountScale(type->mBase) / type->mSize;
    else
        return 0;  // No ZP for complex types
}
```

**Allocation Algorithm:**
1. Filter variables: not already ZP, no initializer
2. Score = `useCount * VarUseCountScale(type)`
3. Sort by score (highest first)
4. Fill ZP until exhausted

### CheckInterrupt()

Propagates interrupt-safety through call graph:

```cpp
void GlobalAnalyzer::CheckInterrupt(void)
{
    bool changed = false;
    do {
        changed = false;
        for (int i = 0; i < mFunctions.Size(); i++)
        {
            Declaration* f = mFunctions[i];
            if (f->mFlags & DTF_FUNC_INTRCALLED)
            {
                for (int j = 0; j < f->mCalled.Size(); j++)
                {
                    Declaration* cf = f->mCalled[j];
                    if (!(cf->mFlags & DTF_FUNC_INTRCALLED))
                    {
                        cf->mFlags |= DTF_FUNC_INTRCALLED;
                        changed = true;
                    }
                }
            }
        }
    } while (changed);
}
```

## Declaration Flags (SFA-Relevant)

### Calling Convention Flags
| Flag | Meaning |
|------|---------|
| `DTF_FASTCALL` | Use ZP params |
| `DTF_STACKCALL` | Use stack params |
| `DTF_INTERRUPT` | Interrupt handler |
| `DTF_HWINTERRUPT` | Hardware interrupt |

### Function Analysis Flags
| Flag | Meaning |
|------|---------|
| `DTF_FUNC_RECURSIVE` | Recursive function |
| `DTF_FUNC_ANALYZING` | Currently being analyzed |
| `DTF_FUNC_INTRSAVE` | Interrupt-safe |
| `DTF_FUNC_INTRCALLED` | Called from interrupt |
| `DTF_FUNC_VARIABLE` | Address taken |

### Variable Flags
| Flag | Meaning |
|------|---------|
| `DTF_ZEROPAGE` | In zero page |
| `DTF_VAR_ALIASING` | Has alias (address taken) |
| `DTF_MEMMAP` | Memory-mapped |

## Declaration Fields (SFA-Relevant)

| Field | Purpose |
|-------|---------|
| `mVarIndex` | Variable index / ZP offset |
| `mFastCallBase` | Fastcall region start |
| `mFastCallSize` | Fastcall region size |
| `mCallers` | Functions that call this |
| `mCalled` | Functions called by this |
| `mLinkerObject` | Final memory allocation |
| `mUseCount` | Access frequency counter |

## Key Insights for Blend SFA

1. **Weight-Based ZP Priority**
   - Pointers get highest weight (0x800)
   - Smaller integers get higher weight
   - useCount * weight determines allocation order

2. **Dual Calling Convention**
   - Fastcall for non-recursive = ZP params, zero overhead
   - Stackcall for recursive = software stack

3. **Recursion Detection**
   - Simple DFS cycle detection
   - All functions in cycle marked recursive
   - Recursive → forces stackcall

4. **Interrupt Propagation**
   - Functions called from interrupts propagate marking
   - Used for interrupt-safe analysis

5. **Call Graph Integration**
   - Call graph built during analysis
   - Used for inlining, recursion, interrupt propagation
   - NOT used for frame coalescing (different from KickC)

## Comparison: Oscar64 vs KickC

| Feature | Oscar64 | KickC |
|---------|---------|-------|
| Recursion | Stackcall | Error (default) / `__stackcall` |
| ZP Allocation | Weight-based | Weight-based |
| Frame Coalescing | NO | YES (critical!) |
| Calling Conv | Fastcall/Stackcall | PHI_CALL/STACK_CALL |
| Interrupt Safety | Propagation | Thread-aware coalescing |

**Key Difference:** Oscar64 does NOT do frame coalescing like KickC. Each non-recursive function gets its own static allocation, without reusing memory based on call graph disjointness.

## Next Steps

- [ ] Session 3.2: Declaration model deep dive
- [ ] Session 3.3: InterCode variable representation
- [ ] Session 3.4: NativeCodeGenerator frame handling