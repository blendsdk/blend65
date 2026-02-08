# Requirements: IL & IL-Optimizer Extreme Testing

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Create a comprehensive, production-grade testing suite for the IL Generator and IL Optimizer components that goes beyond simple unit tests to include real-world patterns, stress tests, complex combinations, and edge cases.

The goal is to achieve "god-level" confidence in these critical compiler components before proceeding to code generation.

## Functional Requirements

### Must Have

#### IL Generator Tests
- [ ] Real-world C64 game development patterns (7 categories)
- [ ] Stress tests for scale limits (deep nesting, many functions, many variables, large programs)
- [ ] Complex combinations (nested loops with calls, expression trees, control flow matrix)
- [ ] Edge cases for numeric boundaries, arrays, break/continue, operators

#### IL Optimizer Tests
- [ ] Real-world optimization scenarios matching C64 patterns
- [ ] Stress tests for optimizer limits (large functions, many passes, many opportunities)
- [ ] Correctness tests ensuring optimizer doesn't break semantics
- [ ] Edge cases for boundary values, degenerate code, pass interactions

#### Shared Infrastructure
- [ ] Shared test helper utilities for IL verification
- [ ] Shared test helper utilities for optimizer verification
- [ ] Consistent test patterns matching existing semantic tests

### Should Have

- [ ] Comprehensive test descriptions and documentation
- [ ] Clear categorization enabling targeted test runs
- [ ] Performance benchmarks for stress tests

### Won't Have (Out of Scope)

- Golden file tests (user doesn't have pre-verified IL output)
- Changes to IL Generator implementation
- Changes to IL Optimizer implementation
- New IL opcodes or optimizer passes
- Documentation updates outside test files
- Benchmark/performance regression suite

## Technical Requirements

### Test Structure

Each test file should:
- Follow existing patterns from `semantic/e2e/real-world/`
- Contain 5-10 focused tests (AI context friendly)
- Test one logical category/pattern
- Use shared helper utilities
- Include clear, descriptive test names

### Test Verification

Tests must verify:
1. **IL Generator**: Correct IL opcodes generated for source patterns
2. **IL Optimizer**: Correct transformations without semantic changes
3. **Edge Cases**: Proper handling of boundary conditions
4. **Stress Tests**: Successful completion within reasonable time

### Performance

- All tests should complete within 60 seconds total
- Individual test files should complete within 5 seconds
- Stress tests may take up to 10 seconds per file

### Compatibility

- Must work with existing Vitest test infrastructure
- Must integrate with `./compiler-test` script
- Must follow existing test naming conventions

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
| -------- | ------------------ | ------ | --------- |
| Test granularity | 5-10 or 10-20 tests/file | 5-10 | Smaller files = easier AI context |
| Helper utilities | Per-file or shared | Shared | Reduces duplication |
| Validation | Snapshot or opcode | Opcode | More explicit, easier to debug |
| Plan structure | Per-phase or master | Master | Single reference point |

## Acceptance Criteria

### Phase Completion Criteria

1. [ ] All IL Generator test files created and passing
2. [ ] All IL Optimizer test files created and passing
3. [ ] Shared helper utilities created and working
4. [ ] No regressions in existing 5000+ tests
5. [ ] All new tests follow established patterns

### Quality Criteria

1. [ ] Each test file has clear purpose documented
2. [ ] Tests are focused and specific
3. [ ] Edge cases cover boundary conditions
4. [ ] Stress tests verify scale limits
5. [ ] Real-world tests reflect actual C64 patterns

### Success Metrics

| Metric | Target |
|--------|--------|
| New IL Generator tests | ~325 |
| New IL Optimizer tests | ~325 |
| Test files created | 44 |
| All tests passing | 100% |
| Test run time | < 60 seconds |