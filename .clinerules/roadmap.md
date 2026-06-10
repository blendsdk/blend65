# MANDATORY: Roadmap Protocol

> **Version**: 1.0
> **Date**: 2026-06-09
> **Status**: Mandatory — applies to every task in this repository, alongside the CodeOps
> rules (`.clinerules/project.md`) and the Language Guard (`.clinerules/language-guard.md`).

The repository has a single living implementation tracker: **`plans/ROADMAP.md`**. It is
authoritative for *implementation status* (what is done, what is next).

---

## Rule 1 — Read the roadmap first

At the **start of every task**, read `plans/ROADMAP.md` to determine:

- the **Current Position** (last completed RD + next up),
- which RD the work belongs to, and
- where that RD sits in the MVP critical path.

Do not begin implementation work without knowing the current roadmap position.

---

## Rule 2 — Follow the fixed per-RD workflow

Every RD is taken through this exact sequence — no steps skipped, no reordering:

```
preflight  →  make_plan  →  preflight  →  exec_plan
```

1. **preflight** — validate the RD requirements document against
   `requirements/01-preflight-checklist.md`. Verdict must be PASS before planning.
2. **make_plan** — author the plan under `plans/<rd-slug>/` (skip only if a plan directory
   already exists; in that case review/refresh it instead).
3. **preflight** — re-run preflight against the *authored plan* to confirm it is coherent
   and complete. Verdict must be PASS before any code is written.
4. **exec_plan** — execute phase-by-phase (spec-tests-first per `testing.md`), updating the
   plan's `99-execution-plan.md` progress header as each task lands.

---

## Rule 3 — Keep the roadmap updated (never let it drift)

`plans/ROADMAP.md` MUST stay in sync with the plan headers. As part of the same change set:

- When an RD's `plans/<rd-slug>/99-execution-plan.md` reaches **100%**, move its row from
  **Pending** to **Done** in `plans/ROADMAP.md`.
- Update the **Current Position** block (last completed + next up).
- When `make_plan` creates a new plan directory, update that RD's "Plan dir" cell.
- Bump **Last Updated**.

Updating `ROADMAP.md` is **not optional** and is **not a separate task** — it is part of
finishing the work. A task that completes an RD but leaves the roadmap stale is incomplete.

---

## Rule 4 — Ownership boundaries

- `plans/ROADMAP.md` owns **status** (done / pending / current position).
- `requirements/README.md` owns **dependencies and RD scope**.
- If the two diverge, reconcile in favor of `requirements/README.md` for dependencies, and
  fix `plans/ROADMAP.md` status to match the real plan headers.
