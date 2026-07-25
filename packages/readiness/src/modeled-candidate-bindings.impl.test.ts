import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { isFreshCandidateRegistration } from "./binding-validator.js";
import type { ImplementationRevisionInput } from "./implementation-revision.js";
import { registerModeledCandidateBindings } from "./modeled-candidate-bindings.js";
import {
  MODELED_BOUNDARY_REVISION,
  MODELED_GENERATOR_REVISION,
  type GeneratedCandidateRevision,
} from "./modeled-candidate-revisions.generated.js";

async function metadata(
  expected: GeneratedCandidateRevision,
): Promise<ImplementationRevisionInput> {
  const files = await Promise.all(
    expected.dependencyPaths.map(async (path) => ({
      path,
      content: await readFile(new URL(`../../../${path}`, import.meta.url)),
    })),
  );
  return {
    contractVersion: "1.0.0",
    entryPath: expected.entryPath,
    files,
  };
}

describe("modeled candidate registrations", () => {
  it("derives revisions and freshness-gates all four candidate-only callables", async () => {
    const generatorMetadata = await metadata(MODELED_GENERATOR_REVISION);
    const boundaryMetadata = await metadata(MODELED_BOUNDARY_REVISION);
    const result = registerModeledCandidateBindings({
      frontend: generatorMetadata,
      compiler: generatorMetadata,
      runtime: generatorMetadata,
      boundary: boundaryMetadata,
    });

    expect(result).toMatchObject({ ok: true, diagnostics: [] });
    if (!result.ok) return;
    expect(result.registrations).toHaveLength(4);
    expect(result.registrations.map(({ binding }) => binding.handlerId)).toEqual([
      "generator.frontend-cases",
      "generator.compiler-cases",
      "generator.runtime-cases",
      "transform.boundary-variants",
    ]);
    expect(result.registrations.every(isFreshCandidateRegistration)).toBe(true);
    expect(result.bindings.bindings).toHaveLength(4);
  });

  it("rejects one changed dependency byte against generated closure authority", async () => {
    const generatorMetadata = await metadata(MODELED_GENERATOR_REVISION);
    const boundaryMetadata = await metadata(MODELED_BOUNDARY_REVISION);
    const first = generatorMetadata.files[0];
    if (first === undefined) throw new TypeError("Generated closure must contain files.");
    const changed = {
      ...generatorMetadata,
      files: [
        { ...first, content: new Uint8Array([...first.content, 0x0a]) },
        ...generatorMetadata.files.slice(1),
      ],
    };

    expect(
      registerModeledCandidateBindings({
        frontend: changed,
        compiler: generatorMetadata,
        runtime: generatorMetadata,
        boundary: boundaryMetadata,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "implementation.revision.stale" }],
    });
  });

  it("fails closed before reading accessor-backed dependency fields", () => {
    const hostile = Object.defineProperty({}, "frontend", {
      enumerable: true,
      get: () => {
        throw new Error("must not execute");
      },
    });

    expect(() => registerModeledCandidateBindings(hostile)).not.toThrow();
    expect(registerModeledCandidateBindings(hostile)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "implementation.input.invalid" }],
    });

    const topLevel = Proxy.revocable({}, {});
    topLevel.revoke();
    expect(() => registerModeledCandidateBindings(topLevel.proxy)).not.toThrow();
    expect(registerModeledCandidateBindings(topLevel.proxy)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "implementation.input.invalid" }],
    });

    const nested = Proxy.revocable({}, {});
    nested.revoke();
    const nestedHostile = {
      frontend: nested.proxy,
      compiler: nested.proxy,
      runtime: nested.proxy,
      boundary: nested.proxy,
    };
    expect(() => registerModeledCandidateBindings(nestedHostile)).not.toThrow();
    expect(registerModeledCandidateBindings(nestedHostile)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "implementation.input.invalid" }],
    });
  });
});
