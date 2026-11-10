# Ambiguity Register: RD-07 Loadable Assets and D64 Delivery

> **Status**: ✅ GATE PASSED — all 22 items resolved
> **Last Updated**: 2026-11-10 08:44
> **Mode**: Auto-design active — eligible technical decisions delegated; reserved decisions remain user-owned
> **Root invocation ID**: `rd07-plan-20261110T0844`
> **Policy version**: 1

## Scope of the register

RD-07 requirements are preflighted and AR-001 through AR-044 are resolved in
[00-ambiguity-register.md](../../requirements/00-ambiguity-register.md). This register records only
the plan-local gaps that the requirements do not settle by themselves: implementation mechanisms,
exact encodings, diagnostic mapping into the frozen registry, and evidence-schema details. It does
not reopen approved product behavior.

## Register

| # | Category | Ambiguity / gap | Decision | Status | Authority |
|---|----------|-----------------|----------|--------|-----------|
| AR-P1 | Feature gap | Which loadable initializer forms are in this slice? | Scalars, fixed arrays, fixed structs, and RD-06 embedded/composed values; unsized arrays and non-constant initializers stay rejected. | ✅ Resolved | RD-07 R7.1 |
| AR-P2 | Behavioral | Which profile exposes `c64.loader.load`? | Only `c64-pal-d64-kernal-6581`. The four PRG profiles keep E10275; unknown profiles keep E10279. | ✅ Resolved | RD-07 R7.9, R7.19; AR-032 |
| AR-P3 | Behavioral | Which destination forms produce a finite candidate set? | One static place, or a fixed-array element selected by a runtime index whose every element has the exact unit type; nested fields and constant indices compose normally. No root-only rule, no pointer arithmetic, no general theorem solver. | ✅ Resolved | AR-P3 |
| AR-P4 | Behavioral | How granular is the publication/alias fact? | Sparse half-open logical ranges per destination binding, plus must-alias propagation through proved address provenance. May-alias and partial overlap lose definite-initialization credit. No runtime state. | ✅ Resolved | AR-P4 |
| AR-P5 | Behavioral | How is quiescence proved? | Reuse the RD-05 LIFO IRQ/NMI ownership state and the audio route state at the call. Every recognized user route must be restored/stopped; the stock KERNAL route stays active. Unproved routes reject with E10275. | ✅ Resolved | AR-P5 |
| AR-P6 | Technical | Is the loader emitted inline or as a shared helper? | Inline the exact SETLFS/SETNAM/LOAD sequence per call. Name bytes are per-unit data objects. No helper ABI, no registry, and the code exists only when a load call is reachable. | ✅ Resolved | AR-P6 |
| AR-P7 | Technical | Which KERNAL state is reserved, preserved, or reported clobbered? | Reserve the documented KERNAL workspace (`STATUS`, `VERCK`, `MEMUSS`, `EAL/EAH`, `FNLEN`, `FNADR`, `LA`, `SA`, `FA`), the hardware stack peak, and the loader's own temporaries. The adapter saves live program registers it uses and reports every unavoidable clobber; SFA excludes the reserved bytes when the loader is linked. | ✅ Resolved | AR-P7 |
| AR-P8 | Technical | How do RD-07 conditions map onto the frozen diagnostic registry? | Source conditions use E10274, E10275, E10276 and E10279. Packaging conditions use stable packaging failure codes `D64_PROFILE`, `D64_NAME`, `D64_CAPACITY`, and `D64_STRUCTURE` in the existing `packaging` category. Sidecar envelopes keep E10267/E10268. No `spec/` edit. | ✅ Resolved | AR-P8 |
| AR-P9 | Technical | How are the D64 disk label and disk ID derived? | Label: deterministic uppercase PETSCII encoding of the validated project name, at most 16 bytes, `$A0`-padded. ID: two uppercase PETSCII characters from the first two hex digits of the canonical semantic-input SHA-256. Both are recorded in `.build.json` as PETSCII hex. | ✅ Resolved | AR-P9 |
| AR-P10 | Technical | How are directory names encoded and made collision-free? | Uppercase A–Z, 0–9 only. Boot name derives from the project name; each unit name is `L` plus 12 uppercase hex characters of its stable unit identity. Names are 1–16 bytes and `$A0`-padded in the directory. A collision or unrepresentable boot name is rejected, never silently rewritten. | ✅ Resolved | AR-P10 |
| AR-P11 | Technical | Which sector allocation/interleave policy is used? | Policy `cbm-dos-1541-interleave-v1`: file data in ascending tracks outside track 18 with the standard 1541 file interleave 10, directory sectors in the standard interleave-3 chain, and a measured VICE KERNAL-load comparison before the serializer is accepted. The measured result is recorded in the build evidence. | ✅ Resolved | AR-P11 |
| AR-P12 | Technical | What fill byte is used for unused bytes and sectors? | `$00` for unused directory bytes, tail bytes, unused sectors, and image padding. The choice is recorded as a policy constant and covered by the independent decoder. | ✅ Resolved | AR-P12 |
| AR-P13 | Technical | Where does the D64 packager live? | New `packages/compiler/src/packaging/d64/` module with pure geometry, allocator, encoder, and evidence projections. The target profile owns the packager identity `cbm-d64`; no external dependency and no shell call. | ✅ Resolved | AR-P13 |
| AR-P14 | Technical | How are D64 records added to the version-1 sidecars? | Use the existing version-1 record families and fields: `.build.json` `package.kind: "d64"` with the admitted component set, `.assets.json` `placement.kind: "loadable"`, `.memory.json` `loader`/`loadDestination`/`loadUnitId`, `.costs.json` `loader`/`diskFile`/`diskContainer`/`sectorOverhead`/`callSite`/`existingRom`, and `.debug.json` `loadUnits`. No schema-version bump and no parallel format. | ✅ Resolved | AR-P14 |
| AR-P15 | Technical | How does `run` autostart the first D64 entry? | Probe VICE 3.10 first, then record one exact argv. The expected form attaches the D64 as drive 8 and autostarts the boot entry; if VICE requires `8:<name>`, the probe fixes that spelling. No stale PRG fallback. | ✅ Resolved | AR-P15 |
| AR-P16 | Technical | Are native RD-06 assets allowed under `loadable const`? | Yes. Remove the current E10204 loadable rejection; the handler's exact bytes become the load unit payload. Inconsistent handler output stays an error. The expressiveness-ledger row is retired with evidence. | ✅ Resolved | RD-07 R7.1; AR-P16 |
| AR-P17 | Technical | What is a load unit's stable identity? | The qualified declaration identity plus its logical type descriptor and initializer provenance. Aliases of the same declaration share one unit; different declarations stay distinct even when their bytes match. Content hashes are evidence, not identity. | ✅ Resolved | RD-07 R7.6, R7.14; AR-P17 |
| AR-P18 | Non-functional | Which verification command governs this plan? | Impact-based directed suites during implementation, then one complete RD-07 boundary plus the repository `yarn build`, `yarn typecheck`, `yarn test`, and targeted `yarn prettier --check`. No new readiness product. | ✅ Resolved | RD-07 R7.45; AGENTS.md |
| AR-P19 | Non-functional | Which expert baseline version is bound? | Active baseline `2.0.4`, content commit `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`. HLE-010 and the KERNAL/D64 guidance are already present; no spec or skill edit. RD-07's historical `2.0.0` reference is satisfied by the current qualified baseline. | ✅ Resolved | AR-P19 |
| AR-P20 | Scope | Does any work here reopen hardware qualification? | No. Automated evidence is VICE 3.10 `x64sc` and remains `VICE-verified / hardware-unverified`. Real-drive and physical-C64 QA stay RD-10-owned. | ✅ Resolved | RD-07 R7.44; AR-027 |
| AR-P21 | Edge case | Are exact-fit boundaries accepted? | Yes for a destination ending exactly at `$10000` (returned X/Y `$0000`), for exactly 664 used data blocks, and for exactly 144 directory entries. One byte/block/entry beyond each limit fails before publication. | ✅ Resolved | RD-07 R7.15, R7.20 |
| AR-P22 | Integration | Is the D64 packager or loader a new generalized framework? | No. Both are the direct built-in implementations the RD requires: one packager, one KERNAL strategy, one independent test decoder. No plugin registry, external packager, fastloader, compressor, or VFS. The Complexity Escalation Gate is not triggered. | ✅ Resolved | RD-07 R7.12, R7.18; AR-042 |

## Resolution Notes

### AR-P1 — Loadable initializer forms

**Decision per AR-P1:** keep the frozen R7.1 type set. An unsized array, a non-constant initializer,
a mutable `let`, or a `loadable` member of a `zeropage` block stays rejected by the existing
frontend checks. No new type system is introduced.

### AR-P2 — Profile availability

**Decision per AR-P2:** the D64 profile is a distinct executable profile, not an alias of
`c64-pal-prg-kernal-6581`. The source capability appears only in the D64 profile's declaration
environment. PRG-profile rejection remains E10275 with the selected profile named.

### AR-P3 — Destination candidate sets

**Decision per AR-P3**

```text
Authority: AI — delegated by --auto-design
Eligibility: Implementation mechanism inside the approved destination contract (R7.3/R7.4); it
  does not change which source forms the approved requirement allows.
Objective: Prove every possible destination interval before emission without a general solver.
Decision: Static place -> one interval. Fixed-array element with a runtime index -> every element
  of that fixed array is a candidate, admitted only when every candidate has the exact unit type and
  a complete legal interval. Nested fields and constant indices compose by ordinary place paths.
Evidence: Existing place/provenance model in frontend/address-provenance.ts and semantic
  SemanticPlace; RD-07 R7.3 explicitly requires fields, nested fields, array elements and finite
  dynamic sets; layout already proves complete intervals.
Rejected alternatives: Root-only destinations (rejected: R7.3 forbids it); arbitrary pointer
  arithmetic (rejected: no pointer language and no finite proof); a general theorem solver
  (rejected: R7.5 forbids it and it is disproportionate).
Strongest counterargument: A fixed-array candidate set can be large and may over-constrain every
  element even when only one index is reachable. The requirement explicitly chooses the finite
  conservative set, and the alternative would require runtime validity state.
Confidence: High — the source forms and proof obligation are frozen by R7.3/R7.4.
Hardening: In-context second pass against the existing place model; no independent challenger is
  required because the decision is bounded and reversible before emission.
Policy version: 1
Root invocation ID: rd07-plan-20261110T0844
Reopen triggers: A required destination form cannot be represented by the existing place model;
  a finite candidate set cannot be proved without unbounded enumeration.
```

### AR-P4 — Publication and alias granularity

**Decision per AR-P4**

```text
Authority: AI — delegated by --auto-design
Eligibility: Compiler analysis mechanism inside the approved definite-assignment contract
  (R7.5); it does not add runtime state or change the publication rule.
Objective: Prove byte-range initialization after a load without a general theorem solver.
Decision: Keep sparse half-open logical ranges per destination binding. A capture records the
  destination place and its ranges plus a fresh result identity. The true edge adds only those
  ranges; the false edge removes them. Must-alias bindings inherit the same update through proved
  address provenance; may-alias and partially overlapping bindings lose credit. Joins intersect
  ranges; loops use the existing monotone fixed point.
Evidence: frontend/flow-facts.ts already stores initializedRanges, initializedPaths,
  conditionalEffect and addressPlaces; mergeScalarFacts already intersects ranges and drops
  conditional effects when alternatives disagree; R7.5 requires exactly this sparse range model.
Rejected alternatives: A global memory bitmap (rejected: over-approximates and is not sparse);
  per-array-element enumeration (rejected: R7.5 forbids it); runtime validity state (rejected:
  R7.5 and R11 forbid it).
Strongest counterargument: Per-binding ranges do not by themselves describe overlapping fields of
  one object. The place path supplies the field offset, and the implementation converts it to a
  binding-relative range, so partial overlap remains expressible without a global model.
Confidence: High — the existing flow-fact shape already supports the needed operations.
Hardening: In-context second pass; the semantics are frozen, only the representation is chosen.
Policy version: 1
Root invocation ID: rd07-plan-20261110T0844
Reopen triggers: A required alias case cannot be expressed as a binding-relative range; the
  existing merge semantics cannot represent a required join or loop fact.
```

### AR-P5 — Quiescence mechanism

**Decision per AR-P5:** the call site consumes the existing LIFO ownership proof. A recognized
`setIRQ`/`setNMI`/audio route that is still active at the call rejects with E10275 and names the
route. A route that was restored/stopped before the call passes. The stock KERNAL service route is
not a user route and stays active. This reuses RD-05's `storage/irq-stack.ts` and audio capability
state instead of inventing a second ownership model.

### AR-P6 — Inline loader

**Decision per AR-P6**

```text
Authority: AI — delegated by --auto-design
Eligibility: Internal lowering mechanism inside the approved one-strategy loader (R7.18/R7.19).
Objective: Emit the exact KERNAL sequence with the smallest support surface.
Decision: Inline SETLFS/SETNAM/LOAD at each reachable call. Unit name bytes are a read-only data
  object. No shared helper function or ABI.
Evidence: The expert baseline prices the three setup-and-call sequences at 27 bytes/37 cycles
  before variable KERNAL work; R7.18 requires the loader only when reached. Inline emission
  directly matches the hand-written expert form and avoids an internal calling convention.
Rejected alternatives: One shared helper with a name/destination ABI (rejected: extra ABI and
  parameter staging for no proven win); a source library (rejected: would add a public loader
  module and import surface).
Strongest counterargument: Repeated call sites duplicate 27 bytes. Sharing would save code for a
  program with many loads, but no measured workload justifies the added ABI, and the RD explicitly
  keeps the first transport minimal.
Confidence: High — bounded and reversible; the exact sequence is frozen.
Hardening: In-context second pass against the expert cost baseline.
Policy version: 1
Root invocation ID: rd07-plan-20261110T0844
Reopen triggers: A measured program shows inline duplication dominating loader cost; a required
  calling pattern cannot be expressed inline.
```

### AR-P7 — KERNAL workspace and preservation

**Decision per AR-P7:** the adapter reserves the documented KERNAL workspace names from the expert
reference (`STATUS`, `VERCK`, `MEMUSS`, `EAL/EAH`, `FNLEN`, `FNADR`, `LA`, `SA`, `FA`), the
hardware stack peak, and its own A/X/Y/flags temporaries. The generated wrapper saves any live
program register it must use and restores it on both success and failure. KERNAL workspace bytes are
reported as clobbered, not restored, because the profile contract says they may change. When a load
call is reachable, SFA excludes those bytes from its zero-page window; when no call is reachable,
the existing allocation is unchanged.

### AR-P8 — Diagnostic mapping

**Decision per AR-P8**

```text
Authority: AI — delegated by --auto-design
Eligibility: Implementation mapping inside the frozen diagnostic registry; it does not change the
  registry or claim a new public code.
Objective: Give every RD-07 failure a stable, documented identity without editing spec/.
Decision: Source-level loadable and destination failures use E10274, E10275, E10276 and E10279.
  Packaging failures use the existing `packaging` failure category with stable service codes
  `D64_PROFILE`, `D64_NAME`, `D64_CAPACITY`, and `D64_STRUCTURE`. Sidecar JSON envelope failures
  keep E10267/E10268. No new E10xxx code is invented.
Evidence: spec/14-diagnostics.md is frozen and assigns only E10274-E10276 and E10279 to this area;
  packages/compiler/src/services/services.ts already uses stable serviceDiagnostic codes such as
  ARTIFACT_EVIDENCE and PUBLICATION_FAILED for non-source failures.
Rejected alternatives: Add E10282+ to spec/ (rejected: spec/ is frozen by D3 and RD-01 did not
  authorize an RD-07 diagnostic transition); reuse E10267 for binary D64 structure (rejected: its
  frozen scope is the JSON artifact envelope); silently emit generic COMPILER_LAYOUT text
  (rejected: R7.36/R7.37 require stable identities and actionable detail).
Strongest counterargument: RD-07 R7.36 literally says Specification 4 assigns unique codes for all
  fifteen conditions. The frozen registry does not, and the governing rule forbids editing it during
  implementation. The plan therefore satisfies the conditions with the frozen source codes plus
  stable packaging identities and records the literal gap in the closeout rather than fabricating a
  registry.
Confidence: High — no spec edit is lawful, and the chosen identities are stable and testable.
Hardening: In-context cross-check against spec/14; a spec transition would be a separate user-owned
  authority decision.
Policy version: 1
Root invocation ID: rd07-plan-20261110T0844
Reopen triggers: The user authorizes a Specification 4 diagnostic amendment; a frozen code's scope
  is found to cover one of the packaging conditions more precisely.
```

### AR-P9 — Disk label and ID

**Decision per AR-P9**

```text
Authority: AI — delegated by --auto-design
Eligibility: Deterministic artifact metadata inside the approved D64 profile; no product behavior
  or compatibility promise changes.
Objective: Produce a stable label and ID that VICE and a 1541 accept.
Decision: Label = uppercase PETSCII encoding of the validated project name, maximum 16 bytes,
  `$A0` padded. ID = two uppercase PETSCII characters derived from the first two hex digits of the
  canonical semantic-input SHA-256. Both are recorded as PETSCII hex in .build.json.
Evidence: The frozen spec does not define label/ID; RD-03's version-1 .build.json requires the
  fields; the expert baseline requires deterministic compiler-owned identities and leaves
  allocation policy to the packager. Deterministic derivation avoids host/time state.
Rejected alternatives: Random ID (rejected: breaks byte-identical builds); fixed "65" ID
  (rejected: needlessly collides across projects and ignores project identity); truncating the
  label without recording it (rejected: hides an observable format choice).
Strongest counterargument: A hash-derived two-character ID has only 256 values and can collide
  across different projects. Only one image is mounted by this profile, and the label plus image
  hash disambiguate the artifact; cross-project disk identity is not a contract.
Confidence: High — deterministic and accepted by the target format.
Hardening: In-context check against the RD-03 schema and VICE probe.
Policy version: 1
Root invocation ID: rd07-plan-20261110T0844
Reopen triggers: VICE or a real 1541 rejects the chosen label/ID; a future multi-disk workflow
  requires globally unique IDs.
```

### AR-P10 — Directory names

**Decision per AR-P10:** boot name from the validated project name through the C64 encoding policy;
unit names `L` + 12 uppercase hex characters of the unit identity hash. The directory stores the
16-byte `$A0`-padded form; SETNAM receives the unpadded bytes. A boot/unit collision or an
unrepresentable project name is `D64_NAME`, never a silent rewrite. Unit names are stable across
checkout paths because the identity is semantic, not host-path-based.

### AR-P11 — Allocation and interleave

**Decision per AR-P11**

```text
Authority: AI — delegated by --auto-design
Eligibility: Packager mechanism inside the approved fixed D64 format; it changes only which free
  sector a file uses, not the image contract.
Objective: Choose a measured, documented, versioned sector order that a 1541 and KERNAL serve
  predictably.
Decision: Policy `cbm-dos-1541-interleave-v1`: allocate file data in ascending track order from 1
  to 35, skipping track 18, with the standard 1541 file interleave 10 within each track (for
  example, 0, 10, 20, 9, 19, … on a 21-sector track). Directory sectors use the standard
  interleave-3 chain `18/1, 18/4, 18/7, …`. Before the serializer is accepted, measure a
  representative multi-block KERNAL load under VICE 3.10 and record the chosen policy and observed
  duration in the build evidence. The policy is a versioned constant; changing it is an observable
  format change.
Evidence: Primary D64 format references record the standard 1541 file interleave of 10 and
  directory interleave of 3; the expert reference states that allocation/interleave are measured
  packager choices; the frozen spec fixes geometry but not the order.
Rejected alternatives: Interleave 1 / sequential sectors (rejected: worst-case drive head-step
  pattern); the 1571 interleave 6 (rejected: this profile targets the 1541); copying a
  fastloader-specific order (rejected: no fastloader in this slice); leaving the order unspecified
  (rejected: violates determinism).
Strongest counterargument: VICE's drive emulation does not reproduce real 1541 head-step timing,
  so the measurement cannot prove physical-drive optimality. It can still prove a deterministic
  KERNAL-load path and a stable relative order; physical timing remains hardware-unverified.
Confidence: Med — the format is standard, but the physical timing claim is bounded.
Hardening: In-context comparison against the expert reference; the VICE measurement is the
  required representative check. A targeted real-drive measurement stays RD-10.
Policy version: 1
Root invocation ID: rd07-plan-20261110T0844
Reopen triggers: The VICE measurement shows a materially worse load path than the sequential
  candidate; a real 1541 measurement contradicts the chosen order; a later fastloader requires a
  different policy.
```

### AR-P12 — Fill byte

**Decision per AR-P12:** `$00`. It is the least surprising value for unused directory bytes, tail
bytes, and unused sectors, and it keeps the image deterministic when combined with the fixed
allocation order. The independent decoder asserts it and the policy constant is recorded.

### AR-P13 — Packager location

**Decision per AR-P13:** `packages/compiler/src/packaging/d64/` with pure modules:
`geometry.ts`, `bam.ts`, `directory.ts`, `allocator.ts`, `image.ts`, and `evidence.ts`. The target
profile owns `packager.id = "cbm-d64"` and `outputFormat = "d64"`. The module never reads the host
filesystem, runs a shell, or imports a third-party image builder.

### AR-P14 — Sidecar records

**Decision per AR-P14:** extend only the admitted version-1 shapes:
`.build.json` uses the existing D64 `package` variant; `.assets.json` uses the admitted `loadable`
placement with `loadUnitId`, `artifactPath`, and ordered `destinations`; `.memory.json` uses
`loader` and `loadDestination` interval kinds plus `loadUnitId`; `.costs.json` uses the admitted
disk/loader components; `.debug.json` populates `loadUnits` with `{name, kind, publication,
artifact, residence}`. No new schema version and no parallel debug format.

### AR-P15 — VICE D64 autostart

**Decision per AR-P15:** the first implementation task after the packager can produce a fixture is a
bounded VICE 3.10 probe. It records the exact argv that (a) attaches the image as drive 8, (b)
autostarts the first directory entry, and (c) returns to BASIC normally. The probe chooses between
`-8 <image> -autostart <image>` and the `8:<name>` spelling; the chosen argv is frozen in the
target profile and covered by a test. No PRG fallback.

### AR-P16 — Native assets under loadable

**Decision per AR-P16:** remove the `request.owner === "loadable"` early rejection in
`assets/asset-dispatch.ts`. The handler still validates its output, selector, hash and identity.
The load unit payload is the selected `EmbeddedArrayValue.bytes`; scalar assets remain
compile-time-only metadata and cannot be a load unit because they have no byte payload. The
expressiveness-ledger row that says native loadable delivery fails E10204 is retired with a
replacement case asserting the unit loads.

### AR-P17 — Unit identity

**Decision per AR-P17:** unit identity is the qualified declaration identity plus logical type and
initializer provenance, hashed into a stable `loadUnitId`. Imported aliases resolve to the same
declaration, so they share one unit. Two declarations with identical bytes remain distinct. The
disk name is derived from the unit ID, and the build evidence records both the source declaration
and the logical hash.

### AR-P18 — Verification

**Decision per AR-P18:** use the commands already defined by `AGENTS.md`:
`yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`, and
`yarn prettier --check <touched files>`. During implementation run directed RD-07 suites; at the
phase boundary run the complete RD-07 boundary once. Do not run the unrelated compiler corpus per
file and do not create a readiness product.

### AR-P19 — Expert baseline

**Decision per AR-P19:** bind the active `2.0.4` release record and its content commit
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`. HLE-010 is already present in both Specification 4 and
the skill; the historical `2.0.0` wording is satisfied by the current qualified release. No spec or
skill edit is authorized or needed.

### AR-P20 — Hardware boundary

**Decision per AR-P20:** all automated runtime evidence is VICE 3.10 `x64sc`, reported exactly as
`VICE-verified / hardware-unverified`. Real-drive timing, serial/IRQ behavior, and physical PAL C64
checks remain RD-10-owned. The closeout records the boundary and does not claim silicon proof.

### AR-P21 — Exact-fit boundaries

**Decision per AR-P21:** accept an exact destination end at `$10000` with returned X/Y `$0000`;
accept exactly 664 used data blocks and exactly 144 directory entries; reject one beyond each with
`D64_CAPACITY` and the largest contributors. No truncation, no extended image.

### AR-P22 — Complexity classification

**Decision per AR-P22:** the D64 packager, inline KERNAL adapter, flow-fact extension, and
independent test decoder are the direct implementations RD-07 requests. They add no generalized
framework, external dependency, service, cache, or infrastructure. The Complexity Escalation Gate
is not triggered. Rejected alternatives that would have triggered it — a public loader plugin
registry, a fastloader/compressor, a generic VFS, and a third-party image builder — stay out of
scope per RD-07's Won't Have section.

## Gate check

- Every row is resolved or explicitly deferred: yes, 22/22 resolved.
- Every auto-design row carries eligibility, objective, decision, evidence, rejected alternatives,
  counterargument, confidence, hardening, policy version, root invocation ID, and reopen triggers.
- Reserved decisions (product behavior, frozen spec, hardware claims) remain user-owned and were
  not decided by auto-design.
- No row silently defers work.
