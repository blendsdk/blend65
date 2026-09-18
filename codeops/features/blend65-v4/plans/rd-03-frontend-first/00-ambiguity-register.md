# Ambiguity Register: RD-03 Frontend First

> **Status**: ❌ GATE BLOCKED — AR-P3 needs a public diagnostic authority decision; remaining discovery is not yet complete
> **Last Updated**: 2026-09-18
> **CodeOps Artifact Schema**: 1

## Planning Scope Contract

| Boundary | Authorized scope |
|---|---|
| Planning target | The source-reading, parsing and semantic-analysis portion of Blend65 v4 RD-03, planned before SpritePad integration |
| Context artifacts | Frozen Specification 4, qualified expert 2.0.0, RD-03 and its existing decisions, the RD-02 project API and tests, current manifests and guidance |
| Modification set | This plan folder, the active feature roadmap, and only the RD-03/AR-037 planning-order wording needed to record the approved exception. No frozen specification, expert content, sibling requirements, production code or tests. |

## Decisions

| ID | Category | Decision | Authority | Status |
|---|---|---|---|---|
| AR-P1 | Scope / planning order | Plan the compiler frontend first. SpritePad integration remains for later. This does not close RD-02, claim Windows qualification, or satisfy the complete RD-03 game milestone. | User: "i approve", responding to the explicit frontend-first planning-order proposal on 2026-09-18 | ✅ Resolved |
| AR-P2 | Technical / responsibility ownership (complex) | Use focused `packages/compiler/src/frontend/` modules and direct stage services. Do not add a workspace, dependency, pass registry or harness. Before an actual editor consumer appears, establish a backend-free public entry or extract the real frontend. | Plan-owned decision under overriding project workflow directive 4; independent challenger converged on the smaller design | ✅ Resolved |
| AR-P3 | Behavioral / public diagnostic authority (sensitive) | Specification 4 has no general syntax diagnostic for a missing semicolon, unmatched delimiter or malformed expression. Recommended: one explicitly project-owned `PARSE_SYNTAX_ERROR` service diagnostic, without inventing or reusing a normative `E` code. This requires an explicit exception to RD-03 R3.10's all-normative-code requirement for this missing class. | Awaiting the user's direct decision; no code, template or tests authorized yet | ❌ Open |

## Resolution Notes

### AR-P1 — Approved Exception, Not Scope Reduction

The approved exception allows asset-independent frontend planning before the
authentic SpritePad handoff. Producer evidence is still mandatory before any
SpritePad-dependent planning or decoder implementation. Windows testing remains
tracked by RD-02 DEF-1. Backend, game integration and final RD-03 acceptance are
not part of this partial plan. Technical choices use the overriding project
workflow directive 4; product-scope changes still require the user.

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

Recommended narrow ruling: permit the frontend to report one project-owned
`PARSE_SYNTAX_ERROR` diagnostic for grammar violations with no normative entry.
Use published Specification 4 codes for every condition that does have an entry.
Do not claim full normative diagnostic conformance for the project-owned class.
This changes the public diagnostic policy, so directive 4 does not authorize the
agent to decide it silently. Frozen specification and expert files stay untouched.
After approval, settle the exact template, byte-span and recovery rules in this
register before defining the parser's specification tests.

The real alternative is to reopen frozen authority, add a normative syntax code,
rebind the specification identity and qualify the affected expert baseline. That
has a larger authority-maintenance cost and is not included in the approved
frontend-first planning scope. The independent fallback recommends the bounded
service namespace; its strongest limitation is that it is an explicit project
overlay, not a code published by frozen Specification 4.

## Discovery Findings to Carry Into the Plan

The independently checked minimum result boundary separates completed analysis,
proven errors and incomplete obligations. Incomplete analysis retains independently
proven diagnostics but exposes no usable typed program. Missing asset/profile
checks and valid unimplemented forms are not language errors. Lexing/parsing
completion alone does not prove semantic completion.

This is a frontend-only partial plan. No public `blendc check`, backend, SpritePad
decoder, LSP, game runtime or RD completion claim is authorized by this discovery
checkpoint. Do not create the remaining plan documents until the semantic gate
passes. Review all twelve ambiguity categories before claiming that gate passed.

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
