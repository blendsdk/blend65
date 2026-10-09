# Closeout — direct constant nested construction

> **Parent**: [Index](00-index.md)
> **Status**: Complete — 14/14 verified; one minor report-only host follow-up
> **Boundary**: T-12 / keyboard AR-P9, not RD-05 or keyboard qualification
> **Last Updated**: 2026-10-09 18:10 CEST
> **CodeOps Artifact Schema**: 1

## Delivered contract

Fresh local initialization carries one whole-tree constant/effect proof through the
existing aggregate destinations. Explicit nested literals write their certified
final subhomes. Both builders omit only complete, identical member intervals;
equal immediate loads are reused only while A/N/Z remain proved unchanged.
Typed frontend constants supply packed scalar values; no new evaluator is added.

Assignments, globals, borrowed/caller destinations, effectful trees, aggregate-fill
reuse and unknown homes retain existing safe lowering. Destination indices remain
live. Existing inventory, interference, binding and final SFA closure still own every
function home. There is no new pass, IR kind, runtime, solver, API or source restriction.

| Requirement                  | Decisive evidence                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| R1 packed values/layout      | Independent four-profile bytes, signed/enum/cast/word and wide-offset cases                |
| R2 no redundant construction | Assembled row bound, exact final-home resource assertions, both-builder identity checks    |
| R3 effects/ABI               | Independent order/count, later mutation, overlap/borrow/return and D/I/SP checkpoint cases |
| R4 closed storage            | Real inventory/allocator tests, final bound artifact and independent SFA audit             |
| R5 authorities/identity      | Old tests and frozen authorities unchanged; public identity/repeated-build controls        |
| R6 independent oracles       | Separate requirement-derived behavior and MOS-derived output/cost expectations             |

## Verification and review

| Check                           | Result                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| New immutable specifications    | 36/36 GREEN; corrected pre-production RED was 16 failures / 20 pre-passing controls                               |
| Old directed controls           | 32 root aggregate/ABI/borrow specifications and 83 package internals pass unchanged                               |
| New internals                   | Nine semantic and ten machine cases pass; 26 CFG controls also pass                                               |
| Install / build / typecheck     | PASS                                                                                                              |
| Complete owned tests            | PASS: 5,921 tests; two existing compiler skips. Root 3,922; compiler 1,910; CLI 62; language server 21; VS Code 6 |
| Touched formatting / whitespace | PASS; local links, source keys and final authority/oracle guards checked                                          |

Six fresh native reviewers inspected the complete working diff against baseline tree
`6b1e165fb42d349d442d5a36db003cc01d9612be`, including untracked files, in waves within
the four-agent limit. No reviewer ran competing verification or VICE.

| Lens                                       | Result / disposition                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness / standards / oracle integrity | No findings; no old-oracle exception                                                                                                     |
| Semantics / modern-source DX               | No findings within the correction                                                                                                        |
| SFA / ABI                                  | No findings; complete certified final-home and fallback proof                                                                            |
| Emitted output                             | No findings within T-12; row meets the local floor, not whole-program parity                                                             |
| Target platform                            | No findings within the preservation contract                                                                                             |
| Host performance                           | PE-001 MINOR, report-only: repeated prefix cloning for large copy-free nested tables; follow-up remains owned, not a correctness failure |

### PE-001 host-cost follow-up

PE-001: `lower-aggregate-build.ts:268` clones an accumulated instruction prefix
which `lower-function.ts:437` then discards. A legal fresh `Row[1024]`, each row
containing an explicit `byte[8]`, copies at least 4,198,400 instruction references
per lowering invocation. Eight-byte slots imply about 32 MiB cumulative transient
copying, not measured peak or latency. The bounded remedy is to retain the prefix
unchanged for empty tails and reuse the existing small builder for scalar-only tails.
No responsiveness failure was measured. Roadmap T-13 owns this compiler-host follow-up,
not authority for a larger optimizer or framework.

Review evidence limits: base and host readers briefly exposed release summaries;
the base reader also saw a historical reference preamble. The platform reader saw
the adjacent saved-decoder subsection. Those passages were excluded from decisive
reasoning; no qualification-answer/map check is counted. The accepted new specs
have recorded blind-author/RED chronology but no acceptance-time digest. Current
closeout hashes bind final bytes only, not a retrospective acceptance proof.
The platform reader corrected its initial baseline label: the normalized assembly
comparison used two post-fix generations. Original startup preservation rests on
the unchanged implementation, not a reinspection of the pruned baseline artifact.

## Exact ordinary artifact and costs

Private evidence root:
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/keyboard-construction.wF92Zh/nested-constant/`.
Generation `fbaa1630-7e00-4310-bf43-1c13517e09d1` contains the real PRG and hidden
assembly, labels, build/debug/memory/cost records. Public check/build succeed without
diagnostics. PAL/6581, NMOS 6510, ACME 0.97, optimization `none`, safety off; no
keyboard operation or NMI hook.

| Identity              | SHA-256                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `src/game.blend`      | `c9f51871da59bebbe478fa4406aeb08b89a89a8a162d075055b7da883270e859` |
| PRG                   | `70d1ba4bd74b50a52142163a35b9948ef09820ff4c37556f25eeae67b5836413` |
| `.build.json`         | `1d3e93a7d82b7b0c7cd9c1a8795100e36e0a3fc877d3489bdcac0e119cb9ba3a` |
| Final SFA closure     | `d6d5aa878b12a112201f6b476ce0bf35797086ddacf868d84e5afb5227c5fc3f` |
| Current output spec   | `5c93171a97add45de1f1587045ce961f802a2118a095d3bf7a04b95244dea370` |
| Current behavior spec | `4afa4c3edb7ba6b2d4e99aa712f6f9df41e2d0f75d2067981028d0d2bc8cebf5` |
| Current safety spec   | `dc0aaaf61b0be9c781ef1ca6edd5ef6cce1e0a670d6da57fc546abe31399df3c` |

| Resource / component                         | Recorded baseline | Fresh actual result |
| -------------------------------------------- | ----------------: | ------------------: |
| Eight-row construction code / nominal cycles |    97 bytes / 237 |       26 bytes / 34 |
| Complete main code / nominal cycles          |   121 bytes / 266 |       46 bytes / 59 |
| Native code, including startup/restore       |         730 bytes |           655 bytes |
| BASIC stub                                   |          12 bytes |            12 bytes |
| PRG payload / container                      |   742 / 744 bytes |     667 / 669 bytes |
| Platform BSS                                 |          49 bytes |            49 bytes |
| General RAM function storage                 |          19 bytes |            11 bytes |
| Zero page                                    |           4 bytes |             0 bytes |
| Resident occupancy                           |         814 bytes |           727 bytes |
| Padding / tables/assets / helper scratch     |                 0 |                   0 |

Actual rows at `$0955–$096E` are `LDA #0` plus eight absolute stores to
`$0ACD–$0AD4`: 26 bytes / 34 nominal cycles, the independent local expert floor.
Complete 11-byte construction is 37 bytes / 48 cycles. Startup is 328 bytes / 441
cycles; restoration is 281 bytes / 385 cycles. The uninterrupted generated native
path totals 885 nominal cycles. These are instruction calculations, not elapsed
VICE/silicon timing, BASIC/loader work or firmware/interrupt/DMA costs.

Savings against the prior independent audit record: 75 packaged bytes, eight RAM
bytes, four ZP bytes and 207 nominal main cycles. Normal two-generation publication
retention pruned the original baseline PRG during recapture; the old raw bytes were
not reinspected. The current actual bytes/reports and retained baseline audit are
different evidence endpoints.

Generated additional stack use is one status byte; incoming SYS and external
firmware/interrupt stack are separate. External aggregate NMI stack, retained-firmware
completion, deadlines and whole-program runtime memory safety remain unproved.
Four-profile VICE cases prove their specified checkpoints, not this exact private
artifact's complete epilogue or universal hardware behavior: **VICE-verified /
hardware-unverified**. No whole-program win is claimed.

Open [#102](https://github.com/blendsdk/blend65/issues/102) retains the path beyond
the local meet. An analytical retained-11-byte expert main uses A=0 for the ten
zeros, `LDY #2; STY quality`, then `STA $D020; JMP restore`: 43 bytes / 55 cycles,
versus current 46 / 59. Existing member/register selection or value forwarding owns
that 3-byte / 4-cycle opportunity under RD-08. It is unassembled/unexecuted; neither
whole-main parity nor a broader output waiver is claimed. No issue was closed or
externally updated by this checkpoint.

## Deferral expiry and remaining owners

**Did this slice's deliverables expire any deferral's stated rationale?** Yes: the
approved keyboard AR-P9 unnecessary constant-child construction obstacle expires
for the qualified fresh-local cases. It must not remain an unfinished prerequisite.
It does not choose the acquisition route, prove the decoder, resolve AR-P10 or close
RD-05/DEF-7. PE-001 has a separate follow-up owner, not this closed plan's future slice.

Walked this register, keyboard AR-P2/3/6–10, carried platform/IRQ/CIA/NMI decisions,
RD-05's Won't Have boundaries, requirements AR-026, the active expressiveness ledger
and frozen future reconsideration criteria. No additional rationale expires. FUT-012
remains a redundant copy API, FUT-017/018 gain no distinct barrier/volatile contract,
and assembly-linking, stack-free calls, syntax, asset conversion, hardware/user-host
and general optimization deferrals keep their existing reasons/owners. No new source
restriction or protected-ledger amendment is introduced.

Lineage: expert **2.0.4**, immutable content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`, router SHA-256
`0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8`, frozen spec
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
Normative routes: packed/effect semantics; SFA ownership/lifetimes/final closure;
aggregate lowering; NMOS load/store flags; equivalent-work/cost ledger; ACME PRG.
Keys: BLEND65-SPEC-4, MOS-PGM-1976, MOS-6510-1982, CBM-C64-PRG-1982,
CBM-C64-KERNAL-03, ACME-097-R266, VICE-310-MANUAL.

Private verification logs are in Git metadata `nested-constant-fix.6ev3Cu/`.
No new persistent `/tmp` diagnostic directory or architecture framework was added.
Unrelated historical `/tmp` folders were left untouched; active test roots are
fixture-owned and cleaned by their existing lifecycle. No push is authorized.
