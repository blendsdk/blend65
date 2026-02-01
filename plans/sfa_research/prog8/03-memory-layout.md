# Prog8 Memory Layout Analysis

> **Document**: prog8/03-memory-layout.md
> **Parent**: [Phase 4 Execution Plan](../99d-phase4-prog8.md)
> **Status**: Complete
> **Source**: `ProgramAndVarsGen.kt` (~700 lines)

## Overview

Prog8's memory layout is entirely static - all variables have fixed addresses determined at compile time. There is no stack growth, no heap allocation, and no dynamic memory management.

---

## Memory Map Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      ZERO PAGE ($00-$FF)                     │
├─────────────────────────────────────────────────────────────┤
│  $00-$02:     Reserved (system)                              │
│  Scratch:     P8ZP_SCRATCH_B1, P8ZP_SCRATCH_REG              │
│               P8ZP_SCRATCH_W1, P8ZP_SCRATCH_W2               │
│               P8ZP_SCRATCH_PTR                               │
│  User ZP:     Variables with REQUIRE/PREFER/DONTCARE wishes  │
│  Platform:    System-specific reserved areas                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│               PROGRAM CODE (Load Address)                    │
├─────────────────────────────────────────────────────────────┤
│  prog8_program_start:                                        │
│    cld                                                       │
│    tsx / stx prog8_lib.orig_stackpointer                    │
│    jsr p8_sys_startup.init_system                           │
│    jsr p8_sys_startup.init_system_phase2                    │
│    jsr p8b_main.p8s_start                                   │
│    jmp p8_sys_startup.cleanup_at_exit                       │
├─────────────────────────────────────────────────────────────┤
│  Block definitions (.proc/.block)                            │
│    - Subroutines                                             │
│    - Inline assembly                                         │
│    - Float constants (pooled)                                │
│    - Struct type definitions                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│            BSS SECTION (Uninitialized Data)                  │
├─────────────────────────────────────────────────────────────┤
│  BSS_NOCLEAR:    Subroutine temp vars (init before use)      │
│  BSS:            Global vars (cleared to 0 at startup)       │
│  BSS_SLABS:      Memory slabs                                │
│  STRUCTINSTANCES: Struct instances                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           INITIALIZED DATA SECTION                           │
├─────────────────────────────────────────────────────────────┤
│  Arrays with initializers                                    │
│  Strings (with null terminators)                             │
│  Float constants                                             │
│  Struct instances with init values                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│               prog8_program_end                              │
└─────────────────────────────────────────────────────────────┘
```

---

## BSS Sections

Prog8 uses multiple BSS sections for different purposes:

### BSS_NOCLEAR - Subroutine Temporaries

```kotlin
// Variables created during code generation
asmgen.out("    .section BSS_NOCLEAR")
for((dt, name, addr) in asmGenInfo.extraVars) {
    if(addr != null)
        asmgen.out("$name = $addr")
    else when(dt) {
        BaseDataType.UBYTE -> asmgen.out("$name    .byte  ?")
        BaseDataType.UWORD -> asmgen.out("$name    .word  ?")
        BaseDataType.FLOAT -> asmgen.out("$name    .fill  ${FLOAT_MEM_SIZE}")
    }
}
asmgen.out("  .send BSS_NOCLEAR")
```

These are **not cleared at startup** - they're initialized before use within subroutines.

### BSS - Main Uninitialized Section

```kotlin
// Cleared to 0 at program start
asmgen.out("prog8_bss_section_start")
asmgen.out("  .dsection BSS")
asmgen.out("prog8_bss_section_size = * - prog8_bss_section_start")
```

At program startup:
```kotlin
asmgen.out("  jsr  prog8_lib.program_startup_clear_bss")
```

### BSS_SLABS - Memory Slabs

```kotlin
if(symboltable.allMemorySlabs.isNotEmpty()) {
    asmgen.out("; memory slabs\n  .section BSS_SLABS")
    for (slab in symboltable.allMemorySlabs) {
        if (slab.align > 1u)
            asmgen.out("\t.align  ${slab.align.toHex()}")
        asmgen.out("${slab.name}\t.fill  ${slab.size}")
    }
    asmgen.out("  .send BSS_SLABS")
}
```

---

## Variable Placement by Scope

### Block-Level Variables

```kotlin
private fun createBlockVariables(block: PtBlock) {
    // 1. Zeropage Variables
    val varnames = varsInBlock.filter { it.type == STATICVAR }
        .map { it.scopedNameString }.toSet()
    zeropagevars2asm(varnames)

    // 2. Memory Definitions and Constants
    memdefsAndConsts2asm(mvs, consts)

    // 3. Non-ZP Variables
    nonZpVariables2asm(variables)
}
```

### Subroutine Variables

```kotlin
internal fun translateSubroutine(sub: PtSub) {
    asmgen.out("${sub.name}\t.proc")
    
    // ZP variables defined as equates
    zeropagevars2asm(varnames)
    
    // Memory defs and constants
    memdefsAndConsts2asm(mvs, consts)
    
    // Statements
    sub.children.forEach { asmgen.translate(it) }
    
    // Extra variables (BSS_NOCLEAR section)
    asmgen.out("    .section BSS_NOCLEAR")
    for((dt, name, addr) in asmGenInfo.extraVars) { ... }
    asmgen.out("  .send BSS_NOCLEAR")
    
    // Non-ZP variables
    nonZpVariables2asm(variables)
    
    asmgen.out("  .pend")
}
```

---

## ZP Variable Generation

ZP variables are generated as **equates** (address constants):

```kotlin
private fun zeropagevars2asm(varNames: Set<String>) {
    val zpVariables = allocator.zeropageVars
        .filter { it.key in varNames }
        .sortedBy { it.second.address }
    
    for ((scopedName, zpvar) in zpVariables) {
        if(variable.dt.isSplitWordArray) {
            // Split arrays get two addresses
            asmgen.out("${name}_lsb \t= $lsbAddr \t; zp ${zpvar.dt} (lsbs)")
            asmgen.out("${name}_msb \t= $msbAddr \t; zp ${zpvar.dt} (msbs)")
        } else {
            asmgen.out("${name} \t= ${zpvar.address} \t; zp ${zpvar.dt}")
        }
    }
}
```

**Generated output:**
```asm
myvar       = $02    ; zp ubyte
counter     = $03    ; zp ubyte
pointer     = $04    ; zp uword
```

---

## Non-ZP Variable Generation

### Uninitialized Variables (BSS)

```kotlin
private fun uninitializedVariable2asm(variable: StStaticVariable) {
    when {
        dt.isBool || dt.isUnsignedByte -> asmgen.out("${name}\t.byte  ?")
        dt.isSignedByte -> asmgen.out("${name}\t.char  ?")
        dt.isUnsignedWord || dt.isPointer -> asmgen.out("${name}\t.word  ?")
        dt.isFloat -> asmgen.out("${name}\t.fill  ${FLOAT_MEM_SIZE}")
        dt.isArray -> {
            val numbytes = compTarget.memorySize(variable.dt, variable.length)
            asmgen.out("${name}\t.fill  $numbytes")
        }
    }
}
```

### Initialized Variables

```kotlin
private fun staticVariable2asm(variable: StStaticVariable) {
    // Only arrays and strings can have initialization values
    // Numeric variables go to BSS and are initialized via assignment
    when {
        dt.isString -> outputStringvar(...)
        dt.isArray -> arrayVariable2asm(...)
    }
}
```

---

## Struct Instance Layout

```kotlin
private fun structInstances2asm() {
    // Struct types as 64tass struct definitions
    symboltable.allStructTypes().forEach { structtype ->
        asmgen.out("${structtype.name}    .struct ...")
        structtype.fields.forEach { field ->
            asmgen.out("p8v_${field.name}  $type  \\$varname")
        }
        asmgen.out("    .endstruct")
    }

    // Uninitialized instances in BSS
    asmgen.out("    .section BSS")
    instancesNoInit.forEach {
        asmgen.out("${name}    .dstruct  ${structName}, ${zerovalues}")
    }
    asmgen.out("    .send BSS")

    // Initialized instances in data section
    asmgen.out("    .section STRUCTINSTANCES")
    instances.forEach {
        asmgen.out("${name}    .dstruct  ${structName}, ${initValues}")
    }
    asmgen.out("    .send STRUCTINSTANCES")
}
```

---

## Program Entry Point

```kotlin
private fun entrypointInitialization() {
    // 1. Clear BSS section (arrays to zero)
    asmgen.out("  jsr  prog8_lib.program_startup_clear_bss")

    // 2. Initialize block-level (global) variables
    blockVariableInitializers.forEach {
        if (it.value.isNotEmpty())
            asmgen.out("  jsr  ${it.key.name}.prog8_init_vars")
    }

    // 3. Initialize ZP arrays/strings with values
    stringVarsWithInitInZp.forEach { copyStringToZp(it) }
    arrayVarsWithInitInZp.forEach { copyArrayToZp(it) }
}
```

---

## Golden RAM / High Bank Support

Prog8 supports relocating BSS to special memory areas:

```kotlin
if(options.varsGolden) {
    // Golden RAM area (platform-specific)
    relocatedBssStart = options.compTarget.BSSGOLDENRAM_START
    relocatedBssEnd = options.compTarget.BSSGOLDENRAM_END
}
else if(options.varsHighBank != null) {
    // High RAM bank (e.g., Commander X16)
    relocatedBssStart = options.compTarget.BSSHIGHRAM_START
    relocatedBssEnd = options.compTarget.BSSHIGHRAM_END
}
```

---

## Memory Layout Characteristics

### Fixed at Compile Time

| Characteristic | Value |
|---------------|-------|
| Variable addresses | Fixed |
| Stack growth | None |
| Heap allocation | None |
| Dynamic memory | None |

### Memory Regions

| Region | Contents |
|--------|----------|
| Zero Page | Fast-access variables |
| Code | Program instructions |
| BSS | Uninitialized variables |
| Data | Initialized arrays, strings |
| BSS_SLABS | Large memory blocks |

### Size Constraints

```kotlin
// Memtop check in footer
asmgen.out("  .cerror * >= ${memtopAddress.toHex()}, \"Program too long\"")
```

---

## Comparison with Other Compilers

| Aspect | CC65 | Oscar64 | KickC | Prog8 |
|--------|------|---------|-------|-------|
| Stack Frame | Yes | Yes | Optional | **No** |
| Dynamic Memory | malloc | No | No | **No** |
| BSS Clearing | Yes | Yes | Yes | **Yes** |
| Golden RAM | No | No | No | **Yes** |
| High Bank | No | No | No | **Yes** |

---

## Implications for Blend65

### Adopt from Prog8

1. **Multiple BSS Sections** - Separate cleared vs. uncleaned
2. **Struct Type Support** - Native assembler structs
3. **Memory Slab System** - Large buffer allocation
4. **High Bank Support** - Platform-specific extensions

### Extend Beyond Prog8

1. **Optional Stack Frame** - For recursive functions
2. **Frame Coalescing** - Share memory when safe
3. **Dynamic ZP** - Runtime ZP variable management