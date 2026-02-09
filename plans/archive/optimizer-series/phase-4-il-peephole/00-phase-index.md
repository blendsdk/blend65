# Phase 4: IL Peephole - Phase Index

> **Phase**: 4 of 7  
> **Status**: Not Started  
> **Sessions**: ~5-7  
> **Goal**: IL-level pattern optimization for -O2  
> **Milestone**: -O2 produces smaller code than -O1

---

## Phase Overview

Phase 4 implements **IL-level peephole optimization** using pattern matching. This phase establishes the pattern framework used by both IL and ASM peephole optimizers.

**After this phase**: The compiler can recognize and optimize common IL instruction sequences before ASM generation.

---

## Documents in This Phase

| Doc | Name | Focus | Est. Lines |
|-----|------|-------|------------|
| **01** | [Pattern Framework](01-pattern-framework.md) | Pattern base, matching engine | ~350 |
| **02** | [Pattern Registry](02-pattern-registry.md) | Pattern registration, priority | ~250 |
| **03** | [Load-Store IL](03-load-store-il.md) | IL-level load/store patterns | ~300 |
| **04** | [Arithmetic Identity](04-arithmetic-identity.md) | x+0, x*1, x-x patterns | ~300 |
| **05** | [Strength Reduction](05-strength-reduce.md) | x*2→x<<1, x/2→x>>1 | ~300 |
| **99** | [Tasks](99-phase-tasks.md) | Task checklist | ~150 |

---

## Key Patterns

### Pattern Framework Architecture

The pattern framework provides a reusable system for both IL and ASM optimization:

```typescript
interface Pattern {
  name: string;
  match(instructions: ILInstruction[], index: number): MatchResult | null;
  apply(match: MatchResult): ILInstruction[];
  priority: number;  // Higher = applied first
}
```

### Load-Store Elimination (IL Level)

Eliminates redundant load/store sequences in IL:

```
; Before
STORE %x, $50
LOAD %y, $50

; After  
STORE %x, $50
COPY %y, %x    ; Use SSA value directly
```

### Arithmetic Identity Patterns

Simplifies trivial arithmetic:

| Pattern | Before | After |
|---------|--------|-------|
| Add Zero | `x + 0` | `x` |
| Multiply One | `x * 1` | `x` |
| Subtract Self | `x - x` | `0` |
| Divide Self | `x / x` | `1` |
| Multiply Zero | `x * 0` | `0` |
| Or Zero | `x | 0` | `x` |
| And Self | `x & x` | `x` |

### Strength Reduction

Replaces expensive operations with cheaper equivalents:

| Expensive | Cheap | Savings |
|-----------|-------|---------|
| `x * 2` | `x << 1` | ~75 cycles |
| `x * 4` | `x << 2` | ~150 cycles |
| `x * 8` | `x << 3` | ~225 cycles |
| `x / 2` | `x >> 1` | ~50 cycles |
| `x / 4` | `x >> 2` | ~100 cycles |
| `x % 2` | `x & 1` | ~50 cycles |
| `x % 4` | `x & 3` | ~50 cycles |

---

## Directory Structure

```
packages/compiler/src/il/optimizer/
├── patterns/
│   ├── index.ts              # Pattern exports
│   ├── pattern.ts            # Pattern base class
│   ├── registry.ts           # Pattern registry
│   ├── load-store.ts         # Load-store patterns
│   ├── arithmetic.ts         # Arithmetic identity patterns
│   └── strength-reduce.ts    # Strength reduction patterns
├── peephole.ts               # PeepholeOptimizer pass
└── index.ts                  # Optimizer exports
```

---

## Dependencies

### From Phase 3

- `ConstantFolding` - For evaluating strength reduction opportunities
- `CopyPropagation` - For tracking value aliases

### From Phase 2

- `UseDefAnalysis` - For load-store elimination safety

---

## Success Criteria

- [ ] Pattern framework supports registration and matching
- [ ] Load-store redundancy detected at IL level
- [ ] All arithmetic identity patterns working
- [ ] Strength reduction for multiply/divide by powers of 2
- [ ] ~150 tests passing
- [ ] -O2 measurably reduces code size vs -O1

---

## Why IL-Level Peephole?

| Benefit | Explanation |
|---------|-------------|
| **Higher abstraction** | See values, not just registers |
| **More context** | SSA form tracks data flow |
| **Platform independent** | Patterns work for any target |
| **Foundation for ASM** | Framework reused in Phase 5 |

---

**Parent**: [OPTIMIZER-ROADMAP.md](../OPTIMIZER-ROADMAP.md)  
**Previous Phase**: [Phase 3: O1 Transforms](../phase-3-o1-transforms/00-phase-index.md)  
**Next Phase**: [Phase 5: ASM Peephole](../phase-5-asm-peephole/00-phase-index.md)