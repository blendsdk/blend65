# Blend → Blend64 (v0.1) — Cuts and Redesigns

This document lists what was removed or redesigned when transforming the original Blend specification into Blend64 v0.1.

---

## 1. Design goal rewrite (core identity)

### Removed / Replaced
- Blend’s goal as a **JS-emitting, sandbox-safe macro language**.
- Blend’s focus on **web-app automation, host objects, DOM, ABI, runtimes**.

### Blend64 redesign
- Blend64 is **assembler-plus** for **C64 PRG output**, with:
  - no implicit runtime
  - reachability-based DCE
  - static memory planning
  - deterministic layout

---

## 2. Types

### Removed
- `integer` (32-bit), `long` (64-bit), `single`, `double`
- all floating-point semantics (promotion rules, `/` producing double, overflow runtime errors)
- nullable/optional types `T?` and `null`
- `Result[T,E]` and any polymorphic/generic surface

### Redesigned / Added
- Target-fixed primitives:
  - `byte` (8-bit)
  - `word` (16-bit)
  - `boolean` (8-bit)
  - `void`
- Optional signed types (`sbyte`, `sword`) as toolchain feature.
- `/` is integer division (toolchain-defined for byte/word), not floating division.

---

## 3. Collections

### Removed
- Dynamic arrays (`T[]`) with heap allocation and methods (`push`, `.length` as runtime property, etc.)
- `map[K,V]` (hash tables, iteration over pairs)
- spread `...` (implies dynamic container behavior)

### Redesigned
- **Fixed-size arrays only**: `byte[256]`, `word[40]`, etc.
- Indexing allowed; bounds checks are a compiler option (debug mode).

---

## 4. Strings

### Removed
- `string` as a dynamic UTF-8 runtime type
- multi-line template strings with arbitrary `${expression}` interpolation
- general string utilities as an implied stdlib (`split`, `join`, etc.)

### Redesigned
- `string(N)` fixed-capacity buffers only.
- Template strings allowed only for assignment to `string(N)` and only with restricted placeholders.
- Overflow behavior defined (default truncate; debug option may warn/error).
- Formatting lowers to helper routines only if used.

---

## 5. Variables and memory

### Removed
- `let` / local mutability semantics tied to runtime/stack
- local variable declarations (function locals)
- sandbox-driven “safety” rules like runtime loop iteration limits

### Redesigned
- All variables have **static storage**.
- Explicit storage classes: `zp`, `ram`, `data`, `const`, `io`
- Optional pinned placement: `@ $D020`
- Compiler emits memory map; may auto-promote to zero page.

---

## 6. Functions

### Removed
- Lambdas: `function(...) => expr`
- Higher-order function patterns (passing lambdas around)
- Nested functions / closures
- Recursion (allowed in Blend examples)

### Redesigned
- No recursion (compile-time error, including mutual recursion).
- No local variables; only static/global storage.
- Returns limited to scalars: `byte`, `word`, `boolean`, `void`.
- Returning records/arrays forbidden.

Optional readability feature (toolchain):
- “static temps” lowered into unique global symbols (still static storage).

---

## 7. Classes / OOP

### Removed
- Classes entirely:
  - `class`, `new`, `self`
  - visibility modifiers (`public`, `protected`)
  - constructor `init`
  - method dispatch / object model

### Replaced with
- Flat records (`type`) + functions.

---

## 8. Modules and interop

### Removed
- JS/ABI/host interop:
  - `abi:*`, `host:*`, “managed runtime interop”
  - cyclic runtime module initialization semantics
  - “host object reachability”

### Redesigned
- Modules are compile-time namespaces.
- Imports are static and toolchain-defined.
- Developers may define their own modules; `c64:*` is a conventional namespace for toolchain-provided libraries.

---

## 9. Control flow

### Removed
- Blend’s sandbox loop limits (e.g. while-loop iteration caps)

### Redesigned / Kept subset
- `if/else`, `for`, `while` (infinite allowed), `match`.
- `match` narrowed to:
  - literals
  - ranges
  - wildcard `_`
- `match` guards (`if`) removed in v0.1 to keep lowering predictable and jump-table-friendly.

---

## 10. Operators

### Removed / Changed
- Blend’s `^` exponentiation
- optional chaining `?.` and null coalescing `??` (no nullable types)

### Redesigned
- Full bitwise operator set is first-class:
  - `& | ^ ~ << >>`
- `^` is **bitwise XOR** in Blend64.
- Expensive operators may lower to helpers emitted only if used.

---

## 11. Error handling

### Removed
- `Result[T,E]` and pattern matching on `Ok/Err`
- any exception bridging

### Replacement
- explicit return codes / flags (library patterns), not language-level `Result`.

---

## 12. Standard library

### Removed
- `std:*` monolithic “standard library modules”
- implicit runtime services (GC, dynamic strings, hash maps, etc.)

### Redesigned
- No implicit stdlib.
- Toolchain may ship optional `c64:*` modules (reachable-only emission).
- Compiler intrinsics exist only when used (e.g. `addr`, string formatting helpers).

---

## 13. Entry point / reachability roots

### Redesigned
- A single exported entry point:
  - `export function main(): void`
- This root drives reachability-based dead-code elimination.

---

## End
