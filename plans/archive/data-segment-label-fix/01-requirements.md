# Requirements: @data Const Array Label-Based Addressing Fix

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Bug Description

When a Blend65 program uses `@data const` arrays and reads elements via array indexing (e.g., `balloonData[i]`), the generated 6502 assembly references address `$0000` instead of the actual data location in the binary. This causes reads from zero page memory (garbage) instead of the intended data.

### Reproduction

```js
module Example;

@data const myData: byte[] = [10, 20, 30];

export function main(): void {
    for (let i: byte = 0 to 2) {
        let val: byte = myData[i];
        poke($0400 + i, val);
    }
}
```

**Expected ASM:** `LDA __data_Example_myData,Y`
**Actual ASM:** `LDA $00,Y`

## Functional Requirements

### Must Have

- [ ] `@data const` arrays must be addressable by the code generator via ACME labels
- [ ] Generated LDA/STA for `@data` array access must use label operands (not numeric 0)
- [ ] Data section must emit labels before each `@data` entry's byte data
- [ ] All existing tests must continue to pass
- [ ] Balloon-sprite example must be reverted to the idiomatic `@data const` pattern

### Won't Have (Out of Scope)

- Numeric address rebasing (using labels instead)
- Changes to `@ram` or `@zp` global handling
- Changes to the data segment byte packing (`DataSegmentBuilder`)
- Changes to scalar `@data const` (only arrays are affected by indexed access)

## Acceptance Criteria

1. [ ] `@data const` array read generates `LDA __data_<module>_<name>,Y` in assembly
2. [ ] Data section contains matching `__data_<module>_<name>:` label before `!byte` directives
3. [ ] All existing compiler tests pass (`./compiler-test`)
4. [ ] New tests cover @data array label generation
5. [ ] Balloon-sprite example compiles and produces correct assembly
