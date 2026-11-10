# RD-07 Closeout: Loadable Assets and D64 Delivery

> **Document**: 09-closeout.md
> **Parent**: [Index](00-index.md)
> **Status**: Done — `VICE-verified / hardware-unverified`
> **Date**: 2026-11-10
> **Execution plan**: [99-execution-plan.md](99-execution-plan.md) — 122/131 checked; the remaining
> tasks are the tracked gaps in this document, not unstarted work.

## Result

RD-07 delivers a working loadable-asset path: truthful `loadable const` values, a proved mutable
destination, one built-in KERNAL transport that returns `boolean`, one deterministic standard D64,
complete publication, and bounded VICE runtime evidence.

| Capability | Evidence |
| --- | --- |
| Loadable unit model | `frontend/load-units.ts`; scalar/array/struct/embedded/composed bytes, identity, local units, handoff |
| Native/raw assets under `loadable const` | Handler validation replaces the old E10204 rejection; ledger row retired |
| D64 serializer | `packages/compiler/src/packaging/d64/`; independent decoder; BAM/directory/names/capacity |
| D64 profile | `c64-pal-d64-kernal-6581`, `cbm-d64`, `kernal-sequential-uncompressed` |
| Load operation | `c64.loader.load(unit, destination)`: direct, field, nested, local, parameter, constant-index, runtime-index |
| Publication | E10276 on failed, changed-index, and non-covering edges; must/may/partial aliasing; retry loops |
| Quiescence | Active user IRQ/NMI route rejects with E10275; restored route passes |
| KERNAL lowering | SETLFS/SETNAM/LOAD; read-only name; per-unit RAM scratch; `STATUS & $0F`; MSGFLG suppression |
| D64 build/publish | A real project publishes `<name>.d64` with boot + reachable units; eight-file generation |
| Evidence | `.build.json` components, `.assets.json` loadable placement, `.memory.json` loader/destination/`loadStates`, `.costs.json` split, `.debug.json` load units |
| Run | Pinned fresh D64 passed to VICE `-autostart`; exact argv test |
| Runtime | Success + canary, missing-file `false`, longer-file overwrite + `false`, BASIC return — 4/4 |
| Example | `examples/rd07-loadable`: two sequential loads, failure path, unused unit omitted |

## Verification record

| Check | Command | Result |
| --- | --- | --- |
| Compiler suite | `yarn workspace @blend65/compiler test` | 3,656 passed / 2 skipped |
| RD-07 directed suite | `yarn vitest run test/rd07` | 72 passed / 4 opt-in skipped (VICE) |
| Affected root suites | RD-04/05/06 + M1 boundary | 133 passed |
| VICE runtime (opt-in) | `RD07_VICE=1 RD07_RUNTIME_DIR=<prebuilt> yarn vitest run test/rd07/d64-vice.spec.test.ts` | 4/4 passed |
| D64 run argv | `src/services/vice-profiles.spec.test.ts` | 12 passed |
| Frozen specification | `git status --porcelain spec/` | empty |
| Formatting | targeted `yarn prettier --check` | clean |

## Runtime findings (fixed during qualification)

| Finding | Evidence | Correction |
| --- | --- | --- |
| KERNAL `STATUS` sets bit 6 (EOI, `$40`) on success | Monitor stop before the result store: `$90 = $40`, X/Y one past end | Mask with `$0F`; only the low error nibble is failure |
| A missing file entered the BASIC warm-start path | Missing-entry run never reached the false branch (`ok = 0`) | Clear `MSGFLG` bits 6/7 around the call; restore afterwards |
| KERNAL `LOAD` clobbers zero-page scratch shared with SFA | Destination pointer in `$08/$09` was overwritten; target stayed `$FF` fill | Keep all cross-call state in a per-unit absolute RAM scratch object |
| Zero-page SFA window overlapped the KERNAL workspace | Same evidence | The loader no longer keeps state in `$02–$8F` |

The frozen one-past-end success contract was confirmed against the real KERNAL and is unchanged.

## Deferral-expiry scan

The audit walked the RD `Won't Have` section, the ambiguity register (24/24 resolved), the
expressiveness ledger, `spec/future-considerations.md`, and the hardware-limitation register.

| Source | Item | Result |
| --- | --- | --- |
| RD Won't Have | Fastloader, drive code, compression, staging, hostile-media containment | Still out of scope; HLE-010 documents the boundary |
| RD Won't Have | Streaming, random access, async load, runtime handle, multi-disk, other formats | Still out of scope |
| RD Won't Have | Loader plugin registry, external packager, shell, `c1541`, VFS, engine | Still out of scope; packager is pure and shell-free |
| RD Won't Have | D64 variants for other machines | Still out of scope; only `c64-pal-d64-kernal-6581` |
| Expressiveness ledger | `v4-native-loadable-asset` | **Retired**; synthetic SPD replacement builds |
| `spec/future-considerations.md` | No load/D64 row | Nothing due |
| Ambiguity register | 24 resolved rows | Nothing open |
| HLE-010 reconsideration | Bounded transport for hostile media | Still future; not named as an RD-07 slice |

No deferral's stated rationale was expired by this RD. Three delivered-slice gaps are re-owned as
tracked issues rather than deferred without an owner:

| Issue | Gap | Impact |
| --- | --- | --- |
| [#141](https://github.com/blendsdk/blend65/issues/141) | Partial/field destinations lack an exact `loadDestination` interval and exclusive state view | Reporting precision; the write and asset range are correct |
| [#142](https://github.com/blendsdk/blend65/issues/142) | A failed dynamic load invalidates every candidate instead of proving the unselected one | Conservative E10276; safe but coarser than R7.42 |
| [#143](https://github.com/blendsdk/blend65/issues/143) | Native-asset destination alignment/visibility constraints are recorded but not enforced | A misaligned loadable charset can be accepted |

## Host observations (R7.49)

| Observation | Value | Fixture |
| --- | --- | --- |
| Build (frontend → D64 publish) | 0.53 s wall, 93,116 KB peak RSS | `test/rd07/d64-vice.spec.test.ts` source |
| VICE success window | 3.6 s bounded observation | fresh D64 |
| VICE failure window | 8.1 s bounded observation (drive timeout) | patched D64 |
| VICE BASIC return | 4.1 s bounded observation | fresh D64 |
| D64 codec suite | 5 tests in ~60 ms | synthetic image |

These are comparable observations, not pass/fail gates.

## Honest boundary

- Runtime status is `VICE-verified / hardware-unverified`. Real-drive timing, serial behavior, CIA
  edge cases, and physical PAL C64 checks remain RD-10-owned.
- The automated VICE suite is opt-in because the agent sandbox blocks the emulator child from
  test-created paths. It passed against prebuilt images with `RD07_VICE=1`; outside the sandbox it
  builds its own fixture.
- The loader checks the low `STATUS` error nibble plus the returned one-past-end address. Carry is
  not inspected separately; the observed KERNAL error paths set the status nibble or an unexpected
  end address.
- The three tracked issues above are correctness/expressiveness debt, not silent deferrals.

## Roadmap

RD-07 is **Done** with the three tracked issues. The next v4 feature is RD-09; RD-10 owns native
host and physical-hardware qualification.
