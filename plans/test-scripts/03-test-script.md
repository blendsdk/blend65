# Test Script Specification: compiler-test

> **Document**: 03-test-script.md
> **Parent**: [Index](00-index.md)

## Overview

The `compiler-test` script is a bash script that enables targeted testing of specific compiler components. It provides a simple interface for running tests by component name while always ensuring a clean, consistent build state.

## Architecture

### Script Flow

```
┌─────────────────────────────────────────────────────┐
│                   compiler-test                      │
├─────────────────────────────────────────────────────┤
│  1. clear                                           │
│  2. yarn clean                                      │
│  3. yarn build                                      │
│  4. Check arguments:                                │
│     ├─ No args → yarn test (all tests)             │
│     └─ Args    → yarn vitest run --testPathPattern │
└─────────────────────────────────────────────────────┘
```

### Pattern Matching

Arguments are combined into a regex OR pattern for vitest's `--testPathPattern` flag:

| Input | Pattern Generated | Tests Matched |
|-------|-------------------|---------------|
| `parser` | `parser` | All files with "parser" in path |
| `lexer il` | `lexer\|il` | All files with "lexer" OR "il" |
| `semantic/type` | `semantic/type` | Files in semantic/type* |

## Implementation Details

### Full Script

```bash
#!/bin/bash
#
# compiler-test - Targeted Compiler Test Runner
#
# Usage:
#   ./compiler-test              # Run ALL tests
#   ./compiler-test parser       # Run parser tests only
#   ./compiler-test lexer il     # Run lexer AND il tests
#   ./compiler-test semantic/type  # Run semantic/type* tests
#
# This script always performs clean + build before running tests
# to ensure a consistent test environment.
#

set -e  # Exit on error

# Always start with clean environment
clear && yarn clean && yarn build || {
  echo "Build failed. Cannot run tests."
  exit 1
}

if [ $# -eq 0 ]; then
  # No arguments = run all tests
  echo "Running all tests..."
  yarn test
else
  # Build OR pattern from all arguments
  # e.g., "lexer il" becomes "lexer|il"
  PATTERN=""
  for arg in "$@"; do
    if [ -z "$PATTERN" ]; then
      PATTERN="$arg"
    else
      PATTERN="$PATTERN|$arg"
    fi
  done

  echo "Running tests matching: $PATTERN"
  yarn vitest run --reporter=verbose "$PATTERN"
fi
```

### Key Design Decisions

1. **Always Clean+Build**: Ensures tests run against latest code
2. **Dynamic Patterns**: No hardcoded list, accepts any regex pattern
3. **OR Semantics**: Multiple args = run tests matching ANY pattern
4. **set -e**: Script exits immediately on any command failure

## Code Examples

### Example 1: Run All Tests

```bash
./compiler-test
```

**Behavior:**
1. `clear && yarn clean && yarn build`
2. `yarn test` (runs all 6500+ tests)

### Example 2: Single Component

```bash
./compiler-test parser
```

**Behavior:**
1. `clear && yarn clean && yarn build`
2. `yarn vitest run --testPathPattern="parser"`

**Matches:**
- `packages/compiler/src/__tests__/parser/*.test.ts`
- Any file with "parser" in the path

### Example 3: Multiple Components

```bash
./compiler-test lexer parser ast
```

**Behavior:**
1. `clear && yarn clean && yarn build`
2. `yarn vitest run --testPathPattern="lexer|parser|ast"`

**Matches:**
- All lexer tests
- All parser tests
- All AST tests

### Example 4: Subdirectory Pattern

```bash
./compiler-test semantic/type
```

**Behavior:**
1. `clear && yarn clean && yarn build`
2. `yarn vitest run --testPathPattern="semantic/type"`

**Matches:**
- `semantic/type-checker-*.test.ts`
- `semantic/type-coercion.test.ts`
- `semantic/type-resolver.test.ts`
- `semantic/type-system.test.ts`

## Error Handling

| Error | Handling |
|-------|----------|
| Build fails | Script exits with error, tests not run |
| No matching tests | Vitest reports "0 tests", script succeeds |
| Invalid regex | Vitest handles gracefully |

## Testing Requirements

### Unit Tests

Not applicable - bash script tested manually.

### Manual Testing Checklist

- [ ] `./compiler-test` runs all tests
- [ ] `./compiler-test parser` runs parser tests only
- [ ] `./compiler-test lexer il` runs both lexer and il tests
- [ ] `./compiler-test nonexistent` reports 0 tests
- [ ] Script exits if build fails