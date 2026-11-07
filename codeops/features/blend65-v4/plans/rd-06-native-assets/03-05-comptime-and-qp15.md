# Compile-Time Refinement and Q-P15: RD-06 Native Assets

> **Document**: 03-05-comptime-and-qp15.md
> **Parent**: [Index](00-index.md)

## Overview

This component proves that ordinary `comptime function` source can refine validated embedded values
into resident tables, masks, panels and metadata without adding a scene DSL, asset graph, template
system, renderer API, callback registry, or runtime conversion. It also defines the Q-P15
Integrator-style qualification workload: a large visible area built from repeated elements/panels,
foreground objects, occlusion masks, and at least one multicolor attribute conflict, with two
explicitly selected representations and a user-authored runtime consumer.

The compiler evaluates and preserves the source exactly. It does not infer scene semantics, choose a
game representation, recolor, crop, reorder, flatten, repack, or replace selected values.

## Architecture

### Current architecture

`comptime function` already supports typed expressions, loops, conditions, fixed arrays/structs,
direct compile-time calls, aggregate returns, and the shared `comptime-budget-v1`. Embedded array
values are readable by the evaluator at zero copy charge (`comptime-aggregates.ts:84`). Scalar
embedded values do not exist yet. The Q-P15 workload does not exist.

### Proposed changes

- No new language feature. The plan adds tests and fills any gap that prevents a `comptime function`
  from reading a validated embedded constant, indexing it, transforming bytes, and returning a fixed
  array or struct.
- A scalar embedded value is readable as an ordinary compile-time scalar, with the same zero-copy
  visibility rule as an array.
- The shared budget remains compilation-wide and non-configurable. Referencing an already validated
  embed does not charge its bytes again; transformation steps and live copies do.
- Q-P15 lives under `test/rd06/qualification/q-p15/` and is not an example or public library (AR-8).

## Implementation Details

### Allowed compile-time work

| Capability | Allowed | Evidence |
| --- | --- | --- |
| Read a module-level resident `const` initialized by `embed()` | Yes | Existing embedded aggregate read |
| Index, slice by fixed extent, copy, transform bytes | Yes | Normal typed expressions and fixed arrays |
| Loops, conditions, direct `comptime` calls | Yes | Existing evaluator |
| Return fixed arrays or structs | Yes | Existing aggregate returns |
| `embed()` inside a `comptime function` | No; E10135 (not an allowed embed owner) | RD-06 R6.33 |
| Read files, environment, time or random state | No | RD-06 R6.33 |
| Read/write MMIO, `peek`/`poke` | No | RD-06 R6.33 |
| Call runtime, indirect or ordinary functions | No | RD-06 R6.33 |
| Emit target instructions, SFA homes, stack use or helpers | No | RD-06 R6.33 |
| Hidden second budget or configurable quota | No | `comptime-budget-v1` |

### Budget behavior

The compilation-wide budget is 16,777,216 steps, 16 MiB live logical memory and 512 active calls
(`packages/compiler/src/frontend/comptime-budget.ts:4-9`). A referenced immutable embed is not charged
again merely for being visible. Materialized copies, indexed writes, loops and direct calls consume
the same budget as any other compile-time root. Failure reports the rejected operation and the
outermost root.

### Q-P15 workload

`test/rd06/qualification/q-p15/` contains:

- a large visible area built from repeated elements/panels;
- multiple foreground objects;
- occlusion masks and draw-priority metadata;
- at least one multicolor attribute conflict represented as exact typed metadata;
- two credible data representations selected explicitly in source (for example panel references vs a
  precomposed table);
- a user-authored renderer and a VICE check for draw order, foreground occlusion, changed-panel
  updates, Color RAM work and worst-case cycles;
- a `[spec-author]`-owned source/oracle task that freezes the workload, panel design, conflict
  metadata, renderer and expected artifact/runtime values before implementation;
- an artifact check for exact bytes, reuse, padding, alignment, VIC visibility, mask/priority data,
  conflict results and absence of hidden copies.

The renderer is test source. Its code and cost are reported separately from asset bytes and compiler
metadata. It is not linked into the compiler, examples or public packages.

### Example: panel mask from an embedded bitmap

```blend65
const TILES: byte[] = embed("level.kla", "bitmap");

comptime function invertMask(source: byte[]): byte[1000] {
  let mask: byte[1000] = [; 0];
  for let index: word = 0; index < 1000; index += 1 {
    mask[index] = source[index] ^ $ff;
  }
  return mask;
}

const MASK: byte[] = invertMask(TILES);
```

The example is illustrative; Q-P15 uses fixed extents and real Koala/PSID data where applicable.
No runtime call, helper or hidden copy is emitted for `invertMask`.

### Error handling

| Error case | Handling strategy | AR Ref |
| --- | --- | --- |
| File/MMIO/runtime access inside `comptime` | E10191 on the rejected operation | AR-27 |
| `embed()` inside a `comptime function` | E10135 on the call | AR-27 |
| Budget exceeded | E10269/E10270/E10271 with root span | AR-27 |
| Unsupported aggregate shape | Existing fixed-array/struct diagnostic; no new DSL | AR-27 |
| Hidden runtime conversion or copy | Artifact inspection failure; no plan task may add one | AR-28 |
| Q-P15 conflict silently recolored | Test failure; conflict must be reported as typed metadata | AR-28 |

## Testing Requirements

- Compile-time read of an embedded array and scalar, with exact result bytes and no target
  instructions/SFA homes/helpers.
- Budget accounting: no double charge for visibility; transformation steps and copies charged.
- Negative tests for file, MMIO, runtime call, indirect call and `embed()` inside `comptime`.
- Q-P15 artifact oracle: exact bytes, masks, priority, conflict metadata, two representations, padding,
  alignment, VIC visibility and no hidden copies.
- Q-P15 VICE runtime: draw order, foreground occlusion, changed panel, Color RAM transfer and
  worst-case cycle record.
- The renderer's cost is separate from asset bytes and compiler metadata.
