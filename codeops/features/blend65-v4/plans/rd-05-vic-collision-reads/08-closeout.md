# Closeout: VIC-II collision reads

> **Date**: 2026-10-01
> **Status**: Complete — 10/10 tasks verified
> **Owner**: RD-05 R5.27 collision-latch portion only
> **Runtime boundary**: VICE-verified / hardware-unverified
> **CodeOps Artifact Schema**: 1

## Delivered behavior

| Source API | Hardware read | Result and effect |
|---|---|---|
| `c64.vic.readAndClearSpriteSpriteCollisions()` | `$D01E` | Unsigned byte of participating sprites; clears only this latch |
| `c64.vic.readAndClearSpriteBackgroundCollisions()` | `$D01F` | Unsigned byte of foreground-colliding sprites; clears only this latch |

Both operations take no arguments. Every call performs one consuming read, even when its
result is discarded. Repeated calls remain separate, source-ordered observations. Bits are
sprite participants, not collision pairs. A read does not acknowledge `$D019`, mask interrupts
or provide a synchronized two-register snapshot. New collisions may latch again.

The existing profile declarations, named machine facts and direct lowering are extended.
The existing adjacent, sole-use byte register-forwarding selector admits exactly these two
producers. It retains its fixed-address, same-block and no-intervening-clobber guards.
No new language form, IR, pass, runtime wrapper, cache, helper, harness or dependency is added.
Results that must survive another consuming read use ordinary storage closed through SFA.

## Independent verification

| Evidence | Result |
|---|---|
| New API specification | 13 cases pass: signatures, unsigned byte, zero arguments, effects and diagnostics |
| New output specification | 32 cases pass: exact assembled instructions, ordering, counts and resource deltas |
| New sequential VICE specification | 16 cases pass: four collision scenarios on each of four profiles |
| Existing profile inventories | 55 cases pass; only the exact AR-P3 rows/title changed |
| Directed implementation and regression checks | 42 cases pass, including 17 new instruction/retention cases |
| Full project checkpoint | Install, build, typecheck and all 2,980 tests pass |
| Independent reviews | Correctness, semantics and performance complete; no unresolved implementation findings |
| Artifact checks | Formatting, local links, diff checks and frozen specification/expert status pass |

The specification-first RED runs established missing-export failures before implementation:
58 failures and three already-passing cases across the 61 new cases. There was no syntax,
tool/setup failure or timeout in that RED evidence. AR-P5 subsequently authorized only the
five-line removal of a misplaced binding-representation assertion; all behavioral obligations
remain intact. See the [review record](09-phase-review.md) for the exact test-authority ruling
and the bounded before/after provenance.

The first full checkpoint hit an unchanged service test's five-second timeout. The unchanged
complete retry passed: compiler 1,620, CLI 62, language server 14, editor extension 6 and root
1,278 cases. No timeout or expectation was changed for the retry.

Local verification logs, not portable release artifacts:

| Check | Log |
|---|---|
| Combined RED | `/tmp/blend65-vic-combined-red.Hfoswz.log` |
| Directed GREEN including VICE | `/tmp/blend65-vic-directed-green.JLKduq.log` |
| Implementation/regression GREEN | `/tmp/blend65-vic-impl-final.exNqKG.log` |
| Initial full checkpoint timeout | `/tmp/blend65-vic-full-checkpoint.CQ5GKS.log` |
| Complete unchanged retry | `/tmp/blend65-vic-full-retry.KIcX5W.log` |
| Complete-cost probe | `/tmp/blend65-vic-cost-evidence.D6MLq0.log` |
| Runtime source/binary identities | `/tmp/blend65-vic-runtime-identities.c8oL3M.log` |

## Expert output and complete cost

| Isolated source operation | Generated / expert bytes | Generated / expert nominal cycles |
|---|---|---|
| One read, discarded | 3 / 3 | 4 / 4 |
| Read plus explicit fixed byte store | 6 / 6 | 8 / 8 |
| Three separate reads | 9 / 9 | 12 / 12 |
| Both latches in either source order | 6 / 6 | 8 / 8 |

Actual ACME bytes match `LDA absolute`, with `STA absolute` only where requested by the caller.
The first output run exposed unnecessary temporary traffic (+6 bytes/+8 nominal cycles).
The narrow existing-selector correction removed it; output expectations were not changed.
The local expert floor is met, not claimed as a whole-program beat. The required reopenable
path to a program-scale win is [issue #94](https://github.com/blendsdk/blend65/issues/94),
owned by RD-08: proved register allocation/retention across wider program contexts without
deleting, merging, caching or reordering consuming device reads.

For the identical PAL/6581 marker scaffold, complete artifacts have the following costs:

| Artifact | PRG including 2-byte header | Payload | Program code | Resident-RAM report |
|---|---|---|---|---|
| Baseline scaffold | 651 bytes | 649 bytes | 637 bytes | 699 bytes |
| One discarded read | 654 bytes | 652 bytes | 640 bytes | 702 bytes |
| Read plus explicit fixed store | 657 bytes | 655 bytes | 643 bytes | 705 bytes |

The existing 12-byte startup stub and 50-byte platform state are unchanged. Execution-storage
intervals are empty for these slices; zero page and scratch are zero. The reported qualified
hardware-stack aggregate is 21 bytes, comprising program-domain peak 1 plus platform reserve
20; reserve capacity is not measured use. No collision-related stack delta is introduced.
Whole-program cycles remain **Unknown**. The instruction cycles above are nominal CPU costs,
not universal VIC-contended wall-clock timing.

## Runtime evidence and identity

All profiles run through ACME 0.97 and pinned VICE 3.10 `x64sc` sequentially:
`c64-pal-prg-kernal-6581`, `c64-pal-prg-kernal-8580`,
`c64-ntsc-prg-kernal-6581`, `c64-ntsc-prg-kernal-8580`.
PAL uses VIC-II model 0, NTSC model 3; SID model 0/1, CIA models 0 and KERNAL revision 3.

Real rendered sprite pixels produce sprite/sprite mask `$81` and foreground mask `$80`.
Tests exercise each alone and both together in both read orders. Sprites are disabled for
a full frame before consuming the latches, so repeat-zero assertions do not confuse clearing
with a new collision. Ordinary RAM retains first samples across subsequent reads. Traced
device counts/order are exact; `$D019` status remains unchanged with no acknowledgment write.
The monitor observes ordinary RAM and access traces, never consumes the collision latches.

The runtime fixture is bound to SHA-256
`cedb1606ca978c59b4985ec896cb933bcff2a7f3f39b980d0573e9a3daf10e56`.
Each runtime case checks its actual assembled PRG against its published artifact digest.
Payload size is 1,038 bytes for each case. Source and PRG identities below apply to all four
profiles; differing display data is controlled by the bound monitor fixture.

| Scenario | Source SHA-256 | PRG SHA-256 |
|---|---|---|
| Sprite only / both, sprite first | `d9c39a2c32e4beb22d5dca5f60a9308e6ebe2186012ee57eb9342b8e7a8f563b` | `c85f701696321b5182e17ba1b11336ea077a73d7b04635ffe25fe4f7df48eb03` |
| Background only | `0b017403c85e342d06091f9ce50ed1b3210b55c4e4f899a7e85bba0e74b9ef85` | `4c5c874bd801d647087b02515a6fae9b7dc8fb2c06a288e6debad4e3f57c02e3` |
| Both, background first | `dd74ad8b7df4bcc038fac120961b0dc077f12aae10ddc03850b4b01dd56687f6` | `7feb089a56c3eb5ae4410057acda4eb9849c957bc2d076235be5f9e049b1c204` |

| Tool/ROM | SHA-256 |
|---|---|
| Pinned VICE executable | `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74` |
| KERNAL 901227-03, 8,192 bytes | `83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721` |
| BASIC 901226-01, 8,192 bytes | `89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d` |
| Chargen 901225-01, 4,096 bytes | `fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420` |

These identities and sequential emulator results do not qualify physical silicon.
Windows and targeted physical C64/C64U checks remain RD-10, with no earlier host request.

## Deferral-expiry gate and ownership

**Did this RD's deliverables expire any deferral's stated rationale?** No, for this bounded
collision-read slice. The missing collision bindings are delivered. The ambiguity registers,
RD-05 Won't Have scope and frozen future-consideration triggers were checked. No other
deferral's reason is removed by two consuming reads and narrow adjacent register retention.
No outstanding deferral uses this collision slice as its future landing place.

| Remaining obligation | Owner and unchanged reason |
|---|---|
| DEF-7 NMI / CIA2 consuming ownership | RD-05 R5.15–R5.17; unbounded NMI re-entry cannot be given a finite stack proof; existing guards stay |
| Enabled/unmasking exact-context CIA analysis hardening | RD-05; the completed T-02 masked-helper fix does not resolve this residual |
| Other platform, takeover and timing obligations | RD-05; not delivered by collision-latch reads |
| Native assets and missing SpritePad producer evidence | RD-06; producer/native-import authority remains separate |
| Wider optimization and local-parity debts | RD-08; no whole-program optimization win is claimed here |
| Native Windows and physical qualification | RD-10; actual host/silicon evidence remains unavailable or unqualified |

The active v4 expressiveness ledger at `test/rd04/expressiveness-ledger.json` has no collision
restriction row to retire. Its live NMI restriction remains justified; retired handler-side
IRQ and stack-estimate rows remain retired. No frozen future-consideration trigger expires.
RD-05 remains **Executing**, not Done. The feature roadmap is updated; portfolio synchronization
waits for the integration branch, preserving the existing branch-local policy.

## Documentation and authority

The techdocs check found no maintained C64 API document or existing documentation-site opt-in.
Public declarations and named facts carry durable JSDoc; no documentation framework is added.
Specification 4.0 and the single expert baseline remain untouched.

Expert baseline: **2.0.1**, content commit `1ce4852016e2a883cf1f733c6014c45e176bfc69`.
Knowledge: `c64-hardware.md#vic-ii-sprites` / `#volatile-and-rmw-policy`,
`6502-lowering-casebook.md#loads-stores-and-moves`,
`il-and-optimization.md#memory-effects-and-volatility`, `sfa-and-abi.md`.
Primary source keys: `BLEND65-SPEC-4-1c2a2d75`, `CSG-6567-318014`,
`CBM-C64-PRG-1982`, `MOS-PGM-1976`.
