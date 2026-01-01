# Blend64 Language Specification (v0.1)

**Status:** Draft (derived from Blend 0.2.0-draft, redesigned for Commodore 64) **Target:** MOS 6510 / C64,
ahead-of-time compiled to **PRG** **Core guarantees:** static memory, deterministic codegen, no implicit runtime,
reachability-based dead-code elimination

---

## 0. Non-negotiable Guarantees

Blend64 is an **assembler-plus** language for serious C64 game code.

### 0.1 Compilation model

-   Source compiles **ahead-of-time** to a C64 **PRG**.
-   The compiler performs **reachability-based dead-code elimination**:
    -   Only code/data reachable from entry points (e.g. `main`) and imported reachable symbols are emitted.
-   There is **no implicitly linked runtime** and **no default standard library**.
-   The compiler may emit **helper routines** (e.g. `mul16`, `hex8`) **only if used**, and must deduplicate them.

### 0.2 Memory & storage model

-   **All variables have static storage** (global lifetime). **No stack-allocated locals** exist in v0.1.
-   Modules are **namespaces only**; they do not imply storage duration.
-   The compiler emits a **memory map** (symbols, sizes, segments, addresses).
-   Storage classes exist (explicit or inferred):
    -   `zp` (zero page)
    -   `ram` (RAM, uninitialized)
    -   `data` (RAM/ROM initialized bytes/words)
    -   `const` (read-only data / ROM-intent)
    -   `io` (memory-mapped I/O)
-   The compiler **may auto-promote** eligible variables to `zp` unless pinned elsewhere.
-   Explicit pinned placements must be respected.

### 0.3 Forbidden in v0.1

-   Heap allocation (no dynamic arrays, maps, strings, objects)
-   Floating-point types
-   Local variables
-   Nested functions / closures / lambdas
-   Recursion (direct or indirect)
-   Exceptions / `Result` types
-   Returning structs/records/arrays

---

## 1. Lexical Structure

### 1.1 Source encoding

-   UTF-8 source files.

### 1.2 Comments

-   `//` line comment
-   `/* ... */` block comment

### 1.3 Identifiers

-   `[A-Za-z_][A-Za-z0-9_]*`
-   Case-sensitive
-   Keywords are reserved.

---

## 2. Program Structure

A program is a set of modules. Each file declares exactly one module.

```
module Game.Main

import c64:vic
import game:player

export function main(): void
    // ...
end function
```

### 2.1 Module declaration

```ebnf
module         ::= "module" qualified_name newline
qualified_name ::= ident { "." ident }*
```

Modules are **namespaces**. They do not create runtime init logic. Top-level initializers are compiled into static data
or explicit init code only if referenced.

### 2.2 Imports

Imports are **compile-time only** and exist solely to:

-   bring names into scope
-   mark imported symbols as potential reachability roots when referenced

```
import irqInit, irqEnable from c64:irq
import Player_Init, Player_Tick from game:player
```

```ebnf
import_decl ::= "import" import_list "from" module_path newline
import_list ::= ident { "," ident }*
module_path ::= qualified_name | string_literal
```

**Resolution is toolchain-defined** (project-local modules, or `c64:*` modules shipped with the toolchain). Imports are
never dynamic.

### 2.3 Exports

Only exported symbols may be imported by other modules.

```
export const SCREEN_W: byte = 40
export function main(): void
    // ...
end function
```

---

## 3. Types

Blend64 types are **target-defined** and have fixed sizes.

### 3.1 Primitive types

|      Type |   Size | Notes             |
| --------: | -----: | ----------------- |
|    `byte` |  8-bit | unsigned 0..255   |
|    `word` | 16-bit | unsigned 0..65535 |
| `boolean` |  8-bit | 0 or 1            |
|    `void` |      — | no value          |

Optional (toolchain flag / future v0.1.x):

-   `sbyte` (8-bit signed)
-   `sword` (16-bit signed)

**No** `integer`, `long`, `single`, `double`.

### 3.2 Arrays (fixed-size only)

Arrays are fixed-capacity, compile-time sized, contiguous memory.

Syntax (developer-friendly, C-like):

```
var spriteX: byte[8]
var screenLine: byte[40]
var tiles: byte[256]
```

```ebnf
array_type ::= prim_type "[" int_lit "]"
```

-   Size must be a compile-time constant integer literal.
-   No `push`, `pop`, resizing, or heap backing.
-   Indexing is allowed; bounds checking is **compiler-option**:
    -   `--bounds=off` (default for release)
    -   `--bounds=on` (debug; inserts checks via helpers)

### 3.3 Records (structs)

Records compile to a **flat layout** in memory.

```
type Player extends HasPos, HasVel
    hp: byte
    flags: byte
end type

type HasPos
    x: word
    y: word
end type

type HasVel
    vx: sbyte
    vy: sbyte
end type
```

Rules:

-   `extends` is allowed **only** as compile-time composition.
-   The **magic phase flattens** `extends` into a single field list.
-   No optional fields. No field defaults.
-   Layout is deterministic and toolchain-defined (default: declaration order).
-   No methods on records; use functions.

```ebnf
type_decl ::= "type" ident [ "extends" type_ref { "," type_ref }* ] newline
             { field_decl }*
             "end" "type" newline

field_decl ::= ident ":" type_expr newline
type_expr  ::= prim_type | array_type | type_ref
```

### 3.4 Pointers (v0.1)

To keep v0.1 simple and safe, raw pointers are **not** a surface feature by default. However, memory-mapped and
address-taken patterns are needed on C64, so Blend64 provides:

-   `addr(expr)` builtin that yields a `word` address (compile-time when possible)
-   `peek(addr: word): byte` / `poke(addr: word, value: byte): void` as **explicit imports** from `c64:mem`
    (recommended)

Toolchains may add a `ptr<T>` surface type in v0.1.x, but it is not required by this spec.

---

## 4. Storage Classes and Placement

Every variable is static. Storage is expressed via a **storage prefix** and optional placement.

### 4.1 Declarations

```
zp   var frame: byte
ram  var bulletsX: byte[8]
data var palette: byte[16] = [ 0x00, 0x06, 0x0E, 0x0B, /* ... */ ]
const var msg: string(16) = "SCORE:"
io   var VIC_BORDER: byte @ $D020
```

```ebnf
storage    ::= "zp" | "ram" | "data" | "const" | "io"
var_decl   ::= [storage] ("var" | "const") ident ":" type_expr [placement] [ "=" init ] newline
placement  ::= "@" (hex_lit | int_lit)
```

Notes:

-   `const` means read-only intent; final placement may be ROM or a read-only segment depending on linker config.
-   `io` declarations must be placed explicitly with `@ $D000`-range addresses.
-   The compiler may infer `ram` for uninitialized vars and `data` for initialized vars if storage is omitted.

---

## 5. Strings

Strings are **fixed-capacity buffers**: `string(N)`.

```
ram  var hudLine: string(40)
const var labelScore: string(8) = "SCORE:"
```

### 5.1 String literal assignment

-   A quoted literal may be assigned only to `string(N)`.
-   If the literal exceeds capacity:
    -   default behavior: **truncate**
    -   debug option may emit a warning or error.

### 5.2 Template strings (restricted)

Template strings are allowed **only** when assigning to a `string(N)` buffer, and only with predictable placeholders.

```
// allowed (examples)
hudLine = `S:${hex(score)} L:${lives}`
```

Allowed placeholders (v0.1):

-   `${byteVar}`
-   `${wordVar}`
-   `${hex(byteVar)}`
-   `${hex(wordVar)}`
-   `${padN(wordVar)}` (toolchain-defined `N`, e.g. pad2/pad4)

Forbidden:

-   function calls inside `${...}` (except the allowed formatting intrinsics above)
-   arbitrary expressions
-   dynamic concatenation requiring allocation

Lowering:

-   constant copies + emitted formatting helpers **only if used**.

---

## 6. Expressions and Operators

### 6.1 Numeric operators

Arithmetic:

-   `+ - * / %`

Comparisons:

-   `== != < <= > >=`

Boolean:

-   `and or not`

Bitwise (first-class):

-   `& | ^ ~ << >>`

Assignment:

-   `= += -= *= /= %=`
-   `&= |= ^= <<= >>=`

### 6.2 Operator precedence (high → low)

1. Postfix: `()` `[]` `.`
2. Unary: `+ - ~ not`
3. Multiplicative: `* / %`
4. Additive: `+ -`
5. Shifts: `<< >>`
6. Bitwise AND: `&`
7. Bitwise XOR: `^`
8. Bitwise OR: `|`
9. Comparisons: `< <= > >=`
10. Equality: `== !=`
11. Logical AND: `and`
12. Logical OR: `or`
13. Assignment: `= += ...`

Notes:

-   `^` is **bitwise XOR** in Blend64 (unlike Blend).
-   Expensive ops (e.g. 16-bit multiply/divide) may lower to helper routines.

---

## 7. Statements and Control Flow

### 7.1 If

```
if a == 0 then
    // ...
else
    // ...
end if
```

### 7.2 While (infinite loops allowed)

```
while true
    // main game loop
end while
```

No sandbox iteration limits exist.

### 7.3 For

Two forms are allowed:

#### Range form

```
for i = 0 to 39
    // ...
next
```

#### Range form with step

```
for i = 39 to 0 step -1
    // ...
next
```

`i` is a **static loop variable** (see §8.3), not a local.

### 7.4 Match

Match is allowed as a statement or expression, but must lower predictably.

```
match state
    case 0:
        // ...
    case 1:
        // ...
    case _:
        // ...
end match
```

Allowed patterns (v0.1):

-   literals (`case 3:`)
-   ranges (`case 10..15:`)
-   wildcard default (`case _:`)

Guards are **not** included in v0.1.

Lowering strategies (compiler choice):

-   compare chains
-   jump tables when safe and profitable

### 7.5 Break / Continue / Return

-   `break`, `continue` valid inside loops.
-   `return` may return only scalar types (`byte`, `word`, `boolean`) or no value (`void`).

---

## 8. Functions

### 8.1 Declaration

```
function add(a: byte, b: byte): byte
    return a + b
end function
```

```ebnf
fn_decl ::= ["export"] "function" ident "(" [params] ")" [ ":" ret_type ] newline
           { statement }*
           "end" "function" newline
params   ::= param { "," param }*
param    ::= ident ":" type_expr
ret_type ::= "byte" | "word" | "boolean" | "void"
```

### 8.2 Restrictions

-   No nested functions.
-   No closures/lambdas.
-   No recursion (compile-time error; includes mutual recursion).
-   No returning records or arrays.
-   Parameters are passed in a compiler-defined calling convention (typically A/X/Y + scratch/ZP).
-   Any scratch storage used is compiler-managed and visible in the memory map.

### 8.3 No locals: “static temps” and loop variables

Blend64 v0.1 has **no local variables**. To write readable code, the language supports:

-   module-scoped variables (`ram var tmp: byte`)
-   function-scoped _static temps_ declared at module scope with a naming convention (recommended) or explicit storage

Example pattern:

```
module Game.Math

ram var tmp0: word
ram var tmp1: word

function mulAdd(a: word, b: word, c: word): word
    tmp0 = a * b
    tmp1 = tmp0 + c
    return tmp1
end function
```

The compiler may additionally provide an optional feature:

-   `temp var name: type` inside a function that is **lowered** into a unique static symbol (still global storage). This
    is purely a readability feature and does not allocate on stack.

(If enabled, temps must be proven non-aliased across interrupts or re-entrancy, or rejected.)

---

## 9. Builtins and Standard Modules

Blend64 has **no implicit standard library**.

### 9.1 Toolchain modules (recommended set for v0.1)

These names are conventional; a developer can implement their own modules.

-   `c64:mem` — `peek`, `poke`, `memcpy`, `memset`
-   `c64:vic` — VIC-II register helpers, screen pointers
-   `c64:cia` — CIA timers, keyboard/joystick scanning helpers
-   `c64:irq` — IRQ install/enable/ack helpers
-   `c64:sid` — SID access / music driver glue
-   `c64:sprites` — sprite pointer table + enable/pos helpers

All module code is still subject to reachability DCE.

### 9.2 Intrinsics (compiler-known)

The compiler may recognize and lower these as intrinsics:

-   `addr(symbolOrIndexedExpr): word`
-   formatting intrinsics used by template strings: `hex(x)`, `padN(x)`

Intrinsics must not imply always-linked helpers.

---

## 10. Entry Points, Reachability Roots, and Output

### 10.1 Entry point

A program must export exactly one entry:

```
export function main(): void
```

This is a reachability root.

### 10.2 Optional roots

Toolchain may support additional explicit roots:

-   `@entry` attribute on a function (future)
-   configuration file listing roots (build-system)

### 10.3 Output artifacts

The compiler outputs:

-   `.prg` (binary)
-   optional `.map` (memory map)
-   optional `.sym` (symbols)
-   optional `.lst` (annotated listing)

---

## 11. The Mandatory Magic Phase

After parsing and typechecking, the compiler performs a **magic phase** that:

-   desugars constructs (e.g. `extends` flattening)
-   enforces static memory rules (no heap / no locals / fixed sizes)
-   selects helper routines for expensive operations
-   builds a complete call graph
-   proves or rejects string-capacity operations
-   prepares IR for 6502 codegen and dead-code elimination

No feature may bypass this phase.

---

## 12. Minimal Grammar Summary (EBNF excerpt)

```ebnf
source      ::= { module_file }*
module_file ::= module_decl { import_decl }* { top_decl }*

top_decl    ::= var_decl | type_decl | fn_decl

statement   ::= if_stmt | while_stmt | for_stmt | match_stmt
              | break_stmt | continue_stmt | return_stmt
              | expr_stmt

expr        ::= assignment
```

(Full grammar is toolchain-defined; v0.1 focuses on deterministic compilation rather than maximal surface area.)

---

## End

```

```
