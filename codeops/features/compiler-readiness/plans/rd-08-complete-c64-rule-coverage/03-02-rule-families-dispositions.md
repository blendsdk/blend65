# Rule Families and Terminal Dispositions: RD-08

> **Document**: 03-02-rule-families-dispositions.md
> **Parent**: [Index](00-index.md)

## Overview

The first v2 publication already contains one schema-valid disposition row for every inventory ID:
the exact first-vertical population has modeled evidence and the remaining rows carry the closed
`family-review-pending` blocker. Later phases replace every blocker with reviewed family bindings
or named non-source routes and compute one fail-closed result per inventory ID. Equivalent rules
share data and handlers, never identity or result rows. (AR-3, AR-6)

## Architecture

### Proposed data model

```ts
export type RuleClaimRole = "semantic-gate" | "secondary-quality";
export type RuleEvidenceRoute =
  | { readonly kind: "source"; readonly familyId: string }
  | { readonly kind: "non-source"; readonly handlerId: string };
export type RuleEvidenceResult =
  | { readonly kind: "passing"; readonly evidenceDigest: Sha256Digest }
  | { readonly kind: "failing"; readonly evidenceDigest: Sha256Digest; readonly owner: string }
  | {
      readonly kind: "blocking";
      readonly reason:
        | "evidence-unavailable"
        | "evidence-incomplete"
        | "unreviewed-quality-obligation";
    };

export type TerminalRuleDispositionV2 =
  | {
      readonly state: "pending-review";
      readonly ruleId: RuleId;
      readonly result: {
        readonly kind: "blocking";
        readonly reason: "family-review-pending";
      };
    }
  | {
      readonly state: "reviewed";
      readonly ruleId: RuleId;
      readonly claimRole: RuleClaimRole;
      readonly route: RuleEvidenceRoute;
      readonly result: RuleEvidenceResult;
    };

export interface RuleFamilyV2 {
  readonly familyId: string;
  readonly memberRuleIds: readonly RuleId[];
  readonly constructionPreconditions: readonly ConstructionPrecondition[];
  readonly typedDomains: readonly TypedDomain[];
  readonly invalidContracts: readonly InvalidContract[];
  readonly boundaryFamilyIds: readonly BoundaryFamilyId[];
  readonly spellings: readonly SpellingKind[];
  readonly oracleRouteIds: readonly string[];
}
```

This complete v2 schema is frozen before the first v2 candidate is prepared. A pending row cannot
carry a claim role, route or non-pending result. A reviewed row requires all three, and cannot carry
`family-review-pending`. Phase 3 replaces the whole pending row with a reviewed row while preserving
the same `ruleId`; mixed variants reject at their exact field paths.

Inventory applicability and evidence obligations remain inventory-owned. The reviewed claim role,
route and result are joined by `ruleId`; missing, duplicate or invalid combinations are blocking.
`outside-initial-slice` is not valid v2 data, and the pending variant prevents terminal closure
without creating a second v2 dialect. (AR-6)

## Family expansion

Family expansion is lexical and deterministic. Validation proves:

1. the selected inventory and disposition authority contain exactly the same 2,112 IDs;
2. every family member exists once and cites frozen authority;
3. every inventory-owned valid domain, invalid neighbor and boundary appears bidirectionally in
   the family authority and has a selected case or explicit blocker;
4. every separately reviewed citation-owned construction and spelling obligation appears
   bidirectionally in the family authority and has a selected case or explicit blocker;
5. every mandatory semantic row has one source/non-source route and decisive result;
6. every non-source passing result names an accepted handler result;
7. cost-only rows retain their inventory IDs in the secondary-quality projection and cannot
   alter semantic readiness.

### Independent family-completeness authority

Family data never validates itself. The validator derives domains, invalid neighbors and boundary
families directly from the selected frozen inventory. Construction and spelling obligations not
carried by inventory are stored in a separately reviewed, citation-keyed authority containing only
those missing axes. Validation requires equality in both directions:

- removing an obligation from family data fails;
- removing the corresponding selected case fails;
- inventing a family obligation absent from inventory/citation authority fails; and
- omitting an obligation from both family data and cases still fails against the independent
  authority.

The citation-keyed authority is not a second 2,112-row rule manifest and cannot change rule
identity, applicability or terminal result.

### Quality-obligation review

All selected `quality-obligation` rows are reviewed against their frozen citation before
denominator-wide expansion. A row is classified semantic only when its cited requirement changes
program correctness or defined behavior. Byte/cycle/profitability-only rows are secondary quality.
Ambiguous or unreviewed rows block; the implementation adds no cost measurement. (AR-1, AR-6)

### Non-source evidence

Named handlers are finite data-to-result operations. Each declares observable contract, input
authority, failure states and evidence capability. `not-source-generatable` alone is a route
classification, never pass evidence. Handlers do not execute host paths, commands, network or
compiler internals.

## Embed fixture mapping

Where valid `embed()` source is required, the published execution case carries an immutable list of
fixture references: allowlisted fixture ID, expected digest and fixed safe relative path. The
trusted route adapter resolves each ID through the readiness fixture projection, verifies the
digest, and performs the existing exclusive workspace write before launching the source-only
worker. The worker request remains limited to `main.blend` and receives no fixture lookup or host
filesystem authority.

Absolute/traversal/symlink/missing/duplicate/over-limit variants reject before any compiler or
worker launch. No caller-selected path, ambient lookup, general asset service or new workspace API
is added. (AR-1, AR-8)

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Missing/duplicate/unknown family member | Reject authority at exact rule path | AR-3 |
| Family silently adds a member | Exact list equality fails | AR-3 |
| Applicability/claim/route/result disagreement | Terminal join returns blocking | AR-6 |
| Unreviewed quality row | Blocks denominator closure | AR-6 |
| Non-source classification without handler result | Blocks; cannot pass | AR-6 |
| Unsafe embed fixture ID/path | Reject before materialization | AR-8 |

## Testing Requirements

- ST-16–ST-21 cover exact denominator equality, family completeness, terminal joins,
  quality classification, non-source evidence and bounded embed mapping.
- Property tests independently remove one authority obligation, one family declaration and one
  selected case from every category and require a stable failure, including the both-family-and-
  case omission that previously allowed self-validation.
- Existing v1 files remain byte-identical throughout data authoring.
