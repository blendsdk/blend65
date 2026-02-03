# Testing Strategy: IL Optimizer

> **Document**: 09-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: 90%+ coverage per pass
- Integration tests: All pass combinations
- E2E tests: Source → optimized IL verification

## Test Categories

### Unit Tests (Per Pass)

| Pass | Test File | Test Count |
|------|-----------|------------|
| Infrastructure | `infrastructure.test.ts` | ~10 |
| DCE | `dce.test.ts` | ~15 |
| Constant Folding | `constant-fold.test.ts` | ~15 |
| Constant Propagation | `constant-prop.test.ts` | ~12 |
| Copy Propagation | `copy-prop.test.ts` | ~10 |
| IL Peephole | `il-peephole.test.ts` | ~15 |

### Integration Tests

| Test | Description |
|------|-------------|
| Pass ordering | Verify dependencies respected |
| Iterative optimization | O3 iterates until fixed-point |
| Optimization levels | O0 does nothing, O2 runs all |
| Combined effect | Const fold + prop together |

### End-to-End Tests

| Test | Description |
|------|-------------|
| Simple program | Optimize hello world |
| Loop optimization | Optimize loop code |
| Dead code | Large dead section removed |
| Constants | All constants folded |

## Test Data Fixtures

### Fixture Structure

```
packages/compiler-v2/fixtures/optimizer/
├── dce/
│   ├── dead-store.blend
│   ├── unreachable-code.blend
│   └── ...
├── constant-fold/
│   ├── arithmetic.blend
│   └── ...
├── integration/
│   └── combined.blend
```

### Example Fixture

```typescript
// __tests__/optimizer/passes/dce.test.ts

describe('DCE Pass', () => {
  it('removes dead stores', () => {
    const il = createTestFunction([
      loadImm(5),
      storeByte('x'),     // Dead - x never read
      loadImm(10),
      storeByte('y'),
      loadByte('y'),
      ret(),
    ]);

    const pass = new DCEPass();
    computeLiveRanges(il);
    pass.run(il, { level: 'O1' });

    expect(il.instructions).not.toContain(
      expect.objectContaining({ opcode: ILOpcode.STORE_BYTE, /* x */ })
    );
  });

  it('preserves live stores', () => {
    const il = createTestFunction([
      loadImm(5),
      storeByte('x'),
      loadByte('x'),      // x IS read
      ret(),
    ]);

    const pass = new DCEPass();
    const before = il.instructions.length;
    pass.run(il, { level: 'O1' });

    expect(il.instructions.length).toBe(before); // Nothing removed
  });
});
```

## Verification Checklist

- [ ] All unit tests pass at O0, O1, O2
- [ ] No semantic changes between levels
- [ ] No regressions in existing tests
- [ ] Test coverage meets goals
- [ ] E2E tests verify real programs

## Test Helpers

```typescript
// __tests__/optimizer/helpers.ts

export function createTestFunction(instructions: ILInstruction[]): ILFunction {
  return {
    name: 'test',
    instructions,
    frame: createTestFrame(),
    // ...
  };
}

export function loadImm(value: number): ILInstruction { /* ... */ }
export function storeByte(slot: string): ILInstruction { /* ... */ }
export function loadByte(slot: string): ILInstruction { /* ... */ }
export function ret(): ILInstruction { /* ... */ }
```

## Related Documents

| Document | Description |
|----------|-------------|
| [04-dce.md](04-dce.md) | DCE test requirements |
| [99-execution-plan.md](99-execution-plan.md) | Implementation order |