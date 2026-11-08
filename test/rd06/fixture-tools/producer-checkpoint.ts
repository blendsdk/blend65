import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One checked producer-evidence manifest shape. */
interface ProducerManifest {
  readonly schemaVersion: 1;
  readonly producerRoot: string;
  readonly retention: { readonly disposition: string };
  readonly manuals: readonly { readonly path: string; readonly sha256: string }[];
  readonly fixtures: readonly {
    readonly family: string;
    readonly path: string;
    readonly sha256: string;
    readonly producerVersion: string;
  }[];
}

/** Result of one producer checkpoint. */
export interface ProducerCheckpoint {
  /** Whether the licensed application folder is present on this host. */
  readonly available: boolean;
  /** Every deterministic violation; empty when the checkpoint passes. */
  readonly violations: readonly string[];
}

/** Hash one file without text decoding. */
function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Validate the local producer-evidence checkpoint.
 *
 * The checkpoint is honest when the vendor applications are absent: it then
 * reports `available: false` and does not claim producer verification.
 */
export function validateProducerCheckpoint(repository: string): ProducerCheckpoint {
  const manifestPath = join(repository, "test/rd06/fixtures/producer-evidence.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ProducerManifest;
  const violations: string[] = [];
  if (manifest.schemaVersion !== 1) violations.push("producer manifest schema is not 1");
  if (manifest.retention.disposition !== "local-only") {
    violations.push("producer retention must stay local-only");
  }
  for (const family of ["spritepad", "charpad", "goattracker"]) {
    if (existsSync(join(repository, "test/rd06/fixtures/public", family))) {
      violations.push(`producer family '${family}' must not be committed under public fixtures`);
    }
  }
  const available = existsSync(manifest.producerRoot);
  if (available) {
    for (const item of [...manifest.manuals, ...manifest.fixtures]) {
      const path = join(manifest.producerRoot, item.path);
      if (!existsSync(path)) {
        violations.push(`missing producer file: ${item.path}`);
      } else if (sha256(path) !== item.sha256) {
        violations.push(`producer hash mismatch: ${item.path}`);
      }
    }
    for (const fixture of manifest.fixtures) {
      if (fixture.producerVersion !== "3.80") {
        violations.push(`producer version must be 3.80: ${fixture.path}`);
      }
    }
  }
  return Object.freeze({ available, violations: Object.freeze(violations) });
}
