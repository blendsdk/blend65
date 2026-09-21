import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { loadProject } from "@blend65/compiler/frontend";

const packageRoot = join(import.meta.dirname, "..");

/** Collect one child process without permitting an unbounded server test. */
async function collect(
  child: ReturnType<typeof spawn>,
): Promise<{ readonly code: number | null; readonly signal: NodeJS.Signals | null }> {
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Language server did not terminate"));
    }, 3_000);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
}

/** Wait for one framed response before sending the next protocol lifecycle message. */
async function waitForResponse(child: ReturnType<typeof spawn>, id: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Missing response ${id}`)), 3_000);
    const onData = (chunk: Buffer) => {
      if (!chunk.toString("utf8").includes(`\"id\":${id}`)) return;
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      resolve();
    };
    child.stdout.on("data", onData);
  });
}

/** Write one complete Content-Length JSON-RPC frame. */
function send(child: ReturnType<typeof spawn>, message: unknown): void {
  const body = Buffer.from(JSON.stringify(message));
  child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
  child.stdin.write(body);
}

/** Narrow untrusted JSON-RPC messages before inspecting their fields. */
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Small framed peer for implementation-only stale-state regressions. */
class ProtocolPeer {
  readonly child: ReturnType<typeof spawn>;
  readonly messages: unknown[] = [];
  #buffer = Buffer.alloc(0);
  #cursor = 0;
  #waiters: (() => void)[] = [];

  constructor() {
    this.child = spawn(process.execPath, [join(packageRoot, "dist/server.js")], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.on("data", (chunk: Buffer) => {
      this.#buffer = Buffer.concat([this.#buffer, chunk]);
      this.#drain();
    });
  }

  /** Write one JSON-RPC message. */
  send(message: unknown): void {
    send(this.child, message);
  }

  /** Wait for a later message matching the requested state. */
  async waitFor(predicate: (message: unknown) => boolean): Promise<unknown> {
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      while (this.#cursor < this.messages.length) {
        const message = this.messages[this.#cursor++];
        if (predicate(message)) return message;
      }
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 50);
        this.#waiters.push(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    throw new Error("Timed out waiting for language-server state");
  }

  /** Decode every complete Content-Length frame. */
  #drain(): void {
    for (;;) {
      const boundary = this.#buffer.indexOf("\r\n\r\n");
      if (boundary < 0) return;
      const header = this.#buffer.subarray(0, boundary).toString("ascii");
      const length = /^Content-Length: (\d+)$/imu.exec(header)?.[1];
      if (length === undefined) throw new Error("Missing Content-Length");
      const start = boundary + 4;
      const end = start + Number(length);
      if (this.#buffer.length < end) return;
      this.messages.push(JSON.parse(this.#buffer.subarray(start, end).toString("utf8")));
      this.#buffer = this.#buffer.subarray(end);
      for (const wake of this.#waiters.splice(0)) wake();
    }
  }
}

/** Match a diagnostics notification containing exactly the requested codes. */
function diagnostics(uri: string, codes: readonly string[]): (message: unknown) => boolean {
  return (message) => {
    if (!record(message) || message.method !== "textDocument/publishDiagnostics") return false;
    if (!record(message.params) || message.params.uri !== uri) return false;
    if (!Array.isArray(message.params.diagnostics)) return false;
    return (
      message.params.diagnostics
        .map((diagnostic) => (record(diagnostic) ? diagnostic.code : null))
        .every((code, index) => code === codes[index]) &&
      message.params.diagnostics.length === codes.length
    );
  };
}

/** Write a two-source project whose helper begins with one semantic error. */
async function staleProject(): Promise<{
  readonly root: string;
  readonly gamePath: string;
  readonly gameUri: string;
  readonly helperPath: string;
  readonly helperUri: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "blend65-lsp-stale-"));
  const files = {
    "blend65.json": JSON.stringify({
      schemaVersion: 1,
      name: "stale-state",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
    }),
    "src/game.blend":
      "module Game; import { helper } from Helper; function main(): void { helper(); }",
    "src/helper.blend": "module Helper; export function helper(): void { missing(); }",
  };
  for (const [name, text] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  }
  const gamePath = join(root, "src/game.blend");
  const helperPath = join(root, "src/helper.blend");
  return {
    root,
    gamePath,
    gameUri: pathToFileURL(gamePath).href,
    helperPath,
    helperUri: pathToFileURL(helperPath).href,
  };
}

describe("language-server implementation bounds", () => {
  it("stops a project load before discovery when its request is already superseded", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadProject({ cwd: packageRoot, signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("owns stdio shutdown and exits successfully after the LSP shutdown sequence", async () => {
    const child = spawn(process.execPath, [join(packageRoot, "dist/server.js")], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const initialized = waitForResponse(child, 1);
    send(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { processId: null, rootUri: null, capabilities: {} },
    });
    await initialized;
    send(child, { jsonrpc: "2.0", method: "initialized", params: {} });
    const shutdown = waitForResponse(child, 2);
    send(child, { jsonrpc: "2.0", id: 2, method: "shutdown", params: null });
    await shutdown;
    send(child, { jsonrpc: "2.0", method: "exit", params: null });
    child.stdin.end();
    await expect(collect(child)).resolves.toEqual({ code: 0, signal: null });
  });

  it("replaces diagnostics when a source disappears or the newest project load fails", async () => {
    const fixture = await staleProject();
    const peer = new ProtocolPeer();
    try {
      peer.send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { processId: null, rootUri: null, capabilities: {} },
      });
      await peer.waitFor((message) => record(message) && message.id === 1);
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
      await peer.waitFor(diagnostics(fixture.gameUri, []));
      const helperText = "module Helper; export function helper(): void { missing(); }";
      peer.send({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            uri: fixture.helperUri,
            languageId: "blend65",
            version: 1,
            text: helperText,
          },
        },
      });
      await peer.waitFor(diagnostics(fixture.helperUri, ["E10239"]));

      await unlink(fixture.helperPath);
      peer.send({
        jsonrpc: "2.0",
        method: "textDocument/didChange",
        params: {
          textDocument: { uri: fixture.helperUri, version: 2 },
          contentChanges: [{ text: helperText }],
        },
      });
      await peer.waitFor(diagnostics(fixture.helperUri, []));

      await unlink(fixture.gamePath);
      peer.send({
        jsonrpc: "2.0",
        method: "textDocument/didChange",
        params: {
          textDocument: { uri: fixture.gameUri, version: 2 },
          contentChanges: [
            {
              text: "module Game; import { helper } from Helper; function main(): void { helper(); }",
            },
          ],
        },
      });
      await peer.waitFor(diagnostics(fixture.gameUri, ["PROJECT_EMPTY_SOURCES"]));
    } finally {
      if (peer.child.exitCode === null && peer.child.signalCode === null) {
        peer.child.kill();
        await new Promise<void>((resolve) => peer.child.once("exit", () => resolve()));
      }
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("keeps the emitted server free of backend and file-write imports", async () => {
    const bundle = await readFile(join(packageRoot, "dist/server.js"), "utf8");
    expect(bundle).toContain("@blend65/compiler/frontend");
    expect(bundle).not.toMatch(
      /@blend65\/compiler(?:["']|\/(?:target|semantic|storage|machine|layout|artifacts|publication|tools|services))/,
    );
    expect(bundle).not.toMatch(/node:fs(?!\/promises)|writeFile|appendFile|createWriteStream/);
  });
});
