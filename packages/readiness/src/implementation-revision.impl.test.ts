import { describe, expect, it, vi } from "vitest";

import {
  isFreshCandidateRegistration,
  registerFreshCandidateBinding,
} from "./binding-validator.js";
import {
  deriveImplementationRevision,
  isFreshImplementationRevision,
  validateImplementationRevision,
  type ImplementationRevisionInput,
} from "./implementation-revision.js";

const encoder = new TextEncoder();

function metadata(): ImplementationRevisionInput {
  return {
    contractVersion: "1",
    entryPath: "packages/readiness/src/handler.ts",
    files: [
      {
        path: "packages/readiness/src/dependency.ts",
        content: encoder.encode("export const value = 1;\r\n"),
      },
      {
        path: "packages/readiness/src/handler.ts",
        content: encoder.encode('import "./dependency.js";\r\n'),
      },
    ],
  };
}

function derive() {
  const result = deriveImplementationRevision(metadata());
  if (!result.ok) throw new Error("expected derived revision");
  return result;
}

function validate() {
  const derived = derive();
  const result = validateImplementationRevision({
    claimedRevision: derived.revision,
    metadata: metadata(),
  });
  if (!result.ok) throw new Error("expected fresh revision");
  return result;
}

describe("implementation dependency revisions", () => {
  it("normalizes CRLF and CR to LF without changing caller bytes", () => {
    const source = metadata();
    const before = source.files[0]?.content.slice();
    const derived = deriveImplementationRevision(source);
    expect(derived.ok).toBe(true);
    if (!derived.ok) return;

    expect(source.files[0]?.content).toEqual(before);
    expect(new TextDecoder().decode(derived.normalizedFiles[0]?.content)).toBe(
      "export const value = 1;\n",
    );
    const lfMetadata: ImplementationRevisionInput = {
      ...metadata(),
      files: [
        {
          path: "packages/readiness/src/dependency.ts",
          content: encoder.encode("export const value = 1;\n"),
        },
        {
          path: "packages/readiness/src/handler.ts",
          content: encoder.encode('import "./dependency.js";\n'),
        },
      ],
    };
    expect(deriveImplementationRevision(lfMetadata)).toMatchObject({
      ok: true,
      revision: derived.revision,
    });
    expect(Object.isFrozen(derived)).toBe(true);
    expect(Object.isFrozen(derived.normalizedFiles)).toBe(true);
    expect(Object.isFrozen(derived.normalizedFiles[0])).toBe(true);
    const standaloneCr = deriveImplementationRevision({
      contractVersion: "1",
      entryPath: "handler.ts",
      files: [{ path: "handler.ts", content: encoder.encode("a\rb") }],
    });
    expect(
      standaloneCr.ok && new TextDecoder().decode(standaloneCr.normalizedFiles[0]?.content),
    ).toBe("a\nb");
  });

  it("uses one defensive copy per dependency and reuses LF-only snapshots", () => {
    const slice = vi.spyOn(Uint8Array.prototype, "slice");
    try {
      expect(deriveImplementationRevision(metadata()).ok).toBe(true);
      expect(slice).toHaveBeenCalledTimes(2);
    } finally {
      slice.mockRestore();
    }
  });

  it.each([
    [{ ...metadata(), extra: true }, "implementation.input.invalid", ""],
    [{ ...metadata(), contractVersion: "" }, "implementation.input.invalid", "/contractVersion"],
    [
      { ...metadata(), entryPath: "/absolute.ts" },
      "implementation.dependency.invalid",
      "/entryPath",
    ],
    [
      { ...metadata(), entryPath: "../outside.ts" },
      "implementation.dependency.invalid",
      "/entryPath",
    ],
    [{ ...metadata(), entryPath: "missing.ts" }, "implementation.dependency.invalid", "/entryPath"],
    [{ ...metadata(), files: [] }, "implementation.dependency.invalid", "/files"],
    [
      { ...metadata(), files: [...metadata().files].reverse() },
      "implementation.dependency.invalid",
      "/files/1/path",
    ],
    [
      { ...metadata(), files: [metadata().files[0], metadata().files[0]] },
      "implementation.dependency.invalid",
      "/files/1/path",
    ],
    [
      {
        ...metadata(),
        files: [{ path: "packages/readiness/src/handler.ts", content: "text" }],
      },
      "implementation.input.invalid",
      "/files/0/content",
    ],
  ])("rejects invalid dependency closure data", (input, code, path) => {
    // @ts-expect-error Hostile runtime metadata is intentionally malformed.
    expect(deriveImplementationRevision(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code, path }],
    });
  });

  it("rejects accessors, sparse arrays and proxies without invoking user code", () => {
    let calls = 0;
    const accessor = metadata();
    Object.defineProperty(accessor.files[0], "content", {
      enumerable: true,
      get: () => {
        calls += 1;
        return new Uint8Array();
      },
    });
    const sparse: ImplementationRevisionInput = {
      ...metadata(),
      files: new Array(1),
    };
    const proxy = new Proxy(metadata(), {
      ownKeys: () => {
        throw new TypeError("blocked");
      },
    });

    expect(deriveImplementationRevision(accessor).ok).toBe(false);
    expect(calls).toBe(0);
    expect(deriveImplementationRevision(sparse).ok).toBe(false);
    expect(deriveImplementationRevision(proxy).ok).toBe(false);
  });

  it("rejects inherited, symbolic, accessor-backed and non-array closure containers", () => {
    const inherited: ImplementationRevisionInput = Object.create(metadata());
    const symbolic = metadata();
    Object.defineProperty(symbolic, Symbol("hidden"), { enumerable: true, value: true });
    const accessorFiles = metadata();
    Object.defineProperty(accessorFiles, "files", {
      enumerable: true,
      get: () => metadata().files,
    });
    const nonArray = { ...metadata(), files: {} };

    for (const input of [inherited, symbolic, accessorFiles, nonArray]) {
      // @ts-expect-error Hostile runtime closure containers are intentional.
      expect(deriveImplementationRevision(input).ok).toBe(false);
    }
    // @ts-expect-error Non-record metadata is intentional hostile input.
    expect(deriveImplementationRevision(null)).toMatchObject({ ok: false });
  });

  it("rejects decorated arrays and file records before content access", () => {
    const symbolicFiles = [...metadata().files];
    Object.defineProperty(symbolicFiles, Symbol("hidden"), { enumerable: true, value: true });
    const inheritedFile = Object.create(metadata().files[0]);
    const accessorFile = { ...metadata().files[0] };
    Object.defineProperty(accessorFile, "path", {
      enumerable: true,
      get: () => "packages/readiness/src/dependency.ts",
    });

    for (const files of [
      symbolicFiles,
      [inheritedFile, metadata().files[1]],
      [accessorFile, metadata().files[1]],
    ]) {
      expect(deriveImplementationRevision({ ...metadata(), files }).ok).toBe(false);
    }
  });

  it.each([
    ["packages\\readiness\\handler.ts"],
    ["packages/readiness//handler.ts"],
    ["packages/readiness/./handler.ts"],
    ["packages/readiness/../handler.ts"],
    ["packages/readiness/\u0000handler.ts"],
  ])("rejects a non-contained dependency path %s", (path) => {
    expect(
      deriveImplementationRevision({
        contractVersion: "1",
        entryPath: path,
        files: [{ path, content: new Uint8Array() }],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "implementation.dependency.invalid", path: "/entryPath" }],
    });
  });

  it("enforces the aggregate dependency byte bound", () => {
    const slice = vi.spyOn(Uint8Array.prototype, "slice");
    try {
      expect(
        deriveImplementationRevision({
          contractVersion: "1",
          entryPath: "handler.ts",
          files: [{ path: "handler.ts", content: new Uint8Array(16_777_217) }],
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "implementation.dependency.invalid", path: "/files/0" }],
      });
      expect(slice).not.toHaveBeenCalled();
    } finally {
      slice.mockRestore();
    }
  });

  it("grants freshness only after claimed revision validation", () => {
    const derived = derive();
    expect(isFreshImplementationRevision(derived)).toBe(false);
    const fresh = validate();
    expect(isFreshImplementationRevision(fresh)).toBe(true);
    expect(
      validateImplementationRevision({
        claimedRevision: `sha256:${"f".repeat(64)}`,
        metadata: metadata(),
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "implementation.revision.stale", path: "/claimedRevision" }],
    });
    expect(isFreshImplementationRevision(null)).toBe(false);
  });

  it("rejects malformed and hostile freshness envelopes as data", () => {
    const derived = derive();
    expect(
      validateImplementationRevision({
        // @ts-expect-error Runtime claimed revision is intentionally malformed.
        claimedRevision: "latest",
        metadata: metadata(),
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/claimedRevision" }],
    });
    expect(
      validateImplementationRevision({
        claimedRevision: derived.revision,
        metadata: metadata(),
        // @ts-expect-error Runtime envelope includes an unknown field.
        extra: true,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "" }],
    });
    const hostile = new Proxy(
      { claimedRevision: derived.revision, metadata: metadata() },
      {
        ownKeys: () => {
          throw new TypeError("blocked");
        },
      },
    );
    expect(validateImplementationRevision(hostile)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "implementation.input.invalid" }],
    });
    expect(
      validateImplementationRevision({
        claimedRevision: derived.revision,
        metadata: { ...metadata(), entryPath: "missing.ts" },
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "implementation.dependency.invalid" }],
    });
  });
});

describe("fresh candidate registration", () => {
  it("returns a non-forgeable registration only for matching validated freshness", () => {
    const fresh = validate();
    const binding = {
      handlerId: "generator.fixture",
      kind: "generator" as const,
      contractVersion: "1",
      implementationRevision: fresh.revision,
      implementation: () => "ready",
    };
    const result = registerFreshCandidateBinding({ binding, freshness: fresh });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isFreshCandidateRegistration(result.registration)).toBe(true);
    expect(result.registration.binding.implementation()).toBe("ready");
    expect(Object.isFrozen(result.registration)).toBe(true);
    expect(Object.isFrozen(result.registration.binding)).toBe(true);
  });

  it("rejects derived-only, mismatched and forged freshness before exposing a callable", () => {
    const derived = derive();
    const binding = {
      handlerId: "generator.fixture",
      kind: "generator" as const,
      contractVersion: "1",
      implementationRevision: derived.revision,
      implementation: () => "ready",
    };
    // @ts-expect-error derived revisions deliberately lack freshness authority
    expect(registerFreshCandidateBinding({ binding, freshness: derived })).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/freshness" }],
    });

    const fresh = validate();
    expect(
      registerFreshCandidateBinding({
        binding: { ...binding, implementationRevision: `sha256:${"f".repeat(64)}` },
        freshness: fresh,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/binding/implementationRevision" }],
    });
    expect(isFreshCandidateRegistration(Object.freeze({ binding }))).toBe(false);

    expect(
      registerFreshCandidateBinding({
        binding: { ...binding, contractVersion: "2" },
        freshness: fresh,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "binding.entry.contract", path: "/binding/contractVersion" }],
    });
  });

  it("preserves the raw Phase 1 validator while closing the authoritative seam", () => {
    const fresh = validate();
    expect(
      registerFreshCandidateBinding({
        binding: {
          handlerId: "../handler",
          kind: "generator",
          contractVersion: "1",
          implementationRevision: fresh.revision,
          implementation: () => undefined,
        },
        freshness: fresh,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/binding/handlerId" }],
    });
  });

  it("rejects malformed registration wrappers, properties and bindings as data", () => {
    const fresh = validate();
    const binding = {
      handlerId: "generator.fixture",
      kind: "generator" as const,
      contractVersion: "1",
      implementationRevision: fresh.revision,
      implementation: () => undefined,
    };
    // @ts-expect-error Non-record wrapper is intentional hostile input.
    expect(registerFreshCandidateBinding(null)).toMatchObject({ ok: false });
    expect(
      registerFreshCandidateBinding({
        binding,
        freshness: fresh,
        // @ts-expect-error Unknown wrapper property is intentional.
        extra: true,
      }),
    ).toMatchObject({ ok: false });

    const accessor = { binding, freshness: fresh };
    Object.defineProperty(accessor, "binding", {
      enumerable: true,
      get: () => binding,
    });
    expect(registerFreshCandidateBinding(accessor)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/binding" }],
    });

    const accessorBinding = { ...binding };
    Object.defineProperty(accessorBinding, "implementation", {
      enumerable: true,
      get: () => binding.implementation,
    });
    expect(
      registerFreshCandidateBinding({ binding: accessorBinding, freshness: fresh }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/binding/implementation" }],
    });

    expect(
      registerFreshCandidateBinding({
        binding: { ...binding, implementationRevision: "latest" },
        freshness: fresh,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/binding/implementationRevision" }],
    });

    const hostile = new Proxy(
      { binding, freshness: fresh },
      {
        ownKeys: () => {
          throw new TypeError("blocked");
        },
      },
    );
    expect(registerFreshCandidateBinding(hostile)).toMatchObject({ ok: false });

    const inheritedWrapper = { binding, freshness: fresh };
    Object.setPrototypeOf(inheritedWrapper, { inherited: true });
    expect(registerFreshCandidateBinding(inheritedWrapper)).toMatchObject({ ok: false });
  });
});
