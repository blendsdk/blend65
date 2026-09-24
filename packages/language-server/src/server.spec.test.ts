import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  ANALYSIS_RESULT_KIND,
  analyzeProject,
  analyzeProjectOverlay,
  byteOffsetToPosition,
} from "@blend65/compiler/frontend";
import type { ProjectSnapshot, SourceOverlay, SourceRecord } from "@blend65/compiler/frontend";

const repository = join(import.meta.dirname, "../../..");
const temporaryRoots: string[] = [];
const runningServers: ReturnType<typeof spawn>[] = [];

/** Hash exact UTF-8 text for an immutable synthetic source record. */
function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Build one trusted source record without involving host discovery. */
function source(
  sourceId: string,
  text: string,
  byteLength = Buffer.byteLength(text),
): SourceRecord {
  return Object.freeze({
    sourceId,
    text,
    sha256: hash(text),
    byteLength,
    resolvedPath: `/project/${sourceId}`,
  });
}

/** Build the smallest complete immutable snapshot accepted by frontend analysis. */
function snapshot(sources: readonly SourceRecord[]): ProjectSnapshot {
  const manifestSource = source("blend65.json", "{}");
  return Object.freeze({
    manifest: Object.freeze({
      schemaVersion: 1,
      name: "editor-spec",
      sourceRoot: "src",
      entry: "Game",
      target: "test.target",
      assetPaths: Object.freeze([]),
      outDir: "out",
      optimization: "none",
      boundsCheck: true,
      divisionZeroCheck: true,
    }),
    manifestSource,
    sources: Object.freeze([...sources]),
    inputSha256: hash(sources.map(({ sourceId, sha256 }) => `${sourceId}:${sha256}`).join("\n")),
    projectRoot: "/project",
    sourceRoot: "/project/src",
    assetPaths: Object.freeze([]),
    outDir: "/project/out",
    overrides: Object.freeze({ target: null, entry: null }),
    effectiveTarget: "test.target",
    effectiveEntry: "Game",
  });
}

/** Create a real minimal Blend65 project for the stdio protocol tests. */
async function project(): Promise<{
  readonly root: string;
  readonly gameUri: string;
  readonly helperUri: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "blend65-lsp-spec-"));
  temporaryRoots.push(root);
  const files = {
    "blend65.json": JSON.stringify({
      schemaVersion: 1,
      name: "editor-protocol",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
    }),
    "src/game.blend":
      "module Game; import { helper } from Helper; function main(): void { helper(); }",
    "src/helper.blend": "module Helper; export function helper(): void {}",
  };
  for (const [name, text] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  }
  return {
    root,
    gameUri: pathToFileURL(join(root, "src/game.blend")).href,
    helperUri: pathToFileURL(join(root, "src/helper.blend")).href,
  };
}

/** JSON object guard for untrusted protocol messages. */
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Minimal real JSON-RPC peer for exercising the bundled stdio server. */
class ProtocolPeer {
  readonly child: ReturnType<typeof spawn>;
  readonly messages: unknown[] = [];
  #buffer = Buffer.alloc(0);
  #cursor = 0;
  #waiters: (() => void)[] = [];

  constructor() {
    this.child = spawn(
      process.execPath,
      [join(repository, "packages/language-server/dist/server.js")],
      {
        cwd: repository,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    runningServers.push(this.child);
    this.child.stdout.on("data", (chunk: Buffer) => {
      this.#buffer = Buffer.concat([this.#buffer, chunk]);
      this.#drain();
    });
  }

  /** Send one framed JSON-RPC message. */
  send(message: unknown): void {
    const body = Buffer.from(JSON.stringify(message));
    this.child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
    this.child.stdin.write(body);
  }

  /** Wait for the first later message matching a narrow predicate. */
  async waitFor(predicate: (message: unknown) => boolean): Promise<unknown> {
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      while (this.#cursor < this.messages.length) {
        const message = this.messages[this.#cursor++];
        if (predicate(message)) return message;
      }
      if (this.child.exitCode !== null || this.child.signalCode !== null) {
        throw new Error(
          `Language server exited before the expected message; stderr=${this.child.stderr.read()}`,
        );
      }
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 50);
        this.#waiters.push(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    throw new Error(`Timed out waiting for protocol message; stderr=${this.child.stderr.read()}`);
  }

  /** Decode every complete Content-Length frame currently buffered. */
  #drain(): void {
    for (;;) {
      const boundary = this.#buffer.indexOf("\r\n\r\n");
      if (boundary < 0) return;
      const header = this.#buffer.subarray(0, boundary).toString("ascii");
      const length = /^Content-Length: (\d+)$/imu.exec(header)?.[1];
      if (length === undefined) throw new Error(`Missing Content-Length in ${header}`);
      const bodyStart = boundary + 4;
      const bodyEnd = bodyStart + Number(length);
      if (this.#buffer.length < bodyEnd) return;
      this.messages.push(JSON.parse(this.#buffer.subarray(bodyStart, bodyEnd).toString("utf8")));
      this.#buffer = this.#buffer.subarray(bodyEnd);
      for (const wake of this.#waiters.splice(0)) wake();
    }
  }
}

/** Match a diagnostics notification for one exact document URI. */
function diagnosticsFor(uri: string, count?: number): (message: unknown) => boolean {
  return (message) => {
    if (!record(message) || message.method !== "textDocument/publishDiagnostics") return false;
    if (!record(message.params) || message.params.uri !== uri) return false;
    return (
      count === undefined ||
      (Array.isArray(message.params.diagnostics) && message.params.diagnostics.length === count)
    );
  };
}

afterEach(async () => {
  for (const child of runningServers.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    }
  }
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("bounded frontend overlays", () => {
  it("analyzes known sibling overlays without changing the snapshot and returns to disk content", async () => {
    const game = source(
      "src/game.blend",
      "module Game; import { helper } from Helper; function main(): void { helper(); }",
    );
    const helper = source("src/helper.blend", "module Helper; export function helper(): void {}");
    const projectSnapshot = snapshot([game, helper]);
    const before = JSON.stringify(projectSnapshot);
    const overlays: readonly SourceOverlay[] = Object.freeze([
      Object.freeze({
        sourceId: helper.sourceId,
        text: "module Helper; export function helper(): void { missing(); }",
      }),
    ]);

    const changed = await analyzeProjectOverlay(projectSnapshot, overlays);
    expect(changed.diagnostics.map(({ code }) => code)).toContain("E10239");
    expect(changed.diagnostics[0]?.primarySpan?.sourceId).toBe(helper.sourceId);
    expect(JSON.stringify(projectSnapshot)).toBe(before);

    const closed = analyzeProject(projectSnapshot);
    expect(closed.kind).toBe(ANALYSIS_RESULT_KIND.complete);
    expect(closed.diagnostics).toEqual([]);
  });

  it.each([
    {
      name: "unknown source",
      overlays: [{ sourceId: "src/unknown.blend", text: "module Unknown;" }],
      code: "PROJECT_PATH_INVALID",
    },
    {
      name: "duplicate source",
      overlays: [
        { sourceId: "src/game.blend", text: "module Game; function main(): void {}" },
        { sourceId: "src/game.blend", text: "module Game; function main(): void {}" },
      ],
      code: "PROJECT_PATH_INVALID",
    },
    {
      name: "unpaired Unicode",
      overlays: [{ sourceId: "src/game.blend", text: "module Game; //\ud800" }],
      code: "PROJECT_INVALID_UTF8",
    },
  ])("rejects $name with its stable host diagnostic", async ({ overlays, code }) => {
    const result = await analyzeProjectOverlay(
      snapshot([source("src/game.blend", "module Game; function main(): void {}")]),
      overlays,
    );
    expect(result.kind).toBe(ANALYSIS_RESULT_KIND.error);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([code]);
  });

  it("enforces the fixed per-source count and effective-project bounds before analysis", async () => {
    const fourMiB = " ".repeat(4 * 1024 * 1024);
    const ordinary = source("src/game.blend", "module Game; function main(): void {}");
    const tooLarge = await analyzeProjectOverlay(snapshot([ordinary]), [
      { sourceId: ordinary.sourceId, text: `${fourMiB}x` },
    ]);
    expect(tooLarge.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_HOST_LIMIT"]);

    const shared = source("src/shared.blend", fourMiB, fourMiB.length);
    const aggregateSources = Array.from({ length: 65 }, (_, index) =>
      Object.freeze({
        ...shared,
        sourceId: `src/s${index}.blend`,
        resolvedPath: `/project/src/s${index}.blend`,
      }),
    );
    const aggregate = await analyzeProjectOverlay(snapshot(aggregateSources), []);
    expect(aggregate.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_HOST_LIMIT"]);

    const countedSources = Array.from({ length: 10_001 }, (_, index) =>
      source(`src/c${index}.blend`, "module Counted;"),
    );
    const counted = await analyzeProjectOverlay(snapshot(countedSources), []);
    expect(counted.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_HOST_LIMIT"]);
  });

  it("maps raw UTF-8 boundaries to exact zero-based UTF-16 positions", () => {
    const text = "Aé🎮\r\nZ";
    expect(byteOffsetToPosition(text, 0)).toEqual({ line: 0, character: 0 });
    expect(byteOffsetToPosition(text, 3)).toEqual({ line: 0, character: 2 });
    expect(byteOffsetToPosition(text, 7)).toEqual({ line: 0, character: 4 });
    expect(byteOffsetToPosition(text, Buffer.byteLength(text))).toEqual({ line: 1, character: 1 });
  });
});

describe("diagnostics-only stdio language server", () => {
  it("advertises only synchronization and publishes the newest sibling overlay state", async () => {
    const fixture = await project();
    const peer = new ProtocolPeer();
    peer.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { processId: null, rootUri: null, capabilities: {} },
    });
    const initialized = await peer.waitFor((message) => record(message) && message.id === 1);
    expect(initialized).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: { capabilities: { textDocumentSync: expect.anything() } },
    });
    if (
      !record(initialized) ||
      !record(initialized.result) ||
      !record(initialized.result.capabilities)
    ) {
      throw new Error("Invalid initialize response");
    }
    expect(Object.keys(initialized.result.capabilities)).toEqual(["textDocumentSync"]);
    peer.send({ jsonrpc: "2.0", method: "initialized", params: {} });
    peer.send({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: fixture.gameUri,
          languageId: "blend65",
          version: 1,
          text: "module Game; import { helper } from Helper; function main(): void { helper(); }",
        },
      },
    });
    await peer.waitFor(diagnosticsFor(fixture.gameUri, 0));
    peer.send({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: fixture.helperUri,
          languageId: "blend65",
          version: 1,
          text: "module Helper; export function helper(): void { missing(); }",
        },
      },
    });
    const invalid = await peer.waitFor(diagnosticsFor(fixture.helperUri));
    expect(invalid).toMatchObject({
      params: { diagnostics: [expect.objectContaining({ code: "E10239", severity: 1 })] },
    });

    peer.send({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: {
        textDocument: { uri: fixture.helperUri, version: 2 },
        contentChanges: [
          { text: "module Helper; export function helper(): void { missingAgain(); }" },
        ],
      },
    });
    peer.send({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: {
        textDocument: { uri: fixture.helperUri, version: 3 },
        contentChanges: [{ text: "module Helper; export function helper(): void {}" }],
      },
    });
    await peer.waitFor(diagnosticsFor(fixture.helperUri, 0));
    peer.send({
      jsonrpc: "2.0",
      method: "textDocument/didSave",
      params: { textDocument: { uri: fixture.helperUri } },
    });
    await peer.waitFor(diagnosticsFor(fixture.helperUri, 0));
    peer.send({
      jsonrpc: "2.0",
      method: "textDocument/didClose",
      params: { textDocument: { uri: fixture.helperUri } },
    });
    await peer.waitFor(diagnosticsFor(fixture.helperUri, 0));

    peer.send({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: "untitled:escape.blend",
          languageId: "blend65",
          version: 1,
          text: "missing",
        },
      },
    });
    expect(peer.messages.some(diagnosticsFor("untitled:escape.blend"))).toBe(false);
  });

  it("publishes non-ASCII primary and related byte spans as UTF-16 ranges", async () => {
    const fixture = await project();
    const peer = new ProtocolPeer();
    peer.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { processId: null, rootUri: null, capabilities: {} },
    });
    await peer.waitFor((message) => record(message) && message.id === 1);
    peer.send({ jsonrpc: "2.0", method: "initialized", params: {} });
    const text = [
      "module Game; // é🎮",
      "let value: byte = 1;",
      "let value: byte = 2;",
      "function main(): void {}",
    ].join("\n");
    peer.send({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: { textDocument: { uri: fixture.gameUri, languageId: "blend65", version: 1, text } },
    });
    const published = await peer.waitFor(diagnosticsFor(fixture.gameUri));
    expect(published).toMatchObject({
      params: {
        diagnostics: [
          expect.objectContaining({
            code: "E10003",
            range: { start: { line: 2, character: 4 }, end: { line: 2, character: 9 } },
            relatedInformation: [
              expect.objectContaining({
                location: {
                  uri: fixture.gameUri,
                  range: { start: { line: 1, character: 4 }, end: { line: 1, character: 9 } },
                },
              }),
            ],
          }),
        ],
      },
    });

    const incomplete = "module Game; // é🎮\nfunction main(): void {";
    peer.send({
      jsonrpc: "2.0",
      method: "textDocument/didChange",
      params: {
        textDocument: { uri: fixture.gameUri, version: 2 },
        contentChanges: [{ text: incomplete }],
      },
    });
    const eof = await peer.waitFor(diagnosticsFor(fixture.gameUri));
    expect(eof).toMatchObject({
      params: {
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            range: {
              start: { line: 1, character: 23 },
              end: { line: 1, character: 23 },
            },
          }),
        ]),
      },
    });
  });
});
