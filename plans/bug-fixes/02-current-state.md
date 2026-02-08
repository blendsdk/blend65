# Current State: Bug Fixes

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Source Code Analysis

### BUG-001: Double CMP — Comparison Code Generation

**File**: `packages/compiler/src/codegen/generator/` (comparison subclass)

The code generator emits `CMP #value` followed by `CMP #$00`, where the second CMP
overwrites the CPU flags from the first. For `if (color > 15)`, the correct approach
is `CMP #$10` + `BCC .else` (unsigned greater-than on 6502).

**Root Cause**: The comparison codegen emits a boolean result (0/1) into the accumulator
and then tests that boolean, instead of directly branching on the comparison flags.

**Fix**: Emit a single CMP + branch instruction pair, skipping the boolean materialization.

---

### BUG-004: Duplicate Labels

**File**: `packages/compiler/src/codegen/generator/base.ts`

```typescript
protected labelCounter: number = 0;
// ... resets on each function:
this.labelCounter = 0;
```

The `labelCounter` resets to 0 when generating each function. This causes `.while0`,
`.endwhile1`, etc. to appear in multiple functions.

**Fix**: Remove the reset (`this.labelCounter = 0`). The counter should be module-global
so labels are unique across all functions. Also verify `il/builder/base.ts` has the
same issue (it also resets `labelCounter`).

---

### BUG-005 / BUG-006 / BUG-007: CLI Optimization Flags

**File**: `packages/cli/src/commands/build.ts`

```typescript
.option('optimization', {
  alias: 'O',
  type: 'string',
  choices: ['O0', 'O1', 'O2', 'O3', 'Os', 'Oz'],  // includes 'O' prefix
  default: 'O0',
})
```

**BUG-005 Fix**: Change choices to `['0', '1', '2', '3', 's', 'z']`, default `'0'`.
In `buildConfig`, prepend `'O'`: `optimization: ('O' + args.optimization)`.

**BUG-006 Fix**: Add `.epilog()` with optimization level descriptions.

**BUG-007 Fix**: In `buildConfig`, handle array: `Array.isArray(opt) ? opt[opt.length - 1] : opt`.

---

### DESIGN-003: Unnecessary JMP main

**File**: Code generator startup section emission

The codegen emits all functions in source order, then creates a startup section with
`JMP main`. Instead, it should detect `main()` and emit it first, eliminating the jump.

**Fix**: In the function emission loop, partition functions: emit `main()` first,
then all other functions. Remove the startup section entirely.

---

### BUG-003: Misleading Comments

**File**: Code generator comment emission

Comments like `; A already has $02` are generated based on simple tracking that doesn't
account for branch convergence points. These comments can be wrong.

**Fix**: Either remove register-state comments entirely, or only emit them when
the previous instruction is the direct predecessor (no branch targets).

---

### Skipped Tests

**Known skipped tests from Phase 5/5B**:
- 22 skipped: Block scope limitations (variables in if/while blocks)
- 2 skipped: Parser limitation + scope resolution bug
- 5 skipped: Type coercion gaps, break/continue outside loop, logical edge case
- Unknown: Any other skipped tests in codegen/optimizer/pipeline tests

**Audit needed**: Run `grep -r 'it.skip\|describe.skip\|xit\|xdescribe' packages/compiler/src/__tests__/` to get full count.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| BUG-001 fix affects other comparisons | Medium | High | Test ALL comparison operators |
| Label counter change breaks tests | Low | Medium | Run full test suite after change |
| CLI changes break existing scripts | Low | Low | Maintain backward compat where possible |
| Skipped tests reveal deeper bugs | Medium | Medium | Fix incrementally, document gaps |
