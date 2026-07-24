import { describe, expect, it } from "vitest";
import { validateCandidateBindings, validatePublishedBindings } from "./index.js";

const IMPLEMENTATION_REVISION = `sha256:${"b".repeat(64)}`;
const implementation = () => "ready";

function declaration(id: string, binding: "bound" | "unbound") {
  return {
    id,
    kind: "generator",
    owner: "fixture",
    contractVersion: "1",
    binding,
  };
}

function executableBinding(id: string) {
  return {
    handlerId: id,
    kind: "generator",
    contractVersion: "1",
    implementationRevision: IMPLEMENTATION_REVISION,
    implementation,
  };
}

describe("binding validator internals", () => {
  it("closes candidate bindings into a direct lookup without publishing them", () => {
    const result = validateCandidateBindings(
      [declaration("generator.fixture.one", "unbound")],
      [executableBinding("generator.fixture.one")],
    );

    expect(result).toMatchObject({ ok: true, diagnostics: [] });
    if (!result.ok) return;
    expect(result.bindings.get("generator.fixture.one")?.implementation()).toBe("ready");
    expect(Object.isFrozen(result.bindings.bindings)).toBe(true);
  });

  it("permits an empty candidate set without changing unrelated declarations", () => {
    expect(
      validateCandidateBindings([declaration("generator.fixture.one", "bound")], []),
    ).toMatchObject({
      ok: true,
      bindings: { bindings: [] },
      diagnostics: [],
    });
  });

  it("validates multiple published bindings bidirectionally", () => {
    const result = validatePublishedBindings(
      [
        declaration("generator.fixture.one", "bound"),
        declaration("generator.fixture.two", "bound"),
      ],
      [executableBinding("generator.fixture.one"), executableBinding("generator.fixture.two")],
    );

    expect(result).toMatchObject({
      ok: true,
      bindings: {
        bindings: [{ handlerId: "generator.fixture.one" }, { handlerId: "generator.fixture.two" }],
      },
    });
  });

  it("reports every independent incompatibility on one candidate", () => {
    const result = validateCandidateBindings(
      [declaration("generator.fixture.one", "bound")],
      [
        {
          ...executableBinding("generator.fixture.one"),
          kind: "transform",
          contractVersion: "2",
          implementationRevision: "latest",
        },
      ],
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        {
          code: "binding.entry.kind",
          path: "/bindings/0/kind",
          message: expect.any(String),
        },
        {
          code: "binding.entry.contract",
          path: "/bindings/0/contractVersion",
          message: expect.any(String),
        },
        {
          code: "binding.entry.revision",
          path: "/bindings/0/implementationRevision",
          message: expect.any(String),
        },
        {
          code: "binding.candidate.state",
          path: "/declarations/0/binding",
          message: expect.any(String),
        },
      ]),
    });
  });

  it.each([
    [
      "an extra declaration field",
      [{ ...declaration("generator.fixture.one", "unbound"), extra: true }],
      [executableBinding("generator.fixture.one")],
      "/declarations/0",
    ],
    [
      "an extra binding field",
      [declaration("generator.fixture.one", "unbound")],
      [{ ...executableBinding("generator.fixture.one"), extra: true }],
      "/bindings/0",
    ],
    [
      "a non-callable implementation",
      [declaration("generator.fixture.one", "unbound")],
      [{ ...executableBinding("generator.fixture.one"), implementation: "not-callable" }],
      "/bindings/0/implementation",
    ],
  ])("rejects $name through the closed runtime shape", (_name, declarations, bindings, path) => {
    expect(validateCandidateBindings(declarations, bindings)).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "model.schema.invalid",
          path,
          message: expect.any(String),
        },
      ],
    });
  });

  it("rejects unsupported declaration kinds and binding states", () => {
    expect(
      validateCandidateBindings(
        [{ ...declaration("generator.fixture.one", "unbound"), kind: "future" }],
        [executableBinding("generator.fixture.one")],
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "binding.entry.kind",
          path: "/declarations/0/kind",
          message: expect.any(String),
        },
      ],
    });
    expect(
      validateCandidateBindings(
        [{ ...declaration("generator.fixture.one", "unbound"), binding: "pending" }],
        [executableBinding("generator.fixture.one")],
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "binding.candidate.state",
          path: "/declarations/0/binding",
          message: expect.any(String),
        },
      ],
    });
    expect(
      validatePublishedBindings(
        [{ ...declaration("generator.fixture.one", "bound"), binding: "pending" }],
        [],
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: "binding.published.state",
          path: "/declarations/0/binding",
          message: expect.any(String),
        },
      ],
    });
  });

  it.each([
    [
      "a declaration ID",
      [{ ...declaration("generator.fixture.one", "unbound"), id: "../handler" }],
      [executableBinding("generator.fixture.one")],
      "model.schema.invalid",
      "/declarations/0/id",
    ],
    [
      "a declaration owner",
      [{ ...declaration("generator.fixture.one", "unbound"), owner: "../owner" }],
      [executableBinding("generator.fixture.one")],
      "model.schema.invalid",
      "/declarations/0/owner",
    ],
    [
      "a declaration contract",
      [{ ...declaration("generator.fixture.one", "unbound"), contractVersion: "" }],
      [executableBinding("generator.fixture.one")],
      "binding.entry.contract",
      "/declarations/0/contractVersion",
    ],
    [
      "a binding handler ID",
      [declaration("generator.fixture.one", "unbound")],
      [{ ...executableBinding("generator.fixture.one"), handlerId: "../handler" }],
      "model.schema.invalid",
      "/bindings/0/handlerId",
    ],
    [
      "a binding kind",
      [declaration("generator.fixture.one", "unbound")],
      [{ ...executableBinding("generator.fixture.one"), kind: "future" }],
      "binding.entry.kind",
      "/bindings/0/kind",
    ],
    [
      "a binding contract",
      [declaration("generator.fixture.one", "unbound")],
      [{ ...executableBinding("generator.fixture.one"), contractVersion: "" }],
      "binding.entry.contract",
      "/bindings/0/contractVersion",
    ],
    [
      "a non-string revision",
      [declaration("generator.fixture.one", "unbound")],
      [{ ...executableBinding("generator.fixture.one"), implementationRevision: 1 }],
      "binding.entry.revision",
      "/bindings/0/implementationRevision",
    ],
  ])("rejects invalid $name", (_name, declarations, bindings, code, path) => {
    expect(validateCandidateBindings(declarations, bindings)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        {
          code,
          path,
          message: expect.any(String),
        },
      ]),
    });
  });

  it("rejects inherited, accessor-backed, and non-plain records without invoking accessors", () => {
    let accessorCalls = 0;
    const accessorBinding = executableBinding("generator.fixture.one");
    Object.defineProperty(accessorBinding, "implementation", {
      configurable: true,
      enumerable: true,
      get: () => {
        accessorCalls += 1;
        return implementation;
      },
    });
    const inheritedDeclaration: unknown = Object.create(
      declaration("generator.fixture.one", "unbound"),
    );

    expect(
      validateCandidateBindings(
        [declaration("generator.fixture.one", "unbound")],
        [accessorBinding],
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.schema.invalid", path: "/bindings/0/implementation" }],
    });
    expect(accessorCalls).toBe(0);
    expect(
      validateCandidateBindings(
        [inheritedDeclaration],
        [executableBinding("generator.fixture.one")],
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "model.schema.invalid", path: "/declarations/0" }],
    });
  });

  it("rejects cyclic, sparse, symbolic, function, proxy, and non-array input shapes as data", () => {
    const cyclic: Record<string, unknown> = {
      ...declaration("generator.fixture.one", "unbound"),
    };
    cyclic.self = cyclic;
    const symbolicBinding = executableBinding("generator.fixture.one");
    Object.defineProperty(symbolicBinding, Symbol("hidden"), {
      enumerable: true,
      value: true,
    });
    const sparseDeclarations = new Array(1);
    const hostileProxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new TypeError("blocked");
        },
      },
    );

    for (const [declarations, bindings] of [
      [[cyclic], [executableBinding("generator.fixture.one")]],
      [sparseDeclarations, []],
      [[declaration("generator.fixture.one", "unbound")], [symbolicBinding]],
      [[() => undefined], []],
      [[hostileProxy], []],
      [{}, []],
    ]) {
      expect(validateCandidateBindings(declarations, bindings)).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          {
            code: "model.schema.invalid",
            path: expect.any(String),
            message: expect.any(String),
          },
        ]),
      });
    }
  });

  it("defensively clones and freezes validated binding records behind accessors", () => {
    const candidate = executableBinding("generator.fixture.one");
    const result = validateCandidateBindings(
      [declaration("generator.fixture.one", "unbound")],
      [candidate],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const validated = result.bindings.get("generator.fixture.one");
    candidate.contractVersion = "changed";

    expect(validated?.contractVersion).toBe("1");
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(result.bindings)).toBe(true);
    expect(result.bindings).not.toHaveProperty("byHandlerId");
  });
});
