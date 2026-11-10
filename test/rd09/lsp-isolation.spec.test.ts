import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { LspPeer, positionOf, record } from "./lsp-peer.js";

const SOURCE = [
  "module Game;",
  "",
  "let value: byte = 1;",
  "function main(): void { value = 2; }",
  "",
].join("\n");

/** Write one real project and return its manifest, source URI, and text. */
async function createProject(
  root: string,
  name: string,
): Promise<{ readonly uri: string; readonly text: string }> {
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src/game.blend"), SOURCE);
  await writeFile(
    join(root, "blend65.json"),
    JSON.stringify({
      schemaVersion: 1,
      name,
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
    }),
  );
  return { uri: pathToFileURL(join(root, "src/game.blend")).href, text: SOURCE };
}

/** Open one document on an already initialized peer. */
function open(peer: LspPeer, uri: string, text: string): void {
  peer.send({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { uri, languageId: "blend65", version: 1, text } },
  });
}

/** Match a ready status for one exact document URI. */
function readyFor(uri: string): (message: unknown) => boolean {
  return (message) =>
    record(message) &&
    message.method === "blend65/projectStatus" &&
    record(message.params) &&
    message.params.state === "ready" &&
    message.params.documentUri === uri;
}

describe("language-server project isolation", () => {
  it("should keep two manifests fully isolated", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-rd09-isolation-"));
    const peer = new LspPeer();
    try {
      const first = await createProject(join(root, "one"), "one");
      const second = await createProject(join(root, "two"), "two");
      await peer.request(1, "initialize", {
        processId: null,
        rootUri: null,
        capabilities: {},
      });
      peer.send({ jsonrpc: "2.0", method: "initialized", params: {} });
      open(peer, first.uri, first.text);
      open(peer, second.uri, second.text);
      let sawFirst = false;
      let sawSecond = false;
      while (!sawFirst || !sawSecond) {
        const message = await peer.waitFor(
          (value) => readyFor(first.uri)(value) || readyFor(second.uri)(value),
          10_000,
        );
        if (readyFor(first.uri)(message)) sawFirst = true;
        if (readyFor(second.uri)(message)) sawSecond = true;
      }

      const references = await peer.request(2, "textDocument/references", {
        textDocument: { uri: first.uri },
        position: positionOf(SOURCE, "value"),
        context: { includeDeclaration: true },
      });
      const locations = references.result as { uri: string }[];
      expect(locations).toHaveLength(2);
      expect(new Set(locations.map(({ uri }) => uri))).toEqual(new Set([first.uri]));

      const definition = await peer.request(3, "textDocument/definition", {
        textDocument: { uri: second.uri },
        position: positionOf(SOURCE, "value", 1),
      });
      expect((definition.result as { uri: string }[])[0]?.uri).toBe(second.uri);

      const hover = await peer.request(4, "textDocument/hover", {
        textDocument: { uri: second.uri },
        position: positionOf(SOURCE, "value"),
      });
      expect(record(hover.result) && record(hover.result.contents)).toBe(true);
    } finally {
      await peer.dispose();
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("should report no-project and invalid-project states without inventing a project", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-rd09-status-"));
    const peer = new LspPeer();
    try {
      await peer.request(1, "initialize", {
        processId: null,
        rootUri: null,
        capabilities: {},
      });
      peer.send({ jsonrpc: "2.0", method: "initialized", params: {} });
      const noProject = join(root, "plain.blend");
      await writeFile(noProject, "module Game;\n");
      const noProjectUri = pathToFileURL(noProject).href;
      open(peer, noProjectUri, "module Game;\n");
      await peer.waitFor(
        (message) =>
          record(message) &&
          message.method === "blend65/projectStatus" &&
          record(message.params) &&
          message.params.state === "no-project",
        10_000,
      );

      const invalidRoot = join(root, "invalid");
      await mkdir(join(invalidRoot, "src"), { recursive: true });
      await writeFile(join(invalidRoot, "src/game.blend"), SOURCE);
      await writeFile(join(invalidRoot, "blend65.json"), "{}");
      const invalidUri = pathToFileURL(join(invalidRoot, "src/game.blend")).href;
      open(peer, invalidUri, SOURCE);
      await peer.waitFor(
        (message) =>
          record(message) &&
          message.method === "blend65/projectStatus" &&
          record(message.params) &&
          message.params.state === "invalid",
        10_000,
      );
    } finally {
      await peer.dispose();
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);
});
