# Chapter 04 — Expressions & Operators

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: F017, F024, F006, F020

---

## 1. Overview

This chapter defines the complete expression system of Blend65 v3: the operator set, operator precedence, the address-of operator, the conditional (ternary) operator, and the nine memory intrinsics. Type rules for all operators are defined canonically in → Ch 02; this chapter defines *what* operators exist, their precedence, their evaluation rules, and their 6502 code generation cost.

---

## 2. Operator Precedence Table

Blend65 uses 14 precedence levels. Higher numbers bind tighter. All binary operators are **left-associative** unless noted.

| Level | Operators | Associativity | Category |
|-------|-----------|---------------|----------|
| 14 | `()` (grouping), function call, array index `[]`, member access `.` | Left | Primary |
| 13 | `!` (logical NOT), `~` (bitwise NOT), `-` (unary minus), `&` (address-of) | Right (unary) | Unary |
| 12 | `? :` (conditional / ternary) | **Right** | Conditional |
| 11 | `*`, `/`, `%` | Left | Multiplicative |
| 10 | `+`, `-` | Left | Additive |
| 9 | `<<`, `>>` | Left | Shift |
| 8 | `<`, `<=`, `>`, `>=` | Left | Relational |
| 7 | `==`, `!=` | Left | Equality |
| 6 | `&` (bitwise AND) | Left | Bitwise AND |
| 5 | `^` (bitwise XOR) | Left | Bitwise XOR |
| 4 | `\|` (bitwise OR) | Left | Bitwise OR |
| 3 | `&&` (logical AND) | Left | Logical AND |
| 2 | `\|\|` (logical OR) | Left | Logical OR |
| 1 | `=`, `+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `\|=`, `^=`, `<<=`, `>>=` | **Right** | Assignment |

**Notes:**
- The conditional operator (`? :`) at level 12 is **right-associative**: `a ? b : c ? d : e` parses as `a ? b : (c ? d : e)`.
- Assignment operators at level 1 are **right-associative**: `a = b = c` parses as `a = (b = c)`. However, chained assignment is not idiomatic in Blend65.
- The `&` token is disambiguated by position: unary prefix (level 13) = address-of; binary infix (level 6) = bitwise AND (→ Ch 01, §9.7).

---

## 3. Arithmetic Operators

### 3.1 Addition and Subtraction

| Operator | Name | Operands | Result |
|----------|------|----------|--------|
| `+` | Addition | integer OP integer | same-type (→ Ch 02, TS-3/TS-4) |
| `-` | Subtraction | integer OP integer | same-type |
| `-` | Unary minus | `-expr` (signed only) | same signed type |

**6502 cost:**

| Width | Operation | Cycles | Bytes |
|-------|-----------|--------|-------|
| 8-bit | `a + b` / `a - b` | ~8–10 | 6–8 |
| 16-bit | `a + b` / `a - b` | ~14–18 | 12–16 |
| 8-bit | `-a` (negate) | ~10 | 5 |

Unary minus is valid only on signed types (`sbyte`, `sword`). Applying it to unsigned types produces **E10083** (→ Ch 02, TS-8).

### 3.2 Multiplication

| Operator | Name | 6502 Native? |
|----------|------|-------------|
| `*` | Multiply | No — the 6502 has no hardware multiply |

**Three-tier codegen strategy:**

| Tier | Condition | Code Generated | Cost |
|------|-----------|----------------|------|
| **Constant fold** | Both operands are compile-time constants | Result computed at compile time | 0 cycles, 0 bytes |
| **Shift-and-add** | One operand is a constant power of 2 or small constant | Shift/add sequence | Varies (⚠️ W10172) |
| **Software multiply** | Both operands are runtime variables | Subroutine call | ~80–150 cycles 8-bit (⚠️ W10170), ~200–400 cycles 16-bit |

The compiler emits **W10170** when a runtime multiply generates a subroutine call, and **W10172** when a constant multiply generates a shift-and-add sequence, documenting the approximate cycle cost.

### 3.3 Division and Modulo

| Operator | Name | 6502 Native? |
|----------|------|-------------|
| `/` | Integer divide | No |
| `%` | Modulo (remainder) | No |

Division is integer division — the result is truncated toward zero (for both signed and unsigned operands).

**Codegen:** Always generates a software subroutine call. The compiler emits **W10171** documenting the cost (~100–200 cycles for 8-bit, ~300–500 cycles for 16-bit).

**Division by zero:**
- Constant expression: **E10160** (compile-time error).
- Runtime: Defined behavior — the result is the maximum value for the type (255 for byte, 65535 for word, etc.). The compiler emits **W10173** when it can detect a possible runtime division by zero.

### 3.4 Compound Assignment

All arithmetic operators have compound-assignment forms: `+=`, `-=`, `*=`, `/=`, `%=`. Semantics are equivalent to the expanded form (→ Ch 02, TS-17).

---

## 4. Bitwise Operators

| Operator | Name | Operands | Result |
|----------|------|----------|--------|
| `&` | Bitwise AND | integer OP integer | same-type |
| `\|` | Bitwise OR | integer OP integer | same-type |
| `^` | Bitwise XOR | integer OP integer | same-type |
| `~` | Bitwise NOT (unary) | `~expr` | same-type |
| `<<` | Left shift | integer OP unsigned | same as left operand |
| `>>` | Right shift | integer OP unsigned | same as left operand |

**Rules:**
- Bitwise operators work on all four integer types (`byte`, `sbyte`, `word`, `sword`). Boolean is not valid (→ Ch 02, TS-6).
- Shift amount must be unsigned (`byte` or `word`). A signed shift amount produces **E10161**.
- Shift amount ≥ type width (8 for byte/sbyte, 16 for word/sword) produces **W10174** — result is always 0.
- Right shift is type-aware: logical (zero-fill) for unsigned, arithmetic (sign-extend) for signed (→ Ch 02, TS-19).
- Left shift (`<<`) is identical for signed and unsigned types.

**6502 cost:**

| Operation | 8-bit | 16-bit |
|-----------|-------|--------|
| AND, OR, XOR | ~6 cycles | ~10 cycles |
| NOT (`~`) | ~4 cycles | ~8 cycles |
| Shift by 1 | ~4 cycles | ~8 cycles |
| Shift by N (const) | ~4N cycles | ~8N cycles |

**Compound assignment:** `&=`, `|=`, `^=`, `<<=`, `>>=` follow TS-17.

---

## 5. Comparison Operators

| Operator | Name | Result Type |
|----------|------|-------------|
| `==` | Equal | `boolean` |
| `!=` | Not equal | `boolean` |
| `<` | Less than | `boolean` |
| `<=` | Less or equal | `boolean` |
| `>` | Greater than | `boolean` |
| `>=` | Greater or equal | `boolean` |

All comparisons produce `boolean` (→ Ch 02, TS-7). Type-mixing rules apply (→ Ch 02, §5.2).

**Comparison semantics follow the operand type:**
- Unsigned types use carry-flag comparisons (~6 cycles for 8-bit).
- Signed types use N⊕V flag comparisons (~8–10 cycles for 8-bit, ~12–18 cycles for 16-bit).

**Boolean restriction:** `boolean` supports only `==` and `!=`. Ordered comparisons (`<`, `>`, `<=`, `>=`) on boolean produce **E10154**.

---

## 6. Logical Operators

| Operator | Name | Operands | Result |
|----------|------|----------|--------|
| `&&` | Logical AND | `boolean` OP `boolean` | `boolean` |
| `\|\|` | Logical OR | `boolean` OP `boolean` | `boolean` |
| `!` | Logical NOT (unary) | `!boolean` | `boolean` |

**Short-circuit evaluation:** `&&` and `||` use short-circuit evaluation:
- `a && b`: if `a` is `false`, `b` is not evaluated.
- `a \|\| b`: if `a` is `true`, `b` is not evaluated.

This is not an optimization — it is a **language guarantee**. Code may depend on short-circuit behavior (e.g., `if (i < length(arr) && arr[i] != 0)`).

**6502 cost:** ~6–10 cycles per logical operation (branch-based).

---

## 7. Conditional (Ternary) Operator

### 7.1 Syntax

```blend65
condition ? whenTrue : whenFalse
```

The conditional operator selects between two values based on a boolean condition. Only the selected arm is evaluated.

```ebnf
conditional_expr = logical_or_expr , "?" , expression , ":" , conditional_expr ;
```

### 7.2 Rules

1. **Condition must be `boolean`** — non-boolean produces **E10100** (→ Ch 05).
2. **Both arms must have compatible types** — same type, or same-signedness with auto-promotion (→ Ch 02, TS-4). Incompatible types produce **E10162**.
3. **Arm types must be scalar** — struct and array types are not valid (only `byte`, `sbyte`, `word`, `sword`, `boolean`, and enum types).
4. **Only the selected arm is evaluated** — side effects in the unselected arm do not occur.
5. **Right-associative at precedence level 12** — `a ? b : c ? d : e` parses as `a ? b : (c ? d : e)`.

### 7.3 Type Resolution

| True Arm | False Arm | Result Type |
|----------|-----------|-------------|
| `byte` | `byte` | `byte` |
| `byte` | `word` | `word` (auto-promote) |
| `sbyte` | `sword` | `sword` (auto-promote) |
| `byte` | `sbyte` | ❌ E10162 (mixed signedness) |
| `boolean` | `boolean` | `boolean` |
| Enum A | Enum A | Enum A |
| Enum A | Enum B | ❌ E10162 |

### 7.4 Examples

```blend65
let speed: byte = isRunning ? 4 : 2;
let dir: sbyte = goingRight ? 1 : -1;
let addr: word = useAlt ? $D020 : $D021;

// Nested (right-associative):
let priority: byte = isUrgent ? 3 : isNormal ? 2 : 1;
// Parses as: isUrgent ? 3 : (isNormal ? 2 : 1)
```

### 7.5 6502 Cost

The conditional operator generates the same code as an equivalent `if`/`else` assignment — a conditional branch, two load paths, and a join point. Typical cost: ~10–14 cycles plus the cost of evaluating the arms.

---

## 8. Address-Of Operator (`&`)

### 8.1 Syntax

```blend65
&identifier
```

The `&` operator returns the **compile-time memory address** of a variable or function as a `word` value.

```ebnf
address_of_expr = "&" , identifier ;
```

### 8.2 Rules

| Operand | Valid? | Notes |
|---------|--------|-------|
| Module-level variable (`let`) | ✅ | Returns RAM address |
| Local variable (`let` inside function) | ✅ | SFA gives locals static addresses |
| Zeropage variable | ✅ | Returns zero-page address (0–255) |
| Function name | ✅ | Returns function entry point address |
| `const` scalar | ❌ E10040 | Scalar constants are inlined; no address |
| `const` array | ✅ | Array constants have ROM addresses |
| Parameter | ❌ E10041 | Copy to a local variable first |
| Expression / literal | ❌ E10042/E10043 | Only named variables and functions |

### 8.3 Return Type

`&` always returns `word` — addresses are 16-bit unsigned values on all target platforms.

```blend65
let vel: sbyte = -3;
let addr: word = &vel;         // ✅ word (address is always unsigned)

let handler: word = &myFunc;   // ✅ function address for callback installation
```

### 8.4 Function Addresses and Callbacks

`&functionName` yields the function's entry point address, enabling callback patterns:

```blend65
function onVSync(): void { ... }
poke(IRQ_VECTOR_LO, lo(&onVSync));
poke(IRQ_VECTOR_HI, hi(&onVSync));
```

The compiler detects `&fn` usage and ensures the function is emitted at a stable address (not inlined or eliminated).

### 8.5 6502 Cost

Address-of is resolved at **compile time** or **link time**. At runtime, it loads an immediate 16-bit constant:

```asm
LDA #<address   ; low byte
STA dest
LDA #>address   ; high byte
STA dest+1
; ~8 cycles, 8 bytes
```

---

## 9. Memory Intrinsics

Blend65 provides **9 memory intrinsics** — built-in functions for direct memory access, byte extraction, and compile-time size queries.

### 9.1 Memory Access

#### `peek(addr: word): byte`

Reads a single byte from memory address `addr`.

```blend65
let color: byte = peek($D020);
```

```asm
; If addr is a constant:
LDA $D020       ; 4 cycles, 3 bytes (absolute addressing)
STA color
```

#### `poke(addr: word, value: byte): void`

Writes a single byte `value` to memory address `addr`.

```blend65
poke($D020, 14);
```

```asm
LDA #$0E        ; value
STA $D020       ; 4 cycles, 3 bytes
```

#### `peekw(addr: word): word`

Reads a 16-bit word (little-endian) from addresses `addr` and `addr+1`.

```blend65
let timer: word = peekw($A2);
```

```asm
LDA $A2         ; low byte
STA timer
LDA $A3         ; high byte (addr+1)
STA timer+1
; ~8 cycles
```

#### `pokew(addr: word, value: word): void`

Writes a 16-bit word (little-endian) to addresses `addr` and `addr+1`.

```blend65
pokew($A2, 1000);
```

```asm
LDA #$E8        ; low byte of 1000
STA $A2
LDA #$03        ; high byte of 1000
STA $A3
; ~8 cycles
```

### 9.2 Byte Extraction

#### `lo(value: word): byte`

Returns the low byte (bits 0–7) of a 16-bit value.

```blend65
let low: byte = lo(addr);    // equivalent to byte(addr & $FF)
```

Also accepts `sword`. For 8-bit types, `lo` is an identity (returns the value unchanged).

#### `hi(value: word): byte`

Returns the high byte (bits 8–15) of a 16-bit value.

```blend65
let high: byte = hi(addr);   // equivalent to byte(addr >> 8)
```

Also accepts `sword`. For 8-bit types, `hi` returns 0 (unsigned) or the sign-extension byte (signed).

**6502 cost:** If the source is already in a register pair, `lo` and `hi` are zero-cost (just use the appropriate byte). Otherwise, ~2–4 cycles for a load.

### 9.3 Compile-Time Queries

#### `sizeof(TypeName): byte | word`

Returns the size in bytes of a type. The argument is a **type name**, not an expression.

```blend65
sizeof(byte)      // 1
sizeof(word)      // 2
sizeof(Player)    // sum of field sizes
sizeof(byte[256]) // 256
```

**Return type:** `byte` for sizes ≤ 255, `word` for larger types (→ Ch 02, TS-21).

**Rules:**
- Argument must be a type name: **E10200** if an expression is passed.
- `sizeof(void)` is 0.
- `sizeof(EnumName)` is 1 (enums are byte-backed).
- Evaluated at compile time — no runtime cost.

#### `offsetof(StructType, fieldName): byte`

Returns the byte offset of a field within a struct type. Both arguments are names, not expressions.

```blend65
struct Player { x: byte; y: byte; score: word; }
offsetof(Player, x)      // 0
offsetof(Player, y)      // 1
offsetof(Player, score)  // 2
```

**Rules:**
- First argument must be a struct type: **E10201** otherwise.
- Second argument must be a valid field name: **E10202** otherwise.
- Returns `byte` (struct sizes are always ≤ 255 bytes).
- Evaluated at compile time.

#### `length(arrayExpr): byte | word`

Returns the element count of an array. The argument is an **array-typed expression** (typically a variable name).

```blend65
const DATA: byte[100] = [0; 0];
length(DATA)    // 100
```

**Rules:**
- Argument must be an array: **E10203** if a non-array type is passed.
- Returns the declared element count, not the byte size (use `sizeof` for byte size).
- Evaluated at compile time.

---

## 10. Expression Grammar (EBNF Fragment)

```ebnf
expression       = assignment_expr ;

assignment_expr  = conditional_expr , [ assignment_op , assignment_expr ] ;
assignment_op    = "=" | "+=" | "-=" | "*=" | "/=" | "%="
                 | "&=" | "|=" | "^=" | "<<=" | ">>=" ;

conditional_expr = logical_or_expr , [ "?" , expression , ":" , conditional_expr ] ;

logical_or_expr  = logical_and_expr , { "||" , logical_and_expr } ;
logical_and_expr = bitwise_or_expr , { "&&" , bitwise_or_expr } ;
bitwise_or_expr  = bitwise_xor_expr , { "|" , bitwise_xor_expr } ;
bitwise_xor_expr = bitwise_and_expr , { "^" , bitwise_and_expr } ;
bitwise_and_expr = equality_expr , { "&" , equality_expr } ;
equality_expr    = relational_expr , { ( "==" | "!=" ) , relational_expr } ;
relational_expr  = shift_expr , { ( "<" | "<=" | ">" | ">=" ) , shift_expr } ;
shift_expr       = additive_expr , { ( "<<" | ">>" ) , additive_expr } ;
additive_expr    = multiplicative_expr , { ( "+" | "-" ) , multiplicative_expr } ;
multiplicative_expr = unary_expr , { ( "*" | "/" | "%" ) , unary_expr } ;

unary_expr       = ( "!" | "~" | "-" | "&" ) , unary_expr
                 | postfix_expr ;

postfix_expr     = primary_expr , { call_or_index } ;
call_or_index    = "(" , [ arg_list ] , ")"           (* function call / cast *)
                 | "[" , expression , "]"               (* array index *)
                 | "." , identifier ;                   (* field / enum access *)

primary_expr     = identifier
                 | number_literal
                 | string_literal
                 | char_literal
                 | "true" | "false"
                 | "(" , expression , ")" ;             (* grouping *)

arg_list         = expression , { "," , expression } ;
```

---

## 11. Error Codes

Errors canonically owned by this chapter:

| Code | Message |
|------|---------|
| E10040 | Cannot take address of constant `<name>` — scalar constants are inlined and have no memory address |
| E10041 | Cannot take address of parameter `<name>` — copy it to a local variable first |
| E10042 | Cannot take address of `<expr>` — address-of is only supported on named variables and functions |
| E10043 | Cannot take address of `<expr>` — address-of requires a named variable or function |
| E10160 | Division by zero in constant expression |
| E10161 | Shift amount must be unsigned type (`byte` or `word`) — found `<type>` |
| E10162 | Conditional operator arms have incompatible types `<type_a>` and `<type_b>` |
| E10200 | `sizeof` requires a type name — found `<expr>` |
| E10201 | `offsetof` requires a struct type — found `<type>` |
| E10202 | Field `<field>` not found in struct `<type>` — available fields: `<list>` |
| E10203 | `length` requires an array — found `<type>` |

### Warning Codes

| Code | Message |
|------|---------|
| W10170 | Runtime multiply generates subroutine call (~`<N>` cycles for `<width>`-bit) |
| W10171 | Runtime divide/modulo generates subroutine call (~`<N>` cycles for `<width>`-bit) |
| W10172 | Multiply by `<N>` generates shift-and-add sequence (~`<M>` cycles) |
| W10173 | Possible division by zero — divisor `<name>` may be 0 at runtime |
| W10174 | Shift amount `<N>` >= type width (`<W>` bits) — result is always 0 |
