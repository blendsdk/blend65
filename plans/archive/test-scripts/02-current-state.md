# Current State: Test Scripts Enhancement

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

**Current Test Setup:**
- `test-all.sh` - Simple script that runs all tests
- `vitest.config.ts` - Vitest configuration with custom reporter
- `yarn test` - Runs all tests via vitest
- 6500+ tests across 15 test directories

**Current test-all.sh:**
```bash
#!/bin/bash
reset && \
clear && \
yarn clean && \
yarn build && \
yarn test
```

### Test Directory Structure

```
packages/compiler/src/__tests__/
├── asm-il/          # Assembly IL layer tests
├── ast/             # AST type guards & walker tests
├── codegen/         # Code generation tests
├── config/          # Configuration tests
├── debug/           # Debug utility tests
├── e2e/             # End-to-end tests
├── il/              # IL generator tests (largest)
├── integration/     # Integration tests
├── lexer/           # Lexer/tokenization tests
├── library/         # Library loader tests
├── optimizer/       # Optimization pass tests
├── parser/          # Parser tests
├── pipeline/        # Full pipeline tests
├── semantic/        # Semantic analyzer tests
└── target/          # Target architecture tests
```

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `test-all.sh` | Current test runner | Keep as-is (backward compat) |
| `vitest.config.ts` | Test configuration | No changes needed |
| `.clinerules/agents.md` | AI agent rules | Add testing.md reference |
| `.clinerules/project.md` | Project rules | Add testing.md reference |
| `.clinerules/code.md` | Coding standards | Add testing.md reference |

### Vitest Configuration

```typescript
// vitest.config.ts - relevant portions
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'build', '.turbo'],
    reporters: [__dirname + '/scripts/vitest.reporter.cline.ts'],
    typecheck: { enabled: true },
  },
});
```

**Key Points:**
- Vitest supports `--testPathPattern` flag for filtering tests
- Custom reporter exists for AI-friendly output
- No special filtering currently in place

## Gaps Identified

### Gap 1: No Targeted Testing

**Current Behavior:** Must run all 6500+ tests every time
**Required Behavior:** Run specific component tests via command line
**Fix Required:** New `compiler-test` script with pattern filtering

### Gap 2: No Testing Rules for AI

**Current Behavior:** Testing rules scattered across multiple `.clinerules` files
**Required Behavior:** Centralized testing rules in `testing.md`
**Fix Required:** Create `.clinerules/testing.md` and update references

### Gap 3: Inconsistent Rule References

**Current Behavior:** Each file has inline testing rules
**Required Behavior:** All files reference single source of truth (`testing.md`)
**Fix Required:** Update agents.md, project.md, code.md

## Dependencies

### Internal Dependencies

- Vitest test framework (already installed)
- Existing test structure (already organized by component)
- `.clinerules` infrastructure (already exists)

### External Dependencies

- bash (macOS default shell)
- yarn (already in use)

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Pattern not matching intended tests | Low | Medium | Provide clear examples in testing.md |
| Build failures blocking tests | Medium | Low | Always clean+build ensures consistent state |
| AI not following new rules | Medium | Medium | Update ALL clinerules to reference testing.md |