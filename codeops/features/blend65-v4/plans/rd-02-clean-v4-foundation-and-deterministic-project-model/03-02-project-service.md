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

## Manifest and Names

Use the existing JSONC tree to detect duplicate keys before value extraction,
including repeated unknown keys. Require an object root and reject errors rather
than returning recovery values. Validate every RD-owned key/default/type; report
independent manifest violations without dependent cascades. Malformed syntax or
unusable root suppresses schema/path work. Unknown keys never become extensions.

Preserve exact input bytes. For a leading BOM, the parser may skip the character
but span offsets add its three raw bytes back. Do not strip the manifest/source
record or alter hashes. Fatal UTF-8 decoding rejects malformed input. Duplicate
keys point to the second key and relate the first. Missing keys point to the
object/root and carry their JSON pointer. `name` failures point to `/name` and
escape offending code points; do not suggest a rewritten filename. R2.15 owns
the exact predicate and accepted spelling.

Validate `entry` as a nonempty qualified ASCII module identifier using the frozen
lexical/module identifier rules, not filenames or module-header scans. An override
is validated the same way and recorded separately; it never repairs an invalid
manifest. Profile IDs are the exact ordered table in `spec/15-platform-profile.md`.
Invalid profiles instantiate E10279 exactly. No codegen/profile capability claim.

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

Host-project failures use descriptive stable identifiers, not retired/reassigned
language E codes. They are project-service diagnostics, not new Blend65 grammar
or semantic rules. The frozen profile failure remains normative E10279.

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
| `PROJECT_CHANGED` | `Project inputs changed during loading; all 3 attempts failed` |
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
