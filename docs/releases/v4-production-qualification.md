# Blend65 v4 Production Qualification

> **Status**: Qualification in progress — not approved
> **Candidate code tree**: `6ff6e293` (installed-path evidence added; final boundary rerun pending)
> **Created**: 2026-11-11
> **Owning RD**: [RD-10](../codeops/features/blend65-v4/requirements/RD-10-production-qualification-and-c64u-handoff.md)

This record is the single release closeout index. It links and hashes existing evidence; it is not
a readiness product, score, or second evidence database.

## 1. Candidate identity

| Fact | Value |
| ---- | ----- |
| Candidate code commit | `6ff6e29347afb1612db3c0bf4e680ea902ec81a2` |
| Working tree at freeze | clean at `6ff6e293`; later commits add documentation only |
| Compiler version | `0.1.0` |
| Specification identity | `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b` |
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

The counts below were recorded at `c6cc63b3`. The tool-discovery feature at `6ff6e293` changes the
CLI and compiler surface, so one final sequential rerun is pending and will replace this table.

| Suite | Result |
| ----- | ------ |
| Compiler package | 216 files, 3,659 passed, 2 skipped |
| Root release suite | 325 files, 6,569 passed, 1 failed then retried, 4 skipped |
| CLI package | 9 files, 69 passed |
| Language server package | 5 files, 21 passed |
| VS Code package | 5 files, 17 passed |
| Root typecheck | 7 Turbo tasks successful |

The single root failure was `test/rd05/vic-collision-vice.spec.test.ts`, profile
`c64-pal-prg-kernal-8580`, case `only sprite 7 overlaps foreground`. Its frame-wait guard
(`$0708=1`) expired under full-suite load. The case passed when retried alone (4/4 for that
scenario) and the complete file passed on retry (16/16). This is recorded as a bounded retry, not
as a skipped pass or a product defect.

### Installed public path

The three public packages were packed and installed into a clean temporary prefix outside the
repository. The install resolved nine packages, including the declared `jsonc-parser` dependency.

| Artifact | Bytes | SHA-256 |
| -------- | ----- | ------- |
| `blend65-compiler-0.1.0.tgz` | 1,530,207 | `d6281974b2a7c9f16a21b47291f8b23a0e0ad69df85693c5453d3c16f9877f39` |
| `blend65-cli-0.1.0.tgz` | 19,543 | `ffa95580812ba6c6c93bcedda545aa8e67cf299165dad15f0acdbf5e1a25d53f` |
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

## 4. Profile and artifact matrix

Nine manifest profile IDs:

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
| `c64-pal-prg-kernal-6581` | Pending | Pending | — |
| `c64-pal-prg-kernal-8580` | Pending | Pending | — |
| `c64-ntsc-prg-kernal-6581` | Pending | Pending | — |
| `c64-ntsc-prg-kernal-8580` | Pending | Pending | — |
| `c64-pal-prg-takeover-6581` | Pending | Pending | — |
| `c64-pal-prg-takeover-8580` | Pending | Pending | — |
| `c64-ntsc-prg-takeover-6581` | Pending | Pending | — |
| `c64-ntsc-prg-takeover-8580` | Pending | Pending | — |
| `c64-pal-d64-kernal-6581` | Pending | Pending | — |

Artifact inventory: exactly one literal-name primary PRG or D64 plus `.asm`, `.labels`,
`.assets.json`, `.memory.json`, `.costs.json`, `.debug.json`, and `.build.json`. `.build.json`
hashes every other artifact and not itself.

## 5. Language, assets, optimizer, and engine boundary

| Area | Evidence | Status |
| ---- | -------- | ------ |
| Complete language | `packages/compiler` suite and VICE-bearing family cases | Pending |
| Native assets | RD-06 producer/format fixtures, including CharPad 3.80/3.88 gap disclosure | Pending |
| Optimizer | RD-08 four-mode behavior, cost, resource, and parity evidence | Pending |
| Compiler-not-engine | Workload programs and package/binary inspection | Pending |

## 6. ACME and VICE results

ACME and VICE identities are recorded in section 1. Runtime results are recorded here as they run.

### Atomic-failure evidence

`packages/compiler/src/publication/`, `terminal-failure.spec.test.ts`, and
`packages/compiler/src/services/services.impl.test.ts` pass 26/26:

- seeded publication/lock/recovery failures fail closed;
- a lexical failure after a successful generation does not reuse or launch the previous generation;
- VICE banner mismatches are rejected;
- cancellation stops the complete owned VICE process group.

The publication cap fix was rechecked by the complete compiler suite at candidate `c6cc63b3`
(216 files, 3,659 passed, 2 skipped). Post-commit VICE failure/cancellation preserves the committed
generation and reports build success separately; the owning tests are `terminal-failure.spec.test.ts`
and `services.impl.test.ts`.

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
