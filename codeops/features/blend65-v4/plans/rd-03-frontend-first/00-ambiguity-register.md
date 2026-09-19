# Ambiguity Register: RD-03 Frontend First

> **Status**: ✅ GATE PASSED — all 9 items resolved; partial RD-03 frontend scope only
> **Last Updated**: 2026-09-19
> **CodeOps Artifact Schema**: 1

## Planning Scope Contract

| Boundary | Authorized scope |
|---|---|
| Planning target | The source-reading, parsing and semantic-analysis portion of Blend65 v4 RD-03, planned before SpritePad integration |
| Context artifacts | Frozen Specification 4, qualified expert 2.0.0, RD-03 and its existing decisions, the RD-02 project API and tests, current manifests and guidance |
| Modification set | This plan folder, the active feature roadmap, the approved RD-03/AR-037 planning-order wording, and the approved narrow R3.10 diagnostic exception. No frozen specification, expert content, sibling requirements, production code or tests. |

## Decisions

| ID | Category | Decision | Authority | Status |
|---|---|---|---|---|
| AR-P1 | Scope / planning order | Plan the compiler frontend first. SpritePad integration remains for later. This does not close RD-02, claim Windows qualification, or satisfy the complete RD-03 game milestone. | User: "i approve", responding to the explicit frontend-first planning-order proposal on 2026-09-18 | ✅ Resolved |
| AR-P2 | Technical / responsibility ownership (complex) | Use focused `packages/compiler/src/frontend/` modules and direct stage services. Do not add a workspace, dependency, pass registry or harness. Before an actual editor consumer appears, establish a backend-free public entry or extract the real frontend. | Plan-owned decision under overriding project workflow directive 4; independent challenger converged on the smaller design | ✅ Resolved |
| AR-P3 | Behavioral / public diagnostic authority (sensitive) | Use one project-owned `PARSE_SYNTAX_ERROR` for grammar violations without a published diagnostic; preserve every existing normative code and frozen file. Apply only the corresponding R3.10 exception. | User: "i approve", answering the single explicit parser-diagnostic proposal on 2026-09-18 | ✅ Resolved |
| AR-P4 | Technical / integration and data | Internal synchronous lexer, parser, module and analysis services reuse RD-02 source records, raw byte spans and diagnostic shape. Partial syntax and poison never become a usable typed program. Analysis distinguishes complete, error and incomplete; incomplete retains independent errors and takes precedence when obligations remain unchecked. | Plan-owned under overriding project directive 4; prior independent fallback recommended these boundaries | ✅ Resolved |
| AR-P5 | Scope / feature and edge coverage | Implement the asset-independent portions of R3.5–R3.10 and semantic payload of R3.11: admitted scalar expressions/control/direct calls, one-dimensional fixed arrays, scalar-field structs, arrays of those structs, exact aggregate parameters and size queries. No full RD completion, CLI command, profile module, encoding table, asset reader, SFA or backend. Forms outside this partial semantic slice are unchecked implementation obligations, never new language restrictions. | Approved frontend-first scope AR-P1; matrix in RD-03; plan-owned bounded decomposition under directive 4 | ✅ Resolved |
| AR-P6 | Technical / diagnostics and recovery | Published diagnostic fields come from Chapter 14. The approved syntax diagnostic has one fixed expected/found template, a proving token or EOF span, and bounded deterministic recovery. Stable source/span/code ordering and the existing default 20-error ceiling apply; truncation or unsafe recovery prevents completion. | AR-P3 authorizes the class; plan-owned template/recovery mechanics under directive 4 | ✅ Resolved |
| AR-P7 | Technical / verification and delivery | Reuse compiler Vitest cases and root import-boundary tests. Directed stage tests during implementation; compiler build/typecheck/test and boundary qualification per phase; root build/typecheck/test at final integration. No lint command, new runner, coverage gate, infrastructure or emulator required for this partial frontend. | Actual manifests and R3.34; overriding impact-based verification and directive 4 | ✅ Resolved |
| AR-P8 | Technical / template instantiation (runtime) | E10222's `<literal>` is the exact interior spelling, without opening/closing source quotes; the canonical template already supplies its surrounding quotes. Escape control characters using the existing diagnostic helper. Thus `'AB'` reports `Multi-character literal 'AB' — use a double-quoted string for multiple characters`. | Plan-owned mechanical clarification under overriding project directive 4; Chapter 14 supplies the canonical quoted placeholder; independent specification author identified the question before implementation | ✅ Resolved |
| AR-P9 | Technical / verification path correction (runtime) | Rename the current v4 CLI implementation tests `args.impl.test.ts` and `render.impl.test.ts` to `project-args.impl.test.ts` and `project-render.impl.test.ts`, with identical contents. The frozen foundation oracle prohibits the inherited v3 test paths; current files accidentally reused those names. No production CLI or specification test changes. | Mechanical filename correction under project directive 4 and execution-protocol's mechanical-correction rule; root qualification demonstrated the exact collision at `test/foundation.spec.test.ts:325` | ✅ Resolved |

## Resolution Notes

### AR-P9 — Preserve the Existing Foundation Oracle

The broader phase checkpoint found a pre-existing failure after the CLI's v4
implementation tests had been committed under two historical v3 names. These
three files are unchanged from phase-start commit `c42d6ab`; the lexer did not
cause the failure. The foundation oracle rejects reuse of inherited test paths.
Renaming only the two new implementation-test files preserves their exact content,
test discovery, the immutable oracle and CLI behavior. There is no new product
decision or support surface. The phase qualification modification set explicitly
includes these two mechanical renames; no other RD-02 artifact is changed.

### AR-P8 — Quoted Literal Placeholder

Resolved during phase 1 independent test authoring. This instantiates the existing
E10222 template; it does not introduce a new code, predicate, source restriction,
or support mechanism. The template owns its punctuation; the placeholder retains
the literal's interior source spelling. Frozen authority remains unchanged.

The E10219/E10220 representation backslashes are instantiated as displayed source
escape spellings from Chapter 01 §7.2: one backslash for `\q`, `\x`, `\n`, etc.,
and two for the backslash escape `\\`. Words and punctuation remain canonical.
This keeps messages describing the actual source escape rather than a host-string
representation of it. The independent author raised this before the red run;
the same plan-owned mechanical ruling under directive 4 applies.

### AR-P1 — Approved Exception, Not Scope Reduction

The approved exception allows asset-independent frontend planning before the
authentic SpritePad handoff. Producer evidence is still mandatory before any
SpritePad-dependent planning or decoder implementation. Windows testing remains
tracked by RD-02 DEF-1 and, by RD-02 AR-P11, is scheduled for RD-10 rather than
blocking this plan or later Linux compiler work. Backend, game integration and
final RD-03 acceptance are not part of this partial plan. Technical choices use
the overriding project workflow directive 4; product-scope changes still require
the user.

### AR-P2 — Grounding and Independent Challenge

`test/import-boundary.ts:25` recognizes internal frontend paths;
`test/import-boundary.spec.test.ts:182` proves that an internal frontend cannot
reach target lowering. RD-03's M1 end-to-end contract permits adjacent stages to
share modules. The current compiler public entry exports only project input
services. There is no editor consumer yet.

The specialist challenger could not read local files with its available tools
and was stopped before issuing a grounded verdict. A fresh read-only generic
fallback inspected the relevant files and independently recommended the smaller
module design. It made no edits. Confidence: High. Hardening: package ownership
converged; the fallback identified the separate diagnostic authority gap AR-P3.

The strongest counterargument is the eventual editor's dependency boundary:
importing the compiler root becomes unsafe once that root also reexports backend
services. The existing checker follows transitive imports and reexports. A narrow
backend-free entry or extraction is due when that real consumer lands, not now.

### AR-P3 — Small Missing Contract, Not New Language Design

The grammar requires semicolons and matching delimiters. For example,
`module Game; function main(): void { let x: byte = 1 }` is malformed because
the declaration lacks its semicolon. Chapter 14's complete active error registry
has no general syntax-error code or template for that condition. E10210 is the
non-ASCII lexical error; E10204 is an embedded-format parsing error. Neither may
be repurposed. RD-03 R3.10 requires authoritative codes and messages.

Approved narrow ruling: permit the frontend to report one project-owned
`PARSE_SYNTAX_ERROR` diagnostic for grammar violations with no normative entry.
Use published Specification 4 codes for every condition that does have an entry.
Do not claim full normative diagnostic conformance for the project-owned class.
This changes the public diagnostic policy, so it was not decided silently.
The user explicitly approved it on 2026-09-18. Frozen specification and expert
files stay untouched. R3.10 now records only this approved exception. AR-P6
assigns the exact template, byte-span and recovery mechanics to the component
specification before parser specification tests are defined.

The real alternative is to reopen frozen authority, add a normative syntax code,
rebind the specification identity and qualify the affected expert baseline. That
has a larger authority-maintenance cost and is not included in the approved
frontend-first planning scope. The independent fallback recommends the bounded
service namespace; its strongest limitation is that it is an explicit project
overlay, not a code published by frozen Specification 4.

## Discovery Findings to Carry Into the Plan

Corrective preflight authority, 2026-09-18: the user answered "you may" to the
explicit request to apply PF-001–PF-003 and re-check. The existing component docs
now freeze the fields independent authors inspect, distinguish internal module
analysis from final program acceptance, place semantic assertions in their owning
phases and prescribe signed division/remainder and zero-divisor rows. These are
corrections within AR-P4–AR-P7, not new scope or public API decisions. The preflight
report owns their resolution evidence; no extra register or tooling is added.

The independently checked minimum result boundary separates completed analysis,
proven errors and incomplete obligations. Incomplete analysis retains independently
proven diagnostics but exposes no usable typed program. Missing asset/profile
checks and valid unimplemented forms are not language errors. Lexing/parsing
completion alone does not prove semantic completion.

This is a frontend-only partial plan. No public `blendc check`, backend, SpritePad
decoder, LSP, game runtime or RD completion claim is authorized. The gate now
passes for this scope; it is not full RD-03 or compiler-conformance approval.

## Systematic Discovery Closure

| Category | Closure evidence |
|---|---|
| Feature gaps | R3.5–R3.10 and the RD-03 coverage matrix; excluded obligations stay explicit (AR-P5). |
| Behavioral gaps | No typed program after poison, pending checks or truncated analysis (AR-P4, AR-P6). |
| Scope ambiguities | Exact user-approved frontend-first boundary and syntax exception (AR-P1, AR-P3). |
| Technical unknowns | Internal modules and direct stage services; no new support mechanism (AR-P2, AR-P4). |
| Edge cases | UTF-8/BOM/CRLF, recovery, narrow barriers, scopes, recursion, initialization and zero-size objects use governing chapters (AR-P5, AR-P6). |
| Integration points | RD-02 `ProjectSnapshot`, `SourceRecord`, `SourceSpan` and diagnostics inspected; no public CLI/editor integration in this plan (AR-P4). |
| Data & state | Immutable inputs; source-based binding identity; typed facts only after complete admitted analysis (AR-P4). |
| Security & compliance | Pure source analysis; no filesystem access, shell, execution, output, network, credentials or infrastructure (AR-P4, AR-P7). |
| Non-functional gaps | Observational measurements only per upstream AR-026; no numeric performance gate (AR-P7). |
| UX & presentation | Existing Chapter 14 fields preserved; the one approved missing syntax class is settled (AR-P3, AR-P6). |
| Stakeholder conflicts | Modern source remains legal; incomplete implementation is not a user-facing language restriction (AR-P5). |
| Naming & terminology | Focused `frontend/` files and internal stage/result names are plan-owned; public syntax code has direct user approval (AR-P2–AR-P6). |

Normal make-plan mode remains active: no `--auto-design` authority is inferred.
Project directive 4 overrides repeated user prompts for plan-owned technical
decisions. User-owned scope and public diagnostic rulings remain explicit.
No extra material support surface is approved or planned. The existing independent
fallback covers the chosen package and result boundaries; its stronger alternative
was considered and rejected because there is no current editor consumer. Remaining
mechanical choices are standard and use in-context hardening, not another agent.

## Expert Lineage and Evidence Limits

Status: Verified partial. Claim kinds: inspected boundary facts and design
recommendations; no frontend implementation or machine output has been produced.
`skillVersion=2.0.0`; content commit
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`;
`compiler-architecture.md#target-neutral-front-end` and
`#required-pipeline-invariants`;
`blend65-semantics.md#diagnostic-doctrine`; governing source key
`BLEND65-SPEC-4-5c6bac04a56b91d7d55ff570fbbf0dde5f521e2edce8901279dfa39a32c7acfa`.
Assembly, SFA allocation, artifact and runtime costs are not assessed by this
frontend planning checkpoint.
