# Testing Standards & Rules

## **IMPORTANT**

These rules are **mandatory** and must be applied **strictly and consistently** when working on this project.

---

## **Rule 1: Use compiler-test Script**

**ALWAYS use the `compiler-test` script for running tests.**

### Basic Usage

| Command | Description |
|---------|-------------|
| `./compiler-test` | Run ALL tests (6500+) |
| `./compiler-test <component>` | Run tests for specific component |
| `./compiler-test <comp1> <comp2>` | Run tests for multiple components |

### Examples

```bash
# Run all tests (full test suite)
./compiler-test

# Run only parser tests
./compiler-test parser

# Run lexer and IL tests
./compiler-test lexer il

# Run specific test category
./compiler-test semantic/type
```

---

## **Rule 2: When to Use Targeted vs Full Tests**

### Use Targeted Tests When:

- ✅ Working on a specific component (lexer, parser, etc.)
- ✅ Quick iteration during development
- ✅ Debugging a failing test in one area
- ✅ Time-constrained changes to one module

### Use Full Tests When:

- ✅ Before completing any task (`attempt_completion`)
- ✅ Before any git commit
- ✅ After refactoring that may affect multiple components
- ✅ When changes could have cross-cutting concerns
- ✅ Final verification of any implementation

**CRITICAL:** Always run `./compiler-test` (all tests) before marking a task complete!

---

## **Rule 3: Test Components Reference**

Available test directories/components:

| Component | Directory | Description |
|-----------|-----------|-------------|
| `lexer` | `__tests__/lexer/` | Tokenization tests |
| `parser` | `__tests__/parser/` | Parsing tests |
| `ast` | `__tests__/ast/` | AST utilities |
| `semantic` | `__tests__/semantic/` | Semantic analysis |
| `il` | `__tests__/il/` | IL generator |
| `asm-il` | `__tests__/asm-il/` | Assembly IL layer |
| `codegen` | `__tests__/codegen/` | Code generation |
| `optimizer` | `__tests__/optimizer/` | Optimizations |
| `pipeline` | `__tests__/pipeline/` | Full pipeline |
| `config` | `__tests__/config/` | Configuration |
| `library` | `__tests__/library/` | Library loading |
| `target` | `__tests__/target/` | Target arch |
| `integration` | `__tests__/integration/` | Integration tests |
| `e2e` | `__tests__/e2e/` | End-to-end tests |

---

## **Rule 4: Test Script Behavior**

The `compiler-test` script **ALWAYS**:

1. Clears the terminal (`clear`)
2. Cleans build artifacts (`yarn clean`)
3. Builds the project (`yarn build`)
4. Runs specified tests

**This ensures tests always run against fresh, consistent builds.**

---

## **Rule 5: Test Coverage Requirements**

When implementing new features:

1. **Unit Tests**: Required for all new functions/methods
2. **Integration Tests**: Required for component interactions
3. **End-to-End Tests**: Required for complete workflows

Refer to `code.md` Rules 4-8 for detailed testing standards.

---

## **Rule 6: Test-Driven Development Workflow**

**Recommended workflow for AI agents:**

1. **Understand** the change needed
2. **Write/update tests first** (if adding functionality)
3. **Run targeted tests** during development: `./compiler-test <component>`
4. **Implement the change**
5. **Verify targeted tests pass**
6. **Run full test suite** before completion: `./compiler-test`
7. **Only then** call `attempt_completion`

---

## **Rule 7: Common Testing Patterns**

### Frontend Changes (lexer/parser)

```bash
# Quick iteration
./compiler-test lexer
./compiler-test parser

# Before commit - include AST too
./compiler-test lexer parser ast
```

### Semantic Analysis Changes

```bash
# Quick iteration
./compiler-test semantic

# Before commit - include dependent components
./compiler-test semantic il
```

### Code Generation Changes

```bash
# Quick iteration  
./compiler-test codegen

# Before commit - include full pipeline
./compiler-test il asm-il codegen pipeline
```

### Full Compiler Changes

```bash
# Always run all tests for cross-cutting changes
./compiler-test
```

---

## **Rule 8: Debugging Test Failures**

When tests fail:

1. **Read the error message** - Vitest provides clear output
2. **Isolate the failure** - Use targeted tests: `./compiler-test <component>`
3. **Check related tests** - Failures may indicate broader issues
4. **Fix and verify** - Run targeted tests until passing
5. **Full verification** - Run `./compiler-test` before completing

---

## **Summary**

| Situation | Command |
|-----------|---------|
| Quick dev iteration | `./compiler-test <component>` |
| Before task completion | `./compiler-test` |
| Before git commit | `./compiler-test` |
| Debugging specific area | `./compiler-test <component>` |
| Cross-cutting changes | `./compiler-test` |

**Remember:** The `compiler-test` script handles clean+build automatically. Never run `yarn test` directly - always use `./compiler-test`.

---

## **Cross-References**

- See **code.md** for testing standards (Rules 4-8)
- See **agents.md** for shell command rules
- See **project.md** for project configuration