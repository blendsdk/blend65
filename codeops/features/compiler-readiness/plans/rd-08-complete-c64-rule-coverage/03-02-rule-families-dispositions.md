# Rule Families and Terminal Dispositions: RD-08

> **Document**: 03-02-rule-families-dispositions.md
> **Parent**: [Index](00-index.md)

## Overview

After the vertical slice, RD-08 replaces all 2,103 `outside-initial-slice` entries with reviewed
family bindings or named non-source routes and computes one fail-closed result per inventory ID.
Equivalent rules share data and handlers, never identity or result rows. (AR-3, AR-6)

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
  | { readonly kind: "blocking"; readonly reason: string };

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

Inventory applicability and evidence obligations remain inventory-owned. The reviewed claim role,
route and result are joined by `ruleId`; missing, duplicate or invalid combinations are blocking.
`outside-initial-slice` is not valid v2 data. (AR-6)

## Family expansion

Family expansion is lexical and deterministic. Validation proves:

1. the selected inventory and disposition authority contain exactly the same 2,112 IDs;
2. every family member exists once and cites frozen authority;
3. every declared construction, invalid neighbor, boundary and spelling has a selected case or
   explicit blocker;
4. every mandatory semantic row has one source/non-source route and decisive result;
5. every non-source passing result names an accepted handler result;
6. cost-only rows retain their inventory IDs in the secondary-quality projection and cannot
   alter semantic readiness.

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

Where valid `embed()` source is required, a case names an allowlisted content digest. The existing
canonical execution workspace materializes the bounded bytes. Absolute/traversal/symlink/missing/
over-limit variants are rejection cases. No general asset service or new workspace API is added.
(AR-1, AR-8)

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
- Property tests remove or duplicate one member from each declared category and require a stable
  failure.
- Existing v1 files remain byte-identical throughout data authoring.
