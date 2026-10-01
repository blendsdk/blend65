# Phase 1 review: bundled C64 input source

> **Date**: 2026-10-01
> **Phase baseline tree**: `b593e6970797cec2919b183b77b6a9785706702d`
> **Status**: Complete — full checkpoint green; independent review has no findings
> **Scope**: Strict — one fixed packaged source file and existing analysis/editor seams

## Scope and authority

The delivered source is `packages/compiler/stdlib/c64/input.blend`, with six documented ordinary
exported byte constants. Only the four approved C64 profiles admit it. Preparation is request-local,
bounded by the existing source-byte ceiling and exact UTF-8 decoding. User source records, overlays
and the user-only loader identity remain unchanged. Compiler results, build/debug evidence and
editor diagnostics use the actual consumed source records and the unchanged portable hash tuple.

No caller-configurable resolver, library framework, persistent cache, dependency, runtime input
system, optimizer or game-policy API was added. The existing constant dependency map was corrected
to exclude rejected duplicates; two generic implementation cases check cascade suppression and
preservation of independent errors. The phase's exact modification set owns this bounded repair.

Governing decisions are AR-P1–AR-P4 and AR-P9 in the [decision register](00-ambiguity-register.md).
Contracts and tests are [component design](03-joystick-library.md) and
[ST-1–ST-9](07-testing-strategy.md). Frozen specification and expert authority remain untouched.
Expert baseline: 2.0.1, content commit `1ce4852016e2a883cf1f733c6014c45e176bfc69`;
`compiler-architecture.md` and `blend65-semantics.md`, using
`BLEND65-SPEC-4-1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`.

## Specification-test integrity

All three new specification files were authored before production implementation. The valid gate
was 23 assertion failures and one justified existing-profile validation pass; setup failures were
excluded. The [execution ledger](99-execution-plan.md) records the blind-author read boundary.
No pre-existing specification test changed in Phase 1.

| New oracle | Frozen Git blob |
| --- | --- |
| Library semantics | `45db89094093a4c7087a802b53832f9c135c00c7` |
| Editor diagnostics | `cd7c7a3066566e37aa44b488fabf47e4a791b29b` |
| Installed evidence, original | `35d61b218d8170955c8ee66cbea0b9744844e0b3` |
| Installed evidence, exact approved AR-P9 correction | `1b15b8b35699434bc5bce08e6fb3402101ad02ce` |

AR-P9 adds only the constant-binding selection to the evidence test's `masks` projection. All
fixtures and assertions remain unchanged, including six values/types/source IDs and the exact
count. Existing joystick functions are preserved. This narrow user-approved authority exception
does not permit any other oracle change. Removing that one predicate in memory reproduces the
original frozen blob identity exactly; the original need not be stored as a Git object to check it.
The other two new oracles retain their recorded identities byte-for-byte.

## Verification

| Boundary | Directed result |
| --- | --- |
| New phase-1 specification cases | 24/24 GREEN |
| Existing import boundaries | 36/36 pass |
| Existing snapshot, host and race controls | 36/36 pass |
| Existing frontend/module/constant controls | 74/74 pass |
| Existing service/artifact controls | 41/41 pass |
| Editor specification and regression cases | 19/19 pass |
| Compiler implementation cases | 12/12 pass |
| Editor implementation cases | 2/2 pass |

Native-read cases prove the exact 4 MiB ceiling, bounded chunks, initial/growing overflow rejection,
invalid UTF-8 rejection, regular-file checks, changed-file rejection, handle cleanup and fresh reads
after installed bytes change. Detached tarball tests prove actual packaged bytes, outside-checkout
analysis/build, portable relocation identity and source/hash evidence. Real-stdio editor tests
prove duplicate routing in both source-ID orders, standalone installed faults, close-triggered
fallback, normal-error coexistence and clearing. Transport-only implementation fixtures also prove
canonical installed URIs and user-only overlays.

Checkpoint logs are captured outside the repository in `/tmp/blend65-bundled-phase1.0gQxfT/`:
`checkpoint-install.log`, `checkpoint-build.log`, `checkpoint-typecheck.log`, `checkpoint-test.log`.
The complete unchanged-command retry passes install, build, typecheck and all 3,150 tests:
compiler 1,652 (two unchanged native-host skips), CLI 62, language server 21, editor extension 6
and root 1,409. The retry logs use the `checkpoint-retry-` prefix in the same scratch directory.
Root emulator cases ran sequentially. Native tools: Linux x64, Node 22.23.1, Yarn 1.22.22,
ACME 0.97 and VICE 3.10. Touched-code/config formatting, local Markdown links/anchors, task/source
identities, diff checks and frozen-authority checks pass. Authored Markdown is not policed by
Prettier under the existing repository policy; its structure and links were checked separately.

The first complete run passed 3,148 cases and failed two existing shared-storage padded-image
cases at their 50-second VICE wait. An unchanged five-case retry repeated two timeouts under host
load about 25. A detached build of pre-phase `bb753d63` and the current compiler produced identical
PRG hashes and restore checkpoint addresses for all three origins:

| Fixed origin | PRG bytes | SHA-256, both compilers |
| --- | --- | --- |
| 52986 | 50,940 | `d330e49026118b1513b024b52322cad1383cf07938bc26c3a118e61328247935` |
| 52987 | 50,941 | `3aff11a9cbc95010b424a93bf4a22e42ce8befffcdf6093333c0d6c536dec50f` |
| 52992 | 50,946 | `a1048bfd4baec5ea6cfc81ffc2c7e524acfdae996f9dc0ede0298e4db149f4c0` |

Only these padded implementation cases now use a 90-second finite host wait and a 100-second
outer test budget. Small-image waits stay 50/60 seconds. Programs, checkpoints, emulated cycle
limits, stimuli and assertions are unchanged. This necessary verification-fixture correction is
in the phase modification set; it changes no compiler, machine-code or language behavior.
Comparison and retry evidence is captured alongside the checkpoint logs.

## Independent review

Independent reviewer `/root/joystick_phase1_review` reports **no findings**. It reviewed the
supplied snapshot through correctness, maintainability, standards, security, API surface and
concurrency lenses. It independently confirmed the exact AR-P9 change, both other oracle hashes,
absence of pre-existing specification-test edits, frozen authority and the captured 3,150-pass
checkpoint. The fixed read, consumed-input evidence, duplicate-order repair and editor routing
satisfy the assigned Phase 1 contract. No ruling or fix-only re-review was needed.

The review diff includes committed, staged, unstaged and new phase files while excluding pre-phase
changes. The baseline and complete packet are recorded in the phase scratch directory. Roadmap
and verified-task completion bookkeeping follows the review; production and tests remain unchanged.
Separate security-profile and performance-critical auditors are not activated: no configured
web/authentication/financial/tenant/MCP profile or performance-critical machine-code change applies.
The fixed host-read and publication risks remain in the correctness review rather than unreviewed.

## Qualification boundary and next phase

Phase 1 does not qualify new joystick operations or claim expert assembly/cost parity. Both-port
operations, volatile order, exact output/resource expectations and runtime input stimuli belong to
Phase 2. This is not an RD-05 closeout; its remaining platform obligations and deferral-expiry gate
remain owned there. Windows/macOS user-host and physical hardware release checks remain RD-10.
No opted-in `docs/index.md` exists; the authorized small platform-library page remains a plan
closeout deliverable, without adding a documentation framework at this phase checkpoint.
