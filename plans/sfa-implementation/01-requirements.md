# SFA Requirements

> **Document**: 01-requirements.md
> **Parent**: [00-index.md](00-index.md)
> **Status**: Approved

## Overview

This document defines the final requirements for Static Frame Allocation (SFA) implementation in Blend65. All decisions have been approved and are ready for implementation.

---

## 1. Functional Requirements

### 1.1 Core SFA Behavior

| Requirement | Description | Priority |
|-------------|-------------|----------|
| **FR-01** | Function locals allocated to fixed memory at compile time | Must Have |
| **FR-02** | Function parameters allocated to fixed memory | Must Have |
| **FR-03** | Zero call overhead (no stack manipulation) | Must Have |
| **FR-04** | Recursion detection with compile-time error | Must Have |
| **FR-05** | Frame coalescing for memory optimization | Must Have |
| **FR-06** | Zero page allocation with @zp directive | Must Have |
| **FR-07** | RAM allocation with @ram directive | Must Have |
| **FR-08** | Automatic ZP allocation based on scoring | Must Have |
| **FR-09** | Callback function isolation (ISR safety) | Must Have |
| **FR-10** | Platform-configurable memory regions | Should Have |

### 1.2 Memory Allocation Rules

| Requirement | Description | Priority |
|-------------|-------------|----------|
| **FR-11** | @zp variables MUST be in Zero Page (error if full) | Must Have |
| **FR-12** | @ram variables MUST be in RAM (never ZP) | Must Have |
| **FR-13** | No-directive variables use ZP scoring formula | Must Have |
| **FR-14** | Module globals go to RAM by default | Must Have |
| **FR-15** | Function locals go to Frame Region by default | Must Have |

### 1.3 Error Handling

| Requirement | Description | Priority |
|-------------|-------------|----------|
| **FR-16** | Clear error for recursion detection | Must Have |
| **FR-17** | Clear error for ZP overflow | Must Have |
| **FR-18** | Clear error for frame region overflow | Must Have |
| **FR-19** | Warning for functions called from multiple threads | Should Have |

---

## 2. Non-Functional Requirements

### 2.1 Performance

| Requirement | Description | Target |
|-------------|-------------|--------|
| **NFR-01** | Call overhead | 0 cycles for non-recursive functions |
| **NFR-02** | Memory savings with coalescing | 30-60% reduction |
| **NFR-03** | Compile time | <2s for 10K LOC |

### 2.2 Quality

| Requirement | Description | Target |
|-------------|-------------|--------|
| **NFR-04** | Test coverage | >90% for all SFA code |
| **NFR-05** | False recursion errors | 0 (no false positives) |
| **NFR-06** | ZP allocation accuracy | >95% optimal |

### 2.3 Maintainability

| Requirement | Description | Target |
|-------------|-------------|--------|
| **NFR-07** | Code documentation | JSDoc on all public APIs |
| **NFR-08** | Modular design | Inheritance chain architecture |
| **NFR-09** | Test design | Unit, integration, and E2E tests |

---

## 3. Approved Decisions

All design decisions have been finalized:

### Decision 1: Recursion Handling

**Choice: STRICT**

- Recursion always causes a compile error
- No `recursive fn` keyword
- No software stack fallback

**Rationale**:
- 99% of 6502 game code doesn't use recursion
- Keeps compiler simpler
- Forces developers to write efficient iterative code
- No runtime overhead

### Decision 2: ZP Scoring

**Choice: SMART (Automatic)**

- Compiler auto-promotes hot variables to ZP
- Uses scoring formula: `score = accessCount × typeWeight × loopBonus`
- Deterministic and reproducible

**Type Weights**:
| Type | Weight | Rationale |
|------|--------|-----------|
| pointer | High (0x800) | Enables indirect Y addressing |
| byte | Medium (0x100) | Most benefit from ZP |
| word | Low (0x080) | Less relative benefit |
| array | Zero (0x000) | Too large for ZP |

### Decision 3: Frame Region Size

**Choice: CONFIGURABLE**

- Developer can customize region in platform config
- Default: $0200-$03FF (512 bytes) for C64
- Allows optimization for specific projects

### Decision 4: Coalescing

**Choice: AGGRESSIVE**

- Maximize memory savings
- Deeper call graph analysis
- Functions that never overlap share memory
- Target: 30-60% memory savings

### Decision 5: ISR Handling

**Choice: USE EXISTING `callback` KEYWORD**

- No new `interrupt fn` syntax
- Existing `callback` keyword marks interrupt handlers
- Thread context separation (main vs ISR)
- Functions in different threads cannot coalesce

---

## 4. Language Syntax (No Changes)

SFA is an internal compiler optimization. The language syntax remains unchanged:

### Storage Directives

```js
// Zero Page - fast, limited
@zp let counter: byte = 0;

// General RAM - default, larger
@ram let buffer: byte[256];
let buffer2: byte[256];  // Same as @ram

// Data Section - for constants
@data const lookupTable: byte[256] = [/* ... */];
```

### Function Declarations

```js
// Standard function
function update(): void {
    let temp: byte = 0;  // Local allocated by SFA
}

// Callback (treated as ISR for thread separation)
callback irq(): void {
    let timer: byte = 0;  // Isolated from main thread
}
```

---

## 5. Memory Layout Specification

### 5.1 C64 Default Configuration

```
$0000-$0001   CPU Indirect (reserved)
$0002-$008F   ZERO PAGE (142 bytes)
              ├── @zp module globals
              ├── @zp function locals
              └── Compiler scratch ($FB-$FE)

$0090-$00FF   KERNAL/BASIC ZP (reserved)

$0100-$01FF   Hardware Stack (return addresses only)

$0200-$03FF   STATIC FRAME REGION (512 bytes)
              ├── Function frames
              ├── Function parameters
              └── Function locals

$0400-$07FF   Screen RAM (VIC-II)

$0800+        PROGRAM CODE & DATA
              ├── @ram module globals
              ├── @data constants
              └── Large arrays
```

### 5.2 Region Limits

| Region | Start | End | Size | Purpose |
|--------|-------|-----|------|---------|
| Zero Page | $02 | $8F | 142 bytes | Fast variables |
| Frame Region | $0200 | $03FF | 512 bytes | Function frames |
| General RAM | $0800+ | varies | ~38KB | Module globals, arrays |

---

## 6. Allocation Algorithm Summary

### 6.1 Allocation Flow

```
1. Build Call Graph
   ├── Identify all function declarations
   ├── Track call relationships (caller → callee)
   ├── Detect callback functions (ISR context)
   └── Identify thread contexts (main vs ISR)

2. Check Recursion
   ├── Detect direct recursion (f calls f)
   ├── Detect indirect recursion (f → g → h → f)
   └── ERROR if any recursion detected

3. Calculate Frame Sizes
   ├── Sum local variable sizes
   ├── Sum parameter sizes
   └── Add return value slot if needed

4. Build Coalesce Groups
   ├── Find functions that never overlap
   ├── Group into equivalence classes
   ├── Respect thread boundaries (main/ISR)
   └── Calculate group size (max of members)

5. Assign Frame Addresses
   ├── Assign addresses to coalesce groups
   └── Track total frame region usage

6. Allocate Zero Page
   ├── Process @zp required first (error if impossible)
   ├── Score all no-directive variables
   ├── Fill ZP with highest-score slots
   └── Remaining go to RAM

7. Build Frame Map
   └── Map function name → Frame with addresses
```

### 6.2 Output

The frame allocator produces a `FrameMap` containing:
- Map of function name → Frame
- Each Frame contains FrameSlots with absolute addresses
- Statistics (ZP usage, frame region usage, coalescing savings)
- Diagnostics (errors, warnings)

---

## 7. Out of Scope

The following are explicitly **NOT** part of this implementation:

| Item | Reason |
|------|--------|
| Full C compatibility | Blend is not a C compiler |
| General-purpose recursion | SFA trade-off |
| Automatic stack frames | Dynamic allocation has overhead |
| Complex optimization levels | KISS - one good strategy |
| Source-level debugging info | Separate feature |
| Heap allocation | All memory is compile-time |

---

## 8. Success Metrics

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Call overhead | 0 cycles | Inspect generated assembly |
| Memory savings | 30-60% | Compare coalesced vs non-coalesced |
| Compile time | <2s for 10K LOC | Benchmark tests |
| False recursion errors | 0 | Test suite |
| ZP allocation accuracy | >95% | Compare to manual allocation |
| Test coverage | >90% | Coverage report |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [SFA-IMPLEMENTATION-SUMMARY.md](../../SFA-IMPLEMENTATION-SUMMARY.md) | High-level overview |
| [../sfa_research/god-level-sfa/](../sfa_research/god-level-sfa/) | Design research |
| [../sfa_research/blend-integration/](../sfa_research/blend-integration/) | Integration research |

---

**Next Document**: [02-current-state.md](02-current-state.md)