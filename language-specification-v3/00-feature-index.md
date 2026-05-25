# Blend65 v3 — Language Feature Index

> **Created**: May 25, 2026  
> **Purpose**: Central index tracking every language feature, design decision, and error code.  
> **Usage**: Each feature has its own file in `features/`. This index provides the overview and the canonical error code registry.

---

## Design Axioms

These are foundational decisions — not features. They are **givens** that all features must respect.

| ID | Axiom | Description |
|----|-------|-------------|
| A1 | C-like syntax | Curly braces, semicolons, `name: type` annotations, C-style operators |
| A2 | Static Frame Allocation (SFA) | All memory allocation at compile time. No heap, no recursion, static call graph |
| A3 | No undefined behavior | Every input produces a defined result or a compile-time error (Language Guard H5) |
| A4 | Explicit over implicit | No hidden code execution, no implicit conversions, no magic |
| A5 | Multi-platform | Must compile to all target platforms: C64, C64 Ultimate, CX16, Atari 800XL, Atari 7800 |

---

## Feature Summary

| ID | Feature | Status | Guard | File |
|----|---------|--------|-------|------|
| F001 | Multi-file compilation | ✅ Accepted | Pass | [features/F001-multi-file.md](features/F001-multi-file.md) |
| F002 | Module declarations | ✅ Accepted | Pass | [features/F002-modules.md](features/F002-modules.md) |
| F003 | Module contents & visibility | ✅ Accepted | Pass | [features/F003-module-contents.md](features/F003-module-contents.md) |
| F004 | Program entry point | ✅ Accepted | Pass | [features/F004-entry-point.md](features/F004-entry-point.md) |
| F005 | Memory placement | ✅ Accepted | Pass | [features/F005-memory-placement.md](features/F005-memory-placement.md) |
| F006 | Address-of operator (`&`) | ✅ Accepted | Pass | [features/F006-address-of.md](features/F006-address-of.md) |
| F007 | Interrupt functions | ✅ Accepted | Pass | [features/F007-interrupt-functions.md](features/F007-interrupt-functions.md) |
| F008 | For loop | ✅ Accepted | Pass | [features/F008-for-loop.md](features/F008-for-loop.md) |
| F009 | Switch statement | ✅ Accepted | Pass | [features/F009-switch-statement.md](features/F009-switch-statement.md) |
| F010 | Signed types (`sbyte`, `sword`) | ✅ Accepted | Pass | [features/F010-signed-types.md](features/F010-signed-types.md) |
| F011 | Structs | ✅ Accepted | Pass | [features/F011-structs.md](features/F011-structs.md) |
| F012 | CPU control intrinsics | ✅ Accepted | Pass | [features/F012-cpu-control-intrinsics.md](features/F012-cpu-control-intrinsics.md) |
| F013 | Control flow (if/else, while, do-while, block scoping) | ✅ Accepted | Pass | [features/F013-control-flow.md](features/F013-control-flow.md) |

---

## Related Documents

| Document | Description |
|----------|-------------|
| [future-considerations.md](future-considerations.md) | Deferred features (FUT-001 through FUT-011) |
| [../\.clinerules/language-guard.md](../.clinerules/language-guard.md) | Language Guard — 23 rules, 5 escape hatch tiers |

---

## Appendix: Error Code Registry

All error codes use a 5-digit format starting at 10000.

| Code | Feature | Message |
|------|---------|---------|
| E10001 | F002 | Module declaration required — every source file must begin with `module <name>;` |
| E10002 | F002 | Only one module declaration allowed per source file |
| E10003 | F002 | Duplicate declaration `<name>` in module `<module>` (also declared in `<file>`) |
| E10010 | F003 | Executable statements are not allowed at module level — place code inside a function |
| E10011 | F003 | Module-level initializer must be a compile-time constant expression |
| E10020 | F004 | No entry point found — define a `function main(): void` in any module |
| E10021 | F004 | Multiple entry points found — `main` is defined in module `<A>` and module `<B>`. Only one is allowed |
| E10022 | F004 | Entry point `main` must have signature `function main(): void` — found `<actual signature>` |
| E10030 | F005 | Only one `zeropage` block is allowed per module — combine all zero-page declarations into a single block |
| E10031 | F005 | Constants are not allowed in `zeropage` — zero page is for mutable runtime data. Use module-level `const` instead |
| E10032 | F005 | Zero-page budget exceeded — used `<N>` bytes, platform `<platform>` allows `<M>` bytes (range `<start>`–`<end>`) |
| E10033 | F005 | Unexpected `<keyword>` in zeropage block — declarations use `name: type` syntax without let/const |
| E10040 | F006 | Cannot take address of constant `<name>` — scalar constants are inlined and have no memory address |
| E10041 | F006 | Cannot take address of parameter `<name>` — copy it to a local variable first |
| E10042 | F006 | Cannot take address of `<expr>` — address-of is only supported on named variables and functions |
| E10043 | F006 | Cannot take address of `<expr>` — address-of requires a named variable or function |
| E10050 | F007 | Interrupt function `<name>` must have signature `(): void` — found `<actual>` |
| E10051 | F007 | Cannot call interrupt function `<name>` directly — use `&<name>` to get its address for installation |
| E10060 | F008 | Cannot assign to for-loop variable `<name>` — loop variables are read-only |
| E10061 | F008 | Step value must not be zero — this would create an infinite loop |
| E10062 | F008 | Variable `<name>` already declared in enclosing for-loop — use a different name |
| E10063 | F008 | `<keyword>` can only be used inside a loop body |
| E10070 | F009 | Duplicate case value `<value>` — already used at line `<N>` |
| E10071 | F009 | Case value must be a compile-time constant — `<expr>` cannot be evaluated at compile time |
| E10072 | F009 | Case value type `<case_type>` does not match switch expression type `<switch_type>` |
| E10073 | F009 | `fallthrough` has no effect — this is the last case in the switch |
| E10074 | F009 | `fallthrough` must be the last statement in a case body — it cannot be inside an if/while/for block, and no statements may follow it |
| E10075 | F009 | Cannot switch on type `<type>` — switch expression must be `byte`, `sbyte`, `word`, `sword`, or an enum type |
| E10076 | F009 | Only one `default` clause is allowed per switch statement |
| E10080 | F010 | Cannot implicitly convert `<from_type>` to `<to_type>` — use explicit cast: `<to_type>(<expr>)` |
| E10081 | F010 | Cannot mix signed type `<type_a>` with unsigned type `<type_b>` in expression — cast one operand |
| E10082 | F010 | Cannot implicitly narrow `<from_type>` to `<to_type>` — use explicit cast: `<to_type>(<expr>)` |
| E10083 | F010 | Cannot negate unsigned type `<type>` — use `sbyte`/`sword` for signed arithmetic |
| E10084 | F010 | Value `<value>` out of range for type `<type>` (range: `<min>` to `<max>`) |
| E10085 | F010 | Array index must be unsigned type (`byte` or `word`) — found `<type>` |
| E10086 | F010 | Cannot cast `<from_type>` to `<to_type>` — boolean is not convertible to/from integer types |
| E10090 | F011 | Struct `<name>` must have at least one field |
| E10091 | F011 | Struct `<name>` cannot contain a field of its own type — self-referencing structs are not allowed |
| E10092 | F011 | Circular struct dependency: `<struct_a>` contains `<struct_b>` which contains `<struct_a>` |
| E10093 | F011 | Cannot return struct type `<name>` from function — pass a struct parameter instead |
| E10094 | F011 | Cannot pass `const` struct `<name>` as function parameter — copy to a mutable variable first |
| E10095 | F011 | Cannot compare structs with `<op>` — compare individual fields instead |
| E10096 | F011 | Struct literal must initialize all fields — missing field `<field>` |
| E10097 | F011 | Struct literal fields must be in declaration order — expected `<expected>`, found `<found>` |
| E10100 | F013 | Condition must be type `boolean` — found `<type>`. Use an explicit comparison (e.g., `<expr> != 0`) |
| E10101 | F013 | Variable `<name>` shadows declaration in enclosing scope (line `<N>`) — use a different name |

### Warning Codes

| Code | Feature | Message |
|------|---------|---------|
| W10030 | F005 | Zero-page usage is `<N>`/`<M>` bytes (`<percent>`%) for platform `<platform>` — consider moving less critical variables to RAM |
| W10060 | F008 | Loop counter `<name>` uses `word` but range fits in `byte` — use `byte` for faster loop execution (6-7 cycles/iteration vs 15-20) |
| W10070 | F009 | Switch expression is `word` but all case values fit in `byte` — consider using a `byte` variable for more efficient comparison (4 bytes/case vs 8 bytes/case) |
| W10100 | F010 | Signed overflow in constant expression — result wraps to `<value>` |
| W10101 | F010 | Narrowing cast from `<from_type>` to `<to_type>` truncates value `<value>` to `<result>` |
| W10110 | F011 | Struct `<name>` in zeropage uses `<N>` bytes — consider moving large structs to RAM |
| W10111 | F011 | Array of structs indexed by variable: struct size `<N>` is not a power of 2 — indexing requires multiply |
| W10112 | F011 | Possible aliasing: parameter `<a>` and `<b>` may refer to the same struct |
| W10120 | F012 | `asm_sed()` enables BCD decimal mode — Blend65 arithmetic operators (+, -) will produce BCD results. Call `asm_cld()` before resuming normal arithmetic |
