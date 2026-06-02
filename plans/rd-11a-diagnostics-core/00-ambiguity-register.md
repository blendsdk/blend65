# Ambiguity Register: RD-11a Diagnostics Core (Plan Level)

> **Status**: ✅ GATE PASSED — 8 plan-level items resolved (2026-06-01)
> **Last Updated**: 2026-06-01

> **Source RD**: [RD-11](../../requirements/RD-11-diagnostics-reporting.md) (scoped to the "11a" subset)
> **Also consulted**: [RD-02](../../requirements/RD-02-lexer.md) (consumer), [RD-14](../../requirements/RD-14-vscode-language-server.md) (consumer)
> **Upstream register**: [requirements/00-ambiguity-register.md](../../requirements/00-ambiguity-register.md) — AR-1..AR-93 (discovery closed)
> **Frozen spec**: [spec/14-diagnostics.md](../../spec/14-diagnostics.md) (Ch 14)

---

## Purpose & Scope

RD-11 and the upstream requirements register (AR-1..AR-93) already resolve all
**language- and architecture-level** decisions for the diagnostics engine. This register
captures only the **plan/implementation-level** decisions that surfaced when sequencing
RD-11 ahead of RD-02 (the lexer) and carving out the **11a subset** — the diagnostics
core that the lexer depends on, built fully (no stubs) per RD-11's authoritative API.

Every plan-level entry is prefixed `AR-Q` to distinguish it from the upstream `AR-NN`
entries it builds on and from RD-01's `AR-P` entries.

---

## The 11a / 11b Split (governing decision)

**AR-Q1** establishes the split. RD-11 owns two subsystems: the **diagnostics engine**
and the **resource reporter**. The lexer (RD-02) depends only on the diagnostics-engine
*data model and accumulation* layer — not on rendering, severity policy, the source
registry, or resource reporting. We therefore build, in this plan:

**11a — built now, complete, in `@blend65/core`:**
- `SourceId`, `SourceSpan`, `LabeledSpan` (RD-11 §4.2, R12–R13)
- `LineMap` — all three methods, complete (RD-11 §4.2, R14–R15; RD-02 §4.8)
- `Diagnostic` record (RD-11 §4.1, R4–R11)
- `DiagnosticBag` — complete: ordering, dedup, max-errors, all query methods (RD-11 §4.3, R17–R22)
- Diagnostic code namespace constants `E10xxx` / `W10xxx` / `E9xxxx` (RD-11 §3.1, R1–R3)

**11b — deferred to a later RD-11 plan (NOT stubbed here):**
- `SourceMap` registry (RD-11 §4.2) — the lexer receives `(sourceId, text)` directly per
  RD-02 §4.9, so it never touches the registry; built when interning/rendering needs it.
- `SeverityPolicy` + `applySeverityPolicy` (RD-11 §4.4) — post-collection pass, no producer dep.
- `renderTerminal` / `renderJson` (RD-11 §4.5) — consumers, not producers.
- `ResourceReport` + report renderers (RD-11 §4.6–4.7) — consumes SFA (RD-05) / ACME (RD-09)
  data that does not exist yet (RD-11 R48 explicitly designs the shape to be populated per slice).

This yields infra-first purity for the lexer's prerequisites while not building a report
subsystem we cannot yet runtime-verify. RD-11's eventual plan **extends** 11a and never
refactors it.

---

## Register

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| AR-Q1 | Scope | How to sequence the diagnostics infra vs the lexer, and how much of RD-11 to build now | (1) RD-02-first, pull needed core types / (2) full RD-11 first / (3) RD-11a-first hybrid: build the diagnostics-core subset fully now, defer resource-report (11b) | **Option 3 — RD-11a-first hybrid.** Build the diagnostics-core subset (span model, LineMap, Diagnostic, DiagnosticBag, code namespace) fully per RD-11 now; defer SourceMap, SeverityPolicy, renderers, ResourceReport (11b) to a later plan | ✅ Resolved |
| AR-Q2 | Technical | "Minimal now" risks shipping partial types RD-11 would later refactor | full owner-spec implementations / partial stubs filled in later | **No stubs.** Every type built now is implemented 100% to its owning RD's (RD-11) final API and semantics. "Minimal" limits *which* components are built, never *how completely* | ✅ Resolved |
| AR-Q3 | Technical | `LineMap` line/column method name conflict — RD-02 §4.8 sketches `getLineAndColumn(offset, text)`; RD-11 §4.2 (owner) defines `getLineCol(offset)` | follow RD-02 sketch / follow RD-11 owner | **Follow RD-11 owner verbatim:** `getLineCol(offset): { line, column }` (1-based). RD-02's sketch is discarded as informal | ✅ Resolved |
| AR-Q4 | Technical | `getUtf16Column` signature — RD-02 sketch passes `sourceText`; RD-11/RD-14 call it with offset only | text-param / no text-param (LineMap holds text) | **Follow RD-11/RD-14:** `getUtf16Column(offset): number`. The `LineMap` stores its own source-text reference (constructed with the text), so RD-14 §4.4 can call it without passing text | ✅ Resolved |
| AR-Q5 | Technical | RD-11 §4.2 defines a third `LineMap` method `getLineText(offset)` (needed by the terminal renderer) that RD-02 omits | include now / defer | **Include now**, complete per RD-11. Cheap, owner-mandated, avoids a later reshape | ✅ Resolved |
| AR-Q6 | Technical | `DiagnosticBag` API the lexer calls — RD-02 pseudocode writes `bag.add(code, span, msg)`; RD-11 §4.3 (owner) defines `addError` / `addWarning` / `addICE` (+ query methods) | follow RD-02 sketch / follow RD-11 owner | **Follow RD-11 owner verbatim.** Lexer calls `addError` / `addWarning`. The bag implements the complete RD-11 interface and semantics now (ordering, dedup, max-errors). RD-02's `bag.add` sketch is discarded | ✅ Resolved |
| AR-Q7 | Technical | `SourceId` representation (RD-11 §4.2 says `type SourceId = number` "index into SourceMap", but SourceMap is deferred to 11b) | opaque branded type / plain `number` | **Plain `number`** exactly as RD-11 §4.2 states (`type SourceId = number`). The "index into SourceMap" semantics are honored; the registry that produces the index is 11b. The lexer is handed a `SourceId` by its caller | ✅ Resolved |
| AR-Q8 | Workflow | Commit mode for executing this plan | --ask-commit (default) / --auto-commit / --no-commit | **`--no-commit`** — implement, verify, update plan; the user handles all git operations | ✅ Resolved |

---

## Resolution Notes

**AR-Q1:** The user explicitly chose the hybrid after weighing three sequencings. RD-11's
own header declares `Depends On: RD-01` only, so building the diagnostics core now is
unblocked. Deferring 11b avoids building the `ResourceReport` renderers against
non-existent SFA/ACME data (RD-11 R48 anticipates exactly this by defining the report
shape now and populating it per slice — that work belongs with the producers, RD-05/RD-09).

**AR-Q2:** Governing principle for the whole plan: anything implemented now is implemented
to its owning RD's complete specification. This is why `DiagnosticBag` ships with full
deterministic ordering, dedup, and max-errors behavior (RD-11 R18–R20) rather than a
thin append-only stub — RD-11's later plan must find these already satisfied, not need a
rewrite.

**AR-Q3 / AR-Q4 / AR-Q5:** RD-11 is the **owning RD** for `LineMap` (it appears in RD-11
§4.2 with all three methods; RD-02 only references it as a consumer/builder). When an
informal sketch in a consumer RD conflicts with the owner's definition, the owner wins.
The `LineMap` is constructed with `(sourceId, text)`; it precomputes line-start byte
offsets and retains the text so `getLineCol`, `getUtf16Column`, and `getLineText` all work
from offsets alone. UTF-16 columns are computed by measuring the UTF-16 code-unit length
of the text slice from the line start to the offset (LSP positions are UTF-16, 0-based —
the −1 line conversion happens in the RD-14 consumer, not in `LineMap`, which returns
1-based lines per RD-11).

**AR-Q6:** RD-11 §4.3 is the authoritative `DiagnosticBag` contract:
`addError(code, span, message, options?)`, `addWarning(...)`, `addICE(...)`,
`hasErrors()`, `getAll()`, `getErrors()`, `getWarnings()`, `count()`,
`isErrorLimitReached()`, with `DiagnosticOptions { secondarySpans?, notes?, help? }`.
Ordering is deterministic (sourceId → start offset → code; R18); duplicates with the same
`(code, sourceId, start)` triple are dropped (R19); `--max-errors` (default 20) stops
accepting new *error*-severity diagnostics after the limit and emits one truncation
diagnostic, while warnings continue to be accepted (R20). The lexer (RD-02 R30) calls
`addError`/`addWarning` only — it never renders.

**AR-Q7:** `SourceId` is a plain `number` per RD-11 §4.2. The lexer's `lex(sourceId, text,
bag)` entry point receives an already-assigned id from its caller; producing ids
(interning paths) is the deferred `SourceMap`'s job (11b). Using `number` now matches the
owner exactly — no branded-type migration later.

**AR-Q8:** Per the user's instruction, this plan executes under `--no-commit`. The agent
implements tasks, runs the verify command, and updates `99-execution-plan.md`, but performs
no git operations and issues no commit prompts.

---

## Traceability

Every decision in the RD-11a plan documents traces to an upstream `AR-NN`
(language/architecture, in `requirements/00-ambiguity-register.md`), a frozen spec section
(Ch 14), the owning RD's numbered requirement (RD-11 `R#`), or an `AR-Q#` above.
Universally-obvious facts (`.ts` extension, markdown formatting) are exempt per the
Zero-Ambiguity Gate exception clause.

**Runtime entries:** if implementation surfaces a new ambiguity, STOP, add it here as the
next `AR-Q#` tagged `(runtime)`, resolve it with the user, then resume.
