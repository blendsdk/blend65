# RD-05 Stage A — Cooperative Profile Handoff

> **Status**: Stage A complete; full RD-05 remains open
> **Date**: 2026-09-27
> **Scope**: [Stage acceptance](01-requirements.md#stage-acceptance)
> **Task authority**: [Execution plan](99-execution-plan.md)

## Delivered

The four cooperative KERNAL PRG profiles now agree across source constants, frontend checking,
target selection, generated artifacts and emulator launch. The selected identity belongs to the
fresh built generation; changing the manifest during the VICE probe cannot relabel that generation.
Interactive runs still report `interactive-unverified`.

The existing qualification helper accepts the four exact profile IDs and preserves its PAL/6581
default. Pinned ROM arguments follow model selection. One five-name integer-resource reader was
added to the existing monitor. No new runner, registry, public schema, dependency or compiler pass
was added.

Denied emulator termination now returns recovery-required within the existing cleanup bound.
It retains the generation pin and releases only the parent's process/pipe handles so the CLI can
exit. A surviving emulator remains a manual recovery obligation; it is never reported stopped.

## Verification

| Check | Result |
|---|---|
| Frozen-lockfile install, build, typecheck | Pass |
| Complete owned tests | **2,434 pass**: 1,516 compiler, 62 CLI, 14 language-server, 6 editor, 836 root |
| Phase 3 additions | 30 independent specification cases and 17 implementation cases |
| Runtime | Four fresh ACME PRGs and the unchanged 441-input M1 rendered journey pass sequentially |
| Independent review | RV-001 corrected; one focused re-review: resolved, no new findings |
| Frozen authority | No `spec/`, expert-skill or existing specification-test edit |

Final commands: `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`,
`yarn test --testTimeout 30000`, plus targeted Prettier and document checks.
The temporary Vitest option changes only the root tests' default host waiting time. It changes no
assertion, explicit test deadline, monitor deadline, emulated-cycle cap or output-cost limit.
An old five-second timeout and a later interrupted run are not counted as qualification; the
complete final retry passed. Detailed failures, owned-process cleanup, oracle hashes and review
dispositions are in the execution plan. No timeout or test-configuration file was edited.

Session logs: `/tmp/blend65-rd05-phase3-OIYPb2/`, especially `final-install.log`, `final-build.log`,
`final-typecheck.log`, `final-test-retry.log`, `review-regression-red.log` and `review-fix-green.log`.
The final root retry freshly ran all 89 files; unchanged workspace results were reused from the
successful post-correction workspace run. These temporary logs supplement, not replace, the
durable evidence below and the reproducible checked-in tests.

## Observed Machines and Artifacts

All four runs observed `CIA1Model=0`, `CIA2Model=0` and `KernalRev=3`.
The remaining resource values, source results and fresh PRG identities were:

| Exact profile | VIC / SID resource | Raster / SID source words | Source border | PRG SHA-256 |
|---|---|---|---|---|
| `c64-pal-prg-kernal-6581` | 0 / 0 | 312 / 6581 | 6 | `845b12713755d44e9ee95f597ce8f7872e3d33f343d982fd547a2d8db7ca52a8` |
| `c64-pal-prg-kernal-8580` | 0 / 1 | 312 / 8580 | 6 | `5f615416d71b7561bcd45b75193407d5a1451994eacf2e9ecb5a4080688f9a76` |
| `c64-ntsc-prg-kernal-6581` | 3 / 0 | 263 / 6581 | 2 | `879212bc7215823c3f97b686f0b235f7e0551c19f48f0c98b3daef70b9731123` |
| `c64-ntsc-prg-kernal-8580` | 3 / 1 | 263 / 8580 | 2 | `ce248df91053c8b6cfb5d2455b70ac6f6820a2822fcb380a3ffdf02c340b6949` |

These resource expectations come from pinned VICE 3.10
[VIC models](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/vicii.h) and
[C64 presets](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/c64/c64model.c).
The reader checks the exact integer reply in the pinned
[monitor protocol implementation](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/monitor/monitor_binary.c).

| Pinned component | Bytes | SHA-256 |
|---|---|---|
| VICE 3.10 `x64sc` | — | `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74` |
| KERNAL `901227-03` | 8,192 | `83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721` |
| BASIC `901226-01` | 8,192 | `89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d` |
| Character ROM `901225-01` | 4,096 | `fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420` |

### Startup, source execution and return

Each run stopped at startup `$080D`, public `main`, startup restoration and the captured BASIC
caller return `$E147`. The test-only entry trampoline sets I/D before startup; no NMI source is
introduced. Observed CPU states are identical across the four runs:

| Boundary | A / X / Y | SP | P |
|---|---|---|---|
| Startup entry | 0 / 0 / 0 | 246 | `$0C` |
| Main entry | 19 / 246 / 0 | 246 | `$04` |
| Caller return | 0 / 0 / 0 | 248 | `$3C` |

The asserted status contract is D clear at `main`, then restoration of I/D at return; it does not
claim every status bit remains numerically identical. SP increases by two only for the final RTS.
At `main`, owned DDR bits are `$07` and mapping bits `$06`, with upper port bits preserved.

Captured entry and exit readbacks matched in every run:

| State | Captured and restored value |
|---|---|
| CPU `$00/$01` | `$2F/$37` |
| CINV / NMINV | `$EA31/$FE47` |
| CIA2 `$DD00/$DD02` | `$C7/$3F` |
| Sprite positions `$D000..$D010` | Seventeen zero bytes |
| `$D015,$D017,$D018,$D01B,$D01C,$D01D` | `$00,$00,$14,$00,$00,$00`; `$D018` uses readable mask `$FE` |
| Colors `$D020..$D02E` | Low nibbles `14,6,1,2,3,4,0,1,2,3,4,5,6,7,12` |
| Sprite pointers `$07F8..$07FF` | `0,0,255,255,255,255,0,0` |

The initializer writes its counter exactly once. Loaded bytes `[13,29,47]` at `$3000` receive
zero stores. The selected border is written exactly once between `main` and restoration; startup
and restoration traffic is counted separately. Stop reason: captured caller-return checkpoint,
not timeout, cycle exhaustion or an inferred screen outcome.

Qualification remains **VICE-verified / hardware-unverified**. No universal silicon, SID analog,
cycle-stable raster, native Windows, NMI or takeover claim follows from these runs.

## Output Quality and Optimization

Phase 3 changes no emitted assembly, lowering, allocation or optimization path. Phase 2's
independent profile-versus-literal proof remains: the selected store is 5 bytes / 6 nominal cycles,
with no profile storage or runtime dispatch. Empty startup remains 647 emitted / 697 resident
bytes, zero ZP/scratch and 21 reported aggregate stack bytes. Entry is 345 bytes / 463 nominal
cycles; restoration is 287 bytes / 393 cycles. These are not elapsed whole-program timing claims.

Existing measured routes beyond the local expert floor remain in the execution record:
[#79](https://github.com/blendsdk/blend65/issues/79) constant-call specialization and dead-home
removal, [#51](https://github.com/blendsdk/blend65/issues/51) fallthrough elision, and
[#89](https://github.com/blendsdk/blend65/issues/89) broader output floors. No new meet-only
capability or output debt was introduced. Peephole and whole-program optimization remain reachable.

## Deferral Expiry and Remaining Owner

**Did this stage expire any deferral's stated rationale?** No new deferral became due merely
because the four cooperative identities and source facts are delivered. The already-owned
RD-04 AR-P19 source-fact obligation is now delivered by Stage A. The relevant ambiguity registers,
RD-05 exclusions and `spec/future-considerations.md` triggers were checked; profile selection does
not establish the missing interrupt, banking, physical-host, asset or optional-optimization proofs.
This is a stage handoff, not the full mandatory RD-closeout audit.

| Remaining work | Owner / next boundary |
|---|---|
| General all-returning runtime-switch layout defect [#90](https://github.com/blendsdk/blend65/issues/90) | **Next:** remaining RD-05 correctness planning; make a bounded specification-first repair plan. Not a game-specific workaround. |
| Positive NMI safety, AR-P3 / carried AR-P16 | RD-05 planning; resolve finite-source/reentry and safe vector-update proof before NMI-dependent executable work or declaring the full RD plan ready. |
| Handler-side IRQ install/restore, carried AR-P17 | RD-05 R5.16; distinct predecessor storage and finite live-chain proof still required. |
| Takeover, banking, named hardware operations, input, audio and user-authored workloads | Later RD-05 planning; the full R5.1–R5.56 and acceptance inventory remains owned by [requirements](01-requirements.md). |
| Native assets / SpritePad; loading / D64; optional optimization; tooling | RD-06; RD-07; RD-08; RD-09 respectively. |
| Windows and physical-machine qualification | RD-10, at the agreed end; no earlier access request. |

No full-RD acceptance criterion is closed by this subset. Full RD-05 remains open on the
[feature roadmap](../../00-roadmap.md). The portfolio remains untouched on this non-integration
branch and is reconciled at integration. No active technical-docs opt-in requires another artifact.

Authority lineage: frozen Specification 4, normative digest
`ee2be7c2139ff82f22d1d8f169251bae1d2244e5e4a74bddbdfc4903af39fff8`; expert skill 2.0.0, content
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`. Neither frozen baseline changed.
