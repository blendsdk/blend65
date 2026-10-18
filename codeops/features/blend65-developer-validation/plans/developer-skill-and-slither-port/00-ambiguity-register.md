# Plan Discovery: Developer Skill and Slither Port

> **Status**: ❌ GATE BLOCKED — discovery incomplete; no executable plan
> **Created**: 2026-10-15
> **Last Updated**: 2026-10-18 11:43 CEST
> **Planning target**: blend65-developer-validation/RD-01
> **CodeOps Artifact Schema**: 1

## Authority and Scope

The user requested preflight and continuation in the dedicated worktree. No
implementation plan existed. The primary explained the requirements-first
sequence; the four requirement inputs now have a clean formal preflight bound
to their exact blobs in
[the report](../../requirements/00-preflight-report.md), committed as `b8f21d56`.
This is the incrementally persisted planning register, not a created or
preflighted implementation plan. It must not advance the roadmap to Plan Created.

Planning implements the existing one-skill/one-Slither scope; no new product
decision, compiler API, engine or support subsystem is proposed. The requirement
documents and compiler are context, not authorized modification targets.
New plan documents are confined to this plan directory. The per-feature roadmap
will change only at a supported lifecycle transition.

## Discovery Register

| ID | Category | Decision or missing fact | Authority / next evidence | Status |
| --- | --- | --- | --- | --- |
| AR-P1 | Scope and actors | One companion skill and one complete eligibility-gated Slither port; existing compiler owners retain defects; no replacement, publication or added machinery. | Imported unchanged from requirements AR-001–AR-012 and the user's continuation request. | ✅ Resolved |
| AR-P2 | Semantics and evidence | Frozen authority, ordinary source, independent behavior/cost expectations, exact pins, owned outputs and sequential host-wide VICE windows remain mandatory. | Imported unchanged from RD-01 R1.3–R1.20; clean requirements preflight is not implementation proof. | ✅ Resolved |
| AR-P3 | Technical and integration facts | Exact original machine/profile, player rights/ABI, reachable interrupt routes, cadence and compatible public compiler facilities must be established before the detailed implementation contract can be fixed. | [PAL/8580 follow-up](../../research/slither-pal8580-followup.md) now records declaration-compatible bounded control flow and one actual tick. Rights, full ABI/interrupt/cadence/cost proof and public player support remain open; no behavior change or new adapter is approved. | ❌ Open |
| AR-P4 | Concurrency | All prior windows are released. Standing user authority permits reserving a new window without another question; check actual availability, announce it, run sequentially and await owned teardown. | User: “From now on Reserve a new VICE session if you need it. You don't have to ask me again.” Latest PAL/8580 window 2026-10-18 09:43:05–09:43:24 UTC, final exact-name check empty. Never overlap or stop a foreign process. | ✅ Resolved |
| AR-P5 | Planning scope and priority | Create and preflight the bounded skill-first plan, preserving every full-port obligation and blocker under the same RD. | User explicitly selected “Skill-first (Recommended)” after the two viable phasings and requalification risk were presented. Independent challenger converged; [player handoff](../../research/slither-player-dependency-handoff.md) retains the open dependency facts. | ✅ Resolved |

## AR-P5 Recommendation Evidence

The independent challenger reviewed the two viable phasings in a fresh Astra
context without the primary's preferred choice. It recommends a bounded
skill-first plan because RD-01 permits preparation during compiler work and
requires its own independent unseen-work proof. The strongest counterargument
is that easier exercises could produce a shallow skill and leave the actual
game indefinitely blocked. The proposed boundary therefore preserves every
capability's honest status, complete-port ownership and all existing acceptance
gates; the RD cannot close on skill success alone. No new machinery is proposed.

This user-owned phasing decision is now explicitly resolved; it was not inferred
from “proceed further”. The bounded plan's own gate is recorded in
[the skill-first register](../game-developer-skill/00-ambiguity-register.md).
This combined-port discovery register stays open for AR-P3. If no meaningful
independently provable skill subset exists, skill-first authoring cannot proceed
merely to show progress.

## Gate Boundary

On 2026-10-18 the user requests further continuation after the skill slice's
local checkpoint `74e08d02`. This authorises prerequisite assessment, not a new
adapter, external contact/publication or bypass of AR-P3. The skill-first plan
is now 20/20; it neither completes this combined plan's gate nor closes RD-01.
The modification set for this continuation is this discovery register, the
feature-local follow-up/handoff records and a derived DEF-5 roadmap clarification.
Requirements, compiler, prior evidence and other owners remain unchanged.

While discovery is incomplete, no index, component specification, test strategy,
execution checklist, skill or port implementation is created. The remaining
twelve-category scan and concrete independent test expectations follow the
missing facts; they are not declared complete by these initial rows. Missing
facts do not reopen the passed RD unless investigation reveals a real upstream
contract defect. Any user-owned behavior, scope or rights fork is surfaced
before choosing it.
