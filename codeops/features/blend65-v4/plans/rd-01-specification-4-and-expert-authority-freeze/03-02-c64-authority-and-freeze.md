# Component: C64 Authority and Specification Freeze

> **Parent**: [Index](00-index.md)
> **Owns**: Phase 3 C64 authority, Guard, diagnostics, inventory, crosswalk, and digest
> **Requirements**: R1.2–R1.5, R1.15–R1.20, R1.25–R1.27

## C64 Authority

Before these clauses freeze, the closeout captures hash-pinned primary records for the exact
D64/1541 geometry, C64 KERNAL `SETLFS`/`SETNAM`/`LOAD` behavior, and Koala format facts used here.
Phase 4 copies the same records into the expert source manifest; it does not choose new sources
after the specification is frozen.

`15-platform-profile.md` and `appendix-c64.md` define exactly the eight approved PRG profiles plus
`c64-pal-d64-kernal-6581`, with `c64-pal-prg-kernal-6581` first. They own the exact CPU, video,
startup, banking, IRQ, SID, artifact, exit, loader, resource, and evidence contracts.

`13-data-inclusion.md`, F015, and the C64 appendix define exactly SPD v5, CTM v9, the approved PSID
subset, classic Koala, and raw fallback. Koala source bytes are preserved in full; only low nibbles
carry VIC-II color meaning. The D64 profile owns standard 35-track geometry and the bounded KERNAL
sequential-load contract, including explicit quiescence, captured-range publication, trusted-media
scope, and `HLE-010`.

The public surface stops at typed hardware operations, external asset ingestion/adapters, placement,
and packaging. Game loops, renderers, schedulers, collision, scene systems, buffering policy, and
mixers remain user-authored Blend65.

## Removed and Future Targets

The four non-C64 appendices and obsolete active workflow/migration reports are removed only after
their crosswalk rows are recorded. C64U, X16, and Atari constraints may remain in
`future-considerations.md` only as explicitly non-normative, unqualified triggers. Unknown/planned
target IDs are not selectable.

## Guard and Whole-Spec Closure

The Language Guard identifies Specification 4 and applies to every qualified active target. Every
changed feature records all 23 rule results. Conditional results name their authority; no failed
result enters the corpus. A whole-tree pass closes grammar, diagnostics, links, examples, target
claims, and product-boundary wording after the C64 changes.

## Central Inventory and Digest

`spec/00-normative-inventory.md` is the sole membership and identity record. It lists exact relative
paths, classifies each retained file as normative or non-normative, fixes UTF-8/LF bytes and rejects
symlinks or paths outside `spec/`. The corpus digest is SHA-256 over the byte concatenation of
GNU-style records for normative files sorted by bytewise relative path:

```text
<64 lowercase hex><two spaces><relative path><LF>
```

Each record's hex value is the SHA-256 of the file's raw bytes. The inventory is a non-normative
membership/identity record and is not one of the files in that record stream, so the digest is not
self-referential. Its final raw hash is recorded separately. No normative file repeats the identity.
The closeout records the final raw hash of every retained `spec/` file so the at-rest tree is
auditable.

## Transition and Freeze Record

`08-closeout.md` owns one row per P3 normative path and each Spec 4 addition:

| Prior path | Disposition | Governing decisions | Specification 4 destination |
|---|---|---|---|

Source and destination set equality must pass. A final semantic-diff review accounts for every
material change; the table is not a hunk ledger. The same closeout owns the bootstrap, inventory and
raw hashes, Guard summary, qualification impact, approval, freeze proof, future constraints, zero
unresolved findings, and deferral-expiry answer.
