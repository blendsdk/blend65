# Blend65 E2E Test Fixtures

This directory contains end-to-end test fixtures for the Blend65 compiler. Each fixture is a complete Blend source file with metadata annotations that define expected compilation behavior.

## Directory Structure

```
fixtures/
├── 01-lexer/          # Lexer/tokenization tests
├── 02-parser/         # Parser/AST construction tests
├── 03-semantic/       # Semantic analysis/type checking tests
├── 04-il-generator/   # IL generation tests
├── 05-optimizer/      # Optimizer transformation tests
├── 06-codegen/        # Code generation tests
├── 10-integration/    # Full pipeline integration tests
├── 20-edge-cases/     # Edge case and boundary value tests
├── 30-error-cases/    # Error handling validation tests
└── 99-regressions/    # Regression tests for fixed bugs
```

## Fixture Format

Every fixture file **MUST** include metadata annotations at the top of the file using special comment syntax.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `@fixture` | string | Unique fixture identifier (path-like format) |
| `@category` | enum | Category: lexer, parser, semantic, il-generator, optimizer, codegen, integration, edge-cases, error-cases, regressions |
| `@description` | string | Human-readable description of what this fixture tests |
| `@expect` | enum | Expected outcome: success, error, warning |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `@error-code` | string | Expected error code (required if @expect: error) |
| `@error-message` | string | Expected error message substring |
| `@output-check` | string | Generic output check: `Contains "pattern"` |
| `@output-contains` | string | Shorthand for checking assembly contains pattern |
| `@output-not-contains` | string | Shorthand for checking assembly does NOT contain pattern |
| `@output-matches` | string | Regex pattern to match in assembly output |
| `@skip` | string | Reason to skip this test |
| `@tags` | string | Comma-separated tags for filtering |
| `@dependencies` | string | Comma-separated list of dependent fixtures/modules |
| `@min-opt-level` | number | Minimum optimization level required |
| `@max-opt-level` | number | Maximum optimization level this test is valid for |

### Example Fixture

```js
// @fixture: integration/real-programs/sprite-movement
// @category: integration
// @description: Tests sprite movement with VIC-II hardware access
// @expect: success
// @output-contains: STA $D000
// @tags: hardware, sprite, vic-ii

module SpriteMovement;

// Memory-mapped VIC-II sprite position
@map spriteX at $D000: byte;
@map spriteY at $D001: byte;

// Move sprite to position
function moveSprite(x: byte, y: byte): void {
    spriteX = x;
    spriteY = y;
}

// Main entry point
function main(): void {
    moveSprite(100, 150);
}
```

## Metadata Syntax

### Basic Format
```js
// @field: value
```

### Multi-line Values
```js
// @description: This is a long description
//               that spans multiple lines
//               and contains important details
```

### Output Checks

**Contains check (assembly must include pattern):**
```js
// @output-contains: LDA #$00
```

**Not-contains check (assembly must NOT include pattern):**
```js
// @output-not-contains: dead_code_label
```

**Regex match:**
```js
// @output-matches: STA\s+\$D0[0-9]{2}
```

**Generic format:**
```js
// @output-check: Contains "STA $D020"
```

## Categories Explained

### 01-lexer
Tests for the lexer/tokenizer. Validates that source code is correctly tokenized.
- Number formats (decimal, hex, binary)
- String literals and escape sequences
- Operators and punctuation
- Comments

### 02-parser
Tests for the parser. Validates AST construction.
- Expression parsing (unary, binary, precedence)
- Statement parsing (if, for, while)
- Declaration parsing (variables, functions, @map)
- Module parsing (imports, exports)

### 03-semantic
Tests for semantic analysis. Validates type checking and symbol resolution.
- Type checking (byte, word, arrays)
- Scope resolution
- Symbol table management

### 04-il-generator
Tests for IL (Intermediate Language) generation.
- Basic block construction
- Control flow graph generation
- Intrinsic function handling

### 05-optimizer
Tests for optimization passes.
- Dead code elimination
- Constant folding
- Peephole optimizations

### 06-codegen
Tests for 6502 code generation.
- Addressing modes
- Register allocation
- Instruction selection

### 10-integration
Full pipeline tests with realistic programs.
- Real-world program patterns
- Multi-module projects
- Standard library usage

### 20-edge-cases
Boundary conditions and edge cases.
- Maximum values
- Deeply nested structures
- Large files

### 30-error-cases
Tests that should produce errors.
- Syntax errors
- Type errors
- Semantic errors

### 99-regressions
Tests for bugs that have been fixed.
- Named after issue number or description
- Ensures bugs don't reappear

## Running Fixture Tests

```bash
# Run all fixture tests
./compiler-test e2e

# Run fixture tests with verbose output
./compiler-test e2e --verbose
```

## Adding New Fixtures

1. Create a new `.blend` file in the appropriate category directory
2. Add required metadata annotations at the top
3. Write the test code
4. Run tests to verify the fixture works

### Checklist for New Fixtures

- [ ] `@fixture` has unique identifier
- [ ] `@category` matches directory
- [ ] `@description` clearly explains what is tested
- [ ] `@expect` is set correctly
- [ ] For error cases: `@error-code` is specified
- [ ] Code is minimal but complete
- [ ] Output checks verify expected behavior

## Fixture Validation

The test runner validates fixtures before execution:

1. **Metadata validation** - All required fields present
2. **Category validation** - Category matches directory structure
3. **Compilation** - Fixture compiles (or fails as expected)
4. **Output validation** - Assembly output matches checks

Invalid fixtures will be reported with clear error messages.