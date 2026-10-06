import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  profileSpan,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const TARGETS = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

const SOURCE = `module Game;
import { setIRQ, restoreIRQ } from c64.system;

interrupt function B(): void {}

interrupt function A(): void {
  setIRQ(&B);
  restoreIRQ();
}

function G(): void {
  let nestedByte: byte = peek($c024);
  poke($c026, nestedByte);
}

function H(): void {
  G();
}

export function main(): void {
  setIRQ(&A);
  let savedByte: byte = peek($c020);
  H();
  poke($c022, savedByte);
  restoreIRQ();
}
`;

type ByteHome = { start: number; end: number };

/** Require a finite integer address before comparing public memory ranges. */
function address(value: unknown): number {
  expect(typeof value).toBe("number");
  expect(Number.isSafeInteger(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(0);
  return value as number;
}

/** Resolve one source declaration without relying on an emitted symbol spelling. */
function declarationHomes(
  debug: Record<string, unknown>,
  declaration: string,
  identifier: string,
  owner: string,
): ByteHome[] {
  const proof = profileSpan(SOURCE, declaration);
  const identifierOffset = declaration.indexOf(identifier);
  expect(identifierOffset).toBeGreaterThanOrEqual(0);
  const identifierStart = proof.start + Buffer.byteLength(declaration.slice(0, identifierOffset));
  const identifierEnd = identifierStart + Buffer.byteLength(identifier);
  const sources = profileRecords(debug.sources);
  const sourceIndices = sources.flatMap((source, index) =>
    source.path === proof.sourceId ? [index] : [],
  );
  expect(sourceIndices, "the fixture source must have one debug identity").toHaveLength(1);
  const sourceIndex = sourceIndices[0]!;
  expect(sources[sourceIndex]!.byteLength).toBe(Buffer.byteLength(SOURCE));

  const symbols = profileRecords(debug.symbols);
  const matchingSymbols = symbols.flatMap((symbol, index) => {
    if (symbol.kind !== "local" || symbol.scope !== `${proof.sourceId}::Game.${owner}`) return [];
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return [];
    const span = profileRecord(origin.span);
    return span.sourceIndex === sourceIndex &&
      typeof span.startByte === "number" &&
      typeof span.endByte === "number" &&
      span.startByte >= proof.start &&
      span.endByte <= proof.end &&
      span.startByte <= identifierStart &&
      span.endByte >= identifierEnd
      ? [index]
      : [];
  });
  expect(matchingSymbols, `${owner} must expose exactly the requested declaration`).toHaveLength(1);
  const symbolIndex = matchingSymbols[0]!;
  expect(symbols[symbolIndex]!.byteWidth).toBe(1);

  const locations = profileRecords(debug.locations).filter(
    (location) => location.symbolIndex === symbolIndex,
  );
  expect(locations.length, `${owner} must expose a storage location`).toBeGreaterThan(0);
  const homes = locations.flatMap((location) => {
    const availability = profileRecord(location.availability);
    expect(["available", "split"]).toContain(availability.kind);
    const pieces = profileRecords(availability.pieces);
    expect(pieces.length, `${owner} must expose a memory piece`).toBeGreaterThan(0);
    return pieces.map((piece) => {
      expect(piece.kind).toBe("memory");
      const machine = profileRecord(piece.machine);
      const start = address(machine.start);
      const end = address(machine.end);
      expect(end - start, `${owner} stores one byte`).toBe(1);
      return { start, end };
    });
  });
  expect(homes.length, `${owner} must have nonempty byte homes`).toBeGreaterThan(0);
  return homes;
}

describe("IRQ installation and transitive caller lifetimes", () => {
  it.each(TARGETS)(
    "%s preserves a caller byte while a nested callee byte is live",
    async (target) => {
      await withProfileProject(SOURCE, target, async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("The ordinary IRQ fixture must build");
        const { debug } = await readProfileArtifacts(built);
        const callerHomes = declarationHomes(
          debug,
          "let savedByte: byte = peek($c020);",
          "savedByte",
          "main",
        );
        const calleeHomes = declarationHomes(
          debug,
          "let nestedByte: byte = peek($c024);",
          "nestedByte",
          "G",
        );
        for (const caller of callerHomes) {
          for (const callee of calleeHomes) {
            expect(
              caller.end <= callee.start || callee.end <= caller.start,
              "the post-call caller value and nested callee value need disjoint live storage",
            ).toBe(true);
          }
        }
      });
    },
  );
});
