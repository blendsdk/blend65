# Testing Strategy: RD-07 Loadable Assets and D64 Delivery

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage goals

| Code type | Target |
| --------- | ------ |
| Loadable/flow semantics | 95% branch coverage of new paths |
| Loader lowering and resource proof | 95% |
| D64 codec | 100% of format branches |
| Publication/run orchestration | 90% |
| Evidence producers/validators | 95% |

Tests state behavior: `should [expected behavior] when [condition]`. Specification tests derive
from the RD, Specification 4, and the plan's component docs; implementation tests derive from the
code after it exists.

## 🚨 Specification Test Cases (MANDATORY)

> Expectations come from the frozen specification, the RD, and the approved component contracts —
> never from imagined implementation behavior. The immutable-oracle rule applies.

### A. Loadable unit model

| # | Input / scenario | Expected output / behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | `loadable const N: byte = 7;` then `length(N)` | Builds; no resident bytes; logical size 1, bytes `[7]` | R7.1 |
| ST-2 | `loadable const A: byte[4] = [1,2,3,4];` | Unit size 4, bytes `[1,2,3,4]`, no resident interval | R7.1 |
| ST-3 | `struct S { a: byte; b: word; } loadable const S0: S = ...;` | Unit size 3, packed field order `a`, low `b`, high `b` | R7.1 |
| ST-4 | `loadable const L: LevelData = buildLevel(embed(...), ...);` | Unit size equals the exact struct size; bytes equal the composed logical value | R7.1, R7.6 |
| ST-5 | `loadable const DATA: byte[8] = embed("x.bin");` | Native/raw asset bytes become the unit payload; no E10204 | R7.1, AR-P16 |
| ST-6 | Two imports alias one loadable declaration | One unit identity and one disk entry | R7.6, R7.14 |
| ST-7 | Two distinct loadable declarations with identical bytes | Two unit identities and two disk entries | R7.6 |
| ST-8 | Unreachable function contains a load call to unit U | U contributes no entry, name, loader bytes, or reservation | R7.6 |
| ST-9 | Ordinary resident `const` and its loadable twin | Resident twin has an address; loadable twin has none and no resident bytes | R7.8 |
| ST-10 | `loadable const X: byte[] = ...;` | Existing type rejection; no artifact | R7.1 |
| ST-11 | `loadable const X: byte = runtimeValue;` | E10191; no artifact | R7.1 |
| ST-12 | `loadable const DATA: byte[2048] = embed("charset.ctm", "charset");` | Unit carries the handler's 2048-byte alignment/VIC constraint to its destinations | R7.1, R7.3 |

### B. Load operation and destination

| # | Input / scenario | Expected output / behavior | Source |
|---|------------------|----------------------------|--------|
| ST-13 | `c64.loader.load(U, moduleObject)` on the D64 profile | Compiles; one destination candidate; boolean result | R7.4 |
| ST-14 | Destination is a local | Compiles; local is a complete mutable interval | R7.3 |
| ST-15 | Destination is a mutable parameter place | Compiles when lifetime covers the result use | R7.3 |
| ST-16 | Destination is `obj.field` | Compiles; candidate offset is the field offset | R7.3 |
| ST-17 | Destination is `obj.a.b` nested field | Compiles; exact nested range | R7.3 |
| ST-18 | Destination is `array[3]` with constant index | Compiles; one candidate | R7.3 |
| ST-19 | Destination is `array[i]` with runtime `i` over a fixed exact-type array | Compiles; every element is a candidate; expression evaluated once | R7.3, R7.4 |
| ST-20 | Destination is a constant | E10275 with `constant has no mutable storage`; no artifact | R7.3 |
| ST-21 | Destination is MMIO/volatile | E10275 with the I/O reason; no artifact | R7.3, R7.31 |
| ST-22 | Destination is a loadable value | E10275 with `loadable value has no resident address` | R7.3 |
| ST-23 | Destination is a temporary | E10275 with the temporary reason | R7.3 |
| ST-24 | Nominal struct types differ but sizes match | E10275 with the exact-type reason | R7.3 |
| ST-25 | Extents differ | E10275 with both sizes | R7.3 |
| ST-26 | Destination lifetime ends before the result use | E10275 with the lifetime reason | R7.3 |
| ST-27 | Destination is an unsized array | E10275; no finite complete interval | R7.3 |
| ST-28 | Destination is `obj.field` where `obj` is a byte array and the field is a subaggregate | Compiles; no root-only rejection | R7.3 |
| ST-29 | `c64.loader.load(U, d)` on each of the four PRG profiles | E10275 naming the selected profile; no artifact | R7.9 |
| ST-30 | Lowering-level destination whose interval ends exactly at `$10000` | Expected end `$0000`; the source-level profile proof separately rejects an interval intersecting `$E000–$FFFF` | R7.20, AR-P21 |

### C. Publication, flow, alias, and quiescence

| # | Input / scenario | Expected output / behavior | Source |
|---|------------------|----------------------------|--------|
| ST-31 | Read destination immediately after `if (load(U,d))` | Legal on the true path; exact loaded value | R7.5 |
| ST-32 | Read destination on the false path without reassignment | E10276 naming the read and the load | R7.5 |
| ST-33 | If/else where only the true branch loads, then join and read | E10276; the join lacks definite initialization | R7.5 |
| ST-34 | Both branches load the same unit, then join and read | Legal; ranges intersect on the true path | R7.5 |
| ST-35 | Loop whose body may not load before a read | E10276; back edge lacks the success fact | R7.5 |
| ST-36 | Covering loop that loads on every iteration before the read | Legal when the monotone fact proves the range | R7.5 |
| ST-37 | Retry loop: load fails, then a later success, then read | Legal after the later success | R7.5, R7.26 |
| ST-38 | Store the boolean result and branch on the stored value | Capture follows the stored result | R7.5 |
| ST-39 | Must-alias name of the destination | True edge publishes the range; false edge invalidates it | R7.5 |
| ST-40 | May-alias name of the destination | Receives no definite-initialization credit | R7.5 |
| ST-41 | Partially overlapping destination | Only the exact overlap is updated; the rest keeps its state | R7.5 |
| ST-42 | Repeated loads into the same destination | Each call gets a fresh result identity; the later success publishes the new value | R7.5 |
| ST-43 | Volatile index changes between load and read | Equal source spelling is not identity; read is E10276 | R7.5 |
| ST-44 | Saved destination address used before/after load | Address remains valid; contents change only on success | R7.33 |
| ST-45 | Active user IRQ route at the call | E10275 naming the active route and `restoreIRQ` remedy | R7.23 |
| ST-46 | Active NMI route at the call | E10275 naming the active route and `restoreNMI` remedy | R7.23 |
| ST-47 | Active audio route at the call | E10275 naming the audio route and stop remedy | R7.23 |
| ST-48 | All user routes restored/stopped before the call | Compiles; stock KERNAL route stays active | R7.23 |
| ST-49 | Externally installed/unknown route | E10275; no artifact | R7.23 |
| ST-50 | `false` edge then full assignment then read | Legal; the assignment establishes a separate fact | R7.5, R7.26 |

### D. Loader lowering and resources

| # | Input / scenario | Expected output / behavior | Source |
|---|------------------|----------------------------|--------|
| ST-51 | One reachable load with a static destination | Exact SETLFS/SETNAM/LOAD sequence with A=1, X=`$BA`, Y=0, A=0, X/Y=destination | R7.19 |
| ST-52 | Static setup cost | 27 output bytes / 37 cycles before variable KERNAL/device work | R7.19, expert baseline |
| ST-53 | Unit name length N | `SETNAM` receives N and the unpadded name address; directory padding is not passed | R7.19, R7.14 |
| ST-54 | KERNAL returns carry clear and exact end | Boolean `true`; no error branch | R7.20 |
| ST-55 | KERNAL returns carry set | Boolean `false`; no publication | R7.20 |
| ST-56 | KERNAL returns short end | Boolean `false` | R7.20 |
| ST-57 | Lowering-level exact end `$10000` | Returned X/Y `$0000`; `true`; source-level KERNAL-ROM intersection rejects | R7.20, AR-P21 |
| ST-58 | Destination + size beyond `$10000` | E10275 before emission | R7.20 |
| ST-59 | Dynamic array destination | Expression evaluated once into X/Y; end check compares runtime `destination + size` | R7.4, R7.20 |
| ST-60 | No reachable load call | No loader code, name bytes, KERNAL scaffolding, or reservation | R7.18 |
| ST-61 | One reachable load call | Exactly the built-in strategy; no fastloader/compressor | R7.18 |
| ST-62 | Loader resource evidence | KERNAL workspace, stack peak, code/data, and unknown timing are separate | R7.22, R7.39 |
| ST-63 | Destination in `$A000–$BFFF` under banked-out BASIC ROM | Legal; direct write and later read | R7.31 |
| ST-64 | Destination in I/O or visible KERNAL ROM | E10275; no device write, no artifact | R7.31 |

### E. Joint layout and memory

| # | Input / scenario | Expected output / behavior | Source |
|---|------------------|----------------------------|--------|
| ST-65 | Legal destination in `$0801–$CFFF` | One `loadDestination` interval with exact range | R7.27 |
| ST-66 | Destination overlaps code | E10275 naming the code owner | R7.30 |
| ST-67 | Destination overlaps live SFA | E10275 naming the SFA owner | R7.30 |
| ST-68 | Destination overlaps hardware stack/vector/loader/player/MMIO | E10275 with every conflicting owner | R7.30 |
| ST-69 | Two units sequentially share one destination | One physical interval; exclusive state residencies; no double count | R7.28, R7.40 |
| ST-70 | One unit loads into two destinations | Two destination candidates; one disk entry | R7.29 |
| ST-71 | VIC-visible destination | CPU and VIC views agree; VIC fields derive from the destination | R7.31 |
| ST-72 | Active screen/character-ROM overlap | Reject unless the unit is the active VIC consumer | R7.31 |
| ST-73 | Memory report free intervals | Exact occupied/free partition; total free, largest hole, stack headroom | R7.40 |
| ST-74 | Disk-only unit bytes | Never appear as resident RAM | R7.40 |
| ST-75 | Bounded writes | Checked against the ledger; `runtimeMemorySafety` reflects proof status | R7.40 |
| ST-76 | ACME final reconciliation mismatch | Reject before publication | R7.40 |

### F. D64 codec

| # | Input / scenario | Expected output / behavior | Source |
|---|------------------|----------------------------|--------|
| ST-77 | Empty boot-only image | Exactly 174,848 bytes; 35 tracks; 683 sectors | R7.11 |
| ST-78 | BAM 18/0 | Link 18/1; byte 2 `$41`; bytes 4–143 BAM; exact 144–255 header slice: name 144–159, `$A0 $A0` 160–161, ID 162–163, `$A0` 164, `2A` 165–166, `$A0 ×4` 167–170, zero 171–255; `bamSha256` is the whole sector | R7.11, R7.13 |
| ST-79 | Directory chain | 18/1, 18/4, 18/7, …, last link `$00 $FF`; `directorySha256` hashes 18/1..18/18 in numeric order | R7.11, R7.16 |
| ST-80 | Directory entries | Eight per sector; type `$82`; exact name/first data T/S/block count | R7.11, R7.14 |
| ST-81 | Boot entry | First entry; closed PRG; exact BASIC-startable boot body | R7.13 |
| ST-82 | Unit entry | Closed PRG; first two file bytes `$00 $00`; remaining bytes exact unit | R7.14 |
| ST-83 | File chain | Interleave 10; 254 payload bytes per sector; final byte 1 index | R7.11, R7.12 |
| ST-84 | File data on track 18 | Never allocated | R7.11 |
| ST-85 | Shared/orphan/cyclic sector | Rejected by the independent decoder | R7.16 |
| ST-86 | BAM free count | Equals 664 minus allocated data blocks; bit map matches | R7.11, R7.15 |
| ST-87 | Exactly 664 used blocks | Succeeds | R7.15 |
| ST-88 | 665 used blocks | `D64_CAPACITY`; no image | R7.15 |
| ST-89 | Exactly 144 directory entries | Succeeds | R7.15 |
| ST-90 | 145 directory entries | `D64_CAPACITY`; no image | R7.15 |
| ST-91 | Name collision or unrepresentable boot name | `D64_NAME`; no image | R7.13, R7.14 |
| ST-92 | Name length 1 and 16 | Accepted; 16-byte `$A0` padding in the directory; unpadded SETNAM | R7.14 |
| ST-93 | Fill bytes | `$00` for unused tail/slot/sector/BAM-tail | R7.16 |
| ST-94 | Identical inputs in different checkout paths | Byte-identical image, directory, BAM, names, hashes | R7.12 |
| ST-95 | Independent decoder | Parses without importing the production serializer; all fields match | R7.41 |
| ST-96 | Allocation policy measurement | Fixture/hash/VICE version/duration recorded; policy id in `.build.json` | R7.12 |

### G. Artifact, publication, and run

| # | Input / scenario | Expected output / behavior | Source |
|---|------------------|----------------------------|--------|
| ST-97 | D64 profile selected | Executable profile; `cbm-d64`; `.d64` primary | R7.9, R7.10 |
| ST-98 | Successful D64 build | Exactly eight generation files; `.d64` primary; seven sidecars | R7.10 |
| ST-99 | `.build.json` package | `kind:"d64"`, image bytes, DOS `2A`, label/ID, BAM/directory hashes, policy, free blocks, boot id, components | R7.10, R7.38 |
| ST-100 | Publication pre-commit failure/cancellation | Prior current generation intact; no partial artifact | R7.10 |
| ST-101 | Post-commit cancellation | New generation retained; only own pin released | R7.10, R7.17 |
| ST-102 | `run` on D64 | Fresh build; pin; exact image as drive 8; first entry autostarts | R7.17 |
| ST-103 | `run` mount/autostart failure | `emulator-start` with `RUN_MOUNT`/`RUN_AUTOSTART`; no PRG fallback | R7.17 |
| ST-104 | `run` pin acquisition failure | `recovery-required`; no emulator launch | R7.17 |
| ST-105 | `run` timeout | `emulator-runtime` with `RUN_TIMEOUT`; pin released | R7.17 |
| ST-106 | `run` cancellation after commit | VICE stopped; generation retained; pin released or diagnosed | R7.17 |
| ST-107 | Stale/mixed generation | Never mounted; identity/hash check fails | R7.10, R7.17 |
| ST-108 | PRG profile builds remain unchanged | Existing `.prg` primary and behavior; no loader/disk records | R7.9 |

### H. Evidence, costs, examples, and qualification

| # | Input / scenario | Expected output / behavior | Source |
|---|------------------|----------------------------|--------|
| ST-109 | `.assets.json` loadable record | `placement.kind:"loadable"` with unit id, artifact, destinations; emitted=payload | R7.38 |
| ST-110 | `.memory.json` loader/destination | Loader name data, destination interval, exclusive states, KERNAL reservation | R7.40 |
| ST-111 | `.costs.json` categories | Boot, loader, filename, call-site, SFA/ZP/stack, KERNAL ROM, logical/disk, sector overhead, destination, time | R7.39 |
| ST-112 | Unknown load time | `.costs.json` uses `{kind:"unknown"}`; `"Unknown"` is confined to `.build.json` host provenance | R7.39 |
| ST-113 | `.debug.json` load units | Boot primary + contained units; ranges use `loadUnitIndex` | R7.38 |
| ST-114 | Cross-sidecar mismatch | E10267; no publication | R7.38 |
| ST-115 | Disk allocation never enters optimizer B/R | Saved/acquisition byte metrics unchanged by D64 size | R7.15 |
| ST-116 | Focused level example | Composite load, sequential reuse, failure path, quiescence, restoration | R7.47 |
| ST-117 | Unreachable unit example | No disk entry or loader bytes | R7.47 |
| ST-118 | Capacity diagnostic example | Exact contributors and grouping remedy | R7.47 |
| ST-119 | VICE boot/load/success/failure/BASIC return | Fresh D64 boots, loads exact bytes, canaries hold, returns to BASIC | R7.43 |
| ST-120 | No hidden resident copy | Static maps, disk bytes, PRG inspection, runtime trace show one copy | R7.21 |
| ST-121 | Quiescence runtime | Active route rejected; restored route loads | R7.23 |
| ST-122 | Host responsiveness | Serializer, decoder, flow analysis, build, bounded run durations/RSS recorded | R7.49 |
| ST-123 | `spec/` unchanged | Byte-identical frozen corpus | AC-36 |
| ST-124 | Hardware boundary | Exact `VICE-verified / hardware-unverified`; no silicon claim | R7.44 |
| ST-125 | Deferral expiry | Every due item re-owned; no orphaned deferral | R7.46 |
| ST-126 | Full RD-07 boundary | All directed suites plus one complete boundary pass | R7.45 |

### I. Security and integrity

| # | Input / scenario | Expected output / behavior | Source |
|---|------------------|----------------------------|--------|
| ST-127 | Project/asset path outside the contained root, symlink alias, or output-component collision | Existing containment/alias diagnostic; no D64 and no generation | R7.10, Security |
| ST-128 | Unit name collides with the boot or another unit; host artifact component aliases another | `D64_NAME` or existing packaging failure; prior generation preserved | R7.13, R7.14 |
| ST-129 | `build` without VICE or `c1541`; static scan of the build path | Build succeeds; no shell command, hook, plugin, or `c1541` call exists | R7.12, R7.17 |
| ST-130 | Controlled readable longer replacement of one unit on an isolated sacrificial destination | Wrapper returns `false`; canaries show the overwrite boundary; no containment claim | R7.25, HLE-010 |
| ST-131 | Seeded overlap, overflow, resource exhaustion, or ACME mismatch | Hard diagnostic before publication; no partial artifact | R7.40 |

### J. Handoff, lifecycle, and remaining acceptance cases

| # | Input / scenario | Expected output / behavior | Source |
|---|------------------|----------------------------|--------|
| ST-132 | Frontend entry-point query for loadable facts | `LoadableHandoff` exposes type/size/provenance, illegal uses, and destination compatibility; its import graph never reaches packaging/layout/machine/serializer/D64 | R7.48, AR-P24 |
| ST-133 | Build-only query after final layout | `LoadableBuildView` exposes directory name, sector chain, address, strategy, quiescence, memory proof, and cost ids | R7.48, AR-P24 |
| ST-134 | `.build.json` D64 package | Contains `loaderStrategyId`, components in directory order with boot first, and the allocation policy id matching `09-allocation-measurement.md` | R7.38, R7.12 |
| ST-135 | Name collision, over-length name, or seeded image-structure failure | `D64_NAME` for names; `D64_STRUCTURE` for image structure; no generation | R7.13, R7.14, R7.16 |
| ST-136 | Local `loadable const` used by a reachable load; another local not used | One unit/entry for the reachable local; zero for the unreachable one; function-qualified identity | R7.1, R7.6 |
| ST-137 | Zero-byte loadable unit | One data sector containing the 2-byte header; success returns end == destination; destination unchanged | R7.14, R7.15 |
| ST-138 | Loader and call-site cost attribution | `code + loader + callSite` subsets sum exactly to the function code interval bytes; no double count | R7.39 |
| ST-139 | AC-22/AC-27 negative inspection | No automatic callback, retry, prompt, state-save, or validity byte; optimizer-none IL retains capture/result, selected update, unselected preservation, blocking write, failure, quiescence, and profile effect | R7.24, R7.32, R7.34 |
| ST-140 | Identical inputs in different checkout paths | Byte-identical D64 and deterministic evidence; `.build.json` differs only in `generationId` and declared host provenance | AC-11 |
| ST-141 | Product-boundary scan | No public package, symbol, example dependency, or generated module implements a VFS, asset manager, loader plugin, renderer, scene, scheduler, or engine | AC-34 |
| ST-142 | Link/deferral closeout scan | All public links resolve; every due deferral is re-owned; `spec/` is unchanged | AC-36 |
| ST-143 | Read a loadable value through an index | E10274; no resident address | R7.2 |
| ST-144 | Mutate a loadable value | E10274 | R7.2 |
| ST-145 | Cast a loadable value | E10274 | R7.2 |
| ST-146 | Return a loadable value | E10274 | R7.2 |
| ST-147 | Store a loadable value | E10274 | R7.2 |
| ST-148 | Compare a loadable value | E10274 | R7.2 |
| ST-149 | Iterate a loadable value | E10274 | R7.2 |
| ST-150 | Dynamic destination with one prior initialized candidate; load fails | Selected candidate is invalidated; the prior initialized candidate remains readable | R7.42, AC-04 |

## Test categories

### Specification tests

| File | ST cases | Component |
| ---- | -------- | --------- |
| `test/rd07/loadable-model.spec.test.ts` | ST-1..ST-12, ST-136, ST-143..ST-149 | Unit model |
| `test/rd07/load-destination.spec.test.ts` | ST-13..ST-30 | Destination proof |
| `test/rd07/load-publication.spec.test.ts` | ST-31..ST-44, ST-150 | Flow/alias |
| `test/rd07/load-quiescence.spec.test.ts` | ST-45..ST-50 | Quiescence |
| `test/rd07/loader-lowering.spec.test.ts` | ST-51..ST-64 (runtime half in VICE) | Lowering |
| `test/rd07/load-layout.spec.test.ts` | ST-65..ST-76 | Layout/memory |
| `test/rd07/d64-codec.spec.test.ts` | ST-77..ST-96, ST-135, ST-137 | D64 codec |
| `test/rd07/d64-capacity.spec.test.ts` | ST-87..ST-90 | Capacity |
| `test/rd07/d64-publication.spec.test.ts` | ST-97..ST-108, ST-134, ST-140 | Publication/run |
| `test/rd07/prg-regression.spec.test.ts` | ST-108 | PRG compatibility |
| `test/rd07/d64-evidence.spec.test.ts` | ST-109..ST-115, ST-133, ST-138 | Evidence/costs |
| `test/rd07/qualification.spec.test.ts` | ST-116..ST-126, ST-132, ST-139, ST-141..ST-142 | Examples/qualification |
| `test/rd07/d64-e2e.spec.test.ts` | ST-98, ST-102, ST-119..ST-120 | End-to-end |
| `test/rd07/security.spec.test.ts` | ST-127..ST-131 | Security/integrity |

### Implementation tests

| File | Description | Priority |
| ---- | ----------- | -------- |
| `packages/compiler/src/packaging/d64/*.impl.test.ts` | Geometry, BAM, allocator, names, image edge cases | High |
| `packages/compiler/src/frontend/load-*.impl.test.ts` | Place/candidate/alias internals | High |
| `packages/compiler/src/machine/loader-*.impl.test.ts` | Sequence and resource internals | High |
| `packages/compiler/src/services/d64-*.impl.test.ts` | Evidence/publication internals | High |

### Integration and end-to-end tests

| Test | Components | Description |
| ---- | ---------- | ----------- |
| `test/rd07/d64-e2e.spec.test.ts` | Frontend → packager → publication | One program with boot + units |
| `test/rd07/d64-vice.spec.test.ts` | Build → D64 → VICE | Boot, load, failure, BASIC return |
| `test/rd07/d64-capacity.spec.test.ts` | Packager → publication | Exact fit and one-over |
| `test/rd07/prg-regression.spec.test.ts` | All PRG profiles | No loader/disk change |

## Test data

- Synthetic D64 fixtures built from the packager for codec tests.
- A small boot PRG and 1–3 unit files with known bytes.
- A representative 20-block unit for the allocation measurement.
- Existing RD-06 raw/CTM/SPD fixtures for loadable asset tests.
- VICE 3.10 `x64sc` and ACME 0.97.

## Verification commands

| Check | Command |
| ----- | ------- |
| Frozen install | `yarn install --frozen-lockfile` |
| Root RD-07 specs | `yarn vitest run test/rd07/<file>.spec.test.ts` |
| Compiler impl tests | `yarn workspace @blend65/compiler test src/<path>/<file>.impl.test.ts` |
| Build | `yarn build` |
| Typecheck | `yarn typecheck` |
| Targeted formatting | `yarn prettier --check <touched files>` |
| Final boundary | `yarn test` once after integration |
| VICE | Sequential `x64sc` runs with explicit cycle limits and soft-skip when unavailable |

`yarn test` remains the final boundary command; it is not the per-file directed command because it
runs the complete package corpus and the root suite.

## Verification checklist

- [ ] Every ST case traces to a requirement, spec doc, or AR entry.
- [ ] Specification tests written before implementation.
- [ ] Red phase recorded for each phase.
- [ ] Green phase passes all ST cases.
- [ ] Implementation tests cover edge cases and internals.
- [ ] Independent decoder imports no production serializer.
- [ ] Directed RD-07 suite and one complete boundary pass.
- [ ] `spec/` unchanged.
- [ ] No unrelated corpus run per file.
