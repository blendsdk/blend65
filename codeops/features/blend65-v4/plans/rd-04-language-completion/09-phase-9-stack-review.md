# Phase 9 stack-correction review

Status: focused corrections, the one re-review and repository verification pass.
This was an intermediate checkpoint; final Phase 9 completion is in the [closeout](08-closeout.md).

Baseline: `4ccb28d01c36d8afc2634ddb72ee83022afad655`. Scope is the Phase 6
RV-010 stack precision correction already assigned to RD-04 qualification.
The user confirmed XHigh for this correction and the remaining phase.

Independent semantic review found two necessary corrections:

| Finding | Severity | Evidence | Ruling |
|---|---|---|---|
| SEM-P9-001 | Major | `irq-stack.ts` followed a chained predecessor even when the current handler has no returning exit. A masked-install fixture incorrectly reports 237 bytes instead of 27. | Fix within the approved correction: follow a predecessor only on a returning handler path. Independent `stack-nonreturn.spec.test.ts` captured RED. |
| SEM-P9-002 | Major | Architectural I and instruction-boundary IRQ recognition were conflated. Adjacent CLI/PLP incorrectly rejects a 236-byte route as 237. | Fix within the existing stack proof and lowering-fact seam: preserve the old-I recognition boundary and distinguish emitted work from compile-time-only operations. Independent adjacent-instruction cases must precede implementation. |

These are compiler-owned correctness decisions under AGENTS workflow directive 4,
not changes to product scope or approved deferrals. Neither changes generated
instructions, adds a runtime, nor permits unbounded IRQ storage. No finding is waived.
The one re-review reports **no remaining findings** in this narrow fix batch. It
independently reproduced 27 bytes for the non-returning chain and 236 bytes for
both adjacent CLI/PLP and bare CLI/RTS. It also checked the generated conditional
installation jump boundary and variant call contexts. General Phase 9 closeout
review remains pending; no third semantic review is dispatched.

Authority: frozen Specification 4 §11.5.1–5.3; expert 2.0.0 content
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`, SFA/ABI and selected C64 runtime references.
The NMOS recognition boundary is corroborated by the primary
[VICE 6510 core](https://github.com/VICE-Team/svn-mirror/blob/main/vice/src/6510core.c)
(`CLI`, `SEI`, `PLP`, and `OPCODE_ENABLES_IRQ`/`OPCODE_DISABLES_IRQ`). This source inspection
is not a claim of emulator or physical-hardware execution of the new cases.

Independent initial evidence: 14 stack-overlap cases (eight RED, six controls GREEN),
then 24 passing overlap/context cases. Non-returning chain, adjacent CLI/PLP and bare
CLI/RTS cases independently captured RED before their corrections. All 35 focused
stack and call-evidence cases now pass (`/tmp/phase9-mask-green.log`). This includes
complementary real-instruction, scalar-return, overflow and unbounded-reentry controls.
The lowering change records instruction presence only; it does not alter instructions.
The initializer author corrected an unintended third source call in its new fixture;
the original two-call byte expectations were retained. No existing tracked specification
test or frozen authority file was changed.

Separately, the Phase 6 RV-009 source-context obligation has an independent RED case:
the first helper machine variant records its leaf call, while the second lacks that
same source-call record. The narrow correction emits the existing call-context record
for every existing caller entry variant; it does not change the schema or machine code.
Both the variant case and 64-parameter acceptance case now pass.

Repository install, build and typecheck pass. The first full test run exceeded
the unchanged five-second limit in existing service tests under host load above
20. The previously approved command-local 30-second default allowance will be
used again; project configuration, assertions and explicit VICE limits stay intact.

Final verification passes all **2,031 tests**: 1,380 compiler, 62 CLI, 14 language
server, six editor and 569 root. The root corpus used its unchanged limits with
sequential VICE processes; the complete M1 trace and all three padded-image cases
pass. Runtime status is **VICE-verified / hardware-unverified**. The new exact CPU
boundary cases additionally rely on primary CPU semantics, not a claim of dedicated
hardware execution. Formatting, whitespace, documentation and frozen-authority
checks pass. No existing tracked specification test changed.

Logs: `/tmp/phase9-install.log`, `/tmp/phase9-build-final.log`,
`/tmp/phase9-typecheck.log`, `/tmp/phase9-workspaces-load-allowance.log`,
`/tmp/phase9-root.log`, `/tmp/phase9-prettier-check.log`.
RV-010's ledger entry is retired; its old RV-007 attribution is corrected. RV-009's
variant call-context omission is also closed. General Phase 9 tasks were still open at this
checkpoint; their subsequent completion is recorded in the closeout.
