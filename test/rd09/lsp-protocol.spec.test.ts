import { describe, expect, it } from "vitest";
import { positionOf, record, withLspProject } from "./lsp-peer.js";

const SOURCE = [
  "module Game;",
  "",
  "let value: byte = 1;",
  "function main(): void { value = 2; }",
  "",
].join("\n");

describe("language-server protocol robustness", () => {
  it("should return bounded outcomes for unknown methods and malformed requests", async () => {
    await withLspProject(
      SOURCE,
      async (peer, uri) => {
        const unknown = await peer.request(2, "blend65/unknown", {});
        expect(record(unknown.error)).toBe(true);
        expect(unknown.result).toBeUndefined();

        const missing = await peer.request(3, "textDocument/completion", {
          textDocument: { uri: "file:///no/such/file.blend" },
          position: { line: 0, character: 0 },
        });
        expect(missing.result).toBeNull();

        const malformed = await peer.request(4, "textDocument/completion", {
          textDocument: { uri },
          position: { line: -1, character: 0 },
        });
        expect(malformed.result).toBeNull();

        const alive = await peer.request(5, "textDocument/hover", {
          textDocument: { uri },
          position: positionOf(SOURCE, "value"),
        });
        expect(record(alive.result)).toBe(true);
      },
      15_000,
    );
  }, 15_000);
});
