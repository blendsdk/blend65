# Blend65 v3 — Language Feature Index

> **Created**: May 25, 2026  
> **Purpose**: Discovery index for every language feature, design decision, and diagnostic code.
> **Usage**: Each feature has an evaluation file in `evaluations/`. Chapter 14 is the sole canonical
> diagnostic registry; summaries here help readers find the owning feature and never redefine a
> code, severity, or message template.

---

## Design Axioms

These are foundational decisions — not features. They are **givens** that all features must respect.

| ID | Axiom | Description |
|----|-------|-------------|
| A1 | C-like syntax | Curly braces, semicolons, `name: type` annotations, C-style operators |
| A2 | Static Frame Allocation (SFA) | All memory allocation at compile time. No heap, no recursion, static call graph |
| A3 | Bounded behavior | Every input has defined control/effects/width, produces a compile-time error, or uses an explicitly registered narrow hardware-limitation exception |
| A4 | Explicit over implicit | No hidden code execution, no implicit conversions, no magic |
| A5 | Multi-platform | Must compile to all target platforms: C64, C64 Ultimate, CX16, Atari 800XL, Atari 7800 |

---

## Feature Summary

| ID | Feature | Status | Guard | File |
|----|---------|--------|-------|------|
| F001 | Multi-file compilation | ✅ Accepted | Pass | [evaluations/F001-multi-file.md](evaluations/F001-multi-file.md) |
| F002 | Module declarations | ✅ Accepted | Pass | [evaluations/F002-modules.md](evaluations/F002-modules.md) |
| F003 | Module contents & visibility | ✅ Accepted | Pass | [evaluations/F003-module-contents.md](evaluations/F003-module-contents.md) |
| F004 | Program entry point | ✅ Accepted | Pass | [evaluations/F004-entry-point.md](evaluations/F004-entry-point.md) |
| F005 | Memory placement | ✅ Accepted | Pass | [evaluations/F005-memory-placement.md](evaluations/F005-memory-placement.md) |
| F006 | Address-of operator (`&`) | ✅ Accepted | Pass | [evaluations/F006-address-of.md](evaluations/F006-address-of.md) |
| F007 | Interrupt functions | ✅ Accepted | Pass | [evaluations/F007-interrupt-functions.md](evaluations/F007-interrupt-functions.md) |
| F008 | For loop | ✅ Accepted | Pass | [evaluations/F008-for-loop.md](evaluations/F008-for-loop.md) |
| F009 | Switch statement | ✅ Accepted | Pass | [evaluations/F009-switch-statement.md](evaluations/F009-switch-statement.md) |
| F010 | Signed types (`sbyte`, `sword`) | ✅ Accepted | Pass | [evaluations/F010-signed-types.md](evaluations/F010-signed-types.md) |
| F011 | Structs | ✅ Accepted | Pass | [evaluations/F011-structs.md](evaluations/F011-structs.md) |
| F012 | CPU control and packed-BCD intrinsics | ✅ Accepted | Pass | [evaluations/F012-cpu-control-intrinsics.md](evaluations/F012-cpu-control-intrinsics.md) |
| F013 | Control flow (if/else, while, do-while, block scoping) | ✅ Accepted | Pass | [evaluations/F013-control-flow.md](evaluations/F013-control-flow.md) |
| F014 | Arrays, strings, char literals, const params | ✅ Accepted | Pass | [evaluations/F014-arrays.md](evaluations/F014-arrays.md) |
| F015 | Data inclusion (asset embedding) | ✅ Accepted | Pass | [evaluations/F015-data-inclusion.md](evaluations/F015-data-inclusion.md) |
| F016 | Type system rules | ✅ Accepted | Pass | [evaluations/F016-type-system.md](evaluations/F016-type-system.md) |
| F017 | Arithmetic, bitwise, logical, and comparison operators | ✅ Accepted | Pass | [evaluations/F017-operators.md](evaluations/F017-operators.md) |
| F018 | Functions (declaration, calling, SFA frames, recursion prohibition) | ✅ Accepted | Pass | [evaluations/F018-functions.md](evaluations/F018-functions.md) |
| F019 | Variables & constants (let/const, initialization, startup sequence) | ✅ Accepted | Pass | [evaluations/F019-variables.md](evaluations/F019-variables.md) |
| F020 | Memory intrinsics (peek/poke, lo/hi, sizeof/offsetof/length) | ✅ Accepted | Pass | [evaluations/F020-memory-intrinsics.md](evaluations/F020-memory-intrinsics.md) |
| F021 | Lexical structure (tokens, keywords, literals, operators, comments) | ✅ Accepted | Pass | [evaluations/F021-lexical-structure.md](evaluations/F021-lexical-structure.md) |
| F022 | Enums (byte-backed nominal type, asymmetric conversion) | ✅ Accepted | Pass | [evaluations/F022-enums.md](evaluations/F022-enums.md) |
| F024 | Conditional (ternary) operator (`cond ? a : b`) | ✅ Accepted | Pass | [evaluations/F024-conditional-operator.md](evaluations/F024-conditional-operator.md) |

---


## Related Documents

| Document | Description |
|----------|-------------|
| [future-considerations.md](future-considerations.md) | Deferred features (FUT-001 through FUT-019; FUT-004/FUT-005/FUT-008/FUT-019 resolved) and rejected features (REJ-001 type aliases, REJ-002 inline assembly) |
| [../\.clinerules/language-guard.md](../.clinerules/language-guard.md) | Language Guard — 23 rules, 5 escape hatch tiers |

> **Note**: Feature ID **F023** (type aliases) was consciously **rejected** and its ID is **retired** — it is never reused. See `future-considerations.md` → REJ-001 for the full decision record. The `type` keyword remains reserved (F021 LS-9).
>
> **Note**: Inline assembly — `asm { }` blocks and the full v2-style `asm_*()` opcode API — was consciously **rejected**. See `future-considerations.md` → REJ-002 for the full decision record. What Blend65 *does* provide is the 13 curated CPU-control intrinsics (F012); the sanctioned escape hatch for cycle-counted code is external assembly linking (FUT-011).



---

## Appendix: Diagnostic Discovery Index

Active diagnostic codes use a 5-digit format starting at 10000. The final column is a discovery
summary, not the public message template. See Chapter 14 for canonical wording, severity behavior,
source spans, suppression, and retirement history.

| Code | Feature | Discovery summary |
|------|---------|-------------------|
| E10001 | F002 | Module declaration required — every source file must begin with `module <name>;` |
| E10002 | F002 | Only one module declaration allowed per source file |
| E10003 | F002 | Duplicate declaration `<name>` in module `<module>` (also declared in `<file>`) |
| E10010 | F003 | Executable statements are not allowed at module level — place code inside a function |
| E10012 | Modules | Import names a non-exported declaration |
| E10020 | F004 | No entry point found — define a `function main(): void` in any module |
| E10021 | F004 | Multiple entry points found — `main` is defined in module `<A>` and module `<B>`. Only one is allowed |
| E10022 | F004 | Entry point `main` must have signature `function main(): void` — found `<actual signature>` |
| E10023 | F004 | Cannot call `main()` — it is the program entry point, not a callable function |
| E10030 | F005 | Only one `zeropage` block is allowed per module — combine all zero-page declarations into a single block |
| E10031 | F005 | Constants are not allowed in `zeropage` — zero page is for mutable runtime data. Use module-level `const` instead |
| E10032 | F005 | Zero-page budget exceeded — used `<N>` bytes, platform `<platform>` allows `<M>` bytes (range `<start>`–`<end>`) |
| E10033 | F005 | Unexpected `<keyword>` in zeropage block — declarations use `name: type` syntax without let/const |
| E10034 | Memory model | Output binary exceeds the selected platform budget |
| E10040 | F006 | Cannot take address of constant `<name>` — scalar constants are inlined and have no memory address |
| E10041 | F006 | Cannot take address of parameter `<name>` — copy it to a local variable first |
| E10042 | F006 | Cannot take address of field or array element `<expr>` — this address form is not supported |
| E10043 | F006 | Address-of requires a named variable or function — found `<expr>` |
| E10050 | F007 | Interrupt function `<name>` must have signature `(): void` — found `<actual>` |
| E10051 | F007 | Cannot call interrupt function `<name>` directly — use `&<name>` to get its address for installation |
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
| E10086 | F010 | Cannot cast `<from_type>` to `<to_type>` — boolean is not convertible to/from integer types |
| E10090 | F011 | Struct `<name>` must have at least one field |
| E10091 | F011 | Struct `<name>` cannot contain a field of its own type — self-referencing structs are not allowed |
| E10092 | F011 | Circular struct dependency: `<struct_a>` contains `<struct_b>` which contains `<struct_a>` |
| E10093 | F011 | Cannot return struct type `<name>` from function — pass a struct parameter instead |
| E10094 | F011 | Cannot pass `const` struct `<name>` to a mutable parameter — use a const parameter or a mutable copy |
| E10095 | F011 | Cannot compare structs with `<op>` — compare individual fields instead |
| E10096 | F011 | Struct literal must initialize all fields — missing field `<field>` |
| E10097 | F011 | Struct literal fields must be in declaration order — expected `<expected>`, found `<found>` |
| E10100 | F013 | Condition must be type `boolean` — found `<type>`. Use an explicit comparison (e.g., `<expr> != 0`) |
| E10101 | F013 | Variable `<name>` shadows declaration in enclosing scope (line `<N>`) — use a different name |
| E10102 | F013 | Not all code paths return a value in function `<name>` — add a return statement or ensure all branches return |
| E10110 | F014 | Array size must be a compile-time constant expression — found `<expr>` |
| E10112 | F014 | Array initializer has `<N>` elements but array size is `<M>` |
| E10113 | F014 | Const array must be fully initialized — `<N>` elements provided for size `<M>`. Use fill syntax: `[values; fill]` |
| E10114 | F014 | Fill syntax `[...; fill]` requires explicit array size — use `type[N] = [values; fill]` |
| E10115 | F014 | Fill value must be a single element — found string or array |
| E10116 | F014 | Cannot mix string literals with value elements in array initializer |
| E10119 | F014 | Cannot assign whole array — copy elements individually using a loop |
| E10120 | F014 | Cannot return array type from function — use an array parameter instead |
| E10121 | F014 | Cannot compare arrays with `<op>` — compare individual elements |
| E10122 | F014 | Cannot pass const `<name>` to mutable parameter `<param>` — add `const` to parameter or copy to mutable variable |
| E10123 | F014 | Cannot modify const parameter `<name>` — parameter is declared `const` |
| E10124 | F014 | String literal (`<N>` bytes) exceeds array size (`<M>`) |
| E10125 | F014 | Encoding or character map `<name>` is unavailable for platform `<platform>` — available: `<list>` |
| E10130 | F015 | File not found: `<path>` (searched: `<search_paths>`) |
| E10131 | F015 | Embedded file `<path>` is empty (0 bytes) |
| E10132 | F015 | Format `<format>` (`<ext>`) requires a selector |
| E10133 | F015 | Unknown selector `<selector>` for format `<format>` (`<ext>`) — available: `<list>` |
| E10134 | F015 | `embed()` can only initialize `const` declarations — found `let` |
| E10135 | F015 | `embed()` can only be used at module level |
| E10136 | F015 | `embed()` path must be a string literal |
| E10137 | F015 | No format handler registered for extension `<ext>` and selector `<selector>` specified |
| E10140 | F015 | Embedded data size mismatch: expected `<expected>` elements, got `<actual>` elements |
| E10142 | F015 | Cannot use array selector in expression context — array selectors can only initialize `const` declarations |
| E10143 | F015 | Alignment conflict: `<data>` requires `<align>`-byte alignment but placement failed |
| E10144 | F015 | Type mismatch: selector `<selector>` returns `<expected>`, declaration type is `<actual>` |
| E10150 | F016 | Type annotation required for declaration `<name>` — add `: <type>` |
| E10151 | F016 | Cannot use `boolean` in arithmetic/bitwise expression — boolean is a logical type, not numeric |
| E10152 | F016 | Cannot cast to or from `void` |
| E10153 | F016 | Cannot cast struct or array types — only integer types (`byte`, `sbyte`, `word`, `sword`) support casts |
| E10154 | F017 | Cannot apply `<op>` to `boolean` — ordered comparisons (`<`, `>`, `<=`, `>=`) are not valid for boolean operands |
| E10160 | F017 | Division by zero in constant expression |
| E10161 | F017 | Shift amount must be unsigned type (`byte` or `word`) — found `<type>` |
| E10162 | F024 | Conditional operator arms have incompatible types `<type_a>` and `<type_b>` — both arms must yield the same type (or compatible integer types) |
| E10170 | F018 | Return type required — use `function <name>(): void` for functions that return nothing |
| E10171 | F018 | Wrong argument count — `<name>()` expects `<N>` parameters, got `<M>` |
| E10172 | F018 | Argument type mismatch — parameter `<param>` of `<name>()` expects `<expected>`, found `<actual>` |
| E10173 | F018 | Cannot return a value from void function `<name>` — remove the expression or change the return type |
| E10174 | F018 | Missing return value — function `<name>` returns `<type>` but `return` has no expression |
| E10175 | F018 | `<name>` is not a function — cannot call `<type>` value as a function |
| E10176 | F018 | Cannot define function inside function `<outer>` — move `<inner>` to module level |
| E10180 | F018 | Direct recursion — function `<name>` calls itself. Blend65 uses static frame allocation which does not support recursion |
| E10181 | F018 | Indirect recursion detected — cycle: `<fn1>` → `<fn2>` → ... → `<fn1>` |
| E10190 | F019 | `const` declaration requires an initializer — constants must be initialized at declaration |
| E10191 | F019 | `const` initializer must be a compile-time constant expression — found `<expr>` |
| E10192 | F019 | Cannot assign to `const` variable `<name>` |
| E10194 | Modules | Circular module-level initializer dependency |
| E10200 | F020 | `sizeof` requires a type name — found `<expr>`. Use `sizeof(<TypeName>)` with a type like `byte`, `word`, or a struct name |
| E10201 | F020 | `offsetof` requires a struct type — found `<type>`. Only struct types have field offsets |
| E10202 | F020 | Field `<field>` not found in struct `<type>` — available fields: `<list>` |
| E10203 | F020 | `length` requires an array — found `<type>`. Use `sizeof(<TypeName>)` for type sizes |
| E10204 | Data inclusion | Format-aware asset cannot be parsed |
| E10210 | F021 | Unexpected non-ASCII character outside a string literal, character literal, or comment |
| E10211 | F021 | Unterminated block comment — expected `*/` before end of file |
| E10212 | F021 | Cannot redeclare reserved built-in `<name>` — this identifier is a built-in function/constant |
| E10213 | F021 | Invalid underscore in numeric literal — underscores must appear between digits only (no leading, trailing, or consecutive underscores) |
| E10214 | F021 | Invalid hexadecimal literal — expected hex digit (`0`–`9`, `A`–`F`) after `<prefix>` |
| E10215 | F021 | Invalid binary literal — expected binary digit (`0` or `1`) after `0b` |
| E10216 | F021 | Numeric literal value `<value>` exceeds maximum (65535) — no Blend65 type can hold values larger than 16 bits |
| E10217 | F021 | Newline in string literal — strings must be on a single line. Use `\n` for newline characters |
| E10218 | F021 | Unterminated string literal — expected closing `"` before end of line |
| E10219 | F021 | Unknown escape sequence `\<char>` — valid escapes are: `\\`, `\"`, `\'`, `\n`, `\r`, `\t`, `\0`, `\xNN` |
| E10220 | F021 | Incomplete hex escape `\x<char>` — `\x` requires exactly two hex digits (e.g., `\x41`) |
| E10221 | F021 | Empty character literal — char literals must contain exactly one character or escape sequence |
| E10222 | F021 | Multi-character literal `<literal>` — char literals must contain exactly one character. Use a string literal for multiple characters |
| E10223 | F021 | Unterminated character literal — expected closing `'` |
| E10224 | F021 | `<keyword>` is reserved for a future Blend65 version and cannot be used yet |
| E10230 | F022 | Enum member value must be a compile-time `byte` constant — found `<expr>` |
| E10231 | F022 | Enum member `<member>` references an unknown enum `<name>` — did you mean `<suggestion>`? |
| E10232 | F022 | Duplicate enum member name `<member>` in enum `<name>` |
| E10233 | F022 | Enum member value `<value>` out of range — enum members must be 0–255 (enums are byte-backed) |
| E10234 | F022 | Empty enum `<name>` — an enum must declare at least one member |
| E10235 | F022 | Cannot assign `<type>` to enum `<name>` — use an explicit cast `<name>(<expr>)` to convert a byte to this enum |
| E10236 | F022 | Cannot compare enum `<a>` with enum `<b>` — different enum types. Cast one to `byte` to compare underlying values |
| E10237 | Modules | Module declaration is not the first source item |
| E10238 | Resources | Selected target resource budget is exceeded |
| E10239 | Names | Identifier is not declared in the current scope |
| E10240 | Arrays | Statically provable array index is outside the extent |
| E10241 | Types | Type name cannot be resolved |
| E10242 | Structs | Field access names a field not present on the struct |
| E10243 | Structs | Struct initializer contains an unknown field |
| E10244 | Interrupts | Ordinary `RTS` function reaches an interrupt-handler sink |
| E10245 | SFA / stack | Execution overlap or hardware-stack use has no static bound |
| E10246 | Functions | `const` parameter is not an array or struct |
| E10247 | Interrupts | Function-address sink receives erased or unknown ABI provenance |
| E10248 | Functions / intrinsics | Explicit stack operations do not preserve a valid function-entry stack state |
| E10249 | Strings / characters | Selected encoding cannot represent a literal character or symbolic escape as the required byte |
| E10250 | F015 | `embed()` selector argument must be a string literal |
| E10251 | F014 | Character-map argument must be a string literal |
| E10252 | Interrupts / memory | Raw interrupt entry is written to a recognized incompatible firmware vector |
| E10253 | Arrays | Array storage has no explicit or initializer-inferred compile-time extent |
| E10254 | Intrinsics | Statically known packed-BCD operand contains a non-decimal nibble |
| E10255 | Intrinsics | Raw decimal state reaches an ordinary semantic boundary or mismatched control-flow join |
| E10256 | F015 / C64 audio | Embedded asset has no qualified callable player contract |
| E10257 | F015 / C64 audio | Selected player contract lacks the requested operation, cue, ID form/range, or logical voice |
| E10258 | F015 / interrupts | Reachability permits overlapping calls to a non-reentrant audio-player contract |
| E10259 | Intrinsics / platform profile | Reachable `asm_brk()` has no proven BRK control-flow and handler contract |
| E10260 | F006 / functions / SFA | Local-origin address or derived fragment may escape its dynamic source lifetime |
| E10261 | F015 / platform profile / C64 | SID asset requirements are incompatible with the selected video/SID topology or player contract |
| E10262 | F008 / control flow | Finite-looking canonical loop counter repeats before its invariant condition can become false |
| E10263 | F014 / arrays | Array index has a non-integer type |
| E10264 | F014 / arrays | Compile-time array extent is not an integer in the representable range `0..65535` |
| E10265 | F011 / F014 / aggregates | Fixed array or struct type requires more than 65535 bytes |
| E10266 | F020 / size query | `sizeof` is applied to an unsized array type with no standalone extent |

### Warning Codes

| Code | Feature | Message |
|------|---------|---------|
| W10030 | F005 | Zero-page usage is `<N>`/`<M>` bytes (`<percent>`%) for platform `<platform>` — consider moving less critical variables to RAM |
| W10033 | Memory model | RAM usage approaches the selected platform budget |
| W10070 | F009 | Switch expression is `word` but every case fits in `byte` — a byte value is cheaper to compare |
| W10100 | F010 | Known signed overflow in an ordinary runtime expression wraps at operand width |
| W10101 | F010 | Narrowing cast from `<from_type>` to `<to_type>` truncates value `<value>` to `<result>` |
| W10110 | F011 | Struct `<name>` in zeropage uses `<N>` bytes — consider moving large structs to RAM |
| W10111 | F011 | Array of structs indexed by variable: struct size `<N>` is not a power of 2 — indexing requires multiply |
| W10112 | F011 | Possible aliasing: parameter `<a>` and `<b>` may refer to the same struct |
| W10130 | F013 | Condition is always false — code block will never execute |
| W10131 | F013 | Unreachable code — statements after `<keyword>` will never execute |
| W10140 | F014 | Partially initialized array `<name>` — `<N>` of `<M>` elements initialized, remaining are indeterminate |
| W10141 | F014 | Uninitialized array `<name>` — all `<N>` elements are indeterminate |
| W10143 | F014 | Mutable array `<name>` (`<N>` RAM bytes) reaches the platform warning threshold |
| W10150 | F015 | Embedded data (`<N>` bytes) uses `<percent>`% of platform `<platform>` binary-size budget |
| W10151 | F015 | `<N>` declarations share one embedded output `<path>` selector `<selector>` and address |
| W10160 | F016 | `<narrow_type>` arithmetic may overflow before widening to `<wide_type>` — use `<wide_type>(a) <op> <wide_type>(b)` for wider arithmetic |
| W10161 | F016 | Known ordinary runtime expression wraps at narrow width before widening |
| W10170 | F017 | Runtime multiply generates subroutine call (~`<N>` cycles for `<width>`-bit) |
| W10171 | F017 | Runtime divide/modulo generates subroutine call (~`<N>` cycles for `<width>`-bit) |
| W10172 | F017 | Multiply by `<N>` generates shift-and-add sequence (~`<M>` cycles) — consider power-of-2 stride for faster access |
| W10173 | F017 | Runtime divisor is not proven nonzero; default zero result bits are unspecified |
| W10174 | F017 | Wide shift saturates: left to 0; signed negative right to -1; other right to 0 |
| W10180 | F018 | Proven simultaneous hardware-stack peak reaches the profile threshold (default: 80% of usable capacity, rounded down) |
| W10181 | F018 | Function `<name>` is never called and not exported — consider removing or adding `export` |
| W10190 | F019 | Function-local variable `<name>` may be read before initialization — value is indeterminate; module-level storage is exempt |
| W10191 | Variables | Variable is declared but never used |
| W10210 | F021 | Numeric literal has leading zeros: `<literal>` — Blend65 does not have octal literals; this is decimal `<value>` |
| W10211 | Interrupts | Cross-domain read-modify-write can lose an update |
| W10212 | Interrupts | Cross-domain multi-byte access can tear |

Retired codes, former draft collisions, and all replacement mappings are listed only in Chapter 14.
