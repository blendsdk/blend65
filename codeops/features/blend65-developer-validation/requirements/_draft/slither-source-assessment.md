# Slither Source Assessment

> **Owner**: blend65-developer-validation/RD-01
> **Status**: Verified partial — original source/build facts established; pilot qualification incomplete
> **Date**: 2026-10-15
> **Bootstrap commit**: `1022fd52226215a6c77db7c2251be184f4d26b94`
> **CodeOps Artifact Schema**: 1

## Scope and Result

This is preparatory evidence for R1.1–R1.4, not a plan, port implementation,
frozen oracle, completed source-assessment gate or compiler capability claim.
The original's required source and included SID data are available at one
immutable upstream commit. Two independent source/output directories produce
identical PRG and label bytes using the installed ACME 0.97. No upstream file
was patched, and no compiler, skill or specification test was changed.

No VICE process was launched. Machine/profile compatibility, imported-player
ownership/ABI, complete runtime behavior, independent expected traces and expert
cost bounds remain unqualified. A successful assembly does not decide any of
those questions. The RD remains **RD Drafted**, with requirements preflight and
implementation planning still due.

## Reference Identity and Declared Rights

| Field | Value |
| --- | --- |
| Repository | <https://github.com/skrasser/slither_c64> |
| Selected upstream commit | `31347444d9547210f698ac98961e794ea671d276` |
| Commit date reported by GitHub | 2017-06-11T01:38:25Z |
| Source root | [Pinned source](https://github.com/skrasser/slither_c64/tree/31347444d9547210f698ac98961e794ea671d276) |
| Declared licence | [MIT, copyright 2013–2015 Sven Krasser](https://github.com/skrasser/slither_c64/blob/31347444d9547210f698ac98961e794ea671d276/LICENSE) |
| Selected inputs | Four root text files, nine `code/*.asm` files and `data/slither_r.sid`; all fourteen hashes below |
| Download method | Fixed HTTPS raw URLs at the selected commit; explicit file allowlist, no archive, clone, installer or dependency script |

The repository provides one MIT notice. The inspected source has a Dustlayer
template attribution and the SID metadata names SidTracker64 v1.0. No separately
declared conflicting licence was observed in the selected text files, but that
is not independent proof of the provenance of every generated player byte or
underlying asset. Preserve the MIT notice and those attributions. Before
retaining/distributing an asset or choosing an imported-player integration,
resolve any missing rights/dependency evidence; do not describe the whole
redistribution gate as cleared by this preliminary check.

Original source, SID and generated PRG files were used only in task-owned
temporary directories for this assessment. They are not vendored into the
repository by this document. The hash inventory and pinned URLs permit a later
authorized reproduction without retaining disposable downloads or logs.

## Reviewed Build Path

The [README](https://github.com/skrasser/slither_c64/blob/31347444d9547210f698ac98961e794ea671d276/README.md)
suggests Dustlayer's `dust compile`. The actual
[Makefile](https://github.com/skrasser/slither_c64/blob/31347444d9547210f698ac98961e794ea671d276/Makefile)
provides a direct ACME target:

```text
acme -l build/labels.txt index.asm
```

This exact assembler action was used, with an owned `build/` directory already
created. Dustlayer is not needed for that direct action. Neither `make all` nor
`make launch` was executed: the launch recipe contains platform-specific
process-killing and background emulator commands. Its cleanup target was not
executed either. Tool execution was a literal argument array, not a command
constructed from upstream text.

All ten assembly files, the Makefile and its referenced paths were inspected
before execution. `index.asm` includes exactly the nine listed code files and
the included SID; output is `build/slither.prg`. No external build dependency
was fetched or run. The installed assembler binary, rather than a downloaded
upstream executable, performed both builds.

| Tool | Identity |
| --- | --- |
| Assembler | `/usr/bin/acme` |
| Banner | ACME release 0.97 ("Zem"), 31 Jan 2021; platform-independent version |
| Assembler SHA-256 | `19485b0605ddae23897d07cde5fd05c7e0c40eea530668db0b86e68e9f45c4f8` |
| Development host | Linux; Node 22.23.1, Yarn 1.22.22 available |
| New worktree dependencies | `yarn install --frozen-lockfile` passes in this checkout; no compiler build/test result is inferred |

## Two-Build Result

Every selected input was copied unchanged into each of two separate owned
directories before assembly. The literal assembler invocation completed
successfully in both. Both artifact comparisons below are byte-identical.

| Artifact | Bytes in each build | SHA-256 in both builds |
| --- | ---: | --- |
| `build/slither.prg` | 48,145 | `94ad1ac90e3ec0c8d0ea5a5e9e0df8411691a337cb01f10d8de2d4d2f70852e2` |
| `build/labels.txt` | 1,271 | `866f8568de5887824efb90601ef40507136022fb8e373e9e4a0e7ecf27599f8a` |

The PRG's two-byte load address is `$0801`. The file length includes the load
address and sparse-placement fill; **48,145 bytes is not an instruction-code
size, live-RAM peak or expert cost result**. No existing upstream PRG was used
as a reference; the pinned upstream `build/` listing contained no ordinary
files. These are two fresh builds, not a claim of matching an independently
published release binary.

## Source-Level Observations Requiring Later Contracts

These are observations of the selected source, not executed game answers or
qualified hardware behavior. Comments are not treated as normative hardware
facts. Any actual machine claim still requires the primary hardware/expert
authority and the exact configured artifact/runtime endpoint.

| Source | Observed implementation | Required follow-up |
| --- | --- | --- |
| `index.asm` | Declares `!cpu 6502`, BASIC `SYS 49152` and code origin `$C000`; includes SID payload at `$1000`, skipping its header and load word. | Bind entry state, ROM/banking, placement and the exact compatible Blend65 profile. |
| `code/main.asm` | Fire starts/restarts the game; movement repeatedly checks/draws a bitmap pixel, runs three busy loops and reads joystick port 2. A prior direction is retained when none is pressed. | Derive exact input priority/sampling, movement cadence, collision and restart answers before port code. Do not silently replace workload-dependent cadence with a frame tick. |
| `code/gfx.asm`, `code/pixel.asm` | Source uses bitmap base `$2000`, screen/color-selection data at `$0400`, a frame and bit-addressed movement. | Recover exact rendered boundaries, coordinate/memory mappings and independent pixel/collision expectations. |
| `code/text.asm` | Copies character-ROM data into RAM at `$4000`, then draws bitmap text from that copy. | Prove entry/banking assumptions and text behavior; distinguish source-visible output from incidental private storage/copy strategy. Do not distribute a captured ROM image. |
| `code/score.asm` | Maintains three decimal-mode BCD bytes and prints six digits. | Establish increment/order/wrap expectations and interrupt/decimal-state obligations independently. |
| `code/irq.asm`, `code/sfx.asm` | Writes CIA interrupt controls and KERNAL IRQ vector `$0314/$0315`; invokes music at `$1000/$1003`; uses direct SID crash effects. | Establish every enabled IRQ/NMI route, handler/firmware state, player footprint, audio/effect ownership and exact ABI. No complete route or finite external-stack claim follows from assembly. |
| `code/main.asm` | The main control graph loops back to game start or movement; no normal return-to-BASIC path was identified in that graph. | Freeze the actual exit/nonreturning contract; do not import M1's return requirement into this different game. |

The included SID header reports `PSID`, version 2, data offset 124, embedded
load address, init `$1000`, play `$1003`, one song starting at song 1, title
`SLITHER`, author field `SidTracker64 v1.0` and released field `2015-10-23`.
These fields describe the supplied bytes; they do not prove player effects,
rights, compatibility, scratch use, interrupt behavior or runtime safety.

## Input Inventory

All sizes are original downloaded bytes. Hashes are SHA-256. URLs are resolved
relative to the pinned source root above, never a mutable branch name.

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `README.md` | 360 | `12826301708ba680a9855bbe1feba1b479e5ac94f5699d27537019eb0319ab2c` |
| `LICENSE` | 1,084 | `fe95a74be2836d9af31fbf0cd624f4fbb17ee67338c7c6b8310e6b821367810e` |
| `Makefile` | 716 | `40449ac0d9e0bde01f1f67992bbe3f1a6eead9769b5aa043af9432880f088e0d` |
| `index.asm` | 684 | `e9d956f90933b2dc0d1a79ddfde99a92405fd1b891dd86d74ae92c78376d93be` |
| `code/zero.asm` | 208 | `411ff8cb50b1f49d752d344182a0a6443c7f5c72b76f5e2b88a69202f0f14881` |
| `code/macro.asm` | 382 | `59bfd8cb041cc218e51d7a49d2dc8bc662c420cb2bd1f4c70f3fef8751e834cd` |
| `code/main.asm` | 2,738 | `51439ff5883ec80ef593889f8f9f344f8f7980d054dd6595bb6c7512d0fe40cd` |
| `code/gfx.asm` | 2,832 | `278b8395defabd20c5d9c5d72b2ff89138473be78cc65def9ac5c35609a7587a` |
| `code/text.asm` | 2,290 | `8058a8f5a1fd1d1d8fee69be7f5b10ff457d94c4632db0b0278bf068ca656013` |
| `code/pixel.asm` | 2,089 | `8324b6bbdc1108239c49c706ffb7f5302d817ae27c091d68897ec96cb66c3fde` |
| `code/score.asm` | 1,328 | `7479cfa58e204a91acb2b69e6f5387d2cac57d5c7824ed76b33829b862cf0298` |
| `code/sfx.asm` | 516 | `d28e3db6c6d7b8ee2947ef62136621c4854c534b623068c31b520d520ec50905` |
| `code/irq.asm` | 672 | `3d0ecb9870b976c404520b783b963e8614a0bb0acac01607f373854532d1a179` |
| `data/slither_r.sid` | 3,343 | `239a2cae4feeca8408381196a33eaa212491b985d746cd9cf86d17773c4c446a` |

## Remaining Gates and Ownership

| Gate | State / owner |
| --- | --- |
| Available pinned source and local original assembly | Verified complete for the fourteen named inputs and two named outputs only. |
| Full rights/dependency assessment | Verified partial: declared repository MIT identified; underlying player/content provenance still needs assessment before retention/distribution or integration. |
| Machine/profile and original runtime | Unknown; this feature must establish them in coordinated VICE work. No emulator window was taken from the other session. |
| Independent behavior and expert expectations | Not authored or qualified; required before dependent skill/port implementation. |
| Required compiler/platform/player availability | Unknown for this game; any gap goes to its existing v4 owner. Bootstrap source is not a qualified compiler release. |
| Formal requirements preflight and implementation plan | Not started. The two authoring reviews of the RD are not a substitute. |
| Port, developer skill and physical hardware proof | Not implemented or claimed. |

Any failed eligibility gate stops the affected work. Replacing Slither, removing
its music, changing its behavior, adding an assembly escape, or introducing a
new support subsystem still requires the relevant explicit user ruling. This
assessment does not authorize any of those changes.

## Assessment Checkpoint Review

Targeted Markdown formatting, all 17 local links across the five feature
documents, the fourteen recorded input hashes, both output hashes/sizes,
whitespace and unchanged frozen-authority status pass primary validation.
The new worktree's locked dependency installation also passes. No compiler
suite or VICE result is claimed.

The independent correctness reviewer reports
**no findings at the supplied-evidence endpoint** for this three-file
documentation checkpoint against
`1022fd52226215a6c77db7c2251be184f4d26b94`. Native permissions denied its direct
access to temporary raw evidence; no retry or permission change was made.
Review instead used the non-secret source/execution excerpts already collected
by the primary, including the complete input hash inventory. The reviewer did
not independently execute tools, inspect binaries or inspect raw build logs.
Historical routing smoke summaries were excluded. This is an ordinary bounded
documentary review, not formal preflight or independent game qualification.
