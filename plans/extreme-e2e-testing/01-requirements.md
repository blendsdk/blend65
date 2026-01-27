# Requirements: Extreme E2E Testing Infrastructure

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Create a comprehensive, fixture-based end-to-end testing system that verifies the Blend65 compiler works correctly across all possible code patterns, combinations, and edge cases. This is critical for release confidence.

## Functional Requirements

### Must Have

- [ ] **Fixture directory structure** - Organized by compiler phase and category
- [ ] **Metadata format** - Standard comment format for fixture metadata
- [ ] **Test runner** - Automated execution of all fixtures with reporting
- [ ] **350+ diverse fixtures** - Covering all language features
- [ ] **Complex real-world programs** - Not just simple one-liners
- [ ] **Regression tracking** - Capture and verify bug fixes
- [ ] **Success/failure validation** - Verify expected outcomes
- [ ] **Output verification** - Check generated assembly when needed

### Should Have

- [ ] **Fixture generator** - Script to generate combinatorial fixtures
- [ ] **Coverage tracking** - Identify which language features are tested
- [ ] **Performance benchmarks** - Track compilation time of fixtures
- [ ] **VICE integration tests** - Actually run compiled programs

### Won't Have (Out of Scope)

- Hardware-in-the-loop testing (actual C64 execution)
- Visual verification of output
- Cross-platform testing (focus on macOS dev environment)

## Technical Requirements

### Fixture Format

Every `.blend` fixture MUST include metadata comments:

```js
// @fixture: category/subcategory/name
// @category: lexer|parser|semantic|il|optimizer|codegen|integration|error
// @description: Human-readable description of what this tests
// @expect: success|error|warning
// @error-code: S001 (if @expect: error)
// @output-check: pattern to find in assembly output (optional)
// @skip: reason (optional - for known issues)

module TestModule;
// ... test code ...
```

### Directory Structure

```
fixtures/
├── 01-lexer/
├── 02-parser/
├── 03-semantic/
├── 04-il-generator/
├── 05-optimizer/
├── 06-codegen/
├── 10-integration/
├── 20-edge-cases/
├── 30-error-cases/
└── 99-regressions/
```

### Test Runner Requirements

1. **Auto-discovery**: Find all `.blend` files in `fixtures/`
2. **Parallel execution**: Run fixtures concurrently for speed
3. **Metadata parsing**: Extract and validate fixture metadata
4. **Outcome validation**: Check success/failure matches @expect
5. **Output verification**: If @output-check specified, verify assembly
6. **Reporting**: Clear pass/fail summary with failure details
7. **CI integration**: Return proper exit codes

## Complexity Requirements

### NOT Acceptable (Too Simple)

```js
// ❌ One-liner hello world - doesn't test anything meaningful
let x: byte = 5;
```

### REQUIRED (Realistic Complexity)

```js
// ✅ Real program with multiple features interacting
module SpriteManager;

import { poke, pokew, peek, lo, hi } from system;

@map VIC_SPRITE_X at $D000: byte[16];
@map VIC_SPRITE_Y at $D001: byte[16];

let spritePositions: word[8] = [0, 0, 0, 0, 0, 0, 0, 0];

export function moveSprite(id: byte, dx: byte, dy: byte): void {
    let idx: byte = id * 2;
    let currentX: word = spritePositions[id];
    let newX: word = currentX + dx;
    
    if (newX > 320) {
        newX = 320;
    }
    
    VIC_SPRITE_X[idx] = lo(newX);
    spritePositions[id] = newX;
    
    // Update MSB if needed
    // ... more complex logic ...
}
```

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Fixture location | `fixtures/` vs `__tests__/fixtures/` | `fixtures/` at root | Easier access, visible in project |
| Metadata format | JSON, YAML, comments | Comments | No parsing dependency, IDE-friendly |
| Test runner | Separate script, vitest, jest | Vitest integration | Consistent with existing tests |
| Minimum fixtures | 100, 200, 350+ | 350+ | Need comprehensive coverage |

## Acceptance Criteria

1. ✅ All 350+ fixtures are created and categorized
2. ✅ Test runner discovers and executes all fixtures
3. ✅ 100% pass rate for success fixtures
4. ✅ Error fixtures correctly report expected errors
5. ✅ Real-world program fixtures compile and produce valid output
6. ✅ CI pipeline runs fixture tests on every commit
7. ✅ Regression fixtures prevent reintroduction of fixed bugs
8. ✅ Documentation explains how to add new fixtures