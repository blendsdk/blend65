# Intrinsics Library Specification

> **Phase**: 5a (Extension of Phase 5)  
> **Est. Time**: ~4 hours  
> **Tasks**: 4  
> **Tests**: ~40  
> **Prerequisites**: Phase 4 (Expression Translation)

---

## Overview

This document specifies the **intrinsics library** - a set of stub functions that the IL generator recognizes and translates to special IL instructions. These intrinsics replace the need for inline assembly while remaining **type-safe**, **optimizable**, and **inlinable**.

---

## Design Philosophy

### Why Intrinsics Instead of Inline Assembly?

| Inline Assembly | Intrinsics |
|-----------------|------------|
| ❌ Un-optimizable | ✅ Fully optimizable |
| ❌ Type-unsafe | ✅ Type-checked |
| ❌ Parser changes needed | ✅ Uses existing function calls |
| ❌ Target-specific | ✅ Target-aware via IL |
| ❌ Can't inline | ✅ Can be inlined |

### How Intrinsics Work

1. **User writes:** Normal function call syntax
2. **Parser sees:** Regular function call (no special syntax)
3. **Semantic analyzer:** Validates types, marks as intrinsic
4. **IL generator:** Recognizes intrinsic, emits special IL opcode
5. **Optimizer:** Understands intrinsic semantics (barriers, volatiles, etc.)
6. **Code generator:** Emits appropriate 6502 instructions

---

## Intrinsic Categories

### Category 1: Memory Access (Already in Plan)

| Intrinsic | Signature | IL Opcode | Description |
|-----------|-----------|-----------|-------------|
| `peek` | `(address: word): byte` | `INTRINSIC_PEEK` | Read byte from memory |
| `poke` | `(address: word, value: byte): void` | `INTRINSIC_POKE` | Write byte to memory |
| `peekw` | `(address: word): word` | `INTRINSIC_PEEKW` | Read word from memory |
| `pokew` | `(address: word, value: word): void` | `INTRINSIC_POKEW` | Write word to memory |

### Category 2: Optimization Control (NEW)

| Intrinsic | Signature | IL Opcode | Description |
|-----------|-----------|-----------|-------------|
| `barrier` | `(): void` | `OPT_BARRIER` | Prevent instruction reordering |
| `volatile_read` | `(address: word): byte` | `VOLATILE_READ` | Read that can't be eliminated |
| `volatile_write` | `(address: word, value: byte): void` | `VOLATILE_WRITE` | Write that can't be eliminated |

**Usage Example:**
```js
function criticalWrite(addr: word, value: byte): void
  barrier();              // Prevent reordering before
  poke(addr, value);      // The critical write
  barrier();              // Prevent reordering after
end function
```

### Category 3: 6502 CPU Instructions (NEW)

| Intrinsic | Signature | IL Opcode | 6502 Instruction | Description |
|-----------|-----------|-----------|------------------|-------------|
| `sei` | `(): void` | `CPU_SEI` | `SEI` | Disable interrupts |
| `cli` | `(): void` | `CPU_CLI` | `CLI` | Enable interrupts |
| `nop` | `(): void` | `CPU_NOP` | `NOP` | No operation (2 cycles) |
| `brk` | `(): void` | `CPU_BRK` | `BRK` | Software interrupt |

**Usage Example:**
```js
function bankSwitch(config: byte): void
  sei();                  // Disable interrupts
  barrier();              // Critical section start
  poke($01, config);      // Switch memory configuration
  barrier();              // Critical section end
  cli();                  // Enable interrupts
end function
```

### Category 4: Stack Operations (NEW)

| Intrinsic | Signature | IL Opcode | 6502 Instruction | Description |
|-----------|-----------|-----------|------------------|-------------|
| `pha` | `(): void` | `CPU_PHA` | `PHA` | Push A to stack |
| `pla` | `(): byte` | `CPU_PLA` | `PLA` | Pull A from stack |
| `php` | `(): void` | `CPU_PHP` | `PHP` | Push processor status |
| `plp` | `(): void` | `CPU_PLP` | `PLP` | Pull processor status |

**Usage Example:**
```js
function preserveAndModify(): void
  php();                  // Save processor status
  pha();                  // Save A register
  
  // ... do work that modifies A and flags ...
  
  pla();                  // Restore A
  plp();                  // Restore flags
end function
```

### Category 5: Utility (Already in Plan)

| Intrinsic | Signature | IL Opcode | Description |
|-----------|-----------|-----------|-------------|
| `sizeof` | `(type): byte` | (compile-time) | Size of type in bytes |
| `length` | `(array): word` | `INTRINSIC_LENGTH` | Array/string length |
| `lo` | `(value: word): byte` | (compile-time or IL) | Low byte of word |
| `hi` | `(value: word): byte` | (compile-time or IL) | High byte of word |

**Note:** `@` (address-of operator) is already supported for getting variable addresses.

---

## IL Opcode Additions

Add to `ILOpcode` enum in `01-type-system.md`:

```typescript
// Optimization control (v2.0)
OPT_BARRIER = 'OPT_BARRIER',
VOLATILE_READ = 'VOLATILE_READ',
VOLATILE_WRITE = 'VOLATILE_WRITE',

// CPU instructions (v2.0)
CPU_SEI = 'CPU_SEI',
CPU_CLI = 'CPU_CLI',
CPU_NOP = 'CPU_NOP',
CPU_BRK = 'CPU_BRK',
CPU_PHA = 'CPU_PHA',
CPU_PLA = 'CPU_PLA',
CPU_PHP = 'CPU_PHP',
CPU_PLP = 'CPU_PLP',
```

---

## IL Instruction Behavior

### OPT_BARRIER

```typescript
class ILOptBarrierInstruction extends ILInstruction {
  // No operands, no result
  // Semantics: Optimizer cannot move instructions across this barrier
  
  hasSideEffects(): boolean { return true; }  // Prevents DCE
  isBarrier(): boolean { return true; }        // New method for optimizer
}
```

### VOLATILE_READ / VOLATILE_WRITE

```typescript
class ILVolatileReadInstruction extends ILInstruction {
  // Similar to INTRINSIC_PEEK but:
  // - Cannot be eliminated even if result unused
  // - Cannot be moved across barriers
  // - Cannot be combined with other reads
  
  isVolatile(): boolean { return true; }
}
```

### CPU Instructions

```typescript
class ILCpuInstruction extends ILInstruction {
  // Maps 1:1 to a 6502 instruction
  // Properties:
  // - Cannot be eliminated
  // - Cannot be reordered (implicit barrier behavior)
  // - Fixed cycle count
  
  getCycleCount(): number {
    switch (this.opcode) {
      case ILOpcode.CPU_SEI: return 2;
      case ILOpcode.CPU_CLI: return 2;
      case ILOpcode.CPU_NOP: return 2;
      case ILOpcode.CPU_PHA: return 3;
      case ILOpcode.CPU_PLA: return 4;
      // ... etc
    }
  }
}
```

---

## Intrinsic Registry Updates

Update `05-intrinsics.md` Task 5.1 to include:

```typescript
class IntrinsicRegistry {
  protected intrinsics = new Map<string, IntrinsicHandler>([
    // Memory access (existing)
    ['peek', { opcode: ILOpcode.INTRINSIC_PEEK, ... }],
    ['poke', { opcode: ILOpcode.INTRINSIC_POKE, ... }],
    ['peekw', { opcode: ILOpcode.INTRINSIC_PEEKW, ... }],
    ['pokew', { opcode: ILOpcode.INTRINSIC_POKEW, ... }],
    
    // Optimization control (new)
    ['barrier', { opcode: ILOpcode.OPT_BARRIER, ... }],
    ['volatile_read', { opcode: ILOpcode.VOLATILE_READ, ... }],
    ['volatile_write', { opcode: ILOpcode.VOLATILE_WRITE, ... }],
    
    // CPU instructions (new)
    ['sei', { opcode: ILOpcode.CPU_SEI, ... }],
    ['cli', { opcode: ILOpcode.CPU_CLI, ... }],
    ['nop', { opcode: ILOpcode.CPU_NOP, ... }],
    ['brk', { opcode: ILOpcode.CPU_BRK, ... }],
    ['pha', { opcode: ILOpcode.CPU_PHA, ... }],
    ['pla', { opcode: ILOpcode.CPU_PLA, ... }],
    ['php', { opcode: ILOpcode.CPU_PHP, ... }],
    ['plp', { opcode: ILOpcode.CPU_PLP, ... }],
    
    // Utility (existing)
    ['sizeof', { compileTime: true, ... }],
    ['length', { opcode: ILOpcode.INTRINSIC_LENGTH, ... }],
    ['lo', { compileTime: true, ... }],
    ['hi', { compileTime: true, ... }],
  ]);
}
```

---

## Task Breakdown

### Task 5a.1: Add Optimization Control Intrinsics

**Time**: 1 hour

**Tests**: 10 tests

**Implementation**:
- Add `barrier()` → OPT_BARRIER
- Add `volatile_read()` → VOLATILE_READ
- Add `volatile_write()` → VOLATILE_WRITE
- Optimizer respects barriers
- DCE doesn't eliminate volatile operations

### Task 5a.2: Add CPU Instruction Intrinsics

**Time**: 1.5 hours

**Tests**: 15 tests

**Implementation**:
- Add sei, cli, nop, brk intrinsics
- Add pha, pla, php, plp intrinsics
- Each generates single IL instruction
- Code generator maps to exact 6502 instruction

### Task 5a.3: Add Utility Intrinsics

**Time**: 1 hour

**Tests**: 10 tests

**Implementation**:
- Add `lo(word)` → extract low byte
- Add `hi(word)` → extract high byte
- Compile-time evaluation when possible
- IL instruction for runtime cases

### Task 5a.4: Integration Tests

**Time**: 0.5 hours

**Tests**: 5 tests

**Implementation**:
- Test intrinsics in realistic scenarios
- Test optimizer respects barriers
- Test CPU instructions generate correct code

---

## Phase 5a Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 5a.1 | Optimization control intrinsics | 1 hr | 10 | [ ] |
| 5a.2 | CPU instruction intrinsics | 1.5 hr | 15 | [ ] |
| 5a.3 | Utility intrinsics (lo/hi) | 1 hr | 10 | [ ] |
| 5a.4 | Integration tests | 0.5 hr | 5 | [ ] |
| **Total** | | **4 hr** | **40** | |

---

## Success Criteria

- [ ] All intrinsics recognized by IL generator
- [ ] Optimizer respects OPT_BARRIER
- [ ] Volatile operations never eliminated
- [ ] CPU instructions generate correct 6502 code
- [ ] Intrinsics can be inlined at call sites
- [ ] 40 tests passing

---

## Standard Library File

These intrinsics will be declared in a standard library file:

**`examples/lib/system.blend`** (or similar):

```js
module System.Intrinsics

// Memory access
export function peek(address: word): byte;
export function poke(address: word, value: byte): void;
export function peekw(address: word): word;
export function pokew(address: word, value: word): void;

// Optimization control
export function barrier(): void;
export function volatile_read(address: word): byte;
export function volatile_write(address: word, value: byte): void;

// CPU instructions
export function sei(): void;
export function cli(): void;
export function nop(): void;
export function brk(): void;
export function pha(): void;
export function pla(): byte;
export function php(): void;
export function plp(): void;

// Utility
export function lo(value: word): byte;
export function hi(value: word): byte;
```

---

**Previous**: [05-intrinsics.md](05-intrinsics.md)  
**Next**: [06-ssa-construction.md](06-ssa-construction.md)