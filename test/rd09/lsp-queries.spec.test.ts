import { describe, expect, it } from "vitest";
import { positionOf, record, withLspProject } from "./lsp-peer.js";

const SOURCE = [
  "module Game;",
  "",
  "let counter: byte = 1;",
  "const LIMIT: byte = 10;",
  "",
  "struct Point { x: byte; y: byte; }",
  "",
  "function add(a: byte, b: byte): byte {",
  "    let sum: byte = a + b;",
  "    return sum;",
  "}",
  "",
  "function main(): void {",
  "    let p: Point = { x: 1, y: 2 };",
  "    counter = add(counter, LIMIT);",
  "    p.x = counter;",
  "}",
  "",
].join("\n");

/** Read one protocol result object. */
function resultOf(message: Record<string, unknown>): Record<string, unknown> {
  if (!record(message.result)) throw new Error("Missing protocol result");
  return message.result;
}

describe("language-server queries over real stdio", () => {
  it("should complete visible symbols and member fields without out-of-scope locals", async () => {
    await withLspProject(
      SOURCE,
      async (peer, uri) => {
        let id = 2;
        const completion = resultOf(
          await peer.request(id++, "textDocument/completion", {
            textDocument: { uri },
            position: positionOf(SOURCE, "let p: Point"),
          }),
        );
        expect(Array.isArray(completion.items)).toBe(true);
        const items = completion.items as { label: string }[];
        const labels = items.map(({ label }) => label);
        expect(labels).toContain("counter");
        expect(labels).toContain("add");
        expect(labels).toContain("Point");
        expect(labels).not.toContain("sum");

        const members = resultOf(
          await peer.request(id++, "textDocument/completion", {
            textDocument: { uri },
            position: {
              line: positionOf(SOURCE, "p.x = counter").line,
              character: positionOf(SOURCE, "p.x = counter").character + 2,
            },
          }),
        );
        expect((members.items as { label: string }[]).map(({ label }) => label).sort()).toEqual([
          "x",
          "y",
        ]);
      },
      15_000,
    );
  });

  it("should report sourced hover, signature help, definition, and references", async () => {
    await withLspProject(
      SOURCE,
      async (peer, uri) => {
        let id = 2;
        const hover = resultOf(
          await peer.request(id++, "textDocument/hover", {
            textDocument: { uri },
            position: positionOf(SOURCE, "counter"),
          }),
        );
        expect(record(hover.contents)).toBe(true);
        expect(String(hover.contents.value)).toContain("variable Game.counter: byte");
        expect(String(hover.contents.value)).not.toContain("Compile-time value");

        const functionHover = resultOf(
          await peer.request(id++, "textDocument/hover", {
            textDocument: { uri },
            position: positionOf(SOURCE, "add"),
          }),
        );
        expect(String(functionHover.contents.value)).toContain("function Game.add");

        const call = positionOf(SOURCE, "add(counter, LIMIT)");
        const signature = resultOf(
          await peer.request(id++, "textDocument/signatureHelp", {
            textDocument: { uri },
            position: { line: call.line, character: call.character + "add(counter, ".length },
          }),
        );
        const signatures = signature.signatures as {
          parameters: { label: string }[];
        }[];
        expect(signatures[0]?.parameters.map(({ label }) => label)).toEqual(["a: byte", "b: byte"]);
        expect(signature.activeParameter).toBe(1);

        const definition = await peer.request(id++, "textDocument/definition", {
          textDocument: { uri },
          position: positionOf(SOURCE, "counter", 1),
        });
        const locations = definition.result as { range: { start: { line: number } } }[];
        expect(locations[0]?.range.start.line).toBe(positionOf(SOURCE, "counter").line);

        const references = await peer.request(id++, "textDocument/references", {
          textDocument: { uri },
          position: positionOf(SOURCE, "counter"),
          context: { includeDeclaration: true },
        });
        expect(references.result as unknown[]).toHaveLength(4);
      },
      15_000,
    );
  });

  it("should rename every semantic reference and return bounded symbols and tokens", async () => {
    await withLspProject(
      SOURCE,
      async (peer, uri) => {
        let id = 2;
        const prepare = resultOf(
          await peer.request(id++, "textDocument/prepareRename", {
            textDocument: { uri },
            position: positionOf(SOURCE, "counter"),
          }),
        );
        expect(record(prepare.range)).toBe(true);

        const rename = resultOf(
          await peer.request(id++, "textDocument/rename", {
            textDocument: { uri },
            position: positionOf(SOURCE, "counter"),
            newName: "total",
          }),
        );
        const changes = rename.changes as Record<string, unknown[]>;
        expect(Object.values(changes)[0]).toHaveLength(4);

        const symbols = await peer.request(id++, "textDocument/documentSymbol", {
          textDocument: { uri },
        });
        const names = (symbols.result as { name: string }[]).map(({ name }) => name);
        expect(names).toEqual(["Game", "counter", "LIMIT", "Point", "add", "main"]);

        const workspace = await peer.request(id++, "workspace/symbol", { query: "counter" });
        expect(workspace.result as unknown[]).toHaveLength(1);

        const tokens = resultOf(
          await peer.request(id++, "textDocument/semanticTokens/full", {
            textDocument: { uri },
          }),
        );
        expect(Array.isArray(tokens.data)).toBe(true);
        expect((tokens.data as number[]).length).toBeGreaterThan(0);

        const actions = await peer.request(id++, "textDocument/codeAction", {
          textDocument: { uri },
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          context: { diagnostics: [] },
        });
        expect(actions.result).toEqual([]);
      },
      15_000,
    );
  });

  it("should complete a contained embed() asset path", async () => {
    const source = [
      "module Game;",
      "",
      'const DATA: byte[4] = embed("level1.map");',
      "function main(): void {}",
      "",
    ].join("\n");
    await withLspProject(
      source,
      async (peer, uri) => {
        const completion = await peer.request(2, "textDocument/completion", {
          textDocument: { uri },
          position: positionOf(source, "level1.map"),
        });
        const result = completion.result as { items: { label: string; kind: number }[] };
        expect(result.items.map(({ label }) => label)).toContain("level1.map");
      },
      { extraFiles: { "assets/level1.map": "ABCD" }, assetPaths: ["assets"] },
    );
  }, 15_000);

  it("should return one canonical full-document format edit", async () => {
    const compact = "module Game;\nlet x:byte=1;\nfunction main():void{x=2;}\n";
    await withLspProject(compact, async (peer, uri) => {
      const formatted = await peer.request(2, "textDocument/formatting", {
        textDocument: { uri },
        options: { tabSize: 4, insertSpaces: true },
      });
      const edits = formatted.result as { newText: string }[];
      expect(edits).toHaveLength(1);
      expect(edits[0]?.newText).toBe(
        "module Game;\nlet x: byte = 1;\nfunction main(): void {\n    x = 2;\n}\n",
      );
    });
  }, 15_000);
});
