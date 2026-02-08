# Prog8 Variable Allocator Analysis

> **Document**: prog8/01-variable-allocator.md
> **Parent**: [Phase 4 Execution Plan](../99d-phase4-prog8.md)
> **Status**: Complete
> **Source**: `VariableAllocator.kt` (~100 lines)

## Overview

The Prog8 VariableAllocator is remarkably simple compared to other compilers because it **only handles static allocation** - there is no frame or stack allocation logic at all.

---

## Class Structure

```kotlin
internal class VariableAllocator(
    private val symboltable: SymbolTable,
    private val options: CompilationOptions,
    private val errors: IErrorReporter
) {
    private val zeropage = options.compTarget.zeropage
    internal val globalFloatConsts = mutableMapOf<Double, String>()
    internal val zeropageVars: Map<String, MemoryAllocator.VarAllocation>

    init {
        allocateZeropageVariables()
        zeropageVars = zeropage.allocatedVariables
    }
}
```

**Key properties:**
- `zeropage` - Platform-specific ZP allocator (from target)
- `globalFloatConsts` - Pool of float constants (value → name)
- `zeropageVars` - Map of variable names to ZP allocations

---

## ZP Wish Enumeration

Variables express their ZP preference via `ZeropageWish`:

```kotlin
enum class ZeropageWish {
    REQUIRE_ZEROPAGE,  // MUST be in ZP - error if impossible
    PREFER_ZEROPAGE,   // TRY ZP first, silent fallback
    NOT_IN_ZEROPAGE,   // NEVER use ZP (@nozp directive)
    DONTCARE           // Allocator decides
}
```

---

## Allocation Algorithm

### Phase 1: Collect All Variables

```kotlin
private fun collectAllVariables(st: SymbolTable): Collection<StStaticVariable> {
    val vars = mutableListOf<StStaticVariable>()
    fun collect(node: StNode) {
        for(child in node.children) {
            if(child.value.type == StNodeType.STATICVAR)
                vars.add(child.value as StStaticVariable)
            else
                collect(child.value)
        }
    }
    collect(st)
    return vars.sortedBy { it.dt.base }  // Sort by data type
}
```

### Phase 2: Categorize by ZP Wish

```kotlin
val allVariables = collectAllVariables(symboltable)

val varsRequiringZp = allVariables.filter { it.zpwish == ZeropageWish.REQUIRE_ZEROPAGE }
val varsPreferringZp = allVariables.filter { it.zpwish == ZeropageWish.PREFER_ZEROPAGE }
val varsNotZp = allVariables.filter { it.zpwish == ZeropageWish.NOT_IN_ZEROPAGE }
val varsDontCare = allVariables.filter { it.zpwish == ZeropageWish.DONTCARE }
    .partition { it.align == 0u }  // Separate aligned vs non-aligned
```

### Phase 3: Allocate in Priority Order

**Priority 1: REQUIRE_ZEROPAGE**
```kotlin
varsRequiringZp.forEach { variable ->
    val result = zeropage.allocate(
        variable.scopedNameString,
        variable.dt,
        variable.length?.toInt(),
        variable.astNode?.position ?: Position.DUMMY,
        errors
    )
    result.fold(
        success = { numVariablesAllocatedInZP++ },
        failure = { errors.err(it.message!!, position) }  // ERROR!
    )
}
```

**Priority 2: PREFER_ZEROPAGE**
```kotlin
varsPreferringZp.forEach { variable ->
    val result = zeropage.allocate(...)
    result.onSuccess { numVariablesAllocatedInZP++ }
    // No error if fails - silent fallback to RAM
}
```

**Priority 3: DONTCARE Integers/Pointers (fill remaining ZP)**
```kotlin
// NOTE: Only integers and pointers, NOT floats!
val sortedList = varsDontCareWithoutAlignment.sortedByDescending { it.scopedNameString }
for (variable in sortedList) {
    if(variable.dt.isIntegerOrBool || variable.dt.isPointer) {
        if(zeropage.free.isEmpty()) break
        val result = zeropage.allocate(...)
        result.onSuccess { numVariablesAllocatedInZP++ }
    } else {
        numberOfNonIntegerVariables++  // Floats skip ZP
    }
}
```

**Priority 4: NOT_IN_ZEROPAGE**
```kotlin
// No ZP allocation attempted - variables go directly to RAM
```

---

## Allocation Decision Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                 For Each Variable                            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │   ZP Wish Type?       │
               └───────────────────────┘
          ┌──────────┼──────────┼───────────┐
          ▼          ▼          ▼           ▼
    ┌──────────┐ ┌────────┐ ┌─────────┐ ┌────────┐
    │ REQUIRE  │ │ PREFER │ │DONTCARE │ │ @nozp  │
    └──────────┘ └────────┘ └─────────┘ └────────┘
          │          │          │           │
          ▼          ▼          ▼           ▼
    ┌──────────┐ ┌────────┐ ┌─────────┐ ┌────────┐
    │Allocate  │ │Allocate│ │Is int/  │ │Skip ZP │
    │ZP or     │ │ZP, ok  │ │bool/ptr?│ │entirely│
    │ERROR     │ │to fail │ └─────────┘ └────────┘
    └──────────┘ └────────┘      │           │
          │          │      ┌────┴────┐      │
          │          │      ▼         ▼      │
          │          │   ┌─────┐  ┌──────┐   │
          │          │   │Yes  │  │No    │   │
          │          │   │fill │  │(float│   │
          │          │   │ZP   │  │skip) │   │
          │          │   └─────┘  └──────┘   │
          │          │      │         │      │
          └──────────┴──────┴─────────┴──────┘
                           │
                           ▼
               ┌───────────────────────┐
               │  Remaining → BSS/RAM  │
               └───────────────────────┘
```

---

## Helper Methods

### isZpVar - Check if Variable is in ZP

```kotlin
internal fun isZpVar(scopedName: String): Boolean {
    // Check if explicitly allocated to ZP
    if(scopedName in zeropageVars)
        return true

    // Check if it's a memory-mapped variable in ZP range
    val v = symboltable.lookup(scopedName)
    return if(v is StMemVar) v.address <= 255u else false
}
```

### getFloatAsmConst - Float Constant Pooling

```kotlin
internal fun getFloatAsmConst(number: Double): String {
    val asmName = globalFloatConsts[number]
    if(asmName != null) return asmName

    // Create new float constant
    val newName = "prog8_float_const_${globalFloatConsts.size}"
    globalFloatConsts[number] = newName
    return newName
}
```

---

## Limitations Identified

### 1. No Usage-Based Prioritization

From the source code comment:

```kotlin
// TODO some form of intelligent priorization? 
// most often used variables first? loopcounter vars first? ...?
```

**Current behavior:** Variables are sorted alphabetically (by `scopedNameString`), NOT by usage frequency.

**Impact:** Frequently-used variables may not get ZP placement if ZP fills up with rarely-used variables.

### 2. No Weight System

Unlike Oscar64's weight-based allocation (pointers get higher weight), Prog8 treats all integer variables equally.

### 3. Floats Always Skip ZP

Float variables are unconditionally excluded from ZP allocation, even if ZP space remains.

### 4. Alignment Handled Separately

Variables with alignment requirements are allocated after non-aligned variables, which may fragment ZP.

---

## Comparison with Other Allocators

| Feature | CC65 | KickC | Oscar64 | Prog8 |
|---------|------|-------|---------|-------|
| ZP Allocation | Limited | Aggressive | Weight-based | Wish-based |
| Usage Analysis | No | Yes (liveness) | No | **No** |
| Prioritization | None | Coalescing | Pointer weight | **None** |
| Float in ZP | No | No | No | No |
| User Control | Minimal | Minimal | Minimal | **Full (wishes)** |

---

## Strengths

1. **User Control** - ZP wishes give programmer explicit control
2. **Simplicity** - Easy to understand and predict
3. **No Overhead** - All decisions made at compile time
4. **Float Pooling** - Efficient constant deduplication

## Weaknesses

1. **No Intelligence** - Alphabetical sorting is naive
2. **No Liveness** - Can't reuse ZP slots
3. **Static Only** - No dynamic allocation option
4. **No Coalescing** - Variables can't share ZP locations

---

## Implications for Blend65

### What to Adopt

1. **ZP Wish System** - Give users explicit control
2. **Float Constant Pooling** - Efficient memory use
3. **Simple Categorization** - Easy to maintain

### What to Improve

1. **Add Usage Analysis** - Prioritize frequently-used variables
2. **Add Weight System** - Pointers > integers > others
3. **Consider Coalescing** - Non-overlapping lifetimes share ZP
4. **Allow Float in ZP** - User choice with @zp directive

---

## Source Code Reference

```kotlin
// Location: codeGenCpu6502/src/prog8/codegen/cpu6502/VariableAllocator.kt
// ~100 lines total

internal class VariableAllocator(...) {
    // Key methods:
    // - allocateZeropageVariables() - Main allocation logic
    // - collectAllVariables() - Gather all static vars
    // - isZpVar() - ZP membership check
    // - getFloatAsmConst() - Float constant pooling
}
```