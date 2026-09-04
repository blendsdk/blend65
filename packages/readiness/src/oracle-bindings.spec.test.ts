import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createCurrentOraclePublicationSpecFixture,
  createLegacyPublicationSpecFixture,
  createOraclePublicationSpecFixture,
} from "./test-fixtures/oracle-publication-spec-fixture.js";
import type { SpecDigest } from "./test-fixtures/oracle-publication-spec-fixture.js";

type HandlerKind = "generator" | "oracle" | "transform";

interface ImplementationRevisionInput {
  readonly contractVersion: "1.0.0";
  readonly entryPath: string;
  readonly files: readonly {
    readonly path: string;
    readonly content: Uint8Array;
  }[];
}

interface CandidateRegistration {
  readonly binding: {
    readonly handlerId: string;
    readonly kind: HandlerKind;
    readonly contractVersion: "1.0.0";
    readonly implementationRevision: SpecDigest;
    readonly implementation: (...args: readonly unknown[]) => unknown;
  };
}

type CandidateRegistrationResult =
  | {
      readonly ok: true;
      readonly registrations: readonly CandidateRegistration[];
      readonly bindings: object;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly path: string;
        readonly message: string;
      }[];
    };

type CatalogResult =
  | { readonly ok: true; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly path: string;
        readonly message: string;
      }[];
    };

type PublicationResult<T> =
  | { readonly ok: true; readonly value: T; readonly diagnostics: readonly [] }
  | {
      readonly ok: false;
      readonly diagnostics: readonly {
        readonly code: string;
        readonly path: string;
        readonly message: string;
      }[];
    };

interface CandidateApi {
  readonly registerOracleCandidateBindings: (input: unknown) => CandidateRegistrationResult;
}

interface CandidateLoaderApi {
  readonly RD03_PUBLICATION_HANDLER_IDS: readonly string[];
  readonly loadPublicationCandidatesForHandlerIds: (input: {
    readonly repositoryRoot: string;
    readonly handlerIds: readonly string[];
  }) => Promise<CatalogResult>;
}

interface LegacyPublicationApi {
  readonly prepareBindingPublicationReview: (input: { readonly repositoryRoot: string }) => Promise<
    PublicationResult<{
      readonly request: {
        readonly promotedHandlerIds: readonly string[];
      };
    }>
  >;
  readonly publishBindingTransaction: (input: {
    readonly repositoryRoot: string;
    readonly semanticReviewBytes: Uint8Array;
  }) => Promise<PublicationResult<object>>;
  readonly resolvePublishedSnapshot: (input: {
    readonly repositoryRoot: string;
  }) => Promise<PublicationResult<object>>;
}

interface ResolverApi {
  readonly resolvePublishedSnapshotByDigest: (input: {
    readonly repositoryRoot: string;
    readonly publicationDigest: SpecDigest;
  }) => Promise<PublicationResult<object>>;
  readonly getPublishedBindingRows: (snapshot: object) =>
    | readonly {
        readonly handlerId: string;
        readonly kind: HandlerKind;
        readonly contractVersion: string;
        readonly implementationRevision: SpecDigest;
      }[]
    | undefined;
}

const encoder = new TextEncoder();
const LEGACY_HANDLER_IDS = [
  "generator.compiler-cases",
  "generator.frontend-cases",
  "generator.runtime-cases",
  "transform.boundary-variants",
] as const;
const RD03_HANDLER_IDS = [
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
] as const;

function dependency(name: string, content = name): ImplementationRevisionInput {
  const path = `fixtures/${name}.ts`;
  return {
    contractVersion: "1.0.0",
    entryPath: path,
    files: [{ path, content: encoder.encode(`export const value = "${content}";\n`) }],
  };
}

function candidateDependencies(frontendContent = "frontend") {
  return {
    frontendResult: dependency("frontend-result", frontendContent),
    compilerResult: dependency("compiler-result"),
    emittedProgram: dependency("emitted-program"),
    runtimeState: dependency("runtime-state"),
    semanticRelations: dependency("semantic-relations"),
  };
}

function requireSuccess<T>(result: PublicationResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError(JSON.stringify(result.diagnostics));
  }
  return result.value;
}

function expectDiagnostic(result: unknown, code: string, path: string): void {
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
  expect(result).not.toHaveProperty("registrations");
  expect(result).not.toHaveProperty("bindings");
}

async function candidateApi(): Promise<CandidateApi> {
  return vi.importActual<CandidateApi>("./oracle-candidate-bindings.js");
}

async function loaderApi(): Promise<CandidateLoaderApi> {
  return vi.importActual<CandidateLoaderApi>("./publication-candidates.js");
}

async function legacyApi(): Promise<LegacyPublicationApi> {
  return vi.importActual<LegacyPublicationApi>("./index.js");
}

async function resolverApi(): Promise<ResolverApi> {
  return vi.importActual<ResolverApi>("./publication-resolver.js");
}

describe("oracle candidate bindings and compatible resolution", () => {
  it("preserves the one-input legacy four-handler preparation without selecting a pointer", async () => {
    const api = await legacyApi();
    const fixture = await createLegacyPublicationSpecFixture();
    try {
      expect(api.prepareBindingPublicationReview).toHaveLength(1);
      expect(api.publishBindingTransaction).toHaveLength(1);
      expect(api.resolvePublishedSnapshot).toHaveLength(1);

      const pointerPath = join(
        fixture.repositoryRoot,
        "readiness/publications/current-publication.json",
      );
      await expect(readFile(pointerPath)).rejects.toMatchObject({ code: "ENOENT" });
      const prepared = requireSuccess(
        await api.prepareBindingPublicationReview({
          repositoryRoot: fixture.repositoryRoot,
        }),
      );
      expect(prepared.request.promotedHandlerIds).toEqual(LEGACY_HANDLER_IDS);
      await expect(readFile(pointerPath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await fixture.cleanup();
    }
  });

  it("registers five fresh compatible candidates from exact content-derived dependency closures", async () => {
    const api = await candidateApi();
    const first = api.registerOracleCandidateBindings(candidateDependencies());
    expect(first).toMatchObject({ ok: true, diagnostics: [] });
    if (!first.ok) {
      throw new TypeError(JSON.stringify(first.diagnostics));
    }

    const expectedKinds = new Map<string, HandlerKind>(
      RD03_HANDLER_IDS.map((handlerId) => [
        handlerId,
        handlerId === "transform.semantic-relations" ? "transform" : "oracle",
      ]),
    );
    expect(
      first.registrations.map(({ binding }) => ({
        handlerId: binding.handlerId,
        kind: binding.kind,
        contractVersion: binding.contractVersion,
      })),
    ).toEqual(
      RD03_HANDLER_IDS.map((handlerId) => ({
        handlerId,
        kind: expectedKinds.get(handlerId),
        contractVersion: "1.0.0",
      })),
    );
    expect(
      new Set(first.registrations.map(({ binding }) => binding.implementationRevision)),
    ).toHaveLength(5);
    for (const registration of first.registrations) {
      expect(registration.binding.implementationRevision).toMatch(/^sha256:[0-9a-f]{64}$/u);
      expect(registration.binding.implementation).toBeTypeOf("function");
    }

    const changed = api.registerOracleCandidateBindings(candidateDependencies("frontend-changed"));
    expect(changed).toMatchObject({ ok: true, diagnostics: [] });
    if (!changed.ok) {
      throw new TypeError(JSON.stringify(changed.diagnostics));
    }
    const revisions = (registrations: readonly CandidateRegistration[]) =>
      new Map(
        registrations.map(({ binding }) => [binding.handlerId, binding.implementationRevision]),
      );
    const before = revisions(first.registrations);
    const after = revisions(changed.registrations);
    expect(after.get("oracle.frontend-result")).not.toBe(before.get("oracle.frontend-result"));
    for (const handlerId of RD03_HANDLER_IDS.filter(
      (handlerId) => handlerId !== "oracle.frontend-result",
    )) {
      expect(after.get(handlerId)).toBe(before.get(handlerId));
    }
  });

  it("rejects undeclared, duplicate, stale, wrong-kind, wrong-contract, and wrong-revision handlers", async () => {
    const loader = await loaderApi();
    const fixture = await createOraclePublicationSpecFixture();
    try {
      expect(loader.RD03_PUBLICATION_HANDLER_IDS).toEqual(RD03_HANDLER_IDS);
      for (const handlerIds of [
        [...RD03_HANDLER_IDS, "oracle.undeclared"],
        [RD03_HANDLER_IDS[0], RD03_HANDLER_IDS[0]],
        [RD03_HANDLER_IDS[1], RD03_HANDLER_IDS[0]],
      ]) {
        expectDiagnostic(
          await loader.loadPublicationCandidatesForHandlerIds({
            repositoryRoot: fixture.repositoryRoot,
            handlerIds,
          }),
          "implementation.dependency.invalid",
          "/handlerIds",
        );
      }

      const validator = await vi.importActual<{
        readonly validateCandidateBindings: (
          declarations: readonly unknown[],
          bindings: readonly unknown[],
        ) => unknown;
      }>("./binding-validator.js");
      const implementation = () => undefined;
      const declaration = {
        id: RD03_HANDLER_IDS[0],
        kind: "oracle",
        owner: "readiness-rd03",
        contractVersion: "1.0.0",
        binding: "unbound",
      };
      const binding = {
        handlerId: RD03_HANDLER_IDS[0],
        kind: "oracle",
        contractVersion: "1.0.0",
        implementationRevision: `sha256:${"a".repeat(64)}`,
        implementation,
      };
      for (const variant of [
        {
          declarations: [],
          bindings: [binding],
          code: "binding.declaration.missing",
          path: "/bindings/0/handlerId",
        },
        {
          declarations: [declaration],
          bindings: [binding, binding],
          code: "binding.entry.duplicate",
          path: "/bindings/1/handlerId",
        },
        {
          declarations: [declaration],
          bindings: [{ ...binding, kind: "transform" }],
          code: "binding.entry.kind",
          path: "/bindings/0/kind",
        },
        {
          declarations: [declaration],
          bindings: [{ ...binding, contractVersion: "2.0.0" }],
          code: "binding.entry.contract",
          path: "/bindings/0/contractVersion",
        },
        {
          declarations: [declaration],
          bindings: [{ ...binding, implementationRevision: "revision-stale" }],
          code: "binding.entry.revision",
          path: "/bindings/0/implementationRevision",
        },
      ]) {
        expectDiagnostic(
          validator.validateCandidateBindings(variant.declarations, variant.bindings),
          variant.code,
          variant.path,
        );
      }
    } finally {
      await fixture.cleanup();
    }
  });

  it("resolves the current executable release by its serialized four-handler binding set", async () => {
    const api = await resolverApi();
    const fixture = await createCurrentOraclePublicationSpecFixture();
    try {
      const snapshot = requireSuccess(
        await api.resolvePublishedSnapshotByDigest({
          repositoryRoot: fixture.repositoryRoot,
          publicationDigest: fixture.publicationDigest,
        }),
      );
      const rows = api.getPublishedBindingRows(snapshot);
      expect(rows).toBeDefined();
      expect(rows?.map(({ handlerId }) => handlerId)).toEqual(LEGACY_HANDLER_IDS);
      expect(rows).toHaveLength(4);
      expect(api.getPublishedBindingRows({})).toBeUndefined();
    } finally {
      await fixture.cleanup();
    }
  });
});
