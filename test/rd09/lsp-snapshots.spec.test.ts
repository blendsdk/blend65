import { describe, expect, it } from "vitest";
import { positionOf, record, withLspProject } from "./lsp-peer.js";

const V1 = [
  "module Game;",
  "",
  "let alpha: byte = 1;",
  "function main(): void { alpha = 2; }",
  "",
].join("\n");
const V2 = [
  "module Game;",
  "",
  "let beta: byte = 1;",
  "function main(): void { beta = 2; }",
  "",
].join("\n");

/** Read one hover markdown body. */
function hoverText(message: Record<string, unknown>): string | null {
  if (!record(message.result) || !record(message.result.contents)) return null;
  const value = message.result.contents.value;
  return typeof value === "string" ? value : null;
}

describe("language-server versioned snapshots", () => {
  it("should analyze unsaved version 2 and restore the saved view after close", async () => {
    await withLspProject(V1, async (peer, uri) => {
      let id = 2;
      peer.send({
        jsonrpc: "2.0",
        method: "textDocument/didChange",
        params: {
          textDocument: { uri, version: 2 },
          contentChanges: [{ text: V2 }],
        },
      });
      await peer.waitFor(
        (message) =>
          record(message) &&
          message.method === "blend65/projectStatus" &&
          record(message.params) &&
          message.params.state === "ready",
        10_000,
      );
      const beta = await peer.request(id++, "textDocument/hover", {
        textDocument: { uri },
        position: positionOf(V2, "beta"),
      });
      expect(hoverText(beta)).toContain("beta");

      const alpha = await peer.request(id++, "textDocument/hover", {
        textDocument: { uri },
        position: positionOf(V2, "beta"),
      });
      expect(hoverText(alpha)).toContain("beta");

      peer.send({
        jsonrpc: "2.0",
        method: "textDocument/didClose",
        params: { textDocument: { uri } },
      });
      peer.send({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: { textDocument: { uri, languageId: "blend65", version: 1, text: V1 } },
      });
      await peer.waitFor(
        (message) =>
          record(message) &&
          message.method === "blend65/projectStatus" &&
          record(message.params) &&
          message.params.state === "ready",
        10_000,
      );
      const restored = await peer.request(id++, "textDocument/hover", {
        textDocument: { uri },
        position: positionOf(V1, "alpha"),
      });
      expect(hoverText(restored)).toContain("alpha");
    });
  }, 20_000);

  it("should publish the newest result when a broken version is superseded", async () => {
    const broken = ["module Game;", "", "let broken: = 1;", ""].join("\n");
    await withLspProject(
      broken,
      async (peer, uri) => {
        peer.send({
          jsonrpc: "2.0",
          method: "textDocument/didChange",
          params: {
            textDocument: { uri, version: 2 },
            contentChanges: [{ text: V2 }],
          },
        });
        await peer.waitFor(
          (message) =>
            record(message) &&
            message.method === "blend65/projectStatus" &&
            record(message.params) &&
            message.params.state === "ready",
          10_000,
        );
        const diagnostics = await peer.waitFor(
          (message) =>
            record(message) &&
            message.method === "textDocument/publishDiagnostics" &&
            record(message.params) &&
            message.params.uri === uri &&
            Array.isArray(message.params.diagnostics) &&
            message.params.diagnostics.length === 0,
          10_000,
        );
        expect(record(diagnostics)).toBe(true);
      },
      { waitForReady: false },
    );
  }, 20_000);
});
