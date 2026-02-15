# Current State: Sprite Function Codegen Bugs

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The compiler pipeline (Lexer → Parser → SFA → IL Generator → Codegen) is fully functional
for many use cases. The `@sprite` storage class, `lo()` intrinsic, and `@` address-of operator
all work correctly in **inline expressions** like `lo(@spriteData / 64)`.

The problem arises when these features are used **inside function calls and function bodies**,
where the IL generator makes incorrect assumptions about type widths.

### Root Cause: No Type Annotation Pass

**Critical finding**: `setTypeInfo()` is never called in production code — only in test files.
This means `expr.getTypeInfo()` always returns `undefined`, and `isWordTyped()` always
returns `false`. The IL generator relies on type info for byte-vs-word decisions, but that
info is never populated.

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/compiler/src/il/generator/expressions.ts` | Expression IL generation | Bug #1 + Bug #2 fixes |
| `packages/compiler/src/il/generator/control-flow.ts` | Loop/branch IL generation | Bug #3 fix |
| `examples/spinning-line/main.blend` | Sprite animation demo | Rewrite to multi-frame |
| `examples/spinning-line/README.md` | Example documentation | Update |

## Bug Details

### Bug #1: Address-of Argument Promotion Destroys High Byte

**Location**: `generateCallArguments()` in `expressions.ts` (~line 660)

**What happens**:
1. Caller evaluates `@lineFrames` → `LOAD_ADDRESS` emits `LDA #<label / LDX #>label` (correct A:X word)
2. `generateCallArguments()` checks if argument needs promotion to word for the target parameter
3. It calls `!this.isWordTyped(args[0])` → always `true` (no type info available)
4. Emits `PROMOTE_BYTE_WORD` → `LDX #$00` → **overwrites the valid high byte from LOAD_ADDRESS!**

**Assembly evidence**:
```asm
LDA #<lineFrames    ; low byte of address → A ✓
LDX #>lineFrames    ; high byte of address → X ✓
LDX #$00            ; promote byte→word → DESTROYS X! ✗
```

**Current code** (simplified):
```typescript
if (firstParam && firstParam.size === 2 && !this.isWordTyped(args[0])) {
    // BUG: fires for @variable which already produced A:X via LOAD_ADDRESS
    this.builder.promoteByteWord(`arg byte→word for ${funcName}`);
}
```

### Bug #2: Word Division Falls Through to 8-bit `__div8`

**Location**: `generateBinary()` and `generateBinaryWordImmediate()` in `expressions.ts`

**What happens**:
1. Inside `getSpriteFrame()`, expression `spriteAddr / 64` where spriteAddr is a word parameter
2. `generateBinary()` checks `resultType?.kind === TypeKind.Word` → `false` (no type info)
3. Falls to byte path → `divImm(64)` → 8-bit `__div8` — only uses low byte of address!
4. Even if it reached the word path, `generateBinaryWordImmediate()` has no DIVIDE case — falls to `default: nop()`

**Code path** (simplified):
```typescript
// In generateBinary():
if (resultType?.kind === TypeKind.Word) {
    // Word path — never reached because resultType is undefined
    this.generateBinaryWordImmediate(op, value);
} else {
    // Byte path — always taken
    this.divImm(value); // 8-bit division only!
}

// In generateBinaryWordImmediate():
switch (op) {
    case TokenType.PLUS: /* handled */ break;
    case TokenType.MINUS: /* handled */ break;
    // ... no DIVIDE case!
    default:
        this.builder.nop(); // DIVIDE falls here!
}
```

### Bug #3: For-Loop Byte Overflow at 255

**Location**: `generateForCondition()` in `control-flow.ts`

**What happens**:
1. Ascending byte loop: `for (let i: byte = 0 to 255)`
2. Exit condition generates: `CMP #(constEnd + 1)` where constEnd=255
3. `255 + 1 = 256` → overflows 8-bit immediate → `CMP #$00` or assembler error

**Code**:
```typescript
if (isAscending) {
    if (isWord) {
        this.builder.cmpWordImm(constEnd + 1, `cmp word with end+1`);
    } else {
        this.builder.cmpImm(constEnd + 1, `cmp with end+1`); // 255+1=256 overflows!
    }
    this.builder.jumpGe(exitLabel, 'exit if i > end');
}
```

## What Works Currently

The spinning-line example currently uses an **inline workaround**:

```js
// This works because tryGenerateAddressExpr() detects @var/const pattern
poke(SPRITE0_POINTER, lo(@lineVertical / 64));
```

The `tryGenerateAddressExpr()` method in `expressions.ts` has a special optimization that
detects `@variable / constant` and emits assembly-time label math directly. This bypasses
both Bug #1 and Bug #2. But it only works for inline expressions, not function arguments.

## Dependencies

### Internal Dependencies

- Bug #1 fix must not break existing function call patterns
- Bug #2 fix must not break existing byte-width binary operations
- Bug #3 fix must not break existing for-loops with end < 255

### External Dependencies

- None — all fixes are in the IL generator

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bug #1 fix breaks other arg promotions | Medium | High | Careful pattern matching; only skip promotion for UnaryExpression(AT) |
| Bug #2 fix creates wrong word ops for byte values | Medium | High | Use slot-size inference, not just operator type |
| Bug #3 fix causes infinite loop | Low | High | Test boundary: end=254 (normal), end=255 (special), end=0 (edge) |
| Regressions in existing tests | Medium | Medium | Run full `./compiler-test` after each fix |
