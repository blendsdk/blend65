# Findings — function-frame callable-proof repair

> **CodeOps Artifact Schema**: 1 · **Plan**: local-callable-proof · **Phase**: T-34
> **Review diff baseline**: `9678b110b7d546869846fb6b3e9b0d2a1ba561b0`

| Finding | Phase | Severity | Area | Ruling |
| --- | --- | --- | --- | --- |
| PE-001 | T-34 | MINOR | services/final-callable-proof | fixed |
| PE-002 | T-34 | MINOR | semantic/final-placement-proof | accepted |
| PE-003 | T-34 | MINOR | semantic/interprocedural-kills | accepted |
| PE-004 | T-34 | MINOR | frontend/direct-calls | deferred |
| RV-001 | T-34 | MINOR | frontend/direct-calls | fixed |
| RV-002 | T-34 | MINOR | frontend/direct-calls | fixed |
| RV-003 | T-34 | MINOR | semantic/function-targets | fixed |
| RV-004 | T-34 | MINOR | semantic/interprocedural-kills | dismissed |
| RV-005 | T-34 | MINOR | services/final-callable-proof | fixed |
| RV-006 | T-34 | MINOR | evidence/byte-identity | fixed |
| SM-001 | T-34 | MAJOR | services/final-callable-proof | fixed |
| SM-002 | T-34 | CRITICAL | semantic/raw-write-kills | fixed |
| SM-003 | T-34 | MAJOR | semantic/function-targets | accepted |
| SM-004 | T-34 | MINOR | frontend/direct-calls | fixed |
| SM-005 | T-34 | MINOR | semantic/final-placement-proof | accepted |
| SM-006 | T-34 | MINOR | frontend/direct-calls | accepted |
| SF-001 | T-34 | MAJOR | services/final-callable-proof | fixed |
| SF-002 | T-34 | MAJOR | semantic/function-targets | accepted |
| MC-001 | T-34 | MAJOR | services/size-selection | fixed |
| MC-002 | T-34 | MINOR | services/final-callable-proof | fixed |
| MC-003 | T-34 | MINOR | frontend/direct-calls | accepted |
| SM-007 | T-34 | MAJOR | semantic/function-targets | fixed |
| SM-008 | T-34 | MINOR | services/final-callable-proof | accepted |
| SM-009 | T-34 | MINOR | services/final-callable-proof | accepted |
| SM-010 | T-34 | MINOR | plan/design-record | fixed |

## Rulings that needed a decision rather than a repair

**The write whose address is only known at run time (SM-003, SF-002, SM-007).** Two reviewers
found that such a write invalidates a callable held in a module variable but not one held in a
function frame, and proposed closing the gap by treating every placed home as reachable by an
unknown write. It was prototyped, measured as free against every suite and the example corpus,
and then **withdrawn**.

Two independent reasons, either of which is sufficient:

1. The project's own frozen specification test `test/rd04/function-values.spec.test.ts` refused a
   valid program under the prototype. A frozen oracle failing means the implementation is wrong.
2. The governing question — what an expert developer expects — answers plainly that a helper
   taking an address and writing through it must compile. Every comparable systems language
   compiles it. The existing module-variable behaviour is therefore the defect, and copying a
   defect into new territory for the sake of symmetry is not a justification.

Recorded consequences: a raw write whose address the compiler cannot resolve does not invalidate a
callable in frame storage, and the stricter module-variable behaviour is itself a defect awaiting
its own unit. The underlying cause is that an unresolved write is never cleared by a later definite
typed store, although the code claims otherwise in a comment.

**The sixth file (`frontend/direct-calls.ts`).** A call through an aggregate field produced a
refusal that named no storage at all, because the frontend resolves the whole callee text as a
name and a dotted path is not a name. The leading identifier of the path is now resolved for that
note only. Two reviewers examined the blast radius independently and both cleared it: the resolved
binding reaches the declaration note alone, so the other diagnostics produced in that function are
unchanged.

**The byte-identity claim (MC-001).** The original claim was broader than its evidence. It now
reads: a program with no raw write covering frame-callable bytes keeps its bytes; a program that
has one may be refused, or may publish a different representation when a candidate withdraws from
cost selection. Supporting evidence is the committed `boing-ball.prg` artifact, which a current
build reproduces byte-for-byte.
