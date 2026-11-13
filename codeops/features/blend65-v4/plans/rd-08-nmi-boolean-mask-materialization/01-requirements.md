# Requirements Delta — NMI Boolean Mask Materialization

> **Issue**: [#149](https://github.com/blendsdk/blend65/issues/149) — "materialize the remaining
> NMI Boolean masks without private storage"
> **Parent**: RD-08 measured output debt; issues #147 and #148 delivered the ordinary and shift forms
> **Updated**: 2026-11-13

## Requirement mapping

| Source requirement | Current state | Plan deliverable |
|---|---|---|
| #149: constant masks `8+` as Booleans | Every form fails `E10245`; mainline retains masked and comparison bytes | Expert inline branch, no home |
| #149: multi-bit constant masks | Same | Expert inline branch, no home |
| #149: zero constant mask | Same | Fold `x & 0`; materialize `LDA #0`/`LDA #1` |
| #149: runtime mask | Same | Branch when the mask is directly addressable and the read stays in A |
| #149: wider-than-byte operand | Same; the word local also needs a home | Zero-extended word comparison plus single-use constant-local elision |
| #149: delivered forms meet or beat the expert with byte/path-cycle evidence | No delivered form | Exact sequences and costs in the closeout |
| #149: no NMI proof relaxation | Existing proof rejects private requests | No proof change; no request is created |
| #149: shared masked value and multi-sample | Existing negative passes | Keep the negative; re-own with a live issue |
| #149: independent spec oracles on four profiles plus sequential VICE | None for these forms | Build/byte oracle plus two genuine NMI cases |
| #149: honest residual record | Ledger row names all remaining classes | Narrow to the retention and unstaged-width forms with a live owner |

## Explicit non-goals

- No NMI proof relaxation or private-home allowance.
- No bounded stack-retention class, heap, or multi-sample support.
- No shared masked-value allocation.
- No 16-bit word mask with a possibly-nonzero high byte.
- No runtime word local that needs a zero-extension staging home.
- No `spec/` edit and no physical-hardware claim.

## Acceptance

1. Masks `8` and `3` (single-bit and multi-bit) build with optimization `none` on all four
   cooperative profiles, in both polarities.
2. The zero mask builds and emits the constant Boolean after the single volatile read.
3. An addressable runtime mask builds in both `&` operand orders.
4. A byte-masked word global builds for mask `1` (identity), mask `2` (shift), mask `8` (branch);
   a single-use constant word local builds with no home.
5. An all-ones mask `0xFF` uses the load's value and flags without a redundant `AND`.
6. Their memory evidence contains no NMI-private request; the read is a single volatile access.
7. Every emitted handler is the expert branch, identity, shift or constant load, decoded from
   published debug ranges, with no retained masked byte and no comparison retention.
8. Measured handler bytes and path-max cycles meet or beat the expert branch.
9. Shared masked value, multi-sample, 16-bit word mask, runtime word local, computed runtime mask
   and nonzero-constant comparison still fail `E10245` with no generation.
10. Sequential VICE proves a genuine CIA2 NMI for the mask-`3` `!=` and mask-`8` `==` forms and the
    program returns; both observe true through Timer A.
11. The ledger row and docs record the remaining boundary with a live owner.
12. `yarn build`, `yarn typecheck`, the complete compiler suite and the affected root suites pass;
    `spec/` is clean.
