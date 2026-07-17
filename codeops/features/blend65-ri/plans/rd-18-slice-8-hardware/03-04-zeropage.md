# Zeropage Blocks: RD-18 Slice 8a

> **Document**: 03-04-zeropage.md
> **Parent**: [Index](00-index.md)
> **Governs**: `zeropage {}` semantic collection, merging, initializer rules, SFA wiring,
> lowering, and symbol emission.
> **Spec**: Ch 03 §2.3/§4.4 (+ F005); Ch 11 §4. **AR**: 17, 18.

## Overview

The parser ships the block form; the allocator ships the priority-1 user category; the emitter
ships the 2-digit-equate discipline. This component builds the missing middle: collection →
typing/init parity → projection → wiring, for the FULL surface (scalars + aggregates).

## Implementation Details

### Collection & merging (`module-variable-collection.ts` + Pass 1)

- `ZeropageBlock` fields collect as module variables with a `storage: "zeropage"` marker on the
  symbol — same scope, same name rules as `let` module vars: a duplicate against ANY top-level
  name (including across merged files) rejects via the existing **E10003** path.
- Multiple blocks per module (same file or across merged files) MERGE (AR-17); F005's
  one-block rule is a recorded superseded deviation; E10030 stays unminted.
- Module-level only (parser-enforced position); always mutable — `let`/`const` keywords inside
  the block are parse errors already (block grammar has no keyword slot).

### Typing & initializers (5b parity, AR-18)

- Field types resolve through the ordinary type machinery: scalars, arrays, structs all legal
  (full surface). Enum-typed fields follow the module-var rules.
- Initializers: const-only, call-free — EXACTLY the 5b module-variable initializer discipline
  (same rejection set, same E10193-family behavior, same declaration-order-independent const
  evaluation). Initialized fields join the per-variable topological `__init` order (E10194 on
  cycles) — the initializer stream writes ZP at startup.
- **No zero-fill** (spec ZP-4): an uninitialized ZP var emits NO startup code and NO data-image
  bytes — its value is indeterminate. (ZP is outside the PRG load image, so this also falls out
  mechanically; the rule is still asserted by test.)
- **Boundary pin (8a/8b seam)**: a string-literal initializer on a zeropage field hits the
  existing loud string-init rejection (`statement-typing.ts:830` path) — verify the guard covers
  `ZeropageField` initializers and add the negative test. Strings land in 8b.

### Projection & wiring

- New `modelToZpUserVars(model)` in the SFA adapter: `[{ name, size }]` per ZP var,
  deterministic order (module-merge order, then declaration order — placement freedom inside
  the block is spec ZP-2).
- `run-frontend.ts:174` replaces `zpUserVars: []` with the projection. The allocator's user
  category then places them at priority 1 (`zp-allocator.ts:193-198`), before pointers/temps;
  E10032 (once, on first overflow) and W10030 (75% advisory, suppressed after E10032) are
  already wired.

### Naming & emission

- Symbol naming: **`__zp_<Module>_<name>`** — consistent with `__var_<Module>_<name>` and the
  `__zp_ptr_*` family. The allocator's `place()` receives this name via the projection.
- `SymbolDefinition.zeroPage: true` → 2-digit equate emission (7b discipline — load-bearing for
  any future `(zp),Y` operand against these symbols).

### Lowering & addressing

- Identifier resolution to a ZP-storage symbol lowers exactly like a module var but with the ZP
  symbol as the direct operand. ACME selects zp addressing automatically from the 2-digit
  equate — no new translate framings.
- Aggregates: indexed/member access rides the shipped 7a/7b paths against the ZP symbol
  (ZP addresses are valid absolute operands; tier-2 formation cannot arise — a ZP aggregate is
  budget-bounded ≪ 256 bytes). `&zpVar` works per 03-01.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| duplicate name (in-module or cross-file) | existing E10003 | AR-17 |
| ZP budget exceeded | existing E10032 (once); W10030 advisory below it | AR-18 |
| non-const / call-bearing initializer | existing 5b module-init rejections | AR-18 |
| init cycle through a ZP var | existing E10194 | AR-18 |
| string initializer on a ZP field | existing loud string-init rejection (8b retires) | AR-18 |

## Integration Points

- `__init` stream (5b) executes ZP initializers; 03-06's fixture uses an initialized ZP counter
  as the primary observable; 03-03's allocator changes share `zp-allocator.ts` (sequence the
  edits; user category is priority 1, irq additions sit below it).

## Testing Requirements

ST-25..ST-33: placement inside the platform ZP range as 2-digit equates; merge across files;
E10003 dup; initializer joins `__init` (write visible at startup); NO zero-fill; E10032/W10030;
aggregate-in-ZP addressing; `&zpVar`; string-init negative.
