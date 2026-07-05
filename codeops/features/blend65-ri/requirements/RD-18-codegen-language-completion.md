# RD-18: Codegen Language-Feature Completion (vertical-slice rollout)

> **Document**: RD-18-codegen-language-completion.md
> **Status**: Draft
> **Created**: 2026-07-03
> **Project**: Blend65 Compiler (`blendc`)
> **Depends On**: RD-04, RD-05, RD-06, RD-07, RD-09, RD-10, RD-11, RD-12, RD-17
> **Supersedes**: the provisional `RD-04b-semantic-checker` plan and the horizontal
> "implement pass-by-pass" resume order both provisioned in
> `_archive/rd-04-semantic-analysis/08-deferred-semantics-ledger.md` (§"How to use this ledger", line 18; §resume, line 298)
> **CodeOps Skills Version**: 3.2.0

---

## Feature Overview

The compiler is a deliberate **walking skeleton at "slice 2"** (AR-38/AR-43/AR-44). Every
pipeline *stage* exists and the frozen language (`spec/` chapters 01–13) is fully specified,
but the *implementation* covers only the MVP gate (`poke` a constant) plus one local `byte`.
Between the (near-complete) parser and the (complete, VICE-proven) ACME/runtime/ harness
layers sits an unbuilt middle: the semantic analyzer's type-resolution (Pass 2) and post-check
(Pass 4) are no-ops (`packages/frontend/src/semantics/passes.ts:42,83`), so
`modelToFunctionInfo` returns `[]` (`packages/frontend/src/sfa/model-adapter.ts:34-36`) and the
fully-built SFA/ZP allocator is **starved** — no real program produces frame symbols, so
nothing beyond the constant-`poke` gate assembles. IL lowering (`packages/codegen/src/il/lower.ts`)
and IL→Instr translation (`packages/codegen/src/instr/translate.ts`) cover only the matching
slice; control flow, user calls, `&&`/`||`, compound assignment, unary/member/index, and the
`br`/`brcond`/`call` ops all ICE.

**This RD is a thin rollout tracker, not a requirements restatement.** The language rules are
already authored — RD-04 (semantic analysis, 121 reqs), RD-06 (IL lowering "for all 51 node
kinds"), RD-07 (IL→Instr "for all ops") — and frozen in `spec/`. RD-18 does **not** re-specify
them; it **references** them and defines the *rollout*: a dependency-ordered sequence of
**vertical language slices** that each grow the four unbuilt middle stages —
**semantic analysis → `modelToFunctionInfo` projection → IL lowering → IL→Instr translation** —
in lockstep for one language surface, and prove that surface **runs on real 6502 hardware**
via the RD-12 emulator harness. The goal is **100% working _unoptimized_ code for the entire
frozen language**; the two optimizer seams (RD-06 IL passes, RD-08 peephole rules) stay
excluded and are tackled afterward (Phase B), per the standing "correctness first, then
optimizers" strategy.

Its backlog of concrete deferred requirements is the RD-04
`08-deferred-semantics-ledger.md` (every ⛔ DEFERRED row, with its pass ownership and
complexity tag) plus the un-lowered node kinds in RD-06/RD-07. RD-18 maps those items onto
slices and drives the parent RDs' open acceptance criteria to closure.

---

## Functional Requirements

### Must Have

- [ ] **A thin, reference-only rollout RD.** RD-18 restates **no** language rule; every slice's
      normative surface is cited to `spec/` chapters + the relevant RD-04/06/07 requirement IDs
      and the `08-deferred-semantics-ledger.md` rows. No fourth source of truth is created.
- [ ] **Six vertical slices, dependency-ordered** (3a → 3b → 4 → 5 → 6 → 7 → 8; see Technical
      Requirements §Slice Map), each grown across semantic analysis → `modelToFunctionInfo` →
      IL lowering → IL→Instr translation, each closing a defined language surface.
- [ ] **Each slice = one `make_plan` derived from RD-18** (the single RD input for a cross-cutting
      vertical slice), taken through the per-RD workflow (preflight → make_plan → preflight →
      exec_plan) recorded in `00-roadmap.md`.
- [ ] **Three-part acceptance per slice** (§Acceptance Bar): (a) CI **assemble-clean** — every
      slice program assembles through ACME to a real PRG with **zero undefined symbols**;
      (b) CI **golden snapshot** — a committed `--emit-il` and/or `--emit-asm` and/or PRG-byte
      golden (`assertGolden`) that runs in CI (the emulator-independent regression guard); and
      (c) **local VICE runtime verification** via the RD-12 harness, asserting the observable
      behavior (register/memory) the slice program is designed to produce.
- [ ] **Supersede the phantom `RD-04b-semantic-checker`** and the ledger's horizontal
      pass-by-pass resume order. RD-18's vertical slices are the sole plan of record for the
      deferred semantic work; the ledger is consumed as the itemized backlog, not as a resume order.
- [ ] **Drive the parent RDs' open ACs to closure and reconcile the roadmap.** As each slice
      lands, tick the corresponding RD-04 (AC-02..20), RD-06 (AC-02), and RD-07 (AC-07..09)
      acceptance criteria, and keep the roadmap's RD-04/RD-06 status annotated as
      "slice-scoped; full scope driven by RD-18" rather than an unqualified ✅ COMPLETE.
- [ ] **Inherit the four parked ledger questions** into the Zero-Ambiguity Gate of the slice that
      owns them (§Parked-Question Routing): Q3 (for-loop counter shadowing) and Q4
      (`fallthrough` in `default` → **a new diagnostic code allocated at the gate** — no canonical
      code exists; the ledger's tentative "`E10134`" is already spent on `embed()`/F015 — which
      must pass the Blend65 Language Guard) → Slice 4; Q1 (recursive-struct depth) → Slice 7;
      Q2 (`embed` path resolution) → Slice 8.
- [ ] **Keep `spec/` untouched** (decision D3): `git status --porcelain spec/` stays empty across
      every slice.

### Should Have

- [ ] **`examples/` growth** — a small runnable `.blend` program per slice, doubling as the VICE
      acceptance fixture and living documentation of the newly-working surface.
- [ ] **Per-slice resource-report deltas** — record the code/binary/ZP figures (RD-11
      `ResourceReport`) each slice adds, so unoptimized-size growth is visible before Phase B.

### Won't Have (Out of Scope)

- **The two optimizers** — IL optimizer passes (RD-06 Phase B, `optimizeIL` currently `[]`) and
  the 11 peephole rules (RD-08 Phase B, `V1_RULES = []`). Deferred until the language is
  fully lowered; tracked under their existing RDs. *(AR-111)*
- **New language features** — the language is frozen at `spec-v3.0`; RD-18 implements the
  existing surface only. Deferred/rejected items (FUT-\*, REJ-\*) stay out.
- **A CI emulator tier** — VICE stays local-only (AR-27); CI enforces assemble-clean + goldens.
- **Signed `*`/`/`/`%` runtime routines** — deferred by RD-17 (AR-P16/PF-022); Slice 3b/6
  cover unsigned `byte`/`word` operand arithmetic only until a future signed-arithmetic slice.
- **LSP/VS Code consumption** of the richer semantic model — RD-14 owns that; RD-18 only makes
  the model *exist*, which RD-14 later reads.

---

## Technical Requirements

### The rollout model

Each slice is a **vertical** increment. It does **not** complete a whole stage; it adds exactly
enough of each middle stage to make one language surface compile and run:

```
spec surface  →  semantic analysis (RD-04 passes, scoped to the surface)
              →  modelToFunctionInfo projection (RD-05 adapter)
              →  IL lowering (RD-06 lower.ts cases)
              →  IL→Instr translation (RD-07 translate.ts cases + terminators)
              →  serialize→ACME→PRG (RD-09, done)  →  VICE (RD-12, done)
```

This is the AR-38 walking-skeleton methodology applied past slice 2, and is the reason the
slices are vertical (not "finish all of Pass 2, then all of lowering") — stage-first was
explicitly rejected (`requirements/README.md:195`, AR-38).

### Slice Map

| Slice | Language surface (frozen spec) | Middle-stage work | Backlog refs |
|-------|-------------------------------|-------------------|--------------|
| **3a — Model-seam proof** *(keystone plumbing)* | the existing gate + one local `byte`, but through the **real** populated-model path | populate a minimal real `SemanticModel`; implement `modelToFunctionInfo` (`sfa/model-adapter.ts:34`) so SFA emits `__frame_*`; prove model→SFA→symbol→ACME→PRG→VICE end-to-end | RD-05 adapter; `serialize-acme.ts:101-103` (already threads symbols) |
| **3b — Scalar type engine** | local + **module-level** scalars (`byte`/`sbyte`/`word`/`sword`/`boolean`), same-width `+ - * / %`, `=`, `peek`/`poke(w)`, const `lo`/`hi`; `main()` validity | RD-04 Pass 1 (scope/symbol table), Pass 3 (name-res + expression typing, real `isAssignableTo`/`commonType`, poison), Pass 4 (`main` sig); minimal const-eval for const scalars; module-var + `ILProgram.initCode` allocation | ledger Pass 1/3/4 rows (R7–R16, R31/R36, R44–R66, R80–R81, R114) |
| **4 — Control flow** | `if`/`else`, `while`, `do-while`, `for` (`to`/`downto`/`step`), `switch`/`case`/`default`/`break`/`continue`/`fallthrough`; boolean-condition rule (Ch 05) | RD-04 CFG validators (loop-context E10130/E10131; plus all-paths-return and non-boolean-condition — **new codes minted at this slice's gate**, absent from the canonical registry, see §Parked-Question Routing); RD-06 **multi-block CFG** + `br`/`brcond` terminators (`cfg.ts` is types-only today); RD-07 branch generation | ledger Ch-05 rows; **Parked Q3, Q4 (new `fallthrough` code)** |
| **5 — User functions & modules** | calls, params, return, calling convention, recursion detection (E10174), cross-module name resolution + imports, module init order (E10194) (Ch 06/10) | RD-04 call-graph + Pass 1 module merge + Pass 4 init order; RD-06 `call` op; RD-07 calling convention + prologue/epilogue | ledger R20–R23, R86, R107-adjacent; RD-06/07 `call` |
| **6 — Full expressions & mixed width** | `&&`/`\|\|` short-circuit, compound assignment, unary `- ! ~`, casts, mixed-signedness (E10081), auto-promotion, ternary, `zext`/`sext`/`trunc`, word/variable shifts, non-const `lo`/`hi` (Ch 02/04) | RD-04 full expression typing; RD-06/07 remaining ops (`neg`/`not`/`zext`/`sext`/`trunc`, word shifts, short-circuit lowering) | ledger Ch-04 rows; `translate.ts:258` deferred ops |
| **7 — Aggregates** | fixed arrays (indexing, `length`, tier1/2, optional bounds), structs (fields, member access, `offsetof`, nested), enums (member access, casts), const aggregates → data (Ch 07/08/09) | full **const evaluator** (array sizes, R88–R93); RD-04 aggregate typing; RD-06/07 `load_indexed`/`store_indexed`/`load_indirect`/`store_indirect` | ledger §12 const-eval, Ch-07/08/09 rows; **Parked Q1** |
| **8 — Hardware & advanced** | `interrupt` functions (prologue/epilogue/RTI), `zeropage` blocks, `&`-address-of for vector install, string/char encoding, `embed()`, CPU-control (T1) intrinsics end-to-end, non-terminating `main` (Ch 03§2.3/06§7/08/12/13) | RD-04 remaining validators; RD-06/07 interrupt lowering + `&`; RD-10/RD-17 encoding + T1 wiring | ledger Ch-06§7/12/13 rows; **Parked Q2** |

> Slice 3 is split (3a/3b) because the integration seam (does a *populated* model flow all the
> way to VICE?) is small and orthogonal to the type-engine risk (~20 RD-04 requirements across
> Passes 1/3/4). Proving the seam first de-risks the largest slice before the type engine piles on.

> **Const-evaluation grows per slice**, like the other stages — not in two lumps. Each slice pulls
> in exactly the folding its surface needs: Slice 3b = const scalars (`lo`/`hi`); **Slice 4 =
> `case`-label + `for`-bound integer constants**; Slice 6 = cast/shift folds; with the **full**
> evaluator (array/aggregate sizing, R88–R93) completing at Slice 7.

### Acceptance Bar (all three required per slice)

1. **Assemble-clean (CI):** every slice program compiles via the `build()` pipeline through ACME
   to a loadable PRG with **zero undefined symbols** (the `__frame_*`-undefined failure mode is
   the canonical thing this closes).
2. **Golden snapshot (CI):** a committed golden of the emitted **IL** (`--emit-il`) and/or **ASM**
   (`--emit-asm`) and/or **PRG bytes** (`assertGolden`, RD-12), running in the CI golden tier
   (which does **not** require VICE). This is the regression guard that re-proves behavior after
   merge, since CI cannot re-run the emulator.
3. **VICE runtime (local):** an RD-12 emulator test (`skipIf(!hasVice())`) that runs the slice
   program on real VICE 3.10 and asserts the observable register/memory outcome. Local-only per
   AR-27; proves correctness when a golden is first minted or intentionally changed.

### Parked-Question Routing

The four questions parked in `08-deferred-semantics-ledger.md:277-292` are resolved at the
**owning slice's** Zero-Ambiguity Gate (not now): Q3 (for-loop counter shadowing) → Slice 4;
Q4 (`fallthrough` in `default` needs a **new diagnostic code**; must pass the Language Guard) →
Slice 4; Q1 (recursive-struct depth limit) → Slice 7; Q2 (`embed()` path resolution + traversal
safety) → Slice 8.

**New diagnostic codes needed (Slice 4).** Three control-flow checks Slice 4 relies on have **no
code in the canonical registry** (`spec/14-diagnostics.md`) and need new ones minted at the gate:
(a) **non-boolean condition** (`E10100` in stale spec text = *Undeclared identifier*, so it is not
available); (b) **all-paths-return completeness** (`E10102` exists only in the stale scheme, absent
from the canonical registry — the nearest canonical `E10172` is a *different* "missing return
statement" check); (c) **`fallthrough` in `default`** (the ledger's tentative `E10134` is already
spent on `embed()`/F015). Per **Scope Decisions §New diagnostic codes (AR-115)**, these codes are
added to `@blend65/core`'s `diagnostic-codes.ts` **only** — `spec/` stays frozen (D3) — with the
Ch-14 canonical-registry drift recorded as an accepted deviation until a post-freeze spec
reconciliation. (Recursion, by contrast, already has the canonical unified `E10174`; no new code.)

---

## Integration Points

### With RD-04 (Semantic analysis) — *primary backlog owner*
RD-18 drives RD-04's deferred Passes 2/4 + real Pass 3 to completion, slice by slice, consuming
`08-deferred-semantics-ledger.md` as the itemized backlog and **superseding** its horizontal
resume order and the phantom `RD-04b` plan.

### With RD-05 (SFA) — *the starved-allocator seam*
Slice 3a implements `modelToFunctionInfo` so the already-complete SFA/ZP allocator receives real
`FunctionInfo[]` + module/ZP vars and emits `__frame_*`/`__var_*`/ZP symbol definitions.

### With RD-06 (IL lowering) & RD-07 (IL→Instr)
Each slice widens `lower.ts` (statements/expressions/multi-block CFG) and `translate.ts`
(terminators `br`/`brcond`, `call`, remaining ops), driving RD-06 AC-02 and RD-07 AC-07..09 shut.
Optimizer seams (RD-06 passes) stay untouched.

### With RD-09 (ACME) — *unchanged, consumed*
The serializer already threads `allocationPlan.symbolDefinitions` and produces loadable PRGs;
RD-18 adds no ACME work, it feeds the pipeline real symbols.

### With RD-12 (Test harness) — *the acceptance engine*
Every slice's VICE gate and golden snapshot are RD-12 constructs (`setupEmulator`, run
strategies, register/memory assertions, `assertGolden`). CI runs the golden tier; VICE runs local.

### With RD-17 (Intrinsics/runtime) — *consumed*
Arithmetic slices reuse the shipped `__rt_mul8/div8/mul16/div16` marshalling; Slice 8 wires the
T1 CPU-control intrinsics end-to-end.

### With RD-08 (Peephole) & RD-06 Phase B — *deliberately after*
Both optimizers remain passthrough until RD-18 completes; then their Phase-B rule/pass catalogs
land against a stable, fully-lowered IL/Instr contract.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|--------------------|--------|-----------|--------|
| RD-18 shape | Thin rollout (reference) / full requirements restatement / no-RD-plans-only | **Thin rollout, reference-only** | Requirements already exist in RD-04/06/07 + frozen spec; restatement duplicates 250+ reqs and risks drift; a vertical slice has no single existing RD to own its plan, so a coordinating RD is needed | AR-110 |
| Optimizers | Include in RD-18 / exclude to Phase B | **Exclude (unoptimized only)** | "Correctness first, then optimizers"; seams are correctness-preserving passthroughs; deferral changes no semantics and RD-11 budget checks catch bloat loudly | AR-111 |
| Slice breakdown & keystone split | Single Slice 3 / split 3a-seam + 3b-engine | **Split 3a/3b + slices 4–8** | Slice 3's semantic work is the tent-pole (~20 reqs across Passes 1/3/4), not plumbing; proving the model→VICE seam (3a) first de-risks the type engine (3b) | AR-112 |
| Per-slice acceptance | Assemble-clean + local VICE / + CI golden | **Assemble-clean + CI golden + local VICE** | CI cannot run VICE (AR-27), so runtime correctness is proven once; the shipped RD-12 CI golden tier re-guards behavior on every CI run | AR-113 |
| Tracking & records | New plan of record / keep phantom RD-04b + ledger order | **RD-18 supersedes RD-04b + ledger horizontal order; reconciles roadmap** | Two competing plans of record for the same 100+ reqs is a defect; RD-18 is the sole vertical plan of record and drives parent-RD ACs shut | AR-114 |
| New diagnostic codes | Add to frozen `spec/14-diagnostics.md` (breaks D3) / add to `@blend65/core` `diagnostic-codes.ts` only | **Code registry only; `spec/` stays frozen** | Slice 4 needs codes absent from the canonical registry (non-boolean-condition, all-paths-return, `fallthrough`-in-`default`); D3 forbids editing `spec/`, so new codes land in `diagnostic-codes.ts`, with the Ch-14 canonical-registry drift recorded as an accepted deviation until a post-freeze spec reconciliation | AR-115 |

> **Traceability:** every decision references `00-ambiguity-register.md` (AR-110..114). Slice
> surfaces trace to `spec/` chapters + RD-04/06/07 requirement IDs + the ledger rows; no rule is
> restated here.

---

## Security Considerations

> Compiler / build-tool threat surface (no network service, no runtime data store).

- **Data sensitivity**: none — inputs are the user's own `.blend` source + `blend65.json`; outputs
  are local artifacts (`.asm`, `.prg`, label files). No PII/credentials/tokens.
- **Input validation**: all user source reaches these slices through the lexer/parser and the
  semantic passes, which **emit diagnostics, never throw** (AR-15/AR-73). New semantic checks
  (type/name resolution, const-eval) must validate and produce `E10xxx`/`W10xxx` diagnostics on
  malformed input, never crash — ICEs (`E9xxxx`) are for compiler bugs only (AR-68/AR-70).
- **Authentication & authorization**: N/A (local CLI/library).
- **Injection risks**: the only shell-adjacent surface is ACME invocation (RD-09, unchanged) and,
  in **Slice 8**, `embed()` file resolution — which **must canonicalize paths and reject `..`
  traversal past the package/project root** (Parked Q2; mirrors RD-17 `embed.ts` policy). No user
  source text is ever interpolated into a shell command or file path unsanitized.
- **Encryption**: N/A (no data at rest/in transit beyond local files).
- **Rate limiting**: N/A.
- **Infrastructure**: const evaluator + CFG passes must be **bounded** (no unbounded recursion on
  attacker-crafted source) — recursion detection (E10174, Slice 5), recursive-struct depth
  limit (Parked Q1, Slice 7), and const-eval iteration/step bounds (Slice 3b/7) are the guards.
- **Security testing**: each slice's negative-case tests include malformed/over-budget/adversarial
  source (deep nesting, cyclic structs, oversized array sizes, traversal paths) asserting a clean
  diagnostic, not a crash or wrong binary.

---

## Acceptance Criteria

Each criterion is met when its slice's three-part bar (assemble-clean + CI golden + local VICE)
passes and the parent-RD ACs it advances are ticked.

1. [ ] **Slice 3a**: the existing gate + one local `byte` program assembles through the **real**
       populated-model path (not the empty-model stub) to a loadable c64 PRG with zero undefined
       symbols; `modelToFunctionInfo` returns real `FunctionInfo[]`; the emitted symbol-definitions
       block contains the local's `__frame_*` address; VICE asserts the poked value. RD-04 AC(scope)
       + RD-05 adapter proven.
2. [ ] **Slice 3b**: a program using local + module-level scalars, same-width `+ - * / %`, `=`, and
       `peek`/`poke(w)` compiles and VICE-verifies a computed result (e.g. `(a*b + c) mod 256`
       poked to an observable address); mixed-signedness (E10081) programs are **rejected** with
       the exact code; a golden of the emitted ASM is committed. RD-04 Pass 1/3/4 (scalar scope)
       closed. *(The non-boolean-condition check moves to Slice 4, where control flow — and its
       new diagnostic code — lands.)*
3. [ ] **Slice 4**: `if`/`while`/`do-while`/`for`(to/downto/step)/`switch` programs VICE-verify
       (loop-sum + switch-select fixtures); a `fallthrough` in `default`, a non-boolean condition,
       and a non-returning path in a non-void function are each rejected with a diagnostic — these
       three are **new codes minted at this slice's gate** (Language-Guard-approved; added to
       `diagnostic-codes.ts` per AR-115), none existing in the canonical registry; `break`/`continue`
       outside a loop reject with the canonical E10130/E10131. Multi-block CFG + `br`/`brcond`
       emitted; ASM golden committed.
4. [ ] **Slice 5**: a multi-function, multi-module program with params + return values VICE-verifies;
       recursion (direct or indirect) is rejected with the unified E10174; module init order is
       deterministic (topological, E10194 on cycle). Calling convention + `call` op proven; ASM golden committed.
5. [ ] **Slice 6**: an expression-heavy program (`&&`/`\|\|` short-circuit, compound assign, unary,
       casts, ternary, mixed-width promotion, word shifts) VICE-verifies the exact arithmetic
       result; short-circuit is observable (RHS side effect suppressed); ASM golden committed.
6. [ ] **Slice 7**: array/struct/enum programs VICE-verify (indexed read/write, member access,
       enum-dispatch); `length`/`offsetof`/`sizeof` fold to correct constants; a `const byte[N]`
       with `N` a const-expression sizes correctly (const evaluator); ASM golden committed.
7. [ ] **Slice 8**: a raster-`interrupt` program installed via `pokew($0314, &onIRQ)` VICE-verifies
       an observable effect (border color flips across frames); `zeropage {}` variables land in ZP;
       `embed()` rejects `..` traversal; a non-terminating `main` runs under the frames strategy.
8. [ ] **Rollout closure**: RD-04 AC-02..20, RD-06 AC-02, RD-07 AC-07..09 are all ticked; the
       roadmap's RD-04/RD-06 rows carry the "slice-scoped; full scope driven by RD-18" annotation;
       the phantom RD-04b is retired; `git status --porcelain spec/` is empty throughout.
9. [ ] Security requirements verified per slice (diagnostic-not-crash on malformed input; bounded
       recursion/const-eval; `embed` traversal rejection) — see Security Considerations.
