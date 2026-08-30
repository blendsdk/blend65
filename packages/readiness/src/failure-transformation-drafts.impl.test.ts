import { describe, expect, it } from "vitest";

import {
  applyFailureTransformationDraftV1,
  createFailureTransformationDescriptorSourceV1,
  createFailureTransformationDescriptorsV1,
} from "./failure-transformation-drafts.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";
import { renderSourceModule } from "./source-renderer.js";

import type { FailureTransformationV1 } from "./failure-transformation-model.js";
import type { GenModule } from "./generator-ir.js";
import type { InvalidSourceTransform } from "./modeled-generator-model.js";
import type { ReductionCandidateDraftV1 } from "./reduction-candidate.js";

type TypedDraft = Extract<ReductionCandidateDraftV1, { readonly kind: "typed-valid" }>;
type InvalidDraft = Extract<ReductionCandidateDraftV1, { readonly kind: "typed-invalid" }>;

const encoder = new TextEncoder();

function createModule(): GenModule {
  const validated = validateGeneratorIr({
    kind: "module",
    path: ["Coverage", "Drafts"],
    constants: [],
    functions: [
      {
        kind: "function",
        name: "main",
        parameters: [
          { name: "input", type: "byte" },
          { name: "unused", type: "byte" },
        ],
        returnType: "byte",
        body: [
          {
            kind: "local",
            name: "value",
            type: "byte",
            initializer: { kind: "name", type: "byte", name: "input" },
          },
          {
            kind: "assign",
            target: "value",
            value: { kind: "literal", type: "byte", value: 7n },
          },
          { kind: "return", value: { kind: "name", type: "byte", name: "value" } },
        ],
      },
    ],
  });
  if (!validated.ok) throw new TypeError("expected valid coverage module");
  return validated.module;
}

function createTypedDraft(module: GenModule): TypedDraft {
  const rendered = renderSourceModule(module, {
    maxSourceBytes: 1_048_576,
    literalSpellings: [],
  });
  if (!rendered.ok) throw new TypeError("expected rendered coverage module");
  return {
    revision: "reduction-candidate-draft-v1",
    kind: "typed-valid",
    sourceBytes: rendered.sourceBytes,
    module,
    parameterBindings: [],
    primaryRuleId: "coverage.primary",
    claimedRuleIds: [],
    claimWitnesses: [],
  };
}

function createInvalidDraft(baseline: GenModule, transform: InvalidSourceTransform): InvalidDraft {
  return {
    revision: "reduction-candidate-draft-v1",
    kind: "typed-invalid",
    sourceBytes: new Uint8Array(),
    baseline,
    transform,
    parameterBindings: [
      {
        kind: "parameter-value",
        parameterPath: "/functions/0/parameters/0",
        value: 1n,
      },
      {
        kind: "parameter-value",
        parameterPath: "/functions/0/parameters/1",
        value: 2n,
      },
    ],
    primaryRuleId: "coverage.primary",
    claimedRuleIds: [],
    claimWitnesses: [],
    neighborId: "coverage.neighbor",
    violatedPredicateId: "coverage.predicate",
    diagnosticFamily: "coverage.diagnostic",
  };
}

const wrongFamilyEdit: FailureTransformationV1 = {
  revision: "failure-transformation-v1",
  kind: "malformed-byte-chunk-delete",
  startByte: 0,
  endByte: 1,
};

describe("failure transformation draft helpers", () => {
  it("should enumerate Boolean names, target rebases, and unused bindings deterministically", () => {
    const module = createModule();
    const booleanModule = validateGeneratorIr({
      kind: "module",
      path: ["BooleanCoverage"],
      constants: [],
      functions: [
        {
          kind: "function",
          name: "main",
          parameters: [{ name: "flag", type: "boolean" }],
          returnType: "boolean",
          body: [{ kind: "return", value: { kind: "name", type: "boolean", name: "flag" } }],
        },
      ],
    });
    expect(booleanModule).toMatchObject({ ok: true });
    if (booleanModule.ok) {
      expect(
        createFailureTransformationDescriptorsV1(createTypedDraft(booleanModule.module)),
      ).toContainEqual(
        expect.objectContaining({ kind: "typed-expression-simplify", replacement: "false" }),
      );
    }

    const scalarTransform: InvalidSourceTransform = {
      kind: "scalar-expression-replace",
      expressionPath: "/functions/0/body/1/value",
      replacement: { kind: "integer-literal", value: 256n },
    };
    const descriptors = createFailureTransformationDescriptorsV1(
      createInvalidDraft(module, scalarTransform),
    );
    expect(new Set(descriptors.map(({ kind }) => kind))).toEqual(
      new Set([
        "invalid-baseline-delete",
        "invalid-baseline-simplify",
        "invalid-transform-target-rebase",
        "invalid-unused-binding-remove",
      ]),
    );
    expect(descriptors).toContainEqual(
      expect.objectContaining({
        kind: "invalid-unused-binding-remove",
        parameterPath: "/functions/0/parameters/1",
      }),
    );

    const bindingTarget: InvalidSourceTransform = {
      kind: "parameter-binding-replace",
      parameterPath: "/functions/0/parameters/0",
      replacement: { kind: "integer-literal", value: 256n },
    };
    expect(
      createFailureTransformationDescriptorsV1(createInvalidDraft(module, bindingTarget)),
    ).toContainEqual(expect.objectContaining({ kind: "invalid-transform-target-rebase" }));

    const callTarget: InvalidSourceTransform = {
      kind: "intrinsic-argument-remove",
      callPath: "/functions/0/body/2/value",
      argumentIndex: 0,
    };
    expect(
      createFailureTransformationDescriptorsV1(createInvalidDraft(module, callTarget)),
    ).not.toHaveLength(0);
  });

  it("should reject hostile typed pointers and edits without mutating the draft", () => {
    const draft = createTypedDraft(createModule());
    const edit = (
      kind: "typed-statement-delete" | "typed-literal-simplify" | "typed-expression-simplify",
      path: string,
    ): FailureTransformationV1 =>
      kind === "typed-statement-delete"
        ? { revision: "failure-transformation-v1", kind, path }
        : kind === "typed-literal-simplify"
          ? { revision: "failure-transformation-v1", kind, path, value: "0" }
          : {
              revision: "failure-transformation-v1",
              kind,
              path,
              replacement: "left",
            };

    expect(applyFailureTransformationDraftV1(draft, wrongFamilyEdit)).toBeUndefined();
    for (const transformation of [
      edit("typed-statement-delete", "bad"),
      edit("typed-statement-delete", "/module/functions~0"),
      edit("typed-statement-delete", "/module/functions/nope"),
      edit("typed-statement-delete", "/module/missing"),
      edit("typed-statement-delete", "/module"),
      edit("typed-literal-simplify", "/module/path/0"),
      edit("typed-expression-simplify", "/module/path/0"),
      edit("typed-expression-simplify", "/module/functions/0/body/1/value"),
    ]) {
      expect(applyFailureTransformationDraftV1(draft, transformation)).toBeUndefined();
    }
    expect(draft.module.path).toEqual(["Coverage", "Drafts"]);
  });

  it("should reject malformed invalid baselines, missing bindings, and deleted targets", () => {
    const module = createModule();
    const transform: InvalidSourceTransform = {
      kind: "scalar-expression-replace",
      expressionPath: "/functions/0/body/1/value",
      replacement: { kind: "integer-literal", value: 256n },
    };
    const draft = createInvalidDraft(module, transform);
    const simplify = (baseline: object): InvalidDraft => ({ ...draft, baseline }) as never;
    const applySimplify = (baseline: object): void => {
      expect(
        applyFailureTransformationDraftV1(simplify(baseline), {
          revision: "failure-transformation-v1",
          kind: "invalid-baseline-simplify",
          path: "/baseline/functions/0/body/0",
        }),
      ).toBeUndefined();
    };
    const withBody = (statement: unknown): object => ({
      ...module,
      functions: [{ ...module.functions[0], body: [statement] }],
    });

    applySimplify(withBody(null));
    applySimplify(withBody({ kind: "other" }));
    applySimplify(withBody({ kind: "return", value: null }));
    applySimplify(withBody({ kind: "return", value: { kind: "literal", type: 3, value: 0n } }));
    expect(applyFailureTransformationDraftV1(draft, wrongFamilyEdit)).toBeUndefined();
    expect(
      applyFailureTransformationDraftV1(draft, {
        revision: "failure-transformation-v1",
        kind: "invalid-baseline-delete",
        path: "/module/functions/0/body/0",
      }),
    ).toBeUndefined();
    expect(
      applyFailureTransformationDraftV1(draft, {
        revision: "failure-transformation-v1",
        kind: "invalid-unused-binding-remove",
        parameterPath: "/functions/0/parameters/99",
      }),
    ).toBeUndefined();
    expect(
      applyFailureTransformationDraftV1(draft, {
        revision: "failure-transformation-v1",
        kind: "invalid-baseline-delete",
        path: "/baseline/functions/0/body/1",
      }),
    ).toBeUndefined();
  });

  it("should reject malformed UTF-8 and non-boundary raw deletions", () => {
    const raw = (sourceBytes: Uint8Array): ReductionCandidateDraftV1 => ({
      revision: "reduction-candidate-draft-v1",
      kind: "raw-malformed",
      sourceBytes,
      tokens: [],
    });
    const deletion = (startByte: number, endByte: number): FailureTransformationV1 => ({
      revision: "failure-transformation-v1",
      kind: "malformed-byte-chunk-delete",
      startByte,
      endByte,
    });

    expect(createFailureTransformationDescriptorsV1(raw(new Uint8Array()))).toEqual([]);
    expect(createFailureTransformationDescriptorsV1(raw(Uint8Array.from([0xff])))).toEqual([]);
    const bounded = createFailureTransformationDescriptorSourceV1(raw(encoder.encode("a")), 0);
    expect(bounded.all()).toEqual([]);
    expect(bounded.capacityExceeded).toBe(true);
    expect(bounded.at(1)).toBeUndefined();
    expect(
      applyFailureTransformationDraftV1(raw(Uint8Array.from([0xff])), deletion(0, 1)),
    ).toBeUndefined();
    const multibyte = raw(encoder.encode("éa"));
    expect(applyFailureTransformationDraftV1(multibyte, deletion(1, 3))).toBeUndefined();
    expect(applyFailureTransformationDraftV1(multibyte, deletion(0, 1))).toBeUndefined();
    expect(applyFailureTransformationDraftV1(multibyte, deletion(2, 2))).toBeUndefined();
    expect(applyFailureTransformationDraftV1(multibyte, typedDelete)).toBeUndefined();
  });
});

const typedDelete: FailureTransformationV1 = {
  revision: "failure-transformation-v1",
  kind: "typed-statement-delete",
  path: "/module/functions/0/body/0",
};
