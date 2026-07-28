import { describe, expect, it } from "vitest";

import { createOracleBudgetMeter } from "./oracle-budget.js";
import { runWithOracleMutationVariant } from "./oracle-conformance-v1.js";
import { evaluateOracleProgram } from "./oracle-evaluator.js";
import { createOracleMemoryState, readOracleMemory, writeOracleMemory } from "./oracle-memory.js";
import {
  evaluateOracleBinaryOperation,
  evaluateOracleUnaryOperation,
} from "./oracle-operations.js";
import { normalizeOracleInteger } from "./oracle-values.js";
import {
  EXPECTED_BINDING_AUTHORITY,
  EXPECTED_DIAGNOSTIC_AUTHORITY,
  validateBindingAuthorityCandidate,
  validateDiagnosticAuthorityCandidate,
} from "./oracle-authority-policy.js";
import {
  compareSemanticRelationObservations,
  semanticRelationComparatorWitness,
} from "./semantic-relation-compare.js";
import { semanticRelationPreconditionAccepted } from "./semantic-relation-conformance.js";
import { applySemanticRelationRewriteMutation } from "./semantic-relation-transform.js";
import type { GenModule } from "./generator-ir.js";
import type { OracleObservationV1 } from "./oracle-model.js";

const BUDGET = Object.freeze({
  inputNodes: 256n,
  expressionDepth: 64n,
  evaluationSteps: 512n,
  frames: 2n,
  memoryCells: 64n,
  effects: 64n,
  transformedNodes: 256n,
});

function selection(operationId: string, pathId: string, variantId: string) {
  return Object.freeze({
    mutantId: `mutant.${pathId}`,
    operationId,
    pathId,
    variantId,
  });
}

describe("oracle mutation production dispatch", () => {
  it("activates scalar, normalization, and memory mutations inline", async () => {
    await expect(
      runWithOracleMutationVariant(
        selection("evaluator.binary", "evaluator.binary.boolean.equal", "boolean-negate-v1"),
        () =>
          evaluateOracleBinaryOperation(
            "==",
            "boolean",
            { kind: "boolean", type: "boolean", value: true },
            { kind: "boolean", type: "boolean", value: true },
          ),
      ),
    ).resolves.toMatchObject({ kind: "value", value: { value: false } });
    await expect(
      runWithOracleMutationVariant(
        selection("evaluator.binary", "evaluator.binary.integer.add", "integer-xor-one-v1"),
        () =>
          evaluateOracleBinaryOperation(
            "+",
            "word",
            { kind: "integer", type: "word", value: 1n },
            { kind: "integer", type: "word", value: 2n },
          ),
      ),
    ).resolves.toMatchObject({ kind: "value", value: { value: 2n } });
    await expect(
      runWithOracleMutationVariant(
        selection("evaluator.unary", "evaluator.unary.logical-not", "boolean-negate-v1"),
        () =>
          evaluateOracleUnaryOperation("!", "boolean", {
            kind: "boolean",
            type: "boolean",
            value: true,
          }),
      ),
    ).resolves.toMatchObject({ kind: "value", value: { value: true } });
    await expect(
      runWithOracleMutationVariant(
        selection("evaluator.normalize", "evaluator.normalize.byte", "integer-off-by-one-v1"),
        () => normalizeOracleInteger("byte", 3n),
      ),
    ).resolves.toBe(4n);

    const memory = createOracleMemoryState({
      schemaVersion: 1,
      cells: [
        { address: 10n, value: 1n },
        { address: 11n, value: 0n },
      ],
    });
    await expect(
      runWithOracleMutationVariant(
        selection("evaluator.memory", "evaluator.memory.read-byte", "memory-value-xor-one-v1"),
        () => readOracleMemory(memory, 1, 10n, createOracleBudgetMeter(BUDGET), "/read"),
      ),
    ).resolves.toMatchObject({ ok: true, value: 0n });
    await expect(
      runWithOracleMutationVariant(
        selection("evaluator.memory", "evaluator.memory.write-word", "memory-value-xor-one-v1"),
        () => writeOracleMemory(memory, 2, 10n, 0x1234n, createOracleBudgetMeter(BUDGET), "/write"),
      ),
    ).resolves.toMatchObject({
      ok: true,
      state: { effects: [{ value: 0x1235n }] },
    });
  });

  it("activates exact authority and relation mutations inline", async () => {
    const diagnostic = EXPECTED_DIAGNOSTIC_AUTHORITY[0];
    const binding = EXPECTED_BINDING_AUTHORITY[0];
    if (diagnostic === undefined || binding === undefined)
      throw new TypeError("expected authority");
    await expect(
      runWithOracleMutationVariant(
        selection(
          "diagnostic.mapping",
          `diagnostic.mapping.${diagnostic.neighborId}.${diagnostic.diagnosticContext}`,
          "wrong-exact-mapping-v1",
        ),
        () => validateDiagnosticAuthorityCandidate(EXPECTED_DIAGNOSTIC_AUTHORITY),
      ),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      runWithOracleMutationVariant(
        selection(
          "binding-rejection.mapping",
          `binding-rejection.mapping.${binding.neighborId}.${binding.spelling}`,
          "wrong-exact-rejection-v1",
        ),
        () => validateBindingAuthorityCandidate(EXPECTED_BINDING_AUTHORITY),
      ),
    ).resolves.toMatchObject({ ok: false });

    await expect(
      runWithOracleMutationVariant(
        selection(
          "relation.algebraic-identity",
          "relation.algebraic-identity.precondition",
          "force-true-v1",
        ),
        () => semanticRelationPreconditionAccepted("relation.algebraic-identity", false),
      ),
    ).resolves.toBe(true);

    const observation: OracleObservationV1 = Object.freeze({
      kind: "value-state",
      returnValue: Object.freeze({
        kind: "integer" as const,
        type: "byte" as const,
        value: 1n,
      }),
      effects: Object.freeze([]),
      finalMemory: Object.freeze([]),
    });
    await expect(
      runWithOracleMutationVariant(
        selection(
          "relation.algebraic-identity",
          "relation.algebraic-identity.comparator",
          "omit-required-observable-v1",
        ),
        () => {
          const witness = semanticRelationComparatorWitness(
            "relation.algebraic-identity",
            observation,
          );
          return compareSemanticRelationObservations(
            "relation.algebraic-identity",
            observation,
            witness,
          );
        },
      ),
    ).resolves.toBe(true);

    const module = {
      kind: "module",
      path: ["mutation"],
      constants: [],
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [],
          returnType: "byte",
          body: [
            {
              kind: "return",
              value: { kind: "literal", type: "byte", value: 1n },
            },
          ],
        },
      ],
    } as unknown as GenModule;
    await expect(
      runWithOracleMutationVariant(
        selection(
          "relation.algebraic-identity",
          "relation.algebraic-identity.rewrite",
          "non-preserving.add-zero-right",
        ),
        () =>
          applySemanticRelationRewriteMutation(
            "relation.algebraic-identity",
            "add-zero-right",
            module,
            "main",
          ),
      ),
    ).resolves.not.toEqual(module);
  });

  it("activates all observable order reversals through the evaluator", async () => {
    const program = (
      body: readonly unknown[],
      cells: readonly { readonly address: bigint; readonly value: bigint }[],
      returnType: "byte" | "void",
    ) => ({
      schemaVersion: 1,
      module: {
        kind: "module",
        path: ["mutation"],
        constants: [],
        functions: [{ kind: "function", name: "main", parameters: [], returnType, body }],
      },
      entryFunction: "main",
      parameterBindings: [],
      memory: { schemaVersion: 1, cells },
      budget: BUDGET,
    });
    const read = (type: "byte" | "word", width: 1 | 2, address: bigint) => ({
      kind: "memory-read",
      type,
      width,
      address: { kind: "literal", type: "word", value: address },
    });
    const cases = [
      {
        pathId: "evaluator.order.binary-operands",
        input: program(
          [
            {
              kind: "return",
              value: {
                kind: "binary",
                type: "byte",
                operator: "+",
                left: read("byte", 1, 10n),
                right: read("byte", 1, 11n),
              },
            },
          ],
          [
            { address: 10n, value: 1n },
            { address: 11n, value: 2n },
          ],
          "byte",
        ),
      },
      {
        pathId: "evaluator.order.memory-write-operands",
        input: program(
          [
            {
              kind: "memory-write",
              width: 1,
              address: read("word", 2, 0n),
              value: read("byte", 1, 2n),
            },
            { kind: "return" },
          ],
          [
            { address: 0n, value: 100n },
            { address: 1n, value: 0n },
            { address: 2n, value: 7n },
            { address: 100n, value: 0n },
          ],
          "void",
        ),
      },
      {
        pathId: "evaluator.order.statement-effects",
        input: program(
          [
            {
              kind: "memory-write",
              width: 1,
              address: { kind: "literal", type: "word", value: 10n },
              value: { kind: "literal", type: "byte", value: 1n },
            },
            { kind: "return" },
          ],
          [{ address: 10n, value: 0n }],
          "void",
        ),
      },
    ];
    for (const item of cases) {
      await expect(
        runWithOracleMutationVariant(
          selection("evaluator.order", item.pathId, "reverse-order-v1"),
          () => evaluateOracleProgram(item.input),
        ),
      ).resolves.toMatchObject({ ok: true });
    }
  });
});
