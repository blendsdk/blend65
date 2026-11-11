# Blend65 v4 Production Qualification

> **Status**: Qualification in progress — not approved
> **Candidate code tree**: `b75333c8` (later commits in this qualification add evidence only)
> **Created**: 2026-11-11
> **Owning RD**: [RD-10](../codeops/features/blend65-v4/requirements/RD-10-production-qualification-and-c64u-handoff.md)

This record is the single release closeout index. It links and hashes existing evidence; it is not
a readiness product, score, or second evidence database.

## 1. Candidate identity

| Fact | Value |
| ---- | ----- |
| Candidate code commit | `b75333c82916af50e5c4160a3ea2d64385809aa2` |
| Working tree at freeze | clean (`git status --porcelain` empty) |
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
| `linux/x64` | Install/build/typecheck pass; full test boundary running | `yarn install --frozen-lockfile`, `yarn build --force`, `yarn typecheck --force` (2026-11-11) |
| `win32/x64` | Unknown unless a native host is available | — |
| `darwin/arm64` | Unknown unless a native host is available | — |
| `darwin/x64` | Unknown unless a native host is available | — |

Linux ARM64 and Windows ARM64 are best-effort. Hosts below Node 22, 32-bit hosts, and unknown
architectures are unsupported.

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

Post-commit VICE failure/cancellation preserves the committed generation and reports build success
separately; the owning tests are `terminal-failure.spec.test.ts` and `services.impl.test.ts`.

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
| Compiler/CLI/LSP tarballs | `npm pack` and clean-prefix install | Pending |
| Local VSIX | Build, install, Build/Run/Evidence journey | Pending |
| Tool discovery | Config/`PATH` precedence and missing-tool failure | Pending |
| Cancellation | Owned process-tree termination | Pending |

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
