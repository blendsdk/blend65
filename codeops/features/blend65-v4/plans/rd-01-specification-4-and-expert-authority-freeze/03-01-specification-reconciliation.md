# Component: Specification Reconciliation

> **Parent**: [Index](00-index.md)
> **Owns**: Phase 1 exact oracles and Phase 2 language reconciliation
> **Requirements**: R1.1–R1.14, R1.20, R1.27

## Baseline and Exact Oracles

Before `spec/` changes, `08-closeout.md` records the verified worktree/branch, source commit, parked
v3 status, P3 identity, expert 1.0.0 identity/content commit, and consumed AR-001–AR-050 decisions.
It also freezes the existing 50 `spec/` paths, raw hashes, and simple authority roles: primary
chapter/grammar/C64 appendix, subordinate evaluation, or non-normative navigation/future/workflow
record. The baseline is derived before edits and is not a per-file stamp or hunk ledger.

The baseline also records the canonical compile-time trigonometric oracle from AR-050:

- for `k` in `{8,16}`, `N=2^k`, `A=2^(k-1)-1`, and unsigned `p` denotes `p/N` turns;
- `sin_k(p)` is the nearest integer to `A*sin(2*pi*p/N)`, with exact halves away from zero;
- `cos_k(p)=sin_k((p+N/4) mod N)`;
- ranges are `-127..127` and `-32767..32767`;
- SHA-256 of the 256 signed byte results, encoded as two's-complement bytes, is
  `fec3247a063767c499a18d6efdb1e5f86f96f859e2e98a859d621e93af013259`;
- SHA-256 of the 65,536 signed word results, encoded as little-endian two's-complement words, is
  `e0313f89310605acaa740fa67cf9fb157e363c9bd4af10fea66d8846735c5a50`.

Representative values are `sin8(0)=0`, `cos8(0)=127`, `sin8(32)=90`, `sin8(64)=127`,
`sin8(128)=0`, `sin8(192)=-127`, `sin16(8192)=23170`, `sin16(16384)=32767`,
`sin16(32768)=0`, and `sin16(49152)=-32767`.

## Semantic Work Groups

| Group | Normative owners | Required reconciliation |
|---|---|---|
| Loops and scope | `03-variables.md`, `05-statements-control-flow.md`, `06-functions.md`, F008, F013, F018, F019, F021 | Three-clause `for`, ordinary effects/exits, wrap rule, nested shadowing, shared parameter/outermost-body duplicate domain, stable declaration identity, E10101 retirement |
| Integers and arrays | `02-type-system.md`, `04-expressions-operators.md`, `08-arrays-strings.md`, F014, F016, F017 | Fixed-width wrap, direct-subscript promotion, narrow barriers, fixed extents, rectangular layout, exact-shape values, word queries |
| Aggregates and places | `06-functions.md`, `07-structs.md`, `11-memory-model.md`, F006, F011, F018 | Struct/array assignment and return, caller-owned return storage, alias-safe copying, addressable places, lifetime/provenance/escape |
| Function values and handlers | `01-lexical-structure.md`, `02-type-system.md`, `06-functions.md`, F007, F016, F018, F021 | Typed finite target sets, widening, devirtualization, handler kinds, per-sink LIFO ownership, raw-vector invalidation |
| Compile time | `01-lexical-structure.md`, `04-expressions-operators.md`, `06-functions.md`, F021, F025 | Typed compile-time functions, exact trig oracle, fixed budget constants/charging, deterministic failure/no output |
| Placement and loading | `01-lexical-structure.md`, `03-variables.md`, `11-memory-model.md`, `13-data-inclusion.md`, F005, F015, F019, F021 | Closed `place(...)`, `loadable const`, captured ranges, success publication, failure invalidation, must-alias proof |
| Intrinsics and safety | `01-lexical-structure.md`, `04-expressions-operators.md`, `08-arrays-strings.md`, `12-intrinsics.md`, F012, F017, F020, F021 | Exact five `asm_*` controls, variable-address PEEK/POKE, checked/unchecked division and bounds, no mandatory runtime |

## Shared Owners

`grammar.ebnf.md`, `14-diagnostics.md`, and cross-cutting evaluations are updated with the owning
semantic group, then checked once across the complete candidate. The final check proves that each
syntax form has one production, each invalid class has one live diagnostic owner, examples agree
with both, E10101 stays retired/reserved, and E10267–E10271 keep their approved meanings.

## Editing Rules

- Preserve every P3 behavior not changed by an accepted decision.
- Use ordinary modern-language examples and at least one relevant game workload per changed area.
- Keep SFA as the function-storage closure without turning it into whole-machine memory management.
- Do not preserve compiler limitations as language rules.
- Do not add a heap, generic runtime, target plugin system, pointer/view type, inline assembly, or
  game-policy library.
