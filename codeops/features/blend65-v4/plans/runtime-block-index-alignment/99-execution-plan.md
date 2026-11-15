# Runtime element block-index alignment — execution plan

> **Owner**: issue [#159](https://github.com/blendsdk/blend65/issues/159), alignment slice.
> **Dependency**: the #74 static block-index alignment pass.
> **Scope mode**: strict. No frozen `spec/` change, no runtime, no source restriction.

## Problem

#74 aligns a module object for a static block-index address. A runtime element address is left
untouched even when every element preserves the required alignment:

```blend65
let blocks: byte[2][64];
function main(): void {
  let index: byte = peek($0400);
  c64.vic.setSpritePointer(0, lo(&blocks[index] / 64));
}
```

A root alignment alone does not prove the selected element unless the stride is a multiple of the
demand. A byte-stride array must not be falsely aligned.

## Decision

Walk the addressed place with the required alignment:

- A constant field/index offset is added normally.
- A runtime index is admitted only when the element stride is a multiple of the demand; the static
  prefix and suffix must also leave a multiple of the demand.
- A byte-stride runtime index leaves the placement untouched.
- The proof is allocation-only; the runtime shift path and the ordinary acceptance remain.

The VIC-bank and character-ROM visibility check for a proved block-index consumer is **not** part of
this slice. It needs the consumer-aware diagnostic contract owned by #158 and remains open on #159.

## Tasks

- [x] T-159.1 Reproduce the 64-byte-stride and byte-stride runtime witnesses.
- [x] T-159.2 Add the four-profile alignment oracle.
- [x] T-159.3 Extend the alignment proof with the runtime-stride rule.
- [x] T-159.4 Update the #74 runtime-index oracle to the byte-stride control.
- [x] T-159.5 Compiler and host checkpoints.
- [ ] T-159.6 VIC-bank/character-ROM diagnostic for a proved consumer — blocked on #158.

## Acceptance

| Area | Oracle |
| --- | --- |
| 64-byte stride | `byte[2][64]` with a runtime index gets a 64-byte root alignment; the address is aligned. |
| Byte stride | `byte[128]` with a runtime index is not 64-aligned. |
| Runtime path | The witness keeps the ordinary shift sequence; no runtime mask or helper is added. |
| Four profiles | The oracle passes on PAL/NTSC 6581/8580. |
| Bank/ROM visibility | **Open** — awaits the #158 diagnostic contract. |

## Residuals

| Residual | Owner |
| --- | --- |
| VIC-bank/character-ROM diagnostic for a proved block-index consumer | #158 contract, then #159 |
| Runtime element block-index fold to `base + index` | not claimed |

## Constraints

- `spec/` and the ledger stay byte-identical. No test or VICE journey is weakened. No push.
