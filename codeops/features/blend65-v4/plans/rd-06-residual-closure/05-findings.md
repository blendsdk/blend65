# Findings: RD-06 Residual Closure

> **Document**: 05-findings.md
> **Parent**: [Execution Plan](99-execution-plan.md)
> **Review basis**: whole-task diff `2e7b02bd..HEAD`, five independent roles plus a preflight audit.

## Dispositions

| Finding | Role | Severity | Area | Disposition |
| ------- | ---- | -------- | ---- | ----------- |
| RV-001 / MC-002 / TP-001 / SM-002 | correctness / machine / platform / semantics | MAJOR | T-27 active-screen scope | fixed — scan only reachable functions and reachable module initializer blocks; dead code ignored; runtime initializer and dead-code tests added. |
| RV-002 / MC-001 / SM-001 | correctness / machine / semantics | CRITICAL | T-22 static word read / symbol offset | fixed — T-22 is now a store-only path; static reads stay on the existing indirect path. The duplicate high-byte read and offset loss are removed. |
| RV-003 / MC-003 | correctness / machine | MAJOR | T-20 held-counter observer | fixed — the raw observer derives the index prefix from the lowered index and skips value loads; a bounded-counter constant-value test covers the sequence. |
| RV-004 / SA-002 | correctness / SFA | MINOR | T-22 zero-page label cost | fixed — `static-address` carries `zeroPage`; unit test asserts 4 bytes/5 cycles. |
| SA-001 | SFA/ABI | CRITICAL | T-20 deferred index lifetime | fixed — ordinal writes only admit a constant or load-backed stable index; computed temporaries and A-held write indices fall back to the indirect path. |
| MC-004 / SM-006 | machine / semantics | MAJOR/MINOR | T-23 C/V liveness | fixed — C and V are tracked independently and `fallthrough` is followed. |
| MC-005 | machine | MAJOR | T-20 A-held index | fixed — a register-A write index falls back to ordinary address computation. |
| MC-006 | machine | MINOR | T-22 returned-local base | fixed — returned-local places are excluded from the static store path. |
| TP-003 | platform | MINOR | T-21 NMI wrapper compaction | fixed — NMI publication wrappers keep their identity form. |
| TP-002 / SM-004 | platform / semantics | MAJOR | E10273 message/category | fixed — constant/field messages use the `Cannot place …; change …` shape and lowering E10273 is categorized as a source failure. Contributors remain explicit help text. |
| SM-005 | semantics | MAJOR | VIC projection consumers | fixed — VIC projections use a dedicated `cpu16-vic` address space, so CPU/resident consumers and legacy tests do not double-count; RD-08 saved/acquisition evidence consumers now reconcile views against the full ledger and resources against CPU intervals only. |
| SM-007 | semantics | MINOR | ledger/test addresses | fixed — multi-screen probes use valid `$0C00`/`$2400` screens and assert the active-screen message. |
| SM-008 | semantics | MINOR | ledger ownership | fixed — owner changed to `T-27 follow-up / issue #140`. |
| SM-010 / MC-007 | semantics / machine | MINOR | T-22 evidence | fixed — `test/rd04/raw-static-address.spec.test.ts` added; zero-page and aggregate-store costs covered; plan no longer claims read-only asset stores. |
| SM-011 | semantics | MINOR | T-26 relocated reservation | fixed — the clipping test now uses a relocated `$0C00` screen and asserts `vic.screen.c00`. |
| TP-006 | platform | MINOR | multi-screen VIC evidence | fixed — every `vicScreenRole` block is overlaid as an explicit VIC screen reservation. |
| TP-004 / MC-008 | platform / machine | MINOR | claimed RED coverage | partially fixed — runtime-initializer, dead-code, subtract/shift, static-store and counter cases added. Startup identity, long-branch fixed point and held-X constant-value VICE remain supporting evidence gaps, not behavior claims. |
| RV-007 | correctness | MINOR | existing `BLEND65_DEBUG_RAWASSOC` stderr | accepted — pre-existing diagnostic instrumentation outside this task's modification set; no behavior change. |
| SM-003 / TP-004 const form | semantics / platform | MAJOR | frozen compile-time const VIC field | accepted debt — the frozen F015 compile-time `const` form still fails E10191 in the frontend. T-27 supports the runtime initializer and direct use; the language restriction is recorded, not hidden. |
| SM-009 | semantics | MINOR | T-20 none-mode evidence | accepted debt — the unoptimized bounds pass has no fixed-loop facts; optimized ordinal writes are verified and Q-P15 stays at 383. |
| SM-013 | semantics | MINOR | stale RD-06 evidence | fixed at closeout — RD-06 findings/closeout and roadmap rows updated with the final state. |

## Deferral-Expiry Check

- T-20 none-mode ordinal writes: re-owned to the future loop-bound/optimization owner; the reason
  (no fixed-loop facts in `none`) is recorded in the plan and closeout.
- Multi-screen `setSpritePointer`: tracked by the expressiveness ledger and issue #140; the
  per-call screen relation is a future platform/layout capability.
- Frozen compile-time `const` VIC field: existing frontend E10191 debt, not created or widened by
  this task; recorded as an expressiveness limitation rather than silently claimed.

No deferral names this task as its only future landing place.
