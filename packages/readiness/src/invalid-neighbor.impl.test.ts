import { describe, expect, it } from "vitest";

import type { GenModule } from "./generator-ir.js";
import { applyInvalidNeighbor } from "./invalid-neighbor.js";

function baseline() {
  return {
    kind: "module",
    path: ["Neighbor"],
    constants: [],
    functions: [
      {
        kind: "function",
        name: "main",
        parameters: [],
        returnType: "void",
        body: [{ kind: "return" }],
      },
    ],
  };
}

const predicates = [
  {
    predicateId: "predicate.main-present",
    evaluate: (module: GenModule) => module.functions.some((fn) => fn.name === "main"),
  },
  {
    predicateId: "predicate.path-stable",
    evaluate: (module: GenModule) => module.path[0] === "Neighbor",
  },
];

interface NeighborFixtureInput {
  baseline: ReturnType<typeof baseline>;
  operation: {
    neighborId: string;
    targetPredicateId: string;
    diagnosticFamily: string;
    apply: (module: GenModule) => unknown;
  };
  predicates: {
    predicateId: string;
    evaluate: (module: GenModule) => boolean;
  }[];
}

function validInput(): NeighborFixtureInput {
  return {
    baseline: baseline(),
    operation: {
      neighborId: "neighbor.rename-main",
      targetPredicateId: "predicate.main-present",
      diagnosticFamily: "missing-entrypoint",
      apply: (module: GenModule) => ({
        ...module,
        functions: [{ ...module.functions[0]!, name: "renamed" }],
      }),
    },
    predicates,
  };
}

describe("invalid-neighbor validation", () => {
  it("isolates capabilities behind immutable baseline and result snapshots", () => {
    const input = validInput();
    let receivedBaseline: GenModule | undefined;
    input.operation.apply = (module: GenModule) => {
      receivedBaseline = module;
      return {
        ...module,
        functions: [{ ...module.functions[0]!, name: "renamed" }],
      };
    };

    const result = applyInvalidNeighbor(input);
    expect(result).toMatchObject({ ok: true, neighborId: "neighbor.rename-main" });
    expect(receivedBaseline).toBeDefined();
    expect(Object.isFrozen(receivedBaseline)).toBe(true);
    input.baseline.path[0] = "Changed";
    if (!result.ok) return;
    expect(result.module.path).toEqual(["Neighbor"]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.module.functions)).toBe(true);
  });

  it.each([
    [{}, ""],
    [{ ...validInput(), extra: true }, ""],
    [{ ...validInput(), predicates: "not-an-array" }, "/predicates"],
    [{ ...validInput(), predicates: [] }, "/predicates"],
    [
      {
        ...validInput(),
        operation: { ...validInput().operation, targetPredicateId: "predicate.absent" },
      },
      "/operation/targetPredicateId",
    ],
    [
      {
        ...validInput(),
        operation: { ...validInput().operation, apply: true },
      },
      "/operation",
    ],
    [
      {
        ...validInput(),
        predicates: [{ predicateId: "predicate.main-present", evaluate: true }],
      },
      "/predicates/0",
    ],
    [
      {
        ...validInput(),
        predicates: [predicates[0], predicates[0]],
      },
      "/predicates/1/predicateId",
    ],
  ])("rejects malformed capability input %#", (input, path) => {
    expect(applyInvalidNeighbor(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "neighbor-invalid", path }],
    });
  });

  it("prefixes invalid baseline diagnostics without leaking validator internals", () => {
    const input = validInput();
    input.baseline.path = [];

    expect(applyInvalidNeighbor(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "neighbor-invalid", path: "/baseline" }],
    });
  });

  it("requires every participating predicate to hold before mutation", () => {
    const input = validInput();
    input.baseline.path[0] = "AlreadyInvalid";

    expect(applyInvalidNeighbor(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "neighbor-invalid", path: "/predicates" }],
    });
  });

  it("turns operation throws and structurally invalid outputs into data failures", () => {
    const throwing = validInput();
    throwing.operation.apply = () => {
      throw new Error("operation failed");
    };
    expect(applyInvalidNeighbor(throwing)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "neighbor-invalid", path: "/operation/apply" }],
    });

    const malformed = validInput();
    malformed.operation.apply = () => ({ ...baseline(), path: [] });
    expect(applyInvalidNeighbor(malformed)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "neighbor-invalid", path: "/operation/apply" }],
    });
  });

  it("turns predicate exceptions before and after mutation into indexed failures", () => {
    const before = validInput();
    before.predicates = [
      {
        predicateId: "predicate.main-present",
        evaluate: () => {
          throw new Error("before");
        },
      },
    ];
    expect(applyInvalidNeighbor(before)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "neighbor-invalid", path: "/predicates/0/evaluate" }],
    });

    let calls = 0;
    const after = validInput();
    after.predicates = [
      {
        predicateId: "predicate.main-present",
        evaluate: () => {
          calls += 1;
          if (calls === 2) throw new Error("after");
          return true;
        },
      },
    ];
    expect(applyInvalidNeighbor(after)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "neighbor-invalid", path: "/predicates/0/evaluate" }],
    });
  });

  it("rejects a flip of the wrong predicate even when exactly one becomes false", () => {
    const input = validInput();
    input.operation.apply = (module: GenModule) => ({
      ...module,
      path: ["Changed"],
    });

    expect(applyInvalidNeighbor(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "neighbor-invalid", path: "/predicates" }],
    });
  });

  it("rejects accessor-backed capabilities before invoking them", () => {
    const input = validInput();
    Object.defineProperty(input.operation, "apply", {
      enumerable: true,
      get: () => () => baseline(),
    });

    expect(applyInvalidNeighbor(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "neighbor-invalid", path: "/operation/apply" }],
    });
  });

  it("prevents an operation from mutating the validated baseline snapshot", () => {
    const input = validInput();
    input.operation.apply = (module: GenModule) => {
      Reflect.set(module, "path", ["Changed"]);
      return module;
    };

    expect(applyInvalidNeighbor(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "neighbor-invalid", path: "/predicates" }],
    });
  });
});
