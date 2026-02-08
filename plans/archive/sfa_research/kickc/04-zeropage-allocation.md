# KickC Zero Page Allocation

> **Document**: 04-zeropage-allocation.md
> **Parent**: [KickC Overview](00-overview.md)
> **Created**: 2025-01-31
> **Status**: Complete

## Overview

KickC uses a sophisticated zero page allocation strategy that prioritizes frequently-used variables, respects reserved addresses, and can overflow to main memory when ZP is exhausted.

## Allocation Architecture

### When It Happens

ZP allocation occurs in `Pass4RegistersFinalize.java`, which runs during the register allocation phase (Pass4).

### Key Class Members

```java
public class Pass4RegistersFinalize extends Pass2Base {
    /**
     * The current zero page address used to create new registers.
     * Starts at $02 (after system-reserved locations)
     */
    private int currentZp = 2;

    /** All reserved zeropage addresses not available for the compiler. */
    private List<Integer> reservedZp;
}
```

## Reserved ZP Handling

### Sources of Reserved Addresses

KickC collects reserved ZP addresses from three sources:

```java
public Pass4RegistersFinalize(Program program) {
    super(program);
    this.reservedZp = new ArrayList<>();
    
    // 1. Global reserved ZPs (from command line/config)
    this.reservedZp.addAll(program.getReservedZps());
    
    // 2. Procedure-specific reserved ZPs
    for(Procedure procedure : getSymbols().getAllProcedures(true)) {
        List<Integer> procedureReservedZps = procedure.getReservedZps();
        if(procedureReservedZps != null) {
            this.reservedZp.addAll(procedureReservedZps);
        }
    }
    
    // 3. Hardcoded register addresses from variable declarations
    for(Variable variable : getSymbols().getAllVariables(true)) {
        if(variable.getRegister() instanceof Registers.RegisterZpMem) {
            int zp = ((Registers.RegisterZpMem) variable.getRegister()).getZp();
            int sizeBytes = variable.getType().getSizeBytes();
            for(int i = 0; i < sizeBytes; i++) {
                if(!reservedZp.contains(zp + i))
                    this.reservedZp.add(zp + i);
            }
        }
    }
}
```

### C64 Default Reserved Addresses

Typical reserved ZP for C64:
- `$00-$01` - CPU port (always)
- `$02` - Available for compiler (starts here)
- `$FB-$FE` - Often reserved for BASIC/Kernal
- `$FF` - Sometimes reserved

## ZP Allocation Algorithm

### Weight-Based Priority

Variables are sorted by **register weight** (usage frequency) before allocation:

```java
private void reallocateMemRegisters(LiveRangeEquivalenceClassSet equivalenceClassSet, 
                                     boolean overflowToMainMem) {
    List<LiveRangeEquivalenceClass> equivalenceClasses = 
        new ArrayList<>(equivalenceClassSet.getEquivalenceClasses());
    
    final VariableRegisterWeights registerWeights = getProgram().getVariableRegisterWeights();
    
    // Sort by weight - highest weight first
    Collections.sort(equivalenceClasses, (o1, o2) -> 
        Double.compare(registerWeights.getTotalWeight(o2), registerWeights.getTotalWeight(o1)));
    
    // Allocate in weight order
    for(LiveRangeEquivalenceClass equivalenceClass : equivalenceClasses) {
        // ... allocation logic
    }
}
```

**Why weight matters:**
- Higher weight = more frequently used
- Frequently used variables benefit more from ZP (faster access)
- Loop variables, frequently accessed pointers get priority

### Allocation Decision Logic

```java
for(LiveRangeEquivalenceClass equivalenceClass : equivalenceClasses) {
    Registers.Register register = equivalenceClass.getRegister();
    boolean reallocate = true;
    
    if(register != null) {
        // Don't reallocate hardware registers (A, X, Y)
        if(register.isHardware()) {
            reallocate = false;
        } 
        // Don't reallocate hardcoded addresses
        else if(register.isAddressHardcoded()) {
            reallocate = false;
        }
    }
    
    if(reallocate) {
        Variable variable = getProgram().getSymbolInfos().getVariable(variableRef);
        
        // Check if variable is explicitly marked for main memory
        if(variable.isMemoryAreaMain()) {
            register = new Registers.RegisterMainMem(variableRef, size, null, false);
        } else {
            // Allocate on ZP
            register = allocateNewRegisterZp(variable);
            
            // Check for ZP overflow
            int zp = ((Registers.RegisterZpMem) register).getZp();
            int sizeBytes = variable.getType().getSizeBytes();
            
            if(overflowToMainMem && zp + sizeBytes > 0x100) {
                // ZP exhausted - move to main memory
                register = new Registers.RegisterMainMem(variableRef, size, null, false);
                getLog().append("Zero-page exhausted. Moving allocation to main memory " + variable);
            }
        }
        
        equivalenceClass.setRegister(register);
    }
}
```

### Sequential Allocation with Gap Avoidance

```java
private int allocateZp(int size) {
    // Find a ZP sequence of 'size' bytes without any reserved addresses
    boolean reserved;
    do {
        reserved = false;
        int candidateZp = currentZp;
        
        // Check each byte in the allocation
        for(int i = 0; i < size; i++) {
            if(reservedZp.contains(Integer.valueOf(candidateZp + i))) {
                reserved = true;
                currentZp++;  // Skip this address
                break;
            }
        }
    } while(reserved);
    
    // Found a valid sequence
    int allocated = currentZp;
    currentZp += size;
    return allocated;
}
```

**Example:**
```
Reserved: $05, $10-$11

Allocating 2-byte word:
  Try $02-$03: OK → Allocated
  currentZp = $04

Allocating 1-byte:
  Try $04: OK → Allocated
  currentZp = $05

Allocating 1-byte:
  Try $05: RESERVED → Skip
  Try $06: OK → Allocated
  currentZp = $07
```

## Type-Based Allocation Sizes

```java
private Registers.Register allocateNewRegisterZp(Variable variable) {
    SymbolType varType = variable.getType();
    
    if(SymbolType.BYTE.equals(varType)) {
        return new Registers.RegisterZpMem(allocateZp(1), 1);
    } 
    else if(SymbolType.SBYTE.equals(varType)) {
        return new Registers.RegisterZpMem(allocateZp(1), 1);
    } 
    else if(SymbolType.WORD.equals(varType)) {
        return new Registers.RegisterZpMem(allocateZp(2), 2);
    } 
    else if(SymbolType.SWORD.equals(varType)) {
        return new Registers.RegisterZpMem(allocateZp(2), 2);
    } 
    else if(SymbolType.DWORD.equals(varType)) {
        return new Registers.RegisterZpMem(allocateZp(4), 4);
    } 
    else if(SymbolType.SDWORD.equals(varType)) {
        return new Registers.RegisterZpMem(allocateZp(4), 4);
    } 
    else if(varType.equals(SymbolType.BOOLEAN)) {
        return new Registers.RegisterZpMem(allocateZp(1), 1);
    } 
    else if(varType.equals(SymbolType.VOID)) {
        return null;  // No register for void
    } 
    else if(varType instanceof SymbolTypePointer) {
        return new Registers.RegisterZpMem(allocateZp(2), 2);
    } 
    else if(varType instanceof SymbolTypeStruct) {
        int size = varType.getSizeBytes();
        return new Registers.RegisterZpMem(allocateZp(size), size);
    }
    
    throw new RuntimeException("Unhandled variable type " + varType);
}
```

| Type | Size | ZP Bytes |
|------|------|----------|
| byte, sbyte | 1 | 1 |
| boolean | 1 | 1 |
| word, sword | 2 | 2 |
| pointer | 2 | 2 |
| dword, sdword | 4 | 4 |
| struct | variable | variable |

## ZP Overflow Handling

### When Overflow Occurs

```java
if(overflowToMainMem && zp + sizeBytes > 0x100) {
    // Zero-page exhausted - move to main memory
    register = new Registers.RegisterMainMem(variableRef, sizeBytes, null, false);
    getLog().append("Zero-page exhausted. Moving allocation to main memory " + variable);
}
```

### Overflow Message

```
Zero-page exhausted. Moving allocation to main memory myVariable
```

### Alternative: Enable Coalescing

If ZP is exhausted, users can enable more aggressive coalescing:
```
kickc -Ocoalesce myprogram.c
```

This enables `Pass4MemoryCoalesceExhaustive` which tries harder to share ZP locations.

## ASM Name Shortening

After allocation, KickC shortens ASM names for readability:

```java
private void shortenAsmNames() {
    for(Variable variable : scope.getAllVariables(false)) {
        if(variable.getAllocation() != null && variable.getAllocation().isMem()) {
            variable.setAsmName(variable.getLocalName());
        }
    }
    
    // Handle name collisions by adding suffix
    Map<String, Registers.Register> shortNames = new LinkedHashMap<>();
    for(Variable variable : scope.getAllVariables(false)) {
        shortenAsmName(shortNames, variable, allocation);
    }
}

private void shortenAsmName(Map<String, Registers.Register> shortNames, 
                            Variable variable, Registers.Register allocation) {
    String asmName = variable.getAsmName();
    String prefix = asmName;
    
    // Remove SSA version suffix
    if(asmName.contains("#")) {
        prefix = asmName.substring(0, asmName.indexOf("#"));
    }
    
    int suffix = 0;
    boolean found = false;
    while(!found) {
        String shortName = prefix + ((suffix == 0) ? "" : ("_" + suffix));
        if(shortNames.get(shortName) == null || 
           shortNames.get(shortName).equals(allocation)) {
            // Name is available or same allocation
            variable.setAsmName(shortName);
            shortNames.put(shortName, allocation);
            found = true;
        }
        suffix++;
    }
}
```

**Result:**
```asm
; Before shortening
.label counter#0 = $02
.label counter#1 = $02
.label counter#2 = $02

; After shortening (same allocation → same name)
.label counter = $02
```

## Implications for Blend

### What Blend Should Adopt

1. **Weight-based priority** - Frequently used variables get ZP first
2. **Reserved address handling** - Respect user/system reservations
3. **Overflow to RAM** - Graceful degradation when ZP exhausted
4. **Type-based sizing** - Proper byte counts for each type

### What Blend Can Improve

1. **User annotations** - `@zp` for explicit ZP placement
2. **Better diagnostics** - Show ZP usage statistics
3. **Priority hints** - Let users influence allocation priority
4. **Segment-aware allocation** - Different ZP regions for different purposes

### Blend's ZP Strategy

```
Priority Order:
1. @zp annotated variables (user explicit)
2. High-weight variables from coalescing analysis
3. Loop counters and frequently-accessed pointers
4. Remaining variables by weight
5. Overflow to RAM if ZP exhausted
```

---

## Summary

| Aspect | KickC Implementation |
|--------|---------------------|
| **Starting address** | $02 (after CPU port) |
| **Priority** | Weight-based (frequency) |
| **Reserved handling** | ✅ Respects all sources |
| **Overflow** | ✅ Can spill to main memory |
| **Coalescing integration** | ✅ After coalescing |
| **Type awareness** | ✅ Proper sizes for all types |