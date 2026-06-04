# RD-05 SFA Frame Planner — Ambiguity Register

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Status**: ❌ GATE BLOCKED — 4 items resolved (D1–D4) / 3 open (D5–D7)
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
2026-06-04. Three further items (D5–D7) are sub-decisions of D2/D3 plus process, presented
below for resolution before plan documents are authored.

---

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| D1 | Scope / Strategy | RD-04 shipped a passthrough (empty `SemanticModel`), so RD-05's algorithms have no live input. Build the real SFA algorithms now, or mirror RD-04 with a passthrough skeleton? | A: **full algorithms, fixture-tested** — implement frame computation / interference graph / coloring / module-var layout / ZP allocation / stack analysis / budgets as pure functions over `(CallGraph, frames, profile)`, unit + golden tested against hand-built fixtures; defer only the live `analyze()`→`planAllocation()` wiring · B: passthrough skeleton (interfaces + empty `AllocationPlan`) | **A** — full fixture-tested algorithms | ✅ Resolved |
| D2 | Technical / Integration | RD-05 needs RAM/ZP/stack budgets, but the current `PlatformProfile` is a 2-field D4 stub and RD-10 (real profile system) is not built. | A: **interim budget shape** — RD-05 additively defines the budget fields it needs (RD-10 supersedes later) · B: pull a minimal RD-10 slice forward first | **A** — interim budget shape in RD-05, superseded by RD-10 | ✅ Resolved |
| D3 | Technical | Given the checker is deferred, how does the planner receive each function's **frame inputs** (ordered params + locals with types/`byRef`, and `isInterrupt`/`isEscaped`/`isReachable`)? | A: **additively extend the core `Symbol`** with optional function-frame fields · B: define an **RD-05-owned `FunctionInfo` input record** the planner consumes (populated by fixtures now, by the checker later) | **(pending — see D5/D6)** | ❌ Open |
| D4 | Process | Diagnostic codes E10032/E10033/W10030/W10033/W10180 used by the planner. | A: **confirm present in the registry and reuse** (one-registry rule); add none · B: add any missing per the Language Guard | **A** — confirm-and-reuse; surface any gap as a new runtime AR if a code is missing | ✅ Resolved |
| D5 | Technical | (Sub-decision of D3) Exact mechanism for the frame-input surface. | A: extend core `Symbol` (optional `params`/`locals`/`isInterrupt`/`isEscaped`/`isReachable`) · B: RD-05-owned `FunctionInfo` record in `@blend65/core`'s new `sfa/` module, decoupled from `Symbol` | — | ❌ Open |
| D6 | Naming | Frontend module directory for `planAllocation()` and the planner passes. | A: `packages/frontend/src/sfa/` · B: `packages/frontend/src/allocator/` · C: fold into existing `semantics/` | — | ❌ Open |
| D7 | Process | Commit mode for execution. | ask / no-commit / auto-commit | — | ❌ Open |

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

---

## Surface-during-authoring rule

If authoring or implementation surfaces a *new* ambiguity, **STOP**, add it here as the next
`D-N` (tagged `(runtime)` if found during execution), resolve it with the user, back-propagate
the resolution into the affected plan documents, then resume. Do not fill gaps by guessing.
