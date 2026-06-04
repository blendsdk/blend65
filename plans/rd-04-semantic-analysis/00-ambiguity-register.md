# RD-04 Semantic Analysis (Skeleton) — Ambiguity Register

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Status**: ✅ GATE PASSED — 12 items resolved at planning (D1–D12) / 2 added during preflight (D13–D14) / 1 added during execution (D15, supersedes D14), all confirmed by user
> **Last Updated**: 2026-06-04



> **Purpose**: Plan-level Zero-Ambiguity Gate. Every decision in the RD-04 plan that is
> *not* already fixed by the frozen `spec/` or by `requirements/RD-04-semantic-analysis.md`
> is recorded here, with its resolution, before any document or code depends on it.

## Scope of this register

The defining decision for this plan is **strategic**: per the project's own research
(`research/feasibility-and-strategy.md` — *"ship with NO optimizer first," "correct before
fast," "build incrementally"*), the semantic **checker** is intentionally **not** built in
this iteration. We first want a working compiler that emits correct code end-to-end; the
real type/scope/control-flow analyzer is a deliberate later investment.

Therefore **RD-04 in this plan = the complete public surface of semantic analysis with a
no-op passthrough `analyze()`**. Every interface, type, and contract from RD-04 §4 is
delivered so downstream phases (RD-05 SFA, RD-06 IL, RD-07 codegen, RD-14 LSP) can compile
against a stable `SemanticModel`; but `analyze()` enforces **none** of the R30–R117 rules
yet. A first-class **Deferred Semantics Ledger** ([08](08-deferred-semantics-ledger.md))
records exactly what is stubbed so the real checker can be built later from a precise map.

The first twelve items (D1–D12) were reviewed with the user and confirmed before authoring.
Two further items (D13–D14) were surfaced by the **preflight audit** and confirmed by the user
on 2026-06-03 before the plan was marked execution-ready. A fifteenth item (D15) was surfaced
during **execution** when the Phase 1 gate revealed that D14 had addressed only the ESLint gate
and missed the prior `tsc --noUnusedParameters` gate; D15 supersedes D14 with a mechanism that
satisfies both, confirmed by the user on 2026-06-04.



---

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| D1 | Scope | Build the full RD-04 analyzer now, or a passthrough skeleton? | A: full four-pass checker (R1–R121) · B: passthrough skeleton — full interfaces/contracts, `analyze()` is a no-op | **B** — passthrough only; real checker deferred to a later RD (research strategy: working compiler first) | ✅ Resolved |
| D2 | Behavioral | What does passthrough `analyze()` put in the returned `SemanticModel`? | A: empty-but-valid (single global `Scope`, `hasErrors=false`, `mainFunction=null`, empty maps; no AST walk) · B: Pass-1-only declaration collection | **A** — empty skeleton, no AST walking | ✅ Resolved |
| D3 | Behavioral | Does passthrough `analyze()` ever emit diagnostics? | A: never (always `hasErrors=false`) · B: propagate parser error-sentinels only | **A** — never emits; always `hasErrors=false` | ✅ Resolved |
| D4 | Technical / Integration | `PlatformProfile` param (RD-10 not built). | A: define a minimal `PlatformProfile` interface stub in `@blend65/core` now (RD-10 supersedes) · B: make `profile` optional / omit | **A** — minimal stub interface in core | ✅ Resolved |
| D5 | Data | Semantic primitive type name: frozen AST uses `"boolean"`; RD-04 §R25 says `'bool'`. | A: semantic `Type` uses `"boolean"` (match AST, no churn) · B: use `'bool'` + map at boundary | **A** — use `"boolean"` to match the frozen AST | ✅ Resolved |
| D6 | Technical | `analyze()` signature shape. | A: object `analyze(input: AnalyzeInput)` `{ programs, bag, profile }` (mirrors RD-03 `ParseInput`) · B: positional per R118 | **A** — object signature, future-proof (matches RD-03 AR-8) | ✅ Resolved |
| D7 | Technical | Where do the semantic data types live? | A: `Type`+utils, `Scope`, `Symbol`, `CallGraph`, `ConstValue`, `SemanticModel`, `PlatformProfile` in `@blend65/core`; `analyze()` in `@blend65/frontend` · B: all in frontend | **A** — data in core, logic in frontend (mirrors RD-03 AR-5) | ✅ Resolved |
| D8 | Documentation | How are deferred checks documented so the real analyzer can be built later? | A: a dedicated `08-deferred-semantics-ledger.md` + in-code `// DEFERRED(RD-04-checker)` markers + requirements-doc annotation · B: code comments only | **A** — three-layer deferral documentation | ✅ Resolved |
| D9 | Process | `requirements/RD-04-semantic-analysis.md` treatment. | A: annotate it (not frozen) — mark R30–R117 + AC-02..AC-20 as DEFERRED, keep R1–R29/R118–R121 + AC-01 as in-scope · B: leave untouched | **A** — annotate the (non-frozen) requirements doc | ✅ Resolved |
| D10 | Technical | Type-utility functions (`isInteger`, `commonType`, `isAssignableTo`, …) — implement now or stub? | A: implement the trivially-pure, checker-independent ones (`isInteger`, `isSigned`, `isUnsigned`, `bitWidth`, `byteSize`, `isError`, `typeName`); stub the policy ones (`isAssignableTo`, `commonType`) with a `// DEFERRED` marker · B: stub all | **A** — implement the pure structural utils, defer the type-policy ones | ✅ Resolved |
| D11 | Scope | RD-04 §7 open questions (recursive-struct depth, embed path resolution, for-loop shadowing, fallthrough-in-default code). | A: defer all four with the checker (they are checker behavior; none needed for passthrough) · B: resolve now | **A** — parked in the ledger for the future checker | ✅ Resolved |
| D12 | Process | Commit mode for execution. | ask / no-commit / auto-commit | **no-commit** (identical to RD-01/02/03/11a) | ✅ Resolved |
| D13 (preflight) | Technical | `bitWidth`/`byteSize` contract on `void`/`error`/`struct`/`array` — the `8 \| 16` return type contradicts the doc's "throws-free" claim. | A: throw on non-width types · B: narrow `bitWidth` to `PrimitiveType` + make `byteSize` total with documented sentinels (`void`/`error`→0) · C: defer to runtime | **B** — narrow `bitWidth(t: PrimitiveType)`; `byteSize(t: Type)` total & never throws | ✅ Resolved |
| D14 (preflight) | Technical | Lint approach for the 4 pass-seam + 2 policy-stub unused params (`eslint.config.mjs` has no `argsIgnorePattern`, so `_`-prefix fails lint). | A: `_`-prefix only (FAILS lint) · B: scoped `eslint-disable @typescript-eslint/no-unused-vars` + rationale · C: drop params, re-add with checker | **B** — scoped `eslint-disable` with rationale (drop-params is documented fallback) | ⛔ Superseded by D15 |
| D15 (runtime) | Technical | D14 missed that `tsconfig.base.json` sets `noUnusedParameters: true`, so the stub seams fail **`tsc` (TS6133)** before ESLint — and an `eslint-disable` cannot suppress a tsc error. The seams must pass BOTH gates. | A: `_`-prefix params + add `argsIgnorePattern: "^_"` to root ESLint (canonical, reusable) · B: `_`-prefix + keep scoped `eslint-disable` (two mechanisms) · C: `void param;` statements in each body | **A** — `_`-prefix (satisfies tsc) + root-ESLint `argsIgnorePattern: "^_"` (satisfies ESLint); removes the D14 scoped disable | ✅ Resolved |

---



## Resolution Notes

### D1 — Passthrough skeleton, not the full checker

The decisive driver is the documented project strategy. `research/feasibility-and-strategy.md`
(Question 1, *Recommendation*) is explicit: *"ship with NO optimizer first. Correct
unoptimized code beats broken optimized code every time"* and *"Add features … incrementally,
one at a time."* RD-04 §1 itself anticipates this by invoking the **walking-skeleton**
methodology (AR-38). The user's instruction: *"we will not implement the analyze in the MVP
… the MVP analyzer would have all the correct interfaces, contract and what not, but it would
be passthrough only … Later when the compiler can produce working code, we would invest
resources to create [the] analyzer."*

**Consequence:** this plan delivers RD-04 §3.5 (type representation, R24–R29), §3.2/§3.3 data
shapes (scope/symbol — structures only), §3.11/§3.8/§3.12 data shapes (call graph, const
value), §4.10 (`SemanticModel`), and §3.17 (`analyze()` API, R118–R121) — as **interfaces +
a passthrough implementation**. It does **not** implement §3.6 (type checking), §3.7 (casts),
§3.8 (expression typing behavior), §3.9–§3.10 (declaration/statement validation), §3.11
behavior (recursion detection), §3.12 behavior (const evaluation), §3.13 (intrinsic
validation), §3.14 (array/embed validation), §3.15 (warnings), §3.16 (error tolerance
behavior). Every one of those is logged in the [Deferred Semantics Ledger](08-deferred-semantics-ledger.md).

### D2 / D3 — Empty model, no diagnostics

The passthrough returns a structurally valid `SemanticModel` with: one root `global` `Scope`
(no children populated), `hasErrors === false`, `mainFunction === null`, and every map
(`typeMap`, `symbolMap`, `constValues`, `structTypes`, `enumTypes`) empty, `callGraph` with
no nodes/edges, `initOrder` empty. It performs **no** AST traversal and adds **nothing** to
the `DiagnosticBag`. This is the smallest honest implementation of "passthrough only" and
satisfies **AC-01** (accepts `ProgramNode[]`, returns a model, never throws). Downstream
phases get the *shape* of the contract immediately; they get *data* when the real checker
lands. The query helpers (`typeOf`, `symbolOf`, `scopeOf`) return defined safe values
(`ErrorType` / `null` / the global scope respectively) — documented in
[03-02](03-02-scope-symbol-model.md) and ledgered.

### D4 — Minimal `PlatformProfile` stub in core

RD-04 R118/R120 require a `PlatformProfile` parameter providing char encoding, available
intrinsics, and resource limits. RD-10 (which owns the real profile system) is not built.
A **minimal placeholder interface** is defined in `@blend65/core` so `analyze()` carries its
true R118 signature today; RD-10 will supersede/extend it (additive, F2 platform-profile
ready). The passthrough does not read the profile — it is accepted and ignored — so the stub
needs only the documented field *shape*, not behavior. Ledgered.

### D5 — Semantic type name is `"boolean"` (match the frozen AST)

The as-built AST (`packages/core/src/ast/nodes.ts`) defines
`PrimitiveTypeName = "byte" | "sbyte" | "word" | "sword" | "boolean" | "void"`. RD-04 §R25/§4.4
illustrate the semantic `PrimitiveType.name` with `'bool'`. To avoid a needless boundary-
mapping layer and any AST churn (D3-freeze of spec is unrelated, but minimising surface is
prudent), the semantic `PrimitiveType.name` reuses the **same six-name union** as the AST,
i.e. `"boolean"`, not `'bool'`. RD-04's `'bool'` spelling is treated as superseded
illustration. This is recorded so the future checker uses `"boolean"` consistently.

### D6 — Object signature `analyze(input: AnalyzeInput)`

Consistent with RD-03's `parse(input: ParseInput)` decision (RD-03 AR-8), `analyze()` takes a
single input object: `AnalyzeInput = { programs: readonly ProgramNode[]; bag: DiagnosticBag;
profile: PlatformProfile }`. This is future-proof (F1-Extensible): later the real checker can
add **optional** fields (options, cancellation token for the LSP) with no breaking change.
RD-04 R118's positional illustration is treated as superseded.

### D7 — Data in `@blend65/core`, `analyze()` in `@blend65/frontend`

Mirrors RD-03 AR-5 and the project's data-vs-logic split. The semantic *data* vocabulary
(`Type` union + utilities, `Scope`, `Symbol`, `SymbolKind`, `ScopeKind`, `CallGraph`,
`ConstValue`, `SemanticModel`, `PlatformProfile`) lives in a new `semantics/` module under
`@blend65/core`, shared by `frontend` and `language-server` (neither imports `codegen`,
R15/AR-20). The `analyze()` function + its four stubbed pass functions live in
`@blend65/frontend`'s new `semantics/` module, on top of the frozen AST.

### D8 — Three-layer deferral documentation

The user requires that what-is-not-implemented be discoverable when the real analyzer is
resumed. Three layers:
1. **[08-deferred-semantics-ledger.md](08-deferred-semantics-ledger.md)** — the authoritative
   table: every requirement R1–R121 and AC-01..AC-20 with status
   `IMPLEMENTED (interface)` / `IMPLEMENTED (passthrough)` / `DEFERRED (no behavior)`, the
   diagnostic code(s) each deferred check would emit, and the four §7 open questions parked.
2. **In-code markers** — every stub site carries `// DEFERRED(RD-04-checker): Rxx — <what>`
   pointing back to the ledger row.
3. **Doc annotations** — `requirements/RD-04-semantic-analysis.md` gains a `SEMANTICS-DEFERRED`
   banner; the `SemanticModel` and `analyze()` JSDoc state the passthrough contract.

### D9 — Annotate the (non-frozen) requirements doc

Only `spec/` is frozen (D3). `requirements/RD-04-semantic-analysis.md` may be annotated. A
banner is added marking R30–R117 and AC-02..AC-20 as **DEFERRED to the future semantic-checker
RD**, while R1–R29 (data shapes), R118–R121 (API), and AC-01 (no-throw passthrough) are the
**in-scope** deliverables of this plan. No requirement text is deleted — only status-annotated
— so the future checker inherits the full specification intact.

### D10 — Implement pure structural type utils; stub the policy utils

RD-04 §4.4 lists type-utility functions. The ones that are **pure structural facts** about a
`Type` (independent of checker policy) are implemented now because they are trivial, useful to
downstream phases, and cannot drift: `isInteger`, `isSigned`, `isUnsigned`, `bitWidth`,
`byteSize`, `isError`, `typeName`. The ones that encode **type-system policy** —
`isAssignableTo` (R36/§4.6) and `commonType` (R31/widening, §4.6) — are **stubbed** with a
documented placeholder behavior and a `// DEFERRED(RD-04-checker)` marker, because their real
behavior is exactly the checking logic being deferred. Ledgered with their target rules.

### D11 — §7 open questions parked with the checker

RD-04 §7 raises four questions: (1) recursive-struct detection depth, (2) `embed()` path
resolution, (3) for-loop counter shadowing, (4) `fallthrough`-in-`default` diagnostic code.
All four are **checker behavior** with **no** bearing on the passthrough skeleton. They are
recorded verbatim in the ledger's "Parked Open Questions" section to be resolved with the user
when the real checker is planned. (Item 4 will likely need a new diagnostic code then.)

### D12 — Commit mode: `--no-commit`

The agent implements, verifies, and updates the execution plan, but performs **no** git
operations. The user handles all commits. Identical to RD-01/02/03/11a.

### D13 — `bitWidth`/`byteSize` contract (preflight)

Surfaced during the preflight audit: `03-01` typed `bitWidth(t: Type): 8 | 16` while its
error-handling table claimed throws-free defined behavior for `void`/`error`/`struct`/`array`
— which `8 | 16` cannot express. Resolved by **narrowing**:
- `bitWidth(t: PrimitiveType): 8 | 16` — defined only for primitives (8 for
  `byte`/`sbyte`/`boolean`; 16 for `word`/`sword`; `void` is not a width-bearing primitive, so
  callers must not pass it — enforced by the parameter type, a compile-time guard, L7).
- `byteSize(t: Type): number` — **total** over the whole union with documented values:
  `byte`/`sbyte`/`boolean` → `1`; `word`/`sword` → `2`; `void`/`error` → `0`; `struct` →
  `struct.byteSize`; `array` → `byteSize(element) * size`. Never throws.

This keeps both utilities pure structural facts (D10) with fully-defined, total behavior
(H5-style determinism) and no runtime guesswork.

### D14 — Lint approach for the stub seams (preflight) — ⛔ SUPERSEDED BY D15

> **Superseded.** D14 analysed only the ESLint gate and concluded a scoped
> `eslint-disable` was required. Execution (Phase 1 gate) revealed D14 was based on an
> incomplete picture — see D15. The scoped-`eslint-disable` mechanism is **not** used in the
> as-built code; the `_`-prefix + `argsIgnorePattern` mechanism of D15 is. The original
> analysis is retained below for the decision record.

The as-built root `eslint.config.mjs` is `tseslint.configs.recommended` + prettier with **no**
`argsIgnorePattern`. Therefore a `_`-prefix on an unused parameter does **not** silence
`@typescript-eslint/no-unused-vars` — it still errors, failing the `yarn lint` phase gate. The
four pass-seam functions (`collectDeclarations`/`resolveTypes`/`checkBodies`/`postCheck`) and
the two type-policy stubs (`isAssignableTo`/`commonType`) intentionally keep their parameters
to document the future checker's signature. Resolution: wrap each stub body / file region in a
**scoped `eslint-disable @typescript-eslint/no-unused-vars`** carrying a rationale comment that
references this register and the code.md rule-4 planned-seam exception. The `_`-prefix-only
option is rejected (it fails lint); dropping the params is the documented fallback only if a
future lint-config change makes the scoped disable itself unused.

### D15 — Unused-parameter seams must pass BOTH tsc and ESLint (runtime)

Surfaced during execution at the **Phase 1 verify gate**. D14 reasoned only about ESLint and
prescribed a scoped `eslint-disable @typescript-eslint/no-unused-vars`. But the verify pipeline
runs `tsc` (build + typecheck) **before** ESLint, and `tsconfig.base.json` sets
`noUnusedParameters: true`. So the stub seams failed first with **`tsc` error TS6133**
(`'source' is declared but its value is never read`, etc.) — and an `eslint-disable` directive
**cannot** suppress a TypeScript compiler error. D14's mechanism was therefore unworkable as
written.

Two independent gates must pass: **tsc** (`noUnusedParameters`) and **ESLint**
(`@typescript-eslint/no-unused-vars`). `tsc` honours the leading-`_` convention natively;
ESLint does not unless told. **Resolution (Option A):**
- Rename every intentionally-unused deferred-seam parameter to a `_`-prefixed name
  (`_source`/`_target`/`_a`/`_b` in `type-utils.ts`; `_input`/`_model` in the four frontend
  pass seams). This satisfies `tsc --noUnusedParameters`.
- Add a single root-level ESLint rule override:
  `"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern:
  "^_", caughtErrorsIgnorePattern: "^_" }]`. This satisfies ESLint and makes the `_`-prefix the
  **single canonical mechanism** for an intentionally-unused binding across the whole repo
  (aligning ESLint with `tsc` and with code.md rule 4's TypeScript convention).

The D14 scoped `eslint-disable` regions are removed. This mechanism is reusable for every future
deferred seam (e.g. RD-05+), so it is preferred over a localized per-file disable. Verified: the
full `build && typecheck && lint && test` gate passes across all 10 packages with `spec/` clean.


---


## Surface-during-authoring rule

If authoring or implementation surfaces a *new* ambiguity, **STOP**, add it here as the next
`D-N` (tagged `(runtime)` if found during execution), resolve it with the user, back-propagate
the resolution into the affected plan documents, then resume. Do not fill gaps by guessing.
