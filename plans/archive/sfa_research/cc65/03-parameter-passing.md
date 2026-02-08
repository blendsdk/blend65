# CC65 Parameter Passing & Function Calls

> **Document**: 03-parameter-passing.md
> **Compiler**: CC65 (C Compiler for 6502)
> **Source Files Analyzed**: `function.c/h`, `funcdesc.h`, `codegen.c`
> **Date**: 2025-01-31

## Executive Summary

CC65 supports two calling conventions: **standard** (all parameters on stack) and **fastcall** (last parameter in A/X registers). Parameters can also be promoted to zero page register variables via a swap mechanism.

## Calling Conventions

### Standard Calling Convention (Default)

| Aspect | Description |
|--------|-------------|
| Parameters | Pushed onto software stack |
| Order | Left to right (first param at highest address) |
| Return value | A (byte), A/X (word), via stack (long/struct) |
| Caller cleanup | No - callee cleans up |
| Variadic | Supported |

### Fastcall Convention (`__fastcall__`)

| Aspect | Description |
|--------|-------------|
| Last parameter | Passed in A/X registers |
| Other params | Pushed onto software stack |
| Return value | Same as standard |
| Variadic | NOT supported |

**Why Fastcall?** Avoids one push/pop cycle for the last parameter, saving ~20 cycles per call.

## Parameter Layout on Stack

```
Before call:
┌──────────────────────────────────────┐
│ [existing stack contents]            │
└──────────────────────────────────────┘ ← c_sp

After pushing parameters (standard):
┌──────────────────────────────────────┐
│ [existing stack contents]            │
├──────────────────────────────────────┤
│ Param 1 (first)                      │ ← c_sp + param_size - size(param1)
│ Param 2                              │
│ Param 3 (last)                       │ ← c_sp + 0
└──────────────────────────────────────┘ ← c_sp (after call setup)
```

## Function Entry Code

### Fastcall Entry

```c
// From function.c
if (D->ParamCount > 0 && IsFastcallFunc (Func->Type)) {
    unsigned Flags = CG_TypeOf (D->LastParam->Type) | CF_FORCECHAR;
    g_push (Flags, 0);  // Push last param from A/X to stack
}

g_enter (CG_CallFlags (Func->Type), F_GetParamSize (CurrentFunc));
```

**Generated Assembly (fastcall):**
```asm
; Last parameter arrives in A/X
    jsr pushax          ; Push to stack to standardize access
; OR for fixed-arg:
    ; Nothing! Just track that A/X holds last param
```

### Register Parameter Promotion

Parameters declared as `register` can be moved to zero page:

```c
// From function.c
if (SymIsRegVar (Param)) {
    int Reg = F_AllocRegVar (CurrentFunc, RType);
    if (Reg >= 0) {
        Param->V.R.RegOffs = Reg;
        // Swap stack location with ZP location
        g_swap_regvars (Param->V.R.SaveOffs, Reg, Size);
    }
}
```

**Generated Assembly:**
```asm
; Swap parameter from stack to zero page
    ldy #<param_offset>
    lda (c_sp),y        ; Load from stack
    ldx regbank+0       ; Save old regbank value
    sta regbank+0       ; Store param to ZP
    txa
    sta (c_sp),y        ; Save old regbank to stack (for restore later)
```

## Return Values

### By Size

| Return Type | Location | Notes |
|------------|----------|-------|
| `char` | A register | Zero-extended if unsigned |
| `int`, `short`, pointer | A/X registers | A=low, X=high |
| `long` | A/X + sreg | sreg is ZP secondary register |
| struct (≤4 bytes) | A/X/sreg | Treated as equivalent integer |
| struct (>4 bytes) | Via pointer | Caller provides destination |

### Return Sequence

```c
// From function.c g_leave()
void g_leave (int DoCleanup) {
    if (DoCleanup) {
        unsigned ToDrop = (unsigned) -StackPtr;
        // Drop locals, restore register vars, RTS
    }
}
```

**Generated Assembly:**
```asm
; Function return
    jsr incspX          ; Drop X bytes of locals
    rts                 ; Return (value already in A/X)
```

## FuncDesc Structure

```c
typedef struct FuncDesc FuncDesc;
struct FuncDesc {
    unsigned Flags;           // FD_EMPTY, FD_VARIADIC, etc.
    struct SymTable* SymTab;  // Parameter symbol table
    unsigned ParamCount;      // Number of parameters
    unsigned ParamSize;       // Total size in bytes
    struct SymEntry* LastParam; // For fastcall access
};
```

### Function Flags

| Flag | Meaning |
|------|---------|
| `FD_EMPTY` | Empty parameter list `()` |
| `FD_VOID_PARAM` | Explicit `(void)` |
| `FD_VARIADIC` | Variable argument list |
| `FD_OLDSTYLE` | K&R style function |

## Expression Evaluation During Calls

From expr.c `FunctionArgList()`:

```c
// Can pre-allocate frame for efficiency
if (FrameParams > 1) {
    FrameOffs = StackPtr;
    g_space (FrameSize);        // Allocate once
    StackPtr -= FrameSize;
}

// Then store arguments directly instead of pushing
g_putlocal (Flags, FrameOffs, Expr.IVal);
```

**Optimization**: Instead of N pushes, one allocation + N stores.

## Implications for Blend

### Key Learnings

1. **Fastcall is valuable** - Passing last param in registers saves cycles
2. **Register promotion** - Hot parameters can go to ZP
3. **Frame pre-allocation** - Batch allocation is more efficient
4. **No frame pointer** - All relative to c_sp

### Blend Considerations

| CC65 Feature | Blend Opportunity |
|--------------|-------------------|
| Fastcall | Make default for ≤2 params |
| Register params | Auto-promote based on usage analysis |
| Frame prealloc | Always use for static allocation |
| Variadic | Reject (static allocation incompatible) |

### Static Frame Allocation Impact

With SFA, parameters become even simpler:
- No stack manipulation at all
- Parameters at fixed memory addresses
- Register params still valuable for ZP speed

---

**Next**: [04-code-generation.md](04-code-generation.md) - Assembly patterns for frame operations