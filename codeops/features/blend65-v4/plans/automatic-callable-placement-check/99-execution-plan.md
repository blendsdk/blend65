# Automatic callable placement check (#164)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-164 / #164
> **Progress**: 2/4 tasks (50%)
> **Status**: Executing — reference build verified; matching-address build not started
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

Matching-address classification: **Unknown**. T-164.2 produced the disjoint reference artifact
recorded below, not a matching-address or runtime result.
The historical T-30 ruling does not authorize a new waiver.
This investigation is not a bugfix: no implementation or new regression oracle is planned.
Any later repair requires independent specification-first tests and meaningful RED evidence.

## Small chunks

Complete at most one numbered chunk per run, then report the result.

- [x] T-164.1 Define this check, validate the documentation and obtain independent planning review. Verified 2026-11-19: formatting, local links, checklist and exact documentation-only scope pass; independent review reports no findings. No public build or emulator run.
- [x] T-164.2 Build the unrelated-address control and record its exact source, compiler/options/tool identities, diagnostics and final variable interval. Verified 2026-11-19 at `afc1edea`: public API success, no diagnostics; callback `[$0A92,$0A94)`, control disjoint; artifact/document checks pass, bounded documentation review clear and owned cleanup complete.
- [ ] T-164.3 Build the matching-address case; confirm its own final interval and inspect the relevant emitted bytes and call path. If no matching final artifact is obtained, record that limitation rather than claim coverage.
- [ ] T-164.4 Classify the result, use the minimum sequential VICE observation only if needed, obtain applicable independent reviews, record evidence limits and clean owned temporary files. Commit GREEN documentation locally through the git-commit skill; never push.

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
