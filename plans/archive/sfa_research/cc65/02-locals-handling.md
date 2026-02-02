# CC65 Local Variable Handling

> **Document**: 02-locals-handling.md
> **Compiler**: CC65 (C Compiler for 6502)
> **Source Files Analyzed**: `locals.c/h`, `function.c/h`, `symentry.h`
> **Date**: 2025-01-31

## Executive Summary

CC65 supports three storage classes for local variables: **register** (zero page), **auto** (software stack), and **static** (BSS/DATA segments). A key discovery is the `--static-locals` option that converts ALL auto variables to static storage, which is essentially **Static Frame Allocation** - exactly what Blend aims to implement!

## Storage Classes for Locals

### Overview

| Storage Class | Location | Access Mode | Symbol.V |
|--------------|----------|-------------|----------|
| `register` | Zero page (regbank) | `lda $xx` (ZP direct) | `V.R.RegOffs` |
| `auto` | Software stack | `lda (c_sp),y` | `V.Offs` |
| `static` | BSS/DATA segment | `lda label` | `V.L.Label` |

### Storage Class Determination Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ ParseOneDecl()                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Is storage class REGISTER?                                   │ │
│ │ ├─YES─→ F_AllocRegVar() → success? ─YES─→ ParseRegisterDecl │ │
│ │ │                         └─NO─→ Convert to AUTO             │ │
│ │ └─NO──→ Is storage class AUTO?                               │ │
│ │         ├─YES─→ StaticLocals option?                         │ │
│ │         │       ├─YES─→ Convert to STATIC → ParseStaticDecl  │ │
│ │         │       └─NO─→ ParseAutoDecl (stack allocation)      │ │
│ │         └─NO──→ ParseStaticDecl (explicit static)            │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Register Variables (Zero Page)

### Allocation Mechanism

```c
int F_AllocRegVar (Function* F, const Type* Type) {
    // Only at function top level, and if enabled
    if (IS_Get (&EnableRegVars) && GetLexicalLevel () == LEX_LEVEL_FUNCTION) {
        unsigned Size = CheckedSizeOf (Type);
        
        // Allocate HIGH to LOW for stack-compatible save/restore
        if (F->RegOffs >= Size) {
            F->RegOffs -= Size;
            return F->RegOffs;  // Return ZP offset in regbank
        }
    }
    return -1;  // No space
}
```

**Key Points:**
1. Zero page space is limited (`RegisterSpace` constant, typically 6 bytes)
2. Allocated from HIGH to LOW addresses
3. Only at function top level (not in nested blocks)
4. Requires `--enable-regvars` flag

### Register Variable Save/Restore

Register variables are caller-saved (saved on entry, restored on exit):

```c
// On function entry, save register variable contents to stack
if (SaveRegVars) {
    g_save_regvars (Reg, Size);
}

// On function exit, restore from stack
g_restore_regvars (Offs, Sym->V.R.RegOffs, Bytes);
```

**Generated Assembly:**
```asm
; Save register vars (function entry)
    ldy #5              ; regbank size
saveregs:
    lda regbank,y
    sta (c_sp),y        ; Save to stack
    dey
    bpl saveregs

; Restore register vars (function exit)
    ldy #5
restregs:
    lda (c_sp),y        ; Load from stack
    sta regbank,y       ; Restore to regbank
    dey
    bpl restregs
```

### Symbol Storage for Register Variables

```c
struct SymEntry {
    union {
        struct {
            int RegOffs;   // Offset in regbank (zero page)
            int SaveOffs;  // Offset of saved copy on stack
        } R;
    } V;
};
```

## Auto Variables (Stack)

### Normal Stack Allocation

```c
static void ParseAutoDecl (Declarator* Decl) {
    if (IS_Get (&StaticLocals) == 0) {
        // STACK ALLOCATION
        
        // Calculate offset: current SP minus size
        Sym = AddLocalSym (Decl->Ident, Decl->Type,
                           Decl->StorageClass,
                           F_GetStackPtr (CurrentFunc) - (int) Size);
        
        // Reserve space (deferred allocation)
        F_ReserveLocalSpace (CurrentFunc, Size);
    }
}
```

### Deferred Allocation Pattern

CC65 uses a clever two-phase allocation:

1. **Reserve Phase** (`F_ReserveLocalSpace`):
   - Tracks how much space is needed
   - Doesn't emit any code yet
   
2. **Allocate Phase** (`F_AllocLocalSpace`):
   - Emits `g_space()` to actually allocate
   - Called when initialization code needs the space

```c
int F_ReserveLocalSpace (Function* F, unsigned Size) {
    F->Reserved += Size;
    return StackPtr - F->Reserved;  // Return offset without allocating
}

void F_AllocLocalSpace (Function* F) {
    if (F->Reserved > 0) {
        g_space (F->Reserved);      // Generate allocation code
        StackPtr -= F->Reserved;    // Update compile-time SP
        F->Reserved = 0;
    }
}
```

**Why Deferred?** Allows batch allocation of multiple variables with a single `g_space()` call.

### Symbol Storage for Auto Variables

```c
struct SymEntry {
    union {
        int Offs;  // Stack offset (negative from frame base)
    } V;
};
```

## Static Locals (THE KEY DISCOVERY!)

### The StaticLocals Option

**This is critical for Blend's SFA design!**

```c
static void ParseAutoDecl (Declarator* Decl) {
    if (IS_Get (&StaticLocals) == 0) {
        // Normal stack allocation (as shown above)
    } else {
        // STATIC ALLOCATION - Convert auto to static!
        Decl->StorageClass = (Decl->StorageClass & ~SC_STORAGEMASK) | SC_STATIC;
        
        // Generate a data label
        DataLabel = GetLocalDataLabel ();
        
        // Add to symbol table with label (not stack offset)
        Sym = AddLocalSym (Decl->Ident, Decl->Type, 
                           Decl->StorageClass, DataLabel);
        
        // Allocate in BSS segment
        AllocStorage (DataLabel, g_usebss, Size);
    }
}
```

**What `--static-locals` Does:**
1. Converts ALL auto variables to static storage
2. Each variable gets a unique label (e.g., `L0001`, `L0002`)
3. Variables live in BSS (uninitialized) or DATA (initialized) segment
4. No stack operations needed!

### Trade-offs of Static Locals

| Aspect | Stack (default) | Static (`--static-locals`) |
|--------|----------------|---------------------------|
| Memory | Shared, reused | Dedicated per variable |
| Recursion | ✅ Supported | ❌ NOT supported |
| Speed | Slower (ZP indirect) | Faster (absolute addressing) |
| RAM usage | Efficient | Higher (no overlap) |
| Code size | Larger (SP setup) | Smaller (no SP ops) |

### Symbol Storage for Static Locals

```c
struct SymEntry {
    union {
        struct {
            unsigned Label;       // Data label number
            Collection *DefsOrRefs;
            struct CodeEntry *IndJumpFrom;
        } L;
    } V;
};
```

## Compound Type Initialization

For arrays and structs, CC65 generates initialization data in RODATA:

```c
// For auto compound with initialization:
if (IsCompound) {
    // Put init data in RODATA segment
    unsigned InitLabel = AllocLabel (g_userodata);
    Size = ParseInit (Sym->Type);
    
    // Allocate stack space
    Sym->V.Offs = F_ReserveLocalSpace (CurrentFunc, Size);
    F_AllocLocalSpace (CurrentFunc);
    
    // Copy init data to stack
    g_initauto (InitLabel, Size);
}
```

**Generated Assembly:**
```asm
; Initialize array on stack from RODATA
    ldy #<size-1>
initloop:
    lda L0001,y         ; Load from RODATA
    sta (c_sp),y        ; Store to stack
    dey
    bpl initloop
```

## Scope Handling

CC65 tracks scopes via lexical levels:

```c
LEX_LEVEL_GLOBAL    // Global scope
LEX_LEVEL_FUNCTION  // Function top level
LEX_LEVEL_BLOCK     // Nested block
```

**Important**: Register variables only at `LEX_LEVEL_FUNCTION` - not in nested blocks!

### Block-Level Locals

Variables declared in inner blocks share the same stack frame:

```c
void example() {
    int a;           // Offset: SP-2
    {
        int b;       // Offset: SP-4
        {
            int c;   // Offset: SP-6
        }
        // c's space NOT reclaimed (still part of frame)
    }
    // b's space NOT reclaimed
}
```

CC65 does NOT reclaim inner-block variable space during function execution.

## Memory Layout Summary

```
Zero Page ($00-$FF):
┌──────────────────────────────────────┐
│ c_sp (2 bytes)       - Stack pointer │
│ sreg (2 bytes)       - Secondary reg │
│ regsave (2 bytes)    - Temp save     │
│ regbank (N bytes)    - Register vars │ ← F_AllocRegVar allocates here
│ ... other ZP usage ...               │
└──────────────────────────────────────┘

Software Stack (RAM):
┌──────────────────────────────────────┐
│ Parameter 2                          │ ← c_sp + param_offset
│ Parameter 1                          │
├──────────────────────────────────────┤
│ Saved register vars                  │ ← If register vars used
├──────────────────────────────────────┤
│ Local var 1                          │ ← Sym->V.Offs (negative)
│ Local var 2                          │
│ Local var 3 (from inner block)       │
├──────────────────────────────────────┤
│ Expression temporaries               │
└──────────────────────────────────────┘
                                         ← c_sp points here

BSS Segment (for static locals):
┌──────────────────────────────────────┐
│ L0001:  .res 2      ; static int x   │ ← Sym->V.L.Label
│ L0002:  .res 4      ; static long y  │
└──────────────────────────────────────┘
```

## Implications for Blend Compiler

### Key Learnings

1. **`--static-locals` is SFA!**
   - CC65 already implements static frame allocation
   - Blend can make this the DEFAULT, not an option
   
2. **Register variables = Zero Page**
   - Explicit `@zp` in Blend maps to `register` in CC65
   - Save/restore pattern is well-established
   
3. **Deferred allocation is clever**
   - Reserve, then batch-allocate
   - Blend could adopt this pattern
   
4. **No scope-based space reclaim**
   - CC65 doesn't reclaim inner-block space
   - Blend could optimize this with liveness analysis

### What Blend Should Do Differently

1. **Static by default** - No runtime stack for non-recursive code
2. **Call graph analysis** - Reuse memory for non-overlapping call paths
3. **Automatic ZP selection** - Promote hot variables to zero page
4. **Recursion detection** - Error at compile time if recursion detected

## Summary

| Feature | CC65 Approach | Blend Opportunity |
|---------|--------------|-------------------|
| Default locals | Stack | Static (SFA) |
| ZP allocation | Explicit `register` | Automatic + `@zp` override |
| Space reuse | None | Call graph analysis |
| Recursion | Supported (stack) | Rejected (compile error) |
| Block scopes | No reclaim | Liveness-based reuse |

---

**Next**: [03-parameter-passing.md](03-parameter-passing.md) - How CC65 handles function parameters