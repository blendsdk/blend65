# Fixture Structure: Extreme E2E Testing Infrastructure

> **Document**: 03-fixture-structure.md
> **Parent**: [Index](00-index.md)

## Directory Layout

```
fixtures/
├── README.md                          # Documentation
├── 01-lexer/
│   ├── numbers/
│   │   ├── decimal-literals.blend
│   │   ├── hex-formats.blend
│   │   ├── binary-numbers.blend
│   │   └── max-values.blend
│   ├── strings/
│   │   ├── basic-strings.blend
│   │   ├── escape-sequences.blend
│   │   └── edge-cases.blend
│   ├── operators/
│   │   └── all-operators.blend
│   └── comments/
│       └── comment-styles.blend
│
├── 02-parser/
│   ├── expressions/
│   │   ├── unary/
│   │   ├── binary/
│   │   ├── precedence/
│   │   ├── deeply-nested/
│   │   └── combinations/
│   ├── statements/
│   │   ├── if-else/
│   │   ├── for-loops/
│   │   ├── while-loops/
│   │   └── nested-control/
│   ├── declarations/
│   │   ├── variables/
│   │   ├── arrays/
│   │   ├── map-declarations/
│   │   └── functions/
│   └── modules/
│       ├── imports/
│       └── exports/
│
├── 03-semantic/
│   ├── type-checking/
│   │   ├── byte-word-types.blend
│   │   ├── array-types.blend
│   │   └── function-types.blend
│   ├── scopes/
│   │   ├── global-scope.blend
│   │   ├── function-scope.blend
│   │   └── block-scope.blend
│   └── symbol-resolution/
│       ├── forward-refs.blend
│       └── imports.blend
│
├── 04-il-generator/
│   ├── basic-blocks/
│   ├── control-flow/
│   ├── intrinsics/
│   └── memory-operations/
│
├── 05-optimizer/
│   ├── dead-code/
│   ├── constant-folding/
│   ├── peephole/
│   └── cfg-simplification/
│
├── 06-codegen/
│   ├── addressing-modes/
│   ├── register-usage/
│   ├── instruction-selection/
│   └── output-formats/
│
├── 10-integration/
│   ├── real-programs/
│   │   ├── sprite-movement.blend
│   │   ├── screen-draw.blend
│   │   ├── game-loop.blend
│   │   └── score-system.blend
│   ├── multi-module/
│   │   ├── simple-import.blend
│   │   └── library-style.blend
│   └── standard-library/
│       ├── system-intrinsics.blend
│       └── hardware-access.blend
│
├── 20-edge-cases/
│   ├── boundary-values/
│   ├── deeply-nested/
│   ├── large-files/
│   └── complex-cfgs/
│
├── 30-error-cases/
│   ├── lexer-errors/
│   ├── parser-errors/
│   ├── type-errors/
│   └── semantic-errors/
│
└── 99-regressions/
    └── issue-001-dominator-warning.blend
```

## Naming Conventions

### Files

- Use kebab-case: `sprite-movement.blend`
- Be descriptive: `deeply-nested-arithmetic.blend`
- Include category context when needed

### Directories

- Numbered prefixes for ordering: `01-lexer/`, `02-parser/`
- Subcategories lowercase: `expressions/`, `statements/`

## Metadata Format

Every fixture MUST include metadata comments at the top:

```js
// @fixture: integration/real-programs/sprite-movement
// @category: integration
// @description: Tests sprite movement with VIC-II hardware access
// @expect: success
// @output-check: Contains "STA $D000"

module SpriteMovement;
// ... implementation ...
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `@fixture` | string | Unique fixture identifier (path-like) |
| `@category` | enum | lexer, parser, semantic, il, optimizer, codegen, integration, error |
| `@description` | string | Human-readable description |
| `@expect` | enum | success, error, warning |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `@error-code` | string | Expected error code (if @expect: error) |
| `@output-check` | string | Pattern to verify in assembly output |
| `@skip` | string | Reason to skip this test |
| `@tags` | string[] | Additional categorization tags |