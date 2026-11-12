# Blend65 v4 Production Qualification

> **Status**: Production candidate approved — `VICE-verified / hardware-unverified`
> **Candidate code tree**: `bb10e0d1` (final complete boundary; one stale docs oracle corrected)
> **Created**: 2026-11-11
> **Owning RD**: [RD-10](../../codeops/features/blend65-v4/requirements/RD-10-production-qualification-and-c64u-handoff.md)

This record is the single release closeout index. It links and hashes existing evidence; it is not
a readiness product, score, or second evidence database.

## 1. Candidate identity

| Fact | Value |
| ---- | ----- |
| Candidate code commit | `bb10e0d116d19a1d96f169a09d14f02ff0daa0f8` |
| Working tree at freeze | clean at `bb10e0d1`; later commits add documentation and test-evidence support only |
| Compiler version | `0.1.0` |
| Specification corpus | 45 files; `BLEND65-SPEC-4-2ea3decf9362644b657e9d20ffeadb318028615958263147e579bfeeb5aada0e` |
| Normative specification identity | `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b` (18 normative files) |
| Expert skill | `2.0.4`; content commit `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15` |
| Node | `v22.23.1` |
| TypeScript | `7.0.2` |
| Yarn | `1.22.22` |
| Turbo | `2.9.16` |
| Vitest | `2.1.9` |
| ACME | 0.97 (`/usr/bin/acme`, SHA-256 `19485b0605ddae23897d07cde5fd05c7e0c40eea530668db0b86e68e9f45c4f8`) |
| VICE | 3.10 `x64sc` (`/home/gevik/.local/bin/x64sc`, SHA-256 `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`) |
| VICE KERNAL | `kernal-901227-03.bin`, 8192 bytes, SHA-256 `83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721` |
| VICE BASIC | `basic-901226-01.bin`, 8192 bytes, SHA-256 `89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d` |
| VICE CHARGEN | `chargen-901225-01.bin`, 4096 bytes, SHA-256 `fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420` |

A later product-code change invalidates the intersecting evidence. Evidence-only edits do not
change the candidate code tree.

## 2. Prerequisite closeouts

| RD | Requirement | Closeout | Status |
| -- | ----------- | -------- | ------ |
| RD-01 | [Requirements](../../codeops/features/blend65-v4/requirements/RD-01-specification-4-and-expert-authority-freeze.md) | [Closeout](../../codeops/features/blend65-v4/plans/rd-01-specification-4-and-expert-authority-freeze/08-closeout.md) | Done |
| RD-02 | [Requirements](../../codeops/features/blend65-v4/requirements/RD-02-clean-v4-foundation-and-deterministic-project-model.md) | [Closeout](../../codeops/features/blend65-v4/plans/rd-02-clean-v4-foundation-and-deterministic-project-model/08-closeout.md) | Done |
| RD-03 | [Requirements](../../codeops/features/blend65-v4/requirements/RD-03-playable-m1-complete-pipeline.md) | [Closeout](../../codeops/features/blend65-v4/plans/rd-03-pipeline-completion/08-closeout.md) | Done |
| RD-04 | [Requirements](../../codeops/features/blend65-v4/requirements/RD-04-complete-language-correct-unoptimized-compiler.md) | [Closeout](../../codeops/features/blend65-v4/plans/rd-04-language-completion/08-closeout.md) | Done |
| RD-05 | [Requirements](../../codeops/features/blend65-v4/requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md) | [Plan index](../../codeops/features/blend65-v4/plans/rd-05-c64-platform/00-index.md) | Done |
| RD-06 | [Requirements](../../codeops/features/blend65-v4/requirements/RD-06-native-assets-compile-time-composition-and-resident-layout.md) | [Closeout](../../codeops/features/blend65-v4/plans/rd-06-native-assets/09-closeout.md) | Done |
| RD-07 | [Requirements](../../codeops/features/blend65-v4/requirements/RD-07-loadable-assets-and-d64-delivery.md) | [Closeout](../../codeops/features/blend65-v4/plans/rd-07-loadable-assets-and-d64-delivery/09-closeout.md) | Done |
| RD-08 | [Requirements](../../codeops/features/blend65-v4/requirements/RD-08-optimization-and-expert-output.md) | [Plan index](../../codeops/features/blend65-v4/plans/rd-08-optimizer/00-index.md) | Done |
| RD-09 | [Requirements](../../codeops/features/blend65-v4/requirements/RD-09-developer-tooling-and-debug-evidence.md) | [Closeout](../../codeops/features/blend65-v4/plans/rd-09-developer-tooling/09-closeout.md) | Done |

No unresolved critical or major finding remains open from the prerequisite closeouts.

## 3. Host matrix

| Host | Status | Evidence |
| ---- | ------ | -------- |
| `linux/x64` | Install/build/typecheck, test boundary, and installed public path pass | `yarn install --frozen-lockfile`, `yarn build --force`, `yarn typecheck --force`, compiler/root suites, package suites, and clean-prefix tarball install (2026-11-11) |
| `win32/x64` | Unknown unless a native host is available | — |
| `darwin/arm64` | Unknown unless a native host is available | — |
| `darwin/x64` | Unknown unless a native host is available | — |

Linux ARM64 and Windows ARM64 are best-effort. Hosts below Node 22, 32-bit hosts, and unknown
architectures are unsupported.

### Test boundary

The compiler row is the final `bb10e0d1` run. The root row is the completed `bb10e0d1` run.

| Suite | Result |
| ----- | ------ |
| Compiler package | 218 files, 3,683 passed, 2 skipped |
| Root release suite | 325 files, 324 passed, 1 failed, 1 skipped; 6,570 passed, 1 failed, 4 skipped |
| CLI package | 11 files, 73 passed |
| Language server package | 5 files, 21 passed |
| VS Code package | 5 files, 18 passed |
| Root typecheck | 7 Turbo tasks successful |

The one root failure was the stale foundation README-status assertion. The README now states the production-qualified surface, the oracle was amended to assert that status, and the foundation test passed 12/12. No VICE retry was needed in the final run.

No skip contributed a pass. The earlier load-sensitive VICE retries remain recorded in the device matrix.

### Installed public path

The three public packages were packed and installed into a clean temporary prefix outside the
repository. The install resolved nine packages, including the declared `jsonc-parser` dependency.

| Artifact | Bytes | SHA-256 |
| -------- | ----- | ------- |
| `blend65-compiler-0.1.0.tgz` | 1,534,117 | `40a1382a41d0d9b1add954115bdfcdf047053628d15999e873b235599c36fd05` |
| `blend65-cli-0.1.0.tgz` | 19,533 | `f655f4b0cdae842acf783ecc1f7c8f19ef42459fdb94428056bc062cbd6b0d2d` |
| `blend65-language-server-0.1.0.tgz` | 23,982 | `366d382ed837086885662ad7578a261daa3c5b56fd1a032406b035d10bf7094d` |

| Check | Result |
| ----- | ------ |
| Tarball contents | Only `dist`, `stdlib`, and `package.json`; no source tree |
| Installed `blendc --version` | `blendc 0.1.0` |
| Installed `blendc check` | Success on `c64-pal-prg-kernal-6581` |
| Installed `blendc build` | Success; `.build.json` records `/usr/bin/acme` with SHA-256 `19485b06…` |
| Installed `blendc run` | Fresh build, VICE launch, `SIGTERM` cancellation exit 130, no `x64sc` residue |
| Installed compiler root export | Resolves inside the prefix; `checkProject` succeeds |
| Installed `frontend` export | Resolves inside the prefix; no backend exports; private imports rejected |
| Installed language server | Initialize, diagnostics, 92 completion labels, hover, one format edit, one error diagnostic |
| Tools-file precedence | Explicit path wins with an empty `PATH`; invalid explicit path fails without fallback |
| Missing tools | `check` succeeds with no tools; `build` fails `ACME_DISCOVERY`; `run` fails `VICE_DISCOVERY` |
| Exact ACME line | `This is ACME, release 0.97 ("Zem"), 31 Jan 2021` |

The installed `run` path is recorded as a launch plus owned cancellation. Interactive completion
remains `interactive-unverified`, matching the CLI's own run status.

### Qualification-blocking fixes

| Finding | Effect | Fix |
| ------- | ------ | --- |
| CLI returned `json: false` in every parsed argument object | Exact RD-08 argument-shape oracles failed | Omit the flag unless `--json` is present (`a00b8407`) |
| Foundation oracle rejected the required VS Code `Run in VICE` title | RD-02 and RD-09 oracles contradicted; CI red | Foundation oracle allows the product name; toolchain checks remain (AR-15, `a00b8407`) |
| Publication applied a 1 MiB metadata cap to every artifact | A valid 38,440-instruction build failed on its 9.6 MiB `.debug.json` | Metadata records stay at 1 MiB; generation artifacts allow 64 MiB (`c6cc63b3`) |
| RD-09 R9.5 tools-file discovery was missing | The CLI and services used `PATH` only, so R10.13 could not be proven | Added schema-1 `tools.jsonc`, explicit ACME/VICE paths, relative `PATH` resolution, exact probes, and tests (AR-16/AR-17) |
| Four takeover profiles were not executable at the original `bb10e0d1` approval | RD-10's eight-profile matrix could not be claimed at that candidate | Resolved after approval under `V4-TAKEOVER-1`: all four IDs now build and pass sequential VICE; the original approval remains historical and the new rows are bounded as recorded in section 13 |
| D64 opt-in suite referenced missing and longer images that it never generated | Two of four runtime cases could not start VICE | Added reproducible variant generation in `test/rd07/d64-runtime-fixture.ts`; 4/4 pass |
| Publication metadata bound was not applied to `.build.json` and cleanup reads | An untrusted `out/` tree could force much larger reads | `.build.json` uses the 1 MiB record bound; cleanup checks the size; escaping VS Code `assetPaths` are rejected (SA-001/SA-002) |

## 4. Profile and artifact matrix

Nine manifest profile IDs are recognized. All nine are executable after the takeover update: the
four KERNAL resident profiles, the four raw-takeover resident profiles, and one D64. The takeover
rows were added after the original `bb10e0d1` approval under `V4-TAKEOVER-1`; their bounded status is
the same `VICE-verified / hardware-unverified`. The takeover artifact hashes below are for the
qualified runtime-fixture source, not the smaller empty-program smoke build.

```text
c64-pal-prg-kernal-6581
c64-pal-prg-kernal-8580
c64-ntsc-prg-kernal-6581
c64-ntsc-prg-kernal-8580
c64-pal-prg-takeover-6581
c64-pal-prg-takeover-8580
c64-ntsc-prg-takeover-6581
c64-ntsc-prg-takeover-8580
c64-pal-d64-kernal-6581
```

| Profile | Build/package | VICE observation | Status |
| ------- | ------------- | ---------------- | ------ |
| `c64-pal-prg-kernal-6581` | Pass; PRG SHA-256 `3d2c602280c9ae74d66d1489af7562a44481634275fb108becafb1b6ea8d1541` | Pass: VIC-II 6569, SID 6581, KERNAL rev 3, caller return `$E147` | `VICE-verified / hardware-unverified` |
| `c64-pal-prg-kernal-8580` | Pass; PRG SHA-256 `f9f4557be9b15f9c9408c016dbdafe260fd80f33b4db50267406d82390a0f279` | Pass: VIC-II 6569, SID 8580, KERNAL rev 3, caller return `$E147` | `VICE-verified / hardware-unverified` |
| `c64-ntsc-prg-kernal-6581` | Pass; PRG SHA-256 `70b021355770fb462b1c8fdf34f1ec2bafa89fbbd4684cb702a81fa1d1d1a78b` | Pass: VIC-II 6567, SID 6581, KERNAL rev 3, caller return `$E147` | `VICE-verified / hardware-unverified` |
| `c64-ntsc-prg-kernal-8580` | Pass; PRG SHA-256 `273dfee5e30210447ea97b07b82c7260f769a8e547ff2b6dbc6f5176b3c7f4a1` | Pass: VIC-II 6567, SID 8580, KERNAL rev 3, caller return `$E147` | `VICE-verified / hardware-unverified` |
| `c64-pal-prg-takeover-6581` | Pass; PRG SHA-256 `70cb56efc9e424086d241f4a85b805c9f93af155727dae27e0f74d4959a539ed` | Pass: VIC-II 6569, SID 6581, raw IRQ/NMI vectors, `$05` mapping, default IRQ and NMI entries, caller return `$E147` | `VICE-verified / hardware-unverified` |
| `c64-pal-prg-takeover-8580` | Pass; PRG SHA-256 `a6e10a359a45c07905bbb2783c5a71d84a85cecc242f1998d9f2e8bc465d2982` | Pass: VIC-II 6569, SID 8580, raw IRQ/NMI vectors, `$05` mapping, default IRQ and NMI entries, caller return `$E147` | `VICE-verified / hardware-unverified` |
| `c64-ntsc-prg-takeover-6581` | Pass; PRG SHA-256 `1ddb14d8d0b336bee15eb9d2601ab35e44960d28b26a0719be38f983aa6133c9` | Pass: VIC-II 6567, SID 6581, raw IRQ/NMI vectors, `$05` mapping, default IRQ and NMI entries, caller return `$E147` | `VICE-verified / hardware-unverified` |
| `c64-ntsc-prg-takeover-8580` | Pass; PRG SHA-256 `4e554f61405114f10f80db866758e7a6f04dbc3b1e3dc0442c823703ba894743` | Pass: VIC-II 6567, SID 8580, raw IRQ/NMI vectors, `$05` mapping, default IRQ and NMI entries, caller return `$E147` | `VICE-verified / hardware-unverified` |
| `c64-pal-d64-kernal-6581` | Pass; 174,848-byte D64, SHA-256 `29f7e22559979cd1242bf81609f2027b7b378b09435c495280228a2ed99bbd0f` | Pass: success+canary, missing-unit false, longer-overwrite false, fresh BASIC `READY.` after screen clear | `VICE-verified / hardware-unverified` |

Artifact inventory: exactly one literal-name primary PRG or D64 plus `.asm`, `.labels`,
`.assets.json`, `.memory.json`, `.costs.json`, `.debug.json`, and `.build.json`. `.build.json`
hashes every other artifact and not itself.

## 5. Language, assets, optimizer, and engine boundary

| Area | Evidence | Status |
| ---- | -------- | ------ |
| Complete language | 397 normative keys (106 grammar, 102 semantic, 184 diagnostic, 5 conformance); 379 core plus 18 owned by RD-05/06/07; live key validator passes; compiler suite 3,683 passed | Pass |
| Native assets | SpritePad 3.80 SPD v5, PSID v1–v4, Koala, Q-P15, raw fixtures, and CharPad 3.80 CTM v9 pass; CharPad 3.88 producer is unavailable | Pass with disclosed producer gap |
| Optimizer | Four modes wired; saved 709/725 payload, acquisition 943/963; `none` remains 2,163 bytes; parity debt is linked to open issues | Pass with linked debt |
| Compiler-not-engine | Public packages are compiler, CLI, language server, and VS Code only; no renderer, mixer, entity, scene, scheduler, or game-loop module | Pass |

The complete-language ledger covers every named key with no unowned row. The non-normative
`test/rd04/normative-coverage.json` record and its validator are pinned to the active normative
identity `BLEND65-SPEC-4-038b70e9…`; the 397-key extraction passes against the live `spec/` tree.
The 18 rows marked `rd-05`, `rd-06`, or `rd-07` are proved by those closed owners; they are not
gaps. Two expressiveness items are explicitly deferred: `v4-multi-screen-sprite-pointer` (`E10273`,
`T-27`/issue #140) and the remaining NMI source-read forms in
`v4-nmi-retained-source-reads` (`E10245`, issue #147; issue #100 delivered the assignment and
masked-bit-condition forms).

Optimizer whole-program results at the final candidate:

| Mode | Whole-program evidence |
| ---- | ---------------------- |
| `none` | 2,163-byte baseline, SHA-256 `0417b7da8c4eabb022e6ec868e0d8dcaf4b4727da83d43e29fcbe98e16a02a93`, direct lowering |
| `balanced` | Saved gate: payload 709/725, general 740/745, combined 754/759 |
| `speed` | Acquisition gate: payload 943/963, general 976/984, combined 990/998, ZP 14/14, stack 6/10 |
| `size` | Saved size-quality output; 17/17 saved cases |

The whole-program gates pass, but no local selected-objective loss claim is made. The `size`
acquisition form is 66 payload bytes above a complete 877-byte expert; the gap is tracked as
issue #145 with the measured 943/877 delta and the missing looped transform. Local per-routine
saved parity at a matched ABI remains `Unknown`; #137 was closed as a non-equal-contract comparison,
and the equal-contract comparison is the whole-program saved gate. Open RD-08 issues #95, #97,
#104, #107–#133, #135, #136, #139, and #145 carry measured deltas; #96, #134, #138, and the
non-equal-contract #137 disposition are recorded separately.

## 6. ACME and VICE results

ACME and VICE identities are recorded in section 1. Runtime results are recorded here as they run.

### Atomic-failure evidence

`packages/compiler/src/publication/`, `terminal-failure.spec.test.ts`, and
`packages/compiler/src/services/services.impl.test.ts` pass 26/26:

- seeded publication/lock/recovery failures fail closed;
- a lexical failure after a successful generation does not reuse or launch the previous generation;
- VICE banner mismatches are rejected;
- cancellation stops the complete owned VICE process group.

The publication cap fix and review hardening were rechecked by the complete compiler suite at candidate `bb10e0d1`
(217 files, 3,683 passed, 2 skipped). Post-commit VICE failure/cancellation preserves the committed
generation and reports build success separately; the owning tests are `terminal-failure.spec.test.ts`
and `services.impl.test.ts`.

### D64 runtime

`test/rd07/d64-publication.spec.test.ts` passes 3/3 for the eight-file D64 generation, unreachable
unit omission, and unchanged PRG path. The opt-in runtime suite was made self-contained by
generating the missing-unit and longer-replacement images from the published D64 directory and BAM.
`RD07_VICE=1 yarn vitest run test/rd07/d64-vice.spec.test.ts` passes 4/4:

| Case | Result |
| ---- | ------ |
| Load the unit bytes and preserve the canary | Pass |
| Missing unit returns false without the success path | Pass |
| Longer readable file overwrites the bounded destination and still returns false (`HLE-010`) | Pass |
| Program ends and BASIC prints a fresh `READY.` after the program clears the screen | Pass |

The D64 row remains `VICE-verified / hardware-unverified`; real-drive and serial timing are
`Unknown` under `V4-HW-1`.

### Device and runtime matrix

The final root run executes these suites sequentially. The retries below are the exact failed
cases and passed alone; no skip counted as a pass.

| Family | Evidence | Result |
| ------ | -------- | ------ |
| CIA/IRQ | `cia-vice` 4, `cia-basic-return-vice` 4, `cia2-startup-vice` 68, `cia2-vice`, `handler-irq-vice` 8, `handler-irq-nesting-vice` 9 | Pass |
| NMI routes | `nmi-route-*` and `nmi-stack-evidence` suites | Pass |
| Runtime switch | `runtime-switch-vice` 1 | Pass |
| VIC collision | `vic-collision-vice` 16; one frame-wait case retried and passed 4/4 | Pass with recorded retry |
| Joystick | `joystick-vice` 32, `joystick-api-output` 220 | Pass |
| Assets | `vice-koala` 1, `vice-psid` 2, `vice-producer` 2, `vice-qp15` 1, `vice-sprite-pointer` 1 | Pass |
| Optimizer native | `input-startup-selection` 104, `optimizer-saved-output` 17, `optimizer-acquisition-output` 12, `input-size-runtime` 64 | Pass |
| Canonical fixed-object ABI | 20 cases; one monitor-startup case retried and passed 1/1 | Pass with recorded retry |
| Byte selection | 56 cases; one monitor-ownership case retried and passed 4/4 | Pass with recorded retry |

After the runs, `pgrep x64sc` found no process, no monitor port remained, and every owned process
group had stopped.

## 7. Physical-evidence status

Consensus basis: VICE 3.10 `x64sc` is accepted as sufficiently accurate for the functional,
instruction-level, memory/MMIO, and bounded timing scope of this candidate. This is not a claim of
universal hardware equivalence. Analog SID behavior, real drive/serial timing, board/chip revision
behavior, and silicon-sensitive edges remain unproven.

No physical C64, 1541-compatible drive, SID unit, or analogue capture path is available.

| Physical row | Status | Future evidence | Owner |
| ------------ | ------ | --------------- | ----- |
| PAL timing and machine state | Unknown | Named PAL board/ASSY and chip revisions; raster/badline, sprite-DMA, IRQ/NMI/CIA edge traces | `V4-HW-1` |
| Later NTSC timing and machine state | Unknown | Named later-NTSC unit; the same timing and interrupt traces | `V4-HW-1` |
| 6581 analogue SID | Unknown | Named 6581 unit and analogue capture of filters, combined waveforms, and revision character | `V4-HW-1` |
| 8580 analogue SID | Unknown | Named 8580 unit and the same analogue capture matrix | `V4-HW-1` |
| Real D64 drive path | Unknown | 1541-compatible drive, real serial timing, media behavior, and the D64 loader journey | `V4-HW-1` |
| Emulator/hardware disagreement | Untested; VICE only | Side-by-side VICE and named-hardware observations for the same artifact and configuration | `V4-HW-1` |

`V4-HW-1` owns the future targeted physical matrix. No physical claim is made by this candidate.

## 8. Tooling, package, and VSIX

| Item | Evidence | Status |
| ---- | -------- | ------ |
| Compiler/CLI/LSP tarballs | `npm pack` and clean-prefix install | Pass |
| Local VSIX | Build, install, Build/Run/Evidence journey | Pass in a clean VS Code 1.145.2 extension host |
| Tool discovery | Config/`PATH` precedence and missing-tool failure | Pass from the installed prefix |
| Cancellation | Owned process-tree termination | Pass from the installed prefix; VICE residue absent |

### Local VSIX

| Fact | Value |
| ---- | ----- |
| Extension ID | `blendsdk.blend65@0.1.0` |
| Package | `blend65-0.1.0.vsix`, 3,089,583 bytes, SHA-256 `5260a517e5ddb01435f6ff0f8d02de1cc4dba82d3c6f54fe1b989ac3aef8751e` |
| Contents | 1,683 files; extension bundle plus the externalized CLI, language server, compiler, and protocol dependencies |
| Packager | `@vscode/vsce` 4.1.0 |
| Host | VS Code 1.145.2, clean `--user-data-dir` and `--extensions-dir` |

The workspace package remains `@blend65/vscode`; the VSIX staging manifest uses the unscoped
extension name `blend65` and publisher `blendsdk` because VS Code rejects scoped extension names.
The package's runtime dependencies are installed into the VSIX; the extension bundle itself remains
externalized.

A temporary driver extension activated `blendsdk.blend65` through the real VS Code API and executed
the installed commands:

| Command | Result |
| ------- | ------ |
| `blend65.build` | Succeeded and published a fresh generation |
| `blend65.openEvidence` | Resolved and opened the published `.asm` evidence |
| `blend65.run` | Launched VICE; the owned process was stopped externally and the command returned, with no `x64sc` residue |

The interactive run success path remains `interactive-unverified`, matching the CLI. Trust denial,
selective save-or-abort, progress, diagnostics, output, and artifact containment are covered by the
18 passing VS Code package tests. No UI input automation was available, so command execution used a
driver extension in a real extension host rather than a simulated click path.

## 9. C64U readiness and handoff

The twelve seams were audited against real files and types. Nine pass. Rows 8–10 pass at the seam
level and carry recorded future-pressure items; no speculative field or abstraction was added.

| # | Seam | Evidence | Result |
| - | ---- | -------- | ------ |
| 1 | Language and semantic IR | `packages/compiler/src/frontend/`, `spec/` | Pass |
| 2 | CPU ownership | `packages/compiler/src/machine/`, `target/profile.ts` | Pass |
| 3 | Machine ownership | `target/c64-kernal.ts`, `frontend/profile.ts`; startup is a terminal C64 component | Pass |
| 4 | Serializer/packager ownership | `artifacts/acme-serializer.ts`, `packaging/d64/` | Pass |
| 5 | Function storage | `storage/`; SFA closes function execution only | Pass |
| 6 | Physical identity | `.debug.json`, `.memory.json`, `addressSpaceId`/`bankId` | Pass |
| 7 | Transfer effects | `frontend/load-units.ts`, `test/rd07/` | Pass |
| 8 | Multiple clocks | CPU/video facts typed; SID, serial/loader, and configurable clocks absent | Pass with recorded pressure |
| 9 | Device topology | `sidModel`/`sidAddress` and `c64.audio` seam; multi-SID/UltiSID topology absent | Pass with recorded pressure |
| 10 | Optimization | CPU/machine/scarce-resource facts typed; bank/transfer costs absent | Pass with recorded pressure |
| 11 | Project/tooling | `blend65.json`, `tools.jsonc`, typed profile/evidence boundaries | Pass |
| 12 | Product honesty | No selectable `c64u` ID, package, stub, emulator case, or support claim | Pass |

The handoff packet is
[`codeops/features/blend65-c64u/requirements/_draft/discovery-notes.md`](../../codeops/features/blend65-c64u/requirements/_draft/discovery-notes.md).
It carries the three pressure items as explicit C64U unknowns, the primary-source needs, the five
activation gates, and one target-native proof seed. The successor roadmap links the packet and keeps
`RD-01` dependent on v4. No C64U implementation exists.

## 10. Security, responsiveness, deferrals, and limitations

### Responsiveness

Measured from the installed `linux/x64` prefix. These are diagnostic trends only; no wall-clock or
memory value changes pass/fail.

| Phase | Runs | Elapsed | Peak RSS |
| ----- | ---- | ------- | -------- |
| `blendc check` | 2 | 0.35 s / 0.37 s | 87,112 / 87,484 KB |
| `blendc build` | 2 | 0.59 s / 0.62 s | 92,716 / 93,480 KB |
| `blendc evidence` | 2 | 0.30 s / 0.32 s | 82,928 / 83,948 KB |
| Language server initialize + diagnostics + queries + format | 1 | 0.56 s | 85,128 KB |
| Complete compiler suite | 1 | 662.72 s | not separately sampled |
| Complete root release suite | 1 | 8,621.84 s | not separately sampled |

`blendc run` reached a VICE spawn within the first one-second poll after invocation; the exact
sub-second startup was not measured. Windows and macOS produce no observation because those hosts
remain `Unknown`.

### Security negative matrix

| Boundary | Evidence | Result |
| -------- | -------- | ------ |
| Path and symlink containment | RD-09 security, publication, and project-loading tests | Pass |
| Malformed source, manifest, evidence, and D64 records | RD-04 diagnostics, RD-07 codec, publication validators | Pass |
| Output collisions and immutable generations | Publication and current-record tests | Pass |
| Executable and argument injection | CLI argument tests, fake-ACME cases, discovery probes | Pass |
| Hostile tool and monitor output | ACME/VICE probe limits, monitor ownership and cancellation tests | Pass |
| Workspace trust and explicit command intent | VS Code command and spec tests | Pass |
| Cancellation cleanup and stale artifacts | CLI/LSP/service cancellation, VICE process-group tests | Pass |
| Unrelated loopback services | Monitor ownership and port-selection tests | Pass |

No security case produced an outside file, process, or network effect.

### Docs reconciliation and examples

`docs/tooling.md`, `docs/platform-libraries.md`, `docs/loadable-assets.md`, and `docs/c64-cia2.md`
now match the qualified surface: four KERNAL profiles, four takeover profiles, D64, `tools.jsonc`,
local VSIX, and the physical/host/producer unknowns. Every `blendc` example was exercised from the
installed prefix; library and asset examples are covered by the package and root suites.

### Deferrals and limitations

| Item | Status | Owner |
| ---- | ------ | ----- |
| Four takeover profiles | Delivered; four-profile VICE matrix passes, normal return and source raw IRQ verified | `V4-TAKEOVER-1` |
| Source-installed raw NMI | Default raw NMI route verified; source installer deferred because the frozen text withholds the unbounded-NMI exception | `V4-TAKEOVER-F2` |
| Physical timing, analogue SID, real drive, board/chip revisions | `Unknown` | `V4-HW-1` |
| Multi-screen sprite pointer | Deferred expressiveness item | `T-27` / issue #140 |
| Remaining NMI source-read forms (`E10245`) | Deferred expressiveness/implementation limit; assignment and masked-bit-condition forms delivered | issue #147 |
| `size` acquisition 66-byte local floor | Tracked measured gap; issue #145 | RD-08 backlog |
| Open optimizer/parity debt | Linked measured issues #95, #97, #104, #107–#133, #135, #136, #139 | RD-08 backlog |
| Unused return/argument staging homes | Minor certified-RAM/debug evidence debt; issue #146 | SFA/debug |
| NMI path cycles and balanced/speed full RAM/stack pinning | Diagnostic evidence only; entry-to-return `T` is recorded | RD-08 |
| Open optimizer/parity debt | Linked measured issues #95, #97, #104, #107–#133, #135, #136, #139 | RD-08 backlog |
| CharPad 3.88 producer proof | `Unknown`; installed producer is 3.80; CTM v9 exercised | `V4-ASSET-1` |
| GoatTracker 2.77 adapter | Deferred; no adapter exists | `T-19` |
| Windows x64, macOS arm64/x64 native hosts | `Unknown` | `V4-HOST-1` |
| C64U multi-clock, topology, and bank/transfer costs | Recorded future pressure, no C64U implementation | `blend65-c64u/RD-01` |

## 11. Bounded support statement

> **Status: VICE-verified / hardware-unverified.**

Blend65 v4 is production-qualified on `linux/x64` for the surface below. The original
candidate `bb10e0d116d19a1d96f169a09d14f02ff0daa0f8` covered four KERNAL PRG profiles plus
the D64; the four takeover rows are the `V4-TAKEOVER-1` update, approved on 2026-11-12 and recorded
in section 13. The qualified surface is:

- the compiler library (root, `frontend`, and `tools` entries), the `blendc` CLI
  (`check`, `build`, `run`, `evidence`), the language server, and the local VS Code VSIX
  `blendsdk.blend65@0.1.0`;
- compiler `0.1.0`, Specification 4 normative identity
  `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`, and
  expert skill `2.0.4` content `0e2a6280…`;
- optimization modes `none`, `balanced`, `speed`, and `size`, with `boundsCheck` and
  `divisionZeroCheck` as the documented safety options; whole-program gates pass, while the local
  matched-ABI and 66-byte `size` acquisition debt remain tracked;
- ACME 0.97 assembly, `tools.jsonc` schema-1 discovery, local package tarballs, and the eight-file
  build evidence;
- the eight resident PRG profiles
  `c64-{pal|ntsc}-prg-{kernal|takeover}-{6581|8580}` and the one
  `c64-pal-d64-kernal-6581` profile;
- the native asset handlers exercised by the release fixtures: SpritePad SPD v5, PSID v1–v4,
  Koala, Q-P15, raw data, and CharPad CTM v9; CharPad 3.88 producer evidence and the GoatTracker
  2.77 adapter are absent;
- runtime observations made only through VICE 3.10 `x64sc`, with the exact executable and ROM
  hashes recorded in this document.

`blendc run` and the VS Code Run command launch an interactive VICE session. Their completed
interactive exit remains `interactive-unverified`; only the launch, owned cancellation, and
no-residue behavior are qualified.

The statement does **not** claim: physical C64 timing, analogue SID behavior, real drive or serial
behavior, board/chip revisions, or emulator/hardware agreement (`V4-HW-1`); source-installed raw NMI
(`V4-TAKEOVER-F2`) or raw-MMIO interrupt source containment (`V4-TAKEOVER-F3`); Windows x64 or
macOS arm64/x64 native hosts (`V4-HOST-1`); Linux ARM64
or Windows ARM64 support; C64U target support (only the discovery handoff exists); local
matched-ABI optimizer parity, the 66-byte `size` acquisition floor, CharPad 3.88, or the
GoatTracker 2.77 adapter; a game engine, renderer, runtime, mixer, scheduler, asset plugin
framework, or debug adapter; or NPM/Marketplace publication, tags, signing, or announcements.

## 12. Approval

### Independent reviews

Six read-only reviews were run against candidate `649718ec`; their fixes are bound to `bb10e0d1`. No critical
finding was reported. Every major finding was fixed or converted into a tracked, bounded debt.

| Lens | Findings | Disposition |
| ---- | -------- | ----------- |
| SFA/ABI | SF-001 minor: unused return/argument staging homes in certified RAM/debug | Tracked as issue #146 |
| Machine code | MC-001 major: `size` acquisition 943 vs 877-byte expert; MC-002/MC-003 major: incomplete local-parity/debt disclosure; MC-004/MC-005 minor | #145 tracks the 66-byte gap; the release claim now says whole-program gates pass and local matched-ABI parity is `Unknown`; minor cycle/pinning gaps recorded |
| Target platform | TP-01 major: D64 READY was the autostart banner; TP-02/TP-03/TP-04 minor | D64 source now clears the screen and requires a fresh READY; 4/4 pass. Cycle label, success criteria, and full artifact hashes corrected |
| Security | SA-001/SA-002 minor: inconsistent metadata read bound and escaping VS Code asset paths | `.build.json` uses the 1 MiB bound; cleanup checks size; escaping `assetPaths` are rejected; tests pass |
| Semantics/DX | SM-001–SM-006 major: stale normative identity, missing E10245 ledger row, incomplete support statement, closed-owner gaps, stale README; SM-007/SM-008 minor | Normative ledger re-pinned to `038b70e9`; E10245 row/probe added; support statement expanded; `V4-ASSET-1`/`V4-HOST-1` created; README and debt wording corrected |
| Correctness | RV-001–RV-005 major: premature success criteria, missing GoatTracker row, contradictory #134 status, takeover plan contradiction, prefix-only hashes; RV-006–RV-011 minor | Success criteria reopened, GoatTracker recorded, #134 status reconciled, takeover wording corrected, full hashes recorded, roadmap/count/links/AR count fixed |

Post-fix directed evidence: D64 VICE 4/4, normative coverage 19/19, expressiveness ledger 14/14,
publication 18/18, VS Code 18/18, typecheck clean. The final complete boundary is running at the
time of writing.

### Deferral-expiry scan

RD-10 did not expire a prior deferral's stated rationale. Every remaining item has a concrete
owner: takeover delivered under `V4-TAKEOVER-1` with residual findings `V4-TAKEOVER-F2/F3`;
physical evidence `V4-HW-1`; Windows/macOS `V4-HOST-1`; CharPad
3.88 and GoatTracker `V4-ASSET-1`/`T-19`; remaining E10245 NMI source-read forms issue #147
(issue #100 delivered); multi-screen pointer issue #140;
`size` gap issue #145; staging-home debt issue #146; open optimizer debt issues #95, #97, #104,
#107–#133, #135, #136, #139; C64U future pressure in the handoff packet. No orphaned owner
remains.

### Decision

Approved by the user on 2026-11-12. The exact candidate `bb10e0d1` and the bounded support statement in
section 11 are approved. This approval is a production transition only; it does not authorize a
push, NPM/Marketplace publication, release tag, signing, or announcement. The named debt and
`Unknown` rows remain owned as recorded.

## 13. Takeover profile update

This section records the delivery of `V4-TAKEOVER-1`. It does not rewrite the historical
`bb10e0d1` approval; it extends the qualified surface under the same bounded evidence rules and
leaves every physical row `Unknown`. The takeover implementation commit is `d73e002c` on
`feature/v4-rebuild`; the [CodeOps closeout](../../codeops/features/blend65-v4/plans/rd-05-takeover-profiles/08-closeout.md)
records the verification boundary and residual findings.

### 13.0 Approval

The four takeover rows are part of the approved production surface. The user approved them on
2026-11-12, after the `bb10e0d1` candidate, on the evidence in this section: four fresh artifacts,
five sequential VICE 3.10 cases, the cooperative regression, the complete compiler suite and the
independent reviews recorded in the closeout. The approval keeps the same bounded wording as the
original candidate: `VICE-verified / hardware-unverified`, no physical C64, drive or SID claim, and
no authorization to push, publish, tag, sign or announce. `V4-TAKEOVER-F2` and `V4-TAKEOVER-F3`
remain owned follow-ups, not part of the claim.

### 13.1 Delivered behavior

The four `c64-{pal|ntsc}-prg-takeover-{6581|8580}` identities now select a raw ownership
constructor. Application execution runs with BASIC/KERNAL execution absent, I/O visible, RAM at
`$E000-$FFFF` exposed, and the compiler owning both hardware vectors. Startup:

1. saves A/X/Y, status, stack pointer, `$0000`, `$0001` and `$DD02`;
2. captures every borrowed BASIC zero-page byte;
3. writes complete default IRQ/NMI vectors into underlying RAM while ROM still supplies the read
   path;
4. performs the single owned latch change to `$05` under mask `$07`;
5. selects VIC bank zero through the owned CIA2 direction bits;
6. enables IRQs and runs initializers then `main`.

The default IRQ entry preserves A, reads CIA1 ICR once, reads VIC `$D019` once and writes the
observed bits back before `RTI`. The default NMI entry uses `BIT $DD0D` to consume CIA2 pending
state without changing A, then `RTI`; its entry is placed at low byte `$47`. A normal return
restores `$DD02`, borrowed bytes, `$0001`, `$0000`, status, registers and stack pointer and
executes `RTS` to BASIC. The finite stack proof includes the always-reachable default NMI
frame (3 bytes) and, while no source IRQ route replaces it, the default IRQ frame (4 bytes);
a source raw-IRQ route adds the default NMI frame to its selected route peak.

`c64.system.setRawIRQ`/`restoreRawIRQ` install and remove a source handler with the fixed compiler
save/restore/`RTI` wrapper (12 output bytes, 37 cycles plus body, six stack bytes). A raw IRQ handler
must consume or fully disable every enabled CIA1 source on **every path** before installation;
otherwise the build fails `E10278`. The raw IRQ install writes both `$FFFE/$FFFF` bytes inside the
existing IRQ-masked transaction and the restore writes the exact saved predecessor back. Direct
source writes to the compiler-owned processor port, VIC-bank or hardware-vector bytes fail
`E10278`.

The prescribed `$05` mapping exposes RAM at `$A000-$BFFF` as well as `$E000-$FFFF`; the full frozen
`$0801-$CFFF` range remains available for code, data, default entries and SFA. A VICE read/write
probe under the running `$05` mapping confirmed the RAM view.

### 13.2 Runtime matrix

The takeover VICE matrix runs one fresh artifact per identity, sequentially, in the pinned VICE
3.10 `x64sc` with the exact 901227-03/BASIC/chargen ROM hashes from section 2. Each case observes
the startup entry, the `$05` mapping, both raw vectors, the default IRQ entry (stock CIA1 Timer A),
the default NMI entry (monitor-injected CIA2 Timer A), `main`, the restore block and the caller
return. The NMI case also confirms A is unchanged from the interrupted value at the handler's
`RTI`. The returning epilogue restores the exact `$0000/$0001/$DD02` bytes, the zero-page fixture
byte and the processor/stack state.

| Profile | Runtime observation | Status |
| ------- | ------------------- | ------ |
| `c64-pal-prg-takeover-6581` | 6569 / 6581 / KERNAL rev 3; vectors, `$05`, default IRQ+NMI, caller return | `VICE-verified / hardware-unverified` |
| `c64-pal-prg-takeover-8580` | 6569 / 8580 / KERNAL rev 3; vectors, `$05`, default IRQ+NMI, caller return | `VICE-verified / hardware-unverified` |
| `c64-ntsc-prg-takeover-6581` | 6567 / 6581 / KERNAL rev 3; vectors, `$05`, default IRQ+NMI, caller return | `VICE-verified / hardware-unverified` |
| `c64-ntsc-prg-takeover-8580` | 6567 / 8580 / KERNAL rev 3; vectors, `$05`, default IRQ+NMI, caller return | `VICE-verified / hardware-unverified` |

A separate PAL/6581 case installs a source raw IRQ handler, observes the handler entry and
`$FFFE/$FFFF` value, consumes CIA1, returns to `main`, restores `$FFFE/$FFFF` to the default entry,
and reaches the caller return.

The post-commit compiler suite passes 219/219 files (3,701 passed, 2 skipped); the directed
takeover/cooperative root slice passes 63/63, including the five takeover VICE cases.

### 13.3 Residual findings

| ID | Finding | Owner |
| --- | ------- | ----- |
| `V4-TAKEOVER-F2` | Source-installed raw NMI (`setRawNMI`/`restoreRawNMI`) is not exposed. The default raw NMI route is verified, but the frozen text withholds the cooperative unbounded-NMI exception from takeover and supplies no finite external arrival bound. | RD-05 future slice |
| `V4-TAKEOVER-F3` | Direct raw-MMIO enablement of IRQ/NMI sources (`$D01A`, `$DC0E`, `$DD0E`, and similar writes) remains an opaque hardware boundary. Typed operations are checked; raw writes retain the existing unsafe-boundary contract. | RD-05 future slice |

No physical C64, drive or SID was used. The physical rows in section 10 remain `Unknown`; the
takeover rows above are `VICE-verified / hardware-unverified`, not silicon proof.
