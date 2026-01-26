# Requirements: Test Scripts Enhancement

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Create an enhanced test runner script that enables targeted testing of specific compiler components, reducing test execution time during development. Additionally, establish comprehensive testing rules in `.clinerules/` for AI agent compliance.

## Functional Requirements

### Must Have

- [ ] **R1**: New `compiler-test` script that accepts component names as arguments
- [ ] **R2**: Script runs all tests when no arguments provided
- [ ] **R3**: Script accepts multiple component arguments (e.g., `lexer il parser`)
- [ ] **R4**: Script always runs `clear && yarn clean && yarn build` before testing
- [ ] **R5**: Dynamic pattern matching - no hardcoded component list
- [ ] **R6**: New `.clinerules/testing.md` file with testing rules for AI
- [ ] **R7**: Update `agents.md` to reference `testing.md`
- [ ] **R8**: Update `project.md` to reference `testing.md`
- [ ] **R9**: Update `code.md` to reference `testing.md`

### Should Have

- [ ] **R10**: Helpful usage message when invalid arguments provided
- [ ] **R11**: Support for partial path matching (e.g., `semantic/type`)
- [ ] **R12**: Clear examples in testing.md for common scenarios

### Won't Have (Out of Scope)

- Watch mode (can use `yarn vitest` directly for that)
- Coverage reports per component (use full test run for coverage)
- Test parallelization configuration
- Component dependency tracking

## Technical Requirements

### Performance

- Script should not add significant overhead beyond clean/build time
- Pattern matching should not slow down test discovery

### Compatibility

- Script must work on macOS (bash)
- Must integrate with existing vitest configuration
- Must follow existing `.clinerules` conventions

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Component list | Static list vs Dynamic | Dynamic | More flexible, accepts any pattern |
| Build behavior | Optional build vs Always | Always | Ensures consistent test environment |
| Script name | test.sh, run-tests, compiler-test | compiler-test | Clear purpose, distinguishes from test-all.sh |

## Acceptance Criteria

1. [ ] `./compiler-test` runs all tests after clean/build
2. [ ] `./compiler-test parser` runs only parser tests after clean/build
3. [ ] `./compiler-test lexer il` runs lexer and IL tests after clean/build
4. [ ] `.clinerules/testing.md` exists with comprehensive rules
5. [ ] All referenced `.clinerules` files updated with testing.md references
6. [ ] All tests pass after implementation