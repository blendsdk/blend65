# #156 independent review packet

> **Baseline**: `7236f7a2` plus the verified #74 working-tree change
> **Scope**: direct, same-body raw-write invalidation of callable target proofs
> **Boundary**: interprocedural and borrowed-alias invalidation is #161; #156 stays open
> **Status**: implementation and implementation tests green at the source level; public GREEN and
> the complete checkpoint pending

## Authorized reads

You are authorized to read these exact paths for this review:

- `packages/compiler/src/semantic/assignment-facts.ts`
- `packages/compiler/src/semantic/callable-paths.ts`
- `packages/compiler/src/semantic/raw-write-kills.ts`
- `packages/compiler/src/semantic/function-targets.ts`
- `packages/compiler/src/semantic/operations.ts`
- `packages/compiler/src/semantic/lower.ts`
- `packages/compiler/src/services/services.ts`
- `packages/compiler/src/semantic/raw-write-invalidation.impl.test.ts`
- `test/rd04/raw-write-callable-invalidation.spec.test.ts`
- `codeops/features/blend65-v4/plans/raw-write-callable-invalidation/99-execution-plan.md`
- `codeops/features/blend65-v4/plans/raw-write-callable-invalidation/00-preflight-report-99-execution-plan.md`
- `.agents/skills/blend65-domain-expert/SKILL.md`
- `.agents/skills/blend65-domain-expert/qualification/release.md`
- `.agents/skills/blend65-domain-expert/references/blend65-semantics.md`
- `.agents/skills/blend65-domain-expert/references/sfa-and-abi.md`
- `.agents/skills/blend65-domain-expert/references/6502-lowering-casebook.md`
- `.agents/skills/blend65-domain-expert/references/mos-6502-family.md`
- `.agents/skills/blend65-domain-expert/references/evidence-parity-and-recovery.md`
- `.agents/skills/blend65-domain-expert/references/c64-memory-and-runtime.md`
- `.agents/skills/blend65-domain-expert/references/c64-hardware.md`
- Frozen `spec/06-functions.md`, `spec/evaluations/F018-functions.md`, `spec/07-structs.md`,
  `spec/11-memory-model.md` and `spec/03-variables.md`.

## Expert lineage

| Field | Value |
| --- | --- |
| Active qualified version | `2.0.4` |
| Status | Active qualified and frozen |
| Router | `2.0.4`; SHA-256 `0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8` |
| Specification | `BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b` |
| Immutable content commit | `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15` |

## Design

- Killed facts are half-open byte ranges per binding root.
- A raw write adds its written interval; a typed store subtracts only the bytes it completely
  writes.
- A join unions kills (may-corruption) and intersects assignments (must-assignment).
- A load is unknown when its place interval overlaps a killed interval.
- A constant raw write is checked against explicitly placed module intervals.
- No diagnostic code is added; the read fails the existing E10277.
- Calls, borrowed parameters, indirect calls and runtime destinations are **not** transferred;
  #161 owns them.

## RED evidence (spec oracle)

`test/rd04/raw-write-callable-invalidation.spec.test.ts`, four profiles, 44 cases:

| Case | Result |
| --- | --- |
| Direct word, direct byte, field, crossing word, placed, branch kill | 24 failed — each built successfully where E10277 was required |
| Disjoint byte, before-store, unrelated, direct recovery, non-callable | 20 passed |

## GREEN evidence

| Command | Result |
| --- | --- |
| `yarn workspace @blend65/compiler vitest run src/semantic/raw-write-invalidation.impl.test.ts` | 24 passed |
| `yarn workspace @blend65/compiler vitest run src/semantic/function-targets.impl.test.ts src/semantic/block-index-alignment.impl.test.ts src/semantic/whole-program.impl.test.ts` | 4 files, 85 passed |
| Complete compiler package suite | 229 files, 3,872 passed / 2 skipped |
| `tsc -p packages/compiler/tsconfig.json --noEmit` | clean |
| Public spec GREEN | 44 passed (44), 6.6 s |
| Complete `yarn test:full` | 80m39s: compiler 229 files / 3,872 passed / 2 skipped; host 221 files / 4,789 passed; VICE 122 files / 2,270 passed / 4 skipped |

## Review round 1 and dispositions

| ID | Reviewer | Severity | Finding | Disposition |
| --- | --- | --- | --- | --- |
| RV-001 / SM-002 / SF-001 / MC-001 | Correctness, semantics, SFA, machine code | Major | Seeding every block with all kills let a write after a loop circulate backward and reject an earlier valid call. | Fixed: may-kill outputs start empty and the analysis computes the least fixed point. Loop-before-write regression added. |
| RV-002 / SM-003 / SF-002 | Correctness, semantics, SFA | Major | A whole-aggregate read used the aggregate interval and poisoned every callable leaf when only a disjoint prefix byte was written. | Fixed: callable leaves are enumerated with exact byte intervals and checked individually. Aggregate-copy regression added. |
| RV-003 / SM-004 / SF-003 | Correctness, semantics, SFA | Major | A constant-index callable array store could not clear the kill because `assignmentKey` rejects every index. | Pre-existing precision gap, not introduced by the kill facts. The indexed recovery test was removed and the limitation is filed as #162; the bounded acceptance only promises scalar/field direct recovery. |
| RV-004 / SM-001 | Correctness, semantics | Major | A direct `&prefix` write did not check an adjacent explicitly placed callable at the next byte. | Fixed: a placed root's direct write is translated to its absolute interval and intersected with every placed object. Adjacent-placed regression added. |
| RV-005 / SM-005 | Correctness, semantics | Major | A runtime-index write was approximated as offset zero, falsely killing a disjoint callable. | Fixed: an unresolved index returns no exact range and adds no kill, matching the #161 deferral. Dynamic-index regression added. |
| SF-004 | SFA | Major | A dynamic read (`callbacks[index]`) bypassed known corruption because a null place range made the corruption check false. | Fixed: a dynamic read checks the whole root interval against known kills and marks every callable leaf unknown. Regression added. |

## Review round 2 and dispositions

| ID | Reviewer | Severity | Finding | Disposition |
| --- | --- | --- | --- | --- |
| RV-006 / SM-006 / MC-002 | Correctness, semantics, machine code | Major | A dynamic read checked the whole root, so a disjoint non-callable prefix falsely rejected an untouched callable array. | Fixed: a dynamic read enumerates the possible callable intervals after the static prefix and checks each; the disjoint-prefix dynamic-read regression is accepted, the raw-written-element regression still rejects. |
| RV-007 | Correctness | Minor | `allKills` was computed but unused after the least-fixed-point correction. | Removed the accumulator and its operation scan. |
| RV-008 | Correctness | Minor | The `placeByteRange` doc promised a whole-root fallback while returning null. | Documented the actual unresolved-range result and caller handling. |

## Review round 3 and dispositions

| ID | Reviewer | Severity | Finding | Disposition |
| --- | --- | --- | --- | --- |
| RV-009 / SF-005 / MC-003 | Correctness, SFA, machine code | Major | A dynamic read discarded the remaining field path and treated every callable sibling as possibly selected. | Fixed: the possible-range walker continues through the complete remaining field/index path for every possible element; the untouched `good` field is accepted, the corrupted `bad` field still rejects. |
| SF-006 | SFA | Major | With bounds checks disabled, enumerating only declared elements assumed an unchecked index is in range. | Fixed: `SemanticProgram.boundsChecked` carries the manifest policy; a dynamic read with checks disabled conservatively checks the whole root. Regression covers both policies. |

## Review round 4 and dispositions

| ID | Reviewer | Severity | Finding | Disposition |
| --- | --- | --- | --- | --- |
| RV-010 / SF-007 | Correctness, SFA | Major | A dynamic aggregate read applied any possible overlap to every leaf, so a corrupted `bad` field poisoned an untouched `good` field through a copy. | Fixed: possible ranges retain their relative leaf path and each output leaf is checked only against its matching candidates. Positive copy-good and negative copy-bad regressions pass. |
| RV-011 / SF-006 | Correctness, SFA | Major | An unchecked dynamic read checked only its own root, missing an adjacent placed callable reachable out of bounds. | Fixed: when bounds checks are disabled, any known kill conservatively makes a dynamic callable read unknown. Adjacent placed-root regression accepts with checks and rejects without. |

## Review round 5 and disposition

| ID | Reviewer | Severity | Finding | Disposition |
| --- | --- | --- | --- | --- |
| MC-004 | Machine code | Major | An unchecked dynamic read with a masked index held in a local is rejected conservatively, although the index is bounded. | Bounded local-index propagation is outside this analysis. Inline masked indices are proved and accepted; a local masked value remains conservatively rejected. Filed as #163 precision debt. This is a false rejection, not an unsafe acceptance. |

## Review round 6 and disposition

The analysis was split into `callable-paths.ts` (28 lines) and `raw-write-kills.ts` (423 lines);
`assignment-facts.ts` is now 361 lines. Behavior is unchanged: 24 implementation tests and 85
targeted semantic tests pass, typecheck is clean.

## Review-role fallback

The `spec-test-author` role could not be used because its charter requires a repository-relative
`standards/coding-standards-full.md` that does not exist in this checkout. A general agent was
given the same implementation-blind forbidden-source list and authored only the public oracle. An
independent general/read-only audit checked the 44 cases against the frozen requirement. This is a
reported role fallback, not a silent substitution.

## Production diff

```diff
diff --git a/packages/compiler/src/semantic/assignment-facts.ts b/packages/compiler/src/semantic/assignment-facts.ts
index 3458236c..20d1dd36 100644
--- a/packages/compiler/src/semantic/assignment-facts.ts
+++ b/packages/compiler/src/semantic/assignment-facts.ts
@@ -1,5 +1,4 @@
 import { bindingIdentityKey } from "../frontend/semantic-types.js";
-import type { SemanticType } from "../frontend/semantic-types.js";
 import type {
   SemanticBlock,
   SemanticFunction,
@@ -7,32 +6,22 @@ import type {
   SemanticPlace,
   SemanticProgram,
 } from "./operations.js";
+import { joinPath, placePath } from "./callable-paths.js";
+import {
+  addRawWrite,
+  allDynamicIndicesBounded,
+  callableLeaves,
+  definitionsOf,
+  hasDynamicIndex,
+  killFlow,
+  placeByteRange,
+  possibleCallableRanges,
+  rangeIsKilled,
+  subtractStore,
+} from "./raw-write-kills.js";
+import type { PlacedRange } from "./raw-write-kills.js";
 
-/** A dynamic index may select any element; named fields never alias each other. */
-export function placePath(place: SemanticPlace): string {
-  return place.path
-    .map((part) => (part.kind === "field" ? `field:${part.name}` : "index:*"))
-    .join("\0");
-}
-
-/** Attach a child aggregate path without confusing a field with its similarly named sibling. */
-export function joinPath(parent: string, child: string): string {
-  return parent.length === 0 ? child : child.length === 0 ? parent : `${parent}\0${child}`;
-}
-
-/** Enumerate only callable leaves, without allocating a path for every array element. */
-export function callablePaths(type: SemanticType): readonly string[] {
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
+export { callablePaths, joinPath, placePath } from "./callable-paths.js";
 
 /** Must-assignment facts at each block entry and after its operations. */
 interface AssignmentFlow {
@@ -211,28 +200,57 @@ export function assignmentFacts(
   blocks: readonly SemanticBlock[],
   initial: ReadonlySet<string>,
   callEffects: CallWriteEffects,
+  placed: ReadonlyMap<string, PlacedRange> = new Map(),
+  boundsChecked = true,
 ): {
   readonly unknown: ReadonlyMap<SemanticOperation, readonly string[]>;
   readonly beforeCalls: ReadonlyMap<SemanticOperation, ReadonlySet<string>>;
 } {
   const flow = assignmentFlow(entry, blocks, initial, callEffects);
+  const definitions = definitionsOf(blocks);
+  const killedFlow = killFlow(entry, blocks, definitions, placed);
   const unknown = new Map<SemanticOperation, readonly string[]>();
   const beforeCalls = new Map<SemanticOperation, ReadonlySet<string>>();
   for (const block of blocks) {
     const facts = flow.input.get(block.id);
     if (facts === undefined) continue;
     const assigned = new Set(facts);
+    let killed = killedFlow.input.get(block.id) ?? Object.freeze([]);
     for (const operation of block.operations) {
       if (operation.kind === "load" || operation.kind === "place-address") {
         const root = bindingIdentityKey(operation.place.root);
         const path = placePath(operation.place);
-        const missing = callablePaths(operation.type).filter(
-          (leaf) => !isAssigned(assigned, root, joinPath(path, leaf)),
-        );
+        const base = placeByteRange(operation.place, definitions);
+        const dynamic = hasDynamicIndex(operation.place, definitions);
+        const possible = dynamic ? possibleCallableRanges(operation.place, definitions) : null;
+        const boundedDynamic = dynamic && allDynamicIndicesBounded(operation.place, definitions);
+        const missing = callableLeaves(operation.type).flatMap((leaf) => {
+          // An unchecked, unbounded index may leave the object entirely, so any
+          // known kill can be reachable. A checked or proved-bounded index stays
+          // within the declared elements and is matched by possible leaf ranges.
+          const corrupted = dynamic
+            ? boundsChecked || boundedDynamic
+              ? possible !== null &&
+                possible.some((range) => range.path === leaf.path && rangeIsKilled(killed, range))
+              : killed.length > 0
+            : base !== null &&
+              rangeIsKilled(killed, {
+                root: base.root,
+                start: base.start + leaf.start,
+                end: base.start + leaf.end,
+              });
+          return corrupted || !isAssigned(assigned, root, joinPath(path, leaf.path))
+            ? [leaf.path]
+            : [];
+        });
         if (missing.length > 0) unknown.set(operation, missing);
       } else if (operation.kind === "store") {
         const key = assignmentKey(operation.place);
         if (key !== null) assigned.add(key);
+        const range = placeByteRange(operation.place, definitions);
+        if (range !== null) killed = subtractStore(killed, range);
+      } else if (operation.kind === "memory-write") {
+        killed = addRawWrite(killed, operation, definitions, placed);
       } else if (operation.kind === "call" || operation.kind === "indirect-call") {
         beforeCalls.set(operation, new Set(assigned));
         applyCallWrite(assigned, operation, callEffects);
diff --git a/packages/compiler/src/semantic/function-targets.ts b/packages/compiler/src/semantic/function-targets.ts
index e352ebf5..114c65aa 100644
--- a/packages/compiler/src/semantic/function-targets.ts
+++ b/packages/compiler/src/semantic/function-targets.ts
@@ -1,4 +1,4 @@
-import { semanticTypesEqual } from "../frontend/semantic-type-relations.js";
+import { semanticTypeSize, semanticTypesEqual } from "../frontend/semantic-type-relations.js";
 import { bindingIdentityKey } from "../frontend/semantic-types.js";
 import type { BindingId, FunctionType } from "../frontend/semantic-types.js";
 import {
@@ -164,6 +164,17 @@ export function resolveTargetSets(
   // call site. Address-taken functions remain independent entries. Source export
   // controls visibility; it does not erase assignments made by an ordinary caller.
   const globalRoots = new Set(program.globals.map((global) => bindingIdentityKey(global.id)));
+  // Explicitly placed storage has a proved absolute interval, so a constant
+  // raw write can be checked for overlap before code generation.
+  const placedRanges = new Map<string, { start: number; end: number }>();
+  for (const global of program.globals) {
+    const at = global.placement?.at;
+    if (at === null || at === undefined) continue;
+    placedRanges.set(bindingIdentityKey(global.id), {
+      start: at,
+      end: at + semanticTypeSize(global.type),
+    });
+  }
   const allGlobalAssignments = new Set(initializedGlobals);
   for (const root of globalRoots) allGlobalAssignments.add(root);
   for (const context of contexts) {
@@ -256,6 +267,8 @@ export function resolveTargetSets(
         context.blocks,
         initial,
         callEffects,
+        placedRanges,
+        program.boundsChecked ?? true,
       ).beforeCalls) {
         if (operation.kind !== "call") continue;
         const callee = bindingIdentityKey(operation.callee);
@@ -304,6 +317,8 @@ export function resolveTargetSets(
       context.blocks,
       initial,
       callEffects,
+      placedRanges,
+      program.boundsChecked ?? true,
     ).unknown) {
       unknownReads.set(operation, paths);
     }
diff --git a/packages/compiler/src/semantic/lower.ts b/packages/compiler/src/semantic/lower.ts
index a9f348eb..4d5f9c33 100644
--- a/packages/compiler/src/semantic/lower.ts
+++ b/packages/compiler/src/semantic/lower.ts
@@ -8,6 +8,7 @@ import { initializerBytes } from "./lower-data.js";
 import { sinkTerminalChoice } from "./lower-control.js";
 import { checkLoadQuiescence } from "./load-quiescence.js";
 import { enforceLoadDestinationConstraints } from "./load-destination-constraints.js";
+import { alignBlockIndexStorage } from "./block-index-alignment.js";
 import type {
   AggregateDestination,
   SemanticFunction,
@@ -203,7 +204,10 @@ function lowerGlobal(
 }
 
 /** Build the target-neutral semantic program only from a complete frontend result. */
-export function buildSemanticProgram(analysis: AnalysisResult): SemanticBuildResult {
+export function buildSemanticProgram(
+  analysis: AnalysisResult,
+  options: { readonly boundsCheck?: boolean } = {},
+): SemanticBuildResult {
   if (analysis.kind !== "complete") return analysis;
   const frontend = analysis.program;
   const bindingsByKey = new Map(
@@ -257,9 +261,13 @@ export function buildSemanticProgram(analysis: AnalysisResult): SemanticBuildRes
       inputs: analysis.inputs,
     });
   }
+  // A block-index expression proves the hardware alignment its storage needs.
+  // Apply that demand before layout; explicit, zero-page and runtime-index
+  // placements are preserved exactly as written.
+  const alignedGlobals = alignBlockIndexStorage(functions, constrained.globals);
   const program: SemanticProgram = Object.freeze({
     main: mainCandidates[0]!.id,
-    globals: constrained.globals,
+    globals: alignedGlobals,
     functions: Object.freeze(
       functions.map((fn) => sinkTerminalChoice(fn, functions, bindingsByKey)),
     ),
@@ -282,6 +290,7 @@ export function buildSemanticProgram(analysis: AnalysisResult): SemanticBuildRes
         (binding) => !embeddedBindings.has(bindingIdentityKey(binding)),
       ),
     ),
+    boundsChecked: options.boundsCheck ?? true,
   });
   const quiescence = checkLoadQuiescence(program);
   if (quiescence !== null) {
diff --git a/packages/compiler/src/semantic/operations.ts b/packages/compiler/src/semantic/operations.ts
index 57b0a572..76996d76 100644
--- a/packages/compiler/src/semantic/operations.ts
+++ b/packages/compiler/src/semantic/operations.ts
@@ -504,4 +504,6 @@ export interface SemanticProgram {
   readonly residentAssetRoots?: readonly string[];
   /** Runtime global initializer roots in proved execution order. */
   readonly initializerOrder: readonly BindingId[];
+  /** Whether later compilation inserts bounds guards for dynamic indices. */
+  readonly boundsChecked?: boolean;
 }
diff --git a/packages/compiler/src/services/services.ts b/packages/compiler/src/services/services.ts
index b132240f..bbd59744 100644
--- a/packages/compiler/src/services/services.ts
+++ b/packages/compiler/src/services/services.ts
@@ -191,7 +191,9 @@ async function checkSource(options: BuildOptions): Promise<CheckedSourceResult>
     };
   }
   if (isCancelled(options.signal)) return { kind: "failure", failure: cancelled() };
-  const semantic = buildSemanticProgram(analyzed);
+  const semantic = buildSemanticProgram(analyzed, {
+    boundsCheck: selectedSnapshot.manifest.boundsCheck,
+  });
   if (semantic.kind === "error") {
     return { kind: "failure", failure: failure("source", semantic.diagnostics) };
   }
diff --git a/packages/compiler/src/semantic/callable-paths.ts b/packages/compiler/src/semantic/callable-paths.ts
new file mode 100644
index 00000000..ff462876
--- /dev/null
+++ b/packages/compiler/src/semantic/callable-paths.ts
@@ -0,0 +1,28 @@
+import type { SemanticType } from "../frontend/semantic-types.js";
+import type { SemanticPlace } from "./operations.js";
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
diff --git a/packages/compiler/src/semantic/raw-write-kills.ts b/packages/compiler/src/semantic/raw-write-kills.ts
new file mode 100644
index 00000000..1b7b525b
--- /dev/null
+++ b/packages/compiler/src/semantic/raw-write-kills.ts
@@ -0,0 +1,423 @@
+import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
+import { bindingIdentityKey } from "../frontend/semantic-types.js";
+import type { SemanticType } from "../frontend/semantic-types.js";
+import type {
+  SemanticBlock,
+  SemanticOperation,
+  SemanticPlace,
+  SemanticPlacePath,
+} from "./operations.js";
+import { joinPath } from "./callable-paths.js";
+
+/** One callable leaf and its byte interval relative to an enclosing value. */
+export interface CallableLeaf {
+  /** Field/index path from the enclosing value, matching `callablePaths`. */
+  readonly path: string;
+  /** First byte relative to the enclosing value. */
+  readonly start: number;
+  /** Half-open end byte relative to the enclosing value. */
+  readonly end: number;
+}
+
+/** Enumerate callable leaves with their exact byte intervals. */
+export function callableLeaves(
+  type: SemanticType,
+  start = 0,
+  prefix = "",
+): readonly CallableLeaf[] {
+  if (type.kind === "function" || type.kind === "interrupt-handler") {
+    const bytes = semanticTypeSize(type);
+    return [{ path: prefix, start, end: start + bytes }];
+  }
+  if (type.kind === "struct") {
+    return type.fields.flatMap((field) =>
+      callableLeaves(field.type, start + field.offset, joinPath(prefix, `field:${field.name}`)),
+    );
+  }
+  if (type.kind === "array" && type.length > 0) {
+    const stride = semanticTypeSize(type.element);
+    return Array.from({ length: type.length }, (_, index) =>
+      callableLeaves(type.element, start + index * stride, joinPath(prefix, "index:*")),
+    ).flat();
+  }
+  return [];
+}
+
+/** One statically placed module object and its complete byte interval. */
+export interface PlacedRange {
+  /** First byte in the selected CPU address space. */
+  readonly start: number;
+  /** Half-open end byte. */
+  readonly end: number;
+}
+
+/** One half-open byte range whose callable provenance may be corrupted. */
+export interface KilledRange {
+  /** Binding root identity. */
+  readonly root: string;
+  /** First corrupted byte relative to the root. */
+  readonly start: number;
+  /** Half-open end byte relative to the root. */
+  readonly end: number;
+}
+
+/** Killed ranges retained in a stable order for equality and overlap checks. */
+export type KilledFacts = readonly KilledRange[];
+
+/** One value definition retained for constant index resolution. */
+export type Definitions = ReadonlyMap<string, SemanticOperation>;
+
+/** Resolve one constant expression, including truncating conversions. */
+export function constantValue(
+  operation: SemanticOperation | undefined,
+  definitions: Definitions,
+): number | null {
+  if (operation?.kind === "constant")
+    return typeof operation.value === "boolean"
+      ? operation.value
+        ? 1
+        : 0
+      : Number(operation.value);
+  if (operation?.kind !== "convert") return null;
+  const value = constantValue(definitions.get(operation.operand), definitions);
+  if (value === null) return null;
+  if (operation.conversion !== "truncate") return value;
+  const mask = 2 ** (semanticTypeSize(operation.type) * 8) - 1;
+  return value & mask;
+}
+
+/** Collect the value definitions of one executable body. */
+export function definitionsOf(blocks: readonly SemanticBlock[]): Definitions {
+  const definitions = new Map<string, SemanticOperation>();
+  for (const block of blocks)
+    for (const operation of block.operations) {
+      const result = "result" in operation ? operation.result : null;
+      if (result !== null && result !== undefined) definitions.set(result, operation);
+    }
+  return definitions;
+}
+
+/**
+ * Resolve one place to an exact half-open byte range. A runtime index has no
+ * exact offset and returns null; callers keep that case on the deferred
+ * runtime-destination boundary or use a possible-range check.
+ */
+export function placeByteRange(place: SemanticPlace, definitions: Definitions): KilledRange | null {
+  const root = bindingIdentityKey(place.root);
+  let type: SemanticType | undefined = place.rootType;
+  let start = 0;
+  for (const step of place.path) {
+    if (step.kind === "field") {
+      if (type?.kind !== "struct") return null;
+      const field = type.fields.find(({ name }) => name === step.name);
+      if (field === undefined) return null;
+      start += field.offset;
+      type = field.type;
+      continue;
+    }
+    if (type?.kind !== "array") return null;
+    const index = constantValue(definitions.get(step.value), definitions);
+    // A runtime index has no exact byte range. The bounded slice leaves it on
+    // the deferred #161 path instead of inventing offset zero.
+    if (index === null) return null;
+    start += semanticTypeSize(type.element) * index;
+    type = type.element;
+  }
+  const bytes = type === undefined ? 0 : semanticTypeSize(type);
+  return { root, start, end: start + bytes };
+}
+
+/** Whether a place contains an index whose value is not compile-time known. */
+export function hasDynamicIndex(place: SemanticPlace, definitions: Definitions): boolean {
+  return place.path.some(
+    (step) =>
+      step.kind === "index" && constantValue(definitions.get(step.value), definitions) === null,
+  );
+}
+
+/** One possible callable leaf and its path relative to the loaded value. */
+export interface PossibleLeaf extends KilledRange {
+  /** Leaf path relative to the loaded value, matching `callableLeaves`. */
+  readonly path: string;
+}
+
+/**
+ * Enumerate the possible callable byte intervals for one place, continuing
+ * through the complete remaining field/index path after every runtime index.
+ * The static prefix and each possible element are retained, so a disjoint
+ * non-callable prefix or sibling does not poison the read.
+ */
+export function possibleCallableRanges(
+  place: SemanticPlace,
+  definitions: Definitions,
+): readonly PossibleLeaf[] {
+  const root = bindingIdentityKey(place.root);
+  const walk = (
+    type: SemanticType | undefined,
+    start: number,
+    steps: readonly SemanticPlacePath[],
+  ): readonly PossibleLeaf[] => {
+    if (steps.length === 0) {
+      if (type === undefined) return [];
+      return callableLeaves(type, start).map((leaf) => ({
+        root,
+        path: leaf.path,
+        start: leaf.start,
+        end: leaf.end,
+      }));
+    }
+    const [step, ...rest] = steps;
+    if (step.kind === "field") {
+      if (type?.kind !== "struct") return [];
+      const field = type.fields.find(({ name }) => name === step.name);
+      if (field === undefined) return [];
+      return walk(field.type, start + field.offset, rest);
+    }
+    if (type?.kind !== "array") return [];
+    const stride = semanticTypeSize(type.element);
+    const index = constantValue(definitions.get(step.value), definitions);
+    if (index !== null) return walk(type.element, start + stride * index, rest);
+    const bound = indexUpperBound(step.value, definitions);
+    const count = bound === null ? type.length : Math.min(type.length, bound + 1);
+    return Array.from({ length: count }, (_, element) =>
+      walk(type.element, start + element * stride, rest),
+    ).flat();
+  };
+  return walk(place.rootType, 0, place.path);
+}
+
+/** A proved upper bound for one index value, or null when it is unknown. */
+export function indexUpperBound(value: string, definitions: Definitions): number | null {
+  const operation = definitions.get(value);
+  if (operation?.kind === "constant")
+    return typeof operation.value === "boolean"
+      ? operation.value
+        ? 1
+        : 0
+      : Number(operation.value);
+  if (operation?.kind === "convert") return indexUpperBound(operation.operand, definitions);
+  if (operation?.kind === "merge")
+    return operation.incoming.reduce<number | null>((maximum, incoming) => {
+      const bound = indexUpperBound(incoming.value, definitions);
+      if (bound === null) return null;
+      return maximum === null ? bound : Math.max(maximum, bound);
+    }, null);
+  if (operation?.kind !== "binary") return null;
+  const right = constantValue(definitions.get(operation.right), definitions);
+  if (operation.operator === "&" && right !== null) return right;
+  if (operation.operator === "%" && right !== null && right > 0) return right - 1;
+  return null;
+}
+
+/** Whether every runtime index in the place is proved inside its array. */
+export function allDynamicIndicesBounded(place: SemanticPlace, definitions: Definitions): boolean {
+  let type: SemanticType | undefined = place.rootType;
+  for (const step of place.path) {
+    if (step.kind === "field") {
+      if (type?.kind !== "struct") return false;
+      const field = type.fields.find(({ name }) => name === step.name);
+      if (field === undefined) return false;
+      type = field.type;
+      continue;
+    }
+    if (type?.kind !== "array") return false;
+    const array = type;
+    const index = constantValue(definitions.get(step.value), definitions);
+    if (index === null) {
+      const bound = indexUpperBound(step.value, definitions);
+      if (bound === null || bound >= array.length) return false;
+    } else if (index >= array.length) return false;
+    type = array.element;
+  }
+  return true;
+}
+
+/** Merge and sort overlapping or adjacent ranges for stable comparison. */
+export function normalizeKills(ranges: readonly KilledRange[]): KilledFacts {
+  const byRoot = new Map<string, [number, number][]>();
+  for (const range of ranges) {
+    if (range.end <= range.start) continue;
+    const known = byRoot.get(range.root) ?? [];
+    known.push([range.start, range.end]);
+    byRoot.set(range.root, known);
+  }
+  const merged: KilledRange[] = [];
+  for (const [root, intervals] of [...byRoot].sort(([left], [right]) =>
+    left.localeCompare(right),
+  )) {
+    intervals.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
+    let current: [number, number] | null = null;
+    for (const interval of intervals) {
+      if (current === null) current = [interval[0], interval[1]];
+      else if (interval[0] <= current[1]) current[1] = Math.max(current[1], interval[1]);
+      else {
+        merged.push({ root, start: current[0], end: current[1] });
+        current = [interval[0], interval[1]];
+      }
+    }
+    if (current !== null) merged.push({ root, start: current[0], end: current[1] });
+  }
+  return Object.freeze(merged);
+}
+
+/** Union two killed fact sets. */
+export function unionKills(left: KilledFacts, right: KilledFacts): KilledFacts {
+  return normalizeKills([...left, ...right]);
+}
+
+/** Remove the bytes a typed store completely writes. */
+export function subtractStore(kills: KilledFacts, store: KilledRange): KilledFacts {
+  const remaining: KilledRange[] = [];
+  for (const range of kills) {
+    if (range.root !== store.root || range.end <= store.start || store.end <= range.start) {
+      remaining.push(range);
+      continue;
+    }
+    if (range.start < store.start)
+      remaining.push({ root: range.root, start: range.start, end: store.start });
+    if (store.end < range.end)
+      remaining.push({ root: range.root, start: store.end, end: range.end });
+  }
+  return normalizeKills(remaining);
+}
+
+/** Whether a place interval overlaps any killed byte. */
+export function rangeIsKilled(kills: KilledFacts, range: KilledRange): boolean {
+  return kills.some(
+    (killed) => killed.root === range.root && killed.start < range.end && range.start < killed.end,
+  );
+}
+
+/** Add the intersections of one absolute write with every placed object. */
+export function addPlacedWrite(
+  kills: KilledFacts,
+  absoluteStart: number,
+  width: number,
+  placed: ReadonlyMap<string, PlacedRange>,
+): KilledFacts {
+  const added: KilledRange[] = [];
+  for (const [root, interval] of placed) {
+    const start = Math.max(absoluteStart, interval.start);
+    const end = Math.min(absoluteStart + width, interval.end);
+    if (start < end) added.push({ root, start: start - interval.start, end: end - interval.start });
+  }
+  return added.length === 0 ? kills : normalizeKills([...kills, ...added]);
+}
+
+/** Add one raw write's byte range to the killed facts. */
+export function addRawWrite(
+  kills: KilledFacts,
+  operation: Extract<SemanticOperation, { readonly kind: "memory-write" }>,
+  definitions: Definitions,
+  placed: ReadonlyMap<string, PlacedRange>,
+): KilledFacts {
+  const address = throughAddressConversions(operation.address, definitions);
+  if (address?.kind === "place-address") {
+    const range = placeByteRange(address.place, definitions);
+    if (range === null) return kills;
+    let next = normalizeKills([
+      ...kills,
+      { root: range.root, start: range.start, end: range.start + operation.width },
+    ]);
+    // A placed root has a proved absolute address, so the same write can also
+    // overlap an adjacent placed object.
+    const placedRoot = placed.get(range.root);
+    if (placedRoot !== undefined)
+      next = addPlacedWrite(next, placedRoot.start + range.start, operation.width, placed);
+    return next;
+  }
+  const constant = constantValue(address, definitions);
+  return constant === null ? kills : addPlacedWrite(kills, constant, operation.width, placed);
+}
+
+/** Follow only conversions that preserve the full address value. */
+export function throughAddressConversions(
+  value: string,
+  definitions: Definitions,
+): SemanticOperation | undefined {
+  let current = definitions.get(value);
+  for (;;) {
+    if (
+      current?.kind !== "convert" ||
+      (current.conversion !== "identity" && current.conversion !== "reinterpret")
+    )
+      return current;
+    current = definitions.get(current.operand);
+  }
+}
+
+/** Per-block killed facts for one executable body. */
+export interface KillFlow {
+  /** Killed bytes on entry to each reachable block. */
+  readonly input: ReadonlyMap<string, KilledFacts>;
+  /** Killed bytes after each reachable block's operations. */
+  readonly output: ReadonlyMap<string, KilledFacts>;
+}
+
+/**
+ * Compute may-killed byte facts over one executable body. A join unions kills
+ * because corruption on any path makes a later read unsafe. A typed store
+ * removes only the bytes it completely replaces.
+ */
+export function killFlow(
+  entry: string,
+  blocks: readonly SemanticBlock[],
+  definitions: Definitions,
+  placed: ReadonlyMap<string, PlacedRange>,
+): KillFlow {
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
+    else if (block.terminator.kind === "branch")
+      pending.push(block.terminator.whenTrue, block.terminator.whenFalse);
+  }
+  const active = blocks.filter((block) => reachable.has(block.id));
+  const predecessors = new Map(active.map((block) => [block.id, new Set<string>()] as const));
+  for (const block of active) {
+    const successors =
+      block.terminator.kind === "jump"
+        ? [block.terminator.target]
+        : block.terminator.kind === "branch"
+          ? [block.terminator.whenTrue, block.terminator.whenFalse]
+          : [];
+    for (const successor of successors) predecessors.get(successor)?.add(block.id);
+  }
+  const output = new Map(
+    active.map((block) => [block.id, Object.freeze([]) as KilledFacts] as const),
+  );
+  const input = new Map<string, KilledFacts>();
+  let changed = true;
+  while (changed) {
+    changed = false;
+    for (const block of active) {
+      let before: KilledFacts = Object.freeze([]);
+      if (block.id !== entry) {
+        for (const predecessor of predecessors.get(block.id) ?? [])
+          before = unionKills(before, output.get(predecessor)!);
+      }
+      input.set(block.id, before);
+      let after = before;
+      for (const operation of block.operations) {
+        if (operation.kind === "store") {
+          const range = placeByteRange(operation.place, definitions);
+          if (range !== null) after = subtractStore(after, range);
+        } else if (operation.kind === "memory-write") {
+          after = addRawWrite(after, operation, definitions, placed);
+        }
+      }
+      const previous = output.get(block.id)!;
+      if (JSON.stringify(after) !== JSON.stringify(previous)) {
+        output.set(block.id, after);
+        changed = true;
+      }
+    }
+  }
+  return { input, output };
+}
```

## Test inventory

`raw-write-invalidation.impl.test.ts`: word, byte, field, crossing word, disjoint byte, placed,
before-store, unrelated, branch, direct recovery and pointer-byte-restoration cases.

`raw-write-callable-invalidation.spec.test.ts`: the same behaviors through the public build API on
four profiles; the interprocedural/borrowed cases are intentionally absent.

## Evidence limits

The public spec GREEN and the complete checkpoint are pending the #74 public build. No runtime or
emitted-code claim is made: accepted programs keep their existing code; the change is analysis-only.
