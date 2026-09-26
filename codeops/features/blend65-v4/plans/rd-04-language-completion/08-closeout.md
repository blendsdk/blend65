# RD-04 Linux closeout

> **Status**: Full qualification passed; PE-001 correction and verification pending
> **Date**: 2026-09-26
> **Scope**: Specification 4 core language, direct `none` compiler, qualified first C64 profile
> **Authority**: expert `2.0.0`, content `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`
> **Specification SHA-256**: `ee2be7c2139ff82f22d1d8f169251bae1d2244e5e4a74bddbdfc4903af39fff8`

## Completion boundary

The [execution plan](99-execution-plan.md) owns task completion. This record does not claim
the remaining platform APIs, native asset formats, loading, optional optimization or production
editor features. They retain RD-05–RD-09 ownership. Native Windows evidence remains with RD-10;
no host access was requested and no Windows result is inferred from Linux or CI configuration.
Runtime claims are **VICE-verified / hardware-unverified** for VICE 3.10, PAL C64 NMOS 6510,
the cooperative KERNAL/6581 profile and ACME 0.97.

## Coverage and independent evidence

| Boundary | Evidence |
|---|---|
| Frozen normative inventory | `test/rd04/normative-coverage.json`: 397 exact named keys; 379 implemented and 18 explicitly later-owned. Twelve source-key/completion checks pass. Mixed conformance sections identify both current proof and later ownership. |
| Values, expressions and control | Scalar/type/flow specification cases, `scalars-runtime.spec.test.ts`, scalar arithmetic and switch diagnostic cases. Constant versus runtime width, effects and checked stops are distinct oracles. |
| Aggregates, calls and storage | Aggregate/runtime/borrow/provenance cases; finite call/recursion cases; caller-owned aggregate returns and exact storage closure. No source destination-parameter workaround or runtime was added. |
| Interrupt precision and debug contexts | 35 independent stack/call-context cases and [semantic review](09-phase-9-stack-review.md). Only simultaneous live routes contribute to stack demand; every emitted caller variant has call evidence. |
| Complete diagnostics | Phase 8 canonical-record suites and exact active diagnostic crosswalk. E10280/E10281 are the user-approved AR-P27 diagnostic-only freeze exception; Phase 9 changes no specification bytes. |
| Oracle sensitivity | `oracle-integrity.spec.test.ts`: 26 corruptions, two valid controls and one real VICE run use the same assertions. Wrong values, order/count, aliases, decimal/check state and IRQ return cannot silently pass. |
| Publication and services | `backend.spec.test.ts`, frontend-boundary and direct import-boundary suites; exact artifacts, failed publication, deterministic output, canonical CLI/LSP diagnostics and honest unavailable capabilities. |
| Expiry gate | `expressiveness-ledger.spec.test.ts`: seven public builds plus status/owner mutation controls; all nine checks pass. A supported deferred restriction or a broken retired correction fails the gate. |

The new ledger author's first draft assumed exactly one error per probe. Two restricted operations
legitimately produced two records. The author corrected that unsupported cardinality assumption
to the supplied diagnostic-set contract: a nonempty set containing only the recorded identity.
Probe sources and all status/owner assertions stayed unchanged. No existing specification test
was edited during Phase 9.

## Expert comparison reconciliation

Costs below use the existing reference's exact local boundary. They do not hide caller setup,
startup, data residency or interrupt costs inside a whole-program claim. `none` still chooses one
direct sequence; no optional search, optimizer pass, candidate registry or runtime was added.
The six-file reference reconciliation passes all 24 cases; 38 focused machine checks also pass.

| Family / reference | Current qualified result | Follow-up |
|---|---|---|
| Scalars — `expert/scalars.json` | Multiply-by-three core 6 bytes / 10 cycles / 1 ZP byte; multiply-by-seven 8 / 14 / 1; divide-by-two 1 / 2 / 0; times-255 5 / 6 / 0. General byte multiply has one 20-byte helper and 2 ZP bytes. Shift, quotient/remainder sharing and sequential helper-sharing checks pass. | [#89](https://github.com/blendsdk/blend65/issues/89): constant/range specialization, dead work and complete-program accounting. |
| Array reads — `expert/aggregates.json` | Constant resident byte read 3 bytes / 4 cycles; runtime byte ordinal core 6 / 8–9, no pointer scratch; staged checked word-read core within 18 / 28. | #89: immutable element folding and proved index-register reuse. Bounds/setup costs remain outside these core-only comparisons on both sides. |
| Byte load → fixed store | Three independent assembled cases now cost 6 bytes / 8 cycles / zero temporary RAM, versus 12 / 16 / 1 before the correction. VICE preserves reads/writes, calls, clobbers, repeated uses, dynamic destinations and word controls. | [#87](https://github.com/blendsdk/blend65/issues/87)'s measured staging defect is corrected. Register selection remains local and single-use; no intervening emitted operation is crossed. |
| Aggregate ABI — `expert/aggregate-abi.json` | Public assembled copy/clone/fill bodies: 102/82/31 bytes including RTS versus 104/84/31 reference limits. No full-size snapshot. Nested 300-byte copy remains 103 bytes; 8 KiB copy remains bounded. | [#81](https://github.com/blendsdk/blend65/issues/81): whole-program alias specialization. Its old snapshot measurements are historical; [#82](https://github.com/blendsdk/blend65/issues/82)'s local byte gap is already fixed. |
| Function values — `expert/calls.json` | Page-safe indirect dispatch 6 bytes / 11 cycles, zero dispatch scratch, 2 hardware-stack bytes. These are dispatch-only costs, not complete caller costs. | [#83](https://github.com/blendsdk/blend65/issues/83) and [#84](https://github.com/blendsdk/blend65/issues/84) retain the previously approved home-coalescing and shared-thunk work; no complete-routine parity claim hides them. |
| IRQ — `expert/interrupts.json` | Chained/exclusive entry 11/20 and 9/11 bytes/cycles; install 27/44; restore 17/32. Firmware-owned saves/tails are separately accounted. | [#85](https://github.com/blendsdk/blend65/issues/85): share proved storage-free bodies without merging overlapping homes. |
| BCD — `expert/intrinsics.json` | Byte increment 11/16/0, two-read byte add/sub 18/26/1, word increment/decrement 20/28/0, two-read word add/sub 34/48/1 (bytes/cycles/scratch). All seven complete routines meet. | [#86](https://github.com/blendsdk/blend65/issues/86)'s old defects are fixed. #89 records constant folding and decimal-region sharing only with complete flag/interrupt proof. |
| Private 5,000-byte fill | 72 bytes / 26,964 nominal cycles; no extra ZP or stack; one existing 5,000-byte object. Observable global/borrowed write order is unchanged. | [#88](https://github.com/blendsdk/blend65/issues/88): future proved dead-initialization removal. Its original 25,000-byte defect and weaker 74-byte reference are historical. |

Only issue #89 was created during this reconciliation, under the standing parity-debt authority.
Existing issues were read, not edited or closed. No Git push was made. The improvement remains
compatible with later structured peepholes, value/effect proof and SFA re-closure.

## Portability and simplicity inspection

The audit found C64 vector-byte literals in shared raw-memory diagnostics and interrupt ownership.
The correction uses the existing frontend profile owner for the diagnostic query and the already
selected routes' vector facts for ownership invalidation. Two independent structural checks were
RED before the correction and now pass with five scanner controls. Existing exact diagnostics,
IRQ behavior and import boundaries still pass. Extra implementation controls cover both vector
bytes, overlapping word writes, unrelated addresses and frontend/backend profile agreement.

Inspection of `services/services.ts`, semantic operations, the storage closure and machine path
confirms one connected pipeline. Concrete CPU/register/layout/serializer duties remain outside
the shared operations. The four existing packages and dependency graph are unchanged. No new
package, future-target field, game system, generic runtime, software stack, pass framework or
qualification service was introduced. Frozen identity and publication/closure tests provide the
executable checks; this is not a claim that a keyword scan proves the whole architecture.

## Non-gating host observations

Measured with Node 22.23.1, Linux x64, eight logical CPUs, while retaining the user's other jobs.
The one-minute host load was approximately 10–14. Each row has three sequential samples, the first
cold. Builds include ACME; the ACME-only column reassembles the same emitted source separately.
LSP observations use real stdio `didChange` → published diagnostics, excluding server startup.
Peak RSS is the observed process peak, not a per-stage allocation estimate. No threshold, cache,
worker or daemon was added in response.

| Workload | Check, ms | Build including ACME, ms | ACME alone, ms | LSP edit response, ms | Compiler / LSP peak RSS, KiB |
|---|---|---|---|---|---|
| Existing M1 with raw assets | 819 / 477 / 485 | 2,194 / 2,039 / 2,581 | 9 / 29 / 10 | 123 / 84 / 100 | 189,856 / 90,080 |
| Combined language sample: aggregate return, enum/switch, function value, comptime, placed raw data, word division, arrays/loops and BCD | 316 / 132 / 100 | 926 / 630 / 630 | 7 / 6 / 5 | 42 / 26 / 38 | 141,780 / 73,632 |

These representative measurements supplement the complete qualification corpus; they are not an
exhaustive benchmark or a Windows measurement. Captured at `adf8a808`, before the byte-forwarding
and profile-ownership corrections. Logs: `/tmp/phase9-host-observations.log` and
`/tmp/phase9-host-complete.log`; disposable measurement source is under
`/tmp/blend65-host-observations.VVhh1e/`, not repository infrastructure.

## Mandatory deferral-expiry answer

**Did this RD's deliverables expire any deferral's stated rationale? Yes.** The stack-route
overestimate no longer has a technical rationale: the owned correction is implemented, independently
re-reviewed and its ledger row is retired. No active ledger item points back at this closing RD.

| Item scanned | Disposition and owner |
|---|---|
| AR-P16 cooperative NMI | Still requires finite reentry and safe two-byte vector-update proof. Remains explicitly unavailable, owned by RD-05 R5.15–R5.17. |
| AR-P17 handler-side IRQ updates | Still requires separately live predecessor links and finite chain contexts. Remains explicitly unavailable, owned by RD-05 R5.16. |
| AR-P19 source-visible profile facts | Frozen spec still has no source binding. RD-05 R5.3/AC-03 owns that surface and paired profiles; no API was invented here. |
| AR-P22 future-target payload | No new bank/transfer/DMA consumer appeared. Concrete facts remain with RD-05, RD-07 and the separate C64U feature. |
| Windows deferrals | User-directed late native qualification remains RD-10 work, including RD-02/RD-03 closeout. Linux completion does not fabricate a host pass. |
| SpritePad producer/native-format evidence | Completing the compiler makes the later asset work eligible; the existing RD-06 row and authentic producer-fixture requirements already own it. No SpritePad access is needed for RD-04 or RD-05. |
| RD-04 Won't Have | Platform APIs, native assets, loading, optional optimization and production editor features retain RD-05–RD-09 owners. Their absent implementations were not supplied by this RD. |
| FUT-006/007 | No demonstrated frequent labelled exits or range-case need; neither syntax change is implied by compiler completion. |
| FUT-011/012 | No new extern-assembly ABI evidence or need beyond ordinary aggregate assignment/return; no copy intrinsic or assembly escape was added. |
| FUT-015/016 | No qualified modern-image conversion demand or real workload proving a stack-free calling convention necessary. Artificial stack-pressure probes are not such a workload. |
| FUT-017/018 | Optional cross-statement optimization and real barrier/volatile-variant demand remain absent. RD-08 owns any renewed evidence. |
| Resolved future considerations and rejected items | Existing Specification 4 resolutions stay resolved. Typed function values alone do not establish new type-alias ergonomic demand; no new inline-assembly justification appeared. Frozen `spec/future-considerations.md` remains unchanged. |
| Expert records | Worse #87 staging is fixed here. Measured meet-only opportunities have explicit RD-08 issues; old issue descriptions do not redefine the current reference. |

## Final verification and review

Final install, build and typecheck pass, followed by all **2,093 tests**: 1,393 compiler,
62 CLI, 14 language-server, six editor and 618 root tests. The complete root/VICE run is
sequential, including the M1 journey and all three padded images. Formatting, frozen-authority,
46 local documentation links and whitespace checks pass. The approved command-local
30-second workspace test scheduler allowance is used under host contention; root VICE/process
deadlines and every assertion remain unchanged. Logs: `/tmp/phase9-final-{install,build,typecheck,workspaces,root}.log`
and `/tmp/phase9-final-format.log`.

Independent correctness review reports **no findings**: scope, existing-oracle integrity,
coverage, actual verification and deferral ownership are consistent. The performance review
found one necessary correction; no other performance finding was reported.

| Finding | Severity | Evidence | Ruling |
|---|---|---|---|
| PE-001 | Major | `storage/irq-stack.ts:151` keys summaries by the full source-installation stack. A linear call graph with two balanced, equivalent IRQ-install arms per level requires 4,094 / 16,382 / 65,534 uncached summaries at 10 / 12 / 14 levels. The 14-level source is 2,235 bytes, emits 30 machine functions and needs only 37 stack bytes. | Necessary compiler-owned correction under workflow directive 4: canonicalize only the abstract installation token by its selected handler/entry-variant set. Preserve stack order/multiplicity, masks, exact upstream ownership and all generated code. No new cache layer, runtime or framework. Independent behavior controls precede the change; a deterministic implementation counter must prove the growth correction. |

Observed stack-analysis times were 579 / 2,765 / 13,761 ms under current load, not acceptance
thresholds. The exponential summary counts establish the defect independently of host timing.
This ruling changes neither scope nor an approved deferral and waives no finding. The correction
and its final verification remain pending; RD-04 is not closed.
