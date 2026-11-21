# A raw write whose value is a function address

> **Owner**: T-47 · **Type**: Task (lightweight) · **CodeOps Artifact Schema**: 1
> **Status**: Complete
> **Progress**: 4/4 tasks (100%)
> **Last Updated**: 2026-11-21

## Why

```
pokew($0314, &handler);
```

compiled successfully and emitted neither the vector write nor anything else. The listing held
startup and the BASIC stub and nothing more. A program that says it installs a handler, a compiler
that reports success, and an output that does neither — a silent wrong-code outcome rather than a
missing feature, which is why it outranked the feature question it was filed next to.

## The cause, which was not about interrupts

Where a value that is not a scalar met a scalar expectation, the conversion rule returned no node
**and no diagnostic**. Its caller then abandoned the expression it was analyzing, and for a
statement whose only effect was that expression, the statement left the program silently.

So the reported spelling was one symptom of a general silence. Measured before any change:

| Written | Before | Diagnostic |
| --- | --- | --- |
| `pokew($0314, &handler)` | built, no write | none |
| `pokew($C000, &handler)` | built, no write | none |
| `pokew($C000, &plain)` — an ordinary function | built, no write, callee dropped | none |
| `let w: word = &handler; pokew($C000, w)` | built, no write | none |
| `pokew($C000, pair)` — a `byte[2]` | built, no write | none |
| `pokew($C000, word(&handler))` | built, both bytes | — |
| `pokew($0314, word(&handler))` | refused | `E10252` |

The last two lines are what made the diagnosis quick: the same program with the conversion written
down behaved correctly, so nothing in lowering or reachability was at fault. Only the unconverted
spelling had no path at all.

## What the specification settles, and what it leaves open

The decision this unit could have got wrong is whether to honour such a write or refuse it. It is
not open:

| Source | Says |
| --- | --- |
| `Appendix C64 §9.2` | Writing `pokew($0314, &handler)` **is E10252**, because the raw entry address has the wrong stack/exit ABI for CINV |
| `Ch 06 §7.7` | A direct write to an exactly recognized firmware vector is not an escape hatch; when the compiler can see a raw-entry address going to a sink with a different ABI, E10252 rejects it |
| `F006 address-of` | Conversion of either a function or a handler value to `word` is **explicit**; it exposes the address and erases callable or sink proof |
| `Ch 06 §7.7` | An address that has become opaque remains an explicit unsafe boundary — the function stays reachable, the convention is not certified |

So both diagnostics are required, and which one applies depends on the destination.

## After

| Written | After | Why |
| --- | --- | --- |
| `pokew($0314, &handler)`, `pokew($0318, &handler)` | **E10252**, naming the operation that owns that vector | The appendix's own example; entering a vector needs that vector's contract, and no spelling of the address supplies it |
| `pokew($C000, &handler)` | **E10080**, naming the explicit conversion | Ordinary memory. The conversion is legal and must be written |
| `pokew($C000, &plain)`, `pokew($0314, &plain)` | **E10080** | An ordinary function address is not a raw interrupt entry, so the vector diagnostic would be a false claim |
| `let w: word = &handler` | **E10080** | The same silence outside any builtin |
| `pokew($C000, pair)` | **E10080**, naming the member to select | Not a function address at all, and the same dead end |
| `pokew($C000, word(&handler))` | **unchanged**, both bytes emitted | Written down, exposing an address is ordinary |
| `let w: word = word(&handler); pokew($0314, w)` | **unchanged**, both bytes emitted | The compiler can no longer see a handler entry arriving, and the language keeps that an explicit boundary rather than a refusal |

Why E10252 rather than letting the conversion rule speak first: it is what the appendix specifies
for that exact line, and it is the better answer. The generic rule would send its author to write
an explicit conversion that is then rejected in turn, while saying nothing about the operation that
would have worked.

Recognizing it has to happen before the value is converted, because afterwards the value is gone.
It therefore reads the written spelling, and a name it cannot resolve to an interrupt function
falls through to the generic rule — a weaker message, never a wrong one.

## Tasks

- [x] **T-47.1 Map the real scope.** Establish by measurement which spellings drop their write,
      rather than trusting the one in the report.
- [x] **T-47.2 Settle refuse or honour.** From the specification, not from preference.
- [x] **T-47.3 Report the silence.** Diagnose the general case, and keep the vector-specific
      refusal ahead of it where the specification names it.
- [x] **T-47.4 Verify.** Specification controls for the documented refusals, implementation
      controls for the invariant that broke, and the full gate.

## Verification

| Check | Result |
| --- | --- |
| New specification controls | **6/6** |
| New implementation controls | **9/9** |
| Full gate, both corpora | **268 files / 5,542 tests** |
| Existing tests that flipped | **none** — nothing relied on the silence |
| All seven examples, four modes | **byte-identical** |

The implementation controls assert the refusal code and the emitted write count **in one record**,
because the defect was neither alone: it was a success that emitted nothing. A control that checked
only for a diagnostic would have passed against a compiler that still dropped the write.

## Stop conditions observed

No frozen oracle was edited and no specification file was touched; the new specification controls
pin behavior the specification already documents, in a new file of their own, and leave the remedy
wording to the compiler by pinning only the documented message shape. The change adds diagnostics
and removes nothing: every spelling that compiled correctly before still compiles and still emits
the same bytes.
