# RD-05 SFA Frame Planner — Ambiguity Register

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Status**: ✅ GATE PASSED — all 9 items resolved (D1–D9)
> **Last Updated**: 2026-06-04

> **Purpose**: Plan-level Zero-Ambiguity Gate. Every RD-05 plan decision that is *not*
> already fixed by the frozen `spec/` (Ch 11, Ch 06) or by the (authored, non-frozen)
> `requirements/RD-05-sfa-frame-planner.md` is recorded here, with its resolution, before
> any document or code depends on it.

## Scope of this register

RD-05 is highly prescriptive: its 62 requirements (R1–R62), 21 acceptance criteria
(AC-01–AC-21), the §4 algorithms (interference graph, greedy chordal coloring, ZP priority
allocation, stack-depth analysis), and the §4.10 `AllocationPlan` interface are all fixed by
the requirements document and the frozen spec. Those decisions trace to the RD/spec and need
**no** AR entry.

What this register captures is the small set of decisions left genuinely open because RD-05's
**primary input — RD-04's `SemanticModel` — shipped as an empty passthrough skeleton**
(RD-04 plan D1/D2). The real call graph, function symbols, and const-sized arrays are not yet
populated by `analyze()`. The RD-05 preflight (run 2026-06-04 against the Five-Gate protocol)
surfaced these as input-availability forks.

The first four items (D1–D4) were presented to the user during preflight and resolved on
2026-06-04. Three further items (D5–D7) — the frame-input mechanism, the module name, and the
commit mode — were resolved with the user the same day before any plan document was authored.
Two further items (**D8–D9**) were surfaced by a **second preflight pass** (2026-06-04) that
audited the authored plan documents against the RD and found two design choices made silently
during authoring — the ZP arg-block reservation and the `planAllocation` signature shape. Both
were resolved with the user before execution. All nine are now closed; the gate is **PASSED**.

---

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| D1 | Scope / Strategy | RD-04 shipped a passthrough (empty `SemanticModel`), so RD-05's algorithms have no live input. Build the real SFA algorithms now, or mirror RD-04 with a passthrough skeleton? | A: **full algorithms, fixture-tested** — implement frame computation / interference graph / coloring / module-var layout / ZP allocation / stack analysis / budgets as pure functions over `(CallGraph, frames, profile)`, unit + golden tested against hand-built fixtures; defer only the live `analyze()`→`planAllocation()` wiring · B: passthrough skeleton (interfaces + empty `AllocationPlan`) | **A** — full fixture-tested algorithms | ✅ Resolved |
| D2 | Technical / Integration | RD-05 needs RAM/ZP/stack budgets, but the current `PlatformProfile` is a 2-field D4 stub and RD-10 (real profile system) is not built. | A: **interim budget shape** — RD-05 additively defines the budget fields it needs (RD-10 supersedes later) · B: pull a minimal RD-10 slice forward first | **A** — interim budget shape in RD-05, superseded by RD-10 | ✅ Resolved |
| D3 | Technical | Given the checker is deferred, how does the planner receive each function's **frame inputs** (ordered params + locals with types/`byRef`, and `isInterrupt`/`isEscaped`/`isReachable`)? | A: **additively extend the core `Symbol`** with optional function-frame fields · B: define an **RD-05-owned `FunctionInfo` input record** the planner consumes (populated by fixtures now, by the checker later) | **B** — RD-05-owned `FunctionInfo` record + adapter (see D5) | ✅ Resolved |
| D4 | Process | Diagnostic codes E10032/E10033/W10030/W10033/W10180 used by the planner. | A: **confirm present in the registry and reuse** (one-registry rule); add none · B: add any missing per the Language Guard | **A** — confirm-and-reuse; surface any gap as a new runtime AR if a code is missing | ✅ Resolved |
| D5 | Technical | (Sub-decision of D3) Exact mechanism for the frame-input surface. | A: extend core `Symbol` (optional `params`/`locals`/`isInterrupt`/`isEscaped`/`isReachable`) · B: RD-05-owned `FunctionInfo` record in `@blend65/core`'s new `sfa/` module, decoupled from `Symbol`; a thin `modelToFunctionInfo(SemanticModel)` adapter is the single deferred wiring seam | **B** — `FunctionInfo` record + adapter | ✅ Resolved |
| D6 | Naming | Frontend module directory for `planAllocation()` and the planner passes. | A: `packages/frontend/src/sfa/` · B: `packages/frontend/src/allocator/` · C: fold into existing `semantics/` | **A** — `sfa/` in both core and frontend (symmetric with `semantics/`) | ✅ Resolved |
| D7 | Process | Commit mode for execution. | ask / no-commit / auto-commit | **no-commit** (consistent with RD-01/02/03/04/11a) | ✅ Resolved |
| D8 | Technical / Spec-fidelity | Authoring introduced a **5th ZP category `arg-block`**, reserved **first** (before user vars) with interim default `zpArgBlockMin = 4`. But RD-05's priority order (R29/§4.7/§4.13) lists only **4** categories; the arg-block appears in the RD only as **Open Question #3**, which defers its exact floor to **RD-17**. So both *whether* to reserve it now and *where* it sits were authoring-time choices, not RD-fixed. | A: keep reserve-first with interim default **4** (pre-empts RD-17; shifts every ZP address by 4) · B: **defer** — keep the field + `"arg-block"` category plumbed but set interim default **0** so it contributes 0 bytes until RD-17 raises the floor additively | **B** — defer; `zpArgBlockMin` default **0**, category plumbed, RD-17 owns the floor | ✅ Resolved |
| D9 | API shape | RD-05 §4.12 specifies `planAllocation(model, profile, bag)`. Authoring substituted `planAllocation(input: PlanInput, profile, bag)` to match the deferred-wiring seam (the live `model` is not consumed yet). | A: **keep the `PlanInput` object** (mirrors RD-03/RD-04 `analyze(AnalyzeInput)`; clean seam) · B: revert to the literal `model` parameter | **A** — keep `PlanInput`; record an AC-01 note that the entry point takes `PlanInput` | ✅ Resolved |

---

## Resolution Notes

### D1 — Full algorithms, fixture-tested (not a passthrough)

The SFA passes are **pure functions** of the call graph, the per-function frame sizes, and the
platform budgets. None of them require the deferred type checker to be runnable — they require
only well-formed input data, which hand-built fixtures supply. Building them now yields real,
golden-tested value (frame coloring, ZP sharing, stack analysis, budget diagnostics) and gives
RD-06/RD-07/RD-09 a concrete `AllocationPlan` to consume. The single deferred seam is the live
`analyze()` → `planAllocation()` wiring, which lights up unchanged when the RD-04b checker
populates the `SemanticModel`. Contrast with RD-04, where the checker itself (not just its
wiring) was the deferred mass — there a passthrough was the honest choice; here it would
needlessly throw away implementable, testable logic.

### D2 — Interim platform-budget shape, superseded by RD-10

RD-05 §4.5/§4.6/§4.9 reference `ramStart`/`ramEnd`, `zpStart`/`zpEnd`, a stack budget, and a ZP
arg-block minimum. The D4 `PlatformProfile` stub (`{ name, charEncoding }`) lacks these. RD-05
additively defines the budget fields it needs so the planner can compile and be tested today; a
C64-shaped test fixture profile supplies concrete values. RD-10 later supersedes/extends this
with the canonical profile (F2 platform-profile-ready, additive — no breaking change).

### D4 — Confirm-and-reuse diagnostic codes

The five SFA codes are listed in RD-05 §4.13 and Ch 14. Per the one-registry rule, the planner
**reuses** the already-registered codes in `packages/core/src/diagnostics/diagnostic-codes.ts`
(the RD-03/RD-11a E10xxx/W10xxx surface). Authoring will verify each is present; if any is
missing, that is a new runtime ambiguity (STOP, add the code per the Language Guard + one
registry, log a runtime AR).

### D3 / D5 — `FunctionInfo` input record + adapter seam

The planner consumes an explicit, RD-05-owned input record rather than reaching into the
semantic `Symbol`. A new `@blend65/core/src/sfa/` module defines `FunctionInfo` — a flat,
SFA-specific view of one function: its fully-qualified name, ordered `parameters` and `locals`
(each with name, `Type`, and `byRef`), and the `isInterrupt` / `isEscaped` / `isReachable`
flags the coloring and stack passes need. This matches the "explicit record between pipeline
stages" pattern already used by RD-03 (AST) → RD-04 (`SemanticModel`) → RD-05 (`AllocationPlan`).

A single thin adapter — `modelToFunctionInfo(model: SemanticModel): FunctionInfo[]` — is the
**one** place the "RD-04 checker not yet wired" deferral lives. Under the passthrough the
adapter returns `[]` (the empty model has no functions); when RD-04b populates the model, the
adapter is filled in **without touching any SFA pass**. All algorithm tests build `FunctionInfo`
fixtures directly, with zero dependence on the (empty) `Symbol`/`Scope`/`typeMap` machinery.
Rejected: extending `Symbol` (A) — would add five optional fields that are `undefined` in
nearly every path until RD-04b, widening a core semantic type for a downstream concern; and
deriving live from `SemanticModel` (C, considered) — would couple every pass to the model's
traversal API and scatter the deferral across many call sites.

### D6 — `sfa/` module in both core and frontend

The frontend planner lives in `packages/frontend/src/sfa/` (`planAllocation()` + the nine
passes); the shared records live in `packages/core/src/sfa/` (`FunctionInfo`, `AllocationPlan`
and its sub-records, the interim `PlatformProfile` budget fields). This mirrors the existing
core-`semantics/` / frontend-`semantics/` pairing and names the domain (Static Frame Allocation)
exactly as the spec (Ch 11) and RD-05 title do. `allocator/` under-describes the stage (it also
does frame computation, coloring, stack analysis, and budget checking); folding into
`semantics/` would blur a distinct pipeline stage into the semantic module.

### D7 — Commit mode: `--no-commit`

The agent implements, verifies, and updates the execution plan, but performs **no** git
operations. The user handles all commits. Identical to RD-01/02/03/04/11a.

### D8 — ZP arg-block deferred to RD-17 (interim default 0)

RD-05's ZP priority order (R29, §4.7, §4.13) is explicit and contains **four** categories: user
`zeropage` vars → struct/array pointers → main temps → IRQ temps. The runtime-ABI ZP arg-block
appears in the RD **only** as Open Question #3, which states the exact minimum floor is *deferred
to RD-17* and that the planner "will read it from the platform profile." Authoring had introduced
a fifth `arg-block` category reserved *first* with an interim default of 4 bytes — a behavior the
RD does not yet fix, and one that would shift every ZP address by 4 and bake an ABI floor RD-17
owns.

Resolution: **defer.** The interim `PlatformProfile` keeps the `zpArgBlockMin` field and the ZP
allocator keeps the `"arg-block"` category plumbed (so RD-17 lights it up with **no** code
change), but the interim default is **0** — the arg-block contributes zero bytes until RD-17 sets
a real floor. This keeps RD-05 faithful to its own four-category priority order, keeps every
golden snapshot aligned with the RD, and preserves the additive seam for RD-17. The C64 fixture
profile therefore uses `zpArgBlockMin: 0`. When RD-17 lands, raising the floor is an additive
profile change that the already-present reservation loop honours automatically.

### D9 — `planAllocation(PlanInput, profile, bag)` signature

RD-05 §4.12 illustrates `planAllocation(model, profile, bag)`. Because the live `SemanticModel`
is not consumed yet (D1/D3/D5: the deferred wiring seam is `modelToFunctionInfo`), the planner
instead takes an explicit `PlanInput` object carrying the `FunctionInfo[]`, module-var inputs,
and interference data the passes actually use. This **keeps** the object-input form, mirroring the
established RD-03/RD-04 `parse(ParseInput)` / `analyze(AnalyzeInput)` convention already in the
codebase, and gives the deferred seam a clean single call site
(`planAllocation({ functions: modelToFunctionInfo(model), … }, …)`). AC-01 is annotated to note
the entry point takes `PlanInput` (functionally equivalent to the RD's `model` illustration —
no semantic change, a signature refinement only).

---

## Surface-during-authoring rule

If authoring or implementation surfaces a *new* ambiguity, **STOP**, add it here as the next
`D-N` (tagged `(runtime)` if found during execution), resolve it with the user, back-propagate
the resolution into the affected plan documents, then resume. Do not fill gaps by guessing.
