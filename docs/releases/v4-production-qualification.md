# Blend65 v4 Production Qualification

> **Status**: Qualification in progress — not approved
> **Candidate code tree**: `649718ec` (test boundary complete with three recorded VICE retries)
> **Created**: 2026-11-11
> **Owning RD**: [RD-10](../codeops/features/blend65-v4/requirements/RD-10-production-qualification-and-c64u-handoff.md)

This record is the single release closeout index. It links and hashes existing evidence; it is not
a readiness product, score, or second evidence database.

## 1. Candidate identity

| Fact | Value |
| ---- | ----- |
| Candidate code commit | `649718ecd7ff7185222d897f546858fc524d3053` |
| Working tree at freeze | clean at `649718ec`; later commits add documentation and test-evidence support only; product code is unchanged |
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
| RD-01 | [Requirements](../codeops/features/blend65-v4/requirements/RD-01-specification-4-and-expert-authority-freeze.md) | RD-01 plan | Done |
| RD-02 | [Requirements](../codeops/features/blend65-v4/requirements/RD-02-clean-v4-foundation-and-deterministic-project-model.md) | RD-02 plan | Done |
| RD-03 | [Requirements](../codeops/features/blend65-v4/requirements/RD-03-playable-m1-complete-pipeline.md) | RD-03 plans | Done |
| RD-04 | [Requirements](../codeops/features/blend65-v4/requirements/RD-04-complete-language-correct-unoptimized-compiler.md) | RD-04 plan | Done |
| RD-05 | [Requirements](../codeops/features/blend65-v4/requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md) | RD-05 plans | Done |
| RD-06 | [Requirements](../codeops/features/blend65-v4/requirements/RD-06-native-assets-compile-time-composition-and-resident-layout.md) | [Closeout](../codeops/features/blend65-v4/plans/rd-06-native-assets/09-closeout.md) | Done |
| RD-07 | [Requirements](../codeops/features/blend65-v4/requirements/RD-07-loadable-assets-and-d64-delivery.md) | [Closeout](../codeops/features/blend65-v4/plans/rd-07-loadable-assets-and-d64-delivery/09-closeout.md) | Done |
| RD-08 | [Requirements](../codeops/features/blend65-v4/requirements/RD-08-optimization-and-expert-output.md) | RD-08 plan | Done |
| RD-09 | [Requirements](../codeops/features/blend65-v4/requirements/RD-09-developer-tooling-and-debug-evidence.md) | [Closeout](../codeops/features/blend65-v4/plans/rd-09-developer-tooling/09-closeout.md) | Done |

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

The compiler row is the final `649718ec` rerun. The root row is the completed `649718ec` run with
three bounded VICE retries recorded below.

| Suite | Result |
| ----- | ------ |
| Compiler package | 217 files, 3,683 passed, 2 skipped |
| Root release suite | 325 files, 321 passed, 3 failed, 1 skipped; 6,567 passed, 3 failed, 4 skipped |
| CLI package | 11 files, 73 passed |
| Language server package | 5 files, 21 passed |
| VS Code package | 5 files, 17 passed |
| Root typecheck | 7 Turbo tasks successful |

The three root failures were VICE harness/load cases, and each passed when retried alone:

| Failed case | Observed failure | Retry |
| ----------- | ---------------- | ----- |
| `test/rd08/input-byte-selection.spec.test.ts` — `should preserve captured 3 against 1 across calls loads and restored status 9` | Monitor listener ownership attestation failed under full-suite load | Case passed 4/4 profiles |
| `test/rd05/canonical-fixed-object-abi.spec.test.ts` — `uses the generic borrower for two distinct objects on c64-ntsc-prg-kernal-8580` | VICE binary monitor did not open inside the bounded startup window | Case passed 1/1 |
| `test/rd05/vic-collision-vice.spec.test.ts` — `only sprite 7 overlaps foreground` | Frame-wait guard (`$0708=1`) expired under full-suite load | Case passed 4/4 profiles |

No skip contributed a pass, and no product defect is inferred from these load-sensitive retries.

### Installed public path

The three public packages were packed and installed into a clean temporary prefix outside the
repository. The install resolved nine packages, including the declared `jsonc-parser` dependency.

| Artifact | Bytes | SHA-256 |
| -------- | ----- | ------- |
| `blend65-compiler-0.1.0.tgz` | 1,533,856 | `10d53e7e2c3d7c866619bc1f7c6cfb576e30aa3c17d070ddc216106bd4eacb1d` |
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
| Four takeover profiles are not executable | RD-10's eight-profile matrix cannot be claimed | Defer under `V4-TAKEOVER-1`; claim narrows to four KERNAL profiles plus D64 (AR-18) |
| D64 opt-in suite referenced missing and longer images that it never generated | Two of four runtime cases could not start VICE | Added reproducible variant generation in `test/rd07/d64-runtime-fixture.ts`; 4/4 pass |

## 4. Profile and artifact matrix

Nine manifest profile IDs are recognized. Five are executable for this candidate: the four KERNAL
resident profiles and one D64. The four takeover IDs are not executable by the current compiler and
are recorded `Unknown` under `V4-TAKEOVER-1`.

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
| `c64-pal-prg-kernal-6581` | Pass; PRG `3d2c6022…` | Pass: VIC-II 6569, SID 6581, KERNAL rev 3, normal return at cycle 57,671 | `VICE-verified / hardware-unverified` |
| `c64-pal-prg-kernal-8580` | Pass; PRG `f9f4557b…` | Pass: VIC-II 6569, SID 8580, KERNAL rev 3, normal return at cycle 57,671 | `VICE-verified / hardware-unverified` |
| `c64-ntsc-prg-kernal-6581` | Pass; PRG `70b02135…` | Pass: VIC-II 6567, SID 6581, KERNAL rev 3, normal return at cycle 57,671 | `VICE-verified / hardware-unverified` |
| `c64-ntsc-prg-kernal-8580` | Pass; PRG `273dfee5…` | Pass: VIC-II 6567, SID 8580, KERNAL rev 3, normal return at cycle 57,671 | `VICE-verified / hardware-unverified` |
| `c64-pal-prg-takeover-6581` | Not executable | Not run | `Unknown` — `V4-TAKEOVER-1` |
| `c64-pal-prg-takeover-8580` | Not executable | Not run | `Unknown` — `V4-TAKEOVER-1` |
| `c64-ntsc-prg-takeover-6581` | Not executable | Not run | `Unknown` — `V4-TAKEOVER-1` |
| `c64-ntsc-prg-takeover-8580` | Not executable | Not run | `Unknown` — `V4-TAKEOVER-1` |
| `c64-pal-d64-kernal-6581` | Pass; 174,848-byte D64 | Pass: success+canary, missing-unit false, longer-overwrite false, BASIC `READY.` return | `VICE-verified / hardware-unverified` |

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

The complete-language ledger covers every named key with no unowned row. The 18 rows marked
`rd-05`, `rd-06`, or `rd-07` are proved by those closed owners; they are not gaps. The one deferred
expressiveness item is `v4-multi-screen-sprite-pointer` (`E10273`), owned by `T-27`/issue #140.

Optimizer whole-program results at the final candidate:

| Mode | Whole-program evidence |
| ---- | ---------------------- |
| `none` | 2,163-byte baseline, SHA-256 `0417b7da…`, direct lowering |
| `balanced` | Saved gate: payload 709/725, general 740/745, combined 754/759 |
| `speed` | Acquisition gate: payload 943/963, general 976/984, combined 990/998, ZP 14/14, stack 6/10 |
| `size` | Saved size-quality output; 17/17 saved cases |

No untracked meet-only result is claimed. The open optimizer and parity issues (#107–#140) carry
measured deltas and reopen paths; #96, #134, #137, and #138 are closed with evidence.

## 6. ACME and VICE results

ACME and VICE identities are recorded in section 1. Runtime results are recorded here as they run.

### Atomic-failure evidence

`packages/compiler/src/publication/`, `terminal-failure.spec.test.ts`, and
`packages/compiler/src/services/services.impl.test.ts` pass 26/26:

- seeded publication/lock/recovery failures fail closed;
- a lexical failure after a successful generation does not reuse or launch the previous generation;
- VICE banner mismatches are rejected;
- cancellation stops the complete owned VICE process group.

The publication cap fix was rechecked by the complete compiler suite at candidate `649718ec`
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
| Program ends and BASIC prints `READY.` | Pass |

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

| Physical row | Status | Owner |
| ------------ | ------ | ----- |
| PAL timing and machine state | Unknown | `V4-HW-1` |
| Later NTSC timing and machine state | Unknown | `V4-HW-1` |
| 6581 analogue SID | Unknown | `V4-HW-1` |
| 8580 analogue SID | Unknown | `V4-HW-1` |
| Real D64 drive path | Unknown | `V4-HW-1` |
| Emulator/hardware disagreement | Untested; VICE only | `V4-HW-1` |

`V4-HW-1` owns the future targeted physical matrix. No physical claim is made by this candidate.

## 8. Tooling, package, and VSIX

| Item | Evidence | Status |
| ---- | -------- | ------ |
| Compiler/CLI/LSP tarballs | `npm pack` and clean-prefix install | Pass |
| Local VSIX | Build, install, Build/Run/Evidence journey | Pending |
| Tool discovery | Config/`PATH` precedence and missing-tool failure | Pass from the installed prefix |
| Cancellation | Owned process-tree termination | Pass from the installed prefix; VICE residue absent |

## 9. C64U readiness and handoff

Twelve readiness rows and the discovery packet are pending. No C64U target, package, stub, or
support claim exists.

## 10. Security, responsiveness, deferrals, and limitations

Pending.

## 11. Bounded support statement

Pending. The final statement will name only evidenced identities and will use
`VICE-verified / hardware-unverified` wherever physical evidence is absent.

## 12. Approval

Not approved. RD-10 remains in qualification until the user explicitly approves the exact candidate
and support statement.
