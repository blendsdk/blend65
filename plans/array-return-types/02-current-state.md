# Current State: Array Return Types

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Works

**Variable declarations with arrays:**
```js
let buffer: byte[256];        // ✅ Works
let data: byte[] = [1, 2, 3]; // ✅ Works (size inferred)
let matrix: byte[2][3];       // ✅ Works (multidimensional)
```

**Function parameters with arrays:**
```js
function processBuffer(data: byte[], size: byte): void {
  // ✅ Works - parseParameterList() uses parseTypeAnnotation()
}
```

### What Doesn't Work

**Function return types with arrays:**
```js
function getArray(): byte[5] {
  return [1, 2, 3, 4, 5];
}
// ❌ FAILS - 100 cascading parse errors
```

## Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/compiler/src/parser/parser.ts` | Main parser class | **Change return type parsing** |
| `packages/compiler/src/parser/declarations.ts` | `parseTypeAnnotation()` | No changes |
| `packages/compiler/src/__tests__/parser/` | Parser tests | Add new tests |

## Code Analysis

### Current Return Type Parsing (parser.ts lines ~298-314)

```typescript
// Parse optional return type
let returnType: string | null = null;
if (this.match(TokenType.COLON)) {
  // Return type can be a keyword (void, byte, word) or identifier (custom type)
  if (
    this.check(
      TokenType.VOID,
      TokenType.BYTE,
      TokenType.WORD,
      TokenType.BOOLEAN,
      TokenType.STRING,
      TokenType.IDENTIFIER
    )
  ) {
    returnType = this.advance().value;  // ❌ Only gets single token
  } else {
    this.reportError(
      DiagnosticCode.EXPECTED_TOKEN,
      DeclarationParserErrors.expectedReturnType()
    );
  }
}
```

**Problem**: Uses `this.advance().value` which only gets a single token (`byte`), then sees `[5]` and gets confused.

### Working Parameter Type Parsing (parser.ts lines ~370-375)

```typescript
// Use parseTypeAnnotation() to handle full type expressions including arrays
// This enables parameter types like: byte[], word[256], byte[25][40]
const typeAnnotation = this.parseTypeAnnotation();
```

**Solution**: Use the same approach for return types.

### parseTypeAnnotation() Implementation (declarations.ts)

Already fully supports:
- Simple types: `byte`, `word`, `void`, `boolean`, `string`, `callback`, identifiers
- Array types with explicit sizes: `byte[256]`, `word[100]`
- Array types with inferred sizes: `byte[]`, `word[]`
- Multidimensional arrays: `byte[25][40]`, `byte[][]`

## Gap Identified

### Gap 1: Return Type Only Accepts Simple Types

**Current Behavior:** 
When parsing `function f(): byte[5]`, the parser:
1. Matches `:` after `)`
2. Checks for type tokens, finds `byte`
3. Advances and sets `returnType = "byte"`
4. Sees `[5]` - doesn't know what to do
5. Reports error: "Expected '{' after function declaration"
6. Cascading errors follow

**Required Behavior:**
When parsing `function f(): byte[5]`, the parser should:
1. Match `:` after `)`
2. Call `parseTypeAnnotation()`
3. Get `returnType = "byte[5]"` (full type string)
4. Continue to parse function body

**Fix Required:**
Replace simple token check with `parseTypeAnnotation()` call.

## Dependencies

### Internal Dependencies

- `parseTypeAnnotation()` in `declarations.ts` - already implemented
- `FunctionDecl` AST node - accepts string return type, no changes needed
- Type checker - already handles array types

### External Dependencies

None

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing tests | Low | Medium | Run full test suite after change |
| Type checker issues | Very Low | Low | Type checker already handles arrays |
| `void` handling edge case | Low | Low | `parseTypeAnnotation()` handles `void` |