# Component Design: Orchestration and Acceptance

> **Document**: 03-07-orchestration-acceptance.md
> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P1, AR-P5, AR-P9, AR-P13, AR-P63, AR-P64, AR-P73, AR-P77, AR-P79–AR-P81

## Responsibility

Join selected authority, precomputed routes, real adapters and independent expectations into a
replayable campaign result. Preserve every blocker outside the executed modeled population.

## Entry point

`executeReadinessCampaign` accepts opaque selected parent/execution/oracle contexts, a prepared
campaign, target, selector revision, policy and an explicit environment capability probe. The live
context's private state supplies its already validated passive release; the orchestrator resolves
that release with the selected parent, obtains the guarded composite projection, derives the
passive campaign projection and dedicated report identity from the genuine prepared campaign,
cross-checks their campaign digests and the identity target, and passes only the planning
projections plus the selected oracle digest to the pure planner. The report serializes the retained
genuine seed verbatim. It then derives and serializes the complete
`ExecutionRoutePlanV1`; only then may it create a case workspace or call an adapter. A failed or
forged composite/projection handoff cannot reach planning or execution.

Campaign preparation consumes the same genuine resolver-created selected-parent snapshot used to
create the oracle context. The execution-only campaign-identity boundary supplies the fixed target,
seed and normalized 40-case configuration; inventory, rule-model, generator, boundary and renderer
authority come only from the snapshot's private retained authority. Every enabled rule must resolve
to one compatible selected generator route. Loose workspace readiness bytes and synthetic
participant revisions are not campaign authority. This adapter remains outside the already-sealed
parent dependency closures. A separate generated runner closure covers campaign construction,
planning, orchestration and report authority; its revision joins the selected parent and six-row
binding digest in the prepublication execution digest. That digest is retained by the route plan,
report and accepted semantic-review report digest.

For each planned selection it builds a valid-only envelope when required, executes prerequisite
stages in order, captures the actual diagnostic/value/effect, and asks the selected RD-03 evaluator
to compare actual evidence against the host-side expectation. Results are sorted by stable plan
order and serialized canonically. The required positional result array is accompanied by exact
per-route records that bind case and execution identity, rule, obligation, terminal tier,
stage/code, cumulative usage and bounded evidence digests. Aggregate status, counts and blockers
are derived from those records and rejected if a supplied report is inconsistent.
The selector rejects the first route beyond the report's shared inclusive 4,096-record limit before
rank or route materialization. Orchestration generates each campaign ordinal once and retains one
immutable diagnostic or execution-case authority per case identity across that case's obligation
routes; unavailable and substituted routes do no preparation, and consumable VICE/process authority
remains per route.

## Campaign outcome

The summary reports independently for every rule/obligation:

- selected and terminal case identities;
- pass/failure and stable primary result code;
- unavailable execution capabilities;
- remaining unmodeled, not-generatable, oracle-unmodeled and capability-unbound blockers;
- local-authority proof status for ACME/VICE-dependent bindings.

The selected parameter-spelling cases remain genuine parameter calls. Before lowering, the
frontend may prove the address constant only when the callee is main-reachable, same-module,
non-recursive, not address-taken and has exactly one visible call site with a constant actual.
Ambiguous shapes retain E10045 and ledger ownership; the accepted shape reaches the existing
literal/direct-address code path, so its memory instruction is identical to expert absolute 6502
output rather than a harness rewrite or generic indirect fallback. (AR-P84)
Address marshalling is eliminated from the accepted whole-call path. Constant value marshalling
and the residual leaf-call/frame overhead remain measured parity debt under GitHub issue #79, with
value specialization, inlining and dead-frame removal as the required path to a program-scale win.

Cheaper success cannot satisfy an unexecuted expensive obligation. Missing tools are visible
`tier-unavailable` blockers, never skipped tests or passes. RD-04 completion therefore establishes
execution for its selected modeled population but does not claim the RD-06 release gate.

## Publication acceptance

The six-route candidate can be reviewed and selected only after:

1. every immutable specification and CI-safe implementation test passes;
2. readiness and readiness-execution each meet a 90% branch floor;
3. the exact repository verification command passes;
4. local real ACME/VICE proof passes for the projection and all four current runtime rules;
5. semantic, correctness, security and performance review findings are resolved under project
   policy; and
6. candidate resolution clears exactly six parent blockers against the exact nine-binding digest.

The workspace exposes a documented local execution command through the new package/root script,
but CI does not pretend to provide emulator authority. Reports must state tool versions and evidence
digests without embedding machine-specific temporary paths.

The exact local command is:

```text
yarn readiness:execute -- --target c64 --seed <64-lowercase-hex> [--report readiness/execution-evidence/rd-04-local-v1.json]
```

`--target c64` and `--seed` occur exactly once; the only optional flag is `--report`, whose value
must be the exact repository-relative default path shown above. Unknown, duplicate, absolute,
traversing or alternate-output arguments exit `2` and print the one-line grammar to stderr. The
command resolves the selected parent/oracle authority, prepares the deterministic modeled campaign
from that exact selected snapshot,
probes ACME and VICE and executes every selected route. Exit `0` means every selected case passed
and the report was atomically persisted; `1` means a semantic/execution blocker with a valid report;
`3` means a required local tool is unavailable; `4` means trusted report publication or cleanup
failed. Stdout contains only the canonical JSON summary plus newline. Stderr contains bounded
human diagnostics sorted by code/path and no temporary path.

The mode-`0600` report is written to a sibling temporary file under a verified mode-`0700`
`readiness/execution-evidence` directory, file-synced, renamed without overwrite unless existing
bytes are identical, and directory-synced. A fault preserves the prior report. The canonical
`ExecutionAuthorityReportV1` contains schema revision, parent/oracle/campaign/plan/final execution
digests, target, seed, normalized tool names/versions, projection revisions, per-route result and
evidence digests, cumulative usage, cleanup blockers and overall result; it contains no cwd,
absolute path, PID, port or timestamp. Its byte digest is the mandatory input to semantic review.
Identical authority, seed, tools and results reproduce identical report bytes.
Only `executeReadinessCampaign` can mint process-local report authority. Serialization, digest and
durable writing reject plain records and structural copies, so callers cannot omit planned routes
and salt the remaining identities with an invented plan digest.

## Specification conformance boundary

The package-private `execution-orchestration-conformance-v1` module gives the immutable Phase 7
specification deterministic access to the real public wrappers without adding public dependency
ports. Its operation-scoped controls are closed declarative data only: exact single-use planned
handler-result substitutions, normalized capability facts and named durable-report fault points.
Every substituted result passes the production `ExecutionResultV1` validator and proves only
orchestration aggregation and serialization; the already frozen runtime-evaluator specification
proves genuine actual-versus-oracle comparison. The module exposes no handler, expectation, opaque
authority, executable path, filesystem callback or public package export; nested scopes, unused
controls and identity mismatch fail closed. Production calls outside a conformance scope always
use genuine handlers, probes and filesystem operations. Bounded frozen observations return with
the scope and cannot re-enter or influence execution.

## Closeout

At completion, update the feature roadmap and closeout evidence. Before marking RD-04 complete,
walk ambiguity registers, Won't Have clauses and `spec/future-considerations.md` and answer whether
any deliverable expired a deferral rationale. Reopen every expired restriction as an owned backlog
or expressiveness-ledger row; no future-slice owner may become orphaned.

## Specification-visible TypeScript interface

The following declarations are exported from `@blend65/readiness-execution`:

```ts
export type ExecutionAuthorityContextV1 =
  | LiveExecutionContextV1
  | ExecutionReviewContextV1;
export interface ExecuteReadinessCampaignInputV1 {
  readonly parent: PublishedSnapshot;
  readonly execution: ExecutionAuthorityContextV1;
  readonly oracle: PublishedOracleContext;
  readonly campaign: PreparedCampaign;
  readonly target: 'c64';
  readonly policy: ExecutionPolicyV1;
  readonly capabilities: ExecutionEnvironmentCapabilitiesV1;
}
export interface ExecutionEnvironmentCapabilitiesV1 {
  readonly acme: { readonly available: boolean; readonly version?: string };
  readonly vice: { readonly available: boolean; readonly version?: string };
}
export interface ExecutionToolVersionV1 {
  readonly tool: 'node' | 'acme' | 'vice';
  readonly version: string;
}
export interface ExecutionCampaignSummaryV1 {
  readonly status: 'pass' | 'failure' | 'unavailable';
  readonly selectedCases: number;
  readonly passedCases: number;
  readonly blockers: readonly string[];
}
export interface ExecutionRouteAuthorityRecordV1 {
  readonly caseIdentity: string;
  readonly executionIdentity: string;
  readonly ruleId: string;
  readonly obligation: string;
  readonly terminalTier: ExecutionTierV1;
  readonly requiredTools: readonly ('acme' | 'vice')[];
  readonly unavailableTools: readonly ('acme' | 'vice')[];
  readonly result: ExecutionResultV1;
}
export interface ExecutionAuthorityReportV1 {
  readonly revision: 'execution-authority-report-v1';
  readonly parentDigest: string;
  readonly executionDigest: string;
  readonly oracleDigest: string;
  readonly campaignDigest: string;
  readonly routePlanDigest: string;
  readonly target: 'c64';
  readonly seed: string;
  readonly toolVersions: readonly ExecutionToolVersionV1[];
  readonly projectionRevisions: readonly ExecutionProjectionRevisionV1[];
  readonly results: readonly ExecutionResultV1[];
  readonly routeRecords: readonly ExecutionRouteAuthorityRecordV1[];
  readonly residualBlockers: readonly string[];
  readonly summary: ExecutionCampaignSummaryV1;
}
export function executeReadinessCampaign(
  input: ExecuteReadinessCampaignInputV1,
): Promise<ExecutionOperationResultV1<ExecutionAuthorityReportV1>>;
export function serializeExecutionAuthorityReportV1(
  report: ExecutionAuthorityReportV1,
): Uint8Array;
export function writeExecutionAuthorityReportV1(
  repositoryRoot: string,
  report: ExecutionAuthorityReportV1,
): Promise<ExecutionOperationResultV1<string>>;
export interface ExecutionCliIoV1 {
  readonly cwd: string;
  writeOut(text: string): void;
  writeErr(text: string): void;
}
export function runReadinessExecutionCliV1(
  argv: readonly string[],
  io: ExecutionCliIoV1,
): Promise<0 | 1 | 2 | 3 | 4>;
```
