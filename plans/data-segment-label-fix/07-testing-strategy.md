# Testing Strategy: @data Const Array Label-Based Addressing Fix

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: Label generation and propagation
- Integration tests: Full pipeline from Blend source to ASM output
- E2E tests: Verify assembly output contains correct labels and addressing
- Regression: All existing tests must pass

## Test Categories

### Unit Tests

| Test | Description | Priority |
|------|-------------|----------|
| GlobalSlot dataLabel assignment | `allocateDataGlobals()` sets `dataLabel` on @data slots | High |
| Label name sanitization | Dots in module names replaced with underscores | High |
| FrameSlot dataLabel propagation | `dataLabel` flows from GlobalSlot to FrameSlot | High |
| Non-@data slots have no dataLabel | @ram, @zp, default globals don't get dataLabel | Medium |

### Integration Tests (E2E Pipeline)

| Test | Description | Priority |
|------|-------------|----------|
| @data array read generates label LDA | `myData[i]` → `LDA __data_Module_myData,Y` | High |
| Data section contains matching label | Assembly has `__data_Module_myData:` before `!byte` | High |
| Multiple @data arrays in same module | Each gets unique label, both work correctly | High |
| @data scalar read (non-indexed) | Scalar `@data const` uses label LDA (non-Y-indexed) | Medium |
| Multi-module @data arrays | Labels include module name, no collisions | Medium |

### Regression Tests

| Test | Description | Priority |
|------|-------------|----------|
| All existing tests pass | `./compiler-test` shows no regressions | Critical |
| Existing @data segment tests | `__tests__/e2e/pipeline/global-variables.test.ts` still passes | High |
| Existing data-segment builder tests | `__tests__/codegen/data-segment.test.ts` still passes | High |

## Verification Checklist

- [ ] All existing tests pass (`./compiler-test`)
- [ ] New unit tests for dataLabel generation pass
- [ ] New integration tests for label-based LDA pass
- [ ] Balloon-sprite example produces correct ASM with labels
- [ ] No regressions in existing @data/global variable tests
