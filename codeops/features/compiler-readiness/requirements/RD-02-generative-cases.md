# RD-02: Typed Generative Cases and Deterministic Replay

> **Document**: RD-02-generative-cases.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: Compiler Readiness
> **Depends On**: RD-01
> **CodeOps Artifact Schema**: 1

## Feature Overview

Generate bounded valid and invalid Blend65 programs from independent models so readiness explores
type/value boundaries and feature interactions that compiler-authored examples omit.

## Functional Requirements

### Must Have

- [ ] Define a small independent typed generator IR that does not import `@blend65/core`,
  `@blend65/frontend`, `@blend65/codegen` or compiler AST/type utilities. (AR-6)
- [ ] Render IR through deterministic source generation so the real lexer and parser remain under
  test.
- [ ] Generate valid programs only where evaluation behavior is defined by inventoried rules.
- [ ] Generate type-neighbor invalid programs with one intentional contract violation and a named
  expected diagnostic family.
- [ ] Use token/text generators only for lexical, parser and malformed-input robustness rules.
- [ ] Pin PRNG algorithm and version as well as campaign seed; assign every case a stable ID.
- [ ] Replay a case from inventory version, generator version, target, seed and case ID.
- [ ] Generate boundary values, empty/min/max forms, signed/unsigned widths, literal/const/local/
  parameter spellings, nesting and cross-module combinations where permitted by the rule model.

### Won't Have

- Unrestricted random text as semantic coverage.
- Construction of compiler-owned AST nodes.
- Generation of undefined behavior as a valid semantic case.

## Technical Requirements

Generation is compositional and budgeted by maximum modules, declarations, statements, expression
depth and runtime steps. Source rendering has a structural round-trip test against the independent
IR; the compiler parser may be an integration check but cannot be the renderer's only oracle.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Valid generation | Independent typed IR | AR-6 |
| Malformed generation | Token/text partition | AR-6 |
| Persistence | Identity and promoted failures, not all cases | AR-9 |

## Security Considerations

Generated identifiers and paths use allowlists. Campaign budgets prevent resource exhaustion.
Sources are data files, never executed by the host. Temporary directories are unique and removed
after bounded execution. No credentials, user accounts, encryption or network access are involved.

## Acceptance Criteria

1. [ ] Static boundary tests fail if the generator package imports any compiler semantic or
   codegen package.
2. [ ] Replaying the same pinned PRNG version, inventory version, seed and case ID produces
   byte-identical Blend65 source on two fresh processes.
3. [ ] Valid campaigns generate at least literal, named-constant, local-variable and parameter
   spellings for every rule whose domain permits those forms.
4. [ ] Invalid semantic cases contain exactly one intentional violation recorded in case metadata.
5. [ ] Maximum configured modules, statements, expression depth and runtime steps are enforced
   before compilation.
6. [ ] A renderer mutation affecting precedence or parentheses is detected by independent
   round-trip/property tests.
