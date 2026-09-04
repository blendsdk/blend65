import { declaredRelationNames, freshRelationName } from "./semantic-relation-analysis.js";
import { semanticRelationRewriteIsMutated } from "./semantic-relation-conformance.js";
import { isGenIdentifier } from "./generator-ir.js";
import type { GenExpression, GenModule, GenStatement } from "./generator-ir.js";
import type { PreparedSemanticRelationRequestV1 } from "./semantic-relation-input.js";
import {
  freezeExpression,
  freezeFunction,
  freezeModule,
} from "./semantic-relation-transform-helpers.js";

/** Produces the deliberately impure module used by semantic-closure fault injection. */
export function semanticClosureFault(module: GenModule): GenModule {
  const name = freshRelationName("impure", declaredRelationNames(module));
  if (!isGenIdentifier(name)) return module;
  return freezeModule({
    ...module,
    constants: [
      ...module.constants,
      Object.freeze({
        kind: "const" as const,
        name,
        type: "byte" as const,
        value: Object.freeze({
          kind: "memory-read" as const,
          type: "byte" as const,
          width: 1 as const,
          address: Object.freeze({ kind: "literal" as const, type: "word" as const, value: 0n }),
        }),
      }),
    ],
  });
}

/** Produces the deliberately observable module used by preservation fault injection. */
export function nonPreservingFault(module: GenModule, entryFunction: string): GenModule {
  const functions = module.functions.map((fn) => {
    if (fn.name !== entryFunction) return freezeFunction(fn);
    let changed = false;
    const body: GenStatement[] = [];
    for (const statement of fn.body) {
      if (!changed && statement.kind === "return") {
        changed = true;
        if (statement.value === undefined) {
          body.push(
            Object.freeze({
              kind: "memory-write",
              width: 1,
              address: Object.freeze({ kind: "literal", type: "word", value: 0xffffn }),
              value: Object.freeze({ kind: "literal", type: "byte", value: 1n }),
            }),
          );
          body.push(Object.freeze({ ...statement }));
          continue;
        }
        const value: GenExpression =
          statement.value.type === "boolean"
            ? Object.freeze({
                kind: "unary",
                type: "boolean",
                operator: "!",
                operand: freezeExpression(statement.value),
              })
            : Object.freeze({
                kind: "binary",
                type: statement.value.type,
                operator: "^",
                left: freezeExpression(statement.value),
                right: Object.freeze({
                  kind: "literal",
                  type: statement.value.type,
                  value: 1n,
                }),
              });
        body.push(Object.freeze({ ...statement, value }));
        continue;
      }
      body.push(freezeFunction({ ...fn, body: [statement] }).body[0] ?? statement);
    }
    if (!changed && fn.returnType === "void") {
      body.push(
        Object.freeze({
          kind: "memory-write",
          width: 1,
          address: Object.freeze({ kind: "literal", type: "word", value: 0xffffn }),
          value: Object.freeze({ kind: "literal", type: "byte", value: 1n }),
        }),
      );
    }
    return changed ? Object.freeze({ ...fn, body: Object.freeze(body) }) : freezeFunction(fn);
  });
  return freezeModule({ ...module, functions });
}

/** Applies the configured non-preserving rewrite mutation, when selected. */
export function applySemanticRelationRewriteMutationCore(
  relationId: PreparedSemanticRelationRequestV1["request"]["relationId"],
  variantId: string,
  module: GenModule,
  entryFunction: string,
): GenModule {
  return semanticRelationRewriteIsMutated(relationId, variantId)
    ? nonPreservingFault(module, entryFunction)
    : module;
}
