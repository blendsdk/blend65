# Execution plan: Canonical fixed-object ABI

> **CodeOps Artifact Schema**: 1
> **Implements**: blend65-v4/RD-05
> **Progress**: 9/9 tasks (100%)
> **Last Updated**: 2026-11-06
> **Reasoning**: high — calling convention, interference and final physical closure
> **Scope**: strict; AR-P6/9 approved; preflight passed; Phase1 oracle frozen; Phase2 implementation

## Phase 1 — Independent contract tests

**Reasoning:** high — separate behavior and output obligations.

- [x] 1.1 Independently author new ST-1–ST-8 cases from `07-testing-strategy.md` and public interfaces; never read implementation or edit old oracles. Authored41 tests in two new files; run is **16 fail /25 pass**: eight ST-1/2 runtime-pointer/indirect RED and eight ST-7 ordinary/acquisition resource RED; fallback, raw/lifetime, nested and native ABI controls green. Independent oracle review is clear with no findings; startup-owned CIA2/VIC contracts are delegated to the existing suite. RED frozen2026-11-06.
- [x] 1.2 Establish meaningful representation/resource RED and baseline behavior controls; complete independent oracle review before implementation. Assertion-level RED confirmed; compiler suite3,510/two skips and pinned3/3 remain green; oracle review clear at the two new spec files. No old oracle edited.
- [x] 1.3 Verify the directed existing/new inventory and preserve the exact oracle set for the implementation owner. New41-case ABI set plus the unchanged returned-local20-case oracle (12 pass/8 intended RED), four profiles, native ST-8 and fallback controls are recorded; the spec files are frozen pending Phase2.

## Phase 2 — Existing-owner integration

**Reasoning:** high — one tightly coupled ABI/storage owner.

- [~] 2.1 Derive/authenticate the restricted complete recipe set in existing fact/selection owners (`03-01` §§1–2, IT-1/2/5). Completed: `selectClosedObjectStorage` restricted to returned-local results and same-object parameter roots; object/fact project marker validated against construction bundles; sealed scope distinguishes canonical-object from Closed. Directed spec41/41 and old returned-local20/20 pass; independent correctness/SFA fix reviews clear.
- [x] 2.2 Carry object-only facts through call/place/result lowering and actual projection/closure without optimizer activation; first qualify authentic metadata-only generic/restricted lowering and invariance through the existing caller/transform guards (`03-01` §§2–3, IT-3/5/7). Completed: metadata-only lowering, result projection, direct fixed-result/nested construction and restricted borrower support; metadata-only disables general temporary pruning and permits only construction-scoped replacements. Optimized pinned identities3/3 remain exact; independent correctness/SFA fix reviews clear.
- [x] 2.3 After IT-7 passes, qualify the canonical attempt against its real generic reference at existing service/final owners, including AR-P9 residual byte-loop/MMIO unchanged-control correspondence; retain fallback and exact failure categories (`03-01` §4, IT-4/6/8). Completed: annotated generic reference comparison, generic fallback, and bounded unchanged-control byte-loop admission gated to object-only with no synthetic counter bounds; directed spec41/41 and old oracle20/20 pass; independent correctness/SFA/machine fix reviews clear; full root green.

## Phase 3 — Hardening and qualification

**Reasoning:** high — independent final proof and complete artifact obligations.

- [x] 3.1 Complete IT-1–IT-8 regressions and independent correctness, semantics, SFA/ABI, platform, emitted-code and host-cost reviews. Semantics reports preservation and modern-source DX separately. Resolve findings through authority gates. Independent correctness RV-001–004, SFA/ABI SF-001–003 and machine MC-001 fix reviews clear; focused seal-scope, byte-loop carry and initialization-window corruption tests pass. Remaining IT hardening is folded into final verification.
- [x] 3.2 Run four-profile unchanged output/resource/native gates, startup/borrow/provenance guards and exact saved/acquisition/none identities; record bounded costs/hardware limits. Directed and green: new spec41/41 including four-profile native, unchanged returned-local20/20, exact saved/acquisition/none identities3/3; full root 274 files / 6,248 tests.
- [x] 3.3 Run complete verification, synchronize DEF-17/root progress without advancing siblings and make the green local checkpoint through the git-commit skill; never push automatically. Completed: install/build/typecheck and complete `yarn test` pass **274 files / 6,248 tests / zero failures**; approved AR-P12 resolved the stale RD-04 held-byte cases and moved only the IRQ188 NMI case to195/188. Local green checkpoint committed; never pushed.

## Verify and continuation

Use directed `yarn vitest run <files>` during work. Before checkpoint run
`yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, complete owned
tests and complete `yarn test`. Capture logs in session temp; VICE is sequential.
Check touched formatting and frozen authority/old tests. This checklist owns
only DEF-17; the root-remediation checklist still owns root green and return to
RD-05. RD-06 remains untouched.
