# Automatic callable placement check (#164)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-164 / #164
> **Progress**: 4/4 tasks (100%)
> **Status**: Done — diagnosis only; confirmed MAJOR #164 remains open for separately planned repair, without waiver
> **Baseline**: `e9a374cf`, clean `feature/v4-rebuild`
> **Scope**: strict; classification only
> **Reasoning**: high — final storage placement and the compiler's known call target must agree
> **Created**: 2026-11-19

## Objective

Determine how the current public compiler handles a constant memory write that coincides with
an automatically placed function-pointer variable before that variable is called.
This is a small C64 compiler-correctness check, not a compiler repair or release approval.

**Planning target:** the [T-32 next check](../current-tree-release-readiness/99-execution-plan.md#next-bounded-task-recommendation).
**Context artifacts:** the referenced analysis, existing public-build examples and current
semantic source below. **Modification set:** this mini-plan and its T-164 roadmap row only.
Temporary source projects and generated output belong under `CODEOPS_TMPDIR`, not the repository.

**Smallest viable design:** use the existing `buildProject` public API and artifact files.
Compare one unrelated-address case with one matching-address case. Do not add a test framework,
dependency, shared helper or compiler change. Run only one small emulator observation if the
final output inspection cannot settle the classification.

## Contract and limits

- Use `c64-pal-prg-kernal-6581`, canonical `optimization: "none"` and ACME 0.97.
  If execution is needed, use the existing VICE 3.10 tools sequentially.
- Use a bare automatically placed `fn(): byte` global assigned a known function.
  Do not give the variable explicit placement or take its storage address in source.
  Taking the function's address for assignment is required and is a different operation.
- Perform the constant word write after assignment and before the call. Keep the same
  declarations, assignment, write width/value and call in both cases; change only the address.
- Establish each final variable interval from that build's own labels and storage evidence.
  An address found in a prior build is only a candidate, never proof of a match.
- Confirm that the unrelated-address control really is disjoint from the function-pointer
  variable and other program-owned storage. If addresses move, recheck before interpreting.
- Record diagnostics or safe relocation separately from accepted matching-address output.
  For accepted matching output, inspect the actual pointer stores, memory write and call path.
  Record whether the write really changes the pointer bytes; coincident addresses alone do
  not establish an outdated call-target assumption or wrong runtime behavior.
- Do not impose a new language rule or assume that rejection is the only valid solution.
  If the language conclusion is unresolved, retain Unknown and report the exact open question.
- Stop at classification. A repair, new restriction or renewed acceptance of risk requires
  separate bounded work and applicable authority. #168 and release qualification stay open.
- Keep source, existing tests, shared helpers, timeouts, ledger, `spec/`, expert authority and
  historical release approval unchanged. No existing oracle-edit exception applies.

## Evidence already inspected

| Evidence | What it establishes |
| --- | --- |
| [`function-targets.ts:172–182`](../../../../../packages/compiler/src/semantic/function-targets.ts) | The semantic absolute-range map includes explicitly placed globals. |
| [`raw-write-kills.ts:499–517`](../../../../../packages/compiler/src/semantic/raw-write-kills.ts) | A constant write is compared with those ranges; this does not prove the final build outcome. |
| [Existing specification cases](../../../../../test/rd04/raw-write-callable-invalidation.spec.test.ts) | Direct-address and explicitly placed cases already have immutable expectations; reuse the public-build pattern, not their address-taking setup. |
| [Existing artifact inspection](../../../../../test/rd04/interprocedural-kill-cost.impl.test.ts) | Public builds and output inspection already have a project pattern. |

Language-level classification: **confirmed stale-target-proof defect**, independently supported
by the T-164.4 semantic and storage reviews below. Runtime behavior remains **Unknown**.
T-164.2 established the disjoint reference; T-164.3 produced the matching-address artifact
recorded below. Neither build is a runtime observation.
The historical T-30 ruling does not authorize a new waiver.
This investigation is not a bugfix: no implementation or new regression oracle is planned.
Any later repair requires independent specification-first tests and meaningful RED evidence.

## Small chunks

Complete at most one numbered chunk per run, then report the result.

- [x] T-164.1 Define this check, validate the documentation and obtain independent planning review. Verified 2026-11-19: formatting, local links, checklist and exact documentation-only scope pass; independent review reports no findings. No public build or emulator run.
- [x] T-164.2 Build the unrelated-address control and record its exact source, compiler/options/tool identities, diagnostics and final variable interval. Verified 2026-11-19 at `afc1edea`: public API success, no diagnostics; callback `[$0A92,$0A94)`, control disjoint; artifact/document checks pass, bounded documentation review clear and owned cleanup complete.
- [x] T-164.3 Build the matching-address case; confirm its own final interval and inspect the relevant emitted bytes and call path. If no matching final artifact is obtained, record that limitation rather than claim coverage. Verified 2026-11-19 at `5b7c4b0b`: accepted with no diagnostics; current interval fully matches, zero stores followed by direct call confirmed; capture/document checks and bounded reviews pass; owned cleanup done.
- [x] T-164.4 Classify the result, use the minimum sequential VICE observation only if needed, obtain applicable independent reviews, record evidence limits and clean owned temporary files. Commit GREEN documentation locally through the git-commit skill; never push. Verified 2026-11-19: confirmed proof defect; user approved separate bounded repair planning without waiver; final correctness review has no findings, documentation/artifact checks pass, no emulator needed and owned scratch cleaned. No compiler implementation authorized.

**Task verify:** for T-164.1, targeted Prettier, local links, checklist/roadmap consistency and
an exact documentation-only diff. For T-164.2–3, successful public-build evidence or exact
diagnostics, final-artifact interval checks, source/artifact hashes and relevant output
inspection. Do not treat either case as a fresh compiler-suite or release checkpoint.

**Verify:** documentation checks plus the recorded two-case classification evidence.
T-164.4 needs base correctness review and relevant semantics, SFA/ABI and emitted-code reviews;
add platform review if runtime or machine-state conclusions are made. No new specialist role:
the existing routing already covers these boundaries. No full compiler suite is required for
this investigation while production source, tests, tools and their configuration stay unchanged.

## Planning review and verification

T-164.1: independent correctness review `ses_e0d24b56effeGd0WSzXhIcP7o5`, Astra/high,
returned **no findings**. It confirmed the small-chunk boundary, final-artifact requirements,
Unknown current outcome and unchanged oracle authority. This was a planning review, not a
compiler or runtime audit. Parent validation passed targeted formatting, local links, the
four-task checklist and the exact two-document scope. Owned validation scratch is removed.
Portfolio synchronization is deferred on `feature/v4-rebuild`, as required off integration.

Later chunk evidence is recorded here, not in a new evidence subsystem.
Preserve exact small source cases and decisive excerpts in this document before deleting
temporary projects; hashes alone cannot recreate deleted evidence. If intermediate artifacts
must survive until the next chunk, name their owned directory and explain why.

Knowledge lineage: expert `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
`references/evidence-parity-and-recovery.md#evidence-boundary-rules`.
This planning chunk makes no new instruction, timing or physical-hardware claim.

## T-164.2 reference-build evidence

Status: **Verified partial**; claim kind: **Fact** for the inspected reference artifact only.
The source below was built once through `buildProject` from `@blend65/compiler`, without a
cache wrapper. Compiler package build (`tsc --build`) passed first. No compiler, test, tool or
configuration source changed. No target execution or complete regression gate ran.

```blend65
module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void {
  callback = &chosen;
  pokew($C100, 0);
  poke($C000, callback());
}
```

Exact manifest: JSON formatted with two-space indentation, fields in the following order,
and one trailing newline. Source has one trailing newline as shown.

```json
{
  "schemaVersion": 1,
  "name": "callable-reference",
  "sourceRoot": "src",
  "entry": "Game",
  "target": "c64-pal-prg-kernal-6581",
  "assetPaths": [],
  "outDir": "out",
  "optimization": "none"
}
```

| Identity / observation | Recorded value |
| --- | --- |
| Compiler Git commit | `afc1edea8a6cdb303a3857daa3ea1782c587f7dc` |
| Chunk baseline tree | `33355d0292fd31541aad25b6dc2c232c34204db3` |
| Public build result | `success`; diagnostics `[]` |
| Generation | `e8f7087f-2b9a-46b6-8fc7-4ded4b406b21` |
| Host | Linux/x64; Node `22.23.1` |
| Target / options | `c64-pal-prg-kernal-6581`, NMOS 6510, PRG; `none`, bounds check false, division-zero check false |
| Assembler | ACME `0.97`; `/usr/bin/acme`; options `--cpu=6502`, `--strict-segments`, `--format=cbm` |
| Source input | `src/game.blend`, 172 bytes; the build also records installed `c64/input.blend`, 16,331 bytes |
| Final callback interval | CPU16 `[$0A92,$0A94)`, two BSS bytes, `global.src/game.blend:13:38`; label address agrees |
| Control-write interval | `[$C100,$C102)`; no intersection with any CPU16 interval, including reservations, in this generation |
| Other allocated storage | Startup state `[$0A94,$0AC5)`; SFA `[$0AC5,$0AC7)` and `[$0AC7,$0AC8)` |
| PRG extent | 659 file bytes: two-byte load address `$0801` plus 657 payload bytes ending at exclusive `$0A92`; callback is BSS, not file payload |
| Reported costs | 645 `code` + 12 `startup`; resident RAM 711; ZP 0; scratch 0; three SFA bytes |
| Memory-report limit | `acmeReconciled: true`, but `runtimeMemorySafety: "unproven"` |

The memory report retains the external NMI aggregate-stack, retained-firmware-completion and
finite-deadline unknowns. This control does not resolve those or qualify runtime behavior.
The source intentionally has neither explicit variable placement nor `&callback`.

### Decisive output excerpts

The callback label is
`b65_Game_callback_676c6f62616c2e7372632f67616d652e626c656e643a31333a3338 = $0A92`.
Its encoded identity decodes to the memory record's `global.src/game.blend:13:38`.
`Game.main` occupies `[$0953,$0976)`; `Game.chosen` occupies `[$0976,$0979)`.

The final PRG bytes for `Game.main`, in address order, are:

```text
a9 76 8d 92 0a a9 09 8d 93 0a a9 00 8d 00 c1 a9 00 8d 01 c1
20 76 09 8d c7 0a ad c7 0a 8d 00 c0 4c 79 09
```

These encode the `$0976` callback assignment, zero stores to `$C100` and `$C101`,
direct `JSR $0976`, result staging at `$0AC7`, output at `$C000`, and a jump to restore
at `$0979`. The chosen routine's bytes are `a9 25 60` (`LDA #$25; RTS`).
This is an inspected code path, not an observed execution or a whole-program timing claim.

### SHA-256 identities and validation

| Input / artifact | SHA-256 |
| --- | --- |
| Source | `0cf2182bb0160192388a1cc86e0b818501dbc37852ccbba02f32945fe17b0b32` |
| Manifest | `c0ad37db06844b8c4173eeb83e023067d4c6ba7d9896c4aa9bb87cda8e333eee` |
| Compiler identity reported by build | `58c3d257272c0520e731c4f0b4b7b3f9271c8fdaaf238225d5d6e184dfbcd11e` |
| Specification identity reported by build | `7dcd4998f84d5d6099946f673ce426e314046fb32f5ab8edea7d606d2bd1c651` |
| Expert identity reported by build | `1a2039ffb5d887e8ca221b21dd2d022fd6d06ec375771a413c01cd8c7e252f30` |
| Installed input-library source reported by build | `e79f6b62297eca4b7b415842479d4f80e8d54ebd88344b405c3558276a58b5ea` |
| ACME executable, independently hashed | `19485b0605ddae23897d07cde5fd05c7e0c40eea530668db0b86e68e9f45c4f8` |
| PRG | `a4364e5135963aeb192abfb88cb6c320d3c54c0a32126ec5299b6c93d2b0a717` |
| `.build.json` | `de955f2f8f80c87722ada9f305910070126dfd28ae1a8d7f725e59f5e518ee91` |
| `.memory.json` | `a06c7c825a88fa8b8177d5c5cf0b139c86c20e604ac3bc3f5b2886da6ca747f3` |
| `.labels` | `0ceb733cb73033f6269651c3a0286241221b9538d90b94752816b53e9fcd46be` |
| `.asm` | `50cf1042909a58d4e8ecc330683713dfa4a16e49a6d0b5c1b1d9f1f8117bfb6b` |
| `.costs.json` | `a29912ea21ae8bfb0f143dfcdf4909cb1a5261ecbe6fd03210282694e69d7062` |

The build's content identities are recorded as supplied, not equated with Git commit hashes
or the qualified expert-content commit. A local artifact check independently authenticated
every artifact listed by `.build.json`, plus that sidecar's returned digest, source/manifest,
ACME executable, label/storage identity, disjoint interval and exact selected PRG bytes: PASS.

Prior work was pushed through `afc1edea` before this chunk, as explicitly requested.
Independent correctness review `ses_e0cff95c7ffeavo47h19bwddRl`, Astra/high, reported
**no findings** in the documentation diff and parent-reported results. Its native permissions
denied temporary-file access; no alternate access was attempted. The review continued only
on permitted repository documentation and the supplied diff. It did not independently
authenticate raw files or obtain a tool-level diff; artifact checks remain execution-owner
evidence. Specialist classification reviews remain assigned to T-164.4.

The owned temporary reference project, output and diagnostic scripts have been removed.
Exact source, manifest, decisive interval/byte excerpts and hashes above remain; the deleted
raw generation cannot now be reauthenticated. No temporary artifacts are retained.
Documentation formatting, local links, source/manifest digest reproduction from durable
excerpts, checklist, exact two-file diff and unchanged product/frozen inputs all pass.
The progress helper's known lightweight-plan exit limitation is recorded in the
[assessment verification](../current-tree-release-readiness/99-execution-plan.md#verification-and-cleanup);
independent four-task arithmetic remains the checklist check.
The later matching-address build must establish its own final interval; `$0A92` is only a
candidate address for that next build.

Additional knowledge references: `c64-memory-and-runtime.md#cpu-address-view`,
`mos-6502-family.md#official-nmos-instruction-and-addressing-grid`, and
`6502-lowering-casebook.md#calls-returns-abi-and-helpers`.
Source keys: `CBM-C64-PRG-1982`, `MOS-PGM-1976` and `MOS-6510-1982`.
No runtime, hardware or expert-parity claim is made.

## T-164.3 matching-address evidence

Status: **Verified partial**; claim kind: **Fact** for this artifact inspection.
One public `buildProject` call succeeded with diagnostics `[]` after the compiler package build
passed. The source differs from the reference by only `pokew($C100, 0)` becoming
`pokew($0A92, 0)`; declarations, write width/value, assignment and call are unchanged:

```blend65
module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void {
  callback = &chosen;
  pokew($0A92, 0);
  poke($C000, callback());
}
```

The manifest is byte-identical to the reference, including project name. Host, target,
options, assembler executable/options and reported compiler/specification/expert identities
also match the reference. The compiler Git commit is now
`5b7c4b0b7debdaf39075de94b78ad709bf95655a`; the chunk baseline tree is
`6c886d3ffd3dc69653efb03cd9c90f05c4aec053`. Only documentation changed since the reference commit.

| Observation | Current generation |
| --- | --- |
| Generation | `3be825da-9c79-4cd0-80bc-d5ac9d8c962b` |
| Callback identity | `global.src/game.blend:13:38`, mutable CPU16 BSS |
| Independently checked final interval | `[$0A92,$0A94)`, two bytes; this generation's label and memory record agree |
| Constant-write interval | `[$0A92,$0A94)`; exactly matches the callback, not another CPU16 interval |
| Main / chosen intervals | `[$0953,$0976)` / `[$0976,$0979)` |
| File / code / storage costs | Unchanged: 659 PRG bytes, 645 `code` + 12 `startup`, resident RAM 711, three SFA bytes, ZP 0, scratch 0 |
| Memory-report limits | Same report bytes as reference: reconciled, runtime safety unproven; external NMI limitations unchanged |
| Runtime / release claim | None; no emulator, hardware, complete regression gate or installed-package qualification |

### Selected emitted bytes

The current PRG's 35 main-routine bytes are:

```text
a9 76 8d 92 0a a9 09 8d 93 0a a9 00 8d 92 0a a9 00 8d 93 0a
20 76 09 8d c7 0a ad c7 0a 8d 00 c0 4c 79 09
```

These encode the `$0976` pointer assignment, then zero stores to both `$0A92` and `$0A93`,
then direct `JSR $0976`. Thus the instructions would replace the assigned pointer value
`$0976` with `$0000` before a direct call to the original function. This is a decoded
instruction sequence, not a claim that the target program was executed.
The chosen routine remains `a9 25 60`. No relocation or diagnostic prevented this artifact.
The source-language verdict, independent contract review and any necessary runtime observation
remain T-164.4; this chunk authorizes no repair or risk acceptance.

### Identity and checks

| Input / artifact | SHA-256 |
| --- | --- |
| Source, 172 bytes | `0e487178b4359e4d302a0a5a9eb85b04c8fad4c695670ec9319707c96c303af3` |
| PRG | `49f6fa84584958cfea1a109b7ee95b8b550d8d04fb3a5326b1c632998c33fdb5` |
| `.build.json` | `1e90ac52a754951549f841da3f54b6e62d854d5ebc1aba91a0f0880bb7d821eb` |
| `.asm` | `9269f058d34a6a471b9fc3a522851061381abbe1996abe9d06e4ba39bf883f5d` |

Manifest, labels, memory and cost-file hashes equal their T-164.2 values. The execution owner
authenticated all generation-listed artifact digests, returned build digest, exact one-address
source change, unchanged manifest/compiler/options, ACME executable, current callback label and
storage interval, and exact main/chosen bytes: PASS.
Changing only the four write-address operand bytes back to the control values reproduces the
recorded reference PRG hash. This is a byte-identity check, not a behavior oracle.

### Complete matching PRG bytes

The following 659-byte capture includes the two-byte load address. It preserves the actual
artifact for later digest verification without retaining a temporary project or inventing
new compiler output. Reconstruction must verify the recorded SHA-256 before any use.

```text
01 08 0b 08 0a 00 9e 32 30 36 31 00 00 00 8d 94 0a 8e 95 0a 8c 96 0a 08 68 8d 97 0a ba 8e 98 0a
d8 a6 00 8e 99 0a a4 01 8c 9a 0a ad 18 d0 8d 9c 0a ad 15 d0 8d 9d 0a ad 10 d0 8d 9e 0a ad 17 d0
8d 9f 0a ad 1b d0 8d a0 0a ad 1c d0 8d a1 0a ad 1d d0 8d a2 0a ad 20 d0 8d a3 0a ad 21 d0 8d a4
0a ad 00 d0 8d a5 0a ad 01 d0 8d a6 0a ad 02 d0 8d a7 0a ad 03 d0 8d a8 0a ad 04 d0 8d a9 0a ad
05 d0 8d aa 0a ad 06 d0 8d ab 0a ad 07 d0 8d ac 0a ad 08 d0 8d ad 0a ad 09 d0 8d ae 0a ad 0a d0
8d af 0a ad 0b d0 8d b0 0a ad 0c d0 8d b1 0a ad 0d d0 8d b2 0a ad 0e d0 8d b3 0a ad 0f d0 8d b4
0a ad 27 d0 8d b5 0a ad 28 d0 8d b6 0a ad 29 d0 8d b7 0a ad 2a d0 8d b8 0a ad 2b d0 8d b9 0a ad
2c d0 8d ba 0a ad 2d d0 8d bb 0a ad 2e d0 8d bc 0a ad f8 07 8d bd 0a ad f9 07 8d be 0a ad fa 07
8d bf 0a ad fb 07 8d c0 0a ad fc 07 8d c1 0a ad fd 07 8d c2 0a ad fe 07 8d c3 0a ad ff 07 8d c4
0a 98 29 f8 09 06 85 01 8a 09 07 85 00 ad 02 dd 8d 9b 0a 29 fc 8d 02 dd a9 14 8d 18 d0 a9 00 8d
15 d0 8d 17 d0 8d 1b d0 8d 1c d0 8d 1d d0 8d 20 d0 8d 21 d0 a9 76 8d 92 0a a9 09 8d 93 0a a9 00
8d 92 0a a9 00 8d 93 0a 20 76 09 8d c7 0a ad c7 0a 8d 00 c0 4c 79 09 a9 25 60 ad 9c 0a 8d 18 d0
ad 9d 0a 8d 15 d0 ad 9e 0a 8d 10 d0 ad 9f 0a 8d 17 d0 ad a0 0a 8d 1b d0 ad a1 0a 8d 1c d0 ad a2
0a 8d 1d d0 ad a3 0a 8d 20 d0 ad a4 0a 8d 21 d0 ad a5 0a 8d 00 d0 ad a6 0a 8d 01 d0 ad a7 0a 8d
02 d0 ad a8 0a 8d 03 d0 ad a9 0a 8d 04 d0 ad aa 0a 8d 05 d0 ad ab 0a 8d 06 d0 ad ac 0a 8d 07 d0
ad ad 0a 8d 08 d0 ad ae 0a 8d 09 d0 ad af 0a 8d 0a d0 ad b0 0a 8d 0b d0 ad b1 0a 8d 0c d0 ad b2
0a 8d 0d d0 ad b3 0a 8d 0e d0 ad b4 0a 8d 0f d0 ad b5 0a 8d 27 d0 ad b6 0a 8d 28 d0 ad b7 0a 8d
29 d0 ad b8 0a 8d 2a d0 ad b9 0a 8d 2b d0 ad ba 0a 8d 2c d0 ad bb 0a 8d 2d d0 ad bc 0a 8d 2e d0
ad bd 0a 8d f8 07 ad be 0a 8d f9 07 ad bf 0a 8d fa 07 ad c0 0a 8d fb 07 ad c1 0a 8d fc 07 ad c2
0a 8d fd 07 ad c3 0a 8d fe 07 ad c4 0a 8d ff 07 ad 9b 0a 8d 02 dd ad 9a 0a 85 01 ad 99 0a 85 00
ae 98 0a 9a ad 97 0a 48 ad 94 0a ae 95 0a ac 96 0a 28 60
```

Correctness review `ses_e0cf473a7ffeISdF5j9iTHVP8P`, Astra/high, returned **no findings**
within the documentation/evidence scope. It inspected permitted repository documents and
parent-reported verification, not raw temporary files or a tool-level diff.
Machine-byte review `ses_e0cf473a1ffe24pswNVP2oo8j7`, Astra/xhigh, returned **no findings**
in decoding and extent arithmetic. It independently confirmed the assignment, both zero stores,
direct call, 35-byte main, three-byte chosen routine and 659-byte capture extent. Its proof
ends at the supplied textual bytes; raw-file/digest and label/storage authentication remain
execution-owner evidence. Neither review determines language legality or runtime behavior.

Durable-capture checks passed: exact source change, complete 659-byte capture equality to the
generated PRG and its recorded digest, and the four-operand-byte reconstruction hash.
The owned matching project, generated files and scripts have been removed. The complete PRG
capture remains digest-verifiable above; raw sidecars are no longer available for reauthentication.
Documentation formatting, local links, durable source/PRG digests, exact two-file scope,
checklist arithmetic and unchanged product/frozen inputs pass. No unrelated task advanced.
No compiler, existing test, oracle, shared helper, timeout, specification, expert authority,
historical release record or release approval changed. No emulator or push was performed.

## T-164.4 classification and finding gate

Classification baseline: `8ae6ed896fd2144bc4399d763ab48b62d0c7d221`, clean tree
`9de03b81ab6ea8d23a075a364b3d905c4c8a9d4a`.
Both durable source digests, the complete matching PRG digest and the reconstructed reference
PRG digest were checked again: PASS. The product tree has not changed since the recorded public
build. No new compiler build, emulator observation or full regression gate ran in this chunk.

### Confirmed condition

The accepted matching artifact retains a source-function singleton that is no longer supported
by its materialized storage. It assigns `$0976`, writes `$0000` over that same two-byte global,
then emits direct `JSR $0976`. The disjoint control does not have this overlap.
This establishes an **incorrect finite-target proof**, not an observed runtime result.

Governing normative requirements:

- [Function representation](../../../../../spec/02-type-system.md#23-function-types):
  materialized function values occupy one target address word; their target sets are proof
  information, not runtime tags.
- [Call evaluation and finite proof](../../../../../spec/06-functions.md#43-finite-target-proof):
  the function-value target is evaluated before arguments; a direct call requires a valid
  singleton, and a call without a finite proved source set is rejected.
- [Memory-access effects](../../../../../spec/12-intrinsics.md#31-memory-access):
  the little-endian word write occurs in source order before the call.

If this overlapping layout is retained without a valid replacement proof, E10277 applies.
The compiler must not instead call `$0000`, add a hidden null-call runtime, globally forbid
memory writes, or require explicit source placement/address-taking. A safe automatic placement
could avoid this overlap, so this diagnosis does not prescribe rejection for every layout.
The non-normative F018 example corroborates intent but is not used to override the chapters.
Historical T-30 AR-P1 is batch risk acceptance, not a language waiver or new approval.

### Ownership and cause

The missing fact is the final association between `global.src/game.blend:13:38` and
`[$0A92,$0A94)`. The semantic placement map includes only explicitly placed objects; the
constant-write path therefore does not invalidate this automatic global's target fact.
The singleton is consumed by call lowering before automatic BSS placement.

| Boundary | Inspected source |
| --- | --- |
| Incomplete absolute-range map | [`function-targets.ts:172–182`](../../../../../packages/compiler/src/semantic/function-targets.ts) |
| Constant write compared with that map | [`raw-write-kills.ts:499–517`](../../../../../packages/compiler/src/semantic/raw-write-kills.ts) |
| Final target publication | [`function-targets.ts:689,706,728–737`](../../../../../packages/compiler/src/semantic/function-targets.ts) |
| Target consumer / singleton lowering | [`lower-function.ts:649–658`](../../../../../packages/compiler/src/machine/lower-function.ts) and [`lower-indirect.ts:47–55`](../../../../../packages/compiler/src/machine/lower-indirect.ts) |
| Later automatic BSS placement | [`c64-layout.ts:820–859`](../../../../../packages/compiler/src/layout/c64-layout.ts) |
| Function-storage reclosure, not global-target revalidation | [`shared-storage.ts:231–270`](../../../../../packages/compiler/src/services/shared-storage.ts) |

The callback is a **global/platform-layout object**, not an SFA home. Neither zero store reaches
startup state or the three SFA bytes. This witness does not demonstrate invalid frame sharing,
nor does function-storage reclosure prove that the overwritten global still names the old target.

### Independent reviews and ruling

| Review | Result and evidence boundary |
| --- | --- |
| Semantics `ses_e0cebdf5bffeegyfe69KrX7JTD`, Astra/xhigh | SM-001 MAJOR in the pre-existing compiler: finite-target proof fails; no product-owned ambiguity prevents this bounded conclusion. Semantic preservation and silent diagnostic acceptance fail; ordinary source forms must remain usable. No finding in the diagnostic design/evidence packet. |
| Storage `ses_e0cebdf53ffeo3QJ7NxlFIqNqU`, Astra/xhigh | SF-001 MAJOR in the pre-existing compiler: missing final-placement premise, not invalid SFA overlay. Independently traced the named producer/consumer sources. No finding in the diagnostic storage-review scope; final closeout diff not yet reviewed. |
| Emitted bytes `ses_e0cf473a1ffe24pswNVP2oo8j7` | Existing T-164.3 review applies to the unchanged captured bytes; decoding and extents have no findings. This is not a new runtime or digest-authentication review. |

SM-001 and SF-001 describe the same #164 proof invariant and are merged below; they are not two
independent product defects. These reviews used permitted repository evidence and parent-supplied
qualified expert excerpts. The storage reviewer excluded accidentally exposed historical routing
smoke-check summaries from its assessment. Neither reviewer authenticated deleted raw sidecars.

| Finding | Severity | Owner | Ruling |
| --- | --- | --- | --- |
| SM-001 / SF-001: final global placement and callable target fact disagree | MAJOR | Existing issue #164; separate bounded corrective plan required | User approved fix through a separate bounded plan on 2026-11-19; no waiver, completed repair, issue closure or release approval |

**User ruling (2026-11-19):** the user answered “yes” to recording the confirmed defect without
accepting it as safe, completing diagnostic closeout, and creating a separate bounded repair plan.
That plan must reconcile final placement with target validity and preserve the disjoint control.
No repair design, new analysis framework or broad source restriction is selected here.
This ruling resumes diagnostic closeout and authorizes repair planning, not implementation.
It neither resolves the product defect nor permits accepting its output as safe.

### Why no emulator run

VICE cannot decide the language rule or validate a stale source-target proof. The actual compiled
stores, complete matching interval and direct-call bytes already settle this classification.
An emulator could add a bounded runtime observation, but it is not necessary for this proof
finding. No current witness is presented as VICE-verified or hardware-verified.

Runtime effects, physical hardware, general interrupt/stack guarantees and whole-program safety
remain Unknown. The memory report's existing unproven boundaries remain unchanged.
Issue #164 is **not fixed or closed**; #168 and current-tree release qualification remain open.
Final correctness review `ses_e0ce27de3ffebffk8UpwoWc3XZ`, Astra/high, returned **no findings**
in the bounded diagnostic closeout. It checked the recorded user ruling, merged unresolved product
finding, classification/repair distinction, unchanged oracle authority and explicit evidence limits.
It inspected permitted repository documentation and supplied verification results, not raw artifacts
or a tool-level diff. No security/host-performance audit applies to this documentation-only diff.

The four-task diagnostic checklist is complete. Targeted formatting, links, exact document scope,
unchanged product/frozen inputs and preserved capture digest checks pass; owned validation scratch
is cleaned. The local diagnostic checkpoint records this closeout. No temporary artifacts are
retained and no push is authorized. The product MAJOR finding remains open for the separately
authorized repair plan; completing this investigation is not completing its fix.
