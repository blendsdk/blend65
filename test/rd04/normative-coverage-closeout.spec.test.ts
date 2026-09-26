import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const existingProof = "test/rd04/normative-coverage-closeout.spec.test.ts";

/** Narrow parsed JSON before inspecting the closeout fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Check completion and physical proof files without inferring proof quality from a filename.
 * Source-key and full row-shape validation belong to the separate inventory assertions.
 * Canonical paths also prevent an in-repository symlink from escaping the repository.
 */
async function closeoutViolations(document: unknown): Promise<readonly string[]> {
  if (!isRecord(document) || !Array.isArray(document.entries)) {
    throw new Error("The completion record must contain entries");
  }
  const entries: readonly unknown[] = document.entries;
  const root = await realpath(repository);
  const violations: string[] = [];
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.key !== "string") {
      throw new Error("Completion rows must have a source key");
    }
    if (entry.disposition === "planned") {
      violations.push(`${entry.key}: unfinished disposition`);
    }
    if (!Array.isArray(entry.proof) || entry.proof.length === 0) {
      violations.push(`${entry.key}: no proof references`);
      continue;
    }
    const references: readonly unknown[] = entry.proof;
    for (const proof of references) {
      if (
        typeof proof !== "string" ||
        proof.trim().length === 0 ||
        isAbsolute(proof) ||
        win32.isAbsolute(proof) ||
        proof.split(/[\\/]/).includes("..")
      ) {
        violations.push(`${entry.key}: unsafe proof reference`);
        continue;
      }
      try {
        const target = await realpath(resolve(root, proof));
        const contained = relative(root, target);
        if (contained === ".." || contained.startsWith(`..${sep}`) || isAbsolute(contained)) {
          violations.push(`${entry.key}: proof escapes repository`);
        } else if (!(await stat(target)).isFile()) {
          violations.push(`${entry.key}: proof is not a regular file`);
        }
      } catch {
        violations.push(`${entry.key}: proof file is unavailable`);
      }
    }
  }
  return violations;
}

describe("normative coverage closeout", () => {
  // Every recorded obligation must have a terminal disposition and real, contained proof files.
  it("should close every recorded obligation with existing repository proof", async () => {
    const contents = await readFile(new URL("./normative-coverage.json", import.meta.url), "utf8");
    const document: unknown = JSON.parse(contents);
    expect(await closeoutViolations(document)).toEqual([]);
  });

  // Mutate only one completion property so a broken gate cannot pass on unrelated fixture errors.
  it.each([
    {
      name: "a planned row even when its proof exists",
      disposition: "planned",
      proof: [existingProof],
      violation: "unfinished disposition",
    },
    {
      name: "a missing proof file",
      disposition: "implemented",
      proof: [`${existingProof}.missing`],
      violation: "proof file is unavailable",
    },
    {
      name: "an empty proof reference set",
      disposition: "implemented",
      proof: [],
      violation: "no proof references",
    },
    {
      name: "an empty proof reference",
      disposition: "implemented",
      proof: [""],
      violation: "unsafe proof reference",
    },
    {
      name: "a proof reference containing parent traversal",
      disposition: "implemented",
      proof: ["test/rd04/../../package.json"],
      violation: "unsafe proof reference",
    },
    {
      name: "a directory used as proof",
      disposition: "implemented",
      proof: ["test/rd04"],
      violation: "proof is not a regular file",
    },
  ])("should reject $name", async ({ disposition, proof, violation }) => {
    const entry = {
      key: "grammar:conditional_expr",
      kind: "grammar",
      source: "grammar.md",
      owner: "compiler",
      disposition: "implemented",
      proof: [existingProof],
    };
    expect(await closeoutViolations({ entries: [entry] })).toEqual([]);
    expect(await closeoutViolations({ entries: [{ ...entry, disposition, proof }] })).toEqual([
      `${entry.key}: ${violation}`,
    ]);
  });
});
