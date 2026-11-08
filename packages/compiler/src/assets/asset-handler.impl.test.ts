import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ResidentAsset } from "./asset-types.js";
import type { PlacementConstraints, TypedDeclaration } from "../frontend/semantic-types.js";
import { placeSemanticAssets } from "../frontend/asset-placement.js";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { SourceSpan } from "../project/types.js";
import { SCALAR_TYPES } from "../frontend/constants.js";
import {
  createNativeOutput,
  type AssetHandler,
  type AssetHandlerRequest,
  type AssetSelectorInfo,
} from "./asset-handler.js";
import { canonicalAssetExtension, dispatchAsset, findAssetHandler } from "./asset-dispatch.js";
import { MAX_NATIVE_ASSET_BYTES, readNativeAsset } from "./raw-asset.js";

const SPAN: SourceSpan = Object.freeze({ sourceId: "src/game.blend", start: 5, end: 25 });
const temporaryRoots: string[] = [];

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function source(root: string, text: string): SourceRecord {
  return {
    sourceId: "src/game.blend",
    text,
    sha256: sha256(text),
    byteLength: Buffer.byteLength(text, "utf8"),
    resolvedPath: join(root, "src/game.blend"),
  };
}

function snapshot(root: string, assetRoots: readonly string[]): ProjectSnapshot {
  const manifestText = "{}";
  return Object.freeze({
    manifest: Object.freeze({
      schemaVersion: 1,
      name: "rd06-native-read",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: Object.freeze(assetRoots.map((path) => relative(root, path))),
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    }),
    manifestSource: Object.freeze({
      sourceId: "blend65.json",
      text: manifestText,
      sha256: sha256(manifestText),
      byteLength: Buffer.byteLength(manifestText, "utf8"),
      resolvedPath: join(root, "blend65.json"),
    }),
    sources: Object.freeze([source(root, "module Game; function main(): void {}")]),
    inputSha256: sha256(root),
    projectRoot: root,
    sourceRoot: join(root, "src"),
    assetPaths: Object.freeze([...assetRoots]),
    outDir: join(root, "out"),
    overrides: Object.freeze({ target: null, entry: null }),
    effectiveTarget: "c64-pal-prg-kernal-6581",
    effectiveEntry: "Game",
  });
}

async function freshRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-rd06-native-"));
  temporaryRoots.push(root);
  await mkdir(join(root, "src"));
  return root;
}

async function put(path: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

const SELECTORS: readonly AssetSelectorInfo[] = Object.freeze([
  Object.freeze({
    name: "sprites",
    type: Object.freeze({
      kind: "array" as const,
      array: Object.freeze({ kind: "array", element: SCALAR_TYPES.byte, length: 4, size: 4 }),
    }),
    available: true,
    default: true,
  }),
]);

function request(overrides: Partial<AssetHandlerRequest> = {}): AssetHandlerRequest {
  return Object.freeze({
    sourceId: "src/game.blend",
    literalPath: "assets/player.spd",
    resolvedPath: "assets/player.spd",
    selector: null,
    owner: "resident",
    span: SPAN,
    bytes: Object.freeze([1, 2, 3, 4]),
    inputSha256: sha256(Uint8Array.from([1, 2, 3, 4])),
    ...overrides,
  });
}

function syntheticHandler(
  parse: AssetHandler["parse"],
  overrides: Partial<AssetHandler> = {},
): AssetHandler {
  return Object.freeze({
    key: "spritepad",
    version: "3.80",
    extensions: Object.freeze([".spd"]),
    defaultSelector: "sprites",
    parse,
    ...overrides,
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("native bounded reads", () => {
  // The parser input bound is independent of the selected-output extent.
  it("should accept the exact input limit and reject one byte more", async () => {
    const root = await freshRoot();
    const assets = join(root, "assets");
    await put(join(assets, "limit.spd"), new Uint8Array(MAX_NATIVE_ASSET_BYTES));
    await put(join(assets, "over.spd"), new Uint8Array(MAX_NATIVE_ASSET_BYTES + 1));
    const project = snapshot(root, [assets]);

    const accepted = await readNativeAsset(project, "limit.spd");
    expect(accepted.kind).toBe("complete");
    const rejected = await readNativeAsset(project, "over.spd");
    expect(rejected.kind).toBe("error");
    if (rejected.kind !== "error") throw new Error("Expected an oversized failure");
    expect(rejected.diagnostics.map(({ code }) => code)).toEqual(["E10204"]);
  });

  // The native reader rejects a final symlink and an escaping target.
  it("should reject a final symlink without reading outside the project", async () => {
    const root = await freshRoot();
    const assets = join(root, "assets");
    const outside = join(root, "outside.spd");
    await put(outside, new Uint8Array([1]));
    await mkdir(assets);
    await symlink(outside, join(assets, "player.spd"), "file");
    const result = await readNativeAsset(snapshot(root, [assets]), "player.spd");
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("Expected a path failure");
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_PATH_INVALID"]);
  });

  // A changed native input cannot be silently reused under its first identity.
  it("should reject a native input changed after validation", async () => {
    const root = await freshRoot();
    const assets = join(root, "assets");
    const path = join(assets, "player.spd");
    await put(path, new Uint8Array([1, 2, 3]));
    const project = snapshot(root, [assets]);
    expect((await readNativeAsset(project, "player.spd")).kind).toBe("complete");

    await writeFile(path, new Uint8Array([4, 5, 6]));
    const result = await readNativeAsset(project, "player.spd");
    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("Expected a change failure");
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_CHANGED"]);
  });
});

describe("dispatch hardening", () => {
  // Extensions are canonical regardless of source casing.
  it("should canonicalize extension spelling for lookup", () => {
    expect(canonicalAssetExtension("assets/PLAYER.SPD")).toBe(".spd");
    expect(canonicalAssetExtension("assets/player")).toBe("");
    expect(findAssetHandler(new Map([["x", syntheticHandler(() => failure())]]), "a.SpD")).not.toBe(
      null,
    );
  });

  // A handler that returns another handler's identity is rejected as inconsistent.
  it("should reject a handler output with inconsistent identity", () => {
    const output = createNativeOutput({
      handlerKey: "charpad",
      handlerVersion: "3.80",
      request: request(),
      resolvedSelector: "sprites",
      representation: "native-bytes",
      type: Object.freeze({ kind: "array", element: SCALAR_TYPES.byte, length: 4, size: 4 }),
      bytes: Object.freeze([1, 2, 3, 4]),
      constraints: Object.freeze([]),
      selectors: SELECTORS,
    });
    const result = dispatchAsset(
      request(),
      new Map([["spritepad", syntheticHandler(() => output)]]),
      new Set([".spd"]),
    );
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected an identity failure");
    expect(result.diagnostic.code).toBe("E10204");
  });

  // A handler's missing-default failure keeps its source-linked primary span.
  it("should preserve the handler diagnostic span when no default selector exists", () => {
    const handler = syntheticHandler(
      () =>
        Object.freeze({
          kind: "failure",
          diagnostic: projectDiagnostic(
            "E10132",
            "This registered format requires a selector",
            SPAN,
          ),
        }),
      { defaultSelector: null },
    );
    const result = dispatchAsset(request(), new Map([["spritepad", handler]]), new Set([".spd"]));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected a selector failure");
    expect(result.diagnostic.code).toBe("E10132");
    expect(result.diagnostic.primarySpan).toEqual(SPAN);
  });

  // Two files with the same bytes and selector still differ by input identity.
  it("should keep input identity in the selected asset id", () => {
    const first = createNativeOutput({
      handlerKey: "spritepad",
      handlerVersion: "3.80",
      request: request(),
      resolvedSelector: "sprites",
      representation: "native-bytes",
      type: Object.freeze({ kind: "array", element: SCALAR_TYPES.byte, length: 4, size: 4 }),
      bytes: Object.freeze([1, 2, 3, 4]),
      constraints: Object.freeze([]),
      selectors: SELECTORS,
    });
    const second = createNativeOutput({
      handlerKey: "spritepad",
      handlerVersion: "3.80",
      request: request({ resolvedPath: "assets/copy.spd" }),
      resolvedSelector: "sprites",
      representation: "native-bytes",
      type: Object.freeze({ kind: "array", element: SCALAR_TYPES.byte, length: 4, size: 4 }),
      bytes: Object.freeze([1, 2, 3, 4]),
      constraints: Object.freeze([]),
      selectors: SELECTORS,
    });
    expect(first.value.assetId).not.toBe(second.value.assetId);
  });
});

function failure() {
  return Object.freeze({
    kind: "failure" as const,
    diagnostic: projectDiagnostic("E10204", "synthetic failure", SPAN),
  });
}

describe("native cache identity", () => {
  // Retargeting a contained directory symlink must not return the old file's bytes.
  it("should reject a logical spelling that now resolves to another file", async () => {
    const root = await freshRoot();
    const first = join(root, "src/targets/first/player.sid");
    const second = join(root, "src/targets/second/player.sid");
    await put(first, new Uint8Array([1, 1, 1]));
    await put(second, new Uint8Array([2, 2, 2]));
    await symlink(join(root, "src/targets/first"), join(root, "src/linked"), "dir");
    const project = snapshot(root, []);
    const admitted = await readNativeAsset(project, "linked/player.sid");
    expect(admitted.kind).toBe("complete");

    await rm(join(root, "src/linked"));
    await symlink(join(root, "src/targets/second"), join(root, "src/linked"), "dir");
    const changed = await readNativeAsset(project, "linked/player.sid");
    expect(changed.kind).toBe("error");
    if (changed.kind !== "error") throw new Error("Expected a change failure");
    expect(changed.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_CHANGED"]);
  });

  // A second spelling of one file is revalidated instead of mixing versions.
  it("should report a change reached through a second spelling", async () => {
    const root = await freshRoot();
    const assets = join(root, "assets");
    const path = join(assets, "player.sid");
    await put(path, new Uint8Array([1, 2, 3]));
    const project = snapshot(root, [assets]);
    expect((await readNativeAsset(project, "player.sid")).kind).toBe("complete");

    await writeFile(path, new Uint8Array([4, 5, 6]));
    const second = await readNativeAsset(project, "./player.sid");
    expect(second.kind).toBe("error");
    if (second.kind !== "error") throw new Error("Expected a change failure");
    expect(second.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_CHANGED"]);
  });

  // Deleting the selected candidate must not silently fall back to another root.
  it("should reject a request whose selected file disappears before a fallback root", async () => {
    const root = await freshRoot();
    const assets = join(root, "assets");
    await put(join(root, "src/player.sid"), new Uint8Array([1, 1, 1]));
    await put(join(assets, "player.sid"), new Uint8Array([2, 2, 2]));
    const project = snapshot(root, [assets]);
    expect((await readNativeAsset(project, "player.sid")).kind).toBe("complete");

    await rm(join(root, "src/player.sid"));
    const changed = await readNativeAsset(project, "player.sid");
    expect(changed.kind).toBe("error");
    if (changed.kind !== "error") throw new Error("Expected a change failure");
    expect(changed.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_CHANGED"]);
  });

  // Two logical spellings of one host file cannot become two admitted inputs.
  it("should reject a hard-link alias of an admitted native input", async () => {
    const root = await freshRoot();
    const assets = join(root, "assets");
    await put(join(assets, "player.sid"), new Uint8Array([1, 2, 3]));
    await link(join(assets, "player.sid"), join(assets, "alias.sid"));
    const project = snapshot(root, [assets]);
    expect((await readNativeAsset(project, "player.sid")).kind).toBe("complete");
    const alias = await readNativeAsset(project, "alias.sid");
    expect(alias.kind).toBe("error");
    if (alias.kind !== "error") throw new Error("Expected an alias failure");
    expect(alias.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_SOURCE_ALIAS"]);
  });
});

describe("handler and source placement intersection", () => {
  const span = Object.freeze({ sourceId: "src/game.blend", start: 0, end: 20 });
  const binding = Object.freeze({ sourceId: "src/game.blend", span });
  const arrayType = Object.freeze({
    kind: "array" as const,
    element: SCALAR_TYPES.byte,
    length: 4,
    size: 4,
  });

  /** Build one resident asset with an explicit handler constraint. */
  function resident(handlerConstraint: {
    readonly kind: "at" | "align";
    readonly value: number;
  }): ResidentAsset {
    const constraint =
      handlerConstraint.kind === "at"
        ? Object.freeze({
            kind: "at" as const,
            origin: "handler" as const,
            addressSpaceId: "cpu16" as const,
            start: handlerConstraint.value,
          })
        : Object.freeze({
            kind: "align" as const,
            origin: "handler" as const,
            bytes: handlerConstraint.value,
          });
    return Object.freeze({
      kind: "resident-asset",
      id: "asset",
      sourcePath: "assets/player.spd",
      inputSha256: "0".repeat(64),
      outputSha256: "0".repeat(64),
      bytes: Object.freeze([1, 2, 3, 4]),
      handler: Object.freeze({
        handlerKey: "spritepad",
        handlerVersion: "3.80",
        selector: "sprites",
        representation: "native-bytes",
        inputSha256: "0".repeat(64),
        outputSha256: "0".repeat(64),
        selectors: Object.freeze([]),
      }),
      constraints: Object.freeze([constraint]),
    });
  }

  /** Build one declaration that places the same asset explicitly. */
  function declaration(placement: PlacementConstraints): TypedDeclaration {
    return Object.freeze({
      kind: "typed",
      binding,
      type: arrayType,
      initializer: Object.freeze({
        kind: "name",
        span,
        type: arrayType,
        constant: null,
        binding,
        place: null,
        conversion: null,
        integer: null,
        embedded: Object.freeze({
          kind: "embedded",
          assetId: "asset",
          type: arrayType,
          constant: true,
          bytes: Object.freeze([1, 2, 3, 4]),
        }),
      }),
      body: null,
      placement,
    });
  }

  // A source address that differs from a handler fixed load is a contradiction.
  it("should reject a source address that contradicts a handler address", () => {
    const result = placeSemanticAssets(
      [resident({ kind: "at", value: 0xc000 })],
      [
        declaration({
          at: 0xc100,
          align: 1,
          noCross: null,
          region: null,
        }),
      ],
      [],
    );
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10273"]);
    expect(result.diagnostics[0]?.message).toContain("handler requirement");
  });

  // An omitted source alignment is not an explicit weakening of the handler alignment.
  it("should accept an address-only placement that satisfies the handler alignment", () => {
    const result = placeSemanticAssets(
      [resident({ kind: "align", value: 64 })],
      [declaration({ at: 0x2000, align: 1, noCross: null, region: null })],
      [],
    );
    expect(result.diagnostics).toEqual([]);
  });

  // A source address that violates the handler alignment is contradictory.
  it("should reject a source address that violates the handler alignment", () => {
    const result = placeSemanticAssets(
      [resident({ kind: "align", value: 64 })],
      [declaration({ at: 0x2001, align: 1, noCross: null, region: null })],
      [],
    );
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10273"]);
  });

  // A compatible source constraint is strengthened by the handler requirement.
  it("should retain the strongest alignment when constraints agree", () => {
    const result = placeSemanticAssets(
      [resident({ kind: "align", value: 64 })],
      [declaration({ at: null, align: 64, noCross: null, region: null })],
      [],
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.assets[0]?.kind).toBe("resident-asset");
    if (result.assets[0]?.kind !== "resident-asset") throw new Error("Expected resident bytes");
    expect(result.assets[0].placement).toMatchObject({ align: 64 });
  });
});
