# Fragmentation and Source Safety: RD-01 Specification Inventory

> **Document**: 03-02-fragmentation-source-safety.md
> **Parent**: [Index](00-index.md)

## Overview

A versioned byte-oriented scanner derives total, ordered and non-overlapping fragments from every
included source section. A closed manifest classifies every `spec/` file and section. Citation
validation proves each rule still resolves to exactly one source span beneath the frozen root
(AR-P6, AR-P8, AR-P11).

## Fragmentation profile

Profile `markdown-ebnf-v1` consumes raw UTF-8 bytes and records byte offsets, display line/column,
heading ancestry, node kind, normalized content hash and fragment ID. It recognizes:

- ATX headings and their ancestry;
- paragraphs;
- each list item, including continuation bytes;
- table rows and cells with escaped-pipe handling;
- fenced EBNF blocks and individual production spans;
- every remaining non-whitespace byte range as `residual`.

The scanner is not a CommonMark renderer or a normativity classifier. BOM, LF/CRLF, Unicode,
unterminated fences, nested lists and escaped table syntax are fixed by conformance vectors.
Normalization affects hashes only; original byte spans remain authoritative (AR-P6).

Fragment IDs combine profile version, canonical source path, section identity, node kind and a
bounded normalized-content hash. Rule IDs remain independently assigned so wording drift does not
replace semantic identity (AR-P8).

## Normative-source manifest

The ordered manifest:

1. includes chapters 00–15 in canonical order;
2. includes only declared normative sections of `grammar.ebnf.md`;
3. includes `appendix-c64.md` for target-specific obligations;
4. classifies every other `spec/` file and excluded section with a closed authority/disposition
   code.

Chapter semantics outrank contextual restatements; the C64 appendix owns C64-specific values.
Classification enumerates actual paths, not globs, so adding an unclassified file fails. Section
selectors resolve through heading ancestry plus content identity and must be unique.

## Source resolution

`SourceRepository` is constructed with a repository root and allowed `spec/` root. For every
manifest or citation path it:

1. rejects absolute paths, empty segments and `..`;
2. resolves the existing path;
3. compares real paths to reject symlink escapes;
4. enforces file and aggregate limits;
5. verifies the bounded quote/hash at exactly one selected span.

No later source read bypasses this abstraction (AR-P11). Display line numbers are recomputed
metadata and never participate in identity. The repository is required to remain stable during a
validation run; concurrent malicious checkout mutation is outside the offline tool's threat model.

## Conformance vectors

`readiness/conformance/fragmentation-v1.json` contains literal source bytes encoded losslessly and
the expected ordered kind/start/end/ancestry/hash tuples. The production fragmenter must match
byte-for-byte. The vectors do not call production helpers to derive expectations (AR-P6).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Invalid UTF-8 or unsupported newline/profile | Deterministic source diagnostic; no fragments | AR-P6, AR-P7 |
| Unclassified file/section | Manifest completeness error | AR-P1, AR-P6 |
| Missing/repeated heading selector | Exact-resolution error with candidates | AR-P8 |
| Quote/hash mismatch | Stale-source error; rule cannot validate | AR-P8 |
| Absolute/traversal/symlink path | Reject before escaped content is read | AR-P11 |
| Unrecognized non-whitespace syntax | Emit residual fragment; ledger must dispose it | AR-P6 |

## Testing Requirements

- Independent vectors for every node kind and encoding/newline edge.
- Mutation tests delete or alter one byte/span and require ledger/source failure.
- Path fixtures cover missing, absolute, traversal, repeated-heading and symlink cases.
- Manifest fixtures add an unclassified file and exclude a required normative section.
- Two scans of identical bytes return deeply equal ordered fragments.
