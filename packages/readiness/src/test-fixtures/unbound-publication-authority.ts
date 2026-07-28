import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PROMOTED_HANDLER_IDS = new Set([
  "generator.compiler-cases",
  "generator.frontend-cases",
  "generator.runtime-cases",
  "transform.boundary-variants",
]);

const BOUND_GENERATION_DIGEST =
  "sha256:3416cae59b38d211d580015cc80d45905d7345ee124c52afdb3bbca2da10a3f1";
const UNBOUND_GENERATION_DIGEST =
  "sha256:2e9cf80d73718e6dd52790934ac20f0eab200f73b2bcff2c23d389e637dc2dfd";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function restoreGeneratedDigest(filePath: string): Promise<void> {
  const source = await readFile(filePath, "utf8");
  const firstOccurrence = source.indexOf(BOUND_GENERATION_DIGEST);
  if (
    firstOccurrence < 0 ||
    source.indexOf(BOUND_GENERATION_DIGEST, firstOccurrence + BOUND_GENERATION_DIGEST.length) >= 0
  ) {
    throw new TypeError(`Publication fixture ${filePath} does not contain one bound digest.`);
  }
  await writeFile(filePath, source.replace(BOUND_GENERATION_DIGEST, UNBOUND_GENERATION_DIGEST));
}

/**
 * Restores the reviewed pre-publication authority inside an isolated test repository.
 *
 * The checked-in repository correctly retains the selected publication and bound declarations
 * after release. Publication tests need the earlier unbound state so they can exercise the whole
 * transition from candidate validation through pointer selection. This helper changes only the
 * four version-one publication bindings and installs the accepted review evidence for that exact
 * unbound state.
 */
export async function restoreUnboundPublicationAuthority(
  repositoryRoot: string,
  fixtureRoot: string,
): Promise<void> {
  await rm(join(fixtureRoot, "readiness/publications"), { recursive: true, force: true });

  const inventoryPath = join(fixtureRoot, "readiness/inventory/compiler-readiness-v1.json");
  const inventory: unknown = JSON.parse(await readFile(inventoryPath, "utf8"));
  if (!isRecord(inventory) || !Array.isArray(inventory.handlerDeclarations)) {
    throw new TypeError("Publication fixture inventory has an invalid handler declaration shape.");
  }

  let restored = 0;
  for (const declaration of inventory.handlerDeclarations) {
    if (
      !isRecord(declaration) ||
      typeof declaration.id !== "string" ||
      !PROMOTED_HANDLER_IDS.has(declaration.id)
    ) {
      continue;
    }
    if (declaration.binding !== "bound") {
      throw new TypeError(`Publication fixture handler ${declaration.id} is not bound.`);
    }
    declaration.binding = "unbound";
    restored += 1;
  }
  if (restored !== PROMOTED_HANDLER_IDS.size) {
    throw new TypeError("Publication fixture does not contain the exact version-one handler set.");
  }
  await writeFile(inventoryPath, `${JSON.stringify(inventory)}\n`);

  await copyFile(
    join(
      repositoryRoot,
      "packages/readiness/src/test-fixtures/unbound-compiler-readiness-v1-review.json",
    ),
    join(fixtureRoot, "readiness/reviews/compiler-readiness-v1-review.json"),
  );

  await Promise.all([
    restoreGeneratedDigest(join(fixtureRoot, "readiness/generated/compiler-readiness.md")),
    restoreGeneratedDigest(join(fixtureRoot, "packages/readiness/src/generated/declarations.ts")),
  ]);
}
