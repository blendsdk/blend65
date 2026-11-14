# T-30 independent review packet

> **Baseline**: commit `c7d21d75` (clean tree, `spec/` untouched)
> **Scope**: T-15 partial fixed-array construction and T-10 helper callable proof
> **Status**: implementation green on the targeted oracles after the first review round;
> complete checkpoint in progress

## Authorized review reads

You are authorized to read these exact paths for this review, including the frozen expert
authority named below:

- `packages/compiler/src/machine/lower-aggregate-members.ts`
- `packages/compiler/src/semantic/assignment-facts.ts`
- `packages/compiler/src/semantic/function-targets.ts`
- `packages/compiler/src/machine/aggregate-partial.impl.test.ts`
- `packages/compiler/src/semantic/function-targets.impl.test.ts`
- `test/rd04/partial-array-construction.spec.test.ts`
- `test/rd05/callable-helper-assignment.spec.test.ts`
- `codeops/features/blend65-v4/plans/partial-array-and-callable-proof/99-execution-plan.md`
- `codeops/features/blend65-v4/plans/partial-array-and-callable-proof/00-preflight-report-99-execution-plan.md`
- `.agents/skills/blend65-domain-expert/SKILL.md`
- `.agents/skills/blend65-domain-expert/qualification/release.md`
- The SFA/ABI, CPU/platform, lowering, semantics and emitted-code references those two files
  route to.
- Frozen specification files under `spec/` named in the plan.

Shell execution is not required. Treat the diff and evidence below as the change under review.

## Expert lineage (current active record only)

| Field | Value |
| --- | --- |
| Active qualified version | `2.0.4` |
| Status | Active qualified and frozen |
| Router | `2.0.4`; SHA-256 `0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8` |
| Specification | `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b` |
| Immutable content commit | `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15` |

## Scope confirmations

| Check | Evidence |
| --- | --- |
| `spec/` unchanged | `git status --porcelain spec/` produced no output. |
| Ledger unchanged | `test/rd04/expressiveness-ledger.json` and its test are untouched; no T-10/T-15 row exists. |
| No oracle weakened | No pre-existing test, oracle or VICE journey was deleted or skipped. Two new spec files were authored implementation-blind from the frozen spec; the author was forbidden to read the production files. Two intermediate implementation tests added during review were withdrawn together with the superseded alias implementation; no pre-existing oracle was touched. |
| Public API | No package export, CLI, profile, platform or SSA/ABI shape changed. |
| Production surface | Three compiler source files (two changed, one extracted module). |

## RED evidence (spec tests before implementation)

| File | Result | Actual failure |
| --- | --- | --- |
| `test/rd04/partial-array-construction.spec.test.ts` | 12 failed / 4 passed (16) | `COMPILER_LOWERING: Fixed array construction is missing an element` on the three partial cases; the fill control passed. |
| `test/rd05/callable-helper-assignment.spec.test.ts` | 12 failed / 8 passed (20) | `E10277` on both positive helper cases; `COMPILER_LOWERING` (not `E10277`) on the omitted callable element; conditional and fully supplied controls passed. |

## GREEN evidence (after implementation and the first review round)

| Command | Result |
| --- | --- |
| `yarn vitest run test/rd04/partial-array-construction.spec.test.ts test/rd05/callable-helper-assignment.spec.test.ts` | 2 files, 36 passed, 50.3 s |
| `yarn workspace @blend65/compiler vitest run src/machine src/semantic` | 96 files, 1,264 passed, 26.6 s |
| Complete compiler package suite | 227 files, 3,828 passed / 2 skipped, 5m10 |
| Complete package + host checkpoint | Compiler 227 files / 3,828 passed / 2 skipped; CLI 70; host root 219 files / 4,681 passed |
| Complete VICE tier, first run | 2,269 passed / 4 skipped with one known VIC collision timing flake; isolated serialized rerun 16/16 twice |
| Complete VICE tier, clean rerun | 122 files passed / 1 skipped; 2,270 tests passed / 4 skipped in 64m55s |

## First review round and dispositions

| ID | Reviewer | Severity | Finding | Disposition |
| --- | --- | --- | --- | --- |
| RV-001 | Correctness | Major | Helper writes made during global initialization never reached main's entry facts. | Fixed: `startupAssignmentFacts` carries definite writes through the ordered initializers into main's entry facts; later initializers see earlier ones. New impl test and a public CLI build accept the witness. |
| RV-002 | Correctness | Minor | The omitted callable-array tests used only a constant index. | Fixed: a dynamic-index rejection case was added. |
| RV-003 | Correctness | Minor | `function-targets.ts` grew to 803 lines. | Fixed: the must-assignment analysis and call summaries moved to `assignment-facts.ts` (295 lines); `function-targets.ts` is 541 lines. |
| SM-001 | Semantics | Major | A helper that assigns then raw-writes through `&callback` kept a false finite target. | Fixed for the summary route: address-taken globals are excluded from call-write summaries, so the witness now fails `E10277`. The pre-existing direct-assignment plus raw-write hole is a separate spec violation tracked by issue #156. |
| MC-001 | Machine code | Minor | The newly accepted partial-array witness reloads the known element before publishing it. | Tracked by issue #154 with the measured 3-byte / 4-cycle gap. Not a regression: the construction itself is expert-minimal and the reload is existing private-value forwarding debt. |
| MC-002 | Machine code | Major | `Game.invoke` stages a byte result through RAM before returning. | Already tracked by issue #124 (return-result staging). The direct `JSR chosen` selection is correct. |
| Startup minimality | Machine code | Unknown | A partial global initializer uses a called runtime-initializer routine. | Measured 4-byte / 12-cycle call-wrapper overhead; tracked by issue #155. The member body is minimal. |
| RV-004 | Correctness / SFA | Major | Startup transfer exported addressed-global facts without the raw-write exclusion. | Fixed: startup additions exclude addressed roots; a startup helper + raw write now fails `E10277`, with an impl test and public build. |
| RV-005 / SF-002 | Correctness / SFA | Major | Every `place-address` was treated as raw exposure, so ordinary aggregate borrowing lost a valid helper write. | **Superseded by the final bounded rule.** The aggregate path is no longer transferred; the intermediate alias-aware state was withdrawn and issue #157 owns the wider form. |
| SM-001 placed alias | Semantics | Major | A placed callable could be raw-written at its fixed or forced address without an address-of operation. | **Superseded by the final bounded rule.** Any global with a placement constraint is excluded from the new transfer, so the literal, computed and align-forced witnesses reject. The intermediate unresolved-address algorithm was withdrawn. |
| RV-006 / SF-003 | Correctness / SFA | Major | Raw exposure through a borrowed aggregate parameter (`&value.cb`) was not propagated to the global alias (`box`). | **Superseded by the final bounded rule.** The aggregate path is no longer transferred, so the witness and its harmless contrast both reject as at baseline; issue #157 owns the wider form. |
| RV-007 | Correctness | Major | A constant unary address (`~$3EFF` = `$C100`) bypassed the placed-global overlap check. | **Superseded by the final bounded rule.** Any placement constraint excludes the destination, so the witness rejects without address folding. |
| RV-008 | Correctness | Minor | The startup rejection test did not exercise the startup filter because the helper summary already excluded the root. | Fixed: added the direct initializer-assignment witness `let seeded: fn(): byte = (callback = &chosen);`; it fails `E10277`. |
| RV-006 / SF-004 | Correctness / SFA | Major | Aggregate copies and returns could carry corrupted callable provenance. | Resolved by bounding the new transfer to bare callable globals with no aggregate path. Aggregate-field helper transfer is now issue #157; the wider corruption tracks belong to #156. |
| SM-001 (align-only / indexed escape) | Semantics | Major | Align-only placements and bounds-off typed stores could overwrite a placed callable. | Any placement constraint is now excluded from the new transfer, and the new transfer is limited to bare unplaced callables with no taken address. Typed out-of-bounds corruption remains the pre-existing #156 boundary. |
| RV-009 / SF-005 / SM-002 | Correctness / SFA | Major | Blanket indirect-borrow exposure rejected a harmless program. | The aggregate path is out of the new transfer domain: the witness is rejected exactly as at baseline, so this is not a regression. Issue #157 owns the wider form. |
| RV-010 / SF-004 (final) | Correctness / SFA | Major | A helper could copy an overwritten callable value into an eligible bare global, or overwrite an earlier safe assignment. | Fixed: a destination is transferable only when every compiler-visible store to it assigns a direct callable source (`function-address` or a merge of addresses), and a transferred summary only credits such stores. Loads, parameters, call results, temporaries, returns and any non-qualifying overwrite exclude the destination. Same-helper, cross-helper and startup overwrite witnesses fail `E10277`; the direct `callback = &chosen` helper still builds. |

## Final review status

| Lens | Verdict |
| --- | --- |
| Correctness | APPROVE within AR-P1 |
| Semantics | APPROVE within AR-P1 |
| SFA/ABI | APPROVE within AR-P1 |
| Emitted code | APPROVE on output dispositions |

AR-P1 is resolved in `00-ambiguity-register.md`: the user selected the bounded typed-provenance
transfer on 2026-11-14. #156 remains an accepted raw-corruption risk, not a safe rejection; #157
remains conservative aggregate precision debt.

## Emitted-code evidence (`c64-pal-prg-kernal-6581`, optimization `none`)

Partial local array `let a: byte[2] = [7]; poke($C000, a[0]);`:

```asm
; routine "Game.main"
  lda #$07
  sta $0aad        ; supplied element only
  lda $0aad
  sta $c000
  jmp+2 b65_startup_block_1_...restore
```

One store to the array home, no zero fill, no omitted store, no new scratch.

Helper callable `prepare(); poke($C000, invoke());`:

```asm
; routine "Game.prepare"
  lda #<(b65_Game_chosen_...)
  sta+2 b65_Game_callback_global...
  lda #>(b65_Game_chosen_...)
  sta+2 b65_Game_callback_global... + $0001
  rts

; routine "Game.invoke"
  jsr+2 b65_Game_chosen_...
  sta $0ac7
  lda $0ac7
  rts
```

The singleton target is a direct `JSR chosen`, not a dispatcher.

Partial global array `let values: byte[3] = [9];` startup path:

```asm
  jsr+2 b65_Game_values_init
; ...
b65_Game_values_init:
  lda #$09
  sta+2 b65_Game_values_global...
  rts
```

The body stores only the supplied element; the call wrapper is tracked by issue #155.

## Public CLI behaviour after the review round

| Program | Result |
| --- | --- |
| Startup helper: `let ready: byte = prepare();` where `prepare` assigns `callback` | Builds |
| Helper assigns then `pokew(&callback, ...)` | Fails `E10277` |
| Startup helper assigns an addressed global, then raw write | Fails `E10277` |
| Typed aggregate borrow: `prepare()` assigns `box.cb`, `invoke(box)` calls it | Fails `E10277` — final bounded rule; issue #157 (an intermediate state briefly built it) |
| Placed global `place(at: $C100)` plus `pokew($C100, ...)` | Fails `E10277` |
| Placed global plus computed `pokew(~$3EFF, ...)` | Fails `E10277` |
| Direct initializer assignment of an addressed global, then raw write | Fails `E10277` |
| Safe direct assignment then a copied overwrite in the same helper | Fails `E10277` |
| Safe helper and unsafe overwrite helper for the same destination | Fails `E10277` |
| Safe and unsafe startup helpers for the same destination | Fails `E10277` |
| Auxiliary `corrupt(box)` raw-writes `&value.cb`, then `invoke(box)` | Fails `E10277` |
| Aggregate-field helper write without a raw write | Fails `E10277` — same as baseline; issue #157 |
| Indirect aggregate borrow without a raw write | Fails `E10277` — same as baseline; issue #157 |
| Direct assignment then `pokew(&callback, ...)` | Builds — pre-existing hole tracked by issue #156 |

## Production diff (baseline `c7d21d75`)

```diff
diff --git a/packages/compiler/src/machine/lower-aggregate-members.ts b/packages/compiler/src/machine/lower-aggregate-members.ts
index f66dfd77..97b3e342 100644
--- a/packages/compiler/src/machine/lower-aggregate-members.ts
+++ b/packages/compiler/src/machine/lower-aggregate-members.ts
@@ -43,15 +43,16 @@ export function memberWrites(
       );
     }
     const bytes = typeBytes(operation.type.element);
-    return Object.freeze(
-      Array.from({ length: operation.type.length }, (_, index) => {
-        const valueId = operation.elements[index]?.value ?? operation.fill;
-        if (valueId === null || valueId === undefined) {
-          throw loweringFailure("Fixed array construction is missing an element", operation.span);
-        }
-        return Object.freeze({ valueId, start: index * bytes, bytes });
-      }),
-    );
+    const writes: MemberWrite[] = [];
+    for (let index = 0; index < operation.type.length; index += 1) {
+      const valueId = operation.elements[index]?.value ?? operation.fill;
+      // Omitted elements keep their indeterminate stored bits. The frontend
+      // warns for a partial mutable initializer; lowering must not invent a
+      // zero fill the source never wrote.
+      if (valueId === null || valueId === undefined) continue;
+      writes.push(Object.freeze({ valueId, start: index * bytes, bytes }));
+    }
+    return Object.freeze(writes);
   }
   if (operation.type.kind !== "struct") {
     throw loweringFailure("Aggregate construction requires an aggregate type", operation.span);
diff --git a/packages/compiler/src/semantic/function-targets.ts b/packages/compiler/src/semantic/function-targets.ts
index a3a7b455..e352ebf5 100644
--- a/packages/compiler/src/semantic/function-targets.ts
+++ b/packages/compiler/src/semantic/function-targets.ts
@@ -1,6 +1,16 @@
 import { semanticTypesEqual } from "../frontend/semantic-type-relations.js";
 import { bindingIdentityKey } from "../frontend/semantic-types.js";
-import type { BindingId, FunctionType, SemanticType } from "../frontend/semantic-types.js";
+import type { BindingId, FunctionType } from "../frontend/semantic-types.js";
+import {
+  assignmentFacts,
+  assignmentKey,
+  callWriteSummaries,
+  callablePaths,
+  callableValuePredicate,
+  joinPath,
+  placePath,
+  startupAssignmentFacts,
+} from "./assignment-facts.js";
 import type {
   IndirectCallOperation,
   PlatformOperation,
@@ -45,18 +55,6 @@ function addTargets<Key>(
 /** Function identities retained separately for each aggregate member path. */
 type PathTargets = Map<string, Set<string>>;
 
-/** A dynamic index may select any element; named fields never alias each other. */
-function placePath(place: SemanticPlace): string {
-  return place.path
-    .map((part) => (part.kind === "field" ? `field:${part.name}` : "index:*"))
-    .join("\0");
-}
-
-/** Attach a child aggregate path without confusing a field with its similarly named sibling. */
-function joinPath(parent: string, child: string): string {
-  return parent.length === 0 ? child : child.length === 0 ? parent : `${parent}\0${child}`;
-}
-
 /** Add all known member targets from one value to another value or storage binding. */
 function addPathTargets<Key>(
   facts: Map<Key, PathTargets>,
@@ -98,130 +96,6 @@ function selectPathTargets(source: PathTargets | undefined, path: string): PathT
   return selected;
 }
 
-/** Enumerate only callable leaves, without allocating a path for every array element. */
-function callablePaths(type: SemanticType): readonly string[] {
-  if (type.kind === "function" || type.kind === "interrupt-handler") return [""];
-  if (type.kind === "struct") {
-    return type.fields.flatMap((field) =>
-      callablePaths(field.type).map((path) => joinPath(`field:${field.name}`, path)),
-    );
-  }
-  if (type.kind === "array" && type.length > 0) {
-    return callablePaths(type.element).map((path) => joinPath("index:*", path));
-  }
-  return [];
-}
-
-/** Whole-object writes cover child paths; a field write covers only that field. */
-function assignmentKey(place: SemanticPlace): string | null {
-  if (place.path.some((part) => part.kind === "index")) return null;
-  return joinPath(bindingIdentityKey(place.root), placePath(place));
-}
-
-/** An assigned ancestor contains every one of its descendants. */
-function isAssigned(assigned: ReadonlySet<string>, root: string, path: string): boolean {
-  if (assigned.has(root)) return true;
-  let prefix = "";
-  for (const part of path.split("\0")) {
-    if (part.length === 0) continue;
-    prefix = joinPath(prefix, part);
-    if (assigned.has(joinPath(root, prefix))) return true;
-  }
-  return false;
-}
-
-/** Must-assignment facts at reads and calls within one executable CFG. */
-function assignmentFacts(
-  entry: string,
-  blocks: readonly SemanticBlock[],
-  initial: ReadonlySet<string>,
-): {
-  readonly unknown: ReadonlyMap<SemanticOperation, readonly string[]>;
-  readonly beforeCalls: ReadonlyMap<SemanticOperation, ReadonlySet<string>>;
-} {
-  const byId = new Map(blocks.map((block) => [block.id, block] as const));
-  const reachable = new Set<string>();
-  const pending = [entry];
-  while (pending.length > 0) {
-    const id = pending.pop()!;
-    if (reachable.has(id)) continue;
-    const block = byId.get(id);
-    if (block === undefined) throw new Error(`Semantic CFG references missing block '${id}'`);
-    reachable.add(id);
-    if (block.terminator.kind === "jump") pending.push(block.terminator.target);
-    else if (block.terminator.kind === "branch") {
-      pending.push(block.terminator.whenTrue, block.terminator.whenFalse);
-    }
-  }
-  const active = blocks.filter((block) => reachable.has(block.id));
-  const predecessors = new Map(active.map((block) => [block.id, new Set<string>()] as const));
-  const allAssigned = new Set(initial);
-  for (const block of active) {
-    for (const operation of block.operations) {
-      if (operation.kind === "store") {
-        const key = assignmentKey(operation.place);
-        if (key !== null) allAssigned.add(key);
-      }
-    }
-    const successors =
-      block.terminator.kind === "jump"
-        ? [block.terminator.target]
-        : block.terminator.kind === "branch"
-          ? [block.terminator.whenTrue, block.terminator.whenFalse]
-          : [];
-    for (const successor of successors) predecessors.get(successor)?.add(block.id);
-  }
-  const output = new Map(active.map((block) => [block.id, new Set(allAssigned)] as const));
-  const input = new Map<string, Set<string>>();
-  let changed = true;
-  while (changed) {
-    changed = false;
-    for (const block of active) {
-      const before = block.id === entry ? new Set(initial) : new Set(allAssigned);
-      if (block.id !== entry) {
-        for (const predecessor of predecessors.get(block.id) ?? []) {
-          const facts = output.get(predecessor)!;
-          for (const key of before) if (!facts.has(key)) before.delete(key);
-        }
-      }
-      input.set(block.id, before);
-      const after = new Set(before);
-      for (const operation of block.operations) {
-        if (operation.kind === "store") {
-          const key = assignmentKey(operation.place);
-          if (key !== null) after.add(key);
-        }
-      }
-      const previous = output.get(block.id)!;
-      if (after.size !== previous.size || [...after].some((key) => !previous.has(key))) {
-        output.set(block.id, after);
-        changed = true;
-      }
-    }
-  }
-  const unknown = new Map<SemanticOperation, readonly string[]>();
-  const beforeCalls = new Map<SemanticOperation, ReadonlySet<string>>();
-  for (const block of active) {
-    const assigned = new Set(input.get(block.id));
-    for (const operation of block.operations) {
-      if (operation.kind === "load" || operation.kind === "place-address") {
-        const root = bindingIdentityKey(operation.place.root);
-        const path = placePath(operation.place);
-        const missing = callablePaths(operation.type).filter(
-          (leaf) => !isAssigned(assigned, root, joinPath(path, leaf)),
-        );
-        if (missing.length > 0) unknown.set(operation, missing);
-      } else if (operation.kind === "store") {
-        const key = assignmentKey(operation.place);
-        if (key !== null) assigned.add(key);
-      } else if (operation.kind === "call" || operation.kind === "indirect-call") {
-        beforeCalls.set(operation, new Set(assigned));
-      }
-    }
-  }
-  return { unknown, beforeCalls };
-}
-
 /** Infer callable and handler provenance through values, typed storage and calls. */
 export function resolveTargetSets(
   program: SemanticProgram,
@@ -302,18 +176,64 @@ export function resolveTargetSets(
       }
     }
   }
-  const independent = new Set([
-    bindingIdentityKey(program.main),
-    ...addressTaken.keys(),
-    ...handlerAddresses,
-  ]);
+  // A new call-write guarantee is limited to a bare callable global with no
+  // placement and no taken address. Aggregate fields, placed globals and raw
+  // aliases stay on the conservative pre-existing proof path. Corruption by an
+  // arbitrary numeric raw write remains the separate target-proof boundary.
+  const rawAddressRoots = new Set<string>();
+  for (const context of contexts) {
+    for (const block of context.blocks) {
+      for (const operation of block.operations) {
+        if (operation.kind === "place-address" && operation.type.kind === "scalar")
+          rawAddressRoots.add(bindingIdentityKey(operation.place.root));
+      }
+    }
+  }
+  // A destination is transferable only when every compiler-visible store to it
+  // assigns a direct callable source. One non-qualifying write anywhere means
+  // the definite assignment no longer proves the stored function identity.
+  const unsafeStoreRoots = new Set<string>();
+  for (const context of contexts) {
+    const safeValue = callableValuePredicate(context.blocks);
+    for (const block of context.blocks) {
+      for (const operation of block.operations) {
+        if (operation.kind !== "store") continue;
+        const key = assignmentKey(operation.place);
+        if (key === null || !safeValue(operation.value))
+          unsafeStoreRoots.add(bindingIdentityKey(operation.place.root));
+      }
+    }
+  }
+  const transferableRoots = new Set(
+    program.globals
+      .filter(
+        (global) =>
+          global.type.kind === "function" &&
+          (global.placement === null || global.placement === undefined),
+      )
+      .map((global) => bindingIdentityKey(global.id))
+      .filter((root) => !rawAddressRoots.has(root) && !unsafeStoreRoots.has(root)),
+  );
+  const callEffects = callWriteSummaries(functions, transferableRoots);
+  const startup = startupAssignmentFacts(
+    program,
+    initializedGlobals,
+    callEffects,
+    transferableRoots,
+  );
+  const mainKey = bindingIdentityKey(program.main);
+  const independent = new Set([mainKey, ...addressTaken.keys(), ...handlerAddresses]);
+  const independentEntry = (key: string): ReadonlySet<string> =>
+    key === mainKey ? startup.startup : initializedGlobals;
   const entryAssigned = new Map(
     program.functions.map(
       (fn) =>
         [
           bindingIdentityKey(fn.id),
           new Set(
-            independent.has(bindingIdentityKey(fn.id)) ? initializedGlobals : allGlobalAssignments,
+            independent.has(bindingIdentityKey(fn.id))
+              ? independentEntry(bindingIdentityKey(fn.id))
+              : allGlobalAssignments,
           ),
         ] as const,
     ),
@@ -326,13 +246,17 @@ export function resolveTargetSets(
       const fn = functions.get(context.owner);
       const initial =
         fn === undefined
-          ? context.initial
+          ? (startup.initializerEntry.get(context.owner) ?? context.initial)
           : new Set([
               ...entryAssigned.get(context.owner)!,
               ...fn.parameters.map((parameter) => bindingIdentityKey(parameter.id)),
             ]);
-      for (const [operation, assigned] of assignmentFacts(context.entry, context.blocks, initial)
-        .beforeCalls) {
+      for (const [operation, assigned] of assignmentFacts(
+        context.entry,
+        context.blocks,
+        initial,
+        callEffects,
+      ).beforeCalls) {
         if (operation.kind !== "call") continue;
         const callee = bindingIdentityKey(operation.callee);
         if (!functions.has(callee)) continue;
@@ -351,7 +275,7 @@ export function resolveTargetSets(
     }
     for (const fn of program.functions) {
       const key = bindingIdentityKey(fn.id);
-      const next = new Set(independent.has(key) ? initializedGlobals : allGlobalAssignments);
+      const next = new Set(independent.has(key) ? independentEntry(key) : allGlobalAssignments);
       for (const caller of incoming.get(key) ?? []) {
         for (const assignment of next) if (!caller.has(assignment)) next.delete(assignment);
       }
@@ -370,13 +294,17 @@ export function resolveTargetSets(
     const fn = functions.get(context.owner);
     const initial =
       fn === undefined
-        ? context.initial
+        ? (startup.initializerEntry.get(context.owner) ?? context.initial)
         : new Set([
             ...entryAssigned.get(context.owner)!,
             ...fn.parameters.map((parameter) => bindingIdentityKey(parameter.id)),
           ]);
-    for (const [operation, paths] of assignmentFacts(context.entry, context.blocks, initial)
-      .unknown) {
+    for (const [operation, paths] of assignmentFacts(
+      context.entry,
+      context.blocks,
+      initial,
+      callEffects,
+    ).unknown) {
       unknownReads.set(operation, paths);
     }
   }
@@ -504,6 +432,26 @@ export function resolveTargetSets(
             "index:*",
           ) || changed;
       }
+      // A partial array initializer leaves the omitted elements with
+      // indeterminate bytes. If a callable leaf can live in an omitted element,
+      // the merged index path has no finite target and stays unknown. Without
+      // this, a supplied element's target would be reused for an uninitialized
+      // sibling because every array index shares the same proof path.
+      if (
+        operation.type.kind === "array" &&
+        operation.fill === null &&
+        operation.elements.length < operation.type.length
+      ) {
+        const callable = callablePaths(operation.type);
+        if (callable.length > 0) {
+          for (const path of callable) {
+            changed =
+              addPathTargets(valuePaths, output, new Map([[path, new Set([UNKNOWN_TARGET])]])) ||
+              changed;
+          }
+          changed = addTargets(valueTargets, output, [UNKNOWN_TARGET]) || changed;
+        }
+      }
       return (
         addTargets(valueTargets, output, [
           ...operation.elements.flatMap(({ value }) => [...targetsOf(owner, value)]),
diff --git a/packages/compiler/src/semantic/assignment-facts.ts b/packages/compiler/src/semantic/assignment-facts.ts
new file mode 100644
index 00000000..3458236c
--- /dev/null
+++ b/packages/compiler/src/semantic/assignment-facts.ts
@@ -0,0 +1,343 @@
+import { bindingIdentityKey } from "../frontend/semantic-types.js";
+import type { SemanticType } from "../frontend/semantic-types.js";
+import type {
+  SemanticBlock,
+  SemanticFunction,
+  SemanticOperation,
+  SemanticPlace,
+  SemanticProgram,
+} from "./operations.js";
+
+/** A dynamic index may select any element; named fields never alias each other. */
+export function placePath(place: SemanticPlace): string {
+  return place.path
+    .map((part) => (part.kind === "field" ? `field:${part.name}` : "index:*"))
+    .join("\0");
+}
+
+/** Attach a child aggregate path without confusing a field with its similarly named sibling. */
+export function joinPath(parent: string, child: string): string {
+  return parent.length === 0 ? child : child.length === 0 ? parent : `${parent}\0${child}`;
+}
+
+/** Enumerate only callable leaves, without allocating a path for every array element. */
+export function callablePaths(type: SemanticType): readonly string[] {
+  if (type.kind === "function" || type.kind === "interrupt-handler") return [""];
+  if (type.kind === "struct") {
+    return type.fields.flatMap((field) =>
+      callablePaths(field.type).map((path) => joinPath(`field:${field.name}`, path)),
+    );
+  }
+  if (type.kind === "array" && type.length > 0) {
+    return callablePaths(type.element).map((path) => joinPath("index:*", path));
+  }
+  return [];
+}
+
+/** Must-assignment facts at each block entry and after its operations. */
+interface AssignmentFlow {
+  /** Keys definitely assigned on entry to each reachable block. */
+  readonly input: ReadonlyMap<string, ReadonlySet<string>>;
+  /** Keys definitely assigned after each reachable block's operations. */
+  readonly output: ReadonlyMap<string, ReadonlySet<string>>;
+}
+
+/** Global keys definitely written by a call, independent of the caller's entry facts. */
+export type CallWriteEffects = ReadonlyMap<string, ReadonlySet<string>>;
+
+/** Ordered startup facts: what is assigned before main and at each initializer entry. */
+export interface StartupAssignmentFacts {
+  /** Keys definitely assigned after every ordered startup initializer completes. */
+  readonly startup: ReadonlySet<string>;
+  /** Keys definitely assigned before each global initializer runs. */
+  readonly initializerEntry: ReadonlyMap<string, ReadonlySet<string>>;
+}
+
+/** Immutable empty fact set shared by every analysis that proves no assignment. */
+const NO_ASSIGNMENTS: ReadonlySet<string> = Object.freeze(new Set<string>());
+
+/** Whole-object writes cover child paths; a field write covers only that field. */
+export function assignmentKey(place: SemanticPlace): string | null {
+  if (place.path.some((part) => part.kind === "index")) return null;
+  return joinPath(bindingIdentityKey(place.root), placePath(place));
+}
+
+/** An assigned ancestor contains every one of its descendants. */
+function isAssigned(assigned: ReadonlySet<string>, root: string, path: string): boolean {
+  if (assigned.has(root)) return true;
+  let prefix = "";
+  for (const part of path.split("\0")) {
+    if (part.length === 0) continue;
+    prefix = joinPath(prefix, part);
+    if (assigned.has(joinPath(root, prefix))) return true;
+  }
+  return false;
+}
+
+/** Add the global keys a directly called function definitely writes on every returning path. */
+function applyCallWrite(
+  assigned: Set<string>,
+  operation: Extract<SemanticOperation, { readonly kind: "call" | "indirect-call" }>,
+  effects: CallWriteEffects,
+): void {
+  // An indirect call contributes no guarantee: its finite target set is proved
+  // separately and may contain functions with different write behavior.
+  if (operation.kind !== "call") return;
+  for (const key of effects.get(bindingIdentityKey(operation.callee)) ?? NO_ASSIGNMENTS)
+    assigned.add(key);
+}
+
+/**
+ * Values whose callable identity is a direct source function address, possibly
+ * selected by a conditional merge. A load, parameter, call result or conversion
+ * carries provenance the summary cannot re-prove, so it is not transferable.
+ */
+export function callableValuePredicate(
+  blocks: readonly SemanticBlock[],
+): (value: string) => boolean {
+  const definitions = new Map<string, SemanticOperation>();
+  for (const block of blocks) {
+    for (const operation of block.operations) {
+      const result = "result" in operation ? operation.result : null;
+      if (result !== null && result !== undefined) definitions.set(result, operation);
+    }
+  }
+  const memo = new Map<string, boolean>();
+  const isCallable = (value: string): boolean => {
+    const known = memo.get(value);
+    if (known !== undefined) return known;
+    const definition = definitions.get(value);
+    let safe = false;
+    if (definition?.kind === "function-address") safe = true;
+    else if (definition?.kind === "merge")
+      safe = definition.incoming.every(({ value: incoming }) => isCallable(incoming));
+    memo.set(value, safe);
+    return safe;
+  };
+  return isCallable;
+}
+
+/** Compute must-assignment facts over one executable control-flow graph. */
+function assignmentFlow(
+  entry: string,
+  blocks: readonly SemanticBlock[],
+  initial: ReadonlySet<string>,
+  callEffects: CallWriteEffects,
+  acceptStore: (value: string) => boolean = () => true,
+): AssignmentFlow {
+  const byId = new Map(blocks.map((block) => [block.id, block] as const));
+  const reachable = new Set<string>();
+  const pending = [entry];
+  while (pending.length > 0) {
+    const id = pending.pop()!;
+    if (reachable.has(id)) continue;
+    const block = byId.get(id);
+    if (block === undefined) throw new Error(`Semantic CFG references missing block '${id}'`);
+    reachable.add(id);
+    if (block.terminator.kind === "jump") pending.push(block.terminator.target);
+    else if (block.terminator.kind === "branch") {
+      pending.push(block.terminator.whenTrue, block.terminator.whenFalse);
+    }
+  }
+  const active = blocks.filter((block) => reachable.has(block.id));
+  const predecessors = new Map(active.map((block) => [block.id, new Set<string>()] as const));
+  const allAssigned = new Set(initial);
+  for (const block of active) {
+    for (const operation of block.operations) {
+      if (operation.kind === "store") {
+        const key = assignmentKey(operation.place);
+        if (key !== null && acceptStore(operation.value)) allAssigned.add(key);
+      } else if (operation.kind === "call") {
+        applyCallWrite(allAssigned, operation, callEffects);
+      }
+    }
+    const successors =
+      block.terminator.kind === "jump"
+        ? [block.terminator.target]
+        : block.terminator.kind === "branch"
+          ? [block.terminator.whenTrue, block.terminator.whenFalse]
+          : [];
+    for (const successor of successors) predecessors.get(successor)?.add(block.id);
+  }
+  const output = new Map(active.map((block) => [block.id, new Set(allAssigned)] as const));
+  const input = new Map<string, Set<string>>();
+  let changed = true;
+  while (changed) {
+    changed = false;
+    for (const block of active) {
+      const before = block.id === entry ? new Set(initial) : new Set(allAssigned);
+      if (block.id !== entry) {
+        for (const predecessor of predecessors.get(block.id) ?? []) {
+          const facts = output.get(predecessor)!;
+          for (const key of before) if (!facts.has(key)) before.delete(key);
+        }
+      }
+      input.set(block.id, before);
+      const after = new Set(before);
+      for (const operation of block.operations) {
+        if (operation.kind === "store") {
+          const key = assignmentKey(operation.place);
+          if (key !== null && acceptStore(operation.value)) after.add(key);
+        } else if (operation.kind === "call") {
+          applyCallWrite(after, operation, callEffects);
+        }
+      }
+      const previous = output.get(block.id)!;
+      if (after.size !== previous.size || [...after].some((key) => !previous.has(key))) {
+        output.set(block.id, after);
+        changed = true;
+      }
+    }
+  }
+  return { input, output };
+}
+
+/** Intersect every returning block's facts into an entry-independent call summary. */
+function definiteExit(flow: AssignmentFlow, blocks: readonly SemanticBlock[]): ReadonlySet<string> {
+  let summary: Set<string> | null = null;
+  for (const block of blocks) {
+    if (block.terminator.kind !== "return") continue;
+    const facts = flow.output.get(block.id);
+    if (facts === undefined) continue;
+    if (summary === null) summary = new Set(facts);
+    else for (const key of [...summary]) if (!facts.has(key)) summary.delete(key);
+  }
+  return summary === null ? NO_ASSIGNMENTS : summary;
+}
+
+/** Must-assignment facts at reads and calls within one executable control-flow graph. */
+export function assignmentFacts(
+  entry: string,
+  blocks: readonly SemanticBlock[],
+  initial: ReadonlySet<string>,
+  callEffects: CallWriteEffects,
+): {
+  readonly unknown: ReadonlyMap<SemanticOperation, readonly string[]>;
+  readonly beforeCalls: ReadonlyMap<SemanticOperation, ReadonlySet<string>>;
+} {
+  const flow = assignmentFlow(entry, blocks, initial, callEffects);
+  const unknown = new Map<SemanticOperation, readonly string[]>();
+  const beforeCalls = new Map<SemanticOperation, ReadonlySet<string>>();
+  for (const block of blocks) {
+    const facts = flow.input.get(block.id);
+    if (facts === undefined) continue;
+    const assigned = new Set(facts);
+    for (const operation of block.operations) {
+      if (operation.kind === "load" || operation.kind === "place-address") {
+        const root = bindingIdentityKey(operation.place.root);
+        const path = placePath(operation.place);
+        const missing = callablePaths(operation.type).filter(
+          (leaf) => !isAssigned(assigned, root, joinPath(path, leaf)),
+        );
+        if (missing.length > 0) unknown.set(operation, missing);
+      } else if (operation.kind === "store") {
+        const key = assignmentKey(operation.place);
+        if (key !== null) assigned.add(key);
+      } else if (operation.kind === "call" || operation.kind === "indirect-call") {
+        beforeCalls.set(operation, new Set(assigned));
+        applyCallWrite(assigned, operation, callEffects);
+      }
+    }
+  }
+  return { unknown, beforeCalls };
+}
+
+/**
+ * Prove the global keys each function definitely writes on every returning path.
+ * A caller may rely on those keys after the call returns. Summaries are
+ * entry-independent, so the analysis starts every body with no assignments and
+ * grows a worklist whenever a directly called function proves a new write. This
+ * transfers a callee's definite writes back into its caller's facts without
+ * assuming any particular call order or single caller.
+ *
+ * Only a whole bare callable global with no taken address and no placement is
+ * transferable. A raw write can replace callable bytes after the typed
+ * assignment, so broader storage keeps its pre-existing conservative proof.
+ */
+export function callWriteSummaries(
+  functions: ReadonlyMap<string, SemanticFunction>,
+  transferableRoots: ReadonlySet<string>,
+): CallWriteEffects {
+  const effects = new Map<string, ReadonlySet<string>>();
+  const callers = new Map<string, Set<string>>();
+  for (const [owner, fn] of functions) {
+    const direct = new Set<string>();
+    for (const block of fn.blocks) {
+      for (const operation of block.operations) {
+        if (operation.kind === "call") direct.add(bindingIdentityKey(operation.callee));
+      }
+    }
+    for (const callee of direct) {
+      const known = callers.get(callee) ?? new Set<string>();
+      known.add(owner);
+      callers.set(callee, known);
+    }
+  }
+  const pending = new Set(functions.keys());
+  while (pending.size > 0) {
+    const owner = pending.values().next().value;
+    if (owner === undefined) break;
+    pending.delete(owner);
+    const fn = functions.get(owner);
+    if (fn === undefined) continue;
+    const flow = assignmentFlow(
+      fn.entry,
+      fn.blocks,
+      NO_ASSIGNMENTS,
+      effects,
+      callableValuePredicate(fn.blocks),
+    );
+    const summary = new Set<string>();
+    for (const key of definiteExit(flow, fn.blocks)) {
+      // A field path belongs to the global binding before its first NUL separator.
+      // Only a whole bare callable global is transferable; a field or element
+      // path keeps its pre-existing conservative proof.
+      if (key.includes("\0") || !transferableRoots.has(key)) continue;
+      summary.add(key);
+    }
+    const previous = effects.get(owner) ?? NO_ASSIGNMENTS;
+    if (summary.size === previous.size && [...summary].every((key) => previous.has(key))) continue;
+    effects.set(owner, summary);
+    for (const caller of callers.get(owner) ?? []) pending.add(caller);
+  }
+  return effects;
+}
+
+/**
+ * Carry definite writes through the ordered startup initializers. Every
+ * initializer runs before main, so an assignment made by a called helper during
+ * startup is visible at main's entry. Later initializers also see the writes of
+ * earlier ones. A non-returning initializer contributes no post-startup fact.
+ *
+ * Newly transferred facts are limited to the same whole bare callable globals
+ * as call summaries. Already-initialized globals keep their pre-existing facts.
+ */
+export function startupAssignmentFacts(
+  program: SemanticProgram,
+  initializedGlobals: ReadonlySet<string>,
+  callEffects: CallWriteEffects,
+  transferableRoots: ReadonlySet<string>,
+): StartupAssignmentFacts {
+  const globals = new Map(
+    program.globals.map((global) => [bindingIdentityKey(global.id), global] as const),
+  );
+  const startup = new Set(initializedGlobals);
+  const initializerEntry = new Map<string, ReadonlySet<string>>();
+  for (const binding of program.initializerOrder) {
+    const owner = bindingIdentityKey(binding);
+    const global = globals.get(owner);
+    if (global === undefined || global.entry === null) continue;
+    initializerEntry.set(owner, new Set(startup));
+    const flow = assignmentFlow(
+      global.entry,
+      global.blocks,
+      startup,
+      callEffects,
+      callableValuePredicate(global.blocks),
+    );
+    for (const key of definiteExit(flow, global.blocks)) {
+      if (!key.includes("\0") && transferableRoots.has(key)) startup.add(key);
+    }
+  }
+  return { startup, initializerEntry };
+}
```

## Test inventory

`test/rd04/partial-array-construction.spec.test.ts` (four profiles each):
local partial, global partial, nested outer partial, fill contrast. Runtime observes only the
supplied element after the native SYS return; omitted bytes are never read or asserted.

`test/rd05/callable-helper-assignment.spec.test.ts` (four profiles each):
direct helper, transitive helper, conditional-assignment rejection, omitted callable element
rejection (`E10277`, no lowering error), fully supplied callable array. Runtime observes the
called function's result after the native SYS return.

`packages/compiler/src/semantic/function-targets.impl.test.ts` adds eighteen fast proof cases:
direct transfer, transitive transfer, post-call write rejection, early-return rejection,
independent-caller intersection, omitted callable element rejection, dynamic-index rejection,
startup-helper transfer, address-taken raw-write rejection, startup addressed raw-write rejection,
direct startup raw-write rejection, placed-address raw-write rejection, computed placed-address
rejection, copied-source rejection, same-helper overwrite rejection, cross-helper overwrite
rejection, startup overwrite rejection, fully supplied acceptance.

`packages/compiler/src/machine/aggregate-partial.impl.test.ts` adds two emitted-form cases:
only supplied element offsets are stored; no zero load or omitted store for one supplied element.
