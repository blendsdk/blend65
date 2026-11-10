import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { byteOffsetToPosition } from "@blend65/compiler/frontend";

const repository = join(import.meta.dirname, "../..");

/** One decoded JSON-RPC object. */
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return the LSP position of one exact source substring. */
export function positionOf(
  text: string,
  proof: string,
  occurrence = 0,
): { line: number; character: number } {
  let index = -1;
  for (let count = 0; count <= occurrence; count += 1) index = text.indexOf(proof, index + 1);
  if (index < 0) throw new Error(`Missing source proof: ${proof}`);
  const bytes = Buffer.byteLength(text.slice(0, index));
  return byteOffsetToPosition(text, bytes);
}

/** Minimal real JSON-RPC peer for the bundled stdio server. */
export class LspPeer {
  readonly child: ReturnType<typeof spawn>;
  readonly messages: unknown[] = [];
  #buffer = Buffer.alloc(0);
  #cursor = 0;
  #waiters: (() => void)[] = [];

  constructor() {
    this.child = spawn(
      process.execPath,
      [join(repository, "packages/language-server/dist/server.js")],
      { cwd: repository, stdio: ["pipe", "pipe", "pipe"] },
    );
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

  /** Send one request and wait for its exact response id. */
  async request(id: number, method: string, params: unknown): Promise<Record<string, unknown>> {
    this.send({ jsonrpc: "2.0", id, method, params });
    const message = await this.waitFor((value) => record(value) && value.id === id);
    if (!record(message)) throw new Error("Invalid response");
    return message;
  }

  /** Wait for the first later message matching one predicate. */
  async waitFor(predicate: (message: unknown) => boolean, timeout = 5_000): Promise<unknown> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      while (this.#cursor < this.messages.length) {
        const message = this.messages[this.#cursor++];
        if (predicate(message)) return message;
      }
      if (this.child.exitCode !== null || this.child.signalCode !== null) {
        throw new Error(`Language server exited; stderr=${String(this.child.stderr.read())}`);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 25);
        this.#waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    throw new Error(`Timed out; stderr=${String(this.child.stderr.read())}`);
  }

  /** Decode every complete frame currently buffered. */
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

  /** Stop the child and wait for its exit. */
  async dispose(): Promise<void> {
    if (this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill();
      await new Promise<void>((resolve) => this.child.once("exit", () => resolve()));
    }
  }
}

/** Match a diagnostics notification for one exact document URI. */
export function diagnosticsFor(uri: string, count?: number): (message: unknown) => boolean {
  return (message) => {
    if (!record(message) || message.method !== "textDocument/publishDiagnostics") return false;
    if (!record(message.params) || message.params.uri !== uri) return false;
    return (
      count === undefined ||
      (Array.isArray(message.params.diagnostics) && message.params.diagnostics.length === count)
    );
  };
}

/** Run one inspection against a real bundled server and a real temporary project. */
export async function withLspProject<T>(
  source: string,
  inspect: (peer: LspPeer, uri: string, text: string, root: string) => Promise<T>,
  options: {
    readonly extraFiles?: Readonly<Record<string, string>>;
    readonly assetPaths?: readonly string[];
    readonly waitForReady?: boolean;
  } = {},
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "blend65-rd09-lsp-"));
  const peer = new LspPeer();
  try {
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src/game.blend"), source);
    for (const [name, text] of Object.entries(options.extraFiles ?? {})) {
      const path = join(root, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, text);
    }
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "rd09-lsp",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: options.assetPaths ?? [],
        outDir: "out",
        optimization: "none",
      }),
    );
    const uri = pathToFileURL(join(root, "src/game.blend")).href;
    const initialized = await peer.request(1, "initialize", {
      processId: null,
      rootUri: null,
      capabilities: {},
    });
    if (!record(initialized.result)) throw new Error("Missing initialize result");
    peer.send({ jsonrpc: "2.0", method: "initialized", params: {} });
    peer.send({
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: { uri, languageId: "blend65", version: 1, text: source },
      },
    });
    const isDiagnostics = diagnosticsFor(uri);
    const isReady = (message: unknown): boolean =>
      record(message) &&
      message.method === "blend65/projectStatus" &&
      record(message.params) &&
      message.params.state === "ready";
    let sawDiagnostics = false;
    let sawReady = options.waitForReady === false;
    while (!sawDiagnostics || !sawReady) {
      const message = await peer.waitFor((value) => isDiagnostics(value) || isReady(value), 10_000);
      if (isDiagnostics(message)) sawDiagnostics = true;
      if (isReady(message)) sawReady = true;
    }
    return await inspect(peer, uri, source, root);
  } finally {
    await peer.dispose();
    await rm(root, { recursive: true, force: true });
  }
}
