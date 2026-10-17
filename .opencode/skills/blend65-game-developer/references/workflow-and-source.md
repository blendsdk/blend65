# Workflow and source

Use this reference for project setup, readable source decomposition and the
public development loop. Application-system choices belong in
[game systems](game-systems.md); proof and security details belong in
[evidence and boundaries](evidence-and-boundaries.md).

## Start with a small explicit contract

Record what the application does before choosing implementation details:

- Observable states, inputs, transitions, outputs and exit behavior.
- Update and display cadence, input sampling points and required effect order.
- Numeric ranges, capacities, initialization and overflow policy.
- Exact profile, source/assets, compiler identity and tool versions.
- Required public operations and their availability for that identity.

The language's [profile contract](../../../../spec/15-platform-profile.md)
defines whole target identities. A profile includes video timing, hardware model,
firmware ownership, banking, resources and delivery format. Do not mix pieces of
different profiles or infer current implementation support from specification
membership. Ask when the application's needs do not match a supported profile;
do not silently change timing, ownership or required behavior to get a build.

## Set up through the public toolchain

Use Node.js 22 or newer and an explicitly identified local toolchain. The
`@blend65/compiler` and `@blend65/cli` packages at version `0.1.0` are local
workspace facts, not a claim of registry publication or installation availability.
Use an authorized built toolchain; do not consume another checkout's live build
outputs or install tools automatically. Record the compiler content identity as
well as the package version.

An illustrative `blend65.json` manifest is:

```json
{
  "schemaVersion": 1,
  "name": "border-demo",
  "sourceRoot": "src",
  "entry": "Game",
  "target": "c64-pal-prg-kernal-6581",
  "assetPaths": [],
  "outDir": "out",
  "optimization": "none",
  "boundsCheck": false,
  "divisionZeroCheck": false
}
```

Choose safe project-relative paths and an owned output directory. Treat incoming
manifests and path aliases as untrusted; validate them before use. The profile
above is an explicit example, not the right target for every application.

The two `false` settings illustrate an unchecked build, not a safety
recommendation. Choose each check explicitly from the behavior and cost contract.
Unchecked indexing can access unrelated memory or devices; a narrow integer
wrap is not an array-bound check. Checked failure is a non-returning platform
safety stop, not a recoverable exception, and is not protection against all
hardware activity. Review the actual emitted success and failure paths.

A minimal `src/game.blend` uses a verified named hardware operation:

```blend65
module Game;

/** Set the border through the selected profile's named VIC operation. */
function main(): void {
    c64.vic.setBorderColor(6);
}
```

`c64.vic.setBorderColor(color: byte): void` is provided as a qualified namespace
by this profile; no import is needed. This is a setup example, not a frame loop
or a behavior-verified application. Do not extrapolate other APIs from its name.
This cooperative KERNAL PRG profile restores owned caller and machine state when
`main` returns, so the example does not promise a persistent visible border
change; the application owns its lifecycle.

## Check, build and run deliberately

With the pinned `blendc` executable available, always name the manifest:

```sh
blendc check --project ./blend65.json
blendc build --project ./blend65.json --optimization none
blendc run --project ./blend65.json
```

The current public build option supports only `optimization: 'none'`. Do not
advertise another mode as available or replace an unsupported requested mode
silently. `--target` and `--entry` are shared overrides; record them when used.
`--bounds-check true|false` and `--division-zero-check true|false` belong to build
and run, not check. For example, an explicitly checked build is:

```sh
blendc build --project ./blend65.json --optimization none --bounds-check true --division-zero-check true
```

Changing options changes the result being assessed. Retain the previous build
identity and repeat affected proof instead of combining evidence from different
settings. A successful `check` does not prove assembly, execution or timing.

`run` starts an interactive emulator and returns `interactive-unverified`.
It is useful for manual exploration, not automated behavior proof. Before any
emulator invocation, agree an exclusive VICE window across sessions, even across
different checkouts. Run cases sequentially and manage only your own processes.
Wait if ownership is unavailable. Correlate the artifact actually launched with
the build being assessed; a prior build's identity is not enough.

For programmatic use, import the public package, never compiler internals:

```ts
import { buildProject } from '@blend65/compiler';

const result = await buildProject({ project: './blend65.json' });
```

The public services are `checkProject(options?)`, `buildProject(options?)` and
`runProject(options?)`. Their common options include `project` (the manifest
file, **not** a directory), `cwd` (starting directory), `target`, `entry` and
`signal` (`AbortSignal`). Pass an options object, not a positional directory.

Discriminate the build result before accessing output. A failure has
`kind: 'failure'`, `category` and `diagnostics`; it is not a usable generation.
A success has `kind: 'success'`, `diagnostics`, `measurements` and `generation`.
Retain `generationId`, `directory`, `buildJsonSha256` and `primaryArtifact` from
that returned generation. Inspect only its exact immutable files, never a
mutable current-output alias, a sibling generation or another checkout.

Inspect the primary artifact named by `generation.primaryArtifact` with its
assembly (`.asm`), labels (`.labels`), memory (`.memory.json`), assets
(`.assets.json`), costs (`.costs.json`), debug (`.debug.json`) and build
(`.build.json`) sidecars. These are exact fixed filenames inside the returned
generation directory, not suffixes to append to the primary artifact's name or
permission to search unrelated or protected files. Reconcile source locations,
placement and resources with the same artifact identity. See
[evidence and boundaries](evidence-and-boundaries.md) before drawing conclusions.

## Decompose by application responsibility

Follow [modules](../../../../spec/10-modules.md): put `module Name;` first in
each source file, keep executable statements inside functions, and use exactly
one `function main(): void` entry point. Export only declarations other modules
need; use named imports or qualified access. Module names are case-sensitive
identities, not filenames. Several files may contribute to one module.

Split source when responsibilities become hard to explain: for example, entry
and lifecycle, model/state, input interpretation, display and audio decisions.
These are application modules, not promised toolchain components. Keep related
data and invariants together. Prefer small reusable functions to copied code,
one giant entry function or an invented framework.

Write ordinary nested calls and returns. Arguments evaluate left to right; a
function-valued target evaluates once before its arguments. Do not reorder calls
that read hardware or change state merely to simplify source or generated code.
Call cycles are rejected: use iteration for recursive algorithms. A nested call
is legal; a function definition nested inside another function is not.

## Choose types from meaning and range

Use the [type rules](../../../../spec/02-type-system.md), not guessed machine
shortcuts:

| Need | Source choice and invariant |
| --- | --- |
| Small unsigned quantities | `byte`, range 0–255; do not force larger counts into it |
| Larger unsigned quantities or addresses | `word`, range 0–65535; addresses still need lifetime and device contracts |
| Signed quantities | `sbyte` or `sword`; choose a range that includes intermediate results |
| Conditions | `boolean`; integers are not implicitly truthy |
| Named state | An enum; validate external values because a byte-to-enum cast does not check membership |
| Fixed records and collections | Structs and fixed arrays with explicit complete types |

Every variable, constant, parameter and return type needs an annotation.
Same-signedness widening is implicit; narrowing and mixed signedness require an
explicit intentional conversion. Runtime arithmetic wraps at its expression
width. Assigning a byte-width result to `word` does not undo earlier overflow:
use `word(a) + word(b)` when the sum must be wide. If wrapping is not intended,
test or clamp before narrowing. Constant-expression evaluation uses full
precision and rejects a result outside its declared type instead of wrapping.

## Use aggregates as normal values

Read [structs](../../../../spec/07-structs.md),
[arrays](../../../../spec/08-arrays-strings.md) and
[functions](../../../../spec/06-functions.md) for exact rules.

- Struct assignment and return require the same declared struct type. Fixed
  arrays require the same element type and every ordered extent. Use ordinary
  aggregate returns; do not add source output parameters to accommodate lowering.
- Scalar and ordinary function-value parameters are copied. Array and struct
  parameters borrow the caller's data; mutation affects that original object.
  Use `const` aggregate parameters for read-only access.
- `T[]` is an any-size borrowed parameter form, not a dynamic array, stored slice
  or return type. It may also infer an extent from a declaration initializer.
  Stored arrays have fixed extents. Initialize every value before reading it.
- Use `word` counts and indices when ranges require them. `length`, `sizeof`
  and `offsetof` return `word`; an object crossing 255 bytes is not a different
  source programming model. Nested arrays are rectangular and row-major.
- A direct subscript's arithmetic has a 16-bit-capable ordinal context. An
  explicit narrow cast, stored narrow intermediate or narrow result computed
  inside a called function preserves that earlier narrow arithmetic. Neither
  promotion nor a wide index proves that the access is in bounds.

For example, an application utility can return a record and consume that result
in an ordinary nested call:

```blend65
module Measures;

/** Two extents whose application contract keeps their product within word range. */
export struct Dimensions {
    /** Horizontal extent in the caller's units. */
    width: word;
    /** Vertical extent in the caller's units. */
    height: word;
}

/** Construct a fixed value; the compiler owns the hidden return destination. */
export function dimensions(width: word, height: word): Dimensions {
    return { width: width, height: height };
}

/** Read the borrowed record without changing the caller's data. */
export function area(size: const Dimensions): word {
    return size.width * size.height;
}

/** A small composition example, not an execution or output-cost claim. */
export function exampleArea(): word {
    return area(dimensions(12, 9));
}
```

## Function values, compile-time work and lifetimes

Use exact `fn(parameterTypes): ReturnType` values for finite application-selected
functions. `&ordinaryFunction` preserves its callable type; signatures, qualifiers
and array extents must match. Typed values may be stored, passed, returned and
called within the compiler-proven finite source target set. There are no closures,
captures or raw-address-to-function conversions. Conversion to `word` erases the
callable proof; an interrupt handler is a separate non-callable kind.

Use `comptime function` for pure bounded construction of constant tables or
records. It emits a constant result, not a runtime routine or frame. It cannot
read runtime/MMIO/host state, perform indirect calls or invoke ordinary runtime
functions. Validate embedded inputs outside the function. Compiler evaluation
budgets still apply; do not promise unlimited host computation.

[Static Frame Allocation and lifetimes](../../../../spec/11-memory-model.md)
make function execution storage a compiler responsibility. Fixed physical homes
do not make locals persistent. A local-derived address is valid only within its
source lifetime and proven non-retaining uses; copying an address does not extend
that lifetime. Use suitably lived caller-owned or module data for consumers that
retain it. Assets, images, banks, segments and packaging are separate placement
concerns, not function frames. No heap or generic runtime is introduced.

## Diagnose without rewriting intent

Read public diagnostic `code`, `severity`, `message`, `primarySpan`, `related`,
`help` and `pointer` fields when present. Resolve the relevant source spans and
manifest fields. A warning is not proof that a shared-state hazard or numeric
edge is harmless. A successful build with warnings still needs behavior review.

For a failure, keep the smallest ordinary-source reproduction that preserves the
trigger and intended effect order. Retain the exact toolchain/profile/options,
diagnostic and generation identity when one exists, expected result and its
normative basis. Remove unrelated code, not the legal feature that fails.
Hand a suspected compiler defect to its owner; do not patch generated output,
import private compiler APIs, amend expected answers or teach a compiler gap as
a language restriction. Preserve the failed attempt separately from prior proof.
