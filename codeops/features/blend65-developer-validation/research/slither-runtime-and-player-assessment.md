# Slither: Original Runtime and Player Assessment

> **Status**: Verified partial — bounded original control-flow observations only
> **Date**: 2026-10-15 23:20 CEST
> **Owner**: blend65-developer-validation/RD-01 source assessment
> **Codebase**: `b8f21d56`; compiler implementation unchanged from `58c771dc`
> **CodeOps Artifact Schema**: 1

## Purpose and Boundary

Continue the [initial source assessment](../requirements/_draft/slither-source-assessment.md)
without changing its historical evidence or the four inputs passed by
[requirements preflight](../requirements/00-preflight-report.md). This research
record is new evidence, not a fifth passed requirement, an implementation plan,
an independent behavior oracle or a qualified Blend65 port.

The user explicitly reserved an exclusive VICE window. An initial exact-name
process check found no `x64sc`. Two owned original-only probes ran sequentially,
then terminated through the existing owned-process helper. The final process
check found no `x64sc`. **The primary released the exclusive window.** Another
run requires renewed coordination; this record does not retain emulator access.

## Reproduction and Observation Method

The fourteen pinned inputs from upstream
`31347444d9547210f698ac98961e794ea671d276` were downloaded again by explicit
HTTPS file allowlist and checked against every recorded byte size and SHA-256.
The installed ACME binary identity was checked before the same literal
`acme -l build/labels.txt index.asm` action. Both output identities again match
the initial assessment: PRG 48,145 bytes/hash
`94ad1ac90e3ec0c8d0ea5a5e9e0df8411691a337cb01f10d8de2d4d2f70852e2`, labels
1,271 bytes/hash
`866f8568de5887824efb90601ef40507136022fb8e373e9e4a0e7ecf27599f8a`.
No upstream build/launch/cleanup recipe was executed and no input was patched.

The probe reused `test/m1/vice-runtime.ts` and `test/m1/vice-monitor.ts` in owned
temporary storage. Node 22.23.1's experimental `stripTypeScriptTypes` removed
types only; helper runtime logic was not edited. This is a temporary research
invocation, not a new retained runner or a compiler build/typecheck result.
Trying the installed TypeScript package's legacy transpilation API first failed
before any emulator started; no package was installed or replaced.

| Existing helper input | SHA-256 |
| --- | --- |
| `test/m1/vice-runtime.ts` | `52ebddb24e48e11f5971b5ce34d50276dcb46e0a354049b1366b981705e61050` |
| `test/m1/vice-monitor.ts` | `e1320888df0dc668b5c6793cfa6912bdc39253fd4f5e43e4b097d83fa96871e6` |

Autostart loaded the exact original PRG. Execution checkpoints stopped before
the original's `$C000` entry and at its unchanged labels `gamestart` (`$C015`)
and `joy_read` (`$C031`). Input was supplied through the existing joystick-2
simulation: released `$1F`, fire `$0F`, then released movement for sixteen loop
iterations. The extended run added right `$17`, collision return and fire to
restart. No game RAM, code, banking, vectors, registers or devices were patched.
Monitor reads requested no side effects. Pausing the emulated clock is not a
claim about physical input latency or uninterrupted timing.

### Exact exploratory machine

Both probes deliberately used the existing helper's explicit
`c64-pal-prg-kernal-6581` context: NMOS C64, PAL VIC-II 6569, one 6581, CIA model
0, KERNAL revision 3. The monitor returned version `[3,10,0,0]` and resources
`VICIIModel=0`, `SidModel=0`, `CIA1Model=0`, `CIA2Model=0`, `KernalRev=3`.
Display responses were 504 by 312 pixels. Each probe had a 150,000,000-cycle
termination bound; this is an experiment limit, not measured game cycles.

| Runtime input | Bytes | SHA-256 |
| --- | ---: | --- |
| VICE executable | — | `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74` |
| KERNAL 901227-03 | 8,192 | `83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721` |
| BASIC 901226-01 | 8,192 | `89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d` |
| Character ROM 901225-01 | 4,096 | `fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420` |

**This exploratory SID model does not match the tune's subsequently decoded
declaration below.** It cannot qualify audio or establish the final compatible
profile. The observations remain valid only for the explicit probe context.
No 8580 run or physical-hardware result is claimed.

## Observed Original Control Flow

Values below are observations before the named instruction, not expected
answers authored for a future port. The packed-decimal score bytes are listed
in memory order; `$16` represents sixteen, not twenty-two.

| Observation | Score bytes | Bitmap pointer / mask | Retained direction |
| --- | --- | --- | --- |
| First `joy_read`, before score increment | `$00,$00,$00` | `$3000 / $80` | `$FB` |
| Released input, step 1 | `$01,$00,$00` | `$2FF8 / $01` | `$FB` |
| Released input, step 2 | `$02,$00,$00` | `$2FF8 / $02` | `$FB` |
| Released input, step 8 | `$08,$00,$00` | `$2FF8 / $80` | `$FB` |
| Released input, step 16 | `$16,$00,$00` | `$2FF0 / $80` | `$FB` |
| Right input, next loop | `$17,$00,$00` | `$2FF0 / $40` | `$07` |
| Collision return to `gamestart` | `$18,$00,$00` | `$2FF0 / $40` | `$07` |
| Restart, first `joy_read` | `$00,$00,$00` | `$3000 / $80` | `$FB` |

At original entry, CPU-port bytes were `$2F,$37`; CINV was `$EA31` and NMINV
`$FE47`. At game-loop observations, CPU-port bytes remained `$2F,$37`, CINV was
`$C3F4` and NMINV remained `$FE47`; CPU SP was `$F6` at the selected mainline
boundaries. These finite samples do not prove all bank transitions, interrupt
routes, NMI behavior, player clobbers, stack peaks or decimal-mode safety.
Captured display/RAM hashes are diagnostic observations at particular raster
positions, not deterministic full-frame goldens or proof of every rendered state.

## Newly Decoded SID Facts

The same hash-bound `data/slither_r.sid` has flags **`$0024`** at file offset
`$76`. The primary
[HVSC SID file format](https://www.hvsc.c64.org/download/C64Music/DOCUMENTS/SID_file_format.txt)
defines the v2 fields in sections “BITS 2-3: VIDEO STANDARD”, “BITS 4-5: SID
MODEL” and “+12 LONGWORD speed”. The fetched document is dated 2026-10-09; only
its v2-compatible definitions are used, not new v5 functionality.

| Field | Exact value and meaning |
| --- | --- |
| Clock bits `(flags >> 2) & 3` | `1`: PAL |
| SID-model bits `(flags >> 4) & 3` | `2`: MOS8580 |
| Speed | `$FFFFFFFF`: song 1 declares CIA1-timer timing in a generic PSID environment |
| Payload | 3,217 bytes after the 124-byte header and embedded two-byte load address |
| Loaded payload interval | `$1000` through `$1C90`, end-exclusive `$1C91` |
| Declared init/play | `$1000` / `$1003` |

The original game's `code/irq.asm` instead invokes `$1003` from its raster IRQ
after disabling CIA interrupt masks. Header timing is not authority to rewrite
the original game's call schedule. The exact game/player contract must explain
that difference, preserve the assessed game and prove the required device
behavior. Header fields alone prove neither safe calls nor content rights.

Under frozen Specification 4 Chapter 15, SID-configuration identity and
`audio_player_contracts`, a contract cannot contradict a specific header model.
Thus **`c64-pal-prg-kernal-8580` is the declaration-compatible cooperative
candidate for the next assessment**, not a newly qualified result. The earlier
6581 observations cannot establish its audio behavior.

## Compiler Prerequisite and Honest Remaining Work

At this compiler snapshot, the bounded source inventory contains only raw asset
resolution in `packages/compiler/src/assets/`; `packages/compiler/stdlib/c64/`
contains `input.blend`. Searches of `packages/compiler/src/*.ts` recursively
found no PSID handler, player-contract registry, E10256 implementation or
SidTracker64 adapter. This is **static absence evidence**, not a fabricated
public failing compiler invocation or a new diagnostic expectation.

Existing v4/RD-06 R6.23 requires an exact hash-bound callable-player contract;
R6.24 owns the first GoatTracker 2.77 adapter, not Slither's SidTracker64 export.
The ABI includes registers/flags, writable/self-modifying ranges, ZP/stack,
banking, tick cadence, interrupt ownership, costs and direct SID-SFX coexistence.
Raw byte inclusion and known init/play addresses cannot replace that contract.
No adapter, compiler change, inline assembly or music removal is authorized here.

| Boundary | State / next owner |
| --- | --- |
| Original inputs and assembly | Verified complete for the existing pinned input/output hashes; reproduced once more. |
| Original movement/collision/restart | Verified partial in the explicit PAL/6581 probes only; `VICE-verified / hardware-unverified` for those observations. |
| Declaration-compatible PAL/8580 runtime | Unknown; requires a newly coordinated emulator window. |
| Rights and exported-player provenance | Repository MIT remains declared; no conclusive export-player terms were established by the bounded public-source search. Full gate remains open. |
| Player ABI, music/SFX effects and cadence | Unknown; exact source/payload/route proof still required. No listening or complete SID-event trace was taken. |
| Complete game/IRQ/NMI/cost proof | Unknown; neither SP samples nor a reached checkpoint prove these totals. |
| Callable-player compiler support | Unestablished at the public endpoint; existing v4/RD-06 owns capability qualification and any repair, with an owner decision needed for this exact export. |
| Independent oracles, skill and port | Not authored or implemented. Observed answers are supporting source-assessment evidence, not their immutable expected answers. |

### Knowledge lineage

Expert 2.0.4, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
Specification 4 identity
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
Selected reference headings: C64 game machine-bound completion; C64 memory
interrupt entry/exit; SFA interrupt-route completion; C64 hardware interrupt
control; evidence boundaries and equivalent-work accounting. Governing keys
include the frozen specification, CBM-C64-KERNAL-03 and MOS-6526-1981. No route
is declared complete and no new hardware doctrine is inferred from this probe.

## Documentary Checkpoint

Independent correctness and target-platform reviewers report **no findings at
the supplied-evidence endpoint** for the two new documents against `b8f21d56`.
The platform reviewer received the complete interrupt-route gate and the five
current-release metadata fields; neither reviewer inspected temporary raw
binaries, independently executed the probes or established a full player/route
contract. Historical routing smoke summaries were excluded from evidence.

Primary validation passes targeted Markdown formatting, four local links, all
eight table rows and recorded runtime/helper/artifact identities against the
actual probe results, and the PAL/8580 header derivation. All four passed
requirement input blobs, frozen authority and other feature/portfolio files
remain unchanged. No compiler test/build or physical-hardware result is claimed.
Planning discovery remains open; this checkpoint is not plan preflight.
