import { describe, expect, it } from "vitest";

import { compareFailureTransformationsV1 } from "./failure-transformation-model.js";

import type { FailureTransformationV1 } from "./failure-transformation-model.js";

const typedDelete: FailureTransformationV1 = {
  revision: "failure-transformation-v1",
  kind: "typed-statement-delete",
  path: "/module/functions/0/body/0",
};

describe("failure transformation ordering", () => {
  it("should compare every closed family and family-specific tie breaker", () => {
    const typedExpressionLeft: FailureTransformationV1 = {
      revision: "failure-transformation-v1",
      kind: "typed-expression-simplify",
      path: typedDelete.path,
      replacement: "left",
    };
    const typedExpressionRight: FailureTransformationV1 = {
      ...typedExpressionLeft,
      replacement: "right",
    };
    const typedLiteralZero: FailureTransformationV1 = {
      revision: "failure-transformation-v1",
      kind: "typed-literal-simplify",
      path: typedDelete.path,
      value: "0",
    };
    const typedLiteralOne: FailureTransformationV1 = { ...typedLiteralZero, value: "1" };
    const invalidBinding: FailureTransformationV1 = {
      revision: "failure-transformation-v1",
      kind: "invalid-unused-binding-remove",
      parameterPath: "/functions/0/parameters/0",
    };
    const invalidBindingLater: FailureTransformationV1 = {
      ...invalidBinding,
      parameterPath: "/functions/0/parameters/1",
    };
    const rawWhole: FailureTransformationV1 = {
      revision: "failure-transformation-v1",
      kind: "malformed-byte-chunk-delete",
      startByte: 0,
      endByte: 4,
    };
    const rawPrefix: FailureTransformationV1 = { ...rawWhole, endByte: 2 };
    const rawLater: FailureTransformationV1 = { ...rawWhole, startByte: 1 };

    expect(compareFailureTransformationsV1(typedDelete, invalidBinding)).toBeLessThan(0);
    expect(compareFailureTransformationsV1(invalidBinding, rawWhole)).toBeLessThan(0);
    expect(compareFailureTransformationsV1(invalidBinding, invalidBindingLater)).toBeLessThan(0);
    expect(compareFailureTransformationsV1(typedDelete, typedExpressionLeft)).toBeLessThan(0);
    expect(compareFailureTransformationsV1(typedExpressionLeft, typedExpressionRight)).toBeLessThan(
      0,
    );
    expect(compareFailureTransformationsV1(typedLiteralZero, typedLiteralOne)).toBeLessThan(0);
    expect(compareFailureTransformationsV1(rawWhole, rawPrefix)).toBeLessThan(0);
    expect(compareFailureTransformationsV1(rawWhole, rawLater)).toBeLessThan(0);
    expect(compareFailureTransformationsV1(rawWhole, rawWhole)).toBe(0);
  });
});
