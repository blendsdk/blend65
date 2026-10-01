# Independent phase review: VIC-II collision reads

> **Date**: 2026-10-01
> **Phase baseline tree**: 84485b973025215df270819ba0b0ee1f14b871a4
> **Status**: Complete — no unresolved implementation findings; full checkpoint green
> **Scope**: Strict — two consuming hardware reads and existing result retention

## Review coverage

| Reviewer | Lenses | Result |
|---|---|---|
| Independent correctness reviewer | Correctness, maintainability, standards, API surface, volatile ordering | No implementation findings; one blanket-policy flag below |
| Independent semantics reviewer | Unsigned masks, register/flag effects, consuming order, retention, hardware/runtime oracle | No findings |
| Independent performance auditor | Expert instruction costs, hidden resources, forwarding guards, compiler complexity | No findings |

The snapshot includes staged, unstaged and new files. The extra selector path is attributed
to this phase's necessary existing-seam correction in the execution plan, not unrelated work.
No new language or instruction representation, runtime service, harness or dependency was added.
Security-auditor profiles are not applicable: there is no new host input, authentication,
transport or public host schema. Existing source/name/profile validation remains exercised.

## Finding and explicit ruling

**RV-001 — reviewer classification: CRITICAL / standards.** The reviewer role mechanically
flags every existing specification-test edit, including the two exact inventory additions
in `frontend/profile.spec.test.ts` and `frontend/profile-constants.spec.test.ts`.
The reviewer independently confirmed that those changes match AR-P3 exactly: two new rows
per file and the approved operation-count title; no other existing expectation changed.
It identified a blanket-policy conflict, not weakened behavior or an implementation defect.

**Resolution: the prior explicit user ruling is controlling.** AR-P3 already approves these
exact edits, and the project's non-negotiable workflow directive overrides default CodeOps
guardrails. The exception preserves every old row, fixture, assertion and case. Restoring
obsolete closed inventories would contradict the approved additive API. This is not an
automatic risk waiver or a newly accepted edit: the user decided the exact test-authority
exception before execution, and its narrow boundary was independently verified. RV-001 is
resolved by that recorded ruling. No code fix or fix-only re-review is required.

AR-P5 separately records the user's explicit approval to remove only the misplaced
`binding.type` comparison from the new API oracle. Its remaining call signature, unsigned-byte,
zero-argument, arity, effect and diagnostic obligations were independently reviewed intact.
The phase baseline predates that entire new file, so it cannot independently prove its
before/after edit history. Provenance is bounded to the author's original 117-line file,
the implementation-blind author's correction recommendation, the user's approval, and the
captured five-line removal; the current file is 112 lines. No saved pre-correction blob hash
is claimed. Both existing inventory exceptions remain fully visible in the Git diff.

## Verification boundary

Directed results: 61 new specification cases (including 16 sequential VICE cases),
55 inventory cases and 42 implementation/regression cases pass. The first full checkpoint
hit an unchanged service test's five-second timeout. The unchanged complete retry passes
install, build, typecheck and all 2,980 tests: compiler 1,620, CLI 62, language server 14,
editor extension 6 and root 1,278. No test timeout or expectation was changed for the retry.
Full checkpoint log: `/tmp/blend65-vic-full-retry.KIcX5W.log`.
Touched-file formatting, local links, diff checks and frozen-authority checks pass.

Local cost meets the expert floor: each read is 3 bytes/4 nominal cycles; an explicit absolute
destination store adds 3 bytes/4 cycles. No added execution homes, ZP, scratch or stack delta.
The selector remains O(n) in semantic operations, with O(1) additional work per operation.
Whole-program timing remains Unknown. Runtime is VICE-verified / hardware-unverified.

Expert 2.0.1, content `1ce4852016e2a883cf1f733c6014c45e176bfc69`;
`c64-hardware.md#vic-ii-sprites` / `#volatile-and-rmw-policy`,
`6502-lowering-casebook.md#loads-stores-and-moves`,
`il-and-optimization.md#memory-effects-and-volatility`;
sources `BLEND65-SPEC-4-1c2a2d75`, `CSG-6567-318014`, `CBM-C64-PRG-1982`, `MOS-PGM-1976`.
