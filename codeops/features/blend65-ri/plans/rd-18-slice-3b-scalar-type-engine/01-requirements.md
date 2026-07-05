# Requirements: RD-18 Slice 3b — Scalar Type Engine

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-18](../../requirements/RD-18-codegen-language-completion.md) (Slice 3b row §Slice Map; AC-2)

## Purpose

Build the scalar type engine so a program using local **and** module-level scalars, same-type
`+ - * / %`, `=`, and `peek`/`poke(w)` compiles and **VICE-verifies a computed result**, and
mixed-signedness is **rejected with E10081**. This closes RD-04 Passes 1/3/4 for the scalar surface.

## Functional Requirements

### FR-1 — Scalar expression & literal typing (Pass 3)

Every expression node in a scalar program is assigned a real `Type` in `SemanticModel.typeMap`
(replacing `typeOf`→`ERROR_TYPE`). Covers, per spec Ch 02:
- **Numeric literal typing** (TS-2): value → default type (`0..255`→`byte`, `256..65535`→`word`,
  `-1..-128`→`sbyte`, `-129..-32768`→`sword`); **literal adaptation** to a typed context when the
  value fits; **out-of-range** literal in a typed context → **E10084** (spec `02:89–97`).
  *(E10084 is spec-designated but unregistered — registered additively per [AR-11](00-ambiguity-register.md).)*
- **Boolean literal** → `boolean` (TS-2).
- **Identifier expression** → the resolved symbol's type; unresolved → **E10100** + `ERROR_TYPE`
  poison (R16/R61/R115).
- **Same-type arithmetic** `+ - * / %` (TS-3): `T OP T → T` for the four integer types.
- **`lo`/`hi`** const intrinsics → `byte` (const-only, AR-2/spec).

> Widening (TS-4), auto-promotion, comparison→boolean (TS-7), logical/bitwise/shift, unary, casts
> (TS-11..13) are **OUT** (Slices 4/6). See [AR-3](00-ambiguity-register.md).

### FR-2 — Same-type / signedness enforcement (Pass 3)

- **Mixed signedness** in an arithmetic expression (e.g. `byte + sbyte`) → **E10081** and poison
  (spec TS-5, matrix §5.1). *This is AC-2's headline negative case.*
- **Boolean in arithmetic** (`byte + boolean`, etc.) → **E10080** (InvalidOperandType; ledger R34,
  Ch 14). *(Registry E10151 = `UnknownType`, not boolean-in-arith; corrected per [AR-11](00-ambiguity-register.md).)*
- **Assignment compatibility** (`isAssignableTo`, real): same type ✅; **narrowing** (word→byte) →
  **E10154** (WidthNarrowingNoCast; ledger R32); **cross-signedness** (byte↔sbyte) → **E10153**
  (SignedUnsignedMismatch; ledger R33); **boolean↔integer** assignment → **E10152**
  (TypeMismatchAssignment; RD-04 AC-06) — out of the scalar fixture but implemented if trivial.
  *(Codes corrected per [AR-11](00-ambiguity-register.md): stale spec §5.3 used E10082/E10080/E10086,
  which collide with the registry; E10086 dropped — casts are Slice 6.)* Same-signedness widening on
  assignment (byte→word) is **deferred** (AR-3) — 3b requires same type on assignment.
- **Missing type annotation** on a `let`/`const` → **E10150** (TS-1).

### FR-3 — Poison propagation (R114)

An `ErrorType` operand yields an `ErrorType` result **without** cascading further diagnostics
(one diagnostic per root cause). `isAssignableTo`/binary typing treat `ErrorType` as compatible
(suppression), per RD-04 R114 / AC-13 (scalar subset).

### FR-4 — Module-level scalar declaration & allocation (Pass 1 + SFA)

- Top-level `let name: T;` (initializer-less, AR-2) in a module is collected as a `variable`
  `Symbol` in the **module** scope (not a function body scope), with its resolved primitive `Type`.
- A `modelToModuleVars(model)` projection produces `ModuleVarInput[]`; `run-frontend` feeds it to
  `planAllocation` (replacing `moduleVars: []`), so SFA emits `__var_<Module>_<name>` symbols.
- Module scalars are **read and written from function bodies** (cross-scope name resolution).
- A **duplicate** top-level declaration → **E10003** (R9/R20). A **module-level executable
  statement** is already a parse concern; no new check required for the fixture.

### FR-5 — `main()` validity (Pass 4)

- **No `main`** in the program → **E10020**; **more than one `main`** → **E10021** (R66).
- `main` signature must be `(): void` with **no parameters** → **E10022** (spec Ch 06 /
  `00-feature-index` / `F004`; spec-designated but unregistered — registered additively per
  [AR-11](00-ambiguity-register.md)).
- **E10023** (calling `main` directly) is **deferred to Slice 5** (needs call support) — AR-7.

### FR-6 — Minimal const-eval (Pass 3, scalar subset)

A minimal constant evaluator supports **literal folding**, **`lo`/`hi` of a constant**, and the
**literal-range** check (E10084). Full const-eval (array sizes, aggregates, R88–R93) stays deferred
(Slice 7). Const **division by zero** in a const context → **E10082**‑band (`ConstDivisionByZero`
E10082 per registry) if reachable by the minimal evaluator; otherwise deferred with the rest.

### FR-7 — Width-aware lowering (codegen)

- Lowering consumes the model's `typeMap`: `lowerNumericLit` and `lowerBinary` derive IL width from
  the real expression type (not the `IL_BYTE` hardcode), so word scalars & word literals propagate
  and `word * word` reaches `__rt_mul16`.
- Module-variable **read/write** lowers to `load`/`store` against the `__var_*` symbol (paralleling
  the `__frame_*` path); `lowerToIL` walks module-var reads/writes via the symbol scheme.

### FR-8 — Acceptance (three-part bar) & fixture

Per [AR-4/AR-6](00-ambiguity-register.md) and [03-04](03-04-acceptance-fixtures.md): the byte+word
fixture assembles clean, matches a committed ASM golden, and VICE-asserts `$C000==$11`,
`$C001==$58`, `$C002==$02`; a separate negative test asserts **E10081** on `byte + sbyte`.

### FR-9 — `spec/` frozen; no new codes; emit-diagnostic-never-throw

`git status --porcelain spec/` stays empty (D3). All codes 3b emits are the canonical registry codes
per the [AR-11](00-ambiguity-register.md) reconciliation table — two (**E10084**, **E10022**) are
registered additively in `diagnostic-codes.ts` (Language-Guard-approved, RD-18 AR-115); no `spec/`
edit. Every new semantic check **emits a diagnostic, never throws**; no ICE (`E9xxxx`) on user input
(AR-15/AR-68/AR-70).

## Should Have

- **SR-1** — `examples/slice3b/main.blend` doubles as the VICE fixture and living documentation.
- **SR-2** — record the `ResourceReport` delta (bytes/ZP) 3b adds vs the Slice-3a baseline.
- **SR-3** — document the AR-1 **`>13-byte` RAM/code collision ceiling** loudly in the closeout.

## Won't Have (Out of Scope)

Widening/auto-promotion/`as` casts/`zext`·`sext`·`trunc` (Slice 6); comparison & logical operators,
control flow (Slice 4); user calls, E10023 (Slice 5); module-var **initializers** + `initCode`
(deferred); **signed** `*`/`/`/`%` (future signed slice; AR-5); the RAM-collision **fix** (deferred);
`W10190` use-before-init and other Pass-4 dataflow warnings (deferred).

## Acceptance Criteria

1. [ ] **AC-1** — `examples/slice3b/main.blend` (byte+word scalars, module + local) compiles through
       the real type engine to a loadable c64 PRG with zero undefined symbols.
2. [ ] **AC-2** — committed `slice3b.asm.golden` matches `--emit-asm`; contains `__var_Main_accB`,
       `__var_Main_accW`, and the `__rt_mul8`/`__rt_mul16` call sites.
3. [ ] **AC-3** — on real VICE: `$C000==$11` (byte `a*b+c`), `$C001==$58` & `$C002==$02` (word `x*y`).
4. [ ] **AC-4** — a `byte + sbyte` program is **rejected with exactly E10081** (never throws, never
       emits a binary).
5. [ ] **AC-5** — `typeMap` is correct for the fixture's scalar expressions; `symbolMap` resolves
       every identifier; unresolved identifier → E10100 (negative test).
6. [ ] **AC-6** — a program with no `main` → E10020; two `main` → E10021; a `let x = 5` (no
       annotation) → E10150 (negative tests).
7. [ ] **AC-7** — full workspace verify green; `git status --porcelain spec/` empty; R15 boundary green.
8. [ ] **AC-8** — parent ACs advanced (RD-18 AC-2; RD-04 AC-02/03/05/06/08 + ledger rows) and roadmap synced.
