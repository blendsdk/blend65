# Address-of (`&`): RD-18 Slice 8a

> **Document**: 03-01-address-of.md
> **Parent**: [Index](00-index.md)
> **Governs**: `&` typing + rejection codes, `isEscaped`, `&` lowering, and the AR-29 by-ref
> argument-place address materialization.
> **Spec**: Ch 04 §8 (+ F006); Ch 06 FN-12/FN-A9. **AR**: 10, 11, 29.

## Overview

`&` becomes a real value surface: it types as `word` for every addressable operand, rejects
non-addressable operands with the AR-10 codes, and lowers onto the shipped `addr` operand.
The same address-materialization capability retires the two 7b by-ref argument-place ICEs.

## Implementation Details

### Typing (`expression-typing.ts`, the `&` arm of `typeUnary` at :499-501)

Replace the silent poison with operand classification (per AR-10):

| Operand shape | Result | Code |
| ------------- | ------ | ---- |
| Ident → module/local/zeropage `let` var (scalar or aggregate) | `word` | — |
| Ident → `const` aggregate (has a data-section image) | `word` | — |
| Ident → `const` scalar (inlined, no storage) | ERROR | **E10047** AddressOfConstScalar (mint) |
| Ident → function or interrupt function | `word` + mark address-taken | — |
| Ident → parameter (any kind) | ERROR | **E10048** AddressOfParameter (mint) |
| Member → `Module.fn` (exported fn; resolves via the 5b qualified-head path) | `word` + mark | — |
| Member → struct field / Index → array element | ERROR | **E10042** (wire the dormant registration) |
| Anything else (literal, call, parenthesized expr, …) | ERROR | **E10049** AddressOfNonAddressable (mint) |

Notes:
- Codes register additively in `diagnostic-codes.ts` (AR-115 precedent); numbers verified free
  at gate time — re-verify at registration.
- `&Module.fn` in value position retires the 5b "function member in value position" ICE for the
  `&`-wrapped case ONLY; a bare `Math.fn` value read keeps its existing loud behavior (functions
  are not values, FN-12).
- **Address-taken marking**: the model records the set of address-taken function FQNs;
  `modelToFunctionInfo` flips `isEscaped` (`model-adapter.ts:68`) from that set. The flag flows
  through the EXISTING Step-2 always-live handling (`interference.ts:104-112`) — an
  address-taken function's frame and pairs stop sharing (Ch 06 §8 requires the frame
  allocated). Layout perturbs only for programs that use `&fn`; none of the ten prior fixtures
  do (preflight PF-006). Indirect calls stay unsupported (FN-A9). 03-03's irq classification
  additionally treats interrupt-kind escapees specially — see its root-set rule (PF-001).

### Lowering (`lower.ts`, replacing the ICE at :1304-1307)

The operand's address expression lowers to the `addr` operand (`addrOf(symbol)`):

| Operand | Symbol |
| ------- | ------ |
| module var | `__var_<Module>_<name>` (existing) |
| local var | `__frame_<fqn>_<name>` (existing) |
| zeropage var | the 03-04 user-ZP symbol |
| const aggregate | `__data_<Module>_<name>` (existing) |
| function / `Module.fn` | the function's emitted entry label (existing label scheme, `translate.ts:1960-1963`) |

**Placement discipline (7b AR-16 carried forward):** `addr` is legal only as a store source or
ALU right operand. Lowering therefore emits `&x` as:
1. direct `store dst, addr(sym)` when the consumer is an assignment/argument/intrinsic-arg slot
   (these all lower through stores today), and
2. otherwise (e.g. `&x + 2`, comparisons): home it first — `store tmp16, addr(sym)` into a
   synthetic word temp, then use `tmp16`. The temp rides the existing synthetic-slot machinery
   (6's `0sc<N>` precedent) — no new operand positions are added to translate.

`pokew($FFFE, &onIRQ)` (the fixture path) is case 1: two byte-stores of `#<label` / `#>label`
via the existing addr-consuming translate framings.

### AR-29: by-ref argument-place address materialization (`lower.ts:904-908`)

For a by-ref argument whose place needs runtime address computation:

- **runtime-indexed place** `f(a[i])`: reuse the 7b formation sequence (`lower.ts:1779-1786`) —
  `add scratch, addr(base), index_scaled` homed through `__zp_ptr_scratch` — then store the
  formed word into the callee's 2-byte frame home (FN-3 slot). For byte-indexed tier-1 arrays
  the scale/width rules are the shipped 7b ones; the formation word intermediate MUST home
  through the one scratch (foldStoreHome adjacency — exec gotcha).
- **pair-relative place** `f(p.field)` where `p` is a by-ref param: `add scratch, pair(p),
  const(offset)` — the pair is already a word home; same store into the callee frame home.
- The two E90001 pins in `lower-indirect.spec.test.ts` (ST-40) retire per the loud-never-silent
  retired-row protocol: the pins are REWRITTEN to assert successful compilation + the formed
  marshalling shape, never deleted silently.
- The callee-side contract (prologue frame→pair copy, CP rules, dead/pass-through skip) is
  UNCHANGED — this is caller-side marshalling only.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `&constScalar` | E10047, poison, no binary | AR-10 |
| `&param` | E10048, poison | AR-10 |
| `&a[i]` / `&s.f` (user-facing) | E10042, poison (FUT-001 stays deferred) | AR-10 |
| `&42`, `&(x+y)`, `&f()` | E10049, poison | AR-10 |
| addr operand reaching an unsupported translate position | existing loud translate ICE (unchanged backstop) | AR-11 |

## Integration Points

- 03-03 consumes the address-taken set from here: escaped NON-interrupt functions are mainline
  roots in its classification, and interference Step 2 consumes `isEscaped` directly (PF-001/
  PF-006). 03-06's fixture consumes `&fn` + `pokew`.
- `length()` / `sizeof` on `&`-results: not a surface — `&` yields `word`, and word intrinsics
  apply; no special casing.

## Testing Requirements

ST-1..ST-10 (07-testing-strategy) — typing accept/reject matrix, lowering shapes, ST-40
rewrite, `&Module.fn` cross-module, `isEscaped` projection.
