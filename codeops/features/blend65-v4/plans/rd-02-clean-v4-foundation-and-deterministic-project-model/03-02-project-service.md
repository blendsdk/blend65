# Deterministic Project Service

> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P2–AR-P5

## Public Signatures

The owning RD supplies key behavior; these signatures supply the implementation
contract for independent spec-test authoring. Use readonly documented records and
a string-literal discriminated result. No public abstract host, class hierarchy,
cache, registry generator, or plugin interface.

```typescript
type SourceId = string;
type OptimizationGoal = "none" | "balanced" | "speed" | "size";
interface SourceSpan {
  readonly sourceId: SourceId;
  readonly start: number;
  readonly end: number;
}
interface ProjectManifest {
  readonly schemaVersion: 1;
  readonly name: string;
  readonly sourceRoot: string;
  readonly entry: string;
  readonly target: string;
  readonly assetPaths: readonly string[];
  readonly outDir: string;
  readonly optimization: OptimizationGoal;
  readonly boundsCheck: boolean;
  readonly divisionZeroCheck: boolean;
}
interface ProjectDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly primarySpan: SourceSpan | null;
  readonly related: readonly { readonly span: SourceSpan; readonly message: string }[];
  readonly help: string | null;
  readonly pointer: string | null;
}
interface SourceRecord {
  readonly sourceId: SourceId;
  readonly text: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly resolvedPath: string;
}
interface ProjectSnapshot {
  readonly manifest: ProjectManifest;
  readonly manifestSource: SourceRecord;
  readonly sources: readonly SourceRecord[];
  readonly inputSha256: string;
  readonly projectRoot: string;
  readonly sourceRoot: string;
  readonly assetPaths: readonly string[];
  readonly outDir: string;
  readonly overrides: {
    readonly target: string | null;
    readonly entry: string | null;
  };
  readonly effectiveTarget: string;
  readonly effectiveEntry: string;
}
interface ProjectLoadOptions {
  readonly cwd?: string;
  readonly project?: string;
  readonly target?: string;
  readonly entry?: string;
}
type ProjectLoadResult =
  | { readonly kind: "success"; readonly snapshot: ProjectSnapshot;
      readonly observations: readonly ProjectDiagnostic[] }
  | { readonly kind: "failure"; readonly diagnostics: readonly ProjectDiagnostic[] };

type ManifestParseResult =
  | { readonly kind: "success"; readonly manifest: ProjectManifest }
  | { readonly kind: "failure"; readonly diagnostics: readonly ProjectDiagnostic[] };
type NameValidationResult =
  | { readonly kind: "success" }
  | { readonly kind: "failure"; readonly reason:
      "empty" | "ill-formed-unicode" | "forbidden-character" |
      "trailing-character" | "dot-name" | "reserved-device-stem";
      readonly offending: string | null };

function parseManifest(text: string, sourceId?: SourceId): ManifestParseResult;
function validateProjectName(name: string): NameValidationResult;
function loadProject(options?: ProjectLoadOptions): Promise<ProjectLoadResult>;
function byteOffsetToPosition(text: string, offset: number): {
  readonly line: number; readonly character: number;
};
```

`byteOffsetToPosition` returns zero-based line and UTF-16 character coordinates for
valid UTF-8 byte boundaries. Out-of-range, noninteger, and mid-scalar offsets are
programmer errors (`RangeError`), not silently rounded positions. CRLF is one
line break; bare CR and LF are also breaks. Host/config failures remain typed
diagnostics. `target` may use a literal union for the exact nine IDs rather than
the broad string shown above; no arbitrary profile object is accepted.

At the scalar boundary between CR and LF, return the preceding line's content
end (do not count CR as a character). Only after the complete CRLF does the next
line start. This matches the ordinary LSP text-document end-of-line convention
in [Microsoft's text-document implementation](https://github.com/microsoft/vscode-languageserver-node/blob/main/textDocument/src/main.ts).
The byte boundary remains valid; invalid/mid-scalar offsets still throw.

## Private Test Controls

Per approved PF-005, the spec author receives these declarations, not production
code. `loadProjectWithControls` lives in `compiler/src/project/snapshot.ts`;
control types live in the existing `types.ts`. Tests import that private module
using `./snapshot.js`. No control is re-exported by the package barrel.
Public `loadProject(options)` uses the same function with defaults and no hook.

```typescript
interface ProjectLimits {
  readonly manifestBytes: number;
  readonly sourceBytes: number;
  readonly totalBytes: number;
  readonly sourceFiles: number;
  readonly visitedEntries: number;
  readonly depth: number;
  readonly attempts: number;
}
interface LoadCheckpoint {
  readonly phase:
    | "after-manifest" | "after-paths" | "after-inventory"
    | "before-open" | "after-open" | "after-read"
    | "before-revalidation" | "after-revalidation-inventory"
    | "after-revalidation-read";
  readonly attempt: number;
  readonly sourceId: SourceId | null;
}
interface ProjectLoadControls {
  readonly limits?: Partial<ProjectLimits>;
  readonly onCheckpoint?: (point: LoadCheckpoint) => void | Promise<void>;
}
function loadProjectWithControls(
  options?: ProjectLoadOptions, controls?: ProjectLoadControls,
): Promise<ProjectLoadResult>;
```

Omitted limits retain the production defaults below. Trusted test arguments use
integer values no greater than those defaults: depth/count/byte limits may be
zero; attempts is at least one. They add no user-configurable limit surface.
`attempt` is one-based. Each hook is awaited once at its named boundary:
after initial manifest decoding/validation, after path validation, after initial
inventory, immediately before each regular input open, after open but before
handle identity checks, after bounded read but before metadata/path checks,
before whole-attempt revalidation, after its repeated inventory, and after each
revalidation read but before its comparison/checks. Open/read checkpoints include
the manifest as well as sources and carry that input's exact relative source ID;
aggregate checkpoints carry null. Revalidation reads also use the open/read
checkpoints. Tests can mutate known real fixture paths at those boundaries;
they do not receive or replace a host, handle, reader, hash, or result.

Test-hook exceptions are test/programmer failures, not project diagnostics;
handles still close. Production has no hook. These parameters belong to the
existing loader operations, not a separate adapter, fixture engine, or runner.
Reduced attempt limits report their actual count on exhaustion rather than a
hard-coded three. Phase 1 pure parser tests use public production limits; they
do not require this Phase 2 function.

## Manifest and Names

Use the existing JSONC tree to detect duplicate keys before value extraction,
including repeated unknown keys. Require an object root and reject errors rather
than returning recovery values. Convert parser stack-exhaustion `RangeError` into
`PROJECT_MANIFEST_SYNTAX` with message `Invalid JSONC at 0: nesting exceeds parser capacity`,
root byte span, and no recovered value. Walk the plan-owned duplicate/schema tree
without recursive calls that can exhaust the JavaScript stack. A 20,013-byte
unknown-field value with 10,000 nested arrays is a required negative vector
below the byte cap, not a reason to add a parser or public nesting setting.
Validate every RD-owned key/default/type; report
independent manifest violations without dependent cascades. Malformed syntax or
unusable root suppresses schema/path work. Unknown keys never become extensions.

The pure parser checks path field types only: `sourceRoot`/`outDir` strings
and an ordered string array for `assetPaths`. Lexical and native/canonical path
validation belong to Phase 2 `loadProject` below; no filesystem work or additional
empty-string path restriction enters the pure manifest parser.

Preserve exact input bytes. For a leading BOM, the parser may skip the character
but span offsets add its three raw bytes back. Do not strip the manifest/source
record or alter hashes. Fatal UTF-8 decoding rejects malformed input. Duplicate
keys point to the second key and relate the first. Missing keys point to the
object/root and carry their JSON pointer. `name` failures point to `/name` and
escape offending code points; do not suggest a rewritten filename. R2.15 owns
the exact predicate and accepted spelling.

JSONC key/value spans cover the complete token, including surrounding quotes
for a string. Missing-key spans cover the complete root object. Spans use
exclusive ends and raw UTF-8 byte coordinates, including a leading BOM shift.

For the pure name result, `offending` is raw input spelling, not a proposed
replacement: null for empty; the first unpaired surrogate or forbidden scalar;
the final character for a trailing failure; the complete dot-name; or the
original device stem before its first period. Check in this order: empty,
ill-formed Unicode, forbidden character, dot-name, trailing character, reserved
device stem. The diagnostic appends a single offending scalar as uppercase
`U+` with at least four hex digits (including lone surrogate code units).
For a multi-character dot-name or device stem, append its JSON-escaped quoted
spelling instead. This plan-owned signature clarification adds no name rule.

Validate `entry` as a nonempty qualified ASCII module identifier using the frozen
lexical/module identifier rules, not filenames or module-header scans. An override
is validated the same way and recorded separately; it never repairs an invalid
manifest. Profile IDs are the exact ordered table in `spec/15-platform-profile.md`.
Invalid profiles instantiate E10279 exactly. No codegen/profile capability claim.
Render its `qualified_profiles` placeholder as the ordered nine IDs joined by
comma and space, without quotes around each ID.

Standalone `parseManifest` uses source ID `blend65.json` unless explicitly supplied;
the loader supplies the exact host-exposed relative manifest filename. Enforce
the manifest byte bound for this public entry too. A JavaScript text argument
containing literal unpaired surrogates is rejected rather than implicitly
re-encoded with replacements; escaped invalid name values still receive the
specific name predicate. This does not turn the manifest into a source parser.

## Discovery and Containment

Discover nearest upward manifest, or use the explicit path authoritatively.
`cwd` defaults to the caller's working directory. Resolve an explicit relative
project path against that directory. Never fall back from an invalid explicit
path or unreadable nearer manifest to a different project.

Keep separate logical host-exposed spelling and canonical filesystem identity.
Paths are manifest-relative native-host paths, not normalized input names. Reject
absolute/drive/UNC content paths on the relevant native host; perform lexical
containment and realpath containment checks using path component relationships,
not string-prefix tests. A contained `..` component is not an escape; escaping
the root is invalid. Do not impose Windows output-name rules on Linux source
names admitted by that host.

Resolve root/source/asset directories and check regular/directory/readable type.
For missing `outDir`, resolve its nearest existing parent and remaining contained
components without creating anything. Reject file-occupied components. Reject
explicit source/asset directories within the logical or canonical output tree.
`sourceRoot: "."` is legal with a nested output subtree. Exclude that subtree
before opening or enumerating it, even when it contains unreadable prior output.

Contained source symlinks may be followed only after resolving containment and
type. Track active canonical directory ancestors for cycles; track regular-file
identity for aliases/hardlinks and duplicate resolved sources. Preserve the
logical path by which the host inventory exposed each accepted name. A cycle,
alias, device, unsupported special input, permission failure, disappearance, or
outside-root identity fails the complete load. No silent skip of rejected sources.

Open regular inputs through canonical paths, verify opened-handle identity/type
against the resolution, bound the read, then recheck handle metadata and path
identity/containment. Close every handle on every branch. Refuse an observed
symlink/path replacement; use no-follow controls where Node/native host supports
them. An identity guard, not `stat` followed by an unchecked read, is the proof.
Expected host error codes are sanitized; they do not leak absolute paths/stacks.

## Inventory and Bounds

Stream directory entries rather than allocating an unbounded recursive list.
Collect only regular case-sensitive `.blend` suffix files, while checking traversed
directories and followed aliases. RD-02 validates asset search directories but
does not recursively read asset content or implement asset lookup/embedding.
An empty source inventory is `PROJECT_EMPTY_SOURCES`.

| Host safety limit | Default |
|---|---|
| Manifest raw bytes | 1,048,576 |
| Each source raw bytes | 4,194,304 |
| Total unique manifest and source raw bytes admitted per attempt | 268,435,456 |
| Source files per attempt | 10,000 |
| Visited directory entries per attempt | 100,000 |
| Source-tree depth, source root = 0 | 64 |
| Complete attempts, including the first | 3 |

Check limits before large allocations/reads and during traversal. A bounded read
must catch growth beyond the checked size. Diagnostics identify limit name,
configured maximum, and observed/attempted count. Internal test parameters may
lower limits for small fixtures. Revalidation is separately bounded to the same
input set and per-file caps; three attempts bound total reread work.
The exact diagnostic limit names are the declared `ProjectLimits` keys:
`manifestBytes`, `sourceBytes`, `totalBytes`, `sourceFiles`, `visitedEntries`,
and `depth`. Attempt exhaustion uses `PROJECT_CHANGED`, not a limit diagnostic.
These are host safeguards, not target memory or
comptime limits, and add no public manifest/CLI configuration surface.

## Snapshot and Identity

For each complete attempt: read/validate manifest, resolve paths, inventory, read
sources, then revalidate the manifest, path/handle identities and metadata, complete
inventory, and content hashes before accepting. Capture high-resolution identity
metadata and repeat the whole attempt from the manifest on a detected change;
never patch one entry into a partially accepted snapshot. Revalidation must detect
new/removed files as well as replacement/content changes. Retry only observed
instability; invalid manifest/escape/type/limit violations fail directly.
An input disappearing after successful resolution/inventory is observed
instability, including immediately before open. Initial missing required paths
and permission failures are direct typed failures. See AR-P9.

Nothing becomes public until the whole attempt passes. Freeze nested records and
arrays; source content is immutable text, never a mutable public Buffer/view.
Raw UTF-8 bytes can be reconstructed without normalization; BOM is preserved in
text and raw hashes. The snapshot describes the observed and revalidated input
set. It is not a filesystem transaction or a promise against undetectable writes
after final validation. No lock protocol is added for external editors.

Source IDs are exact project-relative host names with `/` separators, including
the exact selected manifest filename (normally `blend65.json`). Compare UTF-8 encoded relative names bytewise,
not via locale, case folding, normalization, or absolute root. Sort sources once.
Hash raw file bytes with SHA-256, producing lowercase hex.

`inputSha256` is SHA-256 of UTF-8 `JSON.stringify` of this fixed array:

```text
["blend65-project-input-v1", [manifestSource.sourceId, manifestSource.sha256],
 [[sourceId, sha256], ...sortedSources], overrideTargetOrNull, overrideEntryOrNull]
```

The manifest's raw hash already binds schema values and exact configuration
spelling. Separate effective values retain invocation overrides. Never hash host
roots, resolved paths, stat identities/timestamps, timing observations, output
bytes, prior generations, process cwd, or toolchain scheduling into this identity.
This is an in-memory identity, not a content-addressed artifact cache.

`BUILD_INFO` is a frozen exported record with `version` matching the package
manifest, `specificationId` from RD-01's frozen inventory, `expertVersion: "2.0.0"`,
and `expertContentCommit: "c9e70fab6039e9ced3108e88f0ea9730d4fd3007"`.
It contains no fabricated compiler capability or new authority selector.

## Project Diagnostics

Per the user's explicit PF-001 product clarification on 2026-09-17,
`PROJECT_*` and `CLI_INVALID_ARGUMENT` are host-service result identifiers outside
Chapter 14's language/compiler diagnostic registry. This accepted host boundary
governs RD-02 and later consumers; it neither edits the frozen specification nor
permits a second language registry. Host identifiers never replace, retire, or
reassign language E/W codes. The profile failure remains normative E10279 with
its exact Chapter 14 template. See the register's Approved Preflight Corrections.

| Identifier | Predicate / message form |
|---|---|
| `PROJECT_NOT_FOUND` | `No blend65.json project found` |
| `PROJECT_READ_FAILED` | `Cannot read '<relative-input-or-option>': <stable-host-code>` |
| `PROJECT_INVALID_UTF8` | `Input '<relative-input>' is not valid UTF-8` |
| `PROJECT_MANIFEST_SYNTAX` | `Invalid JSONC at <byte-offset>: <parser-error>` |
| `PROJECT_MANIFEST_FIELD` | `Invalid project field '<pointer>': <reason>` |
| `PROJECT_DUPLICATE_KEY` | `Duplicate project key '<key>'` |
| `PROJECT_INVALID_NAME` | `Invalid project name: <R2.15-reason> <escaped-offending-point-if-any>` |
| `PROJECT_PATH_INVALID` | `Invalid project path '<pointer-or-relative-input>': <reason>` |
| `PROJECT_SOURCE_ALIAS` | `Source '<relative-input>' resolves to an already inventoried input` |
| `PROJECT_PATH_CYCLE` | `Project path cycle: <ordered-relative-paths>` |
| `PROJECT_EMPTY_SOURCES` | `No .blend source files under '<source-root>'` |
| `PROJECT_HOST_LIMIT` | `Project host limit '<name>' exceeded: maximum <limit>, observed <value>` |
| `PROJECT_CHANGED` | `Project inputs changed during loading; all <attempts> attempts failed` (production: 3) |
| `PROJECT_HOST_UNSUPPORTED` | `Unsupported project host: <node-major>/<os>/<arch>` |
| `PROJECT_HOST_BEST_EFFORT` | Warning: `Project host is best-effort: <node-major>/<os>/<arch>` |

All failures have error severity. Best-effort host status is a non-error
observation only on success. An exhausted attempt set returns one root changed
diagnostic and no partial snapshot. Independent malformed fields may have several
diagnostics; sort by relative identity, raw byte start, severity (error first),
code, then message using deterministic comparison. Escape control characters and
terminal escapes in inserted names; never log full proprietary source or error
objects. Paths unavailable as trustworthy project-relative values use the
responsible option/key, not an absolute host path.

See ST-09–ST-31. Spec tests derive predicates from RD-02 and the explicit contracts
above; implementation tests may inspect internal read/retry details afterwards.
