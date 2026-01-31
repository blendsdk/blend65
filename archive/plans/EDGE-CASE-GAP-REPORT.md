# Edge Case Gap Report

> **Generated**: 2025-01-31
> **Audit Scope**: Language Specification v2 vs Semantic Analyzer Tests
> **Current Tests**: 2802 passing
> **Purpose**: Identify edge cases not covered by existing tests

## Executive Summary

After auditing the language specification (docs/language-specification-v2/) against the existing semantic analyzer tests (2802 tests), the following edge case gaps were identified. These gaps represent areas where the specification defines behavior but tests don't explicitly verify boundary conditions.

**Priority Levels:**
- 🔴 **Critical** - Core language semantics, likely to cause bugs
- 🟡 **High** - Important edge cases, should be tested
- 🟢 **Medium** - Nice to have, improves confidence
- ⚪ **Low** - Minor, can be deferred

---

## Gap Analysis by Specification Section

### 1. Lexical Structure (01-lexical-structure.md)

**Existing Coverage:** Lexer tests cover basic tokenization well.

**Gaps Identified:**

| Gap | Priority | Description | Spec Reference |
|-----|----------|-------------|----------------|
| Empty hex literal | 🟡 High | `$` or `0x` without digits | Numeric Literals |
| Empty binary literal | 🟡 High | `0b` without digits | Numeric Literals |
| Maximum length identifier | 🟢 Medium | Very long identifiers | Identifiers |
| Keywords as identifiers | 🟡 High | `let`, `if`, etc. in wrong context | Keywords |
| Unterminated string at EOF | 🟡 High | `"hello` without closing quote | String Literals |
| Escape sequence edge cases | 🟢 Medium | `\\` at end of string | Escape Sequences |

**Status:** ⚪ Mostly covered at lexer level, some edge cases missing.

---

### 2. Types (02-types.md)

**Existing Coverage:** Good type system tests, but boundary values not explicitly tested.

**Gaps Identified:**

| Gap | Priority | Description | Spec Reference |
|-----|----------|-------------|----------------|
| byte minimum (0) | 🔴 Critical | `let x: byte = 0;` | Primitive Types |
| byte maximum (255) | 🔴 Critical | `let x: byte = 255;` | Primitive Types |
| byte overflow (256) | 🔴 Critical | `let x: byte = 256;` should error | Primitive Types |
| byte negative (-1) | 🔴 Critical | `let x: byte = -1;` should error | Primitive Types |
| word minimum (0) | 🔴 Critical | `let x: word = 0;` | Primitive Types |
| word maximum (65535) | 🔴 Critical | `let x: word = 65535;` | Primitive Types |
| word overflow (65536) | 🔴 Critical | `let x: word = 65536;` should error | Primitive Types |
| byte + byte overflow | 🔴 Critical | `255 + 1` wrapping behavior | Arithmetic |
| word + word overflow | 🔴 Critical | `65535 + 1` wrapping behavior | Arithmetic |
| byte * byte promotion | 🟡 High | `255 * 255` should promote to word | Arithmetic |
| Type alias equivalence | 🟢 Medium | `@address` fully interchangeable with `word` | Type Aliases |
| Empty array (size 0) | 🟡 High | `let arr: byte[0] = [];` | Array Types |
| Single element array | 🟢 Medium | `let arr: byte[1] = [42];` | Array Types |
| Array size inference rules | 🟡 High | Consistent dimension requirements | Array Types |

**Status:** 🔴 Significant gaps in numeric boundary testing.

---

### 3. Variables (03-variables.md)

**Existing Coverage:** Declaration tests exist, but mutation rules not fully tested.

**Gaps Identified:**

| Gap | Priority | Description | Spec Reference |
|-----|----------|-------------|----------------|
| const without initializer | 🟡 High | `const x: byte;` should error | Mutability |
| let array element mutation | 🟡 High | `arr[0] = 10;` allowed | Array Mutation |
| const array element mutation | 🔴 Critical | `arr[0] = 10;` should error | Array Mutation |
| Array reassignment error | 🟡 High | `arr = [1, 2, 3];` should error | Array Mutation |
| Uninitialized variable usage | 🟡 High | `let x: byte; let y = x;` warning | Initialization |
| Storage class validation | 🟢 Medium | Invalid storage class combinations | Storage Classes |

**Status:** 🟡 Some gaps in const/let array semantics.

---

### 4. Expressions (04-expressions.md)

**Existing Coverage:** Good expression tests, but operator edge cases missing.

**Gaps Identified:**

| Gap | Priority | Description | Spec Reference |
|-----|----------|-------------|----------------|
| Division by zero | 🟡 High | `10 / 0` behavior (tested partially) | Arithmetic |
| Modulo by zero | 🟡 High | `10 % 0` behavior | Arithmetic |
| Division truncation | 🟡 High | `5 / 2 = 2` (integer division) | Arithmetic |
| Subtraction underflow | 🟡 High | `0 - 1` for unsigned types | Arithmetic |
| Shift by 0 | 🟢 Medium | `x << 0` should equal `x` | Bitwise |
| Shift by type size | 🔴 Critical | `byte << 8` behavior | Bitwise |
| Shift by more than size | 🔴 Critical | `byte << 16` behavior | Bitwise |
| Bitwise NOT at zero | 🟢 Medium | `~0` for byte = 255 | Bitwise |
| Bitwise NOT at max | 🟢 Medium | `~255` for byte = 0 | Bitwise |
| Address-of literal | 🟡 High | `@5` should error | Address-Of |
| Address-of expression | 🟡 High | `@(x + y)` should error | Address-Of |
| Ternary type widening | 🟢 Medium | `cond ? byte : word` → word | Ternary |
| Nested ternary | 🟢 Medium | `a ? b : c ? d : e` associativity | Ternary |
| Chained comparisons | 🟡 High | `a == b == c` meaning | Comparison |

**Status:** 🔴 Critical gaps in shift operators and overflow behavior.

---

### 5. Statements (05-statements.md)

**Existing Coverage:** Control flow tests exist, but edge cases missing.

**Gaps Identified:**

| Gap | Priority | Description | Spec Reference |
|-----|----------|-------------|----------------|
| break outside loop | 🔴 Critical | Should be compile error | Break/Continue |
| continue outside loop | 🔴 Critical | Should be compile error | Break/Continue |
| break in nested loop | 🟡 High | Only breaks inner loop | Break/Continue |
| continue in nested loop | 🟡 High | Only continues inner loop | Break/Continue |
| Return after return | 🟡 High | Unreachable code after return | Control Flow |
| Code after break | 🟡 High | Unreachable code after break | Control Flow |
| Code after continue | 🟡 High | Unreachable code after continue | Control Flow |
| if (false) branch | 🟢 Medium | Constant condition branch detection | Control Flow |
| while (false) body | 🟢 Medium | Never-executed loop body | Control Flow |
| Missing return in non-void | 🔴 Critical | All paths must return | Return |
| Return in void function | 🟢 Medium | `return;` vs `return value;` | Return |
| do-while semicolon | 🟢 Medium | `do { } while (x);` requires `;` | Do-While |
| for loop counter scope | 🟡 High | Variable declared in for header | For Loop |
| Switch fallthrough | 🟢 Medium | Case without break behavior | Switch |
| Switch duplicate case | 🟡 High | Same value in multiple cases | Switch |

**Status:** 🔴 Critical gaps in break/continue validation and return path analysis.

---

### 6. Functions (06-functions.md)

**Existing Coverage:** Good function tests, recursion detection working.

**Gaps Identified:**

| Gap | Priority | Description | Spec Reference |
|-----|----------|-------------|----------------|
| Direct recursion | ✅ Covered | Already tested extensively | Recursion |
| Indirect recursion | ✅ Covered | Already tested extensively | Recursion |
| Wrong argument count | 🟡 High | Too few/too many arguments | Function Calls |
| Wrong argument types | 🟡 High | Type mismatch in call | Function Calls |
| Return type mismatch | 🟡 High | Returning wrong type | Return |
| Void function return value | 🟡 High | `return x;` in void function | Return |
| Non-void function no return | 🔴 Critical | Missing return statement | Return |
| Callback signature | 🟢 Medium | No parameters, void return | Callbacks |
| Nested function error | 🟡 High | Function inside function | Restrictions |

**Status:** 🟡 Some gaps in function call validation.

---

## Prioritized Test Implementation Plan

### Session 5B.2: Numeric Boundary Tests (~55 tests)

**Files to create:**
- `semantic/edge-cases/numeric/byte-boundaries.test.ts` (~20 tests)
- `semantic/edge-cases/numeric/word-boundaries.test.ts` (~20 tests)
- `semantic/edge-cases/numeric/overflow-behavior.test.ts` (~15 tests)

**Test cases:**
```js
// byte-boundaries.test.ts
let x: byte = 0;        // minimum - should pass
let x: byte = 255;      // maximum - should pass
let x: byte = 256;      // overflow - should error
let x: byte = -1;       // negative - should error
let x: byte = $00;      // hex minimum
let x: byte = $FF;      // hex maximum
let x: byte = 0b00000000;  // binary minimum
let x: byte = 0b11111111;  // binary maximum

// word-boundaries.test.ts
let x: word = 0;        // minimum
let x: word = 65535;    // maximum
let x: word = 65536;    // overflow - should error
let x: word = $0000;    // hex minimum
let x: word = $FFFF;    // hex maximum

// overflow-behavior.test.ts
let x: byte = 255 + 1;  // wraps to 0
let x: word = 65535 + 1;  // wraps to 0
let x: byte = 200 + 100;  // overflow detection
let x: byte = 128 * 2;    // multiplication overflow
```

---

### Session 5B.3: Operator Edge Case Tests (~70 tests)

**Files to create:**
- `semantic/edge-cases/operators/arithmetic-edge-cases.test.ts` (~20 tests)
- `semantic/edge-cases/operators/comparison-edge-cases.test.ts` (~15 tests)
- `semantic/edge-cases/operators/logical-edge-cases.test.ts` (~15 tests)
- `semantic/edge-cases/operators/bitwise-edge-cases.test.ts` (~20 tests)

**Test cases:**
```js
// arithmetic-edge-cases.test.ts
10 / 0        // division by zero
10 % 0        // modulo by zero
5 / 2         // truncation = 2
0 - 1         // underflow for unsigned
255 * 255     // should promote to word

// bitwise-edge-cases.test.ts
1 << 0        // should equal 1
1 << 8        // for byte - undefined/wrap?
1 << 16       // for byte - undefined/wrap?
~0            // for byte = 255
~255          // for byte = 0
~$FFFF        // for word = 0
```

---

### Session 5B.4: Array Edge Case Tests (~50 tests)

**Files to create:**
- `semantic/edge-cases/arrays/array-empty-single.test.ts` (~15 tests)
- `semantic/edge-cases/arrays/array-boundaries.test.ts` (~20 tests)
- `semantic/edge-cases/arrays/array-multidim.test.ts` (~15 tests)

**Test cases:**
```js
// array-empty-single.test.ts
let arr: byte[] = [];       // size 0
let arr: byte[] = [42];     // size 1
let arr: byte[0] = [];      // explicit size 0
let arr: byte[1] = [42];    // explicit size 1

// array-boundaries.test.ts
arr[0]        // first element
arr[9]        // last valid (for size 10)
arr[10]       // out of bounds
arr[-1]       // negative index

// array-multidim.test.ts
let m: byte[][] = [[1,2], [3,4]];  // 2D
m[0][0]       // first element of first row
m[1][1]       // last element of last row
```

---

### Session 5B.5: Control Flow Edge Case Tests (~45 tests)

**Files to create:**
- `semantic/edge-cases/control-flow/unreachable-code.test.ts` (~15 tests)
- `semantic/edge-cases/control-flow/missing-returns.test.ts` (~15 tests)
- `semantic/edge-cases/control-flow/break-continue.test.ts` (~15 tests)

**Test cases:**
```js
// unreachable-code.test.ts
return x; y = 5;      // y unreachable
break; x = 1;         // x unreachable
continue; x = 1;      // x unreachable
if (false) { x = 1; } // never executed

// missing-returns.test.ts
function f(): byte { }           // missing return
function f(): byte { if (x) return 1; }  // some paths missing
function f(): void { }           // ok - void
function f(): void { return; }   // ok - explicit void return

// break-continue.test.ts
break;                // error - not in loop
continue;             // error - not in loop
while (x) { while (y) { break; } }  // only breaks inner
```

---

### Session 5B.6: Type Coercion Edge Case Tests (~35 tests)

**Files to create:**
- `semantic/edge-cases/types/type-coercion.test.ts` (~20 tests)
- `semantic/edge-cases/types/type-narrowing.test.ts` (~15 tests)

**Test cases:**
```js
// type-coercion.test.ts
let w: word = byteVar;     // implicit promotion - ok
let b: byte = wordVar;     // narrowing - should error
let b: byte = boolVar;     // requires conversion
let arr: byte[] = other;   // cannot infer from variable

// type-narrowing.test.ts
if (x > 0) { /* x still byte/word */ }
```

---

### Session 5B.7: Error Combination Tests (~35 tests)

**Files to create:**
- `semantic/edge-cases/errors/error-combinations.test.ts` (~20 tests)
- `semantic/edge-cases/errors/error-recovery.test.ts` (~15 tests)

**Test cases:**
```js
// error-combinations.test.ts
// Multiple errors in same function
// Errors across modules
// Type error + undefined variable

// error-recovery.test.ts
// Continue analysis after error
// Error count and limits
```

---

## Summary Statistics

| Category | Gaps Found | Priority Breakdown |
|----------|------------|-------------------|
| Numeric Boundaries | 14 | 10 Critical, 3 High, 1 Medium |
| Operators | 15 | 3 Critical, 9 High, 3 Medium |
| Arrays | 6 | 0 Critical, 3 High, 3 Medium |
| Control Flow | 14 | 4 Critical, 7 High, 3 Medium |
| Functions | 9 | 1 Critical, 6 High, 2 Medium |
| Variables | 6 | 1 Critical, 4 High, 1 Medium |
| **Total** | **64** | **19 Critical, 32 High, 13 Medium** |

## Recommended Session Order

1. **Session 5B.2: Numeric Boundaries** - Most critical for language correctness
2. **Session 5B.3: Operator Edge Cases** - Shift operators are critical
3. **Session 5B.5: Control Flow** - break/continue and return validation
4. **Session 5B.4: Array Edge Cases** - Important for memory safety
5. **Session 5B.6: Type Coercion** - Type safety
6. **Session 5B.7: Error Combinations** - Robustness

---

## Notes

1. **Existing Coverage is Good**: The 2802 existing tests cover most happy paths
2. **Gaps are at Boundaries**: Most gaps are at boundary conditions (0, max, overflow)
3. **Some Gaps May Be Implementation-Specific**: E.g., shift by more than type size behavior
4. **Parser Limitations**: Some edge cases may hit parser limitations before semantic analysis

---

## Next Steps

1. ✅ Gap report created
2. ⏳ Proceed with Session 5B.2: Numeric Boundary Tests
3. ⏳ Create test files per session plan
4. ⏳ Update this report as gaps are addressed