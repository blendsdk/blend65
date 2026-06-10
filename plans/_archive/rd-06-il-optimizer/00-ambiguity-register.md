# RD-06 IL & IL Optimizer — Ambiguity Register

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Status**: ✅ GATE PASSED — D1–D7 (planning) + D8/D9 (runtime) resolved
> **Last Updated**: 2026-06-05


> **Purpose**: Plan-level Zero-Ambiguity Gate. Every RD-06 plan decision that is *not*
> already fixed by the frozen `spec/` (Ch 02–06, 08–09, 11–13, 14) or by the (authored,
> non-frozen) `requirements/RD-06-il-optimizer.md` is recorded here, with its resolution,
> before any document or code depends on it.

## Scope of this register

RD-06 is highly prescriptive: its 70 requirements (R1–R70), 19 acceptance criteria
(AC-01–AC-19), the §3.4 instruction set, the §3.5 lowering rules, the §4 type/operand/CFG
data shapes, and the §4.12 public API are all fixed by the requirements document and the
frozen spec. Every IL design decision is additionally pre-resolved upstream by the master
requirements register **AR-45..AR-52** (IL shape = flat TAC, explicit typing, virtual
temps, basic-block CFG, intrinsic lowering split, two lowering levels, textual form,
operand model) plus **AR-29/AR-49** (intrinsics) and **AR-91** (module-init order, owned by
RD-04). Those decisions trace to the RD/spec/AR and need **no** plan-level AR entry.

What this register captures is the small set of decisions left genuinely open because
RD-06's **primary input — RD-04's `SemanticModel` — shipped as an empty passthrough
skeleton** (RD-04 plan D1/D2; see `plans/rd-04-semantic-analysis/08-deferred-semantics-ledger.md`),
and because RD-06's **next consumer — RD-07 6502 codegen — does not yet exist**. The IL
lowering sits *between* two stages that are both empty, which is the exact situation the
AR-38 walking-skeleton methodology governs. The RD-06 preflight (run 2026-06-05 against the
Five-Gate protocol in `requirements/01-preflight-checklist.md`) confirmed all five gates
pass; these items are the build-strategy forks that preflight surfaced.

All seven items were presented to the user and resolved on 2026-06-05 before any plan
document was authored. The gate is **PASSED**.

---

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| D1 | Scope / Strategy | RD-04 shipped a passthrough (empty `SemanticModel`) and RD-07 codegen does not exist, so RD-06's lowering has neither live typed input nor a downstream consumer. How much of the IL model + AST→IL lowering to build now? | A: **walking-skeleton slice scope (AR-38)** — build the full IL data model (types/operands/instructions/CFG/`ILProgram`), the deterministic textual printer, and the passthrough optimizer pipeline now; implement lowering ONLY for the gate + slice-2 surface behind an extensible typed lowering-visitor seam, widening per future slice · B: full fixture-tested lowering for all 51 AST node kinds now · C: pure passthrough skeleton (`lowerToIL` returns empty `ILProgram`) | **A** — walking-skeleton slice scope | ✅ Resolved |
| D2 | Scope / Diagnostics | W10130 (unreachable code) is coupled to DCE on the IL CFG (R59/R70), but DCE is a deferred optimizer pass and the optimizer is passthrough in v1. W10130 also appears as a deferred RD-04 Pass-4 check (ledger R110). Build CFG-reachability + emit W10130 now, or defer? | A: **defer entirely** — build the CFG (R12–R16) but perform no reachability analysis and emit no W10130 in v1; the warning arrives with the real DCE pass (coordinated with RD-04b Pass-4 ownership) · B: build CFG-reachability detection + emit W10130 in v1 with no block removal | **A** — defer W10130 from v1 | ✅ Resolved |
| D3 | Naming | Module layout inside `@blend65/codegen` for the IL model, lowering, printer, and optimizer. | A: **`il/` for model + lowering + printer, `il/optimizer/` for the pass pipeline** · B: flat `il.ts` / `optimizer.ts` · C: separate top-level `lowering/` and `optimizer/` | **A** — `il/` + `il/optimizer/` (mirrors RD-05 `sfa/` naming-by-domain) | ✅ Resolved |
| D4 | API shape | RD-06 §4.12 illustrates `lowerToIL(model, plan, bag)`. The lowering also needs the AST (`ProgramNode[]`), and the established codebase convention is an object-input. | A: **explicit `LowerInput` object** — `lowerToIL(input: LowerInput, bag)` with `{ program, model, plan }` (mirrors `parse(ParseInput)`/`analyze(AnalyzeInput)`/`planAllocation(PlanInput)`) · B: literal positional `(model, plan, bag)` | **A** — `LowerInput` object | ✅ Resolved |
| D5 | Scope / Integration | Given the empty `SemanticModel`, what exactly is deferred (the RD-06 analog of RD-05's `modelToFunctionInfo` seam)? | A: **lowering built + fixture-tested now** against hand-built AST+`SemanticModel`+`AllocationPlan` fixtures (gate/slice-2 surface); the ONLY deferred thing is the live compiler-façade wiring (`analyze()`→`planAllocation()`→`lowerToIL()`), which lights up unchanged when RD-04b populates the model; unsupported node kinds hit the visitor default → ICE, never silent · B: defer all lowering behind the empty model | **A** — fixture-tested lowering; defer only live wiring | ✅ Resolved |
| D6 | Process | Diagnostic codes for RD-06. v1 emits no user diagnostics (R69: lowering emits only `E9xxxx` ICEs for unhandled AST shapes). | A: **confirm-and-reuse** — use the existing `IceCode.Unexpected` (`E90001`) for the visitor default; add no user codes; W10130 already registered but deferred (D2). If a more specific ICE is wanted, surface a runtime AR per the one-registry rule · B: add a new ICE code now | **A** — reuse `IceCode.Unexpected`; no new codes | ✅ Resolved |
| D7 | Process | Commit mode for execution. | ask / no-commit / auto-commit | **no-commit** (consistent with RD-01/02/03/04/05/11a) | ✅ Resolved |
| D8 (runtime) | Textual form | `printIL` function-header param rendering. `ILFunction.params` are `AllocationPlan`-backed `Location` operands whose `symbol` is the frame-qualified slot name (`__frame_Math_add_a`), but the §4.7/03-02 golden showed short source names (`a`). How does the header render params? | A: **render param operands verbatim** (header shows `__frame_Math_add_a: i8u`, identical to the body's loads) — single DRY location-rendering path, maximally deterministic, truthful to the SFA model; update the §4.7 plan golden to match · B: fixtures give params bare-name symbols distinct from the frame slots · C: printer strips the `__frame_<fn>_` prefix (magic) | **A** — render verbatim; correct the plan goldens (user delegated: "best recommendation") | ✅ Resolved |
| D9 (runtime) | Lowering / Textual form | The gate/slice-2 goldens render the `poke`/`peek` address as hex `$D020`, but the already-shipped, spec-tested `printIL` renders **immediate** operands as **decimal** (`String(value)`), so an immediate `0xD020` would print `53280` — goldens and the frozen printer disagree on how the poke/peek address renders. | A: **lower the poke/peek address to a symbolic `location` operand** — `poke(0xD020,5)` → `store imm(5,IL_BYTE), loc("$D020",IL_WORD)`; locations render verbatim, so `$D020` prints as the golden shows while the data value stays a decimal immediate. No printer change; truthful to AR-52 (addresses stay symbolic until the ACME emitter); fixtures supply the address symbol string `"$D020"` · B: keep address as immediate + teach printer hex (breaks green ST-P decimal/determinism contract) · C: rewrite ST-L1/L2 goldens to decimal `store 5, 53280` | **A** — address → symbolic `location` (no printer change) | ✅ Resolved |


---

## Resolution Notes

### D1 — Walking-skeleton slice scope (not full lowering, not pure passthrough)

The decisive distinction: **the optimizer operates on IL, not on AST.** When the team
returns to build the two optimizers (IL-general here in RD-06, peephole in RD-08), what
they need is a **complete, stable IL data model + deterministic textual form + a
pass-pipeline seam** — they do *not* need all 51 AST→IL lowerings to exist. Lowering
breadth is almost irrelevant to the optimizer; IL-representation completeness is everything.

Defining the complete IL instruction set, operand union, typed-temp model, CFG, and printer
now is cheap, mechanical, and **low-churn** — exactly what AR-38 says to transcribe fully up
front (like the grammar/token set). Conversely, the *lowering rules* are coupled to two
things that do not yet exist: (a) how RD-04b will represent types/promotions in the
`SemanticModel` (R4 `zext`/`sext`/`trunc` insertion depends on the not-yet-final promotion
representation), and (b) RD-07 codegen, which consumes the IL and is itself built per slice.
Building all 51 lowerings now (Option B) risks real rework when RD-04b/RD-07 pin those down,
and the optimizer gains nothing from it — this is the v2 "100% before a consumer exists"
trap AR-38 exists to prevent. RD-05 could safely pick "full" because its passes are
self-contained pure functions; RD-06's lowering is **not** self-contained — it bridges two
empty stages. Pure passthrough (Option C) is too thin: it would defer the one thing the
optimizer *does* need built stably now.

**Resolution:** build the full IL data model + textual printer + passthrough optimizer
pipeline now (the stable substrate the optimizer and RD-07 both depend on), and implement
lowering only for the gate + slice-2 surface behind an extensible typed lowering-visitor
seam. When we return for the real optimizer the substrate is already complete and stable;
when we widen the language per slice we add one lowering + its codegen together
(consumer-driven), with no rework.

### D2 — Defer W10130 from RD-06 v1

When we return for the real DCE pass, W10130 emission is *intrinsically part of that pass*:
R59 ("DCE removes unreachable basic blocks") and R70 ("when DCE detects unreachable blocks
it contributes to W10130") describe the same CFG-reachability walk. Building a separate v1
detector would mean writing that reachability analysis **twice**, or leaving it
half-connected to a passthrough optimizer — the opposite of AR-38's intent. There is also a
genuine **ownership question** (W10130 appears in both RD-04 Pass-4 / ledger R110 and RD-06
DCE / R70) that belongs to whichever checker/optimizer plan tackles it, with the user;
emitting it from a passthrough RD-06 now would silently pre-empt that decision. Finally, no
MVP slice produces unreachable code (the gate and slice-2 have none), so building
reachability now is speculative, and a passthrough optimizer that emits zero diagnostics has
a trivially stable golden surface.

**Resolution:** the IL CFG **is** fully built in v1 (basic blocks + terminators, R12–R16) —
it is part of the stable IL model the optimizer needs — but it is **not analyzed** for
reachability. The DCE pass adds the reachability walk + W10130 emission together later,
coordinated with RD-04b Pass-4 ownership. `DiagCode.UnreachableCode` ("W10130") already
exists in the registry; RD-06 v1 simply never emits it.

### D3 — `il/` + `il/optimizer/` in `@blend65/codegen`

Unlike RD-05 (which split data into `@blend65/core/sfa/` so the language-server could see
it), RD-06 has **no core/codegen split**: IL is strictly back-end and the language-server
must never import `@blend65/codegen` (R15/AR-20). So both the IL model and the lowering live
in `@blend65/codegen`. The `il/` directory holds the model (types/operands/instructions/CFG/
`ILProgram`), the AST→IL lowering, and the textual printer; `il/optimizer/` holds the pass
pipeline (`ILPass` interface + `optimizeIL`, passthrough in v1). This mirrors RD-05's
domain-named `sfa/` directory.

### D4 — `lowerToIL(input: LowerInput, bag)`

RD-06 §4.12 illustrates `lowerToIL(model, plan, bag)`, but the lowering also walks the AST
(`ProgramNode[]`), and the codebase already standardizes on an object-input for stage entry
points (`parse(ParseInput)`, `analyze(AnalyzeInput)`, `planAllocation(PlanInput)`). The
planner therefore takes `LowerInput = { program: ProgramNode[]; model: SemanticModel; plan:
AllocationPlan }`. This is a signature refinement only (same posture as RD-05 D9); AC-01 is
annotated to note the entry point takes `LowerInput`.

### D5 — Fixture-tested lowering; defer only the live façade wiring

The lowering for the gate/slice-2 surface is **real and golden-tested** against hand-built
AST + `SemanticModel` + `AllocationPlan` fixtures — it does not require the deferred RD-04b
checker to run, only well-formed input data, which fixtures supply. The **single deferred
seam** is the live compiler-façade wiring that threads `analyze()`'s real model and
`planAllocation()`'s real plan into `lowerToIL()`; under the current passthrough that model
is empty, so an end-to-end call lowers to an empty `ILProgram`, but every lowering rule is
exercised directly via fixtures. When RD-04b lands, only the façade wiring changes; no
lowering rule is touched. Unsupported AST node kinds reach the visitor's default arm and
raise an ICE (R69) — never a silent gap.

### D6 — Confirm-and-reuse diagnostic codes (ICE only)

RD-06 v1 emits **no** user-facing diagnostics (R68/R69: all user errors are caught upstream;
lowering may emit only `E9xxxx` ICEs for AST shapes it cannot handle). The existing
`IceCode.Unexpected` (`E90001`) and `DiagnosticBag.addICE` already cover the visitor default,
so **no new code is needed**. If a future slice wants a more specific ICE, that is a new
runtime AR added per the Language Guard + one-registry rule. W10130 is already registered
(used by the deferred DCE per D2).

### D7 — Commit mode: `--no-commit`

The agent implements, verifies, and updates the execution plan, but performs **no** git
operations. The user handles all commits. Identical to RD-01/02/03/04/05/11a.

### D8 — Render function-header params verbatim from their Location symbols

`ILFunction.params` carry the `AllocationPlan`-backed `Location` operands (frame-slot
symbols like `__frame_Math_add_a`), not the short source names. The printer has exactly one
location-rendering path, used identically by the header and the body's `load`s, so the
header reads `__frame_Math_add_a: i8u`. This is maximally deterministic and truthful to the
SFA model; the §4.7 plan golden (03-02) was corrected to match.

### D9 — Lower the `poke`/`peek` address to a symbolic `location` operand

The frozen, spec-tested `printIL` renders **immediate** operands in **decimal**
(`String(value)`) — a contract pinned green by ST-P. The gate/slice-2 plan goldens, however,
show the `poke`/`peek` target as hex `$D020`. Reconciling them by teaching the printer to
emit hex (Option B) would break the green decimal/determinism contract and the slice-2
`const i8u 5` form; rewriting the goldens to decimal (Option C) discards the plan's intended
hex and is less truthful to how addresses actually travel through the IL.

**Resolution:** the memory intrinsics lower their **address argument to a symbolic
`location` operand** — `poke(0xD020, 5)` → `store imm(5, IL_BYTE), loc("$D020", IL_WORD)`;
`peek(0xD020)` → `load %t, loc("$D020", IL_WORD)`. Locations render verbatim, so `$D020`
prints exactly as the golden shows, while the data value stays a decimal immediate. This
needs **no** printer change and is truthful to **AR-52** (addresses stay symbolic all the
way through the IL and are resolved to concrete numbers only by the ACME emitter, RD-09).
The fixtures supply the address operand's `symbol` string as `"$D020"`. When RD-04b/RD-07
land, the live façade will derive that symbol from the const-folded address argument; the
fixture hand-supplies it today (D5).

---


## Surface-during-authoring rule

If authoring or implementation surfaces a *new* ambiguity, **STOP**, add it here as the next
`D-N` (tagged `(runtime)` if found during execution), resolve it with the user, back-propagate
the resolution into the affected plan documents, then resume. Do not fill gaps by guessing.
