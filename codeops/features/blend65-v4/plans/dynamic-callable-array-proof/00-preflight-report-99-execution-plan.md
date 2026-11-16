# Preflight report — dynamic callable array proof

> **Audit target**: [99-execution-plan.md](99-execution-plan.md)
> **Verdict**: ⛔ BLOCKED — the independent semantics review rejected the first relaxation (SM-001),
> and the public oracles conflict.
> **Mode**: strict; independent semantics review completed (see below)

## Findings

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| PF-167-001 | 🟠 MAJOR | Ignoring the opaque kill outright would accept a local whose address escaped to a callee or a runtime pointer. | Address-taken storage joins `opaqueRoots`: `&local`/`word(&local)` and an aggregate passed to a call. The escaped-local test rejects. |
| PF-167-002 | 🟠 MAJOR | Filtering an opaque kill in the unchecked/unbounded branch assumes the index stays in bounds, contradicting AR-8. | **Blocking.** The conservative `killed.length > 0` rule is restored; the RD-04 acceptance and the #163 rejection oracle conflict. A user ruling is required. |
| PF-167-003 | 🟠 MAJOR | A second reach model would diverge from the interval checks. | No second model: the delivered escape rule feeds the same `opaqueRoots` set used by `rangeIsKilled`. |
| PF-167-004 | 🟡 MINOR | Every `place-address` op is not address-taking; aggregate materialization and local copies emit it too. | Non-aggregate results and aggregate call arguments only; the aggregate-copy acceptance test pins it. |
| PF-167-005 | 🟡 MINOR | Cross-block constant tracking of `poke($addr, 1); peek($addr)` could prove the index bound. | Not claimed: volatile-read forwarding and asynchronous KERNAL writers need a separate ruling. |
| PF-167-006 | 🟡 MINOR | An interrupt handler could publish a local's address. | The address-taken rule scans every context, including handlers. |

## Independent review

The project `semantics-reviewer` reviewed the working-tree diff and the soundness questions. It
rejected the first relaxation with SM-001 (the out-of-bounds counterexample above), flagged SM-002
(over-broad aggregate `place-address` roots) and SM-003 (comments/evidence). Its knowledge lineage:
expert skill `2.0.4`, content commit `0e2a6280…`, specification identity `BLEND65-SPEC-4-038b70e9…`.

The delivered sound slice resolves SM-002 and SM-003; SM-001 remains blocked on the oracle
decision. See [08-closeout.md](08-closeout.md).
