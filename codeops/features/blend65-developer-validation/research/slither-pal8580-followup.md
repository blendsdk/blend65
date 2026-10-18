# Slither PAL/8580 Prerequisite Follow-up

> **Status**: Verified partial — original control-flow and one tick observation only
> **Date**: 2026-10-18 11:43 CEST
> **Checkout**: `74e08d02012577dad362097e7f3a6d02078ffff7`; compiler unchanged
> **CodeOps Artifact Schema**: 1

## Scope and Reproduction

This continues the [original assessment](slither-runtime-and-player-assessment.md)
after the bounded skill slice, not a port implementation or independent behavior
oracle. No passed requirement, frozen authority, compiler, test or skill is edited.
The complete game, music and effects remain mandatory. Combined-port AR-P3 stays
open; this record settles only part of its missing machine/runtime evidence.

All fourteen allowlisted upstream inputs at
`31347444d9547210f698ac98961e794ea671d276` were downloaded through fixed HTTPS
raw URLs, with redirect identity, exact lengths and every SHA-256 checked against
the [initial inventory](../requirements/_draft/slither-source-assessment.md#input-inventory).
The source/include path was re-inspected. The literal argument array
`/usr/bin/acme -l build/labels.txt index.asm` ran in one owned temporary original
directory. No upstream Makefile, launch, cleanup or dependency script ran.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Fresh original `build/slither.prg` | 48145 | `94ad1ac90e3ec0c8d0ea5a5e9e0df8411691a337cb01f10d8de2d4d2f70852e2` |
| Fresh original `build/labels.txt` | 1271 | `866f8568de5887824efb90601ef40507136022fb8e373e9e4a0e7ecf27599f8a` |

The PRG again matches both earlier original builds. This is not comparison with
an independently published binary. Its payload spans `$0801–$C410`, end-exclusive,
including sparse-placement fill; file length is not live RAM or instruction size.
ACME 0.97 executable SHA-256 remains
`19485b0605ddae23897d07cde5fd05c7e0c40eea530668db0b86e68e9f45c4f8`.

## Exact Runtime and Ownership

The user has standing authority to reserve a new VICE session without asking
again. The primary announces this window, verifies no exact-name `x64sc` process,
starts one owned process and awaits the unchanged helper's teardown in `finally`.
The run lasts **09:43:05.687–09:43:24.556 UTC** on 2026-10-18. The final exact-name
check is empty and the window is explicitly released. No foreign process is
stopped. A later run still checks actual availability; standing authority does
not permit overlap or imply host-wide mutual-exclusion enforcement.

The existing `test/m1/vice-runtime.ts` and `vice-monitor.ts` are unchanged at
hashes `52ebddb24e48e11f5971b5ce34d50276dcb46e0a354049b1366b981705e61050`
and `e1320888df0dc668b5c6793cfa6912bdc39253fd4f5e43e4b097d83fa96871e6`.
Node 22.23.1 strips types into temporary copies without changing runtime logic.
No retained runner, dependency or helper change is introduced.

| Context | Configured and monitor-checked result |
| --- | --- |
| Profile | `c64-pal-prg-kernal-8580`, NMOS C64/6510, PAL 6569, one MOS8580 |
| VICE | `x64sc` 3.10, reported `[3,10,0,0]`; executable SHA-256 `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74` |
| Resources | `VICIIModel=0`, `SidModel=1`, `CIA1Model=0`, `CIA2Model=0`, `KernalRev=3` |
| ROMs | Same hash-checked 901227-03 KERNAL, 901226-01 BASIC and 901225-01 character ROM as the earlier assessment; no captured ROM is retained/distributed |
| Display | Validated 504 by 312 indexed response |
| Controls | Joystick 2 simulation; released `$1F`, fire `$0F`, right `$17` |
| Termination guards | 150,000,000 emulated cycles; 60-second stop waits; neither is measured game cost |

This model matches the selected SID's PAL/MOS8580 declaration. It does not prove
universal silicon compatibility, analog sound or complete game correctness.
Sound output is disabled by the unchanged helper; no listening test occurs.

## Bounded Control-flow Replay

The PRG autostarts normally. Original-byte execution checkpoints observe `$C000`,
`gamestart=$C015`, `joy_read=$C031`, player entry `$1003` and the unchanged IRQ
continuation `$C3FC`. They do not inject calls or rewrite the game. Apart from
simulated joystick pins and monitor checkpoints/tracepoints, game RAM, code,
CPU registers, banking, vectors and devices are not patched. Reads have monitor
side effects disabled. Pauses are not physical latency or uninterrupted timing proof.

An initial start permits one isolated tick observation. Ordinary rightward input
then reaches collision/restart, resetting the replay through the real game path.
The following finite replay starts from that genuine restart. Score bytes are
packed decimal in memory order: `$16` means sixteen.

| Original boundary before instruction | Score bytes | Bitmap pointer / mask | Direction |
| --- | --- | --- | --- |
| First replay `joy_read` | `$00,$00,$00` | `$3000 / $80` | `$FB` |
| Released input, step 1 | `$01,$00,$00` | `$2FF8 / $01` | `$FB` |
| Released input, step 2 | `$02,$00,$00` | `$2FF8 / $02` | `$FB` |
| Released input, step 8 | `$08,$00,$00` | `$2FF8 / $80` | `$FB` |
| Released input, step 16 | `$16,$00,$00` | `$2FF0 / $80` | `$FB` |
| Right input, next loop | `$17,$00,$00` | `$2FF0 / $40` | `$07` |
| Collision return to `gamestart` | `$18,$00,$00` | `$2FF0 / $40` | `$07` |
| Restart, first `joy_read` | `$00,$00,$00` | `$3000 / $80` | `$FB` |

All 21 sampled boundaries, including the initial start and sixteen released
steps, retain CPU ports `$2F,$37`, CINV `$C3F4`, NMINV `$FE47` and mainline SP
`$F6`. Original entry instead has CINV `$EA31`. These are sampled states, not
proof of every intervening transition, stack peak or external NMI route.
Display hashes vary with raster/partial-frame capture and are not frame goldens.
The movement table agrees with the earlier 6581 observations; that agreement is
supporting evidence, not an independently derived immutable port expectation.

## One Actual Player Tick

Execution stops at original play entry `$1003`, then at `$C3FC` immediately after
the IRQ's actual `JSR $1003`. Between those boundaries:

- A/X/Y change from `$01/$EA/$08` to `$07/$00/$00`; sampled status stays `$24`.
- SP changes `$E8→$EA` across the return; this is **not** a two-byte stack-peak
  measurement and does not reveal the player's internal call depth.
- Snapshots of `$1000–$1C91` differ at 13 bytes. The exact payload needs writable
  residency. This does not distinguish instruction self-modification from data.
- Snapshots of `$0002–$00FF` are equal. This does **not** prove no ZP access,
  no restored writes, or safety at other calls/states.
- Non-stopping store tracepoints record 25 accesses, once to every address
  `$D400–$D418`. The SHA-256 of the ordered offset bytes is
  `07512c36efbe7328b559c6906b81b933144fa48b208a36382ac6203e76300a44`.
  This retains addresses/count/order identity, **not written values or timestamps**.

There is also SID activity during collision/restart. It is not treated as a
complete music/SFX trace. No effect arbitration, full ABI, all writable ranges,
reentrancy, tick cycles, complete hardware-stack budget or audible behavior is
qualified by these finite observations. `VICE-verified / hardware-unverified`.

## Source Contract Facts for the Existing Owner

These facts refer to the exact pinned source, not compiler APIs:

| Source location | Observed obligation |
| --- | --- |
| [`code/irq.asm`](https://github.com/skrasser/slither_c64/blob/31347444d9547210f698ac98961e794ea671d276/code/irq.asm) `irq_setup` | Masks all CIA1/CIA2 interrupt sources and reads both ICRs; selects raster line zero and installs CINV. Source intent is not an all-source/NMI proof. |
| Same file, `irq_handler` | Original 11 bytes at `$C3F4–$C3FF`: `a9018d19d02003104c81ea`; writes `$01` to VIC IRQ status, calls `$1003`, jumps to 901227-03 restore-only tail `$EA81`, not full stock service. No `CLD` appears. |
| Same file, `music_start/music_stop` | Init uses A=0 and `JSR $1000`, then enables raster IRQ. Stop disables raster IRQ; it is not a player stop entry. Cadence is source-owned raster-line-zero calls, not the PSID header's generic CIA timer setting. Exact rate/jitter remains unmeasured. |
| [`code/main.asm`](https://github.com/skrasser/slither_c64/blob/31347444d9547210f698ac98961e794ea671d276/code/main.asm#L22-L53) collision path | Disables music raster IRQ, clears/reinitializes SID, triggers crash, flashes border in four three-frame waits, returns to fire prompt. Restart initializes music before releasing crash gate. Complete event ordering and pending-source overlap still need proof. |
| [`code/sfx.asm`](https://github.com/skrasser/slither_c64/blob/31347444d9547210f698ac98961e794ea671d276/code/sfx.asm) | Initializer clears all 25 SID registers, sets volume and voice-1 envelope. Crash writes frequency high=6, low=0 and control=129; release writes control=128. This is direct source-owned SID effect logic, not a player-native SFX API. |
| [`code/score.asm`](https://github.com/skrasser/slither_c64/blob/31347444d9547210f698ac98961e794ea671d276/code/score.asm#L8-L26) | `SED`/decimal increment/`CLD` may intersect enabled raster IRQ. NMOS entry preserves D, and the IRQ has no decimal normalization. Safe player behavior for D-set entry remains **Unknown**, not disproved by the D-clear sampled tick. |

KERNAL IRQ entry saves A/X/Y and terminal `$EA81` restores them plus CPU status
through `RTI`. Existing ROM entry/tail bytes are not output-file bytes. Complete
source acknowledgement, player calls/storage, decimal policy, NMI routes, nesting,
bank visibility and full route timing/stack remain open. No generated Blend65
interrupt variant or SFA closure is assessed here.

Known input sizes are 3217 player payload bytes at `$1000–$1C91`, 48145 PRG file
bytes and the cited 11-byte original IRQ body. Player instruction/data split,
self-modifying ranges, ZP/scratch, internal stack, cycles and full route costs
remain Unknown. Loader/init transfer costs and full resident/IRQ/NMI peak costs
are also Unknown; neither zero nor a compiler cost qualification is inferred.

## Rights and Public Support: Still Open

The pinned repository still supplies MIT copyright 2013–2015 Sven Krasser.
README and SID metadata add no export-player permission. A targeted public
enquiry into export licensing did not produce an authoritative term. The
upstream GitHub all-state issues endpoint returned an empty list on 2026-10-18.
That absence establishes no rights, endorsement or failure of eligibility.
The previously observed unrelated developer domain is not revisited or treated
as authority. No author/vendor was contacted and no public issue was created.

At this unchanged checkout, `packages/compiler/src/assets/` contains raw-asset
resolution/types and their tests. A scoped TypeScript search of compiler sources
for `PSID`, `SidTracker`, player-contract spelling, `E10256` and
`audio_player` has no matches. Raw byte embedding is not a callable ABI. This is
static unestablished-support evidence, not a public compiler rejection result.
RD-06 R6.23–R6.26 retains exact player contracts; its first GoatTracker 2.77
adapter does not identify or qualify this SidTracker64 export. No adapter,
assembly escape, replacement or compiler repair is authorised by this assessment.

**Next rights evidence:** obtain applicable export-player permission/source terms
from the original author/vendor, or an authoritative existing licence covering
the exact included bytes. Draft questions are in
[the dependency handoff](slither-player-dependency-handoff.md#specific-next-evidence).
Contacting/publishing on the user's behalf needs explicit approval. Until then,
rights are Unknown—not cleared and not a demonstrated infringement. Dependent
copying/distribution/integration and port implementation remain blocked.

## Lineage and Documentary Verification

Expert 2.0.4, immutable content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
Specification 4 identity
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
Selected normative references: `c64-game-engineering.md#music-and-sound-effects`
and `#machine-bound-workload-completion-gate`,
`sfa-and-abi.md#interrupt-route-completion-gate`,
`c64-memory-and-runtime.md#interrupt-entry-and-exit-contracts`,
`c64-hardware.md#interrupt-control` and `#sid-register-and-revision-model`,
`acme-and-artifacts.md#vice-proof-contract`.
Governing keys include CBM-C64-KERNAL-03, MOS-6526-1981, MOS-6581-SID and
VICE-310-MANUAL. No expert evaluator/case answers are read.

The primary binds this record to the actual temporary probe SHA-256
`ac56ea32ef46bd4bd5e2081e63989b55bbbfb69ca39c5c16ca2fb658aff001c4`
and observation report SHA-256
`4060a63623c16cb5cfbcb7bea5f3242c26edb1af796dbe671695f6927e79fafe`.
These identify historical diagnostics, not retained executables or a reproducible
test oracle. Selected facts above survive removal of disposable downloads/logs.
Targeted formatting, links, source/record identity checks and independent bounded
correctness/platform review are required before this documentary checkpoint.
No fresh compiler suite or renewed AR-P5 exception is claimed.

### Independent Documentary Review

Correctness reviewer `ses_eb1985cebffeSpWSN6Vgju090V`, explicitly requested
`openai/gpt-6-astra#high`, reports **no findings** against `74e08d02` at the
supplied-evidence endpoint. Native permissions denied its temporary diff read;
no retry, tool change or permission bypass occurred. It reviewed the parent-supplied
exact inline three-file deltas and the entire new repository addition instead.
Unchanged oracle paths rely on the parent's complete changed-path receipt; no
oracle exception applies. Historical routing smoke text encountered in guidance
was excluded from assessment.

Target-platform reviewer `ses_eb197dc5affelOi4JoV2RHnW3N`, explicitly requested
`openai/gpt-6-astra#xhigh`, also reports **no findings** within the bounded
machine/SID/IRQ claim limits. The exact diff/hash and runtime facts remain
parent-supplied evidence, not independent raw-artifact inspection. Both reviewers
retain the missing rights/full ABI/cost/support gates; no reviewer agreement
qualifies audio, a complete interrupt route, the port or physical hardware.

Primary verification passes targeted formatting, all 19 local links/anchors,
the 21 sample invariants/eight selected replay rows and tick/report/artifact/tool
identities. Compiler, prior evidence, requirements, oracles, frozen authority,
policy, other owners and the integration portfolio remain unchanged. The
remaining checkpoint actions are final receipt formatting, task-owned cleanup
and a local documentation commit only; no push or external enquiry is authorised.

At 11:49 CEST the final deterministic checks and existing roadmap engine confirm
the unchanged 0/1 RD count. The exact task-owned original-assessment scratch,
downloads, generated PRG, probe and logs are removed without following symlinks
or touching foreign files. A final process check finds no `x64sc`. Selected
identity-bound observations remain in this record; the local commit's own
temporary message/logs are removed after the commit completes.
