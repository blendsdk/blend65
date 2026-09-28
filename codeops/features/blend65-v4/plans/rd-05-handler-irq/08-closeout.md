# Handler-Side IRQ Phase Evidence

> **Scope**: RD-05 R5.16 bounded IRQ slice (DEF-8), not RD-05 closeout
> **Status**: Complete — bounded IRQ slice verified
> **Date**: 2026-09-29

## Result and route ownership

Balanced handler-side `setIRQ` / `setIRQExclusive` followed by `restoreIRQ` now compiles. The
source handler remains a callback; each selected entry has its own saved predecessor and the
ordinary helper body uses private homes for its active IRQ root. The selected-instruction stack
walk supplies only proved overlap pairs to SFA before allocation. Final binding retains those
identities, and shared-RAM closure binds the original symbolic code against its new certificate.
No runtime dispatcher, storage copy, global clone, new language restriction or optimizer barrier
was added. Invalid ownership and unbounded re-entry still fail before publication; NMI is not
claimed.

| Route | Owner and enabled peer | Entry, acknowledgement and exit |
|---|---|---|
| Mainline → A | Main owns a two-byte saved CINV predecessor; A is the selected chained entry. Mainline `CLI` enables the controlled opportunity. | A begins with `PHP; CLD`, preserving the interrupted status around binary-mode body work. Its final `PLP; JMP (mainline link)` chains to the exact predecessor. Source/firmware owns device acknowledgement. |
| Suspended A → B | A owns a distinct two-byte temporary predecessor. While A explicitly enables IRQ after installing B, B may run with A suspended; proved co-live private homes cannot alias. | B is the selected exclusive entry, `CLD; JMP $EA81`. The pinned KERNAL tail restores the complete interrupted P and registers. A restores its own temporary vector before its eventual chain. The VICE cases acknowledge their selected CIA/VIC source in source code, not hidden compiler logic. |
| Nested chain/ordinary helpers | A second live A predecessor and root-specific helper state remain distinct; sequential disjoint roots may reuse RAM. | Direct calls remain `JSR`/`RTS`; wrapper chains retain their own saved link. Runtime checkpoints observe B, resumed A and the original predecessor once each, with final CINV, A/X/Y/P/SP and source state restored. |

These routes use the existing four cooperative PAL/NTSC × 6581/8580 profiles. CINV at
`$0314–$0315` and the fixture's saved links at `$0B26–$0B29` are resident RAM under the selected
KERNAL/I/O mapping. The link low bytes `$26` and `$28` are valid NMOS indirect-jump starts; the
direct storage specification also checks `$xxFE` acceptance and `$xxFF` relocation/rejection.
Runtime qualification is **VICE-verified / hardware-unverified**.
Expert authority lineage: `skillVersion=2.0.0`, qualified content commit
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`,
`references/sfa-and-abi.md#interrupt-route-completion-gate` and
`references/c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts`, with primary
source keys `CBM-C64-KERNAL-03` and `MOS-PGM-1976`.

## Reproduced cost and expert comparison

The [selected output fixture](../../../../../test/rd05/handler-irq-output.spec.test.ts) supplies
the hand-derived chain, exclusive, install and restore expectations independently of execution.
For the `costSource` text in that file, rebuilt with optimization `none`, manifest name
`irq-closeout` and each selected profile, ACME produced the same 757-byte PRG (2-byte load
address plus 755 program bytes), SHA-256
`a7a46ed95912370897f46cfaff3ad765e2d70114a22c0d3b59893b22ba95cddc`.
`.memory.json` reports `acmeReconciled: true` in the four-profile specification tests.

| Cost component | Emitted bytes | NMOS path cycles | Independent equal-contract reference |
|---|---:|---:|---|
| Chained A wrapper, excluding body and predecessor | 6 | 14 | `PHP; CLD; PLP; JMP (link)` = 6/14 |
| Exclusive B wrapper, excluding ROM tail | 4 | 5 | `CLD; JMP $EA81` = 4/5 |
| Generic fully preserving handler-side install | 27 | 44 | `PHP; PHA; SEI`, two vector read/save pairs, two immediate entry-byte writes, `PLA; PLP` = 27/44 |
| Generic fully preserving restore | 17 | 32 | `PHP; PHA; SEI`, two saved-byte vector writes, `PLA; PLP` = 17/32 |
| A fixture source/control body outside wrapper/transactions | 7 | 14 | Seven one-byte `NOP`/`CLI`/`SEI` instructions |
| A complete emitted function | 57 | 104 excluding predecessor/ROM | Sum of its wrapper, two transactions and seven source/control instructions |
| B complete emitted function | 4 | 5 excluding ROM | Empty source body plus exclusive wrapper |
| Main emitted function | 50 | Asynchronous full path unknown | Its install/restore and source control are included in the program totals |
| Startup entry / restore / BASIC stub | 345 / 287 / 12 | Not an IRQ-wrapper parity charge | Existing cooperative delivery and restoration |

The generated `program.code` is 743 bytes (345 + 50 + 4 + 57 + 287); the BASIC stub adds 12,
giving 755 program bytes. The two saved links reserve 4 RAM bytes, and platform startup state
reserves 50; total resident RAM is 809 bytes. Zero-page use and separate scratch resource are
both 0. The qualified hardware-stack peak is 33 bytes (13 interrupt-entry save + 20 platform
reserve), with 223 bytes of 256 headroom. These are artifact facts, not summed estimates of
mutually exclusive chain routes. The emitted `.costs.json` correctly marks the complete
asynchronous `program.entry-to-return` cycle total **unknown**; local instruction-path costs above
are recomputed from the emitted assembly. Existing KERNAL code contributes no PRG bytes: the
16-byte PULS-to-CINV path and applicable 6-byte `$EA81` tail are ROM, with the latter taking
22 cycles after B's jump.

All four measured local deltas against the expert's same-contract sequences are 0 bytes and
0 cycles. This is the local floor, not a claim to beat expert whole-program output. Existing
[issue #85](https://github.com/blendsdk/blend65/issues/85) was refreshed with the current
measurements and the narrow post-binding cross-domain body-sharing path to a program-scale win.
The current root-specialized binder already shares physically identical bodies and keeps
different scratch homes separate; the direct machine tests check both cases. No unsafe shorter
sequence is accepted to improve a score.

## Verification and authority

The new source/output specifications pass 44/44, direct storage 7/7, and the two sequential
VICE files 8/8 and 9/9. Internal context/storage/machine hardening and the existing
shared-storage test pass. The approved ledger/profile corrections preserve the invalid
restore-only and NMI cases.

`yarn install --frozen-lockfile`, `yarn build` and `yarn typecheck` pass. The initial `yarn test`
run passed all 1,623 package tests and 906/907 root tests; the sole failure was an unchanged
runtime-switch VICE case exceeding its existing 5-second test timeout (it took about 10 seconds
on that loaded run). Under the plan's approved loaded-host fallback, `yarn turbo run test`
passed 1,623/1,623 and `yarn vitest run --testTimeout 30000` passed 907/907, including that
case at about 12 seconds. No permanent timeout or oracle edit was made for it. All touched
files pass Prettier and `git diff --check`; `spec/` and the frozen expert skill remain untouched.

After review corrections, the same install/build/typecheck commands pass. The package suite
passes 1,629/1,629 and the root suite passes 907/907 with the approved temporary timeout;
the two affected public source files pass 34/34, and three new helper-path regressions
were observed red before the final diagnostic fix and green after it. The single
permitted fix-diff re-review found one remaining major diagnostic case, corrected with the
user's approval and verified without a third review. RD-05 as a whole stays executing.

The final post-closeout run repeated the frozen install, build, typecheck and full suites:
1,629/1,629 package tests and 907/907 root tests pass. The Git-checkpoint run repeated
install, build, typecheck, package tests and a captured root rerun with 907/907 passing;
the first streamed root attempt exited without a retained failure detail. All touched and
new files pass Prettier, `git diff --check` is clean, and frozen authorities remain
untouched. Whole RD-05 work remains open.

## Bounded deferral-expiry check

**Did this slice's deliverables expire any deferral's stated rationale? Yes: DEF-8.** The
old handler-side IRQ restriction existed because an interrupted predecessor link could
alias a live handler's link and the compiler had no finite chain/re-entry proof. The
source, storage, emitted-entry and VICE cases now prove the balanced form; the
expressiveness-ledger row is retired. DEF-8 closes with this verified slice.

The RD-04 and RD-05 ambiguity registers, RD-05 Won't Have list, expressiveness ledger,
and `spec/future-considerations.md` reconsideration criteria were checked for this
bounded slice. DEF-7 and Stage A's NMI deferral **do not expire**: IRQ masking does not
bound NMI self-entry, and this work supplies no safe two-byte NMINV update proof. They
remain owned by RD-05 planning before NMI-dependent work or whole-RD readiness. The
stack-free-call trigger is not met by this fixture's 33-byte stack peak; this slice
adds no cross-statement optimizer or native-asset/other-target support. The remaining
RD-05 Won't Have owners stay unchanged, and no deferral points to this closing slice
as a future landing place. The full RD-05 R5.53 audit remains due at whole-RD closeout.

Independent review found no emitted-output or safety regression. One diagnostic
precision note remains report-only: a related location on an unbounded route can name
an earlier restored installation as well as the live one. The primary handler span and
E10245 rejection are correct; no extra stack-witness machinery was added for this
minor issue.
