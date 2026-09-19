# Static Frame Allocation and ABI: RD-03 Pipeline Completion

> **Document**: 03-02-sfa-and-abi.md
> **Parent**: [Index](00-index.md)

## Overview

Assign every reachable function-execution byte to a deterministic static home, including storage
discovered by target legalization and resource binding. SFA is the sole general function-frame
model. Globals and VIC-visible assets use platform layout instead (AR-C4).

## Storage Model

### Direct Records

```ts
type StorageClass =
  | "parameter"
  | "return-stage"
  | "local"
  | "argument-stage"
  | "temporary"
  | "pointer"
  | "spill"
  | "helper-scratch";

interface StorageRequest {
  readonly id: StorageId;
  readonly owner: FunctionVariantId;
  readonly storageClass: StorageClass;
  readonly bytes: number;
  readonly alignment: number;
  readonly region: "zeropage-required" | "zeropage-preferred" | "ram";
  readonly lifetime: ValueLifetime;
  readonly source: SourceSpan | null;
  readonly reason: string;
}

interface StorageHome {
  readonly requestId: StorageId;
  readonly address: number;
  readonly bytes: number;
  readonly region: "zeropage" | "ram";
}

type ResultLocation =
  | { readonly kind: "a" }
  | { readonly kind: "ax" }
  | { readonly kind: "storage"; readonly requestId: StorageId };

interface StorageClosureCertificate {
  readonly inventoryHash: string;
  readonly graphHash: string;
  readonly profileId: string;
  readonly homes: readonly StorageHome[];
  readonly interference: readonly InterferenceEdge[];
  readonly staticBytes: ResourceTotals;
  readonly peakBytes: ResourceTotals;
  readonly hardwareStackPeak: number;
  readonly closed: true;
}
```

These are ordinary data records, not an allocator framework or ABI registry. Stable IDs derive from
source/binding/operation identity, never traversal accident (AR-C4).

### ABI Used by RD-03

- Arguments evaluate left to right. Each completed argument first owns caller staging when a later
  call can overwrite the eventual callee home.
- Scalar/enum parameters copy into callee static homes before `JSR`.
- Fixed array/struct parameters use their specified two-byte base address.
- `byte`, `sbyte`, `boolean` and enum returns use A; `word`/`sword` use A low and X high.
- Every function result has an explicit `ResultLocation`. Register results do not also consume RAM.
  A `return-stage` request exists only when a result must survive another call, is spilled, or is
  otherwise required in addressable storage.
- RD-03 emits no aggregate-return source case, interrupt function or indirect call; the
  representation does not contradict their Specification 4 direction and adds no fake support.
- `JSR`/`RTS` owns only return-address bytes. No ordinary local is placed on page one.
- Required helper code is dead-stripped and uses an explicit ABI, clobber set, SFA scratch and stack
  cost. RD-03 adds no resident runtime (AR-C4, AR-C13).

### Interference and Placement

Two requests interfere when their lifetimes overlap, one remains live across the other's call, an
alias can observe both, or the selected execution-domain contract permits overlap. M1 application
storage has one mainline domain; the cooperative KERNAL IRQ still contributes machine-state and
hardware-stack cost but does not call M1 functions (AR-C4).

Allocate deterministically by region requirement, width/alignment, owner and stable storage ID.
Zero-page pointer pairs are indivisible and cannot start at `$ff`. `zeropage-preferred` may fall
back to profile RAM only when its selected machine form exists; `zeropage-required` fails with an
actionable resource diagnostic. Compatible non-interfering homes may overlay. The report shows
static total and peak/interference demand separately (AR-C4).

## Final Storage Closure

The only feedback loop is:

```text
provisional semantic storage
  -> deterministic SFA plan
  -> target legalization/helper selection
  -> resource binding/spill discovery
  -> merge only new storage request IDs
  -> repeat until the inventory hash is unchanged
  -> freeze closure certificate
```

The loop is bounded by the finite operation set and finite candidate forms. Each operation may
introduce only its declared finite storage candidates; a repeated existing request does not count as
progress. Exhausting the finite set without a stable placement is a diagnostic, not another retry.
Phase 3 implements the inventory, placement and bounded closure engine but does not claim that the
M1 certificate is final. Phase 4 supplies the real legalizer/binder candidate requests, iterates the
engine to stability and freezes the certificate before platform layout. Final layout, branch repair,
serializer and packager accept that certificate and have no API that can create function-lifetime
storage (AR-C4).

## Hardware Stack

Compute the deepest reachable `JSR` chain plus the cooperative KERNAL IRQ frame/save path and any
explicit stack operations. Use the selected profile's raw capacity and reserve exactly as
`measuredPeak <= rawCapacity - reserve`. Report measured peak, reserve and available capacity
separately. M1 source uses no public explicit stack intrinsic, but focused tests keep call/IRQ cost
accounting honest (AR-C4, AR-C5).

## Transition Contracts

| Transition | Consumes | Produces | Rejects / must not own | AR Ref |
|---|---|---|---|---|
| Inventory | Whole-program operations/lifetimes | Provisional requests | Global/assets, guessed helper bytes | AR-C4 |
| Placement | Requests plus selected RAM/ZP windows | Homes, interference and totals | `$ff` pointer wrap, overlap, hidden reserve | AR-C4 |
| Feedback | Legalizer/binder declared new IDs | Monotonically larger finite inventory | Anonymous scratch, open-ended retry | AR-C4 |
| Closure | Stable inventory and placements | Frozen certificate | Any downstream storage invention | AR-C4 |

## Error Handling

| Error case | Handling | AR Ref |
|---|---|---|
| Recursion/unknown re-entry reaches SFA | Reject with source call path before placement | AR-C4 |
| Nested argument would overwrite an outer value | Allocate/delay marshalling; never reject normal source or call it recursion | AR-C4 |
| ZP pair would straddle `$ff/$00` | Move to another fitting pair or issue exact resource failure | AR-C4 |
| RAM/ZP/stack budget exceeded | Report request, owner, demand, capacity, interference path and realistic remedy | AR-C4 |
| Legalization asks for undeclared/new storage after closure | Internal pipeline failure; no artifact | AR-C4, AR-C14 |

## Testing Requirements

- Inventory covers parameters, explicit result locations, required return staging, locals,
  temporaries, argument staging, dynamic pointer pairs, spills and helper scratch. Register-only
  scalar results have no duplicate memory home.
- Exact nested-call cases include `f(1, g())` and `f(1, f(2, 3))`.
- Overlay cases prove siblings may share and caller/callee live values may not.
- Pointer `$fe` succeeds and `$ff` relocates or fails without wrap.
- A legalizer-created spill forces one re-close; a second stable pass freezes; a deliberately
  nonconverging candidate set fails deterministically.
- Stack cases include ordinary calls plus the selected cooperative KERNAL IRQ path.
