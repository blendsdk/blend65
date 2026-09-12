# Authority and Identity: Specification 4.0 and Expert Authority Freeze

> **Document**: 03-01-authority-and-identity.md
> **Parent**: [Index](00-index.md)

## Overview

This component proves the transition starts from the recorded authority, defines the exact active
Spec 4 corpus, derives its reproducible identity, and leaves one complete closeout record. It owns
control metadata, not language semantics.

## Architecture

### Current Architecture

The P3 identity method hashes a sorted list of all 50 Markdown files and records the digest in the
expert source manifest. It has no in-spec normative-membership authority and avoids self-reference
only because the literal identity is outside the hashed corpus.

### Proposed Changes

Use three durable owners under AR-P6:

| Owner | Responsibility |
|---|---|
| `spec/00-normative-inventory.md` | Exact retained path set, normative roles, and AR-P5 identity algorithm |
| `spec/00-feature-index.md` | Non-normative retained/changed/removed navigation only |
| `08-closeout.md` | Input authorities, complete P3→4 crosswalk, raw hashes, approval, freeze, and deferral closeout |

No other document may define normative membership, the digest algorithm, or the complete transition
crosswalk.

## Implementation Details

### Bootstrap Record

Before `spec/` changes, add an append-only bootstrap section to `08-closeout.md`. It cites the Phase
0 handoff for the exact worktree, branch, ancestry, parked-tree, P3, skill-version, and content-commit
facts, and records a fresh direct verification result. Any mismatch stops execution without edits.
See RD-01 R1.1 and AR-P1.

### Normative Inventory Record

Each retained `spec/**/*.md` path appears exactly once with one role and one normative flag. The
allowed normative roles are `authority-metadata`, `chapter`, `grammar`, `evaluation`, and
`c64-appendix`; retained navigation or future constraints are `non-normative`. Deleted files appear
only in the closeout crosswalk. See RD-01 R1.3 and AR-P5.

The inventory checker derives both sets from the table and compares their union to the filesystem.
It rejects duplicate rows, absent paths, undeclared files, paths outside `spec/`, unknown roles, a
non-normative grammar, more than one C64 appendix, or any normative non-C64 appendix.

### Content Identity

Implement the exact normalized SHA-256 construction owned by AR-P5. The direct verifier performs
four separately reported checks: inventory closure, exactly-one identity field per normative file,
candidate derivation, and stamped-candidate recomputation. Raw per-file at-rest hashes are recorded
only in the final closeout so they do not become a competing corpus definition.

### Transition Crosswalk and Summary

`08-closeout.md#specification-3-to-4-transition-crosswalk` contains the one complete row set required
by RD-01's Required transition crosswalk. The row's semantics cell is deliberately concise and the
exact destination clause remains authoritative. The existing feature index contains only the
human-readable navigation required by R1.26 and links to those clauses and governing AR entries.

### Freeze Record

The final closeout section records all fields required by RD-01 Freeze and change control, including
the explicit user approval and the mandatory deferral-expiry answer. It also states that RD-02 must
reproduce the identity and find `spec/` unchanged before compiler work starts.

## Integration Points

| Consumer | Contract |
|---|---|
| Core-language phases | Add the fixed identity field and remain inside the inventory |
| C64/Guard phase | Finalize retained/deleted path roles before identity freeze |
| Expert phase | Bind its source manifest and cases to the candidate Spec identity |
| Qualification phase | Prove crosswalk, inventory, field, and hash integrity |
| Activation phase | Bind the immutable expert content commit and approval in one closeout |

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Worktree, branch, ancestry, or parked-tree mismatch | Stop before any authority edit | AR-P1 |
| Inventory set or role mismatch | Candidate is invalid; correct the inventory or filesystem | AR-P5 |
| Missing, duplicate, or malformed identity field | Candidate is invalid; do not stamp or activate | AR-P5 |
| Recomputed identity differs | Invalidate downstream evidence and return to the changed phase | AR-P5 |
| Crosswalk row missing or duplicated | Block candidate freeze | AR-P6 |
| Approval absent | Leave v1.0 active and stop Phase 8 | AR-P6 |

## Testing Requirements

- ST-01–ST-06 define bootstrap, inventory, crosswalk, and identity behavior.
- ST-34–ST-40 define qualification, activation, freeze, and deferral evidence.
- `tests/bootstrap-authority.spec.test.md` and `tests/identity-freeze.spec.test.md` are the
  implementation-blind oracles for Phases 1 and 5.
- Their matching `*.impl.test.md` files record exact command inputs, outputs, and negative mutation
  checks after each implementation.
