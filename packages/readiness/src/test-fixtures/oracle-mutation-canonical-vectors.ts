type MutationFamily =
  | "evaluator-operation"
  | "diagnostic-mapping"
  | "transform-precondition"
  | "transform-rewrite"
  | "relation-comparator";

const encodedRows = `
mutant.binding-rejection.mapping.neighbor.scalar.boolean.wrong-type.parameter|diagnostic-mapping|binding-rejection.mapping|binding-rejection.mapping.neighbor.scalar.boolean.wrong-type.parameter|wrong-exact-rejection-v1|vector.binding-rejection.mapping.neighbor.scalar.boolean.wrong-type.parameter.v1
mutant.binding-rejection.mapping.neighbor.scalar.byte.above-max.parameter|diagnostic-mapping|binding-rejection.mapping|binding-rejection.mapping.neighbor.scalar.byte.above-max.parameter|wrong-exact-rejection-v1|vector.binding-rejection.mapping.neighbor.scalar.byte.above-max.parameter.v1
mutant.binding-rejection.mapping.neighbor.scalar.byte.below-min.parameter|diagnostic-mapping|binding-rejection.mapping|binding-rejection.mapping.neighbor.scalar.byte.below-min.parameter|wrong-exact-rejection-v1|vector.binding-rejection.mapping.neighbor.scalar.byte.below-min.parameter.v1
mutant.binding-rejection.mapping.neighbor.scalar.sbyte.above-max.parameter|diagnostic-mapping|binding-rejection.mapping|binding-rejection.mapping.neighbor.scalar.sbyte.above-max.parameter|wrong-exact-rejection-v1|vector.binding-rejection.mapping.neighbor.scalar.sbyte.above-max.parameter.v1
mutant.binding-rejection.mapping.neighbor.scalar.sbyte.below-min.parameter|diagnostic-mapping|binding-rejection.mapping|binding-rejection.mapping.neighbor.scalar.sbyte.below-min.parameter|wrong-exact-rejection-v1|vector.binding-rejection.mapping.neighbor.scalar.sbyte.below-min.parameter.v1
mutant.binding-rejection.mapping.neighbor.scalar.sword.above-max.parameter|diagnostic-mapping|binding-rejection.mapping|binding-rejection.mapping.neighbor.scalar.sword.above-max.parameter|wrong-exact-rejection-v1|vector.binding-rejection.mapping.neighbor.scalar.sword.above-max.parameter.v1
mutant.binding-rejection.mapping.neighbor.scalar.sword.below-min.parameter|diagnostic-mapping|binding-rejection.mapping|binding-rejection.mapping.neighbor.scalar.sword.below-min.parameter|wrong-exact-rejection-v1|vector.binding-rejection.mapping.neighbor.scalar.sword.below-min.parameter.v1
mutant.binding-rejection.mapping.neighbor.scalar.word.above-max.parameter|diagnostic-mapping|binding-rejection.mapping|binding-rejection.mapping.neighbor.scalar.word.above-max.parameter|wrong-exact-rejection-v1|vector.binding-rejection.mapping.neighbor.scalar.word.above-max.parameter.v1
mutant.binding-rejection.mapping.neighbor.scalar.word.below-min.parameter|diagnostic-mapping|binding-rejection.mapping|binding-rejection.mapping.neighbor.scalar.word.below-min.parameter|wrong-exact-rejection-v1|vector.binding-rejection.mapping.neighbor.scalar.word.below-min.parameter.v1
mutant.diagnostic.mapping.neighbor.memory.peek.wrong-address-type|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.memory.peek.wrong-address-type|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.memory.peek.wrong-address-type.v1
mutant.diagnostic.mapping.neighbor.memory.peek.wrong-arity|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.memory.peek.wrong-arity|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.memory.peek.wrong-arity.v1
mutant.diagnostic.mapping.neighbor.memory.peekw.wrong-address-type|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.memory.peekw.wrong-address-type|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.memory.peekw.wrong-address-type.v1
mutant.diagnostic.mapping.neighbor.memory.peekw.wrong-arity|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.memory.peekw.wrong-arity|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.memory.peekw.wrong-arity.v1
mutant.diagnostic.mapping.neighbor.memory.poke.wrong-address-type|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.memory.poke.wrong-address-type|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.memory.poke.wrong-address-type.v1
mutant.diagnostic.mapping.neighbor.memory.poke.wrong-arity|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.memory.poke.wrong-arity|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.memory.poke.wrong-arity.v1
mutant.diagnostic.mapping.neighbor.memory.poke.wrong-value-type|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.memory.poke.wrong-value-type|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.memory.poke.wrong-value-type.v1
mutant.diagnostic.mapping.neighbor.memory.pokew.wrong-address-type|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.memory.pokew.wrong-address-type|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.memory.pokew.wrong-address-type.v1
mutant.diagnostic.mapping.neighbor.memory.pokew.wrong-arity|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.memory.pokew.wrong-arity|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.memory.pokew.wrong-arity.v1
mutant.diagnostic.mapping.neighbor.memory.pokew.wrong-value-type|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.memory.pokew.wrong-value-type|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.memory.pokew.wrong-value-type.v1
mutant.diagnostic.mapping.neighbor.scalar.boolean.wrong-type.initializer|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.scalar.boolean.wrong-type.initializer|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.scalar.boolean.wrong-type.initializer.v1
mutant.diagnostic.mapping.neighbor.scalar.boolean.wrong-type.return-expression|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.scalar.boolean.wrong-type.return-expression|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.scalar.boolean.wrong-type.return-expression.v1
mutant.diagnostic.mapping.neighbor.scalar.byte.above-max|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.scalar.byte.above-max|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.scalar.byte.above-max.v1
mutant.diagnostic.mapping.neighbor.scalar.byte.below-min|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.scalar.byte.below-min|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.scalar.byte.below-min.v1
mutant.diagnostic.mapping.neighbor.scalar.sbyte.above-max|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.scalar.sbyte.above-max|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.scalar.sbyte.above-max.v1
mutant.diagnostic.mapping.neighbor.scalar.sbyte.below-min|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.scalar.sbyte.below-min|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.scalar.sbyte.below-min.v1
mutant.diagnostic.mapping.neighbor.scalar.sword.above-max|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.scalar.sword.above-max|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.scalar.sword.above-max.v1
mutant.diagnostic.mapping.neighbor.scalar.sword.below-min|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.scalar.sword.below-min|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.scalar.sword.below-min.v1
mutant.diagnostic.mapping.neighbor.scalar.word.above-max|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.scalar.word.above-max|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.scalar.word.above-max.v1
mutant.diagnostic.mapping.neighbor.scalar.word.below-min|diagnostic-mapping|diagnostic.mapping|diagnostic.mapping.neighbor.scalar.word.below-min|wrong-exact-mapping-v1|vector.diagnostic.mapping.neighbor.scalar.word.below-min.v1
mutant.evaluator.binary.boolean.equal|evaluator-operation|evaluator.binary|evaluator.binary.boolean.equal|boolean-negate-v1|vector.evaluator.binary.boolean.equal.v1
mutant.evaluator.binary.boolean.not-equal|evaluator-operation|evaluator.binary|evaluator.binary.boolean.not-equal|boolean-negate-v1|vector.evaluator.binary.boolean.not-equal.v1
mutant.evaluator.binary.integer.add|evaluator-operation|evaluator.binary|evaluator.binary.integer.add|integer-xor-one-v1|vector.evaluator.binary.integer.add.v1
mutant.evaluator.binary.integer.bitwise-and|evaluator-operation|evaluator.binary|evaluator.binary.integer.bitwise-and|integer-xor-one-v1|vector.evaluator.binary.integer.bitwise-and.v1
mutant.evaluator.binary.integer.bitwise-or|evaluator-operation|evaluator.binary|evaluator.binary.integer.bitwise-or|integer-xor-one-v1|vector.evaluator.binary.integer.bitwise-or.v1
mutant.evaluator.binary.integer.bitwise-xor|evaluator-operation|evaluator.binary|evaluator.binary.integer.bitwise-xor|integer-xor-one-v1|vector.evaluator.binary.integer.bitwise-xor.v1
mutant.evaluator.binary.integer.divide|evaluator-operation|evaluator.binary|evaluator.binary.integer.divide|integer-xor-one-v1|vector.evaluator.binary.integer.divide.v1
mutant.evaluator.binary.integer.equal|evaluator-operation|evaluator.binary|evaluator.binary.integer.equal|boolean-negate-v1|vector.evaluator.binary.integer.equal.v1
mutant.evaluator.binary.integer.greater|evaluator-operation|evaluator.binary|evaluator.binary.integer.greater|boolean-negate-v1|vector.evaluator.binary.integer.greater.v1
mutant.evaluator.binary.integer.greater-equal|evaluator-operation|evaluator.binary|evaluator.binary.integer.greater-equal|boolean-negate-v1|vector.evaluator.binary.integer.greater-equal.v1
mutant.evaluator.binary.integer.less|evaluator-operation|evaluator.binary|evaluator.binary.integer.less|boolean-negate-v1|vector.evaluator.binary.integer.less.v1
mutant.evaluator.binary.integer.less-equal|evaluator-operation|evaluator.binary|evaluator.binary.integer.less-equal|boolean-negate-v1|vector.evaluator.binary.integer.less-equal.v1
mutant.evaluator.binary.integer.multiply|evaluator-operation|evaluator.binary|evaluator.binary.integer.multiply|integer-xor-one-v1|vector.evaluator.binary.integer.multiply.v1
mutant.evaluator.binary.integer.not-equal|evaluator-operation|evaluator.binary|evaluator.binary.integer.not-equal|boolean-negate-v1|vector.evaluator.binary.integer.not-equal.v1
mutant.evaluator.binary.integer.remainder|evaluator-operation|evaluator.binary|evaluator.binary.integer.remainder|integer-xor-one-v1|vector.evaluator.binary.integer.remainder.v1
mutant.evaluator.binary.integer.subtract|evaluator-operation|evaluator.binary|evaluator.binary.integer.subtract|integer-xor-one-v1|vector.evaluator.binary.integer.subtract.v1
mutant.evaluator.binary.shift-left|evaluator-operation|evaluator.binary|evaluator.binary.shift-left|integer-xor-one-v1|vector.evaluator.binary.shift-left.v1
mutant.evaluator.binary.shift-right|evaluator-operation|evaluator.binary|evaluator.binary.shift-right|integer-xor-one-v1|vector.evaluator.binary.shift-right.v1
mutant.evaluator.memory.read-byte|evaluator-operation|evaluator.memory|evaluator.memory.read-byte|memory-value-xor-one-v1|vector.evaluator.memory.read-byte.v1
mutant.evaluator.memory.read-word|evaluator-operation|evaluator.memory|evaluator.memory.read-word|memory-value-xor-one-v1|vector.evaluator.memory.read-word.v1
mutant.evaluator.memory.write-byte|evaluator-operation|evaluator.memory|evaluator.memory.write-byte|memory-value-xor-one-v1|vector.evaluator.memory.write-byte.v1
mutant.evaluator.memory.write-word|evaluator-operation|evaluator.memory|evaluator.memory.write-word|memory-value-xor-one-v1|vector.evaluator.memory.write-word.v1
mutant.evaluator.normalize.byte|evaluator-operation|evaluator.normalize|evaluator.normalize.byte|integer-off-by-one-v1|vector.evaluator.normalize.byte.v1
mutant.evaluator.normalize.sbyte|evaluator-operation|evaluator.normalize|evaluator.normalize.sbyte|integer-off-by-one-v1|vector.evaluator.normalize.sbyte.v1
mutant.evaluator.normalize.sword|evaluator-operation|evaluator.normalize|evaluator.normalize.sword|integer-off-by-one-v1|vector.evaluator.normalize.sword.v1
mutant.evaluator.normalize.word|evaluator-operation|evaluator.normalize|evaluator.normalize.word|integer-off-by-one-v1|vector.evaluator.normalize.word.v1
mutant.evaluator.order.binary-operands|evaluator-operation|evaluator.order|evaluator.order.binary-operands|reverse-order-v1|vector.evaluator.order.binary-operands.v1
mutant.evaluator.order.memory-write-operands|evaluator-operation|evaluator.order|evaluator.order.memory-write-operands|reverse-order-v1|vector.evaluator.order.memory-write-operands.v1
mutant.evaluator.order.statement-effects|evaluator-operation|evaluator.order|evaluator.order.statement-effects|reverse-order-v1|vector.evaluator.order.statement-effects.v1
mutant.evaluator.unary.bitwise-not|evaluator-operation|evaluator.unary|evaluator.unary.bitwise-not|integer-xor-one-v1|vector.evaluator.unary.bitwise-not.v1
mutant.evaluator.unary.logical-not|evaluator-operation|evaluator.unary|evaluator.unary.logical-not|boolean-negate-v1|vector.evaluator.unary.logical-not.v1
mutant.evaluator.unary.negate|evaluator-operation|evaluator.unary|evaluator.unary.negate|integer-xor-one-v1|vector.evaluator.unary.negate.v1
mutant.relation.algebraic-identity.comparator.omit-required-observable|relation-comparator|relation.algebraic-identity|relation.algebraic-identity.comparator|omit-required-observable-v1|vector.relation.algebraic-identity.comparator.v1
mutant.relation.algebraic-identity.precondition.force-true|transform-precondition|relation.algebraic-identity|relation.algebraic-identity.precondition|force-true-v1|vector.relation.algebraic-identity.precondition.inapplicable.v1
mutant.relation.algebraic-identity.rewrite.add-zero-right|transform-rewrite|relation.algebraic-identity|relation.algebraic-identity.rewrite|non-preserving.add-zero-right|vector.relation.algebraic-identity.rewrite.add-zero-right.v1
mutant.relation.algebraic-identity.rewrite.and-all-ones-right|transform-rewrite|relation.algebraic-identity|relation.algebraic-identity.rewrite|non-preserving.and-all-ones-right|vector.relation.algebraic-identity.rewrite.and-all-ones-right.v1
mutant.relation.algebraic-identity.rewrite.divide-one-right|transform-rewrite|relation.algebraic-identity|relation.algebraic-identity.rewrite|non-preserving.divide-one-right|vector.relation.algebraic-identity.rewrite.divide-one-right.v1
mutant.relation.algebraic-identity.rewrite.multiply-one-right|transform-rewrite|relation.algebraic-identity|relation.algebraic-identity.rewrite|non-preserving.multiply-one-right|vector.relation.algebraic-identity.rewrite.multiply-one-right.v1
mutant.relation.algebraic-identity.rewrite.or-zero-right|transform-rewrite|relation.algebraic-identity|relation.algebraic-identity.rewrite|non-preserving.or-zero-right|vector.relation.algebraic-identity.rewrite.or-zero-right.v1
mutant.relation.algebraic-identity.rewrite.shift-left-zero|transform-rewrite|relation.algebraic-identity|relation.algebraic-identity.rewrite|non-preserving.shift-left-zero|vector.relation.algebraic-identity.rewrite.shift-left-zero.v1
mutant.relation.algebraic-identity.rewrite.shift-right-zero|transform-rewrite|relation.algebraic-identity|relation.algebraic-identity.rewrite|non-preserving.shift-right-zero|vector.relation.algebraic-identity.rewrite.shift-right-zero.v1
mutant.relation.algebraic-identity.rewrite.subtract-zero-right|transform-rewrite|relation.algebraic-identity|relation.algebraic-identity.rewrite|non-preserving.subtract-zero-right|vector.relation.algebraic-identity.rewrite.subtract-zero-right.v1
mutant.relation.algebraic-identity.rewrite.xor-zero-right|transform-rewrite|relation.algebraic-identity|relation.algebraic-identity.rewrite|non-preserving.xor-zero-right|vector.relation.algebraic-identity.rewrite.xor-zero-right.v1
mutant.relation.identifier-renaming.comparator.omit-required-observable|relation-comparator|relation.identifier-renaming|relation.identifier-renaming.comparator|omit-required-observable-v1|vector.relation.identifier-renaming.comparator.v1
mutant.relation.identifier-renaming.precondition.force-true|transform-precondition|relation.identifier-renaming|relation.identifier-renaming.precondition|force-true-v1|vector.relation.identifier-renaming.precondition.inapplicable.v1
mutant.relation.identifier-renaming.rewrite.fresh-sibling-v1|transform-rewrite|relation.identifier-renaming|relation.identifier-renaming.rewrite|non-preserving.fresh-sibling-v1|vector.relation.identifier-renaming.rewrite.fresh-sibling-v1.v1
mutant.relation.independent-declaration-reordering.comparator.omit-required-observable|relation-comparator|relation.independent-declaration-reordering|relation.independent-declaration-reordering.comparator|omit-required-observable-v1|vector.relation.independent-declaration-reordering.comparator.v1
mutant.relation.independent-declaration-reordering.precondition.force-true|transform-precondition|relation.independent-declaration-reordering|relation.independent-declaration-reordering.precondition|force-true-v1|vector.relation.independent-declaration-reordering.precondition.inapplicable.v1
mutant.relation.independent-declaration-reordering.rewrite.swap-independent-constants-v1|transform-rewrite|relation.independent-declaration-reordering|relation.independent-declaration-reordering.rewrite|non-preserving.swap-independent-constants-v1|vector.relation.independent-declaration-reordering.rewrite.swap-independent-constants-v1.v1
mutant.relation.literal-to-local.comparator.omit-required-observable|relation-comparator|relation.literal-to-local|relation.literal-to-local.comparator|omit-required-observable-v1|vector.relation.literal-to-local.comparator.v1
mutant.relation.literal-to-local.precondition.force-true|transform-precondition|relation.literal-to-local|relation.literal-to-local.precondition|force-true-v1|vector.relation.literal-to-local.precondition.inapplicable.v1
mutant.relation.literal-to-local.rewrite.introduce-local-v1|transform-rewrite|relation.literal-to-local|relation.literal-to-local.rewrite|non-preserving.introduce-local-v1|vector.relation.literal-to-local.rewrite.introduce-local-v1.v1
mutant.relation.local-to-parameter.comparator.omit-required-observable|relation-comparator|relation.local-to-parameter|relation.local-to-parameter.comparator|omit-required-observable-v1|vector.relation.local-to-parameter.comparator.v1
mutant.relation.local-to-parameter.precondition.force-true|transform-precondition|relation.local-to-parameter|relation.local-to-parameter.precondition|force-true-v1|vector.relation.local-to-parameter.precondition.inapplicable.v1
mutant.relation.local-to-parameter.rewrite.lift-entry-local-v1|transform-rewrite|relation.local-to-parameter|relation.local-to-parameter.rewrite|non-preserving.lift-entry-local-v1|vector.relation.local-to-parameter.rewrite.lift-entry-local-v1.v1
`.trim();

const rows = encodedRows.split("\n").map((line) => {
  const [mutantId, family, operationId, pathId, variantId, vectorId] = line.split("|");
  if (
    mutantId === undefined ||
    family === undefined ||
    operationId === undefined ||
    pathId === undefined ||
    variantId === undefined ||
    vectorId === undefined
  ) {
    throw new TypeError("invalid canonical mutation row");
  }
  return Object.freeze({
    mutantId,
    family: family as MutationFamily,
    operationId,
    pathId,
    variantId,
    vectorId,
  });
});

if (rows.length !== 84) throw new TypeError("canonical mutation inventory must contain 84 rows");

export const oracleMutationCatalog = Object.freeze({
  schemaVersion: 1 as const,
  catalogVersion: "1.0.0" as const,
  policyRevision: "oracle-mutation-policy-v1" as const,
  mutants: Object.freeze(rows.map(({ vectorId: _vectorId, ...mutant }) => Object.freeze(mutant))),
});

export const oracleMutationVectorIds = Object.freeze(rows.map(({ vectorId }) => vectorId));

export const oracleMutationFamilyCounts = Object.freeze({
  "evaluator-operation": 32,
  "diagnostic-mapping": 29,
  "transform-precondition": 5,
  "transform-rewrite": 13,
  "relation-comparator": 5,
});

export const oracleMutationSelections = Object.freeze([
  oracleMutationCatalog.mutants[29]!,
  oracleMutationCatalog.mutants[31]!,
]);
