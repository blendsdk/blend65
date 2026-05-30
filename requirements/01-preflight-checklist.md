# Preflight Protocol — Blend65 Compiler Discovery

> **Version**: 1.0
> **Status**: ✅ PASSED (first run 2026-05-30)
> **Purpose**: A repeatable gate that proves the requirements discovery has flushed out
> every ambiguity before RD authoring (and re-run before each future platform / major RD).

---

## Why this exists

The Zero-Ambiguity Gate claims "every decision in every RD traces to a resolved entry in
`00-ambiguity-register.md`." This protocol is the **evidence** for that claim. It is run,
its results recorded here, and only then is the gate marked PASSED.

It complements — does **not** replace — `spec/preflight-report.md`,
which audits the *spec* for contradictions. This protocol audits the *compiler
requirements* for unresolved implementation ambiguity.


---

## The Five Gates

| # | Gate | Question | How verified |
|---|------|----------|--------------|
| G1 | **Spec-hygiene** | Does the spec contain unresolved incompleteness markers? | Full-text grep over `spec/` for `TODO`, `FIXME`, `implementation-defined`, `open question`, `to be decided`, `unspecified`, `TBD` |
| G2 | **Spec-contradiction** | Are there self-contradictions / dangling refs in the spec? | `spec/preflight-report.md` (spec-level audit) is complete with all SEVERE/blocking items ✅ Fixed |
| G3 | **AR-coverage** | Does every "the compiler computes/decides X" in the spec map to a resolved or explicitly-delegated AR? | Read Ch 10/11/12/15; cross-check each algorithmic clause against the register |
| G4 | **RD-traceability** | Does every RD (RD-01..RD-17) have its inputs traceable to ARs? | Cross-check the README RD index "Depends On" + the per-AR "Feeds RD-NN" footers |
| G5 | **MVP-reachability** | Does the Phase-A gate slice depend on zero unresolved items? | Trace AR-43 (poke-a-constant) dependencies; confirm SFA/ZP not required until slice 2 |


A run **PASSES** only when all five gates pass.

---

## Run Log

### Run 1 — 2026-05-30 (pre-gate, AR-1..AR-93)

| Gate | Result | Evidence |
|------|--------|----------|
| G1 Spec-hygiene | ✅ PASS | Grep clean: **zero** `TODO`/`FIXME`/`implementation-defined`/`open question`/`to be decided`. The only `unspecified` hits are intentional, documented design (Ch 00 unspecified-value semantics; Ch 10 circular-import rejection) — not ambiguities. |
| G2 Spec-contradiction | ✅ PASS | `preflight-report.md` complete: type-alias double-status (SEVERE), FN-A3 self-contradiction, and error-code typo `E10177→E10176` all ✅ Fixed; reference integrity clean. |
| G3 AR-coverage | ✅ PASS *(after AR-87..AR-93)* | Sweep found 6 algorithmic clauses in Ch 11 / Ch 10 with no algorithm ("compiler computes X"). All now mapped to **delegation ARs**: AR-87 frame coloring, AR-88 interrupt frames, AR-89 FN-A9 escape, AR-90 ZP allocation, AR-91 module-init topo-sort, AR-92 frame-region peak. AR-93 records FUT-003 forward-insurance. **Soundness verified**: the v3 call graph is provably complete (FN-12; no indirect calls; recursion forbidden), checked against Ch 06 + F006/F007. |
| G4 RD-traceability | ✅ PASS | Every RD-01..RD-17 input traces to ARs via the register's "Feeds RD-NN" footers and the README "Depends On" column. The new ARs feed RD-04 (AR-91) and RD-05 (AR-87/88/89/90/92/93). |
| G5 MVP-reachability | ✅ PASS | AR-43 gate program (`poke(0xD020, 5)`) requires neither SFA frame planner nor ZP allocator; the newly-delegated coloring/ZP algorithms (AR-87/90) do not execute until slice 2 (local `byte`). The gate slice depends on zero unresolved items. |

**Verdict:** ✅ **ALL FIVE GATES PASS.** Discovery is closed; the Zero-Ambiguity Gate is
PASSED. RD authoring is unblocked (MVP-first per `requirements/README.md`).

---

## Re-run Triggers

Re-run this protocol (append a new Run row above) when:

- A **new target platform** is about to be specified (e.g. the deferred `vic20`, AR-86).
- A **deferred feature** (FUT-xxx) is promoted into the spec (especially **FUT-003**
  typed function pointers, which changes the AR-87 soundness premise — see AR-93).
- A **major RD** is authored that introduces new compiler decisions not yet in the
  register.
- The frozen spec baseline is bumped (a new `spec-vX.Y`).
