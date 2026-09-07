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
| 12 | `*`, `/`, `%` | Left | Multiplicative |
| 11 | `+`, `-` | Left | Additive |
| 10 | `<<`, `>>` | Left | Shift |
| 9 | `<`, `<=`, `>`, `>=` | Left | Relational |
| 8 | `==`, `!=` | Left | Equality |
| 7 | `&` (bitwise AND) | Left | Bitwise AND |
| 6 | `^` (bitwise XOR) | Left | Bitwise XOR |
| 5 | `\|` (bitwise OR) | Left | Bitwise OR |
| 4 | `&&` (logical AND) | Left | Logical AND |
| 3 | `\|\|` (logical OR) | Left | Logical OR |
| 2 | `? :` (conditional / ternary) | **Right** | Conditional |
| 1 | `=`, `+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `\|=`, `^=`, `<<=`, `>>=` | **Right** | Assignment |

**Notes:**
- The conditional operator (`? :`) at level 2 is **right-associative**: `a ? b : c ? d : e` parses as `a ? b : (c ? d : e)`. It binds less tightly than `||` and more tightly than assignment.
- Assignment operators at level 1 are **right-associative**: `a = b = c` parses as `a = (b = c)`. However, chained assignment is not idiomatic in Blend65.
- The `&` token is disambiguated by position: unary prefix (level 13) = address-of; binary infix (level 6) = bitwise AND (→ Ch 01, §9.7).

### 2.1 Evaluation Order (OP-E1)

Expression evaluation is deterministic. Unless a more specific rule below selects or skips a
subexpression, the immediate subexpressions of an expression are evaluated exactly once in source
order, from left to right. In particular, an ordinary binary expression evaluates its left operand
before its right operand; an array access evaluates its base before its index; and a call evaluates
its callee before its arguments, whose own ordering is defined in Chapter 06. Postfix operations in
a chain are applied from left to right after the value or place needed by each operation is
available.

Operator associativity determines grouping, not a different effect order. Short-circuit operators
may skip their right operand, the conditional operator evaluates only its selected arm, and
assignment evaluates its target place before its right operand as specified below. An optimizer may
reorder machine instructions only when it proves that the change preserves this observable order,
including calls, volatile memory access, traps or safety stops, and all other side effects.

---

## 3. Arithmetic Operators

### 3.1 Addition and Subtraction

| Operator | Name | Operands | Result |
|----------|------|----------|--------|
| `+` | Addition | integer OP integer | same-type (→ Ch 02, TS-3/TS-4) |
| `-` | Subtraction | integer OP integer | same-type |
| `-` | Unary minus | `-expr` (signed only) | same signed type |

These operators, including their compound-assignment forms, always mean binary fixed-width
integer arithmetic. Their meaning is independent of the processor's decimal and carry flags.
Packed-decimal arithmetic is explicit through `bcd_add()` and `bcd_sub()` (→ Ch 12, §2.5).

**6502 cost:** The following rows cover complete standalone forms that load operands from
zero-page or absolute homes, perform the operation, and store the result. A surrounding consumer
may absorb some or all materialization, so selected lowering reports its actual complete cost.

| Width | Operation | Cycles | Bytes |
|-------|-----------|--------|-------|
| 8-bit | `a + b` / `a - b` | 11–14 | 7–10 |
| 16-bit | `a + b` / `a - b` | 20–26 | 13–19 |
| 8-bit | `-a` (negate) | 12–14 | 9–11 |

Unary minus is valid only on signed types (`sbyte`, `sword`). Applying it to unsigned types produces **E10083** (→ Ch 02, TS-8).

### 3.2 Multiplication

| Operator | Name | 6502 Native? |
|----------|------|-------------|
| `*` | Multiply | No — the 6502 has no hardware multiply |

**Three-tier codegen strategy:**

| Tier | Condition | Code Generated | Cost |
|------|-----------|----------------|------|
| **Constant fold** | Both operands are compile-time constants | Result computed at compile time | 0 cycles, 0 bytes |
| **Shift-and-add** | One operand is a constant power of 2 or small constant | Selected shift/add sequence | Varies; W10172 only if the sequence contains both a shift and an add/subtract |
| **Software multiply** | Both operands are runtime variables | Shared helper body; call-site loads, `JSR`, and result materialization are additional | Helper body: ~80–150 cycles and 30–40 ROM bytes for 8-bit (⚠️ W10170), ~200–400 cycles and 50–70 ROM bytes for 16-bit |

The compiler emits **W10170** when a runtime multiply generates a subroutine call. It emits
**W10172** only when the selected constant-multiply lowering contains at least one shift and at
least one add or subtract; a single power-of-two shift does not warn. Each warning documents the
selected lowering's approximate cycle cost. The build report separately includes call-site loads,
the `JSR`, result materialization, and any SFA-owned helper state.

### 3.3 Division and Modulo

| Operator | Name | 6502 Native? |
|----------|------|-------------|
| `/` | Integer divide | No |
| `%` | Modulo (remainder) | No |

For every nonzero divisor, division first computes the mathematical quotient and truncates it toward
zero. Remainder then satisfies `a == (q * b) + r` using that mathematical truncated quotient `q`.
Therefore `abs(r) < abs(b)`, and a nonzero signed remainder has the dividend's sign. Normal
result-type representation applies afterward, including deterministic fixed-width wrap for the
signed minimum divided by `-1`; its remainder is still zero.

```blend65
sbyte(-5) / sbyte(2)   // -2
sbyte(-5) % sbyte(2)   // -1
sbyte(5) % sbyte(-2)   // 1
sbyte(-5) % sbyte(-2)  // -1
```

**Codegen:** The compiler selects a proven inline sequence or software helper. It may replace a
power-of-two operation with shifts or masks only when signed rounding and remainder sign remain
identical. A plain right shift or `AND` is valid for unsigned or proven-nonnegative operands, but
not as a general signed-negative replacement. The compiler emits **W10171** exactly when the
selected division/remainder lowering calls a software helper; a fully inline sequence does not
trigger that diagnostic.

**Division by zero:**
- Constant expression: **E10160** (compile-time error).
- Runtime, default mode: the selected finite division sequence runs without an injected zero check,
  trap, handler, fallback value, or extra scratch. The quotient and remainder are bounded but
  otherwise unspecified values of their declared result types. The sequence must terminate and may
  have only its declared arithmetic effects. The optimizer must not assume that a runtime divisor is
  nonzero and must not use the unspecified result to alter surrounding observable behavior.
- Runtime, `--division-zero-check`: the compiler emits an inline check before the division. Operands
  are evaluated once. A zero divisor branches to the platform's source-labelled, non-returning safety
  stop before division occurs. A sound nonzero proof removes the check. This option is off by default
  and links no runtime library.

The default rule is a documented 6502 hardware-limitation exception: the processor has no division
instruction or native zero-divisor result, and memory-constrained builds do not pay for a software
policy they did not request.

### 3.4 Compound Assignment

All arithmetic operators have compound-assignment forms: `+=`, `-=`, `*=`, `/=`, `%=`. They apply
the corresponding arithmetic operation to the target's previous value and the right operand (→ Ch
02, TS-17), subject to the single-evaluation rule in §3.5.

### 3.5 Assignment Expressions (OP-A1)

Every assignment form is a value-producing expression. Assignment has the lowest precedence and is
right-associative, so `a = b = f()` means `a = (b = f())`. The value of an assignment expression is
the exact value stored in its target after the assignment conversion.

For `=`, the target place is evaluated once, then the right operand is evaluated once, then the
converted value is stored once. For compound assignment, the target place is evaluated once, its old
value is read once, the right operand is evaluated once, and the result is stored once. The compiler
must not re-evaluate an array index, pointer expression, field base, function call, memory intrinsic,
or other effectful subexpression while expanding an assignment. If later evaluation could overwrite
an intermediate SFA home, the compiler snapshots the required value in SFA-accounted temporary
storage.

```blend65
let copied: byte = target = source;       // assignment result is the stored byte
a = b = nextValue();                     // nextValue() is called once
table[nextIndex()] += delta();            // each call and the table place are evaluated once
```

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
- Shift amount ≥ type width (8 for byte/sbyte, 16 for word/sword) produces **W10174**. Left shift
  yields `0`. Right shift yields `0` for unsigned or non-negative signed operands and `-1` for a
  negative signed operand. This is the saturated result of repeated logical or arithmetic shifts.
- Right shift is type-aware: logical (zero-fill) for unsigned, arithmetic (sign-extend) for signed (→ Ch 02, TS-19).
- Left shift (`<<`) is identical for signed and unsigned types.

**6502 instruction-core cost:** The following rows assume the 8-bit left operand is already in A
and exclude any result store. A zero-page or absolute right operand explains each range. Word,
signed-right-shift, materialized-result, and variable-count forms are selected sequences whose
complete cost must be reported from their actual instructions rather than inferred by doubling.

| 8-bit accumulator operation | Cycles | ROM bytes |
|-----------------------------|--------|-----------|
| AND, OR, XOR with memory right operand | 3–4 | 2–3 |
| NOT (`EOR #$FF`) | 2 | 2 |
| Unsigned shift by 1 | 2 | 1 |
| Unsigned shift by constant N | 2N | N |

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
- Unsigned types use carry-flag comparisons. A representative byte `LDA`/`CMP`/branch costs 7–12
  cycles depending on immediate versus memory operands, addressing, and branch path.
- Signed types use a flag-correct sequence equivalent to N⊕V. Comparison against zero can use
  `LDA`/sign branch; the displayed general byte sequence in F010 costs 13–18 cycles. Every selected
  path reports its actual instructions and timing.

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

**6502 cost:** There is no context-free total: the right operand may be skipped or may contain an
arbitrary expression. For each selected Boolean test, the branch instruction itself costs 2 cycles
when not taken, 3 when taken on-page, and 4 when a taken branch crosses a page; loading or computing
the Boolean and materializing a surviving result are additional selected-lowering costs.

---

## 7. Conditional (Ternary) Operator

### 7.1 Syntax

```blend65
condition ? whenTrue : whenFalse
```

The conditional operator selects between two values based on a boolean condition. Only the selected arm is evaluated.

```ebnf
conditional_expr = logical_or_expr , [ "?" , expression , ":" , conditional_expr ] ;
```

### 7.2 Rules

1. **Condition must be `boolean`** — non-boolean produces **E10100** (→ Ch 05).
2. **Both arms must have compatible types** — same type, or same-signedness with auto-promotion (→ Ch 02, TS-4). Incompatible types produce **E10162**.
3. **Arm types must be scalar** — struct and array types are not valid (only `byte`, `sbyte`, `word`, `sword`, `boolean`, and enum types).
4. **Only the selected arm is evaluated** — side effects in the unselected arm do not occur.
5. **Right-associative at precedence level 2** — `a ? b : c ? d : e` parses as `a ? b : (c ? d : e)`; conditional binds below `||` and above assignment.

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

The conditional operator generates the same code as an equivalent `if`/`else` assignment — a
conditional branch, two load paths, and a join point. For the displayed byte form with an already
materialized Boolean condition and immediate arms, the selected path costs 11–15 cycles with
zero-page or absolute condition/result homes. Other arms add their own evaluation cost.

---

## 8. Address-Of Operator (`&`)

### 8.1 Syntax

```blend65
&expression
```

The `&` operator returns the **compile-time memory address** of a variable or function as a `word` value.

```ebnf
address_of_expr = "&" , unary_expr ;
```

### 8.2 Rules

| Operand | Valid? | Notes |
|---------|--------|-------|
| Module-level variable (`let`) | ✅ | Returns RAM address |
| Local variable (`let` inside function) | ✅ with lifetime restriction | SFA gives the local a static address for its active source lifetime; E10260 rejects a possible escape |
| Zeropage variable | ✅ | Returns zero-page address (0–255) |
| Function name | ✅ | Returns function entry point address |
| `const` scalar | ❌ E10040 | Scalar constants are inlined; no address |
| `const` array | ✅ | Array constants have ROM addresses |
| Parameter | ❌ E10041 | Copy to a local variable first |
| Struct field / array element | ❌ E10042 | Field/element address-taking is deferred |
| Other expression / literal | ❌ E10043 | Only named variables and functions |

### 8.3 Local-Address Borrow Lifetime

Taking the address of a function local creates a compiler-tracked **borrowed local address**. Its
source type remains the ordinary integer type `word`, but the compiler retains hidden provenance
that identifies the local and its dynamic source lifetime.

That lifetime is bounded by the local's lexical scope inside one function invocation. A block local
ends when control leaves its block. A loop-body or for-header local has a new source lifetime on
each iteration and cannot be observed from a later iteration merely because SFA reuses the same
physical bytes. Every use through the borrowed address extends the local's SFA liveness through
that use.

A borrowed local address may be consumed by `peek`, `poke`, or another memory operation while the
local is alive; copied through local scalar or aggregate storage whose lifetime is wholly contained
within the local's lifetime; or passed to a parameter proven **non-retaining** for that argument
position. A non-retaining callee may dereference or mutate through the address and may forward it
only to another proven non-retaining position. On every path it must not return the address,
persist it, publish it to an interrupt or hardware consumer, or pass it through an opaque boundary.
User-function contracts are inferred transitively from the complete program; library and platform
operations declare the property explicitly.

Provenance cannot be laundered through the fact that addresses use ordinary integer types. Identity
copies, casts, conditional selection, `lo`/`hi`, arithmetic, and bitwise derivations retain a
dependency on every borrowed local address that contributes to their result. Reading data through
the address produces ordinary data and does not carry address provenance. E10260 rejects the first
use that may let a borrowed address or address-derived fragment outlive its local, including:

- return from the containing function;
- storage in module-level or zero-page state, raw memory, MMIO, or any object whose contained
  lifetime cannot be proved;
- passage to a retaining, unknown, external, interrupt, or hardware-consumed argument; or
- any opaque transformation or boundary that prevents the compiler from proving containment.

After the source lifetime and every legal borrow end, SFA may reuse the same home. The language
therefore promises neither a fresh nor a stable address across sequential invocations or loop
iterations; an earlier address cannot remain observable. If mainline, IRQ, NMI, or another bounded
domain may invoke the same owner concurrently, SFA allocates disjoint homes. Materializing
`&local` may then require a domain/home-specific code variant, and the build report includes every
resulting ROM, RAM, and zero-page cost. Unbounded overlap remains E10245.

```blend65
function useNow(): void {
    let value: byte = 42;
    let address: word = &value;
    poke(address, 7);             // ✅ value is still alive
    inspect(address);             // ✅ only if this argument is proven non-retaining
}

function invalid(): word {
    let value: byte = 42;
    return &value;                // ❌ E10260: value dies when invalid() returns
}
```

Persistent addresses instead name module-level storage or storage owned by the caller and passed
by reference. No heap, runtime check, hidden persistent home, or implicit static-local conversion
is added.

### 8.4 Return Type

`&` always returns `word` — addresses are 16-bit unsigned values on all target platforms.

```blend65
let vel: sbyte = -3;
let addr: word = &vel;         // ✅ word (address is always unsigned)

let handler: word = &myFunc;   // ✅ function address for callback installation
```

### 8.5 Function Addresses and Callbacks

`&functionName` yields the function's entry point address, enabling callback patterns:

```blend65
function onVSync(): void { ... }
poke(IRQ_VECTOR_LO, lo(&onVSync));
poke(IRQ_VECTOR_HI, hi(&onVSync));
```

The compiler detects `&fn` usage and ensures the function is emitted at a stable address (not inlined or eliminated).

### 8.6 6502 Cost

Address-of is resolved at **compile time** or **link time**. At runtime, it loads an immediate 16-bit constant:

```asm
LDA #<address   ; low byte
STA dest
LDA #>address   ; high byte
STA dest+1
; 12 cycles, 10 bytes when dest is absolute (10 cycles, 8 bytes in zero page)
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
; 14 cycles, 10 bytes when timer is absolute; $A2/$A3 use zero-page reads
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
; 10 cycles, 8 bytes; $A2/$A3 use zero-page stores
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

### 9.3 Size and Element-Count Queries

#### `sizeof(TypeName): word`

Returns the size in bytes of a type. The argument is a **type name**, not an expression.

```blend65
sizeof(byte)      // 1
sizeof(word)      // 2
sizeof(Player)    // sum of field sizes
sizeof(byte[256]) // 256
```

**Return type:** always `word` (→ Ch 02, TS-21). A size boundary never changes surrounding
arithmetic semantics; proof may still select byte machine work for a particular consumer.

**Rules:**
- Argument must be a type name: **E10200** if an expression is passed.
- An unsized array type such as `byte[]` has no standalone fixed size: **E10266**.
- `sizeof(void)` is 0.
- `sizeof(EnumName)` is 1 (enums are byte-backed).
- Every valid fixed array or struct type has a total byte size in `0..65535` (→ Ch 02, TS-23).
- Evaluated at compile time — no runtime cost.

#### `offsetof(StructType, fieldName): word`

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
- Returns `word`, including when the selected field happens to be within the first 256 bytes.
- Evaluated at compile time.

#### `length(arrayExpr): word`

Returns the element count of an array. The argument is an **array-typed expression** (typically a variable name).

```blend65
const DATA: byte[100] = [0; 0];
length(DATA)    // 100
```

**Rules:**
- Argument must be an array: **E10203** if a non-array type is passed.
- Returns the declared element count, not the byte size (use `sizeof` for byte size).
- Always returns `word`, including for zero and small arrays. A 256-element array therefore returns
  256 without any type boundary, and compiler proof may still choose an 8-bit machine form for a
  particular use when that preserves behavior.
- Evaluated at compile time for a fixed-extent array. For an any-size array parameter, it loads the
  full 16-bit element count supplied by the caller and is not a constant expression.

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
                 | primitive_cast
                 | struct_literal
                 | array_literal
                 | intrinsic_call
                 | "(" , expression , ")" ;             (* grouping *)

arg_list         = expression , { "," , expression } ;
```

`primitive_cast`, `struct_literal`, `array_literal`, and `intrinsic_call` are the shared productions
defined by their owning type, aggregate, intrinsic, and data-inclusion chapters and collected in
the master grammar. `intrinsic_call` includes `embed_expr` and all other reserved built-in call
forms. This fragment lists the shared productions so it does not narrow the valid
primary-expression set.

---

## 11. Diagnostic Conditions

This chapter owns expression/operator predicates. Chapter 14 alone owns public severities,
templates, spans, suppression, and history.

| Code | Trigger | Rejected behavior or consequence |
|------|---------|----------------------------------|
| E10040 | Address-of targets an inlined scalar constant. | No storage address exists; the expression is rejected. |
| E10041 | Address-of targets a parameter. | The expression is rejected under the parameter-address rule. |
| E10042 | Address-of syntactically targets a struct field or array element. | The deferred field/element form is rejected. |
| E10043 | Address-of targets any other literal/expression instead of one accepted identifier. | The expression is rejected. |
| E10260 | A local-origin address or derived fragment may outlive its dynamic source lifetime. | The escaping use is rejected; legal non-retaining borrows remain available. |
| E10154 | An ordered comparison uses a boolean operand. | The comparison is rejected. |
| E10160 | A compile-time constant divisor is zero. | Division/remainder is rejected before runtime lowering. |
| E10161 | A shift count has a signed type. | The shift is rejected. |
| E10162 | Conditional arms have incompatible types. | The conditional expression is rejected. |
| E10200 | `sizeof` receives a value expression rather than a type. | The query is rejected. |
| E10201 | `offsetof` names a non-struct type. | The query is rejected. |
| E10202 | `offsetof` names no field on the selected struct. | The query is rejected. |
| E10203 | `length` receives a non-array expression. | The query is rejected. |
| E10266 | `sizeof` names an unsized array type with no standalone fixed extent. | The query is rejected. |

### Warning Conditions

| Code | Trigger | Consequence |
|------|---------|-------------|
| W10170 | Runtime multiplication selects a software-helper call. | Compilation continues and reports its estimated width-specific cost. |
| W10171 | Runtime division/remainder selects a software-helper call. | Compilation continues and reports its estimated width-specific cost. |
| W10172 | Constant multiplication selects a nontrivial inline sequence containing at least one shift and at least one add or subtract. | Compilation continues and reports its estimated cost. A single power-of-two shift does not warn. |
| W10173 | A runtime divisor is not proven nonzero. | Default zero produces bounded unspecified result bits; compilation continues with mitigation guidance. |
| W10174 | A compile-time-known shift count is at least the operand width. | Compilation continues with the specified saturated shift result. |
