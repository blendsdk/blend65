# Severity Policy: RD-11b

> **Document**: 03-02-severity-policy.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-11 R27–R31, R50 · §3.6/§4.4 · AC-11 · AR-75, PF-005/PF-011/PF-014

## Overview

The one central layer that turns *natural* severities into *final* severities:
blanket/selective warning promotion (`--warn-as-error[=Wxxxxx]`), selective
suppression (`--suppress-warning=Wxxxxx`), applied exactly once after all
diagnostics are collected (R31). The rest of the compiler always emits natural
severity; consumers derive build success from the policy-applied array — never
from `bag.hasErrors()` (PF-005).

## Architecture

### Current Architecture

Nothing implements the policy. RD-16 delivers validated inputs
(`BlendConfig.warnAsError: boolean | string[]`, `suppressWarnings: string[]`,
`config/src/types.ts:55-56`) and warns on explicit-list overlap (W10241) at load
time; the *application* is this component.

### Proposed Changes

One new file `packages/core/src/diagnostics/severity-policy.ts` exporting
`SeverityPolicy`, `applySeverityPolicy`, `createSeverityPolicy` (§4.4 verbatim).

## Implementation Details

### New Types/Interfaces

```typescript
export interface SeverityPolicy {
  /** Promote all warnings to errors (blanket --warn-as-error). */
  warnAsError: boolean;
  /** Specific warning codes promoted to error. */
  promoteWarnings: Set<string>;
  /** Specific warning codes suppressed. Wins over promotion (R50). */
  suppressWarnings: Set<string>;
}

export function applySeverityPolicy(
  diagnostics: readonly Diagnostic[],
  policy: SeverityPolicy,
): Diagnostic[];

export function createSeverityPolicy(input: {
  warnAsError: boolean | string[];
  suppressWarnings: string[];
}): SeverityPolicy;
```

### Behavior

`createSeverityPolicy` (the RD-16/RD-15 adapter, PF-005 — the policy lives in
exactly one place):

- `warnAsError: true` → `{ warnAsError: true, promoteWarnings: ∅ }`
- `warnAsError: false` → `{ warnAsError: false, promoteWarnings: ∅ }`
- `warnAsError: string[]` → `{ warnAsError: false, promoteWarnings: new Set(arr) }`
- `suppressWarnings` → `new Set(arr)`. No re-validation of code shape — RD-16
  already validated; a code matching nothing is a silent no-op by construction.

`applySeverityPolicy` — a single pure pass, per diagnostic in input order:

| Input diagnostic | Rule | Output |
| ---------------- | ---- | ------ |
| `severity === 'error'` (incl. ICEs, E10000 sentinel) | untouched | passed through as-is |
| warning, code ∈ `suppressWarnings` | R30 + R50 (suppression wins, even if also promoted) | **dropped** |
| warning, `warnAsError` or code ∈ `promoteWarnings` | R28/R29 | copy with `severity: 'error'` — **code string unchanged** (renders `error[W10xxx]`, AR-Q8) |
| warning, otherwise | — | passed through as-is |

Guarantees:

- **Applied exactly once, post-collection** (R31): callers pass `bag.getAll()`
  (already deterministically sorted, R18); output preserves input order.
- **Promoted warnings are not capped** (PF-014): the `--max-errors` cap applies
  at the bag to naturally-emitted errors; this layer never consults the cap.
- **Pure**: input array and records are never mutated; promoted records are
  shallow copies with only `severity` changed.
- Build success = `!result.some(d => d.severity === 'error')` (PF-005) — stated
  in the JSDoc so RD-15 wires it correctly.

### Integration Points

- Input adapter shape *is* `BlendConfig`'s diagnostics fields — RD-15 passes
  them straight through (RD-16 §5 producer note).
- Output feeds `renderTerminal`/`renderJson` (03-03) and RD-15's exit-code logic.

## Code Examples

```typescript
const policy = createSeverityPolicy({ warnAsError: ['W10030'], suppressWarnings: ['W10030'] });
applySeverityPolicy([w('W10030')], policy); // [] — suppression wins (R50)

const blanket = createSeverityPolicy({ warnAsError: true, suppressWarnings: [] });
applySeverityPolicy([w('W10191')], blanket);
// [{ ...w, severity: 'error' }] — code stays "W10191" (AR-Q8)
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Code both promoted and suppressed | Suppressed (R50; RD-16 already warned W10241 at load) | R50/PF-011 |
| Unknown/never-emitted code in either set | Silent no-op (set membership never matches) | AR-Q8 (folded) |
| Blanket `warnAsError: true` + suppression | Suppression still wins; no overlap warning exists (PF-011) | R50 |

## Testing Requirements

- Spec tests ST-6..ST-11 (`severity-policy.spec.test.ts`).
- Impl tests (`severity-policy.impl.test.ts`): empty input, all-suppressed input, input-array non-mutation assertion, promoted-copy field integrity (spans/notes/help preserved), idempotence of a second application.
