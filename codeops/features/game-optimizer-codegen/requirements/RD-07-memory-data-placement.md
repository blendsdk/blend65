# RD-07: Memory Optimization and Data Placement

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-02–RD-06
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Optimize memory traffic and place code/data where the C64 hardware reads it. Placement takes
priority over copying; alias and escape proofs enable store/load elimination, scalar replacement,
layout coalescing and zero-copy assets without changing observable addresses.

## Functional Requirements

### Must Have

- [ ] Track object identity, address-taken state, escape, mutability, alias region, alignment demand,
  access frequency and hardware consumers.
- [ ] Forward loads/stores and eliminate redundant traffic only with exact memory-version and alias
  proof.
- [ ] Perform scalar replacement of non-escaping aggregates when address/layout is unobservable.
- [ ] Keep address-taken or externally visible object layout stable unless the language/platform
  contract explicitly permits relocation.
- [ ] Place const assets in their final hardware-consumed location and flip pointers/indices rather
  than copy bytes at runtime.
- [ ] Coalesce compatible const data and reuse identical immutable images without duplicating RAM.
- [ ] Infer alignment from hardware consumption and symbolic address arithmetic, choosing the
  coarsest required legal boundary without gratuitous padding.
- [ ] Optimize indexed/indirect addressing using proven ranges and page geometry.
- [ ] Model C64 memory-map exclusions, ROM/I/O visibility and target load/link regions.
- [ ] Account for linked padding and memory-region pressure in every placement choice.

### Should Have

- [ ] Reorder unobservable internal fields/data for access locality when no address/layout escapes.
- [ ] Select compressed-versus-raw placement only among versioned provider-supplied
  encodings/decompressors whose capability evidence passes, when complete decompression and frame
  costs prove a win.

### Won't Have

- Runtime copies used solely to compensate for compiler placement.
- Implicit code/data overlays before the overlay/linker capability exists.
- Changing public struct/array layout without an approved language compatibility contract.

## Technical Requirements

Placement operates over symbolic relocations until link resolution. Multiple demands combine by
the strictest valid boundary. A demand is an allowlisted hardware boundary, not an arbitrary source
divisor. Final cost includes padding and any bank/region constraints.

## Integration Points

- RD-02 owns alias/effect truth.
- RD-08 owns ZP/frame allocation; RD-11 owns final linked layout.
- Asset conversion/compression and streamed data are external capabilities named by RD-17.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Data strategy | Placement over copying | AR-1, AR-20 |
| Alias safety | Proof blocks or permits optimization | AR-7 |
| Alignment | Consumption-derived, coarsest wins | AR-15 |

## Security Considerations

Embed/asset paths remain governed by existing canonical-path rules. Placement records use
allowlisted regions and checked address arithmetic; overflow, overlap or forbidden-region output
fails before assembly.

## Acceptance Criteria

1. [ ] An address-taken sprite image is consumed in place with zero staging stores and a correct
   sprite-block pointer.
2. [ ] An indexed-only const table incurs no alignment padding not required by its consumer.
3. [ ] Conflicting 64/256-byte demands combine to 256; three 64-byte demands never become 256 by
   accident.
4. [ ] Two identical immutable images share linked bytes only when neither identity/address is
   observably distinct.
5. [ ] Scalar replacement applies to a non-escaping local aggregate and is rejected for an
   address-taken/by-reference aggregate.
6. [ ] Load forwarding crosses a proven non-aliasing store but not an unknown/volatile write.
7. [ ] Every emitted section lies within its declared C64 region and overlap/overflow is rejected.
8. [ ] Placement selection minimizes the complete linked cost vector, including padding rather
   than code-section bytes alone.
9. [ ] A balloon/boing-ball-class pointer-update path performs pointer/index changes instead of
   per-frame image copying.
