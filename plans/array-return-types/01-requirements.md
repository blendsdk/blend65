# Requirements: Array Return Types

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Enable functions to declare array types as their return type, consistent with how arrays are already supported in variable declarations and function parameters.

## Functional Requirements

### Must Have

- [x] Parse function declarations with array return types: `function f(): byte[5]`
- [x] Support explicit array sizes: `byte[10]`, `word[256]`
- [x] Support inferred array sizes: `byte[]`, `word[]`
- [x] Support multidimensional arrays: `byte[2][3]`, `byte[][]`
- [x] Maintain backwards compatibility with simple return types

### Should Have

- [ ] Clear error messages for malformed array return types
- [ ] Consistent behavior with parameter array types

### Won't Have (Out of Scope)

- Type checking for array return statements (already implemented in type checker)
- Code generation for array returns (separate feature)
- Runtime array bounds checking

## Technical Requirements

### Parser Change

The parser's `parseFunctionDecl()` method must accept full type expressions (not just simple type tokens) for return types.

### Compatibility

- Existing function declarations must continue to work
- Simple return types (`byte`, `word`, `void`, `boolean`, `string`) unchanged
- Custom type returns (identifiers) unchanged

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Implementation | New code vs reuse | Reuse `parseTypeAnnotation()` | Already handles all array type forms correctly |
| Type checking | Add new checks | No changes | Type checker already handles array types |

## Acceptance Criteria

1. [x] `function f(): byte[5]` parses without errors
2. [x] `function f(): byte[]` parses without errors
3. [x] `function f(): byte[2][3]` parses without errors
4. [x] Existing simple return types still work
5. [x] All parser tests pass
6. [x] No regressions in existing tests