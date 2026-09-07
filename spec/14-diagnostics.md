# Chapter 14 — Diagnostics: Canonical Registry

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: Chapters 01–13 and their accepted feature evaluations

---

## 1. Authority and Ownership

This chapter is the only authority for a diagnostic's public code, severity, message template,
source-span shape, help behavior, suppression, promotion, and migration history. The chapter that
owns a language feature remains the authority for the predicate that triggers the diagnostic, the
rejected program behavior, and its semantic consequence.

`00-feature-index.md` is a discovery index only. Evaluation documents preserve rationale and
examples. Neither may redefine a code or public template. Compiler source and tests are evidence of
implementation status, never semantic authority.

Every active code is unique. A code is not reused after retirement, even when the old behavior is
removed. A newly required condition receives the next unused number above its severity's current
maximum unless this registry explicitly records a migration.

---

## 2. Presentation Contract

```text
error[E10042]: Cannot take address of '<expr>' — address-of is only supported on named variables and functions
  --> player.blend:42:13
   |
42 |     let p: word = &players[index];
   |                   ^^^^^^^^^^^^^^^^ unsupported address target
   |
   = help: take the address of a named object, or use an explicit runtime address calculation
```

Every diagnostic contains:

1. severity and stable code;
2. the canonical message instantiated from this registry;
3. one primary source span covering the smallest expression or declaration that proves the
   condition;
4. related spans when another declaration, call edge, initializer, or conflicting site is needed to
   understand the failure; and
5. an optional `help:` line only when a concrete source action is known. Help never weakens or adds
   semantic rules.

For generated or command-line-only failures with no source expression, the primary location is the
responsible source declaration when one exists; otherwise it is the input path or command option.
Cycle diagnostics include the complete ordered path as related locations.

### 2.1 Root Errors, Poison, and Cascade Suppression

After emitting a root error, the owning stage marks the rejected expression or declaration as
invalid (poisoned) so later checks can recover without treating it as a valid typed value. A later
stage must not emit a dependent diagnostic whose only cause is that poison, and it must not lower,
allocate, or emit code for the rejected construct. It still emits a diagnostic for any independent
violation that can be proved without assuming the poisoned construct is valid.

For example, a call with the wrong number of arguments emits **E10171** at the call. Type or lowering
errors that arise only because no valid call result exists are suppressed; an independently invalid
expression inside a supplied argument still reports its own root diagnostic. Cascade suppression
never suppresses an independent cause, converts an error into a warning, or permits an artifact to
be produced. It is deterministic and is not controlled by warning-suppression options.

| Severity | Prefix | Result |
|----------|--------|--------|
| Error | `E` | Compilation fails and no compilation artifact is produced. |
| Warning | `W` | Compilation continues unless promotion is enabled. |

Only warnings are suppressible. Suppression matches the original `W` code before warning promotion;
a suppressed warning is not promoted. Errors cannot be suppressed. Unknown, malformed, retired, or
severity-mismatched codes in a diagnostic option are command-line errors.

“No compilation artifact” includes executable/package output, assembly, object code, serialized IL,
maps, symbols, and other requested build products derived from the invalid program. Human-readable
or machine-readable diagnostics are still emitted. An explicitly requested internal recovery/debug
dump may be shown only when it is unmistakably labelled invalid and cannot enter assembly, linking,
packaging, caching, or a later compilation stage as a usable artifact.

| Flag | Effect |
|------|--------|
| `--warn-as-error` | Promote every unsuppressed warning to an error while retaining its `W` code. |
| `--warn-as-error=WXXXXX` | Promote one unsuppressed warning code. Repeatable. |
| `--suppress-warning=WXXXXX` | Suppress one warning code. Repeatable. |
| `--max-errors=N` | Stop after `N` emitted errors; default `20`. |

---

## 3. Active Error Registry

The **Owner** column names the feature whose normative chapter defines the trigger predicate.

| Code | Owner | Canonical message template |
|------|-------|----------------------------|
| E10001 | F002 / Ch 10 | `Module declaration required — every source file must begin with 'module <name>;'` |
| E10002 | F002 / Ch 10 | `Only one module declaration is allowed per source file` |
| E10003 | F002 / Ch 10 | `Duplicate declaration '<name>' in module '<module>' — also declared at <related_location>` |
| E10010 | F003 / Ch 10 | `Executable statements are not allowed at module level — place code inside a function` |
| E10012 | Ch 10 | `'<name>' is not exported from module '<module>'` |
| E10020 | F004 / Ch 10 | `No entry point found — define 'function main(): void' in any module` |
| E10021 | F004 / Ch 10 | `Multiple entry points found — 'main' is defined in modules '<A>' and '<B>'; only one is allowed` |
| E10022 | F004 / Ch 10 | `Entry point 'main' must have signature 'function main(): void' — found '<actual>'` |
| E10023 | F004 / Ch 10 | `Cannot call 'main()' — it is the program entry point, not a callable function` |
| E10030 | F005 / Ch 03 | `Only one 'zeropage' block is allowed per module — combine the declarations` |
| E10031 | F005 / Ch 03 | `Constants are not allowed in 'zeropage' — use a module-level 'const' declaration` |
| E10032 | F005 / Ch 03 | `Zero-page budget exceeded — used <N> bytes; platform '<platform>' allows <M> bytes (<start>–<end>)` |
| E10033 | F005 / Ch 03 | `Unexpected '<keyword>' in zeropage block — declare '[export] name: type [= expression];' without 'let' or 'const'` |
| E10034 | Ch 11 | `Output binary (<size> bytes) exceeds platform '<platform>' maximum binary size (<limit> bytes)` |
| E10040 | F006 / Ch 04 | `Cannot take address of constant '<name>' — an inlined scalar constant has no storage address` |
| E10041 | F006 / Ch 04 | `Cannot take address of parameter '<name>' — copy it to a local variable first` |
| E10042 | F006 / Ch 04 | `Cannot take address of field or array element '<expr>' — this address form is not supported` |
| E10043 | F006 / Ch 04 | `Address-of requires a named variable or function — found '<expr>'` |
| E10050 | F007 / Ch 06 | `Interrupt function '<name>' must have signature '(): void' — found '<actual>'` |
| E10051 | F007 / Ch 06 | `Cannot call interrupt function '<name>' directly — use '&<name>' for installation in an interrupt-entry sink` |
| E10063 | F008 / Ch 05 | `'<keyword>' can only be used inside a loop body` |
| E10070 | F009 / Ch 05 | `Duplicate case value <value> — already used at <related_location>` |
| E10071 | F009 / Ch 05 | `Case value must be a compile-time constant — '<expr>' cannot be evaluated at compile time` |
| E10072 | F009 / Ch 05 | `Case value type '<case_type>' does not match switch expression type '<switch_type>'` |
| E10073 | F009 / Ch 05 | `'fallthrough' has no effect in the last case of a switch` |
| E10074 | F009 / Ch 05 | `'fallthrough' must be the last statement in a case body and cannot be nested in another control-flow block` |
| E10075 | F009 / Ch 05 | `Cannot switch on type '<type>' — use an integer or enum expression` |
| E10076 | F009 / Ch 05 | `Only one 'default' clause is allowed per switch statement` |
| E10080 | F010 / Ch 02 | `Cannot implicitly convert '<from_type>' to '<to_type>' — use '<to_type>(<expr>)'` |
| E10081 | F010 / Ch 02 | `Cannot mix signed type '<type_a>' with unsigned type '<type_b>' — cast one operand` |
| E10082 | F010 / Ch 02 | `Cannot implicitly narrow '<from_type>' to '<to_type>' — use '<to_type>(<expr>)'` |
| E10083 | F010 / Ch 02 | `Cannot negate unsigned type '<type>' — use 'sbyte' or 'sword' for signed arithmetic` |
| E10084 | F010 / Ch 02 | `Value <value> is out of range for type '<type>' (<min>–<max>)` |
| E10086 | F010 / Ch 02 | `Cannot cast '<from_type>' to '<to_type>' — boolean is not convertible to or from an integer` |
| E10090 | F011 / Ch 07 | `Struct '<name>' must have at least one field` |
| E10091 | F011 / Ch 07 | `Struct '<name>' cannot contain a field of its own type` |
| E10092 | F011 / Ch 07 | `Circular struct dependency: <struct_a> contains <struct_b> which contains <struct_a>` |
| E10093 | F011 / Ch 07 | `Cannot return struct type '<name>' — pass a struct parameter instead` |
| E10094 | F011 / Ch 07 | `Cannot pass const struct '<name>' to a mutable parameter — declare the parameter as 'name: const <type>' or copy the value` |
| E10095 | F011 / Ch 07 | `Cannot compare structs with '<op>' — compare individual fields` |
| E10096 | F011 / Ch 07 | `Struct literal must initialize all fields — missing '<field>'` |
| E10097 | F011 / Ch 07 | `Struct literal fields must follow declaration order — expected '<expected>', found '<found>'` |
| E10100 | F013 / Ch 05 | `Condition must have type 'boolean' — found '<type>'; use an explicit comparison` |
| E10101 | F013 / Ch 05 | `'<name>' shadows a declaration in an enclosing scope at <related_location> — use a different name` |
| E10102 | F013 / Ch 06 | `Not all code paths return a value in function '<name>'` |
| E10110 | F014 / Ch 08 | `Array size must be a compile-time constant expression — found '<expr>'` |
| E10112 | F014 / Ch 08 | `Array initializer has <N> elements but the declared size is <M>` |
| E10113 | F014 / Ch 08 | `Const array must be fully initialized — <N> elements provided for size <M>; use '[values; fill]'` |
| E10114 | F014 / Ch 08 | `Fill syntax '[...; fill]' requires an explicit array size` |
| E10115 | F014 / Ch 08 | `Fill value must be one element — found a string or array` |
| E10116 | F014 / Ch 08 | `Cannot mix string literals with value elements in an array initializer` |
| E10119 | F014 / Ch 08 | `Cannot assign a whole array — copy elements explicitly` |
| E10120 | F014 / Ch 08 | `Cannot return an array type — use an array parameter` |
| E10121 | F014 / Ch 08 | `Cannot compare arrays with '<op>' — compare individual elements` |
| E10122 | F014 / Ch 08 | `Cannot pass const '<name>' to mutable parameter '<param>' — make the parameter const or copy the value` |
| E10123 | F014 / Ch 08 | `Cannot modify const parameter '<name>'` |
| E10124 | F014 / Ch 08 | `String literal (<N> bytes) exceeds array size (<M>)` |
| E10125 | F014 / Ch 08 | `Encoding or character map '<name>' is unavailable for platform '<platform>' — available: <list>` |
| E10130 | F015 / Ch 13 | `File not found: '<path>' — searched <search_paths>` |
| E10131 | F015 / Ch 13 | `Embedded file '<path>' is empty` |
| E10132 | F015 / Ch 13 | `Format '<format>' (<ext>) requires a selector — available selectors: <list>` |
| E10133 | F015 / Ch 13 | `Unknown selector '<selector>' for format '<format>' (<ext>) — available selectors: <list>` |
| E10134 | F015 / Ch 13 | `'embed()' can only initialize a const declaration — found 'let'` |
| E10135 | F015 / Ch 13 | `'embed()' can only be used at module level` |
| E10136 | F015 / Ch 13 | `'embed()' path must be a string literal` |
| E10137 | F015 / Ch 13 | `No format handler is registered for extension '<ext>' with selector '<selector>'` |
| E10140 | F015 / Ch 13 | `Embedded data size mismatch — expected <expected> elements, got <actual>` |
| E10142 | F015 / Ch 13 | `Array selector cannot be used as a scalar expression` |
| E10143 | F015 / Ch 13 | `Alignment conflict — '<data>' requires <align>-byte alignment but placement failed` |
| E10144 | F015 / Ch 13 | `Selector '<selector>' returns '<expected>', but the declaration has type '<actual>'` |
| E10150 | F016 / Ch 02 | `Type annotation required for <declaration> '<name>' — add ': <type>'` |
| E10151 | F016 / Ch 02 | `Cannot use 'boolean' in an arithmetic or bitwise expression` |
| E10152 | F016 / Ch 02 | `Cannot cast to or from 'void'` |
| E10153 | F016 / Ch 02 | `Cannot cast a struct or array — casts support integer and enum conversions only` |
| E10154 | F017 / Ch 04 | `Cannot apply '<op>' to 'boolean' — ordered comparisons are not valid for boolean operands` |
| E10160 | F017 / Ch 04 | `Division by zero in constant expression` |
| E10161 | F017 / Ch 04 | `Shift amount must have unsigned type 'byte' or 'word' — found '<type>'` |
| E10162 | F024 / Ch 04 | `Conditional arms have incompatible types '<type_a>' and '<type_b>'` |
| E10170 | F018 / Ch 06 | `Return type required — write 'function <name>(): void' for a function that returns nothing` |
| E10171 | F018 / Ch 06 | `Wrong argument count — '<name>()' expects <N> parameters, got <M>` |
| E10172 | F018 / Ch 06 | `Argument type mismatch — parameter '<param>' of '<name>()' expects '<expected>', found '<actual>'` |
| E10173 | F018 / Ch 06 | `Cannot return a value from void function '<name>'` |
| E10174 | F018 / Ch 06 | `Missing return value — function '<name>' returns '<type>' but this 'return' has no expression` |
| E10175 | F018 / Ch 06 | `'<name>' is not a function — cannot call a '<type>' value` |
| E10176 | F018 / Ch 06 | `Cannot define function '<inner>' inside function '<outer>' — move it to module level` |
| E10180 | F018 / Ch 06 | `Direct recursion — function '<name>' calls itself; use iteration or an explicit fixed-capacity work structure` |
| E10181 | F018 / Ch 06 | `Indirect recursion detected — cycle: <fn1> → <fn2> → ... → <fn1>` |
| E10190 | F019 / Ch 03 | `Const declaration '<name>' requires an initializer` |
| E10191 | F019 / Ch 03 | `Const initializer must be a compile-time constant expression — found '<expr>'` |
| E10192 | F019 / Ch 03 | `Cannot assign to const '<name>'` |
| E10194 | Ch 10 | `Circular module initializer dependency: <ordered_cycle>` |
| E10200 | F020 / Ch 04 | `'sizeof' requires a type name — found '<expr>'` |
| E10201 | F020 / Ch 04 | `'offsetof' requires a struct type — found '<type>'` |
| E10202 | F020 / Ch 04 | `Field '<field>' is not present in struct '<type>' — available fields: <list>` |
| E10203 | F020 / Ch 04 | `'length' requires an array — found '<type>'` |
| E10204 | Ch 13 | `Cannot parse '<path>' as '<format>' — <details>` |
| E10210 | F021 / Ch 01 | `Unexpected character '<char>' (U+<codepoint>) — non-ASCII characters are allowed only inside string literals, character literals, and comments` |
| E10211 | F021 / Ch 01 | `Unterminated block comment — expected '*/' before end of file` |
| E10212 | F021 / Ch 01 | `Cannot redeclare reserved built-in '<name>'` |
| E10213 | F021 / Ch 01 | `Invalid underscore in numeric literal — underscores must occur singly between digits` |
| E10214 | F021 / Ch 01 | `Invalid hexadecimal literal — expected a hexadecimal digit after '<prefix>'` |
| E10215 | F021 / Ch 01 | `Invalid binary literal — expected '0' or '1' after '0b'` |
| E10216 | F021 / Ch 01 | `Numeric literal <value> exceeds 65535` |
| E10217 | F021 / Ch 01 | `Newline in string literal — use an escape sequence` |
| E10218 | F021 / Ch 01 | `Unterminated string literal — expected closing '"' before end of line` |
| E10219 | F021 / Ch 01 | `Unknown escape sequence '\<char>' — valid escapes: '\\', '\"', '\'', '\n', '\r', '\t', '\0', '\xNN'` |
| E10220 | F021 / Ch 01 | `Incomplete hexadecimal escape — '\x' requires exactly two hexadecimal digits` |
| E10221 | F021 / Ch 01 | `Empty character literal — use exactly one character or escape sequence` |
| E10222 | F021 / Ch 01 | `Multi-character literal '<literal>' — use a double-quoted string for multiple characters` |
| E10223 | F021 / Ch 01 | `Unterminated character literal — expected closing single quote` |
| E10224 | F021 / Ch 01 | `'<keyword>' is reserved for a future Blend65 version` |
| E10230 | F022 / Ch 09 | `Enum member value must be a compile-time byte constant — found '<expr>'` |
| E10231 | F022 / Ch 09 | `Enum member '<member>' references unknown enum '<name>' — did you mean '<suggestion>'?` |
| E10232 | F022 / Ch 09 | `Duplicate enum member '<member>' in enum '<name>'` |
| E10233 | F022 / Ch 09 | `Enum member value <value> is out of range — expected 0–255` |
| E10234 | F022 / Ch 09 | `Enum '<name>' must declare at least one member` |
| E10235 | F022 / Ch 09 | `Cannot assign '<type>' to enum '<name>' — use '<name>(<expr>)'` |
| E10236 | F022 / Ch 09 | `Cannot compare enum '<a>' with enum '<b>' — cast one to 'byte'` |
| E10237 | Ch 10 | `Module declaration must be the first source item after leading comments` |
| E10238 | Ch 03 / Ch 11 / Ch 15 | `Target resource budget exceeded for '<resource>' — used <used>, available <budget> on '<platform>'` |
| E10239 | Ch 03 / Ch 05 | `'<name>' is not declared in this scope` |
| E10240 | Ch 08 | `Index <index> is provably outside array '<name>' with extent <count>` |
| E10241 | Ch 02 | `Unknown type '<name>'` |
| E10242 | Ch 07 | `Struct '<type>' has no field '<name>'` |
| E10243 | Ch 07 | `Struct initializer for '<type>' contains unknown field '<name>'` |
| E10244 | Ch 06 | `Ordinary function '<name>' uses 'RTS' and cannot be installed in interrupt-handler sink '<sink>' — use an interrupt function` |
| E10245 | Ch 06 / Ch 11 | `Execution path '<path>' can overlap or consume hardware stack without a static bound — use a bounded interrupt/callback design` |
| E10246 | Ch 06 | `Parameter '<name>' uses 'const' with non-aggregate type '<type>' — const parameters require an array or struct` |
| E10247 | Ch 06 | `Cannot prove the entry ABI of the value passed to function-address sink '<sink>' — pass a provenance-preserving function address or use an explicit raw hardware boundary` |
| E10248 | Ch 06 / Ch 11 / Ch 12 | `Explicit stack operations in '<name>' do not preserve a valid function-entry stack state on every path — <detail>` |
| E10249 | Ch 08 | `Encoding '<encoding>' cannot represent literal character or escape '<item>' as the required byte on platform '<platform>' — select an available named encoding or use '\xNN' for an exact byte` |
| E10250 | F015 / Ch 13 | `'embed()' selector must be a string literal — found '<expr>'` |
| E10251 | F014 / Ch 08 | `Character-map argument must be a string literal — available maps for '<encoding>' on '<platform>': <list>` |
| E10252 | Ch 06 / Ch 12 | `Raw interrupt-entry address for '<name>' cannot be written directly to firmware vector '<vector>' — use '<sink>' so the compiler selects the required entry variant` |
| E10253 | Ch 08 | `Array storage '<name>' has no compile-time-known extent — add '[N]' or an extent-inferencing initializer` |
| E10254 | Ch 12 | `Packed-BCD operand '<value>' contains a non-decimal digit — every nibble must be 0 through 9` |
| E10255 | Ch 12 | `Raw decimal mode reaches '<boundary>' before 'asm_cld()' — ordinary Blend65 operations require binary mode` |
| E10256 | F015 / Ch 13 / C64 | `Audio operation '<operation>' requires a qualified player contract for asset '<name>' — embedded data alone is not a callable player ABI` |
| E10257 | F015 / Ch 13 / C64 | `Audio player contract '<contract>' does not provide <detail> — available forms: <list>` |
| E10258 | F015 / C64 | `Audio operation '<operation>' can overlap non-reentrant player contract '<contract>' across '<domain_a>' and '<domain_b>'` |
| E10259 | Ch 12 / Ch 15 | `Selected platform profile '<platform>' has no proven BRK control-flow and handler contract — 'asm_brk()' cannot be analyzed safely` |
| E10260 | Ch 04 / Ch 06 / Ch 11 | `Address of local '<name>' escapes its lifetime through <sink> — local addresses may only be borrowed while '<name>' is alive or passed to a proven non-retaining parameter; move the object to module scope or pass caller-owned storage` |
| E10261 | F015 / Ch 13 / Ch 15 / C64 | `SID asset '<path>' requires <asset_configuration>, which is incompatible with profile '<profile>' selection <profile_configuration> — choose a compatible asset/profile or provide a matching qualified player contract for unknown metadata` |
| E10262 | F008 / Ch 05 | `Loop counter '<name>' repeats within <range> before condition bound <bound> can be reached — use '<suggested_type>' or make deliberate wrap/infinite control explicit` |
| E10263 | F014 / Ch 08 | `Array index must have an integer type — found '<type>'` |
| E10264 | F014 / Ch 08 | `Array extent '<expr>' must be a compile-time integer in 0..65535 — found <value_or_type>` |
| E10265 | F011 / F014 / Ch 07 / Ch 08 | `Type '<type>' requires <N> bytes — fixed array and struct types are limited to 65535 bytes` |
| E10266 | F020 / Ch 04 | `'sizeof' requires a fixed-size type — unsized array type '<type>[]' has no standalone extent` |

---

## 4. Active Warning Registry

| Code | Owner | Canonical message template |
|------|-------|----------------------------|
| W10030 | F005 / Ch 03 | `Zero-page usage is <N>/<M> bytes (<percent>%) on '<platform>'` |
| W10033 | Ch 11 | `RAM usage is <percent>% of platform '<platform>' budget` |
| W10070 | F009 / Ch 05 | `Switch expression is 'word' but every case fits in 'byte' — a byte value is cheaper to compare` |
| W10100 | F010 / Ch 02 | `Signed runtime expression '<expr>' is known to overflow at '<type>' width and wraps to <value>` |
| W10101 | F010 / Ch 02 | `Narrowing cast from '<from_type>' to '<to_type>' truncates <value> to <result>` |
| W10110 | F011 / Ch 07 | `Struct '<name>' uses <N> zero-page bytes` |
| W10111 | F011 / Ch 07 | `Variable indexing of struct array '<name>' requires multiplication by non-power-of-two size <N>` |
| W10112 | F011 / Ch 07 | `Parameters '<a>' and '<b>' may alias the same struct` |
| W10130 | F013 / Ch 05 | `Condition is always false — this block cannot execute` |
| W10131 | F013 / Ch 05 | `Unreachable code — statements after '<keyword>' cannot execute` |
| W10140 | F014 / Ch 08 | `Array '<name>' is partially initialized — <N>/<M> elements have defined values` |
| W10141 | F014 / Ch 08 | `Array '<name>' is uninitialized — all <N> elements are indeterminate` |
| W10143 | F014 / Ch 08 | `Mutable array '<name>' uses <N> RAM bytes on platform '<platform>'` |
| W10150 | F015 / Ch 13 | `Embedded data uses <N> bytes (<percent>% of '<platform>' binary-size budget)` |
| W10151 | F015 / Ch 13 | `<N> declarations share embedded output '<path>' selector '<selector>' at one address` |
| W10160 | F016 / Ch 02 | `'<narrow_type>' arithmetic may overflow before widening to '<wide_type>'` |
| W10161 | F016 / Ch 02 | `Runtime expression '<expr>' is known to wrap to <value> at '<type>' width before widening to '<wide_type>'` |
| W10170 | F017 / Ch 04 | `Runtime multiply uses a software sequence of about <N> cycles for <width>-bit operands` |
| W10171 | F017 / Ch 04 | `Runtime division or remainder uses a software sequence of about <N> cycles for <width>-bit operands` |
| W10172 | F017 / Ch 04 | `Multiply by <N> uses a shift-and-add sequence of about <M> cycles — consider a power-of-two stride when practical` |
| W10173 | F017 / Ch 04 | `Runtime divisor '<name>' is not proven nonzero — zero has an unspecified valid-width result; guard it or use '--division-zero-check'` |
| W10174 | F017 / Ch 04 | `Shift amount <N> is at least the <W>-bit width — '<<' yields 0; signed negative '>>' yields -1, otherwise '>>' yields 0` |
| W10180 | F018 / Ch 06 | `Maximum simultaneous hardware-stack use is <N> bytes on '<platform>'; usable capacity is <capacity> (calls <calls>, interrupt entries <entries>, explicit pushes <pushes>)` |
| W10181 | F018 / Ch 06 | `Function '<name>' is never called and not exported` |
| W10190 | F019 / Ch 03 | `Variable '<name>' may be read before initialization — its value is indeterminate` |
| W10191 | Ch 03 | `Variable '<name>' is declared but never used` |
| W10210 | F021 / Ch 01 | `Numeric literal '<literal>' has leading zeros — it is decimal <value>, not octal` |
| W10211 | Ch 06 | `Shared '<name>' has an unprotected cross-domain read-modify-write that can lose an update` |
| W10212 | Ch 06 | `Shared multi-byte '<name>' can tear across '<domain_a>' and '<domain_b>' access` |

---

## 5. Retirement and Migration History

Retired codes remain reserved. The table maps conditions formerly assigned by older Chapter 14
drafts to the active code that now owns that condition. It does not change the meaning of an active
code with the same number.

| Former draft assignment | Active disposition |
|-------------------------|--------------------|
| E10111 zero-length array | Retired; zero-length arrays are valid and every known index is E10240. |
| E10060 read-only for-loop variable | Retired; a `let` declared in a three-clause for header has ordinary mutability. Assignment to a `const` remains E10192. |
| E10061 range step is zero | Retired with the range-loop syntax; update expressions use ordinary expression semantics. |
| E10062 nested for-loop variable | Retired; ordinary no-shadowing diagnostic E10101 governs every nested declaration. |
| E10064 range end outside counter type | Retired with the range-loop syntax; ordinary conversion and comparison diagnostics govern header expressions. |
| E10002 module declaration not first | E10237; E10002 remains the one-module-per-file condition. |
| E10011 constant-only module initializer | Retired; runtime module `let` initialization is legal. |
| E10033 RAM budget exceeded | E10238; E10033 remains invalid keyword inside `zeropage`. |
| E10040/E10041 intrinsic arity | E10171; E10040/E10041 remain address-of diagnostics. |
| E10042 generic intrinsic arity | Retired for that meaning; E10042 remains the accepted address-of target condition. |
| E10080 invalid operator operand | Use the precise type/operator diagnostic; E10080 remains implicit conversion. |
| E10082 constant division by zero | E10160; E10082 remains implicit narrowing. |
| E10083 wide shift | E10161 for invalid shift type or W10174 for a constant amount at least the width; E10083 remains unsigned negation. |
| E10100 undeclared identifier | E10239; E10100 remains non-boolean condition. |
| E10112 platform array budget | E10238; E10112 remains array initializer count mismatch. |
| E10114 invalid index type | E10263; E10114 remains fill syntax without explicit size. |
| E10085 signed array index | Retired; all integer types are valid final indices under the Chapter-08 index-ordinal context. |
| E10117/E10118 array-tier index width | Retired; storage size never selects source index legality, and lowering narrows only under proof. |
| W10142 declaration-size addressing warning | Retired; addressing is selected per access and its exact costs belong in the build report. |
| E10115 static out-of-bounds index | E10240; E10115 remains invalid fill element. |
| E10130/E10131 break or continue outside loop | E10063; E10130/E10131 remain data-inclusion diagnostics. |
| E10132 duplicate case | E10070; E10132 remains missing asset selector. |
| E10133 non-exhaustive enum switch | Retired; E10133 remains unknown asset selector. |
| E10138/E10139 raw partial-embed offsets | Retired with generic offset arguments; use a prepared raw asset or an explicit format selector. |
| E10140 empty enum | E10234; E10140 remains embedded-data size mismatch. |
| E10141 too many enum members / offset with selector | Retired; enum count has no separate language limit and `embed()` has no generic offset argument. |
| E10142 duplicate enum value | Retired for enum use; E10142 remains array-selector expression misuse. |
| E10143 enum backing range | E10233; E10143 remains asset alignment conflict. |
| E10151 unknown type | E10241; E10151 remains boolean arithmetic/bitwise misuse. |
| E10152 assignment mismatch | E10080, E10082, or E10235 according to the conversion; E10152 remains cast to/from void. |
| E10153 signedness mismatch | E10081; E10153 remains aggregate cast misuse. |
| E10154 narrowing | E10082; E10154 remains ordered comparison on boolean. |
| E10155 invalid cast | Retired; use E10080/E10082/E10086/E10152/E10153/E10235 as applicable. |
| E10160 unknown struct field | E10242; E10160 remains constant division by zero. |
| E10161 missing struct initializer field | E10096; E10161 remains invalid shift-amount type. |
| E10162 extra struct initializer field | E10243; E10162 remains incompatible conditional arms. |
| E10163 empty struct | E10090; E10163 is retired. |
| E10170 wrong call arity | E10171; E10170 remains missing function return annotation. |
| E10171 argument type mismatch | E10172; E10171 remains wrong call arity. |
| E10172 missing return on a path | E10102; E10172 remains argument type mismatch. |
| E10174 recursion | E10180/E10181; E10174 remains bare return in a non-void function. |
| E10175 eight-parameter maximum | Retired; there is no language parameter-count limit. |
| E10191 assignment to const | E10192; E10191 remains non-constant const initializer. |
| E10192 const without initializer | E10190; E10192 remains assignment to const. |
| E10193 non-constant initializer | E10191; E10193 is retired. |
| E10200 embed outside const | E10134; E10200 remains invalid `sizeof` argument. |
| E10201 embedded file missing | E10130; E10201 remains invalid `offsetof` type. |
| E10202 embedded size mismatch | E10140; E10202 remains invalid `offsetof` field. |
| E10203 unknown asset selector | E10133; E10203 remains invalid `length` argument. |
| W10130 unreachable code | W10131; W10130 remains constant-false condition. |
| W10060 word loop counter | Retired; choosing a narrower machine induction representation is an optimizer proof, not a source-level warning. |
| W10120 decimal-mode warning | Retired; E10255 now rejects a raw decimal-state path that reaches an ordinary semantic boundary or mismatched join. |
| W10121 release-build BRK warning | Retired; Blend65 has no debug/release semantic mode. `asm_brk()` is an intentional profile-bound hardware operation, and E10259 rejects a reachable use whose control flow, stack, and machine effects are not proven. |

Message wording changes that do not change a predicate keep the accepted feature/evaluation code.
In particular, W10174 now states both left- and signed-right-shift saturation results.
