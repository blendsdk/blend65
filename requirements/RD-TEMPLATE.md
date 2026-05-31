# RD-NN: [Document Title]

> **Status**: 🟡 Draft / 🟢 Authored / ⚪ Deferred
> **MVP Phase**: A / B
> **Depends On**: [RD-NN, …] or —
> **Implements**: `spec-v3.0` [chapters/appendices this RD turns into compiler behavior]
> **Owning package(s)**: `@blend65/[package]`
> **Created**: [YYYY-MM-DD]
> **Last Updated**: [YYYY-MM-DD]

---

## 1. Purpose

[1–2 paragraphs: what part of the compiler this document specifies and why it exists.
State the single responsibility of this RD and how it advances the MVP-first walking
skeleton (AR-38). Every RD must trace back to the frozen spec and to resolved ambiguity
register entries — this document specifies *implementation*, never *language design*.]

## 2. Scope

**In scope:**
- [Concrete deliverable 1]
- [Concrete deliverable 2]

**Out of scope (and where it lives instead):**
- [Excluded item] → [RD-NN / future / spec]

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

## 3. Decisions & Requirements

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | [What must be true] | [Concrete required behavior] | AR-NN / Ch NN §N |
| R2 | … | … | … |

## 4. Design Detail

[The substantive body of the RD. Subsections as needed — interfaces, data shapes,
algorithms, file/directory structures, config schemas, package boundaries, etc.
Use code blocks for concrete artifacts (TypeScript signatures, JSON schema, directory
trees). Keep platform-specific detail out of core sections (Guard P3); reference
platform plugins/profiles instead.]

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-NN | [How this RD depends on / feeds / constrains that RD] |

## 6. Acceptance Criteria

- [ ] [Verifiable condition 1 — measurable / testable]
- [ ] [Verifiable condition 2]
- [ ] All decisions trace to an `AR-NN` or a frozen spec section
- [ ] Verification (unit / golden / emulator per AR-22) defined where applicable

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

[None.]
