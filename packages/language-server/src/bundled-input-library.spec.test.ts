import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  analyzeProjectOverlay,
  byteOffsetToPosition,
  loadProject,
} from "@blend65/compiler/frontend";
import { describe, expect, it } from "vitest";

const repository = join(import.meta.dirname, "../../..");
const compilerRoot = join(repository, "packages/compiler");
const serverRoot = join(repository, "packages/language-server");
const dependencyRoot = dirname(createRequire(import.meta.url).resolve("jsonc-parser/package.json"));
const libraryId = "@blend65/stdlib/c64/input.blend";
const masks = [
  ["joystickUpMask", 1],
  ["joystickDownMask", 2],
  ["joystickLeftMask", 4],
  ["joystickRightMask", 8],
  ["joystickFireMask", 16],
  ["joystickControlsMask", 31],
] as const;
const libraryText = `module c64.input;\n${masks.map(([name, value]) => `export const ${name}: byte = ${value};`).join("\n")}\n`;
const emptyRange = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate protocol JSON before treating it as diagnostic evidence. */
function object(value: unknown): Record<string, unknown> {
  expect(isRecord(value)).toBe(true);
  if (!isRecord(value)) throw new Error("Expected a protocol object");
  return value;
}

function objects(value: unknown): Record<string, unknown>[] {
  expect(Array.isArray(value)).toBe(true);
  if (!Array.isArray(value)) throw new Error("Expected protocol records");
  return value.map((item: unknown) => object(item));
}

/** Calculate exact UTF-16 ranges from independently selected UTF-8 proving bytes. */
function range(text: string, proof: string) {
  const index = text.indexOf(proof);
  expect(index).toBeGreaterThanOrEqual(0);
  const start = Buffer.byteLength(text.slice(0, index));
  return {
    start: byteOffsetToPosition(text, start),
    end: byteOffsetToPosition(text, start + Buffer.byteLength(proof)),
  };
}

/** Small framed peer for the real published executable, independent of server implementation. */
class Peer {
  readonly child: ChildProcessWithoutNullStreams;
  readonly messages: unknown[] = [];
  #buffer = Buffer.alloc(0);
  #cursor = 0;
  #stderr = "";

  constructor(executable: string, cwd: string) {
    this.child = spawn(process.execPath, [executable], { cwd, stdio: "pipe" });
    this.child.stderr.on("data", (chunk: Buffer) => {
      this.#stderr += chunk.toString("utf8");
    });
    this.child.stdout.on("data", (chunk: Buffer) => {
      this.#buffer = Buffer.concat([this.#buffer, chunk]);
      for (;;) {
        const boundary = this.#buffer.indexOf("\r\n\r\n");
        if (boundary < 0) break;
        const length = /^Content-Length: (\d+)$/imu.exec(
          this.#buffer.subarray(0, boundary).toString("ascii"),
        )?.[1];
        if (length === undefined) throw new Error("Missing protocol frame length");
        const start = boundary + 4;
        const end = start + Number(length);
        if (this.#buffer.length < end) break;
        const message: unknown = JSON.parse(this.#buffer.subarray(start, end).toString("utf8"));
        this.messages.push(message);
        this.#buffer = this.#buffer.subarray(end);
      }
    });
  }

  send(method: string, params: unknown, id?: number) {
    const body = Buffer.from(
      JSON.stringify({ jsonrpc: "2.0", method, params, ...(id === undefined ? {} : { id }) }),
    );
    this.child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
    this.child.stdin.write(body);
  }

  /** Match only existing protocol events, leaving new-feature evidence to ordinary assertions. */
  async wait(predicate: (message: unknown) => boolean): Promise<unknown> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      while (this.#cursor < this.messages.length) {
        const message = this.messages[this.#cursor++];
        if (predicate(message)) return message;
      }
      if (this.child.exitCode !== null || this.child.signalCode !== null)
        throw new Error(`Server exited before a protocol event: ${this.#stderr}`);
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Timed out waiting for a protocol event: ${this.#stderr}`);
  }

  async initialize() {
    this.send("initialize", { processId: null, rootUri: null, capabilities: {} }, 1);
    await this.wait((message) => isRecord(message) && message.id === 1);
    this.send("initialized", {});
  }

  open(uri: string, text: string) {
    this.send("textDocument/didOpen", {
      textDocument: { uri, text, version: 1, languageId: "blend65" },
    });
  }

  change(uri: string, text: string, version: number) {
    this.send("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
  }

  async diagnostics(uri: string) {
    const notification = await this.wait(
      (message) =>
        isRecord(message) &&
        message.method === "textDocument/publishDiagnostics" &&
        isRecord(message.params) &&
        message.params.uri === uri,
    );
    return objects(object(object(notification).params).diagnostics);
  }

  async stop() {
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    await new Promise<void>((resolve) => {
      this.child.once("exit", () => resolve());
      this.child.kill();
      setTimeout(() => {
        this.child.kill("SIGKILL");
        resolve();
      }, 2_000).unref();
    });
  }
}

/** Keep host projects and optional detached installed bytes inside one owned temporary root. */
async function withProject<T>(
  files: Readonly<Record<string, string>>,
  detached: boolean,
  inspect: (fixture: {
    root: string;
    project: string;
    library: string;
    peer: Peer;
    uri: (name: string) => string;
  }) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "blend65-input-lsp-"));
  let peer: Peer | undefined;
  try {
    let executable = join(serverRoot, "dist/server.js");
    let library = join(compilerRoot, "stdlib/c64/input.blend");
    if (detached) {
      const installedCompiler = join(root, "node_modules/@blend65/compiler");
      const installedServer = join(root, "node_modules/@blend65/language-server");
      for (const [from, to] of [
        [compilerRoot, installedCompiler],
        [serverRoot, installedServer],
      ]) {
        await mkdir(to, { recursive: true });
        await cp(join(from, "dist"), join(to, "dist"), { recursive: true });
        await cp(join(from, "package.json"), join(to, "package.json"));
      }
      await cp(dependencyRoot, join(root, "node_modules/jsonc-parser"), { recursive: true });
      for (const name of [
        "vscode-languageserver",
        "vscode-languageserver-protocol",
        "vscode-jsonrpc",
        "vscode-languageserver-types",
        "vscode-languageserver-textdocument",
      ]) {
        await cp(join(repository, "node_modules", name), join(root, "node_modules", name), {
          recursive: true,
        });
      }
      library = join(installedCompiler, "stdlib/c64/input.blend");
      await mkdir(dirname(library), { recursive: true });
      await writeFile(library, libraryText);
      executable = join(installedServer, "dist/server.js");
    }
    const projectRoot = join(root, "game");
    const project = join(projectRoot, "blend65.json");
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      project,
      JSON.stringify({
        schemaVersion: 1,
        name: "input-editor",
        sourceRoot: ".",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: [],
        outDir: "out",
      }),
    );
    for (const [name, text] of Object.entries(files)) {
      await mkdir(dirname(join(projectRoot, name)), { recursive: true });
      await writeFile(join(projectRoot, name), text);
    }
    peer = new Peer(executable, detached ? root : repository);
    await peer.initialize();
    return await inspect({
      root,
      project,
      library,
      peer,
      uri: (name) => pathToFileURL(join(projectRoot, name)).href,
    });
  } finally {
    await peer?.stop();
    await rm(root, { recursive: true, force: true });
  }
}

/** Every original installed proving location must remain labeled and byte-exact in related evidence. */
function installedProof(
  diagnostic: Record<string, unknown>,
  library: string,
  expectedRange: ReturnType<typeof range>,
) {
  const related = objects(diagnostic.relatedInformation);
  const location = related.find(
    (entry) => object(entry.location).uri === pathToFileURL(library).href,
  );
  expect(location, "missing original installed proving location").toBeDefined();
  if (!location) throw new Error("Expected installed related evidence");
  expect(object(location.location).range).toEqual(expectedRange);
  expect(location.message).toEqual(expect.stringMatching(/bundled|installed|library/iu));
}

describe("bundled source diagnostics through real stdio", () => {
  it.each(["0/override.blend", "z/override.blend"])(
    "shows duplicate masks at the exact user name with original installed evidence for %s",
    async (name) => {
      const game =
        "module Game; import { joystickUpMask } from c64.input; const selected: byte = joystickUpMask; function main(): void {}";
      const override = "module c64.input; // é🎮\nexport const joystickUpMask: byte = 7;";
      await withProject(
        { "game.blend": game, [name]: override },
        false,
        async ({ peer, uri, library, project }) => {
          const loaded = await loadProject({ project });
          expect(loaded.kind).toBe("success");
          if (loaded.kind !== "success") throw new Error("Expected user-only editor snapshot");
          const before = structuredClone(loaded.snapshot);
          peer.open(uri(name), override);
          const published = await peer.diagnostics(uri(name));
          const duplicate = published.find(({ code }) => code === "E10003");
          expect(duplicate, "merged user and bundled declarations must conflict").toBeDefined();
          if (!duplicate) throw new Error("Expected duplicate declaration evidence");
          expect(duplicate).toMatchObject({
            code: "E10003",
            severity: 1,
            range: range(override, "joystickUpMask"),
          });
          expect(duplicate.message).toEqual(expect.stringContaining("joystickUpMask"));
          installedProof(
            duplicate,
            library,
            range(await readFile(library, "utf8"), "joystickUpMask"),
          );
          const checked = await analyzeProjectOverlay(loaded.snapshot, []);
          const original = checked.diagnostics.find(({ code }) => code === "E10003");
          expect(original).toBeDefined();
          expect(duplicate.message).toBe(original?.message);
          const correction = "module c64.input; export const extra: byte = 7;";
          peer.change(uri(name), correction, 2);
          expect(
            (await peer.diagnostics(uri(name))).filter(({ severity }) => severity === 1),
          ).toEqual([]);
          expect(loaded.snapshot).toEqual(before);
          expect(loaded.snapshot.sources.map(({ sourceId }) => sourceId)).not.toContain(libraryId);
          expect(await readFile(join(dirname(project), name), "utf8")).toBe(override);
        },
      );
    },
    45_000,
  );

  it("accepts valid named imports and keeps bundled bytes outside editable source overlays", async () => {
    const game =
      "module Game; import { joystickUpMask as up, joystickFireMask } from c64.input; const selected: byte = up + joystickFireMask; function main(): void {}";
    await withProject({ "game.blend": game }, false, async ({ peer, uri, project }) => {
      peer.open(uri("game.blend"), game);
      expect(
        (await peer.diagnostics(uri("game.blend"))).filter(({ severity }) => severity === 1),
      ).toEqual([]);
      const loaded = await loadProject({ project });
      expect(loaded.kind).toBe("success");
      if (loaded.kind !== "success") throw new Error("Expected a user-only snapshot");
      const before = structuredClone(loaded.snapshot);
      expect(loaded.snapshot.sources.map(({ sourceId }) => sourceId)).toEqual(["game.blend"]);
      const attempted = await analyzeProjectOverlay(loaded.snapshot, [
        { sourceId: libraryId, text: libraryText },
      ]);
      expect(attempted.kind).toBe("error");
      expect(attempted.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_PATH_INVALID"]);
      expect(loaded.snapshot).toEqual(before);
    });
  }, 45_000);

  it.each([
    {
      name: "parse",
      declaration: "export const malformed: byte = ;",
      proof: ";",
      code: "PARSE_SYNTAX_ERROR",
      message: "Expected an expression, found ';'",
    },
    {
      name: "type",
      declaration: "export const tooLarge: byte = 256;",
      proof: "256",
      code: "E10084",
      message: null,
    },
  ])(
    "routes a standalone installed $name fault across open-document changes and clears corrections",
    async ({ name, declaration, proof, code, message }) => {
      const game =
        "module Game; import { helper } from Helper; import { joystickUpMask } from c64.input; const selected: byte = joystickUpMask; function main(): void { helper(); missing(); }";
      const helper = "module Helper; export function helper(): void {}";
      await withProject(
        { "game.blend": game, "helper.blend": helper },
        true,
        async ({ peer, uri, library, project }) => {
          const faulty = `${libraryText}${declaration}\n`;
          await writeFile(library, faulty);
          peer.open(uri("game.blend"), game);
          const first = await peer.diagnostics(uri("game.blend"));
          const fault = first.find((diagnostic) => diagnostic.code === code);
          expect(
            fault,
            `installed ${name} fault must be visible on the triggering document`,
          ).toBeDefined();
          if (!fault) throw new Error("Expected installed source fault evidence");
          expect(fault).toMatchObject({ severity: 1, range: emptyRange });
          if (message !== null) expect(fault.message).toBe(message);
          const proofIndex = faulty.lastIndexOf(declaration) + declaration.lastIndexOf(proof);
          const proofStart = Buffer.byteLength(faulty.slice(0, proofIndex));
          const exactRange = {
            start: byteOffsetToPosition(faulty, proofStart),
            end: byteOffsetToPosition(faulty, proofStart + Buffer.byteLength(proof)),
          };
          installedProof(fault, library, exactRange);
          expect(first.find((diagnostic) => diagnostic.code === "E10239")).toMatchObject({
            severity: 1,
            range: range(game, "missing"),
          });
          peer.open(uri("helper.blend"), helper);
          const sibling = await peer.diagnostics(uri("helper.blend"));
          expect(sibling.find((diagnostic) => diagnostic.code === code)).toMatchObject({
            range: emptyRange,
          });
          peer.change(uri("game.blend"), game.replace("missing();", ""), 2);
          const correctedUser = await peer.diagnostics(uri("game.blend"));
          expect(correctedUser.some((diagnostic) => diagnostic.code === "E10239")).toBe(false);
          expect(correctedUser.find((diagnostic) => diagnostic.code === code)).toMatchObject({
            range: emptyRange,
          });
          peer.send("textDocument/didClose", { textDocument: { uri: uri("game.blend") } });
          const remaining = await peer.diagnostics(uri("helper.blend"));
          const retained = remaining.find((diagnostic) => diagnostic.code === code);
          expect(retained).toMatchObject({ range: emptyRange });
          installedProof(object(retained), library, exactRange);
          await writeFile(library, libraryText);
          peer.change(uri("helper.blend"), helper, 2);
          expect(
            (await peer.diagnostics(uri("helper.blend"))).filter(({ severity }) => severity === 1),
          ).toEqual([]);
          await writeFile(library, faulty);
          peer.change(uri("helper.blend"), helper, 3);
          expect(
            (await peer.diagnostics(uri("helper.blend"))).find(
              (diagnostic) => diagnostic.code === code,
            ),
          ).toBeDefined();
          const start = peer.messages.length;
          peer.send("textDocument/didClose", { textDocument: { uri: uri("helper.blend") } });
          expect(await peer.diagnostics(uri("helper.blend"))).toEqual([]);
          peer.send("shutdown", null, 99);
          await peer.wait((message) => isRecord(message) && message.id === 99);
          const later = peer.messages
            .slice(start)
            .filter(
              (message) =>
                isRecord(message) && message.method === "textDocument/publishDiagnostics",
            );
          for (const message of later)
            expect(
              objects(object(object(message).params).diagnostics).some(
                (diagnostic) => diagnostic.code === code,
              ),
            ).toBe(false);
          expect(await readFile(join(dirname(project), "game.blend"), "utf8")).toBe(game);
          expect(await readFile(join(dirname(project), "helper.blend"), "utf8")).toBe(helper);
        },
      );
    },
    60_000,
  );
});
