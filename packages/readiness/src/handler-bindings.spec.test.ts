import { describe, expect, it } from "vitest";

import {
  getPublishedBinding,
  validateCandidateBindings,
  validatePublishedBindings,
} from "./binding-validator.js";

const HANDLER_ID = "generator.fixture.scalar";
const IMPLEMENTATION_REVISION = `sha256:${"b".repeat(64)}`;
const IMPLEMENTATION = () => undefined;

function createDeclaration(binding: "bound" | "unbound" = "unbound", kind = "generator") {
  return {
    id: HANDLER_ID,
    kind,
    owner: "fixture",
    contractVersion: "1",
    binding,
  } as const;
}

function createBinding(
  overrides: Partial<{
    handlerId: string;
    kind: string;
    contractVersion: string;
    implementationRevision: string;
    implementation: () => undefined;
  }> = {},
) {
  return {
    handlerId: HANDLER_ID,
    kind: "generator",
    contractVersion: "1",
    implementationRevision: IMPLEMENTATION_REVISION,
    implementation: IMPLEMENTATION,
    ...overrides,
  };
}

function expectDiagnostic(
  result:
    | ReturnType<typeof validateCandidateBindings>
    | ReturnType<typeof validatePublishedBindings>,
  code: string,
  path: string,
): void {
  expect(result).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      {
        code,
        path,
        message: expect.any(String),
      },
    ]),
  });
}

describe("candidate handler bindings", () => {
  it("validates one compatible unbound declaration without creating a published snapshot", () => {
    const result = validateCandidateBindings([createDeclaration()], [createBinding()]);

    expect(result).toMatchObject({
      ok: true,
      diagnostics: [],
    });

    const candidateLookupCannotBeCalled = (): void => {
      if (!result.ok) {
        return;
      }

      // @ts-expect-error Candidate bindings are not a trusted publication snapshot.
      getPublishedBinding(result.bindings, HANDLER_ID);
    };

    expect(candidateLookupCannotBeCalled).toBeTypeOf("function");
  });

  it.each([
    {
      name: "an undeclared handler",
      declarations: [],
      bindings: [createBinding()],
      code: "binding.declaration.missing",
      path: "/bindings/0/handlerId",
    },
    {
      name: "a duplicate declaration",
      declarations: [createDeclaration(), createDeclaration()],
      bindings: [createBinding()],
      code: "binding.declaration.duplicate",
      path: "/declarations/1/id",
    },
    {
      name: "a duplicate binding",
      declarations: [createDeclaration()],
      bindings: [createBinding(), createBinding()],
      code: "binding.entry.duplicate",
      path: "/bindings/1/handlerId",
    },
    {
      name: "a kind mismatch",
      declarations: [createDeclaration("unbound", "generator")],
      bindings: [createBinding({ kind: "transform" })],
      code: "binding.entry.kind",
      path: "/bindings/0/kind",
    },
    {
      name: "a contract mismatch",
      declarations: [createDeclaration()],
      bindings: [createBinding({ contractVersion: "2" })],
      code: "binding.entry.contract",
      path: "/bindings/0/contractVersion",
    },
    {
      name: "a non-canonical implementation revision",
      declarations: [createDeclaration()],
      bindings: [createBinding({ implementationRevision: "revision-latest" })],
      code: "binding.entry.revision",
      path: "/bindings/0/implementationRevision",
    },
    {
      name: "a declaration that is already bound",
      declarations: [createDeclaration("bound")],
      bindings: [createBinding()],
      code: "binding.candidate.state",
      path: "/declarations/0/binding",
    },
  ])("rejects $name", ({ declarations, bindings, code, path }) => {
    const result = validateCandidateBindings(declarations, bindings);

    expectDiagnostic(result, code, path);
  });
});

describe("published handler bindings", () => {
  it("accepts exactly one compatible binding for each bound declaration", () => {
    const result = validatePublishedBindings(
      [
        createDeclaration("bound"),
        {
          ...createDeclaration("unbound"),
          id: "oracle.fixture.semantic",
          kind: "oracle",
        },
      ],
      [createBinding()],
    );

    expect(result).toMatchObject({
      ok: true,
      diagnostics: [],
    });
  });

  it.each([
    {
      name: "an undeclared published handler",
      declarations: [],
      bindings: [createBinding()],
      code: "binding.declaration.missing",
      path: "/bindings/0/handlerId",
    },
    {
      name: "duplicate declarations",
      declarations: [createDeclaration("bound"), createDeclaration("bound")],
      bindings: [createBinding()],
      code: "binding.declaration.duplicate",
      path: "/declarations/1/id",
    },
    {
      name: "duplicate published bindings",
      declarations: [createDeclaration("bound")],
      bindings: [createBinding(), createBinding()],
      code: "binding.entry.duplicate",
      path: "/bindings/1/handlerId",
    },
    {
      name: "a published kind mismatch",
      declarations: [createDeclaration("bound")],
      bindings: [createBinding({ kind: "transform" })],
      code: "binding.entry.kind",
      path: "/bindings/0/kind",
    },
    {
      name: "a published contract mismatch",
      declarations: [createDeclaration("bound")],
      bindings: [createBinding({ contractVersion: "2" })],
      code: "binding.entry.contract",
      path: "/bindings/0/contractVersion",
    },
    {
      name: "a non-canonical published revision",
      declarations: [createDeclaration("bound")],
      bindings: [createBinding({ implementationRevision: "revision-latest" })],
      code: "binding.entry.revision",
      path: "/bindings/0/implementationRevision",
    },
    {
      name: "a binding for an unbound declaration",
      declarations: [createDeclaration("unbound")],
      bindings: [createBinding()],
      code: "binding.published.state",
      path: "/declarations/0/binding",
    },
    {
      name: "a bound declaration with no binding",
      declarations: [createDeclaration("bound")],
      bindings: [],
      code: "binding.published.missing",
      path: "/declarations/0/id",
    },
  ])("rejects $name", ({ declarations, bindings, code, path }) => {
    const result = validatePublishedBindings(declarations, bindings);

    expectDiagnostic(result, code, path);
  });
});
