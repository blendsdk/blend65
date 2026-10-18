# Slither: Public Compiler Support Probes

> **Status**: Verified partial — native-import failure reproduced, no callable player qualified
> **Date**: 2026-10-18
> **Codebase**: `0b481d4c6be20546b19280fc74baf498d29348be`; compiler unchanged
> **CodeOps Artifact Schema**: 1

## Purpose and Boundary

The user handles licensing under combined-port AR-P6. Continue technical work
without a licence-research gate, contacting third parties or claiming clearance.
This record turns the earlier static support gap into actual public-service and
CLI results. It does not implement a compiler feature, player adapter or port.
No existing test, requirement, frozen authority or skill is changed. The failed
probes are support evidence, not new immutable tests or a green compiler result.

## Exact Inputs and Public Endpoint

The only downloaded fixture is `data/slither_r.sid` from upstream
`31347444d9547210f698ac98961e794ea671d276`, fetched from its fixed HTTPS raw URL.
Redirect identity, exact size **3343 bytes** and SHA-256
`239a2cae4feeca8408381196a33eaa212491b985d746cd9cf86d17773c4c446a` are checked.
The existing decoded PSID facts are one PAL/MOS8580 song, 3217 payload bytes at
`$1000`, init `$1000`, play `$1003`. Metadata does not establish a player ABI.

A fresh `yarn build` passes. `@blend65/compiler` resolves through its public
package export to this checkout's `packages/compiler/dist/index.js`. The same
216 generated JavaScript files retain combined SHA-256
`1764f571dc0578bd56a31fec50c957c645fa8bf30eae1474b3d3d8a278d367ab`.
Host: Linux, Node 22.23.1. No emulator starts or VICE window is reserved.

Each probe has an owned temporary `src/game.blend`, `assets/` and explicit
`blend65.json`. This is the representative native-data manifest; other probes
change only `name`, while the import-only probe uses an empty `assetPaths`:

```json
{
  "schemaVersion": 1,
  "name": "native-data",
  "sourceRoot": "src",
  "entry": "Game",
  "target": "c64-pal-prg-kernal-8580",
  "assetPaths": ["assets"],
  "outDir": "out",
  "optimization": "none"
}
```

Public calls are `checkProject({ project })` and `buildProject({ project })`.
The built public CLI is also invoked with literal arguments:
`node packages/cli/dist/bin.js check --project <owned-manifest>` and the matching
`build` command. No upstream script, shell interpolation, private compiler API
or generated-file edit is used. Initial scratch invocation incorrectly selected
Node's `-` argument as its fixture root and failed writing its report; it is
excluded from the results. The corrected invocation validates the actual owned
canonical path and supplies each exact manifest explicitly.

## Reduced Sources

The native-data case is exactly:

```blend65
module Game;
const AUDIO: byte[] = embed("slither_r.sid", "data");
export function main(): void { c64.vic.setBorderColor(AUDIO[0] & 15); }
```

The default-selector case omits `, "data"`. Metadata cases instead declare
`const INIT: word = embed("slither_r.sid", "init_address");` or
`const PLAY: word = embed("slither_r.sid", "play_address");` and use the selected
word's low four bits as the border value. These are format-import probes, not
calls to an unqualified player.

The source-audio case is exactly:

```blend65
module Game;
import { audioInit, audioTick } from c64.audio;
const AUDIO: byte[] = embed("slither_r.sid", "data");
export function main(): void { audioInit(&AUDIO, 0); audioTick(&AUDIO); }
```

It is deliberately blocked before claiming callable compatibility. The separate
import-only probe omits the asset/calls, imports `audioTick` from `c64.audio`,
and uses `c64.vic.setBorderColor(0)` as its entire main body. It distinguishes
that public source surface from the earlier native-import diagnostic but does
not establish its precise internal cause.

## Observed Results

| Case | Public check and build | Boundary actually reached |
| --- | --- | --- |
| Native default selector | Both `failure/source`, E10204 | Registered native import is not implemented; no format-aware data result |
| Native `"data"` | Both `failure/source`, E10204 | Same; span `src/game.blend:35..65` |
| Native `"init_address"` | Both `failure/source`, E10204 | Same; no init metadata result |
| Native `"play_address"` | Both `failure/source`, E10204 | Same; no play metadata result |
| Native asset plus `c64.audio` operations | Both `failure/source`, E10204 | Asset failure precedes callable-player validation; not an observed E10256 |
| `c64.audio` import without an asset | Both `failure/compiler`, `COMPILER_INCOMPLETE` | “The frontend stage is not complete for this program”; no callable result or pinpointed subcause |
| Raw diagnostic control | Check/build succeed with no diagnostics | Same 3343 bytes as `slither_r.bin`, ordinary raw inclusion and border store only |

E10204's actual message is **“Registered native asset format is not yet
supported”**. The CLI confirms `native-data` and the native audio-operation
case with exit **3** for both check/build. Raw-control CLI check/build exit **0**.
There are fourteen corrected public-service calls and six CLI calls. These are
diagnostic invocations, not twenty passing specification tests.

The renamed `.bin` control preserves the entire SID file, including its header.
It does not strip the header, arrange executable placement or call any player
entry. It is **not** an acceptable integration workaround, playable music,
independent runtime proof or permission to ship raw player blobs.

| Raw control artifact | Public-service build | Separate CLI build |
| --- | --- | --- |
| Generation | `a9447934-63b2-4293-bcac-f2bcf47c3bc2` | `7556f63a-60a1-4af2-afb9-f7cad60cff70` |
| Build sidecar SHA-256 | `032620aaa605c6595ed170fd37924adae6819eebaad1f21202b32bd1562de3c2` | `901bd16199f524a124b69fc3e1c2de48c333ac993da37a12ca1e4ee00f3dea1b` |
| PRG bytes / SHA-256 | 3983 / `5671377b69ad007b1da92a17978bd165b0a09b9a72b8251f1716d210d6efc112` | Same |

All declared artifact lengths/hashes in both exact generations are checked.
These control sizes are not Slither's complete game, player or expert costs.
Native player code/data layout, writable ranges, ZP/stack, cycles and generated
interrupt/SFA integration remain unqualified.

## Contract and Owner

Frozen [Chapter 13](../../../../spec/13-data-inclusion.md),
[Appendix C64 §7.3](../../../../spec/appendix-c64.md#73-sid-file-sid) and
[Chapter 15](../../../../spec/15-platform-profile.md) distinguish valid PSID
data/metadata from an exact callable-player contract. Valid import is not
permission to call the payload. The selected declaration-compatible profile
does not remove the contract or qualify an adapter.

The directly inspected current native-input branch is
`packages/compiler/src/frontend/service.ts:577–629`: native file extensions are
recognised, but successful raw resolution still terminates at E10204. This
explains the observed format-import endpoint, not the entire audio-import
frontend failure. The old static absence claim is not substituted for these
actual public results.

Existing **v4/RD-06 R6.20–R6.26** owns PSID parsing, metadata, compatibility and
qualified callable-player support. Its first required adapter is GoatTracker
2.77, not this SidTracker64 export. This handoff neither assigns accepted work
to another session nor approves a Slither-specific adapter or compiler fork.
No fix, frozen-oracle amendment or new E10256 expectation is made here.

## Evidence Receipts and Remaining Work

| Selected input/report | SHA-256 |
| --- | --- |
| Exact native-data source | `248f2d5e2a61e98431ff1be4ed1ad38d37f110d2ac3e6cd9edec2f1acf8f38dd` |
| Exact native-data manifest | `e0d93a702ac3c15ffcfb1263266c625871ffe3d40b083526d70bd96559795dfa` |
| Exact native audio-operation source | `80df447bd472c9832bd849d3e3060287a13e392330909f23c2a8dfb5ec502940` |
| Exact import-only source | `ca63f7ba8be28613f514cb76b8c9ad40030f96bc1d8e004551127d74289921c6` |
| Six-case public results | `a1a7ebc1110c57f142f85e3236907e2387208377abb2d30af5cbd0c0d0149f2a` |
| Import-only public results | `37d06caf971737475bb04c7686353a25d952b7fda9104de83026a659d396d247` |
| CLI results | `913d21e1ede9ea771e71d51090bf1442ac984b1da2d40f72c922fd2868278917` |

Raw diagnostic projects/reports are disposable; the exact reduced source,
manifest shape, fixture identity and actual endpoints are retained here.
Independent source-derived gameplay analysis can continue while the technical
player contract and public-support prerequisite remain open. Licensing is not
an agent blocker. Complete Slither still requires music/effects; no silent
substitution or incomplete-port success is allowed.

Lineage: expert 2.0.4/content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
Specification 4 identity
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`;
`c64-game-engineering.md#music-and-sound-effects` and
`c64-hardware.md#scheduling-and-ownership`. No new hardware/ABI doctrine, parity
or physical/runtime result is claimed.

## Documentary Checkpoint Review

Independent correctness reviewer `ses_eb1985cebffeSpWSN6Vgju090V`, explicitly
requested `openai/gpt-6-astra#high`, reports **no findings** for the five-file
checkpoint against `0b481d4c`. It reviews the parent-supplied existing-file
deltas and complete new repository additions, not denied temporary paths.
The previous external-directory denial remains respected. Oracle/source
preservation and raw execution results remain parent-supplied evidence. No
oracle exception or previous AR-P5 allowance is reused.

Independent target-platform reviewer `ses_eb197dc5affelOi4JoV2RHnW3N`, explicitly
requested `openai/gpt-6-astra#xhigh`, also reports **no findings**. It directly
checks the bounded source-derived geometry, update/input ordering, valid-BCD
cases and delay/audio mechanisms against the pinned original source. Public
probe measurements/hashes remain parent observations, not its own execution.
It reads no compiler implementation, protected path or raw temporary artifact
and starts no emulator. Prior historical routing-summary exposure is excluded.

The checkpoint keeps licensing user-owned without claiming clearance. It keeps
technical AR-P3/DEF-5 open and the complete port mandatory. Primary targeted
formatting, 27 local links/anchors, actual result/source/artifact hash pins,
citation bounds and protected-path checks pass; the existing roadmap engine
confirms 0/1 RDs on an owned temporary copy. Fresh `yarn build` passes, but no
fresh full-suite success, player ABI, hardware or full-port qualification is
claimed. The previous aggregate test RED is not reclassified by this work.

At 12:07 CEST the final source/manifest reproducer, target/options, artifact,
format/link and protected-path checks pass. The exact owned technical-probe
scratch—including downloaded SID/text inputs, temporary projects, raw-control
generations and intermediate logs—is removed without symlink traversal or
foreign-file changes. No `x64sc` process remains; this continuation launched
none. Only the local commit's temporary message/logs remain until that action
completes. Durable research/source facts and the user-owned licensing ruling
are retained; no publication, new support surface or compiler repair is made.
