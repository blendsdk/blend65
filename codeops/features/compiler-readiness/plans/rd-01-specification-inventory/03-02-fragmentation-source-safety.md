# Fragmentation and Source Safety: RD-01 Specification Inventory

> **Document**: 03-02-fragmentation-source-safety.md
> **Parent**: [Index](00-index.md)

## Overview

A versioned byte-oriented scanner derives total, ordered fragment trees from every included source
section. Root fragments are non-overlapping; table and EBNF container fragments own non-overlapping
children. A closed manifest classifies every `spec/` file and section. Citation
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

Table rows parent table-cell fragments and fenced EBNF blocks parent production fragments. Root
fragments are ordered, total and non-overlapping over non-whitespace source bytes. Children are
ordered, total and non-overlapping over their parent's non-whitespace bytes; unclaimed bytes inside
a container become residual children. Every child carries `parentFragmentId`. This hierarchy keeps
the required container and leaf kinds without representing overlapping peers.

### Exact hash and identity contract

Source bytes must decode as strict UTF-8. Fragment `startByte`/`endByte` are zero-based half-open
offsets into the untouched source bytes. For hashing only, remove a UTF-8 BOM when the fragment
starts at source byte zero, convert CRLF and lone CR to LF, normalize decoded Unicode to NFC, then
UTF-8 encode. Preserve every other byte-level distinction: do not trim or collapse whitespace,
change tabs or case, or interpret Markdown escapes. Content hashes are the full lowercase
`sha256:<64 hex>` digest.

Canonical source paths are repository-relative POSIX paths beginning with `spec/`. They contain no
backslashes, absolute prefix, empty, `.` or `..` segments and are not Unicode-normalized.

Section identity is the lowercase unpadded base32 encoding of the first 20 SHA-256 bytes over a
domain-separated binary frame: ASCII `blend65.section-id`, format byte `1`, then normalized heading
ancestry strings as unsigned 32-bit big-endian UTF-8 byte length plus bytes, followed by the
unsigned 32-bit big-endian occurrence ordinal among identical ancestries.

Fragment identity hashes this binary frame: ASCII `blend65.fragment-id`, format byte `1`; then
profile ID, decimal profile version, canonical path, section identity, optional parent fragment ID,
node kind and the full 32-byte content digest, each preceded by an unsigned 32-bit big-endian byte
length; finally the unsigned 32-bit big-endian scan-order ordinal among otherwise identical tuples.
The first 20 digest bytes are lowercase unpadded base32 and render as
`frag.v1.<32 base32 characters>`. Duplicate IDs are fatal. Offsets and display locations never
participate in identity. Rule IDs remain independently assigned so wording drift does not replace
semantic identity (AR-P8).

### Phase-2 public API

The requirements-derived tests target this exact surface:

```ts
export type FragmentKind =
  | "heading"
  | "paragraph"
  | "list-item"
  | "table-row"
  | "table-cell"
  | "ebnf-fence"
  | "ebnf-production"
  | "residual";

export interface SourceDocument {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface SourceFragment {
  readonly fragmentId: string;
  readonly parentFragmentId?: string;
  readonly kind: FragmentKind;
  readonly startByte: number;
  readonly endByte: number;
  readonly headingAncestry: readonly string[];
  readonly sectionIdentity: string;
  readonly contentHash: `sha256:${string}`;
  readonly displayLine: number;
  readonly displayColumn: number;
}

export interface FragmentationResult {
  readonly ok: boolean;
  readonly fragments: readonly SourceFragment[];
  readonly diagnostics: readonly InventoryDiagnostic[];
}

export function fragmentSource(
  source: SourceDocument,
  profile: FragmentationProfile,
  limits: InventoryLimits,
): FragmentationResult;

export interface SourceRepository {
  listSpecFiles(): Promise<readonly string[]>;
  read(path: string): Promise<SourceDocument>;
}

export function createSourceRepository(options: {
  readonly repositoryRoot: string;
  readonly specRoot: string;
  readonly limits: InventoryLimits;
}): Promise<SourceRepository>;

export function validateInventorySources(
  repository: SourceRepository,
  inventory: InventoryV1,
): Promise<ValidationResult>;
```

Profile and limits are mandatory so callers cannot select hidden defaults. Normalization, hashing,
path canonicalization, selectors, citation matching, manifest completeness, ownership precedence
and fragment-ledger coverage remain behind these APIs; later phases cannot compose subtly different
policy from exported helpers. Invalid source input returns no partial fragments. Source validation
uses the inventory's manifest, citations and clause ledger together, so a changed fragment reports
the stale hash and a removed complete span reports the undisposed fragment deterministically.

### Exact scanner grammar

All spans exclude their final line terminator. Multi-line spans retain internal terminator bytes.
Leading indentation belongs to a construct only where its recognizer permits it; otherwise spans
begin at the first non-whitespace byte and end after the last non-whitespace byte. Blank lines and
unclaimed whitespace require no fragment.

- **ATX heading:** zero to three ASCII spaces, one to six `#`, then ASCII space or end of line.
  The full non-whitespace line is the heading fragment. The label removes the marker, surrounding
  horizontal space and an optional closing `#` run. The fragment's ancestry includes its own
  normalized label; later fragments inherit the latest heading stack.
- **List item:** zero or more indentation spaces followed by `-`, `+`, `*`, or one or more digits
  plus `.` or `)`, then at least one ASCII space. An item spans its marker line plus immediately
  following nonblank continuation lines indented beyond its content column. A nested marker starts
  a separate ordered item rather than overlapping its parent; a blank line or another recognized
  root construct ends the item.
- **Table:** a header line followed immediately by a delimiter row whose nonempty cells match
  `:?-{3,}:?` after horizontal-space trimming. Header, delimiter and subsequent pipe-containing
  nonblank lines are `table-row` parents. An unescaped `|` separates cells; `\\|` stays literal.
  Each nonempty byte range between separators, after removing at most one surrounding ASCII space,
  is a `table-cell`. Separator pipes and any other non-whitespace row bytes not owned by a cell are
  residual children. Outer pipes are optional.
- **Fenced EBNF:** zero to three ASCII spaces followed by at least three backticks or tildes and an
  info string whose first token is ASCII-case-insensitive `ebnf`. The matching closer uses the same
  character and at least the opener length with no non-space suffix. The `ebnf-fence` parent spans
  opener through closer, or opener through end of input when unterminated. A production starts on
  a line matching an ASCII identifier followed by optional horizontal space and `=`. It spans
  through the first semicolon outside single/double-quoted terminals, retaining continuation lines.
  Production spans are `ebnf-production` children; opener, closer and other non-whitespace bytes
  are residual children.
- **Paragraph:** a maximal consecutive run of nonblank lines not claimed by a heading, list, table
  or EBNF fence and not beginning, after up to three spaces, with `>`, a thematic-break run, `<`,
  or a non-EBNF fence marker. The span starts at the first non-whitespace byte and ends after the
  final non-whitespace byte.
- **Residual:** maximal non-whitespace byte ranges left unclaimed at the current hierarchy level.
  Residual is a loss-accounting construct, not a fallback paragraph.

Recognition precedence is EBNF fence, heading, table, list item, paragraph, residual. UTF-8 display
line and column are one-based; byte offsets remain zero-based. Two scans of identical input must be
deeply equal.

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
