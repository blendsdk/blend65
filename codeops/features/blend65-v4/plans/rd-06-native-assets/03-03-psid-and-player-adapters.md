# PSID and Player Adapters: RD-06 Native Assets

> **Document**: 03-03-psid-and-player-adapters.md
> **Parent**: [Index](00-index.md)

## Overview

This component owns the qualified PSID v1–v4 data handler and the closed callable-audio seam. The
PSID handler validates the container, resolves the effective load/init/play addresses, and exposes
`"data"`, `"init_address"` and `"play_address"`. It never infers a sound-effect ABI, writable state,
interrupt ownership, cadence or mixer.

Callable audio is a separate contract. A plain PSID remains legal embedded data. `c64.audio`
operations require one exact hash-bound `AudioPlayerContract`; the baseline map is empty, so every
call on a plain PSID is E10256. The GoatTracker 2.77 adapter is moved out of RD-06 to a later
follow-up (AR-58); this plan delivers the generic seam and the empty contract map only.

## Architecture

### Current architecture

No PSID or audio code exists. `.sid` files reach the generic native stub and return E10204. There is
no `c64.audio` platform module, no player contract, and no E10256/E10257/E10258/E10261 producer.

### Proposed changes

```text
.sid file
  -> PSID container validation (magic, version, data offset, fields, flags, payload)
  -> effective load/init/play resolution
  -> typed outputs + fixed-load constraint + compatibility facts
  -> ordinary embedded data (no callable implication)
  -> optional c64.audio operation
       -> exact contract lookup by asset hash + selected profile facts
       -> direct register setup + absolute JSR
       -> no scheduler, mixer, queue, IRQ or name table
```

The handler lives in `packages/compiler/src/assets/c64/psid.ts`. The contract record lives in
`packages/compiler/src/assets/c64/audio-contract.ts`. Operation lowering and whole-program E10258
activation are gated on the first registered contract (AR-59); Phase 2 delivers the contract
record, E10256/E10257 validation and the domain-overlap primitive only.

## Implementation Details

### PSID container validation

Header layout used by the accepted v1–v4 subset:

| Offset | Size | Field | Rule |
| --- | --- | --- | --- |
| `$00` | 4 | Magic | ASCII `PSID`; `RSID` is E10204 |
| `$04` | 2 | Version (BE) | 1–4 only |
| `$06` | 2 | Data offset (BE) | `$0076` for v1, `$007C` for v2–v4 |
| `$08` | 2 | Load address (BE) | Zero means the payload supplies it |
| `$0A` | 2 | Init address (BE) | Zero resolves to the effective load address |
| `$0C` | 2 | Play address (BE) | Nonzero and inside the emitted payload interval |
| `$0E` | 2 | Songs (BE) | `1..256` |
| `$10` | 2 | Start song (BE) | `1..songs` |
| `$12` | 4 | Speed (BE) | Reserved; accepted as declared |
| `$16` | 32 | Name | Accepted, never emitted |
| `$36` | 32 | Author | Accepted, never emitted |
| `$56` | 32 | Released | Accepted, never emitted |
| `$76` | 2 | Flags (v2+) | Clock/model/second/third model bits; MUS/PlaySID bits rejected |
| `$78` | 1 | Start page (v2+) | Must be zero for the self-contained subset; nonzero relocation is E10204 |
| `$79` | 1 | Page length (v2+) | Must be zero for the self-contained subset; nonzero relocation is E10204 |
| `$7A` | 1 | Second SID address (v3+) | Nonzero only if the profile supports it; otherwise E10261 |
| `$7B` | 1 | Third SID address (v4+) | Nonzero only if the profile supports it; otherwise E10261 |
| `$76` / `$7C` | — | Payload start | Exact data offset for the version |

The exact HVSC format-description identity is source key `HVSC-SID-FORMAT-20260906`, SHA-256
`b89a78d3c1d90d0b8c6b4cfd2001be026ad6c2c31b73cdbab857c627a60779f0`. The handler validates every
version-specific field, reserved bit, relocation range, SID address, song count and start-song
range before exposing a selector. Unknown or unsupported structure is E10204.

### Effective addresses

```text
if header load != 0:
    effectiveLoad = header load
    dataBytes = payload bytes from dataOffset to EOF
else:
    effectiveLoad = little-endian first two payload bytes
    dataBytes = payload bytes after those two bytes

effectiveInit = header init != 0 ? header init : effectiveLoad
require effectiveInit inside [effectiveLoad, effectiveLoad + dataBytes.length)
require play != 0 and play inside the same interval
require effectiveLoad + dataBytes.length <= $10000
```

`"data"` is the exact `dataBytes` sequence. `"init_address"` and `"play_address"` are words. `"data"`
is the default selector. The handler never relocates, copies, retimes or retunes the payload.

### Compatibility

| Field | Values | Rule |
| --- | --- | --- |
| Video standard | Unknown, PAL, NTSC, Both | Specific incompatible profile → E10261 |
| Primary SID model | Unknown, 6581, 8580, Both | Specific incompatible profile → E10261 |
| Second/third SID model | Inherit primary, 6581, 8580, Both | Any second/third endpoint on the one-SID profile → E10261 |
| SID address | `$D400` baseline | Any other address → E10261 |
| Unknown | No restriction | Embed-only legal; callable use still needs a contract |

`Unknown` is not `Both`. No automatic conversion, retiming, retuning, filter translation or hardware
activation occurs.

### Fixed-load placement

`"data"` carries a handler constraint:

```text
kind: "at", origin: "handler", addressSpaceId: "cpu16", start: effectiveLoad
```

Source `place(at: ...)` must match exactly. A different `at` is E10273 naming the handler constraint
and the source clause. An effective interval outside the resident range, or one that cannot satisfy
source `align`/`noCross`, is E10143. The linker places the payload exactly at the effective load
address; it never relocates it at runtime (AR-47).

### Callable-audio contract

The closed record is `AudioPlayerContract` (AR-44). It declares:

```ts
export interface AudioPlayerContract {
  readonly identity: { readonly family: string; readonly version: string; readonly sha256: string };
  readonly assetSha256: readonly string[];
  readonly placement: "fixed" | "relocatable";
  readonly entries: { readonly init: number; readonly tick: number; readonly sfx?: number };
  readonly writableRanges: readonly { readonly start: number; readonly end: number }[];
  readonly selfModifyingRanges: readonly { readonly start: number; readonly end: number }[];
  readonly banking: readonly string[];
  readonly effects: {
    readonly registers: string;
    readonly flags: string;
    readonly decimal: "binary-required" | "preserved" | "cleared";
    readonly interruptState: "preserved" | "cleared" | "restored";
    readonly port01: "preserved" | "required-value";
    readonly stackBytes: number;
    readonly ramBytes: number;
    readonly zeroPageBytes: number;
    readonly mmioRanges: readonly { readonly start: number; readonly end: number }[];
  };
  readonly songs: {
    readonly count: number;
    readonly defaultSong: number;
    readonly names: readonly string[];
    readonly dynamicNumeric: boolean;
    readonly numericRange?: { readonly min: number; readonly max: number };
  };
  readonly effectsInventory: {
    readonly names: readonly string[];
    readonly priority: string;
    readonly replacement: string;
    readonly resume: string;
    readonly sameFrame: string;
  };
  readonly voices: readonly { readonly logical: 0 | 1 | 2; readonly channelOffset: 0 | 7 | 14 }[];
  readonly video: readonly ("PAL" | "NTSC")[];
  readonly sidChips: readonly { readonly address: number; readonly model: 6581 | 8580 }[];
  readonly cadence: string;
  readonly callDomains: readonly string[];
  readonly interruptOwnership: string;
  readonly ciaOwnership: string;
  readonly sidFilterOwnership: string;
  readonly reentrant: false;
  readonly featureSizes: readonly { readonly feature: string; readonly codeBytes: number; readonly dataBytes: number }[];
  readonly costs: EvidenceRecord;
}
```

The baseline `audio_player_contracts` map is empty. `c64.audio` capabilities exist and validate their
arguments against the asset provenance and selected profile. A plain PSID call is E10256. A contract
missing the requested operation, cue, numeric form or voice is E10257. Any non-reentrant operation
reachable from two concurrent domains is E10258 (AR-13). A contract that conflicts with the selected
video/model/topology is E10261.

### GoatTracker 2.77 binding (moved out of RD-06)

The adapter must bind the exact GoatTracker 2.77 archive and member hashes, exported player/data
identity, and selected feature set:

- init with subtune in A, then `JSR start`;
- one tick with `JSR start+3`;
- optional `-Dx` SFX with effect address in A/Y and channel offset `0`, `7` or `14` in X to
  `JSR start+6`;
- feature-pruned exports and every code/data/writable/self-modifying/ZP/stack/register/flag/banking/
  cadence/IRQ/cycle obligation.

This work is moved to a follow-up feature (AR-58). It is not a task or closeout gate in this plan.
The `AudioPlayerContract` record remains in the design so the follow-up can attach one exact
contract without changing the compiler seam.

### Error handling

| Error case | Handling strategy | AR Ref |
| --- | --- | --- |
| RSID, MUS, PlaySID dependency | E10204 before selector exposure | AR-21 |
| Wrong data offset or version-specific length | E10204 naming the field | AR-21 |
| Zero play address or entry outside payload | E10204 | AR-21 |
| Load interval wraps or overflows | E10204 | AR-12 |
| Songs/start song out of range | E10204 | AR-21 |
| Specific incompatible video/model/topology | E10261 | AR-21 |
| Payload interval under a visible character/BASIC ROM window | E10261; no banking is inferred | AR-21 |
| Plain PSID used with `c64.audio` | E10256 naming the missing contract | AR-2, AR-44 |
| Contract lacks operation/cue/voice | E10257 listing available forms | AR-44 |
| Non-reentrant overlap | E10258 with both reachable domains | AR-13 |
| Source placement conflicts with fixed load | E10273; a one-object handler-only failure is E10143 | AR-11, AR-47 |

## Testing Requirements

- Every accepted version with fixed-load and payload-load-address forms.
- Exact data offsets, big-endian headers, little-endian embedded load address stripping, zero init
  resolution, exact payload hashes and in-range nonzero play addresses.
- Every rejection class listed in AC-17 and AC-18.
- Plain PSID → E10256 for each audio operation; empty contract inventory.
- Contract validation, feature pruning, voice mapping, name lookup and cost records with synthetic
  contract fixtures (not GoatTracker qualification).
- The domain-overlap primitive, positive and negative, until the first contract activates
  whole-program E10258 (AR-59).
- Fixed-load placement and conflict tests.
- Bounded VICE check that the payload lands at the effective load address and is CPU-readable.
- GoatTracker 2.77 qualification is a separate follow-up feature.
