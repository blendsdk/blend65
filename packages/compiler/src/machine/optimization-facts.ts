import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { EffectSummary } from "../frontend/semantic-types.js";
import type { CheckedSourceInput } from "../services/size-selection.js";
import type { ExecutionDomain } from "../semantic/interrupt-domains.js";
import type { ClosedObjectFacts } from "../semantic/closed-object-facts.js";
import { deriveClosedObjectFacts } from "../semantic/closed-object-facts.js";
import { deriveFixedLoopFacts, fixedLoopValueBounds } from "../semantic/fixed-loop-facts.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import { deriveLocalStorageLifetimes } from "../semantic/local-storage-lifetimes.js";
import { placeUses } from "../semantic/aggregate-place-proof.js";
import type { SemanticPlace, SemanticFunction, SemanticBlock } from "../semantic/operations.js";
import type { ValueLifetime } from "../semantic/whole-program.js";
import { reachableBlocks } from "../semantic/value-lifetimes.js";
import type { TargetProfile } from "../target/profile.js";

/** Immutable facts shared by all rules for one checked candidate. */
export interface OptimizationFacts {
  readonly program: CheckedSourceInput["program"];
  readonly profile: TargetProfile;
  readonly functions: ReadonlyMap<SemanticFunction, OptimizationFunctionFacts>;
  readonly mode: "size" | "balanced" | "speed";
}

/** Per-function facts assembled from existing pure queries only. */
export interface OptimizationFunctionFacts {
  readonly function: SemanticFunction;
  readonly reachableBlocks: readonly SemanticBlock[];
  readonly lifetimes: ReadonlyMap<string, ValueLifetime>;
  readonly places: ReadonlyMap<string, readonly SemanticPlace[]>;
  readonly loops: readonly FixedLoopFacts[];
  readonly objects: ClosedObjectFacts;
  readonly domains: readonly ExecutionDomain[];
  readonly effects: EffectSummary;
}

/** Input to the one shared fact derivation. */
export interface OptimizationFactInput {
  readonly checked: CheckedSourceInput;
  readonly mode: "size" | "balanced" | "speed";
}

/** Return one deterministic place index key for a source operation position. */
function placeKey(block: SemanticBlock, index: number): string {
  return `${block.id}\0${index}`;
}

/** Build the complete immutable fact bundle for one checked source. */
export function deriveOptimizationFacts(input: OptimizationFactInput): OptimizationFacts {
  const program = input.checked.program;
  const profile = input.checked.profile;
  const loops = deriveFixedLoopFacts(program, input.checked.loopNesting);
  const objects = deriveClosedObjectFacts(
    program,
    profile.storage,
    fixedLoopValueBounds(program, loops),
  );
  const lifetimes = deriveLocalStorageLifetimes(program);
  const domains = new Map(
    (program.executionDomains ?? []).map((entry) => [
      bindingIdentityKey(entry.function),
      entry.domains,
    ]),
  );
  const effects = new Map(
    program.effects.map((effect) => [bindingIdentityKey(effect.function), effect]),
  );
  const functions = new Map(
    program.semantic.functions.map((fn) => {
      const blocks = reachableBlocks(fn.entry, fn.blocks);
      const places = new Map<string, readonly SemanticPlace[]>();
      for (const block of blocks)
        for (const [index, operation] of block.operations.entries()) {
          const used = placeUses(operation).map(
            ({ place }: { readonly place: SemanticPlace }) => place,
          );
          if (used.length > 0) places.set(placeKey(block, index), Object.freeze(used));
        }
      const fallback: EffectSummary = Object.freeze({
        function: fn.id,
        reads: Object.freeze([]),
        writes: Object.freeze([]),
        operationEffects: Object.freeze([]),
        opaque: false,
      });
      return [
        fn,
        Object.freeze({
          function: fn,
          reachableBlocks: Object.freeze(blocks),
          lifetimes: new Map([...lifetimes].filter(([, lifetime]) => lifetime.function === fn.id)),
          places,
          loops: Object.freeze(loops.filter((loop) => loop.function === fn)),
          objects,
          domains: domains.get(bindingIdentityKey(fn.id)) ?? Object.freeze([]),
          effects: effects.get(bindingIdentityKey(fn.id)) ?? fallback,
        }),
      ] as const;
    }),
  );
  return Object.freeze({
    program,
    profile,
    functions,
    mode: input.mode,
  });
}
