# RD-04: Semantic Analysis & Type System

> **Status**: 🟢 Authored
> **MVP Phase**: A
> **Depends On**: RD-03
> **Implements**: `spec-v3.0` Ch 02–10, Ch 12–13, Ch 14 (semantic diagnostic codes);
>   evaluations F002, F003, F010, F011, F016, F018, F019, F022
> **Owning package(s)**: `@blend65/core` (type representation, symbol table, scope model),
>   `@blend65/frontend` (semantic analysis passes)
> **Created**: 2026-05-31
> **Last Updated**: 2026-06-04

---

> ## ⚠️ SEMANTICS-DEFERRED — Implemented as a Passthrough Skeleton
>
> **This requirements document specifies the FULL semantic analyzer, but the first
> implementation (plan `plans/rd-04-semantic-analysis/`, decision D1) deliberately ships a
> PASSTHROUGH SKELETON only.** Per the project's research strategy ("working compiler first;
> correct before fast; build incrementally"), the real four-pass type/scope/control-flow
> checker is **deferred to a future RD** (provisionally `RD-04b-semantic-checker`).
>
> **In scope NOW (implemented):**
> - **R1** (four-pass architecture — as named seam functions), **R7–R8** (scope/symbol shapes),
>   **R24–R29** (the `Type` union + `ErrorType`), **R94** (`ConstValue` shape),
>   **R113** (never throws — trivially, the analyzer is a no-op),
>   **R118–R121** (the `analyze()` API + `PlatformProfile` stub + empty `SemanticModel`).
> - **AC-01** (accepts an AST, returns a model, never throws).
> - The pure structural type utilities (`isInteger`/`isSigned`/`isUnsigned`/`bitWidth`/
>   `byteSize`/`isError`/`typeName`).
>
> **DEFERRED (no behavior yet):**
> - **R2–R6, R9–R23, R30–R117** — all declaration collection, name/module resolution, type
>   checking, cast rules, expression typing, declaration/statement validation, call-graph &
>   recursion detection, const evaluation, intrinsic validation, array/embed validation,
>   warnings, and poison-type propagation.
> - **AC-02 … AC-20** — every behavioral acceptance criterion beyond AC-01.
> - The type-policy utilities `isAssignableTo` (returns `true`) and `commonType` (returns
>   `null`) ship as documented placeholders.
>
> `analyze()` therefore returns a structurally-valid **empty** `SemanticModel`
> (`hasErrors === false`, `mainFunction === null`, a lone global scope, empty maps) and emits
> **no** diagnostics. No requirement text below is deleted — only this banner annotates status —
> so the future checker inherits the full specification intact. The authoritative,
> per-requirement deferral map (with the diagnostic code each deferred check must emit and which
> of the four passes owns it) is
> **[plans/rd-04-semantic-analysis/08-deferred-semantics-ledger.md](../plans/rd-04-semantic-analysis/08-deferred-semantics-ledger.md)**.

## 1. Purpose


This document specifies the **semantic analysis** phase of the Blend65 compiler — the
phase that transforms a raw AST (produced by the parser, RD-03) into a fully validated,
type-resolved **semantic model**. Semantic analysis is the second half of the front-end
pipeline and the last phase before lowering to IL (RD-06). It enforces every rule the
parser cannot: type compatibility, name resolution, scope correctness, control-flow
validity, call-graph integrity, compile-time constant evaluation, and intrinsic
signature checking.

The semantic analyzer is the **primary gate for developer-facing errors**. Following the
error-tolerant frontend mandate (AR-15), it **never throws** — it accumulates
diagnostics in a `DiagnosticBag` (AR-73) and propagates **poison types** so that
cascaded errors from a single mistake are suppressed (AR-74). The result is a
`SemanticModel` that downstream phases (SFA → IL → codegen) consume. Per the
walking-skeleton methodology (AR-38), the semantic analyzer grows per vertical slice:
the MVP gate program (AR-43) needs only module scope, `main()` validation, `void`
return, and `poke()` intrinsic checking; subsequent slices add features incrementally.

---

## 2. Scope

**In scope:**

- Scope model: global, module, function, and block scopes
- Symbol table: declaration collection, symbol storage, lookup
- Name resolution: local → enclosing → module → imported → intrinsic (AR-42)
- Module resolution: merging, import validation, export visibility, initialization order (AR-91)
- Type representation: internal `Type` discriminated union for all Blend65 types
- Type checking: all rules from Ch 02 (TS-1 through TS-9), F016
- Expression typing: infer result type of every expression node
- Declaration validation: variables (Ch 03), functions (Ch 06), structs (Ch 07), enums (Ch 09)
- Statement validation: control flow (Ch 05), return checking, break/continue/fallthrough context
- Intrinsic validation: argument count/types against descriptors (AR-29, AR-31, AR-32)
- Call-graph construction and recursion detection (FN-12)
- Compile-time constant evaluation (const initializers, array sizes, enum values)
- Data-inclusion validation: `embed()` context and file checks (Ch 13)
- Warning generation: unused variables, unreachable code, use-before-init
- Semantic diagnostic codes from Ch 14 §2–§3
- Error tolerance: poison-type propagation, cascade suppression, deterministic output

**Out of scope (and where it lives instead):**

- SFA frame allocation, ZP allocation, frame coloring → RD-05
- IL lowering and IL representation → RD-06
- Code generation → RD-07
- Platform profile loading and budget enforcement → RD-10 / RD-11
- Diagnostic rendering (terminal, JSON) → RD-11
- Resource budget errors (E10032, E10033, E10034) → RD-05 / RD-11
- Intrinsic descriptor registry internals and runtime-routine ABI → RD-17
- Test harness for semantic analysis → RD-12

> **Traceability rule:** Every decision below cites the Ambiguity Register entry
> (`AR-NN`) that resolved it, or the frozen spec section that mandates it.

---

## 3. Decisions & Requirements

### 3.1 Multi-Pass Architecture

| # | Requirement | Trace |
|---|-------------|-------|
| R1 | The semantic analyzer uses a **four-pass architecture** over the complete AST set (all parsed source files): (1) Declaration Collection, (2) Type Resolution, (3) Body Checking, (4) Post-Check Validation. | AR-38 walking skeleton; AR-42 module merging in Pass 1 |
| R2 | **Pass 1 — Declaration Collection**: Walk all AST files. Register module declarations. Collect all top-level declarations (functions, structs, enums, `let`, `const`) into their module's scope. Register struct fields and enum members. Process `export` visibility. This pass enables forward references. | Ch 10 §2 (modules), AR-42 |
| R3 | **Pass 2 — Type Resolution**: Resolve all named type references (struct names, enum names in type annotations) to their declarations. Validate struct field types (no recursive structs). Compute `sizeof()` for all struct types. Validate enum member values and backing-value uniqueness. | Ch 02 §4, Ch 07 §2, Ch 09 §2 |
| R4 | **Pass 3 — Body Checking**: Walk function bodies depth-first. Type-check all expressions. Validate all statements. Check const evaluability. Validate intrinsic calls. Build the call graph. Resolve all identifier references. | Ch 02–06, Ch 08, Ch 12 |
| R5 | **Pass 4 — Post-Check Validation**: Verify `main()` exists with correct signature. Check call graph for recursion. Detect unused variables. Detect unreachable code. Compute module initialization order. | Ch 06 FN-7, FN-12; AR-91 |
| R6 | Each pass completes for **all** source files before the next pass begins. This ensures forward references across files/modules are resolved before body checking. | AR-42 module merging |

### 3.2 Scope Model & Symbol Table

| # | Requirement | Trace |
|---|-------------|-------|
| R7 | Scopes form a **tree** with four levels: `global` (root, contains modules and intrinsics) → `module` (one per module declaration) → `function` (one per function/interrupt body) → `block` (one per `{ }` block, including control-flow bodies). | Ch 03 §4, Ch 05, Ch 06 |
| R8 | Each scope owns a `Map<string, Symbol>` of locally declared names. | — |
| R9 | **Duplicate declaration** in the same scope is a compile-time error (E10003). | Ch 14 E10003 |
| R10 | **Shadowing**: A declaration in an inner scope that reuses a name from an enclosing scope is a compile-time error (E10101). Blend65 does not allow shadowing. | Ch 14 E10101; Ch 03 |
| R11 | **For-loop counters** are scoped to the for-loop body block. They shadow nothing (the for-loop introduces a new block scope, and R10 applies to its parent). | Ch 05 §6 (for-loop scoping) |
| R12 | **Module-level declarations** include: functions, interrupt functions, structs, enums, `let` variables, `const` constants. No executable statements at module level (E10010). | Ch 10 §3; F003; Ch 14 E10010 |
| R13 | **Export visibility**: Only declarations marked `export` are visible to other modules via `import`. Non-exported declarations are module-private. | Ch 10 §4; F002 |

### 3.3 Name Resolution

| # | Requirement | Trace |
|---|-------------|-------|
| R14 | A single **unified name resolver** (AR-42) handles all identifier lookups: local variables, parameters, module-level declarations, imported names, and intrinsic names. | AR-42 |
| R15 | **Lookup order** (innermost-first): current block scope → enclosing block scopes → function parameters → module scope → imported names → global intrinsic names. The first match wins. | AR-42; Ch 03 §4 |
| R16 | **Undeclared identifier** (no match in any scope) → E10100. | Ch 14 E10100 |
| R17 | **Qualified access**: `ModuleName.name` resolves `name` in the specified module's exported scope. | Ch 10 §5 |
| R18 | **Enum member access**: `EnumName.Member` resolves `Member` in the enum's member scope. Enum members are not directly visible in the enclosing scope — always qualified. | Ch 09 §3; F022 |
| R19 | **Intrinsic names are reserved** (AR-31): any user declaration that matches an intrinsic name is a compile-time error (E10101, shadowing). This applies to all core (T1–T3) intrinsic names regardless of whether they are used. | AR-31 |

### 3.4 Module Resolution

| # | Requirement | Trace |
|---|-------------|-------|
| R20 | **Module merging**: Multiple source files may declare the same module name. Their declarations are merged into a single module scope during Pass 1. Duplicate names across files in the same module → E10003. | Ch 10 §2; AR-42 |
| R21 | **Circular imports are allowed** (AR-42): Module A may import from Module B while Module B imports from Module A. This works because Pass 1 collects all declarations before Pass 3 resolves references. | AR-42 |
| R22 | **Import validation**: Each imported name must exist in the source module and be marked `export`. Non-exported import → E10012. | Ch 10 §4; Ch 14 E10012 |
| R23 | **Module initialization order**: Module-level `let` initializers are executed in a topological order derived from the import dependency graph (AR-91). Circular initialization dependencies → E10194. | AR-91; Ch 14 E10194 |

### 3.5 Type Representation

| # | Requirement | Trace |
|---|-------------|-------|
| R24 | The compiler represents types using a **discriminated union** `Type` in `@blend65/core` with the following variants: `PrimitiveType`, `ArrayType`, `StructType`, `EnumType`, `ErrorType`. | Ch 02 §2–§5 |
| R25 | `PrimitiveType` has a `name` field with value `'byte'│'sbyte'│'word'│'sword'│'bool'│'void'`. | Ch 02 §2 |
| R26 | `ArrayType` has `element: Type` and `size: number` (compile-time constant). | Ch 08 §2 |
| R27 | `StructType` has `name: string`, a reference to the `StructDeclNode`, and a computed `byteSize: number`. | Ch 07 §2 |
| R28 | `EnumType` has `name: string` and a reference to the `EnumDeclNode`. The underlying type is always `byte`. | Ch 09 §2; F022 |
| R29 | `ErrorType` is a **poison type** — any expression involving an error type produces error type without emitting additional diagnostics (cascade suppression). | AR-74 |

### 3.6 Type Checking Rules

| # | Requirement | Trace |
|---|-------------|-------|
| R30 | **No type inference**: Every variable, constant, parameter, and return type must have an explicit type annotation (E10150). | Ch 02 §1; F016 |
| R31 | **Widening promotion**: In binary expressions, `byte` promotes to `word` and `sbyte` promotes to `sword`. This is the **only** implicit type conversion. | Ch 02 §3 TS-1; F016 |
| R32 | **No implicit narrowing**: Assigning `word` to `byte` or `sword` to `sbyte` without an explicit cast is a compile-time error (E10154). | Ch 02 §3 TS-2; F016 |
| R33 | **Mixed signedness is an error**: Combining `byte`/`word` with `sbyte`/`sword` in an expression or assignment without an explicit cast is a compile-time error (E10153). | Ch 02 §3 TS-7; F016 |
| R34 | **Bool is not numeric**: No implicit conversion between `bool` and any integer type. `bool` may only appear in logical/comparison contexts (E10080). | Ch 02 §3 TS-8; F016 |
| R35 | **Void is return-type only**: `void` may only be used as a function return type. Using `void` as a variable type, parameter type, array element type, or struct field type is a compile-time error. | Ch 02 §3 TS-9 |
| R36 | **Assignment compatibility**: The source type must exactly match or be promotable to the target type. Enum→byte and byte→enum require explicit cast. | Ch 02 §3 TS-7; Ch 09 |
| R37 | **Struct assignment**: Assigning one struct to another of the **same** struct type is allowed (field-by-field copy). Cross-struct-type assignment is an error. | Ch 07 §4 |
| R38 | **No struct equality**: Applying `==` or `!=` to struct-typed operands is a compile-time error (E10080). | Ch 07 §6; F011 |
| R39 | **Enum↔byte cast**: Converting between an enum type and `byte` requires an explicit `as` cast in both directions (E10152 without cast). | Ch 02 §5; Ch 09 §4; F022 |

### 3.7 Explicit Cast Rules

| # | Requirement | Trace |
|---|-------------|-------|
| R40 | The `as` cast operator is the **only** mechanism for explicit type conversion. | Ch 02 §4; F016 |
| R41 | **Allowed casts** (exhaustive list): `byte↔sbyte` (reinterpret), `word↔sword` (reinterpret), `byte→word` (zero-extend), `sbyte→sword` (sign-extend), `word→byte` (truncate low byte), `sword→sbyte` (truncate low byte), `byte↔EnumType` (both directions), `bool→byte` (0/1). | Ch 02 §4; F016 |
| R42 | Any cast not in the allowed list produces E10155 (`Cannot cast '<from>' to '<to>'`). | Ch 14 E10155 |
| R43 | Cast from `void`, to `void`, between struct types, between enum types, or between arrays is always invalid (E10155). | Ch 02 §4 |

### 3.8 Expression Typing

| # | Requirement | Trace |
|---|-------------|-------|
| R44 | Every expression node in the AST must be assigned a resolved `Type` by the semantic analyzer. Error-sentinel expression nodes (`ErrorExpr`) receive `ErrorType`. | AR-74; Ch 02 |
| R45 | **Numeric literals**: Integer value determines type — fits in `byte` (0–255) → `byte`; fits in `word` (256–65535) → `word`; out of range → E10080. Negative literals are parsed as unary-minus on a positive literal; the result type is `sbyte` or `sword`. Hex/binary literals follow the same range rules. | Ch 02 §2; Ch 04 §2 |
| R46 | **Boolean literals** (`true`, `false`) → `bool`. | Ch 02 §2 |
| R47 | **Character literals** (`'A'`) → `byte`. The numeric value is determined by the platform's character encoding (platform profile). | Ch 02 §2; Ch 08 §5 |
| R48 | **String literals** (`"hello"`) → `const byte[]` with size equal to the string length in the platform's encoding (no null terminator unless explicitly included). | Ch 08 §5 |
| R49 | **Arithmetic operators** (`+`, `-`, `*`, `/`, `%`): both operands must be integer type (byte/sbyte/word/sword), same signedness or promotable. Result type = promoted common type. Mixed signedness → E10081. Bool operands → E10080. | Ch 04 §4; F016 TS-1/TS-7 |
| R50 | **Comparison operators** (`==`, `!=`, `<`, `>`, `<=`, `>=`): operands must be same type or promotable integer types. Result type = `bool`. Mixed signedness → E10081. Struct operands → E10080. Enum operands of the same enum type may use `==` and `!=` only. | Ch 04 §5; Ch 07 §6 |
| R51 | **Logical operators** (`&&`, `||`, `!`): operands must be `bool`. Result type = `bool`. Non-bool operands → E10080. | Ch 04 §6; F016 TS-8 |
| R52 | **Bitwise operators** (`&`, `|`, `^`, `~`): operands must be integer type, same width. Result type = operand type. Mixed signedness → E10081. | Ch 04 §7 |
| R53 | **Shift operators** (`<<`, `>>`): left operand must be integer type, right operand must be `byte`. Result type = left operand type. Shift amount ≥ type width (8 for byte/sbyte, 16 for word/sword) → E10083. | Ch 04 §7; Ch 14 E10083 |
| R54 | **Assignment operators** (`=`, `+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `|=`, `^=`, `<<=`, `>>=`): target must be a mutable l-value (variable or struct field). Compound assignments desugar to binary-op + assignment; type rules of the underlying operator apply. Assignment to const → E10191. | Ch 04 §3; Ch 03 |
| R55 | **Conditional expression** (`cond ? then : else`): condition must be `bool`; `then` and `else` branches must have the same type (or be promotable to a common type). Result type = common type. | Ch 04 §8; F024 |
| R56 | **Field access** (`expr.field`): `expr` must be struct-typed. `field` must exist in the struct definition. Result type = field's declared type. Unknown field → E10160. | Ch 07 §3 |
| R57 | **Index expression** (`expr[index]`): `expr` must be array-typed. `index` must be `byte` or `word` (unsigned). Signed index → E10114. Result type = array's element type. If index is a compile-time constant and out of bounds → E10115. | Ch 08 §3; Ch 14 E10114/E10115 |
| R58 | **Function call** (`name(args)`): name must resolve to a function symbol. Argument count must match parameter count (E10170). Each argument type must match or be promotable to the corresponding parameter type (E10171). Result type = function's return type. | Ch 06 §4; Ch 14 E10170/E10171 |
| R59 | **Intrinsic call** (`name(args)`): name must resolve to an intrinsic symbol. Argument count (E10040/E10041) and types validated against the intrinsic's descriptor signature. Result type = intrinsic's declared return type. | Ch 12; AR-29 |
| R60 | **`sizeof(T)`**: argument must be a type name (primitive, struct, or enum). Result type = `word`. Value is a compile-time constant. | Ch 04 §9; Ch 07 §5 |
| R61 | **Identifier expression**: resolved via name resolution (R14–R19). Result type = the symbol's declared type. | Ch 03; AR-42 |
| R62 | **Struct literal** (`TypeName { field: value, ... }`): all fields must be provided (E10161), no extra fields (E10162), each value must match the field's declared type (E10152). Result type = the named struct type. | Ch 07 §4; Ch 14 E10161/E10162 |

### 3.9 Declaration Validation

| # | Requirement | Trace |
|---|-------------|-------|
| R63 | **`let` variable**: Type annotation required (E10150). Initializer required. Initializer type must match declared type (E10152). Variable is mutable (reassignment allowed). | Ch 03 §2; F019 |
| R64 | **`const` constant**: Type annotation required (E10150). Initializer required (E10192). Initializer must be a **compile-time constant expression** (E10193). Constant is immutable (reassignment → E10191). | Ch 03 §3; F019; Ch 14 E10192/E10193 |
| R65 | **Function declaration**: All parameters must have explicit type annotations. Return type must be explicit (or `void`). No duplicate parameter names (E10003). Maximum 8 parameters (E10175). No function overloading — duplicate function name in same scope → E10003. | Ch 06 §2; F018; Ch 14 E10175 |
| R66 | **`main()` function**: Must exist exactly once across all modules (E10020 if missing, E10021 if multiple). Signature must be `main(): void` — no parameters, void return. Calling `main()` directly is an error (E10023). | Ch 06 §5 FN-7; Ch 14 E10020/E10021/E10023 |
| R67 | **Interrupt function**: No parameters allowed. No explicit return type (implicitly `void`). Otherwise follows regular function validation. | Ch 06 §6; F018 |
| R68 | **Struct declaration**: At least one field required (E10163). No duplicate field names (E10003). Field types must be valid: primitives, other struct types, fixed-size arrays, or enum types. **No recursive structs** — a struct field cannot directly or indirectly reference its own struct type (compile-time error). | Ch 07 §2; F011; Ch 14 E10163 |
| R69 | **Enum declaration**: At least one member required (E10140). Maximum 256 members (E10141). No duplicate member names (E10003). Backing values: auto-assigned (0, 1, 2, …) or explicitly specified. Explicit values must be in range 0–255 (E10143). No duplicate backing values (E10142). | Ch 09 §2; F022; Ch 14 E10140–E10143 |
| R70 | **Struct passing convention**: Struct-typed parameters are passed by reference (compiler-managed pointer via ZP). The semantic analyzer annotates struct parameters as by-reference for downstream SFA/codegen. The developer writes value syntax; the compiler handles the rest. | Ch 06 §3 FN-3; Ch 07 |

### 3.10 Statement Validation

| # | Requirement | Trace |
|---|-------------|-------|
| R71 | **If statement**: Condition expression must have type `bool` (E10080 if not). | Ch 05 §2; F016 TS-8 |
| R72 | **While statement**: Condition expression must have type `bool` (E10080). | Ch 05 §3 |
| R73 | **Do-while statement**: Condition expression must have type `bool` (E10080). | Ch 05 §4 |
| R74 | **For-loop**: Counter variable type must be `byte`, `sbyte`, `word`, or `sword`. Start and end bounds must be compatible with counter type. End bound that overflows counter type range → E10064. | Ch 05 §6; Ch 14 E10064 |
| R75 | **Switch statement**: Expression must be `byte`, `sbyte`, or an enum type (E10080 otherwise). Case values must be compile-time constants of the same type. Duplicate case values → E10132. | Ch 05 §7; F009; Ch 14 E10132 |
| R76 | **Switch on enum**: If the switch covers an enum type and not all members are covered and no `default` clause exists → E10133. | Ch 05 §7; Ch 14 E10133 |
| R77 | **`break`**: Only valid inside a loop body or switch body (E10130). | Ch 05 §8; Ch 14 E10130 |
| R78 | **`continue`**: Only valid inside a loop body (E10131). Not valid in switch. | Ch 05 §8; Ch 14 E10131 |
| R79 | **`fallthrough`**: Only valid as the last statement in a non-default switch case clause. Transfers control to the next case. | Ch 05 §7 |
| R80 | **`return` in non-void function**: Expression type must match function's return type (E10152). Every code path must contain a `return` statement (E10172). | Ch 06 §4; Ch 14 E10172 |
| R81 | **`return` in void function**: Must not return a value (E10173). A bare `return;` or falling off the end of the function body is valid. | Ch 06 §4; Ch 14 E10173 |
| R82 | **Expression statement**: The expression is type-checked but its result type is discarded. Only call expressions (function calls and intrinsic calls) and assignment expressions are meaningful as statements. | Ch 05 §9 |
| R83 | **`asm` block**: The semantic analyzer does **not** validate the assembly contents (opaque `ASM_BODY` token). It validates the surrounding context only (must be inside a function body). | Ch 12; RD-03 §4.5 |

### 3.11 Call-Graph & Recursion Detection

| # | Requirement | Trace |
|---|-------------|-------|
| R84 | During Pass 3, the semantic analyzer records every function call as a **directed edge** in a call graph: `caller → callee`. | FN-12; Ch 06 |
| R85 | The call graph must be **complete**: every call in the program is represented. This is guaranteed because Blend65 has no function pointers, no indirect calls, and no dynamic dispatch (FN-12). | FN-12; AR-89 |
| R86 | In Pass 4, the call graph is checked for **cycles** (direct or indirect recursion). Any cycle → E10174 on every function in the cycle. | Ch 06 FN-12; Ch 14 E10174 |
| R87 | **Intrinsic calls are not edges** in the call graph — intrinsics are compiler-handled, not user functions. | AR-28/AR-29 |

### 3.12 Const Evaluator

| # | Requirement | Trace |
|---|-------------|-------|
| R88 | The semantic analyzer includes a **compile-time constant evaluator** that reduces expressions to concrete values where required. | Ch 03 §3; Ch 08 §2; Ch 09 §2 |
| R89 | **Const-required contexts**: `const` initializers, array size expressions, enum member explicit values, `case` values in switch statements, `sizeof()` arguments. | Ch 03, Ch 08, Ch 09, Ch 05 |
| R90 | **Const-evaluable expressions** (recursive definition): numeric/bool/char literals; `const`-declared identifiers; `sizeof(T)`; arithmetic, comparison, logical, bitwise, and shift operators on const operands; explicit casts on const operands; parenthesized const expressions; conditional expressions where condition, then, and else are all const. | Ch 03 §3; F019 |
| R91 | A non-const expression in a const-required context → E10193. | Ch 14 E10193 |
| R92 | **Division by zero** in a const expression → E10082. | Ch 14 E10082 |
| R93 | **Integer overflow** in const evaluation: wrapping semantics (natural 6502 behavior). `byte` wraps at 256, `word` wraps at 65536, signed types wrap at their boundaries. This is defined behavior (H5), not an error. | Ch 02 §3; F016 |
| R94 | The const evaluator produces a `ConstValue` result: `{ type: Type, value: number | boolean }`. | — |

### 3.13 Intrinsic Validation

| # | Requirement | Trace |
|---|-------------|-------|
| R95 | **Core intrinsics** (Tier 1–3: `poke`, `peek`, `pokew`, `peekw`, `sizeof`, `lo`, `hi`, and CPU control intrinsics) are **ambient** — available without import in every module. | AR-31; Ch 12 |
| R96 | **Platform intrinsics** (Tier 4) require explicit `import` from their platform module. | AR-31 |
| R97 | Each intrinsic has a **typed descriptor** (AR-29) specifying: name, parameter types, return type, tier, availability predicate. The semantic analyzer validates calls against these descriptors. | AR-29 |
| R98 | **Argument count mismatch**: parameterless intrinsic called with args → E10040; wrong argument count → E10041. | Ch 14 E10040/E10041 |
| R99 | **Unavailable intrinsic**: calling an intrinsic whose availability predicate is false for the current platform → compile-time error (code defined in RD-17). | AR-32 |
| R100 | Intrinsic names may **not** be used as user-declared identifiers — shadowing an intrinsic name → E10101 (via R19). | AR-31 |

### 3.14 Array & Data-Inclusion Validation

| # | Requirement | Trace |
|---|-------------|-------|
| R101 | **Array size**: Must be a compile-time constant (E10110). Must be ≥ 1 (E10111). Platform-specific maximum checked against profile (E10112, delegated to RD-10 budget). | Ch 08 §2; Ch 14 E10110/E10111 |
| R102 | **Array initializer**: Element count must match declared size. Each element's type must match the array's element type. | Ch 08 §3 |
| R103 | **Const array**: Must be fully initialized — all elements provided (E10113). | Ch 14 E10113 |
| R104 | **Array index type**: Must be `byte` or `word` (unsigned). Signed or bool index → E10114. | Ch 08 §3; Ch 14 E10114 |
| R105 | **Static bounds checking**: If the index is a compile-time constant and exceeds the array size → E10115. | Ch 14 E10115 |
| R106 | **`embed()` context**: `embed()` may only appear in a `const` declaration initializer (E10200). | Ch 13 §2; Ch 14 E10200 |
| R107 | **`embed()` file resolution**: The referenced file must exist relative to the source file or project root (E10201). | Ch 13 §3; Ch 14 E10201 |
| R108 | **`embed()` size**: If the target array has a declared size, the embedded data size must match (E10202). | Ch 13 §3; Ch 14 E10202 |

### 3.15 Warning Generation

| # | Requirement | Trace |
|---|-------------|-------|
| R109 | **Unused variable** (W10191): A `let` or `const` that is declared but never referenced in any expression produces a warning. Parameters are excluded from this check. | Ch 14 W10191 |
| R110 | **Unreachable code** (W10130): Statements following a `return`, `break`, or `continue` in the same block are unreachable. | Ch 14 W10130 |
| R111 | **Use before initialization** (W10190): A variable read before its initializer has been executed in the control-flow path produces a warning. For module-level `let`, initialization order follows AR-91. | Ch 14 W10190 |
| R112 | All warnings flow through the central severity-policy layer (AR-75) — they may be promoted to errors or suppressed via compiler flags. | AR-75 |

### 3.16 Error Tolerance

| # | Requirement | Trace |
|---|-------------|-------|
| R113 | The semantic analyzer **never throws an exception**. All errors are accumulated in the `DiagnosticBag` (AR-73). Analysis continues to collect as many independent errors as possible. | AR-15; AR-73 |
| R114 | **Poison-type propagation**: When an expression has `ErrorType` (because it contains an error-sentinel node from the parser, or because a sub-expression failed type checking), all enclosing expressions that depend on it also receive `ErrorType` **without** emitting additional diagnostics. This is the cascade-suppression contract (AR-74). | AR-74 |
| R115 | **Error symbols**: When name resolution fails (E10100), an error symbol with `ErrorType` is returned to enable continued analysis of the surrounding expression. | AR-74 |
| R116 | **Deterministic output**: Given the same input program, the semantic analyzer must produce the **exact same** set of diagnostics in the **exact same** order (ordered by source file, then byte offset, then diagnostic code). This invariant is locked by golden-snapshot tests. | AR-74; H5 |
| R117 | **Max-errors**: The analyzer respects the `--max-errors=N` threshold (default 20). After N errors, analysis stops collecting new error diagnostics but continues to completion for warnings and model construction. | Ch 14 §4 |

### 3.17 Public API

| # | Requirement | Trace |
|---|-------------|-------|
| R118 | The semantic analysis entry point is a function in `@blend65/frontend` with the signature: `analyze(program: ProgramNode[], bag: DiagnosticBag, profile: PlatformProfile): SemanticModel`. | AR-77 library-first API |
| R119 | `ProgramNode[]` is the array of parsed ASTs from all source files (one `ProgramNode` per file, as produced by `parse()` from RD-03). | RD-03 R47 |
| R120 | `PlatformProfile` provides platform-specific information needed during semantic analysis: character encoding for char/string literals, available intrinsics, resource limits for platform-dependent warnings. | Ch 15; AR-18; RD-10 |
| R121 | `SemanticModel` is the output record containing all semantic information needed by downstream phases. Its shape is defined in §4.10. | — |

---

## 4. Design Detail

### 4.1 Pass Architecture

```
Source files (parsed)
       │
       ▼
┌─────────────────────────────────────────────┐
│  Pass 1 — Declaration Collection            │
│  • Walk all ProgramNode[]                   │
│  • Create module scopes, merge duplicates   │
│  • Register top-level declarations          │
│  • Register struct fields, enum members     │
│  • Register function parameters             │
│  • Register export visibility               │
│  • Register intrinsic symbols in global     │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│  Pass 2 — Type Resolution                   │
│  • Resolve all named type references        │
│  • Validate struct field types              │
│  • Detect recursive structs                 │
│  • Compute sizeof() for all struct types    │
│  • Validate enum backing values             │
│  • Build type→declaration map               │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│  Pass 3 — Body Checking                     │
│  • For each function body:                  │
│    – Create function scope + block scopes   │
│    – Resolve identifiers (R14–R19)          │
│    – Type-check expressions (R44–R62)       │
│    – Validate statements (R71–R83)          │
│    – Evaluate const expressions (R88–R94)   │
│    – Validate intrinsic calls (R95–R100)    │
│    – Record call-graph edges (R84–R87)      │
│    – Check return completeness (R80–R81)    │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│  Pass 4 — Post-Check Validation             │
│  • Verify main() existence & signature      │
│  • Detect recursion in call graph           │
│  • Compute module init order (topo sort)    │
│  • Detect unused variables → W10191         │
│  • Detect unreachable code → W10130         │
│  • Produce final SemanticModel              │
└─────────────────────────────────────────────┘
       │
       ▼
   SemanticModel
```

### 4.2 Scope Tree Model

```typescript
// In @blend65/core

type ScopeKind = 'global' | 'module' | 'function' | 'block';

interface Scope {
  readonly kind: ScopeKind;
  readonly parent: Scope | null;
  readonly children: Scope[];
  readonly symbols: Map<string, Symbol>;

  /** The AST node that introduced this scope (module decl, function decl, block, etc.) */
  readonly node: AstNode | null;
}
```

**Scope tree for a typical program:**

```
global
├── [intrinsic symbols: poke, peek, pokew, peekw, sizeof, lo, hi, ...]
├── module "Game"
│   ├── struct Enemy  (type symbol)
│   ├── enum Direction  (type symbol + 4 member symbols)
│   ├── const MAX_ENEMIES  (const symbol)
│   ├── let score  (variable symbol)
│   ├── function update()
│   │   ├── [parameters: dt]
│   │   ├── block (function body)
│   │   │   ├── let i  (local variable)
│   │   │   └── block (for-loop body)
│   │   │       └── let temp  (loop-local variable)
│   │   └── ...
│   └── function main()
│       └── block (function body)
│           └── ...
└── module "Utils"
    ├── export function clamp()
    └── ...
```

### 4.3 Symbol Record

```typescript
// In @blend65/core

type SymbolKind =
  | 'variable'      // let declaration
  | 'constant'      // const declaration
  | 'function'      // function declaration
  | 'interrupt'     // interrupt function declaration
  | 'struct'        // struct type declaration
  | 'enum'          // enum type declaration
  | 'parameter'     // function parameter
  | 'enumMember'    // enum member (accessed as EnumName.Member)
  | 'intrinsic';    // built-in intrinsic function

interface Symbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly type: Type;
  readonly decl: AstNode;            // the declaring AST node
  readonly scope: Scope;             // the scope that owns this symbol
  readonly exported: boolean;        // true if marked 'export'
  readonly mutable: boolean;         // true for 'let' and 'parameter', false for 'const'
  readonly constValue?: ConstValue;  // resolved value for const symbols
  readonly byRef: boolean;           // true for struct-typed parameters (FN-3)
}
```

### 4.4 Type Representation

```typescript
// In @blend65/core

type PrimitiveName = 'byte' | 'sbyte' | 'word' | 'sword' | 'bool' | 'void';

interface PrimitiveType {
  readonly kind: 'primitive';
  readonly name: PrimitiveName;
}

interface ArrayType {
  readonly kind: 'array';
  readonly element: Type;
  readonly size: number;        // compile-time constant, ≥ 1
}

interface StructType {
  readonly kind: 'struct';
  readonly name: string;
  readonly decl: StructDeclNode;
  readonly fields: ReadonlyMap<string, { type: Type; offset: number }>;
  readonly byteSize: number;    // total size in bytes
}

interface EnumType {
  readonly kind: 'enum';
  readonly name: string;
  readonly decl: EnumDeclNode;
  readonly members: ReadonlyMap<string, number>;  // name → backing value
}

interface ErrorType {
  readonly kind: 'error';       // poison type for cascade suppression
}

type Type = PrimitiveType | ArrayType | StructType | EnumType | ErrorType;
```

**Type utility functions** (in `@blend65/core`):

```typescript
function isInteger(t: Type): boolean;       // byte, sbyte, word, sword
function isSigned(t: Type): boolean;        // sbyte, sword
function isUnsigned(t: Type): boolean;      // byte, word
function bitWidth(t: Type): 8 | 16;        // 8 for byte/sbyte/bool/enum, 16 for word/sword
function byteSize(t: Type): number;         // 1, 2, or struct/array size
function isAssignableTo(source: Type, target: Type): boolean;
function commonType(a: Type, b: Type): Type | null;  // widening promotion
function isError(t: Type): boolean;         // ErrorType check
function typeName(t: Type): string;         // human-readable name for diagnostics
```

### 4.5 Name Resolution Algorithm

The unified name resolver (AR-42) follows this algorithm for resolving an identifier:

```
resolve(name: string, fromScope: Scope): Symbol | null

  1. Let current = fromScope
  2. While current is not null:
     a. If current.symbols.has(name) → return current.symbols.get(name)
     b. If current.kind === 'module':
        i.  Check imported symbols in this module
        ii. If found → return imported symbol
     c. current = current.parent
  3. Check global scope (intrinsic symbols)
  4. Return null → emit E10100
```

**Qualified name resolution** (`Module.name` or `Enum.Member`):

```
resolveQualified(qualifier: string, name: string, fromScope: Scope): Symbol | null

  1. Resolve `qualifier` as a symbol
  2. If qualifier is a module → look up `name` in module's exported scope
     - Not found or not exported → E10012
  3. If qualifier is an enum → look up `name` in enum's member map
     - Not found → E10100
  4. Otherwise → type error (not a module or enum)
```

### 4.6 Type Checker Core

The type checker enforces all rules from §3.6–§3.8 during Pass 3. Key operations:

**Promotion check** (`commonType`):

| Left | Right | Result | Rule |
|------|-------|--------|------|
| `byte` | `byte` | `byte` | identity |
| `byte` | `word` | `word` | widening (R31) |
| `word` | `byte` | `word` | widening (R31) |
| `word` | `word` | `word` | identity |
| `sbyte` | `sbyte` | `sbyte` | identity |
| `sbyte` | `sword` | `sword` | widening (R31) |
| `sword` | `sbyte` | `sword` | widening (R31) |
| `sword` | `sword` | `sword` | identity |
| `byte` | `sbyte` | ❌ E10153 | mixed signedness (R33) |
| `word` | `sword` | ❌ E10153 | mixed signedness (R33) |
| `bool` | any integer | ❌ E10080 | bool not numeric (R34) |
| any | `ErrorType` | `ErrorType` | poison propagation (R114) |

**Assignment compatibility** (`isAssignableTo`):

| Source | Target | Result |
|--------|--------|--------|
| same type | same type | ✅ |
| `byte` | `word` | ✅ (widening) |
| `sbyte` | `sword` | ✅ (widening) |
| `word` | `byte` | ❌ E10154 (narrowing) |
| signed | unsigned | ❌ E10153 |
| `bool` | integer | ❌ E10152 |
| `EnumType` | `byte` | ❌ E10152 (need cast) |
| same `StructType` | same `StructType` | ✅ (copy) |
| diff `StructType` | diff `StructType` | ❌ E10152 |
| `ErrorType` | any | ✅ (suppressed) |

### 4.7 Const Evaluator Algorithm

```typescript
// In @blend65/frontend

interface ConstValue {
  readonly type: Type;
  readonly value: number | boolean;
}

function evalConst(
  expr: ExprNode,
  model: PartialSemanticModel,
  bag: DiagnosticBag
): ConstValue | null   // null = not const-evaluable → emit E10193
```

**Const-evaluable grammar** (R90):

| Expression Kind | Const? | Notes |
|-----------------|--------|-------|
| `NumericLitExpr` | ✅ | Always |
| `BoolLitExpr` | ✅ | Always |
| `CharLitExpr` | ✅ | Value from platform encoding |
| `IdentExpr` → `const` symbol | ✅ | Uses symbol's `constValue` |
| `IdentExpr` → `let`/param | ❌ | Not const |
| `BinaryExpr` (arith/compare/logic/bitwise) | ✅ if both operands const | Evaluate at compile time |
| `UnaryExpr` | ✅ if operand const | |
| `CastExpr` | ✅ if operand const | Apply cast semantics |
| `ConditionalExpr` | ✅ if all three parts const | Evaluate condition, select branch |
| `IntrinsicCallExpr` → `sizeof` | ✅ | Always (type-level) |
| `CallExpr` (user function) | ❌ | Never const |
| `FieldAccessExpr` | ❌ | Runtime struct access |
| `IndexExpr` | ❌ | Runtime array access |
| `EnumName.Member` | ✅ | Enum member backing value |

### 4.8 Call Graph

```typescript
// In @blend65/core

interface CallGraph {
  /** All functions in the program (nodes) */
  readonly functions: ReadonlySet<Symbol>;

  /** Directed edges: caller → Set<callee> */
  readonly edges: ReadonlyMap<Symbol, ReadonlySet<Symbol>>;

  /** Detect cycles → returns list of cycles (each cycle = list of symbols) */
  findCycles(): Symbol[][];
}
```

Recursion detection uses a standard depth-first search with coloring
(white/gray/black). A **gray→gray** back-edge indicates a cycle. All functions
participating in a cycle receive E10174.

### 4.9 Module Initialization Order

Module-level `let` variables with initializers are executed in a dependency-ordered
sequence (AR-91). The algorithm:

1. Build a dependency graph: for each module-level `let`, record which other
   module-level symbols its initializer references.
2. Topological-sort the graph.
3. If a cycle exists → E10194 on every symbol in the cycle.
4. The resulting order is stored in `SemanticModel.initOrder`.

### 4.10 SemanticModel Output

```typescript
// In @blend65/core

interface SemanticModel {
  /** The global scope tree (contains all module scopes, function scopes, etc.) */
  readonly globalScope: Scope;

  /** Map from expression AST nodes to their resolved types */
  readonly typeMap: ReadonlyMap<ExprNode, Type>;

  /** Map from identifier/reference AST nodes to their resolved symbols */
  readonly symbolMap: ReadonlyMap<AstNode, Symbol>;

  /** The static call graph */
  readonly callGraph: CallGraph;

  /** Module-level initialization order (topologically sorted) */
  readonly initOrder: ReadonlyArray<Symbol>;

  /** Resolved const values for all const symbols */
  readonly constValues: ReadonlyMap<Symbol, ConstValue>;

  /** All struct types with computed sizes and field offsets */
  readonly structTypes: ReadonlyMap<string, StructType>;

  /** All enum types with resolved member values */
  readonly enumTypes: ReadonlyMap<string, EnumType>;

  /** The main() function symbol (guaranteed to exist if no errors) */
  readonly mainFunction: Symbol | null;

  /** Whether any error diagnostics were emitted */
  readonly hasErrors: boolean;

  // Query helpers
  typeOf(expr: ExprNode): Type;
  symbolOf(node: AstNode): Symbol | null;
  scopeOf(node: AstNode): Scope;
}
```

### 4.11 Semantic Diagnostics

All diagnostic codes emitted by the semantic analyzer, consolidated from Ch 14:

#### Errors — Module & Program Structure

| Code | Condition | Message |
|------|-----------|---------|
| E10003 | Duplicate declaration in scope | `Duplicate declaration — '<name>' is already declared in this scope` |
| E10010 | Executable statement at module level | `Executable statements are not allowed at module level — place code inside a function` |
| E10012 | Import of non-exported item | `'<name>' is not exported from module '<module>'` |
| E10020 | No main function | `No 'main' function found — every program needs 'function main(): void'` |
| E10021 | Multiple main functions | `Multiple 'main' functions found — in modules '<A>' and '<B>'. Only one is allowed` |
| E10023 | Calling main directly | `Cannot call 'main()' directly — it is the program entry point, not a callable function` |

#### Errors — Scoping & Names

| Code | Condition | Message |
|------|-----------|---------|
| E10100 | Undeclared identifier | `'<name>' is not declared in this scope` |
| E10101 | Name shadows enclosing scope | `'<name>' shadows a declaration in an enclosing scope — use a different name` |

#### Errors — Type System

| Code | Condition | Message |
|------|-----------|---------|
| E10150 | Missing type annotation | `Type annotation required — write '<name>: <type>'` |
| E10151 | Unknown type | `Unknown type '<name>'` |
| E10152 | Type mismatch in assignment | `Cannot assign '<sourceType>' to '<targetType>'` |
| E10153 | Signed/unsigned mismatch | `Cannot mix signed and unsigned types — use explicit cast` |
| E10154 | Width narrowing without cast | `Cannot narrow '<wideType>' to '<narrowType>' — use explicit cast` |
| E10155 | Invalid cast | `Cannot cast '<fromType>' to '<toType>'` |

#### Errors — Operators & Expressions

| Code | Condition | Message |
|------|-----------|---------|
| E10080 | Invalid operand type | `Operator '<op>' cannot be applied to type '<type>'` |
| E10081 | Mixed signed/unsigned operands | `Cannot mix signed and unsigned types in '<op>' — use explicit cast` |
| E10082 | Division by zero (const) | `Division by zero in constant expression` |
| E10083 | Shift amount out of range | `Shift amount <N> is out of range for '<type>' (0–<max>)` |

#### Errors — Arrays

| Code | Condition | Message |
|------|-----------|---------|
| E10110 | Array size not compile-time | `Array size must be a compile-time constant expression` |
| E10111 | Array size zero | `Array size must be at least 1` |
| E10112 | Array size exceeds platform max | `Array of <N> bytes exceeds platform '<platform>' maximum (<max> bytes)` |
| E10113 | Const array without full init | `Const array must be fully initialized — provide all <N> elements` |
| E10114 | Index type mismatch | `Array index must be 'byte' or 'word' — found '<type>'` |
| E10115 | Static index out of bounds | `Index <N> is out of bounds for array of size <M>` |

#### Errors — Structs

| Code | Condition | Message |
|------|-----------|---------|
| E10160 | Unknown field | `Struct '<type>' has no field '<name>'` |
| E10161 | Missing field in initializer | `Struct initializer missing field '<name>'` |
| E10162 | Extra field in initializer | `Unknown field '<name>' in initializer for struct '<type>'` |
| E10163 | Empty struct | `Struct must have at least one field` |

#### Errors — Functions

| Code | Condition | Message |
|------|-----------|---------|
| E10170 | Wrong arg count in call | `Function '<name>' expects <N> arguments — found <M>` |
| E10171 | Arg type mismatch | `Argument <N> of '<name>' expects '<expected>' — found '<actual>'` |
| E10172 | Missing return value | `Function '<name>' must return '<type>' — missing return statement` |
| E10173 | Void function returns value | `Function '<name>' returns void — cannot return a value` |
| E10174 | Recursion detected | `Recursive call detected — '<name>' calls itself (directly or indirectly). Blend65 does not support recursion.` |
| E10175 | Too many parameters | `Function '<name>' has <N> parameters — maximum is 8` |

#### Errors — Control Flow

| Code | Condition | Message |
|------|-----------|---------|
| E10064 | For-loop end bound out of range | `For-loop end bound <value> is out of range for counter type '<type>' (<min>–<max>)` |
| E10130 | Break outside loop/switch | `'break' can only be used inside a loop or switch` |
| E10131 | Continue outside loop | `'continue' can only be used inside a loop` |
| E10132 | Duplicate case value | `Duplicate case value <N> in switch` |
| E10133 | Non-exhaustive switch on enum | `Switch on enum '<type>' is not exhaustive — missing cases: <list>` |

#### Errors — Enums

| Code | Condition | Message |
|------|-----------|---------|
| E10140 | Empty enum | `Enum must have at least one member` |
| E10141 | Too many enum members | `Enum '<name>' has <N> members — maximum is 256` |
| E10142 | Duplicate enum value | `Duplicate backing value <N> in enum '<name>'` |
| E10143 | Backing value out of range | `Backing value <N> is out of range for byte (0–255)` |

#### Errors — Variables

| Code | Condition | Message |
|------|-----------|---------|
| E10191 | Assignment to const | `Cannot assign to const '<name>' — constants cannot be reassigned` |
| E10192 | Const without initializer | `Const '<name>' must have an initializer — constants require a compile-time value` |
| E10193 | Non-constant initializer | `Initializer for const '<name>' is not a compile-time constant expression` |
| E10194 | Circular module-level initializer | `Circular initializer detected — '<name>' depends on itself (directly or indirectly) through module-level initialization order` |

#### Errors — Intrinsics

| Code | Condition | Message |
|------|-----------|---------|
| E10040 | Args to parameterless intrinsic | `'<name>()' takes no arguments — found <N>` |
| E10041 | Wrong argument count | `'<name>()' expects <N> arguments — found <M>` |

#### Errors — Data Inclusion

| Code | Condition | Message |
|------|-----------|---------|
| E10200 | Embed in non-const context | `embed() produces const data — use 'const' declaration` |
| E10201 | File not found | `Cannot find file '<path>' for embed()` |
| E10202 | Size mismatch | `embed('<path>') produces <N> bytes but array declares <M> bytes` |
| E10203 | Unknown selector | `Unknown selector '<name>' for format '<format>'` |
| E10204 | Format parse error | `Cannot parse '<path>' as '<format>' — <details>` |

#### Warnings

| Code | Condition | Message |
|------|-----------|---------|
| W10130 | Unreachable code | `Code after 'return'/'break'/'continue' is unreachable` |
| W10190 | Use before initialization | `Variable '<name>' may be used before being initialized` |
| W10191 | Unused variable | `Variable '<name>' is declared but never used` |

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|-------------|
| **RD-01** | Defines `@blend65/core` and `@blend65/frontend` packages where semantic analysis types and passes live. |
| **RD-02** | Lexer produces the tokens consumed by the parser. Semantic analysis does not interact with tokens directly, only with the AST. However, character literal values depend on the platform encoding established during lexing. |
| **RD-03** | Parser produces the `ProgramNode[]` AST that is the input to `analyze()`. The semantic analyzer consumes all 51 AST node kinds defined in RD-03 §4.2. Error-sentinel nodes (`ErrorExpr`, `ErrorStmt`, `ErrorType`) from the parser are propagated as `ErrorType` in the semantic model. |
| **RD-05** | SFA frame planner and ZP allocator consume the `SemanticModel` — specifically the scope tree, symbol types, call graph, struct sizes, and const values. SFA adds frame addresses and ZP slots. |
| **RD-06** | IL lowering consumes the `SemanticModel` to produce typed IL. The `typeMap`, `symbolMap`, `constValues`, and `callGraph` are all direct inputs to IL generation. |
| **RD-10** | Platform profile system provides the `PlatformProfile` parameter to `analyze()`. The semantic analyzer queries it for: character encoding (char/string literal values), available intrinsics and their descriptors, platform-specific resource limits for array-size warnings (E10112). |
| **RD-11** | Diagnostics & resource reporting. All diagnostic codes in §4.11 are emitted by the semantic analyzer into the shared `DiagnosticBag`. RD-11 owns rendering and severity-policy application. |
| **RD-14** | Language server reuses `analyze()` to provide hover types, go-to-definition (via `symbolMap`), diagnostics, and completions. The `SemanticModel` is the primary data source for LSP features. |
| **RD-17** | Intrinsic descriptor registry provides the typed descriptors consumed by R95–R100. The semantic analyzer queries the registry (populated by core + platform plugins) to validate intrinsic calls. |

---

## 6. Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-01 | `analyze()` accepts a `ProgramNode[]` from `parse()` and returns a `SemanticModel` with no thrown exceptions, even for programs with errors. |
| AC-02 | A program with `module Main; function main(): void { poke(0xD020, 5); }` produces a `SemanticModel` with `hasErrors === false`, a resolved `mainFunction` symbol, and correct type annotations for the `poke()` intrinsic call. |
| AC-03 | A program with an undeclared identifier `x` emits exactly one E10100 diagnostic with the correct span pointing to `x`. |
| AC-04 | A program assigning `word` to `byte` without a cast emits E10154 with a message naming both types. |
| AC-05 | A program mixing `byte + sbyte` emits E10153. |
| AC-06 | A program with `let x: bool = 5;` emits E10152 (type mismatch). |
| AC-07 | A program with two functions `a() → b() → a()` (indirect recursion) emits E10174 for both functions. |
| AC-08 | A program with no `main()` emits E10020. A program with two `main()` functions emits E10021. |
| AC-09 | A `const` with a non-constant initializer (e.g., referencing a `let` variable) emits E10193. |
| AC-10 | Struct literal with a missing field emits E10161; with an extra field emits E10162. |
| AC-11 | Enum with duplicate backing values emits E10142. Enum with >256 members emits E10141. |
| AC-12 | `break` outside a loop/switch emits E10130. `continue` outside a loop emits E10131. |
| AC-13 | A program with an error in expression `x` and a subsequent expression `x + 1` emits only **one** diagnostic (for `x`), not a cascaded type error for the addition — demonstrating poison-type suppression. |
| AC-14 | The `typeMap` correctly maps every non-error expression node to its resolved `Type`. Verified by inspecting types of literals, binary expressions, function calls, field accesses, and index expressions. |
| AC-15 | The `callGraph` correctly represents all call edges and `findCycles()` returns an empty array for acyclic programs. |
| AC-16 | Module-level `let` initializers with a dependency cycle emit E10194. |
| AC-17 | An `if` condition with an integer expression (not `bool`) emits E10080. |
| AC-18 | Golden-snapshot tests: the diagnostic output for a suite of test programs is deterministic and matches committed snapshots (H5, AR-74). |
| AC-19 | `sizeof(StructType)` evaluates to the correct compile-time constant (sum of field sizes, no padding). |
| AC-20 | Array with size 0 emits E10111. Array with non-constant size emits E10110. |

---

## 7. Open Questions

1. **Struct recursive-reference detection depth**: Should the compiler detect indirect
   recursive structs (A contains B contains A) to an arbitrary depth, or cap the
   detection at a fixed depth? Recommendation: arbitrary depth via cycle detection on
   the struct-field type graph during Pass 2. Confirm during implementation.

2. **`embed()` file path resolution**: Ch 13 says "relative to the source file." Should
   it also search relative to the project root, or only the source file? The spec is
   slightly ambiguous. Recommendation: source-file-relative first, then project-root
   fallback. Confirm with spec author.

3. **For-loop counter shadowing**: A for-loop counter introduces a block scope (R11).
   If a module-level variable has the same name as a for-loop counter, R10 (no
   shadowing) would make this an error. This is intentional per the spec but may
   surprise developers. Confirm this is the desired behavior.

4. **`fallthrough` in default clause**: R79 says `fallthrough` is valid only in
   non-default case clauses. The spec should confirm that `fallthrough` in a `default`
   clause is an error. If so, a dedicated diagnostic code is needed (not currently in
   Ch 14).
