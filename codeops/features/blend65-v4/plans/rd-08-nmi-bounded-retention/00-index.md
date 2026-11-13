# RD-08 Bounded NMI Retention Plan

> **Feature**: Retain NMI values in bounded hardware-stack slots and zero-extension staging
> **Status**: Done — 12/12 tasks; verification recorded
> **Created**: 2026-11-13
> **Implements**: blend65-v4/RD-08; completes issue #149
> **CodeOps Artifact Schema**: 1

## Overview

Issue #149 delivered every materialization form but left three forms rejected: a masked value shared
by two consumers, several simultaneously retained samples, and a runtime word local that staged its
zero-extension. They are not materialization gaps; they need bounded retention or staging.

This slice adds two narrow mechanisms:

1. **Bounded stack retention** for a straight-line NMI handler with a void return and no calls. A
   byte local with one initializer store and one or more loads is pushed once (`PHA`), read through
   `TSX`-relative `LDA $0100+n,X`, and popped before the wrapper restores A/X. The proof is capped at
   eight body bytes, so the hardware-stack demand is finite and reported.
2. **Zero-extension staging elision** for a single-use word local initialized by a byte read and
   consumed by a byte-masked `&`. The low byte stays in A; the high byte is proved zero.

No private RAM/zero-page home is created. The NMI private-home proof stays unchanged; the retained
bytes live on the invocation's own hardware stack and are accounted in `hardwareStack`.

## Delivered forms

- `let m = read() & 3; a = m != 0; b = m == 0;`
- five `peek` samples retained across five later `poke`s
- `let w: word = read(); flag = ((w & 2) != 0)`

The exact stack shape and the runtime boundary are in [03-design.md](03-design.md) and
[07-testing-strategy.md](07-testing-strategy.md).

## Exit boundary

Four-profile build/storage oracles, a sequential genuine-NMI VICE case that observes both the
shared Boolean pair and the five copied samples, the complete compiler suite, the affected root
suites, `spec/` untouched, a green commit, and issue #149 re-closed with the delivered boundary.
