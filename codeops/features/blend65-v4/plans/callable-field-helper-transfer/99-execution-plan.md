# Callable-field helper transfer — execution plan

> **Owner**: issue [#157](https://github.com/blendsdk/blend65/issues/157).
> **Dependency**: the direct and interprocedural kill facts from #156 and #161.
> **Scope mode**: strict. No frozen `spec/` change, no new runtime, no new source restriction.

## Problem

A helper that definitely stores a direct callable source into an aggregate field does not transfer
that definite assignment to its caller. The argument read is therefore treated as uninitialized
and the call fails `E10277`:

```blend65
struct Box { cb: fn(): byte; }
let box: Box;
function prepare(): void { box.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }
```

The same store written directly in `main` is accepted. The missing fact is a per-key definite
assignment for an aggregate global field, and the parameter-field form (`prepare(p: Box)`) needs
the key translated to the actual argument.

## Decision

Extend the existing definite-write transfer from a bare callable global to a whole callable field:

- A store is transferable only when its value is a direct source function address or a merge of
  them, and the destination key is a whole global root or a field path under a transferable root.
- A non-callable sibling field store is irrelevant; an unsafe store to a callable key, an indexed
  store, or a whole-root store excludes only the affected scope.
- A parameter-rooted key carries its parameter index. The caller translates it to every possible
  origin of that argument before adding the key to its assignment facts.
- Target provenance already transfers a helper's parameter paths to the actual and a global field
  path is program-wide; no second target pass is added.
- Raw-write corruption remains #161's byte-interval kill facts. A helper that stores and then
  corrupts produces a kill; a helper that corrupts and then stores produces none.

## Tasks

- [ ] T-157.1 Reproduce the global-field and parameter-field witnesses plus the raw, conditional,
      indexed, copied and disjoint controls.
- [ ] T-157.2 Author the public specification oracle and the four-profile VICE case; confirm RED.
- [ ] T-157.3 Replace the root-only transfer filter with per-key safety and callable-field roots.
- [ ] T-157.4 Carry the parameter index with each definite key and translate it at the call site.
- [ ] T-157.5 Apply the same key acceptance to ordered startup initializers.
- [ ] T-157.6 Implementation tests for the witnesses and negative controls.
- [ ] T-157.7 Independent review: correctness, semantics, SFA/ABI and emitted code.
- [ ] T-157.8 Host checkpoint and the wave-level `yarn test:full`; closeout and issue evidence.

## Acceptance

| Area | Oracle |
| --- | --- |
| Global helper field | The issue witness builds and calls `chosen` with no raw write. |
| Parameter helper field | `prepare(p: Box){ p.cb = &chosen; } prepare(box); invoke(box)` builds. |
| Raw write through the field | A helper or caller raw write through `&value.cb` before the read fails `E10277`. |
| Conditional store | A field store on only one route does not transfer. |
| Indexed store | An indexed or bounds-off store to the aggregate keeps the field untransferred. |
| Copy of a corrupted aggregate | A copied corrupted leaf still fails. |
| Disjoint field | A sibling non-callable store does not block the callable field. |
| Restore order | Store-then-corrupt fails; corrupt-then-store builds. |
| Runtime | The global-field witness returns `chosen`'s value on all four PRG profiles. |
| Cost | Accepted controls keep exact emitted bytes and storage. |

## Residuals

| Residual | Owner |
| --- | --- |
| Indexed callable-field transfer | #163 precision debt |
| Indirect-call definite field transfer | finite-target assignment transfer remains direct-call only |
| Aggregate copy/return of a corrupted pointer | existing #156 copy analysis; no new claim |

## Constraints

- `spec/` and the expressiveness ledger stay byte-identical.
- No test, oracle or VICE journey is deleted, skipped or weakened.
- No general solver or runtime. No push.
