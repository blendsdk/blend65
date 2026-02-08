# KickC Memory Coalescing

> **Document**: 03-memory-coalesce.md
> **Parent**: [KickC Overview](00-overview.md)
> **Created**: 2025-01-31
> **Status**: Complete

## Overview

Memory coalescing is the heart of KickC's static frame allocation system. It allows multiple variables with non-overlapping live ranges to share the same memory location, dramatically reducing RAM and zero page usage.

## Coalescing Architecture

### Three Coalescing Passes

KickC uses three different coalescing strategies, applied in sequence:

| Pass | Class | Purpose | Default |
|------|-------|---------|---------|
| 1 | `Pass4MemoryCoalesceAssignment` | Assignment-based | Always |
| 2 | `Pass4MemoryCoalesceCallGraph` | Call-graph-based | Always |
| 3 | `Pass4MemoryCoalesceExhaustive` | Exhaustive search | `-Ocoalesce` |

### When They Run

```java
// In Compiler.pass4RegisterAllocation()

// Register coalesce on assignment (saving bytes & cycles)
new Pass4MemoryCoalesceAssignment(program).coalesce();

// Coalesce can be completely disabled for compilation speed
if(!disableCoalesce) {
    // Register coalesce on call graph (saving ZP)
    new Pass4MemoryCoalesceCallGraph(program).coalesce();

    if (enableZeroPageCoalesce) {
        // Register coalesce using exhaustive search (saving even more ZP - but slow)
        new Pass4MemoryCoalesceExhaustive(program).coalesce();
    }
}
```

---

## Live Range Equivalence Classes

### What They Are

Variables are grouped into equivalence classes based on:

1. **Can share the same memory location**
2. **Have compatible types (same size)**
3. **Live ranges don't overlap**

### Building Equivalence Classes

```java
// Pass4LiveRangeEquivalenceClassesFinalize.allocate()

// 1. Initialize from Phi statements (natural equivalences)
EquivalenceClassPhiInitializer equivalenceClassPhiInitializer = 
    new EquivalenceClassPhiInitializer(getProgram());
equivalenceClassPhiInitializer.visitGraph(getGraph());

// 2. Coalesce all versions of volatile variables
for(Variable variable : getSymbols().getAllVariables(true)) {
    if(variable.isKindPhiVersion() && variable.isVolatile()) {
        // Put all versions in same class
        liveRangeEquivalenceClassSet.consolidate(varEC, otherEC);
    }
}

// 3. Add remaining variables to non-overlapping classes
EquivalenceClassAdder equivalenceClassAdder = new EquivalenceClassAdder(liveRangeEquivalenceClassSet);
equivalenceClassAdder.visitGraph(getGraph());
```

### Adding Variables to Classes

```java
void addToEquivalenceClassSet(VariableRef lValVar, List<VariableRef> preferences, 
                               LiveRangeEquivalenceClassSet liveRangeEquivalenceClassSet) {
    LiveRange lValLiveRange = liveRangeVariables.getLiveRange(lValVar);
    
    // Look through preferences for a compatible class
    for(VariableRef preference : preferences) {
        LiveRangeEquivalenceClass preferenceEquivalenceClass = 
            liveRangeEquivalenceClassSet.getEquivalenceClass(preference);
        if(preferenceEquivalenceClass != null) {
            // Same type and no overlap? Add to this class!
            if(lValVariable.getType().equals(potentialVariable.getType())) {
                if(!lValLiveRange.overlaps(preferenceEquivalenceClass.getLiveRange())) {
                    chosen = preferenceEquivalenceClass;
                    chosen.addVariable(lValVar);
                    break;
                }
            }
        }
    }
    
    if(chosen == null) {
        // No preference usable - create a new one
        chosen = liveRangeEquivalenceClassSet.getOrCreateEquivalenceClass(lValVar);
    }
}
```

---

## Coalescing Constraints

### The Six Checks

Before coalescing two equivalence classes, KickC performs six safety checks:

```java
static boolean canCoalesce(LiveRangeEquivalenceClass ec1, LiveRangeEquivalenceClass ec2, 
                           Collection<ScopeRef> threadHeads, Set<String> unknownFragments, 
                           Program program) {
    return
        canCoalesceNotEqual(ec1, ec2) &&          // 1. Different classes
        canCoalesceCompatible(ec1, ec2, program) && // 2. Type compatibility
        canCoalesceSegments(ec1, ec2, program) &&   // 3. Same data segment
        canCoalesceVolatile(ec1, ec2, program) &&   // 4. Volatile safety
        canCoalesceThreads(ec1, ec2, threadHeads, program) && // 5. Thread safety
        canCoalesceClobber(ec1, ec2, unknownFragments, program); // 6. ASM clobber safety
}
```

### 1. Not Equal Check

```java
private static boolean canCoalesceNotEqual(LiveRangeEquivalenceClass ec1, 
                                            LiveRangeEquivalenceClass ec2) {
    return !ec1.equals(ec2);
}
```

### 2. Compatibility Check

```java
private static boolean canCoalesceCompatible(LiveRangeEquivalenceClass ec1, 
                                              LiveRangeEquivalenceClass ec2, 
                                              Program program) {
    Registers.Register register1 = ec1.getRegister();
    Registers.Register register2 = ec2.getRegister();
    
    // Both must be in memory (not CPU registers)
    if(!register1.isMem() || !register2.isMem())
        return false;
    
    // Same type required
    if(!register1.getType().equals(register2.getType()))
        return false;
    
    // Same size required
    if(register1.getBytes() != register2.getBytes())
        return false;
    
    // Not in reserved ZP
    if(register1 instanceof Registers.RegisterZpMem) {
        int zp = ((Registers.RegisterZpMem) register1).getZp();
        if(program.getReservedZps().contains(zp))
            return false;
    }
    
    return true;
}
```

### 3. Segment Check

```java
private static boolean canCoalesceSegments(LiveRangeEquivalenceClass ec1, 
                                            LiveRangeEquivalenceClass ec2, 
                                            Program program) {
    final String dataSegment1 = program.getScope().getVar(variableRef1).getDataSegment();
    final String dataSegment2 = program.getScope().getVar(variableRef2).getDataSegment();
    return dataSegment1.equals(dataSegment2);
}
```

### 4. Volatile Check

```java
private static boolean canCoalesceVolatile(LiveRangeEquivalenceClass ec1, 
                                            LiveRangeEquivalenceClass ec2, 
                                            Program program) {
    // Volatile variables can only coalesce with themselves
    if(ec1.hasVolatile(program) || ec2.hasVolatile(program)) {
        Variable baseVar1 = ec1.getSingleVariableBase(program);
        Variable baseVar2 = ec2.getSingleVariableBase(program);
        if(baseVar1 == null || baseVar2 == null) {
            return false;  // Different base variables
        }
        if(!baseVar1.equals(baseVar2)) {
            return false;  // Different base variables
        }
    }
    return true;
}
```

### 5. Thread Safety Check (Critical for Interrupts!)

```java
private static boolean canCoalesceThreads(LiveRangeEquivalenceClass ec1, 
                                           LiveRangeEquivalenceClass ec2, 
                                           Collection<ScopeRef> threadHeads, 
                                           Program program) {
    if(threadHeads.size() <= 1) {
        return true;  // Single-threaded, always safe
    }
    
    CallGraph callGraph = program.getCallGraph();
    Collection<ScopeRef> threads1 = getEquivalenceClassThreads(ec1, program, threadHeads, callGraph);
    Collection<ScopeRef> threads2 = getEquivalenceClassThreads(ec2, program, threadHeads, callGraph);
    
    if(threads1.isEmpty() || threads2.isEmpty()) {
        return true;
    }
    
    // Variables must be in SAME thread to coalesce
    return threads1.equals(threads2);
}
```

**Thread heads are:**
- `main()` function
- Interrupt handlers

**Variables from different threads CANNOT coalesce** because an interrupt could fire while a variable is in use, causing corruption.

### 6. Clobber Check

```java
private static boolean canCoalesceClobber(LiveRangeEquivalenceClass ec1, 
                                           LiveRangeEquivalenceClass ec2, 
                                           Set<String> unknownFragments, 
                                           Program program) {
    Registers.Register register1 = ec1.getRegister();
    // Try out the coalesce to test if it works
    RegisterCombination combination = new RegisterCombination();
    combination.setRegister(ec2, register1);
    return Pass4RegisterUpliftCombinations.generateCombinationAsm(
        combination, program, unknownFragments, ScopeRef.ROOT);
}
```

This actually **generates test ASM** to verify the coalescing doesn't cause issues!

---

## Call-Graph-Based Coalescing

### The Key Algorithm

This is the most powerful coalescing strategy - it uses the call graph to identify variables that can **never be live at the same time**:

```java
// Pass4MemoryCoalesceCallGraph.coalesce()
private boolean coalesce(LiveRangeEquivalenceClassSet liveRangeEquivalenceClassSet, 
                          Collection<ScopeRef> threadHeads, 
                          Set<String> unknownFragments) {
    boolean modified = false;
    CallGraph callGraph = getProgram().getCallGraph();
    
    // Already handled equivalence classes
    List<LiveRangeEquivalenceClass> handledECs = new ArrayList<>();
    List<LiveRangeEquivalenceClass> allECs = new ArrayList<>(
        liveRangeEquivalenceClassSet.getEquivalenceClasses());
    
    for(LiveRangeEquivalenceClass thisEC : allECs) {
        // Skip main-memory registers
        if(Registers.RegisterType.MAIN_MEM.equals(thisEC.getRegister().getType()))
            continue;
        
        // Find ALL calling scopes (procedures that could be active when thisEC is live)
        Set<ScopeRef> allCallingScopes = new LinkedHashSet<>();
        for(ScopeRef ecScope : getEquivalenceClassScopes(thisEC)) {
            allCallingScopes.addAll(callGraph.getRecursiveCallerProcs(ecScope));
        }
        
        // Try to coalesce with already-handled ECs
        boolean coalesced = false;
        for(LiveRangeEquivalenceClass otherEC : handledECs) {
            // Skip main-memory
            if(Registers.RegisterType.MAIN_MEM.equals(otherEC.getRegister().getType()))
                continue;
            
            // Skip if there's procedure overlap
            if(isProcedureOverlap(otherEC, allCallingScopes))
                continue;
            
            // NO overlap - attempt coalesce!
            LiveRangeEquivalenceClassCoalesceCandidate candidate = 
                new LiveRangeEquivalenceClassCoalesceCandidate(thisEC, otherEC, null);
            if(Pass4MemoryCoalesce.attemptCoalesce(candidate, threadHeads, unknownFragments, getProgram())) {
                coalesced = true;
                modified = true;
                break;
            }
        }
        
        if(!coalesced) {
            handledECs.add(thisEC);
        }
    }
    return modified;
}
```

### Procedure Overlap Check

```java
private boolean isProcedureOverlap(LiveRangeEquivalenceClass equivalenceClass, 
                                    Collection<ScopeRef> procedureRefs) {
    for(VariableRef otherVarRef : equivalenceClass.getVariables()) {
        ScopeRef otherProcedureRef = getScopeRef(otherVarRef);
        if(procedureRefs.contains(otherProcedureRef))
            return true;  // Overlap!
    }
    return false;  // No overlap - can coalesce
}
```

### The Key Insight

```
Function A          Function B          Function C
+-----------+       +-----------+       +-----------+
| local_a   |       | local_b   |       | local_c   |
+-----------+       +-----------+       +-----------+
     |                   |
     v                   v
   calls               calls
     |                   |
     v                   v
+-----------+       +-----------+
| helper1   |       | helper2   |
+-----------+       +-----------+

If A never calls B (directly or indirectly), and B never calls A:
→ local_a and local_b CAN share memory!

If A calls helper1, and B calls helper2:
→ local_a and helper2's locals CAN share memory!
→ local_b and helper1's locals CAN share memory!
```

---

## Performing the Coalesce

### The Attempt

```java
public static boolean attemptCoalesce(LiveRangeEquivalenceClassCoalesceCandidate candidate, 
                                       Collection<ScopeRef> threadHeads, 
                                       Set<String> unknownFragments, 
                                       Program program) {
    LiveRangeEquivalenceClassSet liveRangeEquivalenceClassSet = 
        program.getLiveRangeEquivalenceClassSet();
    List<LiveRangeEquivalenceClass> equivalenceClasses = 
        liveRangeEquivalenceClassSet.getEquivalenceClasses();
    
    if(equivalenceClasses.contains(candidate.getEc1()) && 
       equivalenceClasses.contains(candidate.getEc2())) {
        // Both equivalence classes still exist
        if(Pass4MemoryCoalesce.canCoalesce(candidate.getEc1(), candidate.getEc2(), 
                                            threadHeads, unknownFragments, program)) {
            String scoreString = (candidate.getScore() == null) ? "" : 
                (" - score: " + candidate.getScore());
            program.getLog().append("Coalescing zero page register [ " + 
                candidate.getEc1() + " ] with [ " + candidate.getEc2() + " ]" + scoreString);
            
            // PERFORM THE COALESCE
            liveRangeEquivalenceClassSet.consolidate(candidate.getEc1(), candidate.getEc2());
            
            // Reset the program register allocation
            program.getLiveRangeEquivalenceClassSet().storeRegisterAllocation();
            return true;
        }
    }
    return false;
}
```

### Consolidation

When two equivalence classes are coalesced:
1. All variables from both classes are merged into one class
2. They all share the same register/memory location
3. Register allocation is updated

---

## Memory Savings Example

### Before Coalescing

```
Function foo():     local_a at $02-$03 (word)
                    local_b at $04     (byte)
                    
Function bar():     local_c at $05-$06 (word)
                    local_d at $07     (byte)

Function helper():  temp at $08        (byte)

Total ZP: 7 bytes
```

### After Call-Graph Coalescing

If `foo()` and `bar()` are never called from each other:

```
Function foo():     local_a at $02-$03 (word)
                    local_b at $04     (byte)
                    
Function bar():     local_c at $02-$03 (word)  ← SHARES with local_a!
                    local_d at $04     (byte)  ← SHARES with local_b!

Function helper():  temp at $02        (byte)  ← SHARES if compatible!

Total ZP: 3-4 bytes (57-50% reduction!)
```

---

## Compiler Flags

| Flag | Effect |
|------|--------|
| (default) | Assignment + Call-graph coalescing |
| `-Ocoalesce` | Enable exhaustive coalescing |
| `-Onocoalesce` | Disable all coalescing |

---

## Implications for Blend

### What Blend MUST Implement

1. **Live range tracking** - Know when variables are live
2. **Call graph analysis** - Know which functions can be active together
3. **Coalescing algorithm** - Merge compatible equivalence classes
4. **Thread/interrupt safety** - Don't coalesce across interrupt boundaries

### Improvements Over KickC

1. **Simpler model** - No SSA, simpler live ranges
2. **Frame-based** - Think in terms of function frames
3. **Explicit ZP priority** - `@zp` annotation for user control
4. **Better diagnostics** - Show memory savings achieved

### Key Insight for Blend

The call-graph-based coalescing is **critical** for RAM efficiency. Without it, every function's locals would need unique memory, wasting precious 6502 RAM.

**Blend's frame allocator MUST implement this or equivalent!**

---

## Summary

| Aspect | KickC Implementation |
|--------|---------------------|
| **Coalescing levels** | 3 (assignment, call-graph, exhaustive) |
| **Safety checks** | 6 constraints before coalescing |
| **Thread safety** | ✅ Interrupt-aware |
| **Algorithm** | Live range equivalence classes |
| **Memory savings** | 50%+ reduction typical |
| **Performance cost** | Low (call-graph), High (exhaustive) |