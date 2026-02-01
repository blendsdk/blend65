# Edge Case Handling

> **Document**: god-level-sfa/06-edge-cases.md
> **Purpose**: Complete edge case handling strategies for SFA
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

This document defines how Blend65's SFA handles all edge cases and corner scenarios. Each edge case includes detection, handling strategy, and error/warning messages.

---

## 1. Frame Size Edge Cases

### 1.1 Empty Functions (Frame Size = 0)

**Scenario:**
```blend
fn empty_stub() {
    // No locals, no params
}
```

**Detection:**
```typescript
function isEmptyFrame(frame: Frame): boolean {
    return frame.totalSize === 0;
}
```

**Handling:**
- ✅ ALLOW 0-byte frames
- ✅ Don't allocate BSS label
- ✅ Generate simple `JMP label` or `RTS`
- ✅ Still include in call graph for coalescing analysis

**Code Generation:**
```asm
; Empty function - no frame needed
empty_stub:
    rts
```

---

### 1.2 Large Frames (>256 bytes)

**Scenario:**
```blend
fn big_function() {
    let buffer1: byte[128];
    let buffer2: byte[128];
    let buffer3: byte[128];  // Total: 384 bytes
}
```

**Detection:**
```typescript
const LARGE_FRAME_THRESHOLD = 256;

function isLargeFrame(frame: Frame): boolean {
    return frame.totalSize > LARGE_FRAME_THRESHOLD;
}
```

**Handling (Static Allocation):**
- ✅ NO PROBLEM - Each variable gets unique BSS label
- ✅ Direct addressing works at any offset
- ✅ No Y-register indexing needed

```asm
; Large frame - all direct addressing
big_function_buffer1:  .res 128
big_function_buffer2:  .res 128
big_function_buffer3:  .res 128

big_function:
    lda big_function_buffer1    ; Direct, works fine
    sta big_function_buffer2
    rts
```

**Warning (for awareness):**
```
INFO: Function 'big_function' has frame size 384 bytes
      This may use significant RAM. Consider if all buffers
      need to exist simultaneously.
```

---

### 1.3 Extremely Large Frames (>10% of RAM)

**Scenario:**
```blend
fn huge_function() {
    let mega_buffer: byte[8192];  // 8KB on 64KB machine
}
```

**Detection:**
```typescript
function checkExtremeFrameSize(
    frame: Frame, 
    platform: PlatformConfig
): Warning | null {
    const ramPercentage = (frame.totalSize / platform.availableRAM) * 100;
    
    if (ramPercentage > 10) {
        return {
            type: 'extreme-frame-size',
            function: frame.function,
            size: frame.totalSize,
            percentage: ramPercentage
        };
    }
    return null;
}
```

**Handling:**
- ⚠️ WARNING: Suggest alternative approaches
- ✅ Still allow compilation (user knows best)
- ✅ Linker will error if truly out of memory

**Warning Message:**
```
┌─────────────────────────────────────────────────────────────────┐
│ WARNING B6510: Extremely large frame                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Function 'huge_function' has frame size 8192 bytes            │
│   This is 12.5% of available RAM (65536 bytes)                  │
│                                                                 │
│ SUGGESTIONS:                                                    │
│   - Use heap/slab allocation for large buffers                  │
│   - Split into multiple smaller functions                       │
│   - Consider if full buffer is needed at once                   │
│                                                                 │
│   Compilation will continue.                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Call Depth Edge Cases

### 2.1 Deep Call Chains (64+ levels)

**Scenario:**
```
main → a → b → c → d → e → f → g → h → i → j → ... (64+ levels)
```

**Detection:**
```typescript
interface CallDepthResult {
    maxDepth: number;
    deepestPath: FunctionSymbol[];
    warnings: DepthWarning[];
}

function analyzeCallDepth(graph: CallGraph): CallDepthResult {
    const WARN_THRESHOLD = 64;   // 128 bytes HW stack
    const ERROR_THRESHOLD = 100; // 200 bytes HW stack
    
    const depths = computeDepths(graph);
    const maxDepth = Math.max(...depths.values());
    
    const warnings: DepthWarning[] = [];
    
    if (maxDepth > ERROR_THRESHOLD) {
        warnings.push({
            severity: 'error',
            depth: maxDepth,
            message: `Call depth ${maxDepth} exceeds safe limit (${ERROR_THRESHOLD})`
        });
    } else if (maxDepth > WARN_THRESHOLD) {
        warnings.push({
            severity: 'warning', 
            depth: maxDepth,
            message: `Call depth ${maxDepth} approaching hardware stack limit`
        });
    }
    
    return { maxDepth, deepestPath: findDeepestPath(graph), warnings };
}
```

**Warning Message:**
```
┌─────────────────────────────────────────────────────────────────┐
│ WARNING B6520: Deep call chain                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Maximum call depth: 72 levels                                 │
│   Hardware stack usage: ~144 bytes (of 256 available)           │
│                                                                 │
│   Deepest path:                                                 │
│     main → init → setup → configure → ... → leaf_function       │
│                                                                 │
│ WARNING: This leaves only ~112 bytes for:                       │
│   - Interrupt handlers (NMI, IRQ)                               │
│   - System/ROM calls                                            │
│   - Register saves                                              │
│                                                                 │
│ SUGGESTIONS:                                                    │
│   - Inline some functions to reduce depth                       │
│   - Flatten call hierarchy where possible                       │
│   - Use state machine pattern instead of deep calls             │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Diamond Call Patterns

**Scenario:**
```
     A
    / \
   B   C
    \ /
     D
```
A calls B and C; both B and C call D.

**Detection:**
```typescript
function detectDiamondPatterns(graph: CallGraph): DiamondPattern[] {
    const diamonds: DiamondPattern[] = [];
    
    for (const node of graph.nodes) {
        const fn = node.function;
        const callees = node.callees.map(e => e.callee);
        
        // Find functions called by multiple direct callees
        for (let i = 0; i < callees.length; i++) {
            for (let j = i + 1; j < callees.length; j++) {
                const shared = findSharedCallees(graph, callees[i], callees[j]);
                for (const sharedFn of shared) {
                    diamonds.push({
                        apex: fn,
                        left: callees[i],
                        right: callees[j],
                        bottom: sharedFn
                    });
                }
            }
        }
    }
    
    return diamonds;
}
```

**Handling:**
- ✅ Coalescing correctly handles this case
- ✅ D cannot share with A, B, or C (all are in D's caller chain)
- ✅ No special error - just correct allocation

**Coalescing Result:**
```
Function A: Cannot coalesce with B, C, D (all overlap)
Function B: Cannot coalesce with A, D (overlap), CAN coalesce with C (sibling)
Function C: Cannot coalesce with A, D (overlap), CAN coalesce with B (sibling)
Function D: Cannot coalesce with A, B, C (all overlap)
```

---

## 3. Zero Page Edge Cases

### 3.1 ZP Exhaustion

**Scenario:**
```blend
// 100 variables marked @zp required
@zp required let ptr1: *byte;
@zp required let ptr2: *byte;
// ... 98 more ...
```

**Detection:**
```typescript
interface ZpExhaustionError {
    required: ZpAllocation[];
    available: number;
    overflow: ZpAllocation[];
}

function detectZpExhaustion(
    allocations: ZpAllocation[],
    platform: PlatformConfig
): ZpExhaustionError | null {
    const required = allocations.filter(a => a.directive === 'required');
    const requiredSize = required.reduce((sum, a) => sum + a.size, 0);
    
    if (requiredSize > platform.zpAvailable) {
        return {
            required,
            available: platform.zpAvailable,
            overflow: required.slice(
                Math.floor(platform.zpAvailable / 2) // Approximate cutoff
            )
        };
    }
    return null;
}
```

**Error Message:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ERROR B6530: Zero page exhausted                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Required ZP allocations: 200 bytes                            │
│   Available ZP space: 100 bytes                                 │
│   Overflow: 100 bytes cannot be allocated                       │
│                                                                 │
│   Variables that could not be allocated in ZP:                  │
│     ptr51 through ptr100 (100 bytes total)                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ SOLUTIONS:                                                      │
│                                                                 │
│   1. Change some '@zp required' to '@zp' (preferred):           │
│      Less critical variables will spill to RAM if needed        │
│                                                                 │
│   2. Remove '@zp' annotation entirely for cold variables        │
│                                                                 │
│   3. Review if all pointers truly need ZP:                      │
│      Only pointer variables used for indirect addressing        │
│      MUST be in ZP. Direct access vars can use RAM.             │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.2 ZP Priority Spillover

**Scenario:**
```blend
// More @zp wishes than ZP space
@zp let ptr1: *byte;   // High priority - gets ZP
@zp let ptr2: *byte;   // High priority - gets ZP
@zp let counter: byte; // Medium priority - spills to RAM
```

**Detection and Handling:**
```typescript
function allocateWithSpillover(
    slots: FrameSlot[],
    platform: PlatformConfig
): AllocationResult {
    // Sort by priority score (highest first)
    const sorted = [...slots].sort((a, b) => b.zpScore - a.zpScore);
    
    let zpUsed = 0;
    const zpAllocations: ZpAllocation[] = [];
    const ramAllocations: RamAllocation[] = [];
    const spilloverWarnings: SpilloverWarning[] = [];
    
    for (const slot of sorted) {
        if (slot.directive === 'required') {
            // MUST be in ZP
            if (zpUsed + slot.size <= platform.zpAvailable) {
                zpAllocations.push(allocateZp(slot, zpUsed));
                zpUsed += slot.size;
            } else {
                throw new ZpExhaustionError(slot);
            }
        } else if (slot.directive === 'preferred' || slot.directive === 'auto') {
            // TRY to put in ZP
            if (zpUsed + slot.size <= platform.zpAvailable) {
                zpAllocations.push(allocateZp(slot, zpUsed));
                zpUsed += slot.size;
            } else {
                // Spill to RAM
                ramAllocations.push(allocateRam(slot));
                if (slot.directive === 'preferred') {
                    spilloverWarnings.push({
                        slot,
                        reason: 'ZP full, allocated to RAM'
                    });
                }
            }
        } else {
            // @ram directive - force RAM
            ramAllocations.push(allocateRam(slot));
        }
    }
    
    return { zpAllocations, ramAllocations, spilloverWarnings };
}
```

**Warning Message:**
```
┌─────────────────────────────────────────────────────────────────┐
│ WARNING B6531: ZP spillover                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   3 variables marked '@zp' were allocated to RAM instead:       │
│                                                                 │
│     counter (byte) - score: 156, reason: ZP full                │
│     tempValue (word) - score: 128, reason: ZP full              │
│     flags (byte) - score: 64, reason: ZP full                   │
│                                                                 │
│   ZP status: 100/100 bytes used (full)                          │
│                                                                 │
│ NOTE: This may impact performance. To guarantee ZP allocation,  │
│       use '@zp required' (but use sparingly).                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Reserved ZP Conflict

**Scenario:**
```blend
@zp at $00 let myPtr: *byte;  // $00-$01 conflicts with CPU!
```

**Detection:**
```typescript
interface ReservedZpRegion {
    start: number;
    end: number;
    reason: string;
}

const C64_RESERVED_ZP: ReservedZpRegion[] = [
    { start: 0x00, end: 0x01, reason: 'CPU indirect addressing' },
    { start: 0x02, end: 0x8F, reason: 'BASIC/KERNAL workspace' },
    { start: 0xFB, end: 0xFF, reason: 'KERNAL I/O' }
];

function checkReservedConflict(
    address: number,
    size: number,
    platform: PlatformConfig
): ReservedConflict | null {
    for (const region of platform.reservedZp) {
        if (address < region.end && address + size > region.start) {
            return {
                requestedAddress: address,
                requestedSize: size,
                conflictRegion: region
            };
        }
    }
    return null;
}
```

**Error Message:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ERROR B6532: Reserved ZP conflict                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Cannot allocate 'myPtr' at $00                                │
│                                                                 │
│   Address $00-$01 is reserved: CPU indirect addressing          │
│   The 6502 uses this location for indirect JMP instructions.    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ RESERVED ZP REGIONS (C64):                                      │
│                                                                 │
│   $00-$01: CPU indirect addressing                              │
│   $02-$8F: BASIC/KERNAL workspace (use -fno-basic to free)      │
│   $FB-$FF: KERNAL I/O                                           │
│                                                                 │
│ AVAILABLE ZP: $90-$FA (106 bytes)                               │
│                                                                 │
│ SOLUTION: Remove '@zp at $00' or use a valid address:           │
│                                                                 │
│   @zp let myPtr: *byte;        // Let compiler choose           │
│   @zp at $90 let myPtr: *byte; // Or specify valid address      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Interrupt Safety Edge Cases

### 4.1 Function Called from Both Main and ISR

**Scenario:**
```blend
fn updateScore(points: byte) {
    score += points;
}

fn main() {
    updateScore(100);  // Main context
}

interrupt fn irq() {
    updateScore(1);    // ISR context
}
```

**Detection:**
```typescript
function detectIsrUnsafeFunctions(graph: CallGraph): IsrUnsafeFunction[] {
    const unsafe: IsrUnsafeFunction[] = [];
    
    // Find functions reachable from both main and ISR
    const mainReachable = computeReachable(graph, 'main');
    const isrReachable = computeReachable(graph, getIsrEntryPoints(graph));
    
    for (const fn of graph.functions) {
        if (mainReachable.has(fn) && isrReachable.has(fn)) {
            unsafe.push({
                function: fn,
                mainCallers: findCallers(graph, fn, mainReachable),
                isrCallers: findCallers(graph, fn, isrReachable)
            });
        }
    }
    
    return unsafe;
}
```

**Warning Message:**
```
┌─────────────────────────────────────────────────────────────────┐
│ WARNING B6540: ISR-unsafe function detected                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Function 'updateScore' is called from both contexts:          │
│                                                                 │
│     Main context via: main → updateScore                        │
│     ISR context via:  irq → updateScore                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ PROBLEM:                                                        │
│   If IRQ fires while main is executing updateScore, the static  │
│   parameter 'points' will be overwritten, corrupting main's     │
│   in-progress call.                                             │
│                                                                 │
│ SOLUTIONS:                                                      │
│                                                                 │
│   1. Create separate versions:                                  │
│      fn updateScoreMain(points: byte) { ... }                   │
│      fn updateScoreIsr(points: byte) { ... }                    │
│                                                                 │
│   2. Disable interrupts during main's call:                     │
│      sei();           // Disable IRQ                            │
│      updateScore(100);                                          │
│      cli();           // Re-enable IRQ                          │
│                                                                 │
│   3. Mark as recursive (uses stack, slower but safe):           │
│      recursive fn updateScore(points: byte) { ... }             │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Nested Interrupt Handling

**Scenario:**
```blend
interrupt fn irq() {
    updateRaster();  // NMI can fire here!
}

interrupt fn nmi() {
    updateMusic();   // Can preempt IRQ
}
```

**Detection:**
```typescript
interface ThreadContext {
    type: 'main' | 'irq' | 'nmi';
    canBePreemptedBy: ThreadContext[];
}

const THREAD_HIERARCHY: ThreadContext[] = [
    { type: 'main', canBePreemptedBy: ['irq', 'nmi'] },
    { type: 'irq', canBePreemptedBy: ['nmi'] },
    { type: 'nmi', canBePreemptedBy: [] }  // NMI is highest priority
];

function detectNestedInterruptIssues(graph: CallGraph): NestedIsrIssue[] {
    const issues: NestedIsrIssue[] = [];
    
    // Functions callable from IRQ
    const irqReachable = computeReachable(graph, getIrqEntryPoints(graph));
    
    // Functions callable from NMI
    const nmiReachable = computeReachable(graph, getNmiEntryPoints(graph));
    
    // Any overlap? NMI can preempt IRQ
    for (const fn of graph.functions) {
        if (irqReachable.has(fn) && nmiReachable.has(fn)) {
            issues.push({
                function: fn,
                irqPath: findPath(graph, 'irq', fn),
                nmiPath: findPath(graph, 'nmi', fn)
            });
        }
    }
    
    return issues;
}
```

**Handling:**
- ✅ Treat NMI and IRQ as separate thread contexts
- ✅ Functions in both MUST use stack allocation
- ⚠️ Or user must create separate versions

---

### 4.3 Coalescing Across Thread Boundaries

**Rule: NEVER coalesce functions from different thread contexts**

```typescript
function canCoalesce(fnA: FunctionSymbol, fnB: FunctionSymbol): boolean {
    // ... other checks ...
    
    // CRITICAL: Never coalesce across thread boundaries
    if (fnA.threadContext !== fnB.threadContext) {
        return false;
    }
    
    // ... rest of coalescing logic ...
}
```

**Why?**
- IRQ can fire ANYTIME during main context
- NMI can fire ANYTIME during IRQ or main
- If they share memory, corruption is guaranteed

---

## 5. Parameter Edge Cases

### 5.1 Many Parameters (8+)

**Scenario:**
```blend
fn drawSprite(
    x: byte, y: byte, 
    w: byte, h: byte,
    color: byte, priority: byte,
    flags: byte, frame: byte
): void { ... }
```

**Detection:**
```typescript
const MANY_PARAMS_THRESHOLD = 4;

function checkManyParameters(fn: FunctionDecl): Warning | null {
    if (fn.parameters.length > MANY_PARAMS_THRESHOLD) {
        return {
            type: 'many-parameters',
            function: fn,
            count: fn.parameters.length
        };
    }
    return null;
}
```

**Handling:**
- ✅ First 1-2 params → registers (A, Y)
- ✅ Rest → static variables
- ⚠️ Info message about potential struct usage

**Info Message:**
```
┌─────────────────────────────────────────────────────────────────┐
│ INFO B6550: Function with many parameters                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Function 'drawSprite' has 8 parameters                        │
│                                                                 │
│   Parameter passing:                                            │
│     x (byte) → A register                                       │
│     y (byte) → Y register                                       │
│     w, h, color, priority, flags, frame → static variables      │
│                                                                 │
│ SUGGESTION: Consider grouping related parameters:               │
│                                                                 │
│   struct SpriteParams {                                         │
│       x: byte, y: byte, w: byte, h: byte,                       │
│       color: byte, priority: byte, flags: byte, frame: byte     │
│   }                                                             │
│                                                                 │
│   fn drawSprite(params: *SpriteParams): void { ... }            │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.2 Large Struct Parameter

**Scenario:**
```blend
struct GameState {
    x: byte, y: byte, health: byte,
    score: word, flags: byte
}

fn saveState(state: GameState): void { ... }
```

**Handling:**
- ✅ Struct copied to static parameter slot
- ⚠️ Suggest passing by reference

**Warning:**
```
┌─────────────────────────────────────────────────────────────────┐
│ INFO B6551: Large struct parameter                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Function 'saveState' receives struct 'GameState' by value     │
│   Struct size: 7 bytes                                          │
│                                                                 │
│   This requires copying 7 bytes at each call site.              │
│                                                                 │
│ SUGGESTION: Pass by reference for better performance:           │
│                                                                 │
│   fn saveState(state: *GameState): void {                       │
│       // Access via state->x, state->y, etc.                    │
│   }                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Module Edge Cases

### 6.1 Circular Module Dependencies

**Scenario:**
```blend
// module_a.blend
import { bFunc } from "module_b";
export fn aFunc() { bFunc(); }

// module_b.blend
import { aFunc } from "module_a";
export fn bFunc() { aFunc(); }
```

**Detection:**
- This is mutual recursion across modules
- Detected by global call graph analysis
- Same handling as regular mutual recursion

**Error:** See [05-recursion-handling.md](05-recursion-handling.md) for cross-module recursion errors.

---

### 6.2 External Library Calls

**Scenario:**
```blend
fn printChar(c: byte) {
    asm { jsr $FFD2 }  // CHROUT ROM routine
}
```

**Handling:**
- ✅ Assume external calls clobber A, X, Y
- ✅ Save any live values before call
- ✅ Provide asm annotations for precise clobber info

**Annotation Support:**
```blend
fn printChar(c: byte) {
    asm clobbers(A, X) preserves(Y) {
        jsr $FFD2
    }
}
```

---

## 7. Volatile Memory Edge Cases

### 7.1 Hardware-Mapped Variables

**Scenario:**
```blend
@map screenColor at $D020: byte;

fn blink() {
    screenColor = 0;  // MUST write
    screenColor = 1;  // MUST write (not "redundant")
}
```

**Handling:**
- ✅ `@map` variables are implicitly volatile
- ✅ Never eliminate memory access to @map
- ✅ Never cache @map values in registers
- ✅ Never coalesce @map with regular variables

```typescript
function isVolatile(symbol: Symbol): boolean {
    return symbol.storageClass === 'map' || 
           symbol.hasVolatileAnnotation;
}

function canOptimizeMemoryAccess(symbol: Symbol): boolean {
    return !isVolatile(symbol);
}
```

---

## 8. Edge Case Handling Matrix

| Category | Edge Case | Severity | Handling | Message Type |
|----------|-----------|----------|----------|--------------|
| **Frame Size** | Empty function | Low | Allow 0-byte | None |
| | >256 bytes | Low | Static OK | Info |
| | >10% RAM | Medium | Allow + warn | Warning |
| **Call Depth** | >64 levels | Medium | Warn | Warning |
| | >100 levels | High | Error | Error |
| | Diamond pattern | Low | Correct coalesce | None |
| **Zero Page** | Exhaustion | High | Error + suggest | Error |
| | Spillover | Medium | Warn | Warning |
| | Reserved conflict | High | Error + guide | Error |
| **Interrupt** | Main+ISR shared | High | Warn + suggest | Warning |
| | Nested ISR | High | Separate contexts | Warning |
| | Cross-thread coalesce | Critical | Never allow | N/A |
| **Parameters** | 8+ params | Low | Static + info | Info |
| | Large struct | Low | Copy + suggest | Info |
| **Module** | Circular deps | High | Recursion error | Error |
| | External calls | Medium | Clobber assume | None |
| **Volatile** | @map access | Low | Never optimize | None |

---

## 9. Error Code Reference

| Code | Severity | Description |
|------|----------|-------------|
| B6510 | Warning | Extremely large frame |
| B6520 | Warning | Deep call chain |
| B6521 | Error | Call depth exceeds limit |
| B6530 | Error | Zero page exhausted |
| B6531 | Warning | ZP spillover |
| B6532 | Error | Reserved ZP conflict |
| B6540 | Warning | ISR-unsafe function |
| B6541 | Warning | Nested ISR conflict |
| B6550 | Info | Many parameters |
| B6551 | Info | Large struct parameter |

---

## 10. Conclusion

### Design Principles Applied

1. **Fail Early, Fail Clearly** - Detect issues at compile time with actionable messages
2. **Warn, Don't Block** - Unusual patterns get warnings but compilation continues
3. **Provide Solutions** - Every error/warning includes suggestions
4. **Be Platform-Aware** - ZP regions and limits are platform-specific
5. **Never Compromise Safety** - ISR safety and volatile handling are non-negotiable

### Implementation Priority

| Priority | Edge Cases |
|----------|------------|
| **P0 (Critical)** | ZP exhaustion, recursion, ISR cross-thread |
| **P1 (High)** | Call depth limits, reserved ZP, ISR shared functions |
| **P2 (Medium)** | Large frames, spillover warnings |
| **P3 (Low)** | Info messages for many params, struct suggestions |

---

**Next Document:** [07-testing-strategy.md](07-testing-strategy.md)