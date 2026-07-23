# RD-01: Specification Inventory and Rule Schema

> **Document**: RD-01-specification-inventory.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Project**: Compiler Readiness
> **Depends On**: —
> **CodeOps Artifact Schema**: 1

## Feature Overview

Create the authoritative, machine-readable denominator for C64 v3.0 readiness. Every normative
rule must be identifiable, attributable to an exact spec location and assigned an observable
terminal tier before generated evidence can count.

## Functional Requirements

### Must Have

- [ ] Inventory every mandatory rule in `spec/` with a stable rule ID, exact document/section
  citation, category, C64 applicability and normative polarity. (AR-1, AR-10)
- [ ] Store inventory data in versioned JSON validated by a committed JSON Schema. (AR-4)
- [ ] Record valid domains, invalid neighbors, boundary families, required oracle IDs, terminal
  tier and explicit dependencies between rules.
- [ ] Represent ambiguity as `blocked-errata`, never as an ordinary exclusion or passing case.
- [ ] Permit only reason-coded non-applicability; the C64 readiness denominator excludes a rule
  only when the specification itself makes it target-inapplicable.
- [ ] Validate every generator/oracle/transform ID against a registered TypeScript handler.
- [ ] Produce human-readable inventory documentation from JSON without making generated Markdown
  authoritative.

### Won't Have

- Changes to the frozen specification.
- Embedded executable semantic logic in inventory JSON.
- Readiness inferred from test-file or generated-case counts.

## Technical Requirements

The schema is closed by default (`additionalProperties: false`) and includes:

| Field | Constraint |
|---|---|
| `schemaVersion` | positive integer |
| `inventoryVersion` | semantic version |
| `ruleId` | unique stable identifier |
| `source` | repository-relative spec path plus heading/line selector |
| `requirement` | concise normative statement |
| `applicability` | `mandatory-c64`, `not-applicable-c64`, `blocked-errata` |
| `terminalTier` | `frontend`, `emit`, `acme`, `vice` |
| `generatorIds`, `oracleIds` | non-empty registered IDs where applicable |
| `dependsOn` | existing rule IDs only |

Schema upgrades must validate old committed inventories or provide a deterministic migration and
replay invalidation report. (AR-9)

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Denominator | Specification rules | AR-1 |
| Representation | JSON Schema + keyed handlers | AR-4 |
| First target | C64 v3.0 only | AR-10 |

## Security Considerations

Treat spec paths and selectors as repository data: canonicalize paths, reject absolute paths and
`..`, never evaluate JSON content, cap field lengths, and emit no shell fragments. There is no
authentication, network endpoint, sensitive data, encryption or rate-limiting requirement.

## Acceptance Criteria

1. [ ] Schema validation rejects an unknown field, duplicate `ruleId`, missing source selector,
   unknown terminal tier, and unregistered handler ID.
2. [ ] A completeness command reports every normative entry in `spec/00-feature-index.md` as
   mapped, explicitly decomposed, or `blocked-errata`; zero entries disappear silently.
3. [ ] A rule marked `not-applicable-c64` requires a spec citation proving target inapplicability.
4. [ ] A `blocked-errata` rule prevents RD-06 from issuing `C64 v3.0 Ready`.
5. [ ] Two consecutive documentation generations from identical JSON are byte-identical.
6. [ ] Path traversal and absolute source paths are rejected before file access.
