# Requirements: Bug Fixes

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Fix all known compiler bugs, CLI issues, and design problems documented in `bug-list.md`. Additionally, audit and enable all skipped tests in the test suite.

## Functional Requirements

### Must Have

- [ ] BUG-001: Fix double CMP in comparison codegen — `>` operator must generate correct branch
- [ ] BUG-004: Fix duplicate labels — labels must be unique across all functions in a module
- [ ] BUG-005: Fix CLI `-O1` shorthand — `-O1`, `-Os`, `-Oz` must work without space
- [ ] BUG-007: Fix duplicate `--optimization` crash — must not throw internal error
- [ ] SKIP-AUDIT: All skipped tests enabled and passing (or removed if obsolete)

### Should Have

- [ ] BUG-006: Add optimization level descriptions to CLI help
- [ ] DESIGN-003: Emit `main()` first after BASIC stub (eliminate JMP main)
- [ ] BUG-003: Fix or remove misleading register state comments

### Won't Have (Out of Scope)

- BUG-002: Redundant init optimization (this is an optimizer improvement, not a bug fix)
- DESIGN-001: Safe ZP allocation ranges (requires frame allocator redesign)
- DESIGN-002: CPU-speed dependent delays (user code pattern, not compiler issue)

## Acceptance Criteria

1. [ ] `./packages/cli/bin/blend65.js build ./examples/border-cycle/main.blend` produces valid ASM
2. [ ] `acme -o ./build/main.prg -f cbm ./build/main.asm` assembles without errors
3. [ ] `-O1`, `-Os` CLI shorthand works correctly
4. [ ] Duplicate `--optimization` flags handled gracefully (last-wins)
5. [ ] `main()` function emitted first (no JMP main startup section)
6. [ ] All comparison operators (`>`, `<`, `>=`, `<=`, `==`, `!=`) generate correct code
7. [ ] Labels are unique across all functions in generated ASM
8. [ ] All previously-skipped tests are either enabled+passing or removed
9. [ ] All existing tests still pass (`./compiler-test`)
