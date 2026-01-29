# Compiler Architecture

> **Version**: 2.0.0  
> **Status**: Draft  
> **Architecture**: Static Frame Allocation (SFA)

## Overview

The Blend65 v2 compiler uses **Static Frame Allocation (SFA)** instead of SSA (Static Single Assignment). This is the standard approach for 6502 compilers like KickC, Prog8, and cc65.

## Why SFA Instead of SSA?

### The Problem with SSA on 6502

SSA was designed for modern CPUs with:
- Many registers (16-32+)
- Register renaming hardware
- Out-of-order execution

The 6502 has only **3 registers** (A, X, Y), making SSA's PHI node resolution extremely complex.

### SFA Advantages

| Aspect | SSA | SFA |
|--------|-----|-----|
| Registers needed | Many | 3 is enough |
| PHI nodes | Complex resolution | Not needed |
| Implementation | Very complex | Straightforward |
| 6502 fit | Poor | Excellent |
| Nested loops | Complex | Simple |

## Static Frame Allocation

### Concept

Each function gets a **static memory frame** allocated at compile time:
- Parameters have fixed addresses
- Local variables have fixed addresses
- No runtime stack for locals

```
Function: calculate(a: byte, b: byte): byte
  Frame at $0200:
    $0200: parameter 'a' (1 byte)
    $0201: parameter 'b' (1 byte)
    $0202: local 'temp' (1 byte)
    $0203: local 'result' (1 byte)
```

### Trade-off: No Recursion

SFA requires that **recursion is forbidden**:
- Each function has ONE frame
- Recursive calls would overwrite the frame
- Compiler detects and rejects recursion (direct or indirect)

```js
// ❌ COMPILE ERROR: Recursion not allowed
function factorial(n: byte): word {
  if (n <= 1) return 1;
  return n * factorial(n - 1);  // ERROR!
}

// ✅ Use iteration instead
function factorial(n: byte): word {
  let result: word = 1;
  for (let i: byte = 2; i <= n; i += 1) {
    result = result * i;
  }
  return result;
}
```

## Compiler Pipeline

```
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌─────────────┐
│  Lexer  │───▶│ Parser  │───▶│ Semantic │───▶│ Frame Alloc │
└─────────┘    └─────────┘    └──────────┘    └─────────────┘
                                                     │
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌─────▼─────┐
│  Emit   │◀───│ ASM Opt │◀───│ CodeGen  │◀───│  IL Gen   │
└─────────┘    └─────────┘    └──────────┘    └───────────┘
                                   ▲
                              [IL Opt slot]
                              (empty/future)
```

### Pipeline Stages

| Stage | Input | Output | Description |
|-------|-------|--------|-------------|
| Lexer | Source | Tokens | Tokenization |
| Parser | Tokens | AST | Build syntax tree |
| Semantic | AST | Typed AST | Type checking, validation |
| Frame Alloc | Typed AST | Frame info | Allocate static frames |
| IL Gen | AST + Frames | IL | Generate intermediate code |
| IL Opt | IL | IL | (Empty slot for future O2) |
| CodeGen | IL | ASM-IL | Generate assembly |
| ASM Opt | ASM-IL | ASM-IL | Peephole optimization |
| Emit | ASM-IL | Output | ACME assembler output |

## Frame Allocator

### Responsibilities

1. **Build call graph** - Which functions call which
2. **Detect recursion** - Direct and indirect cycles
3. **Allocate frames** - Assign addresses to each function's frame

### Call Graph Analysis

```js
module Example;

function main(): void {
  init();
  gameLoop();
}

function init(): void {
  clearScreen();
}

function gameLoop(): void {
  while (true) {
    update();
    render();
  }
}

function update(): void { }
function render(): void { clearScreen(); }
function clearScreen(): void { }
```

**Call Graph:**
```
main ──▶ init ──▶ clearScreen
  │
  └────▶ gameLoop ──▶ update
              │
              └────▶ render ──▶ clearScreen
```

**No cycles = No recursion = OK!**

### Recursion Detection

```js
// Direct recursion
function a(): void {
  a();  // ERROR: a calls itself
}

// Indirect recursion
function b(): void {
  c();
}

function c(): void {
  b();  // ERROR: b → c → b cycle
}
```

**Error message:**
```
error[E0100]: Recursion not allowed
  --> main.blend:5:3
   |
 5 |   a();
   |   ^^^ function 'a' calls itself recursively
   |
   = note: Blend65 uses static frame allocation which doesn't support recursion
   = help: Use iteration instead of recursion
```

### Frame Layout

**Memory regions:**
```
$0200-$03FF  SFA Frame Region (512 bytes)
  $0200-$020F  main() frame (16 bytes)
  $0210-$021F  init() frame (16 bytes)
  $0220-$023F  gameLoop() frame (32 bytes)
  ...
```

**Frame contents:**
```
┌─────────────────────────────┐
│ Function Frame: calculate   │
├─────────────────────────────┤
│ $0200: param a (byte)       │
│ $0201: param b (byte)       │
│ $0202: local temp (byte)    │
│ $0203: local result (byte)  │
│ $0204: return value (byte)  │
└─────────────────────────────┘
```

## Intermediate Language (IL)

### Design Principles

1. **Simple linear structure** - No SSA, no PHI nodes
2. **Static addresses** - All variables have addresses
3. **Accumulator-centric** - Designed around 6502's A register
4. **~20-25 opcodes** - Minimal instruction set

### IL Opcodes

```
// Memory operations
IL_LOAD_BYTE   addr        ; Load byte to accumulator
IL_STORE_BYTE  addr        ; Store accumulator to address
IL_LOAD_WORD   addr        ; Load word
IL_STORE_WORD  addr        ; Store word
IL_LOAD_IMM    value       ; Load immediate

// Arithmetic
IL_ADD         addr        ; A = A + [addr]
IL_SUB         addr        ; A = A - [addr]
IL_AND         addr        ; A = A & [addr]
IL_OR          addr        ; A = A | [addr]
IL_XOR         addr        ; A = A ^ [addr]

// Comparison
IL_CMP         addr        ; Compare A with [addr]
IL_CMP_IMM     value       ; Compare A with immediate

// Control flow
IL_JUMP        label       ; Unconditional jump
IL_JUMP_EQ     label       ; Jump if equal (Z=1)
IL_JUMP_NE     label       ; Jump if not equal (Z=0)
IL_JUMP_LT     label       ; Jump if less than (C=0)
IL_JUMP_GE     label       ; Jump if greater/equal (C=1)

// Function
IL_CALL        func        ; Call function
IL_RETURN                  ; Return from function

// Intrinsics
IL_PEEK        addr        ; peek(addr)
IL_POKE        addr, val   ; poke(addr, val)
```

### IL Example

```js
function add(a: byte, b: byte): byte {
  let result: byte = a + b;
  return result;
}
```

**IL Output:**
```
func_add:
  IL_LOAD_BYTE  $0200       ; Load param a
  IL_ADD        $0201       ; Add param b
  IL_STORE_BYTE $0202       ; Store to result
  IL_LOAD_BYTE  $0202       ; Load result for return
  IL_RETURN
```

## Code Generator

### Strategy

1. **Direct IL-to-ASM mapping** - Most IL instructions map to 1-2 ASM instructions
2. **Accumulator tracking** - Know what's in A to avoid redundant loads
3. **No complex register allocation** - SFA eliminates this problem

### Generated Code Example

```js
function clearScreen(): void {
  for (let i: word = 0; i < 1000; i += 1) {
    poke($0400 + i, 32);
  }
}
```

**Generated Assembly:**
```asm
clearScreen:
    ; let i: word = 0
    LDA #$00
    STA frame_i
    STA frame_i+1
    
.loop:
    ; i < 1000
    LDA frame_i+1
    CMP #$03        ; High byte of 1000
    BCC .body       ; If high < 3, continue
    BNE .done       ; If high > 3, done
    LDA frame_i
    CMP #$E8        ; Low byte of 1000
    BCS .done       ; If low >= 232, done
    
.body:
    ; poke($0400 + i, 32)
    CLC
    LDA #$00
    ADC frame_i
    STA ptr
    LDA #$04
    ADC frame_i+1
    STA ptr+1
    LDA #32
    LDY #0
    STA (ptr),Y
    
    ; i += 1
    INC frame_i
    BNE .loop
    INC frame_i+1
    JMP .loop
    
.done:
    RTS
```

## Optimizer Architecture

### Extension Points

```typescript
interface OptimizerPass<T> {
  name: string;
  run(input: T): T;
}

class Optimizer<T> {
  private passes: OptimizerPass<T>[] = [];
  
  addPass(pass: OptimizerPass<T>): void;
  run(input: T): T;
}
```

### Two Optimizer Slots

| Slot | Level | Status | Purpose |
|------|-------|--------|---------|
| IL Optimizer | O2 | Empty (future) | Constant folding, dead code |
| ASM Optimizer | O1 | Active | Peephole optimization |

### Optimization Levels

| Level | IL Opt | ASM Opt | Description |
|-------|--------|---------|-------------|
| O0 | ❌ | ❌ | No optimization (debug) |
| O1 | ❌ | ✅ | ASM peephole only |
| O2 | ✅ | ✅ | Full optimization |

### ASM Peephole Patterns

**Redundant load elimination:**
```asm
; Before
LDA value
STA temp
LDA value    ; ← redundant

; After
LDA value
STA temp
; (removed - A still has value)
```

**Dead store elimination:**
```asm
; Before
STA temp     ; ← never read
LDA other
STA temp     ; overwrites

; After
LDA other
STA temp
```

**Strength reduction:**
```asm
; Before (multiply by 2)
ASL A
ASL A

; After
ASL A
ASL A        ; (kept - already optimal for *4)
```

## Memory Layout

### C64 Memory Map with SFA

```
$0000-$00FF  Zero Page
  $00-$01    CPU vectors
  $02-$8F    User @zp variables (143 bytes)
  $90-$FA    KERNAL workspace
  $FB-$FE    Compiler indirect pointers (4 bytes)
  $FF        Reserved

$0100-$01FF  Hardware stack (6502 stack)

$0200-$03FF  SFA Frame Region
  Compiler-managed static frames for:
  - Function parameters
  - Function local variables
  - Temporary values

$0400-$07FF  Screen RAM

$0800-$9FFF  Program code and data
  - Compiled code
  - @ram variables
  - @data constants

$A000-$BFFF  BASIC ROM (can be banked out)
$C000-$CFFF  Free RAM
$D000-$DFFF  I/O / Character ROM
$E000-$FFFF  KERNAL ROM
```

## Summary

### v2 Compiler Characteristics

| Aspect | Description |
|--------|-------------|
| Architecture | Static Frame Allocation (SFA) |
| Recursion | Forbidden (compile error) |
| IL | Simple linear, ~20-25 opcodes |
| Optimizer | Two slots (IL empty, ASM active) |
| Frame region | $0200-$03FF |
| ZP usage | $FB-$FE (4 bytes) for compiler |

### Benefits of SFA

1. ✅ **Simple implementation** - No PHI nodes, no complex SSA
2. ✅ **Predictable code** - Direct IL-to-ASM mapping
3. ✅ **Fast compilation** - Linear algorithms
4. ✅ **6502-native** - Works with 3 registers
5. ✅ **Debuggable output** - Clear correspondence to source