# Task 10.6a: SMC Usage Documentation

> **Session**: 5.6a
> **Phase**: 10-smc (Self-Modifying Code)
> **Estimated Time**: 2 hours
> **Tests**: N/A (documentation)
> **Prerequisites**: 10-05-smc-config.md

---

## Overview

This document provides **user-facing documentation** for the SMC optimization system in Blend65.

---

## SMC Quick Start

### Enabling SMC

```js
// Method 1: Global enable (blend65.config.json)
{
  "optimization": {
    "smc": { "enabled": true }
  }
}

// Method 2: Per-function attribute
@smc(allow)
function myFunction(): void { }
```

### SMC Attributes

| Attribute | Description |
|-----------|-------------|
| `@smc(allow)` | Enable SMC for this function |
| `@smc(deny)` | Disable SMC for this function |
| `@smc(prefer)` | Prioritize SMC for this function |
| `@smc(require)` | Fail compilation if SMC cannot be applied |

---

## When to Use SMC

### Good Candidates

```js
// ✅ Hot loops with indexed access
@smc(prefer)
function renderScreen(): void {
    for (let i: byte = 0; i < 200; i++) {
        // Heavy indexing benefits from SMC
    }
}

// ✅ Switch statements with many cases
@smc(prefer)
function handleInput(key: byte): void {
    switch (key) {
        // 8+ cases ideal for jump tables
    }
}
```

### Poor Candidates

```js
// ❌ One-time initialization
function initGame(): void {
    // SMC overhead not worth it
}

// ❌ Safety-critical interrupt handlers
@smc(deny)
interrupt function irqHandler(): void {
    // SMC can cause timing issues
}
```

---

## Safety Considerations

### Interrupt Safety

Multi-byte SMC modifications are not atomic. The compiler automatically wraps unsafe modifications:

```js
// Automatic protection
@smc(allow)
function updatePointer(): void {
    // Compiler generates:
    // SEI
    // ... modification ...
    // CLI
}
```

### Memory Regions

SMC only works in RAM. Code placed in ROM regions cannot be modified:

```js
// ✅ Safe: RAM region
@segment("code", $0800)
@smc(allow)
function ramCode(): void { }

// ❌ Unsafe: ROM region
@segment("rom", $E000)
@smc(allow)  // Compiler warning!
function romCode(): void { }
```

---

## Compiler Output

### SMC Report

```bash
blend65 compile --smc-report game.bl65
```

Output:
```
SMC Optimization Report
=======================
Total patterns detected: 12
Patterns applied: 8
Patterns rejected: 4

Applied:
  renderSprites: LOOP_COUNTER (score: 87)
  handleCommand: COMPUTED_JUMP (score: 72)
  ...

Rejected:
  initLevel: LOOP_COUNTER (reason: cold path)
  ...

Estimated savings: ~850 cycles/frame
```

---

## Debugging SMC

### Viewing Generated Code

```bash
blend65 compile --emit-asm --smc-annotate game.bl65
```

Shows SMC modifications in assembly output:
```asm
; SMC: LOOP_COUNTER pattern
loop:
    LDA table+7     ; [SMC] operand modified each iteration
    ; ...
    DEC loop+1      ; [SMC] decrement operand
```

---

## Task Checklist

- [ ] Write quick start guide
- [ ] Document all SMC attributes
- [ ] Write safety guidelines
- [ ] Document compiler output
- [ ] Add debugging tips

---

## Next Document

**10-06b-smc-examples.md** - SMC code examples and patterns