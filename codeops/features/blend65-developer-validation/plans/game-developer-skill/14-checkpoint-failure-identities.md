# Checkpoint Failure Identities

> **Status**: Static evidence receipt for the one AR-P5 checkpoint, not an exclusion list
> **Baseline**: `e715977d729212eb62d03e4ece8646c4af313aa8`
> **Observed**: 2026-10-16–17; retained at closeout on 2026-10-18
> **CodeOps Artifact Schema**: 1

The [checkpoint record](13-checkpoint-blocker.md) owns causes, provenance,
counts and claim boundaries. This receipt preserves the exact failed names when
disposable reports are deleted. No test runner consumes it. No file-wide,
count-only or future failure allowance follows from it.

## Exact Name Expansion

Each literal `<profile>` below expands once for each of these four strings:

- `c64-pal-prg-kernal-6581`
- `c64-pal-prg-kernal-8580`
- `c64-ntsc-prg-kernal-6581`
- `c64-ntsc-prg-kernal-8580`

Every other character is literal, including the Unicode ellipsis in four Vitest
full names. Code blocks contain one name per line. Compiler reporter hierarchy
separators are normalised to spaces, as in root JSON `fullName` fields. Sorted
compact JSON name-set digests use UTF-8, `ensure_ascii=false` and comma/colon
separators. Root per-file digests are in the checkpoint record; the 14 compiler
names have digest `d8206339406ade0129e06dce2b210d52fd619176a152200e128b41ef123c1545`.

### `packages/compiler/src/services/input-size-frontier.spec.test.ts` — 14

```text
closed version-one cost evidence should preserve a rejected baseline and feasible selection when costs round-trip
complete size frontier on <profile> should close a bounded recipe inventory for 32 ordinary sites
complete size frontier on <profile> should close a bounded recipe inventory for 64 ordinary sites
complete size frontier on <profile> should fit an ordinary seventy-two-function returned pair despite a rejected reference
last-good size publication should preserve every last-good byte after a source failure in size
```

### `test/rd05/input-acquisition-output.spec.test.ts` — 4

```text
input acquisition output on <profile> charges the scoped NMI route and complete caller rather than a scan-only estimate
```

### `test/rd05/input-library-output.spec.test.ts` — 4

```text
complete input library output on <profile> bounds the ordinary dynamic caller by one complete equal-contract expert artifact
```

### `test/rd05/input-saved-query-output.spec.test.ts` — 4

```text
saved input output on <profile> fits the complete expert saved-query caller without copied snapshots or uncharged storage
```

### `test/rd05/joystick-api-output.spec.test.ts` — 8

```text
joystick public API and assembled output on <profile> should preserve a stored readJoystick1 sample and account for its bytes and resources
joystick public API and assembled output on <profile> should preserve a stored readJoystick2 sample and account for its bytes and resources
```

### `test/rd05/nmi-route-initializer-temporaries.spec.test.ts` — 4

```text
Initializer and IRQ compiler-temporary separation on <profile> should separate a saved initializer byte from actual retained IRQ compiler temporaries
```

### `test/rd05/nmi-route-retained-call-lifetimes.spec.test.ts` — 4

```text
retained call lifetimes on <profile> should preserve caller bytes and reuse compatible helpers for finite calls
```

### `test/rd05/profile-pipeline.spec.test.ts` — 8

```text
real terminal admission on <profile> should preserve cooperative startup and return with no profile or SID setup cost
real terminal admission on <profile> should load initialized fixed data once inside the common resident layout
```

### `test/rd05/returned-local-output.spec.test.ts` — 8

```text
returned locals construct in the caller result on every cooperative profile should reduce ordinary code and complete storage without hidden growth on <profile>
returned locals construct in the caller result on every cooperative profile should remove acquisition result copies with no extra variant or net resource growth on <profile>
```

### `test/rd05/vic-collision-output.spec.test.ts` — 32

```text
VIC collision output on <profile> should retain every sampled bit when 'readAndClearSpriteSpriteCollisions' is used as a byte value
VIC collision output on <profile> should retain every sampled bit when 'readAndClearSpriteBackgroundCollisions' is used as a byte value
VIC collision output on <profile> should keep one direct read when the result of 'readAndClearSpriteSpriteCollisions' is discarded
VIC collision output on <profile> should keep one direct read when the result of 'readAndClearSpriteBackgroundCollisions' is discarded
VIC collision output on <profile> should keep three ordered reads when a discarded 'readAndClearSpriteSpriteCollisions' call is followed by two repeats
VIC collision output on <profile> should keep three ordered reads when a discarded 'readAndClearSpriteBackgroundCollisions' call is followed by two repeats
VIC collision output on <profile> should preserve the exact register sequence when the calls run 'sprite then background'
VIC collision output on <profile> should preserve the exact register sequence when the calls run 'background then sprite'
```

### `test/rd08/input-byte-selection.spec.test.ts` — 56

```text
byte availability on <profile> should retain the left byte through comparison and AND for every byte pair
byte availability on <profile> should preserve captured 128 against 129 across calls loads and restored status 0
byte availability on <profile> should preserve captured 255 against 255 across calls loads and restored status 1
byte availability on <profile> should preserve captured 0 against 1 across calls loads and restored status 8
byte availability on <profile> should preserve captured 3 against 1 across calls loads and restored status 9
byte availability on <profile> should return canonical Booleans for 0 and branch only from certified exits
byte availability on <profile> should return canonical Booleans for 1 and branch only from certified exits
byte availability on <profile> should return canonical Booleans for 128 and branch only from certified exits
byte availability on <profile> should return canonical Booleans for 255 and branch only from certified exits
byte availability on <profile> should reuse one complement of stable byte 0 across two fixed loops
byte availability on <profile> should reuse one complement of stable byte 255 across two fixed loops
byte availability on <profile> should invalidate a complement after body writes and raw alias 12800
byte availability on <profile> should invalidate a complement after body writes and raw alias 49456
byte availability on <profile> should retain volatile samples and skip an effectful producer in a zero-trip loop
```

### `test/rd08/input-loop-storage.spec.test.ts` — 20

```text
word loops and private storage on <profile> should preserve eight ordinals and ordered nested pairs in size mode
word loops and private storage on <profile> should preserve wide counters, borrows, break, continue and live-outs in size mode
word loops and private storage on <profile> should retain eight volatile read-write pairs and early or unknown exits in size mode
word loops and private storage on <profile> should preserve surviving values across dead writes, calls and argument delivery in size mode
word loops and private storage on <profile> should share only the homes of access-disjoint byte scopes in size mode
```

### `test/rd08/input-object-facts.spec.test.ts` — 32

```text
fixed object facts on <profile> should read runtime fields through two ordinary forwarding parameters in size mode
fixed object facts on <profile> should keep differing objects and an address-taken entry callable in size mode
fixed object facts on <profile> should preserve a crossing field and member or unsized borrows in size mode
fixed object facts on <profile> should retain a captured readonly field across mutation of its actual in size mode
fixed object facts on <profile> should retain a captured field across an unknown-address write in size mode
fixed object facts on <profile> should construct a returned pair through the same outer destination in size mode
fixed object facts on <profile> should preserve old destination observations until the outer return publishes in size mode
fixed object facts on <profile> should preserve overlapping return values and distinct nested results in size mode
```

### `test/rd08/input-size-mode.spec.test.ts` — 3

```text
public input size mode should write seven when an ordinary byte helper is built with size
public input size mode should publish size evidence when the built CLI receives an explicit size option
public input size mode should reproduce portable evidence when two clean projects are built with size
```

### `test/rd08/input-size-runtime.spec.test.ts` — 64

```text
ordinary size input runtime on <profile> should preserve saved bytes and classify 'released contacts' without fresh device access
ordinary size input runtime on <profile> should preserve saved bytes and classify 'one closed SPACE contact' without fresh device access
ordinary size input runtime on <profile> should preserve saved bytes and classify 'a floating two-column two-row ghost b…' without fresh device access
ordinary size input runtime on <profile> should preserve saved bytes and classify 'overlapping unequal row sets' without fresh device access
ordinary size input runtime on <profile> should preserve saved bytes and classify 'one grounded PB row without a grounde…' without fresh device access
ordinary size input runtime on <profile> should preserve saved bytes and classify 'one grounded PA column without a grou…' without fresh device access
ordinary size input runtime on <profile> should preserve saved bytes and classify 'non-complete acquisition quality 1' without fresh device access
ordinary size input runtime on <profile> should preserve saved bytes and classify 'non-complete acquisition quality 2' without fresh device access
ordinary size input runtime on <profile> should preserve saved bytes and classify 'non-complete acquisition quality 255' without fresh device access
ordinary size input runtime on <profile> should read a wrapped word once in little-endian bus order
ordinary size input runtime on <profile> should read runtime word-indexed VIC mirrors without a page-cross dummy device read
ordinary size input runtime on <profile> should preserve acquisition effects and caller state for 'released inputs with stopped timers'
ordinary size input runtime on <profile> should preserve acquisition effects and caller state for 'released inputs with running timers a…'
ordinary size input runtime on <profile> should preserve acquisition effects and caller state for 'timer A PBON contamination'
ordinary size input runtime on <profile> should preserve acquisition effects and caller state for 'timer B PBON contamination'
ordinary size input runtime on <profile> should preserve live returned pairs and refresh shared complements across a chained IRQ
```

### `test/rd08/input-startup-selection.spec.test.ts` — 52

```text
startup selection on <profile> should restore varied status, CPU ports, CIA2 direction, and all seven borrowed bytes in size mode
startup selection on <profile> should restore two independently chosen caller stack pointers in size mode
startup selection on <profile> should retain full startup for a volatile display-state dependency in size mode
startup selection on <profile> should restore discontiguous borrowed objects without omitting their distant bytes in size mode
startup selection on <profile> should retain full startup for a raw stack-page observer in size mode
startup selection on <profile> should retain full startup for an opaque initializer address in size mode
startup selection on <profile> should retain full startup for an unproved source bank write in size mode
startup selection on <profile> should preserve nested balanced status saves and a stack observer in size mode
NMI startup boundaries on <profile> should preserve an actual accepted NMI at 'before publication' in 'size' mode
NMI startup boundaries on <profile> should preserve an actual accepted NMI at 'after publication' in 'size' mode
NMI startup boundaries on <profile> should preserve an actual accepted NMI at 'before removal' in 'size' mode
NMI startup boundaries on <profile> should preserve an actual accepted NMI at 'after removal' in 'size' mode
NMI startup boundaries on <profile> should preserve an actual accepted NMI at 'normal restore' in 'size' mode
```

## Root Assertion Receipts

Each digest hashes sorted `[fullName, failure-message-prefix]` pairs as compact
JSON with the same encoding above. The prefix stops before the first stack-frame
`\n    at `, retaining the actual assertion/diagnostic rather than host paths and
runner frames. These digests were captured from complete per-file JSON reports.
Source assertions and the causal code remain recoverable at the pinned baseline;
the checkpoint record identifies the failure family and representative values.
They do not establish that a failing expectation is obsolete or wrong.

| File under `test/` | Assertion-set SHA-256 |
| --- | --- |
| `rd05/input-acquisition-output.spec.test.ts` | `17f0bbaaaaf25736cd47ec4c19d19c84def647a541c55204dda760185162adcb` |
| `rd05/input-library-output.spec.test.ts` | `1dd161835567b2582876df3d05086995980ddb74ed4d770a31c2a228a9e9c5fd` |
| `rd05/input-saved-query-output.spec.test.ts` | `c2440da149d365d1a4e88db87f3570f7856f5687db26b549e7fb3bcc48a942f7` |
| `rd05/joystick-api-output.spec.test.ts` | `d055637d451735bea014c8be6381d169116e6397e3514cd34d06eb24c9e79d71` |
| `rd05/nmi-route-initializer-temporaries.spec.test.ts` | `0db533a390e70e70c5dd264299274bf8ba6c4f2461c7472840062ff24bf6ad6d` |
| `rd05/nmi-route-retained-call-lifetimes.spec.test.ts` | `6b0dc9e196af071f0e5f9d9e87fe66b35e9624306669864c580be2a6deb27778` |
| `rd05/profile-pipeline.spec.test.ts` | `1ae83bb49a74e48b382234ca2e164653f562d1b8edef2b4e509b5abc523f060e` |
| `rd05/returned-local-output.spec.test.ts` | `bd1baa1dab5f2adb7e5b5228c28be114fb74a8a696f03fe602a1d1d0652f47ac` |
| `rd05/vic-collision-output.spec.test.ts` | `f1ce51d8c90af951a379e35044e7a42a37a9628c867b8eb6020b2d39e9cca704` |
| `rd08/input-byte-selection.spec.test.ts` | `a605e6dcf4f5e2516e5a4cac7b2304c1f5ec9560e735f5004dc40d797583a6e3` |
| `rd08/input-loop-storage.spec.test.ts` | `41e5e1939a497795ccbe4f84db42b7501f88d0d89c68126d1569e5ebc5d3dd72` |
| `rd08/input-object-facts.spec.test.ts` | `6e7f1467f5a38fec28a5a5917c2bc1b16f6ac8c3d9b5b156a77e7b8b5c3a6a1b` |
| `rd08/input-size-mode.spec.test.ts` | `11c6c441bac0c83dd4d84fa2c06f4b04d3a462edc2ecec1563d39bde0d6b1464` |
| `rd08/input-size-runtime.spec.test.ts` | `4b2fdc5e71f789a0a9a8e29bb28a50c5eeb6d6893fd75372b9eaf09fdcad59c2` |
| `rd08/input-startup-selection.spec.test.ts` | `a08f80a8d83379815fd017856bcff3104dc3fc4701b62b816ddf3e4a18ca8694` |
