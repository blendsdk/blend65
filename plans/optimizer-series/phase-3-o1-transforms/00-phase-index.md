# Phase 3: O1 Transforms - Phase Index

> **Phase**: 3 of 7  
> **Status**: Not Started  
> **Sessions**: ~5-6  
> **Goal**: Implement basic transforms for -O1 level  
> **Milestone**: -O1 produces smaller code than -O0

---

## Phase Overview

Phase 3 implements the **core transformation passes** that form the backbone of optimization. These are enabled at -O1 and above.

**After this phase**: The compiler can eliminate dead code, fold constants, and propagate values.

---

## Documents in This Phase

| Doc | Name | Focus | Est. Lines |
|-----|------|-------|------------|
| **01** | [DCE](01-dce.md) | Dead Code Elimination | ~300 |
| **02** | [Constant Folding](02-constant-fold.md) | Evaluate at compile time | ~300 |
| **03** | [Constant Propagation](03-constant-prop.md) | Propagate known values | ~250 |
| **04** | [Copy Propagation](04-copy-prop.md) | Eliminate copies | ~250 |
| **99** | [Tasks](99-phase-tasks.md) | Task checklist | ~150 |

---

## Key Transforms

### Dead Code Elimination (DCE)

Removes instructions whose results are never used:

```js
let x = 5;      // DEAD - x never used
let y = 10;
print(y);
```

### Constant Folding

Evaluates constant expressions at compile time:

```js
let x = 1 + 2;  // Becomes: let x = 3
let y = x * 4;  // Becomes: let y = 12 (if x is const)
```

### Constant Propagation

Replaces variable uses with known constant values:

```js
let x = 5;
let y = x + 1;  // Becomes: let y = 5 + 1
```

### Copy Propagation

Replaces copies with original values:

```js
let x = y;
let z = x + 1;  // Becomes: let z = y + 1
```

---

## Dependencies

### From Phase 2

- `UseDefAnalysis` - Required for DCE, Copy Prop
- `LivenessAnalysis` - Required for DCE

---

## Success Criteria

- [ ] DCE removes unused instructions
- [ ] Constants fold correctly (with 6502 overflow handling)
- [ ] Constants propagate through assignments
- [ ] Copies are eliminated
- [ ] ~125 tests passing
- [ ] -O1 measurably reduces code size

---

**Parent**: [OPTIMIZER-ROADMAP.md](../OPTIMIZER-ROADMAP.md)  
**Previous Phase**: [Phase 2: Analysis](../phase-2-analysis/00-phase-index.md)  
**Next Phase**: [Phase 4: IL Peephole](../phase-4-il-peephole/00-phase-index.md)