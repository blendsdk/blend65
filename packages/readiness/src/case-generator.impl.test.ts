import { describe, expect, it } from "vitest";

import { renderGeneratedCase } from "./case-generator.js";
import { isGenIdentifier, type GenIdentifier, type GenModule } from "./generator-ir.js";
import {
  deriveInvalidRoundTripProjection,
  validateInvalidRoundTripProjection,
} from "./invalid-roundtrip-projection.js";
import type { GeneratedModeledCase } from "./modeled-generator-model.js";
import { prepareSourceRenderInput } from "./source-renderer.js";

const USAGE = Object.freeze({
  modules: 1n,
  declarations: 2n,
  "ir-nodes": 5n,
  statements: 1n,
  "expression-depth": 2n,
  "loop-work": 0n,
});

const OPTIONS = Object.freeze({
  maxSourceBytes: 4096,
  literalSpellings: Object.freeze([]),
});

function identifier(value: string): GenIdentifier {
  if (!isGenIdentifier(value)) throw new TypeError("test identifier is invalid");
  return value;
}

function memoryModule(): GenModule {
  return Object.freeze({
    kind: "module",
    path: Object.freeze([identifier("RendererCase")]),
    constants: Object.freeze([]),
    functions: Object.freeze([
      Object.freeze({
        kind: "function",
        name: identifier("memoryCase"),
        parameters: Object.freeze([]),
        returnType: "byte",
        body: Object.freeze([
          Object.freeze({
            kind: "return",
            value: Object.freeze({
              kind: "memory-read",
              type: "byte",
              width: 1,
              address: Object.freeze({ kind: "literal", type: "word", value: 0xd020n }),
            }),
          }),
        ]),
      }),
    ]),
  });
}

function scalarParameterModule(): GenModule {
  return Object.freeze({
    kind: "module",
    path: Object.freeze([identifier("BindingCase")]),
    constants: Object.freeze([]),
    functions: Object.freeze([
      Object.freeze({
        kind: "function",
        name: identifier("scalarCase"),
        parameters: Object.freeze([
          Object.freeze({ name: identifier("modeledValue"), type: "byte" }),
        ]),
        returnType: "byte",
        body: Object.freeze([
          Object.freeze({
            kind: "return",
            value: Object.freeze({
              kind: "name",
              type: "byte",
              name: identifier("modeledValue"),
            }),
          }),
        ]),
      }),
    ]),
  });
}

function modeledCase(projection: GeneratedModeledCase["projection"]): GeneratedModeledCase {
  return Object.freeze({
    projection,
    parameterBindings: Object.freeze([]),
    primaryRuleId: "rule.ch12.3-1-memory-access.peek-addr.signature.word",
    claimedRuleIds: Object.freeze(["rule.ch12.3-1-memory-access.peek-addr.signature.word"]),
    spelling: "literal",
    validity:
      projection.kind === "valid"
        ? Object.freeze({ kind: "valid" })
        : Object.freeze({
            kind: "invalid",
            neighborId: "neighbor.fixture",
            violatedPredicateId: "predicate.fixture",
            expectedDiagnosticFamily: "fixture",
          }),
    constructionUsage: USAGE,
  });
}

describe("generated-case rendering", () => {
  it("structurally renders and independently parses a removed intrinsic argument", () => {
    const module = memoryModule();
    const generated = modeledCase(
      Object.freeze({
        kind: "invalid",
        baseline: module,
        transform: Object.freeze({
          kind: "intrinsic-argument-remove",
          callPath: "/functions/0/body/0/value",
          argumentIndex: 0,
        }),
      }),
    );

    const result = renderGeneratedCase(generated, OPTIONS);

    expect(result).toMatchObject({
      ok: true,
      kind: "invalid-source-transform",
      projection: {
        functions: [
          {
            body: [
              {
                value: {
                  kind: "invalid-memory-read",
                  intrinsic: "peek",
                  arguments: [],
                },
              },
            ],
          },
        ],
      },
    });
    if (result.ok) {
      expect(result.source).toContain("return peek();");
      expect(new TextDecoder().decode(result.sourceBytes)).toBe(result.source);
    }
  });

  it("replaces exactly one external parameter binding without changing valid source", () => {
    const module = scalarParameterModule();
    const generated: GeneratedModeledCase = Object.freeze({
      ...modeledCase(
        Object.freeze({
          kind: "invalid",
          baseline: module,
          transform: Object.freeze({
            kind: "parameter-binding-replace",
            parameterPath: "/functions/0/parameters/0",
            replacement: Object.freeze({ kind: "integer-literal", value: 256n }),
          }),
        }),
      ),
      parameterBindings: Object.freeze([
        Object.freeze({
          kind: "parameter-value",
          parameterPath: "/functions/0/parameters/0",
          value: 255n,
        }),
      ]),
    });

    expect(renderGeneratedCase(generated, OPTIONS)).toMatchObject({
      ok: true,
      kind: "invalid-parameter-binding",
      effectiveParameterBindings: [
        {
          kind: "parameter-value",
          parameterPath: "/functions/0/parameters/0",
          value: 256n,
        },
      ],
    });
  });

  it("rejects unresolved transforms, accessors and final byte-budget overflow as data", () => {
    const module = memoryModule();
    const unresolved = modeledCase(
      Object.freeze({
        kind: "invalid",
        baseline: module,
        transform: Object.freeze({
          kind: "intrinsic-argument-remove",
          callPath: "/functions/0/body/9/value",
          argumentIndex: 0,
        }),
      }),
    );
    expect(renderGeneratedCase(unresolved, OPTIONS)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "render.input.invalid" }],
    });
    expect(
      renderGeneratedCase(modeledCase({ kind: "valid", module }), {
        ...OPTIONS,
        maxSourceBytes: 1,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "render.budget.source-bytes" }],
    });

    const hostile = {};
    Object.defineProperty(hostile, "projection", {
      enumerable: true,
      get: () => {
        throw new Error("must not run");
      },
    });
    expect(
      renderGeneratedCase(
        // @ts-expect-error Hostile accessor input intentionally violates the public type.
        hostile,
        OPTIONS,
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "render.input.invalid" }],
    });
  });

  it("rejects no-op and out-of-range transforms before rendering", () => {
    const module = memoryModule();
    const noOp = modeledCase(
      Object.freeze({
        kind: "invalid",
        baseline: module,
        transform: Object.freeze({
          kind: "intrinsic-argument-replace",
          callPath: "/functions/0/body/0/value",
          argumentIndex: 0,
          argument:
            module.functions[0]?.body[0]?.kind === "return"
              ? module.functions[0].body[0].value?.kind === "memory-read"
                ? module.functions[0].body[0].value.address
                : Object.freeze({ kind: "literal" as const, type: "word" as const, value: 0n })
              : Object.freeze({ kind: "literal" as const, type: "word" as const, value: 0n }),
        }),
      }),
    );
    const outOfRange = modeledCase(
      Object.freeze({
        kind: "invalid",
        baseline: module,
        transform: Object.freeze({
          kind: "intrinsic-argument-remove",
          callPath: "/functions/0/body/0/value",
          argumentIndex: 1,
        }),
      }),
    );

    for (const generated of [noOp, outOfRange]) {
      expect(renderGeneratedCase(generated, OPTIONS)).toMatchObject({
        ok: false,
        diagnostics: [{ code: "render.input.invalid" }],
      });
    }
  });

  it("compares every transformed projection field against an independent derivation", () => {
    const module = memoryModule();
    const prepared = prepareSourceRenderInput(module, OPTIONS);
    if (!prepared.ok) throw new TypeError("expected prepared renderer input");
    const removed = deriveInvalidRoundTripProjection(
      prepared.input,
      Object.freeze({
        kind: "intrinsic-argument-remove",
        callPath: "/functions/0/body/0/value",
        argumentIndex: 0,
      }),
    );
    const replaced = deriveInvalidRoundTripProjection(
      prepared.input,
      Object.freeze({
        kind: "intrinsic-argument-replace",
        callPath: "/functions/0/body/0/value",
        argumentIndex: 0,
        argument: Object.freeze({ kind: "literal", type: "boolean", value: 0n }),
      }),
    );
    if (!removed.ok || !replaced.ok) {
      throw new TypeError("expected derived invalid projections");
    }

    expect(
      validateInvalidRoundTripProjection(removed.projection, replaced.projection),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "roundtrip-mismatch" }],
    });
    expect(
      validateInvalidRoundTripProjection(
        removed.projection,
        Object.freeze({
          ...removed.projection,
          path: Object.freeze([identifier("UnrelatedDrift")]),
        }),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "roundtrip-mismatch" }],
    });
  });
});
