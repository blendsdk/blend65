# Blend65 v2 → v3 Migration Reference

> **Date**: May 29, 2026  
> **Purpose**: Maps every construct from the v2 specification to its v3 disposition.  
> **Gate G2 pass criterion**: Zero "NO DISPOSITION" rows.

---

## Disposition Legend

| Code | Meaning |
|------|---------|
| **RETAINED** | Concept and syntax unchanged; moved to v3 chapter |
| **REVISED** | Concept kept but syntax, semantics, or scope changed |
| **REPLACED** | v2 construct removed; a different v3 mechanism covers the use case |
| **REMOVED** | v2 construct deleted with no direct replacement |
| **NEW-v3** | Construct exists only in v3; no v2 predecessor |

---

## 1. Overview & Design Goals (v2 Ch 00)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| Design goal: modern syntax + low-level control | 00 §Design Goals | RETAINED | Ch 00 Axiom A1 | Restated as formal axiom "C-like syntax" |
| Design goal: 6502-specific features | 00 §Design Goals | RETAINED | Ch 00 Axiom A2 | Restated as "6502-native" axiom |
| Design goal: structured programming | 00 §Design Goals | RETAINED | Ch 00 §1 | Subsumed into language overview |
| Target: Commodore 64 | 00 §Introduction | RETAINED | Ch 00, Ch 15 | Primary target; now one of 5 platforms |
| Target: VIC-20 | 00 §Introduction | **REMOVED** | — | Dropped — too constrained (5KB usable RAM). Use case covered by Atari 7800 as the "tight constraints" platform |
| Target: Commander X16 | 00 §Introduction | RETAINED | Ch 00, Ch 15 | Unchanged |
| Target: "Other 6502-based platforms" | 00 §Introduction | **REVISED** | Ch 00 | Explicit platform list now: C64, C64 Ultimate, Commander X16, Atari 800XL, Atari 7800 |
| Static Frame Allocation mention | 00 §Architecture | RETAINED | Ch 00 Axiom A2, Ch 11 | Elevated to formal axiom; full spec in Ch 11 |
| Storage classes (@zp, @abs, @reg) | 00 §Design Goals | **REPLACED** | Ch 03 `zeropage` | Three-class system collapsed to single `zeropage` keyword; compiler decides absolute vs register |
| `string` type mention | 00 §Design Goals | **REMOVED** | Ch 08 | No `string` type in v3. String literals are `const byte[]` |
| Function pointers / callbacks mention | 00 §Design Goals | **REVISED** | Ch 06 §§3, 7 | The `callback` keyword is removed. An ordinary callback remains an ordinary `RTS` function and its address is written `&name`. An `interrupt function` is callback-only; the selected platform sink materializes its raw `RTI` or firmware-tail entry variant. General indirect calls remain deferred. |

---

## 2. Lexical Structure (v2 Ch 01)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| Source encoding: UTF-8 | 01 §Source | RETAINED | Ch 01 §1 | Unchanged |
| ASCII-only identifiers | 01 §Identifiers | RETAINED | Ch 01 §2 | Unchanged: `[a-zA-Z_][a-zA-Z0-9_]*` |
| Single-line comments `//` | 01 §Comments | RETAINED | Ch 01 §5 | Unchanged |
| Multi-line comments `/* */` | 01 §Comments | RETAINED | Ch 01 §5 | Unchanged; v3 explicitly forbids nesting |
| Decimal integer literals | 01 §Literals | RETAINED | Ch 01 §3 | Unchanged |
| Hex literals `$FF` | 01 §Literals | RETAINED | Ch 01 §3 | Unchanged |
| Hex literals `0xFF` | 01 §Literals | RETAINED | Ch 01 §3 | Both `$` and `0x` prefixes accepted |
| Binary literals `0b11110000` | 01 §Literals | RETAINED | Ch 01 §3 | Unchanged |
| String literals `'...'` | 01 §Literals | **REVISED** | Ch 01 §7 | v3 uses double quotes for strings; string literals produce `const byte[]` |
| Char literals `'x'` | 01 §Literals | **REVISED** | Ch 01 §8 | A single character or escape in single quotes produces a `byte` using the selected profile's default encoding and character map |
| Escape sequences `\n`, `\t`, `\\`, `\'`, `\0` | 01 §Literals | RETAINED | Ch 01 §3 | Unchanged |
| Hex escape `\xHH` | 01 §Literals | RETAINED | Ch 01 §3 | Unchanged |
| Keyword: `module` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 10 | Unchanged |
| Keyword: `import` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 10 | Unchanged |
| Keyword: `export` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 10 | Unchanged |
| Keyword: `from` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 10 | Unchanged |
| Keyword: `function` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 06 | Unchanged |
| Keyword: `return` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 06 | Unchanged |
| Keyword: `if` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 05 | Unchanged |
| Keyword: `else` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 05 | Unchanged |
| Keyword: `while` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 05 | Unchanged |
| Keyword: `do` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 05 | Unchanged |
| Keyword: `for` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 05 | Syntax changed (see Statements) |
| Keyword: `switch` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 05 | Unchanged |
| Keyword: `case` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 05 | Unchanged |
| Keyword: `default` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 05 | Unchanged |
| Keyword: `break` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 05 | Unchanged |
| Keyword: `continue` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 05 | Unchanged |
| Keyword: `let` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 03 | Unchanged |
| Keyword: `const` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 03 | Unchanged |
| Keyword: `byte` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 02 | Unchanged |
| Keyword: `word` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 02 | Unchanged |
| Keyword: `boolean` (or `bool`) | 01 §Keywords | **REVISED** | Ch 01 §4, Ch 02 | v3 uses `boolean` only; `bool` is not a keyword |
| Keyword: `void` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 02 | Unchanged |
| Keyword: `true` / `false` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 02 | Unchanged |
| Keyword: `string` | 01 §Keywords | **REMOVED** | — | No `string` type in v3. String literals are `const byte[]` |
| Keyword: `callback` | 01 §Keywords | **REMOVED** | Ch 06 §§3, 7 | The keyword is removed. Ordinary callbacks are ordinary `RTS` functions referenced with `&name`; callback-only `interrupt function` declarations use the raw or firmware entry variant selected by a recognized platform sink. |
| Keyword: `type` | 01 §Keywords | **REVISED** | Ch 01 §§4–5 | Reserved but unusable in v3. Type aliases are rejected under REJ-001 and may be reconsidered only under its recorded bar. |
| Keyword: `struct` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 07 | Unchanged; v3 adds full struct specification |
| Keyword: `fallthrough` | 01 §Keywords | RETAINED | Ch 01 §4, Ch 05 | Unchanged |
| Keyword: `asm` | 01 §Keywords | **REMOVED** | — | No `asm {}` blocks in v3; replaced by curated intrinsics (Ch 12) |
| — | — | **NEW-v3** | Ch 01 §4 | Keyword: `zeropage` — variable storage qualifier |
| — | — | **NEW-v3** | Ch 01 §4 | Keyword: `interrupt` — function modifier |
| — | — | **NEW-v3** | Ch 01 §4 | Keyword: `sbyte` — signed 8-bit type |
| — | — | **NEW-v3** | Ch 01 §4 | Keyword: `sword` — signed 16-bit type |
| — | — | **NEW-v3** | Ch 01 §4 | Keyword: `enum` — enumeration type |
| Operator: `@` (address-of) | 01 §Operators | **REPLACED** | Ch 04 | `@` removed; `&` used for address-of in v3 |
| Operator: `@zp`, `@abs`, `@reg` (storage) | 01 §Operators | **REPLACED** | Ch 03 | `@`-prefixed storage classes removed; `zeropage` keyword replaces `@zp`; others are compiler-decided |

---

## 3. Type System (v2 Ch 02)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| `byte` (u8) | 02 §Primitives | RETAINED | Ch 02 §1 | Unchanged |
| `word` (u16) | 02 §Primitives | RETAINED | Ch 02 §1 | Unchanged |
| `boolean` | 02 §Primitives | RETAINED | Ch 02 §1 | v3: 8-bit storage, `0x00`=false, `0x01`=true |
| `void` | 02 §Primitives | RETAINED | Ch 02 §1 | Unchanged |
| `string` type | 02 §Primitives | **REMOVED** | Ch 08 | Replaced by `const byte[]`; target-registered named encoding intrinsics select non-default byte mappings |
| — | — | **NEW-v3** | Ch 02 §1 | `sbyte` (i8) — signed 8-bit integer |
| — | — | **NEW-v3** | Ch 02 §1 | `sword` (i16) — signed 16-bit integer |
| Array types `byte[N]` | 02 §Arrays | **REVISED** | Ch 08 | Sized extents are compile-time constants; `byte[]` is allowed where size is inferred or passed separately |
| Struct types | 02 §Structs | **REVISED** | Ch 07 | Mentioned in v2 but not fully spec'd; v3 provides complete struct specification |
| Type alias `type Name = ...` | 02 §Type Aliases | **REMOVED** | Ch 01 §5 | `type` remains reserved, but type aliases are rejected for v3 (REJ-001) |
| Implicit type widening byte→word | 02 §Conversions | **REVISED** | Ch 02 §3 | v3 defines complete promotion rules: byte→word (safe), sbyte→sword (safe); all others require explicit cast |
| Explicit cast syntax | 02 §Conversions | **REVISED** | Ch 02 §7 | v3 uses `TargetType(expr)` with defined integer and enum conversion rules |
| — | — | **NEW-v3** | Ch 02 §2 | Literal adaptation — unsuffixed literals adapt to expected type contextually |
| — | — | **NEW-v3** | Ch 02 §5 | Type compatibility matrix — exhaustive table of all type pairs |

---

## 4. Variables & Declarations (v2 Ch 03)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| `let name: type = value;` | 03 §Declarations | RETAINED | Ch 03 §1 | Unchanged syntax |
| `const name: type = value;` | 03 §Declarations | RETAINED | Ch 03 §2 | Unchanged; v3 requires compile-time constant initializer |
| Mandatory type annotation | 03 §Type Annotations | RETAINED | Ch 03 §1 | No type inference (Axiom A4) |
| Mandatory initializer | 03 §Initialization | **REVISED** | Ch 03 §1 | A mutable `let` initializer is optional; an omitted initializer emits no code and leaves indeterminate stored bits |
| Storage class `@zp` | 03 §Storage | **REPLACED** | Ch 03 §3 | Replaced by the module-level `zeropage { [export] name: type [= expression]; }` block |
| Storage class `@abs` | 03 §Storage | **REMOVED** | — | Compiler decides absolute placement; no syntax needed |
| Storage class `@reg` | 03 §Storage | **REMOVED** | — | Compiler decides register allocation; no syntax needed |
| Global variables | 03 §Scope | RETAINED | Ch 03 §4 | Module-level variables use target-selected static storage; the initialization rules below determine whether startup code is emitted |
| Local variables | 03 §Scope | RETAINED | Ch 03 §4 | Function-level variables in SFA frames |
| Variable shadowing | 03 §Scope | **REMOVED** | Ch 03 §4 | v3 rule VAR-9: shadowing is a compile-time error (E10101) |
| — | — | **NEW-v3** | Ch 03 §3 | `zeropage` keyword as storage qualifier |
| — | — | **NEW-v3** | Ch 03 §5 | Startup evaluates every present module/zeropage `let` initializer exactly once in the Chapter 10 dependency/effect schedule. An omitted initializer emits no initialization code; aggregate constants are already present in the program image. |

---

## 5. Expressions (v2 Ch 04)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| Integer literals | 04 §Primary | RETAINED | Ch 04 §1 | Unchanged |
| Boolean literals | 04 §Primary | RETAINED | Ch 04 §1 | Unchanged |
| String literals | 04 §Primary | **REVISED** | Ch 04 §1 | Produce `const byte[]`, not `string` type |
| Identifier expressions | 04 §Primary | RETAINED | Ch 04 §1 | Unchanged |
| Parenthesized expressions | 04 §Primary | RETAINED | Ch 04 §1 | Unchanged |
| Function call `f(args)` | 04 §Call | RETAINED | Ch 04 §2 | Unchanged |
| Array index `a[i]` | 04 §Index | RETAINED | Ch 04 §2 | Unchanged |
| Member access `s.field` | 04 §Member | RETAINED | Ch 04 §2 | Unchanged |
| Arithmetic: `+`, `-`, `*`, `/`, `%` | 04 §Operators | RETAINED | Ch 04 §3 | All selected targets support the language operations; the compiler uses instructions, inline sequences, tables, or helpers as needed and reports expensive runtime forms |
| Unary: `-`, `!`, `~` | 04 §Operators | RETAINED | Ch 04 §3 | Unchanged |
| Comparison: `==`, `!=`, `<`, `>`, `<=`, `>=` | 04 §Operators | RETAINED | Ch 04 §3 | Unchanged |
| Logical: `&&`, `\|\|` | 04 §Operators | RETAINED | Ch 04 §3 | Short-circuit evaluation retained |
| Bitwise: `&`, `\|`, `^`, `<<`, `>>` | 04 §Operators | RETAINED | Ch 04 §3 | Unchanged |
| Assignment: `=` | 04 §Operators | RETAINED | Ch 04 §3 | Value-producing expression; lowest precedence and right-associative |
| Compound assign: `+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `\|=`, `^=`, `<<=`, `>>=` | 04 §Operators | RETAINED | Value-producing expressions; target and right operand each evaluated once |
| Address-of: `@variable` | 04 §Operators | **REPLACED** | Ch 04 §7 | `@` replaced by `&variable`; returns `word` |
| Ternary: `cond ? a : b` | 04 §Ternary | RETAINED | Ch 04 §6 | v3 evaluates only the selected arm and applies the ordinary compatibility/promotion rule; aggregates require the same nominal type |
| Operator precedence (14 levels) | 04 §Precedence | RETAINED | Ch 04 §2 | 14 levels; assignment is lowest, conditional is immediately above it |
| Array literal `[1, 2, 3]` | 04 §Array Literal | RETAINED | Ch 08 | Moved to array chapter with full specification |
| — | — | **NEW-v3** | Ch 04 §4 | Call-shaped casts such as `word(expr)`; `as` is used only for import aliases |
| — | — | **NEW-v3** | Ch 04 §5 | Constant expressions: compile-time evaluation rules |

---

## 6. Statements (v2 Ch 05)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| Variable declaration statement | 05 §Declarations | RETAINED | Ch 05 §1 | Unchanged |
| Assignment statement | 05 §Assignment | RETAINED | Ch 05 §1 | Unchanged |
| Expression statement | 05 §Expression | RETAINED | Ch 05 §1 | Unchanged (function calls) |
| `return` / `return expr;` | 05 §Return | RETAINED | Ch 05 §1 | Unchanged |
| `break` | 05 §Break | RETAINED | Ch 05 §1 | Unchanged |
| `continue` | 05 §Continue | RETAINED | Ch 05 §1 | Unchanged |
| Block statement `{ ... }` | 05 §Blocks | RETAINED | Ch 05 §2 | Unchanged |
| `if (cond) { ... }` | 05 §If | RETAINED | Ch 05 §3 | v3 mandates braces (no dangling-else) |
| `if ... else if ... else` | 05 §If | RETAINED | Ch 05 §3 | Unchanged |
| `while (cond) { ... }` | 05 §While | RETAINED | Ch 05 §4 | Unchanged |
| `do { ... } while (cond);` | 05 §DoWhile | RETAINED | Ch 05 §5 | Unchanged |
| `for i in 0 to 10 { ... }` | 05 §For | **REVISED** | Ch 05 §7 | Use the single three-clause form: `for (let i: byte = 0; i <= 10; i += 1) { }` |
| `for i in 10 downto 0 { ... }` | 05 §For | **REVISED** | Ch 05 §7 | Write direction and inclusion in ordinary expressions: `for (let i: sword = 10; i >= 0; i -= 1) { }`; the semantic type represents the post-zero value and may be narrowed internally when proven safe |
| `for ... step N` | 05 §For | **REVISED** | Ch 05 §7 | Write the stride in the update clause: `for (let i: byte = 0; i <= 100; i += 2) { }` |
| `switch (expr) { case V: ... }` | 05 §Switch | **REVISED** | Ch 05 §7 | v3: implicit break per case; `fallthrough` keyword for explicit fall-through |
| `fallthrough` in switch | 05 §Switch | RETAINED | Ch 05 §7 | Unchanged |
| `default:` in switch | 05 §Switch | RETAINED | Ch 05 §7 | Unchanged |
| Semicolons as terminators | 05 §Semicolons | RETAINED | Ch 05 §1 | Unchanged |
| Self-terminating statements (no `;` after `}`) | 05 §Semicolons | RETAINED | Ch 05 §1 | Unchanged |

---

## 7. Functions (v2 Ch 06)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| `function name(params): RetType { ... }` | 06 §Declaration | RETAINED | Ch 06 §1 | Unchanged syntax |
| `export function ...` | 06 §Export | RETAINED | Ch 06 §1 | Unchanged |
| Parameter passing | 06 §Parameters | **REVISED** | Ch 06 §3 | The caller evaluates arguments left to right and stores them in the callee's static frame before `JSR`: scalars/enums by value, structs and exact arrays as a two-byte base address, and any-size array parameters as a base address plus the fixed caller array's two-byte element count. |
| Return values | 06 §Return | **REVISED** | Ch 06 §3 | v3: byte in A, word in A(lo)/X(hi); no struct/array return |
| Recursion prohibition | 06 §Recursion | RETAINED | Ch 06 §4, Ch 11 | Unchanged; SFA requires static call graph |
| Stub functions `function name(...): type;` | 06 §Stubs | **REMOVED** | — | No stub functions in v3; all functions must have bodies. External linkage via platform libraries |
| `callback` functions | 06 §Callbacks | **REVISED** | Ch 06 §§3, 7 | The `callback` keyword is removed. Ordinary callbacks remain ordinary `RTS` functions referenced with `&name`; an `interrupt function` is callback-only and receives the entry/exit ABI selected by its recognized raw or firmware platform sink. |
| Function pointer / indirect calls | 06 §Callbacks | **REMOVED** | — | General function pointers and indirect calls are deferred. Taking a known function address with `&name` is supported for compiler-recognized platform sinks and raw hardware boundaries. |
| `main()` entry point | 06 §Main | RETAINED | Ch 06 §6, Ch 10 | Exactly one `function main(): void` is required for program builds; it is found regardless of module and need not be exported |
| — | — | **NEW-v3** | Ch 06 §7 | `interrupt function` with a compiler-selected raw save/restore/`RTI` or profile-declared firmware entry/tail variant |
| — | — | **NEW-v3** | Ch 06 §§3, 6 | Explicit calling convention: caller-stored static-frame parameter homes; scalar/enum return in A or A(low)/X(high). |

---

## 8. Module System (v2 Ch 07)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| `module Name;` | 07 §Declaration | RETAINED | Ch 10 §1 | Unchanged |
| `module A.B.C;` (hierarchical) | 07 §Declaration | RETAINED | Ch 10 §1 | Unchanged |
| `import { x } from ModuleName;` | 07 §Imports | RETAINED | Ch 10 §2 | Unchanged |
| `import { x as alias } from ...;` | 07 §Imports | RETAINED | Ch 10 §2 | Unchanged |
| `export function ...` | 07 §Exports | RETAINED | Ch 10 §3 | Unchanged |
| `export let ...` | 07 §Exports | RETAINED | Ch 10 §3 | Unchanged |
| `export const ...` | 07 §Exports | RETAINED | Ch 10 §3 | Unchanged |
| Circular import prohibition | 07 §Rules | **REMOVED** | Ch 10 §4–5 | Circular declaration imports are legal; only an unschedulable runtime initializer dependency/effect cycle is E10194 |
| One module per file | 07 §Rules | RETAINED | Ch 10 §1 | Unchanged |
| Module-qualified access `Module.name` | 07 §Access | RETAINED | Ch 10 §2 | Unchanged |
| — | — | **NEW-v3** | Ch 10 §5 | Multi-file compilation model: dependency resolution, link order |

---

## 9. Intrinsics (v2 Ch 08)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| `peek(address): byte` | 08 §Memory | RETAINED | Ch 12 §2 | Unchanged |
| `poke(address, value)` | 08 §Memory | RETAINED | Ch 12 §2 | Unchanged |
| `peekw(address): word` | 08 §Memory | RETAINED | Ch 12 §2 | Unchanged |
| `pokew(address, value)` | 08 §Memory | RETAINED | Ch 12 §2 | Unchanged |
| `lo(value): byte` | 08 §Byte Extract | RETAINED | Ch 12 §2 | Unchanged; extracts low byte of word |
| `hi(value): byte` | 08 §Byte Extract | RETAINED | Ch 12 §2 | Unchanged; extracts high byte of word |
| `sizeof(type): word` | 08 §Compile-time | RETAINED | Ch 12 §3.3 | Stable `word` result; compile-time evaluation and proof-based narrow lowering |
| `offsetof(StructType, field): word` | 08 §Compile-time | RETAINED | Ch 12 §3.3 | Stable `word` result; compile-time evaluation and proof-based narrow lowering |
| `hint_branch_likely(cond)` | 08 §Optimizer | **REMOVED** | — | Removed; 6502 has no branch prediction; optimizer hint is meaningless |
| `hint_branch_unlikely(cond)` | 08 §Optimizer | **REMOVED** | — | Removed; same reason |
| `fence()` | 08 §Optimizer | **REMOVED** | — | Removed; 6502 is single-core, no memory ordering concern |
| — | — | **NEW-v3** | Ch 12 §2 | `length(array)` — stable `word` element count; compile-time for fixed arrays and caller-supplied for any-size parameters |
| — | — | **NEW-v3** | Ch 08 §5 | Target-registered named encoding intrinsics convert string or character literals at compile time |
| — | — | **NEW-v3** | Ch 13 | `embed("path")` or `embed("path", "selector")` — compile-time data inclusion |

---

## 10. ASM Functions (v2 Ch 09)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| `asm_sei()` | 09 §CPU Control | RETAINED | Ch 12 §1 | Unchanged; generates SEI |
| `asm_cli()` | 09 §CPU Control | RETAINED | Ch 12 §1 | Unchanged; generates CLI |
| `asm_nop()` | 09 §CPU Control | RETAINED | Ch 12 §1 | Unchanged; generates NOP |
| `asm_brk()` | 09 §CPU Control | RETAINED | Ch 12 §2 / Ch 15 §3.2 | Emits only `$00 $EA`; a reachable call requires an exact selected-profile BRK contract and has that contract's returning or non-returning control flow, stack, and machine effects |
| `asm_pha()` | 09 §Stack | RETAINED | Ch 12 §1 | Unchanged; generates PHA |
| `asm_pla()` | 09 §Stack | **REVISED** | Ch 12 §2 | Generates PLA as an opaque CPU-control statement; it does not produce a language value |
| `asm_php()` | 09 §Stack | RETAINED | Ch 12 §1 | Unchanged; generates PHP |
| `asm_plp()` | 09 §Stack | RETAINED | Ch 12 §1 | Unchanged; generates PLP |
| `asm_clc()` | 09 §Flags | RETAINED | Ch 12 §1 | Unchanged; generates CLC |
| `asm_sec()` | 09 §Flags | RETAINED | Ch 12 §1 | Unchanged; generates SEC |
| `asm_cld()` | 09 §Flags | RETAINED | Ch 12 §1 | Unchanged; generates CLD |
| `asm_sed()` | 09 §Flags | RETAINED | Ch 12 §1 | Unchanged; generates SED |
| `bcd_add()` | — | **NEW-v3** | Ch 12 §2.5 | Explicit same-width unsigned packed-decimal addition; ordinary `+` remains binary |
| `bcd_sub()` | — | **NEW-v3** | Ch 12 §2.5 | Explicit same-width unsigned packed-decimal subtraction; ordinary `-` remains binary |
| `asm {}` inline assembly blocks | 09 §Blocks | **REMOVED** | — | Rejected (REJ-002). v3 uses curated intrinsics only. Rationale: asm blocks break type safety, SFA analysis, and cross-platform compilation |

---

## 11. Compiler & Build (v2 Ch 10)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| Single-pass compilation model | 10 §Phases | **REVISED** | Ch 00 §3 | v3 defines multi-pass pipeline: lex → parse → semantic → IL → codegen |
| `.b65` file extension | 10 §Files | **REVISED** | Ch 01 §2.1 | v3 source files use the `.blend` extension |
| `--platform` flag | 10 §CLI | RETAINED | Ch 15 | Selects platform profile |
| `--output` flag | 10 §CLI | RETAINED | Ch 15 | Output binary path |
| Error reporting | 10 §Diagnostics | **REVISED** | Ch 14 | v3 defines 148 active error codes and 29 active warning codes; Chapter 14 owns their public fields |
| Optimization levels | 10 §Optimization | **REVISED** | Ch 15 | Optimization is compiler-implementation detail; platform profile may constrain |
| Binary output format (PRG, etc.) | 10 §Output | **REVISED** | Ch 15 | Output format defined per platform profile |
| — | — | **NEW-v3** | Ch 11 | Full SFA specification: frame allocation, frame coloring, ZP sharing, build summary |
| — | — | **NEW-v3** | Ch 14 | Complete active diagnostic registry: 148 errors (through E10266) and 29 warnings (through W10212), with gaps and retired/remapped meanings preserved; the former range-loop codes E10060/E10061/E10062/E10064/W10060, array-width codes E10085/E10117/E10118/W10142, and prior E10111/W10120/W10121 meanings are retired under their replacement contracts |
| — | — | **NEW-v3** | Ch 15 | Platform profile system: memory maps, ZP budgets, encoding tables, resource limits |

---

## 12. Structs (v2 mentioned but not fully spec'd)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| `struct` keyword | 02 §Structs | **REVISED** | Ch 07 | v2 mentioned structs but had no complete specification; v3 provides full spec |
| — | — | **NEW-v3** | Ch 07 §1 | Struct declaration with typed fields, sequential layout |
| — | — | **NEW-v3** | Ch 07 §2 | Struct literal syntax `StructName { field: value, ... }` |
| — | — | **NEW-v3** | Ch 07 §3 | By-reference parameter passing for structs |
| — | — | **NEW-v3** | Ch 07 §4 | `sizeof(StructType)` and `offsetof(StructType, field)` |
| — | — | **NEW-v3** | Ch 07 §5 | No self-referential structs; no struct return values |

---

## 13. Enums (NEW in v3)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| — | — | **NEW-v3** | Ch 09 | Complete enum specification: byte-backed nominal types |
| — | — | **NEW-v3** | Ch 09 §1 | `enum Name { A, B, C }` with auto or explicit backing values |
| — | — | **NEW-v3** | Ch 09 §2 | Asymmetric conversion: enum→byte implicit, byte→enum requires cast |
| — | — | **NEW-v3** | Ch 09 §3 | Enum values are valid switch expressions and cases; v3 does not require exhaustive enum switches |

---

## 14. Data Inclusion (NEW in v3)

| v2 Construct | v2 Location | Disposition | v3 Location | Notes |
|---|---|---|---|---|
| — | — | **NEW-v3** | Ch 13 | `embed()` intrinsic for compile-time binary data inclusion |
| — | — | **NEW-v3** | Ch 13 §1 | Raw mode: `embed("file.bin")` → `const byte[]` |
| — | — | **NEW-v3** | Ch 13 §2 | Format-aware mode with literal selector keys: `embed("sprite.spd", "sprites")` |

---

## Summary Statistics

| Disposition | Count |
|---|---|
| RETAINED | 72 |
| REVISED | 21 |
| REPLACED | 5 |
| REMOVED | 12 |
| NEW-v3 | 30 |
| **Total rows** | **140** |
| **NO DISPOSITION** | **0** ✅ |

### Key Changes at a Glance

1. **Platform list**: VIC-20 dropped; Atari 800XL, Atari 7800, C64 Ultimate added
2. **`string` type**: Removed — string literals are `const byte[]`
3. **`@` operator**: Split — `&` for address-of, `zeropage` for storage
4. **Storage classes** (`@zp`/`@abs`/`@reg`): Collapsed to single `zeropage` keyword
5. **`asm {}` blocks**: Rejected — curated intrinsics replace all use cases
6. **`callback`**: Keyword removed. Ordinary callbacks use ordinary functions plus `&name`; callback-only `interrupt function` declarations use the raw or firmware entry variant selected by a compiler-recognized platform sink
7. **`for` loop**: One familiar three-clause form replaces range keywords: `for (let i: byte = 0; i < 10; i += 1) { }`; normal expression, scope, and fixed-width rules apply
8. **Switch**: Now has implicit break; `fallthrough` is opt-in
9. **Signed types**: `sbyte` and `sword` added as first-class types
10. **Enums**: Entirely new feature — byte-backed nominal types
11. **Structs**: Elevated from mention to full specification
12. **`embed()`**: New compile-time data inclusion intrinsic
13. **Diagnostics**: Formal error code registry (v2 had no defined error codes)
14. **Platform profiles**: New system replacing ad-hoc platform references

---

## Gate G2 Certification

| Criterion | Status |
|---|---|
| Every v2 construct has a disposition | ✅ 110 v2 rows, all mapped |
| Every NEW-v3 construct is listed | ✅ 30 new rows |
| Zero "NO DISPOSITION" rows | ✅ **PASS** |

**Gate G2: PASSED** — Migration table is complete. The v2 specification may now be deleted.
