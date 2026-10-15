# Blend65 specialist review routing

This is the project dispatch contract, not a compiler stage or a second expert skill.
The primary agent reads it before planning and before selecting phase reviewers.
[Structured configuration](codeops.json) registers roles, effort and permissions;
[native OpenCode charters](../.opencode/agents/) define each role's responsibility.
No daemon, new dependency, global configuration change or plugin modification is required.
The charters are project-owned V2 Markdown: visible subagents with ordered
`permissions`, no model pins and no legacy TOML runtime dependency.

## Authority and ownership

All compiler specialists consume the one active
[Blend65 expert router](../.agents/skills/blend65-domain-expert/SKILL.md), its selected
references and governing frozen specification. Extract current metadata from its
[release record](../.agents/skills/blend65-domain-expert/qualification/release.md)
for lineage: Active qualified version, Status, Router, Specification and Immutable content commit.
Workflow routing does not amend that knowledge baseline. Do not copy
hardware doctrine into these charters or preserve an implementation choice as authority.
Stop the extraction before the next second-level heading; do not emit the full current section
or search the entire release record. Qualification case summaries and evaluator/grader answers are not ordinary review
inputs. Read them only when the packet explicitly assigns that evidence, never during blind
behavioral checks. Report accidental exposure and do not count a contaminated check as decisive.
Bound source-manifest lookups to selected source-definition headings, never its oracle audit map.
For blind checks, source keys in normative references suffice; manifest access requires an
explicit packet allowlist for a source-definition heading or range.
Apply the same boundary to knowledge modules: load relevant normative headings, not historical
evaluation preambles or qualification-case maps.
Aggregate roadmap status/counts are permitted workflow context, not case-answer evidence.

The primary owns user decisions, plans/roadmaps, finding dispositions, fixes and green
local commits. Auditors are read-only and never commit, push, edit tests or create issues.
All read-only roles default-deny unlisted actions, shell, edits and child delegation;
only read/search, research and skill-loading actions are allowed. Writers ask for shell,
executors deny specification edits and the spec author can write only specification files.
Do not bypass a tool denial with shell, another tool or another agent. Generic fallbacks
need equivalent restrictions; a prompt-only promise does not prove enforced permissions.
Agent agreement is not proof. The sensitive-path rule in AGENTS.md remains stricter
than general read access; use authorized excerpts when direct access is not approved.

Keep implementation inline when tasks share substantial context. Delegate bounded phases
only when isolation or capability improves the result; parallel writes need disjoint ownership.
The specification author remains implementation-blind and is not an independent reviewer
of its own oracle. Generic approval never authorizes changing an existing specification test.

## Select by affected contract, not filename alone

Select all applicable rows, including changes in callers or consumers outside the apparent
owner. A tag is a useful summary, not permission to omit a relevant risk. The third column
is the intended reasoning default, not a new per-command effort-confirmation pause.

| Phase signal                                                                                    | Review owner              | Effort | Distinct responsibility                                                              |
| ----------------------------------------------------------------------------------------------- | ------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Every non-trivial executed phase/setup                                                          | `correctness-reviewer`    | high   | Correctness, maintainability, standards, evidence scope and oracle integrity         |
| Language behavior, evaluation, diagnostics, APIs or restrictions                                | `semantics-reviewer`      | xhigh  | Semantic preservation and modern-source DX, reported separately                      |
| Calls/returns, aliases/lifetimes, helpers/spills, allocation/closure or interrupt overlap       | `sfa-abi-auditor`         | xhigh  | Function-storage and calling-convention proof from producer to final consumer        |
| CPU/profile, MMIO, banking, firmware/interrupts, timing, asset visibility or delivery placement | `target-platform-auditor` | xhigh  | Exact selected-machine and artifact contract; C64 does not become universal doctrine |
| Lowering/selection, optimization, allocation/layout or target-library output                    | `machine-code-auditor`    | xhigh  | Equivalent expert assembly and complete generated resource costs                     |
| Compiler/tool host hot paths or scaling                                                         | `performance-auditor`     | xhigh  | Host performance, not emitted-code parity                                            |
| Source/config/asset input, host tool invocation or other security boundary                      | Existing security review  | high   | Applicable input/path/process security, using a bounded supported checklist          |

Specialists are not required for an unrelated documentation or mechanical task. Existing
correctness review and impact-based verification still apply when required. A selected
auditor supersedes the general reviewer's matching lens; reviewers inspect their interface
to another proof, not repeat that audit. Merge duplicate findings by the violated invariant.

## Risk and stage

| Risk                                                                                   | Minimum independent review                                                                         |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Critical: storage corruption, unsafe interrupt/device behavior, incompatible semantics | At least two relevant reviewers independent of the author; retain base correctness review          |
| High: cross-cutting, concurrency-sensitive or public-contract work                     | Demanding reasoning and at least one relevant independent reviewer; retain base correctness review |
| Standard                                                                               | One independent review pass                                                                        |
| Mechanical                                                                             | Inline execution and deterministic verification; no specialist swarm                               |

For critical work, a base reviewer counts toward the two only when its packet assigns
a relevant non-duplicated contract. Do not treat an unrelated review as the second proof.
Keep the configured minimum and all stricter specification/skill gates; this table never
reduces them. Missing decisive evidence blocks the affected conclusion, not necessarily
unrelated work. Critical/major findings must be resolved and re-verified under existing gates;
reviewer count or agreement cannot waive them.

| Stage         | Dispatch target                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Planning      | Contract, smallest design, required producer/consumer facts and decisive proof obligations                                      |
| Preflight     | Assigned artifact and dimension cluster; use relevant specialists for its domain lenses without adding a second full audit team |
| Execution     | Complete bounded phase diff against its actual baseline, including new files but excluding prior dirty work                     |
| Qualification | Actual assembly/bytes/reports/runtime evidence and equivalent obligations, not just intended behavior                           |
| Closeout      | Remaining findings, evidence limits, exact exceptions and deferrals whose reasons have expired                                  |

Preserve preflight's complete dimension partition and budget even when a specialist assists.
An auditor does not become a plan executor. No compiler capability is qualified by setting
up agents or by writing a plan.

## Dispatch and evidence

Start packets with `[codeops-dispatch agent=<role> feature=<owner> phase=<unit>]`.
Supply the scope and original goal, smallest design, baseline/diff or artifact, task and
deliverables, authoritative excerpts and exact approved exceptions, target paths, selected
CPU/profile/tool context, relevant raw-evidence roots, verification command/result, forbidden
actions, assigned lenses/cluster and required output. Do not send the author's preferred
conclusion to an independent challenger. Missing material input must be reported, not guessed.

Reviewers report surviving findings with severity, exact location, governing authority,
counterexample/cost witness, consequence and smallest remedy after attempting refutation.
Return an explicit `no findings` when applicable, alongside the assessed boundary and Unknowns.
Record the active expert version/content, reference heading and source keys for domain conclusions.
Separate semantic, storage, assembly, byte, runtime and physical endpoints. Skips do not pass.
SFA safety does not imply shared-state atomicity; per-entry costs do not prove an external bound.

Each optimization retains independent behavior and assembly/cost expectations. An auditor
identifies missing checks; the implementer adds the smallest necessary existing-tier regression.
Do not build a new validator framework merely to organize reviews.

## Concurrency and unavailable roles

The [configured limit](codeops.json) is four total active agents: primary plus at most three
children. It is a workflow ceiling even when a runtime exposes a different limit. Run additional
required reviews in waves; do not drop coverage to fit one wave. Avoid duplicate verification.
Only the assigned execution owner runs expensive checks; VICE cases are always sequential.

Agent files are repo-local instructions, not a guarantee that the current session has loaded them.
Try the named role once when availability is uncertain. If unavailable, announce it and dispatch
a fresh generic agent with the complete charter and bounded packet. Preserve independence,
effort capability, read-only actions and reviewer count. Inline fallback cannot replace a required
independent review. Do not install a second skill, mutate global settings or restart user processes.

## Native ownership and maintenance

All 13 native files are hand-authored ports, not stock installer output. Preserve
their project-specific contracts. The three existing domain auditors have
metadata briefs in `codeops/specialists/`; their executable charters remain in
`.opencode/agents/`. The former `6502-output-auditor` is now
`machine-code-auditor`, with the same responsibility and finding prefix. Historical
records retain their original names; resolve them through this mapping, not a
second active alias.

Use `effort` for the supported low/medium/high workflow preference and `reasoning`
for the intended model reasoning level. Unsupported model variants must be
reported, not silently claimed as applied. No model is pinned by this migration.

`analyze-agents` records coverage and proposes at most two evidenced gaps, after
deduplicating the current registry. `setup-routing` owns approved specialist
changes and the managed AGENTS index. Refresh the project-managed section with
`analyze-project` only after coverage is current; preserve hand-authored policy.

The installed CodeOps 2.2.1 generator emits legacy fields and hidden catalog
agents. Do not regenerate these native charters from its stock templates. Its
`--check` classifies hand-authored files rather than validating their V2 policy.
The existing `--sync-agents-md` renderer remains the owner of the specialist
index. Configuration, effective permissions, native loading and behavioral smoke
checks are separate results; see the
[migration evidence](features/_maintenance/plans/opencode-native-migration/99-execution-plan.md).

## Setup verification

Parse native Markdown frontmatter and JSON. Check role/filename agreement,
descriptions, visible subagent mode, ordered default-deny permissions, intended
reasoning and registry parity. Verify that reviewers cannot edit, use shell,
delegate or call unlisted mutation tools. Writers must not bypass oracle gates.
Do not use generator byte equality as a test of hand-authored charter correctness.

Check targeted Markdown/JSON formatting, links and frozen-authority guards. Exercise small,
read-only packets for valid and invalid nested calls/storage, device effects, complete versus
unproved interrupt contracts, measured code regressions and exact authorized versus unauthorized
oracle edits. Also check that unrelated work does not select specialists. Do not give a tested
agent the grader's expected verdicts. Configuration parsing, native role loading and behavioral
packet checks are separate results; record fallbacks honestly rather than claiming native activation.

## Historical setup evidence — 2026-10-04

This section records the former Codex setup. It is historical evidence, not
OpenCode activation or present expert-version authority. Current migration
qualification is recorded in the linked maintenance execution document.

Checked 2026-10-04 against worktree snapshot `162e1577`. The modification set is exactly this
file, `AGENTS.md`, `codeops.json`, the three new specialist TOMLs and the two existing
`semantics-reviewer` / `correctness-reviewer` TOMLs. Prior NMI planning changes are excluded.

| Boundary                 | Result                                                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration            | PASS: existing JSON schema; all 13 unique TOMLs agree with the role registry, effort and sandbox defaults; no model pins; four-total ceiling unchanged.                                                                                                     |
| Stock installer          | Explicit ten existing template-role check passes and preserves hand-authored files. Unscoped stock check requests two nonconfigured finance/concurrency roles and reports them missing; this is not a custom-role check. No unrelated roles were installed. |
| Native loading           | Each new named role returned unavailable in this session. Native activation remains Unknown; a later session must check it rather than infer it from files.                                                                                                 |
| Generic fallback         | PASS: fresh agents consumed the complete local charters and bounded packets without mutations. Domain checks used one combined fresh context, not four independently loaded native roles.                                                                   |
| Artifact checks          | PASS: targeted JSON/forced Markdown formatting, local links, whitespace and unchanged frozen/source/test paths. Foundation suite: 12/12. No compiler-suite claim.                                                                                           |
| Independent setup review | No findings in the completed approved setup review.                                                                                                                                                                                                         |

The primary checked 32 synthetic-case distinctions against independently derived expected
behavior. These are smoke checks of review instructions, not compiler or expert-skill qualification.

| Cases | Checked distinction                                                                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1–S7 | Legal staged nested calls versus clobbered arguments; shared versus disjoint IRQ scratch; late storage; platform-data ownership; finite immutable NMI links versus unproved external guarantees.                                     |
| P1–P7 | One consuming read versus two; entry proof versus reset history; complete bounded disclosure; reserve arithmetic; VICE versus silicon; CPU versus VIC visibility.                                                                    |
| M1–M6 | 5-byte/6-cycle expert store versus 6-byte/8-cycle NOP regression; local meet versus whole-program beat; equivalent effects; independent Boolean oracle; 36-byte complete attribution; direct rewrite versus unsupported registry/IR. |
| D1–D5 | Separate semantic/DX results for ordinary nested calls and variable addresses, genuine forbidden recursion, evaluation/volatile effects and actionable ownership diagnostics.                                                        |
| O1–O5 | Exact approved fixture edits accepted; over-broad/unapproved edits rejected; new spec-first tests permitted; missing approval evidence cannot clear an edit.                                                                         |
| R1–R2 | Unrelated prose selects no compiler specialists; critical mixed NMI work selects applicable contracts in waves within four total agents.                                                                                             |

Earlier attempts that exposed historical or current evaluator answers were excluded. The final
domain context received only five release-identity rows and selected normative reference headings;
no case-answer, grading or prior-reviewer exposure occurred. Its initial stop over aggregate
roadmap counts was clarified before case reading or assessment. No grading expectations were sent
to the tested agents. Oracle/routing checks ran in a separate fresh context.

The domain check records expert `2.0.3`, content `22cc5f00f381c82d347cf342be4fcff16bc291c6` and
specification key `BLEND65-SPEC-4-038b70e9`. No compiler implementation, native-role activation,
assembly/runtime qualification or physical-hardware proof follows from this setup.
