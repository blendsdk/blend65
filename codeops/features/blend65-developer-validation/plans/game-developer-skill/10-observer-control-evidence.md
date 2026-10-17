# Observer Control Evidence

> **Status**: Verified partial — observer semantic/binding controls only
> **Date**: 2026-10-16 11:16 CEST
> **Codebase**: `e715977d` plus the owned uncommitted observer/oracle execution work
> **CodeOps Artifact Schema**: 1

## Scope and Ownership

The user explicitly reserved the current exclusive VICE window. At 11:11 CEST
an exact-name process check found no `x64sc`. The execution owner ran the selected
controls sequentially, then two separate identity-retaining observer probes.
Every successful observer invocation awaited the unchanged owned-process teardown.
Post-run and final exact-name checks found no `x64sc`. At **11:16 CEST the primary
explicitly released the window**. Future emulator work needs renewed coordination.

No genuine application or skill exists from these controls. Constant-wrong modules
are deliberately incorrect test inputs, never stand-in implementations. Results
do not qualify the authoring skill, Slither, expert costs, all interrupt routes,
other profiles, release hosts or physical hardware.

## Selected Frozen-Oracle Run

Command from the repository root:

```text
yarn vitest run test/developer-skill/authoring.spec.test.ts --testNamePattern 'compiled control always|owned fixture has'
```

| Result | Count | Endpoint |
| --- | ---: | --- |
| Selected passed controls | 12 | Two actual semantic mismatches and ten malformed/binding rejections |
| Failed | 0 | No setup/import failure counted as successful control |
| Unexecuted positive-author cases | 2 | Genuine source is still absent; these are not passed |

The two semantic controls require successful real public builds, the pinned VICE
identity and actual observed memory values. Unknown cannot satisfy them. The ten
other cases reject missing globals, wrong widths, missing/disconnected markers,
invalid locations, wrong generation/PRG/source/profile/mode bindings. Successful
real builds and completed mutations are asserted before crediting rejections.

The corrected authoring oracle SHA-256 is
`dd085a89b1b8ad08af198f520beb30d2aa0a9fada6edfdbad4b410fe8b7f9613`.
The unchanged package oracle is
`cf743b9898c43e7a4d5aff0a3e327f103e890c7c691fd65089d3411faf16147e`.
The observer is
`ddd314f7f30155fc889a727eded9566230fd60f18e9f397482d100bbe466654e`.
All three identities were checked before runtime; no oracle expectation changed.

## Separate Exact-Identity Probes

Two additional calls observed the same constant-wrong modules and fixed wrappers
through the public observer and retained its returned identities. These are
separate executions, not invented identities for the preceding Vitest run.

For this one-shot capture, the existing TypeScript compiler emitted the observer
and unchanged M1 helper dependencies into owned scratch. A temporary package link
resolved only the current checkout's public `@blend65/compiler`; no other
worktree, implementation fork, new dependency or installed tool was consumed.
The ordinary exported observer then ran directly in Node. This scratch mechanism
is not a supported runner or product surface and is removed at cleanup.

| Field | Score wrong-module probe | Patrol wrong-module probe |
| --- | --- | --- |
| Generation | `ac8eabf4-8e6a-4659-aabc-da3b9222e9c8` | `79e1ed9d-9e2e-4f4c-afce-d3eb7efaec45` |
| Actual values | Six zero words | Ten zero positions and ten `false` directions |
| Completion interval, half-open | `$0A4B–$0A50` | `$0BF8–$0BFD` |
| Exact expression source span | Source index 2, `[578,604)` | Source index 1, `[1092,1118)` |
| Marker bytes in this artifact | `a9 0d 8d 20 d0` | `a9 0d 8d 20 d0` |
| PRG SHA-256 | `b79e12366cffcabad51f269ad81eab9ac2e00b9a6aad416024ed493007114a89` | `15843c0741abe315924f4d01f97d633e54dc6b0fe00e2a51bab1bf7b2ffbc779` |
| Build sidecar SHA-256 | `6c351f26805ec49476b8afb08c72a276a1c8a9fe8166536f1d7882c1f72dbc38` | `78f3f03f5b664cc07b16b4205b797d3e183a66efa8e833dd4cac5ddccc592d46` |
| Debug sidecar SHA-256 | `78bb112878edf9d4a77459c938ed9c404ae7cd073e1385789cc042a43bc84273` | `34870acbb4791ee161155d5287f21187faec9d529dbceaf8001a1c769dd95cd1` |

The fixed wrapper's final result stores precede the straight-line marker
expansion, followed by the startup-restore jump. Source-bound records identify
the complete expression, consistent owner/context/index references and contiguous
PRG interval. The earlier build-only inspection in
[the review](09-observer-pre-runtime-review.md) and these repeat probes have the
same PRG identities. Actual owned execute-checkpoint arrival confirms the selected
entry was reached; observations are read before executing the marker. These facts
are specific to these pinned artifacts, not a universal proof that adjacency
identifies an operation. Genuinely authored artifacts still need their entry proof.

The live selected model and DDR/port predicates passed before any result read;
the helper records no stronger full-port or machine-state trace. The independent
static reviews did not inspect raw temporary artifacts. Runtime evidence here is
execution-owner-observed, not an additional independent artifact audit.

## Input and Tool Identities

Both repeat probes run on Linux x64 with Node `22.23.1`. ACME is version `0.97`,
executable SHA-256
`19485b0605ddae23897d07cde5fd05c7e0c40eea530668db0b86e68e9f45c4f8`, with
portable options `--cpu=6502 --strict-segments --format=cbm`.

| Manifest | Bytes | SHA-256 |
| --- | ---: | --- |
| Score `blend65.json`, project `observer-score` | 211 | `0dae767b5ab09df1f0ff32612c8dab4c4fe04f0a75cb46a73a738c7dd8ea5c5e` |
| Patrol `blend65.json`, project `observer-patrol` | 212 | `7b33fe386c7316a56775a5f9be0b23720de3d93c3dc2545541f668a8d7092745` |

These owned manifests use schema 1, `sourceRoot: "src"`, `entry: "Game"`,
`assetPaths: []`, `outDir: "out"`, and the exact target/options below. Their
different project names are why this identity capture is explicitly separate
from the frozen-oracle run; the raw source/PRG identities remain recorded.

The selected target is `c64-pal-prg-kernal-6581`, CPU `nmos6510`, emitter
`acme-0.97`, packager `cbm-prg`; optimization is `none` and both checks are false.
No introduced IRQ/NMI/audio route belongs to these wrappers. The 100,000,000-cycle
limit and 60-second checkpoint timeout are termination guards, not measured costs.

| Emitted build identity | Version | SHA-256 |
| --- | --- | --- |
| `blend65` | `0.1.0` | `58c3d257272c0520e731c4f0b4b7b3f9271c8fdaaf238225d5d6e184dfbcd11e` |
| `blend65-language` | `4.0` | `7dcd4998f84d5d6099946f673ce426e314046fb32f5ab8edea7d606d2bd1c651` |
| `blend65-domain-expert` | `2.0.4` | `1a2039ffb5d887e8ca221b21dd2d022fd6d06ec375771a413c01cd8c7e252f30` |

These are emitted sidecar identities, not aliases for the separately recorded
qualified expert content commit `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15` or
Specification knowledge identity. Compiler/stdlib source is unchanged in this
feature; the source checkout and exact observer/oracle revisions are recorded
above. A changed identity requires affected-proof refresh, not silent mixing.

| Raw source | Probe | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `@blend65/stdlib/c64/input.blend` | Both | 16118 | `d5c3129c80fea3cdc13e08edc22b53241b10f4a86cde9ef4524306baa23e29c7` |
| `src/award-math.blend` | Score | 88 | `0826d887c1ae41b78709664948009959e54c3fbbee1118e3a21b8689580a8b1e` |
| `src/game.blend` | Score | 608 | `43e9658472ba36fc97603b6f76aa62e23c203da523bc9adf672f29fc8b272b92` |
| `src/score.blend` | Score | 97 | `165a43da4077e1886684ff9d07af9d279337175fd94eca3e7107f724ef7f58bd` |
| `src/game.blend` | Patrol | 1122 | `486c0277609b9d851c124cee103b8ba07d9ec22d308fec125e19bbc14905c14e` |
| `src/patrol.blend` | Patrol | 177 | `2917369fa73738d66405d5e6f9901a3d2f8a392e313f696bbfef6baa8dee7b08` |

VICE executable SHA-256:
`f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`.

| ROM | Bytes | SHA-256 |
| --- | ---: | --- |
| `kernal-901227-03.bin` | 8192 | `83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721` |
| `basic-901226-01.bin` | 8192 | `89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d` |
| `chargen-901225-01.bin` | 4096 | `fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420` |

## Remaining Obligations

Owned ROM/MMIO-location, wrong-port and installed-inventory regression cases
remain with the already planned implementation tests. Full-phase verification,
fresh skill/application authoring, native loading and genuine behavior outcomes
remain open. Slither's rights/profile/player gates are unchanged. No local meet,
expert-output, full resource/interrupt bound or silicon proof follows here.
The bounded runtime endpoint is **VICE-verified / hardware-unverified**.
