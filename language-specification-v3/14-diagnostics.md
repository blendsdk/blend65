# Chapter 14 — Diagnostics: Error & Warning Registry

> **Version**: 3.0  
> **Status**: draft  
> **Stability**: stable  
> **Source**: All chapters (consolidated)

---

## 1. Overview

This chapter is the **canonical registry** of all compiler diagnostics. Every error and warning in Blend65 has a unique code, a defined condition, and an actionable message.

### Diagnostic Format

```
error[E10042]: '<name>()' expects 2 arguments — found 3
  --> player.blend65:42:5
   |
42 |     poke($D020, 0, 1);
   |     ^^^^^^^^^^^^^^^^^ extra argument
```

### Severity Levels

| Level | Prefix | Effect |
|-------|--------|--------|
| **Error** | `E` | Compilation fails. No binary is produced. |
| **Warning** | `W` | Compilation continues. Binary is produced. Developer is informed. |

Warnings can be promoted to errors via `--warn-as-error` or suppressed via `--suppress-warning=WXXXXX`.

---

## 2. Error Codes

### E100xx — Module & Program Structure (→ Ch 10)

| Code | Condition | Message |
|------|-----------|---------|
| E10001 | Missing module declaration | `Source file must begin with a module declaration — add 'module <Name>;'` |
| E10002 | Module declaration not first | `Module declaration must be the first statement in the file` |
| E10003 | Duplicate declaration in scope | `Duplicate declaration — '<name>' is already declared in this scope` |
| E10010 | Executable statement at module level | `Executable statements are not allowed at module level — place code inside a function` |
| E10012 | Import of non-exported item | `'<name>' is not exported from module '<module>'` |
| E10020 | No main function | `No 'main' function found — every program needs 'function main(): void'` |
| E10021 | Multiple main functions | `Multiple 'main' functions found — in modules '<A>' and '<B>'. Only one is allowed` |
| E10023 | Calling main directly | `Cannot call 'main()' directly — it is the program entry point, not a callable function` |

### E100xx — Resource Limits (→ Ch 03, Ch 11)

| Code | Condition | Message |
|------|-----------|---------|
| E10032 | ZP budget exceeded | `Zero-page budget exceeded — <used> bytes used, platform '<platform>' allows <budget> bytes` |
| E10033 | RAM budget exceeded | `RAM usage (<used> bytes) exceeds platform '<platform>' available RAM (<budget> bytes)` |
| E10034 | Binary too large | `Output binary (<size> bytes) exceeds platform '<platform>' maximum binary size (<limit> bytes)` |

### E100xx — Intrinsics (→ Ch 12, Ch 13)

| Code | Condition | Message |
|------|-----------|---------|
| E10040 | Args to parameterless intrinsic | `'<name>()' takes no arguments — found <N>` |
| E10041 | Wrong argument count | `'<name>()' expects <N> arguments — found <M>` |
| E10042 | Address-of element (deferred) | `Address-of array element '&<name>[<index>]' is not supported in v3` |

### E101xx — Scoping & Names (→ Ch 03, Ch 05)

| Code | Condition | Message |
|------|-----------|---------|
| E10100 | Undeclared identifier | `'<name>' is not declared in this scope` |
| E10101 | Name shadows enclosing scope | `'<name>' shadows a declaration in an enclosing scope — use a different name` |

### E101xx — Arrays (→ Ch 08)

| Code | Condition | Message |
|------|-----------|---------|
| E10110 | Array size not compile-time | `Array size must be a compile-time constant expression` |
| E10111 | Array size zero | `Array size must be at least 1` |
| E10112 | Array size exceeds platform max | `Array of <N> bytes exceeds platform '<platform>' maximum (<max> bytes)` |
| E10113 | Const array without full init | `Const array must be fully initialized — provide all <N> elements` |
| E10114 | Index type mismatch | `Array index must be 'byte' or 'word' — found '<type>'` |
| E10115 | Static index out of bounds | `Index <N> is out of bounds for array of size <M>` |

### E101xx — Type System (→ Ch 02)

| Code | Condition | Message |
|------|-----------|---------|
| E10150 | Missing type annotation | `Type annotation required — write '<name>: <type>'` |
| E10151 | Unknown type | `Unknown type '<name>'` |
| E10152 | Type mismatch in assignment | `Cannot assign '<sourceType>' to '<targetType>'` |
| E10153 | Signed/unsigned mismatch | `Cannot mix signed and unsigned types — use explicit cast` |
| E10154 | Width narrowing without cast | `Cannot narrow '<wideType>' to '<narrowType>' — use explicit cast` |
| E10155 | Invalid cast | `Cannot cast '<fromType>' to '<toType>'` |

### E101xx — Structs (→ Ch 07)

| Code | Condition | Message |
|------|-----------|---------|
| E10160 | Unknown field | `Struct '<type>' has no field '<name>'` |
| E10161 | Missing field in initializer | `Struct initializer missing field '<name>'` |
| E10162 | Extra field in initializer | `Unknown field '<name>' in initializer for struct '<type>'` |
| E10163 | Empty struct | `Struct must have at least one field` |

### E101xx — Functions (→ Ch 06)

| Code | Condition | Message |
|------|-----------|---------|
| E10170 | Wrong arg count in call | `Function '<name>' expects <N> arguments — found <M>` |
| E10171 | Arg type mismatch | `Argument <N> of '<name>' expects '<expected>' — found '<actual>'` |
| E10172 | Missing return value | `Function '<name>' must return '<type>' — missing return statement` |
| E10173 | Void function returns value | `Function '<name>' returns void — cannot return a value` |
| E10174 | Recursion detected | `Recursive call detected — '<name>' calls itself (directly or indirectly). Blend65 does not support recursion.` |
| E10175 | Too many parameters | `Function '<name>' has <N> parameters — maximum is 8` |

### E101xx — Control Flow (→ Ch 05)

| Code | Condition | Message |
|------|-----------|---------|
| E10130 | Break outside loop/switch | `'break' can only be used inside a loop or switch` |
| E10131 | Continue outside loop | `'continue' can only be used inside a loop` |
| E10132 | Duplicate case value | `Duplicate case value <N> in switch` |
| E10133 | Non-exhaustive switch on enum | `Switch on enum '<type>' is not exhaustive — missing cases: <list>` |

### E101xx — Enums (→ Ch 09)

| Code | Condition | Message |
|------|-----------|---------|
| E10140 | Empty enum | `Enum must have at least one member` |
| E10141 | Too many enum members | `Enum '<name>' has <N> members — maximum is 256` |
| E10142 | Duplicate enum value | `Duplicate backing value <N> in enum '<name>'` |
| E10143 | Backing value out of range | `Backing value <N> is out of range for byte (0–255)` |

### E101xx — Variables (→ Ch 03)

| Code | Condition | Message |
|------|-----------|---------|
| E10191 | Assignment to const | `Cannot assign to const '<name>' — constants cannot be reassigned` |
| E10192 | Const without initializer | `Const '<name>' must have an initializer — constants require a compile-time value` |
| E10193 | Non-constant initializer | `Initializer for const '<name>' is not a compile-time constant expression` |

### E102xx — Data Inclusion (→ Ch 13)

| Code | Condition | Message |
|------|-----------|---------|
| E10200 | Embed in non-const context | `embed() produces const data — use 'const' declaration` |
| E10201 | File not found | `Cannot find file '<path>' for embed()` |
| E10202 | Size mismatch | `embed('<path>') produces <N> bytes but array declares <M> bytes` |
| E10203 | Unknown selector | `Unknown selector '<name>' for format '<format>'` |
| E10204 | Format parse error | `Cannot parse '<path>' as '<format>' — <details>` |

### E10xxx — Operators & Expressions (→ Ch 04)

| Code | Condition | Message |
|------|-----------|---------|
| E10080 | Invalid operand type | `Operator '<op>' cannot be applied to type '<type>'` |
| E10081 | Mixed signed/unsigned operands | `Cannot mix signed and unsigned types in '<op>' — use explicit cast` |
| E10082 | Division by zero (const) | `Division by zero in constant expression` |
| E10083 | Shift amount out of range | `Shift amount <N> is out of range for '<type>' (0–<max>)` |

---

## 3. Warning Codes

### W100xx — Variables & Memory (→ Ch 03, Ch 11)

| Code | Condition | Message |
|------|-----------|---------|
| W10030 | Large ZP allocation | `Zeropage allocation uses <N> of <budget> bytes — consider total ZP budget` |
| W10033 | RAM nearing limit | `RAM usage is <percent>% of platform '<platform>' budget` |

### W101xx — CPU & Intrinsics (→ Ch 12)

| Code | Condition | Message |
|------|-----------|---------|
| W10120 | Decimal mode without CLD | `asm_sed() called without matching asm_cld() in function '<name>'` |
| W10121 | BRK in release mode | `asm_brk() is a debug breakpoint — remove before release build` |

### W101xx — Functions & Stack (→ Ch 06, Ch 11)

| Code | Condition | Message |
|------|-----------|---------|
| W10180 | Stack depth near limit | `Maximum stack depth is <N> bytes on platform '<platform>' — stack budget is <budget> bytes` |

### W101xx — Variables (→ Ch 03)

| Code | Condition | Message |
|------|-----------|---------|
| W10190 | Use before initialization | `Variable '<name>' may be used before being initialized` |
| W10191 | Unused variable | `Variable '<name>' is declared but never used` |

### W101xx — Control Flow (→ Ch 05)

| Code | Condition | Message |
|------|-----------|---------|
| W10130 | Unreachable code | `Code after 'return'/'break'/'continue' is unreachable` |

---

## 4. Compiler Flags for Diagnostics

| Flag | Effect |
|------|--------|
| `--warn-as-error` | Promote all warnings to errors |
| `--warn-as-error=WXXXXX` | Promote specific warning to error |
| `--suppress-warning=WXXXXX` | Suppress specific warning |
| `--max-errors=N` | Stop after N errors (default: 20) |
