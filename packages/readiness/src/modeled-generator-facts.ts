import type { GenerationSpelling } from "./canonical-identity.js";
import type { ScalarType } from "./generator-ir.js";
import type {
  MemoryCaseChoice,
  ModeledCaseChoice,
  ScalarCaseChoice,
} from "./modeled-generator-model.js";

/** Closed source spellings used by reviewed modeled constructors. */
export const MODELED_SPELLINGS: readonly GenerationSpelling[] = Object.freeze([
  "const",
  "literal",
  "local",
  "parameter",
]);

/** Reviewed scalar rule information needed by construction and evaluation. */
export interface ScalarRuleFact {
  readonly kind: "scalar";
  readonly ruleId: string;
  readonly handlerId: "generator.frontend-cases";
  readonly scalarType: ScalarType;
  readonly values: readonly (bigint | boolean)[];
  readonly predicateId: string;
  readonly neighborIds: readonly string[];
}

/** Reviewed volatile-memory rule information needed by construction and evaluation. */
export interface MemoryRuleFact {
  readonly kind: "memory";
  readonly ruleId: string;
  readonly handlerId: "generator.runtime-cases";
  readonly intrinsic: "peek" | "peekw" | "poke" | "pokew";
  readonly parameterTypes: readonly ["word"] | readonly ["word", "byte" | "word"];
  readonly returnType: "byte" | "word" | "void";
  readonly predicateId: string;
  readonly neighborIds: readonly string[];
}

/** Closed union of the nine independently reviewed rule facts. */
export type ModeledRuleFact = ScalarRuleFact | MemoryRuleFact;

const SCALAR_FACTS: readonly ScalarRuleFact[] = Object.freeze([
  Object.freeze({
    kind: "scalar",
    ruleId: "rule.ch02.2-primitive-types.boolean.range.true",
    handlerId: "generator.frontend-cases",
    scalarType: "boolean",
    values: Object.freeze([false, true]),
    predicateId: "predicate.scalar.boolean.domain",
    neighborIds: Object.freeze(["neighbor.scalar.boolean.wrong-type"]),
  }),
  Object.freeze({
    kind: "scalar",
    ruleId: "rule.ch02.2-primitive-types.byte.range.0-255",
    handlerId: "generator.frontend-cases",
    scalarType: "byte",
    values: Object.freeze([0n, 255n]),
    predicateId: "predicate.scalar.byte.range",
    neighborIds: Object.freeze([
      "neighbor.scalar.byte.above-max",
      "neighbor.scalar.byte.below-min",
    ]),
  }),
  Object.freeze({
    kind: "scalar",
    ruleId: "rule.ch02.2-primitive-types.sbyte.range.128-127",
    handlerId: "generator.frontend-cases",
    scalarType: "sbyte",
    values: Object.freeze([-128n, 127n]),
    predicateId: "predicate.scalar.sbyte.range",
    neighborIds: Object.freeze([
      "neighbor.scalar.sbyte.above-max",
      "neighbor.scalar.sbyte.below-min",
    ]),
  }),
  Object.freeze({
    kind: "scalar",
    ruleId: "rule.ch02.2-primitive-types.sword.range.32768-32767",
    handlerId: "generator.frontend-cases",
    scalarType: "sword",
    values: Object.freeze([-32768n, 32767n]),
    predicateId: "predicate.scalar.sword.range",
    neighborIds: Object.freeze([
      "neighbor.scalar.sword.above-max",
      "neighbor.scalar.sword.below-min",
    ]),
  }),
  Object.freeze({
    kind: "scalar",
    ruleId: "rule.ch02.2-primitive-types.word.range.0-65535",
    handlerId: "generator.frontend-cases",
    scalarType: "word",
    values: Object.freeze([0n, 65535n]),
    predicateId: "predicate.scalar.word.range",
    neighborIds: Object.freeze([
      "neighbor.scalar.word.above-max",
      "neighbor.scalar.word.below-min",
    ]),
  }),
]);

const MEMORY_FACTS: readonly MemoryRuleFact[] = Object.freeze([
  Object.freeze({
    kind: "memory",
    ruleId: "rule.ch12.3-1-memory-access.peek-addr.signature.word",
    handlerId: "generator.runtime-cases",
    intrinsic: "peek",
    parameterTypes: ["word"] as const,
    returnType: "byte",
    predicateId: "predicate.memory.peek.signature",
    neighborIds: Object.freeze([
      "neighbor.memory.peek.wrong-address-type",
      "neighbor.memory.peek.wrong-arity",
    ]),
  }),
  Object.freeze({
    kind: "memory",
    ruleId: "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
    handlerId: "generator.runtime-cases",
    intrinsic: "peekw",
    parameterTypes: ["word"] as const,
    returnType: "word",
    predicateId: "predicate.memory.peekw.signature",
    neighborIds: Object.freeze([
      "neighbor.memory.peekw.wrong-address-type",
      "neighbor.memory.peekw.wrong-arity",
    ]),
  }),
  Object.freeze({
    kind: "memory",
    ruleId: "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
    handlerId: "generator.runtime-cases",
    intrinsic: "poke",
    parameterTypes: ["word", "byte"] as const,
    returnType: "void",
    predicateId: "predicate.memory.poke.signature",
    neighborIds: Object.freeze([
      "neighbor.memory.poke.wrong-address-type",
      "neighbor.memory.poke.wrong-arity",
      "neighbor.memory.poke.wrong-value-type",
    ]),
  }),
  Object.freeze({
    kind: "memory",
    ruleId: "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
    handlerId: "generator.runtime-cases",
    intrinsic: "pokew",
    parameterTypes: ["word", "word"] as const,
    returnType: "void",
    predicateId: "predicate.memory.pokew.signature",
    neighborIds: Object.freeze([
      "neighbor.memory.pokew.wrong-address-type",
      "neighbor.memory.pokew.wrong-arity",
      "neighbor.memory.pokew.wrong-value-type",
    ]),
  }),
]);

/** Lexically indexed facts for the exact reviewed nine-rule seed. */
export const MODELED_RULE_FACTS: ReadonlyMap<string, ModeledRuleFact> = new Map(
  [...SCALAR_FACTS, ...MEMORY_FACTS].map((fact) => [fact.ruleId, fact]),
);

const MODELED_CHOICE_CACHE = new WeakMap<ModeledRuleFact, readonly ModeledCaseChoice[]>();
const MODELED_CHOICE_KEY_CACHE = new WeakMap<ModeledRuleFact, ReadonlySet<string>>();

function choiceKey(choice: ModeledCaseChoice): string {
  if (choice.kind === "scalar") {
    return [
      choice.kind,
      choice.ruleId,
      choice.spelling,
      typeof choice.value === "bigint" ? choice.value.toString() : String(choice.value),
    ].join("|");
  }
  return [
    choice.kind,
    choice.ruleId,
    choice.addressSpelling,
    choice.addressForm,
    choice.valueSpelling ?? "",
  ].join("|");
}

/** Expands the complete immutable construction domain for one reviewed rule. */
export function createModeledChoices(fact: ModeledRuleFact): readonly ModeledCaseChoice[] {
  const cached = MODELED_CHOICE_CACHE.get(fact);
  if (cached !== undefined) return cached;
  const choices: ModeledCaseChoice[] =
    fact.kind === "scalar"
      ? fact.values.flatMap((value) =>
          MODELED_SPELLINGS.map(
            (spelling): ScalarCaseChoice =>
              Object.freeze({
                kind: "scalar",
                ruleId: fact.ruleId,
                spelling,
                value,
              }),
          ),
        )
      : MODELED_SPELLINGS.flatMap((addressSpelling) =>
          (["direct", "computed"] as const).flatMap((addressForm) => {
            const valueSpellings: readonly (GenerationSpelling | undefined)[] =
              fact.parameterTypes.length === 1 ? [undefined] : MODELED_SPELLINGS;
            return valueSpellings.map(
              (valueSpelling): MemoryCaseChoice =>
                Object.freeze({
                  kind: "memory",
                  ruleId: fact.ruleId,
                  addressSpelling,
                  addressForm,
                  ...(valueSpelling === undefined ? {} : { valueSpelling }),
                }),
            );
          }),
        );
  const closed = Object.freeze(
    [...choices].sort((left, right) => choiceKey(left).localeCompare(choiceKey(right))),
  );
  MODELED_CHOICE_CACHE.set(fact, closed);
  MODELED_CHOICE_KEY_CACHE.set(fact, new Set(closed.map(choiceKey)));
  return closed;
}

/**
 * Checks one choice against a precomputed reviewed domain membership index.
 *
 * @param fact Reviewed rule fact owning the domain.
 * @param choice Candidate canonical choice.
 * @returns Whether the choice belongs to the exact closed domain.
 */
export function isModeledChoice(fact: ModeledRuleFact, choice: ModeledCaseChoice): boolean {
  createModeledChoices(fact);
  return MODELED_CHOICE_KEY_CACHE.get(fact)?.has(choiceKey(choice)) === true;
}

/** Returns the exact operation identities permitted by the reviewed seed. */
export function modeledOperationIds(): readonly string[] {
  return Object.freeze(
    [...MODELED_RULE_FACTS.values()].flatMap((fact) => {
      const constructorIds =
        fact.kind === "scalar"
          ? MODELED_SPELLINGS.map((spelling) => {
              const wireSpelling =
                spelling === "const"
                  ? "named-constant"
                  : spelling === "local"
                    ? "local-variable"
                    : spelling;
              return `constructor.scalar.${fact.scalarType}.${wireSpelling}`;
            })
          : [`constructor.memory.${fact.intrinsic}`];
      return [
        ...constructorIds,
        fact.predicateId,
        ...fact.neighborIds,
        `boundary.${fact.kind === "scalar" ? `scalar.${fact.scalarType}` : `memory.${fact.intrinsic}`}`,
      ];
    }),
  );
}
