import { createBoundaryVariants } from "./boundary-variants.js";
import { buildModeledModule } from "./modeled-case-builder.js";
import {
  createModeledChoices,
  isModeledChoice,
  MODELED_RULE_FACTS,
  type ModeledRuleFact,
} from "./modeled-generator-facts.js";
import { isGenIdentifier } from "./generator-ir.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";
import { executeModeledNeighborOperation } from "./modeled-generators.js";
import {
  createExecutableOperationRegistry,
  type ExecutableOperationRegistryResult,
  type RuleModelOperationKind,
} from "./rule-model-registry.js";

interface OperationInput {
  readonly operationId: string;
  readonly kind: RuleModelOperationKind;
  readonly implementation: (...args: never[]) => unknown;
}

function constructorIds(scalarType: string): readonly string[] {
  return ["literal", "local-variable", "named-constant", "parameter"].map(
    (spelling) => `constructor.scalar.${scalarType}.${spelling}`,
  );
}

function constructorSpelling(operationId: string): "literal" | "const" | "local" | "parameter" {
  if (operationId.endsWith(".named-constant")) return "const";
  if (operationId.endsWith(".local-variable")) return "local";
  if (operationId.endsWith(".parameter")) return "parameter";
  return "literal";
}

function constructorProbe(fact: ModeledRuleFact, operationId: string): boolean {
  const moduleName = "OperationProbe";
  if (!isGenIdentifier(moduleName)) return false;
  const choices = createModeledChoices(fact);
  const choice =
    fact.kind === "scalar"
      ? choices.find(
          (candidate) =>
            candidate.kind === "scalar" && candidate.spelling === constructorSpelling(operationId),
        )
      : choices[0];
  return (
    choice !== undefined &&
    choice.ruleId === fact.ruleId &&
    validateGeneratorIr(buildModeledModule(fact, choice, [moduleName])).ok
  );
}

function boundaryProbe(fact: ModeledRuleFact): boolean {
  const result = createBoundaryVariants({
    type: fact.kind === "scalar" ? fact.scalarType : "word",
    spellings: ["const", "literal", "local", "parameter"],
    minNestingDepth: 0,
    maxNestingDepth: 1,
    allowEmpty: false,
  });
  return result.ok && result.variants.length > 0;
}

/**
 * Creates the complete callable operation table used to validate reviewed modeled facts.
 *
 * Operation records deliberately reuse the production callable identities. A registry entry
 * therefore proves both the stable ID/kind join and the existence of executable behavior.
 *
 * @returns A closed executable registry for the exact reviewed seed.
 */
export function createModeledOperationRegistry(): ExecutableOperationRegistryResult {
  const operations: OperationInput[] = [];
  for (const fact of MODELED_RULE_FACTS.values()) {
    const factConstructorIds =
      fact.kind === "scalar"
        ? constructorIds(fact.scalarType)
        : [`constructor.memory.${fact.intrinsic}`];
    for (const operationId of factConstructorIds) {
      operations.push({
        operationId,
        kind: "constructor",
        implementation: () => constructorProbe(fact, operationId),
      });
    }
    operations.push({
      operationId: fact.predicateId,
      kind: "predicate",
      implementation: () => {
        const choice = createModeledChoices(fact)[0];
        return choice !== undefined && isModeledChoice(fact, choice);
      },
    });
    for (const operationId of fact.neighborIds) {
      operations.push({
        operationId,
        kind: "neighbor",
        implementation: () => {
          const choice = createModeledChoices(fact)[0];
          return choice !== undefined && executeModeledNeighborOperation(fact, choice, operationId);
        },
      });
    }
    operations.push({
      operationId:
        fact.kind === "scalar"
          ? `boundary.scalar.${fact.scalarType}`
          : `boundary.memory.${fact.intrinsic}`,
      kind: "boundary-family",
      implementation: () => boundaryProbe(fact),
    });
  }
  return createExecutableOperationRegistry(operations);
}
